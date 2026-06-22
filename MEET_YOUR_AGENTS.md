# Meet Your Agents

The full team roster. One card per agent. What they own, when they run, what they post, when you intervene.

For technical detail (full CLAUDE.md, config.yaml, install instructions), follow the link in each card's header to the agent's own README.

---

## Core team (10 agents — universal Finance functions)

These ship as the v0.1 core. Install any subset; they work independently.

---

### [Controller](agents/controller/README.md) `@controller` 🟢

**Role.** Your senior controller. Owns the month-end close, the books, audit-readiness.

**What it does.** Closes the books in 5 sequential passes over 3 business days:
- BD-1 evening — generates the close calendar
- Day 1 — prepares standard accruals from prior-period patterns
- Day 2 — runs reconciliations (bank, AR, AP, intercompany, crypto)
- Day 3 morning — produces the status report
- Day 3 afternoon — drafts the variance narrative

**What it posts.** Status updates to `#finance-ops` after each pass. JE proposals to `#finance-approvals` for human review. Alerts to `#finance-alerts` when something needs your eye before it proceeds.

**When you intervene.** Approve JE proposals via `/approve <id>`. Resolve flagged reconciling items. Confirm anything that exceeds your materiality threshold. Roughly 30-60 minutes of human time per close instead of 3-4 days.

**What it won't do.** Post journal entries directly. Delete data. Approve its own work. Proceed past missing dependencies — it halts and asks.

---

### [FP&A Analyst](agents/fpa-analyst/README.md) `@fpa-analyst` 🟢

**Role.** Your senior FP&A lead. Owns variance, forecast, scenarios, and what-ifs.

**What it does.** Reads Controller's close packet on Day 4. Decomposes variances by driver (Volume × Rate × Mix for revenue; Headcount × Cost-per-Head for opex). Refreshes the rolling forecast with the new actuals. Re-flexes scenarios if a driver moved materially.

**What it posts.** Variance package to `#fpa-ops` within 48 hours of close. Quarterly scenario refresh. Ad-hoc what-if answers as Slack DMs.

**When you intervene.** Edit the variance narrative for tone. Validate the driver attribution before it goes to exec. Trigger ad-hoc by DMing the agent: *"What's our runway if we miss Q3 by 10%?"*

**What it won't do.** Re-baseline the forecast silently. Publish anything without a confidence range. Mix actuals across entities without labeling.

---

### [Treasury](agents/treasury/README.md) `@treasury` 🟢

**Role.** Your treasury analyst. Daily cash position, runway, banking activity.

**What it does.** Pulls balances from Mercury / Modern Treasury / Plaid every morning. Reconciles to QBO cash GLs. Computes today's runway under base / bull / bear scenarios. Flags PSP float (merchant funds in transit) separately from operating cash.

**What it posts.** Daily cash snapshot to `#treasury-ops` at 8am. Runway alert to `#finance-alerts` if any scenario crosses 6-month critical.

**When you intervene.** Confirm large outflows (above your threshold) before they're booked. Investigate flagged PSP timing diffs. Re-approve runway scenarios when a fundraise or material spend shifts the picture.

---

### [Investor Relations](agents/investor-relations/README.md) `@ir` 🟢

**Role.** Your IR analyst. Monthly investor update drafts, board reading material, KPI narrative.

**What it does.** On Day 5, reads Controller's packet + FP&A's variance + Treasury's cash. Drafts the monthly investor update in your CEO's voice (extracted from `customization/voice/`). Pulls KPI movement narrative from the variance decomposition.

**What it posts.** Draft investor update to `#ir-drafts` for review. Quarterly board reading material on the cadence you configure.

**When you intervene.** Always. IR drafts are *never* sent without explicit CEO/CFO approval. Your job is to revise tone and add the human context the agent can't see (the call that moved the deal, the conversation that closed the partnership).

**What it won't do.** Send email. Post outside `#ir-drafts`. Make claims about future performance the underlying data doesn't support.

---

### [AP Watcher](agents/ap-watcher/README.md) `@ap-watcher` 🟢

**Role.** Your AP analyst. Vendor contracts, invoice validation, duplicate detection, payment-run prep.

**What it does.** Watches incoming AP invoices (Bill.com, Ramp, Brex). Validates each against the vendor's contract (rate, frequency, terms). Flags duplicates by amount-window match. Prepares the weekly payment run with recommended priority.

**What it posts.** Daily AP queue to `#ap-ops`. Duplicate / contract-mismatch alerts to `#finance-alerts`. Payment run recommendations on your weekly schedule.

**When you intervene.** Approve the payment run before it's scheduled. Resolve flagged mismatches. Add new vendor contracts as they're signed.

---

### [AR Follow-Up](agents/ar-follow-up/README.md) `@ar-follow-up` 🟢

**Role.** Your AR analyst. Aging-based collections drafts, DSO tracking, deal-line-item validation.

**What it does.** Daily AR aging snapshot. Drafts collections emails for overdue invoices, tuned to each customer's payment history (gentle for good payers; firm for repeat late). Tracks DSO trend.

**What it posts.** Daily AR queue to `#ar-ops`. Drafts to your Gmail / email tool as drafts (never sent). DSO trend report weekly.

**When you intervene.** Review and send (or edit) the collections drafts. Escalate to legal / collections agency on aging items beyond your threshold.

---

### [Revenue Ops](agents/revenue-ops/README.md) `@revenue-ops` 🟢

**Role.** Your RevOps analyst. Commission calculations, ARR tracking, deal-desk support, quota attainment.

**What it does.** Reads CRM (HubSpot / Salesforce) for closed-won deals. Calculates commissions per the comp plan in `customization/`. Tracks ARR / NRR / churn. Supports deal desk on pricing exceptions.

**What it posts.** Monthly commission run to `#revops-ops`. ARR snapshot weekly. Deal-desk responses as Slack DMs.

**When you intervene.** Approve the commission run before payroll. Resolve flagged comp-plan exceptions. Approve pricing departures from policy.

---

### [Payroll Reviewer](agents/payroll-reviewer/README.md) `@payroll-reviewer` 🟢

**Role.** Your payroll analyst. Monthly payroll variance, headcount cost, comp/equity review.

**What it does.** Pulls payroll from Rippling / Gusto / Deel each cycle. Computes variance vs. prior month, vs. forecast, vs. budget. Flags new hires, terms, comp changes, and any unusual one-time items.

**What it posts.** Payroll variance report to `#payroll-ops` after each run. Anomaly alerts to `#finance-alerts`.

**When you intervene.** Investigate flagged anomalies before they hit the books. Approve unusual one-time entries.

---

### [Prepay Manager](agents/prepay-manager/README.md) `@prepay-manager` 🟢

**Role.** Your prepaid-accounting specialist. Lifecycle management for every prepayment on your books.

**What it does.** Identifies prepayments at invoice time. Builds amortization schedules per ASC 842 / company policy. Proposes monthly amortization JEs. Reconciles the prepay balance against the schedule each month.

**What it posts.** Monthly amortization JE proposals to `#finance-approvals`. Balance reconciliation to `#finance-ops`.

**When you intervene.** Approve the JE batch via `/approve`. Confirm any new prepayment classification.

---

### [Bank Recon](agents/bank-recon/README.md) `@bank-recon` 🟢

**Role.** Your daily transaction matcher. Bank / processor activity → GL.

**What it does.** Daily transaction matching across every bank and processor account. Investigates unmatched items (timing? error? unrecorded?). At period-end, attests that every account ties.

**What it posts.** Daily mismatch queue to `#bank-recon-ops`. Period-end attestation to `#finance-ops`.

**When you intervene.** Investigate the mismatches it can't resolve. Confirm period-end attestation.

---

## Industry pack (1 agent — crypto)

For companies with tokens, MTM, or crypto operations on the balance sheet.

---

### [Crypto Reconciler](agents/crypto-reconciler/README.md) `@crypto-reconciler` 🟢

**Role.** Your crypto-accounting specialist. Wallet activity → MTM → ledger.

**What it does.** Pulls activity from Tres Finance / Bitwave / your custody. Computes MTM per FASB-2023-08 (or your accounting policy). Proposes monthly MTM JEs. Reconciles crypto balances at cost basis vs. fair value vs. deck reporting (which usually wants fair value).

**What it posts.** Monthly MTM proposal to `#finance-approvals`. Crypto position summary to `#finance-ops`.

**When you intervene.** Approve MTM entries before they hit the books. Confirm any wallet additions/removals. Handle complex events (forks, airdrops, restakings) manually.

---

## Execution pack (1 agent — the only write-capable agent)

This is the only agent permitted to write to your GL. It executes JEs that other agents have proposed, after explicit human approval, validated through 8 integrity checks.

---

### [QBO Poster](agents/qbo-poster/README.md) `@qbo-poster` 🟢

**Role.** The bookkeeper that posts. Nothing more.

**What it does.** Subscribes to `#finance-approvals`. When a human types `/approve <proposal-id>`, runs 8 validation checks (authorized approver, content-hash integrity, period not closed, accounts active, idempotency, approver limits, approval recency, structural validity) and posts the entry to QBO.

**What it posts.** One Slack reply per entry — confirmation with the GL transaction ID and a link. Audit-log entry appended.

**When you intervene.** You're the approver. Every entry it posts came from you typing `/approve`.

**What it won't do.** Post anything that fails any of the 8 checks. Post anything not in the proposal queue. Modify a proposal. Roll back without a re-approval cycle.

---

## How to install just the agents you want

You don't need all 12. Install the subset that matches your stack.

**Minimum to test:** Controller + QBO Poster (close + approve flow).

**Recommended starter:** Controller + FP&A Analyst + Treasury + Bank Recon + QBO Poster. Covers the close, variance, cash, daily matching, and posting.

**Full Finance team:** all 10 core + 1 industry pack (if relevant) + QBO Poster.

In Claude Desktop, after pointing at the registry MCP, ask:

> Browse The AI Finance Stack and install Controller and QBO Poster.

The registry returns each agent's package; the client writes them to disk under `agents/<id>/`.

---

## Where to go next

- **[START_HERE.md](START_HERE.md)** — the 1-page overview
- **[YOUR_FIRST_CLOSE.md](YOUR_FIRST_CLOSE.md)** — what closing your first month actually looks like
- Each agent's **`agents/<name>/README.md`** — install instructions, config knobs, schedule customization
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the agents relate to each other (peer / sub-agent / parent-child)
