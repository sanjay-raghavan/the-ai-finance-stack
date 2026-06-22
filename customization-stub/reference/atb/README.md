# atb/ — Adjusted Trial Balance snapshots

One xlsx per closed month, named `ATB-YYYY-MM <Entity>.xlsx`. Drop the file from your accounting system here after each close.

## Why

The ATB is the canonical period-end snapshot — every account's debit and credit balance at the close date, post-adjustments. Agents use it to:

- Verify GAAP-to-Non-GAAP bridges tie out
- Compute period-over-period account walks without re-querying QBO
- Validate the chart of accounts against actual closed-period data
- Provide audit-ready balances for any historical month

## Naming convention

```
ATB-2026-01 Acme Corp.xlsx
ATB-2026-02 Acme Corp.xlsx
ATB-2026-01 Acme Labs.xlsx   ← if multi-entity
```

Year-month first so the files sort chronologically.

## How to export

**QuickBooks Online:** Reports → Adjusted Trial Balance → set date → Export to Excel.

**NetSuite:** Reports → Financial → Trial Balance → toggle "adjusted" → Export.

**Xero:** Reports → Trial Balance → set as of date → Export.

## What agents won't do

- Won't modify the files
- Won't delete old ATBs (keep the time series for audit support)
- Will warn if a closed period (per `closed-periods.md`) doesn't have an ATB filed
