# Revenue Ops — `@revenue-ops`

> Your sales-to-cash hand-off — calculates commissions, tracks ARR movement, supports the deal desk, monitors quota attainment, and keeps the revenue pipeline data clean enough that Finance can trust it.

**Category:** Finance & Accounting (with overlap into Sales & RevOps) · **Function:** Revenue Operations · **Status:** 🟡 Skeleton (v0.1 target) · **License:** MIT

---

## What Revenue Ops does

- **Commission calculations** — monthly commission run from CRM data + comp-plan rules; surfaces edge cases (deals that span periods, clawbacks, accelerators)
- **ARR tracking** — bookings vs. new ARR vs. live ARR; reconciles CRM-reported ARR against billing-system ARR (where they disagree, surfaces the gap)
- **Deal-desk support** — flags non-standard terms in proposed contracts (e.g., unusual discount levels, multi-year prepay structures, rev-rec implications); does not approve
- **Quota attainment scorecard** — weekly snapshot of where each rep / team is against quota
- **Pipeline data hygiene** — flags deals with missing required fields, stale dates, or unrealistic close timing; never modifies CRM records, only surfaces
- **Renewal watch** — surfaces renewals coming up in the next 90 days with relationship history and at-risk signals
- **Hand-off integrity** — at deal close, validates the CRM-to-billing-system hand-off; flags any field mismatches that would corrupt invoicing

---

## What Revenue Ops will not do

- Modify CRM records — only flags issues
- Approve deal terms — flags non-standard items for human review
- Pay commissions — surfaces the run for human approval

---

## Required setup

- **MCPs:** CRM (`hubspot`) + billing MCP (`stripe`, `chargebee`, `salesforce` when added) + `slack`; optionally accounting MCP
- **Slack channels:** `#revops-ops`, `#finance-alerts`
- **Skills** (four scopes — see [`/skills/README.md`](../../skills/README.md)):
  - **Agent-private** (in `agents/revenue-ops/skills/`): `commission-run`, `arr-reconciliation`
  - **Stack-shared imports:** `stack:proposal-format` (commission-accrual proposals), `stack:slack-conventions` (channel routing)
  - **Finance plugin skills:** inherited per `config.yaml`
  - **Global utility:** `sop-pdf`, `sop-pptx`, `sop-xlsx`, `sop-docx`

---

## Schedule

- **Monthly commission run:** Day 5 of new period
- **Weekly ARR / quota scorecard:** Monday 9am
- **Daily pipeline hygiene scan:** 7am
- **Renewal watch:** weekly, Tuesday 9am
- **Deal-desk flag:** triggered on CRM events (deal moves to "Negotiation" or "Closed Won")

---

## Curriculum lessons that build this agent

- Module 7 advanced agent build (post placement TBD when the lesson is written)
- Cross-references the FP&A Analyst for the ARR roll-up

---

## Status notes

**v0.1 — fully authored.** Ships with two skills (`commission-run`, `arr-reconciliation`). Future v0.2 candidates: `quota-scorecard` (currently inline), `pipeline-hygiene` (currently inline in CLAUDE.md), `deal-desk-flag` (currently inline), and `renewal-watch` (currently inline). Pulling each into a dedicated skill file lets other agents invoke them independently.

Most useful for companies with >$10M ARR — pre that scale, the commission-and-ARR overhead is small enough that this agent is overkill. Revenue Ops feeds FP&A (ARR roll-up), AR Follow-Up (deal hand-off integrity), Payroll Reviewer (commission cost), and IR (KPI scorecard).
