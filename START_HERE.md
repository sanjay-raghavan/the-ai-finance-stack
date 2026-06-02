# Start Here

**An AI Finance team that runs on your laptop.** Closes the books, watches variances, chases AR, drafts the investor update. You own the data; you bring your own API key; you approve every journal entry before it touches your GL.

One human + one accountant + 12 agents = a full Finance function.

---

## How it works in three steps

### 1. Install
Clone the repo, drop a config snippet into Claude Desktop, paste your Anthropic API key. **~10 minutes.**

```bash
git clone https://github.com/sanjay-raghavan/the-ai-finance-stack.git
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "the-ai-finance-stack": {
      "url": "https://the-ai-finance-stack.sanjayraghavan.workers.dev/sse"
    }
  }
}
```

Restart Claude Desktop. You'll see "Browse The AI Finance Stack" as an option.

### 2. Customize for your books
Run the `setup-org` skill. It walks you through uploading your chart of accounts, defining your Non-GAAP rules in plain English, dropping in your board-deck and exec-update templates, and pasting writing-style samples. **~30 minutes, one-time.**

Without this step, agents work in "generic mode" and post warnings. With it, every agent in the Stack speaks your books — your entities, your accounts, your reporting conventions.

### 3. Schedule (or run on-demand)
Each agent has a recommended schedule (Controller fires on BD-1 at 5pm; FP&A on Day 4 at 9am; AR Follow-Up daily at 8am, etc.). Install them once and they show up at the right time, drop work in Slack, wait for your approval.

Or skip the schedule entirely and just ask in Claude Desktop: *"Close the books for May"*, *"What's our cash position?"*, *"Draft the investor update"*. Same agents, ad-hoc.

---

## Meet your agents

| Role | Owns | When they run |
|---|---|---|
| **[Controller](agents/controller/README.md)** | Month-end close, accruals, reconciliations, the books | BD-1 through Day 3 |
| **[FP&A Analyst](agents/fpa-analyst/README.md)** | Variance vs. budget, rolling forecast, scenarios, what-ifs | Day 4 + on-demand |
| **[Treasury](agents/treasury/README.md)** | Cash position, runway, banking, PSP float | Daily |
| **[Investor Relations](agents/investor-relations/README.md)** | Monthly investor update drafts, board reading, KPI narrative | Day 5 |
| **[AP Watcher](agents/ap-watcher/README.md)** | Vendor contracts, invoice validation, duplicate detection | Daily |
| **[AR Follow-Up](agents/ar-follow-up/README.md)** | Aging-based collections drafts, DSO tracking | Daily |
| **[Revenue Ops](agents/revenue-ops/README.md)** | Commissions, ARR, deal-desk, quota attainment | Weekly |
| **[Payroll Reviewer](agents/payroll-reviewer/README.md)** | Monthly payroll variance, headcount cost, comp/equity review | Monthly |
| **[Prepay Manager](agents/prepay-manager/README.md)** | Prepayment lifecycle, amortization schedules, JE proposals | Monthly |
| **[Bank Recon](agents/bank-recon/README.md)** | Daily transaction matching, period-end attestation | Daily |
| **[Crypto Reconciler](agents/crypto-reconciler/README.md)** *(industry pack)* | Wallet activity → MTM → ledger | Monthly |
| **[QBO Poster](agents/qbo-poster/README.md)** *(execution pack)* | The only agent that writes to your GL — after explicit human approval | On approval |

See **[MEET_YOUR_AGENTS.md](MEET_YOUR_AGENTS.md)** for the full team roster with what each one posts, when you intervene, and what they explicitly won't do.

---

## What your first week looks like

**Day 1 (Tuesday): Install.** Clone, drop the config snippet, restart Claude Desktop. You ask: *"Show me what The AI Finance Stack can do."* The registry lists the 12 agents. You read Controller's CLAUDE.md to understand what it'll do before installing it.

**Day 2 (Wednesday): Customize.** You run `setup-org`. Upload your CoA from QuickBooks; tag it by category in batches (Legal, Marketing, Personnel, etc.); declare your Non-GAAP exclusions in plain English; upload last month's board deck and a CEO update for voice samples. ~30 minutes. Now every agent knows your books.

**Day 3 (Thursday): First close.** It's BD-1. You ask Controller to start the close. It pulls your trial balance, prepares standard accruals, runs reconciliations, drops a status report in `#finance-ops`, and posts JE proposals in `#finance-approvals` for the items that need a human eye. You type `/approve <id>` on the ones that look right. By end of day, books are closed except for the 2-3 items that need outside input. See **[YOUR_FIRST_CLOSE.md](YOUR_FIRST_CLOSE.md)** for the hour-by-hour.

**Day 4 (Friday): First variance package.** FP&A Analyst reads Controller's close packet, decomposes the variances by driver, drafts narrative commentary in your voice, and posts the package to `#fpa-ops`. You spend 20 minutes editing it for tone instead of 4 hours building it from scratch.

**Day 5 (Monday): First investor update.** IR Agent reads Controller's packet, FP&A's variance, Treasury's cash position. Drafts the monthly investor update in your CEO's voice. You revise the opening paragraph; everything else is close enough to ship.

---

## What the Stack doesn't do (on purpose)

- **Never posts to your GL silently.** Every JE goes through the propose → human-approve → post pipeline. Exactly one agent (QBO Poster) is allowed to write, and only after explicit Slack approval validated by 8 checks.
- **Never sends external communications without approval.** Drafts go to Slack channels you control; nothing leaves until you approve.
- **Never leaves your machine.** Agents run locally under your OAuth grants. Anthropic sees your prompts (you can audit them); no third party touches your books.
- **Doesn't replace your accountant or CFO.** It does the recurring work; the judgment calls still come to you.

---

## Where to go next

Once you've decided this is worth ~30 minutes to try:

- **[QUICK_START.md](QUICK_START.md)** — 30-minute install walkthrough (technical)
- **[SETUP_DEDICATED_LAPTOP.md](SETUP_DEDICATED_LAPTOP.md)** (Mac) or **[SETUP_DEDICATED_LAPTOP_WINDOWS.md](SETUP_DEDICATED_LAPTOP_WINDOWS.md)** (Windows) — full production setup with scheduled agents
- **[MEET_YOUR_AGENTS.md](MEET_YOUR_AGENTS.md)** — full team roster, one card per agent
- **[YOUR_FIRST_CLOSE.md](YOUR_FIRST_CLOSE.md)** — what closing your first month with Controller actually looks like
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — three-layer design, customization layer, agent relationships
- **[customization-stub/README.md](customization-stub/README.md)** — what `setup-org` builds for you, and the contract every agent honors
- **[MCP_INTEGRATION.md](MCP_INTEGRATION.md)** — how agents talk to QBO, Mercury, Stripe, etc.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — adding your own agent

---

## Read the curriculum alongside

If you want to understand how the Stack works under the hood — and learn how to build pieces of it yourself — the companion lesson series is on Substack: [**AI-Powered Finance**](https://sanjayraghavan.substack.com). 60+ lessons across 8 modules; the Stack is the working artifact at the end of Module 7.

---

*MIT-licensed. Built and maintained by [Sanjay Raghavan](https://www.linkedin.com/in/sanjayraghavan/).*
