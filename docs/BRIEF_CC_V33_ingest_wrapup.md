# INGEST V33 — WRAP-UP: EMBEDDING CURRENCY · NEON RECLAIM · RAILWAY CLARITY · RE-SECTIONING · API BACKLOG
**Written:** 09 Aug 2026, by CCh. Repo `Main` (HEAD ≈ `fb8192e`, V32 committees complete). Read `docs/CORPUS_SECTIONS_STORAGE_AUDIT.md`, `docs/LEGISLATION_TRUNCATION_AND_FLAG.md`, `docs/V26_LEGACY_DROP_RECHECK.md`, `handoff_summary.md`, playbook §17 (heavy jobs never on Railway) / §20 (append-safe index).

**Purpose:** close the loose ends after V32 so the corpus is current on *both* search indexes, Neon is reclaimed and the legacy DROP is unblocked, Railway's role is documented and its surplus cleared, and the last content gaps are filled. This is a finish-and-tidy sprint, not new acquisition.

## AUTONOMY / DISCIPLINE
Run end-to-end; fix-or-report. **Scoped commit only** — the search thread still has uncommitted repoint work in this tree; stage files by explicit path, never `git add -A`, never a directory-level add over a shared directory (see the V32 §2 commit for the pattern). Losslessness stays an enforced invariant for any re-sectioning. Predict-then-measure every pass. Heavy jobs on Hetzner, never Railway. **Two spend gates, both Charlie-approved at the sized number: the delta embed (§2) and nothing else material.**

## 0. PRIORITY ORDER
§1 re-section pathological docs (feeds §2) → §2 bring the vector index fully current → §3 Neon reclaim → §5 committee API backlog → §4 Railway inventory (independent, can run any time). §3's legacy DROP waits on the search thread's repoint-confirm.

## 1. RE-SECTION THE PATHOLOGICAL SINGLE-SECTION DOCUMENTS (feeds §2)
`LEGISLATION_TRUNCATION_AND_FLAG.md` found the legislation-tier truncation (8,167 sections, 0.51%) is **concentrated in a few documents stored as ONE giant row** — the worst 15 are all `eur-lex` single-section rows holding a whole document (`eur-lex:32007B0143:1` = 760,509 words, 0.5% embedded), plus `explanatory-notes` (14.3% embedded) and `explanatory-memoranda` (65.8%). **This is a SECTIONING defect, not a chunk-cap one — do NOT raise `MAX_CHUNKS`; even cap 64 would not fix a 760k-word row.**
- Identify the offending rows (the measurement script already lists them; the truncated legislation-tier sections are the candidate set). Re-section each into its natural sub-units — `eur-lex` by article/recital, explanatory notes by their own document structure — reusing the committee splitter's **losslessness invariant** (`assertLossless`: a pure partition or the doc is skipped and counted, never half-written).
- Attach to the existing parent (link, don't fork), retire the giant blob row, same as the committee rechunk.
- Predict the new-section count; measure. Bounded (~8k sections, concentrated in `eur-lex`/explanatory).
- Output feeds §2 so these embed properly in the same pass.
**Acceptance:** no legislation-tier row holds a whole document; the previously 0.5%-embedded docs now section into embeddable units; losslessness holds on every one.

## 2. BRING THE VECTOR INDEX FULLY UP TO DATE (the delta embed — bring embedding current)
The served vector index is the **21 Jul build (~21.8M vectors)** and is now **stale**: everything added since is unembedded — the committee §1 rechunk (78,768), the §2 backfill (222,315), the treaty extension (`uk-treaties-fcdo`, `parliament-treaties`), the §1 re-sectioned docs, and any other post-July additions. Vector serves nobody today (it's off), but it must be current before the flip or vector search is blind to everything since July.
- Compute the delta: `corpus_sections` rows with no current `corpus_vec` entry (new or re-sectioned). Report the count.
- **PREDICT the embed cost before running** (`gemini-embedding-001` @768-d, batch $0.075/M) and report it for Charlie's go — committee delta ≈ $15; treaties + re-sectioned add some; expect low tens of dollars total. Do not spend past the sized, approved number.
- Embed via the existing batch pipeline (checkpointed, idempotent, attempted-vs-stored reconciliation), then the ANN index merge as a **heavy job on Hetzner** (never Railway; ~18–20 GB peak per recent runs). Committee sections are per-finding (small) so they embed whole; the §1 re-sectioning is what makes the `eur-lex` docs embed whole too.
- Do NOT flip any vector flag — the flip is the search thread's action once the index is current (legislation already cleared to proceed at 79.2%/99.3%; gate is `LEX_VECTOR_STREAMS` + `LEX_QUERY_ROUTER=true` + `VECTOR_SEARCH_URL`).
**Acceptance:** every `corpus_sections` row has a current vector; index row count reconciles; the merge leaves 0 unindexed; report the scored cost vs prediction.

## 3. NEON RECLAIM (corpus_sections storage — ingest owns this)
The audit answered the big question: **no body text is wasted in Neon** (it's all in R2; `compiledText` already dropped). Reclaimable = unused indexes (~1.7 GB) + the legacy `Legislation*` DROP (~1.73 GB). Neon is ~16 GB of the 17.5 GB line and has grown since (committee backfill + graph), so this matters.
- **§3a — drop the no-reader indexes FIRST.** Running-order rule from the audit: `DROP INDEX` reclaims immediately, whereas `DROP COLUMN` needs a full-table rewrite that wants room for a second copy of a ~13 GB table and could hit the ceiling *while trying to relieve it*. Re-read `CORPUS_SECTIONS_STORAGE_AUDIT.md` for the exact no-reader list (the `r2RawKey` written-never-read column, the ~866 MB index serving nothing, the four no-reader candidates). Index drops are reversible (rebuildable) — additive-safe.
- **§3b — the legacy DROP, GATED.** `LegislationItem` / `LegislationSection` (+ the compilation/enrichment leftovers). **Do NOT run until the search thread confirms the last readers are repointed** — `backfill-citations.ts:48`, the six web-app paths in `V26_LEGACY_DROP_RECHECK.md` §(a), and the one `IdeaLegislation` row. This is the one irreversible step: **`pg_dump` the legacy tables to R2 as an archive first**, then DROP. Report the reclaimed GB and the new Neon fill.
**Acceptance:** unused indexes dropped, Neon fill measured before/after; legacy DROP either executed (if repoint-confirmed) or blocked-and-recorded with the precise remaining readers.

## 4. RAILWAY — INVENTORY, DOCUMENT THE ROLE, CLEAR THE SURPLUS (NOT a decommission)
Charlie's steer: Railway is **staying** (on Hobby, which is fine) and runs some compute — but its exact role is unclear and the data that has fully moved to Neon should be cleared out. Do NOT remove live services.
- Inventory the Railway project: every service (the `Ingest`/`ops` workers, `vector-serve`, the old `scrutinise-db` Postgres, anything else), what each does, and which are live-load-bearing vs stale.
- The old `scrutinise-db` Postgres is the surplus suspect: it held the pre-V26 app data that migrated to Neon. Confirm whether it still holds that data; if so, `pg_dump`-archive to R2 if not already archived, then it can be emptied/removed — but only after confirming nothing live reads it (0 app connections was verified at the V26 cutover; re-verify).
- Write `docs/RAILWAY_ROLE.md`: current services + role, what's live vs cleared, and the intended future role (transient compute + the always-on serve/worker services; heavy jobs go to Hetzner per §17). This is the "clear picture" Charlie asked for.
**Acceptance:** `RAILWAY_ROLE.md` written; surplus (the migrated old DB) archived + cleared if confirmed safe; live services untouched; a plain statement of what Railway does now and is for.

## 5. COMMITTEE API-PATH BACKLOG (82 publications)
V32 §2 left **82 publications with no rows — all `downloadable` via the committees API** (not archive gaps). Re-run the committees-api ingest for exactly those 82: fetch the served `documents[]`, split per-finding (same splitter), land → §3 metadata → catch-up into the index. Small; closes the committee corpus to 100% accounted.
**Acceptance:** the 82 either ingested or each reclassified as a recorded known-unknown with a reason.

## 6. VERIFICATION & DOCS
Per-pass scorecards with predictions scored. Neon fill before/after; vector index row count before/after; embed cost scored vs predicted. Update `CORPUS_SECTIONS_STORAGE_AUDIT.md` (what was reclaimed), `RAILWAY_ROLE.md` (new), CHANGE_LOG, handoff. Note the embed spend so Charlie's running-cost sheet can be updated. `tsc --noEmit` clean.

## 7. OUT OF SCOPE
The vector flip itself (search thread); the `withPosition:false` ranking fix + `corpus_fts_positions` (search thread); evidence-row inquiry-id backfill (a separate committees follow-on); any new corpus acquisition.

## GIT
No git mid-sprint; single **scoped** commit-all.sh (explicit paths, nothing under `scrutinise-web/`, no directory-level adds); preview; Main.
