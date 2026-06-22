# Shared Skill: `stack:slack-conventions`

The canonical conventions for **every Slack message any agent posts.** Channel routing, severity prefixes, link format, mention rules, thread vs new-post decisions, and the boundaries of what does/doesn't belong in chat.

Every agent in the Stack posts to Slack. Without a shared standard, each agent develops its own conventions — and the resulting fragmentation degrades the human's ability to triage at a glance. A `🚨` from one agent should mean the same thing as a `🚨` from another.

---

## When this skill is invoked

By every agent that posts to Slack. Imported in `config.yaml`:

```yaml
stack_skills:
  required:
    - stack:slack-conventions
```

Referenced in agent skill files whenever they post — e.g., *"Post the confirmation to `#finance-approvals` following the format in `stack:slack-conventions`."*

---

## Channel routing

The Stack uses a small set of well-defined channels. Each has a specific purpose, a specific audience, and a specific tolerance for noise.

| Channel | Purpose | Who reads | Noise tolerance |
|---|---|---|---|
| `#finance-ops` | Routine operational updates (close progress, daily cash position, monthly variance summary) | Finance team, ops adjacent | Medium — daily digest cadence |
| `#finance-approvals` | Proposals awaiting human approval + post confirmations | Authorized approvers + Finance team | Low — every message is actionable |
| `#finance-alerts` | Anything failing, halted, blocked, or unexpected | On-call + CFO + Finance team | Zero — every message demands attention |
| `#fpa-ops` | FP&A-specific traffic (variance work, forecast updates, scenario shifts) | FP&A + Controller + CFO | Medium |
| `#fpa-budget` | Annual budget build + quarterly re-forecast cycles | FP&A + department leaders + CFO | Low during cycle, silent otherwise |
| `#ir-drafts` | Investor update drafts and board materials awaiting CFO review | CFO + IR + ops adjacent | Low |
| `#treasury-ops` | Cash position, banking activity, FX moves | Treasury + CFO + Controller | Low |
| `#ap-ops` | AP-specific (invoice arrivals, payment runs, vendor questions) | AP + Controller | Medium |
| `#ar-ops` | AR-specific (collections drafts, aging escalations) | AR + Revenue Ops + Sales adjacent | Medium |
| `#prepay-ops` | Prepay schedule changes, amortization summaries | Controller + Finance team | Low |
| `#payroll-private` | **Restricted access** — payroll variance, headcount cost. Audience: CFO + Head of People + CHRO only | CFO, Head of People only | Zero noise; restricted channel |

**Rule of routing:** if you can't articulate which channel a message belongs in, you probably shouldn't post it. Surface to `#finance-alerts` if uncertain — the human can route.

**The hardest call:** when to post to `#finance-alerts` vs the agent-specific ops channel. The test: *would a sleeping on-call person want to be paged for this?* If yes → `#finance-alerts`. If no → ops channel.

---

## Severity prefix conventions

Every message starts with an emoji that signals severity at a glance:

| Emoji | Meaning | When to use |
|---|---|---|
| ✅ | Routine success | Posted JE confirmation, close packet ready, reconciliation passed clean |
| 📊 | Routine information | Daily cash snapshot, variance package ready, KPI digest |
| 📋 | Action requested | Proposal awaiting approval, vendor question for human, draft for review |
| 🔄 | In progress | Forecast refreshing, reversal batch running, multi-step workflow underway |
| ⚠️ | Attention needed | Threshold approached, variance exceeded materiality, anomaly detected |
| 🚨 | Critical / blocking | Silent failure detected, period-close issue, security concern, integrity check failed |
| ❌ | Failure | Post rejected, validation failed, idempotency violation |
| 🔒 | Locked / committed | Budget locked, period closed, immutable artifact published |
| 🔍 | Investigation | Anomaly under review, unmatched item, edge case surfaced |

**One emoji per message.** Combining (`✅⚠️`) muddles the signal — pick the more severe one.

**Don't invent new emojis.** The set above is the contract. If you need a new one, extend this file via PR, don't invent ad-hoc.

---

## Message structure

Every Slack message follows this template:

```
<severity emoji> *<bold headline>* — <one-sentence summary with the key number/identifier>

<optional 1-3 sentence detail>

<optional bullet list of supporting facts, max 5 items>

<artifact link in `code` formatting or markdown link>
```

### Examples — Good

```
✅ *Posted to QBO.* Transaction ID `102847`. Total $2,000. Auto-reverse 5/1.

Confirmation: <https://finance.strand.local/posted/2026-04/PROP-2026-04-01-0007>
```

```
⚠️ *Material variance — Revenue.* Strand Payments came in -$130K (-7.4%) vs budget.

• Volume: -3 bps (-$45K)
• Take rate: -2 bps (-$60K)
• Mix: -1 bps (-$25K)

Driver narrative: take rate compression from one Connect renegotiation; not structural.
Full variance package: <https://finance.strand.local/closes/2026-04/variance>
```

```
🚨 *Silent failure suspected.* Posted transaction not found in QBO recent-transactions after 30s.

Proposal: PROP-2026-04-01-0007 ($2,000). Halting all further posting until investigated.
@finance-on-call please verify in QBO directly.
```

### Examples — Bad

```
❌ Just posted a JE for $2000 to QBO. transaction id 102847. cool.
```
(No severity emoji, no headline structure, lowercase, no link.)

```
🚨 ✅ ⚠️ *Update.* April close is progressing. Some items are flagged but most are fine.
```
(Multiple emojis, vague headline, no specifics, no link.)

---

## Threading vs new posts

| Situation | Use |
|---|---|
| Confirmation of a request from a thread | **Reply in thread** |
| Status update on a running multi-step workflow | **Reply in thread** to the originating message |
| Initial proposal awaiting approval | **New post** in the channel |
| Critical alert | **New post** — never bury alerts in threads |
| Daily / scheduled digest | **New post** |
| Follow-up to a daily digest (e.g., "here's the detail you asked for") | **Reply in thread** |

**Rule:** alerts always get a new post. Threading critical content makes it invisible to anyone not subscribed to the thread.

---

## Mentions

Use mentions sparingly. Each `@` is a notification on someone's phone.

| Situation | Mention |
|---|---|
| Proposal awaiting approval | `@<authorized-approver-role>` (e.g., `@controller`, `@cfo`) |
| Critical alert during business hours | `@finance-on-call` |
| Critical alert outside business hours | `@finance-on-call` + post in `#finance-alerts` (channel notification handles the rest) |
| Routine confirmation | **No mention** — let the human check at their cadence |
| Information for a specific person | `@<their-handle>` — but consider whether a DM is more appropriate |

**Never `@channel` or `@here`** unless it's a true cross-team incident. The agent has no business waking the whole channel.

**User-group mentions** (e.g., `@finance-team`) are preferred over individual mentions when an action is needed by "whoever's available."

---

## Link format

Every artifact reference is a clickable link, not a path string.

| Good | Bad |
|---|---|
| `<https://finance.strand.local/closes/2026-04/status\|April close packet>` | `~/finance-data/closes/2026-04/status.md` |
| `<https://qbo.intuit.com/.../txn/102847\|QBO transaction 102847>` | `QBO ID: 102847` |
| `<https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/agents/controller/skills/accrual-entries.md\|accrual-entries skill>` | `the accrual-entries skill in Controller` |

Use Slack's link format `<url|label>` so the user can click through directly. Bare URLs are allowed when the URL itself is the most useful label.

If an artifact is local-filesystem-only (no URL), state the filesystem path in `code` formatting:

```
Saved to `~/finance-data/closes/2026-04/status.md`
```

(But almost everything should have a URL — even local artifacts can be served via a simple HTTP server on the dedicated laptop.)

---

## What does NOT belong in Slack

Some things look like they should be in Slack but shouldn't:

- **Long analytical narratives** → these go in markdown artifacts; Slack gets the summary + link
- **Tables wider than ~6 columns** → put the table in a doc/sheet; Slack gets the headline number + link
- **Code blocks longer than ~10 lines** → snippet to a Gist or include via a code artifact link
- **Sensitive personal data** (payroll specifics, individual comp) → restricted channel only (`#payroll-private`), and even there, prefer "see attached artifact" over inline
- **Anything that should be in the audit log** → audit log is the JSONL file; Slack is the surface. Don't conflate the two.

---

## Anti-patterns

- **Don't post the same alert to multiple channels.** Pick the right one. Posting to both `#finance-ops` and `#finance-alerts` doubles the noise without adding signal.
- **Don't use "every event" channel pattern.** Slack is for *events that matter to humans now*. Use the audit log and the artifact filesystem for the long tail.
- **Don't strip the severity emoji to "look professional."** The emoji is the API for human triage. Without it, every message looks the same.
- **Don't reply in thread for critical alerts.** Threaded alerts are invisible to anyone not already in the thread.
- **Don't @ everyone for routine confirmations.** Mentions are for actions needed; confirmations are for visibility, not interruption.
- **Don't post raw error messages.** Translate to a human-readable severity + one-sentence diagnosis + link to detail. Raw stack traces go in the failure record artifact.
- **Don't use Slack as the source of truth.** Slack is a notification surface. The source of truth is the filesystem artifact + audit log + the ERP. If Slack disagrees with those, those win.

---

## Per-agent channel ownership

Each agent in the Stack has a primary ops channel and may post to alerts when something warrants it. The full mapping is in each agent's `config.yaml` under `notifications.slack.channels`. Common patterns:

| Agent | Primary ops channel | Always posts alerts to |
|---|---|---|
| Controller | `#finance-ops` | `#finance-alerts` |
| FP&A Analyst | `#fpa-ops` (monthly), `#fpa-budget` (annual/quarterly) | `#finance-alerts` |
| Treasury | `#treasury-ops` | `#finance-alerts` |
| Investor Relations | `#ir-drafts` | `#finance-alerts` |
| AP Watcher | `#ap-ops` | `#finance-alerts` |
| AR Follow-Up | `#ar-ops` | `#finance-alerts` |
| Revenue Ops | `#revops` | `#finance-alerts` |
| Payroll Reviewer | `#payroll-private` (restricted) | `#finance-alerts` |
| Prepay Manager | `#prepay-ops` | `#finance-alerts` |
| Bank Recon | `#finance-ops` | `#finance-alerts` |
| crypto-reconciler | `#finance-ops` | `#finance-alerts` |
| QBO Poster | `#finance-approvals` (confirmations) | `#finance-alerts` (every failure) |

---

*Part of the shared skill layer in [The AI Finance Stack](../README.md) · MIT License · Author: Sanjay Raghavan*
