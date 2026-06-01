# The AI Finance Stack — MCP Registry Worker

A Cloudflare Worker that serves The AI Finance Stack's catalog of agents and shared skills as an MCP server. Once deployed, anyone running an MCP-compatible AI client (Claude Desktop, Claude Code) can browse and install agents by pointing their client at the Worker's URL.

```
Claude Desktop  →  https://the-ai-finance-stack.sanjayraghavan.workers.dev/sse
                          ↓
                   This Cloudflare Worker
                          ↓
            Catalog (bundled) + GitHub raw (on demand)
                          ↓
                  Agent files returned to client
                          ↓
                   Client writes them to disk
```

---

## What the registry exposes

Six MCP tools the client can call:

| Tool | What it does |
|---|---|
| `about` | Returns Stack metadata (version, repo URL, license, total agents/skills) |
| `browse_agents` | Lists all 12 agents with id, handle, function, pack, description, required MCPs. Optional `pack` filter. |
| `get_agent_detail` | Returns one agent's CLAUDE.md, config.yaml, and README from the public GitHub repo |
| `download_agent_package` | Returns every file in an agent's folder (CLAUDE.md + config + README + all skills) as a JSON bundle ready to write to disk. Optionally includes the agent's stack-shared skill files. |
| `list_shared_skills` | Lists all stack-shared skills (currently 3: proposal-format, approval-record-format, slack-conventions) |
| `get_shared_skill` | Returns one shared skill's full content |

Plus three HTTP endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /` | Human-readable landing page with install snippet |
| `GET /catalog` | Full catalog as JSON (no MCP client needed to inspect — handy for verification) |
| `GET /sse` | MCP SSE transport endpoint — the URL Claude Desktop config points at |
| `POST /mcp` | MCP Streamable HTTP transport endpoint (newer clients) |

---

## Deploy (first time)

Prerequisites:
- Node.js 18+
- A Cloudflare account ([free signup](https://dash.cloudflare.com/sign-up))
- Wrangler CLI: `npm install -g wrangler`

Then from this directory:

```bash
# 1. Install dependencies
npm install

# 2. Authenticate to Cloudflare (opens browser)
wrangler login

# 3. Deploy
wrangler deploy
```

Wrangler will print the deployed URL, typically:
`https://the-ai-finance-stack.<your-cloudflare-subdomain>.workers.dev`

Visit that URL in a browser — you should see the landing page. Visit `/catalog` to verify the JSON catalog loads. The deploy worked.

---

## Test it as an MCP client

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "the-ai-finance-stack": {
      "url": "https://the-ai-finance-stack.<your-subdomain>.workers.dev/sse"
    }
  }
}
```

Restart Claude Desktop. In a new conversation:

> *"What agents are available in The AI Finance Stack registry?"*

Claude should call `browse_agents` and return the 12-agent list.

> *"Show me the QBO Poster's CLAUDE.md."*

Claude calls `get_agent_detail` and shows the agent's identity doc.

> *"Install the Controller agent into my project."*

Claude calls `download_agent_package` and writes the files to your project folder.

---

## Subsequent deploys

After changing `src/index.ts` or `src/catalog.ts` (e.g., adding a new agent to the catalog):

```bash
wrangler deploy
```

That's it — `wrangler deploy` handles building and uploading. The deployed URL stays the same.

Watch live logs from the deployed Worker:

```bash
wrangler tail
```

Useful for debugging when a Claude Desktop client connects and you want to see what tools it's calling.

---

## Local dev (optional)

To test changes locally without deploying:

```bash
npm run dev
```

This runs a local Cloudflare Worker on `http://localhost:8787`. You can point a local MCP client at `http://localhost:8787/sse` to test before deploying.

---

## Architecture choices

**Why Cloudflare Workers?** Free tier covers our usage easily. No servers to maintain. Global edge — low latency from anywhere. Wrangler-based deploys are reproducible.

**Why bundle the catalog in `catalog.ts` instead of fetching it?** The catalog rarely changes (new agents ship maybe weekly). Bundling means zero cold-start latency and zero dependency on GitHub being reachable for browse/list operations. Full agent content is still fetched from GitHub on demand (in `get_agent_detail` and `download_agent_package`) — that data is too big to bundle and changes more often.

**Why both `/sse` and `/mcp` endpoints?** SSE is the established transport that Claude Desktop's config format supports today. Streamable HTTP is the newer MCP transport. Supporting both keeps the registry compatible with the broadest set of clients.

**Why Durable Objects?** The `McpAgent` base class (from the `agents` SDK) uses a Durable Object to maintain MCP session state across SSE connection lifecycle. SQLite-backed Durable Objects are free on Cloudflare's plan.

---

## Updating the catalog when new agents ship

When a new agent ships to the repo (e.g., a Tax agent in v0.2):

1. Add an entry to the `AGENTS` array in `src/catalog.ts`
2. `wrangler deploy`

That's it. The Worker picks up the new entry; any MCP client calling `browse_agents` immediately sees the new agent. The agent's content (CLAUDE.md, config.yaml, etc.) is fetched live from the GitHub repo, so as long as the repo files exist at the expected paths, `get_agent_detail` and `download_agent_package` work without further changes.

---

*Part of [The AI Finance Stack](https://github.com/sanjay-raghavan/the-ai-finance-stack) · MIT License · Author: Sanjay Raghavan*
