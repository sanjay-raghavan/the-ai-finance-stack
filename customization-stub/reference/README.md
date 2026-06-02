# reference/ — what the agents know about your books

This is the **lookup layer**. Every agent in the Stack reads here before calling QBO (or NetSuite, or Xero). The discipline is: turn a natural-language question into a precise list of accounts / vendors / customers / periods *first*, then call the accounting system for dollar amounts.

Without this layer, agents waste tokens guessing and produce inconsistent results across runs. With it, the same question returns the same answer every time.

---

## Files in this folder

| File | What it is | Required? |
|---|---|---|
| `chart-of-accounts.xlsx` | Your CoA with three extra columns: `Category Tag`, `Exec Category`, `Non-GAAP Treatment` | **Yes** |
| `vendor-map.xlsx` | All vendors with default GL and category tag | Strongly recommended |
| `customer-map.xlsx` | All customers with type, billing cadence, pass-through flag | Strongly recommended |
| `entity-map.xlsx` | Entities, fiscal year, functional currency, close cadence | **Yes** (if multi-entity) |
| `cash-investments-map.xlsx` | Bank/investment GLs grouped into balance-sheet categories | Recommended |
| `non-gaap-rules.yaml` | Declarative non-GAAP exclusion list + presentation rules | **Yes** (if you report non-GAAP) |
| `exec-categories.yaml` | Roll-up buckets used in exec/board decks | Recommended |
| `approval-policy.yaml` | Who can approve which JEs (by je_type), at what thresholds | **Yes** (if 2+ approvers; required for QBO Poster's 8-check validation) |
| `closed-periods.md` | Which months are locked. Plain text, edit by hand | **Yes** |
| `query-recipes.md` | Org-specific overrides on the shared QBO query patterns | Optional |
| `atb/` | Adjusted Trial Balance snapshots, one xlsx per closed month | Recommended |

---

## How `chart-of-accounts.xlsx` works

This is the most important file in the entire customization layer. Export your CoA from your accounting system (QBO: `Reports → Accounts and Settings → Chart of Accounts → Export`), then add three columns:

| Column | Values | Used by |
|---|---|---|
| `Category Tag` | Granular bucket: `Legal`, `Marketing`, `Personnel`, `T&E`, `Subscriptions`, `R&D`, `Crypto MTM`, etc. | All "what did we spend on X" queries |
| `Exec Category` | Rolled-up bucket for the board/exec deck: `Personnel`, `Prof Services`, `G&A`, `Marketing`, etc. (12 typical, customize in `exec-categories.yaml`) | Exec-summary skill, board-deck builds |
| `Non-GAAP Treatment` | `Include` or `Exclude` | The `finance-view-switch` skill |

If you don't know what tag to use, leave it blank — the `setup-org` skill (or any later run of the `tag-coa` skill) will suggest tags interactively based on account name and detail type.

A `Tag Legend` sheet documents what's in each bucket. A `REVIEW — Uncategorized` row should appear for any account whose tag you're unsure of — these get flagged any time an agent encounters them.

---

## How `non-gaap-rules.yaml` works

Different companies exclude different things. SaaS companies usually exclude SBC, restructuring, and acquisition costs. Crypto companies exclude token compensation, MTM, and FX on crypto disposals. Real-estate companies exclude fair-value revaluation. Define yours here:

```yaml
non_gaap:
  enabled: true
  exclusions:
    - account_number: 6065
      reason: "Stock-based compensation (non-cash)"
    - account_range: [9900, 9975]
      reason: "Crypto / FX / derivative MTM adjustments"
    - account_pattern: "Restructuring*"
      reason: "Non-recurring restructuring costs"
  presentation:
    style: "side-by-side"       # side-by-side | single-pnl-adjustments-block | bridge-only
    open_period_handling: "gaap-with-estimate"
                                # gaap-only | gaap-with-estimate | refuse
```

The `finance-view-switch` skill reads this file to build the GAAP-to-Non-GAAP bridge mechanically.

---

## How `closed-periods.md` works

Plain markdown. Update it when a period closes:

```markdown
# Closed periods

Last closed period: **2026-04** (closed 2026-05-08)

| Period | Close date | Notes |
|---|---|---|
| 2026-04 | 2026-05-08 | clean close |
| 2026-03 | 2026-04-09 | Q1 — extra review pass |
| 2026-02 | 2026-03-07 | |
| 2026-01 | 2026-02-10 | |
```

Agents use this to decide: "is the period the user is asking about closed? If yes, pull from the archive file. If no, query live QBO."

---

## Updating this folder

You'll touch this folder regularly — every month after close (closed-periods, new ATB), when a new account is added in QBO (chart-of-accounts), when a new vendor is paid (vendor-map), when a new customer is invoiced (customer-map).

The `update-reference` skill scans your accounting system for changes since last sync and proposes diffs you can review and apply.

**Never write to this folder from code without human approval.** It's the source of truth for the org.
