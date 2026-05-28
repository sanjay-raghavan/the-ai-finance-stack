# QBO Poster

> The execution layer. The only agent in The AI Finance Stack permitted to write to the QuickBooks Online general ledger. Reads approval records, validates integrity, posts to QBO, writes confirmations.

**Pack:** Execution (only agent in this pack for v0.1)
**Status:** v0.1 — reference implementation
**MCPs required:** `quickbooks`, `slack`
**Toolkit:** Read, Write, Glob, Grep, Bash

---

## What this agent does

Every other agent in the Stack is read-only on the general ledger. They produce **proposals** — JE drafts, accrual entries, amortization schedules, recon adjustments, payroll JEs. QBO Poster sits at the end of that chain and is the only agent permitted to commit those proposals to the books.

The agent enforces one contract: **no posting without an explicit human approval record**. The originating agent proposes. A human approves via Slack. QBO Poster validates and posts. Then it verifies the post landed and writes a confirmation that closes the loop.

This is the most controlled agent in the Stack. Temperature is 0.0. Posting requires eight validation checks. Idempotency is enforced at two layers (proposal-content-hash and QBO external-ID). Every API call is logged for seven years.

---

## The propose → approve → post workflow

```
Originating agent (e.g., Controller)
   ↓ drafts JE
~/finance-data/pending-approvals/<proposal-id>.md
   ↓ posts approval request
#finance-approvals: "📋 JE proposed by Controller: April accrual run (12 entries, $42,650). Approve all / review each: /approve PROP-2026-04-01-0007"

Human
   ↓ reviews proposal, replies /approve PROP-2026-04-01-0007

Approval handler (Slack bot)
   ↓ writes approval record with content hash
~/finance-data/approved/PROP-2026-04-01-0007-approval.yaml

QBO Poster (polls every minute, business hours)
   ↓ approval-validation skill (8 checks)
   ↓ post-to-qbo skill (idempotency + post + verify)
~/finance-data/posted/2026-04/PROP-2026-04-01-0007-posted.md
   ↓ replies in originating Slack thread
#finance-approvals: "✅ Posted to QBO. Transaction ID 102847. Auto-reverse 5/1."
```

If any step fails — bad approval record, mismatched content hash, QBO API error, account inactive, period closed, idempotency violation — the agent halts that one posting and escalates to `#finance-alerts`. It never partially posts. It never silently fixes. It never posts twice.

---

## Skills

| Skill | What it does |
|---|---|
| [`approval-validation`](skills/approval-validation.md) | Runs 8 checks on every approval record before posting: well-formed YAML, authorized approver within limits, content hash matches proposal, not previously posted, structural JE validity, accounts active in QBO, period not closed, approval not stale. Binary PASS/FAIL. |
| [`post-to-qbo`](skills/post-to-qbo.md) | Pre-flight idempotency check at QBO, payload build, API call via `quickbooks` MCP, post-verification re-query, confirmation file write, Slack reply, audit log entry. Halts on silent failures. |
| [`reversal-handling`](skills/reversal-handling.md) | Auto-reverses prior-period accruals on Day 1 at 6am ET (before other agents' morning work). Handles human-initiated reversals of posted entries. Maintains bidirectional links between original and reversal. |

---

## Hard rules (non-negotiable)

These are not soft guidelines. Violations get the agent suspended pending investigation.

- **Never post without an explicit approval record.** No "obvious" approvals, no "the human said it was fine in chat," no batch-approval shortcuts that bypass the per-entry approval check.
- **Never modify a proposal.** If a proposal needs fixing: human rejects → originating agent proposes new version → human approves new version → Poster posts the new version. The Poster does not edit.
- **Never combine multiple approvals into a single batch post.** Each approved entry is posted individually. One proposal = one API call = one confirmation = one audit log entry.
- **Never silently retry a failed post.** Surface and stop. The human decides retry, fix, or cancel.
- **Never post an entry whose period is closed in QBO.** Closed-period entries require explicit period-reopen authorization — the human's call.
- **Never edit, void, or delete a posted entry in QBO.** Once a confirmation is written, the posting is immutable from the Poster's perspective. Corrections come as new entries.
- **Never assume a 200 OK means the post landed.** Always re-query QBO to verify the transaction ID exists before writing the confirmation.

---

## How approval records work

When the human runs `/approve <proposal-id>` in Slack, the approval handler writes a YAML record like this:

```yaml
proposal_id: PROP-2026-04-01-0007
proposal_path: "~/finance-data/approved/PROP-2026-04-01-0007.md"
originating_agent: controller
originating_skill: accrual-entries
proposal_content_hash: "sha256:abc123..."        # critical — used by Poster for integrity check
approved_by: "Sanjay Raghavan"
approved_by_user_id: "U1234567"                  # Slack user ID for authentication
approved_at: "2026-04-01T11:23:18Z"
approved_via: "slack"
approval_method: "explicit_approve_command"
slack_message_ref: "https://strand.slack.com/archives/C0123/p1234567890"
notes: ""
```

The `proposal_content_hash` is the integrity anchor. Before posting, the Poster re-hashes the proposal file content. If the hash doesn't match the approval record, the proposal changed after approval — the Poster halts and requires a fresh proposal + re-approval.

Authorized approvers and their limits live in `~/finance-data/poster-config/authorized-approvers.yaml`:

```yaml
approvers:
  - name: "Sanjay Raghavan"
    user_id: "U1234567"
    role: "Controller"
    active: true
    max_per_entry: 50000          # USD
    max_per_day: 200000            # USD
    allowed_proposal_types: [accrual, amortization, recon-adjustment, reversal]
  - name: "Janelle Park"
    user_id: "U2345678"
    role: "CFO"
    active: true
    max_per_entry: 1000000
    max_per_day: 5000000
    allowed_proposal_types: [accrual, amortization, recon-adjustment, reversal, payroll, equity]
```

The CFO has higher limits and more proposal types. Anything above an approver's limit fails approval-validation Check 2.

---

## Idempotency: two layers

**Layer 1 — Audit log check.** Before validating an approval, the Poster searches the audit log for any prior post of the same `proposal_id`. If found, halt with "proposal already posted."

**Layer 2 — QBO external-ID check.** Before the actual POST API call, the Poster queries QBO for any transaction containing the proposal's `external_id` (stored in `PrivateNote` in v0.1; QBO's native external-ID field in v0.2). If found, the Poster does NOT post — it retrieves the existing transaction ID and writes the confirmation as a recovery from a prior partial run.

This dual-layer design handles the worst-case failure: the API call succeeded but the confirmation file write failed (crash, network hiccup, file system error). On the next polling pass, Layer 2 catches the already-posted entry and closes the loop without double-posting.

---

## Accrual reversal lifecycle

Accruals are the agent's most common workload. Every accrual carries an `auto_reverse: true` flag and a `reversal_date` (typically Day 1 of the new period).

The lifecycle:

1. **Day 30 (end of April):** Controller proposes April accruals. Human approves. Poster posts. Confirmation written with `auto_reverse: true, reversal_date: 2026-05-01`.
2. **Day 1 of May at 6am ET:** Reversal-handling skill runs *before* any other agent's morning work. It pulls the prior period's `auto_reverse: true` entries from the audit log, mirrors them with debits/credits swapped, posts them as new transactions referencing the originals via `reverses_transaction_id`. Posts a single batch summary to `#finance-approvals`.
3. **When the actual invoice/expense arrives later in May:** AP Watcher (or similar) recognizes it matches a reversed accrual and processes it as a normal posting. The net effect: the original accrual + its reversal cancel out; the actual entry stands on its own. No double-counting.

Human-initiated reversals (mistake corrections, change of approach) use the same `reversal-handling` skill but go through the standard approval workflow rather than the automated Day-1 batch.

---

## What happens when something goes wrong

| Trigger | Action |
|---------|--------|
| Approval record hash doesn't match proposal | Halt; alert `#finance-alerts`; data integrity issue |
| Approver not in authorized list, or limit exceeded | Halt; alert; require approval from a higher-authority approver |
| Proposal references inactive QBO account | Halt; alert; chart-of-accounts hygiene issue |
| Proposal's TxnDate is in a closed period | Halt; alert; require explicit period reopen |
| External ID already exists in QBO | Don't post; retrieve existing transaction ID; write recovery confirmation |
| QBO API returns 4xx | Don't retry; write failure record; alert; move approval to `failed/` |
| QBO API returns 5xx | Wait 5 minutes; retry once; if still failing, alert and halt |
| Posted transaction not found in QBO within 30 seconds | SILENT FAILURE alert; halt all further posts until investigated |
| Any unexpected MCP response | Halt; alert |

`#finance-alerts` is the channel that pages the human. Every condition above is signal — not noise.

---

## Audit trail

Every Poster action is appended to `~/finance-data/audit/qbo-poster-audit-log.jsonl`:

```json
{"event":"posted","timestamp":"2026-04-01T11:26:42Z","proposal_id":"PROP-2026-04-01-0007","external_id":"<uuid>","qbo_transaction_id":"102847","approver":"U1234567","amount":2000.00,"elapsed_ms":8420}
{"event":"validation_failed","timestamp":"2026-04-01T11:32:18Z","proposal_id":"PROP-2026-04-01-0008","reason":"content_hash_mismatch","approver":"U1234567"}
{"event":"auto_reversed","timestamp":"2026-05-01T06:14:22Z","original_transaction_id":"102847","reversal_transaction_id":"102902","amount":2000.00}
```

Append-only. Immutable. Retained for seven years. This is the canonical answer to "how did this JE get into the books?" for any future audit question.

---

## Config highlights

```yaml
schedule:
  continuous:
    approval_polling_business_hours:
      cron: "* 8-18 * * 1-5"                  # every minute during business hours
      timezone: America/New_York
    approval_polling_off_hours:
      cron: "*/5 * * * *"                     # every 5 minutes overnight + weekends

thresholds:
  approval_validation_strict: true             # no leniency on approval record format
  idempotency_check_required: true             # always check QBO before posting
  closed_period_block: true                    # never post into a closed QBO period
  post_verification_required: true             # always re-query QBO after post to verify
  api_retry_max_attempts: 1                    # one retry on 5xx, then halt

model:
  provider: anthropic
  name: claude-opus-4
  temperature: 0.0                             # Zero creativity. Strictly deterministic.
```

See [`config.yaml`](config.yaml) for the full configuration.

---

## Why this agent is architected the way it is

GL writes are a one-way door. A misplaced journal entry has knock-on effects: it skews close numbers, contaminates downstream variance analysis, complicates audit, and in the worst case becomes a restatement.

Every design choice in QBO Poster optimizes for the same property: **boring, predictable, refuses to act when anything is off**.

- **Temperature 0.0** because a creative posting agent is a dangerous posting agent.
- **Eight validation checks** because each one prevents a specific real-world failure mode that has happened to real accountants.
- **Per-entry posting (no batching)** because the slightly higher API cost is worth the trivially clear audit trail.
- **Post-verification re-query** because a 200 OK from any API can hide a silent failure.
- **Two-layer idempotency** because the crash-between-post-and-confirmation case is real and the cost of double-posting is high.
- **Halt-and-alert on anything unexpected** because in a controlled write surface, "I'm not sure" is always more correct than "let me try."

This is the only agent in the Stack where the right answer to "should I retry?" is almost always "no — escalate."

---

## Future companion agents (v0.2+)

QBO Poster is the first execution-layer agent. The same contract — propose → approve → post — will extend to other ERPs:

- **`netsuite-poster`** — Same workflow, NetSuite-specific posting via NetSuite MCP
- **`xero-poster`** — Xero
- **`rillet-poster`** — Rillet
- **`sage-intacct-poster`** — Sage Intacct

Each has identical strict approval/idempotency contracts but ERP-specific posting mechanics. The originating agents (Controller, Prepay Manager, etc.) remain the same — they propose; the appropriate Poster commits.

---

## Files in this agent

```
qbo-poster/
├── README.md              # This file
├── CLAUDE.md              # Agent system prompt + guardrails
├── config.yaml            # Schedules, thresholds, MCPs, model config
└── skills/
    ├── approval-validation.md   # The 8-check validator
    ├── post-to-qbo.md           # The posting workflow
    └── reversal-handling.md     # Auto + manual reversals
```

---

*The AI Finance Stack · MIT License · Author: Sanjay Raghavan*
*Pack: execution (only agent in this category for v0.1)*
