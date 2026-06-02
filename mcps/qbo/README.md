# QBO Bundled MCP — `mcps/qbo`

A local MCP server that exposes **read-only** access to your QuickBooks Online books to any MCP-compatible client (Claude Desktop, Claude Code, etc.). Part of [The AI Finance Stack](https://the-ai-finance-stack.sanjayraghavan.workers.dev).

> **v0.1 is read-only by design.** No journal entry creation, no invoice posting, no vendor edits. Reads are safe to run against production. Write capability is queued for v0.2 once the propose → approve → post pipeline (via QBO Poster) is wired up end to end with the approval handler.

## Why this exists

Intuit publishes an official QBO MCP, but it requires admin-level access — which most non-admin Finance users don't have. This bundled MCP runs locally under **your own OAuth grant**, so you can read your books from Claude regardless of your QBO permission level. Your tokens, your machine, your data.

See [MCP_INTEGRATION.md](../../MCP_INTEGRATION.md) for the four-tier MCP framework — this is the canonical Tier-2 example.

---

## What's exposed (12 tools)

| Tool | What it does |
|---|---|
| `company_info_get` | Basic entity info, fiscal calendar, base currency |
| `chart_of_accounts_get` | List accounts; filter by active/type |
| `closing_date_get` | Books-closing date (for closed-period checks) |
| `recent_transactions_get` | JEs / invoices / bills in a date range |
| `journal_entry_get` | Single JE by transaction ID |
| `journal_entries_search` | Search JEs by date, doc number, or private-note substring |
| `vendor_search` | Find vendors by name substring |
| `customer_search` | Find customers by name substring |
| `ap_aging_get` | AP aging report (summary or detail) |
| `ar_aging_get` | AR aging report (summary or detail) |
| `profit_and_loss_get` | P&L for date range, optionally grouped/filtered |
| `transactions_by_account` | Drill into transactions hitting one account |

All read-only. All under your OAuth grant.

---

## Setup (one-time, ~10 min)

### 1. Register an Intuit Developer app

If you haven't already:

1. Go to [developer.intuit.com](https://developer.intuit.com) and sign in with your Intuit account
2. Create a new app — pick **"QuickBooks Online and Payments"**
3. Under **Keys & OAuth**, copy the **Production** Client ID and Client Secret
4. Add **`http://localhost:8765/callback`** to the **Redirect URIs** list (must match exactly)
5. Make sure the scope **`com.intuit.quickbooks.accounting`** is enabled

### 2. Install the MCP server

```bash
cd ~/Documents/Claude/Projects/Learning\ AI\ for\ Finance/the-ai-finance-stack/mcps/qbo

# Recommended: use a virtual environment to avoid polluting system Python
python3 -m venv .venv
source .venv/bin/activate

pip install -e .
```

### 3. Configure your credentials

```bash
cp .env.example .env
# Open .env in your editor and fill in:
#   QBO_CLIENT_ID=<from Intuit Developer dashboard>
#   QBO_CLIENT_SECRET=<from Intuit Developer dashboard>
#   QBO_ENVIRONMENT=production
```

### 4. Run the one-time OAuth flow

```bash
python -m qbo_mcp.server --setup
```

Your browser opens. Sign into QuickBooks, authorize the app, get redirected back to localhost. The terminal prints:

```
Setup complete. Realm ID: 1234567890
Credentials saved to: /Users/you/.config/finance-stack/credentials/qbo.json
```

The refresh token is now stored locally (`chmod 600`). It's valid for 101 days; every API call rotates it forward, so as long as you use the MCP at least once every 100 days, it never expires.

### 5. Wire into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "/Users/you/Documents/Claude/Projects/Learning AI for Finance/the-ai-finance-stack/mcps/qbo/.venv/bin/python",
      "args": [
        "-m",
        "qbo_mcp.server"
      ],
      "cwd": "/Users/you/Documents/Claude/Projects/Learning AI for Finance/the-ai-finance-stack/mcps/qbo"
    }
  }
}
```

(Replace the paths to match your machine.)

Restart Claude Desktop. In a fresh conversation, try:

> *"What's our chart of accounts? Show me the expense accounts."*

Claude calls `chart_of_accounts_get` with `account_type=Expense`, returns the list.

> *"How much did we spend on consulting this month?"*

Claude calls `profit_and_loss_get` with the current month dates, then finds the Consulting line in the response and reads the amount.

> *"Show me every JE that hit account [X] in April."*

Claude calls `transactions_by_account` with `account_id=X`, returns the detail.

---

## Running on a second machine (e.g., your dedicated laptop)

Each machine needs its own auth. Repeat steps 2-5 above on the dedicated laptop with the **same** Intuit Client ID — Intuit will issue a separate refresh token for that machine. The two machines now read your QBO independently with no coordination needed.

Why not copy the credentials file between machines? Because rotating refresh tokens are tied to one client session. If two machines try to refresh the same token, one of them gets invalidated. Treat each machine's auth as its own independent grant.

---

## Token expiry behavior

| Token | Lifetime | Behavior |
|---|---|---|
| Access token | 60 minutes | Refreshed automatically on every API call after expiry; cached in memory |
| Refresh token | 101 days | Rotated on every refresh; persisted to disk each time. As long as you use the MCP at least once every ~100 days, it never expires. |

If your refresh token does expire (say, you didn't use the MCP for 4 months), the next call fails with a helpful "re-run setup" message. Just run `python -m qbo_mcp.server --setup` again.

---

## What's NOT in v0.1 (write capability)

Intentionally not included:

- ❌ `journal_entry_create` — comes in v0.2 via the QBO Poster's propose → approve → post pipeline
- ❌ Any POST/PUT/DELETE that creates or mutates QBO entities
- ❌ Invoice send, payment apply, vendor edit

The QBO Poster agent currently runs only the approval-validation and proposal-reading parts of its workflow; the actual `post-to-qbo` step is held until v0.2 when this MCP grows write tools — and those write tools will gate on the approval handler having processed a valid approval record.

If you want to read about why this discipline matters, see the architecturally distinctive idea in [Post 28 of the AI-Powered Finance series](https://sanjayraghavan.substack.com).

---

## Troubleshooting

**"QBO_CLIENT_ID is not set"** — You haven't copied `.env.example` to `.env` and filled in the values. Step 3 above.

**"Refresh token rejected by Intuit"** — Your refresh token expired (>101 days unused). Re-run `python -m qbo_mcp.server --setup`.

**"QBO returned 401 Unauthorized"** — Usually transient; the token refresh layer will retry on the next call. If it persists, re-run setup.

**"Claude Desktop doesn't see the MCP"** — Common gotchas: (1) wrong path to the venv's python in `claude_desktop_config.json`, (2) didn't restart Claude Desktop after editing the config, (3) syntax error in the JSON config (missing comma, trailing comma). Check Claude Desktop's logs at `~/Library/Logs/Claude/`.

**"401 on the very first call after setup"** — Wait ~30 seconds for Intuit's auth backend to propagate, then try again. Rare but does happen on brand-new Intuit apps.

**Want to switch from production to sandbox or vice versa** — Delete `~/.config/finance-stack/credentials/qbo.json`, update `QBO_ENVIRONMENT` in `.env`, run `--setup` again. The MCP refuses to start if the saved credentials don't match the current `.env` environment.

---

## What the agents in the Stack use this MCP for

| Agent | Uses these tools |
|---|---|
| **Controller** | `chart_of_accounts_get`, `recent_transactions_get`, `closing_date_get`, `journal_entries_search` |
| **FP&A Analyst** | `profit_and_loss_get`, `transactions_by_account`, `chart_of_accounts_get` |
| **Bank Recon** | `recent_transactions_get`, `journal_entries_search` |
| **AP Watcher** | `vendor_search`, `journal_entries_search`, `ap_aging_get` |
| **AR Follow-Up** | `customer_search`, `ar_aging_get` |
| **Prepay Manager** | `chart_of_accounts_get`, `journal_entries_search` |
| **QBO Poster** | `journal_entry_get`, `journal_entries_search`, `closing_date_get` (v0.1 read-only validation; write capability v0.2) |

Plus you, directly in Claude Desktop, asking ad-hoc questions about your books.

---

*Part of [The AI Finance Stack](https://github.com/sanjay-raghavan/the-ai-finance-stack) · MIT License · Author: Sanjay Raghavan*
