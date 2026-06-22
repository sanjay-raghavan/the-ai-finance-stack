# Skill: Transaction Matching

For each new bank transaction, find the corresponding GL entry or subledger record. Score the match confidence. Auto-clear high-confidence matches; queue ambiguous matches; surface unmatched items.

---

## When to invoke

Every hour during business hours, every 4 hours off-hours. On-demand for a specific transaction.

---

## Inputs

- New bank transactions (since the last matching pass) from connected banking MCPs
- GL transactions for the relevant cash account (last 30 days, broader window for unmatched items)
- Subledger entries (AP payments, AR receipts, payroll) from the past 30 days
- Expected-transaction context from other agents:
  - AP Watcher's most recent payment run
  - AR Follow-Up's expected receipts (from aging + payment-history forecasts)
  - Payroll Reviewer's recent payroll schedule
  - Treasury's planned inter-account transfers
- Configured thresholds and scoring weights

---

## Outputs

Per matching pass, append-only records in `~/finance-data/bank-recon/<year>-<month>/matching/`:
- `auto-cleared-<date>.md` — high-confidence matches that auto-cleared
- `queue-pending-review.md` — running list of items pending human review
- `unmatched-<date>.md` — items with no proposed match

Daily summary post to `#bank-recon` (handled by the daily digest pass; this skill writes the inputs).

---

## Process

### Step 1 — Pull new bank transactions

Delta query: transactions since the last successful matching-pass timestamp. For each: date, amount, direction (debit/credit), description/memo, counterparty (if the bank provides it), reference ID.

### Step 2 — Pull candidate GL/subledger entries

For each bank transaction, query candidates from the last 30 days where:
- Amount matches within tolerance (exact or within $10)
- Direction is opposite (bank debit → GL credit on cash; bank credit → GL debit on cash)
- Date is within 14 days of the bank transaction

This is the candidate pool. Most bank transactions will have 0–3 candidates.

### Step 3 — Score each candidate

Apply the weighted scoring algorithm from CLAUDE.md:
- Amount match: 0.40
- Date proximity: 0.20
- Counterparty match: 0.20
- Description/memo overlap: 0.10
- Direction match (binary): 0.10

The best candidate (highest score) is the proposed match.

### Step 4 — Decide based on score

| Score | Action |
|-------|--------|
| ≥0.95 | Auto-clear. Write to `auto-cleared-<date>.md`. Mark both bank and GL records as reconciled. |
| 0.70–0.95 | Queue for human review. Write to `queue-pending-review.md` with the proposed match shown. |
| <0.70 | No reliable candidate. Write to `unmatched-<date>.md`. Initiate investigation via `unmatched-investigation` skill. |

### Step 5 — Contextual boost

Cross-reference against expected-transaction context:
- If a bank outflow matches AP Watcher's most recent payment run by amount + within 3 days, boost amount-match weight by 0.05
- If a bank inflow matches an AR Follow-Up expected receipt by customer + amount + ±5 days, boost counterparty-match weight by 0.05
- If a bank transfer matches a Treasury-planned inter-account move, auto-clear with confidence (these are the most predictable transactions)

Boosted scores can push borderline items into auto-clear range. Document the boost in the match record.

### Step 6 — Catch obvious flags

Before recording any match (auto-clear or queue), check:
- **Unknown counterparty** — if the bank transaction has a counterparty name not in the trailing-180-day vendor/customer list, flag specifically (even if amount/date match a GL entry, an unknown counterparty in the bank record warrants attention)
- **Off-hours timestamp** — bank transactions timestamped between 11pm and 5am on weekends/holidays warrant a fraud-pattern flag
- **Round-number whole-dollar amounts** ($10K, $25K, $100K exact) — not inherently suspicious, but a pattern of round transactions to/from new counterparties is a fraud signal worth noting

These flags don't block matching; they get logged alongside the match record. The aging/escalation logic and the unknown-counterparty alert system handle the actual escalation.

### Step 7 — Write outputs and move on

Append to the appropriate file. Update the matching-pass timestamp. Wait for the next scheduled pass.

---

## Match-record format

Each match record (auto-cleared or queued):

```markdown
| Bank Transaction | GL Entry | Score | Decision |
|---|---|---|---|
| 2026-04-15 · -$8,450 · "ACH SLACK INC" · ref 88421 | JE-2026-04-0193 · AP Payment to Slack Inc · $8,450 · 4/15 | 0.98 | ✅ Auto-cleared |
| 2026-04-15 · +$25,000 · "WIRE INC. CUSTOMER X" · ref 99127 | Open invoice INV-2026-0381 to Customer X · $25,000 · due 4/12 | 0.94 | 🟡 Queued — 0.94 (just under auto-clear threshold; verify amount-date-customer alignment) |
| 2026-04-15 · -$120 · "POS PURCHASE ELSE" · ref 23 | (no candidate) | n/a | 🔴 Unmatched — investigate |
```

---

## Escalation thresholds

| Trigger | Channel | Action |
|---------|---------|--------|
| Unknown counterparty in the bank transaction | `#finance-alerts` | Surface specifically — could be fraud, could be a legitimate new vendor that needs onboarding |
| Auto-clear of a prior period (>45 days old) | `#bank-recon` | Late-clearing item; surface for investigation of why it sat unmatched |
| Multiple bank transactions match a single GL entry | `#bank-recon` | Surface; could be a duplicate payment or a split that wasn't recorded |
| Multiple GL entries match a single bank transaction | `#bank-recon` | Surface; usually a batch settlement that needs split-classification |
| Off-hours bank transaction with new counterparty | `#finance-alerts` | Heightened fraud-pattern signal |

---

## Anti-patterns to avoid

- **Don't auto-clear below the configured threshold.** "Close enough" matches are not auto-clears. Queue them for human eyes.
- **Don't reuse a prior match as a precedent.** Every new bank transaction needs its own scoring. Pattern-matching ("Slack always lands on the 15th") is helpful context, but it doesn't substitute for matching this specific transaction.
- **Don't suppress unknown-counterparty flags even when the match score is high.** The amount might match, but if the counterparty is new, the operator should know.
- **Don't let the queue grow without bound.** If the human-review queue exceeds 50 items, surface as a process flag — either the matching is too strict, or there's a systemic gap upstream that's worth investigating.
