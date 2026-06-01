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

  <h2>Install</h2>
  <p>Paste this into your Claude Desktop config file
  (<code>~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS):</p>
  <pre>{
  "mcpServers": {
    "the-ai-finance-stack": {
      "url": "https://the-ai-finance-stack.sanjayraghavan.workers.dev/sse"
    }
  }
}</pre>
  <p>Restart Claude Desktop, then in a fresh conversation ask:
  <em>"What agents are available in the-ai-finance-stack registry?"</em> — Claude calls <code>browse_agents</code> and returns the full catalog. From there you can have Claude install specific agents into your project folder, customize them, and run them.</p>

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

  <h2>Shared skill layer</h2>
  <p>The foundation that prevents schema drift across agents. When multiple agents need the same canonical schema, methodology, or format, it lives in <code>skills/</code> at the repo root and any agent imports it as <code>stack:&lt;name&gt;</code>. Also invokable directly by a human in Claude Desktop — no agent required.</p>

  <table>
    <tr><th>Shared skill</th><th>What it standardizes</th><th>Status</th></tr>
    <tr><td><code>stack:proposal-format</code></td><td>Canonical JE proposal schema (8 agents import it)</td><td class="status-shipped">v0.1 — shipped</td></tr>
    <tr><td><code>stack:approval-record-format</code></td><td>Canonical approval record (auth, content hash, integrity)</td><td class="status-shipped">v0.1 — shipped</td></tr>
    <tr><td><code>stack:slack-conventions</code></td><td>Channel routing, severity emojis, mention rules, link format</td><td class="status-shipped">v0.1 — shipped</td></tr>
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
      <strong>Bundled MCPs</strong><br/>
      8 Python MCP servers (qbo, bill-com, ramp, mercury, stripe, brex, rippling, carta) running locally under your OAuth grant
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

  <p>Beyond v0.2: industry packs for PSP and SaaS; v0.3+ adds investment research, options & derivatives, private capital, and wealth management packs (Series II of the curriculum).</p>

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
    <a href="/license">License (MIT)</a> · <a href="/privacy">Privacy Policy</a> · Star the repo on GitHub if this is useful.
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
