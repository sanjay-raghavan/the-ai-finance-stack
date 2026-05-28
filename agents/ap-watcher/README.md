# AP Watcher — `@ap-watcher`

> Your invoice-to-payment operator — validates incoming invoices, matches them to POs and contracts, catches duplicates and unusual amounts before they hit the GL, and prepares the payment run for human approval.

**Category:** Finance & Accounting · **Function:** Accounts Payable · **Status:** 🟡 Skeleton (v0.1 target) · **License:** MIT

---

## What AP Watcher does

- **Monitors the AP inbox** — invoices arriving via email (Gmail MCP) or AP system (Bill.com / Ramp)
- **Validates each invoice** — vendor exists, PO matches if required, amount within historical range, sales-tax treatment correct
- **Catches duplicates** — same vendor + same amount + same date window across recent invoices, with sensible fuzzy matching (vendor name variants, amount within $5)
- **Surfaces missing contracts** — invoices over a threshold without a stored vendor contract get flagged before coding
- **Codes invoices** — proposes account, department, and project coding based on vendor history; surfaces low-confidence codings for human review
- **Prepares the weekly payment run** — selects invoices due, optimizes for early-pay discounts, flags cash-impact concerns to Treasury
- **Tracks aging** — generates a weekly AP aging report (0–30 / 31–60 / 61–90 / 90+) at vendor level
- **Maintains vendor master data** — flags missing W-9/W-8, contact info, payment terms

---

## What AP Watcher will not do

- Pay invoices directly — payment runs are surfaced; the human authorizes
- Modify vendor master records in the GL — only flags issues
- Communicate with vendors directly — proposed messages are drafted but not sent

---

## Required setup

- **MCPs:** one accounting (`quickbooks` / `xero` / `netsuite`) + `slack`; optionally `gmail`, `billcom`, `ramp`, `expensify`
- **Slack channels:** `#ap-ops` (summaries), `#finance-alerts` (errors and escalations)
- **Skills:** inherits global SOP skills; agent-specific skills (planned): `invoice-validation`, `duplicate-detection`, `payment-run`, `vendor-data-hygiene`

---

## Schedule

- **Inbox sweep:** every 30 minutes during business hours
- **Weekly AP aging report:** Monday 9am
- **Payment run prep:** Thursday 9am (US standard weekly cadence)

---

## Curriculum lessons that build this agent

- Post 32 — The Strand AP Watcher (Building Production Agents with the SDK)
- Post 33 — Multi-Agent Coordination (AP Watcher → Investigation)

---

## Status notes

**v0.1 — fully authored.** Ships with two skills (`invoice-validation`, `payment-run`). Future v0.2 candidates: `vendor-data-hygiene` (W-9/W-8 tracking automation), `early-pay-optimizer` (smarter discount-capture math), and `vendor-concentration-watch` (flag growing reliance on single vendors).

AP Watcher feeds Controller (accruals at month-end) and Treasury (cash-impact projections via payment-run prep). Consults Treasury's 13-week projection before any payment run is finalized.
