# BRIEF — GRAPH 4A: THE CITATION GRAPH'S BLIND SPOTS, THEN INSTRUMENTS

**For:** CC-Graph
**Written:** 26 August 2026, by CCh-Search
**Executes:** `HANDOVER_search_graph_citation.md` §5 tasks T1–T4 (approved) and §6 Layer 2 scoping;
`OPEN_ITEMS.md` OI-15, OI-16, OI-18
**Format:** audit-then-build. **§1–§3 are measurement and produce no new graph.** No git during the
sprint; one **`commit-graph-4a.sh`** at the end. Scoped commits by explicit path; additive migrations
only.

---

## §0 — WHAT THIS INHERITS

`citation_edge` is built: **1,034,548 rows**, every one carrying the literal words it was found in
and the surrounding fragment, both required — an edge with no quotable source is a claim, not a fact.
Hand-checked 20 of 20 against legislation.gov.uk. Scale control passes: Equality Act 1,868 inbound,
Human Rights Act 938, CRAG 2010 182, Down Syndrome Act 13 — a narrow recent Act does not outrank a
broad old one.

**In plain terms: given any Act or provision, we can now list every other provision that refers to
it.** That list is the foundation of any serious amendment or repeal analysis, and until this existed
we could not produce it.

**The finding that shapes everything downstream:** legislation.gov.uk's own machine-readable citation
markup is **roughly 2% complete** — 5.4% of body mentions of the Human Rights Act carry it, 1.8% for
the Equality Act, **0% for CRAG 2010**. On markup alone, *"what refers to CRAG Part 1?"* returns two.
The true answer is 29. ⚠ **It fails silently: a short, confident, wrong list, with no error and no
gap flag.** The standing principle that follows is already in `CLAUDE.md` — *an authoritative
source's own metadata is a sample, not a census* — and **§1 exists to apply it to everything else.**

⚠ **Do not re-raise the Neon storage alarm.** It was withdrawn on 26 August as a false alarm after
being retired twice before. There is no storage ceiling; storage is a bill, not a wall.
`citation_edge` costs about $0.40 a month.

---

## §1 — T1: THE BLAST-RADIUS AUDIT. THIS IS THE MOST IMPORTANT SECTION.

**The defect (OI-15):** the July extractor's file filter required a **calendar** year in the
filename. UK Acts were cited by regnal year — *"1 & 2 Eliz. 2"* — until 1963, so every pre-1963 Act
was skipped: **2,431 of 132,990 documents, including 1,650 Acts, all 660 `aep` and all 58 `apgb`.**
Proved by consequence, not by reading the code: of 121,279 `cites` edges, **exactly zero** have a
regnal-year source, while 29,800 edges of other types do.

⚠ **The general shape, and the reason this is §1: a fix applied to one of two places that must agree,
with no check that they agree.** July widened the URI *parser* for regnal ids and never touched the
entry *filter* — a separate code path. Nobody noticed for seven weeks.

**Deliver: one page listing every consumer downstream of that extractor, and per consumer, whether
the 1,650-Act hole affects it.** This is the *"what else did we get wrong the same way"* question and
it is worth more than any new layer.

⚠ **Do not assume an old Act cannot cite a modern one.** legislation.gov.uk serves *revised* text, so
a Victorian Act amended in 2012 can carry a 2012 reference inserted by that amendment. The intuition
is wrong and it is exactly what would make somebody dismiss this as harmless.

---

## §2 — T2: QUANTIFY THE HOLE

Re-run the extractor with the filter fixed, **over the 1,650 missing Acts only**. Report the delta on
the four control Acts (Equality, Human Rights, CRAG, Down Syndrome).

**The prediction is already on file: under 3% and non-zero.** Record it in `CHANGE_LOG.md` before
running, per standing practice.

- **Under 3%** → proceed, and record the residual as a declared limitation surfaced in §5's coverage
  block.
- **Over 3%** → fix before anything consumes the graph, and say so.

⚠ A prediction that is refuted here is more useful than one confirmed. Report either plainly.

---

## §3 — T3 AND T4: THE CHEAP CHECKS

**T3 — unresolved spans (OI-18).** 93,772 of 1,429,037 act-name spans resolved to nothing (6.6%),
and 73,238 of 649,202 text rows sit in no provision at all (11.3%) — an Act named in an SI's title or
explanatory note, which is a real reference but not a provision that breaks.

Report: **what proportion of the 93,772 unresolved spans sit in documents that also cite one of the
twelve research targets?** That single number decides whether short-form resolution (*"the 1998
Act"*, *"the principal Act"*) is urgent or merely wanted. ⚠ **Do not build short-form resolution in
this sprint** — it needs document-scoped context and is its own piece of work.

**T4 — export hygiene.** CLML commentary handles are `key-` plus 32 hex characters, byte-identical in
shape to an API key, and trip GitHub's secret scanning. Confirm the redaction holds.
⚠ **Standing rule: never bypass secret scanning — change the data, not the guard.** A bypass is
Charlie's decision and gets recorded with its reason.

---

## §4 — SCOPE LAYER 2: INSTRUMENTS TO LEGISLATION. SCOPE ONLY.

**Why it is the highest priority layer:** most references to any Act sit in the statutory instruments
made under it. Until this exists, **every consequence list is systematically incomplete in a way the
user cannot see** — the same failure as the 2% markup problem, one level up.

**Scope, do not build:**

- **Size it before designing it.** Expect several times Layer 1's volume. Report rows, storage and
  build time, priced at $0.35 per GB-month — the real figure.
- ⚠ **The enabling relationship is a different and stronger fact than a textual reference.**
  *"This SI was made under section 15 of that Act"* is not *"this SI mentions that Act"*. Capture it
  as its own edge type. **An SI whose enabling power is repealed may fall with it**, and repeal
  analysis is unanswerable without that separation.
- ⚠ **Confirm SI schedules are ingested.** Extractors commonly drop them, and §5 below depends
  entirely on them.

---

## §5 — CHARLIE'S QUESTION: TAX LAW AND INTERNATIONAL AGREEMENTS

He asked specifically for tax law cross-referenced to international tax agreements, and our treaties
cross-referenced to domestic law. **The handover already covers this well** (§6 Layer 5) and the
answer is that most of it falls out of Layer 2 for free. Confirm or refute each of the following, and
report — **build nothing:**

1. The UK has roughly 130 double taxation agreements. They take domestic effect by Order in Council
   under **TIOPA 2010 s.2**, and **the treaty text is scheduled to the Order** — so it is already in
   the legislation corpus, if schedules were ingested (§4).
2. ⚠ **The direction reverses, and this is the part most likely to be missed.** TIOPA 2010 **s.6**
   gives double taxation agreements effect *despite anything in any enactment*. So the useful query
   for a tax proposal is not only *"what does my change break"* but **"does a treaty already prevent
   this"**. The graph must be queryable in that direction. Report whether it is.
3. ⚠ **The scheduled text may not be the operative text.** The OECD Multilateral Instrument modifies
   many agreements at once without amending each Order, so an agreement read off legislation.gov.uk
   can be out of date **without saying so** — the same silent-incompleteness failure again. Report
   whether we hold MLI positions. Where a modification exists and is not held, **the coverage block
   must say so.**
4. For the wider treaty question, the five relationship types in the handover are the right model and
   must not be flattened into "mentions". ⚠ **`permits_suspension` is the one most likely to be
   skipped and worth the most** — it turns *"the other side might react badly"*, a guess, into
   *"this article permits suspension of these obligations on this notice"*, a finding with a
   citation.

**Report which of the five types are answerable from what we hold today, and which need ingest.**

---

## §6 — THE OPEN QUESTION THAT BLOCKS LAYERS

**What is the relationship between `citation_edge` and the older July `edges` table** — the one
holding 121,279 `cites` edges and 29,800 of other types? Duplicate, complementary, or one superseding
the other?

▶ **Answer this before any layer work.** The handover is explicit: unanswered, the layers get added
twice. If the answer is that one supersedes the other, say which and what would have to happen to
retire the loser — do not retire anything in this sprint.

---

## §7 — THE COVERAGE BLOCK IS NON-NEGOTIABLE

`inbound()` returns rows. **It must also return what it could not see.** A consequence list is a
claim about completeness, and this graph is knowingly incomplete in named, quantified ways.

Every call returns, alongside the rows: which layers were searched, which are not yet built, the
OI-15 residual from §2, the unresolved-span count from §3, and the case-law date boundary where
relevant.

⚠ **Generated from live coverage state — never a hardcoded string.** A hardcoded caveat goes stale
exactly the way the 17.5 GB storage figure did, three times.

This is the platform's existing rule on a new surface: **a gap that announces itself is better than a
gap that looks like an absence of evidence.** A user reading a list of 29 must be able to see what is
not in it.

---

## §8 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-graph-4a.sh`; additive migrations only; nothing owned by
  search, ingest or lex edited — report needed changes instead.
- Every check watched failing against the real broken state. Numeric predictions recorded in
  `CHANGE_LOG.md` before each of T1–T3.
- Bytes before hypotheses: read the live schema before building on it — the handover's own column
  list came from a brief and a report, not from reading the table, and says so.
- **Report `docs/GRAPH_4A_REPORT.md`:** T1's blast-radius list first — one page, per consumer. Then
  T2's delta against its prediction. Then T3, T4, the Layer 2 sizing, and §5's four answers. Then
  §6's answer. Then what is NOT done, named. Decisions for Charlie as numbered questions with a
  recommendation and the consequence of each.
- Change-log and handoff entries labelled **GRAPH**.
