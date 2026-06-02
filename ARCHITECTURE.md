# The AI Finance Stack — Architecture

Three layers, each owning a distinct concern. They compose into a complete Finance agent system that runs locally on your own hardware and is shareable with anyone running an MCP-compatible AI client.

A **customization layer** (`customization/`) sits orthogonal to the three vertical layers — it's the per-org grounding that turns generic agents into ones that understand your specific chart of accounts, non-GAAP definitions, output templates, and writing voice. See `customization-stub/README.md` for the full spec; the short version is below.

The agent inventory itself follows an **extension model** — universal core agents, optional industry packs, an execution pack for write-capable agents, and a shared ERP-specific skill library — described after the three-layer architecture below.

A fourth concern — **how agents talk to your actual financial systems** — is covered in [MCP_INTEGRATION.md](./MCP_INTEGRATION.md). The short version: the Stack uses a four-tier integration pattern (official MCP → bundled local MCP → Bash wrapper → hosted gateway) so the agents work even when the official MCP for a tool is admin-gated or doesn't exist.

---

## The Customization Layer (`customization/`)

Without `customization/`, the agents are generic. With it, they understand your books.

The layer holds three kinds of org-specific knowledge:

1. **`reference/`** — what the agents *know* about your books: tagged chart of accounts, vendor map, customer map, entity structure, non-GAAP rules (declarative YAML), closed periods, ATB snapshots.
2. **`templates/`** — what your outputs *look like*: board deck, exec update, IR memo, variance package, close packet.
3. **`voice/`** — how your writing *sounds*: CEO update style, investor-letter style.

Every agent in the Stack agrees to a four-rule contract (see `customization-stub/AGENT_CONTRACT.md`):

1. Read `customization/` before acting
2. Map natural language to the reference layer *first*, then call MCPs
3. Never write to `customization/` without explicit human approval
4. Surface gaps; don't paper over them

Users populate `customization/` either by hand (using stubs in `customization-stub/`) or interactively via the `setup-org` skill. The folder is gitignored by default so books never get committed.

The non-GAAP piece is fully declarative: `customization/reference/non-gaap-rules.yaml` defines what your org excludes (SBC, restructuring, crypto MTM, fair-value revaluation — whatever applies) and how the bridge is presented (side-by-side, single-pnl-with-adjustments-block, bridge-only). The same `finance-view-switch` skill works for any industry because the rules live in config, not code.

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
- **Composable skills.** Skills can be shared across agents — see [The Skill Layer](#the-skill-layer) below.
- **Plain text.** Everything is markdown or YAML, version-controllable, diff-able, reviewable.
- **No code inside the agent itself.** The runtime (Layer 2) executes; the agent describes.

---

## The Skill Layer

Before describing the runtime and registry, one foundational concern: **how skills compose.** Skills are the atomic unit of reasoning in the Stack — each one captures one capability completely. Agents are orchestrators that invoke skills; skills are the work.

The Stack supports **four scopes of skill**, in order of specificity:

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT-PRIVATE — agents/<name>/skills/<skill>.md                │
│  ────────────────────────────────────────────                   │
│  Tightly coupled to one agent's identity, schedule, workflow.   │
│  Examples: close-calendar (Controller), transaction-matching    │
│  (Bank Recon), approval-validation (QBO Poster).                │
│                                                                 │
│  Invoked: only by the owning agent.                             │
└─────────────────────────────────────────────────────────────────┘
                            +
┌─────────────────────────────────────────────────────────────────┐
│  STACK-SHARED — skills/<skill>.md (at repo root)                │
│  ────────────────────────────────────────────                   │
│  Used by multiple agents. Single source of truth for schemas,   │
│  formats, methodologies that lose meaning if duplicated.        │
│  Examples: proposal-format, approval-record-format,             │
│  slack-conventions, kpi-snapshot, budget-checker.               │
│                                                                 │
│  Imported in config.yaml as: stack_skills.required: [stack:X]   │
│  Referenced in skill files as: stack:X (e.g., stack:proposal-   │
│  format)                                                         │
│                                                                 │
│  Invoked: by any agent that imports it OR directly by a human   │
│  in Claude Desktop. Your teammate's budget-checker fits here.   │
└─────────────────────────────────────────────────────────────────┘
                            +
┌─────────────────────────────────────────────────────────────────┐
│  FINANCE-PLUGIN — from Anthropic's Finance plugin               │
│  ────────────────────────────────────────────                   │
│  Domain skills published by Anthropic (or third parties).       │
│  Examples: finance:variance-analysis, finance:journal-entry,    │
│  finance:reconciliation, finance:sox-testing.                   │
│                                                                 │
│  Imported as: finance_plugin_skills.required: [finance:X]       │
└─────────────────────────────────────────────────────────────────┘
                            +
┌─────────────────────────────────────────────────────────────────┐
│  GLOBAL UTILITY — office-suite, etc.                            │
│  ────────────────────────────────────────────                   │
│  Cross-cutting helpers that every agent uses.                   │
│  Examples: sop-pdf, sop-pptx, sop-xlsx, sop-docx for producing  │
│  formatted deliverables.                                         │
│                                                                 │
│  Imported as: global_skills: [sop-X, ...]                        │
└─────────────────────────────────────────────────────────────────┘
```

### Why this matters

The shared layer is the foundational design move that prevents schema drift across agents. When five agents propose journal entries (Controller, Prepay Manager, Bank Recon, crypto-reconciler, Payroll Reviewer) and one agent posts them (QBO Poster), they all need to agree on what a "proposal" looks like. Without a shared skill, each agent describes the schema inline in its own files — and the moment one drifts, the execution-pack contract breaks.

The `stack:proposal-format` skill is the canonical schema. Every proposing agent imports it. Every Poster (QBO, NetSuite, Xero, etc.) reads against it. One file, one source of truth, ten agents in agreement.

### When to hoist

A skill belongs in the shared layer when **all three** are true:

1. **More than one agent invokes it** (actual or imminent, not theoretical).
2. **The contract is the value** — the skill's job is to enforce a consistent format, schema, or methodology.
3. **The reasoning is generic** — doesn't depend on one agent's specific identity, schedule, or workflow.

If you find yourself describing the same schema in two agents' skill files, hoist it.

### When to keep agent-private

- The skill depends on one agent's specific operating tempo (Controller's `close-calendar`)
- The algorithm is specific to one workflow (Bank Recon's `transaction-matching`)
- Execution mechanics that are intentionally narrow to one agent for security (QBO Poster's `approval-validation`, `post-to-qbo`)

### Human-invoked skills

A useful pattern that often gets missed: shared skills can be invoked directly by a human in Claude Desktop, no agent required. Your teammate's `budget-checker` is exactly this — anyone asks "is Notion in the budget?" and the skill triggers. The same `budget-checker` skill can ALSO be invoked by FP&A Analyst during budget-build, or by AP Watcher when validating an invoice. One skill, three invocation paths (human, FP&A, AP) — that's the leverage.

See [`skills/README.md`](./skills/README.md) for the current shared-skill catalog (9 candidates as of v0.1, with `stack:proposal-format` shipped as the first).

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

## The MCP integration layer

Agents are useless without connections to the tools that hold your books. The Stack treats MCP integration as a first-class architectural concern, not an afterthought.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   MCP INTEGRATION — four tiers, picked by what works            │
│   ────────────────────────────────────────────────────────────  │
│                                                                 │
│   TIER 1 — Official MCP (vendor-built)                          │
│     · slack, gmail, notion, google-calendar                     │
│     · Use when the official MCP works at user scope             │
│                                                                 │
│   TIER 2 — Bundled local MCP (ships in this repo, mcps/)        │
│     · qbo, ramp, mercury, stripe, brex, rippling, carta         │
│     · Use when the official MCP is admin-gated or doesn't exist │
│     · Runs locally under your OAuth grant; credentials never    │
│       leave your machine                                         │
│                                                                 │
│   TIER 3 — Bash + Python wrapper                                │
│     · For one-off integrations not worth a full MCP             │
│     · Agent shells out to a script; credentials in dotfile     │
│                                                                 │
│   TIER 4 — Hosted MCP gateway (Smithery, Composio, etc.)        │
│     · Fallback when you want zero local setup                   │
│     · Trade-off: your data routes through a third party        │
│                                                                 │
│   Plus: create-finance-mcp skill (v0.2)                         │
│     · Scaffolds new Tier-2 MCPs from a template — the           │
│       leverage move for community contributions                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Agents are agnostic to which tier is in use. They declare MCP names in `config.yaml` (e.g., `quickbooks`, `slack`) and the user's Claude Desktop config maps each name to a specific server. Switching from Tier 4 (Smithery-hosted QBO) to Tier 2 (local bundled QBO MCP) is a two-line config edit — no agent code changes.

This is what makes the Stack work for non-admin QBO users, for organizations with strict data-residency requirements, and for tools where no vendor MCP exists yet. See [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) for the full hierarchy, the bundled MCP catalog, and the contribution flow.

---

## How agents relate to each other

Three distinct relationship patterns show up in agent systems. The Stack uses one of them today and will add a second in v0.3. Conflating them is one of the most common architectural mistakes; this section names them explicitly.

### Peer agents (the Stack model)

Independent agents that run on their own schedules and communicate by reading each other's outputs. No agent owns another. The relationships are temporal (Controller produces close packet at Day 3; FP&A reads it at Day 4) and file-based (`~/finance-data/closes/<period>/status-report.md`), not call-based.

```
Controller ──► closes/2026-05/status-report.md ──► FP&A Analyst
                                                ──► IR Agent
                                                ──► Treasury (reads cash)
```

Why peers, not parent/child:
- Each agent has its own schedule, materiality thresholds, escalation paths
- Failures are isolated — if FP&A breaks, Controller still closes the books
- Each agent's audit log is independent — easier for SOX
- A user can install any subset and the installed agents still work

This is the model the Stack ships with in v0.1/v0.2.

### Sub-agents (intra-task fan-out — v0.3 candidate)

A single agent spawns short-lived helpers to do parallel work within one of its own tasks. The parent has a goal ("complete the reconciliations pass"); the sub-agents have bounded sub-tasks ("reconcile the BoA operating account", "reconcile AR aging vs. subledger"). Each sub-agent has its own isolated context, returns a report, and exits. The parent synthesizes.

```
Controller (reconciliations pass)
    ├─► sub-agent: bank-rec(BoA operating)
    ├─► sub-agent: bank-rec(Mercury)
    ├─► sub-agent: AR-rec
    ├─► sub-agent: AP-rec
    └─► sub-agent: intercompany-rec
                              ↓
                  Controller synthesizes → reconciliations.md
```

When sub-agents make sense:
- A task naturally fans out into parallelizable sub-tasks
- Each sub-task has a focused context that would pollute the parent's context if inlined
- The work would otherwise blow through a single agent's context budget
- Speed matters (sub-agents run in parallel)

When sub-agents *don't* make sense:
- The work is genuinely sequential (later steps depend on earlier ones)
- Coordination overhead exceeds parallelization win
- The user needs to see and approve each step (sub-agents are opaque to humans by design)

The Stack will introduce sub-agents in v0.3 starting with Controller's reconciliations pass. See `docs/v0.3-controller-fanout.md` for the design sketch.

### Parent/child orchestration (not used in the Stack)

A long-lived parent agent owns a queue of work and dispatches it to specialized children that report status back over time. This is closer to a workflow engine than to the Stack's pattern. It's the right shape for high-frequency event-driven systems (incident response, customer support routing) — not for finance work, which is more time-boxed and audit-driven.

The Stack deliberately avoids this pattern. If you find yourself wanting it, you probably want either (a) a real workflow engine like Temporal, or (b) the peer-agent pattern with a scheduler that fires the right agent at the right time.

### Rules of thumb

- **Default to peers.** It's the only pattern that gives each agent its own audit log, schedule, and failure boundary. Use this unless you have a specific reason not to.
- **Reach for sub-agents when context budget is the bottleneck.** Not when "I want parallelism" — peers already give you parallelism across time. Sub-agents are for parallelism *within a single task* that's hitting context limits.
- **Avoid parent/child.** Finance work is monthly-cyclical and audit-trailed. Workflow engines are overkill; peers handle the cadence naturally.

---

## Scaling from one human to a whole finance team

The Stack ships with single-user setup in mind (the LinkedIn launch persona is a Finance Leader running it for themselves). But real finance teams have multiple humans interacting with the same set of agents. The architecture handles this cleanly without changing how agents run.

### One execution surface, team-wide interaction

The agents only ever run in **one place** — the dedicated laptop. They never run on each team member's machine.

What changes when you scale to a team is the *interaction surface*, not the *execution surface*:

```
                          DEDICATED LAPTOP (1 machine)
                          ─────────────────────────────
                          Agents run on schedule
                          ┃
                          ┃ posts to
                          ▼
              ┌──────────── SHARED SLACK ────────────┐
              │  #finance-ops · #finance-approvals    │
              │  #fpa-ops · #treasury-ops · etc.      │
              └──────────────────────────────────────┘
               ▲          ▲          ▲          ▲
            Owner    AP lead   AR / close   Treasury
                                lead         lead
            (Mac)    (PC)       (Mac/PC)    …
```

Each team member only needs Slack access. They read posts, approve JE proposals by typing `/approve <id>`, DM agents for ad-hoc questions (`@treasury what's our cash position?`), and post inline corrections.

No software installs. No agent runtime. No machine setup. The dedicated laptop is operationally invisible to them — they only see the agents' work in Slack.

### Multi-user approvals

QBO Poster's 8-check validation includes an **authorized-approver** check. Each JE type declares which roles or specific Slack users are allowed to approve it; only `/approve` typed by an authorized person passes validation.

This lives in `customization/reference/approval-policy.yaml`:

```yaml
approval_policy:
  # Accounts Payable
  - je_type: ap_disbursement
    approvers: [ap-lead@yourcompany.com, controller@yourcompany.com]
    threshold_usd: 50000

  # Accounts Receivable — bad-debt writeoffs
  - je_type: ar_writeoff
    approvers: [ar-lead@yourcompany.com, controller@yourcompany.com]
    threshold_usd: 5000

  # AR credit memos — billing dispute reversals
  - je_type: ar_credit_memo
    approvers: [ar-lead@yourcompany.com, billing-lead@yourcompany.com]
    threshold_usd: 10000

  # Invoicing / billing adjustments — rebills, refunds, pass-through corrections
  - je_type: invoice_adjustment
    approvers: [billing-lead@yourcompany.com]
    threshold_usd: 10000

  # Standard month-end accruals
  - je_type: standard_close_accrual
    approvers: [close-lead@yourcompany.com, controller@yourcompany.com]
    threshold_usd: 10000

  # Prepaid amortization (Prepay Manager output)
  - je_type: prepaid_amortization
    approvers: [close-lead@yourcompany.com]
    threshold_usd: 25000

  # Bank reconciliation adjustments
  - je_type: bank_reconciliation_adjustment
    approvers: [bank-recon-lead@yourcompany.com, controller@yourcompany.com]
    threshold_usd: 1000

  # Treasury / large outflows
  - je_type: treasury_movement
    approvers: [treasury-lead@yourcompany.com, cfo@yourcompany.com]
    threshold_usd: 25000  # any amount above requires CFO

  # Payroll
  - je_type: payroll
    approvers: [payroll-lead@yourcompany.com]
    threshold_usd: 200000

  # Intercompany — always dual approval, no thresholds
  - je_type: intercompany
    approvers: [cfo@yourcompany.com, controller@yourcompany.com]
    require_dual_approval: true
```

The role placeholders (`ap-lead`, `ar-lead`, `close-lead`, etc.) are aligned to typical finance-function ownership. Map them to actual emails in your `customization/reference/approval-policy.yaml`. Small finance teams may have one person filling several roles — that's fine; just list the same email under multiple `je_type` blocks.

The audit log captures who approved what, with what content hash, when. Every entry is attributable to a specific human.

### Optional: ad-hoc Claude Desktop access per team member

Anyone on the team who wants to query agents *outside* Slack can install Claude Desktop on their own machine and add the registry MCP to their config. Works identically on Mac and Windows — the registry endpoint and MCP shape are OS-agnostic.

This is useful for impromptu queries in meetings ("@fpa-analyst, what's our burn rate run-rate?"), but isn't required for everyday participation. Slack covers 95% of interactions.

### The customization layer in a team

The reference layer (`customization/reference/chart-of-accounts.xlsx`, `non-gaap-rules.yaml`, `vendor-map.xlsx`, etc.) is the source of truth for the org. Team members shouldn't edit it freely or you lose consistency.

Two workflow patterns:

**Pattern A — Gatekeeper (recommended for v0.2).** The customization layer lives in a private git repo. Team members propose changes via PR or by Slack-asking the owner. The owner reviews, merges, pulls to the dedicated laptop. Slow but fully auditable.

**Pattern B — Slack-driven updates (v0.3+).** An `update-reference` agent watches `#finance-ops` for messages like `@finance-ops tag vendor "Hetzner Online GmbH" as Cloud Infrastructure`, drafts a PR to the customization repo, awaits approval, pulls. Faster but requires the agent build-out.

Start with A. Graduate to B once the team has rhythm.

### What this means in practice

| Role | Setup needed | Daily interaction |
|---|---|---|
| **Stack owner** | Dedicated laptop running agents; manages customization layer | 30 min/close + maintenance |
| **Backup operator** | Read access to customization repo; SSH/RDP access to dedicated laptop for emergencies | Step in when owner is out |
| **Function leads** (AP, AR, invoicing, accruals, prepays, bank recon, payroll, treasury) | Just Slack | Approve proposals in their function's authority via `/approve` |
| **Read-only consumers** | Just Slack | Read close packets, variance reports, IR drafts |
| **Anyone wanting ad-hoc queries** | Optionally: Claude Desktop + registry MCP on their own laptop | DM agents for impromptu questions |

The Stack scales from "one person automating their own work" to "a 5-person finance team with declarative approval policy" without changing the agent runtime. The dedicated laptop stays the only place where execution happens.

---

## Composition rules

Three rules govern how packs compose with the core:

1. **Core agents don't depend on pack agents.** A reader who installs only the core agents has a complete Finance function. Industry packs and the execution pack are additive, never required for the core to function (though no posting agent means no GL writes — proposals stay in the queue until you set one up).
2. **Pack agents may depend on core agents.** `crypto-reconciler` feeds Controller's close packet; it can't operate fully without Controller. `qbo-poster` posts JEs proposed by Controller, Prepay Manager, Bank Recon, and others — it depends on at least one proposing agent.
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

- **v0.1 (shipped):** 10 core agents + crypto-reconciler (first pack agent) + QBO Poster (first execution-pack agent — the only category allowed to write to the GL, gated through human approval)
- **v0.2 (next):**
   - **Bundled local MCPs** under `mcps/` for QBO, Ramp, Mercury, Stripe, Brex, Rippling, Carta — solves the admin-gated-MCP problem (especially for QBO)
   - **`create-finance-mcp` skill** for community-contributed Tier-2 MCPs
   - **MCP registry server** so agents install via one JSON snippet, no `git clone`
   - **Additional execution-pack agents:** netsuite-poster, xero-poster, rillet-poster, sage-intacct-poster
   - **ERP skill library** scaffolded under `skills/erp/`
   - 2-3 additional crypto pack agents (defi-monitor, crypto-tax-tracker, staking-yield-tracker)
- **v0.3:** PSP pack authored (fraud-loss-watcher, interchange-reconciler, merchant-onboarding-tracker)
- **v0.4+:** SaaS pack, Marketplace pack opened for community contribution
