# Agent Contract — How Agents Use the Customization Layer

If you're authoring an agent for The AI Finance Stack, your agent **must** follow this contract. The customization layer only works if every agent honors it.

## The four rules

### 1. Read customization/ before acting

The first thing your agent does on any task is load:

- `customization/org.yaml`
- `customization/reference/chart-of-accounts.xlsx` (or the relevant subset)
- Anything else in `customization/reference/` that's relevant to the task

If `customization/` doesn't exist, fall back to `customization-stub/` and warn the user that the stack is in generic mode.

### 2. Map natural language to the reference layer first, *then* call MCPs

Wrong:
```
User: "What did we spend on legal in May?"
Agent: [calls QBO with a guess like "search for accounts containing 'legal'"]
```

Right:
```
User: "What did we spend on legal in May?"
Agent: [opens chart-of-accounts.xlsx]
       [filters Category Tag = "Legal"]
       [gets exact account numbers: 7210, 7211, 7212, 7213, 7214]
       [calls QBO with those specific accounts]
```

This is the single biggest source of token waste and inconsistency. Always resolve to accounts/vendors/customers/periods *first*.

### 3. Never write to customization/ without explicit human approval

The customization layer is the source of truth for the org. Agents can *propose* changes (e.g., "I noticed account 8721 has no Category Tag — should I tag it `R&D`?") but never apply them silently.

The `update-reference` skill is the only legitimate path to modify these files, and it always presents a diff for human approval before writing.

### 4. Surface gaps; don't paper over them

If your agent encounters an account, vendor, or customer not in the reference layer, it must:

1. Flag the gap explicitly in its output ("⚠️ Account 8721 not in chart-of-accounts.xlsx — using fallback bucket `REVIEW`")
2. Add a row to a `gaps.md` file in the output directory listing what needs to be added
3. Not silently guess what bucket the item belongs to

The user will fix the gaps periodically. Your job is to make them visible.

---

## What your agent's CLAUDE.md should include

A `## Customization layer` section near the top, like this:

```markdown
## Customization layer

Before doing anything, read:

1. `~/the-ai-finance-stack/customization/org.yaml` — entity defaults, fiscal year
2. `~/the-ai-finance-stack/customization/reference/chart-of-accounts.xlsx` — tagged CoA
3. `~/the-ai-finance-stack/customization/reference/non-gaap-rules.yaml` — if doing P&L work
4. `~/the-ai-finance-stack/customization/reference/closed-periods.md` — to decide live-vs-archive

If `customization/` doesn't exist:
- Warn the user the stack is in generic mode
- Fall back to `customization-stub/` for shape
- Suggest running the `setup-org` skill
```

## What your agent's config.yaml should include

A `customization` block listing which reference files this agent depends on:

```yaml
customization:
  required:
    - org.yaml
    - reference/chart-of-accounts.xlsx
  optional:
    - reference/vendor-map.xlsx
    - reference/non-gaap-rules.yaml
    - reference/exec-categories.yaml
```

The runtime uses this to warn the user at install time if their `customization/` is missing something the agent needs.
