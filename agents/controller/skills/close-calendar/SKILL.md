# Skill: Close Calendar

Generate the month-end close calendar for the current period, with day-by-day task sequencing, dependencies, and target completion dates.

---

## When to invoke

Pass 1 of the close — first thing on Day 1 of each new period. Always before any other close work.

---

## Inputs

- Current period (year, month)
- Target close duration in business days (default: 3)
- Company-specific dependencies (from `~/finance-data/config/close-dependencies.yaml` if it exists)
- Any known one-time events for the period (from `~/finance-data/closes/<year>-<month>/one-time-events.md` if pre-populated by the human)

---

## Outputs

A markdown file at `~/finance-data/closes/<year>-<month>/close-calendar.md` containing:

1. **Header** — period, target close date, today's date, calendar generation timestamp
2. **Task list grouped by Close Day** — Day 1, Day 2, Day 3 (and Day 4+ if applicable)
3. **Per task** — owner (agent or human), prerequisites, estimated duration, status
4. **Critical path** — the sequence of tasks that determines close duration
5. **Dependencies block** — what depends on what, in plain language

Also post a one-paragraph summary to `#finance-ops` Slack.

---

## Process

1. **Invoke `finance:close-management`** with the current period and target duration. This returns a base task list using the 3-day accelerated close framework.

2. **Layer in company-specific dependencies.** If `close-dependencies.yaml` exists, merge those into the base task list. Example: "Revenue close depends on Stripe billing close (external)".

3. **Account for one-time events.** Any item in `one-time-events.md` becomes an additional task with appropriate sequencing. Examples: deferred revenue true-up after a contract amendment, lease modification, equity transaction.

4. **Assign owners.** For each task:
   - If a Finance Stack agent owns it (e.g., AP Watcher, AR Follow-Up), assign to that agent's handle
   - If a human owns it, leave as "Human · [role]" where role is Controller, FP&A Lead, etc.
   - For external dependencies, mark as "External · [system or counterparty]"

5. **Identify the critical path.** Walk the task graph; mark the longest chain of dependencies as the critical path.

6. **Validate target close date** is achievable. If the critical path exceeds the target close duration, surface the gap in the Summary section and post an alert.

7. **Save the file** in the standard artifact structure (Summary · Sections · Items Requiring Human Review · Methodology · Audit Trail).

8. **Post to Slack** — one paragraph: "March close kicked off. Targeting close by [date]. Critical path runs through [task]. [N] items flagged for human review on Day 1."

---

## Escalation thresholds

- **Critical path exceeds target close duration** → surface in Summary, post alert
- **Any task has no clear owner** → flag in "Items Requiring Human Review"
- **Any one-time event without a sequencing assumption** → flag and propose a position; require human confirmation

---

## Anti-patterns to avoid

- Don't invent dependencies that aren't in the config or one-time-events file. The close calendar should reflect what's known, not what you assume.
- Don't compress the calendar to hit the target if the critical path doesn't allow it. Surface the gap honestly.
- Don't omit the methodology section — auditors will read this file in the future.
