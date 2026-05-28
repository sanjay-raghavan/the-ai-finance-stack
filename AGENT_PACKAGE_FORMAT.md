# Agent Package Format — v0.1

The spec every agent in The AI Finance Stack follows. Designed to be compatible with Claude Code's native agent format so packages drop in cleanly.

## Folder structure

```
agents/<agent-name>/
├── CLAUDE.md          # Required. Identity, role, operating instructions.
├── skills/            # Required (can be empty). Reusable capabilities.
│   ├── <skill-1>.md
│   ├── <skill-2>.md
│   └── ...
├── config.yaml        # Required. MCPs, schedule, goals, model config.
└── README.md          # Required. Human-readable install + usage notes.
```

`<agent-name>` is kebab-case and globally unique within The AI Finance Stack (e.g., `close-orchestrator`, `ap-watcher`, `variance-alert`).

---

## CLAUDE.md — Identity and Instructions

The agent's brain. Read by Claude Code at every invocation. Should answer four questions:

1. **Who is this agent?** (Name, role, one-sentence purpose)
2. **What is it allowed to do?** (Tools, MCPs, files it can read/write)
3. **What is it explicitly NOT allowed to do?** (Guardrails — never delete journal entries, never email customers without approval, etc.)
4. **How does it decide what to do?** (The reasoning steps, escalation thresholds, what to surface vs. handle silently)

**Length target:** 800–2,000 words. Long enough to give real instructions, short enough to fit in context every run.

**Tone:** Direct, second-person addressed to the model. Like a job description for a very capable junior teammate.

**Template:**

```markdown
# Close Orchestrator

You are the **Close Orchestrator** — the agent that owns Strand's month-end close from the last business day of each month through the close packet hand-off.

## Your role

Run the month-end close, end to end. Pull data, prepare entries, run reconciliations, generate the status report, surface only what needs human review.

## What you can do

- Read from QuickBooks via the `quickbooks` MCP
- Write to the local `~/finance-data/closes/<year>-<month>/` directory
- Post messages to the `slack` MCP in `#finance-ops` and `#finance-alerts`
- Invoke the Finance Plugin skills: `finance:close-management`, `finance:journal-entry`, `finance:reconciliation`

## What you must NOT do

- Never post journal entries directly to QuickBooks. Generate them, save them as files, surface them for human approval.
- Never delete data of any kind. Read-only on systems-of-record.
- Never message anyone outside `#finance-ops` or `#finance-alerts`.
- Never send email under any circumstances in v0.1.

## How you operate

[The reasoning steps — see Close Orchestrator's CLAUDE.md for the full version.]
```

---

## skills/ — Composable Capabilities

Skills are markdown files describing one capability. Inspired by Claude Code's skill format. Each skill is a self-contained micro-instruction set that the agent can invoke when relevant.

**One skill, one job.** A skill called `accrual-entries.md` handles the preparation of standard month-end accruals. It doesn't also handle the close calendar.

**Skills can be shared across agents.** The same `variance-narrative.md` skill used by the Close Orchestrator can be invoked by the Variance Watcher. To share a skill across the Stack, put it in a top-level `skills/` directory (future) and reference it from the agent's `config.yaml`.

**Skill file format:**

```markdown
# Skill: Accrual Entries

Prepare standard month-end accrual journal entries based on the previous period's pattern, with adjustments for known one-time events.

## When to invoke

When the close calendar reaches the "Standard Accruals" step (typically Day 1 of close).

## Inputs

- The current month-end date
- The list of accrual lines from the prior month
- Any flagged one-time events from the close calendar

## Outputs

A markdown table of proposed entries with Debit / Credit / Account / Department / Memo / Amount columns. Write to `~/finance-data/closes/<year>-<month>/accruals-proposed.md`.

## Process

1. Pull the prior month's accrual entries from QuickBooks
2. For each recurring accrual, project the current month's amount using [methodology]
3. Apply one-time event adjustments
4. Format the output table
5. Run the 11-point review checklist from `finance:journal-entry`
6. Save to file and return the table

## Escalation thresholds

If any accrual deviates from the prior month by >25%, surface to `#finance-ops` before saving — DO NOT save automatically.
```

---

## config.yaml — Runtime Configuration

The machine-readable side of the agent definition.

```yaml
# Identity
name: close-orchestrator
version: 0.1.0
description: End-to-end month-end close automation for the Strand reference company.
author: Sanjay Raghavan
license: MIT
homepage: https://theaifinancestack.com/agents/close-orchestrator
tags:
  - close-management
  - controller
  - flagship

# Required MCPs — agent will not start without these
mcps:
  required:
    - quickbooks
    - slack
  optional:
    - google-drive       # for archiving the close packet
    - notion-finance     # for posting summary to the Finance wiki

# Required Finance Plugin skills
finance_plugin_skills:
  - finance:close-management
  - finance:journal-entry
  - finance:reconciliation

# Schedule
schedule:
  # Cron syntax. Runs at 9am ET on the 1st business day of each month.
  cron: "0 9 1 * *"
  timezone: America/New_York
  # If the 1st is a weekend, the runtime should defer to the next business day.
  business_days_only: true

# Goals (what success looks like)
goals:
  primary:
    - Close the books within 3 business days from period-end
    - Prepare all standard accrual entries by end of Day 1
    - Complete all standard reconciliations by end of Day 2
    - Surface 100% of items requiring human review; nothing booked silently
  metrics:
    - close_duration_business_days
    - accruals_prepared_count
    - reconciliations_completed_count
    - items_flagged_for_review_count

# Output paths (relative to the runtime's data directory)
outputs:
  base_dir: ~/finance-data/closes/<year>-<month>/
  files:
    - close-calendar.md
    - accruals-proposed.md
    - reconciliations.md
    - status-report.md

# Model configuration
model:
  provider: anthropic
  name: claude-opus-4
  max_tokens: 8000
  temperature: 0.2  # We want consistency in Finance work, not creativity

# Notifications
notifications:
  slack:
    channels:
      summary: "#finance-ops"
      alerts: "#finance-alerts"
  on_success: summary
  on_flagged_items: summary
  on_error: alerts

# Logging
logging:
  level: info
  retain_days: 90
```

---

## README.md — Human-Readable Install & Usage

The file an outside user reads to decide whether to install this agent. Should be 200–500 words and cover:

- **What it does** in one paragraph
- **Required MCPs and how to set them up** (links to the MCP setup guides)
- **Schedule** (how often it runs, configurable)
- **Outputs** (what files / messages it produces)
- **Customization notes** (which assumptions might need to change for your business)
- **Known limitations**

---

## Versioning

- `0.x.y` — pre-stable. Format and config may change between versions.
- `1.0.0` — first stable release. Format frozen; new fields are additive only.

Each agent has its own version. The Stack itself also has a version (semver) that reflects the agent package format.

---

## Validation

A future `the-ai-finance-stack validate <agent-dir>` CLI command will check that an agent package conforms to this spec. Until that exists, follow the format manually and reference the Close Orchestrator as the canonical example.
