---
name: working-capital-bridge
description: Compute the working-capital changes that bridge accrual operating
  burn to cash from operations. Returns ΔAR, Δprepayments, Δaccrued expenses,
  ΔAP, and the net working-capital impact on cash for the period. Trigger phrases:
  "working capital change", "AR AP movement", "bridge accrual to cash", "non-cash
  working capital adjustments".
overridable: true
override_guidance: |
  If your org has working-capital line items unique to its business (deferred
  revenue, customer deposits, vendor prepayments held by you, escrow balances),
  add them to the bridge computation. Don't change the sign convention
  established below — the rest of the chain depends on it.
---

# Working Capital Bridge

Compute the change in working capital between two period-end balance sheets and report the net impact on cash. Used by `monthly-cash-burn` to bridge from accrual operating burn to cash from operations.

## When to invoke

Asked directly about working capital changes for a period, OR called as part of `monthly-cash-burn`. Also called by `controller` during close to validate balance sheet movements tie to expected cash impact.

## Pre-flight questions

1. **Period** — which month-end to which month-end? Default: prior close to current close.
2. **Entity** — same default rules as elsewhere (`default_entity` from `org.yaml`).
3. **What's "working capital" for this org?** — standard definition (AR + prepaid - AP - accrued) is the default. Some orgs include deferred revenue, customer deposits, vendor advances. Per `customization/reference/non-gaap-rules.yaml` if defined.

## Process

1. **Pull two balance sheets:** period-end prior month, period-end current month. Source: archive files for closed periods (`<Entity> <YYYY-MM> Final.xlsx → Consolidated BS`); live QBO BS report for open periods.

2. **Identify working-capital lines.** Standard categories:
   - **Accounts Receivable** (typically GL 1200-1299)
   - **Prepayments / Prepaid Expenses** (typically GL 1300-1399)
   - **Other current assets** (deposits, advances) — case by case
   - **Accounts Payable** (typically GL 2100-2199)
   - **Accrued Expenses** (typically GL 2200-2299)
   - **Deferred Revenue** (typically GL 2300-2399) — include if user's org bills upfront
   - **Customer Deposits** (typically GL 2400-2499) — include if relevant

3. **Compute deltas** (current period − prior period):
   - Increase in AR → cash *used* (you booked revenue but haven't collected)
   - Increase in prepayments → cash *used* (you paid out, P&L will catch up later)
   - Increase in AP → cash *generated* (you owe but haven't paid yet)
   - Increase in accrued → cash *generated* (P&L expensed but cash hasn't moved)
   - Increase in deferred revenue → cash *generated* (you collected but haven't recognized)

4. **Apply sign convention:** working capital impact on cash burn is the *negative* of cash from working-capital changes. If working capital provided $300K of cash this month, that reduces burn by $300K.

5. **Report the bridge** in a table form, with the sign of each line explicit.

## Output format

```markdown
## Working Capital Bridge — <Entity>, <Period> end vs. <Prior Period> end

**Net WC impact on cash burn: $X.XM** (positive = increases burn, negative = reduces burn)

| Item | Prior Period | Current Period | Δ | Impact on Cash |
|---|---|---|---|---|
| Accounts Receivable | $A | $A' | $(A'-A) | -(A'-A) |
| Prepayments | $B | $B' | $(B'-B) | -(B'-B) |
| Other current assets | $C | $C' | $(C'-C) | -(C'-C) |
| Accounts Payable | $D | $D' | $(D'-D) | +(D'-D) |
| Accrued Expenses | $E | $E' | $(E'-E) | +(E'-E) |
| Deferred Revenue | $F | $F' | $(F'-F) | +(F'-F) |
| **Net WC change** | | | | **$X.XM** |

**Interpretation:** [one sentence — e.g., "AR grew $1.2M as billings outpaced collections; AP grew $400K mostly in unpaid GCP invoices. Net WC drained $800K of cash this period — adds to burn."]
```

## Anti-patterns

- **Don't mix balance sheet dates with P&L periods.** WC change is *balance sheet snapshot at period end* minus *balance sheet snapshot at prior period end*. Not the P&L period's activity.
- **Don't ignore restricted vs. unrestricted cash.** Restricted cash should stay out of "cash" for runway purposes; restricted AR is similar — flag if present.
- **Don't apply working-capital changes to multi-month periods without a sign check.** Working capital can swing big and reverse — what looks like "$3M of cash used" over Q1 may be $5M used Jan-Feb and $2M returned in March.
- **Don't double-count deferred revenue.** Some orgs split it into current and long-term; the bridge only cares about the *current portion* (next 12 months), since long-term deferred is more of a liability than a working-capital lever.

## Common gotchas

- **Bad-debt provision.** An increase in the allowance for doubtful accounts is a non-cash expense (you reduced AR via the contra-account, not via cash collection). Strip the provision change from raw AR delta when computing WC.
- **Intercompany AR/AP** typically washes out in consolidation. If the user is asking about parent only, IC items count; if consolidated, they shouldn't.
- **Restricted accruals** (e.g., D&O insurance accrual that's already funded into escrow) — these are accruals but the cash already moved. Flag and exclude.

## Composes with

- `monthly-operating-burn` — sits upstream in the bridge
- `non-operating-bridge` — sister skill
- `monthly-cash-burn` — parent
- `controller` close calendar — Day 2 reconciliations call this to validate BS movements
