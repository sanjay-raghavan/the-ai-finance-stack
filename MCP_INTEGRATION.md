# MCP Integration — How the Stack Talks to Your Financial Systems

Every agent in The AI Finance Stack needs to read from (and in the case of QBO Poster, write to) external systems: QuickBooks, Ramp, Mercury, Stripe, Brex, Rippling, Carta, Slack, Gmail, and whatever else lives in your finance stack. The mechanism for that communication is **MCP** — the Model Context Protocol.

But the MCP ecosystem for finance tools is uneven. Some tools have great official MCPs. Some have official MCPs that only work for the admin user. Some have nothing. This doc explains how the Stack handles all three cases and how to add a new one.

---

## The four integration patterns

The Stack supports four ways to connect an agent to a tool, in order of preference:

```
1. Official MCP (vendor-built)
       ↓ fall back to
2. Bundled local MCP (ships in this repo, under mcps/)
       ↓ fall back to
3. Bash + Python wrapper (the agent shells out to a script)
       ↓ fall back to
4. Hosted MCP gateway (Smithery, Composio, etc.)
```

You pick the highest tier that actually works for your tool + your access level. Agents are agnostic to which tier is in use — they just see "the `quickbooks` MCP is available" via the standard MCP interface.

---

### Tier 1 — Official MCP (vendor-built)

**When to use:** The vendor (Intuit, Slack, Google, etc.) publishes an MCP and your user account has the access level it requires.

**Examples that work great:**
- `slack` — Slack's official MCP, full read/write at user scope, no special permissions needed
- `gmail` — Google's official MCP, user-scoped, works for any Gmail user
- `notion` — Notion's official MCP, fine-grained workspace access

**Examples with caveats:**
- `quickbooks` (Intuit's official) — works only for the QBO admin user; non-admins get permission errors on most tool calls. This is the wall that motivates Tier 2 for QBO.
- `ramp` (official) — strong, but the API surface exposed via MCP is narrower than the underlying Ramp API. Some Finance-relevant queries aren't yet wrapped.

**Pros:** Vendor-supported, gets security patches, often well-documented.
**Cons:** You don't control the contract. If the vendor narrows the API or pivots, you're stuck.

---

### Tier 2 — Bundled local MCP (ships in this repo)

**When to use:** No official MCP, OR the official MCP doesn't work for your access level, OR the official MCP's API surface is too narrow for the agent's needs.

**What it is:** A small Python MCP server (typically ~200–400 lines) that lives in `mcps/<tool>/` in this repo. The user runs it locally on the same machine as the agents. It authenticates with their own credentials and exposes the tool's API as MCP tools.

**The v0.2 plan ships eight of these:**

| Tool | Why bundled (vs. relying on the official MCP) | Status |
|------|------------------------------------------------|--------|
| `qbo` | Intuit's official MCP requires admin access; most non-admin users can't use it for the Stack's read patterns | 🔵 v0.2 |
| `bill-com` | No official MCP exists. BILL has a modern REST v3 API plus an LLM-friendly index at developer.bill.com/llms.txt — easy Tier-2 candidate. Used by AP-heavy teams. | 🔵 v0.2 |
| `ramp` | Need broader API surface than the official MCP exposes (especially card-level filters and category-level aggregations) | 🔵 v0.2 |
| `mercury` | No official MCP exists | 🔵 v0.2 |
| `stripe` | No official MCP exists; the Stack needs payout-by-currency and dispute-detail endpoints | 🔵 v0.2 |
| `brex` | No official MCP exists | 🔵 v0.2 |
| `rippling` | No official MCP exists; needed for Payroll Reviewer | 🔵 v0.2 |
| `carta` | No official MCP exists; needed for the future SBC / equity agent | 🔵 v0.2 |

Each bundled MCP follows the same scaffolding:

```
mcps/qbo/
├── README.md           # What this MCP exposes + how to authenticate
├── pyproject.toml      # Dependencies (mcp-python-sdk, httpx, etc.)
├── server.py           # The MCP server itself (~300 lines)
├── auth.py             # OAuth flow + token refresh
├── tools/              # One file per MCP tool exposed
│   ├── chart_of_accounts.py
│   ├── journal_entries.py
│   ├── recent_transactions.py
│   └── ...
└── tests/              # End-to-end tests against QBO's sandbox
```

**Pros:**
- You own the contract. Tool surface is exactly what the Stack's agents need.
- Runs under the user's own OAuth grant — no admin requirement.
- No third-party hosting; survives even if Anthropic, Smithery, etc. change direction.
- Easy to extend: add a new tool to `tools/` and re-register.

**Cons:**
- Maintenance burden: every API change in QBO, Ramp, etc. requires an update.
- Users have to authenticate once per MCP (one-time OAuth, then refresh tokens persist).
- Slightly more setup than a hosted MCP.

The maintenance burden is the real cost. Mitigation: the [`create-finance-mcp` skill](#the-create-finance-mcp-skill) lets the community contribute new MCPs and patches with minimal friction.

---

### Tier 3 — Bash + Python wrapper

**When to use:** The tool has an API but doesn't justify a full MCP — maybe it's used by only one agent, or the API surface is tiny, or it's an internal tool.

**What it is:** Instead of an MCP server, the agent uses its `Bash` tool to run a Python script directly. Credentials live in `~/.config/finance-stack/credentials/<tool>.env`.

**Examples that work well as Tier 3:**
- A one-off "lookup the latest 10-Q EPS for our peer set" script that the IR agent calls — runs once per investor update.
- An internal data warehouse query that the Controller invokes for one specific accrual basis.
- A wrapper around a payroll provider's CSV export that doesn't justify a full MCP.

**Pattern:**
```bash
# Agent invokes via Bash:
python ~/finance-stack/scripts/lookup-peer-eps.py --tickers BILL,PYPL,STRP
# Returns JSON to stdout, agent parses
```

**Pros:** Fastest to ship. No MCP boilerplate. Easy to debug.
**Cons:** Not shareable across agents in a standardized way; each agent has to know the script's CLI shape; harder to enforce security policy.

---

### Tier 4 — Hosted MCP gateway

**When to use:** You want zero local setup, you trust a third-party host, and the tool you need is in their catalog.

**What it is:** Services like [Smithery](https://smithery.ai), [Composio](https://composio.dev), and [Glama](https://glama.ai) host MCP servers and handle OAuth on your behalf. You point your Claude Desktop config at their URL and they proxy to the underlying tool.

**Pros:** Zero setup. Always-up. They handle auth refresh.
**Cons:**
- Adds a third-party dependency to your finance stack — your data routes through their servers.
- Their durability is uncertain (most are early-stage startups).
- Pricing models vary; some are free, some metered.

**Recommendation:** Use Tier 4 as a *fallback* for tools that would otherwise require Tier 2 work you don't have time for. Don't make Tier 4 your default — finance data shouldn't route through more servers than necessary.

---

## How the agent chooses

Agents don't choose. **The user chooses by what they install.** Every agent's `config.yaml` declares the MCPs it requires by name:

```yaml
# agents/controller/config.yaml
mcps:
  required:
    - quickbooks    # name only — agent doesn't care if this is Tier 1, 2, or 4
    - slack
  optional:
    - notion
```

The user's Claude Desktop config maps each name to a specific MCP server (Tier 1, 2, 3, or 4):

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "python",
      "args": ["/Users/.../finance-stack/mcps/qbo/server.py"]
    },
    "slack": {
      "url": "https://slack-mcp.example.com/sse"
    }
  }
}
```

The agent calls `mcp__quickbooks__get_chart_of_accounts()` and the MCP layer handles routing. The agent never knows or cares which tier it's talking to.

This is what makes the four tiers interoperable: **the contract is the MCP tool name + tool schema**, not the implementation behind it. A user can swap from Tier 4 (Smithery-hosted QBO) to Tier 2 (local bundled QBO MCP) by editing two lines of config — no agent code changes.

---

## The `create-finance-mcp` skill

To keep the Stack from drowning in MCP maintenance, v0.2 ships a `create-finance-mcp` skill (under `skills/`) that scaffolds a new bundled local MCP from a template.

Inputs: tool name, OpenAPI spec or API docs URL, OAuth pattern, MCP tools the agent needs.

Outputs: a new `mcps/<tool>/` directory with `server.py`, `auth.py`, `tools/*.py`, `tests/`, and a `README.md` — ready for the contributor to fill in tool-specific logic.

This is the leverage move. Instead of the maintainer (me) writing 30 MCPs, anyone in the community can scaffold an MCP for a tool they need and PR it back. The skill enforces the same auth pattern, error handling, logging, and test convention across every bundled MCP — so they all behave consistently.

The community-contributed MCP catalog grows over time. The maintainer reviews, merges, and the next user `git pull`s and has a new tool available.

---

## Recommended setup for v0.1 → v0.2 migration

If you're using the Stack today (v0.1):

- **Slack, Gmail, Notion:** Use Tier 1 (official MCPs). They work great.
- **QuickBooks:** Try Tier 1 first. If you're not the QBO admin, switch to Tier 2 when the bundled MCP ships in v0.2.
- **Ramp, Stripe, Mercury, Brex:** Use Tier 4 (Smithery or equivalent) as a stopgap. When the bundled MCPs ship in v0.2, switch to Tier 2.
- **Anything internal or one-off:** Use Tier 3 (Bash + Python wrapper). No need to wait for v0.2.

The migration when v0.2 ships is a config edit, not an agent rewrite.

---

## A note on credentials

Bundled local MCPs (Tier 2) authenticate with your credentials, not the maintainer's, not a hosted service's. The OAuth flow runs once on your machine, refresh tokens persist to `~/.config/finance-stack/credentials/<tool>.json`, and that directory is gitignored.

This is the whole point of Tier 2 — **your books, your tokens, your machine**. No third party ever sees the credentials, the API responses, or the agent's reasoning. For Finance workloads where data leaving the building is the worst-case scenario, this matters.

The trade-off is that you're responsible for credential hygiene: rotate when employees leave, revoke compromised tokens, audit access logs. The Stack provides a `runtime/credentials-audit.sh` helper for the basic checks.

---

## How to contribute a new MCP

1. Run the `create-finance-mcp` skill — scaffolds the directory under `mcps/<your-tool>/`
2. Implement the OAuth flow in `auth.py`
3. Add MCP tools to `tools/` — one file per logical tool
4. Write end-to-end tests against the tool's sandbox/staging environment
5. Document install + auth in `mcps/<your-tool>/README.md`
6. Open a PR against `the-ai-finance-stack`

The maintainer reviews for consistency with the bundled MCP standards (auth pattern, error handling, logging, test coverage) and merges. Your MCP is now part of the Stack's catalog and the next `git pull` makes it available to every other user.

---

*This document is part of the v0.1 → v0.2 architecture work. The bundled MCPs and the `create-finance-mcp` skill are v0.2 deliverables; this doc is the design they ship against.*

*The AI Finance Stack · MIT License · Author: Sanjay Raghavan*
