# The AI Finance Stack — Architecture

Three layers, each owning a distinct concern. They compose into a complete Finance agent system that runs locally on your own hardware and is shareable with anyone running an MCP-compatible AI client.

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
