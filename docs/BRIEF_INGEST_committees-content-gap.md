# BRIEF FOR CC (INGEST THREAD) — close the committees content gap

**Written:** 2026-08-06, from Charlie's brief given in conversation. Written to disk *before*
starting, per `SEARCH_STRATEGY v3` §1.8 — a sprint brief handed over verbally is a sprint brief
that can be lost. **Not started.** Nothing below has been audited, built or run yet.

> **Read first, before the audit:** `docs/CHANGE_LOG.md` § "Committees cannot be fixed with better
> questions — `GOLD_TEST_09`" (commit `6e80d00`). The search thread has already done the read-only
> diagnosis this brief rests on — do not repeat it, start from it.

## Background

`GOLD_TEST_09` found the committees corpus is **71.6% correspondence, 10.4% "Report:"**, with
substantive report content present only as one-line stub rows: **2,575 report rows across 2,511
distinct titles — roughly one row per inquiry.** Ten phrases drawn from real committee conclusions
were tested and **none** were found, including "recklessness, hubris and greed", which a 2020
Hansard debate quotes *verbatim from the report* — proving the report's own text is not in our
database.

This is an **ingestion gap, not a search-quality problem.** No amount of query tuning fixes missing
content. Corroborating evidence from the same probe: `CM1` scores 100% while returning **0/20**
committee documents — its answer key is satisfied entirely by Hansard debates *about* Carillion, so
the stream's apparently perfect score is a measurement not attached to committees at all.

## Audit first — bytes before hypotheses (`docs/CLAUDE.md` §13)

1. **Establish exactly what the current ingest pulls per inquiry, and from where.** Is it a
   listing/metadata page (title + one-line summary) rather than the full report document? Show the
   actual fetched bytes for a named inquiry, not a reading of the code.
2. **Establish whether the FULL report text is available from the source** — findings, conclusions,
   recommendations — as a distinct document/PDF/HTML page the current ingest simply doesn't follow
   through to, or whether it needs a different acquisition route entirely.
   **Source-access priority as always: bulk download → scraping → API.**

## Build

3. **Extend/rebuild the committees ingest to pull the full report bodies**, chunked at a sensible
   granularity — **per finding/section**, mirroring how debates are chunked per contribution. Not
   one giant blob per inquiry.
4. **Report the expected scale (row-count increase) BEFORE running the full pass**, per the
   project's standard predict-then-measure discipline. Record the prediction so it can be scored.
5. **Run it, then confirm coverage:** spot-check that the same ten "missing conclusion" phrases from
   `GOLD_TEST_09` are now actually present. That is the acceptance test — not a row count.

## Downstream — do not repeat the July mistake

6. **After the rows land in `corpus_sections`: run the FTS catch-up AND FOLD THE NEW ROWS INTO THE
   INDEX.** Appending leaves rows searchable but un-indexed, brute-force scanned on every query
   forever — that is exactly what produced the 26-second warm p50 in July. See
   `INGEST_PLAYBOOK.md` §20 (and its 5 Aug addendum: `fts-catchup.ts` now *announces* the resulting
   index debt, and writes `.fts-index-debt.json`). The merge is a heavy job — **never Railway**,
   `docs/CLAUDE.md` §17.
7. **Run the embedding pipeline on the new rows** — `gemini-embedding-001` @768d, same chunking
   discipline as the rest of the corpus.
8. **Hand back to the search thread** once both are done, so committees can be re-tested against
   real content.

## Notes for whoever picks this up

- **Cost gate.** Step 7 is real spend. Size the embedding run and report it before spending; the
  standing gate on the full-corpus embed was ~$600 and this is a fraction of that, but the number
  should be stated, not assumed.
- **Related, deliberately out of scope.** `GOLD_TEST_09` also found the live committees stream
  *post*-filters `types:['COMMITTEE']` over the whole 14.17M-row parliamentary tier instead of
  prefiltering (measured yield 0/20, 7/20, 4/20, 19/20). That is the **search thread's** call —
  it changes what users see. Don't fix it here; it will confound the re-test if it moves mid-flight.
- **Concurrency.** The search thread is active in `scripts/ingest/search/` (its own sprint is in
  `docs/SPRINT.md` — do not clobber that file). Coordinate before touching `fts-core.ts` or
  `fts-query-service.ts`.
- **Git:** no git mid-sprint; single end-of-sprint `commit-all.sh` (`docs/CLAUDE.md` §12).
