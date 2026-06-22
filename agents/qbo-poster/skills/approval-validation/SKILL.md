# Skill: Approval Validation

Before posting anything to QBO, validate that the approval record is genuine, complete, and refers to the exact proposal content that was approved. If anything is off, halt.

---

## When to invoke

For every approval record picked up from `~/finance-data/approved/`, before any posting attempt.

---

## Inputs

- The approval record YAML file
- The referenced proposal file
- The authorized approvers list from `~/finance-data/poster-config/authorized-approvers.yaml`
- The audit log (to check for prior posts of this proposal_id)

---

## Outputs

A binary result: PASS or FAIL.

On PASS: hand off to the `post-to-qbo` skill.

On FAIL: write a failure record to `~/finance-data/failed/<proposal-id>.md` with the specific reason; post alert to `#finance-alerts`; remove the approval from the polling queue.

---

## Validation checks

Every check must pass. ANY failure → overall FAIL.

### Check 1 — Approval record exists and is well-formed

The approval YAML must include all required fields:
- `proposal_id` (non-empty string)
- `proposal_path` (file must exist)
- `proposal_content_hash` (sha256:... format)
- `approved_by` (non-empty string)
- `approved_by_user_id` (Slack user ID format: starts with U)
- `approved_at` (ISO 8601 timestamp)
- `approved_via` (one of: slack / web / cli)
- `approval_method` (one of: explicit_approve_command / batch_approve / one_click)
- `slack_message_ref` (URL format, if `approved_via: slack`)

Missing or malformed fields → FAIL with specific reason.

### Check 2 — Approver is authorized

Load the authorized-approvers list. The `approved_by_user_id` must be in this list AND active.

Each approver has limits:
- `max_per_entry` — maximum total $ amount for a single proposal they can approve
- `max_per_day` — daily cumulative limit
- `allowed_proposal_types` — e.g., `[accrual, amortization, recon-adjustment]`

If the proposal exceeds the approver's `max_per_entry`, FAIL.
If today's cumulative posted-from-this-approver exceeds `max_per_day`, FAIL.
If the proposal type isn't in the approver's allowed list, FAIL.

### Check 3 — Proposal file exists and is unmodified

Compute the sha256 hash of the proposal file's content. Compare to `proposal_content_hash` in the approval record.

If hashes don't match → FAIL with "proposal modified after approval." The originating agent or human must re-propose; the human must re-approve.

### Check 4 — Proposal hasn't already been posted

Search the audit log for entries with this `proposal_id`. If any prior entry shows a successful post, FAIL with "proposal already posted on <date>; QBO transaction ID <id>; this duplicate approval would result in double-posting."

This is the primary idempotency check at the approval-validation level. (The `post-to-qbo` skill has a secondary idempotency check against QBO itself.)

### Check 5 — Proposal structural validation

The proposal markdown must contain a parseable JE structure:
- Each line item has DR or CR, account code, amount, optional dept/class/project
- Debits equal credits (within $0.01 rounding tolerance)
- All amounts are positive (the DR/CR direction handles sign)
- TxnDate is present and in ISO format
- DocNumber is unique (not previously used)
- PrivateNote includes the external_id (for idempotency at the QBO level)

Failures here → FAIL with specific structural reason.

### Check 6 — Account references are resolvable

For each line item's account code, query the QBO chart of accounts (via the `quickbooks` MCP).
- Account must exist
- Account must be active (not deactivated)
- Account type must be valid for the DR/CR direction (e.g., expense accounts only DR, revenue accounts only CR — with documented exceptions)

If any account check fails → FAIL with specific account issue.

### Check 7 — Period not closed in QBO

Query QBO's "Closing Date" setting via the MCP. If the proposal's TxnDate is on or before the closing date → FAIL with "period closed in QBO; explicit period-reopen required before this entry can post."

### Check 8 — Approval is recent

The approval timestamp must be within the configured staleness window (default: 7 days). Older approvals → FAIL with "approval stale; require fresh approval."

Stale approvals are a quiet risk vector — a proposal approved 3 weeks ago but never posted may no longer be appropriate (period may have closed, account may have been deactivated, the business context may have shifted).

---

## Output format

On PASS, write a validation receipt to `~/finance-data/posted/<proposal-id>-validated.md`:

```markdown
# Approval Validation — PASS
- Proposal: PROP-2026-04-01-0007
- Approver: Sanjay Raghavan (U1234567)
- All 8 checks passed
- Validated at: 2026-04-01T11:25:33Z
- Proceeding to post-to-qbo
```

On FAIL, write to `~/finance-data/failed/<proposal-id>-validation.md`:

```markdown
# Approval Validation — FAIL

## Reason
Check 3 failed: proposal modified after approval.
- Approval content hash: sha256:abc123...
- Current content hash: sha256:def456...
- Difference indicates proposal was edited after approval timestamp.

## Required action
Originating agent re-proposes (creating a new proposal_id). Human re-approves the new proposal. This approval record is invalidated and removed from the queue.

## Audit detail
Approval timestamp: 2026-04-01T11:23:18Z
Proposal last modified: 2026-04-01T11:24:01Z
Validation timestamp: 2026-04-01T11:25:33Z
```

Then post to `#finance-alerts`:

> 🚫 **Approval validation failed for PROP-2026-04-01-0007.** Reason: proposal modified after approval. New proposal + re-approval required. [link to failure detail]

---

## Anti-patterns to avoid

- **Don't bypass any check.** Every check exists because of a specific failure mode it prevents.
- **Don't auto-recover from a failed check.** The human resolves; the agent doesn't.
- **Don't loosen the hash comparison.** Byte-level integrity is the contract — even a whitespace change to the proposal is a different proposal.
- **Don't accept "the human will fix it later" as a reason to keep an approval in the queue.** Failed approvals are removed from the queue; they require explicit re-approval.
- **Don't log approval details containing sensitive content in clear text.** Log the hash and metadata; the full proposal content is on disk and accessed by authorized users only.
