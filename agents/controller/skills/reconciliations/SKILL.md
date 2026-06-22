# Skill: Reconciliations

Run the recurring reconciliations for the period — bank, GL-to-subledger, intercompany. Categorize every reconciling item and surface what needs human review.

---

## When to invoke

Pass 3 of the close — Day 2 of the new period.

---

## Inputs

- Current period (year, month)
- Reconciliation map from `~/finance-data/config/reconciliations.yaml` (which accounts to reconcile, against which source)
- Bank statement data (via `mercury` / `modern-treasury` / `plaid` MCPs)
- Subledger data (via the accounting MCP — AP subledger, AR subledger, fixed asset subledger, etc.)
- Prior period's reconciliation results

---

## Outputs

A markdown file at `~/finance-data/closes/<year>-<month>/reconciliations.md` containing one section per reconciliation:

1. **Reconciliation header** — account name, source-of-record, GL ending balance, source ending balance, difference
2. **Reconciling items table** — date, description, amount, category (Timing / Adjust / Investigate), aging in days
3. **Status** — Clean (difference = 0 after items) / Adjusted (proposed entry needed) / Open (cannot close)
4. **Recommended actions** for each Adjust / Investigate item
5. **Items Requiring Human Review** — anything that breached an escalation threshold

Post per-account status summary to `#finance-ops`.

---

## Process

For each account in the reconciliation map, run the following sub-process:

### Step 1 — Pull both sides

- Pull GL ending balance for the period (from the accounting MCP)
- Pull source-of-record ending balance (from the bank MCP, subledger query, or counterparty if intercompany)

### Step 2 — Compute the gap

If gap is exactly zero and there are no in-transit items, mark **Clean** and move on.

### Step 3 — Identify reconciling items

For each item on either side that doesn't appear on the other (or doesn't match in amount):

- Pull transaction date, description, amount
- Compare against last period's outstanding items (if it carried over, increment aging)
- Categorize:
  - **Timing Difference** — known to clear in the next period (deposits in transit, outstanding checks under 30 days old, etc.)
  - **Adjustment Required** — a clear GL correction needed (recorded amount differs from source, missing entry, etc.)
  - **Investigate** — unknown source, requires human research

### Step 4 — Compute residual

After accounting for reconciling items, the residual should be zero. If not zero, mark the reconciliation **Open** and escalate.

### Step 5 — Apply escalation thresholds

- **Any reconciling item >$50K** (configurable) → surface in `#finance-alerts`
- **Any item aged >60 days** → always surface, regardless of amount
- **Bank rec residual >$1K** → halt this reconciliation, post to `#finance-alerts`
- **Investigate-category items >$10K total per account** → surface to `#finance-ops`

### Step 6 — Propose adjusting entries for "Adjust" items

For each "Adjust" item, propose a journal entry. Surface for human approval — do not book.

### Step 7 — Save and notify

Save the full reconciliation file. Post per-account status to `#finance-ops`:

```
Bank rec (Operating · Mercury): Clean. 4 reconciling items, all timing differences clearing next period.
AP subledger rec: Adjusted. 1 proposed entry surfaced for review ($8,400 invoice received post-cutoff).
Intercompany (Strand US ↔ Strand UK): OPEN. $12,400 residual after items. See alerts.
```

---

## Escalation thresholds (defaults from config.yaml)

| Trigger | Channel | Action |
|---------|---------|--------|
| Reconciling item > materiality $ | `#finance-alerts` | Surface with context |
| Item aged >60 days | Always surface | regardless of amount |
| Bank rec residual >$1K | `#finance-alerts` | Halt the rec, escalate |
| Total "Investigate" items >$10K per account | `#finance-ops` | Surface, request research help |
| Reconciliation cannot close (Open status) | `#finance-alerts` | Halt close until resolved |

---

## Anti-patterns to avoid

- **Don't force a zero** — if the residual isn't zero, it isn't zero. Don't create a balancing item.
- **Don't auto-clear timing differences** — they need to clear in fact, in the next period. Track them across periods.
- **Don't book the adjusting entries yourself** — propose, surface, wait for human approval, then update the file. Booking is the human's job.
- **Don't skip aging** — an old reconciling item is qualitatively different from a fresh one, even at the same dollar amount.

---

## Example output (excerpt)

```markdown
## Bank Reconciliation — Operating Account · Mercury

| | GL | Source | Difference |
|---|---|---|---|
| **Ending balance** | $1,247,532.18 | $1,251,840.18 | -$4,308.00 |

**Status:** Clean after reconciling items below.

### Reconciling Items

| Date | Description | Amount | Category | Aging |
|------|-------------|--------|----------|-------|
| 03/31 | Customer deposit in transit | $5,200.00 | Timing | 0 days |
| 03/30 | Outstanding check #4521 | -$1,892.00 | Timing | 1 day |
| 03/28 | Wire fee | -$45.00 | Adjust | 3 days |
| 03/26 | Unidentified inbound wire | $1,250.00 | Investigate | 5 days |

Residual after items: $0.00 ✓

### Items Requiring Human Review

1. **Unidentified inbound wire $1,250 from 03/26** — sender info: "REMITTANCE 4392". Not matched to any known customer or vendor. Aging 5 days. Recommended action: human research, likely customer with truncated name or wrong reference.
2. **Wire fee $45 (03/28)** — not yet booked. Proposed JE: Debit 8400 Bank Fees, Credit 1110 Operating Cash. Reversal: none.
```
