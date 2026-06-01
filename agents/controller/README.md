# Controller — `@controller`

> Your senior controller — runs the close, prepares accruals, owns reconciliations, surfaces only what needs review.

A senior controller agent for The AI Finance Stack. Owns the month-end close end-to-end, prepares standard accrual journal entries, runs reconciliations, and produces an audit-ready close packet — surfacing items that need human review without booking anything silently.

**Category:** Finance & Accounting
**Status:** v0.1 · Reference implementation for The AI Finance Stack
**License:** MIT

---

## What Controller does

- **Generates the close calendar** for each period using `finance:close-management`, accounting for company-specific dependencies and target close duration
- **Prepares standard accrual journal entries** based on prior-period patterns, projected one-time events, and the 11-point review checklist from `finance:journal-entry-prep` — surfaces for human approval, never books
- **Runs reconciliations** (bank, GL-to-subledger, intercompany) using `finance:reconciliation`. Categorizes every reconciling item (Timing / Adjust / Investigate) with audit-ready documentation
- **Produces a close status report** in stand-up format (Yesterday / Today / Blockers) every morning during close
- **Drafts the variance narrative** for the period using `finance:financial-statements` for board-appropriate commentary the human can refine
- **Maintains an audit trail** — every action appended to an immutable JSONL log for SOX-readiness

---

## What Controller will not do

- Post journal entries directly to the GL (human approval required)
- Delete any record from any system
- Approve its own work
- Silently true-up prior-period balances
- Message anyone outside the configured Slack channels
- Improvise around uncertainty (halts and asks instead)

---

## Required setup

### MCPs

At minimum, one accounting MCP and Slack:

- One of: `quickbooks` · `xero` · `netsuite`
- `slack`

Optional but recommended:

- `mercury` or `modern-treasury` (banking)
- `plaid` (bank-data aggregation)
- `google-drive` (close-packet archive)
- `notion-finance` (Finance wiki posts)

### Skills

Four scopes — see [`/skills/README.md`](../../skills/README.md):

- **Agent-private** (in `agents/controller/skills/`): `close-calendar`, `accrual-entries`, `reconciliations`
- **Stack-shared imports:** `stack:proposal-format` (canonical schema for the accrual + recon-adjustment proposals Controller writes), `stack:slack-conventions` (channel routing, severity, link format)
- **Finance plugin skills:** `finance:close-management`, `finance:journal-entry`, `finance:journal-entry-prep`, `finance:reconciliation`, `finance:financial-statements` (optional)
- **Global utility:** `sop-pdf`, `sop-pptx`, `sop-xlsx`, `sop-docx`

### Slack channels

- `#finance-ops` — summaries and items needing review
- `#finance-alerts` — errors and escalations

---

## Schedule

Default schedule runs Controller's five passes across the first three business days of each new period:

| Pass | Timing | What it produces |
|------|--------|------------------|
| 1 — Close Calendar | Day 1, 9am ET | `close-calendar.md` |
| 2 — Standard Accruals | Day 1, 11am ET | `accruals-proposed.md` |
| 3 — Reconciliations | Day 2, 9am ET | `reconciliations.md` |
| 4 — Status Report | Day 3, 9am ET | `status-report.md` |
| 5 — Variance Narrative | Day 3, 2pm ET | `variance-narrative-draft.md` |

All passes are configurable in `config.yaml`. The runtime defers weekend triggers to the next business day automatically.

---

## Outputs

All files written to `~/finance-data/closes/<year>-<month>/`.

Each artifact follows a standard structure: Summary · Detail · Items Requiring Human Review · Methodology Notes · Audit Trail.

---

## Customization notes

Most of what you'll want to adjust lives in `config.yaml`:

- **Materiality thresholds** under `thresholds:` — defaults assume a growth-stage company; raise them for larger orgs, lower them for pre-revenue
- **Schedule** under `schedule.passes:` — shift earlier/later, or run all passes on Day 1 for accelerated 1-day close
- **Notification channels** under `notifications.slack.channels:` — point to your team's actual channels
- **MCP choice** in `mcps.required:` — pick the accounting system you actually use

Deeper customization (e.g., changing the audit-trail format, adding a new pass, modifying the Slack message templates) means editing the agent's `CLAUDE.md` directly. Edit a fork; don't fork the file and lose the upstream updates.

---

## Known limitations (v0.1)

- **Intercompany reconciliation is shallow.** Handles two-entity setups; multi-entity needs more sophisticated logic.
- **Tax provision is not handled.** Future Tax agent will own this.
- **Equity entries are not handled.** Stock-based comp, options exercises, and equity rounds require a separate workflow (manual for now).
- **Revenue recognition is assumed straightforward.** Complex ASC 606 scenarios (multi-element arrangements, variable consideration) need human-led setup.
- **No real-time chat interface.** Controller runs on schedule; ask-Controller-anything is a future feature.

---

## Lessons in the AI-Powered Finance series that build with this agent

- **Post 34 — The Strand Close Orchestrator (End-to-End Month-End Automation)** — builds Controller from first principles
- **Post 33 — Multi-Agent Systems for Finance** — shows Controller coordinating with AP Watcher and Investigation
- **Post 36 — Persistent Agents** — extends Controller with prior-period memory
- **Post 37 — Tier 5 Dedicated Agent Server** — runs Controller on a Mac mini 24/7

---

## Install (Claude Desktop, once the registry is live)

```json
{
  "mcpServers": {
    "the-ai-finance-stack": {
      "url": "https://theaifinancestack.com/mcp/registry"
    }
  }
}
```

Then tell Claude: *"Browse The AI Finance Stack and install Controller."*

Until the registry is live: clone the repo and follow [`SETUP_DEDICATED_LAPTOP.md`](../../SETUP_DEDICATED_LAPTOP.md).
