"""Thin async HTTP client for the QBO REST API.

Wraps token management + base URL + common headers. Tools call this client's
methods rather than constructing HTTP requests directly.

Read-only in v0.1 — only GET requests and the Query endpoint (which is POST
but logically a read). No POST that creates entities, no PUT, no DELETE.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from .auth import TokenManager
from .config import Config

logger = logging.getLogger(__name__)

_MINOR_VERSION = "70"  # QBO API minor version; bump as new fields are needed


class QBOClient:
    """Async client for QBO read operations."""

    def __init__(self, config: Config, tokens: TokenManager) -> None:
        self._config = config
        self._tokens = tokens

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict[str, Any]] = None,
        json_body: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Issue an authenticated request; enforce read-only in v0.1."""
        if method.upper() not in ("GET", "POST"):
            raise RuntimeError(
                f"QBO MCP v0.1 is strictly read-only. Method {method} is blocked."
            )

        token = await self._tokens.get_access_token()
        realm_id = self._tokens.realm_id
        url = f"{self._config.api_base_url}/v3/company/{realm_id}{path}"

        merged_params = {"minorversion": _MINOR_VERSION}
        if params:
            merged_params.update(params)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(
                method,
                url,
                params=merged_params,
                json=json_body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )

        # Capture Intuit's transaction ID from response headers. Intuit's support
        # team can look up this exact request in their internal logs using the tid.
        # We log it on every call (debug level) and surface it in every error message.
        intuit_tid = resp.headers.get("intuit_tid", "(missing)")
        logger.debug(
            "QBO %s %s -> %d  intuit_tid=%s",
            method, path, resp.status_code, intuit_tid,
        )

        if resp.status_code == 401:
            raise RuntimeError(
                f"QBO returned 401 Unauthorized (intuit_tid={intuit_tid}). "
                "Token refresh may have failed. "
                "Re-run setup if this persists: python -m qbo_mcp.server --setup"
            )
        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise RuntimeError(
                f"QBO API error {resp.status_code} (intuit_tid={intuit_tid}): {detail}"
            )

        return resp.json()

    async def get(self, path: str, **params: Any) -> dict[str, Any]:
        return await self._request("GET", path, params=params or None)

    async def query(self, sql: str) -> dict[str, Any]:
        """Run a QBO Query Language (QQL) statement. Read-only.

        QQL examples:
          - "SELECT * FROM Account WHERE Active = true MAXRESULTS 1000"
          - "SELECT * FROM JournalEntry WHERE TxnDate >= '2026-04-01' MAXRESULTS 100"
        """
        # QBO's query endpoint is POST with the QQL as text body
        if not sql.strip().upper().startswith("SELECT"):
            raise RuntimeError(
                f"QBO MCP v0.1 only allows SELECT queries; got: {sql[:40]!r}…"
            )
        token = await self._tokens.get_access_token()
        realm_id = self._tokens.realm_id
        url = f"{self._config.api_base_url}/v3/company/{realm_id}/query"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                params={"minorversion": _MINOR_VERSION},
                content=sql,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "Content-Type": "application/text",
                },
            )

        # Capture Intuit's transaction ID for support correlation (see _request docstring).
        intuit_tid = resp.headers.get("intuit_tid", "(missing)")
        logger.debug(
            "QBO Query -> %d  intuit_tid=%s  sql=%s",
            resp.status_code, intuit_tid, sql[:80],
        )

        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise RuntimeError(
                f"QBO Query error {resp.status_code} (intuit_tid={intuit_tid}): {detail}"
            )
        return resp.json()

    async def report(
        self, report_name: str, **params: Any
    ) -> dict[str, Any]:
        """Run a QBO Report (P&L, BalanceSheet, AgedPayables, etc.)."""
        return await self.get(f"/reports/{report_name}", **params)
