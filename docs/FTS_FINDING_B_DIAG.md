# FTS — Finding B: concept→legislation under-surfacing (diagnosis + tier-boost fix)

*Generated 2026-06-25 (UTC). Diagnostic: a throwaway harness
(`scripts/ingest/search/diag-finding-b.ts`, deleted after use — method recorded
below for reproducibility) against the live `corpus_fts` Lance dataset
(16,509,051 rows). Companion to `docs/FTS_ARCHETYPE_A_DIAG.md` (the citation-lookup
case); this is the **concept-query** case raised as Finding B when the FTS path was
first validated end-to-end (24 Jun).*

## TL;DR

For broad **concept keyword** queries the briefing's "legal framework" often fell
back to "no primary legislation matched" even when the anchoring Acts exist. The
diagnosis splits the symptom cleanly into two different causes — and the right fix
depends on which:

- **Term-of-art concepts (MiFID) → RETRIEVED-but-low → ranking.** The anchors
  (FSMA 2000, the 2017 MiFID implementing SIs, retained MiFIR / MiFID II) **are in
  the BM25 candidate set** — retained MiFIR lands at **cand#1** on one phrasing —
  yet only **1** legislation row reached the pre-boost top-20. Mechanism: most
  legislation section bodies have a **NULL `sectionTitle`**, so they miss the ~2.5×
  title-boost that lifts titled parliamentary/guidance rows, which then crowd the
  top-20. A modest **legislation-tier boost on the keyword path** re-ranks the
  anchors up. Fixed (`FTS_LEX_LEG_TIER_BOOST`, default **1.8**).
- **Lay-phrased concepts (data protection, road safety) → ABSENT → vocabulary
  mismatch.** The actual anchor Act never enters the candidate set: the DPA 2018
  Act itself is absent (only a quango guidance doc mentioning it appears); the Road
  Traffic Act 1988 appears only as `section-12E` ("motor race order"), not the
  seatbelt/drink-driving sections. Lay vocabulary doesn't lexically match statutory
  drafting, so **BM25 can't retrieve the row — a boost has nothing to lift.** This
  is the evidence the **vector layer** is the fix for lay concept→legislation, not
  any amount of re-ranking.

The boost closes the term-of-art case; it is correctly **inert** on the lay case
(the controls below stay at 0 legislation after the boost), so it never forces an
irrelevant Act up — it only re-ranks rows BM25 already retrieved.

## Method

Replicates `fts-core`'s candidate fetch — `table.search(q,'fts','body').limit(k)`
— but with a **deep k=800** so the WHOLE candidate set is visible, not the
post-rank top-20 the serving endpoint returns. Per concept query it reports: (1)
tier distribution of the candidate set; (2) every legislation-tier row with its
candidate-rank + raw BM25 `_score`; (3) an **anchor verdict** (RETRIEVED at
cand#N / ABSENT-but-in-corpus / not-in-corpus, via id-pattern + tier-restricted
text probe); (4) where legislation lands in the final top-20 after `rankedSearch`'s
boosts. Two MiFID phrasings + two lay controls.

## Candidate-set composition (k=800)

| query | legislation | parliamentary | guidance | other/caselaw |
|---|---|---|---|---|
| MiFID set A `MiFID investment firms financial instruments investor protection trading venues` | 302 | 228 | 266 | 4 |
| MiFID set B `rules governing investment firms trading financial instruments markets conduct of business` | 301 | 326 | 172 | 1 |
| Data protection `data protection personal data privacy rights of individuals` | 23 | 370 | 391 | 16 |
| Road safety `road safety speeding dangerous driving seatbelts drink driving` | 12 | 749 | 6 | 33 |

The split is already visible here: the MiFID queries pull **300+** legislation
rows into candidates (term-of-art tokens hit statutory text); the lay queries pull
**12–23**, and the few they pull are tangential.

## Anchor verdicts (the actual legislation-tier rows)

| query | anchor | verdict |
|---|---|---|
| MiFID A | FSMA 2000 | **RETRIEVED** — `primary-acts-2000plus:ukpga/2000/8:section-313CB` cand#47 (score 45.0) |
| MiFID A | retained MiFIR (Reg 600/2014) | **RETRIEVED** — `retained-eu:eur/2014/600:article-6/26/7/3` cand#58/63/67/68 (~43–44) |
| MiFID A | 2017 MiFID SIs | **RETRIEVED** — `explanatory-memoranda:em:uksi/2017/488` cand#29; SI leaves deeper |
| MiFID B | retained MiFIR (Reg 600/2014) | **RETRIEVED** — `retained-eu:eur/2014/600:article-2` **cand#1** (46.3) |
| MiFID B | 2017 MiFID SI | **RETRIEVED** — `si-2010plus:uksi/2017/701:regulation-47A` cand#10 (43.0) |
| MiFID B | MiFID II directive (retained) | **RETRIEVED** — `retained-eu:eudr/2014/65:article-31/4` cand#6/12 |
| Data protection | **DPA 2018** (`ukpga/2018/12`) | **ABSENT from candidate set** — Act row never retrieved; only a quango guidance doc naming it (cand#106). The 23 legislation candidates are tangential (retained EU privacy directives/decisions, EMs, unrelated SIs). |
| Road safety | **RTA 1988** (`ukpga/1988/52`) | **ABSENT (relevant sections)** — only `section-12E` "motor race order" appears, at cand#749; the seatbelt (ss.14–15) / drink-driving sections are not retrieved. |

*Method note:* an early pass of the matcher also flagged **parliamentary** rows
whose title contained the Act name (e.g. a Lords debate on "Financial Services and
Markets Act 2000 (Regulated Activities) Order") as anchor hits — those are NOT the
legislation row and were excluded from the verdicts above. The legislation-tier
rows are what's reported.

## Why MiFID retrieves but the lay queries don't

MiFID is a **term of art that appears verbatim** in the legislation and the EU
instruments (high lexical overlap), so BM25 retrieves the anchors — only the
re-rank is wrong. Lay concept queries ("seatbelts", "drink driving", "privacy
rights of individuals") have **low lexical overlap** with statutory drafting
("Wearing of seat belts", "the prescribed limit"), so the anchor sections never
enter the candidate set at all. Re-ranking can only reorder what was retrieved;
the lay case needs semantic (vector) retrieval. This mirrors the archetype-A
ABSENT cases (A1/A5) for the same root reason: the discriminating tokens aren't on
the row the user wants.

## The fix (applied) — legislation-tier boost on the keyword path

`scripts/ingest/search/fts-core.ts`: new `LEX_LEG_TIER_BOOST`
(`FTS_LEX_LEG_TIER_BOOST`, default **1.8**), applied to `tier === 'legislation'`
on the **non-citation** path (citation queries keep the existing
`CITATION_TIER_BOOST` 1.6). It is **multiplicative on the BM25 body score**, so it
only moves rows BM25 already retrieved — a boost, **not** a reserved slot, so it can
never inject an irrelevant Act. It is therefore inert on lay queries whose anchor
never entered the candidate set.

### Re-test (same harness, boost sweep) — legislation rows in the top-20

| boost | MiFID A | MiFID B | Data protection (control) | Road safety (control) |
|---|---|---|---|---|
| 1.0 (none) | 1 (FSMA at #12) | 4 (#4/13/15/19) | 0 | 0 |
| **1.8 (chosen)** | **4 — FSMA 2000 at #1** | **4 — at #1–4** | **0** | **0** |
| 2.5 | 11 | 15 | 0 | 0 |

**1.8 chosen:** it surfaces 4 solid legislation anchors with the **primary Act at
#1** while leaving room for the parliamentary/guidance context a Lex briefing wants.
**2.5 over-corrects** — 11–15 of the top-20 become legislation (much of it
explanatory-memoranda filler), crowding out the rest of the briefing. The controls
stay at **0** at every boost value: proof the boost is safe — it surfaces
legislation precisely when BM25 found the anchor, and stays silent when it didn't.

## Status / scope

- **Closes** the term-of-art concept case (MiFID and similar): the legal-framework
  panel now leads with the anchoring Act/SIs.
- **Does NOT close** lay-phrased concept→legislation: the anchor Acts are *absent
  from BM25 candidates*, not merely mis-ranked. That is now hard evidence for the
  **vector layer** (the next build) — re-ranking cannot reach rows retrieval never
  returned.
- Takes effect on **fts-serve redeploy** (the boost lives in `fts-core`, shared by
  the serving service and the scoring harness). No reindex required — it is a
  query-time re-rank against the existing index.
