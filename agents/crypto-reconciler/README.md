# Crypto Reconciler — `@crypto-reconciler`

> Your crypto-fluent accountant — on-chain truth as source of truth, multi-chain reconciliation, gas/fee separation, cost-basis sanity checks.

**Pack:** Crypto (first industry-specialty agent in The AI Finance Stack)
**Status:** v0.1 — first crypto-pack reference implementation
**License:** MIT

---

## What Crypto Reconciler does

- **Daily wallet reconciliation** across every connected wallet and chain — on-chain balance vs. subledger vs. GL
- **Continuous unexplained-movement watcher** — any on-chain transaction without subledger classification within 24 hours surfaces as an alert
- **Monthly crypto-side close artifact** — period-end balances, gas/fee totals, staking yields, items requiring human investigation. Hand-off to Controller for inclusion in the main close packet.
- **Cost-basis sanity checks** — validate the subledger's cost-basis math against historical transactions; catch errors before they propagate to tax
- **Gas/network fee tracking** — fees separated by purpose (customer settlement → COGS for PSPs; treasury ops → OpEx; DeFi → OpEx) for proper accounting treatment

---

## What Crypto Reconciler will not do

- Move crypto (no on-chain transactions, no transfers)
- Approve multi-sig signers (read-only on pending transactions)
- Recommend custody arrangements, hedging products, or DeFi protocols
- Interact with smart contracts beyond simple balance reads
- Override subledger cost-basis logic (surfaces discrepancies; never recomputes silently)
- Communicate full wallet addresses publicly (labels only in Slack; addresses in restricted local files)

---

## On-chain truth is the source of truth

The architectural principle that makes this agent work: when subledger and on-chain disagree, on-chain wins. The subledger needs fixing. When GL and subledger disagree, the subledger is the period-end source — the GL needs the journal entry to catch up.

Mis-ordering this (treating the GL as truth) is how companies discover they "owned" crypto on the books that wasn't actually in any wallet.

---

## Required setup

### MCPs

At minimum, one crypto-accounting subledger + one GL + Slack:

- One of: `bitwave` · `tres-finance` (subledger)
- One of: `quickbooks` · `xero` · `netsuite` (GL — for crypto-related accounts)
- `slack`

Strongly recommended:

- `gcp-blockchain` — direct on-chain queries via BigQuery public datasets
- `catalyx-wallet` or `enterprise-wallet` — institutional custody
- `lightspark-sdk` + `lightspark-grid` — if Lightning Network operations are in scope
- `notion-finance` — for wallet labels and asset configuration

### Local configuration files

Two YAML files in `~/finance-data/crypto/` (you maintain these):

- `wallets.yaml` — every connected wallet with label, address, chain, custody type, business purpose
- `assets.yaml` — every asset with ticker, decimals, price oracle, accounting treatment

These files are the canonical truth about what's connected. The agent halts if they're missing or stale.

### Slack channels

- `#crypto-ops` — daily summaries, monthly close artifact, multi-sig pending visibility
- `#finance-alerts` — unexplained movements, cost-basis discrepancies, custody alerts (shared with the core agents)

### Skills

Four scopes — see [`/skills/README.md`](../../skills/README.md):

- **Agent-private** (in `agents/crypto-reconciler/skills/`): `wallet-recon`, `gas-and-fees-tracking`
- **Stack-shared imports:** `stack:proposal-format` (crypto-close JE proposals), `stack:slack-conventions` (channel routing)
- **Finance plugin skills:** inherited per `config.yaml`
- **Global utility:** `sop-pdf`, `sop-pptx`, `sop-xlsx`, `sop-docx`

---

## Schedule

| Run | Timing |
|-----|--------|
| Daily wallet reconciliation | 8am ET, including weekends |
| Continuous unexplained-movement watcher | Triggered by chain events; 24h SLA on subledger classification |
| Monthly crypto close artifact | Day 1 of new period, 7am ET (earlier than Controller's 9am) |
| Monthly cost-basis sanity check | Day 2 of close, 9am ET |

---

## Outputs

All files written to `~/finance-data/crypto/<year>-<month>/`. Each artifact follows the standard structure (Summary · Detail · Items Requiring Human Review · Methodology · Audit Trail), with crypto-specific conventions:

- Wallet labels in summaries, never full addresses
- Per-asset breakdown — never aggregate across assets without showing the breakdown
- USD conversion source and timestamp noted for every USD value
- Extra-detailed methodology notes — tax authorities and auditors will read these

---

## Privacy & access

Crypto data is operationally sensitive. Two protective measures:

- **Wallet address handling:** full addresses go in local files only; Slack summaries use labels. Anyone with Slack access shouldn't see the company's full wallet topology.
- **Audit log retention:** 7 years (vs. 2 for most agents). Required for crypto tax + audit reconstruction.

---

## Customization notes

The key things you'll adjust in `config.yaml` and the YAML config files:

- **Cost-basis methodology** — FIFO / LIFO / specific-ID, configurable per asset
- **Wallet and asset lists** — your specific custody arrangement
- **Subledger choice** — Bitwave vs. Tres Finance vs. (when added) others
- **SLA hours for unexplained movements** — default 24h; some shops want 1h for hot-wallet activity

---

## Known limitations (v0.1)

- **DeFi positions are tracked at balance level but not at strategy level.** Impermanent loss, yield decomposition, and protocol-specific events need a dedicated `defi-monitor` agent (v0.2 candidate).
- **Crypto tax computation is out of scope.** A `crypto-tax-tracker` agent is the v0.2 candidate that consumes this agent's outputs for FIFO/LIFO tax-lot tracking and jurisdiction-aware reporting.
- **Cross-chain bridge transactions need manual coordination.** v0.1 surfaces both sides as related; the operational treatment (single vs. dual transaction) requires human classification per bridge type.
- **Wrapped tokens (wBTC, wETH, etc.) are tracked as the wrapped asset, not the underlying.** Aggregating wBTC + BTC into "total BTC exposure" is the operator's reconciliation, not the agent's.

---

## Curriculum lessons that build this agent

- Future Module 7 lesson on industry-pack agents (post placement TBD)
- References the core Controller and Treasury patterns

---

## Status notes

**v0.1 — fully authored. First agent in the crypto pack.** Ships with two skills (`wallet-recon`, `gas-and-fees-tracking`). Future v0.2 pack additions:

- `defi-monitor` — DeFi positions, impermanent loss, yield decomposition
- `crypto-tax-tracker` — FIFO/LIFO tax-lot tracking, jurisdiction-aware reporting
- `staking-yield-tracker` — staking rewards as income, validator monitoring

The crypto pack establishes the **industry-pack pattern** for The AI Finance Stack: core agents are universal; industry packs add 2–4 specialized agents that augment the core. See [`ARCHITECTURE.md`](../../ARCHITECTURE.md) for the full extension model.
