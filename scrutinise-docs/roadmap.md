# Scrutinise — Product Roadmap

Items listed here are planned but not yet in an active sprint. Each entry describes the intention and the data/infrastructure already in place to support it.

---

## AI feedback categorisation and triage

After a `Feedback` record is created, an AI categorisation step runs in the background:

- Categorises into: Functionality suggestion / Bug or problem / General complaint / Immediate support need / Other
- Assigns a priority (low / medium / high / urgent)
- Generates a one-line summary for fast admin scanning
- Posts urgent items to admin via an additional channel (Slack? SMS?)

**Target:** implement within 2–3 sprints of V2-SUPPORT-TAB completion.

**Schema already in place:** `Feedback` model has `aiCategory`, `aiPriority`, `aiSummary`, `aiCategorisedAt` columns ready.

**Longer-term ambition:** replicate basic Zendesk-style functionality — threaded conversations, status tracking, admin assignment, customer notifications on status change. Not Zendesk itself; a lightweight in-house equivalent.

---

## Bring-your-own AI key

Users can add their own API key for one or more AI providers (OpenAI, Anthropic, Google, etc.) in Settings. When configured, Lex calls associated with that account use the user's key rather than the platform key. Useful for heavy users, specific model requirements, or organisational data-handling policies.

---

## Admin feedback view

A `/admin/feedback` listing page for reviewing and triaging user feedback submissions. Status management (NEW → TRIAGED → RESOLVED / WONTFIX), admin notes, and filtering by type and status. Separate sprint from V2-SUPPORT-TAB — entity is already built.
