# voice/ — how your writing sounds

Different from templates: templates capture *structure*, voice captures *tone*. Drop in 2–4 examples of writing you want agents to emulate.

## Recommended files

| File | Used for |
|---|---|
| `ceo-update-style.md` | Monthly all-hands updates, exec memos |
| `investor-letter-style.md` | IR agent — quarterly letters, monthly updates |
| `controller-memo-style.md` | Technical accounting memos, audit responses |
| `slack-update-style.md` | The voice agents use when posting to Slack |

## What's in each file

A short markdown file with:

1. **2–3 paragraph excerpts** from real writing you want to match (redact names/numbers if needed)
2. **A short list of voice attributes** — formal vs. conversational, first-person vs. plural, use of jargon, sentence length preferences
3. **What to avoid** — words/phrases you never use, common AI-slop tells (em-dashes, "delve", "tapestry", etc.)

## Example structure for `ceo-update-style.md`

```markdown
# CEO update — voice

## Example excerpt 1

Q1 closed yesterday. Three takeaways:

1. Cash burn is $X — $Y better than plan, driven by hiring pacing.
2. Pipeline is healthy on logos but light on ACV. Working with sales on this.
3. We promoted Z to VP Eng. More on that in #all-hands.

Numbers tab attached. AMA in #questions.

## Voice attributes

- Conversational, first-person plural ("we")
- Short paragraphs (1-3 sentences)
- Numbers first, narrative second
- No corporate speak ("synergies", "leverage")
- One specific call-to-action at the end

## Avoid

- Em-dashes
- "Delve", "tapestry", "robust"
- "Going forward"
- Long preambles
```

The agent will read these examples before drafting and try to match.
