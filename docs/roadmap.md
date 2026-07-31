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

---

## Funding-route guidance for non-legislative ideas

Many policy proposals require new money or reallocation rather than (or in addition to) statutory change. The platform should be able to recognise this and surface the relevant non-legislative pathways:

- Departmental Spending Review bids
- Estimates / Supply and Appropriation Bill line items
- Departmental Annual Report and Accounts
- HM Treasury "Green Book" appraisal requirements

First step: an information page explaining the funding pathways for users whose ideas need money rather than (or as well as) law. Later: ingest Spending Review documents and Departmental Annual Reports into a parallel corpus to enable Lex to reference current departmental spending and identify realistic funding routes.

**Target:** design after V2-LEX-FLOW-AND-LEGPANEL ships.

---

## Separate Postgres schema for ingest-owned tables

The app's own models (`User`, `Idea`, `Community`, etc.) and the ingest pipeline's operational tables (`corpus_sections`, `ingest_queue`, `ingest_progress_snapshots`, `source_rate_limits`, `scheduler_lock`, and the various now-defunct scratch tables like `corpus_snapshots`/`corpus_targets`/`specialist_queue`/`v26_cs_gids`) currently all live in the same `public` schema and the same Prisma schema file, migrated together even though they're owned and evolved by completely different workflows — the ingest pipeline routinely creates/drops tables out-of-band (raw SQL, one-off scripts) without going through `prisma migrate`.

Proposal: move ingest-owned tables into a separate Postgres schema (e.g. `ingest`), and scope `prisma migrate diff`/`schema.prisma` to `public` only. This would have prevented (or at minimum made much more visible) the 30 Jul 2026 incident's contributing tangle, where `prisma migrate diff` against production mixed genuine app-schema drift (the Community migrations) together with a long tail of unrelated ingest-table churn, making the diff much harder to read and reason about under incident pressure. See `docs/CHANGE_LOG.md`, "INCIDENT — production `/dashboard` full outage" (2026-07-30 02:10 UTC).

**Not yet scoped:** whether ingest scripts connect via a separate `DATABASE_URL` (schema-qualified) or the same connection with `search_path` set; whether this is a `prisma migrate` operation or a manual `ALTER TABLE ... SET SCHEMA` pass followed by updating every ingest script's raw SQL references.
