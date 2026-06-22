# Skill: Post to QBO

Take a validated, approved JE and commit it to QuickBooks Online via the `quickbooks` MCP. Verify the post landed. Write the confirmation. Surface any failure immediately.

---

## When to invoke

After `approval-validation` returns PASS. Never directly.

---

## Inputs

- The validated approval record (already passed all 8 checks in approval-validation)
- The proposal file
- The QBO MCP connection (must be live)

---

## Outputs

On success: a confirmation record at `~/finance-data/posted/<year>-<month>/<proposal-id>-posted.md`, a Slack reply in the originating thread, an audit log entry.

On failure: a failure record at `~/finance-data/failed/<year>-<month>/<proposal-id>-post-failed.md`, a `#finance-alerts` post, no QBO change (or rollback if QBO supports it for the specific failure mode).

---

## Process

### Step 1 — Pre-flight: idempotency check at QBO

Query QBO for any transaction with `PrivateNote` containing the proposal's `external_id`. (In v0.1 the external_id is stored in PrivateNote; in v0.2 when QBO MCP exposes external-ID natively, this becomes a direct check.)

- **If a transaction exists**: do NOT post. Retrieve the existing transaction ID. Write the confirmation referencing the existing transaction with a note: "Recovered from prior partial run; original post was successful, confirmation file was missing." This handles the crash-between-post-and-confirmation case.
- **If no transaction exists**: proceed to Step 2.

### Step 2 — Build the QBO JE payload

From the proposal markdown, build the structured QBO Journal Entry:

```json
{
  "TxnDate": "2026-04-30",
  "DocNumber": "JE-CONTROLLER-2026-04-001",
  "PrivateNote": "external_id=<uuid>; proposal_id=PROP-2026-04-01-0007; approved_by=Sanjay Raghavan",
  "Line": [
    {
      "Description": "April insurance expense per PRP-2026-0019 amortization",
      "Amount": 2000.00,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "PostingType": "Debit",
        "AccountRef": { "value": "6210", "name": "Insurance Expense" },
        "DepartmentRef": { "value": "001", "name": "G&A" }
      }
    },
    {
      "Description": "April insurance expense per PRP-2026-0019 amortization",
      "Amount": 2000.00,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "PostingType": "Credit",
        "AccountRef": { "value": "1410", "name": "Prepaid Insurance" }
      }
    }
  ]
}
```

Validate one more time: debits = credits (sanity check after building the payload).

### Step 3 — Call the QBO MCP

Submit the JE via the `quickbooks` MCP. The MCP returns either:
- Success: transaction ID + full Echo'd JE
- Error: HTTP error code + QBO error message

### Step 4 — On success: verify the post landed

Wait briefly (default 2 seconds for QBO indexing), then query QBO for a transaction with this external_id. The transaction must exist with the same line items and amounts as posted.

If verification succeeds: proceed to Step 5.

If verification fails (transaction doesn't appear within 30 seconds): treat as a silent failure. Surface to `#finance-alerts` as a critical alert; do NOT write the confirmation; the human must investigate.

### Step 5 — Write the confirmation record

Save to `~/finance-data/posted/<year>-<month>/<proposal-id>-posted.md`:

```markdown
# Posted — PROP-2026-04-01-0007
*Confirmed by QBO Poster v0.1 · 2026-04-01T11:26:42Z*

## QBO Transaction
- Transaction ID: 102847
- TxnDate: 2026-04-30
- DocNumber: JE-CONTROLLER-2026-04-001
- Total: $2,000.00 (1 DR, 1 CR)

## Provenance Chain
- Approved by: Sanjay Raghavan (U1234567)
- Approval timestamp: 2026-04-01T11:23:18Z
- Approval Slack message: <link>
- Originating agent: controller
- Originating skill: accrual-entries (called by prepay-manager monthly-amortization)

## Verification
- Pre-post idempotency check: passed (no prior transaction with this external_id)
- Post API call: success at 2026-04-01T11:26:34Z
- Post-verification query: passed at 2026-04-01T11:26:36Z
- Confirmation written: 2026-04-01T11:26:42Z
- Elapsed total: 8.4 seconds from approval-validation pass

## Reversal
- Auto-reverse: true
- Reversal date: 2026-05-01
- Reversal posting will be triggered by `reversal-handling` skill on 2026-05-01

## Audit Trail
2026-04-01T11:26:34Z · MCPs: quickbooks (post + verify) · skills: post-to-qbo · attempt: 1 (success)
```

### Step 6 — Reply in the originating Slack thread

Post in `#finance-approvals` thread (the thread where the original approval happened):

> ✅ **Posted to QBO.** Transaction ID **102847**. Total $2,000. Auto-reverse 5/1. Confirmation: <link>

### Step 7 — Update the audit log

Append a JSONL entry to `~/finance-data/audit/qbo-poster-audit-log.jsonl`:

```json
{"event":"posted","timestamp":"2026-04-01T11:26:42Z","proposal_id":"PROP-2026-04-01-0007","external_id":"<uuid>","qbo_transaction_id":"102847","approver":"U1234567","amount":2000.00,"elapsed_ms":8420}
```

### Step 8 — Remove from approved queue

Move the approval record from `~/finance-data/approved/` to `~/finance-data/posted/<year>-<month>/`. This prevents the polling loop from re-attempting the same approval.

---

## Failure handling

### QBO API returns 4xx (client error)

Examples: validation rejection from QBO, account doesn't exist (slipped past pre-validation due to a race condition), period closed.

- Do NOT retry
- Write failure record at `~/finance-data/failed/<year>-<month>/<proposal-id>-post-failed.md` with the QBO error message
- Surface to `#finance-alerts`
- Reply in originating Slack thread with: "❌ Post failed. Reason: <QBO error>. Approval remains; human resolves."
- Move approval to `~/finance-data/failed/` (still in failed/, not back to approved/) — human decides next step

### QBO API returns 5xx (server error)

Examples: QBO is down, rate-limited, timeout.

- Wait 5 minutes (default `api_retry_delay_seconds`)
- Retry once
- If still failing: write failure record, surface to `#finance-alerts`, halt further posting until the human triggers a resume

### Post API call succeeds but verification fails

- Treat as SILENT FAILURE
- Surface to `#finance-alerts` with critical severity
- Do NOT write a confirmation
- Halt all further posting until investigated — silent failures indicate something deeper is wrong with the QBO MCP

### Verification times out (30s)

- Same as silent failure
- Halt; alert

---

## Critical anti-patterns

These are the absolute don'ts that distinguish a trustworthy execution layer from an unsafe one.

- **Don't retry blind on 4xx errors.** 4xx means QBO rejected the request for a reason. Retrying without fixing the reason just generates more failures.
- **Don't write a confirmation without verification.** If the post-verification check fails or times out, you don't know what happened. Surface, don't confirm.
- **Don't move on to the next approval if the current one failed.** Halt — silent failures cascade. Let the human investigate before continuing.
- **Don't batch multiple JEs into a single QBO API call** even if QBO supports it. One proposal = one API call = one confirmation = one audit log entry. The slightly higher API cost is worth the trivially clear audit trail.
- **Don't reuse external IDs.** Every proposal gets a fresh UUID. Reuse breaks idempotency.
- **Don't suppress alerts to avoid noise in #finance-alerts.** Every failure is signal. Tune which conditions are alerts vs. summaries via config, not by suppressing in code.
