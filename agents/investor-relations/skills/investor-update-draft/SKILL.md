# Skill: Investor Update Draft

Produce a complete first draft of the monthly investor update from the Stack's canonical artifacts (Controller's close packet, FP&A Analyst's variance package, Treasury's runway report). CFO reviews and refines; never sent by you.

---

## When to invoke

Day 5 of close, after FP&A Analyst's variance package and IR input are delivered. On-demand from CFO requests ("draft this month's update").

---

## Inputs

- Controller's close-status report (`~/finance-data/closes/<year>-<month>/status-report.md`)
- FP&A Analyst's variance package (`~/finance-data/variance/<year>-<month>/variance-package.md`)
- FP&A Analyst's IR input file (`~/finance-data/ir/<year>-<month>/fpa-input.md`)
- Treasury's most recent runway report (`~/finance-data/runway/`)
- Treasury's latest 13-week projection (`~/finance-data/cash/<year>-<month>/projection-*.md`)
- Operating-model period data for KPIs
- **Prior 3 monthly updates** from `~/finance-data/ir/<prior-year-month>/` — critical for tone, language consistency, and any commitments referenced
- Investor list from `~/finance-data/ir/investor-list.yaml` to determine recipient segment
- Thresholds from `config.yaml`

---

## Outputs

A markdown file at `~/finance-data/ir/<year>-<month>/draft-v1.md`, plus a formatted `.docx` version via the SOP docx skill at `~/finance-data/ir/<year>-<month>/draft-v1.docx`.

Example structure (Strand reference case, hypothetical March 2026 update):

```markdown
# Strand · March 2026 Investor Update
*Draft prepared by IR agent · 2026-04-05 11:00 ET · v1 (pre-CFO review)*

## Headline

March net revenue came in at $2.18M (+5.3% MoM, -2% vs. plan), driven by take-rate compression of 2 bps on the Connect platform book. TPV growth held strong at +6% MoM. Operating cash $38.4M; runway 19 months (range 16–25). We're flagging the Connect rate trend as a structural item to watch.

## Results

**Net Revenue:** $2.18M for March, +5.3% vs. February, -2% vs. plan ($2.22M). Variance driven by a 2 bps net take rate compression on Connect after one platform client renegotiated their revenue share mid-month. The compression appears to be holding through the first week of April — we're treating it as structural until proven otherwise.

**TPV:** $355M for March (+6% MoM, +1% vs. plan). Volume growth remains healthy across all three product lines. Strand Billing-enabled TPV grew fastest (+9% MoM), continuing the trend we noted in February.

**Gross Margin:** 73% on net revenue for March (vs. 74% in February). The 1-pt compression reflects fraud losses running at 9 bps vs. the 8-bps trailing average — three flagged events in the month, all merchant-side issues now resolved.

**OpEx:** $3.5M for March, in line with budget. R&D spend +$80K vs. plan from two earlier-than-planned engineering hires; offset by lower S&M program spend (events deferred to Q2).

**EBITDA:** ($1.9M) for March, vs. ($1.7M) plan. The $200K miss reconciles to the rate compression noted above.

**Cash & Runway:** Operating cash closed March at $38.4M (excluding $84.2M merchant settlement float, which is never operating cash). Trailing-3-month net burn $2.0M/month. Runway 19 months (range 16–25 based on burn-month variability). The 13-week projection shows the trough in Week 8 (early June) at $24.1M — driven by the Q2 estimated tax payment converging with regular payroll. No threshold breaches.

## Wins

- **Closed a $480K annual Connect agreement** with [Platform Partner], expected first TPV in April
- **Hired two senior engineers** for the Payments core team — one from Stripe, one from Adyen
- **Shipped the merchant onboarding rewrite** — average time-to-first-transaction down from 4.2 to 2.1 days
- **Q1 SOX-readiness gate review with the auditors passed** with no material findings

## What We're Watching

- **Connect take rate compression.** Two platforms renegotiated lower rev-share in Q1. If this expands to more platform clients, it becomes a structural margin story rather than a one-time. FP&A is widening the Bear-case adjustment in next quarter's scenario refresh.
- **Merchant concentration in Connect.** Top three Connect platforms now represent 58% of Connect TPV. A loss of any one would be material. We're working on diversification but the structural reality is fewer, bigger platforms in this product line.
- **Fraud loss rate uptick.** 9 bps in March vs. 8 bps trailing. Risk team has root-caused all three flagged events to merchant-side issues, but if the rate doesn't return to baseline in April, we'll surface as a structural item.
- **Headcount cost growth.** Two earlier-than-planned R&D hires push fully-loaded engineering cost above plan. Manageable in 2026, but trending toward needing a Series D conversation in H1 2027.

## Asks

- **Introductions in the Series B–C fintech operator community.** We're building a fintech CFO board (informal) and are looking for two more practitioners with $50M–$200M revenue range and PSP / payments exposure.
- **Candidate referrals for our Head of Risk Operations role.** Posted on AngelList; quietly looking for warm referrals from teams that have built risk ops at scale.

## Items Requiring Human Review (before sending)

1. **The Connect rate compression language.** I drafted "structural until proven otherwise" — this is a meaningful claim. Confirm the CFO is comfortable making it on the record. Alternative: "we're tracking closely; one more month of data will clarify."
2. **The platform partner name in Wins.** Confirm we have permission to name them in the investor letter (some prefer "stealth" mention).
3. **The Series D timing language in Watching.** "H1 2027" is more specific than prior updates have said. Confirm the CFO wants to be that specific publicly.
4. **The fraud-rate context.** I noted "merchant-side issues now resolved" — the Risk team confirmed this for two of the three events; the third is pending final investigation. Confirm wording.
5. **Compliance flag:** I used "expect" twice in the Wins section. Soften to "anticipate" if the CFO wants to avoid forward-looking-statement risk for the investor data room copy.

## Methodology Notes

- Variance language pulled from FP&A Analyst's variance package dated 2026-04-04
- Runway figure and range pulled from Treasury's weekly runway report dated 2026-03-29; cross-checked against the 13-week projection dated 2026-04-04
- TPV and take-rate figures from the operating model, period closed 2026-04-02 by Controller
- Wins section drafted from a `~/finance-data/ir/<year>-<month>/wins-source.md` file maintained by the CFO; if that file is missing, I draft Wins as "[CFO to fill in]" placeholders
- Cross-referenced against February 2026 update for language consistency on the Connect rate story

## Audit Trail

2026-04-05 11:00:23 ET · Inputs: status-report.md, variance-package.md, fpa-input.md, runway-week-13.md, projection-2026-04-04.md, prior 3 monthly updates · skills: investor-update-draft, sop-docx
```

Then post to `#ir-ops`:

> 📝 **March 2026 investor update — draft v1 ready for CFO review.** Five items flagged for human approval (see Items Requiring Human Review). Connect rate compression is the lead story; runway 19 months (range 16–25). [link]

---

## Process

### Step 1 — Verify all required inputs are present

Check each:
- Controller close packet exists for the period
- FP&A variance package exists for the period
- FP&A IR-input file exists
- Treasury runway report from the past 7 days exists
- Treasury 13-week projection from the past 2 days exists
- Operating-model file readable
- Prior 3 monthly updates accessible

If any are missing or stale, halt and post to `#ir-ops` with the specific gap. Do not draft around missing inputs.

### Step 2 — Read prior 3 monthly updates first

Before drafting, read the 3 prior monthly updates. Note:
- Recurring narrative threads (e.g., "we noted in February" — make sure those references are still consistent)
- Metric definitions (how was gross margin defined in prior updates? Use the same definition.)
- Commitments made to investors that have come due (e.g., "we'll share Q1 cohort data in our Q2 update")
- Risks mentioned in prior updates that may need an update

This is the most important step. The biggest IR mistakes come from drafting the current update in isolation from prior ones.

### Step 3 — Draft the Headline

The Headline answers three questions in 2-3 sentences:
1. What was the period's key result? (numbers + direction)
2. What drove it?
3. What's worth flagging forward?

If the period had bad news, the Headline leads with it — give the CFO the option to soften, but never bury.

### Step 4 — Draft the Results section

For each financial line (net revenue, TPV, gross margin, OpEx, EBITDA, cash & runway):

1. Cite the actual figure (precise, never rounded to "approximately")
2. Compare to prior period AND plan
3. Cite the dominant driver from FP&A's variance narrative
4. If the driver might recur, label it as such

Pull the runway figure from Treasury's report verbatim, including the range. Never recompute.

### Step 5 — Draft Wins

Look for a CFO-maintained source file at `~/finance-data/ir/<year>-<month>/wins-source.md`. If it exists, format the items in the IR voice (concrete, named, not breathless). If missing, leave Wins as a "[CFO to fill in]" placeholder block — never invent wins.

### Step 6 — Draft "What We're Watching"

Pull risk items from:
- FP&A's variance package risk section
- FP&A's scenario refresh (if Bear case crossed any thresholds)
- Treasury's runway report (if runway compressed or thresholds tripped)
- Any structural items flagged in prior updates that remain unresolved

Aim for 3-5 items. Honest, candid, not catastrophic.

### Step 7 — Draft Asks

Pull from a CFO-maintained source file at `~/finance-data/ir/<year>-<month>/asks-source.md`. If missing, draft generic placeholders (always concrete, never "thoughts welcome") and flag in Items Requiring Human Review.

### Step 8 — Cross-check every numeric claim

For each number that appears in the draft, verify it traces to a Stack artifact:
- Net revenue → close packet
- TPV → operating model
- Gross margin → variance package
- Runway → Treasury report
- Customer counts → ops dashboard

Any number that can't be traced gets flagged in Items Requiring Human Review.

### Step 9 — Apply the voice rules

Run through the Anti-patterns list. Strip out:
- "Steady progress" → replace with specific metric
- "Strong demand" → replace with NRR / expansion data
- "Things are going well" → replace with quantified statement
- "Pleased to report" → drop the wrapper
- Hedge words ("modest headwind," "transient challenge") → name the issue plainly

### Step 10 — Generate Items Requiring Human Review

This is the most important output for the CFO. Each item names:
- The specific claim or sentence that needs review
- Why it's flagged (specificity, source confidence, sensitivity)
- The recommended action or alternative wording

5-10 items is typical for a substantive update.

### Step 11 — Save markdown + render .docx

Save the markdown to the path. Use the SOP docx skill to render the .docx version with Strand-appropriate formatting (clean, no Strand logo for v0.1 — the format is generic-professional rather than branded).

### Step 12 — Post to Slack

Summary post to `#ir-ops` with the headline metric, the count of items requiring review, and a link to the draft.

---

## Escalation thresholds

| Condition | Action |
|-----------|--------|
| Any required input missing | Halt, post to `#ir-ops`, do not draft |
| A KPI moved >20% MoM and FP&A's variance package didn't explain it | Halt, post to `#ir-ops`, request human investigation |
| A KPI moved >50% MoM regardless of explanation | Post to `#finance-alerts` immediately |
| Runway below 12 months | Add to "What We're Watching" automatically; do not require additional human prompt |
| Prior month's update was sent <14 days ago | Switch to "brief update" format (Headline + Results only, no Wins/Watching/Asks) |
| Wins source file missing | Draft placeholders; do not invent wins |
| Asks source file missing | Draft generic placeholders; flag in Items Requiring Human Review |

---

## Anti-patterns to avoid

- **Don't invent wins.** Wins must come from the CFO-maintained source file. If it's missing, leave placeholders. Inventing wins damages credibility instantly.
- **Don't smooth bad news.** The CFO can choose how to frame it; your job is to surface it accurately.
- **Don't recompute Treasury's runway.** Use the figure from the runway report exactly as Treasury produced it, range included.
- **Don't reuse prior-update prose.** Each update reads against prior ones; verbatim reuse gets noticed.
- **Don't reference data not in the Stack's artifacts.** The first time an investor sees a metric should be in a place where it's been internally validated — not as a fresh data point in an investor letter.
- **Don't speculate on valuation or fundraise pricing.** Even casually. Investors price the company; you don't.
- **Don't compress the Items Requiring Human Review section.** Better to over-flag than under-flag. The CFO can dismiss flags they don't need; they can't notice flags you didn't raise.
