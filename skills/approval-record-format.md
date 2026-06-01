# Shared Skill: `stack:approval-record-format`

The canonical YAML schema for an **approval record** — the file the approval handler writes when a human approves a proposal in Slack, and that an execution-pack agent (QBO Poster v0.1; netsuite-poster, xero-poster, etc. in v0.2) reads as the trigger to post.

This skill is the companion to [`stack:proposal-format`](./proposal-format.md). The two together define the propose→approve→post contract:

```
Proposing agent writes proposal  →  stack:proposal-format
Human types /approve in Slack    →  approval handler writes record  →  stack:approval-record-format
Poster reads record + proposal   →  validates  →  posts to ERP
```

> **If the schema below changes, the approval handler and every Poster must be updated together.** Drift here breaks the authorization workflow. This file is the single source of truth — no agent should redefine the schema inline.

---

## When this skill is invoked

By two consumers:

1. **The approval handler** (a lightweight Slack-bot script, not an agent itself) — when a human posts `/approve <proposal-id>` in `#finance-approvals`, the handler writes an approval record following this schema.

2. **Any execution-pack agent** — QBO Poster (and future netsuite-poster, xero-poster, etc.) — reads the approval record before posting. The agent declares this skill in its `config.yaml`:

```yaml
stack_skills:
  required:
    - stack:proposal-format          # the proposal being approved
    - stack:approval-record-format   # the approval that authorizes the post
```

Then references it from its own skill files (e.g., `approval-validation.md`) rather than restating the schema.

---

## The schema

Every approval record is a YAML file at `~/finance-data/approved/<proposal-id>-approval.yaml`:

```yaml
# Required identification
proposal_id: PROP-2026-04-01-0007              # matches the proposal being approved
proposal_path: "~/finance-data/approved/PROP-2026-04-01-0007.md"
proposal_content_hash: "sha256:abc123def456..."  # SHA-256 of proposal file content at approval time

# Required provenance — who, when, how
approved_by: "Sanjay Raghavan"                  # human-readable approver name
approved_by_user_id: "U1234567"                 # Slack user ID — used by Poster for auth verification
approved_at: "2026-04-01T11:23:18Z"             # ISO 8601 UTC
approved_via: "slack"                            # slack | web | cli
approval_method: "explicit_approve_command"     # explicit_approve_command | batch_approve | one_click
slack_message_ref: "https://strand.slack.com/archives/C0123/p1234567890"

# Required reference to the originating context
originating_agent: prepay-manager                # which agent created the proposal
originating_skill: monthly-amortization          # which skill within the agent

# Optional approver context
notes: ""                                        # free-form approver comment
batch_id: null                                   # set if this approval was part of a batch-approve action

# Required handler metadata
handler_version: "0.1.0"                         # approval handler version that wrote this record
written_at: "2026-04-01T11:23:19Z"               # ISO 8601 — when the handler wrote the file
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `proposal_id` | string | Must match the `proposal_id` in the proposal file being approved. Validated by the Poster. |
| `proposal_path` | string | Filesystem path to the proposal file. Must resolve to an existing file. |
| `proposal_content_hash` | string | SHA-256 hash of the proposal file's entire content at approval time. Format: `sha256:<64-char-hex>`. **The integrity anchor.** |
| `approved_by` | string | Human-readable name of the approver. Used in confirmation messages, audit trails. |
| `approved_by_user_id` | string | Slack user ID format (e.g., `U1234567`). Used for server-side authorization check against `authorized-approvers.yaml`. |
| `approved_at` | ISO 8601 | UTC timestamp of the approval action. |
| `approved_via` | enum | `slack` (default), `web` (future), `cli` (future). |
| `approval_method` | enum | `explicit_approve_command` (typed `/approve` for one proposal), `batch_approve` (approved a batch with one command), `one_click` (UI button — future). |
| `slack_message_ref` | string | URL to the Slack message that constitutes the approval. Auditors can click through to verify. |
| `originating_agent` | string | Matches the proposal's `originating_agent`. Used by Posters to route the confirmation reply correctly. |
| `originating_skill` | string | Matches the proposal's `originating_skill`. Used for audit reasoning chain. |
| `handler_version` | string | Semver of the approval handler script that wrote this record. Future-proofs against schema migrations. |
| `written_at` | ISO 8601 | Timestamp of file write. Typically ~1 second after `approved_at`. |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `notes` | string | Free-form approver comment (e.g., "Approved with the understanding that the AWS true-up reconciles next month."). |
| `batch_id` | string / null | If this approval came from a batch action covering multiple proposals, the batch ID groups them in the audit log. |

---

## Authorization mechanics

The `approved_by_user_id` field is the authorization anchor. When the Poster reads an approval, it validates against `~/finance-data/poster-config/authorized-approvers.yaml`:

```yaml
approvers:
  - name: "Sanjay Raghavan"
    user_id: "U1234567"
    role: "Controller"
    active: true
    max_per_entry: 50000
    max_per_day: 200000
    allowed_proposal_types: [accrual, amortization, recon-adjustment, reversal]
```

The Poster checks:
1. **User exists and is active** in the approvers file
2. **Proposal amount within `max_per_entry`** for this approver
3. **YTD-from-this-approver-today within `max_per_day`**
4. **Proposal type in `allowed_proposal_types`**

Any failure → halt and surface to `#finance-alerts`.

This is why the approver's Slack user ID matters more than the human-readable name: the Slack ID is the authentication primitive that can't be spoofed by editing a name field.

---

## Content hash mechanics

The `proposal_content_hash` is the integrity anchor between approval and posting. The flow:

1. **At approval time:** Handler computes `sha256(<proposal-file-content>)` and writes it to the approval record.
2. **At validation time:** Poster re-reads the proposal file and re-computes the hash.
3. **If hashes match:** Proceed to post.
4. **If hashes don't match:** Halt. The proposal was edited after approval — require fresh proposal + fresh approval. This catches both accidental edits and tampering.

The hash covers the **entire file content** (front-matter + body, including whitespace and trailing newlines, exactly as on disk). No normalization, no canonicalization — byte-level integrity.

Proposing agents must therefore **never edit the proposal file after writing it**. If a correction is needed, the workflow is the supersede pattern documented in `stack:proposal-format` (write a superseded marker, new proposal_id, new external_id, new hash, fresh approval).

---

## Validation rules

These are enforced by the Poster's `approval-validation` skill. The approval handler should pre-validate against rules 1-3 before writing the file.

### Rule 1 — All required fields present and well-formed
Missing or empty required fields → reject the approval record at the handler before writing.

### Rule 2 — Slack user ID format
`approved_by_user_id` must match the pattern `U[A-Z0-9]+` (Slack workspace user ID format).

### Rule 3 — Timestamp format and recency
`approved_at` must be valid ISO 8601 UTC, and within the past 24 hours when the handler writes the record. Older approvals indicate a clock issue or replay attack.

### Rule 4 — Proposal hash exists and is well-formed
`proposal_content_hash` must be `sha256:<64-char-hex>` format.

### Rule 5 — Approver exists in authorized list
`approved_by_user_id` must appear in `authorized-approvers.yaml` with `active: true`.

### Rule 6 — Approver limits not exceeded
- Proposal total ≤ approver's `max_per_entry`
- Approver's today-cumulative + this proposal ≤ `max_per_day`
- Proposal type ∈ approver's `allowed_proposal_types`

### Rule 7 — Approval not stale
`approved_at` within the configured staleness window (default: 7 days). Older approvals are auto-invalidated and require fresh approval — context may have changed (period closed, accounts deactivated, business conditions shifted).

### Rule 8 — Slack message ref is fetchable
For Slack-sourced approvals, the `slack_message_ref` URL should resolve to an actual Slack message. (In v0.1 this is a soft check via the slack MCP; in v0.2 it could become a hard verification that the message exists and was sent by `approved_by_user_id`.)

---

## Anti-patterns

- **Don't write approval records from the agent.** The approval handler is a separate, narrowly-scoped Slack-bot script. Agents read approval records; they don't write them. (If an agent could write approval records, the agent could self-authorize — defeating the entire human-in-the-loop design.)
- **Don't store the proposal content inside the approval record.** Reference it by path + hash. Embedding content creates two sources of truth that can diverge.
- **Don't reuse approval records across attempts.** If a Poster fails to post and the human re-approves later, that's a fresh approval record with a fresh `approved_at` and (typically) a fresh `slack_message_ref`. Don't re-use the old record.
- **Don't suppress the hash check.** The byte-level integrity check is the foundation of the propose→approve→post contract. Loosening it for any reason (whitespace normalization, "but it's just a comment change") breaks the contract.
- **Don't trust `approved_by` (the name).** Always validate `approved_by_user_id`. Names can be edited; Slack user IDs are workspace-immutable.
- **Don't accept approvals via DM to the bot.** Approvals must happen in the configured `#finance-approvals` channel where they're visible to other authorized approvers — this is what makes "I approved this" auditable.

---

## Future evolution

In v0.2, several extensions are likely:

- **Multi-approver workflows** — proposals over a threshold require two approvers. The schema would extend with `co_approvers: [{user_id, approved_at, slack_message_ref}, ...]`.
- **Time-locked approvals** — for high-amount proposals, a delay between approval and post (e.g., 4 hours). Field: `earliest_post_at: <ISO 8601>`.
- **One-click web UI** — for users who don't live in Slack. Adds `approved_via: web` and a `web_session_token` field.
- **External-ID native support** — when QBO MCP exposes the external-ID field directly (currently in `PrivateNote`), the schema simplifies.

Each of these extends the schema additively; existing fields remain backward-compatible.

---

## Migration note for QBO Poster

As of v0.1, QBO Poster's `approval-validation` skill describes the approval record schema inline. After this skill ships, that skill file should reference `stack:approval-record-format` rather than restating the schema. The migration is a refactor — same schema, just consolidated.

---

*Part of the shared skill layer in [The AI Finance Stack](../README.md) · MIT License · Author: Sanjay Raghavan*
