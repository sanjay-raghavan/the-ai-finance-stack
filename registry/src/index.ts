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
           max-width: 720px; margin: 60px auto; padding: 0 20px; line-height: 1.5;
           color: #111; }
    h1 { font-size: 2rem; margin-bottom: 0.25em; }
    .subtitle { color: #666; margin-bottom: 2em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px;
           font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; }
    a { color: #0066cc; }
    .pack { display: inline-block; padding: 2px 8px; border-radius: 4px;
            font-size: 0.8em; margin-right: 4px; }
    .pack-core { background: #e3f2fd; color: #1565c0; }
    .pack-crypto { background: #fff3e0; color: #e65100; }
    .pack-execution { background: #fce4ec; color: #c2185b; }
  </style>
</head>
<body>
  <h1>The AI Finance Stack — MCP Registry</h1>
  <p class="subtitle">A free, open-source AI Finance team. 12 agents, 3 shared skills, propose → approve → post discipline.</p>

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
  <em>"List the agents available in The AI Finance Stack."</em></p>

  <h2>What you get</h2>
  <ul>
    <li><span class="pack pack-core">core</span> 10 agents — Controller, FP&A Analyst, Treasury, IR, AP Watcher, AR Follow-Up, Revenue Ops, Payroll Reviewer, Prepay Manager, Bank Recon</li>
    <li><span class="pack pack-crypto">crypto</span> 1 agent — Crypto Reconciler</li>
    <li><span class="pack pack-execution">execution</span> 1 agent — QBO Poster (the only write-capable agent — propose → approve → post)</li>
    <li>3 shared skills — stack:proposal-format, stack:approval-record-format, stack:slack-conventions</li>
  </ul>

  <h2>Links</h2>
  <ul>
    <li><a href="https://github.com/sanjay-raghavan/the-ai-finance-stack">GitHub repo</a> — source, docs, contributions</li>
    <li><a href="/catalog">/catalog</a> — full JSON catalog (no MCP client needed to inspect)</li>
    <li><a href="https://sanjayraghavan.substack.com">AI-Powered Finance Substack</a> — the lesson series that builds toward this Stack</li>
  </ul>

  <p style="margin-top: 3em; color: #999; font-size: 0.85em;">
    MIT License · Author: Sanjay Raghavan · MCP Registry v0.1.0
  </p>
</body>
</html>`;
