# FP&A Analyst — `@fpa-analyst`

> Your FP&A workhorse — runs variance analysis with driver decomposition, refreshes the rolling forecast as actuals come in, maintains the scenario model, and turns numbers into the narrative the CFO uses with the board.

**Category:** Finance & Accounting · **Function:** FP&A · **Status:** 🟢 v0.1 — fully authored · **License:** MIT

---

## What FP&A Analyst does

- **Annual budget build** — orchestrates the 2-week budget cycle (smaller-org cadence): pre-populates per-leader input templates from prior-year actuals, captures inputs via scheduled syncs, reconciles top-down vs bottom-up, runs driver-consistency checks, generates the board package, posts the locked budget to the operating model. The agent orchestrates and synthesizes; the CFO and leaders own the calls.
- **Quarterly re-forecast** — same machinery, lighter loop. Pulls YTD actuals, DMs each leader for back-half-of-year revisions, updates the forecast for Q3/Q4 (history never moves).
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
- **Skills** (four scopes — see [`/skills/README.md`](../../skills/README.md)):
  - **Agent-private** (in `agents/fpa-analyst/skills/`): `budget-build`, `variance-decomposition`, `forecast-refresh`, `scenario-flex`
  - **Stack-shared imports:** `stack:slack-conventions` (channel routing for `#fpa-ops`, `#fpa-budget`, `#finance-alerts`). `stack:variance-narrative`, `stack:driver-decomposition`, `stack:kpi-snapshot`, `stack:close-packet-format`, `stack:budget-checker` queued for v0.2 hoist.
  - **Finance plugin skills:** `finance:variance-analysis`, `finance:financial-statements`
  - **Global utility:** `sop-pdf`, `sop-pptx`, `sop-xlsx`, `sop-docx`

---

## Schedule

- **Daily variance check** (during close): 7am
- **Monthly variance report:** Day 4 of close, 9am
- **Quarterly scenario refresh + re-forecast:** first Monday of new quarter
- **Annual budget build:** kicked off by CFO via `/budget-kickoff <fiscal-year>` in `#fpa-budget` (~3-4 weeks before fiscal year start). Runs over 2 weeks.

---

## Curriculum lessons that build this agent

- Post 35 — The Strand Variance Alert Agent
- Post 5, 6 — Cowork-era variance analysis (this agent automates that workflow)

---

## Status notes

**v0.1 — fully authored.** Second reference implementation in The AI Finance Stack, after Controller. Ships with four skills (`budget-build`, `variance-decomposition`, `forecast-refresh`, `scenario-flex`); two more (`kpi-snapshot`, `what-if-analysis`) planned for v0.2.

The agent has two distinct operating tempos:
- **Continuous monthly cadence** — variance work on Day 4, forecast refresh same day, scenario refresh quarterly. Depends on Controller's close packet existing first.
- **Annual budget cycle** — ~3-4 weeks before fiscal year start; runs over 2 weeks of orchestrated input gathering from department leaders. Quarterly re-forecasts run alongside the scenario refresh.
