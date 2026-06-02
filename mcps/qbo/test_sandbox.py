"""Quick sandbox smoke test for the QBO MCP.

Run this from inside the .venv after completing --setup:

    cd ~/Documents/Claude/Projects/Learning\\ AI\\ for\\ Finance/the-ai-finance-stack/mcps/qbo
    source .venv/bin/activate
    python3 test_sandbox.py

It exercises three things end-to-end:
  1. Loading config from .env
  2. Refreshing the access token via the stored refresh token
  3. Calling /companyinfo and a couple of other read endpoints

If you see the sandbox company name and an account list, the integration works.
"""
import asyncio
import json

from qbo_mcp.config import load_config
from qbo_mcp.auth import TokenManager
from qbo_mcp.client import QBOClient


async def main() -> None:
    print("─" * 60)
    print(" QBO MCP — sandbox smoke test")
    print("─" * 60)

    cfg = load_config()
    print(f" Environment: {cfg.environment}")
    print(f" API base:    {cfg.api_base_url}")

    tm = TokenManager(cfg)
    print(f" Realm ID:    {tm.realm_id}")

    client = QBOClient(cfg, tm)

    # 1) Company info — confirms we can authenticate and hit a basic endpoint
    print("\n[1/3] Fetching CompanyInfo …")
    info = await client.get(f"/companyinfo/{tm.realm_id}")
    company_name = info.get("CompanyInfo", {}).get("CompanyName", "(unknown)")
    print(f"      Company name: {company_name}")

    # 2) A couple of accounts — confirms the Query endpoint works
    print("\n[2/3] Fetching first 5 active accounts …")
    accounts = await client.query(
        "SELECT Id, Name, AccountType FROM Account WHERE Active = true MAXRESULTS 5"
    )
    rows = accounts.get("QueryResponse", {}).get("Account", [])
    for a in rows:
        print(f"      [{a.get('Id')}] {a.get('Name')}  ({a.get('AccountType')})")

    # 3) Closing date check — relevant for QBO Poster's eventual validation
    print("\n[3/3] Fetching closing date preference …")
    prefs = await client.get("/preferences")
    close = (
        prefs.get("Preferences", {})
        .get("AccountingInfoPrefs", {})
        .get("BookCloseDate")
    )
    print(f"      BookCloseDate: {close or '(not set)'}")

    print("\n" + "─" * 60)
    print(" Smoke test passed. The QBO MCP is working end-to-end against sandbox.")
    print(" You can truthfully answer 'Yes' to Intuit's connect-test question.")
    print("─" * 60)


if __name__ == "__main__":
    asyncio.run(main())
