# Skill: finance-view-switch

Produce GAAP and Non-GAAP financials for a requested period, with a clean bridge between them. Generic — reads exclusion rules from `customization/reference/non-gaap-rules.yaml`, so the same skill works for SaaS, crypto-native, real-estate, or any other company that reports both views.

## When to invoke

Trigger phrases:
- "GAAP vs Non-GAAP for [period]"
- "Non-GAAP P&L"
- "Bridge GAAP to Non-GAAP"
- "What's excluded from Non-GAAP?"
- "GAAP numbers for the auditor"
- "Non-GAAP view for the board"

Also trigger when:
- The user asks for a P&L without specifying view AND `non-gaap-rules.yaml` has `enabled: true`
- An agent (Controller, FP&A Analyst) needs both views for its own output

## Pre-requisites

- `customization/org.yaml` exists
- `customization/reference/non-gaap-rules.yaml` exists with `enabled: true`
- `customization/reference/chart-of-accounts.xlsx` exists with a `Non-GAAP Treatment` column

If any is missing, fall back to GAAP-only and flag the gap.

## Process

### Step 1 — Resolve the request

Confirm (or default from `org.yaml`):
- Entity
- Period (and whether it's closed per `closed-periods.md`)
- Audience (finance / exec / board / IR / auditor — defaults from `non-gaap-rules.yaml`)
- Presentation style (defaults from `non-gaap-rules.yaml`)

### Step 2 — Resolve exclusions

Open `non-gaap-rules.yaml`. For each rule, resolve to a concrete account list:

- `account_number: X` → that account
- `account_range: [X, Y]` → all accounts where number ∈ [X, Y]
- `account_pattern: "*foo*"` → all accounts where name matches glob

Cross-reference against `chart-of-accounts.xlsx` `Non-GAAP Treatment = Exclude` column as a sanity check. If they disagree, flag the conflict and ask the user which is right.

### Step 3 — Pull the data

If period is **closed**:
- Pull from `customization/archive_location` (per `org.yaml`) — typically `<Entity> <YYYY-MM> Final.xlsx`
- For multi-entity, prefer the archive's consolidated tab over re-aggregating
- If archive missing, fall back to closed-period QBO query with a "archive missing" warning

If period is **open**:
- Pull live from QBO
- Apply the `open_period_handling` rule from `non-gaap-rules.yaml`:
  - `gaap-only`: return GAAP, note "Non-GAAP not yet computed for open period"
  - `gaap-with-estimate`: return both, mark Non-GAAP as estimate, list which exclusions have data and which don't (e.g., crypto MTM may lag)
  - `refuse`: don't return open-period data

### Step 4 — Build the bridge

The bridge is the reconciliation between the two views:

```
GAAP Operating Loss     ($X)
  + Stock-based comp     $Y
  + Crypto MTM           $Z
  + Restructuring        $W
  + FX on crypto         $V
Non-GAAP Operating Loss ($X + Y + Z + W + V)
```

One line per exclusion bucket (group related exclusions, e.g., all crypto-MTM accounts into one "Crypto MTM" line).

### Step 5 — Present

Per `presentation.style` in `non-gaap-rules.yaml`:

**`side-by-side`** (default for finance / exec audiences):

| Line | GAAP | Non-GAAP | Δ |
|---|---|---|---|
| Revenue | $X | $X | — |
| COGS | $Y | $Y | — |
| Gross Profit | $X-Y | $X-Y | — |
| Operating Expenses | $A | $A-$B | $B |
| Operating Income | $X-Y-A | $X-Y-A+B | $B |

Plus the bridge table.

**`single-pnl-adjustments-block`**:

Standard GAAP P&L, then a section labeled "Non-GAAP Adjustments" with the bridge lines, then "Non-GAAP Operating Income" as a subtotal.

**`bridge-only`** (for auditor / IR audiences when they specifically asked for the bridge):

Just the reconciliation table, no P&L.

### Step 6 — Always label

Every output should make clear which view is GAAP and which is Non-GAAP. Auditors and investors get GAAP without confusion; finance/board get both with an explicit label.

### Step 7 — Validate

Before returning:
- GAAP Operating Income + Σ(adjustments) should equal Non-GAAP Operating Income exactly — flag any mismatch
- If the period's ATB exists in `customization/reference/atb/`, tie GAAP numbers to ATB balances and flag any discrepancy
- Surface any account in the period that isn't in the CoA file as a "gap to add" warning

## Outputs

- Markdown table(s) with the requested views
- Bridge table
- Validation status (tied / discrepancy)
- A "what was excluded" disclosure when audience = exec/board/IR — readers must be able to see the adjustments

## Anti-patterns

- **Don't** silently compute Non-GAAP with rules that weren't in `non-gaap-rules.yaml`. The yaml file is the source of truth.
- **Don't** present Non-GAAP alone without the bridge. The bridge is required for transparency.
- **Don't** mix entities silently. If the user asked about parent and you returned consolidated (or vice versa), label it explicitly.
- **Don't** estimate Non-GAAP for an open period without flagging which exclusions have full data and which don't.
- **Don't** assume the user wants Non-GAAP when audience signals suggest GAAP — auditors and bank lenders almost always want GAAP.

## Example invocations

> "Show me April Non-GAAP P&L"
→ Resolves entity = default (per org.yaml), period = 2026-04, audience = finance (default). Returns side-by-side P&L + bridge.

> "GAAP numbers for the auditor for Q1"
→ Returns GAAP-only for the requested entity. Notes "Non-GAAP available on request" footer.

> "What's excluded from Non-GAAP?"
→ Reads `non-gaap-rules.yaml`. Returns the rule list with resolved account list and reason for each.

> "Bridge GAAP to Non-GAAP for May" (May is open period)
→ Pulls live GAAP. Applies `open_period_handling` per yaml. Returns GAAP + estimated Non-GAAP with caveat about MTM/late-posting items.
