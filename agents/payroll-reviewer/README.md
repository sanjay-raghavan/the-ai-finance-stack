# Payroll Reviewer — `@payroll-reviewer`

> Your payroll quality check — reviews the monthly payroll run before it posts, flags variances against headcount expectations, tracks comp-and-equity costs, and surfaces anything that looks off before it becomes an accrual problem.

**Category:** Finance & Accounting · **Function:** Payroll · **Status:** 🟡 Skeleton (v0.1 target) · **License:** MIT

---

## What Payroll Reviewer does

- **Pre-run review** — pulls the upcoming payroll run from the payroll MCP (Gusto / Rippling / ADP via integration); compares against prior period and against headcount plan
- **Variance flags** — surfaces gross-pay changes >5% MoM with no underlying business event explaining them (raises, new hires, terminations)
- **Headcount cost tracking** — keeps `~/finance-data/headcount/` up to date: roster, comp by role, fully-loaded cost per FTE per function
- **Equity / SBC monitor** — tracks stock-based compensation expense, option exercises, and vesting events; surfaces material items for human review (and for the Controller to accrue properly)
- **Bonus accrual support** — projects monthly bonus accruals based on YTD attainment and plan tracking; feeds the Controller's accrual pass
- **Compensation outlier flagging** — flags compensation that's well outside the band for a role (could indicate a data-entry error or a legitimate executive package)

---

## What Payroll Reviewer will not do

- Run payroll — only reviews before the human triggers the run
- Modify employee records or compensation
- Access individual employee personal data beyond what's needed for the review

---

## Required setup

- **MCPs:** `gusto` (or equivalent payroll MCP) + `slack`; optionally accounting MCP for accrual hand-off, `notion-finance` for the headcount roster
- **Slack channels:** `#payroll-ops` (private — restrict membership!), `#finance-alerts`
- **Skills (planned):** `payroll-prereview`, `headcount-cost-tracking`, `bonus-accrual-projection`, `sbc-monitor`, `comp-outlier-flag`

---

## Schedule

- **Pre-run review:** day of payroll run, 2 hours before scheduled run
- **Weekly headcount cost refresh:** Monday 9am
- **Bonus accrual update:** Day 1 of close (feeds Controller's accrual pass)
- **SBC monitor:** monthly, Day 1 of close

---

## Privacy & access

Payroll data is sensitive. Restrict the `#payroll-ops` channel membership to the smallest necessary group. Audit logs are extra-rigorous for this agent — every invocation logs which fields were accessed.

---

## Curriculum lessons that build this agent

- Module 8 lesson on AI-Ready Finance Team (payroll example)
- References Controller (for accrual hand-off)

---

## Status notes

**v0.1 — fully authored.** Ships with two skills (`payroll-prereview`, `headcount-cost-tracking`). Future v0.2 candidates: dedicated `bonus-accrual-projection` skill (currently inline), `sbc-monitor` (currently inline), `comp-outlier-flag` (currently inline in pre-run review).

Payroll Reviewer is the **most privacy-sensitive agent in the Stack.** The `#payroll-ops` Slack channel should have the smallest possible membership; the agent's queries are restricted to scoped fields only (no SSN, no banking, no home address, no dependents, no medical); audit log retention is 7 years (vs. 2 for other agents). Operationalize these controls — they're not theoretical.

Payroll Reviewer feeds Controller (payroll-related accruals), FP&A (headcount cost roster for variance work), Treasury (payroll schedule for 13-week projection), and IR (SBC / headcount commentary for monthly update).
