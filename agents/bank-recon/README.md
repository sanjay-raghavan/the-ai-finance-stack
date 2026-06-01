# Bank Recon — `@bank-recon`

> Your staff accountant for cash — hourly transaction matching, aging discipline, audit-quality period-end attestations.

**Category:** Finance & Accounting · **Pack:** Core · **Status:** v0.1 — fully authored · **License:** MIT

---

## What Bank Recon does

- **Continuous transaction matching** — every hour during business hours, every 4 hours overnight, pull new bank transactions and match each to GL/subledger entries. Auto-clear high-confidence matches (≥0.95 score); queue medium-confidence for human review; surface low-confidence items for investigation.
- **Daily digest** — summary of yesterday's matching activity in `#bank-recon`
- **Weekly aging report** — items aged >14 days surfaced; items aged >30 days escalated
- **Monthly period-end attestation** — formal reconciliation artifact for each bank account, signed off as part of close. **Residual must be zero or attestation halts.**

---

## What Bank Recon will not do

- Modify bank records (read-only on every banking source)
- Modify GL transactions (read-only on the accounting system)
- Auto-clear below the configured confidence threshold
- Force a residual to zero by inserting a plug entry
- Close an attestation with a non-zero residual
- Reuse a match from a prior reconciliation

---

## Why this is its own agent

Bank rec is two distinct modes:

- **Continuous matching** is high-volume daily work — Strand-scale PSPs see hundreds of bank transactions per day. Folding this into Controller's monthly close means thousands of unmatched items pile up by month-end.
- **Period-end attestation** is the formal close-time artifact. Controller's current `reconciliations` skill handles this fine for the periodic part — but the continuous matching has nowhere else to live.

A dedicated Bank Recon agent matches in real time, surfaces investigation paths immediately, and reduces period-end attestation to a fast pre-investigated pass rather than a wall of unmatched items.

---

## The matching algorithm

Every candidate match between a bank transaction and a GL/subledger entry gets a weighted confidence score:

| Factor | Weight |
|--------|--------|
| Amount match | 40% |
| Date proximity (within 3 / 7 / 14 days) | 20% |
| Counterparty match (fuzzy name) | 20% |
| Description/memo overlap | 10% |
| Direction match (debit/credit consistency) | 10% |

Score thresholds:
- **≥0.95** → auto-clear
- **0.70–0.95** → human review queue
- **<0.70** → unmatched; investigate

**Contextual boost:** if a bank transaction aligns with another agent's expected-transaction list (AP Watcher's payment run, AR Follow-Up's expected receipts, Treasury's planned transfers), the matching score gets a small boost. This is how the Stack's coordination pays off — each agent's outputs inform Bank Recon's matching accuracy.

---

## Required setup

### MCPs

At minimum:

- One of: `mercury` · `modern-treasury` · `plaid` (banking source — read-only)
- One of: `quickbooks` · `xero` · `netsuite` (GL — read-only on cash accounts)
- `slack`

Multiple banking MCPs can be connected — each adds accounts to the reconciliation roster.

### Local configuration

- `~/finance-data/bank-recon/accounts.yaml` — for each account: bank source, account number (last 4 only in summaries), GL account, account type (operating / reserve / merchant-settlement), custody arrangement

### Slack channels

- `#bank-recon` — daily digests, ambiguous-match queue, weekly aging
- `#finance-alerts` — critical aging items, suspected-fraud patterns, attestation failures

### Skills

Four scopes — see [`/skills/README.md`](../../skills/README.md):

- **Agent-private** (in `agents/bank-recon/skills/`): `transaction-matching`, `unmatched-investigation`, `period-end-attestation`
- **Stack-shared imports:** _(none in v0.1 — `stack:proposal-format` for recon-adjustment proposals and `stack:slack-conventions` queued for v0.2 hoist)_
- **Finance plugin skills:** `finance:reconciliation` (inherited per `config.yaml`)
- **Global utility:** `sop-pdf`, `sop-pptx`, `sop-xlsx`, `sop-docx`

---

## Schedule

| Run | Timing |
|-----|--------|
| Continuous matching | Hourly during business hours; every 4 hours overnight |
| Daily digest | 8am ET, weekdays |
| Weekly aging report | Monday 9am ET |
| Monthly period-end attestation | Day 1 of new period, 10am ET (between Controller's 9am and 11am passes) |

---

## Outputs

- `<year>-<month>/matching/auto-cleared-<date>.md` — high-confidence matches
- `<year>-<month>/matching/queue-pending-review.md` — items awaiting human review
- `<year>-<month>/matching/unmatched-<date>.md` — items with no proposed match, with investigation notes
- `<year>-<month>/attestations/<account-label>.md` — formal monthly attestation per account
- `<year>-<month>/aging/<date>.md` — weekly aging report

---

## Customization notes

- **Score thresholds** — default 0.95 auto-clear / 0.70 review. Tight enough that auto-clears are reliable; loose enough that high-confidence matches don't all funnel through the human queue.
- **Aging thresholds** — default 14-day warning, 30-day critical. PSP / high-volume teams might tighten to 7/21.
- **Account types** — Strand-style PSPs configure separate accounts for operating cash vs. merchant settlement; this maps to Treasury's float-separation discipline.

---

## Known limitations (v0.1)

- **Multi-currency accounts** — v0.1 reconciles in account-currency only. Cross-currency reconciliation (e.g., a USD account that received an EUR wire that got converted) needs an FX-aware adjustment skill (v0.2 candidate).
- **Cash-pool / sweep arrangements** — accounts with automatic overnight sweeps to a higher-yielding account need explicit treatment (the sweep is a real transfer but generates no economic activity). v0.2 candidate.
- **Lockbox arrangements** — checks deposited through a lockbox service generate batch deposits that need split-classification. v0.2 candidate.

---

## Curriculum lessons that build this agent

- Future Module 7 lesson on continuous-matching agents (post placement TBD)
- References Controller (period-end attestation hand-off)

---

## Status notes

**v0.1 — fully authored.** Ships with three skills (`transaction-matching`, `unmatched-investigation`, `period-end-attestation`). Future v0.2 candidates:

- `fx-aware-matching` (multi-currency support)
- `sweep-arrangement-handling` (cash-pool / overnight sweep accounts)
- `lockbox-batch-split` (batch deposit split-classification)
- `fraud-pattern-detection` (dedicated skill with broader pattern library)

Bank Recon feeds Controller (period-end attestations + adjustment JE proposals) and consumes outputs from AP Watcher, AR Follow-Up, Payroll Reviewer, and Treasury (expected-transaction context for the matching algorithm's contextual boost).
