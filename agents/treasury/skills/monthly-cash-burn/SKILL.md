---
name: monthly-cash-burn
description: Compute true monthly cash burn for a period. Composes
  monthly-operating-burn + working-capital-bridge + non-operating-bridge + capex.
  Optional pro-forma toggle removes one-time items via one-time-items-classifier.
  Returns both as-reported and pro-forma run-rate burn with full reconciliation.
  This is the headline burn number CFOs use for runway. Trigger phrases:
  "monthly cash burn", "true burn", "what's our cash burn", "burn for runway".
overridable: true
override_guidance: |
  This skill is mostly composition — most overrides should happen in the
  individual upstream skills (monthly-operating-burn, working-capital-bridge,
  non-operating-bridge, one-time-items-classifier). Don't change the
  reconciliation structure — runway-calc and downstream consumers depend on
  the output schema being stable.
---

# Monthly Cash Burn

Compute true monthly cash burn — the headline number CFOs use for runway. Composes the four upstream skills (operating burn, working capital, non-operating, one-time classifier) plus capex into a single reconciled answer with two views: as-reported and pro-forma run-rate.

## When to invoke

- Direct ask: "what's our cash burn for May", "monthly burn for runway purposes"
- Called by `runway-calc` (the weekly runway report) as its burn input
- Called by `fpa-analyst` for variance narratives that distinguish cost trajectory from one-off noise
- Called by `ir-agent` building the monthly investor update — investors care about pro-forma burn

## Pre-flight questions

1. **Period** — which month?
2. **Entity** — per the usual default rules.
3. **As-reported only, or also pro-forma run-rate?** Default: both. Pro-forma adds one extra step (calling `one-time-items-classifier`) but readers usually want both numbers side-by-side.
4. **GAAP or Non-GAAP P&L starting point?** Default: GAAP. Note: pro-forma burn is *not* the same as Non-GAAP burn — pro-forma removes one-offs (severance, fundraising costs); Non-GAAP removes specific categories the org doesn't consider core (token comp, MTM). They're orthogonal lenses.

## Process

### Step 1 — Call upstream skills

In sequence:

1. **`monthly-operating-burn`** — get operating loss with non-cash adjustments added back
2. **`working-capital-bridge`** — get net WC impact on cash
3. **`non-operating-bridge`** — get net non-operating cash impact (interest income, etc.)
4. **Capex** — pull capex from the period's cash flow statement (or from balance sheet ΔPP&E + D&A). Treat capex as cash *out* (increases burn).

### Step 2 — Compute as-reported cash burn

```
Cash Burn (as-reported) =
    Operating Burn
  + Working Capital impact
  + Non-Operating impact
  + Capex
```

This is the actual cash that left the bank during the period for operating + investing activities. Equivalent to: -(Cash from operations + Cash from investing — financing). Sanity-check by comparing to actual cash flow statement if available.

### Step 3 — Compute pro-forma run-rate burn (if requested)

Call `one-time-items-classifier` for the period. Get the list of flagged non-recurring items with amounts.

```
Pro-Forma Burn = As-Reported Burn − Σ(High & Medium confidence one-offs)
```

Note: the classifier may flag items in operating expense (severance), in capex (office buildout), or in non-operating (insurance recovery). Subtract each from the right bucket so the reconciliation still balances.

### Step 4 — Reconcile to actual cash change

If the customization layer has a `cash-position-snapshot` from the start and end of the period, the as-reported burn should equal the cash change minus financing activities. Flag any discrepancy >5%.

## Output format

```markdown
## Monthly Cash Burn — <Entity>, <Period>

### Headline

| View | Monthly Cash Burn | Runway @ current cash |
|---|---|---|
| **As-reported** | **$X.XM** | Y months |
| **Pro-forma (excluding one-offs)** | **$X.XM** | Y months |

### Full reconciliation

| Line | As-Reported | Pro-Forma | One-Offs Removed |
|---|---|---|---|
| Revenue | $A | $A | — |
| COGS | $B | $B | — |
| Operating Loss (GAAP) | $C | $C′ | $W (severance + buildout etc.) |
| Add: Non-cash items (D&A, SBC) | $D | $D | — |
| **Operating Burn** | $E | $E′ | $W |
| Working Capital Δ (cash impact) | $F | $F | — |
| Non-Operating Δ (interest income, etc.) | $G | $G | — |
| Capex | $H | $H′ | $X (office buildout etc.) |
| **Cash Burn** | **$Y** | **$Y′** | $W + $X = $Z |

### What's in the one-offs (when pro-forma requested)

[Table listing each one-off item from one-time-items-classifier, with amount and reasoning]

### Reconciliation to actual cash change

[If cash-position-snapshot available for period boundaries]

Cash at <start>: $A
Cash at <end>: $B
Net cash change: $(A-B)
Less: Financing activities (debt draws, equity raises, repayments): $F
Equals: Cash burn from ops + investing: $Y
Computed cash burn (this skill): $Y
Discrepancy: $0 (or flag)

### Interpretation

[2-3 sentences. e.g., "As-reported burn of $2.8M was elevated by $680K of one-off items — severance from Q2 RIF and Project Aurora due diligence. Pro-forma run-rate is $2.1M, which matches the trailing 3-month average closely. Working capital was a $400K drag this month as AR grew faster than AP."]
```

## Anti-patterns

- **Don't return just one number.** Always show as-reported AND pro-forma. The CFO uses pro-forma for runway planning; the auditor wants as-reported. Both are honest answers to the same question.
- **Don't quietly skip the reconciliation to actual cash change.** If the bridge doesn't tie, something's off — flag it loudly. Could be a financing activity we missed, could be a non-cash item we miscategorized.
- **Don't treat capex as opex even if it's a small amount.** ASC 360 says capitalize anything material with >12-month useful life. Adding it to opex inflates operating burn.
- **Don't confuse pro-forma with Non-GAAP.** Different lenses, different audiences. The output should label clearly which is which.
- **Don't use this skill for trailing-N-month averaging.** This is monthly. Aggregation is downstream (`runway-calc` does the trailing-3 average for the runway range).

## Common gotchas

- **First month of a new period.** If the period just closed, the close may not be fully posted — non-cash items (D&A, SBC) may be missing. Flag if the close calendar shows current period status as not-yet-complete.
- **Acquired entities.** First month including a new sub will show a working-capital "increase" that's actually a one-time consolidation event. Flag and exclude.
- **PIK interest on venture debt.** Non-cash; should be in `monthly-operating-burn`'s non-cash adjustments, not in non-operating cash bridge.

## Composes with

- `monthly-operating-burn` — upstream (operating loss + non-cash)
- `working-capital-bridge` — upstream (WC delta)
- `non-operating-bridge` — upstream (interest etc.)
- `one-time-items-classifier` — upstream (pro-forma toggle)
- `runway-calc` — downstream (uses both as-reported and pro-forma burn)
- `fpa-analyst` variance-decomposition — downstream
- `ir-agent` exec-summary — downstream (investor update wants pro-forma)
