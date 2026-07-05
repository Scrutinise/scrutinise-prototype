# Tier-1 Legislation Graph — Audit + Build Report

*Sprint: explicit-edge legislation graph + rescission traversal. 5 Jul 2026.*
*Code: `scripts/ingest/graph/` (ingest-side only, per parallel-thread discipline).*

---

## 1. Audit — what we already held (bytes inspected before any build)

Per-edge-type coverage of the sources named in the brief, verified against live
Neon rows, live R2 objects, and the on-disk bulk ZIP — not docs.

### 1.1 CLML citation markup "in the XML we already hold" — premise REFUTED for the fragments

The per-section `raw.xml` objects the corpus ingest stored (TNA per-provision
`data.xml` output) carry **no `<Citation>` markup at all**. 30 random legislation
fragments across 5 corpora: 0 `<Citation>`, 0 `<CitationSubRef>` (30 `<CommentaryRef>`
pointers whose `<Commentary>` definitions live only in whole-doc CLML, which the
fragment fetch never stored). A targeted probe of 14 explicitly *amending*
provisions (sectionTitle "Amendment of …") confirmed it: act names are **plain
text** in the stored XML ("The Charities Act 2011 is amended as follows").

**Where citation markup DOES exist:** whole-document CLML. The 1.4 GB
`best-collection-xml.zip` (132,017 docs, research.legislation.gov.uk, 14 May 2026)
is still on disk at `scripts/legislation/v276-bulk/`. Sampled whole-docs:
Equality Act 2010 = 1,162 `<Citation>` + 2,765 `<CitationSubRef>` (URI + Year/Number/Class/Title
attributes; SubRefs carry `SectionRef` matching corpus_sections section refs).
That ZIP — data we already hold — is the cites source.

### 1.2 Effects / changes data — captured for 3,590 acts only; bulk fills the gap

- Legacy pipeline (`scripts/legislation/ingest.ts`) fetched the TNA Changes API
  per act to R2 `{gid}/effects.xml` — **3,590 of 11,768 UKPGA only** (`LegislationItem.effectsKey`),
  nothing for UKSI/regional/EU. Fetched Apr 2026.
- Current corpus pipeline has effects-capture *code* (`tna-legislation.ts` →
  `effects/{gid}/effects.xml` + a `format='effects'` corpus_sections row) but
  **zero effects rows exist in corpus_sections** — the path never fired for the
  ingested legislation corpora.
- **Bulk source verified working (HEAD + sample download, 5 Jul 2026):**
  research.legislation.gov.uk `amendments/to-{type}` ZIPs (HTTP Basic
  `research:n3w_s!te`, OGL v3). Same `ukm:Effect` schema as the API feed,
  section-granular both sides, pre-paginated. **Vintage split:** secondary types
  (uksi/ssi/nisr/wsi) regenerate daily (5 Jul 2026); primary + EU types last
  regenerated **30 Oct 2025**. Effects deployed since then for primary/EU targets
  are missing until TNA refreshes — supplement later via the per-act Changes API
  (code already exists) if recency matters before then.

### 1.3 SI preambles (made-under) — never captured per-section; present in the bulk ZIP

Neither ingest generation stored preambles: the corpus section splitter matches
only `P1|Article|Regulation|Rule|Paragraph|Section` elements, so
`<SecondaryPreamble>/<EnactingText>` was dropped; no preamble-ish section refs
exist in any legislation corpus (checked). The whole-doc CLML in the bulk ZIP
has them: enacting text names the enabling sections in prose, and its
`<FootnoteRef>` footnotes carry `<Citation URI>` = the enabling act gid
(verified on uksi/1995/1). Caveat: *revised* SIs (~8% of SIs) may have the
preamble TNA-elided ("…dots…") — counted, act-level edge unavailable for those
unless the made version is fetched later.

### 1.4 Existing graph structures

`LegislationCrossRef` / `LegislationAmendment` exist in the Prisma schema but are
**empty (0 rows)** design scaffolds on the deprecated `Legislation*` family
(slated for DROP per V26 runbook) — ignored. Nothing else graph-shaped exists.
Reused instead: the query-time citation resolver (`search/citation-resolver.ts`,
act-title → gid over 135,531 `LegislationItem` rows) for scoring, and the
corpus id scheme `{corpus}:{gid}:{sectionRef}` for edge ids.

### 1.5 Size constraint

Neon measured **15 GB** at sprint open (corpus_sections 13 GB) against the
17.5 GB alert line. The edge table was budgeted accordingly; every extractor
pilots and extrapolates volume before its full load (§3).

---

## 2. Build

One Neon table + four extractors + traversal + service + scorer, all
resumable/idempotent (per-unit checkpoint files + `ON CONFLICT DO NOTHING` on
the PK `(from_id, to_id, edge_type, sub_type)`).

```
legislation_edges (from_id, to_id, edge_type, sub_type, source, granularity, detail, extracted_at)
  from = actor (affecting / citing / made instrument)   to = target (affected / cited / enabling)
  ids in the corpus_sections scheme: {corpus}:{gid}[:{sectionRef}]; docs no corpus holds → external:{gid}
  edge_type: amends | repeals | commences | modifies | cites | made-under
  sub_type:  normalised raw ukm Type ("words substituted", …) for D4-style "what changed"
  detail:    commences/repeals → "date|qualification|applied" (in-force facts); made-under → powers phrase
  indexes:   (split_part(from_id,':',2), edge_type) and (split_part(to_id,':',2), edge_type)
```

| file | role |
|---|---|
| `graph/graph-common.ts` | gid↔corpus map, URI parser, effect-type buckets, batched insert |
| `graph/setup-edges-table.ts` | DDL + `--status` (row counts + size) |
| `graph/download-graph-sources.ts` | 9 amendments ZIPs (~330 MB) → `graph/data/` (gitignored) |
| `graph/extract-effects-edges.ts` | amends/repeals/commences/modifies from bulk effects XML |
| `graph/extract-madeunder-edges.ts` | made-under from SI SecondaryPreamble in the bulk CLML zip |
| `graph/extract-cites-edges.ts` | cites from body `<Citation>` markup (Commentaries/Footnotes/Preamble excluded — those duplicate effects/made-under); Neon size gate via pilot projection |
| `graph/traverse-edges.ts` | `impactSet(gid, sectionRef?)` — grouped direct + one-hop impact |
| `graph/edges-query-service.ts` | POST /impact, GET /health/stats (mirrors fts-query-service) |
| `graph/score-gold-d.ts` | archetype D re-score through the traversal |

Effect-type normalisation: the ukm `Type` long tail buckets to the brief's edge
set; partial-text deletions ("words omitted") are `amends`, whole-provision
`repealed/revoked/expired` are `repeals`; non-textual `applied/excluded/
restricted/extended/power…` are kept as explicit `modifies` edges (not dropped).
Fan-out cap: an effect affecting >50 provisions collapses to ONE act-level edge
with the provision count in `detail` (counted, not silent).

## 3. Extraction runs (pilot → full, zero silent drops)

All runs on 5 Jul 2026. Every extractor prints an accounting line proving
`inputs = edges-producing + counted-skips`; nothing is dropped silently.

### 3.1 Effects (amends/repeals/commences/modifies) — `tna-bulk-amendments`

- Pilot (27 entries): 5,802 effects → 1.16 edges/effect, all skips accounted,
  size extrapolation inside budget → full run approved.
- Full run: **2,605,737 effects across 1,508 year-files → 2,962,016 edges
  emitted → ~1.89M unique rows** (cross-zip dedupe on the PK collapses the
  to-secondary / fresh to-uksi overlap). Initial run skipped 25,847 URIs
  (1.0%) — byte-inspection showed these are **regnal-year gids** (pre-1963
  acts, `ukpga/Geo6/9-10/80`); the URI parser was extended and the extraction
  re-run idempotently, recovering all but 3,402 (0.13% residual: european-class
  and ancient non-numeric URIs, §5). `SectionRange` provisions (57,046)
  record range start/end sections (interior members not enumerated — see §5).
- Fan-out rule engaged 0 times at the 50-provision cap in the pilot; effects
  affecting many provisions emit one edge per listed `ukm:Section`.

### 3.2 Made-under — `clml-si-preamble`

- Pilot (800 SIs): 3.10 edges/preambled doc; first pass left 5.4% no-target →
  byte-inspection showed indirect enacting words ("the Order of 1978",
  "powers set out in Schedule 1") whose defining citation sits in the preamble
  RECITALS → recital-fallback added (edges flagged `[preamble-recital]` in
  detail) → no-target 0.9% on the pilot.
- Full run: **82,831 unique SI docs → 230,681 edges** (~100k act→act,
  ~130k act→section — the enacting text's "sections 70(1), 105(7) … of" lists
  parsed to section-level targets). Accounting: 70,255 SIs with edges +
  75 no-preamble + **6,108 elided-preamble** (revised SIs where TNA elides the
  enacting words — recoverable later by fetching the made version) + 6,393
  no-target (recital fallback exhausted).

### 3.3 Cites — `clml-body-citation`

- Pilot (2,000 stratified docs): 94% of all `<Citation>` markup sits inside
  `<Commentaries>`/`<Footnote>`/`<SecondaryPreamble>` zones — excluded BY
  DESIGN (those are amendment-provenance/enabling-power citations, already
  captured as effects/made-under edges). Body cites project to ~134k rows —
  far inside the 4M-row Neon gate.
- Full run: **127,296 unique docs → 121,279 cites edges** (3.27M citation
  elements seen; 2.98M in excluded zones; 57k bad URIs = european/… class
  URIs with no UK gid; 0 doc errors). From-side is section-attributed (~98%);
  to-side is act-level in practice — `CitationSubRef` section targets live
  almost entirely inside the excluded commentary zones (11 section→section
  rows survive).
- Engineering note: the first full run OOM'd. Root cause (verified by heap
  instrumentation, then fixed): V8 **sliced strings** — edge ids built from
  regex match groups pinned each multi-MB source document in memory
  (~0.6 MB/doc leaked). `dedupeEdges` now flattens every retained string;
  16 GB/2 GB-free machine also forced heavy runs to be sequential. adm-zip
  (whole-file 1.4 GB Buffer) was replaced with `graph/zip-reader.ts`, a
  ~130-line streaming ZIP64 central-directory reader (pure Node, no new deps,
  TypeScript per docs/CLAUDE.md §14).

### 3.4 In-Force repeals — `tna-inforce-dataset`

TNA changes data starts ~2002; repeals of older instruments (back to 1235)
exist only in the In-Force dataset (local CSVs, dataset vintage ~Aug 2025).
Full load: 441,041 rows → 109,658 repeal-status rows → **~107k act-level
`repeals` edges** (sub_type = raw status incl. jurisdiction variants;
197 no-affecting + 2,426 bad URIs counted — mostly ancient non-numeric gids
like `aep/Hen3/20/stat-merton`, see §5).

### 3.5 Final table (measured 2026-07-05 16:57 UTC)

`legislation_edges` = **2,348,993 rows, ~0.94 GB** including both gid indexes:
amends 1,015,960 · commences 477,946 · repeals 322,346 · made-under 230,681 ·
modifies 180,781 · cites 121,279.
Neon: 15 GB at sprint open → ~16 GB after (17.5 GB alert line — headroom is
thin; anything volume-adding next should re-check `setup-edges-table.ts
--status` first).

## 4. Traversal + gold archetype D re-score

`impactSet(gid, sectionRef?)` groups: madeUnder / citedBy / amendedBy /
repealedBy / commencedBy (inbound), targetTouches (outbound), + one-hop
madeUnder/citedBy over the dependent SIs. Section queries prefix-match
**sub-refs and inserted siblings** (`section-21` also matches `section-21-4`
and `section-21A` — TNA records effects at subsection grain; the Deregulation
Act 2015 amendments to HA 1988 s.21 are invisible without this). Act-level
edges (granularity `*-act`) apply to every section of the target and are
included, honestly, in section-scoped results.

Smoke checks against known truths: HA 1988 s.21 → Deregulation Act 2015
ss.35–40 + Renters' Rights Act 2025 all present; BSA 2022 → 35 SIs made under
it including the Higher-Risk Buildings regulations, each with its enabling
powers phrase in `detail`.

**Gold archetype D (all `floor:true` = 0% for text search), scored by the
gold expected-source patterns over the traversal output haystack:**

| query | target resolved | result |
|---|---|---|
| D1 what amended HA 1988 s.21 since 2015 | ukpga/1988/50:section-21 | **2/2** (Deregulation 2015 ss.33–41 ✓, Renters' Rights 2025 prospective ✓) |
| D2 SIs made under Building Safety Act 2022 | ukpga/2022/30 | **2/2** (act ✓, Higher-Risk Buildings regs ✓) |
| D3 Environment Act 2021 provisions not in force | ukpga/2021/30 | **1/1** (957 commences edges with in-force dates/qualifications in detail) |
| D4 Dangerous Dogs Act 1991 changes + why | ukpga/1991/65 | **3/3** (act ✓, ABCPA 2014 s.106 ✓, XL Bully designation order 2023 ✓ — made-under + amends edges) |
| D5 case law on 'philosophical belief' EqA s.10 | ukpga/2010/15:section-10 | **0/2** — needs case-interprets-section edges, explicitly out of this sprint |

**HEADLINE: D 0% → 80% (8/10 expected sources; 8/8 on the four queries the
Tier-1 edge set covers).** Prediction "D un-floors" confirmed; D5 stays
floored pending case-law extraction (future sprint, as the brief scoped).

Scorer note (`graph/score-gold-d.ts`): targets are derived from the query text
via the production citation resolver, WIDENED with a Title-Case fallback —
`parseCitation`'s ACT_RX mis-anchors on "…made under the Building Safety Act
2022" phrasings. Folding that fallback into the production resolver/router is
a cheap follow-up for archetype A robustness too.

Service: `graph/edges-query-service.ts` (POST /impact {gid, sectionRef?,
depth?, limit?}; GET /health, /stats; default port 8091) mirrors the
fts-query-service pattern; a Railway home can clone fts-serve-run.ts when the
platform needs it — not stood up this sprint.

## 5. Gaps / follow-ups

1. **Vintage**: primary + EU effects files are 2025-10-30 (secondary types are
   daily). Effects deployed Nov 2025–now for primary/EU targets are missing.
   Options: re-download when TNA refreshes, or top up via the per-act Changes
   API (fetch code already exists in `tna-legislation.ts`).
2. **Elided SI preambles** (6,108 revised SIs): fetch `/made` version
   introductions from legislation.gov.uk to recover their made-under edges.
3. **Case-interprets-section edges** (D5): needs case-law citation extraction
   (tna-caselaw LegalDocML) — separate brief per the sprint scope.
4. **SectionRange interiors**: `ss. 33–41` ranges record start/end refs only;
   interior sections match only via act-level fallback. Enumerable if a
   query-time need appears.
5. **Ancient non-numeric gids** (`aep/Hen3/20/stat-merton` class): not parsed
   (~2.4k In-Force rows + some effects skips). Edge ids would not join to any
   corpus anyway; revisit if pre-1700 law matters.
6. **best-collection zip is 14 May 2026**: SIs made since then have no
   made-under/cites edges. A fresh zip re-run is incremental (checkpoints skip
   done gids) — re-download + `--reset` of the two checkpoints when wanted.
7. **Resolver widening**: move the scorer's Title-Case fallback into
   `citation-resolver.ts` (benefits archetype A + the future graph intent
   router).
8. **Prisma model**: `legislation_edges` was created via the ingest path (like
   corpus_sections' extra columns); add to schema.prisma when the web app
   needs typed access.
