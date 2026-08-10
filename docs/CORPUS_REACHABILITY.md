# Corpus reachability matrix

*Generated 2026-08-10 20:40 UTC by `scripts/ingest/search/corpus-reachability.ts`. Machine-readable
twin: `docs/corpus_reachability.json`. Regenerate rather than edit — every number here is
measured, and a hand-corrected row is a row that will be wrong after the next ingest.*

**The one number.** 18,220,575 of 18,383,172 sections (99.1%) sit in a collection some router stream can select. 0 collections are reachable by no path at all and nobody chose that; 1 is unreachable ON PURPOSE, named in `EXCLUDED_BY_DESIGN` with a reason; 9 surface only when routing is off or has failed open; 0 only via an explicit-tier caller.

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
| `committees-evidence` | 142,315 | 140,567 | 702,754 | COMMITTEE | parliamentary | committees | — | 13 | reachable |
| `committees-reports` | 344,773 | 323,922 | 464,790 | COMMITTEE | parliamentary | committees | — | 16 | reachable |
| `cps-guidance` | 270 | 270 | 1,519 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `early-day-motions` | 60,737 | 60,737 | 60,737 | DEBATE | other | **NONE** | — | 1 | deferred-to-graph |
| `echr-hudoc` | 4,460 | 4,410 | 21,883 | CASE_LAW | caselaw | caselaw | — | 1 | reachable |
| `erskine-may` | 2,038 | 1,873 | 2,130 | GUIDANCE | other | guidance | — | — | reachable |
| `et-decisions` | 293,403 | 293,399 | 504,686 | CASE_LAW | caselaw | caselaw | — | 1 | reachable |
| `eur-lex` | 241,571 | 241,571 | 492,152 | EU_LEGISLATION | legislation | legislation | 3 legacy | — | reachable |
| `explanatory-memoranda` | 27,428 | 21,984 | 39,855 | EXPLANATORY_NOTE | legislation | legislation | 3 legacy | — | reachable |
| `explanatory-notes` | 18,801 | 18,651 | 22,517 | EXPLANATORY_NOTE | legislation | legislation | 3 legacy | 5 | reachable |
| `fca-handbook` | 3,661 | 3,661 | 7,428 | GUIDANCE | guidance | guidance | — | — | reachable |
| `govuk-core-docs` | 176 | 175 | 978 | GUIDANCE | guidance | guidance | — | — | reachable |
| `historic-hansard` | 4,641,117 | 4,641,085 | 5,255,517 | DEBATE | parliamentary | debates | — | 6 | reachable |
| `hmrc-ancillary` | 479 | 472 | 1,265 | GUIDANCE | guidance | guidance | — | — | reachable |
| `hmrc-codes-guidance` | 14,067 | 14,067 | 27,490 | GUIDANCE | guidance | guidance | — | — | reachable |
| `hmrc-manuals` | 85,197 | 69,136 | 80,154 | GUIDANCE | guidance | guidance | — | 2 | reachable |
| `hmrc-tiins` | 791 | 791 | 795 | GUIDANCE | guidance | guidance | — | — | reachable |
| `ico` | 26,591 | 26,562 | 128,822 | GUIDANCE | guidance | guidance | — | 1 | reachable |
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
| `members-interests` | 3,448 | 3,448 | 3,448 | **null (dropped)** | other | **NONE** | — | — | *excluded-by-design* |
| `nao-reports` | 3,983 | 2,570 | 18,548 | GUIDANCE | guidance | guidance | — | 1 | reachable |
| `ni-judgments` | 7,927 | 7,772 | 51,421 | CASE_LAW | caselaw | caselaw | — | — | reachable |
| `niassembly-hansard` | 196,348 | 196,348 | 216,825 | DEBATE | parliamentary | debates | — | 2 | reachable |
| `nilawcom` | 17 | 17 | 135 | GUIDANCE | guidance | guidance | — | — | reachable |
| `oecd` | 505 | 505 | 865 | GUIDANCE | guidance | guidance | — | — | reachable |
| `ofcom` | 4,169 | 4,169 | 8,217 | GUIDANCE | other | **NONE** | — | 1 | keyword-only |
| `ofgem` | 17,161 | 17,143 | 58,000 | GUIDANCE | other | **NONE** | — | — | keyword-only |
| `ots-reports` | 497 | 497 | 854 | GUIDANCE | guidance | guidance | — | — | reachable |
| `parliament-treaties` | 328 | 328 | 381 | DEBATE | parliamentary | debates | — | — | reachable |
| `petitions` | 49,529 | 49,529 | 50,301 | DEBATE | other | **NONE** | — | 9 | deferred-to-graph |
| `planning-policy` | 64 | 64 | 433 | GUIDANCE | guidance | guidance | — | — | reachable |
| `primary-acts-2000plus` | 145,767 | 145,704 | 148,935 | PRIMARY_LEGISLATION | legislation | legislation | 3 legacy | 6 | reachable |
| `primary-acts-pre-2000` | 172,995 | 165,438 | 171,637 | PRIMARY_LEGISLATION | legislation | legislation | 3 legacy | 3 | reachable |
| `pwdata-debates` | 6,391,345 | 6,387,314 | 7,102,074 | DEBATE | parliamentary | debates | — | 17 | reachable |
| `pwdata-lords` | 754,546 | 752,809 | 940,041 | DEBATE | parliamentary | debates | — | 11 | reachable |
| `pwdata-lordswms` | 21,463 | 20,932 | 28,160 | DEBATE | parliamentary | debates | — | 1 | reachable |
| `pwdata-lordswrans` | 176,099 | 175,560 | 177,208 | DEBATE | parliamentary | debates | — | 11 | reachable |
| `pwdata-westminster` | 240,582 | 239,263 | 316,710 | DEBATE | parliamentary | debates | — | 11 | reachable |
| `pwdata-wms` | 24,962 | 23,863 | 31,508 | DEBATE | parliamentary | debates | — | 2 | reachable |
| `pwdata-wrans` | 1,235,159 | 1,232,894 | 1,247,557 | DEBATE | parliamentary | debates | — | 18 | reachable |
| `quangos-govuk` | 171,190 | 171,030 | 610,006 | GUIDANCE | guidance | guidance | — | 2 | reachable |
| `regional` | 346,274 | 331,124 | 348,558 | STATUTORY_INSTRUMENT | legislation | legislation | 3 legacy | 2 | reachable |
| `retained-eu` | 308,513 | 187,555 | 197,161 | EU_LEGISLATION | legislation | legislation | 3 legacy | 1 | reachable |
| `scotlawcom` | 350 | 350 | 2,690 | GUIDANCE | guidance | guidance | — | — | reachable |
| `scottish-courts` | 13,070 | 13,056 | 86,876 | CASE_LAW | caselaw | caselaw | — | 1 | reachable |
| `scottish-parliament-or` | 1,044,188 | 1,043,264 | 1,074,786 | DEBATE | other | debates | — | 5 | reachable |
| `senedd-cofnod` | 191,756 | 191,730 | 202,014 | DEBATE | parliamentary | debates | — | — | reachable |
| `sentencing-council` | 253 | 253 | 1,671 | GUIDANCE | guidance | guidance | — | — | reachable |
| `si-2010plus` | 281,244 | 270,339 | 286,946 | STATUTORY_INSTRUMENT | legislation | legislation | 3 legacy | 3 | reachable |
| `si-pre-2010` | 419,636 | 419,250 | 461,752 | STATUTORY_INSTRUMENT | legislation | legislation | 3 legacy | 1 | reachable |
| `tax-treaties-dta` | 324 | 324 | 1,258 | TREATY | parliamentary | **NONE** | — | — | keyword-only |
| `tax-tribunals` | 13,099 | 12,089 | 74,230 | CASE_LAW | caselaw | caselaw | — | 1 | reachable |
| `tna-caselaw` | 74,896 | 74,896 | 558,233 | CASE_LAW | caselaw | caselaw | — | — | reachable |
| `uk-treaties` | 3,264 | 3,250 | 12,543 | TREATY | parliamentary | **NONE** | — | — | keyword-only |
| `uk-treaties-fcdo` | 23,372 | 23,372 | 56,215 | DEBATE | parliamentary | debates | — | — | reachable |
| `written-answers` | 143 | 143 | 1,138 | DEBATE | parliamentary | debates | — | — | reachable |
| `written-statements` | 129 | 129 | 994 | DEBATE | parliamentary | debates | — | — | reachable |

## By verdict

| verdict | collections | sections | fts_rows |
|---|---:|---:|---:|
| reachable | 58 | 18,220,575 | 18,005,745 |
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
| written answers | `pwdata-lordswrans` | 176,099 | debates | reachable |
| written answers | `pwdata-wrans` | 1,235,159 | debates | reachable |
| written answers | `written-answers` | 143 | debates | reachable |
| ministerial statements | `pwdata-lordswms` | 21,463 | debates | reachable |
| ministerial statements | `pwdata-wms` | 24,962 | debates | reachable |
| ministerial statements | `written-statements` | 129 | debates | reachable |
| impact assessments | — | — | — | **absent** — no collection, and no `corpus_targets` row — never scoped, not merely unseeded |
| explanatory notes | `explanatory-memoranda` | 27,428 | legislation | reachable |
| explanatory notes | `explanatory-notes` | 18,801 | legislation | reachable |
| NAO and evaluation reports | `independent-reviews` | 667 | **NONE** | keyword-only |
| NAO and evaluation reports | `inquiry-evidence` | 90 | **NONE** | keyword-only |
| NAO and evaluation reports | `inquiry-reports` | 146 | guidance | reachable |
| NAO and evaluation reports | `nao-reports` | 3,983 | guidance | reachable |
| NAO and evaluation reports | `ots-reports` | 497 | guidance | reachable |
| consultations | — | — | — | **absent** — no collection, and no `corpus_targets` row — never scoped |
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

## Gold-key provenance — is each question testing what it claims to test?

*Untiered top-20 BM25 (`rankedSearch`), the same retrieval the gold reports use, so
these numbers are comparable with them. "intended" is the stream the gold file declares
for the question; "satisfied from" is the collection the documents that actually matched
the answer key came from; "in-stream" counts how much of the whole top-20 came from a
collection the declared stream can select. One pass — a single sample, not a repeat.*

- **12 of 45** questions are satisfied ENTIRELY from outside their declared stream. Those are not testing what they claim to test.
- **4** declare a stream that DOES NOT EXIST in the router at all — a missing capability, not a drafting error, and it would have been hidden inside the previous line.
- **0** are satisfied in part by an UNREACHABLE collection — the scoring harness reads Lance directly, the app's FTS adapter drops those rows for having no display type. To that extent the recall number measures the index rather than the product.
- **1** are satisfied in part by a keyword-only collection: delivered when the router is off or has failed open, never by a routed query. Turning routing ON therefore *costs* recall on those questions — which is worth knowing before the router's gold-set gain is read as unambiguous.

| id | intended stream | keys hit | in-stream | satisfied from | outcome |
|---|---|---:|---:|---|---|
| A1 | legislation | 2/2 | 7/20 | `primary-acts-pre-2000`×1, `primary-acts-2000plus`×1 | ok |
| A2 | legislation | 1/2 | 11/20 | `primary-acts-pre-2000`×1 | ok |
| A3 | legislation | 2/2 | 13/20 | `si-pre-2010`×14 | ok |
| A4 | legislation | 1/2 | 1/20 | `primary-acts-2000plus`×1 | ok |
| A5 | legislation | 0/2 | 0/20 | — | no key hit |
| B1 | legislation | 0/4 | 1/20 | — | no key hit |
| B2 | legislation | 1/3 | 0/20 | `committees-evidence`×1 | **NOT TESTING ITS STREAM** |
| B3 | legislation | 1/3 | 0/20 | `committees-reports`×1 | **NOT TESTING ITS STREAM** |
| B4 | legislation | 2/2 | 0/20 | `committees-reports`×9, `pwdata-lords`×8, `pwdata-westminster`×3, `niassembly-hansard`×2, `pwdata-wrans`×1 | **NOT TESTING ITS STREAM** |
| B5 | legislation | 2/3 | 0/20 | `pwdata-debates`×7, `historic-hansard`×1 | **NOT TESTING ITS STREAM** |
| C1 | legislation + guidance | 1/3 | 0/20 | `pwdata-lordswrans`×2 | **NOT TESTING ITS STREAM** |
| C2 | legislation + guidance | 2/3 | 0/20 | `pwdata-lordswrans`×13, `pwdata-wrans`×7, `petitions`×2, `committees-evidence`×1 | **NOT TESTING ITS STREAM** |
| C3 | legislation + guidance | 0/3 | 0/20 | — | no key hit |
| C4 | legislation + guidance | 2/3 | 0/20 | `pwdata-debates`×6, `pwdata-wrans`×4, `pwdata-lords`×3, `committees-evidence`×2, `committees-reports`×2, `pwdata-westminster`×2, `pwdata-lordswrans`×2, `petitions`×1 | **NOT TESTING ITS STREAM** |
| C5 | legislation + guidance | 3/3 | 1/20 | `pwdata-debates`×3, `pwdata-westminster`×3, `si-2010plus`×1, `committees-reports`×1, `petitions`×1 | ok |
| D1 | citation graph | 0/2 | 0/20 | — | no key hit |
| D2 | citation graph | 2/2 | 0/20 | `explanatory-notes`×11, `primary-acts-pre-2000`×3, `primary-acts-2000plus`×1 | **NO ROUTER STREAM EXISTS** |
| D3 | citation graph | 1/1 | 0/20 | `explanatory-notes`×12 | **NO ROUTER STREAM EXISTS** |
| D4 | citation graph | 1/3 | 0/20 | `pwdata-wrans`×12, `historic-hansard`×2, `pwdata-westminster`×2, `committees-evidence`×2 | **NO ROUTER STREAM EXISTS** |
| D5 | citation graph | 2/2 | 0/20 | `et-decisions`×12, `quangos-govuk`×2 | **NO ROUTER STREAM EXISTS** |
| E1 | debates | 1/2 | 9/20 | `committees-reports`×5, `pwdata-wrans`×2, `primary-acts-2000plus`×1, `regional`×1, `si-2010plus`×1, `pwdata-debates`×1, `pwdata-lordswrans`×1, `pwdata-wms`×1, `pwdata-lordswms`×1 | ok |
| E2 | debates | 2/2 | 17/20 | `historic-hansard`×9, `pwdata-wrans`×5, `pwdata-debates`×3, `committees-reports`×2, `pwdata-lords`×2, `petitions`×2, `pwdata-lordswrans`×1 | ok |
| E3 | debates | 2/2 | 0/20 | `explanatory-notes`×13, `committees-reports`×12, `primary-acts-2000plus`×4, `si-2010plus`×2 | **NOT TESTING ITS STREAM** |
| E4 | debates | 1/2 | 17/20 | `pwdata-debates`×6, `pwdata-lords`×2, `pwdata-wrans`×2, `petitions`×1, `committees-evidence`×1, `historic-hansard`×1, `scottish-parliament-or`×1 | ok |
| E5 | debates | 2/2 | 20/20 | `pwdata-wrans`×3, `pwdata-debates`×3, `pwdata-westminster`×3, `pwdata-lords`×1 | ok |
| F1 | bills + debates | 2/2 | 16/20 | `pwdata-wrans`×20, `petitions`×8, `pwdata-lordswrans`×8, `pwdata-lords`×2, `pwdata-debates`×2 | ok |
| F2 | bills + debates | 2/2 | 14/20 | `committees-evidence`×5, `pwdata-westminster`×5, `pwdata-debates`×5, `pwdata-wrans`×2, `scottish-parliament-or`×2, `petitions`×1, `pwdata-lords`×1 | ok |
| F3 | bills + debates | 2/2 | 13/20 | `pwdata-wrans`×2, `pwdata-lordswrans`×2, `regional`×1, `committees-evidence`×1, `explanatory-notes`×1 | ok |
| F4 | bills + debates | 1/2 | 18/20 | `pwdata-debates`×10, `historic-hansard`×4, `pwdata-westminster`×1, `early-day-motions`×1, `pwdata-lordswrans`×1, `petitions`×1 | ok |
| F5 | bills + debates | 2/2 | 12/20 | `pwdata-debates`×6, `petitions`×3, `pwdata-wrans`×3 | ok |
| B6 | legislation | 0/6 | 14/20 | — | no key hit |
| CM1 *(draft)* | committees | 2/2 | 11/20 | `committees-reports`×17, `pwdata-debates`×6, `pwdata-lordswrans`×1, `nao-reports`×1, `pwdata-westminster`×1, `pwdata-wrans`×1 | ok |
| CM2 *(draft)* | committees | 2/2 | 8/20 | `committees-reports`×10, `scottish-parliament-or`×6, `pwdata-wrans`×5, `committees-evidence`×5, `pwdata-debates`×4, `pwdata-lords`×4, `pwdata-wms`×2 | ok |
| CM3 *(draft)* | committees | 2/2 | 4/20 | `pwdata-debates`×9, `pwdata-lords`×8, `scottish-parliament-or`×8, `committees-evidence`×6, `pwdata-westminster`×2, `niassembly-hansard`×2, `committees-reports`×1 | ok |
| CM4 *(draft)* | committees | 2/2 | 20/20 | `committees-reports`×26 | ok |
| CL1 *(draft)* | caselaw | 1/2 | 2/20 | `scottish-courts`×1 | ok |
| CL2 *(draft)* | caselaw | 0/2 | 0/20 | — | no key hit |
| CL3 *(draft)* | caselaw | 1/2 | 0/20 | `pwdata-debates`×2 | **NOT TESTING ITS STREAM** |
| CL4 *(draft)* | caselaw | 0/2 | 0/20 | — | no key hit |
| GD1 *(draft)* | guidance | 2/2 | 7/20 | `pwdata-wrans`×7, `committees-reports`×4, `hmrc-manuals`×2, `quangos-govuk`×2, `pwdata-lordswrans`×1, `tax-tribunals`×1, `pwdata-westminster`×1, `committees-evidence`×1 | ok |
| GD2 *(draft)* | guidance | 2/2 | 0/20 | `committees-reports`×5, `pwdata-wrans`×3, `committees-evidence`×2, `pwdata-lords`×1 | **NOT TESTING ITS STREAM** |
| GD3 *(draft)* | guidance | 2/2 | 3/20 | `primary-acts-2000plus`×4, `retained-eu`×3, `committees-reports`×2, `ico`×2, `pwdata-debates`×2, `hmrc-manuals`×1, `committees-evidence`×1 | ok |
| GD4 *(draft)* | guidance | 2/2 | 0/20 | `ofcom`×4 ⚠, `pwdata-wrans`×3, `committees-evidence`×2, `pwdata-westminster`×2, `echr-hudoc`×2, `committees-reports`×1, `pwdata-lordswrans`×1, `pwdata-lords`×1, `pwdata-debates`×1 | **NOT TESTING ITS STREAM** |
| EN1 *(draft)* | legislation | 2/2 | 15/20 | `explanatory-notes`×30, `scottish-parliament-or`×1, `pwdata-wrans`×1, `committees-reports`×1 | ok |
| EN2 *(draft)* | legislation | 1/2 | 1/20 | `historic-hansard`×5 | **NOT TESTING ITS STREAM** |

✗ marks a satisfying collection with verdict UNREACHABLE — no caller ever receives it.
⚠ marks one with verdict keyword-only — only the unrouted/fail-open path delivers it.

### The four committee questions, re-measured

*GOLD_TEST_09 (6 Aug) recorded CM1 scoring 100% while returning **0/20 committee**
**documents** — Hansard satisfied the key by accident. `committees-reports` held 24,876
rows then. It holds 323,922 now, after the V32/V33 committee ingest. So the same
measurement, repeated:*

| id | committee docs in top-20 | keys hit | satisfied from a committee collection |
|---|---:|---:|---|
| CM1 | 11/20 | 2/2 | yes (17 hit(s)) |
| CM2 | 8/20 | 2/2 | yes (15 hit(s)) |
| CM3 | 4/20 | 2/2 | yes (7 hit(s)) |
| CM4 | 20/20 | 2/2 | yes (26 hit(s)) |

⚠ **One pass, one sample.** BM25 over a fixed index is deterministic, so this is not an
intermittent measurement — but it is still a single retrieval configuration (untiered,
BM25 only, no router rewrite). It says the 0/20 result no longer reproduces on this
path. It does not say the committees stream is now good, and it does not revisit
GOLD_TEST_09's separate finding that committee CONCLUSIONS are largely not ingested.

## Tier-scoped bypass

*`gateway-legacy.ts` passes an explicit tier, so these callers get neither routing nor
dense retrieval. Collections reachable ONLY this way are invisible to every measurement
taken through the routed path.*

**tier `legislation`** — `app/api/ai/[ideaId] (Lex chat grounding)`, `/api/ideas/[id]/legislation-search (CreateIdea panel)`, `POST /api/search`

- reachable by these callers AND by the router: 9 collections (1,962,229 sections)
- reachable ONLY by these callers: 0 collections

⚠ **`tier-only` is structurally empty today, and that is a fact about the config rather
than a clean bill of health.** The only tier any caller scopes to is `legislation`, and the
`legislation` router stream selects that whole tier — so every collection the legacy
callers can reach, the router can reach too. The bypass costs those three surfaces routing
and dense retrieval; it does not currently expose anything the routed path cannot see. Add
a second tier-scoped caller on any other tier and this column starts carrying rows.
