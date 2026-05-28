# Skill: Accrual Entries

Prepare standard month-end accrual journal entries based on the prior period's pattern, with adjustments for known one-time events. Surface for human approval. Do not book.

---

## When to invoke

Pass 2 of the close — Day 1 of the new period, after the close calendar exists.

---

## Inputs

- Current period (year, month)
- Prior-period accrual journal entries (pulled from the accounting MCP)
- Close calendar from Pass 1 (to identify any one-time events affecting accruals)
- One-time events markdown (if exists)
- Materiality thresholds from `config.yaml`

---

## Outputs

A markdown file at `~/finance-data/closes/<year>-<month>/accruals-proposed.md` containing:

1. **Header** — period, accrual generation timestamp
2. **Summary table** — count of entries by category (recurring, one-time, true-up), total debit, total credit
3. **Detailed proposed entries** — a markdown table per entry with Debit / Credit / Account / Department / Amount / Memo / Reversal Date
4. **Period-over-period comparison** — for each recurring accrual, the prior-period amount vs. proposed amount, with % variance
5. **Items Requiring Human Review** — every entry that breached an escalation threshold, with explanation
6. **Methodology** — projection method used for each recurring accrual class
7. **Audit Trail**

Post summary to `#finance-ops`: "Standard accruals for [period] prepared. [N] recurring entries, [N] one-time, [N] flagged for review. Total accrual amount: $X. See `accruals-proposed.md`."

---

## Process

1. **Pull prior period's accrual entries** from the accounting MCP. Filter to entries tagged "accrual" or matching known accrual account ranges.

2. **Classify each prior entry** into one of:
   - **Recurring fixed** — same amount every month (e.g., subscription accruals)
   - **Recurring variable** — projected from a driver (e.g., bonus accruals based on commission earnings)
   - **One-time** — appeared once, do not project
   - **True-up** — was a prior-period correction; do not project

3. **For each Recurring Fixed accrual**, the proposed current-month amount equals the prior month, unless flagged by a known one-time event.

4. **For each Recurring Variable accrual**, recompute using the driver:
   - Pull the current-month driver value from the relevant MCP (e.g., commissions from RevOps system, payroll cost from payroll MCP)
   - Apply the documented multiplier or formula
   - Document the formula in Methodology

5. **Layer in one-time events** from the close calendar's one-time events list. Each becomes its own proposed entry.

6. **Apply the 11-point review checklist** from `finance:journal-entry-prep`:
   1. Debits equal credits
   2. Account codes are valid
   3. Period is correct
   4. Memo is descriptive enough for an auditor
   5. Department coding is consistent with the accrued cost
   6. Reversal date is set (typically first day of next period)
   7. Amount is reasonable vs. prior period
   8. Account isn't suspended or restricted
   9. Entry doesn't conflict with another proposed entry
   10. Source documentation is referenced
   11. SOX control reference is included if applicable

7. **Compute period-over-period variance** for each recurring accrual. Flag any with >25% deviation (or whatever's in `config.yaml`).

8. **Save the file** in the standard artifact structure.

9. **Post to Slack** with the summary line.

---

## Escalation thresholds (defaults from config.yaml)

- **Recurring accrual deviates >25% from prior period** → flag with possible explanation; require human review before booking
- **New accrual class not seen in prior period** → flag; require human review
- **One-time event without a clear sequencing assumption** → flag; do not propose an amount
- **Total proposed accruals exceed prior period by >40%** → halt and surface to `#finance-alerts`

---

## Anti-patterns to avoid

- **Don't invent accruals** — only project from prior-period patterns or pre-confirmed one-time events
- **Don't smooth variances** — if a number genuinely changed, surface the change. Don't normalize it to the prior period.
- **Don't skip the period-over-period comparison** — that comparison is the entire point of the review checklist
- **Don't book** — even if the entry passes every check, the human approves before booking. No exceptions.

---

## Example output (excerpt)

```markdown
## Summary

| Category | Count | Debit Total | Credit Total |
|----------|-------|-------------|--------------|
| Recurring Fixed | 8 | $245,000 | $245,000 |
| Recurring Variable | 4 | $182,500 | $182,500 |
| One-Time | 1 | $35,000 | $35,000 |
| **Total** | **13** | **$462,500** | **$462,500** |

3 entries flagged for human review (see "Items Requiring Human Review").

## Detail

### Recurring Fixed

| Account | Dept | Debit | Credit | Memo | Reversal |
|---------|------|-------|--------|------|----------|
| 6810 — Software | Eng | $12,000 | | AWS March accrual (per prior period) | 04/01/26 |
| 2100 — Accrued Liabilities | Eng | | $12,000 | | |
...

### Items Requiring Human Review

1. **AWS accrual $12,000** — prior period was $9,800. Variance +22%, just under the 25% threshold but flagged because two prior periods both ran $9,800. Possible explanation: month-end true-up volume.
2. ...
```
