# Bundled MCPs

This directory holds the local MCP servers the Stack ships when no official MCP works for the user's access level, or when the official MCP's surface is too narrow.

See [MCP_INTEGRATION.md](../MCP_INTEGRATION.md) for the full integration-pattern hierarchy and the reasoning behind bundling.

---

## v0.2 catalog

Eight MCPs planned for v0.2. Each is a small Python server (~200–400 lines) that the user runs locally with their own OAuth credentials.

| MCP | Tools served | Used by agents | Status |
|-----|-------|----------------|--------|
| [`qbo/`](./qbo/) | QuickBooks Online | Controller, Prepay Manager, Bank Recon, AP Watcher, AR Follow-Up, QBO Poster | 🔵 v0.2 — scaffold pending |
| [`bill-com/`](./bill-com/) | BILL (AP, AR, Spend & Expense) | AP Watcher, AR Follow-Up, Controller | 🔵 v0.2 — scaffold pending |
| [`ramp/`](./ramp/) | Ramp (cards + bills) | AP Watcher, Controller | 🔵 v0.2 — scaffold pending |
| [`mercury/`](./mercury/) | Mercury (banking) | Treasury, Bank Recon | 🔵 v0.2 — scaffold pending |
| [`stripe/`](./stripe/) | Stripe (payments) | Revenue Ops, Bank Recon, Treasury | 🔵 v0.2 — scaffold pending |
| [`brex/`](./brex/) | Brex (cards + cash) | AP Watcher, Treasury | 🔵 v0.2 — scaffold pending |
| [`rippling/`](./rippling/) | Rippling (HRIS + payroll) | Payroll Reviewer, Controller | 🔵 v0.2 — scaffold pending |
| [`carta/`](./carta/) | Carta (cap table + SBC) | Future SBC agent, IR | 🔵 v0.2 — scaffold pending |

The order of rollout follows agent dependency: QBO first (used by 6 agents), then Bill.com and Mercury (broad AP/banking coverage), then the rest.

---

## What each bundled MCP includes

Every bundled MCP follows the same structure so users can install them with one command and agents can call them with a consistent interface:

```
mcps/<tool>/
├── README.md               # What this MCP exposes + how to authenticate
├── pyproject.toml          # Dependencies (mcp-python-sdk, httpx, etc.)
├── server.py               # The MCP server entry point
├── auth.py                 # OAuth flow + token refresh
├── tools/                  # One file per MCP tool
│   ├── __init__.py
│   ├── <tool_1>.py
│   ├── <tool_2>.py
│   └── ...
├── tests/                  # End-to-end tests against the tool's sandbox
└── .env.example            # Required credentials, never committed
```

Credentials persist to `~/.config/finance-stack/credentials/<tool>.json` — gitignored, never leaves your machine.

---

## Standard install pattern

Once an MCP is scaffolded, the install pattern is the same for every tool:

```bash
cd mcps/qbo
pip install -e .                  # Install dependencies
cp .env.example .env              # Add your API credentials
python server.py --setup          # One-time OAuth flow (opens browser)
# After this, the server is ready. Register it in Claude Desktop config:
```

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "python",
      "args": ["/Users/you/finance-stack/mcps/qbo/server.py"]
    }
  }
}
```

Restart Claude Desktop. The `quickbooks` MCP is now available to every agent in the Stack that requires it.

---

## How to add a new bundled MCP

Use the `create-finance-mcp` skill (shipping in v0.2). It scaffolds the entire directory structure, plumbs OAuth and token refresh from a template, generates `pyproject.toml`, and creates a passing test skeleton.

Manual workflow (for the v0.2 maintainer building the first seven):

1. Create the directory: `mkdir mcps/<tool>` and copy the template scaffold
2. Implement `auth.py` against the tool's OAuth or API-key auth pattern
3. Implement each MCP tool in `tools/<tool_name>.py` — one tool per logical capability
4. Write end-to-end tests in `tests/` against the tool's sandbox environment
5. Document install + tool surface in `mcps/<tool>/README.md`
6. Add a row to the catalog table above

---

## Design principles

The bundled MCPs share five principles that distinguish them from "generic API wrappers":

**1. Narrow surface.** Each MCP exposes only the tools the Stack's agents actually use. Not a general-purpose QBO wrapper — a Finance-Stack-shaped QBO wrapper. If an agent needs a new capability, the maintainer adds a new tool to the existing MCP rather than maintaining a wider surface preemptively.

**2. Read-mostly.** Only QBO Poster writes. The other six bundled MCPs (Mercury, Stripe, Ramp, Brex, Rippling, Carta) are strictly read. This dramatically simplifies the security and idempotency surface.

**3. User-scoped auth.** OAuth runs under the user's own grant. The MCP never sees admin credentials. Non-admin users get the same tool surface as admins, modulo what their own permissions allow at the API level.

**4. Verbose error messages.** When an API call fails, the MCP returns the full error detail to the agent — not a sanitized "an error occurred." Agents need the detail to escalate intelligently.

**5. Logged at the MCP layer.** Every API call (request + response, minus secrets) gets logged to `~/finance-logs/mcp/<tool>/<date>.jsonl`. This is the canonical record for any "what did the agent ask QBO" question.

---

## What's NOT bundled (and why)

These tools have strong official MCPs that work at user scope — no need to bundle:

- **Slack** — Slack's official MCP is excellent
- **Gmail** — Google's official MCP works for any Gmail user
- **Notion** — Notion's official MCP handles workspace permissions cleanly
- **Google Calendar** — Official MCP works
- **Linear, Asana, GitHub** — Official MCPs exist and work

The Stack uses Tier 1 (official MCP) for all of the above. If any of those vendors changes direction in a way that breaks the Stack, we'd bundle a replacement — but not preemptively.

---

*See [MCP_INTEGRATION.md](../MCP_INTEGRATION.md) for the full hierarchy and rationale.*
