# Curriculum Map — The AI Finance Stack ↔ AI-Powered Finance

How each lesson in the *AI-Powered Finance* Substack series maps to The AI Finance Stack. Read this if you're writing a lesson and want to know which agent / skill / pattern to anchor it on.

---

## The principle

Every Module 7 lesson teaches readers how to build one piece of the Stack. The Stack itself is the deliverable artifact — install it from the public MCP registry on Day 1 if you just want it running; read the curriculum lesson if you want to understand how it works and customize it.

The curriculum is the *why* and the *how*. The Stack is the *what*.

---

## Lesson ↔ Stack agent / skill map

### Module 6 (Building Apps with Claude Code)

| Lesson | Stack artifact it relates to |
|--------|------------------------------|
| Post 21 — Where Will Your Finance Tool Live? | The Five Deployment Tiers framework. Stack runs at Tier 5 (dedicated laptop). |
| Post 22 — Apps Script for Finance Teams | Stack agents that don't need to be on a server — those can be Apps Script alternatives. Cross-reference. |
| Post 23 — Intro to Claude Code | This is the tool the Stack runtime uses. Every Stack agent invocation routes through Claude Code on the dedicated laptop. |
| Post 24 — Budget Tracker App | Not a Stack agent (it's a personal-use app, not a recurring agent). But it demonstrates the build pattern that becomes more sophisticated in Module 7. |
| Post 25 — Expense Categorizer | Could be reimagined as a sub-skill the AP Watcher invokes. |
| Post 26 — Financial Dashboard App | Cross-references the Stack's outputs (close packets, variance reports). The dashboard reads what Stack agents have written. |
| Post 27 — Automated Report Generator | Cross-references the IR agent (which is essentially an automated report generator for investors). |

### Module 7 (AI Agents — Your Finance Agent Army)

| Lesson | Stack artifact |
|--------|----------------|
| Post 28 — What AI Agents Are | Opens with Alex's 6-agent stack and **The AI Finance Stack as the working example**. "By the end of Module 7 you'll have built this." Install link to the registry. |
| Post 29 — Anatomy of a Finance Agent | Reads directly from Controller's `config.yaml` to explain the six dimensions. |
| Post 30 — Designing Your Agent Stack | Uses the v0.1 Stack roster as the "Pre-IPO Stack" reference case. Reader's worksheet: pick 3–6 from this list, plus any they'd add. |
| Post 31 — Building Your First Finance Agent | Walks through building a stripped-down `@cash-sweeper` — a simpler agent than Treasury, suitable for first-timers. |
| Post 32 — The Claude Agent SDK | Builds `@ap-watcher` end-to-end, using the SDK for tool use, error handling, and testing. This produces the v0.1 AP Watcher artifact. |
| Post 33 — Multi-Agent Systems | Builds the AP Watcher → Investigation coordination pattern. (Investigation is a v0.2 Stack agent — this lesson is where it first gets authored.) |
| Post 34 — The Strand Close Orchestrator | **The flagship lesson.** Builds `@controller` from scratch. The Controller in this repo is the artifact this lesson produces. |
| Post 35 — The Strand Variance Alert Agent | Builds `@fpa-analyst` (or a subset of it). |
| Post 36 — Persistent Agents | Extends Controller with prior-period memory. Updates the existing Controller artifact. |
| Post 37 — Tier 5 Dedicated Agent Server | Builds the runtime setup. **Uses `SETUP_DEDICATED_LAPTOP.md` from this repo as the canonical guide.** |
| Post 38 — Telegram Integration | Adds a Telegram interface to Controller and FP&A Analyst, so the CFO can ask "what's the close status?" from a phone. |
| Post 39 — MCP Servers | Builds the public MCP registry that hosts The AI Finance Stack. **This lesson is where `the-ai-finance-stack/registry/` actually ships.** |
| Post 40 — Monitoring & Observability | Adds health checks, dead-man switches, and the agent-health dashboard. |

### Modules 2–4 (earlier lessons that feed the Stack agents)

| Lesson | What the Stack uses from it |
|--------|------------------------------|
| Post 4 — Building a Financial Model | Strand's model is the basis for FP&A Analyst's forecast methodology |
| Post 5 — Variance Analysis | The Cowork variance work becomes the basis for FP&A Analyst's variance skill |
| Post 6 — Cash Flow Forecasting | The 13-week model from this lesson becomes Treasury's projection logic |
| Post 8 — Running the Monthly Close | The Cowork close work is exactly what Controller automates |
| Post 9 — Journal Entries | Feeds the Controller's `accrual-entries` skill |
| Post 10 — Reconciliations | Feeds the Controller's `reconciliations` skill |
| Post 11 — SOX Testing | Future SOX Sampler agent (v0.2) |
| Post 12 — Board-Ready Reports | Feeds the IR agent's `investor-update-draft` skill |
| Post 15 — Automating Monthly Management Packs | Direct precursor to Controller's status-report pass |

---

## How to write a lesson that integrates the Stack

Every Module 7 lesson should follow this structure:

### Opening
Establish the agent role being built. Reference where it sits in the Finance org. Reference the published agent in The AI Finance Stack repo.

### Conceptual walkthrough
Walk through the six dimensions (Overview / Skills / MCPs / Schedules / Goals / Config) for this agent. Use the published config.yaml as the worked example.

### Build the agent (the actual lesson content)
Step through authoring CLAUDE.md, the key skills, the config. Strand is the working test case.

### Install path
At the end of the lesson, the JSON snippet to install the agent from The AI Finance Stack registry. Two paths:
- **"I just want this running"** → install from registry
- **"I want to understand and customize"** → fork the repo, modify, redeploy locally

### Hot Take / One Thing I Built / Reader Q&A
The three recurring elements per post.

---

## How the Stack drives readers back to the curriculum

Every Stack agent's `README.md` has a "Curriculum lessons that build this agent" section pointing back to the relevant Substack posts. Readers who install the Stack first and want to understand it follow those links. Readers who read the curriculum first and want the working artifact install the Stack.

Both paths route to both products.

---

## v0.1 build sequence (suggested)

The order in which to author each agent — optimized for reader value and your ability to dogfood.

1. **Controller** (reference implementation; flagship; you use it for your own close)
2. **FP&A Analyst** (highest-leverage second agent; you use it for variance work)
3. **Treasury** (high-stakes; if Strand-the-real-business has cash sensitivity, this matters first)
4. **Investor Relations** (you ship this one because every CFO writes investor updates)
5. **AP Watcher**
6. **AR Follow-Up**
7. **Revenue Ops**
8. **Payroll Reviewer**

Items 1–4 should be production-quality by the time Module 7 publication begins. Items 5–8 can ship as skeletons in v0.1 and get fleshed out as each corresponding lesson is written.
