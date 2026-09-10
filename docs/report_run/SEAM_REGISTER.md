# The seam register — numeric claims written into source, beside their live values

*Generated 2026-09-10 11:24 UTC by `b22-seam-sweep.ts`.*

CCW-B22 §4 asks us to go looking for the eighth seam rather than wait for it. Three of the
seven had one shape: **a number or a claim written into source, describing something that
then moved.** That shape is checkable without judgement.

⚠ **This register does not decide anything.** It puts the claim and the measurement side by
side. A tool that auto-classified "stale" would be making the judgement that has been wrong
seven times — a number can move for a good reason, and a number that holds can still be
attached to a sentence that has stopped being true.

## The named claims

**3 moved · 6 hold · 0 could not be checked.**

| | Claim, in the source's own words | Written | Now | |
|---|---|---|---|---|
| ⚠⚠ | "we hold 60,995 motions and, for each, the member who TABLED it" | 60,995 | 59,925 | **MOVED** |
| ⚠⚠ | "against the 2,125,547 signatories Parliament publishes" | 2,125,547 | 2,126,171 | **MOVED** |
| ✔ | "16,196 extracted positions are held and NOT exposed to search" | 16,196 | 16,196 |  |
| ✔ | "the quotation round-trips into its own source 98.4% of the time (15,937 found)" | 15,937 | 15,937 |  |
| ✔ | the appendix computes 98.4% as found/(found+notFound) — silently excluding rows where the check never ran | 0 | 0 |  |
| ✔ | "285 videos, 128.4 hours, 1,172,546 words" | 285 | 285 |  |
| ⚠⚠ | "6,138 searchable passages" | 6,138 | 6,157 | **MOVED** |
| ✔ | "16 ideas with a DONE build, 0 with a complete kernel in those columns" | 16 | 16 |  |
| ✔ | "nisr/2010/381 is a confirmed misattribution" — one instrument, several rows | 1 | 1 |  |

### ⚠⚠ `edm-sponsorships` — written 60,995, now 59,925

Source says: "we hold 60,995 motions and, for each, the member who TABLED it"

Why this query answers the same question: The sentence counts tabling signals. This counts them.

```sql
SELECT count(*)::int FROM position_signal_stored
           WHERE signal_type='edm_signature' AND derivation LIKE 'primary-sponsor%' AND superseded_by IS NULL
```

### ⚠⚠ `edm-signatures-published` — written 2,125,547, now 2,126,171

Source says: "against the 2,125,547 signatories Parliament publishes"

Why this query answers the same question: The sentence contrasts what Parliament publishes with what we held. We now hold them.

```sql
SELECT count(*)::int FROM edm_signatory
```

### ⚠⚠ `starkey-passages` — written 6,138, now 6,157

Source says: "6,138 searchable passages"

Why this query answers the same question: Quoted in the handoff. The appendix computes it live; the handoff does not.

```sql
SELECT count(*)::int FROM starkey.passage
```

---

## Everything the text sweep found, for triage

**675 lines** in `lib/` and `scripts/` state a quantity in a comment or a string
AND use a counting word. That is a candidate list, not a fault list: most will be accurate,
and several are deliberately historical (*"this was 60,995 when written"* is a fact about a
moment, not a claim about now).

⚠ **The question to ask of each: would the producer and this sentence still agree if the**
**producer changed today?** Where the answer is no, the sentence needs a query behind it or
a date in front of it.

| File | Claims | Densest lines |
|---|---|---|
| `scripts/ingest/seed-rate-limits.ts` | 24 | 40, 44, 45 |
| `scripts/ops/heavy-job/jobs.ts` | 18 | 59, 65, 68 |
| `scripts/ingest/c2/l2-purge.ts` | 10 | 9, 18, 19 |
| `scripts/ingest/census/a3-hollow-units.ts` | 9 | 9, 13, 16 |
| `scrutinise-web/scripts/b18-position-register.ts` | 8 | 10, 33, 34 |
| `scripts/ingest/caseref/extract.ts` | 8 | 19, 23, 25 |
| `scripts/ingest/graph/report-t2-provisions.ts` | 7 | 21, 22, 23 |
| `scripts/ingest/search/fts-refresh.ts` | 7 | 15, 186, 194 |
| `scrutinise-web/lib/lex/statutory-graph.ts` | 6 | 8, 144, 145 |
| `scrutinise-web/scripts/b22-seam-sweep.ts` | 6 | 43, 61, 76 |
| `scripts/graph/resolve-3d-companies-house.ts` | 6 | 24, 25, 27 |
| `scripts/ingest/c2/check-purge-scope-guard.ts` | 6 | 13, 14, 26 |
| `scripts/ingest/v33-resection-legislation.ts` | 6 | 5, 6, 10 |
| `scripts/ingest/v37-citation-gaps.ts` | 6 | 10, 75, 95 |
| `scripts/ingest/workers/process-row.ts` | 6 | 37, 244, 291 |
| `scripts/ingest/graph/audit-4a-layer2.ts` | 5 | 9, 32, 57 |
| `scripts/ingest/graph/extract-citation-edges.ts` | 5 | 9, 12, 34 |
| `scripts/ingest/graph/extract-cites-edges.ts` | 5 | 23, 34, 36 |
| `scripts/ingest/position-graph/derive-edm-signature-signals.ts` | 5 | 18, 19, 36 |
| `scripts/ingest/position-graph/sweep-edm-signatures.ts` | 5 | 7, 12, 323 |
| `scripts/ingest/position-graph/verify-edm-signatures.ts` | 5 | 81, 87, 143 |
| `scripts/ingest/seed-lda-queue.ts` | 5 | 5, 6, 7 |
| `scripts/ingest/sources/lda-parliament.ts` | 5 | 4, 5, 6 |
| `scrutinise-web/lib/lex/deepening-retrieval.ts` | 4 | 108, 137, 139 |
| `scrutinise-web/lib/lex/grain.ts` | 4 | 16, 33, 41 |
| `scrutinise-web/lib/lex/stats-catalogue.ts` | 4 | 32, 150, 151 |
| `scrutinise-web/scripts/b21-critique-standalone.ts` | 4 | 23, 48, 49 |
| `scrutinise-web/scripts/check-surface-5.ts` | 4 | 141, 142, 162 |
| `scripts/graph/ingest-3b-ec.ts` | 4 | 58, 68, 194 |
| `scripts/ingest/c2/l2-purge-index.ts` | 4 | 9, 26, 45 |
| `scripts/ingest/names/backfill-committee-attribution.ts` | 4 | 7, 15, 16 |
| `scripts/ingest/position-graph/sweep-committees.ts` | 4 | 9, 18, 236 |
| `scripts/ingest/shared/compile.ts` | 4 | 151, 157, 212 |
| `scrutinise-web/lib/lex/corpus-type-map.ts` | 3 | 69, 144, 225 |
| `scrutinise-web/lib/lex/statutory-consequences.ts` | 3 | 16, 58, 304 |
| `scrutinise-web/scripts/argument/verdicts.ts` | 3 | 44, 65, 66 |
| `scrutinise-web/scripts/audit-s18-keys.ts` | 3 | 32, 133, 357 |
| `scrutinise-web/scripts/b18-citator-report-judgments.ts` | 3 | 15, 45, 138 |
| `scrutinise-web/scripts/check-corpus-types.ts` | 3 | 280, 445, 470 |
| `scripts/graph/audit-3c-distribution.ts` | 3 | 30, 78, 82 |

<details><summary>Every line found</summary>

**`scripts/ingest/seed-rate-limits.ts`**

- L40 — `1000` — { sourceKey: 'twfy-pwdata',     intervalMs: 1000, maxConcurrentWorkers: 5,  note: 'theyworkforyou.com/pwdata — HALVED from 500ms/10 V19 (11 Jun 2026): V18 full-archive ru
- L44 — `1000` — { sourceKey: 'committees-api',      intervalMs: 1000, maxConcurrentWorkers: 3, note: 'committees-api.parliament.uk JSON API (V20) — 2 fetches/row (detail + document), 100
- L45 — `1000` — { sourceKey: 'tax-tribunals',       intervalMs: 1000, maxConcurrentWorkers: 2, note: 'financeandtax.decisions.tribunals.gov.uk (V20) — legacy HMCTS WebForms host; 2 fetch
- L47 — `5,900` — { sourceKey: 'judiciaryni',         intervalMs: 2000, maxConcurrentWorkers: 1, note: 'judiciaryni.uk Drupal (V20) — 2 fetches/row (page + PDF), ~5,900 decisions; official
- L49 — `5000` — { sourceKey: 'historic-hansard',    intervalMs: 5000, maxConcurrentWorkers: 2, note: 'hansard-archive.parliament.uk bulk volume zips (V21) — 1 fetch/row (~1-2MB zip) then
- L51 — `1000` — { sourceKey: 'niassembly-hansard',  intervalMs: 1000, maxConcurrentWorkers: 2, note: 'data.niassembly.gov.uk AIMS Open Data (V24) — Microsoft-IIS, no Cloudflare; 1 fetch/
- L55 — `1000` — { sourceKey: 'college-policing-archive', intervalMs: 1000, maxConcurrentWorkers: 2, note: 'webarchive.nationalarchives.gov.uk (V25 §3) — TNA infra, CF-free; 1 archived-ca
- L56 — `1000`, `5,131` — { sourceKey: 'scottish-parliament-or', intervalMs: 1000, maxConcurrentWorkers: 2, note: 'www.parliament.scot Official Report HTML (V28 §7) — supersedes the V25/V27 gated 
- L57 — `5,645`, `2,361`, `3,284` — { sourceKey: 'division-votes',      intervalMs: 400,  maxConcurrentWorkers: 3, note: 'commonsvotes-api / lordsvotes-api.parliament.uk (V28 §3, reworked V34 §A) — robust J
- L59 — `1000`, `13,066` — { sourceKey: 'scottish-courts',     intervalMs: 1000, maxConcurrentWorkers: 2, note: 'www.scotcourts.gov.uk (V27 §2) — enumeration via api.pa.web.scotcourts.gov.uk JSON (
- L60 — `26,576` — { sourceKey: 'ico',                 intervalMs: 500,  maxConcurrentWorkers: 2, note: 'ico.org.uk (V27 §4, exempt org) — flat-sitemap enumeration; per row 1 HTML page + 1–
- L62 — `2,038` — { sourceKey: 'erskine-may',         intervalMs: 400,  maxConcurrentWorkers: 3, note: 'erskinemay-api.parliament.uk (V29 §3.1) — robust JSON, 1 fetch/row → one section per
- L64 — `1,181` — { sourceKey: 'impact-assessments',  intervalMs: 700,  maxConcurrentWorkers: 2, note: 'legislation.gov.uk /ukia/ (V34 §B) — BULK route: per-year Atom feed, then 1 PDF fetc
- L65 — `7,447`, `1,059`, `6,302` — { sourceKey: 'consultations',       intervalMs: 500,  maxConcurrentWorkers: 3, note: 'gov.uk Search + Content API (V34 §C) — 1 content fetch/row → one section per consult
- L66 — `60,737` — { sourceKey: 'early-day-motions',   intervalMs: 400,  maxConcurrentWorkers: 3, note: 'oralquestionsandmotions-api.parliament.uk (V29 §3.2) — JSON list pages; 1 fetch/row 
- L68 — `3,341` — { sourceKey: 'members-interests',   intervalMs: 400,  maxConcurrentWorkers: 2, note: 'interests-api.parliament.uk (V29 §3.4) — JSON list pages; 1 fetch/row → one section 
- L69 — `1000` — { sourceKey: 'cps-guidance',        intervalMs: 1000, maxConcurrentWorkers: 2, note: 'cps.gov.uk (V29 §4, own domain) — Drupal sitemap enumeration; 1 HTML fetch/row → one
- L71 — `1000`, `12,899` — { sourceKey: 'ofgem',               intervalMs: 1000, maxConcurrentWorkers: 2, note: 'ofgem.gov.uk (V29 §6, exempt org) — Drupal sitemap; per row 1 HTML + up to 6 PDFs (P
- L72 — `1000`, `4,093` — { sourceKey: 'ofcom',               intervalMs: 1000, maxConcurrentWorkers: 2, note: 'ofcom.org.uk (V29 §6, exempt org) — topic-sitemap enumeration; per row 1 HTML + opti
- L73 — `1000` — { sourceKey: 'lgsco',               intervalMs: 1000, maxConcurrentWorkers: 2, note: 'lgo.org.uk (V29 §7, ombudsman) — self-propagating paged listing (list:{category}:{pa
- L74 — `1000` — { sourceKey: 'library-briefings',   intervalMs: 1000, maxConcurrentWorkers: 2, note: 'commons/lords/post research-briefings WP REST (V28 §5 / V29 §9) — CAPTURE-GATED (Clo
- L76 — `2,562` — { sourceKey: 'cma-cases',           intervalMs: 300,  maxConcurrentWorkers: 5, note: 'gov.uk cma_case finder + assets.publishing.service.gov.uk PDFs (V30 §1.1) — body ove
- L77 — `1000`, `19,605` — { sourceKey: 'inquiry-evidence',    intervalMs: 1000, maxConcurrentWorkers: 2, note: 'public-inquiry evidence sites (V30 §3) — §0-governed. Pilot: postofficehorizoninquir
- L81 — `21,970` — { sourceKey: 'fcdo-treaties', intervalMs: 750, maxConcurrentWorkers: 2, note: 'treaties.fcdo.gov.uk (V31 STEP 1) — legacy JBoss/Knowvation AWARE host, reverse-engineered 

**`scripts/ops/heavy-job/jobs.ts`**

- L59 — `17,700,396` — // MEASURED on the 4 Aug run at 17,700,396 rows: 19.8 GB peak RSS. This retires the
- L65 — `19,161` — // smaller table (19,161 rows removed by fts-hygiene), so its lower peak reflects less
- L68 — `17,978,744` — // (17,978,744 rows, 533s, €0.053). Deliberately NOT lowering the number — the same rule
- L75 — `18,272,377` — // FIFTH measurement, 21 Aug 2026 (SEARCH S11 re-tier + case-law tail): 546s on 18,272,377 rows
- L81 — `118,789`, `1,191,345` — // ⚠ The 44s "before" is worth keeping: 118,789 unindexed rows — a TENTH of the 1,191,345 that
- L87 — `17,700,396` — '4 Aug 2026, cpx62 (32 GB), 17,700,396 rows, 499s → 19.8 GB peak. ' +
- L88 — `17,681,503` — 'Confirmed 5 Aug 2026, cpx62, 17,681,503 rows (post index-hygiene), 509s → 19.4 GB peak, €0.049.',
- L108 — `21,839,900` — // MEASURED on the 7 Aug run: 1.72 GB peak at 21,839,900 rows, 39.1s, €0.010.
- L116 — `22,670,808` — '27 Aug 2026 (S15), cpx62 (32 GB), 22,670,808 rows, 45.1s → 1.82 GB peak, €0.008. ' +
- L117 — `1,478,964` — 'That run was a REFRESH: 1,478,964 rows (6.5%) had fallen outside the index since 7 Aug and ' +
- L120 — `21,839,900` — 'Earlier: 7 Aug 2026, cpx62 (32 GB), 21,839,900 rows, 39.1s → 1.72 GB peak, €0.010. ' +
- L153 — `40000`, `12000` — // branches on --index-only, so the env default of 40000 against the 21 Jul checkpoint's 12000
- L180 — `22,518,608` — // MEASURED 11 Aug 2026, first successful run: **5.6 GB peak** at 22,518,608 rows, 29.5 min,
- L192 — `22,518,608` — '11 Aug 2026, cpx62 (32 GB shared), 22,518,608 rows, 29.5 min → 5.6 GB peak, €0.145, unindexed 0. ' +
- L196 — `22,613,652`, `95,044` — '12 Aug 2026 (V35), cpx62, 22,613,652 rows (+95,044 from the V35 catch-up), ANN build 1,130s, ' +
- L199 — `539,454`, `22,670,808` — // with 539,454): 22,670,808 rows, ANN build 1,825s, 31.9 min wall, €0.156 → 5.9 GB peak,
- L203 — `22,670,808` — '23 Aug 2026 (S12), cpx62, 22,670,808 rows, ANN build 1,825s, 31.9 min, €0.156 → 5.9 GB peak, unindexed 0. ' +
- L258 — `22,518,608` — // MEASURED on the box, 11 Aug 2026: 7.1 GB peak at 22,518,608 rows, 37.6 min, €0.099 on a cpx42

**`scripts/ingest/c2/l2-purge.ts`**

- L9 — `28,629` — * target row set a boolean on `corpus_targets`; it deleted nothing. 28,629 sections have been
- L18 — `131,650` — *   A. et-decisions landing pages — 131,650 rows, format='html', median 18 words. They are a
- L19 — `131,147` — *      GOV.UK landing page, not a decision. 131,147 of them have the real judgment PDF ingested
- L22 — `161,749` — *      only thing this deletion destroys a pointer to. Every one of the 161,749 PDF rows carries
- L24 — `28,629` — *   B. the three retired collections — 28,629 rows, R9 above.
- L29 — `1,972`, `2,089`, `2,087`, `2,089` — *      1,972), `lda-lordsdivisions` (2,089, proved duplicate at 2,087 of 2,089 by C2 L2 item 8),
- L77 — `131,147` — 'The real judgment PDF is held alongside for 131,147 of them.',
- L114 — `2,087`, `2,089` — why: 'proved duplicate at 2,087 of 2,089 against lords-divisions-votes (C2 Lane 2 item 8)',
- L121 — `5,000` — why: 'truncated at the LDA API 5,000-answer page cap — each row is a page of answers, not an ' +
- L142 — `161,753` — * `et-decisions` target — hiding the 161,753 judgment PDFs the purge had deliberately KEPT.

**`scripts/ingest/census/a3-hollow-units.ts`**

- L9 — `20,000` — * A3 specifies "flag every collection where `< 15` words exceeds 5% of rows or `> 20,000` exceeds
- L13 — `367,570` — *   ✓ written-answers        143 rows, median 367,570 words, 95.8% over 20k   — caught
- L16 — `3,150`, `293,399` — *                            floor. Only 3,150 of 293,399 rows fall under it — the test misses
- L18 — `1,483` — *   ✗ building-regs          21 rows, median 318 words, min 237, max 1,483. Nothing under 15,
- L117 — `306,000` — L.push(`\| \`written-answers\` \| 143 rows, ~306,000 words each \| **CAUGHT** — 143 rows, median ${n(dist.find(d => d.corpus === 'written-answers')?.median ?? 0)}, 95.8% 
- L119 — `131,654` — L.push(`\| \`et-decisions\` \| 131,654 landing pages, median 18 words \| **MISSED** — the landing pages sit at 18 words, ABOVE the 15-word floor. Only ${n(dist.find(d => 
- L120 — `1,483`, `20,000` — L.push(`\| \`building-regs\` \| 21 rows, ~446 words each \| **MISSED** — median ${n(dist.find(d => d.corpus === 'building-regs')?.median ?? 0)}, min 237, max 1,483. Nothi
- L161 — `1,982` — L.push('\| `building-regs` \| **HOLLOW, 100%** \| *"Statutory guidance / Structure: Approved Document A / Building regulation in England covering the structural elements 
- L163 — `61,192` — L.push('\| `quangos-govuk` \| **HOLLOW** (of the 61,192 landing rows) \| 359 chars: *"This annual report sets out the activities and achievements of the ECITB…"* — the ab

**`scrutinise-web/scripts/b18-position-register.ts`**

- L10 — `16,196` — // 16,196 extracted positions are held and NOT exposed to search, because read by hand
- L33 — `60,995` — // It read: *"`edm_signature` IS NOT A SIGNATURE. We hold 60,995 motions and, for each, the
- L34 — `2,125,547` — // member who TABLED it — 1.00 per motion against the 2,125,547 signatories Parliament
- L37 — `2,065,026`, `60,995` — // **2,065,026** `edm_signature` rows against the 60,995 it had.
- L42 — `62,400` — //     derivation `primary-sponsor:*`   62,400   — the member who TABLED the motion
- L345 — `60,995` — + 'that *"we hold 60,995 motions and, for each, only the member who tabled it … an EDM target '
- L351 — `60,995` — head.push(`\| \`edm_signature\` signals in \`position_signal_stored\` \| 60,995 \| **${storedEdm.toLocaleString()}** \|`)
- L352 — `60,995` — head.push(`\| …of which the member who **tabled** the motion \| 60,995 \| ${storedSponsor.toLocaleString()} \|`)

**`scripts/ingest/caseref/extract.ts`**

- L19 — `168,569` — * raises nothing — the trap that nearly made a 168,569-row purge report success on 24 Aug. A batch
- L23 — `36,000` — * ⚠⚠ WRITES THE AGGREGATE IN SHARDS, AND THE FIRST VERSION DID NOT — IT LOST A 36,000-DOCUMENT RUN.
- L25 — `36,000`, `74,896`, `97,940` — * The first run of this file read 36,000 of 74,896 judgments, found 97,940 distinct citations, and
- L26 — `1785264` — * then died: `memory allocation of 1785264 bytes failed`. Every citation was in a Map in memory and
- L62 — `2,000`, `2,000` — *     batch 2,000 → 2,000 rows in 62.0s = 32 docs/s
- L63 — `5,000`, `2015184` — *     batch 5,000 → OOM ("memory allocation of 2015184 bytes failed")
- L65 — `2,000`, `1,200`, `36,000` — * ⚠ Lowered from 2,000 to 1,200 after the first full run died at 36,000 documents. The batch was
- L149 — `400000` — `SELECT count(*)::int n FROM (SELECT 1 FROM corpus_sections WHERE corpus=$1 AND status='compiled' LIMIT 400000) t`, [corpus])).rows[0].n

**`scripts/ingest/graph/report-t2-provisions.ts`**

- L21 — `1,235` — * report is a misquotation, not a short quotation. All 1,235 source documents
- L22 — `1,235` — * of the four measures are in the local bulk CLML file (measured: 1,235 of
- L23 — `1,235` — * 1,235), so the sentence is rebuilt from the document and the fragment is used
- L115 — `2,894` — *  holds two copies of 2,894 gids and this is never left to iteration order. */
- L324 — `1000` — console.log(`  quoted ${quotable} of ${quoted.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
- L345 — `2,894` — 'The bulk CLML file holds two copies of 2,894 gids — an as-made (or as-enacted) copy and a revised copy. ' +
- L351 — `2,894` — '2,894 gids it extracted from BOTH copies and wrote the rows under one source_gid with no column saying which. ' +

**`scripts/ingest/search/fts-refresh.ts`**

- L15 — `74,896`, `74,066` — * 2026 and the index carried **0 of 74,896** of them; the dates were wrong on 74,066. **No user
- L186 — `43,893` — // which does not cover this directory. The code was correct and ran — 43,893 rows re-tiered.
- L194 — `3,697` — // `delete WHERE id IN (…500 ids…)`, add 500. Measured live, it managed 3,697 rows in 15 minutes
- L195 — `43,893` — // — 43,893 rows would have taken about three hours. The cause is not the write: **`corpus_fts`
- L208 — `21,525`, `74,896` — //   2. The largest collection in this set is 21,525 rows; case law was 74,896.
- L236 — `21,525` — // Added in chunks: one `add` of 21,525 rows with full bodies is a single very large
- L240 — `1000` — console.log(`[fts-refresh] ${corpus}: rewrote ${records.length.toLocaleString()} rows (${changed.toLocaleString()} changed) in ${((Date.now() - t1) / 1000).toFixed(0)}s`)

**`scrutinise-web/lib/lex/statutory-graph.ts`**

- L8 — `1,034,548` — // same Neon database this app already uses (1,034,548 rows, confirmed through Prisma from
- L144 — `793,616`, `1,034,548` — * **SIs are the largest source type in the table.** Measured: 793,616 of 1,034,548 rows,
- L145 — `1,347`, `1,868` — * and 1,347 of the Equality Act's 1,868 references come FROM statutory instruments. A
- L317 — `1,034,548` — * The coverage block is six aggregate queries over a 1,034,548-row table with unindexed
- L544 — `1,034,548` — * column: **a parallel sequential scan over 1,034,548 rows at 474ms, against 3.7ms on the
- L549 — `3,531` — * 3,531 rows (0.34%) hold ids that are not lower-case — they are the **pre-1963 regnal-year

**`scrutinise-web/scripts/b22-seam-sweep.ts`**

- L43 — `60,995`, `60,995` — * "60,995" in a sentence about motions and "60,995" in a sentence about sponsorships are
- L61 — `60,995` — says: '"we hold 60,995 motions and, for each, the member who TABLED it"',
- L76 — `16,196` — says: '"16,196 extracted positions are held and NOT exposed to search"',
- L79 — `16,196`, `37,657`, `21,461` — // "16,196 → 37,657, MOVED". That was my error and not a seam: 21,461 of those rows record
- L107 — `1,172,546` — says: '"285 videos, 128.4 hours, 1,172,546 words"',
- L114 — `6,138` — says: '"6,138 searchable passages"',

**`scripts/graph/resolve-3d-companies-house.ts`**

- L24 — `14,879` — * The brief predicts *"roughly eleven times the current yield"*, from 14,879 unresolved rows
- L25 — `1,489` — * against 1,489 resolved ones. That ratio is right about ROWS and wrong about SIGNALS, because a
- L27 — `14,879` — * of those 14,879 rows have no resolvable donee at all.
- L31 — `14,879` — *     rows with a CH number we do not hold                        14,879
- L33 — `1,659` — *     distinct (donee, number, date) triples in those rows         1,659   ← the signal ceiling
- L37 — `1,903` — * **So the prediction is 244 → at most 1,903 signals, about 7.8×, not 11×** — and that is a

**`scripts/ingest/c2/check-purge-scope-guard.ts`**

- L13 — `161,749` — * `corpus='et-decisions' AND format='html'`; the collection also holds 161,749 judgment PDFs the
- L14 — `161,753` — * purge deliberately KEPT. So a partial purge retired and blocked a live collection of 161,753 rows.
- L26 — `131,650`, `293,403` — * they are the pre-purge counts, 131,650 of 293,403, taken from the target's own `expect` and from
- L27 — `161,753` — * the 161,753 rows that survived.
- L56 — `131,650`, `293,403`, `161,753` — why: '131,650 html landing pages inside a collection of 293,403 — the 161,753 judgment PDFs survive',
- L75 — `161,753` — //      `et-decisions` is the collection the bug hit, and it still holds 161,753 rows.

**`scripts/ingest/v33-resection-legislation.ts`**

- L5 — `4,250,493` — *   before   eur-lex:32007B0143:1                    1 row, 4,250,493 chars, 0.5% embedded
- L6 — `0001`, `6,000` — *   after    eur-lex:32007B0143:1-0001 … -NNNN       N rows, ≤6,000 chars each, 100% embedded
- L10 — `7,764` — * `LEGISLATION_TRUNCATION_AND_FLAG.md` §1.2 names, 7,764 truncated rows carrying 108.4M of the
- L20 — `0001` — *     would print "s.section-21-0001" and the link would point at a provision that does not
- L111 — `8,850` — *  `LIKE ANY(<8,850 patterns>)` over a 17.9M-row table is a sequential scan per pattern. */
- L147 — `90,260` — * ⚠ `eur-lex` rows carry NO sectionTitle at all today (0 of 90,260), which is why

**`scripts/ingest/v37-citation-gaps.ts`**

- L10 — `17,261` — * and a perfect score against a list missing 17,261 entries is indistinguishable from
- L75 — `1,446` — * `mwa` instruments and 1,446 sections, so that entry would have mislabelled real
- L95 — `1,108` — ukcm:  { why: 'Church Measures — primary legislation passed by General Synod with the force of an Act. Verified present at source (HTTP 200), and ukcm/1969/2 alone carrie
- L133 — `1000` — console.log(`[v37] corpus holds text for ${held.size.toLocaleString()} instruments (${((Date.now() - t0) / 1000).toFixed(1)}s)` +
- L233 — `17,261` — L.push('score against a list missing 17,261 entries is indistinguishable from a perfect score against')
- L294 — `4,000` — L.push('Ranked by total references, so the queue prioritises itself: an instrument referred to 4,000')

**`scripts/ingest/workers/process-row.ts`**

- L37 — `108,349` — // satisfied) read as empty and parked 108,349 legitimate rows. Counting the
- L244 — `41,913` — // processor was not, and it is the one now running a 41,913-row recovery that a
- L291 — `2,093` — // above overwrites it — without this an instrument ends up holding 2,093 real
- L800 — `1,685` — // (1,685 docs incl. the tax-treaties DTA collection) — same documents, working host.
- L1256 — `14,786`, `21,970` — // carry no PDF at all (measured 8 Jul 2026: 14,786 of 21,970) — those get a
- L2635 — `760,509` — // One row per IA is the V33 trap (eur-lex:32007B0143:1 — 760,509 words in a

**`scripts/ingest/graph/audit-4a-layer2.ts`**

- L9 — `132,990` — * over all 132,990 documents in the bulk file, SIs included, and the answer
- L32 — `1,144`, `1,034,548` — /** Bytes per row, MEASURED: citation_edge is 1,144 MB over 1,034,548 rows. */
- L57 — `132,990` — console.log(`    ${(100 * Number(siRow.rows) / si.reduce((n: number, r: { rows: string }) => n + Number(r.rows), 0)).toFixed(0)}% of citation_edge. 25-H ran over all 132,
- L83 — `1,144`, `1,034,548` — console.log(`  measured: citation_edge is 1,144 MB over 1,034,548 rows = ${BYTES_PER_ROW.toFixed(0)} bytes/row incl. indexes`)
- L92 — `132,990` — console.log(`  build time: 25-H's two detectors over all 132,990 documents ran in a single pass;`)

**`scripts/ingest/graph/extract-citation-edges.ts`**

- L9 — `4,426`, `61,996`, `286,659` — *    all 4,426 Acts and 61,996 SIs in the file: of 286,659 body citation
- L12 — `10,853` — *    do carry it, and it supplies the target provision on 10,853 rows — but
- L34 — `2,431`, `1,650` — *    names and so never opened 2,431 documents, including 1,650 ukpga (37% of
- L274 — `1,209` — *    1,209-document sample.
- L593 — `1000` — console.log(`  ${processed}/${entries.length} docs, rows=${stats.rows}, written=${stats.written}, heap=${Math.round(mu.heapUsed / 1e6)}MB, ${((Date.now() - t0) / 1000).to

**`scripts/ingest/graph/extract-cites-edges.ts`**

- L23 — `4,000,000` — * REFUSES to start unless --max-rows (projection gate, default 4,000,000) is
- L34 — `2,431`, `132,990`, `1,650` — * extractor silently never opened **2,431 of 132,990 documents: 1,650 ukpga
- L36 — `121,279` — * read: `audit-4a-blast-radius.ts` counts the entries; and of the 121,279 `cites`
- L140 — `2,431` — *  skipped 2,431 documents including 37% of every Act in the file. */
- L204 — `1000` — console.log(`  ${processed}/${entries.length} docs (at ${entries[i].m[0]}), edges=${stats.edges}, written=${stats.written}, heap=${Math.round(mu.heapUsed / 1e6)}MB rss=${

**`scripts/ingest/position-graph/derive-edm-signature-signals.ts`**

- L18 — `60,995` — *     primary-sponsor:v1 / :v2   the member who TABLED the motion      60,995 rows
- L19 — `2,050,000` — *     signatory:v1               a member who SIGNED it            ~2,050,000 rows
- L36 — `60,995` — * `--fix-sponsor-dates` applies the same correction to the 60,995 sponsorship rows already stored,
- L180 — `1000` — console.log(`\n   ${APPLY ? `INSERT reported ${n(wrote)} rows` : `${n(seen)} rows would be written`} in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`)
- L184 — `60,995` — // THE 60,995 SPONSORSHIP ROWS THAT CARRY THE WRONG DATE

**`scripts/ingest/position-graph/sweep-edm-signatures.ts`**

- L7 — `5,739`, `5,739` — * date on every row (§1's audit: 5,739 of 5,739 on both counts).
- L12 — `60,995` — * A 60,995-request sweep will be interrupted. A resume that re-reads a motion it already has is
- L323 — `60,995`, `2,125,547` — // ── THE WORK LIST. The 60,995 motions in `edm_sponsor`, i.e. exactly the set the 2,125,547
- L417 — `3600` — console.log(`   ${n(tally.motions)}/${n(todo.length)} motions   ${n(tally.sponsorRows)} sponsor rows   ${rps.toFixed(2)}/s   gap ${rate.gapMs}ms   429s ${rate.hits}   eta
- L426 — `1000`, `1000` — console.log(`   elapsed                        ${(elapsed / 1000 / 60).toFixed(1)} min  (${(tally.motions / (elapsed / 1000)).toFixed(1)} motions/s)`)

**`scripts/ingest/position-graph/verify-edm-signatures.ts`**

- L81 — `2,100` — // held on 150 of 150 motions in the audit. At ~2,100 motions it failed on 5, and all five looked
- L87 — `66381` — // so it has gained names since the snapshot: motion 66381 was 1 in August and is 10 now. **The
- L143 — `20,500` — // audit and the pilot. At ~20,500 motions it failed on **10**, and every one is the same shape:
- L144 — `62502` — // **ZERO rows with `sponsoring_order = 1`.** Motion 62502's orders run 2,3,4,5,6 and the member
- L242 — `59,925` — counted: 'graph_signed_motion_edge rows (was 59,925 before this sprint)',

**`scripts/ingest/seed-lda-queue.ts`**

- L5 — `69,852` — *   commonsoralquestions   — 69,852 records  → 140 pages
- L6 — `103,137` — *   lordswrittenquestions  — 103,137 records → 207 pages
- L7 — `618,599`, `1,238` — *   commonswrittenquestions — 618,599 records → 1,238 pages
- L8 — `5,553` — *   commonsdivisions       — 5,553 records   → 12 pages
- L9 — `2,089` — *   lordsdivisions         — 2,089 records   → 5 pages

**`scripts/ingest/sources/lda-parliament.ts`**

- L4 — `69,852` — //   commonsoralquestions  — 69,852 records
- L5 — `103,137` — //   lordswrittenquestions — 103,137 records
- L6 — `618,599` — //   commonswrittenquestions — 618,599 records
- L7 — `5,553` — //   commonsdivisions      — 5,553 records
- L8 — `2,089` — //   lordsdivisions        — 2,089 records

**`scrutinise-web/lib/lex/deepening-retrieval.ts`**

- L108 — `1,169` — * — i.e. 71 of 1,169 assessments, 6.1%, are reviews. (CC-Ingest's independent sweep of the source
- L137 — `18,759` — *   · **0 of 18,759** `impact-assessments` ids contain a `/` at all, so not one of them could ever
- L139 — `1,049`, `17,770` — *   · The correct join reaches **1,049 instruments** and **17,770 sections**.
- L321 — `129,681`, `23,920`, `9,367`, `7,927` — *   N. Ireland nisr 129,681 · nisi 23,920 · nia 9,367 · ni-judgments 7,927

**`scrutinise-web/lib/lex/grain.ts`**

- L16 — `3,200` — // row per section; `corpus_vec` is one row per ~3,200-character chunk, collapsed back to sections
- L33 — `17,770`, `1,049` — //     about (`uksi/2020/971`) — 17,770 rows over 1,049 instruments, so two different assessments of
- L41 — `344,773`, `51,000` — //     `publication` and ALL 344,773 sections of ALL 51,000 reports collapse into one document.
- L206 — `12,705,570`, `13,724,557` — * ARGUMENT 1A measured 12,705,570 of 13,724,557 parliamentary sections (92.6%) as a single chunk,

**`scrutinise-web/lib/lex/stats-catalogue.ts`**

- L32 — `5,733` — // The catalogue is 5,733 rows of short text — about 700 KB of headings, measured, not
- L150 — `2,329`, `5,733` — * Measured position, 19 Aug 2026: 2,329 of 5,733 series (40.6%) carry
- L151 — `40,351`, `80,443` — * `commercialUseExcluded = true`, all of them IMF, covering 40,351 of 80,443
- L256 — `2,807`, `5,733` — *    is a finding rather than a design choice: **2,807 of 5,733 series (49%) are labelled

**`scrutinise-web/scripts/b21-critique-standalone.ts`**

- L23 — `3,829`, `3,549`, `3,332` — // build: 8 of 9, 8 of 9 and 6 of 9, on prompts of 3,829 / 3,549 / 3,332 tokens. This runs
- L48 — `3829` — 'M-01': { version: 4, kernelTokens: 3829, score: '8 of 9', logic: 'holds, 0 defects' },
- L49 — `3549` — 'M-02': { version: 2, kernelTokens: 3549, score: '8 of 9', logic: 'holds, 0 defects' },
- L50 — `3332` — 'M-06': { version: 2, kernelTokens: 3332, score: '6 of 9', logic: 'does NOT hold, 4 defects' },

**`scrutinise-web/scripts/check-surface-5.ts`**

- L141 — `2279` — row('enabling', null, 'uksi/2010/2279', 'in exercise of the powers conferred by section 216 of the Equality Act'),
- L142 — `2279` — row('enabling', null, 'uksi/2010/2279', 'in exercise of the powers conferred by section 207 of the Equality Act'),
- L162 — `2279` — const e = groupEnabling([row('enabling', null, 'uksi/2010/2279',
- L244 — `2284` — const clipped = groupEnabling([row('enabling', null, 'uksi/2005/2284',

**`scripts/graph/ingest-3b-ec.ts`**

- L58 — `200000` — + '?start=0&rows=200000&query=&sort=AcceptedDate&order=desc'
- L68 — `1,174` — * ⚠ 'Members Association' is deliberately absent even though 1,174 rows carry it: an association is
- L194 — `79,391`, `89,861` — // a member-level signal. 79,391 of 89,861 rows are this.
- L236 — `89,861` — console.log('  ── DONEE RESOLUTION, as a share of ALL 89,861 published records')

**`scripts/ingest/c2/l2-purge-index.ts`**

- L9 — `28,629` — * deleted nothing, and 28,629 rows went on answering queries for months. Deleting the database rows
- L26 — `161,753` — * collection is being removed. Only `et-decisions` needs an id list, because 161,753 PDF rows in
- L45 — `168,569` — * ⚠ THIS MOVES BM25 DOCUMENT FREQUENCIES ACROSS THE WHOLE TABLE. 168,569 of 18.27M rows is 0.92%.
- L146 — `1000` — console.log(`   et-decisions landing pages present here: ${n(partialCount)} rows   (${((Date.now() - tp0) / 1000).toFixed(1)}s over ${idBatches.length} predicates)`)

**`scripts/ingest/names/backfill-committee-attribution.ts`**

- L7 — `303,354`, `344,773` — * `committees-reports` already holds the author. 303,354 of its 344,773 rows carry a JSON blob in
- L15 — `276,783` — *     Report              276,783 rows — the committee's own text.        ATTRIBUTED.
- L16 — `18,269` — *     Special Report       18,269 rows — the committee's own text.        ATTRIBUTED.
- L17 — `8,302` — *     Government Response   8,302 rows — THE GOVERNMENT'S text, published

**`scripts/ingest/position-graph/sweep-committees.ts`**

- L9 — `142,315` — *     populated on 142,315 rows and `sectionTitle` is "{inquiry title} — {internalReference}".
- L18 — `6,574` — * 6,574 bill rows. Nothing is extracted from prose and nothing is inferred.
- L236 — `3,031` — //     Measured at source, 11 Aug 2026, over 3,031 organisation entries in four quarterly windows:
- L237 — `2,161` — //     58 of 2,161 distinct normal forms (2.68%) carry more than one cisId — "national grid" ×2,

**`scripts/ingest/shared/compile.ts`**

- L151 — `194,537` — * therefore scored retained-eu at **27 placeholders in 194,537 rows — 0.01%** and printed
- L157 — `199,197` — * 35.4% ±4.19 of the 199,197 rows the census could see and did not flag. The census's
- L212 — `249,256` — * ⚠ NOTHING IN THE DATABASE DISTINGUISHES THEM TODAY. `section_repeals` holds 249,256 rows and
- L214 — `35,895` — * partial case and no row for it. C2 Lane 2 surfaced "~35,895 partially-repealed sections" as an

**`scrutinise-web/lib/lex/corpus-type-map.ts`**

- L69 — `3,448` — // own sake." The rows are named individuals against declared financial interests — 3,448 of
- L144 — `3,448`, `1,873` — // (3,448 and 1,873 rows), never `parliamentary`, so this branch was never reached for either —
- L225 — `1,044,188` — * of the 1,044,188 `scottish-parliament-or` rows already carry a `sectionTitle` beginning

**`scrutinise-web/lib/lex/statutory-consequences.ts`**

- L16 — `1,868` — // ⚠ GROUP BEFORE CLASSIFY, AND GROUP DETERMINISTICALLY. 1,868 rows classified one at a time
- L58 — `334,740`, `1,034,548` — * Measured across the whole table: **334,740 of 1,034,548 rows (32.4%)** contain XML
- L304 — `1,868` — * ⚠ THE MODEL NEVER SEES THE 1,868 ROWS. It sees a handful of group descriptions with one

**`scrutinise-web/scripts/argument/verdicts.ts`**

- L44 — `2276` — { chunkId: 'historic-hansard:S5LV0515P0:2276#0', tag: 'ENFORCEMENT', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, polarity: 'neutral', note: 'Solicitor
- L65 — `5514` — { chunkId: 'historic-hansard:S5LV0498P0:5514#0', tag: 'WRONG_VEHICLE', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"Skeletal le
- L66 — `1527` — { chunkId: 'historic-hansard:S5LV0588P0:1527#0', tag: 'WRONG_VEHICLE', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Contrasts 54 c

**`scrutinise-web/scripts/audit-s18-keys.ts`**

- L32 — `18,759`, `1,049` — *    An impact assessment is held as ~18 sections (18,759 rows over 1,049 documents). A hit on a
- L133 — `3,500,000` — /** A monetary figure in the shapes these documents use: £3.5m, £3,500,000, 3.5 million, -£0.4bn. */
- L357 — `4316` — const COVER = `1 \nTitle: Impact Assessment on the proposal to ban the supply of plastic drinking straws to the end user in England \nIA No: \nRPC Reference No: RPC-4316(

**`scrutinise-web/scripts/b18-citator-report-judgments.ts`**

- L15 — `16,455`, `18,211` — // ⚠⚠ "NO TREATMENT RECORDED" IS NOT "THIS CASE HAS NEVER BEEN DOUBTED." 16,455 of 18,211
- L45 — `2,244` — * Housing Group Ltd"* — and **0 of 2,244 citation values in the database contain a neutral
- L138 — `16,455`, `18,211` — + 'Across the corpus, 16,455 of 18,211 candidate passages (90.4%) produce no treatment record, '

**`scrutinise-web/scripts/check-corpus-types.ts`**

- L280 — `1,043,264`, `1,044,188` — // 1,043,264 of 1,044,188 rows carry a sectionTitle beginning "Scottish Parliament: …", so the
- L445 — `1,024` — ok('…and never renders the bare internal heading, which 1,024 rows carry as the single word "Summary"',
- L470 — `5,553` — // whose name would be caught by any `*divisions*` prefix rule — 5,553 rows, mean 16 words, no

**`scripts/graph/audit-3c-distribution.ts`**

- L30 — `2,304,858` — // remove any — so the estimate count should be within a few rows of 3B's 2,304,858. Not exactly
- L78 — `2,304,858` — ['estimate rows', '2,304,858', Number(d.n).toLocaleString(), PREDICTIONS.estimates],
- L82 — `2,140,510` — ['rows at \|stance\| = 1.00', `2,140,510 (92.87%)`, `${Number(d.at1).toLocaleString()} (${pc(Number(d.at1))})`, PREDICTIONS.at_abs_one],

**`scripts/graph/pilot-3b-ec.ts`**

- L7 — `40,000` — * rows is a different sprint from one that holds 40,000.
- L15 — `85,000` — *   P1  total donation rows in the register            ~85,000
- L47 — `200000` — + '?start=0&rows=200000&query=&sort=AcceptedDate&order=desc'

**`scripts/graph/probe-3a-cost.ts`**

- L82 — `1024` — console.log(`\n  ${Number(a.n).toLocaleString()} rows, ${(Number(a.b) / 1024 ** 2).toFixed(1)} MiB with the PK only`)
- L91 — `1024` — console.log(`  with both §2 indexes: ${(Number(b.b) / 1024 ** 2).toFixed(1)} MiB → ${perRow.toFixed(1)} bytes/row`)
- L112 — `1024` — console.log(`\n  at ${perRow.toFixed(1)} bytes/row  =  ${((all * perRow) / 1024 ** 3).toFixed(2)} GiB`)

**`scripts/graph/probe-3b-fn.ts`**

- L87 — `2,080,585`, `2,317,523` — console.log('   3A measured, and the report records: 2,080,585 vote signals, 2,317,523 total,')
- L103 — `2080585`, `2,080,585` — console.log(`   ${total === 2080585 ? '✓' : '❌'} total vote signals ${total.toLocaleString()} (3A recorded 2,080,585)`)
- L105 — `2317523`, `2,317,523` — console.log(`   ${tot.n === '2317523' ? '✓' : '❌'} total signals      ${Number(tot.n).toLocaleString()} (3A recorded 2,317,523)`)

**`scripts/graph/rebuild-3c2-validation.ts`**

- L232 — `20,246` — // first version was the latter and it selected a 20,246-word schedule of statutory instruments
- L457 — `59,925` — out.push(`\| EDM signature \| YES \| **NO** — 59,925 signals \| EXCLUDE (circular) \|`)
- L458 — `2,080,585` — out.push(`\| division votes \| YES \| **NO** — 2,080,585 signals \| EXCLUDE (circular) \|`)

**`scripts/graph/report-3c-ec-handoff.ts`**

- L18 — `14,879`, `1,489` — * 14,879 unheld-number rows against 1,489 held ones. That is the ratio of ROWS, and rows are not
- L170 — `4,462`, `4,458` — // reported "4,462 data rows" for 4,458 companies because four published donor names contain
- L180 — `1024` — console.log(`\n  ✓ work-list written: ${OUT} (${(Buffer.byteLength(csv) / 1024).toFixed(0)} KB, ${rows.length.toLocaleString()} rows)`)

**`scripts/ingest/caselaw-text/recompile-caselaw.ts`**

- L7 — `74,896` — * 74,896 rows carry an `r2RawKey` and that 60 of 60 sampled objects are present, are Akoma Ntoso,
- L101 — `6,139,777` — * 6,139,777 rows removed by the filter, 1.5 M block reads, 35.9 s cold on the first batch.
- L102 — `74,896`, `74,896` — * The id range is bounded instead; `probe-id-prefix.ts` verified 74,896 of 74,896 ids sit inside

**`scripts/ingest/census/b/walk-apis.ts`**

- L171 — `131,650` — note: 'The 131,650 landing-page rows were deleted from Neon on 27 Aug; this counts the decisions ' +
- L173 — `161,753` — 'the collection still holds 161,753 real judgments — see the sprint report.',
- L205 — `78,310` — note: '⚠ ONE organisation of the many this collection draws from — 62 documents against 78,310 ' +

**`scripts/ingest/diagnose-v4.ts`**

- L60 — `1500` — console.log(`Page 1500: status=${r2.status}, entries=${entries2}`)
- L67 — `1501` — console.log(`Page 1501: status=${r3.status}, entries=${entries3}`)
- L74 — `7489` — console.log(`Page 7489: status=${r4.status}, entries=${entries4}, first 300: ${text4.slice(0, 300)}`)

**`scripts/ingest/graph/extract-caselaw-citation-edges.ts`**

- L31 — `74,896` — * normalisation is recoverable without re-reading 74,896 documents.
- L75 — `193,226` — * **193,226 rows — 15.0%, one in seven — were stored like that by the first full run.** Nothing
- L239 — `1,288,630` — // with 32 concurrent workers, loses updates: the first full run built 1,288,630 rows, stored all

**`scripts/ingest/graph/report-common.ts`**

- L23 — `1,235` — * 3. SOURCE BYTES ARE LOCAL AND THE RUN IS OFFLINE. All 1,235 source documents
- L26 — `1,235`, `1,235` — *    (`probe-zip-coverage.ts`: 1,235 of 1,235). So T2 and T3 need no network,
- L69 — `133,361`, `130,096`, `2,894` — * The zip holds 133,361 documents under 130,096 gids. **2,894 gids carry both

**`scripts/ingest/position-graph/fill-edm-gap.ts`**

- L2 — `60,995` — * fill-edm-gap.ts — the §3 sweep lost exactly 100 of 60,995 motions to one failing page, and the
- L30 — `60,995` — * 100 of 60,995 is 0.16% — under the sweep's own 2% abort threshold, which is why it wrote. It is
- L51 — `2700` — * page at skip=2700 and I took that for the culprit; refetching it recovered 50 rows, **none of

**`scripts/ingest/position-graph/probe-corpus-shape.ts`**

- L11 — `6,574` — *      ~free — `v34-bills-metadata.ts` is the precedent, 6,574 rows repaired with 0 unmatched). A
- L129 — `3,448` — // all 22M rows looking for 3,448 matches, and it timed out at the 60s client limit on the first
- L138 — `50,000` — // of Neon time to answer a question 50,000 rows answers identically.

**`scripts/ingest/position-graph/probe-edm-public-page.ts`**

- L32 — `66501`, `5313` — // Motion 66501 — read in the API probe: 24 sponsors, primary Zöe Franklin (MNIS 5313).
- L34 — `66501` — 'https://edm.parliament.uk/early-day-motion/66501',
- L35 — `66501` — 'https://edm.parliament.uk/early-day-motion/66501/publication-of-legal-advice-on-local-government-reorganisation',

**`scripts/ingest/position-graph/sweep-members.ts`**

- L253 — `46,298` — * 46,298 person entities** (the upsert wrote both from whichever row was in hand), while the edges
- L282 — `1,690`, `5,234` — // they took their seat for others — measured, 16 Aug 2026: **1,690 of 5,234 have an earliest name
- L595 — `5,234` — // Only members with a `voted` or `signed-motion` edge to hold. Creating all 5,234 register rows

**`scripts/ingest/search/corpus-reachability.ts`**

- L176 — `1000` — console.log(`[reachability] ${table}: scanned ${rows.toLocaleString()} rows in ${((Date.now() - started) / 1000).toFixed(1)}s, ${out.size} corpora`)
- L457 — `17,261` — md.push('tactful: 17,261 instruments — including the Companies Act 2006 and UK GDPR — were absent')
- L628 — `24,876` — md.push('**documents** — Hansard satisfied the key by accident. `committees-reports` held 24,876')

**`scripts/ingest/search/fts-hygiene.ts`**

- L14 — `1,030` — *   2. ~1,030+ ORPHANS — superseded Hansard day-files whose `corpus_sections` row no longer
- L182 — `4,041` — //      (id, status) for every row. "Not compiled" is tiny — 4,041 of 6.39M on the worst
- L361 — `1024`, `1024` — log(`  ${category}: ${rowsOut} rows in ${part} parts → s3://${process.env.CLOUDFLARE_R2_BUCKET_NAME}/_search/hygiene-backup/${stamp}/ (${(bytesOut / 1024 / 1024).toFixed(

**`scripts/ingest/search/vec-hygiene.ts`**

- L271 — `1024`, `1024` — log(`exported ${rowsOut} orphan chunk rows in ${part} parts (${(bytesOut / 1024 / 1024).toFixed(1)} MB) → _search/vec-hygiene-backup/${stamp}/`)
- L279 — `6,464`, `89,377` — * marker (stamp 2026-08-06T05-22-55-495Z, 6,464 rows) sat on disk while a 89,377-row export was
- L281 — `89,377`, `6,464` — * delete of 89,377 rows backed by a safety record of 6,464 unrelated ones. The guard was exactly

**`scripts/ingest/search/vector-core.ts`**

- L28 — `4,096` — * 24 probes of 4,096 returns **70.4%** of what the same index returns fully probed — and until now its
- L68 — `5,714` — * chunk. So for a 5,714-word Lords speech the service found the passage that answered the
- L82 — `1,868,316`, `21,846,364` — * distinction is not cosmetic at this ratio: legislation is 1,868,316 of 21,846,364 vectors

**`scripts/ingest/shared/progress-reporter.ts`**

- L140 — `3,560`, `9,343`, `7,279` — * "3,560 of 9,343 Acts that have text — 38.1%; 7,279 more are published with no provisions."
- L144 — `3,560`, `16,622` — * used to lead with `3,560 of 16,622 published = 21.4%` and put the honest figure in a bracket.
- L759 — `914,274` — // 914,274 rows runSearch() cannot return.

**`scripts/ingest/sources/impact-assessments.ts`**

- L38 — `1,932` — * SECOND ROUTE — gov.uk, 1,932 documents typed `impact_assessment`. ⚠ That type
- L65 — `760,509` — * sprint undoing (eur-lex:32007B0143:1 held 760,509 words in one row and was
- L96 — `2924` — /** The instrument this IA belongs to, e.g. "uksi/2008/2924" or "ukpga/2017/29".

**`scripts/ingest/sources/tna-legislation.ts`**

- L56 — `117,667` — // no consumer, and 117,667 rows that have been `pending` since June 2026.
- L513 — `117,667` — // "there is a PDF" from anything else. 117,667 instruments are already classified
- L672 — `8,583` — // V36. THE DIFFERENCE THIS MAKES, measured: 8,583 instruments carry

**`scripts/ingest/v32-rechunk-reports.ts`**

- L7 — `7497`, `78688`, `455,137` — *   before   committees-reports:publication:7497:78688          1 row,  455,137 chars
- L8 — `7497`, `78688`, `0001`, `6,000` — *   after    committees-reports:publication:7497:78688-0001     N rows, ≤6,000 chars each
- L62 — `17,813`, `1,109` — *  Correspondence (17,813 rows, 1,109-word median) is already the right size and is left alone. */

**`scripts/ingest/v33-archive-railway-db.ts`**

- L16 — `914,274` — * 914,274-row table carrying full body text never has to fit in memory, and each shard is capped
- L77 — `914,274` — * on `LegislationSection_DEPRECATED_2026-06-19` — 914,274 rows of body text exceed V8's ~512 MB
- L185 — `1000` — console.log(`  ${n(totalRows)} rows, ${mb(totalBytes)} MB gzipped, in ${Math.round((Date.now() - t0) / 1000)}s`)

**`scripts/ingest/v33-check-vec-hygiene-guard.ts`**

- L6 — `6,464`, `89,377` — * 6,464 rows) sat on disk while a 89,377-row export was still four parts from finishing; the old
- L65 — `89,377` — *   [vec-hygiene] safety export verified: stamp 2026-08-09T13-04-26-205Z, 89,377 rows,
- L80 — `6464`, `0001` — fs.writeFileSync(MARKER, JSON.stringify({ stamp: '2026-08-06T05-22-55-495Z', rows: 6464, keys: ['_search/vec-hygiene-backup/2026-08-06T05-22-55-495Z/orphan-chunks.part-00

**`scripts/ingest/v36-seed-recovery.ts`**

- L44 — `41,913` — * The reason is not speed. A run of 41,913 instruments will be interrupted — a
- L85 — `5,546` — * text. Run against the actual `unseen` work list, the yield is **0 of 12**: 5,546
- L93 — `17,261` — * 17,261 instruments.

**`scripts/ingest/v38-hygiene.ts`**

- L11 — `117,667` — * §4.2 — the 117,667 `specialist_queue` rows labelled `pdf-only`. The label came from a HEAD
- L14 — `117,667` — * sample, because a 52-row sample that decided the fate of 117,667 rows deserves confirming before
- L80 — `117,667` — head('§4.2 — THE 117,667 `pdf-only` ROWS')

**`scripts/legislation/v3opt/src/build-manifest-eu-asc.ts`**

- L7 — `24,488` — *   manifest-eur.json   — Retained EU Regulations  (24,488 raw entries)
- L8 — `13,173` — *   manifest-eudn.json  — Retained EU Decisions     (13,173 raw entries)
- L9 — `2,035` — *   manifest-eudr.json  — Retained EU Directives    (2,035 raw entries)

**`scripts/starkey/b21-measure-sweep.ts`**

- L11 — `6,126` — * **But measured here: 281 videos have ONE transcript, 3 have two.** By passage it is 6,126 `asr`
- L15 — `2,728`, `2,764` — * marked, an unmarked passage reads as "two engines agreed" — and in 2,728 of 2,764 occurrences
- L148 — `4,003` — // The first version held all 4,003 `Hit` objects — each carrying a FULL passage — until

**`scrutinise-web/lib/graph/position-config.ts`**

- L155 — `8,773`, `18,999` — // that plainly was not there. Across the whole graph, 8,773 of 18,999 minority-side votes
- L207 — `17,240`, `46,702`, `5,634` — // Sized off the data: 17,240 of 46,702 party×division groups have 20+ voters, and 5,634 of the

**`scrutinise-web/lib/lex/committee-url.ts`**

- L26 — `264,773`, `487,088` — // — 264,773 of the 487,088 committee rows (54.4%), every one of them a 404 at rest.
- L35 — `264,773` — // is recorded for the ingest thread rather than fixed by a 264,773-row rewrite.

**`scrutinise-web/lib/lex/consequences-ordering.ts`**

- L172 — `3,054` — // reported **100% of 3,054 instruments** as quoting a different Act — a warning on every
- L173 — `3,054` — // correct row, which is worse than no warning at all. Measured before and after: 3,054 → 24.

**`scrutinise-web/lib/lex/costing.ts`**

- L227 — `18,759` — *  instrument's gid — 0 of 18,759 ids contain a slash. That mistake is what killed two of
- L562 — `1,169` — // is the number of assessments whose STAGE is Post Implementation — 71 of 1,169, 6.1%. A coverage

**`scrutinise-web/lib/lex/deepening-jobs.ts`**

- L409 — `1,868` — * does the most damage: a list of 1,868 consequences for the wrong Act reads as authoritative.
- L493 — `1,868` — // let the user open it. Writing 1,868 rows would be the unreadable list the grouping

**`scrutinise-web/lib/lex/fts-search.ts`**

- L250 — `135,531` — // corpus_acts rows vs 135,531 distinct LegislationItem gid→title, 0 missing,
- L251 — `250,808` — // 0 differing. corpus_acts is a SUPERSET (250,808 rows) whose extra rows carry

**`scrutinise-web/lib/lex/general-chat.ts`**

- L185 — `8192` — // 8192, not the 2048 the idea-chat uses, and thinking OFF. The first live run of
- L186 — `2488` — // this file died on `Unterminated string in JSON at position 2488`: an answer over

**`scrutinise-web/lib/lex/political-title.ts`**

- L12 — `1,024` — //                                                              ← names nothing at all. 1,024 rows
- L87 — `1,049` — * populated on 94.7% of rows (1,049 distinct instruments, 742 of them resolving to a title in

**`scrutinise-web/lib/lex/repeal-wording.ts`**

- L31 — `249,256` — * `section_repeals` holds 249,256 rows and every one carries this evidence: the publisher renders
- L48 — `249,256` — * row of this kind today: all 249,256 rows are `dot-leader-placeholder`. `b3-backfill-partial.ts`

**`scrutinise-web/lib/lex/vector-search.ts`**

- L216 — `135,531`, `135,531` — // Verified zero-gap drop-in: 135,531 titled corpus_acts rows vs 135,531
- L218 — `250,808` — // corpus_acts is a SUPERSET (250,808 rows) whose extra rows carry title NULL,

**`scrutinise-web/scripts/argument-peroration.ts`**

- L17 — `22,000` — * ~22,000 characters has no vector whatsoever. **A position experiment run over chunks would be
- L130 — `1800` — console.log('  ⚠ rows excluded by the 1800 date floor (an ingest finding, reported not fixed):')

**`scrutinise-web/scripts/check-lex-25m.ts`**

- L10 — `2,702` — //      (2,702 rows, 2 with a userId). A future edit "restoring" the brief's wording would
- L126 — `2,702` — // ⚠⚠ §4 SAYS LlmSpend AND THE DATA SAYS IT CANNOT BE. Measured 28 Aug 2026: 2,702 rows,

**`scrutinise-web/scripts/check-s18-costing.ts`**

- L10 — `18,759` — *      of their 18,759 ids — so its PREDICTED and OBSERVED legs had never returned a row, and it
- L11 — `1,197` — *      told 952 instruments that no post-implementation review existed while holding 1,197 review

**`scrutinise-web/scripts/check-surface-3.ts`**

- L165 — `2,361` — expectBreak('§1a break: the statement hardcoded — "the Commons record holds 2,361 divisions"',
- L168 — `2,361` — 'const lines: string[] = []\n  const bad = `the Commons record holds 2,361 divisions`')).length === 0)

**`scrutinise-web/scripts/report-position-source-families.ts`**

- L21 — `3,448`, `1,505`, `1,723` — * 3,448 documents, a set of 1,505 graph EDGES and a set of 1,723 SIGNALS. Quoting any one of them
- L59 — `162,733` — * edge and THREE signals. Measured: witness signals have 162,733 distinct (actor, target)

**`scrutinise-web/scripts/verify-lex-25d-live.ts`**

- L180 — `0031` — await decideSource(idea.id, user.id, { sourceKey: 'ukia/2019/0031', status: 'EXCLUDED', reason: '   ' })
- L204 — `0031` — await decideSource(idea.id, user.id, { sourceKey: 'ukia/2019/0031', status: 'INCLUDED' })

**`scrutinise-web/scripts/watch-build-to-done.ts`**

- L67 — `1000` — console.log(`  ${new Date().toISOString().slice(11, 19)}  ${row.status.padEnd(9)} pass ${String(row.currentPass ?? '—').padEnd(12)} ${row.passesComplete} complete  (+${Ma
- L83 — `1000` — console.log(`  wall clock       : ${Math.round((row.completedAt.getTime() - row.startedAt.getTime()) / 1000)}s`)

**`scripts/attic/v18-verification/cleanup-v18-carryover.ts`**

- L12 — `7489` — *    done caselaw rows (with them the old page:7489 overhang AND the discovery
- L23 — `1495`, `1501` — // (page 1 = newest judgments) — the first tail seed (pages 1495–1501) re-fetched

**`scripts/attic/v20-verification/v19-seed-ukpga-regnal.ts`**

- L6 — `6,897` — * enumerable. The 6,897 pre-1963 rows seeded from Neon legacy used calendar ids:
- L46 — `5,840` — // chrome-boilerplate html capture. (All 5,840 format='html' rows in this

**`scripts/graph/check-3b.ts`**

- L235 — `2,317,523` — ok('total signals = 3A\'s 2,317,523 + the P1 donations, and nothing else moved',
- L319 — `80000` — ok('the register is loaded', Number(reg.n) > 80000, `${Number(reg.n).toLocaleString()} rows`)

**`scripts/graph/check-3c.ts`**

- L75 — `2575` — //     0.2575 "under" a ceiling of 1. **An assertion that reads its own bound out of the thing it
- L134 — `2575` — // is how the first version of this check passed at 0.2575 "under" a ceiling of 1.

**`scripts/graph/derive-signals.ts`**

- L51 — `178,208` — basis: "graph_edge WHERE predicate='gave-evidence-to' — an EDGE count, so the measurement should come in HIGHER: 178,208 evidence rows exist, i.e. some actors appeared be
- L55 — `1,822` — basis: "graph_edge WHERE predicate='declared-interest' — 1,822 evidence rows, so again expect higher",

**`scripts/graph/derive-vote-classes.ts`**

- L6 — `2,080,585` — * turn 2,080,585 raw votes into weighted signals, through the `position_signal_vote` view.
- L396 — `5,645` — console.log(`\n  ── threshold sensitivity (divisions tagged free-vote-like, of 5,645) ──`)

**`scripts/ingest/ann-recall-check.ts`**

- L12 — `4,096` — * Production probes 24 of 4,096 IVF partitions (`VECTOR_NPROBES` default 24, VERIFIED unset on the
- L252 — `4,096` — console.log(`[ann-recall] ladder: ${LADDER.join(', ')} probes of 4,096 — reference rung = ${EXHAUSTIVE}`)

**`scripts/ingest/c2/b3-backfill-partial.ts`**

- L8 — `32,040` — * `section_repeals` has never held a row for this. A measured **32,040 sections [95% CI
- L29 — `2,000` — * Lance scan by id is one round trip per 2,000 rows against ~1.6M individual R2 object reads. A

**`scripts/ingest/c2/e1-drop-ftsvector.ts`**

- L8 — `1,178`, `683,153`, `18,521,194` — *   · 1,178 MB across 683,153 of 18,521,194 rows (3.7%) — 6.2% of an 18 GB database.
- L14 — `683,153` — *     is why 96.3% of rows are null. The 683,153 non-null values are fossils of a 2026 build.

**`scripts/ingest/c2/l2-dotfinal.ts`**

- L8 — `319,319` — *  · my first projection quoted a population of 319,319 retained-eu rows while sampling only
- L9 — `120,122` — *    those with an r2Key. 120,122 retained-eu rows have no r2Key or are not `compiled`, so the

**`scripts/ingest/c2/l2-item5-cap.ts`**

- L10 — `5,000` — console.log('=== separator counts in the 10 largest rows (5,000 would be an API page cap) ===')
- L18 — `5,000` — console.log(`\n${capped} of ${rows.length} sampled rows sit exactly on 5,000 answers.`)

**`scripts/ingest/caselaw-text/refresh-fts-caselaw.ts`**

- L84 — `1,191,345` — * index on every query. On 2 Aug 2026, 1,191,345 un-indexed rows of 17.7 M took warm p50 from
- L85 — `74,896` — * 4.5 s to 25-32 s. 74,896 rows is a sixteenth of that, but the number belongs in the report

**`scripts/ingest/caselaw-text/sweep-caselaw-dates.ts`**

- L114 — `6,139,777` — * the first id in an 18-million-row table and filter — EXPLAIN ANALYZE showed 6,139,777 rows
- L117 — `74,896`, `74,896` — * before using it (`probe-id-prefix.ts`): 74,896 of 74,896 ids start `tna-caselaw:` and 0 rows

**`scripts/ingest/committees-freshness.ts`**

- L12 — `22140`, `164408` — *     GET https://committees.parliament.uk/publications/22140/documents/164408/default/  200  ← opens
- L16 — `13110` — * know nothing about. A third class exists too — `13110` is a real correspondence record carrying

**`scripts/ingest/graph/caselaw-coverage.ts`**

- L48 — `74,896` — * `tna-caselaw` — all 74,896 judgments, the entire English holding. That boundary was therefore
- L122 — `11,987` — * 11,987-document "tail". The floor it named was the cut-off of our own ingest run.

**`scripts/ingest/graph/check-graph5-boundary.ts`**

- L103 — `74,896` — const planted = fnSrc.replace('const lines: string[] = []', 'const lines: string[] = []\n  const bad = `our case law begins in 2003 and holds 74,896 documents`')
- L115 — `74,896` — //    the 74,896-document English holding, and its boundary was computed over what was left.

**`scripts/ingest/graph/check-graph5-prereq.ts`**

- L25 — `74,894` — * §0's claim is "77% to 0% across all 74,894 documents". That figure was measured on C. B is what
- L55 — `2381` — `On appeals from: [2019] EWHC 2381 (QB) and [2019] CSIH 49 JUDGMENT `.repeat(3)

**`scripts/ingest/graph/redo-g5-citation-edges.ts`**

- L15 — `1,225,806` — *     only ever touch rows this sprint wrote. The 1,225,806 pre-existing legislation rows are not
- L22 — `74,896` — * ⚠ Reversible in the only sense that matters: the rows are a pure function of 74,896 judgments

**`scripts/ingest/graph/report-b3-caselaw.ts`**

- L25 — `74,896` — * two largest that do (`tna-caselaw`, 74,896 rows from 1965; `ni-judgments`,
- L316 — `74,896`, `7,927` — missing_from_it: ['tna-caselaw (74,896 rows, from 1965)', 'ni-judgments (7,927 rows)'],

**`scripts/ingest/impact/audit-3-layout.ts`**

- L12 — `1,169` — * it: how many of the 1,169 are DISTINCT DOCUMENTS. Three assessments (2021/56, /57, /58) share an
- L13 — `106,674` — * identical 106,674-word body, because one impact assessment deposited against three instruments is

**`scripts/ingest/names/backfill-caselaw-titles.ts`**

- L4 — `74,896` — * Populates `corpus_sections."sectionTitle"` for `tna-caselaw`, whose 74,896 rows carry a blank
- L18 — `74,896` — * 74,896 rows use it) and is per-corpus by existing convention — `petitions` stores a Parliament

**`scripts/ingest/names/sweep-evidence-attribution.ts`**

- L28 — `142,315` — * 142,315 detail calls, and it is METADATA ONLY — the alternative of re-fetching document text is
- L41 — `14,190` — * one row per whole transcript (mean 14,190 words), so "who said this sentence" is not a question

**`scripts/ingest/position-graph/audit-edm-signatures.ts`**

- L183 — `1000` — console.log(`   elapsed ${(elapsed / 1000).toFixed(1)}s at concurrency 4 → ${(elapsed / results.length).toFixed(0)}ms/motion wall`)
- L220 — `1000` — console.log(`   at the measured ${perMotion.toFixed(0)}ms/motion  → ${(totalMotions * perMotion / 1000 / 60).toFixed(0)} min at concurrency 4`)

**`scripts/ingest/position-graph/fix-edm-duplicate-signals.ts`**

- L6 — `60,995` — * 947 motions, and **failed on 42 pairs once all 60,995 were loaded** — the same shape as A3 and A6:
- L34 — `2,002,626` — * ⚠ 42 of 2,002,626 signals is 0.002%. This is not a material change to any number in the report; it is

**`scripts/ingest/position-graph/probe-amd2c.ts`**

- L24 — `179,911` — // ⚠ SAMPLED, not exhaustive. The full join is 179,911 evidence rows against a 22M-row
- L25 — `5,000` — // corpus_sections and blew the 60s client timeout on the first attempt; a 5,000-row sample

**`scripts/ingest/position-graph/project-edm-signatures.ts`**

- L48 — `3,246`, `16,392`, `107,000` — // does not shrink as the sample grows: on 3,246 motions it produced **±16,392** and made a 107,000
- L110 — `59,925` — console.log(`   + sponsorship signals already stored 59,925`)

**`scripts/ingest/position-graph/report.ts`**

- L84 — `78,579` — // evidence" about 78,579 evidence rows that are sitting right there. Measure the thing, not the
- L247 — `5,000` — ['no dangling section in a bounded 5,000-row sample',

**`scripts/ingest/position-graph/verify-2d4.ts`**

- L39 — `37657` — line(untouched.n === '37657', 'the graph of record is UNCHANGED by the trials',
- L40 — `37,657` — `graph_position holds ${Number(untouched.n).toLocaleString('en-GB')} rows (2D-3 wrote 37,657)`)

**`scripts/ingest/position-graph/verify-2d5.ts`**

- L62 — `37657`, `37,657` — check(gp.n === '37657', 'graph_position still holds exactly the 37,657 rows 2D-3 wrote', `found ${gp.n}`)
- L63 — `16196`, `16,196` — check(gp.pos === '16196', 'and exactly the 16,196 non-declined positions the 2D-3 report quotes', `found ${gp.pos}`)

**`scripts/ingest/quango/build-universe.ts`**

- L9 — `1252` — * 1. MOJIBAKE. Six rows carried UTF-8 read as Windows-1252 ("Victoria ClimbiÃ© Inquiry",
- L196 — `1263` — * WARNING - THE FIRST VERSION OF THIS REGEX COULD NOT MATCH ANYTHING, AND REPORTED "0 of 1263" ON

**`scripts/ingest/reseed-deep.ts`**

- L34 — `140,000`, `3,390` — // retained-eu: EU instruments on TNA (eudn/eur/eudr). est 140,000 sections, only 3,390 queue rows.
- L38 — `160,000`, `9,434` — // regional: NI/Scottish/Welsh legislation. est 160,000 sections, only 9,434 queue rows done.

**`scripts/ingest/s3-shortfall-triage.ts`**

- L4 — `5,106` — * `s3-drop-readiness.ts` finds 5,106 instruments where `corpus_sections` holds fewer
- L5 — `37,154` — * rows than `LegislationSection`, ~37,154 sections behind. Read naively that blocks the

**`scripts/ingest/search/build-chunks-scalar-index.ts`**

- L4 — `21,839,900` — * WHY. `corpus_chunks` holds 21,839,900 rows and carries NO index of any kind.
- L85 — `22,670,808`, `21,191,844`, `1,478,964` — * Measured 27 Aug 2026: 22,670,808 rows, 21,191,844 indexed, **1,478,964 unindexed (6.5%)**,

**`scripts/ingest/search/corpus-completeness.ts`**

- L8 — `17,261` — * made of 17,261 absent instruments, and why the number turned out to be larger
- L152 — `2,361` — lines.push('having ingested 25 of 2,361 rows.')

**`scripts/ingest/search/fts-drift.ts`**

- L20 — `3,697` — * batched `delete WHERE id IN (…)` managed 3,697 rows in 15 minutes) — or holding both sides in
- L116 — `1000` — console.log(`  index: scanned ${scanned.toLocaleString()} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${idx.size} collections`)

**`scripts/ingest/search/fts-query-service.ts`**

- L52 — `1,478,964` — * concurrency: **1,478,964 rows (6.5%) had fallen outside a scalar index and were brute-force
- L194 — `12,176`, `1,523` — // client-side p95 of 12,176 ms while this service reported warm_p95 = 1,523 ms and the

**`scripts/ingest/search/fts-record.ts`**

- L120 — `48,900`, `48,900` — *   1. Cost. Re-tiering ~48,900 rows through R2 is ~48,900 object reads for a change to one
- L145 — `1824`, `1,650`, `3,599` — // calendar one (`ukpga/1824/83`), or the reverse. Without this, 1,650 of 3,599 pre-2000

**`scripts/ingest/search/probe-committee-drafting.ts`**

- L6 — `165,443` — *   corpora      committees-* is 165,443 rows, 1.17% of tier='parliamentary'
- L10 — `2,575`, `2,511` — *   reports      2,575 'Report:' rows over 2,511 DISTINCT titles — ~1 row each, i.e. stubs

**`scripts/ingest/search/regnal-alias.ts`**

- L11 — `1,949`, `3,599` — * MEASURED 24 Aug 2026 over `primary-acts-pre-2000`: **1,949 of 3,599 instruments (54.2%) resolve
- L12 — `3,599`, `3,599`, `1,650` — * to a title today; trying both forms resolves 3,599 of 3,599 — 100.0%.** All 1,650 of the

**`scripts/ingest/search/vector-query-service.ts`**

- L648 — `22,670,808` — // IS WHY THIS ENDPOINT IS SHAPED THIS WAY. `corpus_chunks` has 22,670,808 rows and its
- L650 — `130,229`, `130,131`, `1,301` — // the live dataset at 130,229 ms for n=1 and 130,131 ms for n=60, against an ANN of 1,301 ms

**`scripts/ingest/shared/legislation-sections.ts`**

- L15 — `22,240` — * MAX_CHUNKS=8 windows ≈ 22,240 characters per row; raising the cap to 64 would still leave a
- L16 — `760,509` — * 760,509-word row embedding a small fraction of itself. Only splitting the document fixes it —

**`scripts/ingest/shared/report-sections.ts`**

- L5 — `455,137` — * whole committee report — up to 455,137 characters — is a single row and therefore a single
- L8 — `68,000` — *   - BM25 (live today): length normalisation buries a 68,000-word document. `Coronavirus:

**`scripts/ingest/sources/fcdo-treaties.ts`**

- L15 — `21,970`, `15,000` — // library2_lib) holds 21,970 records — NOT the ~15,000 the brief/gov.uk page
- L20 — `7,184`, `14,786` — // 7,184 records (33%) carry at least one such PDF; 14,786 (67%) are

**`scripts/ingest/v21-honest-denominator.ts`**

- L47 — `1,944` — blockedReason: 'college.police.uk CF-blocked; licence unverified (V20 audit deleted 1,944 junk rows from the unfiltered gov.uk search era)',
- L56 — `4,471`, `30,050` — notes: 'V20 probe MEASURED: resultcount GBR 4,471 docs (584 judgments) — replaces the V-era ~30,050 guess. Sections will exceed docs at ingest.',

**`scripts/ingest/v32-committees-audit.ts`**

- L9 — `2,575`, `2,511` — * COUNTS in the Lance FTS table (2,575 rows over 2,511 titles → "~1 row each"). The count is
- L74 — `10,000` — console.log(`     ${v.over_10k} rows are >10,000 words; only ${v.under_500} are <500 words`)

**`scripts/ingest/v32-metadata-pass.ts`**

- L50 — `3,101` — * script's own re-run assertion, not by inspection — 3,101 rows were sitting at exactly 500 chars
- L157 — `3,101` — * the real defect entirely — 3,101 rows whose name had been truncated away.

**`scripts/ingest/v34-bills-metadata.ts`**

- L2 — `6,574` — * v34-bills-metadata.ts — give the 6,574 `bills-api` rows a NAME and a STATUS.
- L11 — `6,574` — *     itemDate       null on all 6,574 rows          ← so a 2019 bill and a live one look alike

**`scripts/ingest/v34-dv-smoke.ts`**

- L3 — `5,645` — * before 5,645 rows go through it, and proves it on the case that would break:
- L61 — `999999` — console.log(`  commons:999999 (date=NULL, synthetic) → 1 division + ${n} member rows  ← the case that would have thrown`)

**`scripts/ingest/v36-attempted-analysis.ts`**

- L2 — `2,935` — * v36-attempted-analysis.ts — V36 §1.2: the 2,935 instruments that WERE attempted
- L22 — `1000` — console.log(`\n=== ${label} ===  (${((Date.now() - t) / 1000).toFixed(1)}s, ${rows.length} rows)`)

**`scripts/ingest/v36-probe-fetch.ts`**

- L17 — `3038` — 'uksi/2012/3038',  // Greenhouse Gas ETS Regs — 'no-provisions', 107 legacy sections
- L19 — `2768` — 'uksi/1991/2768',  // Building Regulations 1991 — 'no-provisions', 57 legacy sections

**`scripts/ingest/v36-verify-deploy.ts`**

- L4 — `41,913` — * THE GATE THIS ENFORCES. Seeding 41,913 instruments to workers running the OLD
- L74 — `41,913` — console.log(`[deploy] ⚠ permanent "no text" marker across 41,913 instruments.`)

**`scripts/ingest/v37-seed-scope-decisions.ts`**

- L38 — `1,264`, `2,602` — note: 'V37 scope decision, 12 Aug 2026: INGEST. 1,264 instruments / 2,602 citation references; the corpus holds nia (2000+) and nisi and nothing for 1921–1972. Not yet se
- L40 — `6,803` — note: 'V37 scope decision, 12 Aug 2026: INGEST. 245 instruments / 6,803 citation references; a Measure has the force of an Act of Parliament. Not yet seeded — needs its o

**`scripts/ingest/v38-orphan-census-probe.ts`**

- L7 — `171,700` — * for flipping 171,700 rows"* (V36), and the V36 pilot that said 6/6 until a random draw said 27.5%.
- L61 — `1,617`, `1,618` — console.log(`     S3 measured that separately: 1,617 of 1,618 apparent absences were alias artefacts.`)

**`scripts/ingest/workers/ingest-pool.ts`**

- L243 — `1000` — timeoutHandle = setTimeout(() => reject(new Error(`row timeout after ${ROW_TIMEOUT_MS / 1000}s`)), ROW_TIMEOUT_MS)
- L259 — `39,964` — // parked all 39,964 pending rows of the recovery as `blocked` minutes into the

**`scripts/legislation/transfer-to-neon.ts`**

- L264 — `1000` — log(`LegislationItem complete: ${transferred.toLocaleString()} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
- L333 — `1000` — log(`LegislationSection complete: ${transferred.toLocaleString()} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

**`scripts/legislation/v276-bulk/phase4-verify.ts`**

- L58 — `1665` — console.log(`  Section rows:               ${co2006?._count.sections}  (expected 1665)`)
- L150 — `168,970` — console.log(`  Total LegislationSection rows \|     168,970 \| ${String(totalSections).padStart(11)}`)

**`scripts/stats/ingest-handlers.ts`**

- L8 — `65,985` — // historical forecasts alone, and it would have made IMF's 65,985 rows an overnight job.
- L30 — `2,925`, `3,404` — * `sourceSeriesId` was NULL on 2,925 of 3,404 series, which is what made the natural key

**`scripts/stats/lib/upsert.ts`**

- L126 — `2,807`, `20,482` — // hours for one dataset of 2,807 series / 20,482 observations, and it would have been ~11
- L127 — `65,985` — // hours for IMF's 65,985 rows. The per-row helpers are kept because they are clearer for

**`scrutinise-web/lib/graph/idea-target.ts`**

- L104 — `60,995`, `60,995` — * 60,995 rows over 60,995 motions, 1.00 per motion — so what we hold is the motion's PRIMARY

**`scrutinise-web/lib/graph/positions.ts`**

- L256 — `2,317,523`, `2,316,542` — // not push it down: the plan materialised all 2,317,523 signals and threw away 2,316,542 of them.

**`scrutinise-web/lib/html-entities.ts`**

- L95 — `1252` — * These references come from documents authored in Windows-1252, where 145 and 146 are the curly

**`scrutinise-web/lib/lex/allowance.ts`**

- L10 — `2,702` — //     LlmSpend: 2,702 rows — 2 with a userId, 5 with an ideaId.

**`scrutinise-web/lib/lex/build-carry.ts`**

- L108 — `217,687` — * build of Charlie's idea (`42d68bea`, 217,687 input tokens, 33.4p):

**`scrutinise-web/lib/lex/build-config.ts`**

- L445 — `77,970` — * returned — ~434 documents, **77,970 input tokens across two calls, 36% of a whole

**`scrutinise-web/lib/lex/build-query.ts`**

- L13 — `1359` — // row is the whole string — `… system private care homes northern lack :: context(1359

**`scrutinise-web/lib/lex/build.ts`**

- L1821 — `0000` — // one U+0000 in one snippet, out of 240 results across five routed streams, took a

**`scrutinise-web/lib/lex/deepening-sift.ts`**

- L67 — `8,000` — * A flat 8,000 was the ceiling that fired: on 19 Aug **3 of 4 Deepening passes truncated here**

**`scrutinise-web/lib/lex/elicitation.ts`**

- L716 — `60,000` — * provenance and a verbatim quote each; putting 60,000 characters per document into every

**`scrutinise-web/lib/lex/gateway-legacy.ts`**

- L333 — `1,838` — // come from the legacy tables, which measure 1,838 and 57 contaminated rows.

**`scrutinise-web/lib/lex/gemini-finish.ts`**

- L8 — `2488` — *   8 Aug   general-chat    — "Unterminated string in JSON at position 2488" over 16 sources

**`scrutinise-web/lib/lex/grain-policy.ts`**

- L122 — `51,000` — * 51,000 committee reports into one document and report a spectacular recall gain. The regroup is

**`scrutinise-web/lib/lex/merge-judged.ts`**

- L101 — `30,000` — * that `term-coverage.ts` documents: a 30,000-word speech and a 200-word regulation both top out

**`scrutinise-web/lib/lex/page-one.ts`**

- L10 — `2,934`, `1,478` — // (idea 452c5ade: 2,934 and 1,478 characters). The empty boxes Charlie saw came from a

**`scrutinise-web/lib/lex/query-router.ts`**

- L102 — `1,873` — * were 1,873 rows of Erskine May. So the collection is re-checked off the id, client-side, where

**`scrutinise-web/lib/lex/question-panel.ts`**

- L61 — `1,145` — * on the pilot idea — median 296 to 1,145 characters a heading — and this assembler was

**`scrutinise-web/lib/lex/repeal-status.ts`**

- L10 — `25,138` — // census (2026-08-13), 25,138 of them naming the repealing instrument, and every one joins

**`scrutinise-web/lib/lex/search-gateway.ts`**

- L571 — `249,256` — // ROWS, and this codebase has now shipped that shape twice. All 249,256 whole-body dot leaders

**`scrutinise-web/lib/lex/stats-licence-register.ts`**

- L62 — `2,329`, `5,733` — 'use without written permission; they do not exclude this use. 2,329 of 5,733 series (40.6%, all ' +

**`scrutinise-web/lib/lex/stream-scopes.ts`**

- L163 — `1,873` — // `erskine-may` (1,873 indexed rows) is parliamentary PROCEDURE — what the House can and cannot

**`scrutinise-web/lib/lex/user-material.ts`**

- L529 — `42,264` — * Measured on Charlie's own document (42,264 chars): the pass offered 15 findings and

**`scrutinise-web/lib/mockData.ts`**

- L340 — `2,500,000,000` — proposedWording: 'The Secretary of State must establish and maintain a Universal Digital Infrastructure Fund of not less than £2,500,000,000 for the purpose of financing 

**`scrutinise-web/lib/search.ts`**

- L214 — `1,838`, `4,874` — // (17 Aug): `LegislationSection.sectionTitle` 1,838 rows, `originalText` 4,874,

**`scrutinise-web/scripts/archive-ideas.ts`**

- L25 — `1234`, `5678` — //   tsx --env-file=.env scripts/archive-ideas.ts --ids 1234,5678      # narrow to ids (prefixes ok)

**`scrutinise-web/scripts/argument/controls.ts`**

- L71 — `3135`, `1873` — { chunkId: 'historic-hansard:S3V0225P0:3135#0', tags: ['PRECEDENT', 'COST'], note: 'The Act of 1873 failed to achieve its object, and the cost of enforcing it precluded p

**`scrutinise-web/scripts/audit-s18-routing.ts`**

- L40 — `18,700` — *    cannot be found even scoped to its own 18,700 documents is not, and no amount of routing will

**`scrutinise-web/scripts/audit-s19-reach.ts`**

- L29 — `69,529` — *    cause was that **all 69,529 of its rows have a blank `sectionTitle`**, so every probe string

**`scrutinise-web/scripts/b18-link-instruments.ts`**

- L81 — `1854` — + 'settlement of 1854 (not an enactment at all) and Part 1 of the Constitutional Reform and Governance Act '

**`scrutinise-web/scripts/check-export-e2e.ts`**

- L158 — `1745` — ok('regenerate → the new source is in the document model', text.includes('HC 1745'))

**`scrutinise-web/scripts/check-lex-25e.ts`**

- L186 — `2,934` — // created hours earlier with nothing in it, and Charlie's own 2,934-character idea never

**`scrutinise-web/scripts/check-lex-25v.ts`**

- L23 — `3153` — const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'

**`scrutinise-web/scripts/check-lex-25w.ts`**

- L28 — `3153` — const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'

**`scrutinise-web/scripts/check-render-decode.ts`**

- L59 — `1,838`, `4,874` — { file: 'lib/search.ts', why: 'legacy legislation + operational FTS (1,838 / 4,874 / 12 dirty rows)', must: ['decodeForDisplay(r.actTitle)', 'decodeMaybe(r.sectionTitle)'

**`scrutinise-web/scripts/check-repeal-exclusion.ts`**

- L8 — `249,256` — * returned to a user as the answer to a question about the law. 249,256 such rows have been

**`scrutinise-web/scripts/check-s19-grain.ts`**

- L8 — `344,773` — *   1. THE DOCUMENT KEY. The obvious rule — the id's second colon segment — collapses ALL 344,773

**`scrutinise-web/scripts/check-s9-catalogue.ts`**

- L68 — `1000` — ok('index is not trivially small', idx.rows.length > 1000, `${idx.rows.length} series`)

**`scrutinise-web/scripts/check-statutory.ts`**

- L155 — `1,034,548` — // ⚠ MEASURED: lower(target_act_id) forces a seq scan over 1,034,548 rows — 474ms

**`scrutinise-web/scripts/check-surface-4.ts`**

- L238 — `2,361` — () => figuresAbout(`const bad = 'our record holds 2,361 divisions'`).length === 0)

**`scrutinise-web/scripts/check-text-integrity.ts`**

- L47 — `4888`, `8581` — // Idea d90b880f-17a6-4888-8581-c3726d69d6a9, "Civil Service Decision Paralysis",

**`scrutinise-web/scripts/classify-stale-challenges-v2.ts`**

- L35 — `3153` — const IDEA = process.argv.slice(2).find((a) => UUID.test(a)) ?? '452c5ade-3153-400a-bf48-3b71aaa52773'

**`scrutinise-web/scripts/classify-stale-challenges.ts`**

- L41 — `3153` — const IDEA = process.argv.slice(2).find((a) => UUID.test(a)) ?? '452c5ade-3153-400a-bf48-3b71aaa52773'

**`scrutinise-web/scripts/costing/m5-pssru.ts`**

- L20 — `115569`, `202026` — 'https://kar.kent.ac.uk/115569/1/The%20unit%20costs%20of%20health%20and%20social%20care%202025_Final%20%281st%20June%202026%29.pdf'

**`scrutinise-web/scripts/explore-s8-gold.ts`**

- L79 — `1,566`, `3,000` — //                        `parentDocId`. 1,566 of 3,000 sampled rows (52%) resolve to a named

**`scrutinise-web/scripts/list-settled-decisions.ts`**

- L20 — `3153` — const IDEA = process.argv.slice(2).find((a) => UUID.test(a)) ?? '452c5ade-3153-400a-bf48-3b71aaa52773'

**`scrutinise-web/scripts/measure-s11-tier.ts`**

- L40 — `45,295` — * "Trades nothing" is itself a claim, and this is the instrument that tests it: 45,295 more

**`scrutinise-web/scripts/measure-s14-merge.ts`**

- L147 — `4,096` — * degenerate into writing an endless decimal and blow the 4,096-token ceiling on **12 of 55 calls

**`scrutinise-web/scripts/probe-three-acts.ts`**

- L4 — `1824` — * WHY IT EXISTS. `docs/GOLD_CANDIDATES_V2.md` records the Vagrancy Act 1824, the Housing Act 1996

**`scrutinise-web/scripts/render-documents.ts`**

- L21 — `3153` — const IDEA = process.argv[2] ?? '452c5ade-3153-400a-bf48-3b71aaa52773'

**`scrutinise-web/scripts/s18-costing-questions.ts`**

- L95 — `9949`, `1206` — + 'provision £ 1.3m -£ 9949.8m £ 1206.8m"` — and WHICH of those three is the EANDCB is not '

**`scrutinise-web/scripts/seed/seed-editorial-ideas.ts`**

- L490 — `60,000` — "HM Courts and Tribunals Service data shows the criminal courts backlog remains at historically high levels (over 60,000 Crown Court cases as of 2024). Remote hearings we

**`scrutinise-web/scripts/seed/seed-historical-kernels.ts`**

- L762 — `250,000`, `300,000` — impactDescription: 'The CBI estimated planning delays cost the UK economy £20 billion per year in deferred investment. NSIPs were taking an average of 4.7 years from appl

**`scrutinise-web/scripts/v36-verify-recovered.ts`**

- L11 — `7,354` — * rank 1 in the V37 citation audit (7,354 references), it was the row whose 5-minute

**`scrutinise-web/scripts/verify-25w-decision-survival.ts`**

- L235 — `1000` — `${row?.estCostPence}p ${row?.startedAt && row?.completedAt ? Math.round((row.completedAt.getTime() - row.startedAt.getTime()) / 1000) + 's' : ''}` +

**`scrutinise-web/scripts/verify-citations.ts`**

- L139 — `24925`, `0002` — // `committees-reports:publication:24925:arc-0002` carry an archive document key.

**`scripts/attic/v17-fleet/worker-queue.ts`**

- L174 — `1000` — setTimeout(() => reject(new Error(`row timeout after ${ROW_TIMEOUT_MS / 1000}s`)), ROW_TIMEOUT_MS)

**`scripts/attic/v18-verification/diag-v18-caselaw-check.ts`**

- L7 — `74,730`, `75,050` — console.log('caselaw sections:', s.rows[0].n, '(was 74,730 before tail seed; TNA total ~75,050)')

**`scripts/attic/v18-verification/diag-v18.ts`**

- L7 — `1501` — * 3. tna-caselaw pre-V4 overhang rows (page > true last page ~1501).

**`scripts/attic/v19-verification/v19-diag-fails3.ts`**

- L9 — `70,040` — await pool.query(`UPDATE ingest_queue SET status='skipped', "lastError"='V19: page beyond live extent (LDA pages are 0-indexed; 0-140 covers 70,040 records)' WHERE id='ld

**`scripts/attic/v19-verification/v19-drop-si-relics.ts`**

- L10 — `1156` — console.log(`si-pre-2010 FINAL: ✓ ${m.rows[0].c} compiled, classified residue ${m.rows[0].res} (uksi/1958/1156 metadata-only)`)

**`scripts/attic/v19-verification/v19-seed-lda-tail.ts`**

- L5 — `70,040` — // 70,040 live records / 500 per page = 141 pages; new records append at the

**`scripts/attic/v20-verification/v20-cleanup-mislabeled-govuk.ts`**

- L9 — `1,944` — * with no org filter → 1,944 unrelated documents (DVLA accounts, ET decisions,

**`scripts/graph/audit-3c-scoring.ts`**

- L318 — `13,448` — // "is it a distribution" question is about the 2.3M-row estimate table (3 → 13,448, see

**`scripts/graph/probe-3b-perf.ts`**

- L10 — `2,317,523` — * condition into a computed column, so it materialises all 2,317,523 signals and then throws away

**`scripts/graph/probe-3c-rules.ts`**

- L102 — `5,645` — console.log(`\n════ 1 · BREADTH — divisions tagged free-vote-like, of 5,645 ════`)

**`scripts/graph/probe-3c2-speech2.ts`**

- L4 — `6,391,345`, `5,693,886` — * Part 1 established that `pwdata-debates` (6,391,345 rows, 5,693,886 with a speaker) and

**`scripts/ingest/c2/b3-partial-census.ts`**

- L13 — `249,256` — * ⚠ NOBODY HAS EVER COUNTED THIS POPULATION. `section_repeals` holds 249,256 rows and every one

**`scripts/ingest/c2/l2-dotmiss.ts`**

- L4 — `1,563,090`, `1,780,445`, `12,642` — * The census scanned 1,563,090 of 1,780,445 legislation sections. 12,642 unflagged rows sit at

**`scripts/ingest/c2/l2-dotscale.ts`**

- L10 — `1,563,090`, `1,780,445`, `217,355` — *     1,563,090 of 1,780,445 read — 217,355 legislation sections never looked at.

**`scripts/ingest/c2/l2-dotsig.ts`**

- L6 — `178,826` — * Q2: does the signature find rows the 178,826 census MISSED?

**`scripts/ingest/c2/l2-et-503.ts`**

- L4 — `131,147`, `131,650` — * C1 measured 131,147 of 131,650 landing pages already have the real judgment PDF ingested

**`scripts/ingest/c2/l2-et-unretire.ts`**

- L7 — `161,749` — * `et-decisions` collection — including the 161,749 judgment PDFs that were kept

**`scripts/ingest/c2/l2-item8-proof.ts`**

- L6 — `2,089` — * too — `itemDate` and `sectionTitle` are NULL on all 2,089 rows.

**`scripts/ingest/c2/l2-measure2.ts`**

- L33 — `131,147`, `131,654` — // ITEM 1 — C1 claimed 131,147 of 131,654 landing pages already have the real PDF alongside.

**`scripts/ingest/c2/ots-filter.ts`**

- L18 — `347,938`, `347,938` — * that query reports **total: 347,938**. We took the first 500 of 347,938 gov.uk pages ranked by

**`scripts/ingest/c3a/et-orphans-refetch.ts`**

- L23 — `131,147` — * the same code that ingested the other 131,147 judgments. Writing a private fetcher here would

**`scripts/ingest/c3a/lords-archive.ts`**

- L261 — `2,820` — * all 2,820 pages it rejects 11 of 20 for the absence of something a continuation page never has.

**`scripts/ingest/c3a/sweep-lance-predicates.ts`**

- L72 — `168,569` — [`"id" = 'x'`, true, 'the exact form that matched 0 of 168,569 rows in the C3 dry run'],

**`scripts/ingest/caselaw-text/measure-embed-delta.ts`**

- L8 — `22,240`, `2,000`, `3,400` — * first ~22,240 characters of any judgment are ever embedded. A 2,000–3,400-character stylesheet

**`scripts/ingest/caselaw-text/probe-query-speed.ts`**

- L25 — `1000` — console.log(`${((Date.now() - t) / 1000).toFixed(2)}s  ${r.rowCount} rows  ${label}`)

**`scripts/ingest/caselaw-text/verify-recompile-coverage.ts`**

- L4 — `2,000`, `38,500` — * The re-compile ran in three pieces: a 2,000-row pilot, a run that was killed at 38,500, and a

**`scripts/ingest/caseref/citations.ts`**

- L199 — `74,896` — * 74,896 judgments to fix a string.

**`scripts/ingest/census/a5-worklist-pilot.ts`**

- L11 — `7,924`, `41,913` — * fix, and this pilot must exercise it, because 7,924 of the 41,913 worklist entries carry exactly

**`scripts/ingest/census/b/check-email.ts`**

- L116 — `4,681`, `4,682` — // ⚠ The real case that prompted this assertion: 4,681 of 4,682 rounds to "100.0%" at one decimal

**`scripts/ingest/census/b/sweep-remaining.ts`**

- L14 — `78,310` — * "we hold 78,310 documents, and we do not know what fraction of the universe that is" is a true

**`scripts/ingest/census/build-corpus-scope.ts`**

- L53 — `348,062` — 'ots-reports': 'Publications of the Office of Tax Simplification. The OTS was abolished in 2023, so the universe is CLOSED AND FINITE: **222 documents**, by the publisher

**`scripts/ingest/check-entity-decode.ts`**

- L7 — `140,567` — * numeric form of the same character, and that one omission damaged 12% of a 140,567-document

**`scripts/ingest/entity-decode-fix.ts`**

- L122 — `18,272,362` — // From entity-decode-census.json's extrapolation: 1.01% of 18,272,362 compiled documents.

**`scripts/ingest/graph/audit-25h-citations.ts`**

- L175 — `2,431`, `132,990` — * so silently skips every REGNAL-year document: 2,431 of 132,990 entries,

**`scripts/ingest/graph/audit-4a-t2-hole.ts`**

- L106 — `1000` — if (docs % 400 === 0) console.log(`  ${docs}/${skipped.length} docs, rows=${rows}, ${((Date.now() - t0) / 1000).toFixed(0)}s`)

**`scripts/ingest/graph/audit-4a-t3-spans.ts`**

- L5 — `93,772` — * 25-H counted 93,772 act-name spans that resolved to no instrument (6.6% of

**`scripts/ingest/graph/audit-4b-layer2.ts`**

- L14 — `230,681` — *      230,681 rows `legislation_edges` holds.

**`scripts/ingest/graph/audit-g5-citation-forms.ts`**

- L217 — `1,160` — console.log(`  at 1,160 bytes/row (measured on citation_edge) = ${projectedGB.toFixed(2)} GB = $${(projectedGB * 0.35).toFixed(2)}/month`)

**`scripts/ingest/graph/check-graph5-case-edges.ts`**

- L128 — `2,499` — //   ~2,499 false misses (0.44%) — comparing a raw string to a collapsed one. The passage really

**`scripts/ingest/graph/check-graph5-citation.ts`**

- L12 — `1,288,630` — * rows written having written 1,288,630 — a lost-update race on the counter, not on the data. A

**`scripts/ingest/graph/coverage.ts`**

- L148 — `1,288,630`, `1,479,888`, `191,258` — // absorbed 1,288,630 case-law rows and reported 1,479,888 where the truth is 191,258.

**`scripts/ingest/graph/extract-enabling-edges.ts`**

- L18 — `230,681` — * `legislation_edges` holds 230,681 `made-under` rows and **has no text column

**`scripts/ingest/graph/extract-inforce-edges.ts`**

- L8 — `1235` — * ~2002 — repeals of/by older instruments (back to 1235) exist ONLY here. Rows

**`scripts/ingest/graph/extract-madeunder-edges.ts`**

- L55 — `230,681` — * 230,681 `made-under` rows this file wrote in July.

**`scripts/ingest/graph/probe-t3-check.ts`**

- L16 — `0,180` — for (const p of d.instrument_allocation.powers) console.log(`  ${p.power_provision_ref ?? '(none named)'} — ${p.instrument_count} instrument(s); power text: ${(p.power_te

**`scripts/ingest/graph/probe-zip-dupes.ts`**

- L1 — `133,361`, `130,096` — /** probe-zip-dupes.ts — 133,361 entries but 130,096 gids. Which gid has more than

**`scripts/ingest/graph/report-b4-markup.ts`**

- L175 — `3,237` — md.push(`\| T5 (brief §6) \| \`text\` (19 of 20 rows) \| 20 of 20 \| 20 rows stratified by measure, from 3,237 \|`)

**`scripts/ingest/graph/report-b5-register.ts`**

- L127 — `1854` — reasoning: '⚠⚠ THE WORKSTREAM MAY BE AIMED AT AN INSTRUMENT HE HAS NOT NAMED. WS-05 is built on CRAG 2010 Part 1, which puts the civil service on a statutory footing. Wha

**`scripts/ingest/impact/audit-1-retention.ts`**

- L70 — `1,234` — /** Every numeric token of 1+ digits, commas and decimals kept, so 1,234.5 is one token not three. */

**`scripts/ingest/impact/audit-4-pir.ts`**

- L9 — `1,186` — * publisher's own `ukm:DocumentStage` says **73** of 1,186 deposits are `Post Implementation`.

**`scripts/ingest/impact/audit-6-duplicates.ts`**

- L2 — `1,169` — * audit-6-duplicates.ts — 463 of 1,169 held ids share a body with another id. Is that GENUINE

**`scripts/ingest/names/measure-css-pollution.ts`**

- L18 — `74,896` — * 74,896 documents and rebuilding the index, which is a sprint, not a footnote.

**`scripts/ingest/names/names-pool.ts`**

- L6 — `344,773` — * here: a `COUNT(*)` over the 344,773 `committees-reports` rows of a 15-million-row table, run

**`scripts/ingest/ops/delete-legacy-db.ts`**

- L9 — `1,251,338`, `2,029` — // live rows for all 68 tables**. The real counts are **1,251,338 rows over 2,029 MB**,

**`scripts/ingest/ops/dump-legacy-db.ts`**

- L6 — `1,251,182`, `2,029` — // **1,251,182 rows over 2,029 MB**, including 29 Users and 54 Ideas from before the Neon

**`scripts/ingest/ops.ts`**

- L305 — `108,349` — //    0 delta ≠ 0 output) — it parked 108,349 legitimate rows. Counting the

**`scripts/ingest/position-graph/claims-bottomup.ts`**

- L438 — `1,920`, `1,933` — * reported 1,920 of 1,933 claims as "not covered by the 83" when 60 of the 83 were never put to a

**`scripts/ingest/position-graph/extract-positions.ts`**

- L24 — `226,000` — *    manufacture ~226,000 rows of "did not mention" that nobody asked anybody.

**`scripts/ingest/position-graph/handcheck-2d2.ts`**

- L16 — `4131` — *   MNIS 4131 Jim Shannon — the highest-volume EDM sponsor in the corpus (934 motions). If

**`scripts/ingest/position-graph/handcheck-edm-signatures.ts`**

- L16 — `39066`, `60227` — *   npx tsx position-graph/handcheck-edm-signatures.ts --motions 39066,60227

**`scripts/ingest/position-graph/match-registers.ts`**

- L222 — `1000` — console.log(`\n  ── ${f.register} — ${scanned.toLocaleString('en-GB')} register rows scanned in ${Math.round((Date.now() - t0) / 1000)}s ──`)

**`scripts/ingest/position-graph/migrate-edm-signatory-order-int.ts`**

- L12 — `44477`, `294739` — * order was recorded (motion 44477, signature 294739, read live) and the first --apply pilot died on

**`scripts/ingest/position-graph/probe-amd2d.ts`**

- L82 — `3296` — head('3. ⚠ MNIS 3296 — a Lords Spiritual record covering 1999-2002 with how many votes?')

**`scripts/ingest/position-graph/probe-born-dates.ts`**

- L6 — `5162` — * first nameHistory row starts 1956-10-01, which is Theresa May's birthday. For MNIS 5162 the

**`scripts/ingest/position-graph/probe-edm-quota.ts`**

- L68 — `60,995` — console.log(`\n   projected sweep of 60,995 motions at ${(spent / mins).toFixed(1)}/min, with a`)

**`scripts/ingest/position-graph/qualify-pass.ts`**

- L138 — `16034` — * Position 16034's condition quote came back BYTE-IDENTICAL to the passage the position was recorded

**`scripts/ingest/position-graph/resolve-offices-posts.ts`**

- L125 — `6,512` — console.log(`\n  compare 2D-3's attempt on graph_member_name: 1 office of 6,512 surfaces.`)

**`scripts/ingest/position-graph/setup-surface.ts`**

- L64 — `164,131` — console.log(`    so the 164,131-row graph_edge is not rewritten by the boolean's DEFAULT FALSE.`)

**`scripts/ingest/position-graph/signal-behaviour.ts`**

- L14 — `2,528,032` — * so this is a query, not a new source. `division_votes` holds 2,528,032 rows: the most concrete

**`scripts/ingest/position-graph/sweep-edm-sponsors.ts`**

- L4 — `60,737` — * `corpus_sections.speaker` already carries the sponsor's display name on all 60,737 EDM rows, so

**`scripts/ingest/position-graph/sweep-interests.ts`**

- L43 — `3,415` — // 695 of 3,415 interests (20.4%) and reported every one of them as a success. Nothing errored;

**`scripts/ingest/position-graph/sweep-posts.ts`**

- L9 — `6,512` — * OFFICE was held.** One surface of 6,512 qualified as an office and it scored 63.8% against ground

**`scripts/ingest/position-graph/text-2d3.ts`**

- L15 — `5,322`, `5,212` — * documents: **24 (12.0%) contain at least one, 5,322 occurrences** — `&#xa0;` (5,212), `&#x2011;`

**`scripts/ingest/position-graph/trial-checks.ts`**

- L49 — `16097` — * Scored over the 50 hand-read positions it produced the rule's ONLY false positive — #16097,

**`scripts/ingest/s3-amendment-target-check.ts`**

- L4 — `3,856`, `3,857` — * The shortfall triage said 3,856 of 3,857 orphaned legacy sections are real text, which

**`scripts/ingest/s3-drop-safety-sample.ts`**

- L5 — `5,106`, `37,154` — *   1. per-instrument counts        → 5,106 instruments "short", ~37,154 sections behind

**`scripts/ingest/s3-refformat-check.ts`**

- L4 — `3,856`, `3,857` — * `s3-shortfall-triage.ts` reported 3,856 of 3,857 orphaned legacy sections as REAL

**`scripts/ingest/search/backfill-citations.ts`**

- L57 — `135,531`, `250,808` — * distinct gid→title, `corpus_acts` has 135,531 titled rows (of 250,808 — a SUPERSET), 0 gids

**`scripts/ingest/search/build-act-metadata.ts`**

- L33 — `331,124`, `26,172` — *  331,124 sections across 26,172 instruments. Omitting it makes this table report

**`scripts/ingest/search/check-index-coverage.ts`**

- L7 — `1,478,964`, `22,670,808` — * 1,478,964 rows — 6.5% of 22,670,808 — had fallen outside it, because a LanceDB index covers only

**`scripts/ingest/search/citation-resolver.ts`**

- L12 — `135,531` — * The act-title→gid map comes from `corpus_acts.title` (135,531 titled rows),

**`scripts/ingest/search/corpus-map.ts`**

- L35 — `18,756` — // its 18,756 sections (94.7%) carry a `parentDocId` naming the instrument they assess, which is

**`scripts/ingest/search/embed-observer.ts`**

- L355 — `000851`, `12000` — chk('detectFailure no signal → null', detectFailure('shard-000851 done (12000 vec, 0 miss)') === null)

**`scripts/ingest/search/fts-catchup.ts`**

- L12 — `1,172,169` — * partial gaps in 20 other corpora (1,172,169 rows total — see

**`scripts/ingest/search/fts-optimize.ts`**

- L39 — `16,509,051` — * fragments, which is exactly how the live index was built (2026-06-20: 16,509,051 rows

**`scripts/ingest/search/fts-railway-run.ts`**

- L51 — `5000` — // the SDK's 50 default throttles us) AND request 256-way fetch concurrency + 5000-row

**`scripts/ingest/search/gemini-batch.ts`**

- L243 — `3,200` — // job splitting: 12k chunks of 3,200 chars (800 est tok) = 9.6M tok → sub-jobs each

**`scripts/ingest/search/gold-draft-streams.ts`**

- L193 — `3552` — //   vehicles." — the RTRA 1984 provision applying the Schedule 6 limits; and uksi/2014/3552,

**`scripts/ingest/search/measure-legislation-truncation.ts`**

- L55 — `22,240` — /** Rows below this cannot reach the 22,240-char cap unless chars/word exceeds ~14.8, which no

**`scripts/ingest/search/measure-vector-load.ts`**

- L24 — `25000` — *   tsx search/measure-vector-load.ts [--users=2] [--rounds=5] [--timeout-ms=25000]

**`scripts/ingest/search/measure-vector-substrate.ts`**

- L114 — `3,072` — console.log(`    ⚠ COMPRESSION vs raw f32: ${ratio.toFixed(1)}x  → ${(m.total / rows).toFixed(0)} bytes per vector, against 3,072 raw`)

**`scripts/ingest/search/probe-committee-reports.ts`**

- L6 — `2,575` — * correspondence and only 10.4% ("Report:", 2,575 rows) the substantive inquiry reports that

**`scripts/ingest/search/probe-committee-yield.ts`**

- L9 — `165,443` — * committees-reports + committees-evidence = 165,443 rows — **1.17% of the parliamentary tier**.

**`scripts/ingest/search/score-stream-fusion.ts`**

- L165 — `1,191,345`, `19,161` — md.push(`> the 4 Aug coverage fix (1,191,345 rows merged) and the 5 Aug dedup (19,161 rows removed, which`)

**`scripts/ingest/search/vec-replace.ts`**

- L38 — `70,890`, `22,689,587` — * `written-statements` 994 = **70,890 of 22,689,587 — 0.31%, two shards of 568.**

**`scripts/ingest/search/vector-serve-run.ts`**

- L314 — `4,096` — * RECALL for latency: S2C5 measured 24 probes of 4,096 returning **70.4%** of what the same index

**`scripts/ingest/seed-committees-api-queue.ts`**

- L89 — `15,809`, `142,397` — // WrittenEvidence walk wrote evidence est=15,809 instead of 142,397).

**`scripts/ingest/seed-committees-queue.ts`**

- L13 — `9,959` — * Compared to one row per publication (9,959 rows) this reduces queue churn.

**`scripts/ingest/shared/akn-text.ts`**

- L20 — `11,830` — *       <judgmentBody>                           ← offset 11,830  the judgment

**`scripts/ingest/shared/caselaw-name.ts`**

- L26 — `3,000` — * compiled document opens with ~3,000 characters of embedded CSS before the first word of the

**`scripts/ingest/shared/html-entities.ts`**

- L99 — `1252` — * These references come from documents authored in Windows-1252, where 145 and 146 are the curly

**`scripts/ingest/shared/r2-client.ts`**

- L75 — `74,896` — * have moved ~7 GB for a 74,896-row backfill. A Range GET moves ~2 GB less than 2% of that and

**`scripts/ingest/sources/bills-parliament.ts`**

- L34 — `6,574` — * internal id and an ordinal. So all 6,574 rows carried no bill NAME, and `itemDate` was left

**`scripts/ingest/sources/committees-api.ts`**

- L132 — `4,191` — // of 4,191 and silently returns a TRUNCATED year rather than an error. Adding

**`scripts/ingest/sources/committees-archive.ts`**

- L5 — `3,935` — * special-report publications and serves a downloadable `documents[]` for only 3,935 of them.

**`scripts/ingest/sources/committees-portal.ts`**

- L194 — `5,212` — // `Barbara&#xa0;Rayment` was written to R2 verbatim, 5,212 times in a 200-document sample.

**`scripts/ingest/sources/gov-scraper.ts`**

- L93 — `3,983` — * 3,983 rows we hold did not come from here. `fca-publications` is retired and blocked in

**`scripts/ingest/sources/scottish-courts.ts`**

- L19 — `13,066` — * Universe (measured 19 Jun 2026): pagination.count.total = 13,066 judgments.

**`scripts/ingest/sources/senedd-cofnod.ts`**

- L189 — `1,609`, `2,915` — // heading on 1,609 of 2,915 judged contributions — 55.2%.

**`scripts/ingest/v19-seed-fcl-tribunals.ts`**

- L7 — `2,686`, `4,325` — * newest entries (corpus held eat 787 / ukut 2,686 / ukftt 4,325 / ukpc 700 /

**`scripts/ingest/v20-seed-writtenevidence-list.ts`**

- L6 — `2,700`, `126,589` — * The API cut the local IP's WrittenEvidence walk at ~2,700 of 126,589 across

**`scripts/ingest/v22-probe-echr.ts`**

- L5 — `244851` — * Takes an itemid (default: 001-244851, HORA v UK judgment 2025), runs the

**`scripts/ingest/v22-repairs.ts`**

- L6 — `12,732` — * 500s). Item-row processing was never the problem (12,732 done before the

**`scripts/ingest/v22-seed-judiciaryni-list.ts`**

- L46 — `5,900` — console.log('[targets] ni-judgments est restored to ~5,900 (unconfirmed)')

**`scripts/ingest/v22-seed-writtenevidence-windows.ts`**

- L11 — `16,393` — * ≤ ~2k items (peak year 2025 = 16,393); one row walks one window.

**`scripts/ingest/v23-devolved-placeholders.ts`**

- L15 — `200000` — key: 'senedd-cofnod', est: 200000, label: 'Senedd Cofnod / Record of Proceedings (1999-)',

**`scripts/ingest/v25-seed-bills.ts`**

- L81 — `3774` — `V25 §4: list:{billId} rows for ${all.length} bills → one section per publication PDF. OPL v3.0. est is the V21 placeholder; rebaseline at drain (per-PDF universe is much

**`scripts/ingest/v26-build-gaplist.ts`**

- L42 — `1000` — console.log(`   v26_nonmatch: ${(await pool.query(`SELECT count(*)::int n FROM v26_nonmatch`)).rows[0].n} rows (${((Date.now()-t0)/1000).toFixed(1)}s)`)

**`scripts/ingest/v26-failed-check.ts`**

- L1 — `1717` — /** v26-failed-check.ts — what are the 115 failed + 1717 pending rows? */

**`scripts/ingest/v26-normalize-explore.ts`**

- L41 — `1000` — console.log(`cs_gids: ${gidCount.rows[0].n} distinct docIds (${((Date.now()-t0)/1000).toFixed(1)}s)`)

**`scripts/ingest/v30-denominator-rebaseline.ts`**

- L5 — `914,274` — * and two corpora (legacy-legislation-section 914,274 rows, written-answers

**`scripts/ingest/v30-seed-scottish-or-pre2016.ts`**

- L47 — `1000` — console.log(`PREDICTION: ~${contentReports} content reports × ~${avgTurns} turns ≈ ${(contentReports * avgTurns / 1000).toFixed(0)}k sections / ~${(contentReports * avgWo

**`scripts/ingest/v31-seed-fcdo-treaties.ts`**

- L6 — `21,970`, `15,000` — * live 8 Jul 2026: 21,970 records — NOT the ~15,000 the brief/gov.uk estimate;

**`scripts/ingest/v32-acceptance-live.ts`**

- L16 — `455,137` — * each report was ONE document of up to 455,137 characters and BM25 length normalisation buried

**`scripts/ingest/v32-backfill-archive.ts`**

- L116 — `7,636` — * past 166 of 7,636 while looking entirely healthy.

**`scripts/ingest/v32-check-report-sections.ts`**

- L80 — `3,802` — // publication 275 of 3,802. docs/CLAUDE.md §13 lists the class; this pins the fix.

**`scripts/ingest/v32-committees-phrase-check.ts`**

- L82 — `1000` — if (read % 500 === 0) process.stdout.write(`\r   …${read}/${rows.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)

**`scripts/ingest/v32-enumerate-committees.ts`**

- L13 — `3700`, `4,191` — * the busy years (2018 died at skip=3700 of 4,191) and returns a TRUNCATED YEAR RATHER THAN AN

**`scripts/ingest/v33-neon-reclaim-indexes.ts`**

- L49 — `48,664` — why: '268 distinct values on 48,664 non-null rows — indexing 18.3M rows to find 48k. It does get used (11 scans), so it is REPLACED by a partial index on the same column 

**`scripts/ingest/v33-probe-pathological.ts`**

- L69 — `3,666` — console.log('\n=== C. the candidate set: legislation-tier rows over the ~3,666-word cap ===')

**`scripts/ingest/v34-seed-division-votes.ts`**

- L82 — `1000` — console.log(`  enumerated (unique ids)  : ${res.entries.length} over ${res.pages} pages in ${Math.round((Date.now() - t0) / 1000)}s`)

**`scripts/ingest/v35-verify-chunk-tiers.ts`**

- L9 — `95,044` — * 95,044 chunks, and no router stream selects `other`. The rows would be embedded, paid for, and

**`scripts/ingest/v36-check-drain-health.ts`**

- L30 — `2,000` — // an instrument is one queue row and anywhere from 1 to 2,000 sections.

**`scripts/ingest/v36-check-pdf-probe.ts`**

- L9 — `117,667` — * some point, because 117,667 instruments carry `pdf-only` and a random sample of

**`scripts/ingest/v36-classb-timing.ts`**

- L28 — `1000` — console.log(`\n=== ${label} ===  (${((Date.now() - t) / 1000).toFixed(1)}s, ${rows.length} rows)`)

**`scripts/ingest/v36-gap-analysis.ts`**

- L26 — `1000` — console.log(`\n=== ${label} ===  (${((Date.now() - t) / 1000).toFixed(1)}s, ${rows.length} rows)`)

**`scripts/ingest/v36-reconcile.ts`**

- L116 — `146,372` — // it on the list would re-fetch 146,372 instruments to re-learn what we know.

**`scripts/ingest/v36-retry-churn-probe.ts`**

- L12 — `39,964` — * becomes a real `failed` — which is how 39,964 rows were parked on 12 Aug.

**`scripts/ingest/v36-unavailable-census.ts`**

- L32 — `1000` — console.log(`\n=== ${label} ===  (${((Date.now() - t) / 1000).toFixed(1)}s, ${rows.length} rows)`)

**`scripts/ingest/v37-repeal-census.ts`**

- L7 — `171,700` — * grounds for flipping 171,700 rows, so this reads every compiled legislation object

**`scripts/ingest/v38-orphan-census.ts`**

- L27 — `47,427` — * as `ukpga/Geo5/15-16/20`. The first run's headline of 47,427 was inflated by that whole class.

**`scripts/legislation/v276-bulk/phase3a-patch-gaps.ts`**

- L4 — `1,677` — * FULL_INGEST: Companies Act 2006 — create 1,677 LegislationSection rows, upload P1group XML to R2.

**`scripts/legislation/wipe-r2-partial.ts`**

- L91 — `1000` — // Delete in batches of 1000 (S3 API limit)

**`scripts/operational/cop-app-ingest.ts`**

- L6 — `2,194` — *   Raw crawl: 2,194 entries (includes fragment-URL and exact duplicates)

**`scripts/ops/heavy-job/run.ts`**

- L367 — `1024` — if (peakMb) log(`PEAK RSS: ${(peakMb / 1024).toFixed(1)} GB — record this in jobs.ts expectedPeakGb`)

**`scripts/starkey/b10-candidates.ts`**

- L528 — `1,713` — // also says a missed candidate is a hole in a printed document, and 1,713

**`scripts/starkey/b9-quote-concentration.ts`**

- L325 — `1220` — `select count(*)::int n from starkey.passage where video_id='EMbRv6aaQrs' and start_s > 1220`)).rows[0].n

**`scripts/stats/generated/stats-client/index.d.ts`**

- L5241 — `2,925`, `3,404` — * `sourceSeriesId` is null (which it is for 2,925 of 3,404 series) — without it the natural

**`scripts/stats/lib/iso.ts`**

- L69 — `3166` — // Devolved (ISO-3166-2:GB) — no rows yet, but the column supports them.

**`scripts/stats/query/stats-query.ts`**

- L93 — `3166` — * ISO-3166 alpha-2 (see lib/iso.ts), so the UK's own rows sit under the SAME `GB` geography

**`scripts/stats/sources/imf.ts`**

- L97 — `65,985` — * Measured 2026-08-04: the full key below returned HTTP 200, 52.8 MB, 65,985 rows in 38.6 s —

**`scripts/stats/sources/world-bank.ts`**

- L40 — `1,000` — { code: 'SP.DYN.IMRT.IN', measure: 'infant_mortality_per_1000', unit: 'PER_1000', label: 'Mortality rate, infant (per 1,000 live births)', outcome: true },

</details>
