---
name: one-time-items-classifier
description: Classify P&L line items as recurring vs. non-recurring (one-time)
  for a given period. Returns each flagged item with amount, reasoning, and a
  confidence level. Used by monthly-cash-burn for the pro-forma toggle. Trigger
  phrases: "one-off items", "non-recurring", "pro-forma adjustments", "what's
  one-time this month".
overridable: true
override_guidance: |
  Add or refine the classification rules below to match your org's pattern.
  Some industries have specific recurring items that look like one-offs at
  first glance (litigation settlements for plaintiff law firms; restructuring
  for serial acquirers). The default rules below are calibrated for a typical
  pre-IPO SaaS / fintech / crypto-native company.
---

# One-Time Items Classifier

Read a P&L (or expense detail) for a period and identify items that are non-recurring. Provides the input that lets `monthly-cash-burn` produce both an "as-reported" burn and a "pro-forma run-rate" burn — the latter being what CFOs use for runway planning under the assumption that one-offs don't repeat.

## When to invoke

Asked directly about non-recurring or one-off items, OR called by `monthly-cash-burn` when the user toggled pro-forma. Also called by FP&A Analyst when building variance commentary that distinguishes "real" cost movement from "noise from one-offs."

## Pre-flight questions

1. **Period** — which month or quarter?
2. **What's the user's view on what's "one-off"?** Default classification rules are below. If the user has a specific list (e.g., "treat the Q1 office buildout as recurring even though it's a single payment"), capture that override.
3. **Confidence threshold for inclusion** — strict (only items the skill is highly confident about) or generous (flag anything that pattern-matches as one-off)? Default: strict.

## Process

### Step 1 — Default classification rules

Flag any P&L line item matching these patterns as a candidate one-off, with reasoning:

| Pattern | Typical GL accounts | Why classified one-off |
|---|---|---|
| **Severance / restructuring** | Personnel: severance line, restructuring | Tied to specific RIF events, not ongoing comp |
| **Litigation settlements** | Legal: settlement, judgment | Tied to specific resolved matters |
| **Acquisition-related costs** | Prof Services: M&A advisory, due diligence | Tied to specific deal — one-time per transaction |
| **Fundraising costs** | Prof Services: investor counsel, due diligence, transfer agent | Per-round event |
| **IPO preparation costs** | Prof Services: SOX consulting, IPO counsel | Per-event; large companies bucket these separately |
| **Office buildout / relocation** | Occupancy: leasehold improvements (if expensed), moving | Per-event |
| **Conference / event sponsorships above usual** | Marketing: sponsorship — flag if 2x trailing 6-month average | Possible one-off |
| **One-time bonuses** | Personnel: bonus accrual — flag if labeled "spot bonus" or "retention" | Often one-off |
| **Tax true-ups** | Below-operating: income tax expense — flag if large vs. trailing average | Often one-off |
| **Asset write-downs** | Various: impairment | One-off |
| **Insurance settlements (received)** | Other income: insurance recovery | One-off offset |

### Step 2 — Cross-reference customization

Open `customization/reference/chart-of-accounts.xlsx`. If accounts have a `Recurring` or `One-Time` tag column populated by the org, use those as authoritative. The default rules above are fallback heuristics.

Also check `customization/reference/non-gaap-rules.yaml` — Non-GAAP exclusions are usually a strict superset of one-off items, so anything excluded from Non-GAAP is definitively non-recurring.

### Step 3 — Confidence levels

For each flagged item, assign:
- **High** — exact match against an org-tagged one-off, OR exact match against a Non-GAAP exclusion
- **Medium** — pattern-matches one of the default rules, no override from CoA tagging
- **Low** — anomalous amount relative to trailing 6-month average, but no clear pattern

In strict mode, return only High and Medium. In generous mode, return all three.

### Step 4 — Materiality filter

Drop anything below the user's materiality threshold (default $1K). Don't waste cycles flagging $200 of one-off office snacks.

## Output format

```markdown
## One-Time Items — <Entity>, <Period>

**Total non-recurring identified: $X.XM** (of $Y.YM total operating expense)

| Account | Description | Amount | Confidence | Reasoning |
|---|---|---|---|---|
| 6090 | Severance — Q2 RIF | $250K | High | Tagged "one-time" in CoA |
| 7115 | M&A due diligence (Project Aurora) | $85K | High | Acquisition costs per deal |
| 7232 | D&O Insurance true-up | $45K | Medium | Annual policy adjustment |
| 7305 | Q2 customer conference sponsorship | $120K | Medium | 3x trailing 6mo avg for this line |
| 7420 | Office buildout — SF expansion | $180K | High | Tagged "leasehold improvement" |
| **Total flagged** | | **$680K** | | |

**Pro-forma run-rate burn (excluding these): $X.XM** vs. as-reported $Y.YM.

**Items the skill is NOT flagging (for transparency):**
- Standard merit increases (recurring annual event)
- Quarterly board fees (recurring)
- Q2 tax estimated payment (recurring quarterly event)
```

## Anti-patterns

- **Don't classify quarterly or annual recurring events as one-offs.** Tax payments, audit fees, board fees — these happen once per period but they happen *every* corresponding period. They're recurring.
- **Don't go by amount alone.** A $500K marketing spend in November might be Q4-heavy seasonality, not a one-off. Cross-check against trailing same-period (e.g., last November) before flagging.
- **Don't reclassify a recurring vendor's spend without reasoning.** If Cooley invoices $30K-$80K monthly for ongoing matters, a $120K month isn't a one-off — it's a higher-activity month for ongoing legal work.
- **Don't include things the user has explicitly marked recurring** in their customization layer.

## Common gotchas

- **Restructuring** can be "one-time" repeated quarterly for serial restructurers. If your org has restructured 3 quarters in a row, ask whether the user wants this treated as recurring.
- **Litigation settlements** can be one-off in nature but multiple in any given month (different matters). Group by matter, not by month.
- **Fundraising costs** straddle multiple periods (deal opens Q1, closes Q3, legal bills land throughout). Be honest that you can only flag what's *in this period*.

## Composes with

- `monthly-cash-burn` — pro-forma toggle consumes this skill's output
- `controller` variance narrative — uses this to explain MoM cost movement
- `fpa-analyst` variance-decomposition — same purpose, different agent
