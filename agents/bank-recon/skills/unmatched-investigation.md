# Skill: Unmatched Investigation

For bank transactions that don't match anything (score <0.70), propose investigation paths. The goal isn't to force a match — it's to surface what we know so the human can resolve faster.

---

## When to invoke

Immediately after `transaction-matching` produces an unmatched item. Also on-demand for any specific unmatched item.

---

## Inputs

- The unmatched bank transaction
- The full pool of recent GL/subledger entries (broader than the matching pool — last 90 days)
- Vendor/customer master from the accounting MCP
- Recent AP refunds/credits, AR refunds, customer-dispute file
- Email subject lines from `gmail` MCP referencing the amount or date (if `gmail` is connected) — sometimes a vendor refund notification email surfaces the explanation

---

## Outputs

For each unmatched item, an investigation note appended to `~/finance-data/bank-recon/<year>-<month>/unmatched-<date>.md`:

```markdown
## 🔴 Unmatched — 2026-04-15 · -$8,420 · "ACH UNKNOWN VENDOR REFUND" · ref 99812

**Direction:** outbound · **Aging:** 0 days (new this pass)

### Possible explanations (ranked by likelihood)

1. **Vendor refund issued** — the description hints at "REFUND" and the direction is outbound. Some banks post refunds-to-vendors as outbound; some inbound. Worth checking AP Watcher's refund tracker for the past 30 days for any expected outbound refund of ~$8,420.

2. **Wire mis-route** — "UNKNOWN VENDOR" with no clear counterparty + outbound. Could be a mis-routed wire that needs immediate cancellation/recall.

3. **Reclass of a prior batch payment** — sometimes banks split a previously-batched payment for compliance/reporting. Look for a prior bank transaction of ~$8,420 plus another that adds up to a previously-cleared batch.

### Cross-references checked
- No matching JE in last 90 days within $10 tolerance ❌
- No matching AP payment-run entry within $10 tolerance ❌
- No matching customer refund in AR Follow-Up tracker ❌
- No expected Treasury transfer of ~$8,420 ❌
- Gmail search "$8,420 OR 8420" in last 30 days: 0 results ❌

### Recommended action

**Immediate:** treat as suspected unknown outflow. Pause any other ambiguity-flagged matches until this is resolved. Reach out to the bank (Mercury) for full transaction details — typically more detail in the bank's UI than in the MCP feed.

**If unresolved within 24 hours:** escalate to `#finance-alerts` as potential fraud signal.

### Aging escalation timeline
- 0–7 days: keep in daily digest
- 8–14 days: weekly aging report
- 15–30 days: weekly aging report with prominent flag
- 31+ days: daily alert to `#finance-alerts`
```

Then post a brief summary to `#bank-recon`:

> 🔴 **1 new unmatched item** — $8,420 outflow, ref 99812. Looks like a vendor refund or wire mis-route. Recommend pulling full bank-side detail. [link to investigation note]

If the item meets fraud-pattern criteria (unknown counterparty + off-hours + outbound), simultaneously post to `#finance-alerts` with the suspected-fraud framing.

---

## Process

### Step 1 — Pull broader candidate pool

The matching skill used a 30-day window with tight tolerances. The investigation skill goes wider:
- 90-day GL window
- 60-day subledger window (AP refunds, AR refunds, customer disputes)
- Email search if `gmail` MCP available

### Step 2 — Rank possible explanations

Based on transaction characteristics, propose explanations ordered by likelihood:

| Signal | Explanation candidates |
|--------|------------------------|
| Outbound + "REFUND" in description | Refund issued to vendor (check AP refund tracker), wire reversal |
| Inbound + customer-like description | Customer payment for an unknown invoice, dispute resolution credit, deposit return |
| Inbound + bank-like description | Interest income, fee reversal, account adjustment |
| Outbound + bank-like description | Bank fee not yet booked, wire fee, FX adjustment |
| Inbound + employee name in description | Payroll return (terminated employee), expense reimbursement repayment |
| Outbound + employee name in description | Off-cycle payroll, advance, bonus payout |
| Round number + new counterparty + off-hours | Suspected fraud — escalate immediately |

Apply the ranking. Present top 3 explanations in the investigation note.

### Step 3 — Cross-reference each explanation

For each ranked explanation, check the relevant sources:
- Refund tracker → AP Watcher's refund queue
- Customer dispute → AR Follow-Up's dispute file
- Treasury transfer → Treasury's planned-transfer file
- Email → Gmail search if available

Record which sources were checked and what was (not) found. This is the audit trail.

### Step 4 — Recommend action

Most unmatched items resolve in one of three ways:
- **Match found in the broader pool** — propose the match for human verification
- **Adjustment JE needed** — propose a JE (DR or CR to the appropriate account)
- **Investigate externally** — bank statement / vendor inquiry / customer follow-up

The recommendation matches the most likely path.

### Step 5 — Track aging

Each unmatched item enters the aging tracker the moment it's identified. The aging is automatic from the matching pass timestamp. The investigation note doesn't re-track aging; the aging report does.

### Step 6 — Surface fraud patterns

Specific patterns warrant immediate `#finance-alerts` escalation, not just `#bank-recon` daily-digest visibility:
- Unknown counterparty + outbound + round number ≥$1,000
- Off-hours transaction (weekend, holiday, 11pm-5am)
- Two or more unmatched outbound transactions to the same unknown counterparty in 24 hours
- A "vendor name" that's similar-but-not-identical to a known vendor (typo-squatting fraud pattern)

---

## Escalation thresholds

| Pattern | Channel | Action |
|---------|---------|--------|
| Suspected fraud pattern (see Step 6) | `#finance-alerts` | Immediate; recommend bank-side action |
| 2+ unmatched items aged >14 days in a single account | `#finance-alerts` | Process-quality flag — investigation hasn't been keeping up |
| An unmatched item is reclassified after >30 days | `#bank-recon` | Late-clearing investigation; surface why it took so long for the documentation cycle to learn from |

---

## Anti-patterns to avoid

- **Don't force a match below the threshold to "clear" an item.** A weak match propagates the error.
- **Don't suppress fraud-pattern signals because the amount is small.** $200 today is testing for $20,000 next week.
- **Don't recommend "investigate" as the action without a starting point.** A useful investigation note ranks the candidates and tells the human where to look first.
- **Don't repeat the matching skill's work.** Investigation looks beyond the matching skill's window and pool. If you find a match in the same pool, that's a matching-threshold issue.
