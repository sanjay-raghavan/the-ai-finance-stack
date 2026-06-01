# Investor Relations — `@ir`

> Your IR partner — drafts the monthly investor update, prepares the board reading material, monitors KPI movements that matter to investors, and tracks the cap-table-adjacent context the CFO needs at hand.

**Category:** Finance & Accounting · **Function:** Investor Relations · **Status:** 🟡 Skeleton (v0.1 target) · **License:** MIT

---

## What Investor Relations does

- **Drafts the monthly investor update** — pulls the period's KPIs, variance narrative (from FP&A Analyst), and qualitative notes; produces a draft in the investor's preferred format (Substack newsletter, email, or board doc)
- **Prepares the board reading material** — quarterly board pack pre-read; KPI scorecard, period highlights, asks, risks
- **Monitors KPI movements** — flags material changes in metrics investors track (revenue growth, burn, runway, net retention, take rate for PSPs)
- **Maintains the investor list** — current investors, their contact preferences, last update sent, anything custom they've asked for
- **Tracks fundraise context** — if a round is active, monitors term sheet artifacts, comparables, recent transactions in the space
- **Prepares one-on-one investor brief** — for any upcoming investor meeting, a short pre-read covering "what's changed since they last heard from us"

---

## What Investor Relations will not do

- Send communications to investors directly — every draft surfaces for human review
- Modify cap-table records — read-only
- Make any claims that aren't supported by the underlying data — explicitly flags areas of uncertainty
- Speculate on valuation

---

## Required setup

- **MCPs:** accounting MCP + `slack`; optionally `notion-finance` (for the investor list / investor pack), `gmail` (drafts the update for review)
- **Slack channels:** `#ir-ops`, `#finance-alerts`
- **Skills** (four scopes — see [`/skills/README.md`](../../skills/README.md)):
  - **Agent-private** (in `agents/investor-relations/skills/`): `investor-update-draft`, `board-prereader`, `kpi-watch`
  - **Stack-shared imports:** `stack:slack-conventions` (channel routing). `stack:kpi-snapshot` and `stack:variance-narrative` queued for v0.2 hoist.
  - **Finance plugin skills:** inherited per `config.yaml`
  - **Global utility:** `sop-pdf`, `sop-pptx`, `sop-xlsx`, `sop-docx`

---

## Schedule

- **Monthly investor update draft:** Day 5 of close
- **KPI movement monitor:** daily, summary every Friday
- **Quarterly board pre-read:** drafted 14 days before scheduled board meeting
- **Investor meeting briefs:** on-demand (triggered by calendar event)

---

## Curriculum lessons that build this agent

- Lesson on automating monthly management packs (the IR write-up extends that)
- Future Module 8 lesson on building the AI-Ready Finance Team — IR as a representative agent

---

## Status notes

**v0.1 — fully authored.** Fourth reference implementation in The AI Finance Stack, after Controller, FP&A Analyst, and Treasury. Ships with three skills (`investor-update-draft`, `board-prereader`, `kpi-watch`); future v0.2 candidates include `investor-meeting-brief` (currently inline within the agent), `fundraise-comp-set`, and dedicated formatters for specific investor-segment communications.

IR depends on three other agents — Controller for the close packet, FP&A Analyst for variance + scenarios, Treasury for runway. Run those first; IR consumes their outputs on Day 5 of close. If any required input is missing, IR halts rather than drafting around it — investor updates with synthesized numbers damage trust permanently.

IR is also the agent most CFOs notice the value of fastest. The monthly investor update grind is genuinely painful for first-time and growth-stage CFOs; a Day 5 draft that's 80% there saves hours of weekend work.
