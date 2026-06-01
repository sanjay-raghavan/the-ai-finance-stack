# Shared Skills — The Foundational Capability Layer

Skills are the **atomic unit of reasoning** in The AI Finance Stack. Each skill is a markdown file that captures one capability completely — when to invoke it, what it consumes, what it produces, how to handle the edge cases. Agents are orchestrators; skills are the work.

This folder holds the **shared skills** — capabilities that more than one agent needs and that should have a single canonical definition rather than drifting across agent-private duplicates.

For the rationale and the full integration pattern (agent-private skills vs shared skills vs human-invoked skills), see [ARCHITECTURE.md](../ARCHITECTURE.md#the-skill-layer).

---

## Two scopes, one referencing convention

Every agent in the Stack can declare two kinds of skills in its `config.yaml`:

```yaml
# Skills owned by this agent — live in agents/<name>/skills/<skill>.md
skills:
  - close-calendar          # agent-private; tightly coupled to Controller's identity
  - accrual-entries
  - reconciliations

# Skills imported from the shared layer — live in skills/<skill>.md (this folder)
stack_skills:
  required:
    - stack:proposal-format
    - stack:audit-log-entry
  optional:
    - stack:variance-narrative
```

The `stack:` prefix is the import convention. It distinguishes shared Stack skills from:
- **`finance:` skills** — from Anthropic's Finance plugin (`finance:variance-analysis`, `finance:journal-entry`, etc.)
- **Global utility skills** — like `sop-pdf`, `sop-pptx` from Anthropic's office-suite plugin
- **Agent-private skills** — bare names referencing the agent's own `skills/` subdirectory

---

## What belongs here (and what doesn't)

A skill belongs in `skills/` when it meets **all three** tests:

1. **More than one agent invokes it** — actual or imminent. Not theoretical "someone might use this someday."
2. **The contract is the value** — the skill's job is to enforce a consistent format, schema, or methodology that loses meaning if every caller redefines it.
3. **The reasoning is generic** — the skill doesn't depend on a specific agent's identity, schedule, or surrounding workflow to make sense.

A skill should **stay agent-private** when:

- It depends on the agent's specific operating tempo (Controller's `close-calendar` is bound to month-end timing)
- The algorithm is specific to one workflow (Bank Recon's `transaction-matching` only makes sense in its agent)
- The skill is QBO Poster's `approval-validation`, `post-to-qbo`, or `reversal-handling` — these are execution mechanics that are intentionally narrow to one agent for security

**Rule of thumb:** if you find yourself describing the same schema, format, or methodology in two agents' skill files, hoist it.

---

## v0.1 catalog

| Skill | What it standardizes | Used by | Priority |
|---|---|---|---|
| [`proposal-format`](./proposal-format.md) | YAML schema for a JE proposal (proposal_id, external_id, content_hash, line items, auto_reverse, reverses_transaction_id) | Controller, Prepay Manager, Bank Recon, crypto-reconciler, Payroll Reviewer — all agents that propose JEs; consumed by QBO Poster | 🔴 Critical — the propose→approve→post contract depends on it. **Shipped v0.1.** |
| `approval-record-format` | YAML schema for an approval record (approved_by, content_hash, approval_method, slack_message_ref) | QBO Poster reads; future approval handler writes | 🔴 Critical | 🔵 v0.2 |
| `slack-conventions` | Channel routing (alerts vs ops vs approvals), severity emojis, link format, mention rules | Every agent that posts to Slack | 🟠 High | 🔵 v0.2 |
| `audit-log-entry` | JSONL schema for the audit log every agent writes | Every agent that performs material actions | 🟠 High | 🔵 v0.2 |
| `variance-narrative` | Template for 1-3 sentence driver-aware variance commentary | FP&A, IR, Treasury, Controller | 🟡 Medium | 🔵 v0.2 |
| `driver-decomposition` | Math + format for Volume × Rate × Mix (revenue) and Headcount × Cost-per-Head (OpEx) | FP&A, IR, Treasury | 🟡 Medium | 🔵 v0.2 |
| `kpi-snapshot` | Canonical KPI set + extraction format (revenue growth, gross margin, burn, runway, NRR, CAC, take rate) | FP&A, IR, Treasury | 🟡 Medium | 🔵 v0.2 |
| `close-packet-format` | The structure of Controller's close-packet artifact | Controller produces; FP&A + IR consume | 🟡 Medium | 🔵 v0.2 |
| `budget-checker` | Query a budget XLSX for vendors, GL codes, employees, categories | Available to humans + any agent that needs to validate against budget | 🟢 Useful | 🔵 v0.2 |

---

## How a shared skill is invoked

When an agent like Prepay Manager needs to write a JE proposal, its config declares the import:

```yaml
# agents/prepay-manager/config.yaml
stack_skills:
  required:
    - stack:proposal-format
```

The agent's skill file then references the schema by name rather than redefining it:

```markdown
# In agents/prepay-manager/skills/monthly-amortization.md:

### Step 4 — Generate the proposal

Build the proposal record following the canonical schema in
`stack:proposal-format`. Required fields for amortization proposals:

- originating_agent: prepay-manager
- originating_skill: monthly-amortization
- auto_reverse: false  # amortization entries don't auto-reverse
- ...
```

This means:

1. **One place to update the schema** — when QBO's external-ID handling matures in v0.2 and we want to use a native field rather than `PrivateNote`, the change happens in `skills/proposal-format.md` once, not in 8 places.

2. **Cross-agent consistency** — every proposing agent emits proposals in the same shape, so QBO Poster's validator can parse them uniformly.

3. **Auditability** — when an external reviewer asks "what is a proposal," there's one document to point at.

---

## Contributing a shared skill

When you find yourself describing the same thing in two agents' skill files:

1. Check this README to see if a shared skill already exists. If yes, point both agents at it.
2. If no, draft a new shared skill in `skills/<name>.md` following the format of [`proposal-format.md`](./proposal-format.md).
3. Update both (or all) agents' configs to declare `stack_skills.required: stack:<your-skill>`.
4. Update the agents' skill files to reference the shared skill rather than restating it inline.
5. Add a row to the catalog table above.
6. Open a PR.

---

*Part of [The AI Finance Stack](../README.md) · MIT License · Author: Sanjay Raghavan*
