# Shared Skill: `stack:proposal-format`

The canonical schema for a journal-entry proposal. This is the contract between any **proposing agent** (Controller, Prepay Manager, Bank Recon, crypto-reconciler, Payroll Reviewer, etc.) and the **execution-pack agent** (QBO Poster v0.1; netsuite-poster, xero-poster, etc. in v0.2).

> **If the schema below changes, every proposing agent and every Poster must be updated together.** Drift here breaks idempotency, breaks the approval workflow, and creates audit-trail gaps. This file is the single source of truth — no agent should redefine the schema inline.

---

## When this skill is invoked

By any agent that needs to write a journal-entry proposal to `~/finance-data/pending-approvals/`. The agent imports this skill in its `config.yaml`:

```yaml
stack_skills:
  required:
    - stack:proposal-format
```

Then references the schema by name in its own skill files (rather than restating it). Example:

```markdown
# In agents/prepay-manager/skills/monthly-amortization.md:
### Step 4 — Generate the proposal
Build the proposal following stack:proposal-format. For amortization
entries, auto_reverse is always false.
```

---

## The schema

Every proposal is a markdown file at `~/finance-data/pending-approvals/<proposal-id>.md` with YAML front-matter and a structured body.

### YAML front-matter

```yaml
---
proposal_id: PROP-2026-04-01-0007            # globally unique, format: PROP-YYYY-MM-DD-NNNN
external_id: 7c2a3b1d-9e4f-5a6b-8c7d-1e2f3a4b5c6d  # fresh UUID v4 per proposal — never reused
originating_agent: prepay-manager             # which agent created this
originating_skill: monthly-amortization       # which skill within the agent
created_at: 2026-04-01T09:14:22Z              # ISO 8601 UTC
proposal_type: amortization                   # one of: accrual, amortization, recon-adjustment, reversal, payroll, commission
TxnDate: 2026-04-30                           # the period the entry posts to (ISO date)
DocNumber: JE-PREPAY-2026-04-001              # human-readable doc number for the ERP
total_amount: 2000.00                         # sum of debits (must equal sum of credits)
currency: USD
auto_reverse: false                           # true if this entry should be reversed automatically on Day 1 of next period
reversal_date: null                           # required if auto_reverse: true; null otherwise
reverses_transaction_id: null                 # required for reversal-type proposals; null otherwise
period_locked_check_required: true            # set false only with explicit human authorization
supporting_documents:                         # optional; paths to evidence files
  - "~/finance-data/prepay-schedules/PRP-2026-0019.xlsx"
approver_routing:
  channel: "#finance-approvals"
  required_role: controller                   # who must approve; matches authorized-approvers.yaml roles
  max_amount: 50000                           # if total_amount exceeds, requires higher-authority approver
---
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `proposal_id` | string | Globally unique. Format: `PROP-YYYY-MM-DD-NNNN`. Reused across the proposal's lifecycle (initial proposal → approval → post → reversal). |
| `external_id` | UUID v4 | Fresh per proposal. Used by QBO Poster for idempotency at the ERP layer (stored in `PrivateNote` in v0.1; native external-ID field in v0.2). Never reuse. |
| `originating_agent` | string | Lowercase agent handle (e.g., `controller`, `prepay-manager`, `bank-recon`). |
| `originating_skill` | string | The specific skill within the agent that produced this proposal. |
| `created_at` | ISO 8601 | UTC timestamp at creation. |
| `proposal_type` | enum | One of: `accrual`, `amortization`, `recon-adjustment`, `reversal`, `payroll`, `commission`. New types require coordinated update to approver routing config. |
| `TxnDate` | ISO date | The accounting period the entry posts to. |
| `DocNumber` | string | Human-readable ERP doc number. Convention: `JE-<AGENT>-<YYYY>-<MM>-<NNN>`. |
| `total_amount` | decimal | Sum of debit lines. Must equal sum of credit lines (validated to $0.01 tolerance). |
| `currency` | ISO 4217 | Default USD for v0.1; multi-currency in v0.2. |
| `auto_reverse` | boolean | If `true`, QBO Poster's `reversal-handling` skill schedules the reversal for `reversal_date`. |
| `reversal_date` | ISO date / null | Required when `auto_reverse: true`. Typically Day 1 of the next period. |
| `reverses_transaction_id` | string / null | For `proposal_type: reversal` only. References the original QBO transaction ID being reversed. |
| `period_locked_check_required` | boolean | Almost always `true`. Set `false` only with explicit human authorization to post into a closed period. |
| `approver_routing` | object | `channel`, `required_role`, `max_amount`. Determines which approvers can sign off. |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `supporting_documents` | array of strings | Paths to evidence (contracts, schedules, prior-period exhibits). |
| `notes` | string | Free-form context for the human approver. |
| `tags` | array of strings | For filtering / audit categorization. |

### Body — line items

After the front-matter, the proposal body contains the line items in a structured markdown table:

```markdown
# Proposal — Monthly Amortization PRP-2026-0019 (April)

## Line items

| DR/CR | Account Code | Account Name | Amount (USD) | Department | Class | Project | Description |
|-------|--------------|--------------|--------------|------------|-------|---------|-------------|
| DR | 6210 | Insurance Expense | 2,000.00 | G&A | — | — | April insurance amortization per PRP-2026-0019 |
| CR | 1410 | Prepaid Insurance | 2,000.00 | — | — | — | Reduce prepaid balance |

## Rationale

April amortization of the 12-month D&O policy purchased in January.
Original prepay schedule: PRP-2026-0019.
Monthly amortization: $24K / 12 = $2,000.
Remaining unamortized balance after this entry: $16,000 (8 months left).

## Supporting artifacts

- Original invoice: ~/finance-data/invoices/2026-01/D&O-renewal.pdf
- Amortization schedule: ~/finance-data/prepay-schedules/PRP-2026-0019.xlsx
- Prior month entry: ~/finance-data/posted/2026-03/PROP-2026-03-01-0014-posted.md
```

### Body — additional sections (proposal-type-specific)

Different `proposal_type` values may include extra sections:

- **`accrual`** — must include a `## Reversal plan` section indicating when the actual is expected (so AP Watcher can match it on arrival)
- **`reversal`** — must include a `## Original entry reference` section linking to the original posted record by `proposal_id`
- **`recon-adjustment`** — must include a `## Reconciling-item detail` section showing the source delta (bank-vs-GL, AP-subledger-vs-GL, etc.)
- **`commission`** — must include a `## Quota period reference` section linking to RevOps' commission run

---

## Validation rules

These are the rules QBO Poster's `approval-validation` skill enforces. Every proposing agent should self-validate against these before writing the file:

### Rule 1 — Debits equal credits
Sum of `DR` amounts must equal sum of `CR` amounts to within $0.01.

### Rule 2 — All amounts positive
Amounts are unsigned; the DR/CR column carries the direction. A negative amount is an error.

### Rule 3 — Account codes valid
Every account code referenced must exist and be active in the ERP's chart of accounts. The proposing agent should query the chart of accounts before writing.

### Rule 4 — TxnDate format and reasonableness
ISO date. Within ±90 days of `created_at` (proposals more than 90 days off the current date are likely errors).

### Rule 5 — DocNumber unique
The DocNumber must not have been used for any prior posted entry. Query the ERP recent-transactions before writing.

### Rule 6 — external_id is fresh
The `external_id` must be a new UUID v4, not reused from any prior proposal. Even if the same proposal_id is being re-proposed (after a rejection), the external_id changes.

### Rule 7 — Auto-reverse logic
If `auto_reverse: true`, `reversal_date` must be non-null AND in the future (typically Day 1 of next period). If `auto_reverse: false`, `reversal_date` must be null.

### Rule 8 — Reversal references original
If `proposal_type: reversal`, `reverses_transaction_id` must be non-null AND must match an existing posted entry (not a proposed-but-not-posted entry, and not an already-reversed entry).

### Rule 9 — Total matches lines
The `total_amount` in front-matter must equal the sum of debits in the body.

### Rule 10 — Approver routing valid
The `required_role` must exist in `~/finance-data/poster-config/authorized-approvers.yaml`. The `channel` must be a configured Slack channel.

---

## Content hash mechanics

The proposal file's **content hash** is the integrity anchor for the approval workflow. When the human approves via `/approve <proposal-id>`, the approval handler computes the SHA-256 of the proposal file's content (entire file, including front-matter, exactly as on disk) and writes it into the approval record.

When QBO Poster picks up the approval, its `approval-validation` skill re-computes the hash and compares. If the hash doesn't match, the proposal was edited after approval — halt and require a fresh proposal + re-approval.

**This means: proposing agents must not modify the proposal file after writing it.** If a correction is needed, the workflow is:

1. Mark the original proposal as superseded by writing `~/finance-data/superseded/<proposal-id>-superseded.md` with a `reason:` field
2. Write a new proposal with a fresh `proposal_id`, a fresh `external_id`, and a fresh hash
3. Get a fresh approval

Editing in place silently breaks the integrity check by design.

---

## Anti-patterns

- **Don't reuse `proposal_id` across proposals.** Each `proposal_id` is unique. If a proposal is superseded, the new one gets a new `proposal_id`. (The `external_id` is similarly never reused.)
- **Don't shortcut the validation rules.** All 10 are enforced server-side by QBO Poster. Failing to pre-validate just means the agent gets a noisy alert later instead of catching it before write.
- **Don't write proposals for entries QBO Poster can't post.** If the period is closed, if an account is inactive, if the DocNumber collides — fail fast at proposal time. Don't write a doomed proposal and rely on QBO Poster to reject it.
- **Don't put proposal logic inline in agent skills.** Every agent skill that creates a proposal should reference this file, not restate the schema. Drift here is the bug class this whole shared-skill layer was created to prevent.
- **Don't change the schema in one place.** If a new field is needed (e.g., for multi-entity support in v0.2), update this file and coordinate with every consuming agent.

---

## Migration note for existing agents

As of v0.1, the following agents already write proposals but reference the schema inline in their own skill files:

- `prepay-manager/skills/monthly-amortization.md`
- `prepay-manager/skills/amortization-schedule.md`
- `prepay-manager/skills/prepay-identification.md`
- `bank-recon/skills/period-end-attestation.md`
- `crypto-reconciler/skills/gas-and-fees-tracking.md`
- `controller/skills/accrual-entries.md`

Each should be updated to:
1. Add `stack:proposal-format` to its parent agent's `stack_skills.required` in `config.yaml`
2. Replace inline schema description with a reference: *"Generate the proposal following the schema in stack:proposal-format. For [proposal type], use these specifics: …"*

Prepay Manager has been updated as the demonstration of the pattern. The remaining agents are queued for v0.2 cleanup. (The schema described in this file is the same one those agents already use — the migration is a refactor, not a behavior change.)

---

*Part of the shared skill layer in [The AI Finance Stack](../README.md) · MIT License · Author: Sanjay Raghavan*
