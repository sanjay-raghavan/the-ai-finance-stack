# Skill: Amortization Schedule

Set up and maintain the amortization schedule for each prepayment. The schedule is the contract between the human and the system — once approved, all subsequent monthly amortizations follow it deterministically.

---

## When to invoke

Once per new prepayment, after identification. On-demand for schedule amendments (e.g., contract terms changed, prepayment partially refunded).

---

## Inputs

- The identified prepayment (from `prepay-identification` skill output)
- The underlying contract (from `notion-finance` MCP if available)
- The accounting MCP's chart of accounts (for selecting prepaid asset + expense accounts)
- The active-schedules registry (for ID generation, conflict detection)
- Configured rounding conventions from `config.yaml`

---

## Outputs

A schedule record in `~/finance-data/prepayments/active-schedules.yaml` (once approved):

```yaml
- schedule_id: PRP-2026-0019
  vendor: Acme Insurance
  description: "General liability insurance, 4/1/2026 - 3/31/2027"
  contract_reference: "notion:gen-liability-2026"
  invoice_reference: "INV-AC-2026-0412"
  total_prepayment: 24000.00
  start_date: 2026-04-01
  end_date: 2027-03-31
  monthly_amount: 2000.00
  prepaid_asset_account: "1410 - Prepaid Insurance"
  expense_account: "6210 - Insurance Expense"
  department: G&A
  status: active
  period_recognized_through: null    # set after first amortization
  approved_by: "Sanjay Raghavan"
  approved_on: 2026-04-05
  notes: "Annual policy. Renewal of PRP-2025-0015 at +9%."
  amendments: []                     # populated if schedule is later amended
```

Until approved, the schedule lives in `~/finance-data/prepayments/proposed/<schedule-id>-draft.md`.

---

## Process

### Step 1 — Generate the schedule ID

Format: `PRP-<year>-<sequence>`. Sequence is the next integer not yet used in the active-schedules registry for that year. Pad to 4 digits.

### Step 2 — Determine start and end dates

Three sources, in priority order:
1. **The contract** — if available and explicit about service period, use it
2. **The invoice description** — often says "4/1/2026 to 3/31/2027" or similar
3. **Inferred from term + invoice date** — if the contract is silent and the invoice says "annual subscription" with no dates, infer start = invoice date, end = invoice date + 1 year

If start/end are ambiguous, halt and surface for human determination — don't guess.

### Step 3 — Compute monthly amount

```
monthly_amount = total_prepayment / number_of_months_in_period
```

Where `number_of_months_in_period` is the count of full calendar months from start_date to end_date.

For partial-month start or end:
- Pro-rate the first or last month based on days
- Compute the full-month amount from the remaining periods
- The first month gets the partial amount; the rest get the full amount

Example: prepayment $12,000 for 4/15/2026 - 4/14/2027 (one year, but mid-month):
- 12 months × $1,000/month? Not exactly, because the start and end are mid-month.
- Better: 12 × $1,000 with the first month (Apr 2026) being a partial of 16 days / 30 days × $1,000 = $533, and the last (Apr 2027) being the remaining $467.
- Document the pro-rata math in the methodology.

### Step 4 — Select accounts

**Prepaid asset account** — based on the prepayment type:
- Insurance → 1410 Prepaid Insurance
- Software subscriptions → 1420 Prepaid Software
- Lease → 1430 Prepaid Rent
- Other services → 1490 Other Prepaid Expenses

Use the account naming/numbering from the connected accounting MCP's chart of accounts. Verify the account exists and is active.

**Expense account** — based on what the prepayment covers:
- Insurance → 6210 Insurance Expense
- Software → 6310 Software Expense
- Rent → 6510 Rent Expense
- Professional services → 6810 Professional Fees

If the right account doesn't exist in the chart, surface; don't propose a schedule until the account is created.

### Step 5 — Select department / project coding

Inherit from the underlying invoice's coding (AP Watcher already proposed this). Carry it through to every monthly amortization.

If the coding seems wrong for the prepayment type (e.g., a G&A insurance prepayment coded to Engineering), flag for human review.

### Step 6 — Validate against the contract

If the contract is available in notion-finance:
- Confirm the total prepayment matches the contract amount
- Confirm the service period matches
- Confirm the vendor name matches

Any mismatch → surface as Items Requiring Human Review.

### Step 7 — Surface for approval

Write the draft schedule to `~/finance-data/prepayments/proposed/<schedule-id>-draft.md`. Post to `#prepay-ops` with the draft attached, asking for approval.

The human approves explicitly (e.g., reply "/approve PRP-2026-0019" or thumbs-up the message — runtime-specific).

### Step 8 — Activate

Once approved:
- Move the schedule from `proposed/` to the active registry (`active-schedules.yaml`)
- Set `status: active`, `approved_by`, `approved_on`
- Confirm by replying in the thread

---

## Amendment workflow

When an active schedule needs to change (contract amended, prepayment partially refunded, service paused):

1. Surface the trigger event (usually detected from AP Watcher's invoice stream — a refund/credit memo — or from a human direction)
2. Propose the amendment as a delta to the existing schedule
3. Human approves explicitly
4. Apply: append to `amendments[]` with timestamp, change description, who approved
5. Recompute remaining monthly amounts from the amendment date forward

Never rewrite history — the past months stay amortized as they were; only the forward-looking periods change.

---

## Escalation thresholds

| Trigger | Channel | Action |
|---------|---------|--------|
| Contract terms differ from invoice (amount, period) | `#prepay-ops` | Surface mismatch; halt schedule proposal until resolved |
| Required account doesn't exist in CoA | `#prepay-ops` | Surface; coordinate with Controller to create account |
| Schedule period results in fractional cent monthly amount | `#prepay-ops` | Surface rounding decision; document choice in schedule notes |
| Amendment would change a historical period | `#finance-alerts` | Halt — amendments only affect forward periods |
| Amendment results in negative balance | `#finance-alerts` | Halt — usually indicates a data error |

---

## Anti-patterns to avoid

- **Don't guess at start/end dates.** If the contract is silent, surface for human determination.
- **Don't aggregate multiple prepayments into one schedule.** Each prepayment is its own schedule, even for the same vendor. Aggregation makes future amendments and reconciliations painful.
- **Don't rewrite history during an amendment.** Past months are settled; only future months change.
- **Don't extend an active schedule past its contracted end date.** Even if "obviously" continuing — that's a new prepayment, new schedule, new approval.
- **Don't approve schedules autonomously.** Every schedule requires explicit human approval before activation, even high-confidence cases. The schedule is the contract; the human signs it.
