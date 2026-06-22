# Skill: Board Pre-Reader

Draft the quarterly board pre-reader deck. Designed to be read in 20 minutes before the meeting, so the meeting itself runs on questions rather than data presentation.

---

## When to invoke

14 calendar days before each scheduled board meeting (date pulled from `~/finance-data/ir/board/meeting-schedule.yaml`). On-demand from CFO requests.

---

## Inputs

- Last quarter's monthly updates (3 files) from `~/finance-data/ir/`
- Current-quarter close packets from `~/finance-data/closes/`
- FP&A's quarterly scenario refresh from `~/finance-data/scenarios/`
- FP&A's quarterly KPI snapshot from `~/finance-data/kpis/`
- Treasury's most recent runway report and 13-week projection
- Prior board pre-reader for format and continuity (from `~/finance-data/ir/board/<prior-quarter>/`)
- Board agenda from `~/finance-data/ir/board/<year>-Q<quarter>/agenda.yaml` (CFO-maintained) — if missing, use the default 8-section structure below

---

## Outputs

Two files at `~/finance-data/ir/board/<year>-Q<quarter>/`:

1. `pre-reader-draft.md` — the canonical markdown
2. `pre-reader-draft.pptx` — rendered via SOP pptx skill, ~18-22 slides

Default 8-section structure (each section = 2-3 slides):

| # | Section | Slides | Purpose |
|---|---------|--------|---------|
| 1 | **Quarter Summary** | 1-2 | Headline numbers, what changed vs. prior quarter, three sentences of context |
| 2 | **Results** | 3-4 | TPV, net revenue (by product), gross margin, OpEx, EBITDA, cash. Comparable to monthly update format but quarterly aggregation. |
| 3 | **KPI Scorecard** | 1-2 | The 8-12 metrics investors track. Trailing 6-quarter trend lines. Green/amber/red against target. |
| 4 | **Highlights** | 1-2 | The 4-6 wins worth a slide's attention each. Named, specific, with the supporting data point. |
| 5 | **Risks** | 1-2 | The 3-5 risks the board needs to know about. Candid. Include current mitigation status. |
| 6 | **Scenarios & Runway** | 1-2 | Bull / Base / Bear endpoints. Runway with confidence bands. Path to next financing event. |
| 7 | **Asks of the Board** | 1 | Specific asks — introductions, candidate sourcing, strategic input, decisions requested. |
| 8 | **Appendix** | 2-4 | Backup data, methodology, additional context the board may want to reference during discussion |

Post to `#ir-ops`:

> 📊 **Q[N] board pre-reader — draft v1 ready for CFO review.** 14 days before the [date] meeting. [X] items flagged for human approval. [link]

---

## Process

### Step 1 — Read the board agenda

Pull `agenda.yaml` for the upcoming meeting. The agenda might emphasize certain topics (e.g., a strategy decision, a fundraising pre-read, a comp committee item). Sections of the pre-reader should map to agenda items so the board sees the connection.

If no agenda exists yet, use the default 8-section structure.

### Step 2 — Read the prior board pre-reader

Critical for continuity:
- What did we tell the board last quarter that we'd update them on this quarter?
- What metrics were defined how — keep definitions consistent
- What asks did we make last quarter — note status (completed / outstanding) in this quarter's pre-reader

### Step 3 — Aggregate the quarter

For each financial line:
- Pull quarterly actuals from the 3 monthly close packets
- Aggregate to quarter total (with month-by-month breakdown available)
- Compare to quarter plan, prior quarter, and same-quarter-prior-year (if available)
- Pull the dominant driver from FP&A's variance work across the quarter

### Step 4 — Build the KPI scorecard

The 8-12 metrics that matter to this board. For Strand (PSP-shaped), defaults are:

1. TPV (total + by product)
2. Net revenue ($)
3. Net take rate (bps)
4. Gross margin %
5. Net cash burn ($/month)
6. Runway (months, with range)
7. Active merchant count
8. Net revenue retention (NRR)
9. Gross customer churn (% annual)
10. Fraud loss rate (bps)
11. Engineering headcount
12. R&D as % of net revenue

For each: trailing 6 quarters as a sparkline or trend line. Current value, comparison to target, green/amber/red status.

### Step 5 — Draft Risks

Pull from:
- FP&A's variance package risk items consolidated across the quarter
- Treasury's runway report if anything tripped
- Items the prior board pre-reader flagged that remain unresolved
- Any new risks that emerged in the quarter

Mitigation status for each: what we're doing about it, who owns it, when we'll have a clearer view.

### Step 6 — Draft Scenarios & Runway

Pull from FP&A's scenario refresh. Show:
- Bull / Base / Bear endpoints for 12-month and 24-month forward
- Runway under Base case + range
- Distance to next financing event under each scenario
- The watch drivers (the metrics most likely to push between scenarios next quarter)

### Step 7 — Draft Asks

Pull from CFO-maintained file at `~/finance-data/ir/board/<year>-Q<quarter>/asks-source.md`. If missing, leave placeholders.

Common asks pattern:
- 1 introduction request
- 1 candidate sourcing request
- 1 strategic input request
- Any explicit decisions or approvals required from the board

### Step 8 — Render to .pptx

Use the SOP pptx skill. Format conventions:
- Title slide: "Strand · Q[N] [YEAR] Board Pre-Reader · Prepared [DATE]"
- Each section starts with a section divider slide
- Data slides use the financial-tables format from SOP pptx
- Trend charts via Chart.js-style configuration (or whatever the SOP pptx skill uses)
- One message per slide; don't overload

### Step 9 — Items Requiring Human Review

Generate a separate Items Requiring Human Review list focused on the pre-reader specifically:
- Claims that need CFO confirmation
- KPI definitions that may have shifted
- Sensitive items (specific deal mentions, fundraise timing language)
- Anything that contradicts prior pre-readers

---

## Escalation thresholds

| Condition | Action |
|-----------|--------|
| Meeting schedule shows meeting <14 days away and pre-reader hasn't been triggered | Halt, alert to `#ir-ops` immediately, request whether to draft a compressed version |
| Prior quarter's pre-reader can't be located | Halt, alert — continuity requires it |
| Bear-case runway under 6 months | Surface as the Headline of the Risks section regardless of other items |
| A board-level commitment from last quarter wasn't met | Surface in Risks with clear "status update" framing |
| Required input (FP&A scenario refresh, KPI snapshot, Treasury runway) is missing | Halt, alert |

---

## Anti-patterns to avoid

- **Don't pack data onto slides.** A board pre-reader's job is to be readable in 20 minutes. One message per slide.
- **Don't omit risks because the quarter went well.** Boards trust CFOs who name risks even in good quarters.
- **Don't recompute Treasury or FP&A numbers.** Pull verbatim with citation.
- **Don't introduce new metrics that haven't appeared in prior monthly updates.** First appearance in a board pre-reader looks evasive.
- **Don't compress to <15 slides.** A board expects depth in a quarterly pre-reader. The 18-22 slide range is the sweet spot — long enough to substantiate, short enough to read.
- **Don't write speaker notes that contradict the slide.** Every speaker-note line should reinforce, not soften, the slide claim. (The CFO can soften live in the room.)
