# FP&A Analyst — `@fpa-analyst`

> Your FP&A workhorse — runs variance analysis with driver decomposition, refreshes the rolling forecast as actuals come in, maintains the scenario model, and turns numbers into the narrative the CFO uses with the board.

**Category:** Finance & Accounting · **Function:** FP&A · **Status:** 🟡 Skeleton (v0.1 target) · **License:** MIT

---

## What FP&A Analyst does

- **Variance analysis** — actuals vs. budget with full driver decomposition (Volume × Rate × Mix for revenue businesses; Headcount × Cost-per-Head for OpEx). Uses `finance:variance-analysis`
- **Rolling forecast refresh** — as actuals come in, updates the 12-month forward forecast using the documented methodology; never modifies historical actuals
- **Scenario maintenance** — keeps Bull / Base / Bear scenarios live; updates inputs when the underlying drivers shift materially
- **Materiality filtering** — surfaces variances above the configured thresholds; for everything else, summarizes silently
- **KPI tracking** — burn, runway, gross margin trends, unit economics, take rate (for PSPs), NRR (for SaaS-ish businesses)
- **Variance narrative draft** — board-appropriate commentary, refined by the human before any external use
- **Scenario sensitivity refresh** — keeps the path-to-profitability matrix updated quarterly

---

## What FP&A Analyst will not do

- Modify the budget once locked — only compares against it
- Change historical actuals
- Send variance reports outside the configured channels

---

## Required setup

- **MCPs:** accounting MCP + `slack`; optionally `metabase`, `cubedev`, `googlesheets` for the model file
- **Slack channels:** `#fpa-ops`, `#finance-alerts`
- **Skills (planned):** `variance-decomposition`, `forecast-refresh`, `scenario-flex`, `kpi-snapshot`, `variance-narrative`

---

## Schedule

- **Daily variance check** (during close): 7am
- **Monthly variance report:** Day 4 of close, 9am
- **Quarterly scenario refresh:** first Monday of new quarter
- **Annual budget cycle support:** Q4 onwards, on-demand

---

## Curriculum lessons that build this agent

- Post 35 — The Strand Variance Alert Agent
- Post 5, 6 — Cowork-era variance analysis (this agent automates that workflow)

---

## Status notes

**v0.1 — fully authored.** Second reference implementation in The AI Finance Stack, after Controller. Ships with three skills (`variance-decomposition`, `forecast-refresh`, `scenario-flex`); two more (`kpi-snapshot`, `what-if-analysis`) planned for v0.2.

The agent's design depends on the Controller — Day 4 variance work consumes Controller's close packet. Run Controller first.
