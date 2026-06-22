# The Customization Layer

This folder is the **grounding layer** for The AI Finance Stack. Without it, the agents are generic. With it, they understand *your* company — your chart of accounts, your non-GAAP definitions, your board-deck format, your writing voice.

> **For users:** copy this entire folder to `customization/` at the repo root and fill in your own data. `customization/` is gitignored by default so your books never get committed. This `customization-stub/` is the template that ships with the repo.

---

## Why this layer exists

A generic finance agent can call QBO. But calling QBO is the easy part. The hard part is mapping a question like *"what'd we spend on legal in May?"* to the right list of GL accounts for *your* chart, and presenting the answer in a format your CFO actually wants to read.

The customization layer holds three kinds of org-specific knowledge:

1. **`reference/`** — what the agents need to *know* about your books. Tagged chart of accounts, vendor map, customer map, entity structure, non-GAAP rules, closed periods.
2. **`templates/`** — what your outputs should *look* like. Board deck, exec update, IR memo, variance package, close packet.
3. **`voice/`** — how the writing should *sound*. CEO update style, investor-letter style, exec-memo tone.

Every agent in the Stack reads from this layer before it does anything else. That single discipline — *read your books first, then call QBO* — is what makes the difference between a generic agent and one that's genuinely useful to your finance team.

---

## How to fill it in

You have two options:

### Option A — Run the setup-org skill (recommended)

From Claude Desktop or Claude Code, invoke the `setup-org` skill. It walks you through:

1. Uploading your chart of accounts (xlsx export from QBO / NetSuite / Xero)
2. Defining your non-GAAP exclusions in plain English (or by pasting your bridge schedule)
3. Uploading one board deck, one exec update, one IR memo — to extract structure into templates and voice into style examples
4. Naming your entities, fiscal year, base currency
5. Listing your closed periods

About 30 minutes for a first pass. Saves everything into `customization/`.

### Option B — Fill the files in by hand

Each subfolder has its own README with the expected format and column conventions. Start with `org.yaml`, then `reference/chart-of-accounts.xlsx`, then layer in the rest. The agents work with whatever exists — partial customization is fine, full customization is better.

---

## Folder layout

```
customization-stub/
├── README.md                      ← you are here
├── org.yaml                       ← entity names, fiscal year, default entity
├── reference/                     ← what the agents know about your books
│   ├── README.md
│   ├── chart-of-accounts.xlsx     ← tagged with Category, Exec Category, Non-GAAP Treatment
│   ├── vendor-map.xlsx
│   ├── customer-map.xlsx
│   ├── entity-map.xlsx
│   ├── cash-investments-map.xlsx
│   ├── non-gaap-rules.yaml
│   ├── exec-categories.yaml
│   ├── closed-periods.md
│   ├── query-recipes.md           ← per-org customization of the shared recipes
│   └── atb/                       ← time-series snapshots, one xlsx per closed month
├── templates/                     ← what your outputs look like
│   ├── README.md
│   ├── board-deck.pptx
│   ├── exec-update.docx
│   ├── ir-update.md
│   ├── variance-package.xlsx
│   └── close-packet.md
└── voice/                         ← how your writing sounds
    ├── README.md
    ├── ceo-update-style.md
    └── investor-letter-style.md
```

---

## The contract

Every agent in the Stack agrees to:

1. **Read `customization/` before acting.** If `customization/` doesn't exist, the agent runs in "generic mode" with warnings — useful for trying things out, not for real work.
2. **Never overwrite anything in `customization/`** without explicit human approval. This is the source of truth for the org.
3. **Surface gaps.** If an agent encounters something that should be in `customization/` but isn't (e.g., an unknown account, a vendor without a tag), it flags it for the user to add.

If you're authoring an agent, see `customization-stub/AGENT_CONTRACT.md` for the full spec.
