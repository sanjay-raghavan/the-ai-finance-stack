# The AI Finance Stack

A free, open-source collection of Finance AI agents that run on your own machine. Connect any MCP-compatible client (Claude Desktop, Claude Code, etc.) to install agents that handle the recurring grunt work of running a Finance function — the month-end close, variance monitoring, fraud watching, AR follow-up, cash position, SOX sampling, and more.

**One human + one accountant + six agents = a full Finance function.**

Built and maintained by [Sanjay Raghavan](https://sanjayraghavan.substack.com), Finance Leader at Matter Labs, as the companion artifact to the *AI-Powered Finance* curriculum.

---

## What's in the Stack — v0.1

Ten core agents (one per Finance function), one industry-pack agent (crypto), and one execution-layer agent (the only one permitted to write to the GL).

| Agent | Handle | Function | What it owns | Status |
|-------|--------|----------|--------------|--------|
| **Controller** | `@controller` | Controller / Accounting | Month-end close, accruals, reconciliations, the books | 🟢 v0.1 — reference implementation |
| **FP&A Analyst** | `@fpa-analyst` | FP&A | Variance vs. budget with driver decomposition, forecast refresh, scenario maintenance | 🟢 v0.1 — fully authored |
| **Treasury** | `@treasury` | Treasury | Cash position, runway, banking, merchant-funds float (PSP-aware) | 🟢 v0.1 — fully authored |
| **Investor Relations** | `@ir` | Investor Relations | Monthly investor update drafts, board reading material, KPI movement narrative | 🟢 v0.1 — fully authored |
| **AP Watcher** | `@ap-watcher` | Accounts Payable | Vendor contracts, invoice validation, duplicate detection, payment-run prep | 🟢 v0.1 — fully authored |
| **AR Follow-Up** | `@ar-follow-up` | Accounts Receivable | Aging-based collections drafts, DSO tracking, deal-line-item validation | 🟢 v0.1 — fully authored |
| **Revenue Ops** | `@revenue-ops` | Revenue Operations | Commission calculations, ARR tracking, deal-desk support, quota attainment | 🟢 v0.1 — fully authored |
| **Payroll Reviewer** | `@payroll-reviewer` | Payroll | Monthly payroll variance, headcount cost, comp/equity review | 🟢 v0.1 — fully authored |
| **Prepay Manager** | `@prepay-manager` | Prepaid Accounting | Prepayment lifecycle: identification, amortization schedules, monthly JE proposals, balance reconciliation | 🟢 v0.1 — fully authored |
| **Bank Recon** | `@bank-recon` | Cash & Banking | Daily transaction matching, unmatched-item investigation, period-end attestation across all bank/processor accounts | 🟢 v0.1 — fully authored |

**Categories:** Every agent above is part of the **core**. The Stack also supports **industry packs** (specialty agents for specific business types) and an **execution pack** (the only agents permitted to write to the GL). See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full extension model.

## Industry Packs

| Pack | Agent | Status | What it adds |
|------|-------|--------|--------------|
| **Crypto** | `@crypto-reconciler` | 🟢 v0.1 — fully authored | Multi-chain wallet reconciliation, gas/fee separation, cost-basis sanity checks. For companies with crypto on the balance sheet (Tres Finance / Bitwave / Integral subledgers). |
| Crypto | `@defi-monitor` | 🔵 v0.2 candidate | DeFi positions, impermanent loss, yield decomposition |
| Crypto | `@crypto-tax-tracker` | 🔵 v0.2 candidate | FIFO/LIFO tax-lot tracking, jurisdiction-aware reporting |
| **PSP** | `@fraud-loss-watcher`, `@interchange-reconciler` | 🔵 v0.2 candidates | For payment service providers (Strand-shaped). Fraud loss monitoring, interchange/network-fee reconciliation. |
| **SaaS** | `@trial-conversion-monitor`, `@usage-billing-reconciler`, `@churn-cohort-analyzer` | 🔵 v0.2 candidates | For subscription / usage-based SaaS businesses |
| **Marketplace, Real Estate, others** | — | Open for community contribution | |

## Execution Pack

The only agents in the Stack permitted to **write** to the general ledger. Every other agent is read-only. Execution-pack agents read approval records, validate integrity, post to the ERP, and write confirmations. The contract is identical for every ERP: propose → human approves → post.

| Pack | Agent | Status | What it does |
|------|-------|--------|--------------|
| **Execution** | `@qbo-poster` | 🟢 v0.1 — fully authored | The only agent permitted to write to QuickBooks Online. Reads approval records, runs 8 validation checks, posts to QBO via MCP, verifies the post landed, writes confirmation. Idempotent, audit-grade, halt-on-anything-unexpected discipline. |
| Execution | `@netsuite-poster`, `@xero-poster`, `@rillet-poster`, `@sage-intacct-poster` | 🔵 v0.2 candidates | Same propose → approve → post contract for other ERPs |

**Future v0.2 core additions:** Tax, SOX Sampler, Investigation (triage layer), Chief of Staff (front-door orchestrator that routes to the other agents).

---

## MCP Connectors

Agents are useless without connections to the tools that hold your books. The Stack uses a [four-tier integration pattern](./MCP_INTEGRATION.md) (official MCP → bundled local MCP → Bash wrapper → hosted gateway) so the agents work whether your tools have great official MCPs, admin-gated MCPs, or no MCP at all.

For tools where the official MCP is admin-gated (QBO) or doesn't exist (Mercury, Stripe, Brex, Rippling, Carta), the Stack ships **bundled local MCPs** under [`mcps/`](./mcps/). Each runs locally under your own OAuth grant — credentials never leave your machine, and non-admin users get the same tool surface as admins.

| MCP | What it connects to | Used by agents | Status |
|-----|-----|-----|-----|
| [`qbo`](./mcps/) | QuickBooks Online | Controller, Prepay Manager, Bank Recon, AP Watcher, AR Follow-Up, QBO Poster | 🔵 v0.2 — scaffold pending |
| [`bill-com`](./mcps/) | BILL (AP, AR, Spend & Expense) | AP Watcher, AR Follow-Up, Controller | 🔵 v0.2 — scaffold pending |
| [`ramp`](./mcps/) | Ramp (cards + bills) | AP Watcher, Controller | 🔵 v0.2 — scaffold pending |
| [`mercury`](./mcps/) | Mercury (banking) | Treasury, Bank Recon | 🔵 v0.2 — scaffold pending |
| [`stripe`](./mcps/) | Stripe (payments) | Revenue Ops, Bank Recon, Treasury | 🔵 v0.2 — scaffold pending |
| [`brex`](./mcps/) | Brex (cards + cash) | AP Watcher, Treasury | 🔵 v0.2 — scaffold pending |
| [`rippling`](./mcps/) | Rippling (HRIS + payroll) | Payroll Reviewer, Controller | 🔵 v0.2 — scaffold pending |
| [`carta`](./mcps/) | Carta (cap table + SBC) | Future SBC agent, IR | 🔵 v0.2 — scaffold pending |

**For Slack, Gmail, Notion, Google Calendar, Linear, Asana, GitHub:** the Stack uses the vendor's official MCP — no bundling needed.

**Coming in v0.2:** a `create-finance-mcp` skill that scaffolds new bundled MCPs from a template, so the community can contribute connectors at the same standard.

---

## Quick install

The public MCP registry server is on the v0.2 roadmap (see [Project Status](#project-status) below). Until then, the install path is:

**Clone the repo and run the Controller (or any other fully-authored agent) locally:**

```bash
git clone https://github.com/sanjay-raghavan/the-ai-finance-stack.git
cd the-ai-finance-stack
```

Then follow either:

- **[QUICK_START.md](./QUICK_START.md)** — try one agent interactively in Claude Desktop (~30 minutes, no dedicated machine needed)
- **[SETUP_DEDICATED_LAPTOP.md](./SETUP_DEDICATED_LAPTOP.md)** — full setup of a Mac as your always-on agent runtime (~90 minutes)

**Future (v0.2) — once the MCP registry server ships, the install becomes a single JSON snippet:**

```json
{
  "mcpServers": {
    "the-ai-finance-stack": {
      "url": "https://sanjay-raghavan.github.io/the-ai-finance-stack/mcp/registry"
    }
  }
}
```

(Exact URL will be confirmed when the registry server is built. See [HOSTING_PLAN.md](./HOSTING_PLAN.md) for the architecture.)

---

## Documents in this repo

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — How the three layers fit together (Agent Packages, Personal Runtime, Public Registry)
- **[AGENT_PACKAGE_FORMAT.md](./AGENT_PACKAGE_FORMAT.md)** — The spec every agent in the Stack follows
- **[MCP_INTEGRATION.md](./MCP_INTEGRATION.md)** — The four integration patterns (official MCP → bundled local MCP → Bash wrapper → hosted gateway). How the Stack connects to QBO, Ramp, Mercury, Stripe, and the rest without depending on admin-gated official MCPs.
- **[SETUP_DEDICATED_LAPTOP.md](./SETUP_DEDICATED_LAPTOP.md)** — How to set up an old Mac/MacBook as your Tier-5 agent server
- **[CURRICULUM_MAP.md](./CURRICULUM_MAP.md)** — How each agent here maps to a lesson in the *AI-Powered Finance* series
- **agents/** — Each subfolder is one installable agent package
- **skills/** — Shared skill layer. Canonical schemas, formats, and methodologies that multiple agents invoke (e.g., `stack:proposal-format` — the contract that holds the propose→approve→post execution pack together). See [`skills/README.md`](./skills/README.md).
- **mcps/** — Bundled local MCP servers (v0.2). For tools where the official MCP requires admin access or doesn't exist: QBO, Ramp, Mercury, Stripe, Brex, Rippling, Carta.
- **registry/** — The public MCP registry server (Python/FastAPI) that hosts the Stack catalog for outside users — v0.2 deliverable
- **runtime/** — Helper scripts for the dedicated-laptop setup (cron, launchd plists, log rotation)

---

## Project status

**v0.1 — ten core agents + one industry-pack agent + one execution-pack agent fully authored.** Controller, FP&A Analyst, Treasury, Investor Relations, AP Watcher, AR Follow-Up, Revenue Ops, Payroll Reviewer, Prepay Manager, Bank Recon, plus Crypto Reconciler (crypto pack) and QBO Poster (execution pack — the only write-capable agent, gated through human approval). Each ships with a `CLAUDE.md` (identity + operating doctrine), `config.yaml` (MCPs, schedules, goals, thresholds), `README.md` (install + usage), and 2–3 reference skills.

**On the v0.2 roadmap:**

- **Hoist the remaining 8 shared skills** from agent-private duplicates to `skills/`: `approval-record-format`, `slack-conventions`, `audit-log-entry`, `variance-narrative`, `driver-decomposition`, `kpi-snapshot`, `close-packet-format`, `budget-checker`. The first (`stack:proposal-format`) shipped in v0.1; see [`skills/README.md`](./skills/README.md) for the full catalog and the hoist rationale.
- **Bundled local MCPs** — Python MCP servers under `mcps/` for the tools where the official MCP is admin-gated (QBO) or doesn't exist (Mercury, Stripe, Brex, Rippling, Carta). Each runs locally under the user's own OAuth grant — no admin requirement, no third-party hosting, credentials never leave the user's machine. See [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) for the full pattern hierarchy and rollout plan.
- **`create-finance-mcp` skill** — scaffolds a new bundled local MCP from a template (OAuth, token refresh, error handling, logging, tests). The leverage move that lets the community contribute MCPs at the same standard.
- **MCP registry server** — public Cloudflare Workers endpoint that serves the Stack's agent catalog so the install path becomes a single JSON snippet (no `git clone` required). Separate concern from the bundled MCPs above — this distributes *agents*, while `mcps/` provides the *tool connectors* those agents use.
- **Industry packs** — additional agents organized by industry (e.g., *crypto pack* with `crypto-reconciler` for companies using Tres / Integral / Bitwave; *SaaS pack*; *marketplace pack*)
- **Additional execution-pack Posters** — `netsuite-poster`, `xero-poster`, `rillet-poster`, `sage-intacct-poster`. Same propose → approve → post contract, ERP-specific posting mechanics.
- **ERP-specific skill library** — shared skills under `skills/erp/` (e.g., `qbo-je-format`, `netsuite-multi-entity`, `rillet-conventions`) that any core agent invokes when working with a specific accounting system. Core agents stay ERP-agnostic; ERP differences live in the skill layer.
- **Runtime helpers** — `runtime/run-agent.sh`, `notify.py`, business-day-defer logic for the dedicated laptop setup
- **Additional core skills per agent** — e.g., `kpi-snapshot` and `what-if-analysis` for FP&A; `merchant-float-separation` as a dedicated skill for Treasury

Building roughly two agents per week alongside the AI-Powered Finance Substack series.

---

## License

MIT. Use the agents, fork them, modify them, ship them inside your own product. Attribution appreciated but not required.

---

*Companion artifact to the [AI-Powered Finance Substack series](https://sanjayraghavan.substack.com). The course teaches you how to build agents like these from first principles. This repo is what you get when you stop building and start using.*
