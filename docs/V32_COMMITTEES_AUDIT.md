# V32 — the committees content gap, audited

*7 Aug 2026. Executes the audit half of `BRIEF_INGEST_committees-content-gap.md` §1–2 and the
`_ADDENDUM` §A2, §A3, §C. **Read this before the build half of either brief — the audit changes
what the build is.** Nothing in the corpus has been written to; every number below is a
measurement, and the script that produced each one is named.*

---

## Summary

The brief rests on `GOLD_TEST_09`'s finding that committee report bodies "are stubs and front
matter, not report bodies". **That is not what the corpus contains.** The report bodies are
ingested, in full, and have been since 2020.

`GOLD_TEST_09` reached its conclusion from row *counts* — 2,575 rows across 2,511 distinct
titles, therefore "~1 row each, therefore stubs". The count is correct. The inference is not:
the committees ingest writes **one section per document**, so exactly one row per report is what
a *fully* ingested report looks like in this pipeline. Nobody measured the bytes.

The bytes say:

| | rows | median words | mean words | >10,000 words | <500 words |
|---|---|---|---|---|---|
| `Report:` | 2,575 | **7,524** | 12,122 | 993 | 9 |
| `Special Report:` | 667 | 5,476 | 6,869 | — | 2 |
| `Government Response:` | 600 | 3,006 | 5,117 | — | 32 |

The largest is 125,347 words. A stub is not 7,524 words.

**There is still a real gap, and it is a different one.** Three defects, each independently
sufficient to produce the symptom `GOLD_TEST_09` observed:

1. **A historical gap.** Report bodies effectively begin in **2020**. Before that the API lists
   the publication but serves no document. Carillion (May 2018) is missing for this reason —
   which is why every phrase drawn from it came back absent.
2. **One report is one search document.** Up to 455,137 characters in a single row. BM25 length
   normalisation buries it, so it never enters a depth-200 result set to be tested.
3. **PDF extraction keeps the PDF's line breaks.** The stored bytes contain
   `"…public \nhealth failures…"`, so the substring `"most important public health failures"` is
   *not present* even though the sentence is.

Defects 2 and 3 mean `GOLD_TEST_09`'s "all 10 phrases absent" was **partly a measurement
artefact**. Re-measured against the bodies directly, **5 of the 10 are already in the corpus**.

---

## 1. The ten phrases, re-measured

`v32-committees-phrase-check.ts` (`npm run check:committee-phrases`) reads the 3,842
report/response bodies straight from R2 and matches on whitespace-normalised text. It answers
*"is this phrase in the corpus"* — the ingest question. Retrievability is a separate question
with a separate fix.

| phrase | verdict | note |
|---|---|---|
| recklessness, hubris and greed | ❌ absent | Carillion 2018 — **historical gap** |
| hubris and greed | ❌ absent | same |
| rotten corporate culture | ❌ absent | same |
| cosy club | ❌ absent | same |
| most important public health failures | ✅ **present** | 2 docs — *invisible to a literal scan* |
| public health failures | ✅ **present** | 2 docs — *invisible to a literal scan* |
| gradual and incremental | ✅ present | 3 docs |
| unimaginable cost | ❌ absent | **never a report phrase** — see below |
| measurable difference | ✅ present | 2 docs |
| eye-watering | ✅ present | 26 docs |

Two things worth stating plainly.

**The two marked *invisible to a literal scan* are the proof of defect 3.** They are in
`Coronavirus: lessons learned to date` (68,522 words, held since Oct 2021). The stored bytes read
`"…rank as one of the most important public \nhealth failures the United Kingdom has ever
experienced."` The sentence is there. `GOLD_TEST_09`'s containment test could not see it.

**"unimaginable cost" was never in the report.** The PAC report it was attributed to —
`COVID-19: Test, track and trace (part 1)`, 8,013 words — *is* held, and contains "£37 billion"
but not that phrase. It appears to come from the Chair's press comment, not the report body. So
the honest denominator for the acceptance test is **9, not 10**: five already present, four
blocked on the historical gap.

---

## 2. What the source offers — and the acquisition route

`v32-committees-audit.ts` (`npm run audit:committees`) walks `/api/Publications` per type per
year.

> ⚠ **The type filter is not cosmetic, and this is a trap worth recording.** An *unfiltered*
> year walk 500s server-side partway through most years (2018 died at skip=3700 of 4,191) and
> **returns a truncated year rather than an error**. The first pass of this audit did exactly
> that and understated the gap. `listCommitteesApiPage` now takes a `publicationTypeId`; measure
> the source with it. A walk that quietly stops early reports a smaller gap than the real one.

| type | at source | downloadable from API | **archive-only** | neither |
|---|---|---|---|---|
| Report | 8,463 | 2,628 | **5,835** | 0 |
| Government Response | 1,559 | 620 | **937** | 2 |
| Special Report | 1,566 | 687 | **879** | 0 |
| **total** | 11,588 | 3,935 | **7,651** | 2 |

**Every single one has a URL.** `documents[]` is empty for pre-2020 items, but the same listing
item carries `additionalContentUrl` (the PDF) and `additionalContentUrl2` (the HTML) pointing at
`publications.parliament.uk`. Nothing is unreachable for want of a link.

**The gap is not only historical.** 2024 (95), 2025 (132) and 2026 (81) also have archive-only
reports — recent publications whose document has not been loaded into the API. A backfill keyed
purely on "pre-2020" would miss those.

### Getting the bytes: `publications.parliament.uk` is behind a bot challenge

Tested rather than assumed, and tested past the first 403 as `docs/CLAUDE.md` §0 requires:

| route | result |
|---|---|
| `fetch` + ingest UA | **403** "Just a moment…" (Cloudflare interstitial) |
| `fetch` + browser UA/headers | **403** — same |
| site root, both UAs | **403** — it is site-wide, not a path |
| `www.parliament.uk/globalassets` PDF | **403** — the other archive host too |
| headless Chromium (Playwright) | **403** "Performing security verification" |
| **real Chrome** (claude-in-chrome) | **200** — full report text |
| **Wayback Machine mirror** | **200** — full report text |
| `committees-api.parliament.uk` (control) | 200 — unaffected |

A real browser passes and headless does not, so this is bot fingerprinting, not an IP ban.

**The route taken is the Wayback Machine** (Charlie's call, 7 Aug). It is the only route that is
both programmatic and robust, it needs no evasion, and it was proven on the canonical missing
document: `web.archive.org/…/cmworpen/769/76903.htm` returns the Carillion report, and
`"recklessness, hubris and greed"` is in it.

### §C — coverage span

Commons, Lords **and** Joint committees are all present in every year, at source and in what we
hold. Nothing is silently dropped. Reports by house/category (source side): Commons/Select 4,050 ·
Lords/Select 1,483 · Joint/Select 532, plus smaller Other/General categories. The
`Commons/General`, `Lords/General` and `Lords/Other` buckets have **0 downloadable** — they are
entirely archive-only.

### §B/§D — the join keys exist

Every listing item carries what the ADDENDUM's data model needs, with no extra call:

- `businesses[].id` — **the stable inquiry id**, on **46.1%** of reports. Stated honestly: the
  other 54% genuinely are not inquiries (statutory-instrument reports, annual reports,
  "Documents considered by the Committee").
- `committee.name` / `.house` / `.category` — §D metadata and the §C span.
- `governmentResponses.publication[]` and `responseToPublicationId` — **the report ↔ response
  link, in both directions**, on 22.3% of reports.

---

## 3. §A2 and §A3 — answered

**A2 — government responses are already full bodies, not stubs.** 600 `Government Response` rows
at a 3,006-word median and 667 `Special Report` rows at 5,476 (a Special Report is usually how a
response is published). They carry the same historical gap as the reports: 937 + 879 archive-only.

**A3 — oral evidence is already full transcripts. No work needed.** 15,264 oral rows, **median
14,511 words**, 14,766 of them over 5,000 words, and **5** under 500. Written evidence is 125,303
rows at a 1,824-word median, which is the right size for a submission. This part of the brief can
be closed.

---

## 4. Reported, not acted on — the vector chunker truncates the whole corpus

Outside this brief's scope, found while measuring, and Charlie's call to defer (7 Aug).

`chunk.ts` caps at `MAX_CHUNKS = 8` windows ≈ 22,240 characters ≈ **3,370 words**. Anything
longer is silently dropped from the vector index. There is no warning and no counter.

- **242,957 sections** corpus-wide exceed it.
- **Only 59.4% of the corpus's body words ever reach the vector index.**
- For committee report bodies: **24.4%**. 1,931 of 2,575 reports are truncated.
- Worst affected: `tna-caselaw` 34.5% of words embedded, `quangos-govuk` 25.0%,
  `cma-cases` 24.8%, `uk-treaties` 13.4%.

`LEX_SEARCH_VECTOR` is OFF, so this is not currently serving users — but it is baked into the
index that a flag flip would switch on. Acting on it means a full re-embed and an index rebuild,
which is a decision of its own. **Recorded here as a known-unknown for the search thread.**

### ADDENDUM (7 Aug 2026) — "a full re-embed" is wrong, and the cost is ~3× lower than assumed

*Charlie's addendum brief challenged the full-re-embed premise. It does not survive contact with
the chunker. Corrected figures below; scripts `check-chunk-stability.ts`, `measure-chunk-topup.ts`.*

**Raising `MAX_CHUNKS` does not move a single existing chunk boundary.** `MAX_CHUNKS` appears in
`chunkBody()` in exactly one place — the loop condition `out.length < MAX_CHUNKS`. Every value
that determines *where* a boundary falls (`start`, `end`, the forward word-snap, the
`start = end - OVERLAP_CHARS` step) is computed without reference to it. Raising the cap
therefore lets the same loop run further; it does not re-cut what it already cut.

Verified rather than asserted, and **verified against the chunks actually stored** in
`corpus_chunks` rather than against a re-run of the function — so it also catches input drift
(a changed R2 body, a changed act title, a changed chunker), not just internal consistency:

> 225 sections (150 truncated + 75 control), 1,321 stored chunks re-derived from their R2 bodies
> at a cap of 64: **1,321 byte-identical, 0 mismatched.** Harness fidelity asserted on all 225
> (the parameterised copy of the algorithm reproduces `chunk.ts` exactly at cap 8).

**(a) The true incremental cost.** Modelled over the real `wordCount` histogram with the tail
stratified (>20k words in 5 bands — a single average over that heavy tail badly misprices exactly
the sections at issue), at a **measured** 6.05 chars/word (400 real bodies; `measure-corpus.ts`
assumed 6.30 — consistent). The model reproduces the current index to **0.4%** (predicts
21,921,361 chunks; `corpus_vec` holds 21,839,900), which is the check that it is describing this
corpus and not an idealised one.

| new cap | new chunks only | new tokens | still truncated | **incremental, batch** |
|---|---|---|---|---|
| 12 | 797,135 | 0.61 B | 159,682 | **$46** |
| 16 | 1,375,340 | 1.06 B | 121,447 | **$80** |
| 24 | 2,173,282 | 1.69 B | 76,920 | **$126** |
| 32 | 2,698,043 | 2.10 B | 52,913 | **$157** |
| 64 | 3,740,866 | 2.92 B | 8,337 | **$219** |
| none | 4,824,049 | 3.78 B | **0** | **$284** |

**Removing the truncation entirely costs $284 at the batch rate, not ~$600.** For contrast, a
genuine full re-embed at no cap is 10.47 B tokens = **$785**, of which **$501 would re-pay for
vectors that already exist and are still valid**. (That $501 also cross-checks the original
build's actual $430–520 spend.) Sensitivity to the one modelling assumption is small: at CPW
5.64–6.55 the cap-32 figure moves $146–$171.

Current state, for the record: **63.9%** of corpus body characters are embedded (the §4 figure of
59.4% was words-based), **227,758** sections are truncated on this model.

**(b) The FTS side needs nothing.** `build-fts-index.ts` stores **one row per section with the
whole body** — it never calls `chunkBody` and has no cap. The truncation is a vector-layer
artefact only. There is no FTS rebuild to do, incremental or otherwise.

**(c) Four things that WOULD shift boundaries — three are real and quantified.**

1. **47,845 sections have been recompiled since the chunk build** (`compiledAt` >
   `2026-07-06T06:02:58Z`, the `corpus_chunks` checkpoint). Their R2 bodies may differ from what
   was chunked, so their existing chunks are not guaranteed reproducible. **These must be
   re-chunked wholesale, not topped up.** 0.27% of the corpus.
2. **41,180 sections have never been chunked at all** — 17,681,740 compiled today vs 17,640,560
   at the checkpoint. They need full chunking + embedding, not a top-up.
3. **The citation header is prepended BEFORE chunking** on legislation-tier rows
   (`applyCitationToBody`, built from `LegislationItem.title`). A retitled act shifts *every*
   boundary in *every* section of that act. The sample found 0 drift, but `build-act-metadata.ts`
   ran on 4 Aug — **re-run `check-chunk-stability.ts` immediately before any top-up**, not just
   once now.
4. **The chunk geometry is env-overridable and is NOT recorded in the checkpoint.**
   `PILOT_WHOLE_CHARS` / `PILOT_WINDOW_CHARS` / `PILOT_OVERLAP_CHARS` are read from the
   environment; the checkpoint stores only phase/lastId/counts. A top-up run with different
   values than the original build would silently re-cut everything. **Pin them explicitly on the
   top-up run.**

Not a boundary shift, but a sequencing trap: **the per-finding re-chunk in §5 replaces committee
report sections with new ones.** Topping up before that runs pays to embed chunks for sections
about to be superseded. Do the re-chunk first, or exclude those corpora from the top-up.

**What this changes about the decision.** The deferral was recorded against "a full re-embed and
an index rebuild". The re-embed is really a **$284 append** (or $157 to fix 77% of it), plus a
vector index rebuild/merge, which remains the genuinely expensive half and is unchanged by this
correction.

Splitting committee reports per finding fixes it *for committees* without touching the shared
chunker, because each section then embeds whole.

---

## 5. The prediction, before the pass

`v32-predict-scale.ts` runs the real splitter over every held body, so this is a measurement of
the corpus rather than an average times a guess. Recorded here so it can be **scored** afterwards
(`feedback-predict-measure-commit`).

| | documents | → sections | tokens | embed cost (batch @ $0.075/M) |
|---|---|---|---|---|
| re-chunk what we hold | 3,842 | **78,776** (×20.5) | 62.3 M | **$4.68** |
| archive backfill | 7,651 | ~156,875 (projected) | 124.1 M | **$9.31** |
| **combined** | 11,493 | **~235,651** | 186.5 M | **$13.99** |

Net new `corpus_sections` rows from the re-chunk alone: **74,934**.

ADDENDUM §F anchored this at "low tens of dollars". The measured figure is **$13.99**, below that.
The projection for the backfill assumes pre-2020 reports resemble the ones we hold; they are older
and were generally shorter, so it is more likely an over- than an under-estimate.

---

## 6. What has been built, and what has not

**Built and verified:**

- `shared/report-sections.ts` — the per-finding splitter (base brief §3). Repairs the PDF
  line-break and justification-spacing defects; splits on the report's own numbered findings with
  a sequence guard; **losslessness is an enforced invariant, not an aspiration** — the split is a
  pure partition and `assertLossless` throws rather than write a partial report.
- `v32-check-report-sections.ts` (`npm run check:report-sections`) — **19/19 pass**, including
  four negative controls that exercise the *real* exported assertion (dropped / duplicated /
  edited section) rather than a copy of it, and a live pass over 120 real bodies. The fixtures
  caught a genuine bug: a body whose sentence punctuation did not survive extraction produced one
  indivisible 15,830-character section — the exact blob this work exists to break up. Fixed with
  a word-boundary oversize split, which is itself covered by a content-preservation assertion.
- `v32-committees-audit.ts`, `v32-committees-phrase-check.ts`, `v32-predict-scale.ts` — the
  measurement scripts behind every number above, all read-only and all re-runnable.
- `sources/committees-api.ts` — `publicationTypeId` on the listing walk (the truncation trap
  above), and the `additionalContentUrl` / `businesses` / `governmentResponses` / `committee`
  fields typed so the backfill and the metadata pass can use them.
- `v32-rechunk-reports.ts` — the writer. Dry-run by default, `--pilot N`, `--resume`, R2 before
  Neon, and an **attempted-vs-stored reconciliation** that reads its own writes back from both
  stores and exits non-zero on a mismatch (`feedback-built-inert-hides-write-bugs`: the last
  layer built inert had six real write-path bugs in a tsc-clean build, three reporting SUCCESS).
  Dry-run over 25 documents: 25 split, 0 lossy, 529 sections (×21.2).

**Built but DELIBERATELY NOT RUN.** `v32-rechunk-reports.ts --commit` has not been executed
against the corpus, and this is a considered stop, not an unfinished one. Base brief §6 is
explicit that the rows must be followed by the FTS catch-up **and the index merge** — *"appending
leaves rows searchable but un-indexed, brute-force scanned on every query forever — that is
exactly what produced the 26-second warm p50 in July"*. The merge is a heavy job (Hetzner,
measured 19.8 GB peak; never Railway, `docs/CLAUDE.md` §17) and could not be completed in the
same session. Landing 74,934 rows and retiring 3,842 blob rows while leaving the Lance index
holding the superseded blobs would put the corpus and its index out of step and repeat the exact
mistake the brief names. **The mutation and the index work should run as one operation.**

**NOT built — the remaining sprint:**

- The **Wayback backfill source** and its worker path for the 7,651 archive-only documents.
- The **§B/§D metadata pass** — inquiry id, committee name/house, report ↔ response linkage onto
  the rows.
- **FTS catch-up AND the index merge** (base brief §6 — the merge is a heavy job, never Railway,
  `docs/CLAUDE.md` §17), and **the embedding run** (§7), which is gated on the $13.99 above.
- The §E loop test (Carillion evidence + conclusions + government response under one inquiry id)
  — it cannot pass until the backfill lands.

`tsc --noEmit` is clean across `scripts/ingest` (the four pre-existing baseline errors in
`diag-db.ts`, `run-cleanup.ts`, `test-fca-playwright.ts`, `v26-pooled-smoke.ts` are unchanged).
Nothing has been committed — no mid-sprint git, per `docs/CLAUDE.md` §12.

---

## 7. What this means for `GOLD_TEST_09` and the candidate questions

`GOLD_TEST_09`'s **D3** asked whether committee reports are ingested, and treated the answer as
deciding whether its three candidate questions were the right shape. The answer is: **reports
have been ingested since 2020, and were not findable for reasons unrelated to ingestion.**

That does not make CQ1–CQ3 wrong — they test what evidence was *put to* a committee, which the
corpus genuinely holds and holds well. It does mean the report is now available to draft
*conclusion*-shaped questions against, for 2020 onwards today and for 2005 onwards once the
backfill lands. The two structural findings `GOLD_TEST_09` got right and this audit does not
disturb: the harness is not scoped to the committee corpora (D1), and every committee subject is
also a Chamber subject in an 85×-larger corpus.

The live post-filter → prefilter issue (D2) was **already fixed by the search thread** on 6 Aug
(`CHANGE_LOG`, "SEARCH — committees is scoped at the query, not after it"), which is worth noting
because the base brief still lists it as outstanding and warns against touching it.
