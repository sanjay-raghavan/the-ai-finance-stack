"""Configuration loading + credential storage paths.

Reads from .env (and process env), validates required fields, and exposes a
typed Config object used by the rest of the server.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv


def _default_creds_path() -> Path:
    """Default location for the persisted refresh token + realm ID."""
    base = Path(os.path.expanduser("~/.config/finance-stack/credentials"))
    return base / "qbo.json"


@dataclass(frozen=True)
class Config:
    client_id: str
    client_secret: str
    environment: Literal["production", "sandbox"]
    redirect_uri: str
    creds_path: Path
    log_level: str

    @property
    def api_base_url(self) -> str:
        """Intuit's REST API base URL for the configured environment."""
        if self.environment == "production":
            return "https://quickbooks.api.intuit.com"
        return "https://sandbox-quickbooks.api.intuit.com"

    @property
    def auth_base_url(self) -> str:
        """OAuth 2.0 authorization endpoint base. Same URL across envs."""
        return "https://appcenter.intuit.com"

    @property
    def token_endpoint(self) -> str:
        return "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"


def load_config() -> Config:
    """Load + validate config from .env (and process environment)."""
    load_dotenv()

    client_id = os.environ.get("QBO_CLIENT_ID", "").strip()
    client_secret = os.environ.get("QBO_CLIENT_SECRET", "").strip()
    environment = os.environ.get("QBO_ENVIRONMENT", "production").strip().lower()
    redirect_uri = os.environ.get(
        "QBO_REDIRECT_URI", "http://localhost:8765/callback"
    ).strip()
    creds_path = Path(
        os.environ.get("QBO_CREDS_PATH", str(_default_creds_path()))
    ).expanduser()
    log_level = os.environ.get("QBO_LOG_LEVEL", "INFO").strip().upper()

    if not client_id or client_id == "your_client_id_here":
        raise SystemExit(
            "QBO_CLIENT_ID is not set. Copy .env.example to .env and fill in your "
            "Intuit Developer credentials. See README for details."
        )
    if not client_secret or client_secret == "your_client_secret_here":
        raise SystemExit(
            "QBO_CLIENT_SECRET is not set. Copy .env.example to .env and fill in "
            "your Intuit Developer credentials. See README for details."
        )
    if environment not in ("production", "sandbox"):
        raise SystemExit(
            f"QBO_ENVIRONMENT must be 'production' or 'sandbox', got: {environment!r}"
        )

    return Config(
        client_id=client_id,
        client_secret=client_secret,
        environment=environment,  # type: ignore[arg-type]
        redirect_uri=redirect_uri,
        creds_path=creds_path,
        log_level=log_level,
    )
