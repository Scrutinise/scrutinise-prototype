# INGEST CBA-1 EXECUTE: report (PARTIAL, stopped at a Charlie decision)

**Brief:** `docs/BRIEF_INGEST_CBA_1_EXECUTE.md` (decisions 326–331). **Session:** cc-ingest, desktop, `C:\Code\scrutinise-prototype`.
**Measured:** 18 Nov 2026, 10:20–11:08 UTC, all read-only. **Written up:** 18 Nov 23:45 UTC.

⚠ **This session wrote nothing to any database, to R2, to an index or to a serve.** It found that half the brief was already done on
production on 14 Nov by a session whose code is not in this repo. It verified that work and stopped at stop rules 1, 5 and 6.
The question is in the inbox: `C:\Code\inbox\done\2026-11-18T1108Z_cc-ingest_cch_cba1x-half-done-on-laptop.md`.
CCh acknowledged it at 12:05 UTC and raised it with Charlie. **Charlie's 1/2/3 decision is still open.**

## §1 — 324 or 327 for the old Green Book rows: **324 stands; 327 is pending a CC-Search change**

- Search has no default filter on `availability_status`.
  - Scope is tier / corpora / excludeCorpora / ids only (`scripts/ingest/search/fts-core.ts` `scopePredicate`, and `vector-core.ts`).
  - `corpus_vec` does not carry the column at all.
  - So 327 (keep the rows, filter by default) cannot work until **CC-Search adds a default `availability_status` filter to both serves**
    and the column to `corpus_vec`. That is the change 327 waits on.
- Read-back today: the five retired rows are at 0 in `corpus_fts`, `corpus_vec`, `corpus_chunks`, live `fts-serve` and live
  `vector-serve`. The control is found everywhere.
  - Trace: `docs/ingest_traces/d324_readback_cba1x-2026-11-18.json`.

## What production already holds (written 14 Nov, nothing committed, no CHANGE_LOG entry)

| Part | State on production |
|---|---|
| §2 Pilot A | 468 rows in `govuk-core-docs`, written 14 Nov 02:16 UTC: Green Book 404 (391 paragraphs + 13 tables), discounting 33, optimism bias 31. Licence ogl-3.0 |
| §2 keyword index | `corpus_fts` 404 / 33 / 31; `body_idx` unindexed = 0 |
| §2 vector index | `corpus_vec` / `corpus_chunks` 408 / 33 / 36 chunks |
| §2 merges and serves | fts-index heavy job 02:25, vector-reindex 02:37; both serves restarted 03:19 / 03:20 |
| §4 GMCA | 30 `m4-*` CostBenchmark rows, created 14 Nov 02:30 |

Inferred, not checked: a laptop CC-Ingest session that has not pushed (the laptop's push hung at Git Credential Manager on 12 Nov).

## §2 — verified, not trusted

- **Same October edition.**
  - The PDF and the HTML are attachments of the same gov.uk publication, `the-green-book--2`.
  - The publisher date (2026-10-28 13:30:39) is unchanged since the 4 Nov review.
  - 388 of 390 PDF paragraph openings appear in the HTML (99.5%).
  - 69 of 69 HTML table figures appear in the PDF.
  - Paragraph *endings* match 357/390 (91.5%, below the 95% floor). The misses are figure labels the PDF splitter attaches to a
    paragraph's end (6.1 carries Figure 5's boxes) and link text, not a different edition. Reported as measured; the floor was not moved.
- **What was reviewed is what was written.**
  - Today's split regenerates the reviewed read-back (`cba1_pilot_readback.txt`) byte for byte.
  - All 468 stored rows match exactly one reviewed section, one to one: 0 unmatched, 0 unclaimed.
  - Map: `docs/ingest_traces/cba1x_existing_map.json`.
- ⚠ **Section refs are a running sequence, not paragraph numbers.** Green Book 6.58 is `…the-green-book-2026-paragraphs:186`.
  - Re-keying would delete 468 rows (stop rule 4).
  - **Adopted by CCh 12:05:** keep the ids. The manifest carries key → section id → text hash, so a re-cut that re-points `:186` fails a
    check.
  - Key format: `green-book:6.58`, `gb-discounting:3.8`, `gb-optimism-bias:3.8`, `green-book:table-1`.
  - cc-lex-26y has shipped an INTERIM manifest built from the rows' sectionTitle. When the §6 manifest lands, its check asserts the two
    agree.

## §9 — answered

`scrutinise-web/lib/.../costing-params.ts` holds the per-year schedule: `STPR_SCHEDULE`, `stprRateForYear` and `discountFactor`. It was built
under decision 325, with Annex A reproduced for years 0–125. It is not just the 3% headline.

## NOT DONE (blocked on Charlie's 1/2/3)

| Part | State |
|---|---|
| §3 (329) Civil Service Statistics, PESA and deflator-release tables, each row with release date, price basis and suppression state | Not built. The stats DB (separate Neon project) is unchanged since 4 Aug. Needs a stats-DB migration. **Build it around `pesa-ch5-function`**, already held since August, which the CBA-1 audit missed |
| §4 CC BY attribution string in `docs/LICENCE_REGISTER.md` | Not written |
| §5 (330) NAO licence note | Not written |
| §6 machine-readable citation manifest | Not built (see key format above) |
| §7 name what is not held | This table, plus: deflator release dates (DeflatorSeries is year + index only, 71 rows, 1955–2025); Civil Service Statistics; PESA beyond chapter 5 |
| §8 Table 1 as its own reference table with its page number | Not built. Re-verify from the page image (PDF p.2) when building. `costing-params.ts` already notes all four columns |
| CHANGE_LOG predictions and scoring, the scoped commit of production work | None for the 14 Nov writes; they need the laptop's code to be honest |

## Code from this session (committed with this report)

- `scripts/ingest/cba/write-pilot-a.ts`. Modes:
  - `check` (default): edition checks, byte identity with the reviewed read-back, and a clash count.
  - `verify-existing`: the one-to-one map above.
  - `readback`.
  - `--apply`: **refuses while the 14 Nov rows exist.**
- Traces: `docs/ingest_traces/d324_readback_cba1x-2026-11-18.json` and `docs/ingest_traces/cba1x_existing_map.json`.
- This brief: `docs/BRIEF_INGEST_CBA_1_EXECUTE.md`.

## Also noted

- `BRIEF_INGEST_CBA_1_SEQUENCED.md`, which the brief says to read first, is not in the repo. CCh says it is in the Project
  (`claude/BRIEF_INGEST_CBA_1_SEQUENCED.md`), and Charlie can drop it into `docs/`.

## Options before Charlie

1. **Recommended:** Charlie pushes the laptop's CBA-1 EXECUTE work to `wip/ingest-cba1x`. A fresh cc-ingest session continues it: §3, §4
   register, §5, §6, §8, the report, one scoped commit.
2. The laptop session finishes EXECUTE; the desktop stands down.
3. The desktop does the rest from scratch, treating the 14 Nov rows as verified. Not advised while the laptop may hold the same work
   uncommitted.
