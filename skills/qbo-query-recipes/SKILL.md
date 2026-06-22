# Skill: qbo-query-recipes

The shared playbook for any agent that reads from QuickBooks Online (or Xero / NetSuite via the same patterns). Turn natural-language finance questions into precise tool calls — always going through the customization layer first.

## When to invoke

Any time an agent needs to answer a financial question against the user's accounting system. Controller, FP&A Analyst, AR Follow-up, AP Watcher, Treasury — anyone that touches QBO uses this.

## The cardinal rule

> **Open `customization/reference/chart-of-accounts.xlsx` (or vendor-map.xlsx, etc.) BEFORE hitting QBO.** Resolve the natural-language question to specific accounts/vendors/customers/periods FIRST. Only then call the connector for dollar amounts.

This is the most important rule in the entire stack. It's the difference between a generic agent and one that's actually useful.

## Pre-flight checks — always ask first if unspecified

Before running any recipe, confirm:

1. **Entity** — which one? (Default per `customization/org.yaml`.)
2. **View** — GAAP or Non-GAAP? (Per `customization/reference/non-gaap-rules.yaml`.)
3. **Period close status** — closed or open? (Per `customization/reference/closed-periods.md`.)
4. **Cash vs accrual** — default = accrual unless user says otherwise.

If the user's question implies an answer to any of these, don't ask — just confirm in your output. Don't interrogate unnecessarily.

---

## Recipes

### 1. "What did we spend on X in [period]?"

**Pattern:**
1. Open `customization/reference/chart-of-accounts.xlsx`
2. Filter `Category Tag = X` → get list of account numbers + full names
3. Call `quickbooks` MCP profit-and-loss tool with the period
4. Filter response to those accounts
5. If response doesn't break out the accounts, fall back to `transactions_by_account` per account number and sum

**Examples:**
- "Legal costs in May" → tag `Legal` → P&L May 1–31
- "Marketing spend Q1" → tag `Marketing` → P&L Jan 1–Mar 31

**Anti-pattern:** Don't search QBO for accounts containing the word "legal" — that misses accounts like "Outside Counsel" and double-counts ones like "Legal Settlements" that you might not want.

### 2. "Who did we pay [vendor] / what did we spend with [vendor]?"

**Pattern:**
1. Open `customization/reference/vendor-map.xlsx` — confirm vendor name + default GL
2. Call vendor search to verify spelling + get vendor ID
3. Use `transactions_by_account` filtered by vendor name, OR pull from the closed-month archive if available

### 3. "AR aging / overdue invoices"

**Pattern:** `quickbooks` MCP AR aging tool. For closed periods, use the archive file.

### 4. "AP aging / unpaid bills"

**Pattern:** `quickbooks` MCP AP aging tool. For closed periods, use the archive file.

### 5. "P&L for [period]" / "How are we doing this month?"

**Pattern:**
- If period is **closed** (≤ last close date from `closed-periods.md`) → pull from `archive_location` if set, else QBO closed-period query
- If period is **current/open** → live QBO query
- Always confirm GAAP vs Non-GAAP view (per `non-gaap-rules.yaml`)
- Default to side-by-side if Non-GAAP is enabled

### 6. "Balance sheet at [date]"

**Pattern:**
- Closed period → archive file → `Consolidated BS` tab
- Open period → live QBO BS tool

### 7. "Journal entries posted in [period]" / "Why did account X move?"

**Pattern:**
1. `journal_entries_search` for the period
2. `journal_entry_get` for detail on flagged entries
3. For account-level walk, `transactions_by_account` on that GL

### 8. "Is the budget for [category] on track?"

**Pattern:** Combine recipe #1 (actuals) with the `budget-checker` skill. Do **NOT** pull budget numbers from QBO — pull from the budget skill or `customization/reference/budget-*.xlsx`.

### 9. "Consolidated [P&L / BS / CF] for [month]"

**Pattern:** Multi-entity orgs: use the `archive_location` Final files. QBO's native consolidated view is unreliable when eliminations live outside the accounting system.

### 10. "What's still uncategorized?"

**Pattern:** Open Tagged CoA → filter `Category Tag = REVIEW — Uncategorized` → call `transactions_by_account` on each → list for human to categorize.

---

## Connector vs MCP — quick routing

| Need | Use |
|---|---|
| Read P&L / BS / aging / transactions | `quickbooks` MCP (standard) |
| Read journal entries | `quickbooks` MCP journal tools |
| Create/edit invoice, estimate, payment link | QBO sales-write MCP (Intuit's) — REQUIRES execution-pack guardrails |
| Payroll detail | QBO payroll MCP (Intuit's) |
| Catalog (products/services) | QBO catalog MCP (Intuit's) |
| Closed-period historical lookups | `customization/reference/atb/` + archive files first |
| Other entity (subsidiary) data | Per `org.yaml` — separate MCP connection if scoped, else archive files |

## Things that go in the customization layer's `query-recipes.md`, not here

If your org has a specific question pattern that doesn't fit the 10 above — a recurring metric, an unusual revenue stream, a quirky internal definition — add it to `customization/reference/query-recipes.md`. That file inherits from this one and adds org-specific recipes.

## Anti-patterns to avoid

- **Guessing account numbers.** Always pull from the CoA file.
- **Hitting QBO without checking close status.** Closed-period archive files are faster and authoritative.
- **Mixing entities silently.** If the user said "what's our cash position?", clarify whether they mean parent-only or consolidated.
- **Returning a Non-GAAP number without saying it's Non-GAAP.** Always label the view.
- **Skipping the "things to ASK" checklist** when the question is ambiguous.
