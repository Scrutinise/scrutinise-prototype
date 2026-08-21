# Corpus reachability matrix

*Generated 2026-08-20 23:59 UTC by `scripts/ingest/search/corpus-reachability.ts`. Machine-readable
twin: `docs/corpus_reachability.json`. Regenerate rather than edit — every number here is
measured, and a hand-corrected row is a row that will be wrong after the next ingest.*

**The one number.** 18,358,567 of 18,521,164 sections (99.1%) sit in a collection some router stream can select. 0 collections are reachable by no path at all and nobody chose that; 1 is unreachable ON PURPOSE, named in `EXCLUDED_BY_DESIGN` with a reason; 9 surface only when routing is off or has failed open; 0 only via an explicit-tier caller.

⚠ **REACHABILITY IS NOT COMPLETENESS, AND THE NUMBER ABOVE IS ONLY THE FIRST.** A
collection that is 60% ingested and 100% reachable reports as healthy on this table. That
sentence is the whole lesson of V36, and it belongs here rather than somewhere more
tactful: 17,261 instruments — including the Companies Act 2006 and UK GDPR — were absent
for months while this matrix read 99.12%, and they were found by accident. The companion
measurements are **`CORPUS_COMPLETENESS.md`** (does the collection hold what the publisher
publishes) and **`CORPUS_CITATION_GAPS.md`** (does the corpus cite instruments it does not
hold). **Quote all three or none.**

`tier` is read OUT OF THE LIVE FTS INDEX, not computed from `corpus-map.ts` — the tier is
baked in at build time, so a collection seeded after the map last changed carries the old
tier in the index and the router filters on the index. `router_stream` is computed by
`streamCanSelect` from the same `STREAM_SCOPES` the router dispatches on.

| collection | sections | fts_rows | vec_rows | type | tier | router_stream | tier-scoped callers | gold Qs | verdict |
|---|---:|---:|---:|---|---|---|---|---:|---|
| `bills-api` | 6,574 | 6,535 | 31,649 | BILL | parliamentary | legislation | — | — | reachable |
| `building-regs` | 21 | 21 | 27 | GUIDANCE | guidance | guidance | — | — | reachable |
| `cma-cases` | 22,898 | 21,525 | 95,863 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `college-of-policing` | 332 | 332 | 1,446 | GUIDANCE | guidance | guidance | — | — | reachable |
| `committees-evidence` | 142,315 | 140,567 | 702,754 | COMMITTEE | parliamentary | committees | — | — | reachable |
| `committees-reports` | 344,773 | 323,922 | 437,701 | COMMITTEE | parliamentary | committees | — | — | reachable |
| `commons-divisions-votes` | 2,361 | 2,361 | 18,888 | DIVISION | parliamentary | debates | — | — | reachable |
| `consultations` | 7,448 | 7,448 | 8,652 | CONSULTATION | guidance | guidance | — | — | reachable |
| `cps-guidance` | 270 | 270 | 1,519 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `early-day-motions` | 60,737 | 60,737 | 60,737 | DEBATE | other | **NONE** | — | — | deferred-to-graph |
| `echr-hudoc` | 4,460 | 4,410 | 21,883 | CASE_LAW | caselaw | caselaw | — | — | reachable |
| `erskine-may` | 2,038 | 1,873 | 2,130 | GUIDANCE | other | guidance | — | — | reachable |
| `et-decisions` | 293,403 | 293,399 | 504,686 | CASE_LAW | caselaw | caselaw | — | — | reachable |
| `eur-lex` | 241,571 | 241,571 | 439,112 | EU_LEGISLATION | legislation | legislation | 3 legacy | — | reachable |
| `explanatory-memoranda` | 27,428 | 21,984 | 32,991 | EXPLANATORY_NOTE | legislation | legislation | 3 legacy | — | reachable |
| `explanatory-notes` | 18,801 | 18,651 | 20,133 | EXPLANATORY_NOTE | legislation | legislation | 3 legacy | — | reachable |
| `fca-handbook` | 3,661 | 3,661 | 7,428 | GUIDANCE | guidance | guidance | — | — | reachable |
| `govuk-core-docs` | 176 | 175 | 978 | GUIDANCE | guidance | guidance | — | — | reachable |
| `historic-hansard` | 4,641,117 | 4,641,085 | 5,255,517 | DEBATE | parliamentary | debates | — | — | reachable |
| `hmrc-ancillary` | 479 | 472 | 1,265 | GUIDANCE | guidance | guidance | — | — | reachable |
| `hmrc-codes-guidance` | 14,067 | 14,067 | 27,490 | GUIDANCE | guidance | guidance | — | — | reachable |
| `hmrc-manuals` | 85,197 | 69,136 | 80,154 | GUIDANCE | guidance | guidance | — | — | reachable |
| `hmrc-tiins` | 791 | 791 | 795 | GUIDANCE | guidance | guidance | — | — | reachable |
| `ico` | 26,591 | 26,562 | 128,822 | GUIDANCE | guidance | guidance | — | — | reachable |
| `impact-assessments` | 18,759 | 18,756 | 49,248 | IMPACT_ASSESSMENT | legislation | legislation | 3 legacy | — | reachable |
| `independent-reviews` | 667 | 657 | 4,429 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `inquiry-evidence` | 90 | 89 | 446 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `inquiry-reports` | 146 | 140 | 899 | GUIDANCE | guidance | guidance | — | — | reachable |
| `lawcom` | 263 | 262 | 1,674 | GUIDANCE | guidance | guidance | — | — | reachable |
| `lda-commonsdivisions` | 5,553 | 5,553 | 5,553 | DEBATE | parliamentary | debates | — | — | reachable |
| `lda-commonsoralquestions` | 69,529 | 69,529 | 69,529 | DEBATE | parliamentary | debates | — | — | reachable |
| `lda-commonswrittenquestions` | 8,000 | 8,000 | 8,000 | DEBATE | parliamentary | debates | — | — | reachable |
| `lda-lordsdivisions` | 2,089 | 2,089 | 2,089 | DEBATE | parliamentary | debates | — | — | reachable |
| `lda-lordswrittenquestions` | 20,500 | 20,500 | 20,500 | DEBATE | parliamentary | debates | — | — | reachable |
| `lgsco` | 40 | 40 | 80 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `lords-divisions-votes` | 3,284 | 3,284 | 18,219 | DIVISION | parliamentary | debates | — | — | reachable |
| `members-interests` | 3,448 | 3,448 | 3,448 | **null (dropped)** | other | **NONE** | — | — | *excluded-by-design* |
| `nao-reports` | 3,983 | 2,570 | 18,548 | GUIDANCE | guidance | guidance | — | — | reachable |
| `ni-judgments` | 7,927 | 7,772 | 51,421 | CASE_LAW | caselaw | caselaw | — | — | reachable |
| `niassembly-hansard` | 196,348 | 196,348 | 216,825 | DEBATE | parliamentary | debates | — | — | reachable |
| `nilawcom` | 17 | 17 | 135 | GUIDANCE | guidance | guidance | — | — | reachable |
| `oecd` | 505 | 505 | 865 | GUIDANCE | guidance | guidance | — | — | reachable |
| `ofcom` | 4,169 | 4,169 | 8,217 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `ofgem` | 17,161 | 17,143 | 58,000 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `ots-reports` | 497 | 497 | 854 | GUIDANCE | guidance | guidance | — | — | reachable |
| `parliament-treaties` | 328 | 328 | 381 | DEBATE | parliamentary | debates | — | — | reachable |
| `petitions` | 49,529 | 49,529 | 50,301 | DEBATE | other | **NONE** | — | — | deferred-to-graph |
| `planning-policy` | 64 | 64 | 433 | GUIDANCE | guidance | guidance | — | — | reachable |
| `primary-acts-2000plus` | 147,975 | 147,788 | 151,045 | PRIMARY_LEGISLATION | legislation | legislation | 3 legacy | — | reachable |
| `primary-acts-pre-2000` | 179,435 | 166,290 | 172,508 | PRIMARY_LEGISLATION | legislation | legislation | 3 legacy | — | reachable |
| `pwdata-debates` | 6,391,345 | 6,387,314 | 7,102,074 | DEBATE | parliamentary | debates | — | — | reachable |
| `pwdata-lords` | 754,546 | 752,809 | 940,041 | DEBATE | parliamentary | debates | — | — | reachable |
| `pwdata-lordswms` | 21,463 | 20,932 | 28,160 | DEBATE | parliamentary | debates | — | — | reachable |
| `pwdata-lordswrans` | 176,119 | 175,576 | 177,224 | DEBATE | parliamentary | debates | — | — | reachable |
| `pwdata-westminster` | 240,582 | 239,263 | 316,710 | DEBATE | parliamentary | debates | — | — | reachable |
| `pwdata-wms` | 24,962 | 23,863 | 31,508 | DEBATE | parliamentary | debates | — | — | reachable |
| `pwdata-wrans` | 1,235,263 | 1,232,942 | 1,247,605 | DEBATE | parliamentary | debates | — | — | reachable |
| `quangos-govuk` | 171,190 | 171,030 | 610,006 | GUIDANCE | guidance | guidance | — | — | reachable |
| `regional` | 357,161 | 341,093 | 358,804 | STATUTORY_INSTRUMENT | legislation | legislation | 3 legacy | — | reachable |
| `retained-eu` | 319,346 | 199,224 | 208,987 | EU_LEGISLATION | legislation | legislation | 3 legacy | — | reachable |
| `scotlawcom` | 350 | 350 | 2,690 | GUIDANCE | guidance | guidance | — | — | reachable |
| `scottish-courts` | 13,070 | 13,056 | 86,876 | CASE_LAW | caselaw | caselaw | — | — | reachable |
| `scottish-parliament-or` | 1,044,188 | 1,043,264 | 1,074,786 | DEBATE | other | debates | — | — | reachable |
| `senedd-cofnod` | 191,756 | 191,730 | 202,014 | DEBATE | parliamentary | debates | — | — | reachable |
| `sentencing-council` | 253 | 253 | 1,671 | GUIDANCE | guidance | guidance | — | — | reachable |
| `si-2010plus` | 287,078 | 275,744 | 292,604 | STATUTORY_INSTRUMENT | legislation | legislation | 3 legacy | — | reachable |
| `si-pre-2010` | 489,450 | 462,809 | 506,949 | STATUTORY_INSTRUMENT | legislation | legislation | 3 legacy | — | reachable |
| `tax-treaties-dta` | 324 | 324 | 1,258 | TREATY | parliamentary | **NONE** | — | — | keyword-only |
| `tax-tribunals` | 13,099 | 12,089 | 74,230 | CASE_LAW | caselaw | caselaw | — | — | reachable |
| `tna-caselaw` | 74,896 | 74,896 | 558,233 | CASE_LAW | caselaw | caselaw | — | — | reachable |
| `uk-treaties` | 3,264 | 3,250 | 12,543 | TREATY | parliamentary | **NONE** | — | — | keyword-only |
| `uk-treaties-fcdo` | 23,372 | 23,372 | 56,215 | DEBATE | parliamentary | debates | — | — | reachable |
| `written-answers` | 143 | 143 | 1,138 | DEBATE | parliamentary | debates | — | — | reachable |
| `written-statements` | 129 | 129 | 994 | DEBATE | parliamentary | debates | — | — | reachable |

## By verdict

| verdict | collections | sections | fts_rows |
|---|---:|---:|---:|
| reachable | 62 | 18,358,567 | 18,111,196 |
| tier-only | 0 | 0 | 0 |
| keyword-only | 9 | 48,883 | 47,467 |
| deferred-to-graph | 2 | 110,266 | 110,266 |
| excluded-by-design | 1 | 3,448 | 3,448 |
| UNREACHABLE | 0 | 0 | 0 |

**The deliberate exclusions, with their reasons** — so that "nobody can reach this" and
"nobody is meant to reach this" never again print the same word:

- `members-interests` (3,448 sections) — political-risk / people-graph input, not general search (SEARCH_STRATEGY.md §3.1)

**Routed to the position graph, not to retrieval** — the third case: not a defect, and
not a decision that it should never be seen, but a decision that retrieval is the wrong
door. ⚠ Documentation only: nothing enforces this, and the unrouted path still returns
these today. See the `note` column for each one's actual retrieval status.

- `early-day-motions` (60,737 sections) — a named list of members endorsing a proposition on a date — a high-confidence position-graph edge, not a document to retrieve and read
- `petitions` (49,529 sections) — the same shape as an EDM but for public salience rather than parliamentary position

## Deferred pending the reranker decision (recorded 2026-08-10, BRIEF_SEARCH_S2C3 §3)

*No action taken on these. Listed so that "deferred" carries a date and an owner rather
than being an omission nobody owns. Revisit after the reranker decision.*

| collection | sections | verdict | type |
|---|---:|---|---|
| `cma-cases` | 22,898 | keyword-only | GUIDANCE |
| `ofgem` | 17,161 | keyword-only | GUIDANCE |
| `ofcom` | 4,169 | keyword-only | GUIDANCE |
| `uk-treaties` | 3,264 | keyword-only | TREATY |
| `independent-reviews` | 667 | keyword-only | GUIDANCE |
| `tax-treaties-dta` | 324 | keyword-only | TREATY |
| `cps-guidance` | 270 | keyword-only | GUIDANCE |
| `inquiry-evidence` | 90 | keyword-only | GUIDANCE |
| `lgsco` | 40 | keyword-only | GUIDANCE |
| **total** | **48,883** | | |

## The named suspects, individually

*The brief asked for the status of each of these one at a time rather than as a total,
because a total hides which of them is the expensive one.*

| suspect | collection(s) found | sections | router_stream | verdict |
|---|---|---:|---|---|
| treaties | `parliament-treaties` | 328 | debates | reachable |
| treaties | `tax-treaties-dta` | 324 | **NONE** | keyword-only |
| treaties | `uk-treaties` | 3,264 | **NONE** | keyword-only |
| treaties | `uk-treaties-fcdo` | 23,372 | debates | reachable |
| members' interests | `members-interests` | 3,448 | **NONE** | excluded-by-design |
| written answers | `lda-commonswrittenquestions` | 8,000 | debates | reachable |
| written answers | `lda-lordswrittenquestions` | 20,500 | debates | reachable |
| written answers | `pwdata-lordswrans` | 176,119 | debates | reachable |
| written answers | `pwdata-wrans` | 1,235,263 | debates | reachable |
| written answers | `written-answers` | 143 | debates | reachable |
| ministerial statements | `pwdata-lordswms` | 21,463 | debates | reachable |
| ministerial statements | `pwdata-wms` | 24,962 | debates | reachable |
| ministerial statements | `written-statements` | 129 | debates | reachable |
| impact assessments | `impact-assessments` | 18,759 | legislation | reachable |
| explanatory notes | `explanatory-memoranda` | 27,428 | legislation | reachable |
| explanatory notes | `explanatory-notes` | 18,801 | legislation | reachable |
| NAO and evaluation reports | `independent-reviews` | 667 | **NONE** | keyword-only |
| NAO and evaluation reports | `inquiry-evidence` | 90 | **NONE** | keyword-only |
| NAO and evaluation reports | `inquiry-reports` | 146 | guidance | reachable |
| NAO and evaluation reports | `nao-reports` | 3,983 | guidance | reachable |
| NAO and evaluation reports | `ots-reports` | 497 | guidance | reachable |
| consultations | `consultations` | 7,448 | guidance | reachable |
| quango rulebooks | `quangos-govuk` | 171,190 | guidance | reachable |
| statutory codes | `building-regs` | 21 | guidance | reachable |
| statutory codes | `college-of-policing` | 332 | guidance | reachable |
| statutory codes | `planning-policy` | 64 | guidance | reachable |
| statutory codes | `sentencing-council` | 253 | guidance | reachable |
| sector rulebooks (FCA Handbook) | `fca-handbook` | 3,661 | guidance | reachable |
| HMRC manuals | `hmrc-ancillary` | 479 | guidance | reachable |
| HMRC manuals | `hmrc-codes-guidance` | 14,067 | guidance | reachable |
| HMRC manuals | `hmrc-manuals` | 85,197 | guidance | reachable |
| HMRC manuals | `hmrc-tiins` | 791 | guidance | reachable |
| statistics catalogue | — | — | — | **absent** — NOT IN THE SEARCHABLE CORPUS AT ALL — it lives in a separate database (`STATS_DATABASE_URL`: `stat_dataset` / `stat_series` / `stat_observation`), reached by the stats layer, never by `corpus_sections`. So no stream change could make it retrievable; that would be an ingest or a federation decision, not a routing one. |

## Gold-key provenance

*Not run (`--no-gold`).*

## Tier-scoped bypass

*`gateway-legacy.ts` passes an explicit tier, so these callers get neither routing nor
dense retrieval. Collections reachable ONLY this way are invisible to every measurement
taken through the routed path.*

**tier `legislation`** — `app/api/ai/[ideaId] (Lex chat grounding)`, `/api/ideas/[id]/legislation-search (CreateIdea panel)`, `POST /api/search`

- reachable by these callers AND by the router: 10 collections (2,087,004 sections)
- reachable ONLY by these callers: 0 collections

⚠ **`tier-only` is structurally empty today, and that is a fact about the config rather
than a clean bill of health.** The only tier any caller scopes to is `legislation`, and the
`legislation` router stream selects that whole tier — so every collection the legacy
callers can reach, the router can reach too. The bypass costs those three surfaces routing
and dense retrieval; it does not currently expose anything the routed path cannot see. Add
a second tier-scoped caller on any other tier and this column starts carrying rows.
