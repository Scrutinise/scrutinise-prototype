# FTS S1b — Archetype A failure diagnosis + fix

*Generated 2026-06-21 (UTC). Diagnostic: `scripts/ingest/search/diag-archetype-a.ts`
(raw table → `docs/FTS_ARCHETYPE_A_DIAG_TABLE.md`) against the live `corpus_fts`
Lance dataset (16,509,051 rows). v1 baseline: `docs/FTS_S1b_SCORING.md` — overall
recall@20 57.8%, **archetype A 0.0%**.*

## TL;DR

Archetype A (known-item / citation lookup) scores 0% because **a legislation
section's indexed text never contains the parent act's title**. The body is the
operative text; `sectionTitle` is the section heading. The act citation ("Housing
Act 1988") lives **only** in legacy `LegislationItem.title` and was never carried
onto `corpus_sections`. So for a citation query the discriminating tokens (act
name + year) are absent from the very row the user wants, but present in thousands
of parliamentary rows that mention the act in passing — which then fill the
top-20. The failure shows in two forms, both from this one cause:

- **ABSENT from retrieval (A1, A5):** the target section's body shares too few
  query terms → it never enters the BM25 result set at all (beyond rank 50,000).
- **PRESENT but out-ranked (A2, A3, A4):** the section IS retrieved but ranks deep
  (#1,789 / #29 / #3,319 raw), buried under parliamentary chatter — and the
  current title-boost makes it *worse*, because parliamentary rows carry the act
  name in their *title* (→ ×2.5) while the legislation row's section-heading title
  does not.

The fix the brief anticipated applies, and **the retrieval form is the dominant
one**: land the act-title/citation onto the legislation rows. This is both a
retrieval fix (the row becomes findable) and a ranking fix (the citation now sits
at the front of the body and in the title, so the right row scores highest).

## Per-query diagnosis

Probes per expected source: (1) **exists?** — direct id lookup in the corpus,
independent of BM25; (2) **raw-BM25 rank** — position in the full BM25 list
(candidate depth k=50,000); (3) **boosted rank** — position after the live
query-time title-boost. ">50000 / absent" = not retrieved.

| query | expected source | exists in corpus | raw-BM25 rank | boosted rank | verdict |
|---|---|---|---|---|---|
| A1 `Section 21 Housing Act 1988` | HA 1988 s.21 | **yes** (`…ukpga/1988/50:section-21`) | **absent** | absent | **ABSENT → retrieval** |
| A2 `…section 1 of the Theft Act 1968…` | TA 1968 s.1 | yes (`…ukpga/1968/60:section-1`) | #1,789 | #11,998 | PRESENT, out-ranked → ranking |
| A2 | TA 1968 ss.2–6 | yes | #27,830 | #32,379 | PRESENT, out-ranked → ranking |
| A3 `Working Time Regulations 1998` | SI 1998/1833 | yes (`…uksi/1998/1833:*`) | #29 | #2,983 | PRESENT, out-ranked → ranking |
| A3 | reg 4 / 13–13A | yes | #11,630 | #13,980 | PRESENT, out-ranked → ranking |
| A4 `Equality Act 2010 section 149` | EqA 2010 s.149 | yes (`…ukpga/2010/15:section-149`) | #3,319 | #518 | PRESENT, out-ranked → ranking |
| A4 | Sch 18 | yes | #3,408 | #8,416 | PRESENT, out-ranked → ranking |
| A5 `…law…you have to wear a seatbelt` | RTA 1988 ss.14–15 | **yes** (`…ukpga/1988/52:section-14/15`) | **absent** | absent | **ABSENT → retrieval** |
| A5 | Seat Belts Regs 1993 | yes | #11,662 | #4,132 | PRESENT, out-ranked → ranking |

Notes on the two ABSENT cases (confirmed in corpus, not retrieved):
- **A1 / HA 1988 s.21** — its `sectionTitle` is *"Recovery of possession on expiry
  or termination of assured shorthold tenancy."* and its body is the operative
  text. Neither contains "Housing", "Act" or "1988", so the row scores near-zero
  for the query and never surfaces. The top-20 is 100% parliamentary/petition rows
  (all title-boosted) that name the act in passing.
- **A5 / RTA 1988 ss.14–15** — title *"Seat belts: adults."* The query says
  "seatbelt" (one token); the legislation says "seat belts" (two tokens) → no
  token overlap, compounded by the missing act citation. A5 is really a concept
  query (no citation given at all); the citation backfill helps the act show up but
  the seatbelt/seat-belt vocabulary gap is a separate B-archetype concern (out of
  scope here — not chased, per the brief's "no bug-chasing").

## Backfill status on the ingest side (the brief's question)

- `corpus_sections` has **no act-title / citation column**. `sectionTitle` carries
  the *section heading* only, and is **NULL for the majority of legislation rows**
  (per-corpus NULL rates: primary-acts-pre-2000 65% · primary-acts-2000plus 62% ·
  si-pre-2010 80% · si-2010plus 83% · regional 86% · retained-eu 88%). The V28 §1.3
  carry (335,595 titles) only populated high-signal section headings for ~35% of
  leg+caselaw rows — and even those omit the act name. `parentDocId` is NULL for
  legislation.
- The act title **does** exist, fully, in legacy **`LegislationItem.title`**:
  135,531 / 135,531 rows populated, keyed by `legislationGovUkId` (e.g.
  `ukpga/1988/50` → "Housing Act 1988"). Every `corpus_sections` legislation id
  embeds that gid (`{corpus}:{gid}:{sectionRef}`), so the citation is **100%
  derivable**. The "pending LegislationSection→corpus_sections backfill" the brief
  refers to was never run for the act citation; it is what unblocks archetype A.

## The fix (applied)

Two complementary parts:

**1. Query-time known-item resolver (the headline fix — `search/citation-resolver.ts`
+ `search/fts-core.ts`).** For an explicit citation we don't need BM25 at all:
parse the query ("Section 21 Housing Act 1988"), resolve the act title → gid via
`LegislationItem.title` (135,531 rows, 100% populated), and fetch the EXACT section
by id (`…ukpga/1988/50:section-21`), injecting it at rank 1. Act-level queries
("Working Time Regulations 1998") surface the act's leaves instead. The remainder
is BM25 with a legislation-tier favour for citation queries (the brief's "favour
the legislation tier"). **Needs no reindex** — works against the existing index,
because it resolves by id, not by body text. This is what lifts A from 0%.

**2. Body/title citation backfill (complementary — `search/citation.ts`,
`build-fts-index.ts`, `backfill-citations.ts`).** Prepends the act citation to the
indexed `body` and folds it into `sectionTitle`, so legislation rows are findable
by BM25 even for concept / partial-citation queries (and gives the title-boost
something to match). Baked into the canonical indexer for the next from-scratch
Railway rebuild; `backfill-citations.ts` is the in-place variant (rewrites only the
~1.6M legislation rows, reversible via Lance version restore). Caselaw is excluded
(ids already carry the neutral citation inline). This part lands on the **gated
Railway rebuild** (local 16GB can't reindex 16.5M — v1 was built on Railway's
24GB box); the re-score below isolates the resolver's effect on the pristine index.

## Re-score (resolver, full 16.5M `corpus_fts`)

`search/score-fts.ts` with the resolver, vs the v1 baseline
(`docs/FTS_S1b_SCORING_v1_baseline.md`):

| archetype | v1 recall@20 | after | Δ | note |
|---|---|---|---|---|
| **A** | **0.0%** | **60.0%** | **+60.0** | MRR 0.000 → 0.800 — exact cited section is #1 in 4/5 |
| B | 40.0% | 40.0% | 0 | no regression |
| C | 60.0% | 60.0% | 0 | no regression |
| D (floor) | 66.7% | 76.7% | +10.0 | citation-ish D queries gain |
| E | 90.0% | 90.0% | 0 | no regression |
| F | 90.0% | 90.0% | 0 | no regression |
| **overall** | **57.8%** | **69.4%** | **+11.6** | excl-floor 56.0% → 68.0% |

Per-A: A1 100% · A2 50% · A3 100% · A4 50% · A5 0%. The exact cited section is
pinned at rank 1 for A1–A4 (MRR 1.0 each). Residual:
- **A2/A4 = 50%** — the *primary* cited section (s.1 / s.149) is #1; the *secondary*
  gold source (ss.2–6 / Sch 18) isn't citation-resolvable and isn't surfaced by
  BM25 on the pristine index. The body backfill (gated rebuild) is expected to lift
  these.
- **A5 = 0%** — "…wear a seatbelt" carries no citation to resolve, and "seatbelt"
  (one token) ≠ "seat belt" (the legislation's wording). A vocabulary/concept gap
  (archetype B in disguise) — out of scope per the brief's "no bug-chasing".
