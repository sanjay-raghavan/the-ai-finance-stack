// The AI Finance Stack — MCP Registry Worker
// =============================================
// Exposes the Stack's catalog of agents and shared skills as MCP tools that
// any MCP-compatible AI client (Claude Desktop, Claude Code, etc.) can call.
//
// Endpoints:
//   GET  /          — human-readable landing page
//   GET  /catalog   — JSON catalog (no auth, browse-only)
//   GET  /sse       — legacy SSE MCP transport (used by Claude Desktop today)
//   POST /mcp       — Streamable HTTP MCP transport (newer clients)
//
// All catalog data is bundled in src/catalog.ts. Full agent package content
// (CLAUDE.md, config.yaml, skill files) is fetched on demand from the public
// GitHub repo — see RAW_BASE in catalog.ts.

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  AGENTS,
  SHARED_SKILLS,
  RAW_BASE,
  REPO_URL,
  findAgent,
  findSkill,
  agentPackagePaths,
  type Pack,
} from "./catalog";

// ────────────────────────────────────────────────────────────────────────────
// MCP server: defines the tools we expose
// ────────────────────────────────────────────────────────────────────────────

export class FinanceStackMCP extends McpAgent {
  server = new McpServer({
    name: "the-ai-finance-stack",
    version: "0.1.0",
  });

  async init(): Promise<void> {
    // ───── browse_agents ─────────────────────────────────────────────────
    this.server.tool(
      "browse_agents",
      "List all agents in The AI Finance Stack. Returns each agent's id, handle, name, function, pack (core / crypto / execution), one-line description, and required MCPs. Use this first to discover what's available; then call get_agent_detail for the agents you care about.",
      {
        pack: z
          .enum(["core", "crypto", "execution"])
          .optional()
          .describe("Filter to a specific pack. Omit to return all packs."),
      },
      async ({ pack }) => {
        const filtered = pack ? AGENTS.filter((a) => a.pack === pack) : AGENTS;
        const summary = filtered.map((a) => ({
          id: a.id,
          handle: a.handle,
          name: a.name,
          function: a.function,
          pack: a.pack,
          writes_to_gl: a.writes_to_gl,
          description: a.description,
          mcps_required: a.mcps_required,
          status: a.status,
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  registry: "the-ai-finance-stack",
                  version: "0.1.0",
                  repo: REPO_URL,
                  total_agents: filtered.length,
                  agents: summary,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // ───── get_agent_detail ─────────────────────────────────────────────
    this.server.tool(
      "get_agent_detail",
      "Get the full description of a single agent: its CLAUDE.md (identity + operating doctrine), its config.yaml (MCPs, schedules, goals, thresholds), and its README (install + usage). Use the agent's `id` from browse_agents.",
      {
        agent_id: z
          .string()
          .describe(
            "The agent's id, e.g. 'controller', 'qbo-poster', 'prepay-manager'.",
          ),
      },
      async ({ agent_id }) => {
        const agent = findAgent(agent_id);
        if (!agent) {
          return {
            content: [
              {
                type: "text",
                text: `Agent '${agent_id}' not found. Call browse_agents to see available ids.`,
              },
            ],
            isError: true,
          };
        }

        // Fetch the three core files from the public GitHub repo
        const [claudeMd, configYaml, readme] = await Promise.all([
          fetchRepoFile(`agents/${agent_id}/CLAUDE.md`),
          fetchRepoFile(`agents/${agent_id}/config.yaml`),
          fetchRepoFile(`agents/${agent_id}/README.md`),
        ]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  agent: {
                    id: agent.id,
                    handle: agent.handle,
                    name: agent.name,
                    function: agent.function,
                    pack: agent.pack,
                    writes_to_gl: agent.writes_to_gl,
                    description: agent.description,
                    mcps_required: agent.mcps_required,
                    agent_skills: agent.agent_skills,
                    stack_skills: agent.stack_skills,
                    status: agent.status,
                  },
                  files: {
                    "CLAUDE.md": claudeMd,
                    "config.yaml": configYaml,
                    "README.md": readme,
                  },
                  install_hint:
                    "To install: download_agent_package(agent_id) returns every file in the agent's folder ready to write to disk. The user's runtime (Claude Desktop / Claude Code) should write them under agents/<id>/.",
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // ───── download_agent_package ───────────────────────────────────────
    this.server.tool(
      "download_agent_package",
      "Return the complete agent package as a JSON bundle: CLAUDE.md, config.yaml, README.md, and every skill file in the agent's skills/ folder. The calling runtime should write these to disk under agents/<id>/ to install the agent locally.",
      {
        agent_id: z
          .string()
          .describe(
            "The agent's id, e.g. 'controller', 'qbo-poster'. See browse_agents for available ids.",
          ),
        include_stack_skills: z
          .boolean()
          .optional()
          .describe(
            "If true, also include the content of all stack:* shared skills this agent imports. Defaults to true.",
          ),
      },
      async ({ agent_id, include_stack_skills = true }) => {
        const agent = findAgent(agent_id);
        if (!agent) {
          return {
            content: [
              {
                type: "text",
                text: `Agent '${agent_id}' not found. Call browse_agents to see available ids.`,
              },
            ],
            isError: true,
          };
        }

        // Core agent files
        const filesObj: Record<string, string> = {};
        for (const path of agentPackagePaths(agent_id)) {
          filesObj[path] = await fetchRepoFile(path);
        }

        // Agent-private skill files
        for (const skill of agent.agent_skills) {
          const p = `agents/${agent_id}/skills/${skill}.md`;
          filesObj[p] = await fetchRepoFile(p);
        }

        // Stack-shared skills (optionally bundled)
        if (include_stack_skills) {
          for (const stackSkill of agent.stack_skills) {
            const id = stackSkill.replace(/^stack:/, "");
            const p = `skills/${id}.md`;
            filesObj[p] = await fetchRepoFile(p);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  agent_id,
                  agent_name: agent.name,
                  total_files: Object.keys(filesObj).length,
                  install_instructions:
                    "Write each file to its path under your local repo or project folder. The 'agents/<id>/...' paths go into your dedicated runtime. The 'skills/...' paths go into the shared skill layer (alongside other shared skills).",
                  files: filesObj,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // ───── list_shared_skills ───────────────────────────────────────────
    this.server.tool(
      "list_shared_skills",
      "List the shared skills (stack:*) that multiple agents in the Stack import. These are canonical schemas and methodologies — proposal-format, approval-record-format, slack-conventions, etc.",
      {},
      async () => {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total_skills: SHARED_SKILLS.length,
                  skills: SHARED_SKILLS,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // ───── get_shared_skill ─────────────────────────────────────────────
    this.server.tool(
      "get_shared_skill",
      "Get the full content of a single shared skill by id. Skills are markdown files that capture one capability completely.",
      {
        skill_id: z
          .string()
          .describe(
            "The skill id (without the 'stack:' prefix), e.g. 'proposal-format', 'approval-record-format', 'slack-conventions'.",
          ),
      },
      async ({ skill_id }) => {
        const skill = findSkill(skill_id);
        if (!skill) {
          return {
            content: [
              {
                type: "text",
                text: `Shared skill '${skill_id}' not found. Call list_shared_skills to see available ids.`,
              },
            ],
            isError: true,
          };
        }
        const content = await fetchRepoFile(`skills/${skill_id}.md`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  skill: {
                    id: skill.id,
                    name: skill.name,
                    description: skill.description,
                    used_by: skill.used_by,
                    status: skill.status,
                  },
                  filepath: `skills/${skill_id}.md`,
                  content,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    // ───── about ─────────────────────────────────────────────────────────
    this.server.tool(
      "about",
      "Return information about The AI Finance Stack — what it is, who built it, where the canonical source lives, and the licensing.",
      {},
      async () => {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  name: "The AI Finance Stack",
                  version: "0.1.0",
                  description:
                    "A free, open-source collection of Finance AI agents that run on your own machine. 12 agents across 3 packs (10 core + 1 crypto + 1 execution) plus 3 shared skills plus a four-tier MCP integration framework. The architecturally distinctive idea: propose → human approve → post.",
                  author: "Sanjay Raghavan",
                  license: "MIT",
                  repo: REPO_URL,
                  substack: "https://sanjayraghavan.substack.com",
                  total_agents: AGENTS.length,
                  total_shared_skills: SHARED_SKILLS.length,
                  packs: ["core", "crypto", "execution"] as Pack[],
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: fetch a file from the public GitHub repo
// ────────────────────────────────────────────────────────────────────────────

async function fetchRepoFile(path: string): Promise<string> {
  const url = `${RAW_BASE}/${path}`;
  try {
    const res = await fetch(url, {
      cf: {
        // Cache at the edge for 5 min to soften GitHub rate limits.
        cacheTtl: 300,
        cacheEverything: true,
      },
    });
    if (!res.ok) {
      return `[Not found: ${path}. The registry attempted to fetch from ${url} and got HTTP ${res.status}. The file may not exist in the repo yet (some skills/agents are queued for v0.2).]`;
    }
    return await res.text();
  } catch (err) {
    return `[Error fetching ${path}: ${
      err instanceof Error ? err.message : String(err)
    }]`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cloudflare Worker entry point — routes requests to MCP transports + pages
// ────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(
    request: Request,
    env: any,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // SSE transport — legacy/widely supported. Claude Desktop config uses this.
    if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
      // @ts-ignore - serveSSE is provided by the agents/mcp McpAgent class
      return FinanceStackMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    // Streamable HTTP transport — newer MCP clients.
    if (url.pathname === "/mcp") {
      // @ts-ignore - serve is provided by the agents/mcp McpAgent class
      return FinanceStackMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // JSON catalog endpoint (no MCP framing) — easy to verify the deploy
    // worked without setting up an MCP client.
    if (url.pathname === "/catalog") {
      return new Response(
        JSON.stringify(
          {
            registry: "the-ai-finance-stack",
            version: "0.1.0",
            repo: REPO_URL,
            total_agents: AGENTS.length,
            total_shared_skills: SHARED_SKILLS.length,
            agents: AGENTS,
            shared_skills: SHARED_SKILLS,
          },
          null,
          2,
        ),
        {
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }

    // Landing page — human-readable summary, install instructions.
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(LANDING_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // License page (MIT) — also serves as the EULA for Intuit / vendor reviews.
    if (url.pathname === "/license" || url.pathname === "/license.html") {
      return new Response(LICENSE_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Privacy policy — required for Intuit Production app review + other vendors.
    if (url.pathname === "/privacy" || url.pathname === "/privacy.html") {
      return new Response(PRIVACY_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Launch URL — registered with Intuit; where users land after authentication.
    if (url.pathname === "/launch" || url.pathname === "/launch.html") {
      return new Response(LAUNCH_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Connect / Reconnect URL — registered with Intuit; where users connect QBO.
    if (url.pathname === "/connect" || url.pathname === "/connect.html") {
      return new Response(CONNECT_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Disconnect URL — registered with Intuit; where users go to disconnect.
    if (url.pathname === "/disconnect" || url.pathname === "/disconnect.html") {
      return new Response(DISCONNECT_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // OAuth callback proxy for Intuit Production. Intuit requires HTTPS for
    // production redirect URIs, but desktop apps need to capture the callback
    // locally on the user's machine. We register this HTTPS endpoint with
    // Intuit and 302-redirect to http://localhost:8765/callback so the user's
    // local MCP server can capture the auth code transparently.
    //
    // This is the standard "OAuth proxy" pattern for desktop apps that need
    // to satisfy HTTPS-redirect policies. The query params (code, state,
    // realmId) pass through unchanged.
    if (url.pathname === "/oauth-callback") {
      return Response.redirect(
        `http://localhost:8765/callback${url.search}`,
        302,
      );
    }

    return new Response("Not found.", { status: 404 });
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Landing page
// ────────────────────────────────────────────────────────────────────────────

const LANDING_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The AI Finance Stack — MCP Registry</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           max-width: 780px; margin: 60px auto; padding: 0 20px; line-height: 1.55;
           color: #111; }
    h1 { font-size: 2.2rem; margin-bottom: 0.25em; line-height: 1.2; }
    h2 { font-size: 1.4rem; margin-top: 2.2em; margin-bottom: 0.5em;
         border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    h3 { font-size: 1.1rem; margin-top: 1.6em; margin-bottom: 0.4em; color: #333; }
    .subtitle { color: #555; margin-bottom: 2em; font-size: 1.1rem; }
    .hero { background: #f8fafc; border-left: 4px solid #0066cc; padding: 16px 20px;
            margin: 1.5em 0; font-size: 1.02rem; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px;
           font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em;
          line-height: 1.5; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .pack { display: inline-block; padding: 2px 8px; border-radius: 4px;
            font-size: 0.78em; font-weight: 600; margin-right: 6px; vertical-align: middle; }
    .pack-core { background: #e3f2fd; color: #1565c0; }
    .pack-crypto { background: #fff3e0; color: #e65100; }
    .pack-execution { background: #fce4ec; color: #c2185b; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.95em; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e5e5;
             vertical-align: top; }
    th { background: #fafafa; font-weight: 600; }
    .status-shipped { color: #1b5e20; font-weight: 600; font-size: 0.85em; }
    .status-v02 { color: #6c757d; font-size: 0.85em; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 1em 0; }
    .grid-2 > div { background: #fafafa; padding: 16px; border-radius: 8px; }
    @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
    .arch-box { background: #f8f9fa; border: 1px solid #e5e5e5; border-radius: 8px;
                padding: 16px 20px; margin: 1em 0; }
    .footer { margin-top: 4em; padding-top: 2em; border-top: 1px solid #e5e5e5;
              color: #888; font-size: 0.88em; }
  </style>
</head>
<body>
  <h1>The AI Finance Stack</h1>
  <p class="subtitle">An open-source AI Finance team — designed around <em>propose → human approve → post</em> discipline. Runs on your own machine, under your own credentials, with auditable provenance for every entry on your books.</p>

  <div class="hero">
    <strong>v0.1 inventory:</strong> 12 agents across 3 packs, 3 shipped shared skills (with 6 more queued for v0.2), and a 4-tier MCP integration framework covering 8 bundled local connectors for the tools where official MCPs are missing or admin-gated. MIT-licensed.
  </div>

  <div class="hero" style="background:#f4f8ff;border-color:#4a6fa5;">
    <strong>New in v0.2 — the customization layer.</strong> A <code>customization/</code> folder convention plus a <code>setup-org</code> skill that walks you through grounding every agent in your specific books: tagged chart of accounts, non-GAAP rules (declarative YAML — works for SaaS, crypto, real-estate), output templates, and writing voice. ~30 minutes once; every agent in the Stack then speaks your books. See <code>customization-stub/README.md</code> in the repo.
  </div>

  <h2>How it works in 3 steps</h2>
  <div class="grid-2">
    <div>
      <strong>1. Install</strong><br/>
      Clone the repo, drop the config snippet below into Claude Desktop, paste your Anthropic API key. ~10 minutes. You'll see "Browse The AI Finance Stack" in Claude Desktop.
    </div>
    <div>
      <strong>2. Customize for your books</strong><br/>
      Run the <code>setup-org</code> skill. Upload your CoA, declare non-GAAP rules in plain English, drop in your board-deck and exec-update templates. ~30 minutes, one-time.
    </div>
    <div>
      <strong>3. Schedule, or run on-demand</strong><br/>
      Install agents once; they fire on their built-in schedule. Or just ask in Claude Desktop: <em>"Close the books for May"</em>, <em>"What's our cash position?"</em>, <em>"Draft the investor update."</em>
    </div>
    <div>
      <strong>Then: one human + one accountant + 12 agents = a full Finance function.</strong><br/>
      You stay in the loop for every JE approval. Everything else the agents handle, watch, and surface only when you need to decide.
    </div>
  </div>

  <h2>Install</h2>
  <p>Paste this into your Claude Desktop config file:</p>
  <ul>
    <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
    <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
    <li><strong>Linux:</strong> <code>~/.config/Claude/claude_desktop_config.json</code></li>
  </ul>
  <pre>{
  "mcpServers": {
    "the-ai-finance-stack": {
      "url": "https://the-ai-finance-stack.sanjayraghavan.workers.dev/sse"
    }
  }
}</pre>
  <p>Restart Claude Desktop, then in a fresh conversation ask:
  <em>"What agents are available in the-ai-finance-stack registry?"</em> — Claude calls <code>browse_agents</code> and returns the full catalog. From there you can have Claude install specific agents into your project folder, customize them, and run them.</p>

  <p><strong>Start here →</strong> <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/START_HERE.md"><code>START_HERE.md</code></a> for the 1-page friendly entry · <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/MEET_YOUR_AGENTS.md"><code>MEET_YOUR_AGENTS.md</code></a> for the team roster · <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/YOUR_FIRST_CLOSE.md"><code>YOUR_FIRST_CLOSE.md</code></a> for an hour-by-hour walkthrough of closing your first month.</p>

  <p><strong>Production setup (dedicated runtime running agents on schedule):</strong> any always-on machine works — a spare laptop you own, a Mac mini or NUC (~$300–600 one-time), or a VPS like Hetzner / Lightsail / DigitalOcean (~$5–15/mo). Guides: <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/SETUP_DEDICATED_LAPTOP.md"><code>SETUP_DEDICATED_LAPTOP.md</code></a> for Mac · <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/SETUP_DEDICATED_LAPTOP_WINDOWS.md"><code>SETUP_DEDICATED_LAPTOP_WINDOWS.md</code></a> for Windows. The Windows guide is v0.1 draft pending validation — Linux/VPS guide planned.</p>

  <p><strong>Scaling to a finance team?</strong> The agents only run on one machine (the dedicated laptop). The rest of your team participates through Slack — read posts, approve JE proposals with <code>/approve &lt;id&gt;</code>, DM agents for ad-hoc questions. No team-member install needed regardless of their OS. See the <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/ARCHITECTURE.md#scaling-from-one-human-to-a-whole-finance-team">"Scaling from one human to a whole finance team"</a> section of <code>ARCHITECTURE.md</code>.</p>

  <h2>The 12 agents (v0.1)</h2>

  <h3><span class="pack pack-core">core</span> 10 agents — universal Finance functions</h3>
  <table>
    <tr><th>Agent</th><th>Function</th><th>What it owns</th></tr>
    <tr><td><strong>Controller</strong></td><td>Accounting</td><td>Month-end close, accruals, reconciliations, status reports</td></tr>
    <tr><td><strong>FP&A Analyst</strong></td><td>FP&A</td><td>Variance with driver decomposition; rolling forecast; scenarios; 2-week annual budget cycle + quarterly re-forecast</td></tr>
    <tr><td><strong>Treasury</strong></td><td>Treasury</td><td>Cash position; 13-week projection; runway calc with confidence bands. PSP-aware.</td></tr>
    <tr><td><strong>Investor Relations</strong></td><td>IR</td><td>Monthly investor update drafts; board pre-reader; KPI watching</td></tr>
    <tr><td><strong>AP Watcher</strong></td><td>AP</td><td>Invoice validation, duplicate detection, vendor contracts, month-end accrual proposals</td></tr>
    <tr><td><strong>AR Follow-Up</strong></td><td>AR</td><td>Aging-based collection drafts in tone-matched bands (Good/Standard/Repeat-Late/Chronic), DSO tracking</td></tr>
    <tr><td><strong>Revenue Ops</strong></td><td>RevOps</td><td>Commission calculations, ARR reconciliation, deal-desk support</td></tr>
    <tr><td><strong>Payroll Reviewer</strong></td><td>Payroll</td><td>Pre-run variance review, headcount cost tracking. Privacy-scoped, restricted channel.</td></tr>
    <tr><td><strong>Prepay Manager</strong></td><td>Accounting</td><td>Full prepayment lifecycle: identification, schedule generation, monthly amortization proposals, reconciliation</td></tr>
    <tr><td><strong>Bank Recon</strong></td><td>Cash & Banking</td><td>Daily transaction matching, unmatched investigation, period-end attestation. Context-aware (uses AP/AR/Treasury outputs).</td></tr>
  </table>

  <h3><span class="pack pack-crypto">crypto pack</span> 1 agent — for companies with tokens on the balance sheet</h3>
  <table>
    <tr><th>Agent</th><th>What it owns</th></tr>
    <tr><td><strong>Crypto Reconciler</strong></td><td>Multi-chain wallet reconciliation, gas/fee separation, cost-basis sanity checks. For Tres Finance / Bitwave / on-chain subledgers.</td></tr>
  </table>

  <h3><span class="pack pack-execution">execution pack</span> 1 agent — the only write-capable agents</h3>
  <table>
    <tr><th>Agent</th><th>What it owns</th></tr>
    <tr><td><strong>QBO Poster</strong></td><td>The only agent permitted to write to QuickBooks Online. Reads approval records, runs 8-check validation, posts to QBO via MCP, verifies the post landed, writes immutable confirmation. Idempotent. Halts on anything unexpected.</td></tr>
  </table>

  <h2>The architecturally distinctive idea</h2>
  <p>Most "AI for Finance" projects let agents post to the GL directly. That's how silent failures happen, how closed-period entries sneak through, and how auditors lose confidence in your books.</p>
  <p>This Stack inverts that: <strong>every JE-writing agent proposes; exactly one execution-pack agent posts — and only after explicit human approval, validated through 8 checks</strong> (authorized approver, content-hash integrity, period not closed, accounts active, idempotency, approver limits, approval recency, structural validity). One Slack reply per entry. An AI Finance team you can deploy in production without losing sleep.</p>

  <div class="arch-box">
    <strong>The flow:</strong><br/>
    Proposing agent (Controller, Prepay Manager, AP Watcher, Bank Recon, etc.) writes a proposal →
    Slack approval request posted in <code>#finance-approvals</code> →
    Human types <code>/approve &lt;proposal-id&gt;</code> →
    Approval handler writes record with SHA-256 hash →
    QBO Poster validates (8 checks) and commits →
    Confirmation written, audit log appended, Slack thread replied.
  </div>

  <h2>Shared skill layer</h2>
  <p>The foundation that prevents schema drift across agents. When multiple agents need the same canonical schema, methodology, or format, it lives in <code>skills/</code> at the repo root and any agent imports it as <code>stack:&lt;name&gt;</code>. Also invokable directly by a human in Claude Desktop — no agent required.</p>

  <table>
    <tr><th>Shared skill</th><th>What it standardizes</th><th>Status</th></tr>
    <tr><td><code>stack:proposal-format</code></td><td>Canonical JE proposal schema (8 agents import it)</td><td class="status-shipped">v0.1 — shipped</td></tr>
    <tr><td><code>stack:approval-record-format</code></td><td>Canonical approval record (auth, content hash, integrity)</td><td class="status-shipped">v0.1 — shipped</td></tr>
    <tr><td><code>stack:slack-conventions</code></td><td>Channel routing, severity emojis, mention rules, link format</td><td class="status-shipped">v0.1 — shipped</td></tr>
    <tr><td><code>stack:qbo-query-recipes</code></td><td>The playbook every QBO-touching agent follows — resolve via customization/ first, then call MCPs</td><td class="status-shipped">v0.2 — shipped</td></tr>
    <tr><td><code>stack:finance-view-switch</code></td><td>Generic GAAP/Non-GAAP P&L + bridge (reads non-gaap-rules.yaml — works for SaaS, crypto, real-estate)</td><td class="status-shipped">v0.2 — shipped</td></tr>
    <tr><td><code>stack:setup-org</code></td><td>Interactive ~30 min walkthrough to populate <code>customization/</code> for a new org</td><td class="status-shipped">v0.2 — shipped</td></tr>
    <tr><td><code>stack:audit-log-entry</code></td><td>JSONL schema for every agent's audit log</td><td class="status-v02">v0.2</td></tr>
    <tr><td><code>stack:variance-narrative</code></td><td>Driver-aware variance commentary</td><td class="status-v02">v0.2</td></tr>
    <tr><td><code>stack:driver-decomposition</code></td><td>Volume × Rate × Mix + Headcount × Cost-per-Head</td><td class="status-v02">v0.2</td></tr>
    <tr><td><code>stack:kpi-snapshot</code></td><td>Canonical KPI extraction format</td><td class="status-v02">v0.2</td></tr>
    <tr><td><code>stack:close-packet-format</code></td><td>Controller's close artifact structure</td><td class="status-v02">v0.2</td></tr>
    <tr><td><code>stack:budget-checker</code></td><td>Query a budget XLSX for vendors / GL codes / employees</td><td class="status-v02">v0.2</td></tr>
  </table>

  <h2>MCP integration — the four-tier framework</h2>
  <p>The MCP ecosystem for finance tools is uneven: some have great official MCPs (Slack, Gmail, Box, Notion), some have admin-gated MCPs that block non-admin users (QuickBooks), some have nothing (Mercury, Stripe, Brex). The Stack uses a four-tier hierarchy so agents work regardless:</p>

  <table>
    <tr><th>Tier</th><th>When to use</th><th>Examples</th></tr>
    <tr><td><strong>1. Official MCP</strong></td><td>Vendor's MCP works at user scope</td><td>Slack, Gmail, Notion, Box, Google Calendar</td></tr>
    <tr><td><strong>2. Bundled local MCP</strong></td><td>Official is admin-gated or missing</td><td>qbo, bill-com, ramp, mercury, stripe, brex, rippling, carta <em>(all v0.2)</em></td></tr>
    <tr><td><strong>3. Bash + Python wrapper</strong></td><td>One-off, doesn't justify full MCP</td><td>Internal data warehouse queries</td></tr>
    <tr><td><strong>4. Hosted MCP gateway</strong></td><td>Zero local setup, trust third party</td><td>Smithery, Composio, Glama</td></tr>
  </table>

  <p>v0.2 ships 8 bundled local MCPs under <code>mcps/</code> in the repo. Each runs locally under <em>your</em> OAuth grant — credentials never leave your machine. Solves the "I'm not the QBO admin and the official MCP doesn't work for me" problem cleanly.</p>

  <h2>What's coming in v0.2</h2>
  <div class="grid-2">
    <div>
      <strong>Customization layer</strong> (shipped)<br/>
      <code>customization/</code> + <code>setup-org</code> skill. Every agent reads your tagged CoA, non-GAAP rules, output templates, and voice samples before acting. Generic agents become yours.
    </div>
    <div>
      <strong>Bundled MCPs</strong><br/>
      8 Python MCP servers (qbo shipped read-only; bill-com, ramp, mercury, stripe, brex, rippling, carta queued) running locally under your OAuth grant
    </div>
    <div>
      <strong>6 more shared skills</strong><br/>
      audit-log-entry, variance-narrative, driver-decomposition, kpi-snapshot, close-packet-format, budget-checker
    </div>
    <div>
      <strong>Additional execution Posters</strong><br/>
      netsuite-poster, xero-poster, rillet-poster, sage-intacct-poster — same propose → approve → post contract
    </div>
    <div>
      <strong>create-finance-mcp skill</strong><br/>
      Scaffolds new bundled MCPs from a template. Community-contributable.
    </div>
  </div>

  <h2>What's planned for v0.3</h2>
  <p>Two foundational pieces designed in v0.2; implementation queued for v0.3. Both are about making the Stack composable for the deployer — customize without forking, scale without sacrificing context.</p>
  <div class="grid-2">
    <div>
      <strong>Skill composability</strong><br/>
      Precedence-based override system: deployers drop a customized version of any shipped skill into <code>customization/skills/&lt;agent&gt;/&lt;skill&gt;.md</code> and the runtime loads it instead. Add new skills the same way. Disable shipped skills with a stub. Threshold + config overrides via <code>customization/config/&lt;agent&gt;.yaml</code>. Upstream <code>git pull</code> never conflicts because everything lives in gitignored <code>customization/</code>. Design: <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/docs/v0.3-skill-composability.md"><code>docs/v0.3-skill-composability.md</code></a>.
    </div>
    <div>
      <strong>Sub-agent fan-out for Controller</strong><br/>
      Controller's reconciliations pass becomes a parent orchestrator that spawns short-lived sub-agents in parallel (bank-rec / AR-rec / AP-rec / intercompany / crypto), each with focused context. Parent synthesizes results into the close packet. Same audit log, same approval gates — just faster on Day 2 and cleaner under context pressure. Design: <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/docs/v0.3-controller-fanout.md"><code>docs/v0.3-controller-fanout.md</code></a>.
    </div>
    <div>
      <strong>Linux / VPS install guide</strong><br/>
      Parallel to the Mac and Windows setup guides. Systemd timers, common VPS providers (Hetzner / Lightsail / DigitalOcean). Mac and Windows guides shipped in v0.2; Linux/VPS guide pending validation.
    </div>
    <div>
      <strong>Slack-driven customization updates</strong><br/>
      An <code>update-reference</code> agent that watches <code>#finance-ops</code> for messages like <em>"tag vendor X as Cloud Infrastructure"</em>, drafts a PR to the customization repo, awaits approval, and pulls. Replaces the current gatekeeper pattern with a faster Slack-native loop.
    </div>
  </div>

  <p>Beyond v0.3: industry packs for PSP and SaaS; v0.4+ adds investment research, options & derivatives, private capital, and wealth management packs (Series II of the curriculum).</p>

  <h2>Companion lesson series</h2>
  <p>The Stack is the <em>artifact</em>. The <a href="https://sanjayraghavan.substack.com">AI-Powered Finance Substack</a> is the <em>why and how</em> — 43 lessons across 8 modules. Module 7 (the agent track) is where the Stack gets introduced, dissected, and built up from first principles. If you want to understand the design decisions, that's where they're documented.</p>

  <h2>Links</h2>
  <ul>
    <li><a href="https://github.com/sanjay-raghavan/the-ai-finance-stack">GitHub repo</a> — source, docs, contributions, issues</li>
    <li><a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/ARCHITECTURE.md">ARCHITECTURE.md</a> — three-layer architecture + extension model + skill layer</li>
    <li><a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/MCP_INTEGRATION.md">MCP_INTEGRATION.md</a> — full four-tier framework</li>
    <li><a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/QUICK_START.md">QUICK_START.md</a> — 30-min install guide</li>
    <li><a href="/catalog">/catalog</a> — full JSON catalog (no MCP client needed to inspect)</li>
    <li><a href="https://sanjayraghavan.substack.com">AI-Powered Finance Substack</a> — the lesson series</li>
  </ul>

  <p class="footer">
    MIT License · Author: <a href="https://www.linkedin.com/in/sanjayraghavan/">Sanjay Raghavan</a> · MCP Registry v0.1.0<br/>
    <a href="/connect">Connect QBO</a> · <a href="/launch">Launch</a> · <a href="/disconnect">Disconnect</a> · <a href="/license">License (MIT)</a> · <a href="/privacy">Privacy Policy</a><br/>
    Star the repo on GitHub if this is useful.
  </p>
</body>
</html>`;

// ────────────────────────────────────────────────────────────────────────────
// License page (MIT) — also serves as EULA for Intuit / other vendor reviews
// ────────────────────────────────────────────────────────────────────────────

const LICENSE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The AI Finance Stack — License (MIT)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           max-width: 780px; margin: 60px auto; padding: 0 20px; line-height: 1.55;
           color: #111; }
    h1 { font-size: 1.8rem; margin-bottom: 0.25em; }
    h2 { font-size: 1.2rem; margin-top: 2em; margin-bottom: 0.5em;
         border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    .subtitle { color: #666; margin-bottom: 2em; }
    pre { background: #f4f4f4; padding: 16px 20px; border-radius: 8px; overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em;
          line-height: 1.55; white-space: pre-wrap; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav { color: #888; font-size: 0.9em; margin-bottom: 2em; }
    .footer { margin-top: 4em; padding-top: 2em; border-top: 1px solid #e5e5e5;
              color: #888; font-size: 0.88em; }
  </style>
</head>
<body>
  <p class="nav"><a href="/">← Back to The AI Finance Stack</a></p>

  <h1>License</h1>
  <p class="subtitle">The AI Finance Stack is released under the MIT License. This page also serves as the end-user license agreement for the bundled MCP servers and other components.</p>

  <h2>MIT License</h2>
  <pre>MIT License

Copyright (c) 2026 Sanjay Raghavan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.</pre>

  <h2>What this means in plain English</h2>
  <ul>
    <li>You may use, modify, distribute, and sell this software freely, for any purpose.</li>
    <li>You must include the copyright notice and license text in any redistribution.</li>
    <li>The software is provided "as is" with no warranty of any kind.</li>
    <li>The author is not liable for any damages arising from use of this software.</li>
  </ul>

  <h2>Specific notes for the QuickBooks Online integration</h2>
  <p>The bundled QuickBooks Online MCP server (<code>mcps/qbo/</code> in the repo) is part of the same MIT license. It runs locally on the user's machine under the user's own Intuit OAuth grant. The maintainer of The AI Finance Stack has no access to user credentials, OAuth tokens, or API responses from any third-party service connected via the bundled MCPs.</p>
  <p>By using the QuickBooks Online MCP, you agree to comply with <a href="https://developer.intuit.com/app/developer/qbo/docs/develop/develop-with-our-apis/end-user-license-agreement" target="_blank">Intuit's API Terms of Service</a> and any applicable laws and regulations governing your use of financial data in your jurisdiction.</p>

  <h2>Canonical source</h2>
  <p>The full source code, issue tracker, and license file live at <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack" target="_blank">github.com/sanjay-raghavan/the-ai-finance-stack</a>.</p>

  <p class="footer">
    The AI Finance Stack v0.1 · MIT License · Author: <a href="https://www.linkedin.com/in/sanjayraghavan/">Sanjay Raghavan</a><br/>
    <a href="/">Home</a> · <a href="/privacy">Privacy Policy</a> · <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack">GitHub</a>
  </p>
</body>
</html>`;

// ────────────────────────────────────────────────────────────────────────────
// Privacy Policy — required for Intuit Production app review + other vendors
// ────────────────────────────────────────────────────────────────────────────

const PRIVACY_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The AI Finance Stack — Privacy Policy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           max-width: 780px; margin: 60px auto; padding: 0 20px; line-height: 1.55;
           color: #111; }
    h1 { font-size: 1.8rem; margin-bottom: 0.25em; }
    h2 { font-size: 1.2rem; margin-top: 2em; margin-bottom: 0.5em;
         border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    h3 { font-size: 1.05rem; margin-top: 1.6em; margin-bottom: 0.4em; color: #333; }
    .subtitle { color: #666; margin-bottom: 2em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px;
           font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav { color: #888; font-size: 0.9em; margin-bottom: 2em; }
    .hero { background: #f0f7ff; border-left: 4px solid #0066cc; padding: 16px 20px;
            margin: 1.5em 0; border-radius: 4px; }
    .footer { margin-top: 4em; padding-top: 2em; border-top: 1px solid #e5e5e5;
              color: #888; font-size: 0.88em; }
  </style>
</head>
<body>
  <p class="nav"><a href="/">← Back to The AI Finance Stack</a></p>

  <h1>Privacy Policy</h1>
  <p class="subtitle">Effective: June 1, 2026 · Last updated: June 1, 2026</p>

  <div class="hero">
    <strong>The short version.</strong> The AI Finance Stack is an open-source toolkit that runs on your own machine. Your credentials and your data never leave your machine. The public registry server (this site) collects no user accounts, no analytics, no personal data. There is nothing for us to share, sell, or lose — because we never receive your data in the first place.
  </div>

  <h2>1. Who this policy applies to</h2>
  <p>This policy covers two distinct components of The AI Finance Stack:</p>
  <ul>
    <li><strong>The public MCP registry server</strong> at <a href="https://the-ai-finance-stack.sanjayraghavan.workers.dev">the-ai-finance-stack.sanjayraghavan.workers.dev</a> — what you're visiting now.</li>
    <li><strong>The bundled local MCP servers</strong> (e.g., <code>mcps/qbo/</code>) — open-source software you may install on your own machine.</li>
  </ul>

  <h2>2. What the public registry collects</h2>
  <p><strong>From you, the user: nothing.</strong></p>
  <ul>
    <li>No user accounts. No login. No personally identifiable information collected.</li>
    <li>No cookies set by this site.</li>
    <li>No analytics, tracking pixels, or third-party scripts.</li>
    <li>The registry serves a static catalog of public, open-source agent metadata. Tool calls (<code>browse_agents</code>, <code>get_agent_detail</code>, etc.) return public information about MIT-licensed components. No user-specific data is processed.</li>
  </ul>
  <p>Standard Cloudflare Workers infrastructure logs (IP address, request path, timing, response code) are retained by Cloudflare per <a href="https://www.cloudflare.com/privacypolicy/" target="_blank">Cloudflare's privacy policy</a>. The maintainer of The AI Finance Stack does not analyze, export, or otherwise use these logs.</p>

  <h2>3. What the bundled local MCPs do with your data</h2>
  <p>The bundled MCP servers (such as the QuickBooks Online MCP) run entirely on the user's local machine. Specifically:</p>
  <ul>
    <li><strong>OAuth credentials</strong> (refresh tokens, realm IDs) are stored locally in <code>~/.config/finance-stack/credentials/</code> on the user's machine, with restrictive file permissions (mode 0600). These credentials never leave the user's machine and are never transmitted to The AI Finance Stack or any third party.</li>
    <li><strong>API responses</strong> from connected systems (e.g., QuickBooks Online, Mercury, Stripe) are returned directly to the user's local MCP client (Claude Desktop, Claude Code, etc.). None of this data is transmitted to any AI Finance Stack server.</li>
    <li><strong>No analytics or telemetry</strong> is collected by the bundled MCPs. The software contains no code that "phones home" to The AI Finance Stack or any other server.</li>
  </ul>
  <p>The maintainer of The AI Finance Stack therefore has no access to your QuickBooks data, your bank data, your customer or vendor information, or any other data accessed via the bundled MCPs. We could not retrieve, view, or share this data even if we wanted to.</p>

  <h2>4. What we explicitly do not do</h2>
  <ul>
    <li>We do not collect, store, process, or transmit user account information.</li>
    <li>We do not sell, share, rent, or otherwise disclose user data to third parties — because we do not receive user data.</li>
    <li>We do not use cookies, web beacons, or similar tracking technologies on the registry site.</li>
    <li>We do not track user activity across sessions, devices, or sites.</li>
    <li>We do not aggregate or anonymize user data for analytics, because we do not collect it.</li>
  </ul>

  <h2>5. Third-party services</h2>
  <p>The public registry server runs on <a href="https://workers.cloudflare.com" target="_blank">Cloudflare Workers</a>. Cloudflare provides the underlying compute and edge infrastructure. Standard request-level logs (as described in section 2) are subject to Cloudflare's own privacy policy.</p>
  <p>The bundled MCP servers connect to third-party services that you configure (QuickBooks Online, Mercury, Stripe, etc.) using your own credentials. The privacy policies of those services apply to the data those services hold about you. The AI Finance Stack does not modify, intercept, or process this data — it flows directly between your local machine and the third-party service.</p>

  <h2>6. Your control</h2>
  <p>Because all data stays on your machine, you control it completely:</p>
  <ul>
    <li>To revoke a bundled MCP's access to a third-party service, revoke its OAuth grant in that service's user dashboard (e.g., in your QuickBooks Online account settings).</li>
    <li>To delete locally stored credentials, delete the relevant file in <code>~/.config/finance-stack/credentials/</code>.</li>
    <li>To stop using The AI Finance Stack entirely, uninstall the software from your machine. There is nothing for us to delete on our end, because we hold nothing.</li>
  </ul>

  <h2>7. Changes to this policy</h2>
  <p>If this policy changes (e.g., if a future version of the registry begins collecting analytics, which is not planned), the change will be visible in the commit history of this file in the <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack" target="_blank">public GitHub repo</a> and the "Last updated" date above will reflect the change.</p>

  <h2>8. Contact</h2>
  <p>The AI Finance Stack is maintained by Sanjay Raghavan. For privacy-related questions:</p>
  <ul>
    <li>File an issue at <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/issues" target="_blank">github.com/sanjay-raghavan/the-ai-finance-stack/issues</a></li>
    <li>Contact via <a href="https://sanjayraghavan.substack.com" target="_blank">Substack</a> or <a href="https://www.linkedin.com/in/sanjayraghavan/" target="_blank">LinkedIn</a></li>
  </ul>

  <p class="footer">
    The AI Finance Stack v0.1 · MIT License · Author: <a href="https://www.linkedin.com/in/sanjayraghavan/">Sanjay Raghavan</a><br/>
    <a href="/">Home</a> · <a href="/license">License (MIT)</a> · <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack">GitHub</a>
  </p>
</body>
</html>`;

// ────────────────────────────────────────────────────────────────────────────
// Shared style block used by /launch, /connect, /disconnect
// ────────────────────────────────────────────────────────────────────────────

const FLOW_PAGE_STYLES = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           max-width: 780px; margin: 60px auto; padding: 0 20px; line-height: 1.55;
           color: #111; }
    h1 { font-size: 1.9rem; margin-bottom: 0.25em; line-height: 1.2; }
    h2 { font-size: 1.2rem; margin-top: 2em; margin-bottom: 0.5em;
         border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    h3 { font-size: 1.05rem; margin-top: 1.6em; margin-bottom: 0.4em; color: #333; }
    .subtitle { color: #555; margin-bottom: 2em; font-size: 1.05rem; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px;
           font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px 20px; border-radius: 8px; overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em;
          line-height: 1.55; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav { color: #888; font-size: 0.9em; margin-bottom: 2em; }
    .hero { padding: 16px 20px; margin: 1.5em 0; border-radius: 6px; font-size: 1.02rem; }
    .hero-success { background: #ecfdf5; border-left: 4px solid #10b981; }
    .hero-info { background: #f0f7ff; border-left: 4px solid #0066cc; }
    .hero-caution { background: #fef9e7; border-left: 4px solid #f59e0b; }
    .step { background: #fafafa; border-radius: 8px; padding: 16px 20px; margin: 1em 0;
            border-left: 3px solid #d1d5db; }
    .step-num { display: inline-block; background: #0066cc; color: white;
                width: 24px; height: 24px; border-radius: 50%; text-align: center;
                line-height: 24px; font-weight: 600; margin-right: 8px; font-size: 0.85em; }
    .footer { margin-top: 4em; padding-top: 2em; border-top: 1px solid #e5e5e5;
              color: #888; font-size: 0.88em; }
`;

// ────────────────────────────────────────────────────────────────────────────
// Launch page — registered as Launch URL with Intuit
// Where users land after authenticating their QBO account.
// ────────────────────────────────────────────────────────────────────────────

const LAUNCH_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're Connected — The AI Finance Stack</title>
  <style>${FLOW_PAGE_STYLES}</style>
</head>
<body>
  <p class="nav"><a href="/">← The AI Finance Stack home</a></p>

  <h1>You're connected.</h1>
  <p class="subtitle">Your QuickBooks Online account is now authorized with The AI Finance Stack. The integration runs locally on your machine — your books never leave it.</p>

  <div class="hero hero-success">
    <strong>Authorization confirmed.</strong> The refresh token has been saved to <code>~/.config/finance-stack/credentials/qbo.json</code> on your local machine. From this point forward, you can ask Claude questions about your books in plain English and get real answers.
  </div>

  <h2>Try a query</h2>
  <p>Open a fresh conversation in Claude Desktop and ask any of these:</p>

  <div class="step">
    <span class="step-num">1</span><strong>"What's our chart of accounts? Just the expense accounts."</strong><br/>
    Claude calls <code>chart_of_accounts_get</code> with <code>account_type=Expense</code> and returns the list.
  </div>

  <div class="step">
    <span class="step-num">2</span><strong>"How much did we spend on consulting this month?"</strong><br/>
    Claude calls <code>profit_and_loss_get</code> for the current month, finds the Consulting line, returns the dollar amount.
  </div>

  <div class="step">
    <span class="step-num">3</span><strong>"Show me every JE that hit our Insurance Expense account in April."</strong><br/>
    Claude calls <code>transactions_by_account</code> with the account ID and date range, returns each line.
  </div>

  <div class="step">
    <span class="step-num">4</span><strong>"What's our current AR aging? Who owes us the most?"</strong><br/>
    Claude calls <code>ar_aging_get</code> in summary mode and reports the largest balances.
  </div>

  <h2>What's available — 12 read-only tools</h2>
  <p>The bundled QBO MCP exposes these to Claude:</p>
  <ul>
    <li><code>company_info_get</code>, <code>chart_of_accounts_get</code>, <code>closing_date_get</code></li>
    <li><code>recent_transactions_get</code>, <code>journal_entry_get</code>, <code>journal_entries_search</code></li>
    <li><code>vendor_search</code>, <code>customer_search</code></li>
    <li><code>ap_aging_get</code>, <code>ar_aging_get</code></li>
    <li><code>profit_and_loss_get</code>, <code>transactions_by_account</code></li>
  </ul>

  <div class="hero hero-info">
    <strong>v0.1 is strictly read-only.</strong> No journal entry creation, no invoice posting, no edits. Write capability is queued for v0.2 once the propose → human approve → post pipeline (via the QBO Poster agent) is wired up end to end. <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/agents/qbo-poster/README.md">Read about the architecture</a>.
  </div>

  <h2>If something isn't working</h2>
  <ul>
    <li><strong>Claude doesn't see the QBO MCP</strong> — check that <code>claude_desktop_config.json</code> points at the right Python and module path; fully quit Claude Desktop (Cmd-Q) and reopen.</li>
    <li><strong>"Refresh token rejected"</strong> — your token expired (Intuit refresh tokens last 101 days unused). Re-run setup: <code>python -m qbo_mcp.server --setup</code></li>
    <li><strong>"401 Unauthorized" on a tool call</strong> — usually transient; retry. If persistent, re-run setup.</li>
  </ul>

  <p>Full troubleshooting in the <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/mcps/qbo/README.md">QBO MCP README</a>.</p>

  <p class="footer">
    The AI Finance Stack v0.1 · MIT License · <a href="/">Home</a> · <a href="/connect">Connect</a> · <a href="/disconnect">Disconnect</a> · <a href="/license">License</a> · <a href="/privacy">Privacy</a>
  </p>
</body>
</html>`;

// ────────────────────────────────────────────────────────────────────────────
// Connect page — registered as Connect/Reconnect URL with Intuit
// Where users go to connect their QBO account to The AI Finance Stack.
// ────────────────────────────────────────────────────────────────────────────

const CONNECT_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect QuickBooks — The AI Finance Stack</title>
  <style>${FLOW_PAGE_STYLES}</style>
</head>
<body>
  <p class="nav"><a href="/">← The AI Finance Stack home</a></p>

  <h1>Connect QuickBooks Online.</h1>
  <p class="subtitle">The AI Finance Stack reads your books locally, under your own OAuth grant. Your credentials never leave your machine. Setup takes about 10 minutes the first time.</p>

  <div class="hero hero-info">
    <strong>How this works.</strong> You install a small Python MCP server on your own machine (Mac, Linux, or Windows). It uses Intuit's OAuth flow to read from QuickBooks Online. Claude Desktop (or any MCP-compatible client) talks to the local server, which talks to QBO. No third-party servers are in the data path.
  </div>

  <h2>Setup — 5 steps</h2>

  <div class="step">
    <span class="step-num">1</span><strong>Clone the repo</strong>
    <pre>git clone https://github.com/sanjay-raghavan/the-ai-finance-stack.git
cd the-ai-finance-stack/mcps/qbo</pre>
  </div>

  <div class="step">
    <span class="step-num">2</span><strong>Create a virtual environment and install</strong>
    <pre>python3 -m venv .venv
source .venv/bin/activate
pip install -e .</pre>
  </div>

  <div class="step">
    <span class="step-num">3</span><strong>Configure your Intuit credentials</strong><br/>
    Copy <code>.env.example</code> to <code>.env</code>, then fill in <code>QBO_CLIENT_ID</code> and <code>QBO_CLIENT_SECRET</code> from your <a href="https://developer.intuit.com/app/developer/myapps" target="_blank">Intuit Developer dashboard</a>. Set <code>QBO_ENVIRONMENT=production</code>.
  </div>

  <div class="step">
    <span class="step-num">4</span><strong>Run the one-time OAuth flow</strong>
    <pre>python -m qbo_mcp.server --setup</pre>
    Your browser opens to Intuit. Sign in, authorize the app, you'll be redirected here.
  </div>

  <div class="step">
    <span class="step-num">5</span><strong>Wire into Claude Desktop</strong><br/>
    Edit <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) and add a <code>quickbooks</code> entry under <code>mcpServers</code> pointing at your local Python venv and the <code>qbo_mcp.server</code> module. Full config example in the <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/mcps/qbo/README.md#5-wire-into-claude-desktop">QBO MCP README</a>.
  </div>

  <h2>What you get</h2>
  <ul>
    <li><strong>12 read-only tools</strong> exposed to Claude — chart of accounts, recent transactions, journal entries, vendor / customer search, AP and AR aging, P&L, and account-level drill-downs.</li>
    <li><strong>Local-only architecture</strong> — refresh tokens stored at <code>~/.config/finance-stack/credentials/qbo.json</code> with mode 0600 permissions. Never transmitted off your machine.</li>
    <li><strong>Token auto-refresh</strong> — access tokens refresh every 60 minutes automatically; refresh tokens rotate forward on each use (101-day lifetime if unused).</li>
  </ul>

  <h2>About the broader project</h2>
  <p>The QBO MCP is part of <a href="/">The AI Finance Stack</a> — a free, open-source collection of 12 Finance AI agents and shared skills, designed around the <strong>propose → human approve → post</strong> architecture. The MCP gives the agents (and you, directly in Claude Desktop) read access to your books. Write capability is queued for v0.2 once the approval pipeline is wired end to end.</p>

  <p><a href="https://github.com/sanjay-raghavan/the-ai-finance-stack">Browse the source on GitHub</a> · <a href="https://github.com/sanjay-raghavan/the-ai-finance-stack/blob/main/ARCHITECTURE.md">Read the architecture</a> · <a href="https://sanjayraghavan.substack.com">The companion lesson series on Substack</a></p>

  <p class="footer">
    The AI Finance Stack v0.1 · MIT License · <a href="/">Home</a> · <a href="/launch">Launch</a> · <a href="/disconnect">Disconnect</a> · <a href="/license">License</a> · <a href="/privacy">Privacy</a>
  </p>
</body>
</html>`;

// ────────────────────────────────────────────────────────────────────────────
// Disconnect page — registered as Disconnect URL with Intuit
// Where users go to fully disconnect The AI Finance Stack from their QBO.
// ────────────────────────────────────────────────────────────────────────────

const DISCONNECT_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Disconnect — The AI Finance Stack</title>
  <style>${FLOW_PAGE_STYLES}</style>
</head>
<body>
  <p class="nav"><a href="/">← The AI Finance Stack home</a></p>

  <h1>Disconnect The AI Finance Stack.</h1>
  <p class="subtitle">Three short steps to fully remove The AI Finance Stack from your QuickBooks Online and your local machine. No data persists on remote servers — everything to clean up lives on Intuit's side and your own machine.</p>

  <div class="hero hero-caution">
    <strong>The AI Finance Stack does not store your data on any remote server.</strong> Your credentials and any API responses you've retrieved live entirely on your local machine. Disconnecting is a local cleanup plus revoking the OAuth grant in QuickBooks.
  </div>

  <h2>Step 1 — Revoke the OAuth grant in QuickBooks</h2>
  <p>This stops Intuit from accepting any further API calls from The AI Finance Stack, even if a credential file is left behind somewhere.</p>

  <div class="step">
    <span class="step-num">1</span>Sign in to <a href="https://app.qbo.intuit.com/app/connected-apps" target="_blank">app.qbo.intuit.com/app/connected-apps</a> (or navigate to <strong>Settings → Manage Users → Connected Apps</strong> in your QuickBooks Online dashboard).<br/><br/>
    <span class="step-num">2</span>Find <strong>The AI Finance Stack</strong> in your list of connected apps.<br/><br/>
    <span class="step-num">3</span>Click <strong>Disconnect</strong>. Intuit invalidates the OAuth grant immediately — no further API calls will succeed even if the local credentials are still on disk.
  </div>

  <h2>Step 2 — Delete the local credentials file</h2>
  <p>This removes the refresh token from your machine.</p>

  <pre>rm ~/.config/finance-stack/credentials/qbo.json</pre>

  <p>On Windows, the path is typically <code>%APPDATA%\\finance-stack\\credentials\\qbo.json</code>.</p>

  <h2>Step 3 — Remove from Claude Desktop config (optional)</h2>
  <p>If you no longer want the QBO MCP server to start with Claude Desktop, edit your config and remove the <code>"quickbooks"</code> entry under <code>mcpServers</code>.</p>

  <p>On macOS, the config file lives at:</p>
  <pre>~/Library/Application Support/Claude/claude_desktop_config.json</pre>

  <p>Remove the <code>"quickbooks"</code> block and any commas that were holding it in the list. Save the file. Fully quit Claude Desktop (Cmd-Q) and reopen.</p>

  <h2>What about data we might have stored?</h2>
  <p>The AI Finance Stack runs entirely on your machine. We do not operate any user-data storage — see the <a href="/privacy">Privacy Policy</a> for the full statement. Once you've revoked the OAuth grant and deleted the local credentials file, there is nothing further to clean up. No accounts to delete, no servers to email.</p>

  <h2>Reconnecting later</h2>
  <p>If you want to reconnect The AI Finance Stack to your QuickBooks Online account at a later date, follow the <a href="/connect">Connect</a> instructions. The setup flow takes about 10 minutes and uses standard Intuit OAuth — no special steps needed for users who previously disconnected.</p>

  <p class="footer">
    The AI Finance Stack v0.1 · MIT License · <a href="/">Home</a> · <a href="/launch">Launch</a> · <a href="/connect">Connect</a> · <a href="/license">License</a> · <a href="/privacy">Privacy</a>
  </p>
</body>
</html>`;
