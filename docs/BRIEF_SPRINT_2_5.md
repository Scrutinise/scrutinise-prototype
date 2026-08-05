# BRIEF — Sprint 2.5: feedback capture + document export

**Thread:** Lex/UX. **Date:** 05 Aug 2026. **Spec:** `LEX_REBUILD_DESIGN` §20.5 and §8.2 (the §21 brief in
the §20–21 addendum, restated here with concurrency rules).

**This sprint runs CONCURRENTLY with active Search and Ingest sessions on the same repo. Read §0 before
touching anything.**

---

## §0 — Parallel-safety rules (non-negotiable)

Other CC sessions are working the search re-index and the statistics ingest right now. This sprint was chosen
because it collides with neither — but only if these rules hold.

**Stay inside your lane. Touch only:**
- `scrutinise-web/**` (app code, its Prisma schema, its migrations)
- `docs/CHANGE_LOG.md`, `docs/handoff_summary.md`, `docs/LEX_PLAYBOOK.md` — **append only**, see below

**Do NOT touch, for any reason:**
- `scripts/ingest/**` or `scripts/stats/**` — other sessions are live in there
- anything under `scripts/ingest/search/**` — **its `watchPatterns` redeploy `fts-serve`, and a redeploy
  mid-re-index is actively harmful**
- `corpus_fts`, the Lance tables, R2 search assets, the stats Neon project
- `scripts/ops/heavy-job/**`

**Git discipline, tightened for concurrency:**
1. **Never `git add -A` / `git add .`** — another session's half-written files are sitting in the same working
   tree. Add explicit paths only.
2. **Name the commit script `commit-lex-2.5.sh`, not `commit-all.sh`.** Two sessions writing `commit-all.sh`
   clobber each other. Delete it after the push, as usual.
3. **Before editing any shared doc, re-read it from disk** — it has probably changed since you last saw it.
   Append your entry; do not rewrite the header or reflow surrounding sections.
4. **`git pull --rebase` before pushing**, and if a conflict appears in a shared doc, keep both entries.
5. Standard rule stands: **no git during the sprint**; one script at the end; Charlie approves; you run it once
   and delete it.

**Database:** `FeedbackItem` goes on the **app** Neon DB (`ep-old-dust-…`). Run the whichdb check first and
say which host you hit. Additive idempotent SQL via `prisma db execute` — **never `prisma db push`**. The
other sessions are on the stats project and on R2, so there should be no overlap; confirm rather than assume.

**Deploy awareness:** pushing `scrutinise-web/**` triggers a Vercel build — expected and fine. It must not
trigger a Railway redeploy; if you find yourself editing anything that would, stop and flag it.

**Un-promoted preview. Do not promote to production.** Charlie's Lex walk-through is outstanding and this
sprint must not change what he is testing: **nothing in the field machine, the conductor, the canonical-state
contract, or the panels' state handling may be modified.** Additive UI only.

---

## Task 1 — Feedback capture (§20.5)

When a user critiques Lex's output — briefing, seeded causes, policy options, cost figures — Lex offers to
pass it back to Scrutinise.

- **Schema:** `FeedbackItem { id, userId, ideaId, stage, surface (BRIEFING|CAUSES|OPTIONS|COSTS|OTHER),
  originalText, summarisedText, userEdited, consentGiven, createdAt }`. Additive, idempotent.
- **Trigger:** enable the existing **disabled "Give feedback" placeholder** on the Background panel CTA row,
  and make the same action reachable from the chat.
- **Flow:** Lex produces (a) a summary with personal content stripped and (b) shows it back verbatim with
  **Yes / Edit / No**. Nothing is stored or sent without an explicit Yes.
  `// The user sees the exact text before it leaves their control — consent is explicit, not implied.`
- **On Yes:** persist the `FeedbackItem` **first**, then send via Resend to `cl@scrutinise.org` (subject
  carrying stage + surface). **A mail failure must not lose the record** — persist, then send, and log the
  send failure.
- **Lex confirms honestly what happened** — per §19-C 1b, no claiming a send that failed.

## Task 2 — Document export (§8.2 — currently stubbed null)

- Generate **docx and PDF** of the Initial Background briefing from the stored `Document` record; populate
  `docxUrl` / `pdfUrl`; store in R2 alongside existing assets.
- Download available from the legislation panel **and** listed in the idea's Documents/Exports tab.
- **Regenerate on demand** — the briefing changes when a search is re-run. Never serve a stale file silently;
  show what it was generated from and when.
- **Content is a rendering of stored state only:** the briefing prose plus its grouped source references with
  citations and links. Nothing generated fresh at export time.
- `// First step toward §20-B, the full proposal document — build the render path so it generalises rather
  than special-casing the briefing.`

## Acceptance criteria

- Critiquing Lex's output offers feedback; the summary is shown before sending; **No** sends nothing; **Yes**
  both stores and emails; a mail failure still leaves the stored record and is logged.
- No personal content survives into `summarisedText` — test with a deliberately personal input.
- The Initial Background downloads as a readable docx and PDF, sources and citations intact.
- Re-running the search then re-exporting produces an updated file, and the UI shows the generation timestamp.
- **Nothing in the field machine, conductor, canonical-state contract, or panel state handling is modified.**
- Working tree respects §0: no files touched outside `scrutinise-web/**` and the three shared docs; commit
  script named `commit-lex-2.5.sh`; explicit paths in every `git add`.
