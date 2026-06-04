---
name: monthly-operating-burn
description: Compute monthly operating burn on an accrual basis with non-cash
  adjustments. Returns P&L operating loss adjusted for depreciation, amortization,
  stock-based comp, and other non-cash items. Bounded scope — does NOT include
  working capital changes, non-operating items, capex, or financing. Use as a
  building block for true cash burn (see monthly-cash-burn). Trigger phrases:
  "monthly operating burn", "accrual burn", "operating loss with non-cash adjustments",
  "P&L burn for [period]".
overridable: true
override_guidance: |
  If your org has unusual non-cash items beyond D&A and SBC (e.g., asset
  impairments, fair-value adjustments on hedges, unrealized FX on receivables),
  add them to the non-cash adjustment list. Don't change the bounded scope —
  if you want to include working capital, use working-capital-bridge instead.
---

# Monthly Operating Burn

Compute operating burn on an accrual basis with non-cash items added back. This is **not** cash burn. It's the cleanest measurement of recurring operating cost discipline — what a Finance leader watches when evaluating whether spend trajectory is sustainable.

## When to invoke

The user (or another skill) is asking about monthly operating burn, accrual-basis burn, or operating loss with non-cash adjustments. Or as part of the `monthly-cash-burn` composition.

If the user said "monthly burn" without qualifier, ask whether they want operating burn (this skill) or cash burn (`monthly-cash-burn`, which composes this + working capital + non-operating).

## Pre-flight questions

Confirm before computing:
1. **Period** — which month? Default: most recent closed period per `customization/reference/closed-periods.md`.
2. **Entity** — parent only, sub only, or consolidated? Default: `default_entity` from `customization/org.yaml`.
3. **GAAP or Non-GAAP P&L starting point?** Default: GAAP (more conservative; auditor-facing). If user prefers Non-GAAP, this skill works on the post-exclusion P&L from `finance-view-switch`.

## Process

1. **Pull operating loss** from the P&L. Open `customization/reference/closed-periods.md` to find the right source — closed period → archive file; open period → live QBO via `qbo-query-recipes`.

2. **Identify non-cash expenses** in operating expenses. Cross-reference `customization/reference/chart-of-accounts.xlsx` for accounts tagged as non-cash. Standard non-cash items:
   - Depreciation expense (typically GL 8500-8519)
   - Amortization expense (typically GL 8520-8529)
   - Stock-based compensation (typically GL 6065, 6066 — also a Non-GAAP adjustment)
   - Deferred tax expense (usually below operating line — flag if present)
   - Asset impairments (one-off, rare)
   - Fair-value adjustments on hedges (rare)

3. **Compute operating burn:**

   ```
   Operating Burn = -(Operating Loss) + Σ(non-cash expenses)
   ```

   Operating Burn is positive when the company is burning. If operating *income* is positive (rare for VC-funded companies), the burn is negative — i.e., the company is generating operating cash.

4. **Verify against ATB.** If `customization/reference/atb/ATB-YYYY-MM <Entity>.xlsx` exists for this period, cross-check that non-cash items match the trial balance.

## Output format

A short structured response:

```markdown
## Monthly Operating Burn — <Entity>, <Period>

**Operating Burn: $X.XM**

| Line | Amount |
|---|---|
| Revenue | $Y |
| COGS | $(Y-X) |
| Gross Profit | $Z |
| Operating Expenses | $(...) |
| **GAAP Operating Loss** | $(...) |
| Add: Depreciation & Amortization | $A |
| Add: Stock-Based Compensation | $B |
| Add: Other non-cash | $C |
| **Operating Burn** | **$X.XM** |

**Methodology:** Accrual-basis operating loss with non-cash items added back. Excludes working capital, non-operating items, capex. For true cash burn, see `monthly-cash-burn`.

**MoM delta:** $X.XM vs. $X.XM last month — driven by [top 2-3 drivers from variance].
```

## Anti-patterns

- **Don't return this as "cash burn."** It is not. True cash burn requires working capital adjustments (ΔAR, Δprepayments, ΔAP), non-operating items (interest income — material for VC-funded companies sitting on T-bills), and often capex. This skill is the *starting point* for that bridge, not the end.
- **Don't mix entities silently.** If the user asked about parent and you returned consolidated (or vice versa), label it explicitly in the output.
- **Don't average over periods.** One month at a time. If the user wants trailing 3-month average, that's a separate aggregation.
- **Don't proxy SBC with "headcount × average grant value."** SBC is what the P&L actually posts per ASC 718 — use the GL value.
- **Don't forget Non-GAAP context.** If the user's org reports Non-GAAP (per `non-gaap-rules.yaml`), the user may want this skill to start from the Non-GAAP P&L (token comp already excluded, etc.) rather than GAAP. Confirm.

## Common gotchas

- **D&A on intangibles** sometimes lives in a different GL section than D&A on PP&E. Catch both.
- **SBC for restricted stock** is recognized over the vesting period — the P&L line is the period's amortization, not the grant value.
- **Token compensation** (for crypto-native companies) is non-cash but is also typically Non-GAAP-excluded — clarify upfront whether the user wants it included in operating burn or stripped per Non-GAAP rules.
- **Lease expense under ASC 842** has both cash and non-cash components. The cash portion is in operating expense; the amortization of the right-of-use asset is non-cash. Most P&Ls don't separate them.

## Composes with

- `working-capital-bridge` — produces the next step toward cash burn
- `non-operating-bridge` — interest income + below-operating items
- `monthly-cash-burn` — the parent that calls all of the above
- `runway-calc` — downstream consumer that uses cash burn for runway
- `one-time-items-classifier` — feeds the pro-forma toggle in `monthly-cash-burn`
