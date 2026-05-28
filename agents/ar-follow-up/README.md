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
- **Skills (planned):** `aging-analysis`, `collection-drafts`, `deal-line-validation`, `cohort-metrics`

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

v0.1 skeleton. To be authored after Controller is in production.
