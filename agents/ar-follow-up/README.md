# AR Follow-Up — `@ar-follow-up`

> Your collections drafter — tracks invoice aging, drafts customer-appropriate follow-up messages, surfaces deal line-item errors that would corrupt ARR before they propagate.

**Category:** Finance & Accounting · **Function:** Accounts Receivable · **Status:** 🟡 Skeleton (v0.1 target) · **License:** MIT

---

## What AR Follow-Up does

- **Tracks invoice aging** — refreshes the AR aging schedule daily; computes DSO trend (rolling 30 / 60 / 90)
- **Drafts collection messages** — tone-matched to each customer's history (gentle for good payers, firm for repeat-late, escalation-ready for chronic). Drafts go to the AR Lead's inbox; never sent without approval
- **Surfaces deal line-item errors** — for subscription / multi-period contracts, validates that revenue recognition schedules match the contract terms; flags discrepancies that would distort ARR
- **Monitors payment reconciliation** — incoming payments matched to open invoices; partial-pay and short-pay flagged
- **Tracks revenue recognition** — for ASC 606 multi-element arrangements, surfaces upcoming rev-rec events; never modifies the schedule, only proposes
- **Computes cohort metrics** — net revenue retention, gross customer churn, expansion vs. contraction, for the FP&A and IR agents to consume

---

## What AR Follow-Up will not do

- Send messages to customers directly — drafts only, human approves and sends
- Adjust revenue recognition schedules in the GL — surfaces issues, human decides
- Apply credits, refunds, or write-offs autonomously

---

## Required setup

- **MCPs:** accounting MCP + `slack`; optionally `stripe`, `chargebee`, `gmail`, `paypal`, `square`
- **Slack channels:** `#ar-ops`, `#finance-alerts`
- **Skills** (four scopes — see [`/skills/README.md`](../../skills/README.md)):
  - **Agent-private** (in `agents/ar-follow-up/skills/`): `aging-analysis`, `collection-drafts`
  - **Stack-shared imports:** _(none in v0.1 — `stack:slack-conventions` queued for v0.2 hoist; `stack:proposal-format` for write-off adjustments queued)_
  - **Finance plugin skills:** inherited per `config.yaml`
  - **Global utility:** `sop-pdf`, `sop-pptx`, `sop-xlsx`, `sop-docx`

---

## Schedule

- **Daily aging refresh:** 8am
- **Weekly collections digest:** Tuesday 9am
- **Monthly cohort report:** 5th of each month, 9am (after the close packet)

---

## Curriculum lessons that build this agent

- Post 33 — Multi-Agent Coordination (AR Follow-Up paired with Investigation)
- Post 35 — Variance Alert Agent (uses AR Follow-Up's cohort metrics as inputs)

---

## Status notes

**v0.1 — fully authored.** Ships with two skills (`aging-analysis`, `collection-drafts`). Future v0.2 candidates: dedicated `cohort-metrics` skill (currently inline), `deal-line-validation` (rev-rec schedule checking), and `dispute-handling` (parsing dispute events from email/CRM).

AR Follow-Up feeds Controller (rev-rec validation at close), Treasury (AR aging input to 13-week projection), FP&A (cohort metrics), and IR (NRR + churn for monthly update). Customer tone bands (Good / Standard / Repeat-Late / Chronic) are the core craft — collection drafts that get the tone wrong damage customer relationships in ways that take quarters to repair.
