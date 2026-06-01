# Skill: Budget Build

Orchestrate the annual budget build and the quarterly re-forecast. Two modes in one skill because they share machinery — input templates, driver tree, scenario flex — but differ in cadence and depth.

The agent's job in both modes is **orchestration plus synthesis**, not judgment. It schedules, templates, gathers, reconciles, and surfaces. The CFO and department leaders make the calls.

---

## When to invoke

Two modes:

1. **Annual budget build** — kicks off ~3-4 weeks before fiscal year start. Runs over **2 weeks** for a smaller org (~50-200 FTEs). Calibrated to that cadence; larger orgs can stretch by widening the gathering phase.

2. **Quarterly re-forecast** — first week of each new quarter. Runs in 2-3 days. Lighter loop, same machinery.

Trigger: the agent enters this skill when the CFO posts `/budget-kickoff <fiscal-year>` or `/reforecast <quarter>` in `#fpa-budget`.

---

## Inputs

**For annual mode:**
- Top-down targets from CEO/CFO: net revenue, gross margin, headcount, EBITDA, runway floor
- Leader list at `~/finance-data/budget/<year>/leaders.yaml` — each entry: name, Slack ID, department, scope lines they own
- Prior-year actuals + trailing-12-month run rate (from accounting MCP)
- Current operating model at `~/finance-data/models/<company>-model.xlsx`
- Strategic context posted by CFO: fundraising plans, hiring freezes, major initiatives planned, runway targets

**For re-forecast mode:**
- YTD actuals through end of last quarter (from accounting MCP)
- Current locked budget for the year
- Variance trends from the trailing 2 quarters (from `variance-decomposition` outputs)
- Any strategic context updates posted since last re-forecast

---

## Outputs

**Annual mode:**

| Output | Where it lives |
|---|---|
| Pre-populated input template per leader | `~/finance-data/budget/<year>/inputs/<leader-slug>-template.xlsx` |
| Bottom-up vs top-down reconciliation report (one per iteration) | `~/finance-data/budget/<year>/reconciliation/v<N>.md` |
| Driver consistency check report | `~/finance-data/budget/<year>/driver-checks/v<N>.md` |
| Locked budget v1, v2, ... vFinal | `~/finance-data/budget/<year>/locked/v<N>/` (xlsx + .md narrative) |
| Bull / Base / Bear scenarios off final budget | `~/finance-data/budget/<year>/scenarios/` |
| Board-ready budget package | `~/finance-data/budget/<year>/board-package.pdf` + `.xlsx` |
| The final budget written to the operating model | `~/finance-data/models/<company>-model.xlsx` (plan tab) |
| Milestone updates posted to `#fpa-budget` | (Slack thread) |

**Re-forecast mode:**

| Output | Where it lives |
|---|---|
| Per-leader update DM + their responses captured | `~/finance-data/budget/<year>/reforecast/<quarter>/leader-inputs/` |
| Updated back-half-of-year forecast | `~/finance-data/budget/<year>/reforecast/<quarter>/forecast.xlsx` + `.md` |
| Variance-vs-budget YTD summary | `~/finance-data/budget/<year>/reforecast/<quarter>/variance-summary.md` |
| Slack update in `#fpa-budget` | (Slack) |

---

## Process — Annual mode (2-week cadence)

### Week 1, Day 1-2 — Kickoff and templating

**Step 1.** Read top-down targets from the CFO's kickoff post in `#fpa-budget`. Validate that all required targets are present:
- Net revenue
- Gross margin %
- Headcount cap
- EBITDA target
- Runway floor (e.g., "must end FY with >18 months runway in base case")

If any required target is missing, halt and post a question in the thread. Do not proceed without targets — the entire bottom-up gathering is calibrated against them.

**Step 2.** Load `leaders.yaml` and identify everyone who owes inputs. Typical Strand-sized org: 6-10 leaders (engineering, sales, marketing, customer success, ops, finance, people, exec).

**Step 3.** For each leader, generate a pre-populated input template containing:
- **Prior-year actuals** for every line that leader owns, by month
- **Trailing-12-month run-rate** (sometimes more meaningful than calendar prior year)
- **Prior-year budget** for comparison (did they hit budget? over? under?)
- **Blank cells** for proposed next-year values, by quarter
- **Notes column** for assumptions, hires planned, contracts renewing, etc.
- **Driver fields** (e.g., for Engineering: headcount by quarter, average loaded cost per FTE, planned tooling additions)

The template is *driver-first*, not line-first. Engineering doesn't fill in "AWS = $X" — they fill in "infra spend per engineer = $Y, planned engineers = Z, → $Y × Z."

**Step 4.** Save templates to `~/finance-data/budget/<year>/inputs/`. Send each leader a Slack DM:

> 📊 *Budget kickoff for FY<N>.* I've prepped your input template — links to prior-year actuals, your trailing run-rate, and blank cells for next-year proposed values. Deadline: end of Day 7 (one week). Drop in a 30-min sync with me before then via this calendar link. Questions in this thread.

### Week 1, Day 3-7 — Gathering

For each leader:

**Step 5.** Sync with the leader (30 min, via the `googlecalendar` MCP). Goal: walk through their template, capture their proposed numbers, log their assumptions verbatim in the notes column. Do not push back, do not negotiate — just capture.

**Step 6.** After the sync, structure the input into the driver tree format. For each proposed line:
- If proposed value is **>25% increase** vs prior-year actuals → flag as needing rationale
- If proposed value is **<-10% decrease** → flag as needing rationale (unusual; could be a real cut or could be a mistake)
- If their proposed driver doesn't match their proposed total (e.g., "20 engineers" but total payroll implies 18) → flag arithmetic gap

The flags are surfaced in the leader's template, not in `#fpa-budget` — give them a chance to fix their own arithmetic before the CFO sees it.

**Step 7.** Day 7: nag any leader who hasn't submitted. Day 8: surface any missing leaders to the CFO with the gap visible.

### Week 2, Day 8-9 — Reconciliation

**Step 8.** Once all leader inputs are in, roll up the bottom-up budget:
- Total revenue (sum of leader-owned revenue lines)
- Total COGS
- Total OpEx (by function)
- Implied EBITDA
- Implied ending headcount
- Implied ending cash → ending runway

**Step 9.** Compare to top-down targets and write the reconciliation report at `~/finance-data/budget/<year>/reconciliation/v1.md`:

```markdown
# Reconciliation v1 — Bottom-up vs Top-down

## Headline
- Bottom-up revenue: $32.0M (top-down: $30.0M) → +6.7% over
- Bottom-up OpEx: $28.5M (top-down: $24.0M) → +18.8% over
- Bottom-up EBITDA: -$3.5M (top-down: +$1.0M) → -$4.5M gap
- Bottom-up headcount: 142 (top-down cap: 125) → +17 over cap

## Largest deltas (vs top-down)
1. Engineering OpEx: +$2.8M over (12 of 17 over-cap hires here)
2. Sales: +$0.9M over (proposed quota bump + 3 incremental AEs)
3. Marketing: +$0.5M over (paid + events programs)

## Smallest deltas
- Finance, People, Ops all within $50K of target

## Recommended conversations
- @engineering-lead — reconcile the 12 over-cap hires against runway target
- @sales-lead — discuss whether quota bump warrants 3 incremental AEs vs. 2
- @marketing-lead — clarify whether events program is incremental or replaces other spend
```

**Step 10.** Run driver consistency checks. Write to `~/finance-data/budget/<year>/driver-checks/v1.md`:

```markdown
# Driver Consistency — v1

## Checks performed
- ✅ Headcount × per-FTE-cost = total payroll (within 2%, OK)
- ⚠️ Cloud spend / engineer: proposed $48K/yr vs prior-year $32K/yr (+50%). Engineering noted "scale costs from new product line" — plausible but worth a second look.
- ✅ Sales OTE × quota attainment = revenue tie-out (within 5%)
- ⚠️ G&A per FTE: proposed $24K/yr vs prior-year $18K/yr (+33%). Finance noted "outsourced controller fees + comp benchmarking project" — one-time vs ongoing?
- ✅ Customer Success cost / customer ratio: stable
- ⚠️ Marketing cost / new customer (CAC): proposed +20%. Marketing noted "paid is more expensive at this scale" — confirms market dynamics but worth challenging.
```

**Step 11.** Post the reconciliation summary to `#fpa-budget` with @-mentions for the leaders who need follow-up. CFO drives the iteration; the agent does not negotiate.

**Step 12.** Iterate v2, v3 as leaders update their inputs. Each iteration produces a new reconciliation report. Convergence typically happens in 2-3 iterations.

### Week 2, Day 10-12 — Driver model assembly + scenarios

**Step 13.** Once iterations converge (bottom-up vs top-down gap <5% on each major target), lock budget v1.

**Step 14.** Convert leader inputs into a coherent driver tree in the operating model:

```
Revenue
  ├── Strand Payments: TPV × take_rate × mix_share
  ├── Strand Billing: subscriptions × ARPU
  └── Strand Connect: clients × ACV × expansion_rate
COGS
  ├── Variable: per-transaction processing
  ├── Variable: fraud loss bps
  └── Fixed: hosting + ops
OpEx
  ├── R&D: headcount × (base + benefits + tools)
  ├── S&M: headcount × OTE + programs
  ├── G&A: headcount × (base + benefits) + outside services
  └── Other: insurance, occupancy, software contracts
```

Every dollar in the budget should trace to a driver. The skill validates this — flag any "plug" or unattributed dollars.

**Step 15.** Run scenarios (Bull / Base / Bear) by flexing key drivers. For Strand, typical sensitivities:
- Take rate (±2 bps)
- Volume growth (Bull: +30%, Bear: +5%)
- Fraud loss rate (Bull: 7 bps, Bear: 12 bps)
- Hiring pace (Bull: 100% of plan by Q2, Bear: 60% of plan)

For each scenario, compute ending EBITDA, ending headcount, ending runway.

**Step 16.** Compute critical thresholds:
- "Bear case runway: <runway months>. ⚠️ if below CFO-set floor"
- "Headcount cap breached in [scenario]: yes/no"
- "Cash-flow-positive month in Base case: M<N>"

### Week 2, Day 13-14 — Board approval + lock

**Step 17.** Generate the board-ready budget package at `~/finance-data/budget/<year>/board-package.pdf`:
- Executive summary (1 page)
- Revenue plan with driver assumptions
- OpEx plan by function
- Headcount plan + hiring waterfall
- EBITDA and cash projection
- Scenarios with critical threshold callouts
- Material assumptions documented

**Step 18.** CFO presents to board. Board feedback (typically minor revisions) iterated in.

**Step 19.** Once approved, the agent:
1. Writes the final budget to the operating model's plan tab via `googlesheets` MCP
2. Posts to `#fpa-budget`: "🔒 *Budget locked for FY<N>.* Final package: [link]. Variance + forecast skills will begin operating against the new plan starting next close."
3. Archives the build at `~/finance-data/budget/<year>/locked/final/`

---

## Process — Quarterly re-forecast mode

Tighter loop. Typical cadence: 2-3 days, week 1 of the new quarter.

### Day 1 — Pull YTD actuals and surface variance

**Step R1.** Pull YTD actuals through end of last quarter via the accounting MCP. Compute YTD-vs-budget variance by department.

**Step R2.** For each leader, generate a brief variance update and DM:

> 📊 *Q<N> re-forecast.* YTD: your department is at $X actual vs. $Y budgeted (<over/under> by <amount>). I'm refreshing the back-half forecast — any updates to your prior assumptions? Specifically:
> - Headcount plan still on track?
> - Any contracts renewing differently than expected?
> - Material program or vendor changes for H2?
>
> Reply in this DM by EOD tomorrow. If your assumptions still hold, just say "no changes."

### Day 2 — Collect updates

**Step R3.** Capture each leader's response in their re-forecast input file. Common patterns:
- "No changes" — most leaders, most quarters
- "Adjust headcount: 2 fewer hires in H2" — meaningful, log
- "Cloud costs ran 15% higher YTD; expect to continue" — meaningful, log
- Anything ambiguous — clarify in DM, do not assume

**Step R4.** If any response implies a back-half adjustment >$50K → flag for CFO review before integrating.

### Day 3 — Re-forecast + scenarios

**Step R5.** Lock the new forecast for the back half of the year. **History does not move.** The first half stays as actuals. Q3 and Q4 get updated based on the leader inputs + YTD variance trends.

**Step R6.** Re-flex scenarios if any driver moved materially (>5% in the back-half forecast). Otherwise, scenarios from the annual build still hold.

**Step R7.** Post to `#fpa-budget`:

> 🔄 *Q<N> re-forecast complete.* Back-half view now: $X.X M revenue (vs. $Y.Y M annual budget). Largest revisions: <list>. Critical thresholds: <yes/no breach>. Full forecast: [link]. Variance skill will report against the refreshed forecast starting next close.

The operating model is updated; downstream skills pick up the new forecast automatically.

---

## Failure modes

### Top-down targets not provided
Halt the annual build at Step 1. CFO must set targets; without them, leader inputs have nothing to reconcile against.

### Leader misses input deadline
Day 7: agent nags via DM. Day 8: agent surfaces the gap to CFO in `#fpa-budget` with a specific call-out. Do not skip — a missing input blocks reconciliation for the whole company.

### Driver consistency check fails materially
e.g., headcount × cost ratio off by >15%, or cloud spend per engineer 2x prior year. Do not auto-fix. Surface to the owning leader with the specific math.

### Bottom-up vs top-down gap >50% after iteration 2
This is a real strategic conversation, not a calculation issue. Pause iteration; surface to CFO with the breakdown by department. CFO must either revise top-down, push back harder on leaders, or accept the gap with the runway implications spelled out.

### Leader proposes something inconsistent with strategic context
e.g., 30% R&D growth when CEO has flagged a hiring freeze, or new vendor at $200K/yr when CFO posted a "no new SaaS contracts" rule. Surface to CFO immediately — do not include in the bottom-up roll-up without resolution.

### Re-forecast inputs imply a critical-threshold breach
e.g., Bear runway drops below the floor based on the new back-half forecast. Surface to CFO + CEO via `#finance-alerts` (not just `#fpa-budget`) — this warrants attention beyond the normal re-forecast channel.

---

## Anti-patterns to avoid

- **Don't auto-resolve top-down/bottom-up gaps.** That's a leadership decision, not a calculation. The agent reconciles and surfaces; the CFO decides.
- **Don't push back on a leader's ask in the gathering phase.** The agent's job in Days 3-7 is to capture cleanly, flag inconsistencies in *their* template, then surface to CFO. Leaders should not feel the agent is negotiating against them.
- **Don't overwrite prior versions silently.** Every iteration of the budget saves with timestamp and rationale. v1, v2, v3, vFinal — auditable.
- **Don't separate the budget from the operating model.** Once locked, the budget IS the plan tab of the operating model. Otherwise variance / forecast / scenario skills can't use it cleanly.
- **Don't skip the input template step.** Asking leaders for "a budget" with a blank sheet means they'll either anchor on round numbers (overestimate) or under-think (effort minimization). The template forces them to compare against prior actuals and articulate drivers.
- **Don't run the re-forecast as a "mini annual build."** Re-forecast is a focused update, not a re-litigation. If a leader wants to revisit fundamentals, that's a separate CFO conversation outside the re-forecast cycle.
- **Don't keep adding scenarios.** Bull / Base / Bear is the contract. Adding "Bull-Bull" or "Worst-case-of-Bear" dilutes the framework. If something materially changes, that's a *new* base case, not a new scenario branch.

---

## Output: example board-ready summary

The Day-13 board package opens with a one-page narrative the CFO can read aloud:

> **FY<N> Plan Summary.** Net revenue plan of $30.0M (+25% YoY) on TPV growth of +30%, with take-rate compression of -1 bp reflecting Connect platform mix shift. OpEx plan of $26.5M (+18% YoY) driven primarily by 17 engineering hires (60% backloaded H2) and a $0.5M expansion in S&M programs. EBITDA: -$1.5M (vs -$3.2M prior year). Ending cash: $32M, runway 19 months in Base — above the 18-month floor.
>
> **Bear case** (15 bps fraud, hiring 100%, take-rate compression -3 bp): ending cash $24M, runway 14 months → below floor; trigger hiring slowdown if Q2 actuals track to Bear.
>
> **Bull case** (volume +35%, fraud 7 bps, take-rate flat): EBITDA +$1.0M, runway 27 months, accelerates Series C optionality.
>
> **Material assumptions:** No new product launches in plan; one Connect platform renegotiation modeled at -2 bp take rate effective Q2; fundraising not assumed.

The board package then drills into the supporting detail. The narrative is structured so the CFO can present in 10 minutes and answer questions for 30.
