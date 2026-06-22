# Skill: Forecast Refresh

Apply this period's actuals to the rolling 12-month forecast. Update projections forward; never modify history. Surface the forecast diff to the human.

---

## When to invoke

Day 4 of close, after `variance-decomposition` has run. The forecast refresh consumes the variance decomposition as input.

---

## Inputs

- The current operating model (`~/finance-data/models/strand-model.xlsx`)
- The current rolling forecast (`~/finance-data/forecasts/<year>-Q<quarter>/forecast.md` plus underlying spreadsheet)
- This period's actuals
- This period's variance decomposition (Output from `variance-decomposition` skill)
- Driver trend data for the trailing 3 / 6 months

---

## Outputs

A markdown file at `~/finance-data/forecasts/<year>-Q<quarter>/forecast-refresh-<year>-<month>.md` with:

1. **Headline** — the new 12-month total vs. the prior view, with the dollar and percentage diff
2. **Driver updates** — which drivers were revised and why
3. **Quarter-by-quarter rollup** — Q+1, Q+2, Q+3, Q+4 projection
4. **Confidence range** — Bull / Base / Bear endpoints for the 12-month forward view
5. **Methodology changes** — anything that changed in the projection method (these are rare; should be human-approved)
6. **Audit trail**

Also: update the underlying spreadsheet via the `googlesheets` MCP (or write to file if Sheets isn't connected).

Post to Slack: "Forecast refreshed for [period]. 12-month forward view: $X.XM (vs. $Y.YM prior; diff ±$ZK). [Driver X] was the largest revision."

---

## Process

### Step 1 — Establish the actuals delta

For each P&L line, the difference between this period's actual and what the forecast had projected for this period. This is the "forecast error" for the period; it tells you which drivers your forecast got wrong.

### Step 2 — Decide whether each driver needs revision

Three rules:

**Rule 1 — One-time event:** the forecast error was caused by a specific identified one-time event (per the variance decomposition). The driver itself doesn't change. The forecast continues as-was for future periods.

Example: a Tier-1 merchant paused processing for a migration. Their TPV will come back next month. No driver revision.

**Rule 2 — Trend break:** the forecast error reflects a sustained directional change in the driver. The driver needs revision.

Example: net take rate has now compressed for 3 consecutive months and the variance decomposition each month showed rate as the dominant driver. The forecast's take-rate assumption needs to come down.

**Rule 3 — Noise:** the forecast error is within historical month-to-month variance for that line. No revision; let the next period clarify.

For each line, classify into one of the three. Document the classification in the audit trail.

### Step 3 — Apply revisions

For drivers classified as Trend Break:

1. Pull the trailing-6-month trend for the driver
2. Compute the new trend-line projection
3. Apply it forward in the model (next 12 months)
4. Recompute downstream P&L lines that depend on that driver

For drivers classified as One-Time or Noise: no change.

### Step 4 — Refresh confidence range

Re-flex the Bull / Base / Bear scenarios using the updated drivers. The 12-month forward view now has three numbers, not one.

### Step 5 — Compute the diff

For each quarter forward, the diff between the new view and the prior view. If any quarter moves by >5% (configurable), surface it explicitly in the headline.

### Step 6 — Save and notify

Write the refresh markdown file. Update the spreadsheet via Sheets MCP. Post Slack summary.

---

## Escalation thresholds

- **12-month forward view moves >10% vs. prior** → escalate to `#finance-alerts`; this is a material forecast change that the CFO needs to see immediately, not at next read
- **Three or more drivers revised in one cycle** → surface as a "broad reforecast" rather than line-item revisions; recommend a more formal planning conversation
- **Methodology change required** (e.g., changing from straight-line growth to S-curve) → halt the refresh, escalate for human approval before applying

---

## Anti-patterns to avoid

- **Don't re-baseline silently.** Every driver revision is logged. The audit trail makes it possible to reconstruct the forecast as of any historical date.
- **Don't over-react to single-period noise.** Three months of evidence before revising a driver, not one.
- **Don't smooth toward the budget.** The forecast doesn't owe loyalty to the original plan. If the trend says the original plan was wrong, the forecast reflects reality, not aspiration.
- **Don't extend a one-time event.** A merchant paused for migration this month doesn't mean they'll pause again next month.
- **Don't conflate driver revision with target revision.** The target stays where the human set it; the forecast reflects what you actually think will happen. They can diverge.

---

## Example (excerpt)

```markdown
## Headline

12-month forward view (Apr 2026 — Mar 2027): **$345M net revenue** (vs. $352M prior view; -$7M / -2.0%).

Largest revision: Strand Payments take rate revised from 45 bps to 43 bps based on three consecutive months of compression and a confirmed Connect-platform pricing change for FY2026.

## Driver Updates

| Driver | Prior | Revised | Classification | Rationale |
|--------|-------|---------|----------------|-----------|
| Payments TPV growth | 30% YoY | 30% YoY | No change | Migration pause was one-time |
| Payments net take rate | 45 bps | 43 bps | Trend break | 3 consecutive months of compression; Connect renegotiation confirmed |
| Billing-enabled TPV | $1.2B → $1.8B | $1.2B → $1.8B | No change | On track |
| Connect take rate | 65 bps | 60 bps | Trend break | Same renegotiation affects Connect contracts going forward |
| Fraud loss rate | 9 bps | 9 bps | No change | This period's variance was one-time |
| R&D headcount | 60 FTEs | 60 FTEs | No change | Headcount plan unchanged |

## Quarterly Rollup

| Quarter | Prior View | Revised View | Diff |
|---------|------------|--------------|------|
| Q2 2026 | $8.6M | $8.5M | -$0.1M |
| Q3 2026 | $9.0M | $8.7M | -$0.3M |
| Q4 2026 | $10.2M | $9.7M | -$0.5M |
| Q1 2027 | $7.8M | $7.4M | -$0.4M |
| ... | | | |
```
