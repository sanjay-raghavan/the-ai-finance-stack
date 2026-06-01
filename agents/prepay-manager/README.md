# Prepay Manager — `@prepay-manager`

> Your prepaid accountant — identifies prepayments from the AP stream, sets up amortization schedules, proposes monthly amortization JEs, reconciles prepaid asset balances.

**Category:** Finance & Accounting · **Pack:** Core · **Status:** v0.1 — fully authored · **License:** MIT

---

## Why this is its own agent

At growth-stage Finance teams, prepaid expense management is genuinely a full-time function for a junior accountant — 30+ active prepayments at any time (insurance, software, lease, sponsorships, retainers), each needing identification, schedule setup, monthly amortization, and lifecycle tracking. The work spans daily (watching the AP stream) and monthly (close-time amortization) — too continuous to fold into Controller's monthly close.

The choice for The AI Finance Stack: split prepayment management into a dedicated agent rather than a Controller skill. Companies with <5 active prepayments at a time can choose to ignore this agent and let Controller handle prepayments inline; companies running 10+ active prepayments at any time benefit from the dedicated lifecycle handling.

---

## What Prepay Manager does

- **Identifies new prepayments** from AP Watcher's invoice stream within 4 hours of invoice arrival
- **Sets up amortization schedules** with proper start / end / monthly / accounts / department coding, validated against the underlying contract
- **Generates monthly amortization JEs** for every active schedule (one row per schedule for audit clarity), handing off to Controller as part of close
- **Maintains the prepaid balance reconciliation** — actual GL balance vs. expected from active schedules
- **Surfaces lifecycle events** — expiring schedules, expired-but-not-zeroed, suspended, amendments, renewal opportunities

---

## What Prepay Manager will not do

- Post journal entries (hands off to Controller; Controller routes through standard JE approval workflow)
- Modify schedules autonomously after approval (amendments require explicit human approval)
- Extend schedules past their contracted end date (renewals are new schedules, not continuations)
- Auto-classify ambiguous invoices as prepayments (surfaces for human classification)
- Aggregate JE rows (each schedule = its own row in monthly amortization)

---

## Required setup

### MCPs

At minimum:

- One of: `quickbooks` · `xero` · `netsuite` (for GL and chart of accounts)
- `slack`

Strongly recommended:

- `notion-finance` — contract storage for validation

### Local configuration

The agent maintains its own data:

- `~/finance-data/prepayments/active-schedules.yaml` — the canonical registry (managed by the agent, approved by you)
- `~/finance-data/prepayments/proposed/` — schedules awaiting your approval
- `~/finance-data/prepayments/<year>-<month>/` — per-period amortization runs and reconciliations

### Slack channels

- `#prepay-ops` (or `#finance-ops` if your team is small) — proposals, approvals, monthly amortization summaries
- `#finance-alerts` — errors, orphaned balances, escalations

### Skills

Four scopes — see [`/skills/README.md`](../../skills/README.md):

- **Agent-private** (in `agents/prepay-manager/skills/`): `prepay-identification`, `amortization-schedule`, `monthly-amortization`
- **Stack-shared imports:** `stack:proposal-format` (canonical JE proposal schema — used when writing monthly amortization proposals), `stack:slack-conventions` (channel routing)
- **Finance plugin skills:** `finance:journal-entry-prep` (optional)
- **Global utility:** `sop-pdf`, `sop-pptx`, `sop-xlsx`, `sop-docx`

---

## Schedule

| Run | Timing |
|-----|--------|
| Continuous identification | Every 4 hours during business hours (after AP Watcher's inbox sweep) |
| Monthly amortization | Day 1 of new period, 7am ET (before Controller's 11am accrual pass) |
| Monthly reconciliation | Day 2 of close, 9am ET |
| Quarterly schedule review | First day of each quarter |

---

## Outputs

All files written to `~/finance-data/prepayments/`. The most-referenced files:

- `active-schedules.yaml` — the canonical registry of active prepayments
- `<year>-<month>/amortization-input.md` — Controller consumes this each month for prepaid amortization JE proposals
- `<year>-<month>/reconciliation/` — period-end reconciliation of GL prepaid balances vs. expected

---

## Customization notes

Key things you'll adjust in `config.yaml`:

- **Materiality thresholds** — `prepayment_dollar_threshold` (default $5K, below which the agent auto-classifies with HIGH confidence rather than surfacing for review)
- **Schedule length cap** — `schedule_max_months` (default 36, above which surfaces for technical-accounting review)
- **Reconciliation tolerance** — `reconciliation_gap_dollar_threshold` (default $1K)
- **Pro-rata convention** — 30-day months vs. actual days; per schedule

---

## Known limitations (v0.1)

- **Multi-element arrangements** (e.g., software + implementation + training in one prepayment) need human guidance on allocation. The agent surfaces them as flagged; doesn't try to split automatically.
- **FX-denominated prepayments** treat the original-currency amortization as fixed; FX gains/losses on the prepaid balance need a separate adjustment (Controller skill, not in scope here).
- **Partial refunds mid-schedule** require explicit amendment approval — the agent can propose the amendment but doesn't auto-apply.
- **Schedule changes affecting historical periods are forbidden.** All amendments are forward-looking only.

---

## Curriculum lessons that build this agent

- Module 7 (post placement TBD) — Building Lifecycle-Oriented Agents
- References Controller (close hand-off) and AP Watcher (invoice stream)

---

## Status notes

**v0.1 — fully authored.** Ships with three skills (`prepay-identification`, `amortization-schedule`, `monthly-amortization`). Future v0.2 candidates: dedicated `reconciliation` skill (currently inline), `amendment-handling`, `renewal-detection-and-proposal`.

Prepay Manager feeds Controller (monthly amortization JE proposals) and reads from AP Watcher (invoice stream for identification). It is the only agent that maintains the prepaid schedule registry — all other agents read from it as the canonical source.
