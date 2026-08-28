# Verification sample — 20 rows against legislation.gov.uk

*Generated 2026-08-28T22:38:10.792Z. Corpus track, `CC_BRIEF_report_corpus.md` T5.*

## The rate

**20 correct, 0 wrong, 0 not checked, out of 20 drawn.**

Rate: **20 of 20** rows that were actually checked — 100.0%.

A row that could not be fetched is **NOT CHECKED** — not "wrong" and not "right". legislation.gov.uk rate-limits sequential fetches, and counting a 504 as a failure would publish a defect in our data that is really a defect in our manners.

## How the sample was drawn

Stratified across the three measures, 7 from each, ordered by `md5(id || 'report-run-2026-08-29')` and trimmed to 20. The seed is fixed so the same rows come back on a re-run — a random sample that cannot be reproduced is not evidence. It is **not** drawn by `id`, which is insertion order, which is document order.

Detection split in the sample: markup 0, text 19, enabling 1. (Not summed — three strengths of evidence.)

## Pass 0 — the verifier's own controls

A verifier that cannot fail measures nothing, so the checker was made to pass once and fail twice before any row was scored. All three go through `judge()`, the same function the sample goes through.

- POSITIVE control — ssi/2024/174:rule-2 → ukpga/1998/42: PASSES
- NEGATIVE control (wrong Act) — must be REJECTED: rejected — live text contains neither the target URI nor the Act name
- NEGATIVE control (wrong provision) — must be REJECTED: rejected — names the Act in 6 place(s) but "section-9999" is in none of those phrases

## Pass 2 — every failure re-examined before it was reported

In sprint 25-H the first pass reported 18/20 and **both** failures were the checker's. So no first-pass failure is published here until it has been put against our own local copy of the document *and* the whole live document, and both agree the row is wrong.

Of the 0 non-passes in pass 1: **0 were the verifier's**, 0 were a provision path that does not exist (an `enabling` reference sits in the enacting words, which have no addressable path), and **0 survived**.

## Every row

| # | measure | source | detection | target provision | verdict | why |
|---|---|---|---|---|---|---|
| 1 | WS-05 | `uksi/2010/1277:(preamble)` | enabling | (act-level) | **correct** | target URI present in the live provision |
| 2 | WS-04 | `ssi/2016/159:(preamble)` | text | (act-level) | **correct** | target URI present in the live provision |
| 3 | WS-01 | `ssi/2024/174:rule-2` | text | section-5-2 | **correct** | target URI present in the live provision |
| 4 | WS-05 | `ukpga/1998/46:section-51` | text | part-1 | **correct** | target URI present in the live provision |
| 5 | WS-04 | `ukpga/2000/38:section-123E` | text | section-6 | **correct** | Act named in the live provision text |
| 6 | WS-01 | `ukpga/2001/17:section-67A` | text | section-6 | **correct** | Act named in the live provision text |
| 7 | WS-04 | `ukpga/2003/1:section-477` | text | (act-level) | **correct** | target URI present in the live provision |
| 8 | WS-01 | `ukpga/2008/23:section-3` | text | section-6 | **correct** | Act named in the live provision text |
| 9 | WS-05 | `ukpga/2015/8:section-69` | text | schedule-6-paragraph-16 | **correct** | Act named in the live provision text |
| 10 | WS-04 | `ukpga/2023/51:section-1` | text | section-40 | **correct** | Act named in the live provision text |
| 11 | WS-01 | `nia/2013/2:section-21` | text | (act-level) | **correct** | Act named in the live provision text |
| 12 | WS-01 | `uksi/2001/443:article-26` | text | section-7-1 | **correct** | Act named in the live provision text |
| 13 | WS-01 | `uksi/2006/2189:regulation-3` | text | section-6 | **correct** | target URI present in the live provision |
| 14 | WS-05 | `uksi/2010/1277:(preamble)` | text | (act-level) | **correct** | target URI present in the live provision |
| 15 | WS-05 | `uksi/2010/2703:(preamble)` | text | (act-level) | **correct** | target URI present in the live provision |
| 16 | WS-05 | `uksi/2010/2703:article-2` | text | (act-level) | **correct** | Act named in the live provision text |
| 17 | WS-05 | `uksi/2011/2485:article-1` | text | (act-level) | **correct** | Act named in the live provision text |
| 18 | WS-04 | `uksi/2013/235:schedule-2-paragraph-166` | text | schedule-1 | **correct** | Act named in the live provision text |
| 19 | WS-04 | `uksi/2017/1140:regulation-2` | text | (act-level) | **correct** | target URI present in the live provision |
| 20 | WS-01 | `uksi/2023/1417:regulation-2` | text | (act-level) | **correct** | Act named in the live provision text |

## What the failures have in common

Nothing survived re-examination as a data failure.

## ⚠ What this rate does NOT cover

**The brief's sample is stratified by measure, and it drew markup 0, text 19, enabling 1.** `markup` is 2–5% of the table, so a 20-row draw is very likely to contain none, and this one contained 0. The headline rate therefore measures the `text` detector and says nothing whatever about the `markup` one — which is the detector the report will lean on hardest, because a markup edge is the source document asserting the target *by URI*. A rate that silently covers one detector and is read as covering three is exactly the kind of number this run exists to avoid.

So a **supplementary draw** takes three rows from each detector by name. It is additional to the brief's 20 and is **not merged into the rate above**:

| detector | correct | wrong | not checked |
|---|---|---|---|
| markup | 2 | 1 | 0 |
| text | 3 | 0 | 0 |
| enabling | 3 | 0 | 0 |

Three rows per detector establish that a detector is not systematically broken. They do **not** establish a rate, and none is quoted for them.

Two further limits, stated rather than left to be discovered:

- **For an act-level row the check is "the target Act is named in this provision as published today".** That is exactly the claim the row makes, so it is the right check — but it tests the parse and the staleness, not the resolution of the target's identity. A row that names the right Act for the wrong reason would pass.
- **The verifier and the extractor read the same kind of bytes**, though from different points in time: the extractor read the August 2026 bulk file, the verifier read the live site today. So this measures parse correctness and staleness, not whether legislation.gov.uk's own markup is right.
