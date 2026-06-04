---
name: non-operating-bridge
description: Compute the net non-operating cash impact for a period — interest
  income (large for VC-funded companies with treasury invested in T-bills /
  money market funds), interest expense, FX gain/loss on cash, dividends from
  investments, other below-operating items. Returns the net add/subtract to
  cash burn. Trigger phrases: "interest income impact", "non-operating items
  on cash", "below-the-line cash", "treasury income".
overridable: true
override_guidance: |
  If your org has unusual non-operating items (royalty income, equity-method
  investment gains, hedging gains, sublease income), add them. The standard
  list below covers most pre-IPO companies.
---

# Non-Operating Bridge

Compute the non-operating items that hit cash for the period. For VC-funded companies sitting on $20M+ of cash invested in T-bills or short-duration funds, this is **material** — interest income can offset $50K-$200K of monthly burn. Skipping it overstates burn meaningfully.

## When to invoke

Asked about non-operating items, interest income impact on burn, below-the-line cash items, OR called as part of `monthly-cash-burn`.

## Pre-flight questions

1. **Period** — which month?
2. **Entity** — per the usual default rules.
3. **Should FX on cash be included?** Default: yes if the org holds material non-USD cash; no otherwise.

## Process

1. **Pull below-operating P&L lines.** From the same source as operating P&L (archive or live QBO):
   - **Interest income** (typically GL 9905) — interest from operating accounts, money market funds, T-bills, CDs
   - **Investment income** (typically GL 9907) — realized gains/losses on securities; partner distributions
   - **Interest expense** (typically GL 9930) — debt facility interest, venture debt, line of credit
   - **FX gain/loss on cash** (typically Exchange Gain or Loss, no fixed GL) — realized + unrealized
   - **Other income/expense** (typically GL 9940-9999) — case by case

2. **Filter to cash-affecting items.** Some non-operating items are non-cash (e.g., unrealized FX on receivables, mark-to-market on securities held). Strip these out — they belong in working capital or non-cash adjustments, not the non-operating cash bridge.

3. **Apply sign convention.** Net non-operating cash impact on burn:
   - Interest income → reduces burn (cash in)
   - Interest expense → increases burn (cash out)
   - FX gain on cash → reduces burn
   - FX loss on cash → increases burn

4. **Compute net impact** and report each component.

## Output format

```markdown
## Non-Operating Bridge — <Entity>, <Period>

**Net non-operating cash impact: $X.XM** (positive = increases burn, negative = reduces burn)

| Item | Amount | Direction on Burn |
|---|---|---|
| Interest income (T-bills / money market) | $A | -$A (reduces) |
| Interest expense (venture debt) | $B | +$B (increases) |
| FX gain/loss on cash | $C | ±$C |
| Other non-operating | $D | depends |
| **Net non-operating** | | **$X.XM** |

**Interpretation:** [one sentence — e.g., "Interest income on the $25M T-bill ladder generated $95K, offsetting venture debt interest of $35K and a $10K FX loss on EUR account. Net $50K reduction to burn."]
```

## Anti-patterns

- **Don't include unrealized mark-to-market** in non-operating cash bridge unless your org actually settled the position. Unrealized gains/losses are non-cash and belong elsewhere.
- **Don't include dividends paid out** (financing activity, not non-operating) or equity raise proceeds (also financing).
- **Don't forget the materiality.** For a $5M-cash company, interest income may be $5K and ignorable. For a $50M-cash company in a 5% rate environment, it's $200K/month and very material. Always sanity-check by stating the magnitude in the output.
- **Don't lump FX gains on operating activities** (e.g., FX gain on collecting a EUR-denominated invoice) — that's a working-capital effect, not non-operating cash.

## Common gotchas

- **Sweep accounts.** Some treasury arrangements sweep operating cash into money-market funds nightly. The interest income shows up in different GLs depending on whether the bank reports it as bank interest or fund income. Confirm with your specific bank/treasury setup.
- **Venture debt PIK vs. cash interest.** PIK (paid-in-kind) interest accrues onto principal and is non-cash — strip from non-operating cash bridge. Only cash-pay interest counts here.
- **Intercompany interest** between parent and sub. Eliminates in consolidation. If the user is asking parent-only, IC interest counts; if consolidated, it shouldn't.

## Composes with

- `monthly-operating-burn` — upstream
- `working-capital-bridge` — sister
- `monthly-cash-burn` — parent
- `treasury` cash-position-snapshot — reads similar data for the daily snapshot
