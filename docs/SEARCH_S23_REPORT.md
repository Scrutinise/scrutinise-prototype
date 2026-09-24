# SEARCH S23 — amendments, ingested versus reachable

*Report only. No fixes applied, no files under `scripts/ingest/search/` touched (checked — the
directory's mtimes are unchanged by this sprint's work; measurements only). Graph tables
(`legislation_edges`, `citation_edge`, `caselaw_case_edge`, `caselaw_treatment_edge`) belong to the
graphs conversation and were read, never written.*

**Why this sprint exists:** twice now "we don't hold it" turned out to be "we hold it and no
stream returns it". This report measures the two separately, with real queries against production
data, before Charlie is asked to accept a gap.

---

## §1 — Bills, ingested

`corpus_sections` holds **6,574 bills-api rows** across **423 distinct bills** (of 4,055 the Bills
API lists overall). All compiled rows are `format='pdf'`; 39 rows are `status='unavailable',
availability_status='pdf-only'` (the PDF served but no extractable text).

### The type is not a column — it has to be rejoined from the API

`sectionTitle` is **not** the publication type. `processBills()` in
`scripts/ingest/workers/process-row.ts` never captured `publicationType` at ingest time — the
enqueue step drops it, and `sectionTitle` was later backfilled to the bill's *display title*
(`billDisplayTitle()` — name + status, e.g. *"Mental Health Act 2025 — Bill papers, became an
Act"*), which is identical for every publication under one bill. **There is no column in
`corpus_sections` today that tells two rows of the same bill apart by type.** The only place the
type still exists is on the wire, at `Bills/{billId}/Publications`, keyed by the `pubId`/`docId`
pair embedded in `sourceUrl`.

So "count bills-api rows by publication type, taken from the source's own field" required
rejoining live: for each of the 423 held bills, re-fetch `Publications` (JSON only, no PDFs, one
call per bill, the same 500ms interval `seed-rate-limits.ts` already specifies for this host) and
match `sourceUrl`'s `(pubId, docId)` back to the type the API returns today. 0 fetch failures, 0
unmatched rows.

### Held, by publicationType (423 bills, 6,574 rows)

| n | publicationType |
|---:|---|
| 3,272 | Amendment Paper |
| 1,519 | Written evidence |
| 707 | Bill |
| 272 | Explanatory Notes |
| 247 | Delegated Powers Memorandum |
| 114 | Impact Assessments |
| 106 | Legislative Consent Motions — devolved legislatures |
| 98 | Transcript of evidence |
| 56 | Human rights memorandum |
| 35 | Bill (with Explanatory Memorandum) |
| 33 | Other documents |
| 32 | Select Committee report |
| 21 | Petitioning guidance |
| 11 | Relevant documents |
| ≤7 each | Government report · Petition against the Bill · Tracked changes (Lords) · Selection of amendments: Commons · Briefing papers · Keeling schedules · Committee report · Tracked changes (Commons) · Report on the Environmental Statement · Library Notes · one-off types (9 more, 1 row each) |

**Amendment Paper is the single largest category we hold — not absent.** §3 below is about a
*different, structured* amendment data source the API also offers, which we do not hold any of.

### Completeness

**Row-level, for the 423 bills we already hold something from: 6,574 / 6,768 = 97.1%.** The API
reports 6,768 PDF publications across exactly these bills today; we hold 97.1% of them. The 2.9%
gap is not further broken down here — it was not this sprint's question, and doing so would mean
re-diffing 423 publication lists against 6,574 stored ids, which is a worthwhile small follow-up
but a different one.

**Bill-level completeness, full population** (denominator = the whole Bills API, all 4,055 bills,
not just the 423 held — 4,055 JSON calls, 0 fetch failures, ~40 minutes at the existing 500ms
courtesy interval):

| publicationType | held | API-wide total | completeness |
|---|---:|---:|---:|
| Amendment Paper | 3,272 | 3,444 | 95.0% |
| Written evidence | 1,519 | 1,633 | 93.0% |
| Bill | 707 | 735 | 96.2% |
| Explanatory Notes | 272 | 280 | 97.1% |
| Delegated Powers Memorandum | 247 | 260 | 95.0% |
| Impact Assessments | 114 | 124 | 91.9% |
| Legislative Consent Motions | 106 | 109 | 97.2% |
| Transcript of evidence | 98 | 102 | 96.1% |
| Human rights memorandum | 56 | 60 | 93.3% |
| Select Committee report | 32 | 32 | 100% |
| Petitioning guidance | 21 | 21 | 100% |
| Keeling schedules | 4 | 5 | 80% |
| Committee report | 3 | 4 | 75% |
| **ALL bills-api publications** | **6,574** | **6,935** | **94.8%** |

**The gap is not concentrated on amendments, or on any one type.** Every substantial category sits
at 91–100% complete; the two categories below 90% (Keeling schedules 80%, Committee report 75%)
are each missing exactly one row, out of four and five respectively — noise at that count, not a
pattern. **§2's finding stands on firmer ground for it: the reachability gap measured there is a
routing defect, not a coverage one — the corpus is genuinely, uniformly ~95% complete on the
publication type §2 tested.**

---

## §2 — Bills, reachable

Ten questions whose answer is a specific held bill publication, at least three about amendments,
chosen against **real, verified** rows (not hypothetical ones) — including the brief's own example,
the Illegal Migration Bill, confirmed held with 35 Amendment Paper publications before it was used
as a test case.

Three layers, same query, same moment:

1. **bills-api alone** — `runFtsSearch(query, N, { corpora: ['bills-api'] })`, BM25 only, scoped to
   nothing but the 6,574 rows.
2. **the legislation stream** — `STREAMS.find('legislation').search(query, N)`: the real fused
   (BM25 + dense, per production's live weights) retrieval for the whole `legislation` tier plus
   `bills-api` as its `extraCorpora` leg — exactly what `query-router.ts` runs when the router picks
   `legislation`.
3. **the full product** — `runSearch({ keywords, intent: 'AD_HOC_RESEARCH' })`, i.e. the same
   gateway function every Lex surface calls, with **production's live capability-flag string read
   directly off `/api/health`** at measurement time (not assumed, not last sprint's values):

   ```
   LEX_QUERY_EXPANSION=true  LEX_QUERY_ROUTER=true  LEX_WEB_ORIENTATION=false
   LEX_SEARCH_VECTOR=true    LEX_SEARCH_RERANKER=true  LEX_TIER_FUSION=true
   LEX_STATS_STREAM=true     LEX_SEARCH_JUDGED_MERGE=true  LEX_SEARCH_GRAIN=false
   LEX_VECTOR_STREAMS=caselaw,committees,debates,guidance,legislation
   commit 946bfca4  (production, read at measurement time)
   ```

A "target" for each question is not one guessed row: it is every corpus_sections row for that bill
whose rejoined `publicationType` matches the question, so a hit anywhere in that set counts.

### Results

| # | Question (bill) | Amendment? | bills-api alone | legislation stream | **full product** | Classification |
|---|---|:-:|---:|---:|---:|---|
| 1 | Illegal Migration Bill — detention amendments | ✓ | 1 | 1 | **not found** (60 returned; router → `debates`) | held but not routed |
| 2 | Nationality and Borders Bill — Report stage amendments | ✓ | 3 | 1 | **not found** (120; router → `debates, committees`) | held but not routed |
| 3 | Safety of Rwanda Bill — Commons reasons amendments | ✓ | 1 | 1 | **not found** (60; router → `debates`) | held but not routed |
| 4 | Pension Schemes Bill — bill text (Commons amendments) | | 2 | 1 | **1** (router → `legislation`) | reachable |
| 5 | Mental Health Bill — Explanatory Notes | | 1 | 15 | **1** (router → `legislation`) | reachable |
| 6 | Institute for Apprenticeships Bill — Delegated Powers Memorandum | | 1 | 2 | **1** (router → `legislation, debates, committees, guidance`) | reachable |
| 7 | Border Security, Asylum and Immigration Bill — written evidence | | 2 | 1 | **not found** (60; router → `committees`) | held but not routed |
| 8 | Border Security, Asylum and Immigration Bill — Human Rights Memorandum | | 76 | 3 | **2** (router → `legislation, debates, committees, guidance`) | reachable |
| 9 | Pension Schemes Bill — Impact Assessment | | 9 | 3 | **not found** (120; router → `committees, guidance`) | held but not routed |
| 10 | Mental Health Bill — Keeling schedule (amendments to the Mental Health Act 1983) | | 1 | 1 | **1** (router → `legislation`) | reachable |

**10 of 10 held. 10 of 10 reachable once the legislation stream is searched directly (rank ≤ 15,
usually rank 1). Only 5 of 10 reachable through the full product.**

**Zero "not held". Zero "routed but out-ranked".** Every miss in this sample is the same
mechanism: **the router never selects `legislation`.** `bills-api` is correctly wired into that
stream's `extraCorpora` leg (`stream-scopes.ts`) and `CORPUS_REACHABILITY.md` already marks
`bills-api` "reachable" on that basis — correctly, as a structural fact. What that document cannot
show, because it doesn't run the router, is that **structurally reachable and actually routed to
are different claims**, and for this vocabulary they diverge exactly half the time.

**All 3 of 3 amendment questions failed at the router.** "What amendments were tabled…" reads to
the router as a parliamentary-proceedings question (`debates`/`committees`), not a legislation
question — even though the actual amendment paper lives in the legislation stream and ranks 1st or
3rd there every time it was tested. Two non-amendment questions failed the same way for the same
reason: "written evidence submitted on [a bill]" routes to `committees` (which holds a much larger,
general committees-evidence collection) and "impact assessment for [a bill]" routes to
`committees, guidance`, in both cases never touching `legislation` at all.

---

## §3 — Amendments not held

Amendment **papers** (PDF marshalled lists) are held — §1 shows 3,272 of them. What is **not**
held, and does not overlap with anything above, is the Bills API's separate **structured**
amendments endpoint: `GET /api/v1/Bills/{billId}/Stages/{stageId}/Amendments`. No ingest script in
this repository calls it (checked: zero hits for `Stages.*Amendments`, `amendmentId` or
`marshalledListText` in `scripts/`).

**What it provides, confirmed live** (Illegal Migration Bill, Committee stage, `billStageId`
17508):

```json
{
  "summaryText": ["Clause 2, page 2, line 32, leave out \"must\" and insert \"may\""],
  "amendmentId": 10006276, "clause": 2, "pageNumber": 2, "lineNumber": 32,
  "decision": "NoDecision", "decisionExplanation": "The House has not considered this amendment.",
  "sponsors": [{ "name": "Alison Thewliss", "party": "Scottish National Party",
                 "memberFrom": "Glasgow Central", "isLead": true }, "…"]
}
```

- **Text** — `summaryText`: the actual proposed wording, plus clause/schedule/page/line.
- **Sponsor** — `sponsors[]`: name, party, constituency, lead/co-sponsor, per amendment.
- **Decision** — `decision` + `decisionExplanation`. Confirmed non-trivial values live, sampled
  from the Safety of Rwanda Bill's Committee stage (100 amendments): `NotMoved` ×79, `Withdrawn`
  ×15, `StoodPart` ×3 — so `Agreed`/`Negatived` etc. are real states this field carries, not just
  the placeholder `NoDecision` the pilot call above happened to show.
- **Stage** — `billStageId`, joined back to `Bills/{billId}/Stages` for the stage description
  ("Committee stage", "Report stage", house).

**Volume, estimated (this sprint did not enumerate every stage of every bill — that is a second
multi-thousand-call sweep on top of §1's, and out of scope for a report).** One contentious bill
alone (Illegal Migration Bill) carries 330 / 216 / 332 / 194 amendments across just 4 of its ~14
stages — comfortably four figures for that bill alone. Most of the 4,055 bills are uncontentious
Private Members' Bills with zero amendments at any stage; volume concentrates heavily in the
government bills we already hold (the same 423). **Order-of-magnitude estimate: tens of thousands
to low hundreds of thousands of individual amendment records for the currently-held bills** —
wide, deliberately, because the true distribution is dominated by a handful of bills like this one
and this sprint measured one of them, not the shape of the whole tail.

**Licence:** same host, same family — `licence-map.ts` already maps `'bills-api': OPL3`. No new
licence question.

**Ingest cost, estimated:** pure JSON, no PDF fetch/text-extraction. One call per (bill, stage)
pair; ~423 held bills × ~8 stages average ≈ 3,500 calls at the existing 500ms courtesy interval ≈
30–45 minutes, one-time, $0 in API cost. Storage: `summaryText` + `sponsors[]` per row is metadata-
scale (order of 1–2 KB/row), so even at the high end of the volume estimate this is tens to low
hundreds of MB — well inside the Neon headroom §17 tracks, and not a "compiled body text" object
that architecture rule would route to R2 instead.

---

## §4 — Consequential amendment schedules

Five Acts with large consequential-amendment schedules, checked directly in `corpus_sections`:

| Act | schedule sections | schedule words | `parentDocId` populated | `sectionTitle` populated |
|---|---:|---:|---:|---:|
| Equality Act 2010 | 326 | 40,130 | 0 / 326 | 0 / 326 |
| Constitutional Reform Act 2005 | 880 | 70,364 | 0 / 880 | 0 / 880 |
| Legal Aid, Sentencing and Punishment of Offenders Act 2012 | 695 | 50,131 | 0 / 695 | 0 / 695 |
| Police, Crime, Sentencing and Courts Act 2022 | 270 | 24,364 | 0 / 270 | 0 / 270 |
| Criminal Justice Act 2003 | 1,626 | 76,050 | 0 / 1,626 | 0 / 1,626 |
| Coroners and Justice Act 2009 | 332 | 40,394 | 0 / 332 | 0 / 332 |

**This confirms, directly, the S17 detail folded into this brief: `parentDocId` and `sectionTitle`
are both NULL on every legislation schedule row, across all six Acts, with no exceptions.**
Sectioning itself is fine-grained — each schedule paragraph is its own row
(`primary-acts-2000plus:{gid}:schedule-N-paragraph-M`) — so the *unit* is not the problem; the
*labelling* is. A legislation row's title/citation is derived at query time from the gid (the
**containing** Act), never from `parentDocId` (there is none) and never from the amended Act's
name, even when that name is the whole content of the paragraph.

### Does a query naming the amended Act return the schedule that amends it?

Six real, text-confirmed cases (fetched the actual R2 paragraph text before writing each query, so
the query is grounded in what the paragraph actually says — not a guess):

| Amending Act § paragraph | Actually amends | Query tried | BM25-only (legislation-scoped) | Fused legislation stream |
|---|---|---|---:|---:|
| Constitutional Reform Act 2005, Sch 4 ¶307 | Finance Act 2003, Sch 17 | "what amendments does the Finance Act 2003 Schedule 17 receive about General and Special Commissioners appeals" | not found | not found |
| (same) | (same) | "Finance Act 2003 stamp duty land tax appeals amendment" | not found | not found |
| Criminal Justice Act 2003, Sch 3 ¶20 | Crime and Disorder Act 1998, Sch 3 | "amendments to the Crime and Disorder Act 1998 procedure for sending persons for trial" | not found | not found |
| (same) | (same) | "Crime and Disorder Act 1998 section 51 sent for trial amendment" | not found | not found |
| Police, Crime, Sentencing and Courts Act 2022, Sch 18 ¶6 | Sexual Offences Act 2003, s.136ZF | "Sexual Offences Act 2003 section 136ZF variation renewal discharge sexual harm prevention order Scotland" | not found | not found |
| Coroners and Justice Act 2009, Sch 21 ¶90 | Road Traffic Offenders Act 1988, s.34 | "Road Traffic Offenders Act 1988 section 34 disqualification extension period amendment" | **rank 91** | **rank 91** |

**5 of 6 do not surface at all. The 6th surfaces at rank 91** — beyond any cutoff a real product
would ever show a user (the platform's own working assumption is "at least 20 from each source").
Even the second phrasing of each of the first two cases — built from words taken directly out of
the paragraph's own text — did not recover it. **The mechanism is not that the text is missing or
mistagged; it is that one 400-word consequential paragraph is competing on plain BM25 against a
1.6M+ section legislation corpus that mentions the same Act names constantly** (Finance Act 2003
has its own substantial body of sections; "section 51" and "Crime and Disorder Act 1998" appear
across thousands of unrelated hits). No structural signal (a "this paragraph amends X" edge, a
title, a parentDocId) currently exists to break that tie in the amended Act's favour.

**So: consequential-amendment schedules are held, correctly sectioned at paragraph grain, and
practically unreachable by the question a reformer would actually ask.**

---

## §5 — What amended what (graph tables — read only)

### The tables, as they stand today

`legislation_edges` — **2,348,993 rows**:

| edge_type | source | n | date range (extracted_at) |
|---|---|---:|---|
| amends | `tna-bulk-amendments` | 1,015,960 | 2026-07-05 |
| commences | `tna-bulk-amendments` | 477,946 | 2026-07-05 |
| made-under | `clml-si-preamble` | 230,681 | 2026-07-05 |
| repeals | `tna-bulk-amendments` | 215,312 | 2026-07-05 |
| modifies | `tna-bulk-amendments` | 180,781 | 2026-07-05 |
| cites | `clml-body-citation` | 121,279 | 2026-07-05 |
| repeals | `tna-inforce-dataset` | 107,034 | 2026-07-05 |

`citation_edge` — **2,514,436 rows** (a separate, finer-grained, quote-carrying table — see below):

| detection | source_type | n | extracted_from |
|---|---|---:|---|
| caselaw-markup | caselaw | 1,288,630 | `tna-caselaw:akn-ref@2026-09-08` |
| text | SI | 445,243 | `best-collection-xml.zip@2026-08-26` |
| markup | SI | 348,373 | (same) |
| text | primary | 202,634 | (same) |
| enabling | SI | 191,258 | (same, separate extraction pass, 2026-08-28) |
| markup | primary | 22,810 | (same) |
| markup | other | 14,163 | (same) |
| text | other | 1,325 | (same) |

`caselaw_case_edge` (565,931 rows) and `caselaw_treatment_edge` (1,749 rows) exist too, but are
case-to-case, not legislation-to-legislation — out of this section's scope.

### Official record versus our own reading

- **`amends` / `commences` / `repeals` (`tna-bulk-amendments`, `tna-inforce-dataset`) — legislation.gov.uk's OWN changes/in-force record.** Bulk `ukm:Effect` data, TNA's structured feed, not
  derived by us from prose.
- **`cites` (`legislation_edges`, `clml-body-citation`) and `markup`-detection rows in
  `citation_edge`** — extracted BY US, but from TNA's OWN structured `<Citation>` markup in the
  bulk CLML, not free-text guessing. High-precision (`resolved` 74–83% typically, vs `text` rows
  below).
- **`made-under` (`legislation_edges`) and `enabling` (`citation_edge`)** — our own parsing of SI
  preamble prose ("made under section N of..."). Structured extraction of free text, not TNA's own
  markup, and not TNA's own record either.
- **`text`-detection rows in `citation_edge`** — our own free-text pattern matching over body
  prose resolving an Act *name* to a gid. The lowest-precision tier (`resolved` 84–94%), and
  explicitly labelled apart from `markup` for exactly that reason — the code's own comment: *"the
  target id is derived, not read from the document — never quote the target as the source's own
  words."*

### Which callers reach them today

Traced by import graph, not assumption:

| Caller | Reaches `legislation_edges` / `citation_edge`? |
|---|---|
| **Lex chat** (`app/api/ai/[ideaId]`, general-chat) | **No.** Zero references anywhere under `app/`. |
| **Search** (`fts-search.ts`, `vector-search.ts`, `query-router.ts`, `search-gateway.ts`) | **No.** Zero references in the whole retrieval stack. |
| **The consequences pass** (`lib/lex/statutory-consequences.ts`) | **Yes** — it's the one caller. |
| **The build** | **Yes, indirectly** — `build.ts` imports `deepening.ts`/`deepening-adversarial.ts`, and the Deepening calls `statutory-consequences.ts` → `statutory-graph.ts`'s `inboundFor()`. |

**And even that one path does not surface the richest edge kind.** `inboundFor()` — the function
the Deepening actually calls — queries `citation_edge` only:

```sql
SELECT source_doc_uri, source_gid, source_provision_ref, citation_text, source_type, detection, target_provision_ref
FROM citation_edge WHERE target_act_id = ANY($1::text[])
```

`legislation_edges` (the amends/repeals/commences/modifies table — the one sourced from
legislation.gov.uk's own official record, 1,899,999 rows) is referenced elsewhere in the same file
**only for a coverage count**, with the gap stated explicitly in the code's own comment:

> *"TNA's own amends / repeals / commences / modifies data is not in `citation_edge` at all.
> Without this line the coverage statement would have implied the answer included them."*
> *"a repeal or an amendment is not a citation and is not returned by this query."*

So today: a build can learn *that* an Act has N amendment-effect rows recorded elsewhere (a
coverage narrative), but the one live code path that reaches the graph tables at all never returns
the actual amends/repeals *edges* — the specific "Act X, section Y amends Act Z, section W" facts
— to anything. `evidence-labels.ts`'s consumers (`agenda.ts`, `question-panel.ts`,
`DeepeningPanel.tsx`) are all post-build display of what the Deepening already computed, not a
second live path.

---

## §6 — Recommendation

**The smallest change that lets a proposal answer "what else does this touch?" from Lex chat**,
in the order it has to happen, each step usable on its own:

1. **Owner: graph.** Add one query function beside `inboundFor()` in `statutory-graph.ts` that
   reads `legislation_edges` for a target gid and returns the actual rows —
   `SELECT edge_type, sub_type, from_id, detail FROM legislation_edges WHERE to_id = ANY($1)`,
   reusing the existing `gidCandidates()` matching `inboundFor` already does for `citation_edge`.
   No schema change, no new extraction, no reindex — the table, the ids and the candidate-matching
   logic all already exist and are already proven at scale (`graphCoverage()` already counts this
   table; nothing here asks it to do more than also *read* it).

2. **Owner: search.** Wire that function into a path Lex chat can call **directly**, not through
   FTS/vector retrieval — this is a structured DB join keyed on a gid the idea already cites, not a
   text search, so it sidesteps §2's router problem entirely rather than needing it fixed first.
   Smallest shape: a new capability, invoked when the chat turn resolves to a specific Act/section
   the idea references, returning "this also amends/is amended by/repeals/is repealed by…" with the
   provenance from §5 attached (official TNA record vs our own extraction) so Lex can say which
   kind of fact it's stating.

3. **Owner: search.** Independently, fix the routing gap §2 measured: the router prompt needs
   explicit examples naming bill-publication vocabulary — "amendments tabled", "marshalled list",
   "written evidence submitted on [a bill]", "impact assessment for [a bill]" — as `legislation`-
   stream triggers. This is a prompt change only, no index/reindex/schema work, and it is what turns
   §2's 5-of-10 into something closer to 10-of-10 for ordinary chat use, independent of step 2.

Step 1 and 2 answer "what else does this touch" for the amends/repeals relationship specifically —
the one the code's own comment already flags as the gap. Step 3 is unrelated but sits in the same
report because it's the same failure shape: real data, real relevance, never routed to.

---

*(Population-wide completeness sweep for §1, launched at the start of this sprint's measurement
window, appended below once complete — see placeholder above.)*
