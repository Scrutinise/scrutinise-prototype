# SEARCH — S27: amendment reach, status since 24 September

**Written:** 2026-10-11 (reads taken that day). Report only: no product code, schema or ingest file changed. Scratch scripts
were deleted; the one artefact kept is `docs/census/s27-bills-product.json` (per-roll data for §1).

> **Quotable answer (for the Lex stream):**
> 1. Bill-publication questions: the router fix is built and measured but is **OFF in production** — through the product, **5 of 10** reach the right bill document in the top 20 today (same as 24 Sep), **10 of 10** with `LEX_ROUTER_BILL_VOCAB` on (at the S24 regression cost, not re-measured here).
> 2. "What amended / repealed this Act" **cannot be answered by Lex today**: the 2.35M official-record rows in `legislation_edges` have no reader in the web app, have not been refreshed since **5 July 2026**, and the Bills API structured amendments have **never been fetched**; the replacement-Lex tool is specified in §5.

---

## 1. Router vocabulary (S24 step 2) — built, measured, not switched on

- **Built:** `ROUTER_PROMPT_BILL_VOCAB`, flag `LEX_ROUTER_BILL_VOCAB`, commit `80b5ae3` (25 Sep). Appended to the router prompt, never woven in.
- **Measured at the time:** S24 measured *routing only* (10/10 name `legislation`) and the regression gate (≈5–7 of 68 gold questions lose a secondary stream, C5 loses its own). It could not run retrieval (no `FTS_SEARCH_URL` locally).
- **Production state, read today from `/api/health` (commit `7a28d52`):** `"LEX_ROUTER_BILL_VOCAB": false`. Never flipped.
- **Through the product, run today.** `runSearch({keywords, intent:'AD_HOC_RESEARCH'})` with production's flag string and the live `fts-serve` and `vector-serve` services. The ten questions are S24's reconstruction of S23's. 3 rolls per question per arm (the router is an LLM call). A "hit" is a `bills-api` row of the right bill **and of the matching publication type** (types rejoined live from `Bills/{id}/Publications`, as S23 did) in the first 20 results.

| # | Bill — ask | Flag OFF (= production today) | Flag ON |
|---|---|:-:|:-:|
| 1 | Illegal Migration — detention amendments | 2/3 (rolls 1,3) | 3/3, rank 1 |
| 2 | Nationality and Borders — Report amendments | 0/3 | 3/3, rank 1 |
| 3 | Safety of Rwanda — Commons reasons amendments | 0/3 | 3/3, rank 6 (bill itself rank 1) |
| 4 | Pension Schemes — bill text | 2/3 (roll 1 missed) | 3/3, rank 1 |
| 5 | Mental Health — Explanatory Notes | 3/3 | 3/3 |
| 6 | Institute for Apprenticeships — DPM | 0/3 | 3/3 |
| 7 | Border Security — written evidence | 0/3 | 3/3 |
| 8 | Border Security — Human Rights Memorandum | 3/3 | 3/3 |
| 9 | Pension Schemes — impact assessment | 0/3 | 3/3 |
| 10 | Mental Health — Keeling schedule | 3/3 | 3/3 |
| | **Majority of rolls (≥2/3)** | **5 of 10** | **10 of 10** |

- **vs 24 Sep: 5 of 10 → still 5 of 10 in production.** Same count, not quite the same set: S23 missed 1, 2, 3, 7, 9; today's majority misses are 2, 3, 6, 7, 9. #1 now hits on 2 of 3 rolls and #6 on none, and #4 misses one roll, so the router is flaky on these rather than stable. The count is a coincidence of the rolls, not a change. Zero `failed` runs; the retrieval leg was live.
- The ON-arm misses are gone because the router now names `legislation` (e.g. #2 routed `debates` only when off, `legislation` only when on); the OFF failures are all `debates`/`committees`-only routes, as in S23.
- **Not re-measured:** the regression cost (S24: 8/68 vs 3/68 noise floor). Flipping is still Charlie's call on that trade-off; C5's loss is the open sub-question S24 named.
- **Caveats:** questions are paraphrases, not S23's literal text; "right bill" matches by title substring, so Mental Health / Pension Schemes cover every bill of that name held (82 and 109 rows); the type filter is by name regex per question.

## 2. Official amends/repeals function — **No, not landed**

- **Web app / Lex: nothing.** `lib/lex/statutory-graph.ts` still reads only `citation_edge` (`inboundFor`); `legislation_edges` appears there solely as a coverage *count* (`amendment-effects` layer, status `held-elsewhere`). The only other web reference is a check script. No Lex tool, no route, no search path reads the amends/repeals rows.
- **Graphs stream:** no commit touches `scripts/ingest/graph/` after 9 Sep (files' newest mtime 14 Sep), none touches `statutory-graph.ts` since S23. The one existing reader, `scripts/ingest/graph/traverse-edges.ts` (`impactSet`: `amendedBy`, `repealedBy`, `commencedBy`, `targetTouches`), dates from the 5 July Tier-1 commit and uses a raw `pg` Pool. S23 step 1 (a query function beside `inboundFor`) has not been done. It cannot be imported into the web app (CLAUDE.md §20 check 0).
- **So the counts below are from a direct SQL read, not a function call.** Equality Act 2010 (`ukpga/2010/15`) and Human Rights Act 1998 (`ukpga/1998/42`), matched on `split_part(to_id,':',2)`:

| Inbound (this Act is the target) | Equality Act 2010 | Human Rights Act 1998 | Source of every row |
|---|--:|--:|---|
| **amends** | 705 | 35 | `tna-bulk-amendments` — legislation.gov.uk's own record |
| **repealed-by** (`repeals`) | 90 | 11 | `tna-bulk-amendments` — official |
| **modified-by** (`modifies`) | 16 | 42 | `tna-bulk-amendments` — official |
| commences | 765 | 10 | `tna-bulk-amendments` — official |
| made-under (SIs) | 206 | 85 | `clml-si-preamble` — **our own extraction** from preamble prose |
| cites | 61 | 28 | `clml-body-citation` — **our own extraction** from TNA `<Citation>` markup |

Outbound (what the Act itself touches): EqA amends 58, modifies 12, repeals 45 (+15 `tna-inforce-dataset`), cites 4; HRA amends 6, modifies 14, repeals 1 (+1 inforce).
- **Read these counts carefully:** `edge_type='amends'` also carries non-textual effects in `sub_type` (e.g. HRA s.3 rows are `excluded`; EqA's SI rows are `applied by … (as amended)`). A tool must return `sub_type`, or "705 amendments" overstates textual change. Counts are rows (one per from/to/type pair, at provision grain), not distinct amending instruments.
- **Provenance:** all amends/repeals/modifies/commences/in-force rows are TNA's own effects feed (`research.legislation.gov.uk` bulk `ukm:Effect` and the In-Force dataset); only `made-under` and `cites` are our extraction.

## 3. Freshness — **not refreshed since 5 July**

- `legislation_edges`: 2,348,993 rows, **newest `extracted_at` 2026-07-05 16:52 UTC**; oldest 2026-07-05 16:26; **every row is from that single day**. Row count and per-type counts are identical to S23's table (e.g. amends 1,015,960; repeals 215,312 + 107,034).
- No Ingest refresh has run: **98 days** at the time of reading. No commit to the graph or ingest code that writes the table exists since.
- It is older than that in substance: the Tier-1 notes record the bulk effects vintage as secondary legislation daily but **primary/EU as of 2025-10-30**, so primary-Act effects may be ~11 months behind the statute book. Anything enacted or amended after those dates (including Acts of the 2025–26 session) is absent.
- `citation_edge` and caselaw tables have newer dates (Aug–Sep) but are a different layer.

## 4. Structured Bills-API amendments — **not fetched**

- No ingest script calls `GET /Bills/{id}/Stages/{stageId}/Amendments` to store anything; the only callers are three graph-stream *probes* and one divisions probe (`take` 3–40, print or write a document, no DB insert).
- Row count: **0**. No table exists (`LegislationAmendment` has 0 rows and is the TNA-section model; `Amendment` has 0 rows and is the product's idea-amendment model). Bills covered: **0**.
- The PDF layer is unchanged since S23: `bills-api` 6,574 rows / 423 bills, newest `createdAt` 2026-06-16.
- S23's estimate stands unchanged (≈3,500 calls, 30–45 min, $0, tens of thousands to low hundreds of thousands of records, licence OPL3 already mapped).

## 5. Tool definition for the replacement Lex

```jsonc
{
  "name": "statute_effects",
  "description": "Return the recorded legislative effects on an Act or one provision: what amended, repealed, modified, commenced, or was made under it, and what it does to other Acts. Read from a stored copy of legislation.gov.uk's changes record, not live. Always read the `freshness` field before stating anything as current.",
  "input_schema": {
    "type": "object",
    "properties": {
      "act": { "type": "string", "description": "legislation.gov.uk id, e.g. 'ukpga/2010/15'. A full URL or a pre-1963 regnal form is accepted and normalised." },
      "provision": { "type": "string", "description": "Optional, e.g. 'section-149'. Matches the section, its subsections and lettered insertions (section-149-2, section-149A), not section-1490." },
      "direction": { "type": "string", "enum": ["inbound", "outbound", "both"], "default": "inbound" },
      "edge_types": { "type": "array", "items": { "enum": ["amends", "repeals", "modifies", "commences", "made-under", "cites"] }, "default": ["amends", "repeals", "modifies"] },
      "limit_per_type": { "type": "integer", "default": 100 }
    },
    "required": ["act"]
  }
}
```

**Output** (one object):

```jsonc
{
  "target": { "act": "ukpga/2010/15", "provision": null, "title": "Equality Act 2010" },
  "counts": { "amends": 705, "repeals": 90, "modifies": 16 },        // true totals, even when rows are capped
  "truncated": { "amends": true },                                   // set when limit_per_type cut a type
  "rows": [{
    "direction": "inbound",
    "edge_type": "amends",                                           // amends | repeals | modifies | commences | made-under | cites
    "sub_type": "words substituted",                                 // REQUIRED: 'excluded', 'applied by …' are not textual amendments
    "other_end": { "act": "ukpga/2024/15", "provision": "schedule-4", "title": "…" },
    "this_end_provision": "schedule-19",
    "granularity": "section-section",
    "source": "tna-bulk-amendments",
    "provenance": "official",                                        // official = legislation.gov.uk's own effects/in-force record
                                                                     // extracted = our parse (made-under, cites); say so when quoting
    "extracted_at": "2026-07-05T16:29:08Z"
  }],
  "freshness": { "newest_row_at": "2026-07-05T16:52:32Z", "age_days": 98, "stale": true, "caveat": "…" },
  "coverage": "Official-record rows only; Bills-API amendments are not included."
}
```

**Implementation notes (from this report, not new work):** query `legislation_edges` with `split_part(to_id,':',2) = ANY(candidates)` (the table's gid expression indexes), reusing `gidCandidates()` and `provisionPredicate()` from `statutory-graph.ts` and the `legislation_identity` bridge for regnal forms (63,520 rows hold them). `age_days` and `stale` are computed from `MAX(extracted_at)` at call time. No figure is written into the caveat (check:statutory rule). `made-under` must stay labelled `extracted`, never `official`.

**The one-sentence caveat the output must carry when stale** (generated from `freshness`, not hard-coded):

> "This is a stored copy of legislation.gov.uk's changes record last refreshed on {newest_row_at:date} ({age_days} days ago), so it will not show amendments, repeals or commencements made since then — check legislation.gov.uk before relying on it as current."

Mark stale at a threshold the Lex stream chooses (the graph's own `FRESHNESS_DAYS` is 30). On today's data every call is stale.

## 6. What this leaves open (decisions, not work done)

1. **Flip `LEX_ROUTER_BILL_VOCAB`?** Gain is real (5→10 of 10); the cost is S24's. Decide on C5.
2. **Graphs stream:** the step-1 reader (§2) is a short job and unblocks the tool above; refreshing the effects data (§3) is Ingest's and is the larger caveat.
3. **Structured bill amendments:** unstarted; S23's cost estimate applies.
