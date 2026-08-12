# SEARCH Stage 2C-6 — report

**Executes:** `docs/BRIEF_SEARCH_S2C6.md` §1 in full; §2 answered, and the answer redirects the
sprint; §3 **stopped on evidence** with the stop documented below. §4/§5 recorded, not started.

**Date:** 2026-08-12. **Spend:** the router probe, 48 Gemini flash calls (negligible); no other
paid work on this thread.

---

## §1 — The four V34 corpora are typed, reachable, and say what they are

Four decisions, not one sweep, each taken against the rows rather than the corpus key. I read
2,361 + 3,284 + 18,756 + 7,448 real sections (`scripts/ingest/v35-inspect-corpora.ts`) before
deciding anything.

| corpus | tier | display type | stream | why |
|---|---|---|---|---|
| `impact-assessments` | `legislation` | **IMPACT_ASSESSMENT** (new) | legislation | **94.7% carry a `parentDocId`** naming the instrument they assess — they are attached to a specific piece of law the way an explanatory note is |
| `consultations` | `guidance` | **CONSULTATION** (new) | guidance | **0% carry a parent.** Not attached to an instrument; the guidance tier already holds government material *about* policy (NAO, inquiries, law commissions) |
| `commons-divisions-votes` | `parliamentary` | **DIVISION** (new) | debates | a roll-call is what Parliament *did*, not what it *said* |
| `lords-divisions-votes` | `parliamentary` | **DIVISION** (new) | debates | as above |

The union goes from 10 display types to 13. `check:corpus-types` extended: **153 assertions, 0
failed**, and every new assertion was **watched failing first** against three deliberate breaks
(remove `DIVISION` from the debates stream · drop it from `TYPE_ORDER` · stub out the IA title
rule) → exactly the predicted 7 failures, then restored.

**The asymmetry in `parentDocId` is why this is four decisions and not one.** It is the piece of
evidence that separates an impact assessment from a consultation, and it is in the data rather
than in anyone's intuition about the two document types.

### ⚠ The sequencing note in `BRIEF_INGEST_V35_SEARCHABILITY.md` §0 is wrong, and it mattered

V35 §0 says the typing gates the **FTS build** and that §1 (the embed) may start immediately.
It gates the embed too. `v33-vec-catchup.ts` writes `tier: tierFor(corpus)` into every
`corpus_chunks` row, and `vector-search.ts` passes `tier` as a **server-side prefilter** over
`corpus_vec` — refusing the results outright if the service does not echo it back. Embedding
before the tier map was corrected would have baked `other` into **95,044 chunks**, which no router
stream selects: paid for, indexed, unreachable. The same UNREACHABLE state, reached through the
vector half instead.

Verified rather than assumed after chunking, by `scripts/ingest/v35-verify-chunk-tiers.ts`
(with a negative control):

```
✓ commons-divisions-votes  18,888 chunks  tier=["parliamentary"]
✓ lords-divisions-votes    18,219 chunks  tier=["parliamentary"]
✓ impact-assessments       49,248 chunks  tier=["legislation"]
✓ consultations             8,652 chunks  tier=["guidance"]
✓ negative control: an unmapped corpus still tiers "other"
```

### The correctness requirement — and all four collections failed it

§1 asks that "a user must be able to tell an impact assessment from the law it assesses, and a
roll-call from a debate", and to say what the rendered titles read as. Measured against the stored
`sectionTitle`:

| corpus | what it rendered as | why that fails |
|---|---|---|
| `lords-divisions-votes` | `Employment Rights Bill` | indistinguishable from a Lords **debate** on that bill |
| `commons-divisions-votes` | `Crime and Policing Bill Report Stage: New Clause 1` | names the question, never says a vote happened |
| `impact-assessments` | `Summary` · `Policy objectives` · `Costs and benefits` | names nothing at all — **1,024 rows are titled the single word "Summary"** |
| `consultations` | `Corporation Tax: response to accounting changes…` | reads as a policy paper |

The cause is the same in every case and is worth naming: the stored title is an **internal
heading**, written for someone who already knows which document they opened. A search result has
no such reader.

`lib/lex/political-title.ts` fixes it at DISPLAY, mirroring `annotation-title.ts` — one rule, both
adapters, correct immediately rather than at the next index build. What they now read as:

```
Division — Employment Rights Bill (Lords, 2025-07-16)
Division — Crime and Policing Bill Report Stage: New Clause 1 (Commons, 2025-06-17)
Impact Assessment — The Ivory Act 2018 (Commencement) Regulations 2020 — Costs and benefits
Impact Assessment (Department for Transport) — Summary          ← when the instrument does not resolve
Consultation — Corporation Tax: response to accounting changes for insurance contracts
```

The instrument title comes from `corpus_acts` joined on `parentDocId` — **742 of 1,049 distinct
parents resolve (70%)**; the rest fall back to the department, never to a bare heading and never
to a dangling separator (asserted).

⚠ **`lda-commonsdivisions` (5,553 rows) and `lda-lordsdivisions` (2,089) are a live finding,
reported not fixed.** They are a *different*, near-empty division collection — **mean 16 and 8
words, `sectionTitle` NULL, `itemDate` NULL** — already typed DEBATE and already in the debates
stream, where they render as the raw corpus key. `check:corpus-types` asserts the new title rule
does **not** capture them, so no prefix rule can sweep them in silently. Whether they should be
excluded outright is an ingest question.

### Before-and-after

`scripts/measure-political-corpora.ts`, run `--label before` at 11:59 UTC ahead of the index
build. It refuses to run without `DATABASE_URL`, because the FTS adapter hydrates through Prisma
and would otherwise report a flawless zero-contamination result from no data — the S2C5 failure,
pre-empted in a new script.

**The `before` run is also the negative control, and it is unusually clean:** **0 of 620 top-20
slots** from the new collections across 31 gold questions, **0/160** on eight off-target
questions, and **6 of 6** on-target questions returning ABSENT. That is the UNREACHABLE state
measured rather than asserted. Baseline latency p50: legislation 2,297 ms · debates 2,847 ms ·
guidance 1,750 ms.

**After** (31,849 rows appended to `corpus_fts`, `fts-serve` restarted):

| | before | after |
|---|---:|---:|
| on-target questions answered by the new material | **0 of 6** | **4 of 6** |
| contamination, off-target top-20 slots | 0/160 | **6/160 (3.8%)** |
| gold answer keys satisfied — legislation | 16/46 | **16/46** |
| gold answer keys satisfied — debates | 14/20 | **14/20** |
| gold answer keys satisfied — guidance | 4/15 | **4/15** |
| latency p50 legislation / debates / guidance | 2,297 / 2,847 / 1,750 ms | **2,153 / 2,806 / 1,762 ms** |

**No gold answer key stopped being satisfied and latency did not move.** The 3.8% contamination is
two questions: an IA about gas-safety regulations at rank 14 on "the statutory duty on landlords
to carry out gas safety checks" (arguably not contamination at all — it is the impact assessment
for the instrument being asked about), and an FCA consultation at rank 2 on a handbook question.

What the titles now read as, from the live panel:

```
IMPACT_ASSESSMENT  Impact Assessment — The Money Laundering and Terrorist Financing (Amendment)
                   (No. 2) Regulations 2022 — Wider impacts (part 7)
IMPACT_ASSESSMENT  Impact Assessment (Department for Environment, Food and Rural Affairs) —
                   Risks and assumptions (part 2)
CONSULTATION       Consultation — Modern leasehold: restricting ground rent for existing leases
```

⚠ **THE FIRST `after` RUN CAME BACK BYTE-IDENTICAL TO `before`, AND WAS MEANINGLESS.** Same
0/620 slots, same 6/6 ABSENT — because `fts-serve` calls `openTable()` once at boot and was still
serving the `2026-08-11T22:37:06.994Z` snapshot. That is exactly the trap `docs/CLAUDE.md` §17
records for this service, and the only reason it was caught rather than reported as "the index
build had no effect" is that the harness records `started_at` on both runs and the two were
identical. After `fts-serve-run.ts redeploy`, `started_at` moved to `2026-08-12T12:45:59.251Z` and
the numbers above are from that snapshot.

⚠ Before and after here are two INDEX STATES measured at different times, so they cannot be
interleaved and anything else that moved lands in the delta.

### ⚠⚠ The roll-calls are typed, titled, admitted — and still do not arrive. Selectable ≠ retrievable

**2 of the 6 on-target questions are still ABSENT, and both are the division questions.** This is
the most important thing in §1 and it was found by the measurement, not by the reasoning.

```
[debates] "how did MPs vote on the assisted dying bill"        → 60 hits, 0 divisions
[debates] "division ayes noes employment rights bill lords"    → 60 hits, 0 divisions
[corpus-scoped lords-divisions-votes] same index, same query
   → "Division — Assisted Dying Bill [HL] (Lords, 2015-01-16)"    RANK 1
```

So the rows are indexed, correctly typed DIVISION, correctly titled, and correctly admitted to the
debates stream. They lose on **scale**: 5,645 roll-calls share the parliamentary tier with ~12M
Hansard sections that use the identical vocabulary — "division", "ayes", "noes" and every bill
name appear constantly in debate text. On one BM25 ranking they cannot win a slot at any limit.
This is the `scottish-parliament-or` problem inverted: there a million rows joined a stream; here
five thousand are drowned by it.

**`extraCorpora` was tried and reverted, because it does not do what it looks like it does.** The
extra leg guarantees a separate *retrieval call*, not *slots*: `mergeLegs` sorts both legs together
by score, and BM25 scores are comparable across them (a prefilter selects rows, it does not
rescore them), so the roll-calls lose the merge for exactly the reason they lost the main leg.
Measured with the entry in place: **still 0 of 60.** Removed rather than left in — each entry costs
one extra retrieval call on every debates query, and this one bought nothing. `check:corpus-types`
now asserts their *absence* from `extraCorpora`, with the reason, so nobody re-adds it believing
it works.

**The mechanism that would work is the round-robin interleave, which allocates slots per stream by
construction — i.e. a dedicated `divisions` stream.** That costs a sixth stream against
`vector-serve`'s concurrency cap of 4, which §4 flags as the binding constraint on stream count.
**Charlie's decision, with the measurement attached rather than a config line added quietly.**

Impact assessments and consultations have no such problem — they arrive at ranks 1 and 2 — because
they join tiers where they are not competing against a corpus three orders of magnitude larger.

---

## §2 — Recall: the brief's own recommendation addresses the smallest of three buckets

### The candidate-count chain, read off the code

For a routed query at gateway limit L (default 12; the ordering harness passes 16):

| # | where | count |
|---|---|---|
| 1 | `search-gateway.ts:133` | L |
| 2 | `query-router.ts:222` | each active stream called with L |
| 3 | `fts-search.ts:149` / `vector-search.ts:91` | service asked for `max(3L, 30)` |
| 4 | `fts-search.ts:257` | adapter returns `.slice(0, 3L)` — after `corpusToType` drops nulls |
| 5 | `query-router.ts:90` | `mergeLegs` → ≈3L |
| 6 | `query-router.ts:178` | `fuseWeightedRrf(...).slice(0, max(L, bm25.length))` → ≈3L |
| 7 | `interleave.ts` | round-robin → up to 3L × streams |
| 8 | `score-ordering.ts:37` | **K = 20 — the scorer reads only the first 20** |

At L=16 the observed numbers are: per-stream bm25 48, vector 48, fused 48; up to 240 interleaved
across five streams; **48 returned on a single-stream query, of which the scorer reads 20.**

### Where the missing documents are actually lost

The brief says to raise the candidate count and re-measure the denominator. Before doing that I
built `scripts/diagnose-recall.ts`, which separates the five distinct ways a document fails to
reach the scorer, because **only one of them is fixed by a bigger candidate set** and a single
"vacuous" count collapses all five. Over the 15 within-stream pairs (30 document-sides), L=16,
wide probe at 120:

| verdict | n | fixed by raising the limit? |
|---|---:|---|
| IN_TOP_K | 13 | — already there |
| **ABSENT** — not retrievable at any limit, by any stream, unscoped | **9** | **no — ingest** |
| **RANKING** — retrieved and returned, but past the scorer's top 20 | **5** | **no — merge/rerank** |
| **CANDIDATES** — reachable only at a larger per-stream limit | **3** | **yes** |
| ROUTING | 0 | — |
| TYPING | 0 | — |

**So the brief's instruction addresses 3 of the 17 missing documents.** ROUTING and TYPING are
both zero, which is the S2C→S2C5 work holding. The two big buckets are ingest and ranking.

### ⚠ The UK GDPR finding, chased as instructed — and it is not a retrieval defect

S2C6 §2 singles out UK GDPR as "a concrete, diagnosable recall failure and probably a good place
to start". It was. The diagnosis, verified three independent ways rather than inferred:

```
eur/2016/679   corpus_acts: in_corpus = FALSE, section_count = 0, corpus = NULL
               corpus_sections: ZERO under every legislation corpus prefix
               legacy LegislationItem: item_section_count = 61
ukpga/2006/46  corpus_acts: in_corpus = FALSE, section_count = 0, corpus = NULL   ← Companies Act 2006
               corpus_sections: ZERO
               legacy LegislationItem: item_section_count = 1,665
```

**UK GDPR is absent from the top 20 because it is not in the corpus at all.** No amount of
retrieval tuning, probe count or reranking reaches it. Same for the Companies Act 2006.

And it is not two instruments. **17,261 instruments known to the legacy table are absent from the
corpus** — `ukpga` 8,896 · `uksi` 4,668 · `eur` 2,268 · `ssi` 732 · … — carrying **77,000 sections
and 61.2 M characters** of legislative text. The biggest titled ones include the Companies Act
2006, the Law of Property Act 1925, the Housing Benefit Regulations 2006, the Jobseeker's
Allowance Regulations 1996 and the Representation of the People (England and Wales) Regulations
2001.

**This is the binding constraint on recall, and it belongs to INGEST, not to search.**

### `caselaw` 36/36 → 22/36: retired, and the premise of four briefs was wrong

**There is no 36-query set.** S2C, S2C2, S2C4 and S2C6 each describe this as something "the gold
set answers" over "that 36-query set". The number comes from S2B §2.3's exit-criterion run
(CHANGE_LOG 2026-08-09 12:10) — a production-budget sample of routing calls of which **36 were
decided forward**. The denominator is a count of CALLS in one run, not a re-runnable fixture. And
the gold set could never have answered it either: **`gold-queries.ts` contains no caselaw
archetype at all** — 43 queries, not one answer key naming a law report. That is why five sprints
could each truthfully report it as not done.

The question it stood in for — *does the router pick caselaw when caselaw is the right answer, and
refrain when it is not?* — is answerable, and now answered. `scripts/measure-router-caselaw.ts`,
8 queries a lawyer would answer with a judgment and 8 where reaching for one would be wrong,
sharing vocabulary deliberately, 3 repeats each (repeats are not optional on an LLM call with a
measured ~3% runaway rate):

```
caselaw SELECTED when it is the right answer     8/8
caselaw selected when it is NOT                  1/8
queries with an UNSTABLE decision across repeats 0/16
fail-opens                                       0/48
```

**The S2B fall from 36/36 to 22/36 was the router discriminating, not losing recall.** The single
false positive ("what does the ICO say about the lawful basis for processing employee data")
selects all five streams and is arguably defensible, since ICO enforcement is litigated. **Item
retired. Do not carry it a sixth time.**

---

## §3 — STOPPED, on evidence: the DROP would destroy the only copy of 61.2 M characters of legislation

§3 asks for the eight legacy repoints "then the repoint-confirm to ingest" — the confirm that
authorises an irreversible 1.73 GB DROP of `LegislationItem` / `LegislationSection`.

**That DROP must not happen, and the repoints as specified would themselves be a regression.**

`LegislationSection` holds **77,000 non-empty sections / 61,227,734 characters across the 17,261
instruments the corpus does not have.** The Companies Act 2006 alone is 1,665 sections and
1,921,188 characters. `corpus_acts` is a clean superset for **metadata** (250,808 ⊇ 135,531, 0
missing, 0 differing — S2C5 verified that). `corpus_sections` is **not** a superset for **text**.

And this is not theoretical coverage. Running the exact query shape `lib/search.ts` uses (path G):

```
"directors duties company"              → ukpga/2006/46 s.656  Companies Act 2006          RANK 1
                                          4 of the top 20 from instruments the corpus lacks
"personal data processing lawful basis" → eur/2016/679 Article 9  UK GDPR                  RANK 2
                                          eur/2016/679 Article 6  UK GDPR                  RANK 7
                                          3 of the top 20 from instruments the corpus lacks
```

**The legacy path is currently the only way a user reaches these documents, and it reaches them at
rank 1 and rank 2 on precisely the queries §2 flagged as recall failures.** Repointing paths A
(`gateway-legacy.ts`), D (`test-sections`), G (`lib/search.ts`) and H (`legislation-search`) onto
the corpus would silently remove that — a narrowing of coverage presented as a modernisation,
which is the exact class of silent absence this project has spent three sprints removing.

**What I did instead:**

- **No repoints made.** Not an oversight — a stop, of the same shape as S2C5 stopping the
  reranker: the brief authorised the work, and the evidence says the work as specified subtracts.
- The four **metadata-only** paths (B `legislation/[itemId]/page.tsx`, C
  `api/legislation/[itemId]`, E `field-approval`, F `legislation/link`) are safe to repoint
  whenever wanted, since `corpus_acts` is a verified metadata superset. They are not worth doing
  alone: they buy nothing until the DROP is possible, and the DROP is not.
- The **`IdeaLegislation` row migration is likewise held.** It is one row and it is correct, but
  it exists to unblock the same DROP.
- **Charlie's `title IS NOT NULL` answer is recorded and still right** for the browse/filter UI
  when the repoint eventually happens.

**The unblock is now an INGEST task with a number on it:** ingest the 17,261 missing instruments
(77,000 sections, 61.2 M chars) into `corpus_sections`, then re-run the reachability check, then
repoint, then DROP. That sequence also removes the largest bucket in §2's recall diagnosis. The
two problems are the same problem.

---

## §5 — `VECTOR_NPROBES`

Left at 64, per the brief. ⚠ **But the brief's stated decision rule now points the other way.** It
says: "If §2 reports no recall improvement that traces to candidate quality, revert to 24 and take
the 14% back." §2 reports that candidate quality accounts for **3 of 17** missing documents, and
that the binding constraint is material that is not in the index. A better candidate set cannot
consume what is not there. **Charlie's call, teed up with the number the rule asks for.**

---

## What is NOT done, said plainly

- **§2's re-measure at a raised limit** — the diagnosis redirected the effort into finding *which*
  limit binds, and the answer is that the per-stream limit is the smallest of the three levers.
  The harness (`diagnose-recall.ts --limit N`) is in the tree and takes one argument.
- **§3's repoints** — stopped on evidence, above.
- **§4** — the routed-gateway migration, untouched as instructed.
- **The `after` half of §1's before-and-after** — pending the V35 §2 FTS build.
