# `corpus_sections` — what the 12.6 GB actually consists of

> ## ▲ V33 §3a UPDATE — 2026-08-09. Acted on: index drops only. Neon 96.2% → 90.2%.
>
> *Script of record: `scripts/ingest/v33-neon-reclaim-indexes.ts` (dry-run by default; every
> dropped index's exact `CREATE INDEX` is printed before it goes, so all of this is reversible).
> Measurement of record: `scripts/ingest/v33-neon-fill.ts`.*
>
> **The alert got worse before it got better.** This audit measured 15.93 GB / 91.0% on 7 Aug.
> On 9 Aug, before any V33 work, it was **16.77 GB / 95.8%** — the committees backfill and the
> graph tables had eaten most of the remaining headroom. 0.73 GB of a 17.5 GB ceiling.
>
> **⚠ ONE ENTRY IN THIS AUDIT'S LIST HAD FLIPPED, and re-verifying is what caught it.**
> `idx_corpus_sections_parent` was recorded below at **6 scans** and graded "review / medium
> risk". It is now at **26,957** — the committees work made `parentDocId` a hot path. Dropping it
> on the strength of a two-day-old counter would have removed a live index. **KEPT.**
> `corpus_sections_corpus_idx` likewise (27,965).
>
> | action | index | size | scans | result |
> |---|---|---:|---:|---|
> | DROP | `corpus_sections_fts` | 0.534 GB | 0 | gone — no code reads `corpus_sections."ftsVector"` (re-grepped 9 Aug) |
> | DROP | `corpus_sections_format_idx` | 0.172 GB | 1 | gone — 5 distinct values over 18.3M rows |
> | DROP | `corpus_sections_status_idx` | 0.184 GB | 4 | gone — 3 distinct values over 18.3M rows |
> | REPLACE | `corpus_sections_notes_idx` | 0.170 GB | 11 | → `corpus_sections_notes_partial_idx` (`WHERE notes IS NOT NULL`), **0.006 GB** — 28× smaller, same 11 scans still served |
> | KEEP | `idx_corpus_sections_parent` | 0.234 GB | **26,957** | see above |
> | KEEP | `corpus_sections_corpus_idx` | 0.179 GB | 27,965 | build/audit scans |
> | KEEP | `corpus_sections_pkey` | 1.683 GB | 4,387,863 | the join key to Lance |
>
> **Reclaimed 1.053 GB against a predicted 1.059 GB. Neon 16.839 → 15.785 GB, 96.2% → 90.2%.**
> `corpus_sections` 13.518 → 12.465 GB.
>
> **The column drops (candidates 2, 4, 7, 8) were deliberately NOT taken**, for the reason this
> audit gives in "How the space actually comes back": `DROP COLUMN` only marks the attribute, and
> the bytes come back on a rewrite that wants room for a second copy of a 12.5 GB table. At 96%
> full that is the move most likely to hit the ceiling while trying to relieve it. They also
> reclaim nothing measurable until there is headroom to repack, and they are irreversible.
>
> **One correction to §5 below.** It says `r2RawKey` appears "in no SELECT anywhere". There is
> one: `scripts/attic/v17-fleet/retry-failed.ts:65`. It is retired code under `scripts/attic/`,
> so the conclusion stands, but the claim as written was too strong.
>
> **Not done, and worth doing next:** the `corpus_sections_fts_trigger` still fires on every
> INSERT and UPDATE of an 18.3M-row table to run a function whose whole body is `RETURN NEW`
> (§3 below). Dropping it is free and removes real per-row cost on every ingest pass; it was left
> alone only because this sprint's remit was the indexes.
>
> ⚠ **V33 §1 and §5 added rows while this was going on**: the legislation re-sectioning wrote
> 193,667 sections and retired 7,769, and the committees backlog added 1,805 — a net +187,703
> rows, ~0.1 GB, already inside the figures above.


*2026-08-07 17:52 UTC. **Report only. No schema changes, no rows written, nothing dropped.**
Read-only measurement against Neon (`NEON_DATABASE_URL`, the direct endpoint). Companion to
`docs/V26_LEGACY_DROP_RECHECK.md`, which established that the legacy DROP alone does not clear
the storage alert and pointed here.*

---

## Headline

**No body text is stored in Neon.** `corpus_sections` has no body column — `compiledText` was
dropped by `scripts/ingest/drop-compiled-text-col.ts` and its slot is still visible in the
catalogue as `........pg.dropped.13........`. Bodies live in R2 only, addressed by `r2Key`. The
12.6 GB is **metadata, index and one abandoned artefact**, not duplicated content.

The single largest *removable* item is **`ftsVector` — a partial, dead Postgres full-text index
that nothing reads: 1,168 MB of column data plus a 545 MB GIN index = 1.71 GB**, which on its own
reclaims slightly more than the entire legacy `LegislationItem`/`LegislationSection` DROP (1.73 GB)
and does so without touching a single live read path.

⚠ **Reclaiming column space is not free at 91% full — see "How the space actually comes back".**

---

## 1. Where the 12.6 GB sits

`pg_database_size` = **15.93 GB** of the 17.5 GB ceiling (91.0%), of which `corpus_sections` is
**12,915 MB**:

| part | size | share of table |
|---|---:|---:|
| heap (main fork) | 7,868 MB | 60.9% |
| indexes (8 of them) | 3,123 MB | 24.2% |
| TOAST (incl. its index) | 1,922 MB | 14.9% |
| **total** | **12,915 MB** | |

Rows: **17,903,304**. Average tuple 458 B.

**The table is not bloated.** A whole-row datum probe (`sum(pg_column_size(cs.*))` over a 1% page
sample, scaled) gives 7,819 MB of live tuple bytes against 7,868 MB of heap — a fill ratio of
~99%. There is no large pool of dead space, so `VACUUM FULL` on its own would reclaim
approximately nothing. *(Caveat: `pg_column_size` on a composite may detoast, so treat 7,819 MB as
an upper bound on live heap bytes. Confirming exactly needs `pgstattuple`, which is available on
this Neon instance but not installed — installing it is a schema change and was not done.)*

## 2. Column by column

Estimated from a 1% page sample scaled to 17,903,304 rows; `pg_column_size` reports the
**compressed** on-disk size, so these are storage bytes, not text lengths.

| column | est. total | avg/row | non-null | notes |
|---|---:|---:|---:|---|
| `sourceUrl` | 1,695 MB | 99.3 B | 100.0% | largest column; 6.74M distinct values |
| `ftsVector` | 1,168 MB | 1,786.6 B | **3.8%** | **dead** — see §3 |
| `r2Key` | 1,018 MB | 60.4 B | 98.7% | **99.58% derivable from `id`** — see §4 |
| `sectionTitle` | 827 MB | 53.9 B | 89.9% | read by both search hydrate paths |
| `id` | 658 MB | 38.5 B | 100.0% | + 1,676 MB of pkey = 2,334 MB, 18% of the table |
| `parentDocId` | 275 MB | 18.3 B | 88.2% | 759,543 distinct docs |
| `corpus` | 267 MB | 15.7 B | 100.0% | 70 distinct values |
| `speaker` | 200 MB | 16.9 B | 69.4% | |
| `status` | 154 MB | 9.0 B | 100.0% | 3 distinct values |
| `createdAt` | 137 MB | 8.0 B | 100.0% | |
| `compiledAt` | 131 MB | 8.0 B | 95.7% | |
| `jurisdiction` | 99 MB | 5.8 B | 100.0% | 4 distinct values |
| `r2RawKey` | 97 MB | 60.3 B | 8.8% | **written by ingest, read by nothing** |
| `availability_status` | 87 MB | 5.1 B | 100.0% | 6 distinct values |
| `licence` | 70 MB | 8.2 B | 50.8% | 15 distinct; constant per corpus |
| `wordCount` | 67 MB | 4.0 B | 98.7% | |
| `itemDate` | 67 MB | 4.0 B | 97.7% | |
| `availability_note` | 31 MB | 129.4 B | 1.3% | 229,637 rows |
| `format` | 22 MB | 5.2 B | 25.3% | 5 distinct values |
| `errorMsg` | 7 MB | 43.6 B | 0.9% | 155,019 rows |
| `notes` | 1 MB | 24.2 B | 0.3% | 48,664 rows, 268 distinct |
| `xmlPreview` | ~0 MB | 204 B | **101 rows** | diagnostic-email field; effectively dead |
| `attribution` | 0 MB | — | **0 rows** | **100% NULL — never populated** |

## 3. `ftsVector` — the abandoned artefact, and the clearest win

**Nothing reads it.** A repo-wide grep for `ftsVector` finds it used only against
`LegislationSection` and `OperationalSection` (`railway-legsection-retire.ts`,
`v26-explain-legsearch.ts`, `v26-fts-state.ts`, `v26-pooled-smoke.ts`, `apply-fts-config.sql`) —
**no code path reads `corpus_sections."ftsVector"`**. Search moved to Lance BM25 + dense; the
serve services never touch Postgres FTS.

**Nothing writes it either.** `drop-compiled-text-col.ts` replaced the maintaining trigger
function with a no-op, and the live catalogue confirms it:

```
CREATE TRIGGER corpus_sections_fts_trigger BEFORE INSERT OR UPDATE ON public.corpus_sections
  FOR EACH ROW EXECUTE FUNCTION corpus_sections_fts_update()
-- function body: BEGIN RETURN NEW; END;
```

So every insert and update of a 17.9M-row table fires a trigger that does nothing.

**It could not serve a query even if something wanted it:** only **684,359 of 17,903,304 rows
(3.8%)** carry a vector, spread across 15 corpora — the residue of a migration-era build that was
never completed corpus-wide. The newest row carrying one is dated **2026-06-05**, while rows have
continued to arrive to **2026-08-07**.

`corpus_sections_fts` (GIN, 545 MB) shows **`idx_scan = 0`**.

**Reclaim: 1,168 MB (column) + 545 MB (index) = 1,713 MB.**

## 4. `r2Key` — derivable, but it is a real external pointer

Full-table test of the rule `{corpus}/{doc-path}/sections/{ref}/compiled.txt` derived from
`id = {corpus}:{doc-path}:{ref}`:

| | rows |
|---|---:|
| non-null `r2Key` | 17,681,740 |
| **match the rule exactly** | **17,606,844 (99.58%)** |
| break the rule | 74,896 |

Every exception is a single corpus, `tna-caselaw`, which uses `caselaw/{docid}/compiled.txt`
(no `sections/` segment, and `caselaw` rather than the corpus name). The 221,564 NULL `r2Key`
rows are all `status = 'unavailable'` — nothing was written to R2 for them.

`r2Key` is read **only at build time** — `build-fts-index.ts:211`, `build-corpus-chunks.ts:117`,
`check-chunk-stability.ts:69`. Neither serve service reads it: snippets come from the Lance
`corpus_chunks` table, not from R2 at query time.

**Reclaim: 1,018 MB** — but this is the one candidate on the list that trades storage for a
*correctness* risk. A derivation function has to stay right for all 70 corpora, and a future
source with a different key shape would break silently rather than loudly. Recommendation: treat
this as a second-round option, not part of the first cut.

## 5. `r2RawKey` — written, never read

Present on 1,583,615 rows (8.8%). Grep finds it in `db-metadata.ts` (the upsert column list),
`process-row.ts` (the writers) and `migrate-corpus-to-neon.ts` (the one-off migration) — and in
**no SELECT anywhere**. It points at raw XML/HTML in R2 that nothing currently fetches.

**Reclaim: 97 MB.**

## 6. Indexes — 3,123 MB, and 866 MB of it is unused

| index | size | `idx_scan` | verdict |
|---|---:|---:|---|
| `corpus_sections_pkey` (btree `id`) | 1,676 MB | 1,871,830 | **keep** — the join key to Lance |
| `corpus_sections_fts` (GIN `ftsVector`) | 545 MB | **0** | **drop** — §3 |
| `idx_corpus_sections_parent` (partial, `parentDocId`) | 234 MB | 6 | review |
| `corpus_sections_status_idx` (3 distinct values) | 175 MB | 1 | drop or make partial |
| `corpus_sections_corpus_idx` (70 distinct values) | 170 MB | 497 | keep — used by build/audit scans |
| `corpus_sections_format_idx` (5 distinct values) | 164 MB | **0** | **drop** |
| `corpus_sections_notes_idx` (268 distinct, 48,664 non-null) | 154 MB | 1 | **make partial** — indexing 17.9M rows to find 48k |
| `idx_corpus_sections_availability` (partial) | 3 MB | 0 | keep — it is already cheap |

A btree on a 3- or 5-value column across 17.9M rows cannot help any selective query; those three
(`status`, `format`, `notes`) cost 493 MB to serve two recorded scans, both of which read ~20M
tuples — i.e. they were full scans that happened to go through an index.

⚠ **Caveat on `idx_scan = 0`:** these counters live in the stats collector. `stats_reset` is NULL
(never explicitly reset), and `pkey` has accumulated 1.87M scans, so the window is real and long —
but a Neon compute restart can still zero them. For `ftsVector` the code grep is the stronger
evidence and it agrees; for `format` and `status` the counter is the main evidence.

**Reclaim, indexes only: 545 (fts) + 164 (format) = 709 MB with zero recorded use; +329 MB more
if `status` and `notes` go or become partial.**

## 7. `sourceUrl` — the largest column, and the least tractable

1,695 MB, 100% populated, avg 99.3 B. It is **not** derivable and **not** constant per document:
6,743,622 distinct URLs across 17.9M rows, and 4,810,362 distinct `(parentDocId, sourceUrl)` pairs
across only 759,543 documents — because a document's sections often point at different assets
(the gov.uk page for one section, the PDF for the next).

Normalising to a URL dictionary would cost 6.74M rows × ~100 B ≈ 643 MB for the dictionary plus
~72–137 MB of foreign keys, netting roughly **900 MB** — for a join added to the hydrate step of
every search result, on both `fts-search.ts` and `vector-search.ts`. Poor value against §3 and §6.

## 8. Dead but worthless

`attribution` is NULL on all 17,903,304 rows and `xmlPreview` on all but 101. Both are genuinely
dead columns; both reclaim essentially nothing, because a NULL costs only its bit in the null
bitmap. Worth dropping for tidiness with something else, never on their own.

---

## What each candidate reclaims

| # | candidate | reclaims | risk |
|---|---|---:|---|
| 1 | `DROP INDEX corpus_sections_fts` | **545 MB** | none — 0 scans, no reader in code |
| 2 | `ALTER TABLE … DROP COLUMN "ftsVector"` | **1,168 MB** | none — no reader, no writer, 3.8% populated |
| 3 | `DROP INDEX corpus_sections_format_idx` | **164 MB** | none — 0 scans, 5 distinct values |
| 4 | `ALTER TABLE … DROP COLUMN "r2RawKey"` | **97 MB** | none — no SELECT anywhere |
| 5 | `status_idx` + `notes_idx` (drop / make partial) | **329 MB** | low — 1 scan each, both full scans |
| 6 | `idx_corpus_sections_parent` | 234 MB | medium — 6 scans; check the parent-doc paths first |
| 7 | drop `r2Key`, derive it instead | 1,018 MB | **medium** — 2-branch rule, silent breakage if a new corpus differs |
| 8 | normalise `sourceUrl` | ~900 MB | medium — a join on every search hydrate |
| | **1–4 combined (nothing reads any of it)** | **1,974 MB** | |
| | **1–5 combined** | **2,303 MB** | |

### Against the alert

| scenario | Neon | % of 17.5 GB |
|---|---:|---:|
| today | 15.93 GB | **91.0%** |
| + candidates 1–4 | 14.00 GB | **80.0%** |
| + candidates 1–5 | 13.68 GB | **78.2%** ✅ |
| + legacy `LegislationItem`/`LegislationSection` DROP (1.73 GB) | 11.95 GB | **68.3%** |
| + candidates 7 and 8 as well | 10.08 GB | **57.6%** |

**The comparison worth noting: the dead `ftsVector` alone (1,713 MB) reclaims about as much as the
entire legacy DROP (1,730 MB) — and unlike the legacy DROP it has no live callers, no FK
constraints, and no row of user data to migrate first.**

## How the space actually comes back

⚠ This matters more than usual at 91% full, and it is where a plan can go wrong:

- **`DROP INDEX` returns space immediately.** The file is unlinked; `pg_database_size` — which is
  exactly what `serve-observer.ts` alerts on — falls straight away. Candidates 1, 3, 5 and 6 are
  therefore the *safe* moves to make first.
- **`ALTER TABLE … DROP COLUMN` does not.** It only marks the attribute dropped. The heap and
  TOAST bytes stay until the rows are rewritten, so candidates 2, 4, 7 and 8 reclaim **nothing
  measurable** until a `VACUUM FULL` or `pg_repack` pass — and `VACUUM FULL` needs room for a
  second copy of a 12.9 GB table plus an ACCESS EXCLUSIVE lock. **Starting there at 91% could hit
  the ceiling rather than relieve it.**
- **The sequence that follows from that: drop the unused indexes first** (candidates 1+3 = 709 MB,
  immediate, no rewrite, no lock beyond the drop), *then* drop the columns, *then* rewrite.
- One cheaper alternative for `ftsVector` specifically: `UPDATE … SET "ftsVector" = NULL` unlinks
  684,359 TOAST values without a full rewrite — but it makes 684,359 dead tuples and still needs a
  vacuum to hand the pages back. Worth costing against `pg_repack` before choosing.

## What is NOT the problem

- **Body text is not duplicated into Neon.** There is no body column; `compiledText` is already
  dropped. The R2/Neon split is being honoured.
- **The table is not bloated** (~99% heap fill). `VACUUM FULL` for its own sake buys nothing.
- **`corpus_chunks` (21.8M rows) is not in Neon at all** — it is a Lance table on R2 and does not
  appear among the database's relations.
- **`id` and its primary key are 2,334 MB (18% of the table) and cannot go.** A synthetic integer
  key plus a unique index on `id` would be larger, not smaller.

---

## Recommendation

Nothing here needs a decision about search behaviour — candidates 1–4 remove things **no code
reads and no process writes**. They take Neon from 91.0% to 80.0%, and adding candidate 5 clears
the 80% alert threshold outright at 78.2%. Do those before considering the legacy DROP, which is
more work, carries a row of real user data, and reclaims less.

**No schema changes have been made. This is Charlie's call.**
