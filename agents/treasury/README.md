# Treasury — `@treasury`

> Your cash watch — tracks live cash position across operating and merchant-funds accounts, projects 13-week rolling cash flow, flags runway risk, and keeps the CFO from being surprised on a Monday morning.

**Category:** Finance & Accounting · **Function:** Treasury · **Status:** 🟡 Skeleton (v0.1 target) · **License:** MIT

---

## What Treasury does

- **Hourly cash position** — pulls current cash balances from all connected banking MCPs; computes total operating cash, broken down by entity and bank
- **PSP-aware merchant float separation** — for payment processors (Strand-relevant), distinguishes operating cash from merchant settlement funds. Never co-mingles them in projections.
- **13-week rolling cash flow** — projects forward using AR aging (from `@ar-follow-up`), AP run (from `@ap-watcher`), payroll schedule (from `@payroll-reviewer`), fixed cost run-rate, and known one-time events. Refreshes daily.
- **Runway calculation** — based on current cash and trailing-3-month net burn; surfaces a runway figure with confidence bands (not point estimates)
- **Cash-risk alerts** — surfaces dates in the next 13 weeks when projected cash drops below configured thresholds (operating cushion, payroll-coverage minimum, etc.)
- **Banking-relationship health** — flags upcoming covenant compliance dates, account balance minimums, and lender reporting obligations
- **FX exposure tracking** (for multi-currency setups) — surfaces unhedged exposure above a threshold

---

## What Treasury will not do

- Move money — projections and alerts only; human authorizes every transfer
- Recommend specific banking products or hedging strategies — surfaces exposure, human decides
- Make commitments on behalf of the company (no ACH origination, no wire initiation)

---

## Required setup

- **MCPs:** at least one banking MCP (`mercury` / `modern-treasury` / `plaid`) + `slack`; optionally accounting MCP for opening balances, `stripe` / `paypal` / `square` if PSP-aware
- **Slack channels:** `#treasury-ops`, `#finance-alerts`
- **Skills (planned):** `cash-position-snapshot`, `13-week-projection`, `runway-calc`, `merchant-float-separation`, `covenant-watch`

---

## Schedule

- **Hourly cash snapshot:** every hour during business hours
- **Daily projection refresh:** 6am
- **Weekly runway report:** Friday 4pm (for the CFO's weekend read)
- **Monthly board-pack input:** Day 4 of close

---

## Special note for PSPs (and the Strand reference case)

For payment processors, the most common mistake in treasury modeling is conflating operating cash with merchant settlement funds. Treasury enforces the separation in every projection. The 13-week forecast presents two side-by-side views:

- **Operating cash** — what the company actually owns and can spend
- **Total cash on books** — operating + merchant float held pending settlement

When the CFO asks "how much cash do we have?" the answer is operating cash. The other figure is for context only.

---

## Curriculum lessons that build this agent

- Post 6 — Cash Flow Forecasting and Runway Analysis (the Cowork-era version)
- Future Module 7 lesson (TBD post number)

---

## Status notes

v0.1 skeleton. Critical agent for pre-IPO companies with limited cash buffer — this is the agent that wakes the CFO up before payroll fails.
