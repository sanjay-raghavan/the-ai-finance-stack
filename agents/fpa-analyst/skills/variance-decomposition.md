# Skill: Variance Decomposition

Decompose actuals-vs-budget variances into the underlying drivers. Revenue lines break into Volume × Rate × Mix; OpEx lines break into Headcount × Cost-per-Head; gross-to-net waterfalls reconcile separately for PSP-shaped businesses.

---

## When to invoke

Day 4 of the close, after Controller's close packet is complete and actuals are final.

---

## Inputs

- Period actuals (from the accounting MCP)
- Period budget (from the operating model — Strand's `~/finance-data/models/strand-model.xlsx`)
- Prior period actuals (for sequential trend)
- Driver data:
  - For revenue: TPV / units / contracts / take rate (from billing or accounting MCP)
  - For OpEx: headcount roster, fully-loaded cost per FTE (from `payroll-reviewer` outputs if available, else payroll MCP)
  - For COGS: volume drivers (fraud rate, hosting tier, etc.)
- Materiality thresholds from `config.yaml`

---

## Outputs

Variance decomposition section of the variance package, structured as:

```markdown
## Material Variances

### Revenue — Net Revenue
| Line | Actual | Budget | $ Var | % Var | Decomposition |
|------|--------|--------|-------|-------|---------------|
| Strand Payments | $1.62M | $1.75M | -$130K | -7.4% | Volume -3 bps (-$45K) · Rate -2 bps (-$60K) · Mix -1 bps (-$25K) |
| Strand Billing | $0.55M | $0.50M | +$50K | +10.0% | Volume +6% (+$30K) · Rate flat · Mix +4% (+$20K) |
| Strand Connect | $0.31M | $0.30M | +$10K | +3.3% | (sub-material in absolute $) |

**Driver narrative — Payments:** Take rate compressed 2 bps from budget due to a single Connect-platform client renegotiating their fee share mid-month. Volume was light on the standard book (-3 bps) primarily from one large merchant pausing during a system migration. Both effects compound; not structural.

### OpEx — R&D
[same structure, decomposed by Headcount × Cost-per-Head × Vendor]
```

---

## Process

### Step 1 — Pull and reconcile

Pull actuals from the accounting MCP. Pull budget from the operating model. Reconcile that line items match (same accounts, same period, same currency). If anything doesn't reconcile, halt and escalate — variance can't be decomposed against mismatched bases.

### Step 2 — Classify each variance

For every P&L line, compute actual minus budget. Bucket each line into:

- **Material** — exceeds the configured $ AND % thresholds. Gets full decomposition.
- **Driver-meaningful** — sub-material in dollars but a driver moved >10%. Gets a narrative even though the dollar impact is small.
- **Sub-material** — small, no notable driver movement. Rolls into the Sub-Material Summary line.

### Step 3 — Decompose material variances by line type

**For revenue lines (especially PSP-shaped):**

Decompose into the three classical drivers. For a PSP like Strand:

- **Volume** = (Actual TPV − Budget TPV) × Budget Take Rate
- **Rate** = (Actual Take Rate − Budget Take Rate) × Budget TPV
- **Mix** = Residual after Volume and Rate, attributable to product-mix shift (Payments vs. Billing vs. Connect)

The three should sum to the total $ variance. If they don't, there's a methodology error — halt and review.

**For OpEx lines:**

- **Headcount** = (Actual FTEs − Budget FTEs) × Budget cost-per-FTE
- **Cost-per-Head** = (Actual loaded cost − Budget loaded cost) × Budget FTEs
- **Other** = Non-payroll OpEx (tools, programs, contractors) breakout

**For COGS lines:**

- Vary by COGS type. For fraud: `(Actual loss rate × Actual TPV) − (Budget loss rate × Budget TPV)`. For hosting: typically a step-function in TPV. For payment-ops payroll: same as OpEx headcount logic.

### Step 4 — Write the driver narrative

For each material variance, two sentences:

1. **What** — the magnitude and direction. "Net revenue came in $130K below plan (-7.4%)."
2. **Why** — the dominant driver(s) in plain language, tied to the decomposition. "Driven primarily by take rate compression (2 bps below plan, ~$60K impact) on a single Connect-platform renegotiation. Volume contributed a smaller miss (-$45K from one large merchant pausing during a migration)."

Avoid speculative causes. If you can't tie the variance to a specific data point, label the explanation as a hypothesis explicitly and put it in the Hypothesis Layer section.

### Step 5 — Cross-check materiality

Add up all line variances. The total should match the EBITDA variance to plan. If it doesn't, there's a missing line or a methodology error.

### Step 6 — Save

Save the decomposed variance section to the variance package file. Post Slack summary with the top three material variances and their drivers.

---

## Escalation thresholds

- **Decomposition doesn't sum to total variance** → halt, post to `#finance-alerts`. Methodology error.
- **Driver data missing for a line that's above materiality** → produce the variance line, label the decomposition "data unavailable," surface in Hypothesis Layer.
- **Same line shows material variance three periods in a row** → flag as structural, recommend assumption review in next planning cycle.

---

## Anti-patterns to avoid

- **Don't compress mix and rate together.** They have different causes and different actions. Separate them.
- **Don't ascribe causes you can't show.** "Macro headwinds" without supporting data is wrong. Use the Hypothesis Layer.
- **Don't decompose at the line level when the action is at the business unit level.** If five COGS lines all moved because the TPV scale changed, surface that as one driver story, not five.
- **Don't smooth signs.** A favorable variance from a one-time event isn't structural goodness; surface the one-time nature.
- **Don't skip the cross-check.** If line variances don't sum to EBITDA variance, something is wrong.

---

## Example (excerpt)

```markdown
### Net Revenue — Strand Payments

| Actual | Budget | $ Var | % Var |
|--------|--------|-------|-------|
| $1,620K | $1,750K | -$130K | -7.4% |

**Decomposition:**

| Driver | Impact | Cause |
|--------|--------|-------|
| Volume | -$45K | TPV came in at $3.42B vs. $3.50B plan. One Tier-1 merchant (12% of book) paused processing 9 days for a system migration. |
| Rate | -$60K | Net take rate 43 bps vs. 45 bps plan. Single Connect-platform renegotiation closed mid-month at lower rev share. |
| Mix | -$25K | Slight shift toward Connect (higher take but compressed in this quarter); offset by Billing-enabled TPV growing slower than plan. |
| **Total** | **-$130K** | (reconciles) |

**Driver narrative:** Net revenue came in $130K below plan (-7.4%). Driven primarily by take-rate compression on a single Connect-platform renegotiation (~$60K) and one large merchant pausing for a migration (~$45K). Mix contributed the remaining $25K. Both rate and volume effects are tied to specific customer-level events; the rate compression is the one to watch — if it expands across more platform clients, this becomes structural rather than one-time.
```
