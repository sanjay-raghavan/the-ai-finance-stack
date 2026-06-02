"""OAuth 2.0 flow + token management for Intuit QBO.

Intuit-specific quirks this module handles:
  - Access tokens last 60 minutes; refresh tokens last 101 days.
  - The realm ID (company ID) is delivered in the OAuth redirect query string,
    NOT in the token response — so we capture it at authorization time.
  - Refresh tokens rotate on each refresh; we must persist the new one each time.
  - Intuit accepts only HTTPS redirect URIs in production for new apps, but
    http://localhost:* is allowed for local-only personal use (which is us).

The setup flow (one-time):
  1. User runs `python -m qbo_mcp.server --setup`
  2. We open a browser to Intuit's authorization URL
  3. User signs in, authorizes the app, gets redirected to our local callback
  4. Local server captures (code, state, realmId), exchanges code for tokens
  5. We persist (refresh_token, realm_id, env, client_id_hash) to ~/.config/...

The runtime flow (every API call):
  1. Load the persisted refresh_token + realm_id
  2. Use refresh_token to get a fresh access_token (60-min lifetime)
  3. Cache access_token in memory until 5 min before expiry
  4. On expiry, refresh again — and persist the new refresh_token
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import secrets
import time
import webbrowser
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse

import httpx

from .config import Config

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Persisted credentials shape
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class StoredCredentials:
    refresh_token: str
    realm_id: str
    environment: str
    client_id_hash: str  # SHA-256 of client_id; sanity check we're using right app
    saved_at: float

    def to_json(self) -> dict:
        return {
            "refresh_token": self.refresh_token,
            "realm_id": self.realm_id,
            "environment": self.environment,
            "client_id_hash": self.client_id_hash,
            "saved_at": self.saved_at,
        }

    @classmethod
    def from_json(cls, data: dict) -> "StoredCredentials":
        return cls(
            refresh_token=data["refresh_token"],
            realm_id=data["realm_id"],
            environment=data["environment"],
            client_id_hash=data["client_id_hash"],
            saved_at=data["saved_at"],
        )


def _client_id_hash(client_id: str) -> str:
    return hashlib.sha256(client_id.encode("utf-8")).hexdigest()[:16]


def load_credentials(config: Config) -> Optional[StoredCredentials]:
    """Load credentials from disk; return None if not yet set up."""
    if not config.creds_path.exists():
        return None
    try:
        with open(config.creds_path) as f:
            creds = StoredCredentials.from_json(json.load(f))
    except (json.JSONDecodeError, KeyError) as e:
        raise RuntimeError(
            f"Credentials file at {config.creds_path} is corrupt: {e}. "
            f"Delete it and re-run setup."
        )

    # Sanity: client ID hash must match (catches "wrong .env loaded" foot-gun)
    expected = _client_id_hash(config.client_id)
    if creds.client_id_hash != expected:
        raise RuntimeError(
            "Saved credentials were created for a different Intuit Client ID. "
            "Either fix your .env to match, or delete the credentials file "
            f"({config.creds_path}) and re-run setup."
        )
    if creds.environment != config.environment:
        raise RuntimeError(
            f"Saved credentials are for environment={creds.environment!r} but "
            f"current config says {config.environment!r}. Delete the credentials "
            f"file or fix QBO_ENVIRONMENT in .env."
        )
    return creds


def save_credentials(config: Config, creds: StoredCredentials) -> None:
    """Persist credentials to disk with 0600 permissions."""
    config.creds_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config.creds_path, "w") as f:
        json.dump(creds.to_json(), f, indent=2)
    config.creds_path.chmod(0o600)
    logger.info("Saved credentials to %s", config.creds_path)


# ─────────────────────────────────────────────────────────────────────────────
# OAuth one-time setup — runs a tiny local HTTP server to catch the redirect
# ─────────────────────────────────────────────────────────────────────────────


class _CallbackHandler(BaseHTTPRequestHandler):
    """Captures the OAuth redirect query string and stashes it on the server."""

    def do_GET(self) -> None:  # noqa: N802 — required by stdlib base class
        parsed = urlparse(self.path)
        if parsed.path != "/callback":
            self.send_response(404)
            self.end_headers()
            return

        params = parse_qs(parsed.query)
        # Intuit redirects with: code, state, realmId
        self.server.oauth_params = {  # type: ignore[attr-defined]
            "code": params.get("code", [""])[0],
            "state": params.get("state", [""])[0],
            "realmId": params.get("realmId", [""])[0],
            "error": params.get("error", [""])[0],
        }

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(
            b"<!DOCTYPE html><html><head><title>QBO MCP Setup</title>"
            b"<style>body{font-family:-apple-system,sans-serif;max-width:560px;"
            b"margin:80px auto;padding:0 20px;color:#111;line-height:1.5}"
            b"h1{font-size:1.5rem}.box{background:#f8fafc;border-left:4px solid #0066cc;"
            b"padding:16px 20px;margin:1em 0;border-radius:4px}</style></head>"
            b"<body><h1>Authorization received.</h1>"
            b"<div class='box'>You can close this tab and return to your terminal. "
            b"The QBO MCP server is finishing setup.</div></body></html>"
        )

    def log_message(self, *_args: object) -> None:  # silence default access log
        return


def _build_auth_url(config: Config, state: str) -> str:
    """Construct the Intuit authorization URL."""
    # Scopes: read-only access to accounting + payments data
    scopes = "com.intuit.quickbooks.accounting"
    params = {
        "client_id": config.client_id,
        "scope": scopes,
        "redirect_uri": config.redirect_uri,
        "response_type": "code",
        "state": state,
    }
    return f"{config.auth_base_url}/connect/oauth2?{urlencode(params)}"


async def run_setup(config: Config) -> StoredCredentials:
    """Run the one-time OAuth setup flow.

    Opens the browser, captures the callback, exchanges the code for tokens,
    and persists the refresh token + realm ID. Returns the stored credentials.
    """
    # Two redirect URI patterns are supported:
    #   1. http://localhost:<port>/callback — direct, used for sandbox/dev where
    #      Intuit accepts HTTP localhost redirects.
    #   2. https://<cf-worker>/oauth-callback — proxied through the registry
    #      Worker, required for Intuit Production (which mandates HTTPS for
    #      registered redirect URIs). The Worker 302-redirects the callback to
    #      http://localhost:8765/callback so the local listener captures it.
    parsed_redirect = urlparse(config.redirect_uri)
    if parsed_redirect.hostname in ("localhost", "127.0.0.1"):
        port = parsed_redirect.port or 8765
    elif parsed_redirect.scheme == "https":
        # Production via the Cloudflare Worker proxy. The local listener still
        # binds to port 8765 / path /callback; the Worker handles the redirect.
        port = 8765
        logger.info(
            "Using HTTPS redirect URI %s (assumed to proxy to "
            "http://localhost:8765/callback via the registry Worker).",
            config.redirect_uri,
        )
    else:
        raise SystemExit(
            f"QBO_REDIRECT_URI must be either http://localhost:* or an "
            f"https:// URL routed through a proxy (e.g. the AI Finance Stack "
            f"registry Worker). Got: {config.redirect_uri}"
        )

    state = secrets.token_urlsafe(24)
    auth_url = _build_auth_url(config, state)

    print()
    print("─" * 72)
    print("  QBO MCP — One-Time Setup")
    print("─" * 72)
    print()
    print(f"  Environment: {config.environment}")
    print(f"  Listening for OAuth callback on http://localhost:{port}")
    print()
    print("  Opening your browser to authorize this app with Intuit…")
    print("  If it doesn't open, copy/paste this URL:")
    print()
    print(f"    {auth_url}")
    print()

    server = HTTPServer(("localhost", port), _CallbackHandler)
    server.oauth_params = None  # type: ignore[attr-defined]
    server.timeout = 0.5

    webbrowser.open(auth_url)

    # Wait up to 5 minutes for the user to authorize
    deadline = time.time() + 300
    while time.time() < deadline and server.oauth_params is None:  # type: ignore[attr-defined]
        server.handle_request()
        await asyncio.sleep(0.05)

    params = server.oauth_params  # type: ignore[attr-defined]
    if params is None:
        raise SystemExit("Authorization timed out (5 min). Try again.")
    if params.get("error"):
        raise SystemExit(f"Authorization failed: {params['error']}")
    if params.get("state") != state:
        raise SystemExit("State mismatch — possible CSRF. Abort setup.")
    if not params.get("realmId"):
        raise SystemExit(
            "No realmId returned from Intuit. Make sure your app is configured "
            "for QuickBooks Online accounting scope."
        )

    code = params["code"]
    realm_id = params["realmId"]

    # Exchange authorization code for the first access + refresh tokens
    async with httpx.AsyncClient(timeout=30.0) as client:
        token_resp = await client.post(
            config.token_endpoint,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic "
                + base64.b64encode(
                    f"{config.client_id}:{config.client_secret}".encode("utf-8")
                ).decode("ascii"),
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": config.redirect_uri,
            },
        )
    token_resp.raise_for_status()
    body = token_resp.json()

    creds = StoredCredentials(
        refresh_token=body["refresh_token"],
        realm_id=realm_id,
        environment=config.environment,
        client_id_hash=_client_id_hash(config.client_id),
        saved_at=time.time(),
    )
    save_credentials(config, creds)

    print()
    print("─" * 72)
    print(f"  Setup complete. Realm ID: {realm_id}")
    print(f"  Credentials saved to: {config.creds_path}")
    print("─" * 72)
    print()

    return creds


# ─────────────────────────────────────────────────────────────────────────────
# Runtime token refresh — used on every API call
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class AccessToken:
    token: str
    expires_at: float


class TokenManager:
    """Caches an access token in memory; refreshes when expired."""

    def __init__(self, config: Config) -> None:
        self._config = config
        self._creds: Optional[StoredCredentials] = None
        self._access_token: Optional[AccessToken] = None
        self._lock = asyncio.Lock()

    def _load_creds_or_die(self) -> StoredCredentials:
        if self._creds is None:
            creds = load_credentials(self._config)
            if creds is None:
                raise SystemExit(
                    "QBO MCP is not set up yet. Run:\n"
                    "    python -m qbo_mcp.server --setup\n"
                    "to authenticate against Intuit."
                )
            self._creds = creds
        return self._creds

    @property
    def realm_id(self) -> str:
        return self._load_creds_or_die().realm_id

    async def get_access_token(self) -> str:
        """Return a valid access token, refreshing if necessary."""
        async with self._lock:
            if (
                self._access_token is not None
                and self._access_token.expires_at - 60 > time.time()
            ):
                return self._access_token.token

            creds = self._load_creds_or_die()
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    self._config.token_endpoint,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": "Basic "
                        + base64.b64encode(
                            f"{self._config.client_id}:{self._config.client_secret}".encode(
                                "utf-8"
                            )
                        ).decode("ascii"),
                    },
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": creds.refresh_token,
                    },
                )
            # Capture Intuit's transaction ID for support correlation
            intuit_tid = resp.headers.get("intuit_tid", "(missing)")

            if resp.status_code == 400:
                raise RuntimeError(
                    f"Refresh token rejected by Intuit (intuit_tid={intuit_tid}; "
                    "likely expired — refresh tokens last 101 days). "
                    "Re-run setup: python -m qbo_mcp.server --setup"
                )
            if resp.status_code >= 400:
                try:
                    err_detail = resp.json()
                except Exception:
                    err_detail = resp.text
                raise RuntimeError(
                    f"QBO token endpoint error {resp.status_code} "
                    f"(intuit_tid={intuit_tid}): {err_detail}"
                )
            body = resp.json()

            # Persist the rotated refresh token immediately
            new_creds = StoredCredentials(
                refresh_token=body["refresh_token"],
                realm_id=creds.realm_id,
                environment=creds.environment,
                client_id_hash=creds.client_id_hash,
                saved_at=time.time(),
            )
            save_credentials(self._config, new_creds)
            self._creds = new_creds

            self._access_token = AccessToken(
                token=body["access_token"],
                expires_at=time.time() + int(body["expires_in"]),
            )
            logger.debug(
                "Refreshed QBO access token; expires in %ss  intuit_tid=%s",
                body["expires_in"], intuit_tid,
            )
            return self._access_token.token
