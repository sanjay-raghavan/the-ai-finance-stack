# Skill: Reversal Handling

For accruals marked `auto_reverse`, schedule and post the reversal on the configured reversal date. For human-initiated reversals of prior posted entries, post the reversal as a new entry referencing the original. The closing-of-the-loop discipline that makes the accrual lifecycle work.

---

## When to invoke

Two triggers:

1. **Auto-reversal trigger**: Day 1 of new period, 6am ET — before any other agent's morning work. Posts the auto-reversals of the prior period's accruals.

2. **Manual reversal request**: a human-initiated proposal arrives in `~/finance-data/approved/` with `reverses_transaction_id: <id>` field. Standard approval validation applies.

---

## Inputs

For auto-reversals:
- Audit log entries from the prior period showing `auto_reverse: true` posts
- Each original confirmation file (to get the QBO transaction ID and content)
- QBO's chart of accounts (to verify accounts are still active)

For manual reversals:
- The reversal proposal file
- The original posted entry (referenced via `reverses_transaction_id`)
- The approval record

---

## Outputs

For each reversal: a posted confirmation at `~/finance-data/posted/<year>-<month>/<reversal-proposal-id>-posted.md`, a Slack reply in `#finance-approvals`, an audit log entry.

For auto-reversal batches: a daily summary post to `#finance-approvals`: "Auto-reversed N prior-period accruals at 6am. Total: $X. All confirmations linked in thread."

---

## Auto-reversal process (Day 1, 6am ET)

### Step 1 — Find prior-period auto-reverse entries

Query the audit log for entries posted during the prior period with `auto_reverse: true`. Each entry has:
- Original QBO transaction ID
- `reversal_date` (typically Day 1 of new period)
- Original proposal_id
- Full line items

### Step 2 — For each, check if already reversed

Query QBO for any transaction that:
- Has a PrivateNote containing `reverses_transaction_id:<original-id>`
- Is dated on or after the reversal date

If found: skip (already reversed; idempotency).

If not found: proceed to Step 3.

### Step 3 — Build the reversal payload

Mirror the original entry with debits and credits swapped:

```
Original:                          Reversal:
DR Insurance Expense $2,000   →   DR Prepaid Insurance $2,000
CR Prepaid Insurance $2,000   →   CR Insurance Expense $2,000
```

Reversal entry metadata:
- TxnDate: the reversal_date
- DocNumber: `<original-doc-number>-REV`
- PrivateNote: "Auto-reversal of transaction <original-id>; original proposal: <proposal-id>; reverses_transaction_id=<original-id>; external_id=<fresh-uuid>"

### Step 4 — Post the reversal

Use `post-to-qbo` skill (same idempotency + verification mechanics).

### Step 5 — Update the original posted record

Append a `reversed_by` field to the original entry's posted record:

```yaml
reversal:
  qbo_transaction_id: 102902
  posted_at: 2026-05-01T06:14:22Z
  reversal_type: auto
```

This makes the original/reversal pair traceable from either side.

### Step 6 — Notify

After processing all auto-reversals for the morning, post a single summary to `#finance-approvals`:

> 🔄 **Auto-reversals — 5/1 6am batch.** 12 accruals reversed (total $42,650). All confirmed. No failures. [link to summary]

If any individual reversal failed, the summary lists the failures and the standard failure handling applies for each.

---

## Manual reversal process

### Step 1 — Validate the proposal references a real prior post

The proposal must include `reverses_transaction_id: <id>`. Query the audit log for that ID; the original must exist and be in posted state.

If the original doesn't exist, or has already been reversed, fail the approval validation (this is caught in approval-validation skill, not here, but Reversal Handling double-checks).

### Step 2 — Validate the reversal isn't trying to "undo" something it shouldn't

Some entries shouldn't be reversed via this workflow:
- Posts that are themselves reversals (don't reverse a reversal — propose a new entry)
- Posts older than 90 days (likely needs technical accounting review for prior-period adjustment)
- Posts where the period has subsequently been closed in QBO (closed-period reopens require explicit authorization)

Each of these fails with a specific reason.

### Step 3 — Post the reversal

Same mechanics as auto-reversal posting, but TxnDate is whatever the human approved (typically current period) rather than the original entry's auto-reversal_date.

### Step 4 — Update both sides

The original's record gets a `reversed_by` annotation. The reversal record gets a `reverses` annotation pointing to the original.

### Step 5 — Notify

Reply in the approval thread:

> 🔄 **Reversal posted.** Original transaction 102847 reversed by transaction 103104. Both entries remain on the books; the GL nets to the corrected position. [link]

---

## Failure modes specific to reversals

### Original entry not found in QBO

Could mean: original was deleted manually in QBO (rare; QBO doesn't easily allow it), or the audit log references an ID that never actually posted (data integrity issue).

Halt; alert with full context.

### Auto-reversal would land in a now-closed period

If the close moved forward and the reversal_date is now in a closed period:
- Halt this reversal
- Surface to `#finance-alerts` with the closed-period detail
- Recommend: human reopens the period briefly OR adjusts the reversal date to the next open period (with appropriate technical-accounting rationale)

### Multi-line entry doesn't reverse cleanly

For complex multi-line entries with multiple departments/classes/projects, the reversal must mirror every line. If any line's account is now inactive, halt and surface — the reversal can't be built cleanly.

---

## Anti-patterns to avoid

- **Don't reverse a reversal.** If a reversal was a mistake, propose a new corrective entry that re-establishes the original position.
- **Don't auto-reverse with a TxnDate inside the now-closed prior period.** Reversal_date is Day 1 of new period for a reason.
- **Don't combine multiple reversals into a batch post.** Each reversal is its own QBO API call for the same one-proposal-one-post audit clarity rule.
- **Don't omit the `reverses_transaction_id` link.** The bi-directional traceability is the whole point.
- **Don't post a reversal before the original is fully confirmed.** Sequence: original posts → confirmation written → audit log updated → only then is the original eligible for reversal.
