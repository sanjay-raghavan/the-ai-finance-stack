# Closed periods

Update this file when a period closes. Agents use it to decide whether to query live QBO or pull from the period-end archive.

**Last closed period:** _(none yet — fill in after first close)_

**Current open period:** 2026-06

---

## Close history

| Period | Close date | Notes |
|---|---|---|
| _YYYY-MM_ | _YYYY-MM-DD_ | _(notes — e.g., extra review pass, restated, etc.)_ |

---

## Rules for agents

- If the user asks about a period whose row appears above with a close date filled in, treat it as **closed** — pull from `archive_location` (see `org.yaml`) if available; otherwise live QBO with a closed-period note.
- If the period is **open**, query live QBO and caveat that journal entries may still be pending.
- For consolidated views in multi-entity orgs, prefer the archive file even for closed periods — eliminations typically live outside the accounting system.
