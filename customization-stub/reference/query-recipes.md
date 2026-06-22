# QBO Query Recipes — your org

> **Rule for agents:** ALWAYS open `chart-of-accounts.xlsx` before hitting QBO. Use the `Category Tag` column to pick the right account list. Only then call the QBO connector/MCP for dollar values.

> **Entity default:** Use whatever's set as `default_entity` in `../org.yaml` unless the user explicitly says otherwise. For consolidated/closed-month numbers, prefer the `archive_location` files (see `org.yaml`) over live QBO.

This file inherits from the shared stack skill `qbo-query-recipes`. Override or add recipes here when your org needs something specific.

---

## Default recipes (from the shared skill)

These cover ~80% of finance queries. They're documented in detail in `the-ai-finance-stack/skills/qbo-query-recipes/SKILL.md`. Quick index:

| # | Pattern | When to use |
|---|---|---|
| 1 | "What did we spend on X in [period]?" | Categorized opex queries |
| 2 | "Who did we pay / what did we spend with [vendor]?" | Vendor-level spend |
| 3 | "AR aging / overdue invoices" | Collections |
| 4 | "AP aging / unpaid bills" | Payment planning |
| 5 | "P&L for [period]" | Standard financials |
| 6 | "Balance sheet at [date]" | Standard financials |
| 7 | "Journal entries posted in [period]" | Audit / why-did-X-move |
| 8 | "Is the budget for [category] on track?" | Budget vs. actual |
| 9 | "Consolidated [P&L / BS / CF] for [month]" | Multi-entity orgs |
| 10 | "What's still uncategorized?" | Close hygiene |

---

## Your overrides

Add org-specific recipes below. Examples of when you'd add one:

- You have an unusual revenue stream that needs a specific account list every time
- You have a recurring report (e.g., "monthly burn") that has a specific definition only your team uses
- Your CFO consistently asks a question that maps to a non-obvious set of accounts

### Example — "Monthly burn rate"

**Pattern:**
1. Get last 3 closed months' P&L (parent entity)
2. Sum operating expenses minus non-GAAP exclusions
3. Add capex (from BS movement on PP&E)
4. Average the three months → monthly burn

**Reasoning:** Our team defines burn as cash operating outflow + capex, not GAAP operating loss. This recipe locks that definition.

### Example — "Pass-through revenue"

**Pattern:**
1. Open `customer-map.xlsx` → filter `Pass-through? = Yes`
2. Get last-month sales by customer
3. Report gross + pass-through component separately

**Reasoning:** Some customers' revenue is largely pass-through to subcontractors and shouldn't be counted as margin contribution.

---

## Things to ASK before running, not assume

- **Entity:** Which one? (Default per `org.yaml` if unspecified.)
- **View:** GAAP or Non-GAAP? (Per `non-gaap-rules.yaml`.)
- **Period close status:** Closed or open? (Per `closed-periods.md`.)
- **Cash vs accrual:** Default = accrual unless user says otherwise.
- **Currency:** Functional vs. reporting? (Default = base_currency from `org.yaml`.)

---

*Last updated: _DATE_. Edit freely — agents will follow whatever is here.*
