# V26 §6 legacy DROP — re-audit after the 4 Aug repoint

> ## ⚠ ADDENDUM 2026-08-09 20:54 UTC — READ THIS FIRST. THE AUDIT BELOW IS STALE IN BOTH DIRECTIONS.
>
> *Written by the SEARCH thread (a V33 brief was delivered into the search session by mistake).
> **Report only — nothing was changed, nothing dropped, no schema touched.** Verified against the
> working tree at commit `972de76` and against live Neon (`neondb`), read-only.*
>
> **VERDICT: DO NOT `pg_dump`-ARCHIVE AND DROP YET.** The premise that the DROP is gated only on
> "six web paths plus one row" no longer holds. Three of the audit's items are already done; three
> paths it never listed are still live. The real remaining count is **eight**.
>
> ### Already repointed — no work left
>
> | audit item | state on 9 Aug |
> |---|---|
> | `lib/lex/fts-search.ts:195` (path 2) | reads `prisma.corpusAct` ✅ |
> | `lib/lex/vector-search.ts:128` (path 3) | reads `prisma.corpusAct` ✅ |
> | `scripts/ingest/search/citation-resolver.ts` (§b) | reads `corpus_acts` ✅ — the boot-critical one |
>
> So `fts-serve` will **not** die at boot on the DROP. One stale COMMENT remains at
> `scripts/ingest/search/fts-query-service.ts:222` claiming the index is "built from
> LegislationItem"; the code beneath it is correct.
>
> ### Still reading the legacy tables — eight, not six
>
> (§(a) below is also internally inconsistent: its heading says six, its table lists seven.)
>
> | # | Path | Reads | Live? |
> |---|---|---|---|
> | A | `lib/lex/gateway-legacy.ts:287` | `LegislationSection` enrichment | Yes — Lex chat, panel, `/api/search` |
> | B | `app/legislation/[itemId]/page.tsx:13,26` | `LegislationItem` + sections + amendments | **Yes — public page, NOT IN THE AUDIT** |
> | C | `app/api/legislation/[itemId]/route.ts:9` | same | Yes |
> | D | `app/api/legislation/test-sections/route.ts:10` | `LegislationSection` | Yes (test route) |
> | E | `app/api/ideas/[id]/field-approval/route.ts:165` | reads `LegislationItem`, writes `IdeaLegislation` | Yes |
> | F | `app/api/legislation/link/route.ts:23` | writes `IdeaLegislation.legislationItemId` | Yes |
> | G | `lib/search.ts:177–178` | raw SQL join | Yes — **filtered `/api/search` is served ONLY by this**, plus `/api/ai/[ideaId]:708` |
> | H | `app/api/ideas/[id]/legislation-search/route.ts:75–76` | raw SQL join | **Fallback — NOT IN THE AUDIT** |
>
> ⚠ **G and H are FALLBACKS, which is the worst shape for this.** They fire only when the gateway
> has already failed. After the DROP they stop being a degraded answer and become a second
> exception thrown on top of the first — the failure arrives on the day you least want it.
>
> ### The finding that shrinks the job (measured, not estimated)
>
> The public browse→detail journey looks like the large blocker. It is not:
>
> - **914,274** legacy sections, but only **1,639** renderable (`COMPILED`/`NEEDS_REVIEW`), across
>   **432 Acts**. Only **24,579** carry a `compiledTextKey`.
> - `/legislation/[itemId]` therefore serves real content for **432 of 135,531 browsable Acts —
>   0.3%.** The other 99.7% already render an empty section list today.
> - **All 432 of those Acts are covered by `corpus_sections`.** Zero gap.
>
> So B and C are a much smaller repoint than §(a) implies, and doing them *widens* browse from
> 135,531 to 250,808 instruments rather than costing anything (the follow-on ACT_METADATA.md
> already describes).
>
> ### Blockers re-confirmed live
>
> - **`IdeaLegislation`: still exactly 1 row** — idea `374c54e5-1bf5-42f1-970c-6e19a9b87132`,
>   `legislationItemId` `2ecb9cd9-fd0f-4d57-958d-cbbac9013370`, **Constitutional Reform Act 2005,
>   gid `ukpga/2005/4`, `linkType: relevant`.** `corpus_acts` carries that gid, so a gid-based
>   reference is available.
> - **Space: 15.79 GiB of 17.5 (90.2%).** `LegislationSection` **1,712 MB** + `LegislationItem`
>   **61 MB** ≈ **1.73 GB → ~80.3%**. Unchanged conclusion: **headroom, not a solved problem.**
>   `corpus_sections` is **12 GB** and is where the storage question actually lives.
> - ⚠ **`pg_stat_user_tables.n_live_tup` is badly stale on this database** — it reports 0 rows for
>   `LegislationSection` (actual count 914,274), 0 for `IdeaLegislation` (actual count 1), and 480,120 for
>   `corpus_sections`. `pg_total_relation_size` is reliable; the row estimates are not. Do not size
>   or verify the DROP off that view.
>
> ### Suggested order of work (web side)
>
> 1. **Writes and the FK** — D delete, E+F repoint to gid, migrate the one `IdeaLegislation` row.
>    Needs a Neon migration (gid column on `IdeaLegislation`), so `whichdb` first per CLAUDE.md §16.
> 2. **B + C** — teach the detail page to resolve a gid and read from `corpus_sections`/R2.
> 3. **A + G + H** — retire the enrichment read and both fallbacks. Largest, and the only slice with
>    a user-visible behaviour change.
>
> ### Three decisions that block slice 3 — Charlie's, not the threads'
>
> 1. When the gateway fails and there is no legacy index, should `/api/search` and the idea
>    legislation panel **fail honestly** (recommended, consistent with §19-C) or something else?
>    This is a real reduction in resilience.
> 2. The one `IdeaLegislation` row — **migrate to a gid reference** (recommended; it is somebody's
>    saved link) or delete?
> 3. Filtered search (`type`/`year`/`actId`) is served ONLY by the legacy path. `corpus_acts`
>    carries `legislation_type`, `year` and `jurisdiction`, so the filters CAN move — but that is a
>    slice of work, not a line. Move them, or retire the filter UI?
>
> **Until 1–3 are answered and the eight paths are cleared, the archive-and-DROP should not run.**

---

## The 7 Aug audit, as written (superseded in part by the addendum above)

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
