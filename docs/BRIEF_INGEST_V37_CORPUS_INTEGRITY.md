# BRIEF — INGEST V37: THE CORPUS AUDITS ITSELF

**Owner:** CC-Ingest
**Stream:** INGEST
**Written:** 12 August 2026
**Runs after:** V36 (the 17,261 missing instruments). **Do not start this until V36's recovery has
landed** — auditing a corpus that is mid-repair produces numbers nobody can act on.

**Where this sits:**
- *Last:* V35 (political sources indexed) → V36 (missing legislation recovered)
- **This: V37 — the instrument that would have found V36's gap in June**
- *Next:* Lords eligible-peer roll; `stage_outcomes`; the Railway remainder tidy-up

---

## §0 — Why this exists, stated plainly

Seventeen thousand instruments were missing from the corpus for months, including the Companies Act
2006 and UK GDPR, and **we found out by accident** — one engineer chased a single odd retrieval
result instead of filing it. No check would have caught it.

The reason is structural and worth naming, because it will recur in other forms otherwise: **every
check we built was a closed loop.** We asked *"did everything we queued succeed?"* and the answer was
always yes. We never asked *"was the queue right?"* A perfect score against a list missing 17,261
entries is indistinguishable from a perfect score against a complete one.

This sprint builds the checks that ask the second question. Three layers, in descending order of
value per hour of work.

---

## §1 — Layer two first, because it is the cheapest and the smartest

**Let the corpus audit itself using citations it already holds.**

Acts and instruments cite each other constantly, and we already extract those citations — the
Tier-1 citation graph was built on 5 July 2026 and powers the rescission-impact traversal, so **the
data exists and this is a query, not a build.**

The question to ask: **of every instrument our corpus refers to, how many do we actually hold?**

An Act citing the Companies Act 2006 while we have no Companies Act 2006 is the corpus pointing at
its own gap. No user has to notice. No query has to fail. It runs entirely on what is already there.

Deliverable:

- A report of every cited instrument identifier that resolves to **nothing** in `corpus_sections`,
  with the citation count (how many documents point at it) and a sample of the citing documents.
- **Rank by citation count.** An instrument cited 4,000 times and absent is a different order of
  problem from one cited twice, and the ranking makes the queue self-prioritising.
- Written to `docs/CORPUS_CITATION_GAPS.md` plus machine-readable JSON, in the shape of the existing
  reachability matrix.

⚠ **Expect false positives and classify them rather than suppressing them.** A citation may point at
something genuinely outside our scope — foreign law, a repealed instrument never published
digitally, a document that does not exist. Those are *findings*, not noise: "we cite this and cannot
hold it, for this reason" is a legitimate permanent state. What is not acceptable is a gap with no
classification.

⚠ **Run it once against the pre-V36 corpus if a snapshot allows it.** If this check would have
surfaced the Companies Act, that is the proof it works — and if it would not, we need to know why
before trusting it.

---

## §2 — Layer one: completeness against the source's own totals

The external check. **This is the only measurement that can catch something missing from both our
corpus and our own records**, which is exactly the blind spot V36 exposed — the 17,261 figure came
from comparing against an old internal table that is itself an incomplete snapshot.

Per document type and per year, compare what we hold against what the source itself publishes.
legislation.gov.uk will state how many Acts were passed in 2006; we count ours; the difference is a
gap with a name and a size.

- Start with legislation, where the source totals are cleanest and the stakes are highest.
- Extend to the parliamentary sources where an equivalent total exists.
- **Where no authoritative total exists, say so** and mark the collection *unverifiable* rather than
  *complete*. A collection nobody can check is a different state from a collection that checks out,
  and the two must not print the same word — the same principle as the `excluded-by-design` verdict.

**Schedule it monthly** and surface it. A check nobody reads is a check that does not exist.

⚠ **Add completeness to the reachability matrix.** Today that matrix answers "can a search reach this
collection" and is reported at 99.12%. It says nothing about whether the collection contains what it
claims to. **A collection 60% ingested and 100% reachable currently reports as healthy** — that
sentence is the whole lesson of V36 and it belongs in the matrix's own header.

---

## §3 — Layer three: catch it live

When the platform searches for a named instrument and finds nothing, that is a direct signal from
real use.

- Log the miss with the identifier sought and the query that sought it. **Do not surface anything to
  the user** — an error message about our own coverage is not their problem.
- Charlie's addition, and it is a good one: **the web-orientation pass should feed this too.** When
  the platform looks outside the corpus and the wider web names an Act we do not hold, that is a gap
  found by exactly the mechanism most likely to notice one — it is looking at what the world
  considers relevant rather than at what we happen to have.
- Accumulate into the same gap queue as §1 and §2, deduplicated, so all three layers feed one list.

---

## §4 — The gap filler

All three layers produce the same thing: a list of identifiers we should hold and do not. This is
what turns that list into corpus.

**Primed and ready, not silently autonomous.** Charlie's framing, and it is the right one.

- **Detect → size → price → queue.** For each gap: what it is, how many sections, estimated fetch
  and embedding cost, estimated time. Everything computed before anything is spent.
- **Notify Charlie** with that summary and a one-click approve. Batched, not per-gap — an alert per
  missing instrument is an alert nobody reads.
- **Below £15 total, run automatically.** Charlie's threshold. Log the spend, report it in the daily
  digest, and **track a running monthly total** — the point of a threshold is that it cannot be
  evaded by a hundred small jobs.
- **Above £15, wait for approval.** No exceptions, and no "the job was nearly under" reasoning.
- **A full-scope job:** fetch, chunk, embed, keyword index, semantic index rebuild, service restart.
  A gap half-filled is worse than a gap, because it stops appearing in the report while still being
  missing from the answers.

⚠ **The service restarts are the step that will be forgotten**, and V35 proved it twice in one day:
the keyword service loads its index once at startup and served a stale snapshot until restarted, and
the semantic service does not redeploy automatically at all. A gap filler that skips these fills the
gap in storage and not in the product — and reports success.

⚠ **Cap the batch size.** A run that discovers 17,000 gaps must not attempt 17,000 fetches
unattended. Process a bounded batch, report, and requeue the rest.

---

## §5 — What "done" looks like

- The citation gap report exists, is ranked, and its findings are classified rather than listed.
- The completeness check runs monthly against source totals and its output is somewhere Charlie will
  see it.
- Every gap, from whichever layer, lands in one queue with a size and a price attached.
- The filler has been run end-to-end on a small real batch — **including the index rebuilds and the
  service restarts** — and the result verified by retrieving one of the recovered documents through
  the product, not by reading a row count.

⚠ **And prove each new check can fail before trusting it to pass.** This whole sprint exists because
a suite of checks that always passed was measuring the wrong thing.
