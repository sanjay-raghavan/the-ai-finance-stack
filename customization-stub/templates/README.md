# templates/ — what your outputs look like

Drop in one example of each deliverable your finance team produces. Agents will read these to understand structure, sections, table conventions, and house style — then produce outputs that match.

You don't need to fill in every template. The agents work with whatever exists. Start with the ones you produce most often.

---

## Recommended templates

| File | Used by | What to upload |
|---|---|---|
| `board-deck.pptx` | board-prep skill (future), exec-summary | One recent board deck (redact numbers if needed) |
| `exec-update.docx` | exec-update skill, controller, fpa-analyst | One monthly CFO/CEO email or memo |
| `ir-update.md` | investor-relations agent | One investor monthly update (text only fine) |
| `variance-package.xlsx` | fpa-analyst, variance-decomposition | One example variance package |
| `close-packet.md` | controller, close-management | Your standard close-packet narrative |

---

## What agents extract from templates

When an agent reads a template, it pulls:

1. **Structure** — section headings, the order they appear, what's in each
2. **Tables** — column conventions, what's bolded, what's totaled
3. **Tone markers** — voice cues (formal / informal, first-person / third-person)
4. **Things you always include** — recurring blocks (e.g., "Top 3 risks" always appears)
5. **Things you never include** — what's deliberately left out

The agent then produces new outputs that match.

---

## Privacy

These templates are gitignored. If you're sharing your Stack config with a colleague (e.g., handing off the dedicated laptop), this folder doesn't travel with the repo — only the stubs do.

If you want to share a template format publicly (e.g., contribute back to the Stack), copy a sanitized version to `customization-stub/templates/` and open a PR. Never commit a real board deck.
