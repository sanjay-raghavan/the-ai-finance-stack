# Hosting Plan — The AI Finance Stack on a Free Tier

You can host all of The AI Finance Stack — repo, docs site, downloadable agent bundles, and the public MCP registry — for **$0/month plus one $10/year domain**. This document spells out exactly how.

The plan deliberately uses GitHub and Cloudflare as the spine because both have generous free tiers and play well together.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  theaifinancestack.com (your domain — $10/year)               │
│                                                             │
│  ├── /              → GitHub Pages (docs site)              │
│  ├── /agents/<name> → static agent detail pages             │
│  ├── /download/...  → GitHub Releases (agent bundles)       │
│  └── /mcp/registry  → Cloudflare Worker (MCP server)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │  github.com/<you>/the-ai-finance-stack    │
        │  (the canonical source of truth)       │
        └───────────────────────────────────────┘
```

Every component is free at the scale this will operate at for the first year or two.

---

## Component-by-component plan

### 1. Repository — GitHub (free, public)

**What:** The canonical source of truth. Every agent package, every doc, every release tag lives here.

**Cost:** $0. Public repos on GitHub are unlimited and free.

**Setup:**
- Create a public repo at `github.com/<your-username>/the-ai-finance-stack`
- Push the existing `the-ai-finance-stack/` folder as the initial commit
- Add a `LICENSE` file (MIT) at the root
- Add a `CONTRIBUTING.md` if you want community contributions

**Why this is the right choice:**
- Public visibility is a feature for thought leadership, not a bug
- The repo IS the docs IS the agent registry — no separate places to maintain
- GitHub's discoverability (stars, forks, search) is free distribution
- Version history is the audit trail

---

### 2. Docs site — GitHub Pages (free)

**What:** A clean web view of the repo's markdown files. Readers go to `theaifinancestack.com` and see the README rendered, with navigation to all the other docs and per-agent detail pages.

**Cost:** $0. GitHub Pages is free for public repos.

**Setup:**
- In the repo settings, enable Pages from the `main` branch
- Pick a theme (Just the Docs, Cayman, or Minimal — all free, all clean)
- Add a `_config.yml` at the repo root with site metadata
- Configure your custom domain in repo Settings → Pages → Custom domain → `theaifinancestack.com`
- Add the DNS records GitHub instructs (CNAME or A records)

**Optional upgrade:** if you want a fancier docs site (sidebar navigation, search, version selector), use **Docusaurus** or **MkDocs Material** as the build tool. Both are free, both deploy via GitHub Actions to GitHub Pages. Adds ~2 hours of setup; pays off if the doc count grows large.

**What the site shows:**
- `/` — the README rendered as the landing page
- `/architecture/` — ARCHITECTURE.md
- `/quick-start/` — QUICK_START.md
- `/setup-dedicated-laptop/` — SETUP_DEDICATED_LAPTOP.md
- `/agents/controller/` — Controller's README rendered as its detail page
- `/agents/ap-watcher/` — etc., one page per agent
- `/curriculum-map/` — CURRICULUM_MAP.md

---

### 3. Downloadable agent bundles — GitHub Releases (free)

**What:** Versioned ZIP files of each agent package that users can download with one click.

**Cost:** $0. GitHub Releases is free with no bandwidth cap for public repos.

**Setup:**
- For each agent ready to ship, create a Release tagged `controller-v0.1.0` (or similar)
- Attach a ZIP of the agent folder as a release asset
- Auto-generate release notes from commits

**Better: automate it.** A simple GitHub Action can build a fresh bundle for any agent whenever you tag a release. The action lives in `.github/workflows/release-agent.yml` and runs in ~30 seconds per release.

**User experience:**
- The agent's detail page on `theaifinancestack.com/agents/controller/` shows a "Download Bundle (v0.1.0)" button
- Click → GitHub serves the ZIP directly
- User extracts it into `~/the-ai-finance-stack/agents/controller/` and follows the README

This is the path you ship in **v0.1** before the MCP registry exists.

---

### 4. Public MCP registry — Cloudflare Workers (free tier)

**What:** The MCP server at `/mcp/registry` that lets Claude Desktop / Claude Code clients browse and install agents without needing to download anything manually.

**Cost:** $0 within the Cloudflare Workers free tier (100,000 requests/day, plenty for years).

**Setup (when you're ready to ship the registry — v0.2):**
- Write the MCP server in Python or TypeScript using the official Anthropic MCP SDK
- Deploy to Cloudflare Workers via `wrangler deploy`
- Route `theaifinancestack.com/mcp/registry` to the Worker via Cloudflare's DNS + page rules
- Agents are read from the GitHub repo (via the GitHub API) — the Worker doesn't store anything itself

**Tools the Worker exposes:**
- `browse_agents` (public, no auth)
- `get_agent_detail` (public)
- `get_agent_package` (public — returns the same ZIP that GitHub Releases serves)
- `request_agent` (public — files an issue on the GitHub repo)
- `publish_agent` (`ak_...` bearer — adds a community contribution; phased in later)

**Why Cloudflare Workers, specifically:**
- The free tier comfortably covers the early registry-call volumes
- Cold starts are <50ms (vs. seconds for Railway / Render free tiers)
- Cloudflare also gives free DNS, free TLS, and free DDoS protection on the same domain
- Excellent for MCP's streamable-HTTP transport

**Alternatives if Workers ends up annoying:** Railway free tier ($5 credit/month) or Fly.io free tier. Both have slightly worse cold starts but easier debugging.

---

### 5. Domain — Cloudflare Registrar or Namecheap (~$10/year)

**What:** `theaifinancestack.com`. The brand and the address everything connects to.

**Cost:** ~$10–12/year depending on registrar.

**Setup:**
- Check availability at Cloudflare Registrar (their pricing is at-cost — usually $10 for a `.com`)
- If unavailable, alternatives that signal "tech/finance project":
  - `theaifinancestack.dev` (~$12)
  - `theaifinancestack.io` (~$30 — usually skip)
  - `financestack.ai` (~$80 — usually skip; .ai is expensive)
  - `the-ai-finance-stack.com` (~$10 — hyphenated, slightly worse SEO)
- Cloudflare Registrar gives you free DNS, free TLS, free DDoS protection out of the box

---

### 6. Analytics — Cloudflare Web Analytics (free, privacy-respecting)

**What:** Basic traffic data (page views, referrers, top pages) without using cookies or selling data.

**Cost:** $0.

**Setup:** Add a snippet to the docs site's `_config.yml` or page templates. Privacy-respecting; doesn't require a cookie banner.

**Alternative:** Plausible (free for low traffic if self-hosted) or skip analytics entirely for v0.1.

---

### 7. Issue tracking & community — GitHub Issues + Discussions (free)

**What:** Where readers report bugs, request agents, ask questions.

**Cost:** $0.

**Setup:** Already part of the repo. Enable Discussions in Settings if you want a Q&A-style community surface.

---

## Recommended sequencing

### Phase 0 — Now (this week)
- Register `theaifinancestack.com`
- Create the GitHub repo, push the current `the-ai-finance-stack/` folder
- Enable GitHub Pages with a basic theme; point the domain at it
- **Result:** `theaifinancestack.com` shows the README rendered as a page. Total time: ~2 hours.

### Phase 1 — Within 2 weeks
- Add per-agent detail pages (rendered from each agent's README.md)
- Create the first GitHub Release for Controller v0.1.0 with the ZIP attached
- Add "Download Bundle" buttons to agent pages
- **Result:** users can install Controller manually from the website. Total time: ~3 hours.

### Phase 2 — In Module 7's first lesson cycle (weeks 3–6)
- Write the MCP registry as a Cloudflare Worker
- Wire it up at `/mcp/registry`
- Update agent detail pages to also show the "Install via MCP" snippet
- **Result:** users can install Controller with one JSON snippet, no manual download. Total time: ~1–2 weeks of part-time work or one focused weekend.

### Phase 3 — Ongoing
- Add `publish_agent` for outside contributors
- Add an Author key flow for community contributions
- Track installs / popularity (privacy-respecting — counts only, no identity)
- **Result:** the Stack becomes a community asset, not just your project.

---

## What this whole setup will cost annually

| Item | Annual cost |
|------|-------------|
| Domain (`theaifinancestack.com` via Cloudflare Registrar) | ~$10 |
| GitHub (public repo + Pages + Releases + Actions) | $0 |
| Cloudflare (DNS, TLS, DDoS, Workers free tier, Web Analytics) | $0 |
| Anthropic API tokens for the registry itself | <$5 (registry calls are cheap; only public read tools, no LLM-heavy work) |
| **Total** | **~$15/year** |

The Anthropic API tokens that *users* pay are their own — they bring their own API key when they install agents on their machine. The registry doesn't bill anyone.

---

## What you'd add if you ever monetize

If you eventually want a paid tier (premium agents, hosted runtime, team features), the additions are modest:

- **Stripe** for payments — free to set up, ~2.9% + 30¢ per transaction
- **Clerk or Auth0** for user accounts — free tier covers 10K users
- **Postgres on Supabase** — free tier covers early customer count
- **Email** — Resend free tier (3K emails/month)

You can ship a paid product on top of the free stack with $0 incremental fixed cost — only marginal costs scale.

---

## What about hosting the personal runtime (the dedicated laptop)?

Out of scope for this document — that's the **Tier 5** deployment covered in [`SETUP_DEDICATED_LAPTOP.md`](./SETUP_DEDICATED_LAPTOP.md). The personal runtime runs on your own hardware. The hosting plan here covers only the public-facing parts: docs, downloads, and registry.
