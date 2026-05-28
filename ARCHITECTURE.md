# The AI Finance Stack — Architecture

Three layers, each owning a distinct concern. They compose into a complete Finance agent system that runs locally on your own hardware and is shareable with anyone running an MCP-compatible AI client.

The agent inventory itself follows an **extension model** — universal core agents, optional industry packs, shared ERP-specific skill library — described after the three-layer architecture below.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   LAYER 3: PUBLIC REGISTRY (MCP server)                         │
│   ───────────────────────────────────────────                   │
│   Python + FastAPI + MCP SDK · Hosted on Railway/Cloudflare    │
│   Exposes tools: browse_agents, get_agent_detail,               │
│                  download_agent_package, request_agent          │
│   Accessible via Claude Desktop, Claude Code, ChatGPT (MCP),    │
│   or REST API                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                            │ MCP / HTTP
                            │
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   LAYER 2: PERSONAL RUNTIME (your Mac mini / old MacBook)       │
│   ───────────────────────────────────────────                   │
│   macOS · Claude Code installed · launchd schedules             │
│   Reads agent packages from the local filesystem                │
│   MCP connections to your actual data:                          │
│     - QuickBooks / NetSuite                                     │
│     - Gmail / Slack / Google Drive                              │
│     - Plaid / Mercury / Stripe                                  │
│   Writes outputs to a Finance folder + sends notifications      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                            │ reads
                            │
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   LAYER 1: AGENT PACKAGES (the asset)                           │
│   ───────────────────────────────────────────                   │
│   Per agent: CLAUDE.md + skills/*.md + config.yaml + README.md  │
│   Open format, version-controlled in Git                        │
│   Each agent is self-contained — drop it on any compatible      │
│   runtime and it works                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Agent Packages

The unit of value. Each agent is a folder following the [AGENT_PACKAGE_FORMAT.md](./AGENT_PACKAGE_FORMAT.md) spec:

```
agents/close-orchestrator/
├── CLAUDE.md          # Identity, role, instructions
├── skills/            # Reusable capabilities the agent can invoke
│   ├── close-calendar.md
│   ├── accrual-entries.md
│   ├── reconciliation.md
│   └── variance-narrative.md
├── config.yaml        # MCPs required, schedule, goals, model
└── README.md          # Human-readable: what this agent does and how to install it
```

**Design principles:**
- **Self-contained.** Drop an agent folder anywhere — it should run.
- **Composable skills.** Skills can be shared across agents. The same `accrual-entries.md` skill that the Close Orchestrator uses can be invoked by the AP Watcher when a close is approaching.
- **Plain text.** Everything is markdown or YAML, version-controllable, diff-able, reviewable.
- **No code inside the agent itself.** The runtime (Layer 2) executes; the agent describes.

---

## Layer 2 — Personal Runtime

Your dedicated machine. The Tier 5 deployment from the *AI-Powered Finance* deployment framework.

**Hardware:** An old MacBook or Mac mini you already have. Newer Apple Silicon is ideal (low power draw, runs headless, sits on a shelf for years) but anything that can run Claude Code works.

**Software stack:**
- macOS (latest)
- Claude Code (the developer-facing CLI)
- The AI Finance Stack repo cloned to `~/the-ai-finance-stack/`
- A `~/finance-data/` folder where agents read and write
- launchd plists or cron jobs scheduling each agent
- Logs rotated to `~/finance-logs/`
- One MCP connection per data source you care about (QuickBooks, Slack, Gmail, etc.)

**What runs continuously:**
- The Close Orchestrator triggers on the last business day of the month
- The Variance Watcher runs every weekday at 7am
- The Cash Monitor runs hourly during business hours
- The Investigation agent listens for flagged items and processes them as they arrive

**Notifications:**
- Slack messages (or Telegram bot) for surfaced items
- A daily digest email summarizing all agent activity
- Errors go to a separate channel — silent agents are dangerous

See [SETUP_DEDICATED_LAPTOP.md](./SETUP_DEDICATED_LAPTOP.md) for the step-by-step.

---

## Layer 3 — Public Registry (MCP server)

How others install your agents. Built as a small Python service (FastAPI + the Anthropic MCP SDK) hosted on Railway or Cloudflare Workers.

**Tools the MCP server exposes (public — no auth):**

| Tool | What it does |
|------|--------------|
| `browse_agents` | List all agents in the Stack, with filters (function, status, MCPs required) |
| `get_agent_detail` | Full description of a single agent — what it does, what MCPs it needs, what schedule it expects |
| `download_agent_package` | Returns the full package as a JSON bundle (CLAUDE.md + skills + config) |
| `request_agent` | Public request board — community can ask for new agents |
| `upvote_request` | Upvote an existing request |
| `list_requests` | Browse pending requests |

**Tools we'll add later (author scope, `ak_...` bearer):**

- `publish_agent` — outside contributors can publish their own Finance agents into the Stack
- `update_my_agent` — manage your own published agents
- `list_my_agents` — your contributions

**User flow:**

1. User pastes the JSON config into `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "the-ai-finance-stack": {
         "url": "https://theaifinancestack.com/mcp/registry"
       }
     }
   }
   ```
2. Restart Claude Desktop.
3. In Claude: *"Browse The AI Finance Stack and install the Close Orchestrator."*
4. Claude calls `browse_agents` → `get_agent_detail` → `download_agent_package` and writes the agent into the user's Claude Code project.
5. User customizes the agent's MCP connections to their own data and starts scheduling.

---

## The data flow, end to end

When the Close Orchestrator runs on Strand's Tier-5 machine on the 1st of the month:

1. **launchd** wakes the agent at 9am.
2. **Claude Code** loads the `close-orchestrator` package from `~/the-ai-finance-stack/agents/close-orchestrator/`.
3. The agent reads its `CLAUDE.md` identity, loads its declared skills, and connects to its declared MCPs.
4. It calls the `finance:close-management` skill to generate the close calendar.
5. It hits the **QuickBooks MCP** to pull actuals.
6. It calls `finance:journal-entry` to prepare standard accrual entries.
7. It calls `finance:reconciliation` to run the bank rec.
8. It writes a close status report to `~/finance-data/closes/2026-04/status.md`.
9. It posts a summary to the **Slack MCP** in the `#finance-ops` channel.
10. launchd logs the run; if any step fails, an alert goes to the `#finance-alerts` channel.

The human (you) opens Slack at 9:15am and sees: "March close: 4/5 standard accruals booked, 1 needs review (vendor contract missing for $12K AWS true-up). Cash position green. Variance to plan -$180K, primarily fraud-loss rate ran 11 bps vs. 9 bps budget."

That's the destination. The rest of the work is building the parts.

---

# The Extension Model

The Stack is not just "8 agents." It's a **composable system** of three agent categories:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   CORE AGENTS — universal, every Finance team has these roles   │
│   ────────────────────────────────────────────────────────────  │
│   Controller · FP&A Analyst · Treasury · IR ·                   │
│   AP Watcher · AR Follow-Up · Revenue Ops · Payroll Reviewer    │
│                                                                 │
│   Industry-agnostic in their reasoning. Adapt at runtime to     │
│   whichever ERP / billing / banking MCPs are connected.         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            +
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   INDUSTRY PACKS — augment the core for specific business types │
│   ────────────────────────────────────────────────────────────  │
│   Crypto Pack (v0.1):                                            │
│     · crypto-reconciler         ✓ shipped                       │
│     · defi-monitor               (v0.2)                          │
│     · crypto-tax-tracker         (v0.2)                          │
│     · staking-yield-tracker      (v0.2)                          │
│                                                                 │
│   PSP Pack (v0.2 candidate):                                     │
│     · fraud-loss-watcher                                         │
│     · interchange-reconciler                                     │
│     · merchant-onboarding-tracker                                │
│                                                                 │
│   SaaS Pack (v0.2 candidate):                                    │
│     · trial-conversion-monitor                                   │
│     · usage-billing-reconciler                                   │
│     · churn-cohort-analyzer                                      │
│                                                                 │
│   Marketplace Pack, Real Estate Pack, etc. — open for           │
│   community contribution                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            +
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ERP SKILL LIBRARY — shared skills under skills/erp/           │
│   ────────────────────────────────────────────────────────────  │
│   Any agent can invoke these when working with a specific ERP.  │
│                                                                 │
│   skills/erp/qbo-je-format.md           — QBO journal-entry     │
│   skills/erp/netsuite-multi-entity.md   — NetSuite intercompany │
│   skills/erp/rillet-conventions.md      — Rillet AI patterns    │
│   skills/erp/xero-tracking-categories.md — Xero specifics       │
│   skills/erp/sage-intacct-dimensions.md — Sage Intacct          │
│                                                                 │
│   Plus posters (write-side, ERP-specific, human-gated):         │
│   skills/erp/qbo-poster.md      — proposes JEs, human approves, │
│                                    then posts to QBO            │
│   skills/erp/netsuite-poster.md                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why this structure

**Core agents are universal.** Every Finance team has a controller's job, an FP&A job, a treasury job, an IR job. The work is conceptually the same whether you're a SaaS, a marketplace, a PSP, or a Web3 company. Forking the Controller into `controller-saas`, `controller-marketplace`, `controller-psp` would multiply maintenance 4× with little benefit.

**Industry packs add specialized agents.** Some industries have categorically different reconciliation, monitoring, or reporting needs. Crypto-native companies need wallet reconciliation that the standard Controller can't address. PSPs need fraud-loss and interchange-reconciliation work. SaaS needs trial-conversion monitoring. These get their own agents — not a forked Controller.

**ERP differences live in shared skills, not in forked agents.** Posting a journal entry to QuickBooks vs. NetSuite vs. Rillet vs. Xero is genuinely different in syntax and API patterns, but the *decision* of what to post is the same. The skill library captures the syntactic differences; the agents stay ERP-agnostic in reasoning.

## A real example — Strand (PSP + crypto)

Strand processes fiat payments and holds USDC on the balance sheet. Its agent stack is:

- **All 8 core agents** — Controller, FP&A Analyst, Treasury, IR, AP Watcher, AR Follow-Up, Revenue Ops, Payroll Reviewer
- **Crypto pack: `crypto-reconciler`** — reconciles Strand's USDC and ETH holdings via Tres Finance (subledger) against QBO (GL)
- **PSP pack** (v0.2): `fraud-loss-watcher`, `interchange-reconciler` — once authored
- **ERP skill: `skills/erp/qbo-je-format.md`** — invoked by Controller when proposing entries to QBO

Total: 9 agents today (8 core + 1 crypto). Growing to 13 or 14 once the PSP pack lands.

A pure-fiat SaaS company runs the 8 core agents only — no crypto pack, no PSP pack. The Stack composes per business.

A pure-crypto Web3 company might lean heavier on the crypto pack and lighter on the core (e.g., no IR if no traditional investors yet) — the Stack still composes.

## Composition rules

Three rules govern how packs compose with the core:

1. **Core agents don't depend on pack agents.** A reader who installs only the 8 core agents has a complete Finance function. Industry packs are additive, never required.
2. **Pack agents may depend on core agents.** `crypto-reconciler` feeds Controller's close packet; it can't operate fully without Controller.
3. **Pack agents may depend on other pack-mates from the same pack.** `crypto-tax-tracker` (future) depends on `crypto-reconciler`'s output. Cross-pack dependencies are avoided.

This keeps the Stack predictable: any subset of {core ∪ chosen packs} is internally coherent.

## Contributing a pack agent

The pattern documented in `CONTRIBUTING.md` applies — same package format (CLAUDE.md, skills/, config.yaml, README.md). The difference: pack agents declare their pack in `config.yaml`:

```yaml
category: Finance & Accounting
pack: crypto          # or saas, marketplace, psp, real-estate, etc.
```

The agent's README should explain which core agents it integrates with and which other pack agents it depends on.

## Roadmap

- **v0.1 (shipped):** 8 core agents + crypto-reconciler (first pack agent)
- **v0.2 (next):** ERP skill library scaffolded; QBO Poster as the first poster agent (the only category of agent allowed to write to the GL, gated through human approval); 2-3 additional crypto pack agents
- **v0.3:** PSP pack authored (fraud-loss-watcher, interchange-reconciler, merchant-onboarding-tracker)
- **v0.4+:** SaaS pack, Marketplace pack opened for community contribution
