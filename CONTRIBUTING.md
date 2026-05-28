# Contributing to The AI Finance Stack

Thanks for considering a contribution. This project ships as a free, open-source registry of Finance AI agents — every well-formed contribution makes the registry more useful for the next Finance leader who installs it.

This guide covers the most common contribution types in order of how often they happen.

---

## Reporting an issue

Before opening an issue, please:

1. Search [existing issues](https://github.com/sanjay-raghavan/the-ai-finance-stack/issues) — your bug may already be tracked.
2. If new, open an issue with:
   - **What you did** — the exact prompt, the agent you used, the MCPs you had connected
   - **What you expected** — the artifact you thought you'd get
   - **What actually happened** — the artifact you actually got, or the error message
   - **Environment** — macOS version, Claude Desktop or Claude Code version, agent version

For sensitive issues (e.g., a security concern in an agent), please email rather than opening a public issue.

---

## Requesting a new agent

If you'd like to see a new agent in the Stack (e.g., a Tax agent, a SOX Sampler, a Procurement agent), open an issue with the `agent-request` label. Use this template:

```
**Function this agent represents:** (e.g., Tax, SOX, Procurement)

**Job-to-be-done:** (one sentence — what would the human delegate to this agent?)

**Required MCPs:** (which data sources does this agent need?)

**Schedule:** (when would it run?)

**Why now:** (why is this agent worth building before others?)
```

Agent requests get triaged and prioritized — popular ones (lots of upvotes) move faster. Some get built by the maintainer; some are great candidates for community contribution (see below).

---

## Contributing an agent

Want to author your own agent and submit it to the Stack? Here's the flow.

### Step 1 — Fork the repo and clone your fork

```bash
gh repo fork sanjay-raghavan/the-ai-finance-stack --clone
cd the-ai-finance-stack
```

### Step 2 — Create a new branch

```bash
git checkout -b agent/your-agent-name
```

Use kebab-case for the agent name (`tax-watcher`, `procurement-assistant`).

### Step 3 — Author the agent package

Follow the format in [`AGENT_PACKAGE_FORMAT.md`](./AGENT_PACKAGE_FORMAT.md):

```
agents/your-agent-name/
├── CLAUDE.md          # Required — agent identity, role, instructions
├── skills/            # Required — at least one skill
│   └── <skill-name>.md
├── config.yaml        # Required — MCPs, schedule, goals, model
└── README.md          # Required — human-readable install + usage
```

Reference [`agents/controller/`](./agents/controller/) or [`agents/fpa-analyst/`](./agents/fpa-analyst/) as canonical examples.

### Step 4 — Test the agent locally

Run the agent against sample data on your machine before submitting. See [`QUICK_START.md`](./QUICK_START.md) for the install path.

### Step 5 — Open a Pull Request

Push your branch and open a PR. The PR description should include:

- A one-sentence summary of the agent
- Required MCPs
- An example of an output the agent produced during your local testing (paste the artifact, or link to a saved copy)
- Anything reviewers should pay extra attention to

### Step 6 — Review

A maintainer will review the PR. Common feedback areas:
- **Hard rules clarity** — what the agent *must not* do should be unambiguous
- **Materiality thresholds** — are they configurable, with sensible defaults?
- **Audit trail** — does the agent's output include a methodology + audit section?
- **MCP requirements** — are all required MCPs documented in `config.yaml`?

Expect 2–3 review rounds for a new agent. Once merged, the agent ships in the next release.

---

## Contributing a skill

If you've built a reusable capability that any agent could invoke (e.g., a better `variance-decomposition` skill, or a new `intercompany-reconciliation` skill), submit it the same way as an agent — open a PR with the new skill file under the relevant agent's `skills/` directory.

For skills that should be shared across multiple agents, propose a top-level `skills/` directory in your PR description.

---

## Contributing a doc improvement

Typos, clarifications, broken links, missing context — open a PR with the fix. No issue needed for doc changes.

---

## Coding style (for `registry/` and `runtime/`)

The Stack will eventually include Python code for the MCP registry server and runtime helpers. When that code lands, contributions follow these conventions:

- **Python 3.12+** target
- **Black** for formatting (line length 100)
- **Ruff** for linting
- **Type hints** on public functions
- **Pytest** for tests
- **Docstrings** in numpy style

The `registry/` and `runtime/` folders will include their own CI workflows that enforce the above on every PR.

---

## What this project is not

To set expectations:

- **Not a SaaS product.** No hosted runtime, no paid tier. The Stack is the asset; you run it on your own hardware.
- **Not financial advice.** Agents help you do Finance work; they don't decide what your numbers should be.
- **Not a substitute for an accountant.** Every accrual the Controller agent prepares surfaces for human approval. Same for every other agent's output.
- **Not enterprise software.** The Stack works well at startup / growth-stage scale. Multi-entity, multi-currency, multi-thousand-user setups need more than what's here.

---

## Code of conduct

Be kind. Assume good faith. Disagree with ideas, not people. The Finance AI community is small and growing — every interaction here ripples.

---

## Maintainer

Sanjay Raghavan · [Substack](https://sanjayraghavan.substack.com) · [LinkedIn](https://www.linkedin.com/in/sanjayraghavan)
