# Quick Start — Install The AI Finance Stack in 30 Minutes

The fastest path from "I read about The AI Finance Stack" to "Controller is running on my actual data and posting to my Slack."

There are **two install paths**. Pick the one that matches where you are.

- **Path A — "I just want to try one agent"** — install Controller in Claude Desktop, point it at sample data, see what it does. ~15 minutes. No dedicated laptop needed.
- **Path B — "I want the full setup, agents running on schedule"** — set up a dedicated Mac, install all 8 agents, schedule them with launchd. ~2 hours the first time. See [`SETUP_DEDICATED_LAPTOP.md`](./SETUP_DEDICATED_LAPTOP.md).

This guide covers Path A. Start here; graduate to Path B when you're ready.

---

## Before you start — prerequisites

You'll need:

- **A Mac, Windows, or Linux machine** running Claude Desktop or Claude Code
- **An Anthropic API key** (the agents call Claude via the API; bring your own key)
- **Slack workspace** access — for the agent to post summaries (optional for first run; can use local files only)
- **30 minutes** the first time

You do **not** need:

- A finance license (the agents read from your accounting system; they don't write to it)
- Any code experience beyond pasting a few commands
- A dedicated laptop yet (Path B handles that)

---

## Step 1 — Install Claude Desktop (or Claude Code)

Skip this step if you already use either.

**Claude Desktop** — download from [claude.com/download](https://claude.com/download). Sign in with your Anthropic account. This is the friendlier of the two clients and the one this guide assumes.

**Claude Code** — install from [claude.com/code](https://claude.com/code). Better for technical users who prefer the terminal. Same install steps for Stack agents, slightly different config file location.

---

## Step 2 — Get The AI Finance Stack on your machine

Two options:

### Option A — Clone the repo (recommended; gets you updates)

```bash
cd ~
git clone https://github.com/<your-username>/the-ai-finance-stack.git
cd the-ai-finance-stack
```

If you don't have `git`, install it from [git-scm.com](https://git-scm.com) or with Homebrew: `brew install git`.

### Option B — Download the ZIP

From the repo's GitHub page, click **Code** → **Download ZIP**. Extract it into `~/the-ai-finance-stack/`.

### Option C (future) — MCP registry install

Once The AI Finance Stack's MCP registry is live, you'll add this to `claude_desktop_config.json` and never need to clone anything:

```json
{
  "mcpServers": {
    "the-ai-finance-stack": {
      "url": "https://theaifinancestack.com/mcp/registry"
    }
  }
}
```

Then in Claude: *"Browse The AI Finance Stack and install Controller."* For now (v0.1), use Option A or B.

---

## Step 3 — Set up your environment

Create a `~/.finance-stack/` directory to hold your local config and secrets:

```bash
mkdir -p ~/.finance-stack
mkdir -p ~/finance-data
mkdir -p ~/finance-logs
```

Inside `~/.finance-stack/`, create a `secrets.env` file (don't check this into Git):

```
ANTHROPIC_API_KEY=sk-ant-...
SLACK_BOT_TOKEN=xoxb-...     # optional, only if you want Slack notifications
QUICKBOOKS_CLIENT_ID=...     # see Step 4
QUICKBOOKS_CLIENT_SECRET=...
```

Lock it down:

```bash
chmod 600 ~/.finance-stack/secrets.env
```

---

## Step 4 — Connect at least one MCP for the agent to use

Controller needs **one accounting MCP** (QuickBooks, Xero, or NetSuite) and **Slack** (or nothing — you can run without notifications for the first test).

### Easiest first connection: QuickBooks via the Anthropic MCP marketplace

In Claude Desktop:

1. Settings → **MCP Connectors**
2. Click **Browse**
3. Find **QuickBooks** (or **Xero**, or **NetSuite**)
4. Click **Connect** → follow the OAuth flow → authorize your sandbox or production account
5. Done

Repeat for Slack if you want notifications (skip for first run if not).

If your accounting system isn't in the marketplace yet, you can run Controller in **sample-data mode** for the first run — see Step 7.

---

## Step 5 — Tell Claude Desktop about Controller

Open Claude Desktop → **Settings** → **Developer** → **Edit Config** (this opens `claude_desktop_config.json`).

Add the Stack as a local agent directory:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/<your-username>/the-ai-finance-stack/agents/controller",
        "/Users/<your-username>/finance-data"
      ]
    },
    "quickbooks": { "command": "...", "args": [...] }
  }
}
```

This gives Claude Desktop access to Controller's package files and your local Finance data directory. Restart Claude Desktop after saving.

---

## Step 6 — Verify the install

In Claude Desktop, start a new chat and ask:

> *"Read the CLAUDE.md from the controller agent folder. Confirm you understand its role and its required MCPs."*

Claude should respond by summarizing Controller's purpose, the 5-pass close workflow, and the required MCPs. If it can't find the file, the filesystem MCP isn't set up correctly — re-check Step 5.

---

## Step 7 — Your first Controller run (sample data)

Try a dry run against sample data before pointing it at your real accounting system.

In Claude Desktop:

> *"Acting as the Controller agent (read its CLAUDE.md and config.yaml first), generate the close calendar for the previous month. Save it to ~/finance-data/closes/sample/close-calendar.md. Skip the MCP calls — use this assumption set: target close in 3 business days, no one-time events, standard recurring accruals only."*

You should get back a `close-calendar.md` file with a task list, day-by-day sequencing, and a critical path. That's Controller's Pass 1 working end-to-end.

Inspect the file. Did the structure match what you'd expect a senior controller to produce? If yes — Controller's reasoning is sound and you're ready to point it at real data. If not — note the gap; this is where you'd customize the agent.

---

## Step 8 — Point Controller at your real data

Once the dry run looks right:

> *"Run Controller's Pass 1 for [current month] against the connected QuickBooks data. Save the output to ~/finance-data/closes/<year>-<month>/close-calendar.md and post a summary to #finance-ops."*

Controller will:
1. Call the QuickBooks MCP to pull current-period context
2. Generate the close calendar using `finance:close-management`
3. Save the artifact
4. Post the summary to Slack

If `#finance-ops` doesn't exist yet in your Slack, create it now (or change the channel name in `config.yaml`).

---

## What to do next

You've now got Controller running interactively (Path A). To graduate to **always-on** (Path B):

- Set up a dedicated Mac via [`SETUP_DEDICATED_LAPTOP.md`](./SETUP_DEDICATED_LAPTOP.md)
- Configure launchd to run Controller on schedule (Day 1 / 2 / 3 of close)
- Install additional Stack agents (AP Watcher, FP&A Analyst, Treasury, etc.)
- Connect their respective MCPs

Each agent has its own README with install steps specific to that role.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "Cannot find CLAUDE.md" | Filesystem MCP path wrong | Re-check the path in `claude_desktop_config.json` |
| QuickBooks MCP fails to authenticate | OAuth token expired | Disconnect and reconnect via Settings → MCP Connectors |
| Controller produces nothing | Required MCP missing or skill not invocable | Check the agent's `config.yaml` for `mcps.required:` and confirm each is connected |
| Slack notification doesn't arrive | Wrong channel name or missing scope | Verify channel in `config.yaml`; confirm Slack bot has `chat:write` scope |
| Controller proposes accruals that look off | Prior-period data wasn't pulled | Check audit-trail section of the output — what sources were referenced? |
| `~/finance-data/` permission denied | Wrong file ownership | `chmod -R 700 ~/finance-data` and verify the directory was created by your user |

---

## How to get help

- Open an issue on the [GitHub repo](https://github.com/<your-username>/the-ai-finance-stack/issues)
- Drop a question on the [AI-Powered Finance Substack](https://sanjayraghavan.substack.com) post comments
- Join the [Finney "AI in Finance" Slack](https://finney.finance)

---

## Where to read next

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — how the three layers fit together (agents · runtime · registry)
- **[AGENT_PACKAGE_FORMAT.md](./AGENT_PACKAGE_FORMAT.md)** — the spec, in case you want to author your own agent
- **[SETUP_DEDICATED_LAPTOP.md](./SETUP_DEDICATED_LAPTOP.md)** — the always-on Tier-5 setup
- **[CURRICULUM_MAP.md](./CURRICULUM_MAP.md)** — which AI-Powered Finance lesson teaches which agent in depth
