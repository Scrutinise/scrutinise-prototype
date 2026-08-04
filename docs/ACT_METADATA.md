# `corpus_acts` — Act-level metadata

*Built by SPRINT §1, 2026-08-04. DDL of record: `scrutinise-web/prisma/act_metadata.sql`.
Builder: `scripts/ingest/search/build-act-metadata.ts`.*

## What it is and why

Everything below this table in the search stack is **section-level**. `corpus_sections`
holds 1,609,670 compiled legislation sections but knows nothing about the *instrument*
each belongs to — no title, no year, no jurisdiction, no section count. Anything that
needs to talk about an Act rather than a provision had to fall back to the legacy
`LegislationItem` table, which is a **different and only partly overlapping population**.

`corpus_acts` is one row per instrument, keyed on the corpus `gid` (`ukpga/2011/20`) or,
for `eur-lex`, the CELEX id (`31973R1057`). It is a **derived table** — a materialised
join of `corpus_sections` and `LegislationItem`. Nothing writes to it by hand; dropping
and rebuilding it is always safe.

## Rebuilding

```bash
cd scripts/ingest
tsx search/build-act-metadata.ts               # rebuild (~17s) + verify
tsx search/build-act-metadata.ts --verify-only # report only, no writes
```

The whole build is one `INSERT … SELECT` inside a transaction (`TRUNCATE` + `INSERT`
together, so readers never see an empty table). It should be re-run after any
legislation ingest, since `section_count` and the gid population drift as ingest runs.

**It reconciles itself.** Every compiled legislation section must be attributed to
exactly one act row; the builder compares `sum(section_count)` against the source count
and prints `** N SECTIONS UNATTRIBUTED **` on any gap. Current state: 1,609,670 =
1,609,670, delta 0.

## Current contents (2026-08-04)

| | rows |
|---|---|
| total instruments | 250,808 |
| in the search corpus (`in_corpus`) | 233,547 |
| in `LegislationItem` (`in_legislation_item`) | 135,531 |
| in both | 118,270 |
| **titled** | **135,531 (54.0%)** |
| no year (regnal-dated) | 1,610 |
| sections attributed | 1,609,670 |

By jurisdiction (derived from the gid type prefix — see below):

| jurisdiction | instruments | of which in corpus |
|---|---|---|
| UK | 131,307 | 115,035 |
| EU (retained) | 92,340 | 92,340 |
| Northern Ireland | 12,676 | 12,478 |
| Scotland | 9,633 | 8,900 |
| Wales | 4,852 | 4,794 |

## Decisions worth knowing

**The population is a UNION, not an intersection.** Taking only corpus gids would drop
the 17,261 `LegislationItem` entries the browse page shows today; taking only
`LegislationItem` would drop the 115,277 corpus instruments that never had a
`LegislationItem` row. `in_corpus` / `in_legislation_item` record which side each row
came from, so a caller can ask for "things that are actually searchable" without the
table having silently made that choice for it.

**Titles are incomplete and the table says so.** Titles exist only where a
`LegislationItem` row exists. The untitled remainder is not random — it is newer Acts
(`ukpga/2026/*`), pre-1963 regnal-year Acts (`ukpga/Edw7/1/5`), older SIs, and the whole
of `eur-lex` (a CELEX id space that was never in `LegislationItem`). `title_source`
records provenance so the gap is queryable rather than invisible. **`corpus_sections`
cannot supply titles itself** — checked: `sectionTitle` is null on all 20,508 whole-document
rows across the legislation corpora. Filling the gap needs a title fetch from
legislation.gov.uk, which is an ingest job, not a query-layer one.

**Jurisdiction comes from the gid prefix, not from `corpus_sections.jurisdiction`.**
That column is the literal string `'uk'` on every one of the 1.6M legislation rows, so it
cannot distinguish an Act of the Scottish Parliament from a UK public general Act. The
gid's own type prefix can (`asp`/`ssi` → Scotland, `nisr`/`nisi`/`nia` → Northern Ireland,
`wsi`/`anaw`/`asc`/`mwa` → Wales), and it is part of the citation rather than a guess.
`LegislationItem.jurisdiction` is preferred where present.

**`regional` is a legislation corpus and must stay in the builder's list.** It is where
*all* devolved primary and secondary legislation lives (331,124 sections / 26,172
instruments). The first build of this table omitted it and consequently reported **zero**
searchable instruments for Scotland, Wales and Northern Ireland — which reads as a corpus
coverage gap when it is really a bug in a hard-coded list. The comment in
`build-act-metadata.ts` says so at the list itself.

**Regnal-year Acts have no `year`.** `ukpga/Edw7/1/5` carries a monarch and a session, not
a calendar year. 1,610 rows have `year IS NULL` rather than a year inferred from the
monarch, which would be fabrication. `number` keeps the whole regnal remainder.

## Who reads it

- `GET /api/legislation/search` (the browse page) — filtered to `in_legislation_item`, so
  the population and the `id`s are unchanged from before the repoint. See below.
- Nothing reads it through the Prisma client. The `CorpusAct` model in `schema.prisma`
  exists **only** so that a future `prisma migrate diff` does not propose dropping a table
  the schema does not know about.

## The browse page, and the widening that is NOT done

`/api/legislation/search` was `title contains q` over `LegislationItem` — ILIKE `%q%`,
which no btree can serve, so a full scan of 135,531 rows on every keystroke of a
300 ms-debounced search box. It now runs against `corpus_acts`, which carries a trigram
GIN index on `title`, giving the same substring semantics an index-served plan.

**Verified as a parity change, not a behaviour change**: old and new were run side by side
over 10 filter combinations (no filters, paged, free-text, type/year/jurisdiction filters,
`%` and `'` in the query) and returned the same rendered page every time; populations match
exactly at 135,531; no row has a null link id.

**One pre-existing bug was fixed in passing.** The old ordering was
`year DESC, title ASC`, which is **not unique** — 107 groups covering 215 rows share both
(e.g. two 2026 rows both titled "The Boiler Upgrade Scheme (England and Wales)"). Where a
tied pair straddles a page boundary the same instrument can appear on two pages while
another vanishes. The new query adds `gid ASC` as a deterministic tie-break.

**Browse still shows only the `LegislationItem` population**, i.e. 135,531 of the 250,808
instruments. Widening it to the 115,277 corpus-only instruments would ship links that 404:
`/legislation/[itemId]` resolves **only** by `LegislationItem.id` (uuid) and renders only
legacy compiled sections. The follow-on is to teach that page to resolve a `gid` and read
sections from `corpus_sections`/R2; until then the widening is deliberately not made.
