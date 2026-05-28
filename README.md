# The AI Finance Stack

A free, open-source collection of Finance AI agents that run on your own machine. Connect any MCP-compatible client (Claude Desktop, Claude Code, etc.) to install agents that handle the recurring grunt work of running a Finance function — the month-end close, variance monitoring, fraud watching, AR follow-up, cash position, SOX sampling, and more.

**One human + one accountant + six agents = a full Finance function.**

Built and maintained by [Sanjay Raghavan](https://sanjayraghavan.substack.com), Finance Leader at Matter Labs, as the companion artifact to the *AI-Powered Finance* curriculum.

---

## What's in the Stack — v0.1

Eight agents, one per Finance function. Each one represents a role on the Finance team.

| Agent | Handle | Function | What it owns | Status |
|-------|--------|----------|--------------|--------|
| **Controller** | `@controller` | Controller / Accounting | Month-end close, accruals, reconciliations, the books | 🟢 v0.1 — reference implementation |
| **AP Watcher** | `@ap-watcher` | Accounts Payable | Vendor contracts, invoice validation, duplicate detection, payment-run prep | 🟡 Skeleton |
| **AR Follow-Up** | `@ar-follow-up` | Accounts Receivable | Aging-based collections drafts, DSO tracking, deal-line-item validation | 🟡 Skeleton |
| **FP&A Analyst** | `@fpa-analyst` | FP&A | Variance vs. budget with driver decomposition, forecast refresh, scenario maintenance | 🟡 Skeleton |
| **Investor Relations** | `@ir` | Investor Relations | Monthly investor update drafts, board reading material, KPI movement narrative | 🟡 Skeleton |
| **Revenue Ops** | `@revenue-ops` | Revenue Operations | Commission calculations, ARR tracking, deal-desk support, quota attainment | 🟡 Skeleton |
| **Payroll Reviewer** | `@payroll-reviewer` | Payroll | Monthly payroll variance, headcount cost, comp/equity review | 🟡 Skeleton |
| **Treasury** | `@treasury` | Treasury | Cash position, runway, banking, merchant-funds float (PSP-aware) | 🟡 Skeleton |

**Categories:** Every agent is tagged `Finance & Accounting`. Future stacks may add `Sales & RevOps` or `People & Payroll` as separate categories.

**Future v0.2 candidates:** Tax, SOX Sampler, Investigation (triage layer), Chief of Staff (front-door orchestrator that routes to the other eight).

---

## Quick install (Claude Desktop)

*Coming once the public MCP registry is live. Until then, clone this repo and follow the [SETUP_DEDICATED_LAPTOP.md](./SETUP_DEDICATED_LAPTOP.md) guide.*

```json
{
  "mcpServers": {
    "the-ai-finance-stack": {
      "url": "https://theaifinancestack.com/mcp/registry"
    }
  }
}
```

Then in Claude: *"Browse The AI Finance Stack and install the Close Orchestrator."*

---

## Documents in this repo

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — How the three layers fit together (Agent Packages, Personal Runtime, Public Registry)
- **[AGENT_PACKAGE_FORMAT.md](./AGENT_PACKAGE_FORMAT.md)** — The spec every agent in the Stack follows
- **[SETUP_DEDICATED_LAPTOP.md](./SETUP_DEDICATED_LAPTOP.md)** — How to set up an old Mac/MacBook as your Tier-5 agent server
- **[CURRICULUM_MAP.md](./CURRICULUM_MAP.md)** — How each agent here maps to a lesson in the *AI-Powered Finance* series
- **agents/** — Each subfolder is one installable agent package
- **registry/** — The public MCP server (Python/FastAPI) that hosts the Stack for outside users
- **runtime/** — Helper scripts for the dedicated-laptop setup (cron, launchd plists, log rotation)

---

## Project status

This is the early-stage scaffold. v0.1 ships with the Close Orchestrator as a reference implementation so you can see exactly what an agent package looks like. The rest of the army is on the roadmap, building roughly one agent every two weeks alongside the AI-Powered Finance curriculum.

---

## License

MIT. Use the agents, fork them, modify them, ship them inside your own product. Attribution appreciated but not required.

---

*Companion artifact to the [AI-Powered Finance Substack series](https://sanjayraghavan.substack.com). The course teaches you how to build agents like these from first principles. This repo is what you get when you stop building and start using.*
