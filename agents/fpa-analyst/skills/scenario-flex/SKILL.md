# Skill: Scenario Flex

Maintain the Bull / Base / Bear scenarios as living artifacts. Re-flex quarterly, or sooner if a driver moves materially. Keep the CFO oriented on the range of outcomes, not just the point estimate.

---

## When to invoke

- **Quarterly** — first Monday of each new quarter (default schedule)
- **Triggered** — if a driver revision in `forecast-refresh` exceeds a sensitivity threshold, or if Bear case runway drops below 6 months

---

## Inputs

- The base case forecast (from the operating model, post `forecast-refresh`)
- The current scenario assumptions for Bull and Bear (from `~/finance-data/scenarios/<year>-Q<quarter-1>/scenario-refresh.md` if it exists)
- The variance trend for the trailing 4 quarters (which drivers have been most volatile?)
- Materiality thresholds and the Bear case runway critical threshold from `config.yaml`

---

## Outputs

A markdown file at `~/finance-data/scenarios/<year>-Q<quarter>/scenario-refresh.md` with:

1. **Headline** — Bull, Base, Bear 12-month and 24-month endpoints for the metrics that matter (net revenue, EBITDA, runway). One sentence on which scenario the company is currently tracking closest to.
2. **Scenario assumption table** — for each driver, the Bull / Base / Bear value, plus what's changed since the prior refresh.
3. **Diff vs. prior scenarios** — what moved in each scenario, and why.
4. **Critical threshold check** — does any scenario cross a watch level (e.g., Bear runway <6 months)?
5. **Drivers most worth watching** — based on variance trend, which drivers are most likely to push the company between scenarios next quarter?
6. **Audit trail**

Post to Slack: "Q[N] scenario refresh. Tracking closest to [scenario]. Bear case runway: [N] months. Largest move: [driver]."

---

## Process

### Step 1 — Refresh the Base case

The Base case is whatever the rolling forecast says, post-`forecast-refresh`. No additional work needed; the base is the forecast.

### Step 2 — Flex each scenario driver

For each driver in the model, the Bull / Bear values are configured as either:

- **Absolute** — e.g., "Bull = 50 bps net take rate, Bear = 40 bps" (regardless of where base lands)
- **Relative** — e.g., "Bull = base + 10 bps, Bear = base − 5 bps" (Bull and Bear move with the base)

Most drivers should use Relative; the Bull and Bear adjustments express *uncertainty*, not absolute conviction. Absolute makes sense for drivers with hard floors or ceilings (e.g., fraud loss rate can't go below ~3 bps regardless of how much the model improves).

For this refresh:

1. Read the current driver value in the base case (post forecast-refresh)
2. Apply the configured Bull / Bear adjustment
3. Compute the resulting Bull / Bear scenario P&L

### Step 3 — Reconsider the Bull and Bear *adjustments themselves*

Quarterly, the Bull / Bear adjustment magnitudes should be reviewed. If a driver has been very volatile (e.g., net take rate compressed 4 bps in the past two quarters), the Bear adjustment for take rate should widen.

For each driver:

1. Compute the trailing-4-quarter standard deviation of the driver value
2. Compare to the configured Bull / Bear adjustment
3. If the std dev is materially larger than the Bull − Bear range, surface a recommendation to widen
4. If the std dev is materially smaller (i.e., the driver has stabilized), surface a recommendation to tighten

Do not apply the adjustment-magnitude change automatically. Surface it for human approval; apply on the next refresh if approved.

### Step 4 — Compute downstream metrics

For each of the three scenarios, compute:

- 12-month net revenue total
- 24-month net revenue total
- 12-month EBITDA
- 12-month cash burn (net of revenue)
- Runway in months (from current cash and forward-looking burn pace)
- Path-to-profitability — what year does EBITDA turn positive under this scenario?

These metrics drive the headline and the Critical Threshold Check.

### Step 5 — Critical threshold check

For each scenario, check:

- **Runway** — Bear case <6 months → critical alert
- **Cash position** — Any scenario projecting cash below $0 within 18 months → critical alert
- **EBITDA crossing** — Any scenario where the path-to-profitability slips by more than 2 quarters from the prior refresh → noteworthy
- **Investor commitment** — If a tracked commitment to investors (e.g., "we'll hit $35M ARR by FY2026") is at risk in Base case → noteworthy

Critical alerts go to `#finance-alerts` immediately, not waiting for the next read.

### Step 6 — Drivers most worth watching

Sort drivers by their trailing-quarter contribution to forecast error. The top 3 are the "watch drivers" for next quarter — the ones most likely to push the company between scenarios. Surface in the refresh document.

### Step 7 — Save and notify

Write the scenario refresh file. Post Slack summary. If any critical thresholds tripped, post to alerts separately with the specific scenario and the trigger.

---

## Escalation thresholds

- **Bear case runway crosses below 6 months** → immediate `#finance-alerts` escalation
- **Base case crosses below a fundraising trigger** (configurable, e.g., 12 months runway) → escalate
- **Bull and Bear gap doubles vs. prior refresh** → noteworthy in summary; suggests increased uncertainty
- **A driver moves outside its Bull-to-Bear range entirely** → halt, escalate; the scenario design is wrong

---

## Anti-patterns to avoid

- **Don't re-flex too often.** Quarterly is enough unless a critical threshold tripped. Monthly re-flexing makes the scenarios noisy and reduces their usefulness as a stable reference point.
- **Don't make Bull case the marketing case.** Bull is a plausibly favorable scenario, not the optimistic spin. It should be defensible to a skeptical board member.
- **Don't make Bear case catastrophic.** Bear is a plausibly unfavorable scenario, not the worst case. The worst case is its own analysis ("what if Strand loses Tier-1 merchant X tomorrow?").
- **Don't move Base case toward Bear case** to look conservative. The Base case is the rolling forecast — your best estimate of what will happen.
- **Don't auto-widen adjustments** based on volatility without human review. The Bull / Bear *adjustments* are a strategic call about how much uncertainty to plan around. Surface, don't automate.

---

## Example (excerpt)

```markdown
## Headline

Q2 2026 Scenario Refresh

| Scenario | 12-Mo Net Rev | 12-Mo EBITDA | Runway | Path to Profitability |
|----------|---------------|--------------|--------|------------------------|
| **Bull** | $42M | -$8M | 36 mo | FY2027 Q4 |
| **Base** | $35M | -$19M | 20 mo | FY2028 Q3 |
| **Bear** | $28M | -$28M | 11 mo | FY2029 Q2 |

Tracking closest to **Base**. Bear case runway is 11 months — above the 6-month critical threshold, but worth monitoring. Next financing event assumed in early 2027 under Base case.

## Largest moves vs. Q1 refresh

- **Connect take rate** (Base): 65 bps → 60 bps — driven by confirmed platform-fee renegotiation
- **Bear case take rate adjustment**: widened from -5 bps to -8 bps — three quarters of compression evidence justifies a wider downside band
- **Fraud loss rate**: unchanged across all three scenarios; trailing quarter showed stability

## Watch drivers for Q3

1. Connect take rate — could compress further if more platform clients renegotiate
2. Payments TPV growth — Tier-1 merchant pause was one-time, but the migration risk pattern could repeat
3. R&D fully-loaded cost — comp-band creep across the engineering org has compressed gross margin by 1 pt in the last 6 months
```
