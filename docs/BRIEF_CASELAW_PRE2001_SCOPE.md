# BRIEF — SCOPING: CASE LAW BEFORE 2001

**For:** CC-Ingest (or any free session — this is a scoping study, not a build)
**Written:** 22 August 2026, by CCh-Search
**Executes:** `CORPUS_COVERAGE_AUDIT_22_AUG.md`, "biggest genuine gaps"
**Format:** **scope only. Build nothing. Fetch nothing in bulk.** Deliverable is a decision document
for Charlie. One **`commit-ingest-caselaw-scope.sh`** at the end if any file is written; scoped
commits by explicit path.

---

## §0 — THE GAP, AND WHY IT IS THE LARGEST ONE WE HAVE

`tna-caselaw` holds 74,896 judgments and **starts in 2001**, because that is where the National
Archives' own Find Case Law service starts. We therefore hold **no** English judgment before 2001 —
no *Donoghue v Stevenson*, no *Anisminic*, no *Pepper v Hart*, no *Carlill*.

**Why that matters to this platform specifically.** Scrutinise's pitch is not "look up a case" — it
is *how has this law been interpreted, how has it been challenged, and what happened when it was
tried*. The doctrines a reformer runs into are largely pre-2001, and a proposal deepened against
post-2001 judgments alone will confidently miss the case everybody in the field would name first.
⚠ It is also the failure mode the platform is built to avoid: **the absence looks like an absence of
evidence rather than a gap**, because the search returns something plausible from 2004.

**This sprint decides nothing. It costs the decision out** so Charlie can make it on numbers.

---

## §1 — WHAT IS ACTUALLY AVAILABLE, AND ON WHAT TERMS

**Answer the licence question first, because it can end the sprint.**

1. **BAILII** is the obvious source. Establish, from BAILII's own published terms rather than from
   assumption or from a summary elsewhere: what is permitted, what bulk access is offered, what is
   forbidden, and whether there is a route for a non-commercial or academic body. **Quote the terms
   and link them.** ⚠ Do not probe, crawl or bulk-fetch to find out — reading the terms is the task.
2. ⚠ **Note the commercial question explicitly.** Scrutinise is a not-for-profit today and has
   discussed a commercial arm. A licence permitting non-commercial use only is a real constraint on
   that future, and the licence register already carries a `commercialUseExcluded` flag for exactly
   this. If the terms differ by use, say so in those terms.
3. **Find the alternatives before concluding.** At minimum: whether the National Archives publishes
   any pre-2001 material anywhere; the Incorporated Council of Law Reporting; the Supreme Court and
   House of Lords judgment archives (the Lords' judicial archive is a well-defined, bounded set and
   may be separately obtainable); Scottish and Northern Ireland equivalents, which have their own
   arrangements; and any open dataset of leading cases.
4. ⚠ **`ssrn` is already recorded as blocked for being licence-hostile.** That precedent is the right
   one: **a source we cannot use lawfully is not a source, however valuable.** If BAILII's terms
   forbid what we would need, the honest output of this sprint is "blocked, with reasons" — that is
   a successful sprint, not a failed one.

---

## §2 — SIZE AND COST, IF IT IS PERMITTED

Only if §1 finds a lawful route. Estimate, showing the arithmetic:

- **How many judgments**, by court and by decade, and what proportion of them are the ones anybody
  would actually cite. ⚠ A "leading cases" subset of a few thousand may deliver most of the value at
  a fraction of the cost, and **that option must be costed alongside the everything option** — a
  scoping study that offers only the maximal version is not offering a choice.
- **Fetch cost and elapsed time**, at whatever rate the source's terms permit.
- **Storage:** sections, words, R2 bytes, Neon heap. Price it at $0.35 per GB-month — the real
  figure, not a threshold. ⚠ Note that compute costs roughly eight times storage on our current
  bill; if the ingest itself is compute-heavy, that is the number that matters.
- **Embedding cost**, using the measured rate: the corpus embed was gated at ~$600 and came in at
  $430–520 for 22.7M chunks. Scale from that, and **state the estimate is likely low** — estimates
  in this project run low, twice this month.
- **Text quality risk.** ⚠ The 2001+ collection was stored with its stylesheet for months and nobody
  noticed. Whatever source is proposed, **name the specific check that would catch the equivalent
  failure on day one**, and cost it in.

---

## §3 — WHAT IT WOULD BUY, MEASURED RATHER THAN ASSERTED

Do not claim a benefit; **demonstrate the gap**.

- Take **ten legal questions a reformer would plausibly ask** where the governing authority is
  pre-2001. Run each through `runSearch()` today and record what comes back.
- Report, for each: is the answer absent, or — worse — is something post-2001 and wrong returned
  confidently? **The second is the real cost and the one to lead with.**
- ⚠ These ten are not gold questions and must not be presented as any kind of score. They are an
  illustration of a gap, with an n of ten, and the report must say so.

---

## §4 — THE DELIVERABLE

`docs/CASELAW_PRE2001_SCOPE.md`, written for Charlie to decide from:

1. **Is it lawful, and on what terms** — with the terms quoted and linked, and the commercial
   question answered separately.
2. **Two or three costed options**, at minimum "leading cases only" and "everything available",
   each with money, elapsed time, storage, and what it would buy from §3.
3. **A recommendation with the consequence of each choice stated**, as a numbered decision.
4. **What could go wrong**, named — including the text-quality check from §2.

⚠ **No downloader, no seeder, no schema change, and no bulk fetching.** If the answer turns out to be
easy and cheap, that is still a decision for Charlie, and a scoping sprint that quietly starts
building is how a £500 button gets pressed by accident.

## §5 — STANDING RULES

- Bytes before hypotheses: quote real terms and real responses, not recollections of them.
- Distinguish clearly, in every figure, between what a source publishes, what we could fetch, and
  what we would hold — those three have been conflated four times this month and it has cost hours
  each time.
- Change-log and handoff entries labelled **INGEST**.
