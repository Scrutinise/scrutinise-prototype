# Markup-only verification sample

*Generated 2026-08-29T15:27:46.710Z. Corpus track, brief B4.*

## The rate

**20 of 25** markup rows verified correct — drawn from a population of **127 markup rows** across the three measures (WS-01 37, WS-04 79, WS-05 11).

0 row(s) could not be fetched and are NOT CHECKED — counted neither correct nor wrong.

### ⚠ This rate is not the T5 rate and the two are never averaged

| sample | detector | rate | denominator |
|---|---|---|---|
| T5 (brief §6) | `text` (19 of 20 rows) | 20 of 20 | 20 rows stratified by measure, from 3,237 |
| B4 (this) | `markup` only | 20 of 25 | 25 rows drawn from a markup population of 127 |

Two rates with two denominators is the honest presentation. A single blended figure would describe neither detector and would be read as describing both.

## The verifier was made to fail before anything was scored

A verification pass that cannot fail is worth nothing, and this is the one number the Method section prints. The controls below run through `runControls()` and `judge()` — **the same functions the sample runs through**, imported from `report-t5-verify.ts` rather than restated, so a disagreement between the two rates can only be about the rows.

- POSITIVE control — ukpga/1983/20:section-142C → ukpga/1998/42: PASSES
- NEGATIVE control (wrong Act) — must be REJECTED: rejected — live text contains neither the target URI nor the Act name
- NEGATIVE control (wrong provision) — must be REJECTED: rejected — names the Act in 1 place(s) but "section-9999" is in none of those phrases

## Every failure was re-examined before being recorded

Each non-pass was put against our own local CLML copy **and** the whole live document. Of 7 first-pass non-passes: **2 were the checker's**, **5 were a misattributed source provision** (the reference real and in the document, but not in the provision the row names), and **5 survived** as data failures.

## Every row

| # | measure | source document | provision | target | verdict | what the live document said |
|---|---|---|---|---|---|---|
| 1 | WS-01 | `ukpga/1983/20` | `section-142C` | contents | **correct** | target URI present in the live provision |
| 2 | WS-01 | `uksi/2011/1408` | `schedule-paragraph-9` | (act-level) | **correct** | target URI present in the live provision |
| 3 | WS-01 | `ukpga/2025/33` | `section-51` | section-6 | **correct** | target URI present in the live provision |
| 4 | WS-01 | `uksi/2008/3122` | `schedule-paragraph-6` | section-6-1 | **correct** | target URI present in the live provision |
| 5 | WS-01 | `uksi/2005/3429` | `schedule-paragraph-2` | (act-level) | **correct** | Act named in the live provision text |
| 6 | WS-01 | `uksi/2001/3500` | `schedule-2-paragraph-6` | (act-level) | **wrong** | MISATTRIBUTED PROVISION: the reference IS in the live document but is NOT in the provision this row names. The citation is real and the target is real; source_provision_ref points at a provision that does not contain it. ⚠ source_provision_ref is the column that answers "which provision breaks if you repeal this", so a wrong value here is worse than a missing one. |
| 7 | WS-01 | `uksi/2024/172` | `article-4` | (act-level) | **wrong** | MISATTRIBUTED PROVISION: the reference IS in the live document but is NOT in the provision this row names. The citation is real and the target is real; source_provision_ref points at a provision that does not contain it. ⚠ source_provision_ref is the column that answers "which provision breaks if you repeal this", so a wrong value here is worse than a missing one. |
| 8 | WS-04 | `asc/2024/5` | `section-27` | section-4 | **correct** | target URI present in the live provision |
| 9 | WS-04 | `uksi/2010/2191` | `article-2` | section-96-9-b | **correct** | Act named in the live provision text |
| 10 | WS-04 | `ukpga/2026/21` | `p07422` | contents | **correct** | target URI present in the live provision |
| 11 | WS-04 | `ukpga/1996/18` | `section-202A` | section-26 | **correct** | VERIFIER FAILURE, not a data failure: both our copy and the whole live document carry the reference; the provision-path check was looking in the wrong place. |
| 12 | WS-04 | `ukpga/2022/31` | `schedule-15-paragraph-9` | (act-level) | **wrong** | MISATTRIBUTED PROVISION: the reference IS in the live document but is NOT in the provision this row names. The citation is real and the target is real; source_provision_ref points at a provision that does not contain it. ⚠ source_provision_ref is the column that answers "which provision breaks if you repeal this", so a wrong value here is worse than a missing one. |
| 13 | WS-04 | `uksi/2023/1425` | `regulation-6` | (act-level) | **correct** | Act named in the live provision text |
| 14 | WS-04 | `uksi/2010/2279` | `schedule-1-paragraph-6` | (act-level) | **correct** | Act named in the live provision text |
| 15 | WS-04 | `uksi/2014/1287` | `article-2` | section-149 | **wrong** | MISATTRIBUTED PROVISION: the reference IS in the live document but is NOT in the provision this row names. The citation is real and the target is real; source_provision_ref points at a provision that does not contain it. ⚠ source_provision_ref is the column that answers "which provision breaks if you repeal this", so a wrong value here is worse than a missing one. |
| 16 | WS-04 | `uksi/2010/2317` | `schedule-8-paragraph-8` | (act-level) | **correct** | Act named in the live provision text |
| 17 | WS-04 | `ukpga/2000/38` | `schedule-9A-paragraph-13` | (act-level) | **correct** | target URI present in the live provision |
| 18 | WS-04 | `uksi/2014/2559` | `schedule-paragraph-9` | (act-level) | **correct** | Act named in the live provision text |
| 19 | WS-04 | `uksi/2014/416` | `schedule-paragraph-16` | section-138 | **wrong** | MISATTRIBUTED PROVISION: the reference IS in the live document but is NOT in the provision this row names. The citation is real and the target is real; source_provision_ref points at a provision that does not contain it. ⚠ source_provision_ref is the column that answers "which provision breaks if you repeal this", so a wrong value here is worse than a missing one. |
| 20 | WS-04 | `uksi/2011/2646` | `article-2` | (act-level) | **correct** | Act named in the live provision text |
| 21 | WS-04 | `ukpga/2025/36` | `p04867` | section-26 | **correct** | target URI present in the live provision |
| 22 | WS-04 | `ukcm/2026/1` | `section-3` | contents | **correct** | target URI present in the live provision |
| 23 | WS-04 | `uksi/2012/1569` | `article-3` | (act-level) | **correct** | Act named in the live provision text |
| 24 | WS-05 | `anaw/2013/4` | `section-72` | part-1 | **correct** | target URI present in the live provision |
| 25 | WS-05 | `ukpga/2026/12` | `section-4` | section-42 | **correct** | VERIFIER FAILURE, not a data failure: both our copy and the whole live document carry the reference; the provision-path check was looking in the wrong place. |

## What the failures have in common

- **5 ×** MISATTRIBUTED PROVISION: the reference IS in the live document but is NOT in the provision this row names. The citation is real and the target is real; source_provision_ref points at a provision that does not contain it. ⚠ source_provision_ref is the column that answers "which provision breaks if you repeal this", so a wrong value here is worse than a missing one.

## The prediction, logged before the draw

Predicted **22 of 25 (88%)**, of which **1** expected to be the checker's, and the markup rate expected to sit **below** T5's text rate.

Actual: **20 of 25**, **2** the checker's, and the rate did sit below T5's.
