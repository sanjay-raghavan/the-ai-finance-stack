---
name: monthly-operating-burn
description: Compute monthly operating burn on an EBITDA basis. Returns
  -(EBITDA) plus any non-cash items still embedded in EBITDA (primarily
  stock-based compensation). EBITDA itself excludes D&A by definition.
  Bounded scope — does NOT include working capital changes, non-operating
  items (interest income, FX), capex, or financing. Use as a building block
  for true cash burn (see monthly-cash-burn). Trigger phrases: "monthly
  operating burn", "EBITDA-basis burn", "operating burn excluding non-cash",
  "P&L burn for [period]".
overridable: true
override_guidance: |
  If your P&L embeds D&A inside COGS or operating expense categories (rather
  than showing it as a separate line below opex), this skill handles that —
  but you may want to override the D&A-detection rules to match your specific
  GL structure. Don't change the bounded scope.
---

# Monthly Operating Burn (EBITDA basis)

Compute operating burn starting from EBITDA — Revenue minus COGS minus Operating Expenses, with D&A excluded. Then add back any non-cash items still in EBITDA (primarily SBC). This is the cleanest measurement of recurring cash-operating cost — what a Finance leader watches when evaluating whether spend trajectory is sustainable.

**This is not cash burn.** Working capital, non-operating items (interest income — material for VC-funded companies sitting on T-bills), and capex are all still missing. Compose with the rest of the chain to get there. This skill produces the foundational input.

## When to invoke

The user (or another skill) is asking about monthly operating burn, EBITDA-basis burn, or operating burn excluding non-cash items. Or as part of the `monthly-cash-burn` composition.

If the user said "monthly burn" without qualifier, ask whether they want operating burn (this skill, EBITDA-basis) or cash burn (`monthly-cash-burn`, which composes this plus working capital plus non-operating plus capex).

## Pre-flight questions

1. **Period** — which month? Default: most recent closed period per `customization/reference/closed-periods.md`.
2. **Entity** — parent only, sub only, or consolidated? Default: `default_entity` from `customization/org.yaml`.
3. **GAAP or Non-GAAP starting point?** Default: GAAP. If the org reports Non-GAAP (per `non-gaap-rules.yaml`), the user may prefer Non-GAAP EBITDA (token comp already excluded, etc.). Confirm.

## Process

### Step 1 — Identify the P&L presentation

Two cases. Check the customer's actual P&L:

**Case A: EBITDA-style P&L (D&A shown below opex).** The COGS and operating-expense lines already exclude D&A. EBITDA is either an explicit line or computed as Revenue - COGS - Opex.

**Case B: Standard GAAP P&L (D&A embedded in COGS / opex).** D&A is buried inside the operating-cost lines (often within S&M, R&D, G&A, and COGS). Operating Loss includes D&A. To derive EBITDA, you must add D&A back to Operating Loss.

If you're not sure which case applies, look for: (1) a separate D&A line in the P&L's operating section, or (2) the absence of "D&A" line items but the presence of fixed-asset accounts whose period activity matches expected depreciation runs. Cross-reference `customization/reference/chart-of-accounts.xlsx` for the GL accounts tagged as depreciation or amortization.

### Step 2 — Compute EBITDA

For Case A:
```
EBITDA = Revenue − COGS − Operating Expenses
```
(All quantities exclude D&A by construction.)

For Case B:
```
EBITDA = Operating Income + Depreciation Expense + Amortization Expense
```
Pull D&A from the GL accounts. Standard ranges:
- Depreciation expense — typically GL 8500-8519
- Amortization expense — typically GL 8520-8529

### Step 3 — Add back other non-cash items still in EBITDA

EBITDA excludes D&A but still contains other non-cash items, primarily:

- **Stock-based compensation** (typically GL 6065-6069) — non-cash equity expense; sits in operating expense; "Adjusted EBITDA" removes this
- **Deferred tax expense** — usually below operating, so usually not relevant here, but flag if present in opex
- **Asset impairments** — one-off, non-cash, often shown as a separate operating line
- **Fair-value adjustments on hedges** — non-cash

```
Operating Burn = -(EBITDA) + Σ(non-cash items still in EBITDA)
                = -(EBITDA) + SBC + (other non-cash)
```

Operating Burn is positive when the company is burning. If EBITDA is positive (rare for VC-funded companies), the burn is negative — i.e., the company is generating operating cash before working-capital / non-operating / capex adjustments.

### Step 4 — Verify

If `customization/reference/atb/ATB-YYYY-MM <Entity>.xlsx` exists for this period, cross-check that SBC and other non-cash items match the trial balance.

## Output format

```markdown
## Monthly Operating Burn — <Entity>, <Period>

**Operating Burn (EBITDA basis): $X.XM**

| Line | Amount |
|---|---|
| Revenue | $A |
| COGS | $(B) |
| Gross Profit | $(A-B) |
| Operating Expenses (excluding D&A) | $(C) |
| **EBITDA** | **$(A-B-C)** |
| Add back: Stock-Based Compensation | $D |
| Add back: Other non-cash in EBITDA | $E |
| **Operating Burn** | **$X.XM** |

**Methodology:** EBITDA basis (Revenue minus cash COGS minus cash Opex) with remaining non-cash items added back. D&A is excluded by construction (it's the "DA" in EBITDA). Excludes working capital, non-operating items, capex, and financing. For true cash burn, see `monthly-cash-burn`.

**P&L presentation:** [Case A: D&A shown separately / Case B: D&A embedded in opex; derived via add-back from Operating Loss + $X (depreciation) + $Y (amortization)].

**MoM delta:** $X.XM vs. $X.XM last month — driven by [top 2-3 drivers from variance].
```

## Anti-patterns

- **Don't return Operating Loss as if it were operating burn.** Operating Loss includes D&A. The whole point of this skill is to exclude D&A (via EBITDA) so the output reflects cash-operating cost, not accounting depreciation.
- **Don't return this as "cash burn."** It is not. True cash burn requires working capital adjustments (ΔAR, Δprepayments, ΔAP), non-operating items (interest income is material for VC-funded companies sitting on T-bills), and often capex. This skill is the *starting point* for that bridge, not the end.
- **Don't mix entities silently.** Label the entity in the output.
- **Don't average over periods.** One month at a time. Aggregation is downstream (`runway-calc` does trailing-3 averaging).
- **Don't forget Non-GAAP context.** If the user's org reports Non-GAAP, clarify upfront whether the user wants EBITDA computed from the Non-GAAP P&L (token comp already excluded, etc.) or the GAAP P&L.

## Common gotchas

- **SBC is non-cash but is in EBITDA.** Many readers conflate EBITDA with "cash earnings" — it's not. SBC is recognized over the vesting period per ASC 718; it's a real operating expense in EBITDA. To get to a cash basis you must add it back. "Adjusted EBITDA" (the common non-GAAP metric) is exactly this — EBITDA with SBC added back.
- **Token compensation** (for crypto-native companies) is non-cash like SBC. Usually a Non-GAAP exclusion AND should be added back here when computing operating burn.
- **D&A on intangibles** sometimes lives in a different GL section than D&A on PP&E (one in COGS for software amortization, one in opex for office furniture, etc.). Make sure you find all of it when deriving EBITDA from operating loss in Case B.
- **Lease expense under ASC 842** has both cash and non-cash components. The cash portion (operating-lease payments) is in opex; the amortization of the right-of-use asset on finance leases is non-cash. Most P&Ls don't separate them. If your org has material finance leases, decompose.
- **Operating Income reported by your accounting system may differ from the EBITDA-style derivation** because of items like restructuring, gain/loss on disposal, or one-time impairments that may or may not sit above the operating line per ASC 220. Reconcile if discrepancy >1% of revenue.

## Composes with

- `working-capital-bridge` — produces the next step toward cash burn
- `non-operating-bridge` — interest income + below-operating items
- `monthly-cash-burn` — the parent that calls all of the above
- `runway-calc` — downstream consumer that uses cash burn for runway
- `one-time-items-classifier` — feeds the pro-forma toggle in `monthly-cash-burn`
