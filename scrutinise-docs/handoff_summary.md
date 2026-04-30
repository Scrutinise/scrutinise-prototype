# SCRUTINISE — CONVERSATION HANDOFF SUMMARY

*Last updated: 30 April 2026 v41*

***

## CURRENT STATE — SPRINT V2.75-I COMPLETE ✓

**This section supersedes everything below. The V2L commit summary that follows is preserved as historical context but does not reflect current working state.**

### What is happening right now

Charlie is leaving for 4 days early on 26 April 2026. V2.75 is an architectural reset triggered by three failures discovered after V2L's full-corpus ingest had been running for \~24 hours.

**The three failures (24 April 2026):**

1.  **TNA gold standard corrupted.** `fetchTnaCompiledText()` strips XML tags from the full TNA response without scoping to the target P1group node first, so editorial content from other Acts contaminates the stored compiled text. Visible at `/legislation-compare`: "40B Employment Rights Act 2025" appearing inside Equality Act 2010 s.11. AI Jaccard scores 0–1.4% as a result.
2.  **Compile worker idling against false signal.** Sections stuck in `COMPILING` status after a crash are invisible to the `PENDING`-only query, so the compile loop reports "8908 COMPILED, 0 PENDING" despite \~10,875 sections being in `FAILED` state.
3.  **Ingest crashed at act 1,891.** Administration of Justice Act 1982 (ukpga/1982/54). Prisma P1017 — Railway closed an idle connection during a long TNA fetch throttle wait. No connection-pool retry config existed.

### Architectural discovery (V2.75-F audit, 25 April 2026)

**The** `.xml` **files in R2 are NOT original-as-enacted.** They are P1group sub-extracts from TNA's current-version full-act CLML — already-compiled by TNA, with all amendment markup stripped before we saw it. **Zero** `<Addition>`**/**`<Substitution>`**/**`<Repeal>` **tags exist in any of the 40,635 stored XML files.** Cannot build a deterministic compiler from this data.

The 5,507 AI-compiled `.compiled.txt` files are tag-stripped prose of TNA's already-compiled text with zero amendments fed in (Amendment table has zero rows, was never populated). They are noise — neither compilations nor summaries nor true Layer 6.

The legislation-compare page was structurally incapable of scoring 100% — comparing TNA-current text against an AI re-compile of the same TNA-current text.

### V2.75 sprints completed

| Sprint     | Date   | Outcome                                                                                                                                                                                                                                                                                                                                                                                                               |
|------------|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| V2.75-A    | 24 Apr | `withPrismaRetry()` helper added (handles P1017/P1001, 3 retries × 5s). Top-level try/catch per act with `failCount`. AdaptiveThrottle confirmed in place. tsc clean.                                                                                                                                                                                                                                                 |
| V2.75-B/F  | 25 Apr | Architecture audit produced (V2.75_architecture_audit.md). AI output samples (V2.75_ai_output_samples.md). Diagnostic report (V2.75_diagnostic_report.md).                                                                                                                                                                                                                                                            |
| V2.75-C    | 25 Apr | Fixed `fetchTnaCompiledText()` to scope to `<P1group>` with attributes (regex `/<P1group[^>]*>([\s\S]*?)<\/P1group>/g`). Tests passed for Equality Act sections; Companies Act 2006 returns HTTP 202 (AWS WAF challenge / on-demand generation).                                                                                                                                                                      |
| V2.75-D    | 25 Apr | DB state confirmed: COMPILED 26,365; FAILED 10,875; PENDING 3,395; COMPILING 0. Stale-reclaim added to compile.ts (10-minute threshold).                                                                                                                                                                                                                                                                              |
| V2.75-G    | 25 Apr | Confirmed 1,142 `.summary.txt` files are genuine plain-English Layer 6 summaries (Lex output). Only AI-compiled sections received summaries.                                                                                                                                                                                                                                                                          |
| V2.75-H1   | 25 Apr | Phase 1 of hard-reset brief: `/enacted/data.xml` URL pattern verified. HTTP 200 for Equality Act 2010 s.11 and Theft Act 1968 s.1. Confirmed: TNA does NOT use inline `<Addition>`/`<Substitution>`/`<Repeal>` markup anywhere — it uses `<CommentaryRef>` + `<Commentary>` footnote pairs (human prose). Companies Act 2006 s.172 returns HTTP 202 for both enacted and current endpoints.                           |
| V2.75-H1.5 | 25 Apr | Bulk download alpha site (`leggovuk.s3-website-eu-west-1.amazonaws.com`) confirmed decommissioned (403 every path). `research.legislation.gov.uk` confirmed invite-only HTTP Basic Auth beta — `WWW-Authenticate: Basic realm="By Invitation Only"` on homepage itself. TNA bulk download PDF documents dataset structure. Verdict: bulk requires credentials. **Charlie approved option 3: proceed with per-section API ingest.** Phase 2 issued. |
| V2.75-H2   | 25 Apr | Phase 2 complete — three-layer ingest implemented and tsc clean. Schema: `LegislationSection.rawXmlKey` → `originalXmlKey` + `tnaXmlKey`; `LegislationItem.effectsKey` + `effectsFetchedAt` added. `r2-client.ts` + `lib/r2.ts`: new key helpers (`originalXmlKey`, `tnaXmlKey`, `effectsKey`). `ingest.ts` full rewrite: `fetchSectionXml()` fetches enacted + current per section, `fetchEffectsFeed()` paginates TNA Changes feed, `withPrismaRetry()` on all DB calls, checkpoint auto-migrated to `ingest-checkpoint.v2L.json`. `compile.ts`: `rawXmlKey` → `originalXmlKey`. Both tsc checks clean. |
| V2.75-H3   | 26 Apr | Phase 3 complete — R2 partial wipe. 65,255 objects deleted (40,635 `.xml` + 24,620 `.compiled.txt`). 1,142 `.summary.txt` files preserved. `wipe-r2-partial.ts` script produced. `prisma db push --accept-data-loss` applied to Railway. |
| V2.75-H4   | 26 Apr | Phase 4 complete — 5-act verification. VERDICT: PARTIAL (4/5). Equality Act 2010: 239 sections, 500 effects ✓. Theft Act 1968: 40 sections, 71 effects ✓. Income Tax Act 2007: 1776 sections, 500 effects ✓. Finance Act 2024: 269 sections, 93 effects ✓. Companies Act 2006: 0 sections — TNA returns 202 for full-act CLML (expected, handled gracefully) ✗. 7 bugs discovered and fixed in ingest.ts during Phase 4 (dotenv path, ECONNREFUSED retry, P1group regex, Pnumber tag-strip, 202 handling, fetch timeout, pnum mismatch). New scripts: `wipe-r2-partial.ts`, `test-ingest-5.ts`, `clear-test-acts.ts`. Full verification report: `V2.75_phase4_verification.md`. |
| V2.75-H5   | 26 Apr | Phase 5 complete — PM2 unattended runner configured and dry-run verified. `ecosystem.config.js` at project root. PM2 6.0.14 installed globally. Dry run confirmed: feed fetched (600 pages, 12,009 acts total in UKPGA corpus), section writes to R2 (`✓ s.N enacted → R2`, `✓ s.N current → R2`) observed, effects feed fetched. `MAX_PAGES` raised 10→200 (Equality Act + Income Tax Act hit cap at 500 entries). `scripts/tsconfig.json` dotenv path added. **READY TO LAUNCH** — awaiting Charlie's go. |
| V2.75-I    | 30 Apr | Resilient resume complete. Root cause identified: PM2 `autorestart: true` restarted on clean exit code 0; main loop iterated all 12,009 acts with 500ms delay each (100 min/restart) even when corpus was complete. Full corpus ingested Apr 29 03:59. Three fixes: (1) `stop_exit_codes: [0]` in `ecosystem.config.js` prevents restart on clean exit; (2) main loop now iterates `remaining` only (not `acts`) — skips 500ms delay for done acts; (3) if `remaining.length === 0`, process logs "Corpus complete" and exits immediately. Also added: checkpoint format upgrade (`permanentlySkipped`, `attemptCounts`), attempt tracking (≥3 failures → permanent skip + crash log), crash exit code (`process.exit(1)` on unhandled errors so PM2 restarts on real crashes). tsc clean. 3-act test passed. PM2 restarted with new config — 241 remaining acts being processed. |

### Critical architectural breakthrough — TNA Effects API

Per TNA's official data-documentation (`https://legislation.github.io/data-documentation/model/effects.html`), the **Changes to Legislation database** is exposed as a structured API:

```
https://www.legislation.gov.uk/changes/affected/{actId}/data.feed
```

Each effect record contains: EffectType (substituted, inserted, repealed, applied, modified), AffectingProvisions, AffectedProvisions, Savings, in-force dates, commencement authority, geographical extent, applied/requires-applied status. Repeals, commencements, and non-textual amendments are deterministically applicable from this data alone. Substitutions and insertions need additional parsing of the affecting provision's prose to extract the literal text change ("In subsection (X) for 'old' substitute 'new'"), but Parliamentary draftsmen use a constrained vocabulary that makes this tractable.

**Coverage:** `to-ukpga` from 1994 onwards, `to-uksi` from 1972 onwards, NI types from 2006, UKLA from 2013. Sufficient for the entire modern statutory tax corpus and most practical use.

This means the original product vision (deterministic compilation with verifiable Jaccard \~100% against TNA gold standard) is achievable, just with a more sophisticated compiler than "find and replace." Build-time estimate: a week of focused engineering post-trip.

### V2.75-H plan — three-layer per-section ingest with effects feed

R2 key scheme:

```
{actId}/sections/{N}.original.xml — enacted CLML from /{actId}/section/{N}/enacted/data.xml
{actId}/sections/{N}.tna.xml      — current revised CLML from /{actId}/section/{N}/data.xml
{actId}/effects.xml               — structured effects from /changes/affected/{actId}/data.feed
```

Schema additions to `LegislationItem`:

-   `effectsKey: String?` — R2 key for the act's effects.xml
-   `effectsFetchedAt: DateTime?`

No schema changes to `LegislationSection`.

**Ingest order per act:**

1.  Fetch section list / metadata as today
2.  For each section: fetch `.original.xml` then `.tna.xml`
3.  After all sections done: fetch `/changes/affected/{actId}/data.feed`, follow pagination if needed, store as `effects.xml`
4.  Update `LegislationItem` with `effectsKey` and `effectsFetchedAt`

**Per-act effects fetch is fast:** \~12,000 acts × \~200ms = \~40 minutes total, trivial relative to the \~4-day per-section run.

### Current state of R2 and Railway (as of 30 April 2026, post V2.75-I)

| Store                              | Content                                                                    | Status                                      |
|------------------------------------|----------------------------------------------------------------------------|---------------------------------------------|
| R2 (scrutinise-legislation bucket) | 267,963 objects: 117,957 `.original.xml`, 145,274 `.tna.xml`, 3,590 `effects.xml`, 1,142 `.summary.txt` | **Full corpus V2.75-H key scheme** |
| Railway `LegislationSection`       | ~11,768+ acts ingested, sections growing                                   | **In progress — 241 remaining acts**        |
| Railway `LegislationItem`          | ~12,009 rows (full UKPGA corpus)                                           | **Complete**                                |
| Railway `Amendment`                | 0 rows                                                                     | Empty (never populated)                     |
| PM2 `scrutinise-ingest`            | Running with new V2.75-I code — 241 remaining acts being processed         | **Online — will self-terminate on completion** |

### Bulk download status

Bulk download alpha site (`leggovuk.s3-website-eu-west-1.amazonaws.com`) decommissioned — 403 on every path. Replacement site `research.legislation.gov.uk` is invite-only HTTP Basic Auth beta — not publicly accessible without credentials. **Decision: proceed with per-section ingest (option 3).** V2.75-H runs as per-section ingest over ~4 days unattended via PM2.

### Next CC action

**V2.75-I complete. Full corpus ingest finishing — 241 remaining acts processing now.**

PM2 is running (`pm2 status` → online, PID active). When 241 acts finish, process logs "Corpus complete — all acts already in checkpoint. Exiting cleanly." and exits with code 0. PM2 **will NOT restart** (new `stop_exit_codes: [0]` config). Status becomes "stopped" — this is correct and expected.

Monitor: `pm2 logs scrutinise-ingest --lines 50`  
Check done: look for "Corpus complete" in log, then `pm2 status` should show stopped/0 restarts.

**Next sprint** (post-trip): compile.ts — build the amendment-aware compiler using `.original.xml`, `.tna.xml`, and `effects.xml` per section. The three-layer data is now in R2; the compiler can apply Effects feed data to produce deterministic compiled text for Jaccard scoring.

**Known limitation:** Acts where TNA returns HTTP 202 for full-act CLML (e.g. Companies Act 2006) produce 0-section LegislationItems — handled gracefully, future sprint.

**`commit-all.sh` ready** at project root (per Section 12 — execute then delete).

### Sprint phasing — strategic priorities post-trip

1.  **Phase 1 (now):** legislation.gov.uk corpus — primary, secondary, amendments. UKPGA, UKSI, ASP, ANAW, NIA, NISI, UKLA, historic acts.
2.  **Phase 2+3 (combined post-trip):** scraping workstreams — HMRC manuals, BAILII case law, FCA Handbook, PRA Rulebook, CMA decisions, other regulator codes. Finance/tax content prioritised first.
3.  **Phase 4:** Cabinet Office codes (Ministerial Code, Civil Service Code), professional codes, ACAS guidance.
4.  **Phase 5:** Hansard, bills-in-progress.

***

## CC GIT DISCIPLINE — STILL THE LAW

CC must not call git during a sprint. At the end of each sprint, CC produces `commit-all.sh` in the project root containing all `git add` + commit commands plus `git push origin Main`, executes it after Charlie's single approval prompt, then deletes the file. Per CLAUDE.md Section 12. Last 4 sprints have ended with mid-sprint commits despite this — every brief must explicitly remind CC.

***

## SESSION CONTEXT MANAGEMENT

If `/clear` is used during a session, CC will lose all working memory. To prevent CC reading stale boot files and reporting outdated state:

-   **handoff_summary.md must be the truth.** It is updated mid-sprint where state changes are significant (this is the one exception to Section 12's no-mid-sprint-commit rule for docs).
-   After `/clear`, CC re-reads boot files. If the handoff says "Sprint X in progress with state Y," CC should report that. If the handoff is stale, fix the handoff first.
-   A dedicated `CURRENT_SPRINT.md` file at repo root could replace this convention post-trip — see CLAUDE.md Section 0.

***

## HISTORICAL — SPRINT V2-L COMPLETE ✅ (24 April 2026, v36)

**Note:** the section below is preserved for reference. It describes the state at end of V2L. V2.75-A through V2.75-H1.5 have superseded the working state described below.

Eight commits to Main. `tsc --noEmit` clean. `prisma generate` done locally. `prisma db push --accept-data-loss` and env vars are MANUAL STEPS (see below).

### V2L commit summary

1.  **V2L-A1** — Schema: `LegislationSection`: removed `compiledText`, `tnaCompiledText`, `lexSummary`; added `rawXmlKey String?`, `compiledTextKey String?`, `lexSummaryKey String?`, `ftsVector String?`. `LegislationItem`: added `feedUrl String?`. `prisma generate` ✅ (locally). `prisma db push --accept-data-loss` is a MANUAL STEP (data loss acceptable — rebuilding into R2).
2.  **V2L-A2** — `scripts/legislation/r2-client.ts` (NEW): `r2Put`, `r2Get`, `r2Exists`, `xmlKey`, `compiledKey`, `summaryKey`. `scrutinise-web/lib/r2.ts` (NEW): same for Next.js API routes. `@aws-sdk/client-s3` installed ✅.
3.  **V2L-A3** — `scripts/legislation/ingest.ts`: R2-first writes — raw XML and TNA compiled text to R2; stores `rawXmlKey`, `compiledTextKey`, `compiledBy: 'tna-direct'` in DB. Full corpus feed flags: `--full` (ukpga all), `--si`, `--eu`. Atom feed pagination with 500ms delay. Checkpoint/resume (`ingest-checkpoint.json`, `--reset-checkpoint` flag). PAUSE file support. Progress logging `[done/total]`.
4.  **V2L-A4** — `scripts/legislation/compile.ts`: fetches raw XML from R2 via `rawXmlKey`. Writes compiled text + lexSummary to R2; stores `compiledTextKey`, `lexSummaryKey` in DB. Parallel batches of 5 (6s between batches). `--reset-failed` flag. Progress summary + PAUSE file.
5.  **V2L-A5** — `app/api/ideas/[id]/legislation-search/route.ts`: SQL selects `compiledTextKey`, `lexSummaryKey`, `compiledBy`; FTS uses `originalText` (in Railway). After query: parallel `r2Get()` for each result. Returns `compiledText`, `lexSummary`, `isTnaVerified` (compiledBy === 'tna-direct'). `components/LegislationPanel.tsx`: interface updated — removed `tnaCompiledText`, added `isTnaVerified`; labels updated.
6.  **V2L-B1** — `app/api/legislation/test-sections/route.ts` (NEW): GET, no auth. Fetches 20 COMPILED sections + amendments from DB; fetches compiledText + lexSummary from R2. `app/legislation-compare/LegislationCompareClient.tsx`: rebuilt — dynamic sections from API, gold standard from R2, verbatim amendment-compilation task, removed cleanTnaText() and live-fetch logic.
7.  **V2L-C1** — `scrutinise-docs/CLAUDE.md`: added STORAGE ARCHITECTURE section (Railway 5GB limit, R2 key scheme, on-demand flow).
8.  **V2L-D1** — `CHANGE_LOG.md` + `handoff_summary.md` bumped to v35.

### V2L architecture notes (still valid)

-   `compiledTextKey` holds the same R2 path regardless of TNA or AI source. `compiledBy === 'tna-direct'` distinguishes TNA from AI in Railway.
-   FTS query uses `originalText` (short, in Railway). `ftsVector` field reserved for future pre-computed tsvector from full compiled text.
-   `compile.ts` only processes `PENDING` sections — sections marked `COMPILED` by ingest (TNA path) are skipped.
-   `LegislationItemClient.tsx` (`/legislation/[itemId]`) will show no compiled text after migration — graceful degradation, not an error.

### V2L MANUAL STEPS (largely done, listed for reference)

1.  Add `CLOUDFLARE_R2_*` env vars to Railway and Vercel.
2.  `npx prisma db push --accept-data-loss` on Railway.
3.  Re-ingest existing Acts (replaced by V2.75-H plan).
4.  Run compile loop (replaced by V2.75-H plan).

***

*Below this point, the historical V2L handoff has been truncated. Full V2L detail remains in git history at the V2L-D1 commit.*
