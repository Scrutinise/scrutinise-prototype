# SPRINT V26 — UNIFICATION + RAILWAY DECOMMISSION (structural)
**Written:** 16 Jun 2026, by CCh. Repo `Main` (HEAD = V25 close). **Build input: `UNIFICATION_PLAN.md` (V24) — follow its §4 sequencing.**
**Supersedes the structural brief previously labelled V25 (renumbered after the V25 feed sprint).**

## AUTONOMY
Run end-to-end without pausing. Decisions here are pre-made; reversible in-scope choices are yours. Anything needing a rethink: fix if reversible, else complete the rest and report with a recommendation. **Two explicit gates only (both lower-risk now that site access is closed): the Migration-B cutover flip (§3) and the final DROP (§6). Stop and flag at those; everything else runs unattended.** No git until commit-all.sh.

## 0. WHY NOW / WHAT CHANGED
Charlie has **closed public site access** pending the new Search/Lex build. This is the ideal migration window: the Migration-B cutover no longer needs a careful write-freeze — there are no users to freeze — so it becomes a plain maintenance operation with effectively zero user impact. End state unchanged: one corpus store, one app DB on Neon, Railway = compute-only.

**Precise search dependency (read this — it is narrower than it looks):** the legacy `LegislationSection.ftsVector` **already exists and is populated on Neon** (copied in the V.4-FTS-3 work). So Migration B repoints the live search paths onto Neon's existing legacy index — search keeps working, relocated not rebuilt. The *new* `corpus_sections` FTS (currently a dead no-op) is a **separate, later** job owned by the search thread. Therefore the migration does NOT wait on the search redesign. The only thing gated on the search thread is retiring the legacy `ftsVector` and dropping the legacy table — and the DROP waits a week of soak regardless (§6). Nothing blocks the migration itself.

## 1. PRECONDITION — settle the corpus first
Run only after the V25 post-push seeds (Senedd, Bills, College, inquiry re-seed) have drained and `v25-rebaseline.ts --confirm` has stamped them ✓. Unification measures the legislation overlap; let the corpus be still before measuring it. (The V25 seeds are different corpora from the legislation Migration A touches, so they don't change the overlap maths — but settle + rebaseline first for clean accounting.) If a V25 seed is still draining when this sprint starts, proceed with the migration anyway (independent data) and note it.

## 2. MIGRATION A — corpus unification (additive, reversible, online) — per UNIFICATION_PLAN §2.1
1. Normalize the 38,571 non-matching legacy `legislationGovUkId`s (read-only): split docId-form differences (ukpga calendar-vs-chrome, eudn/eudr-vs-celex, nisi/nia sub-typing) from genuinely legacy-only items → real coverage-gap list.
2. Gap-fill the genuinely-absent items via the existing tna-legislation queue (online, R2-backed, first-class `corpus_sections`).
3. Compilation layer (compiled-text 2.7%, Lex summaries 0.1%, amendments): preserve as enrichment keyed by `(legislationGovUkId, sectionNumber)` — do NOT discard, do NOT copy text into `corpus_sections` (V3 pointer-only rule). Nullable columns or a small join table.
Additive only (`ON CONFLICT DO NOTHING`); reversible by corpus+watermark until §6.

## 3. MIGRATION B — app tables Railway → Neon — per UNIFICATION_PLAN §3
1. `prisma migrate deploy` on Neon to create the app tables not yet there (User/Idea/Comment/Vote/Group*/Points*/Notification/ActivityLog/OperationalDocument/…).
2. Copy app data Railway→Neon, FK order respected (small; `OperationalSection` 61k is the only bulk).
3. Repoint `DATABASE_URL` → Neon **pooled** endpoint (`pgbouncer=true&connection_limit=1`; keep `DIRECT_URL` for migrations). Collapse the `prisma`/`prismaSearch` dual-client to one.
4. Repoint all three search paths (UNIFICATION_PLAN §1.3) onto Neon's **existing legacy `ftsVector`** (already present on Neon); move the `/legislation-search` sequential-scan path onto the index. (New FTS = search thread, later — not here.)
5. **GATE: cutover.** Site access already closed, so: brief maintenance state → final delta copy → flip `DATABASE_URL` + redeploy → smoke-test (auth, idea create, Lex grounding, LegislationPanel) → done. No user-facing freeze needed. **Flag readiness and get Charlie's go before the flip.**

## 4. RAILWAY POSTGRES — prepare decommission
After B + smoke-test pass: Railway Postgres serves nothing. Leave it intact and running through the soak (§6). Confirm Railway then holds only Ingest + Ops + the idle DB. (Charlie's 28 Jun Hobby downgrade stands separately.)

## 5. VERIFICATION & DOCS
Smoke-test evidence; Migration A reversibility confirmed (watermark recorded); rollback drill documented; UNIFICATION_PLAN updated to as-built; CHANGE_LOG + handoff + playbook (doctrine: app-DB on Neon pooled, one client, Railway = compute-only). Per-corpus table emitted for the workbook.

## 6. GATE: SOAK + DROP — do NOT execute this sprint
Document the checklist only: soak ≥1 week clean → search repointed and verified (and, when the search thread delivers the new `corpus_sections` FTS, Lex grounding moved onto it) → Neon backup/branch confirmed → THEN drop legacy `Legislation*` tables + decommission Railway Postgres. The one irreversible step; it waits for an explicit Charlie go.

## 7. CHARLIE'S PARALLEL ACTIONS
The cutover go (§3) and the later DROP go (§6); Scottish XHR capture (unblocks scottish-courts + Scottish Parliament — ingest, not migration); Railway Hobby downgrade 28 Jun.

## 8. OUT OF SCOPE
New `corpus_sections` FTS / embeddings / RAG (search thread); quango T2/T3 + exempt orgs + other outliers (V27); inquiry evidence bundles; US spec (after soak).

## 9. GIT
No git mid-sprint; single commit-all.sh; preview approval; Main. The two gates (§3 flip, §6 drop) are separate explicit approvals.
