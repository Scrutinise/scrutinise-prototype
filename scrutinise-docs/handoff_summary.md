# SCRUTINISE — HANDOFF SUMMARY

*Read this first every session. Top section is authoritative.*

*Last updated: 3 Jun 2026 (V6 complete — pending commit)*

---

## CURRENT STATE

**Active branch:** Main
**Last sprint:** V6 — EUR-Lex SPARQL fix + LDA Parliament integration (3 Jun 2026)
**Latest commits:** `3cd7713` (V5) — V6 changes written, commit-all.sh pending execution

### What just happened (3 Jun 2026 V6 — EUR-Lex SPARQL fix + LDA Parliament)

1. **EUR-Lex unblocked via CELLAR SPARQL** — `search.html?format=json` now returns HTML (SPA redesign). Fixed: use `publications.europa.eu/webapi/rdf/sparql` (no auth). Confirmed: 232,988 series-3 CELEX IDs enumerable; `fetchDocumentText` returns full text (GDPR: 350KB). EstSections updated 80k→232k.
   - **ACTION NEEDED (Charlie):** Reset existing EUR-Lex done rows: `UPDATE ingest_queue SET status='pending', "lastError"=NULL, claimed_by=NULL, claimed_at=NULL WHERE corpus='eur-lex' AND status='done';`

2. **FCA Handbook confirmed truly blocked** — Every URL (including /sitemap.xml) returns same JS SPA shell. Explicit "JavaScript disabled" message. No rule text in initial HTML. FCA Publications (fca.org.uk/publications) is a viable V7 corpus but requires scraper build.

3. **LDA Parliament integrated** — 5 datasets confirmed, 799K records across 1,602 queue pages:
   - Commons Oral Questions: 69,852 records (140 pages)
   - Lords Written Questions: 103,137 records (207 pages)
   - Commons Written Questions: 618,599 records (1,238 pages)
   - Commons Divisions: 5,553 records (12 pages)
   - Lords Divisions: 2,089 records (5 pages)
   - `lda-parliament.ts` source client built; `processLda()` added to worker-queue.ts; seeder written.
   - **ACTION NEEDED (Charlie):** Run `seed-lda-queue.ts` after deploy to seed 1,602 queue rows.
   - **ACTION NEEDED (Charlie):** Run `seed-rate-limits.ts` to register `lda-parliament` rate limit (200ms).

4. **CORPUS_MANIFEST updated** — EUR-Lex unblocked (blocked→not blocked), estSections 80k→232k. 5 new LDA entries added at correct priorities. FCA comment updated with V6 confirmation.

### What just happened (3 Jun 2026 V5 — Hansard alternative + blocked sources)

1. **TWFY client built** (`theyworkforyou.ts`): TheyWorkForYou API confirmed accessible from Railway (status 200, needs API key only). Source client + worker route + queue seeder all built. **ACTION NEEDED:** Register for TWFY API key at theyworkforyou.com/api/key, add `TWFY_API_KEY` to Railway env, then run `seed-twfy-queue.ts` (~4,700 monthly rows for Commons+Lords+Westminster Hall).

2. **FCA, ECHR, EUR-Lex blocked in manifest**: All APIs confirmed non-functional from Railway environment. Marked `blocked: true` — will show ⛔ blocked in email instead of ⚠️ failing.

3. **⚠️ failing state added to email**: Sources with queue rows but 0 corpus_sections now show `⚠️ failing` — visible signal that something is broken rather than appearing at 0%.

4. **Scheduler duplicate**: Not a code bug — two Railway deployments running simultaneously. Fix: manually redeploy `ingest-scheduler` in Railway dashboard to kill old instance.

5. **Data access request drafts**: `docs/data-access-requests/bailii-request.md` and `parliament-hansard-request.md` ready to send.

6. **corpus-census.md §8**: 19 sources with "client needed" added, with URLs for future build sprints.

### What just happened (3 Jun 2026 V4 — caselaw diagnosis + silent failure fixes)

1. **Caselaw `getTotalJudgments()` fixed** — TNA feed reports 7,489 pages but pages 1,500+ are empty. Binary-search now finds true last non-empty page (~1,499). We've ingested all ~74,950 available TNA caselaw judgments. `estSections` updated to 75,000.

2. **Silent failures now surfaced** — `processHansard`, `processFca`, `processEchr` now mark 'failed' (not 'done') when 0 items are yielded. Root causes confirmed:
   - FCA: `handbook.fca.org.uk` is a JS SPA — HTML scraping never works. Needs Playwright.
   - ECHR: `/app/query/results` returns 404 — API endpoint changed Jun 2026. Needs new endpoint.
   - Hansard: `api.parliament.uk/v1/hansard` returns 403 from Railway IPs. Written Answers/Statements use a different API that works fine.

3. **Reseed running:** UKPGA pre-1963 (6,897 rows) inserted; UKSI 2010-2026 completed; SSI/WSI enumeration rate-limited at 30s/request — still running.

4. **Queue state:** 5,307 primary-acts-pre-2000 pending rows, workers actively processing. Grand total corpus_sections: 587,128.

### What just happened (3 Jun 2026 Sprint 2 — queue gap seeding)

1. **Queue reset (Part 2):** 6,185 rows reset to pending for corpora with 0 corpus_sections (Hansard, FCA, ECHR, Treaties). Root cause: `api.parliament.uk/v1/hansard` returns 403 from Railway IPs — workers looped over 0 debates and marked rows done. FCA/ECHR similar pattern. Workers will retry on next claim cycle; Hansard API access needs Railway investigation.

2. **Queue reseed (Part 1):** `reseed-si-gaps.ts` run: (A) UKSI 2010–2026 enumeration from TNA (adds ~5k–8k new rows for 2015–2026 gap); (B) UKPGA pre-1963: 6,897 new rows inserted from Neon items with 0 sections; (C) SSI+WSI added to regional corpus. Workers now have 13,082+ pending rows — queue is no longer empty.

3. **Worker efficiency email (Part 3):** `queryWorkerThroughput` extended with sourceKey, efficiency %, and ⚡low/🔴critical flags. Each source has theoretical max adjusted by number of workers sharing the token bucket.

4. **Discovery fix (Part 4):** `TNA_CORPUS_META.regional` now includes ssi+wsi. `discoverTnaLegislation` detects under-seeded corpora dynamically (threshold 400 rows/yr) and triggers full historical scan when needed.

### What just happened (3 Jun 2026 late evening — corpus census sprint)

1. **Census scripts created** (`scripts/ingest/census/`): neon-counts.ts, railway-counts.ts, tna-counts.ts, source-counts.ts. Reusable — re-run quarterly.

2. **Census report written** (`docs/corpus-census.md`): Full findings with Neon vs. new pipeline comparison, gap analysis, source API counts.

3. **CORPUS_MANIFEST estSections updated** (`progress-reporter.ts`): Revised 8 estimates based on confirmed data. Most significant: SI-2010+ 300k→120k, Written Statements 50k→17,487. Total corpus estimate revised from ~7M to ~5.3M sections.

4. **Key action items (status):**
   - ~~SI-2010plus reseed~~ — Done V3 (TNA feed confirms counts were accurate, not a gap).
   - ~~Hansard/ECHR/FCA R2 backfill~~ — V2–V5: confirmed no R2 content. Workers marked done due to API failures (403/404). Hansard addressed via TWFY (V5). FCA/ECHR blocked.

### What just happened (3 Jun 2026 evening sprint)

1. **RangeError fix (Part 1):** `progressBar()` in `progress-reporter.ts` now clamps `pct` to `[0,100]` and `filled` to `[0,barWidth]`. Email sends were crashing every hour since compiled > estSections for some corpora.

2. **Worker throughput in email (Part 2):** Added `queryWorkerThroughput()` and a new "WORKER THROUGHPUT" section in `sendProgressEmail()`. Shows per-corpus sections/hr rate with mini bar, ⚠️ stalled / ℹ️ idle flags, total rate, stalled list. Uses 3-snapshot pivot to distinguish stalled vs idle.

3. **Diagnostics (Part 3):** Queue is exhausted (0 pending, 120 claimed, 61,829 done). Self-discovery is working — just trickle-rate new items now. Snapshot doubling bug (×2 SUM at 11:54 BST) is a one-time Railway restart overlap, not a systematic code bug.

4. **Sprint workflow (Part 4):** Created `docs/SPRINT.md` as the canonical home for CCh sprint briefs. Added sprint brief protocol to `CLAUDE.md` §12.

5. **Part 5 (read-only):** Confirmed Hansard/ECHR/FCA/Treaties have the R2 backfill gap. See CHANGE_LOG for exact counts and key patterns.

---

## IMMEDIATE ACTIONS REQUIRED (for Charlie)

### V6 (new)
1. **Run `commit-all.sh`** — commits and pushes all V6 changes. Railway will auto-redeploy.
2. **Reset EUR-Lex queue rows** after deploy: `UPDATE ingest_queue SET status='pending', "lastError"=NULL, claimed_by=NULL, claimed_at=NULL WHERE corpus='eur-lex' AND status='done';`
3. **Run `seed-lda-queue.ts`** after deploy — seeds 1,602 LDA Parliament queue rows: `NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-lda-queue.ts`
4. **Run `seed-rate-limits.ts`** — adds `lda-parliament` rate limit: same tsx command, `scripts/ingest/seed-rate-limits.ts`

### V5 (still pending)
5. **Redeploy `ingest-scheduler` on Railway** — kills duplicate deployment causing alternating email formats. Settings → Deployments → Redeploy.
6. **Register TWFY API key** at theyworkforyou.com/api/key (free for civic use). Add `TWFY_API_KEY` to Railway env vars for all workers + scheduler.
7. **Run `seed-twfy-queue.ts`** after key is added — seeds ~4,700 monthly Hansard rows for Commons (1988–), Lords (1988–), Westminster Hall (1999–).
8. **Review data access request drafts** in `docs/data-access-requests/` — BAILII and Parliament Hansard bulk data.

---

## ARCHITECTURE SNAPSHOT (3 Jun 2026 — post V6)

- **20 Railway workers** ingesting via `worker-queue.ts` — queue-claim model with `FOR UPDATE SKIP LOCKED`
- **Scheduler** (`scheduler.ts`) — hourly loop, sends progress email, saves snapshots. **Two instances currently running — redeploy needed.**
- **Self-discovery** working — detects under-seeded corpora and triggers full historical scan
- **Corpus coverage:** ~587,128 Railway sections + 914,274 Neon legacy = ~1.5M total
- **Hansard:** TWFY client built (needs API key). Parliament API (api.parliament.uk) returns 403 from Railway.
- **LDA Parliament:** 5 datasets integrated (~799K records, 1,602 queue pages). Seeder needs running after deploy.
- **EUR-Lex:** UNBLOCKED — SPARQL-based enumeration. ~232K documents available. Queue rows need reset to pending.
- **FCA Handbook:** Confirmed blocked (pure JS SPA). FCA Publications (fca.org.uk) viable for V7.
- **ECHR:** Still blocked (404 endpoint change, no alternative found).
- **TNA Caselaw:** Complete (~74,950 available judgments all ingested).
- **Active work:** pre-1963 UKPGA + SSI + WSI queue rows being processed.

## DEPLOYMENT

- Ingest workers: Railway (20 services)
- Scheduler: Railway (1 always-on service — currently 2 running, needs redeploy)
- DB: Railway PostgreSQL (`switchback.proxy.rlwy.net:16156`)
- R2: Cloudflare `scrutinise-legislation` bucket
- Web app: Vercel (scrutinise.org)
