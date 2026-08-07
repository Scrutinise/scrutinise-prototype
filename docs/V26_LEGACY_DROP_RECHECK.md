# V26 §6 legacy DROP — re-audit after the 4 Aug repoint

*7 Aug 2026. **Report only. Nothing dropped, nothing altered.** Triggered by the new
serve-observer firing a real alert: Neon at **15.93 GB of a 17.5 GB ceiling (91%)**.*

## Verdict: still blocked — but the blockers are now three small, named pieces of work

The 4 Aug repoint moved three call sites onto `search-gateway.ts`, and `corpus_acts` was
built to take over `LegislationItem`'s Act-title role. **`corpus_acts` is ready. Nothing was
switched over to it.** The Act-title reads all still go to `LegislationItem`, and the legacy
enrichment path still reads `LegislationSection` on the live Lex chat route.

**⚠ Read this before planning around the space: the DROP does not clear the alert.**
1.73 GB reclaimable takes Neon from **91.0% → 81.1%**, still above the 80% threshold. The
bulk is `corpus_sections` at **12.6 GB of the 15.93 GB**. This work is worth doing, but it
buys headroom, not a solved storage problem.

---

## (a) Does anything in the web app still query the two tables at runtime? — **Yes, six paths**

| # | Path | Reads | Live? |
|---|---|---|---|
| 1 | `lib/lex/gateway-legacy.ts:287` | `LegislationSection` (+`LegislationItem` via relation filter) | **Yes** — imported by `app/api/ai/[ideaId]` (Lex chat), `app/api/search`, `app/api/ideas/[id]/legislation-search` |
| 2 | `lib/lex/fts-search.ts:195` | `LegislationItem` (Act titles) | **Yes** — the live BM25 result path |
| 3 | `lib/lex/vector-search.ts:128` | `LegislationItem` (Act titles) | **Inert today, live at step 7** |
| 4 | `lib/search.ts:177–178` | raw SQL `FROM "LegislationSection" JOIN "LegislationItem"` | yes, if still routed |
| 5 | `app/api/legislation/[itemId]/route.ts:9` | `LegislationItem` | Yes |
| 6 | `app/api/legislation/test-sections/route.ts:10` | `LegislationSection` | Yes (test route) |
| 7 | `app/api/ideas/[id]/field-approval/route.ts:165` | `LegislationItem` | Yes |

⚠ **Path 1 is not flag-gated.** The read fires whenever any hit carries a gid + section
number — i.e. the ordinary case — so `LegislationSection` is read on the Lex chat path today.

## (b) Do the three search paths use `corpus_acts` yet? — **No. None of them.**

| caller | what it does now | should be |
|---|---|---|
| `lib/lex/fts-search.ts:195` | `prisma.legislationItem.findMany({ where: { legislationGovUkId: { in: gids } } })` | `corpus_acts` on `gid` |
| `lib/lex/vector-search.ts:128` | identical query | `corpus_acts` on `gid` |
| `scripts/ingest/search/citation-resolver.ts:29` | `SELECT "legislationGovUkId", title FROM "LegislationItem"` — loads the **135,531-row ActIndex at `fts-serve` boot** | `corpus_acts` |

**`corpus_acts` is a verified drop-in for all three:**

- `LegislationItem` distinct gid→title: **135,531**
- `corpus_acts` rows with a title: **135,531** (of 250,808 total — it is a superset)
- gids in `LegislationItem` with no titled `corpus_acts` row: **0**
- gids where the two titles differ: **0**

So this is a mechanical swap with no data gap and no expected behaviour change — the column
is `gid` rather than `legislationGovUkId`, and `corpus_acts` covers *more* Acts, not fewer.

## (c) Any other remaining read path? — plus a structural blocker beyond reads

**Seven real FK constraints point at the two tables:**

```
LegislationSection.legislationItemId   → LegislationItem      (internal, dies with them)
LegislationCrossRef.sourceItemId       → LegislationItem      0 rows
LegislationCrossRef.targetItemId       → LegislationItem      0 rows
LegislationAmendment.sectionId         → LegislationSection   0 rows
LegislationCorrection.sectionId        → LegislationSection   0 rows
CoherentActionSection.legislationSectionId → LegislationSection   0 rows
IdeaLegislation.legislationItemId      → LegislationItem      ⚠ 1 ROW — USER DATA
```

Everything is empty **except `IdeaLegislation`, which holds one row of real user data** — an
idea linked to an Act. One row is not a reason to stop, but it is a reason not to
`DROP … CASCADE` casually: that row is somebody's saved link, and it needs migrating to a
`corpus_acts`-based reference or deliberately deleting with Charlie's say-so. It also means
`/api/legislation/link` and `field-approval` still *write* `legislationItemId`, so the write
path needs repointing too, not only the reads.

`corpus_acts.legislation_item_id` is populated on all 135,531 rows, but it is a plain column,
not an FK, so it does not block — though it should be nulled or dropped afterwards rather
than left pointing at a table that no longer exists.

## Expected space reclaimed

| table | rows | total (incl. indexes) |
|---|---|---|
| `LegislationSection` | 914,274 | **1,712 MB** |
| `LegislationItem` | 135,531 | **61 MB** |
| `LegislationAmendment` | 0 | 32 kB |
| `LegislationCorrection` | 0 | 32 kB |
| `LegislationCrossRef` | 0 | 32 kB |
| **total** | **1,049,805** | **1.73 GB** |

**Neon 15.93 GB (91.0%) → 14.20 GB (81.1%).** Above the 80% alert threshold either way.
`corpus_sections` (17,903,304 rows, **12.6 GB**) is where the storage question actually lives.

## The next small piece of work, in order

1. **Repoint the three Act-title reads to `corpus_acts`** (`fts-search.ts`,
   `vector-search.ts`, `citation-resolver.ts`). Verified zero-gap, mechanical.
   ⚠ Worth doing **before step 7** — `vector-search.ts` is on the path about to be switched
   on, so leaving it is adding a new caller to a table we intend to drop.
2. **Retire the legacy enrichment read** in `gateway-legacy.ts` (or prove the enrichment
   fields are now redundant), which is what still holds `LegislationSection` open on the Lex
   chat path.
3. **Deal with the one `IdeaLegislation` row** and repoint the link/field-approval write
   paths.
4. Retire or repoint paths 4–7 in the table above.
5. Then re-run this audit and drop, with a `pg_dump` to R2 first.

**Nothing has been dropped. Awaiting Charlie's go, and per the list above the go is not yet
the useful next step — the repoint in (1) is.**
