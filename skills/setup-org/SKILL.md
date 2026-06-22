# Skill: setup-org

Walk a new user through populating `customization/` for their organization. About 30 minutes for a first pass. Saves everything to the user's filesystem at `customization/` (relative to repo root).

## When to invoke

- First time a user installs The AI Finance Stack
- User explicitly asks "set up the stack for my company", "customize for our books", "initial setup"
- User invokes `/setup-org`
- An agent detects that `customization/` doesn't exist and the user agrees to set it up

## Pre-requisites

- The user has either Claude Desktop or Claude Code installed
- The user has the-ai-finance-stack repo cloned or downloaded
- The user has an accounting system they can export from (QBO, NetSuite, Xero)

## Process

This is an **interactive** skill. Don't rush. Each step has explicit user approval before writing files.

### Step 0 — Confirm

Tell the user what's about to happen and how long:

> Setup takes ~30 minutes. We'll cover:
> 1. Organization profile (entity names, fiscal year, base currency) — 2 min
> 2. Chart of accounts (upload + tag) — 10 min
> 3. Non-GAAP rules (if you report Non-GAAP) — 5 min
> 4. Templates (board deck, exec update, IR memo) — 5 min
> 5. Voice samples — 5 min
> 6. Verify — 3 min
>
> You can stop at any point — partial customization is fine.

Confirm before proceeding.

### Step 1 — Organization profile (writes `org.yaml`)

Ask, in order:

1. **Organization name** (display name, legal name, short code for filenames)
2. **Entities** — start with one, ask about subsidiaries: name, jurisdiction, functional currency, accounting system (QBO / NetSuite / Xero), realm ID if known
3. **Default entity** — which to query when the user doesn't specify
4. **Fiscal year** — calendar or non-calendar; if non-calendar, what's the start month
5. **Base currency**
6. **Close cadence** — what business day of the next month is close typically done? Current open period?
7. **Reporting cadence** — do you do monthly board decks? Investor updates?
8. **Archive location** — do you save closed-month files to Drive/Box/SharePoint? Where? File naming pattern?

Write `customization/org.yaml` using the template in `customization-stub/org.yaml`.

### Step 2 — Chart of accounts (writes `reference/chart-of-accounts.xlsx`)

1. **Ask the user to export their CoA** from their accounting system. Give system-specific instructions:
   - **QBO:** Reports → Account List → Export to Excel
   - **NetSuite:** Lists → Accounting → Accounts → Export
   - **Xero:** Accounting → Advanced → Chart of Accounts → Export
2. **Wait for upload.** Open the file. Verify it has account number, name, type, detail type at minimum.
3. **Add three columns to the file:**
   - `Category Tag` — granular bucket (Legal, Marketing, Personnel, etc.)
   - `Exec Category` — rolled-up bucket from `exec-categories.yaml` (defaults provided)
   - `Non-GAAP Treatment` — `Include` or `Exclude` (defaults to `Include`)
4. **Tag interactively, in batches:**
   - Start with revenue accounts (usually just a few)
   - Then COGS
   - Then opex by section (Personnel, Prof Services, G&A, Marketing, R&D, Subscriptions, Office, Occupancy)
   - Then below-operating (D&A, Interest, Taxes, Other Income/Expense)
   - For each batch, propose tags based on account name + detail type, ask user to confirm/correct in bulk
   - Don't ask account-by-account — too tedious. Show 10-20 at a time in a table.
5. **Flag uncategorizable accounts** as `REVIEW — Uncategorized`. Don't guess.
6. **Add a `Tag Legend` sheet** documenting what's in each bucket.
7. **Save to `customization/reference/chart-of-accounts.xlsx`.**

### Step 3 — Non-GAAP rules (writes `reference/non-gaap-rules.yaml`)

1. **Ask: "Do you report Non-GAAP financials?"**
   - If no, write `enabled: false` and move on.
2. **If yes, ask: "What's excluded?"** in plain English. Examples:
   - SaaS: stock-based comp, restructuring, acquisition costs, litigation
   - Crypto-native: token compensation, MTM, FX on crypto disposals
   - Real estate: fair-value revaluation of investment property
3. **Translate user's plain-English answers into rules.** Use `account_number`, `account_range`, or `account_pattern` from the CoA they just uploaded. Show the user the resolved account list before writing.
4. **Ask presentation preference:**
   - Side-by-side P&Ls, single P&L with adjustments block, or bridge-only?
   - For open periods: GAAP only, GAAP + Non-GAAP estimate, or refuse?
5. **Write `customization/reference/non-gaap-rules.yaml`.**

### Step 4 — Templates (writes `templates/*`)

For each of (board deck, exec update, IR memo, variance package, close packet):

1. **Ask: "Do you produce these? Want to upload an example?"**
2. **If yes,** wait for upload. Save the file to `customization/templates/<name>.<ext>`.
3. **Read the file** and extract:
   - Section headings + order
   - Recurring tables
   - Tone markers
   - Things always/never included
4. **Save the extracted summary** to `customization/templates/<name>.summary.md` for fast agent reference.

Skip any deliverable the user doesn't produce.

### Step 5 — Voice samples (writes `voice/*`)

1. **Ask: "Want agents to match your writing style?"**
   - If no, skip.
2. **If yes**, ask user to paste 2–3 short excerpts from:
   - A CEO/CFO monthly update
   - An investor letter (if relevant)
   - A controller technical memo (if relevant)
3. **For each, ask for 3 things to avoid** (specific words or AI-slop tells).
4. **Write `customization/voice/<type>-style.md`** with the excerpts + voice attributes + avoid list.

### Step 6 — Verify

1. **Show the user a summary** of everything created:
   ```
   customization/
   ├── org.yaml                              ✓
   ├── reference/
   │   ├── chart-of-accounts.xlsx           ✓ (412 accounts tagged)
   │   ├── non-gaap-rules.yaml              ✓ (4 exclusions)
   │   └── closed-periods.md                ✓ (1 entry)
   ├── templates/
   │   └── board-deck.pptx                  ✓
   └── voice/
       └── ceo-update-style.md              ✓
   ```
2. **Suggest next steps:**
   - Run `update-reference` after each close to update closed-periods + add a new ATB
   - Optionally upload vendor map / customer map (separate skill: `build-vendor-map`)
   - Install Controller and FP&A Analyst agents — they'll now read from this layer
3. **Save a setup-record** to `customization/.setup-record.yaml` with timestamp and what was done.

## Outputs

All saved to `customization/` (or `<repo-root>/customization/` if the agent has a different working directory). Never overwrite existing files without asking.

## Escalation

- If the user uploads a CoA that doesn't parse, surface the error and ask them to re-export
- If the user has a complex non-GAAP structure you can't capture in YAML rules, write what you can and add a `# TODO: complex rule — see notes/` comment pointing to a free-text notes file
- If the user has more than 3 entities, do entity setup for each but warn that multi-entity Stack support is still v0.2 — full consolidation lives outside the agents

## Anti-patterns

- **Don't** auto-tag the whole CoA silently. The user must approve tags in batches.
- **Don't** write Non-GAAP rules without showing the user the resolved account list.
- **Don't** skip the privacy reminder: customization/ is gitignored, but the user should still review what's been written before committing anything.
- **Don't** mix the user's data into `customization-stub/`. Stubs stay generic forever.
