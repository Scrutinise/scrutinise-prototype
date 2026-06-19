# V26 CUTOVER RUNBOOK — Migration B flip (§3 GATE) + soak/DROP (§6 GATE)

*Written 16 Jun 2026 (V26 structural sprint). Everything in §1–§5 of the sprint is DONE and verified at the data level. This runbook covers the two human-gated steps that remain: the **cutover flip** (B.5) and, a week later, the **soak + DROP** (§6). Both need Charlie's explicit go.*

---

## STATE AT HANDOFF (what is already done, no flip needed)

- **Migration A (corpus unification):** complete + reversible.
  - 38,571 non-matching legacy gids normalized → **24,247 genuine gaps** (UKSI 23,513 · UKPGA 394 · EUR 339 · ASP 1); 14,324 were docId-form differences already covered (ukpga calendar↔regnal 8,514 · uksi regional 4,041 · eur eudr/eudn/celex 1,769). 25/25 live-TNA fetchability sample passed; 99.6% hold legacy `originalText`.
  - Gap-fill **seeded** (24,246 tna-legislation rows, priority 5) — draining online behind the V25 work.
  - Compilation layer **preserved**: `legislation_compilation_enrichment` (26,126 rows — 24,579 compiled-text keys / 1,142 lex-summary keys / 5,635 unapplied-amendment JSON), keyed by (legislationGovUkId, sectionNumber), pointer-only. LegislationAmendment/Correction/CrossRef were all empty — nothing else to preserve.
- **Migration B prep:** complete.
  - All app tables already existed on Neon; **app data copied Railway→Neon** (24 tables, 62,394 rows; OperationalSection 61,315 the only bulk) with exact row-count parity. `_prisma_migrations` baselined on Neon (13 rows).
  - Column parity verified for every copied table.
  - **Search repointed in code** onto Neon's existing legacy `ftsVector` (914,274 LegislationSection + 61,315 OperationalSection, both 100% populated, both GIN-indexed). Dual client collapsed (`prismaSearch` → alias of `prisma`). `/legislation-search` moved off the per-query seq-scan onto the GIN index (EXPLAIN confirms Bitmap Index Scan). `tsc --noEmit` clean.
- **Railway** holds only: `scrutinise-db`, `Ingest`, `Ops`.

**The flip has NOT happened.** Production `DATABASE_URL` still points at Railway; the live app still reads Railway. Both DBs carry identical legacy search data, so the deployed code works on either — the flip is a clean switch.

---

> **STATUS: EXECUTED + VERIFIED 18 Jun 2026.** Charlie moved the Vercel env to Neon; `v26-cutover-verify.ts` confirmed prod `GET /api/legislation/search` → HTTP 200 / 20 items from Neon, Railway scrutinise-db shows 0 app connections, Neon serves via pgbouncer. Soak clock started 18 Jun → §6 DROP earliest ~25 Jun. The steps below are retained as the as-run record + rollback reference.

## §3 GATE — THE CUTOVER FLIP (B.5)   ← DONE 18 Jun (was: needs Charlie's go)

Site access is closed, so there is **no user write-freeze to coordinate** — this is a plain maintenance switch.

### Pre-flip checklist
1. Confirm app-data copy is current. Because the site is closed there are no writes, so the V26 copy is already the final state. If any write happened since, re-run the (idempotent) copy:
   `tsx scripts/ingest/v26-copy-appdata.ts --apply`
2. Confirm Neon FTS intact: `tsx scripts/ingest/v26-fts-state.ts` (both tables 100% populated, both GIN indexes, live @@ hits).
3. Confirm the **pooled** endpoint serves the app end-to-end via the real Prisma client (PgBouncer): `tsx scripts/ingest/v26-pooled-smoke.ts` — auth/User, Idea, and both ftsVector search paths. (Ran green 16 Jun: User.count=29, both searches return hits.) This is the exact data path the flip switches to.

### The flip (Vercel env, then redeploy)
3. Set the production env vars on Vercel (and local `.env` for parity):
   - `DATABASE_URL` → the Neon **pooled** endpoint: take the current `NEON_DATABASE_URL`, insert `-pooler` into the host (`ep-old-dust-aboxi69a` → `ep-old-dust-aboxi69a-pooler`), and append `&pgbouncer=true&connection_limit=1`.
   - `DIRECT_URL` → the current (non-pooled) `NEON_DATABASE_URL` verbatim (used by `prisma migrate`; wired in `prisma.config.ts`).
   - Leave `NEON_DATABASE_URL` as-is (harmless; the code no longer needs it once the clients are collapsed).
4. Redeploy Vercel.

### Smoke-test (post-redeploy) — the brief's four checks
5. **Auth:** sign in (Clerk) → session resolves, user record loads (User table now on Neon).
6. **Idea create:** create an idea → Stage 1 fires, row appears (Idea table on Neon).
7. **Lex grounding:** in idea chat, trigger a legislation lookup → `POST /api/search` returns hits (legislation + operational, both from Neon `ftsVector`).
8. **LegislationPanel:** `POST /api/ideas/[id]/legislation-search` returns ranked sections with R2 text hydration (now GIN-indexed).
   - Also spot-check `GET /api/legislation/search?q=...` (title ILIKE browse).

### If a smoke-test fails — ROLLBACK (minutes)
- Set `DATABASE_URL` back to the Railway string (still in git history / Vercel env history) and redeploy. Railway is **intact and running** — no data was destroyed. The deployed code reads Railway's identical legacy search data, so search keeps working on rollback too.

---

## §4 — RAILWAY POSTGRES (post-flip)

After the flip + smoke-test pass, `scrutinise-db` serves nothing. **Leave it intact and running through the soak.** Railway then holds only `Ingest` + `Ops` + the idle `scrutinise-db`. (Charlie's 28 Jun Hobby downgrade is separate.)

---

## §6 GATE — SOAK + DROP   ← do NOT execute this sprint; needs a separate Charlie go

The one irreversible step. Checklist before dropping:
1. **Soak ≥ 1 week** clean on Neon (no app errors traceable to the DB move).
2. **Search repointed + verified** (done in code; verified live at the flip). When the search thread delivers the new `corpus_sections` FTS, move Lex grounding onto it and retire the legacy `ftsVector` first.
3. **Verified Neon backup / branch** taken.
4. THEN, and only then:
   - `DROP TABLE` the legacy `Legislation*` family: `LegislationSection`, `LegislationItem`, `LegislationAmendment`, `LegislationCorrection`, `LegislationCrossRef` — **on both Railway and Neon** (Neon keeps `legislation_compilation_enrichment` + `corpus_sections`, which carry the preserved value).
   - Decommission Railway Postgres (`scrutinise-db`).

**Migration A reversibility (until §6):** every A step is additive or droppable.
- Gap-fill: the seeded rows are `priority=5, sourceType='tna-legislation'`; the corpus_sections they create are exactly the gids in `v26_nonmatch` where `category='gap'`. Roll back by deleting those queue rows and the corresponding corpus_sections rows (join on `split_part(id,':',2) = gid`). Nothing legacy was deleted.
- Enrichment: `DROP TABLE legislation_compilation_enrichment` (pure additive copy).
- Scratch tables `v26_cs_gids`, `v26_nonmatch` are read-only artefacts — drop after §6.

**Migration B reversibility (until §6):** Railway left intact; flip `DATABASE_URL` back + redeploy. The Neon app tables are an additive copy.
