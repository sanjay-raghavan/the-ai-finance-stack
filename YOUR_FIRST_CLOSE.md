# Your First Close

A narrative walkthrough of closing your first month with Controller. Hour by hour. What posts, what you approve, what you ignore. Concrete.

This assumes you've completed setup: cloned the repo, dropped the MCP config in Claude Desktop, run `setup-org` to populate `customization/`, installed Controller + QBO Poster. If not, start at [START_HERE.md](START_HERE.md).

The example below uses a closing the books for **May 2026**. Your dates will differ; the rhythm won't.

---

## BD-1 (Friday, May 30) — 5:00 PM ET

Controller fires on schedule. You see a Slack message in `#finance-ops`:

> 🟢 **Controller — Close Calendar generated for 2026-05**
>
> Standard close: 3 business days (BD1 Mon Jun 2, BD2 Tue Jun 3, BD3 Wed Jun 4).
>
> 5 passes scheduled. 12 reconciliations planned. 8 standard accruals queued from prior-period patterns.
>
> Anything to add for this close? Reply with `@controller add <item>` or `@controller skip <item>`.

You glance at the calendar. Looks right. No reply needed. Go enjoy the weekend.

---

## Day 1 (Monday, June 2) — 9:00 AM ET

Controller starts Pass 2 (Standard Accruals).

> 🟡 **Controller — Standard Accruals (Pass 2) drafted**
>
> 8 accrual proposals prepared. 6 mirror prior-period within tolerance. 2 deviations flagged:
>
> | # | Description | Proposed | Prior month | Deviation | Action |
> |---|---|---|---|---|---|
> | 4 | Cloud infrastructure (GCP) | $47,200 | $38,100 | +24% | flagged ⚠️ |
> | 7 | Legal — outside counsel | $0 | $22,500 | -100% | flagged ⚠️ |
>
> Proposal bundle posted to `#finance-approvals`. Approve individual entries with `/approve <id>` or the batch with `/approve batch:2026-05-accruals`.

You check the GCP bump. You remember the new compute cluster came online May 15 — that's the variance. You type:

> `/approve batch:2026-05-accruals — GCP variance explained by compute cluster spin-up May 15`

Legal at $0 catches your eye. You know there were two outside counsel matters open. You DM Controller:

> Why $0 for legal-outside-counsel? We had two open matters with your outside counsel.

Controller replies in-thread:

> your outside counsel invoiced both matters in April (booked $58K on Apr 28). No invoices received for May yet. Recommended treatment: accrue estimated May fees of ~$25K based on YTD run rate and matter status. Want me to draft the accrual?

You: *"Yes, $25K accrual to legal, post."*

Controller posts a new proposal. You `/approve` it. Total elapsed time: 12 minutes.

By 9:45 AM, Pass 2 is done. 9 entries posted (8 standard + 1 added). Books move forward.

---

## Day 1 — 11:00 AM ET

Controller starts Pass 3 (Reconciliations). This is where v0.3's sub-agent fan-out will help; in v0.2 it runs sequentially.

> 🟡 **Controller — Reconciliations (Pass 3) starting**
>
> 12 reconciliations planned across cash, AR, AP, intercompany, crypto. ETA ~90 min.

You ignore it; go to your next meeting. By 12:30 PM:

> 🟢 **Controller — Reconciliations (Pass 3) complete — 11 of 12 reconciled cleanly**
>
> ✅ Cash (4 accounts): all tie to BoA and Mercury statements
> ✅ AR aging: ties to subledger; 3 invoices flagged for AR Follow-Up agent
> ✅ AP aging: ties to subledger
> ✅ Intercompany: ML → Subsidiary $2.75M consulting fee; eliminates in consolidation
> ✅ Crypto: ties to Tres Finance MTM (FYI cost basis $8.2M, fair value $4.3M — $3.8M dead-token gap is dead-coin reserve)
> ⚠️ 1 escalation: **Hetzner charges** — $1,847 reconciling item, 60 days aged
>
> Detail in `#finance-ops` thread. Hetzner item details + recommended treatment in `#finance-approvals`.

You click into the Hetzner thread:

> **Bank Recon — Hetzner charges, $1,847 difference**
>
> Bank shows three small charges from "Hetzner Online GmbH" totaling $1,847 in March-April that are not in the GL. Pattern matches the bare-metal provisioning category but is not coded to any PO. Possible: missed coding of three additional servers spun up for the new cluster. Aged 60 days.
>
> Recommended treatment: book retro accrual to cloud infrastructure, then categorize the bank-side hits. Need confirmation: are these the new cluster bare-metal nodes?

You ping Eng on Slack, get confirmation in 5 min: *yes, those are ours*. Type:

> `/approve` — confirm; book retro accrual to Cloud Infrastructure (account 7440)

Controller posts the entry; QBO Poster validates and posts. By 1:00 PM, Pass 3 is fully clean.

---

## Day 2 (Tuesday, June 3) — 9:00 AM ET

Controller starts Pass 4 (Status Report).

> 🟢 **Controller — Day 2 Status Report posted**
>
> Close progress: **on track** for BD3 Wed Jun 4.
> - Day 1: 9 accruals posted, 0 stale items
> - Day 1: 12 reconciliations clean (after 1 retro accrual for Hetzner bare-metal)
> - Day 2 today: Crypto Reconciler runs MTM; final reviews
>
> Open items requiring you:
> 1. Confirm Crypto Reconciler's May MTM proposal (lands ~2pm)
> 2. Review variance narrative draft (lands tomorrow afternoon)
>
> Full status report: `~/finance-data/closes/2026-05/status-report.md` (also attached).

You read it. Looks good. You go to your next meeting.

At 2:00 PM, Crypto Reconciler posts:

> 🟡 **Crypto Reconciler — May 2026 MTM proposal**
>
> Per Tres Finance, fair value of crypto holdings declined $467K MoM ($4.77M → $4.31M). Proposed JE: DR Crypto MTM Loss $467K / CR Crypto Holdings $467K (account 9970 → account 1497).
>
> Approve with `/approve crypto-mtm-2026-05`.

You: `/approve crypto-mtm-2026-05`

QBO Poster validates (8 checks pass), posts the entry. Done.

---

## Day 3 (Wednesday, June 4) — 9:00 AM ET

Final pass. Controller starts the Variance Narrative.

You don't need to interact. By 2:00 PM:

> 🟢 **Controller — Variance Narrative draft ready**
>
> May 2026 closed. Variance narrative draft posted to `#finance-ops`. Highlights for review:
>
> - Operating loss: **$2.95M (Non-GAAP), $3.08M (GAAP)** — within budget ($3.0M Non-GAAP planned)
> - Revenue: $285K — 12% over plan (chain partnership fee from a new client closed late-May)
> - OpEx: $2.96M Non-GAAP — flat to plan; cloud infrastructure +$9K offset by lower-than-planned T&E
> - Cash burn: $2.6M (vs. $3.1M plan) — recovery on a delayed pass-through accelerated AR
>
> Bridge: GAAP → Non-GAAP excludes token comp ($128K), crypto MTM ($467K loss reclassified), realized G/L items.
>
> Full narrative + tables: `~/finance-data/closes/2026-05/variance-narrative-draft.md`. **FP&A Analyst will pick this up tomorrow morning and produce the variance package.**

The close is done. You scan the variance commentary. Edit two sentences for tone. Forward to your CFO.

**Total human time across 3 days: ~75 minutes.** Previously: ~24-32 hours across you, the controller, and the accountant.

---

## What you didn't have to do

- Pull TB from QBO and stage in Excel
- Type up the accruals
- Walk every reconciliation manually
- Investigate the Hetzner coding gap yourself
- Compose the variance narrative from scratch
- Format the close packet
- Update the status thread in Slack

What you *did* do: judgment calls. GCP variance? Eng confirms. Legal $0? Add the accrual. MTM proposal? Approve. Reading the variance? Edit for tone. Everything in your unique value-add as the human in the loop.

---

## What goes wrong, and how Controller handles it

**An MCP is down.** Controller halts the pass, posts to `#finance-alerts`: *"QBO MCP returned 503 on profit-and-loss query. Retried 3x. Halting Pass 2 until resolved."* You restart the MCP locally; reply `@controller resume` and it picks up.

**An accrual deviates more than your threshold.** Controller flags it in the proposal queue with the deviation flag. Won't post automatically; waits for `/approve`.

**A reconciliation has a difference above threshold.** Controller posts to `#finance-alerts` with the specific account, dollar amount, and recommended next steps. Won't book a plug; waits for human direction.

**You don't approve in time.** No automation kicks in to post things you didn't approve. The close just doesn't finish. Day 3 status report says *"3 items pending approval — close not complete."*

**The variance is real and material.** Controller drafts the narrative naming the variance; FP&A Analyst the next day decomposes it by driver. Both surface to you for review. Nothing goes out externally until you approve.

---

## After your first close

Once you've run one close, the rhythm gets familiar fast. Months 2-3 typically take half the human time of month 1 because the unusual items you flagged ("Hetzner bare-metal — code to 7440", "outside-counsel billing pattern — accrue monthly even if invoiced quarterly") are now captured in `customization/reference/` and persist.

After month 3, your close looks like: ~30 minutes of approval cycles spread over 3 business days. Less than a single morning of focused work, total.

---

## Where to go next

- **[MEET_YOUR_AGENTS.md](MEET_YOUR_AGENTS.md)** — meet FP&A Analyst (Day 4) and IR (Day 5) — what happens after Controller hands off
- **[agents/controller/README.md](agents/controller/README.md)** — install instructions, schedule customization, all 5 passes in full detail
- **[customization-stub/README.md](customization-stub/README.md)** — how to update `closed-periods.md`, add an ATB to `reference/atb/`, refine your CoA tags as you encounter new accounts
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how Controller fits with the other agents
