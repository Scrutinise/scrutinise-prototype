# BRIEF — STAGE 2D SPRINT 2: THE EDGES THAT ARE ALREADY PAID FOR

**Owner:** CC-Graph
**Stream:** GRAPH
**Written:** 16 August 2026
**Design:** `docs/POSITION_GRAPH_DESIGN.md` and its Amendment 1. Read both.
**Follows:** 2D-1 — the entity spine, 86,816 entities, 164,135 edges, 100% evidence coverage.

**Runs fully in parallel with the corpus work, and that is the point.** Nothing here touches
`corpus_sections`, the keyword index, the semantic index, or either search service. It reads
`division_votes`, `corpus_sections` metadata and the Hansard XML, and writes only to `graph_*`
tables. **CC-Ingest and CC-Search can rebuild indexes underneath this without collision.**

---

## §0 — Why these three, in this order

Every edge in this sprint comes from data **already ingested and already paid for**. There is no new
source, no external register, no LLM extraction and no scraping. It is joining things we hold.

1. **`voted`** — 2,528,032 division-vote rows landed in V34 and nothing consumes them.
2. **The `person_id` sweep** — the fix for the graph's weakest point, and a prerequisite for
   anything user-facing about a named MP.
3. **`signed-motion` (primary sponsor)** — 60,737 rows, already structural, free.

⚠ **Take them in that order and do not reorder for convenience.** `voted` is the highest-value edge
and joins on a key we already have. The sweep is the one that makes person data trustworthy, and
everything MP-facing is gated behind it.

---

## §1 — `voted`: MP → division

The design's §3 names it and V34 delivered the data. **2,528,032 vote rows**, covering the Commons
from 2016 and the Lords from 1999, each carrying the member id.

The join is the `parl_member_id` this graph already populates on 438 people. That is the cheap half.
The rest of the members need resolving — see §2, which is why the sweep comes next rather than later.

Requirements:

- **Store the vote itself, not a summary.** Aye, no, teller, and — separately — absent. §5.4 of the
  design applies without exception: an MP who did not vote did not vote against. Conflating the two
  would be the single most misleading thing this graph could do.
- **Date every edge**, as everywhere else. A member's votes across a decade are a record of a
  changing position, and the design's rule is that a changed position is a finding.
- **Carry the parent Bill and the stage**, per the earlier work on divisions. A clause of interest
  may sit inside a Bill about something else, and the parent title can be actively misleading about
  what was voted on.
- ⚠ **"Passed without a division" must remain expressible.** V34 left `stage_outcomes` deliberately
  empty rather than populate it by fuzzy title match, which was right. Do not infer it here either.
  A provision with no division edge means *we have no division record*, not *there was no division*.

**Report:** edges written, members resolved against members unresolved, date range, and evidence
coverage — which must be 100%, as in 2D-1.

---

## §2 — The `person_id` sweep: make people real

**99.6% of person entities rest on a name match at 0.7 confidence.** `Mr Andrew Smith`,
`Dr Andrew Smith` and `Professor Andrew Smith` may be one person or three, and the graph cannot tell.

This is the graph's weakest point and it is stated as such in 2D-1's own report. It is also fixable
with data we hold: **the Parliament person id sits on 98.5% of Hansard speeches and has never been
parsed.**

- Sweep the person id out of the source and attach it to the entities.
- **Report the resolution rate**: how many name-clusters resolve to a stable id, how many merge, how
  many split, and how many remain unresolved.
- ⚠ **A split is more important than a merge and harder to notice.** If one entity turns out to be
  two people, every edge it holds is now attributed to the wrong person half the time. Log every
  split to `graph_merge_log` in a form that can be audited, and report the count prominently rather
  than as a footnote.
- **When in doubt, do not merge.** Unchanged from 2D-1, and it matters more here because the sweep
  will be tempted to resolve aggressively.

⚠ **Do not build `spoke-in` in this sprint.** 2D-1 declined it for the right reason — name-matching
8.8 million speeches would merge distinct people wholesale — and that reason only stops applying
once this sweep has reported. Getting the identities right is the deliverable; the edges built on
them come next.

---

## §3 — `signed-motion`: the primary sponsor, which is free

Amendment 1 covers this. The primary sponsor is **already structural on all 60,737 EDM rows** —
`speaker` is 100% populated and holds the sponsor's name, spanning 1989 to 2026. No sweep, no fetch,
from columns we already have.

- ⚠ **The Parliament member id is on the wire and we drop it.** The API's list item carries
  `PrimarySponsor.MnisId` and our ingest keeps only the display name — the same shape of loss as
  everywhere else in this project. Recovering it is a small metadata sweep and it makes these edges
  keyed rather than name-matched. Worth doing here rather than leaving for later.
- **Full signatories are a separate job and not in this sprint.** Charlie confirmed from a browser
  that `edm.parliament.uk` displays them, with party, date and a withdrawn-signatures tab — so it is
  a scrape, not an impossibility. 60,737 pages is a real sweep with its own licence and rate-limit
  questions. Scope it separately, and note that **a withdrawn signature is a changed position**,
  which the design treats as a finding rather than noise.

---

## §4 — Consultation responders: report only, do not build

V34 ingested **7,448 consultations** and the design calls responses *"the 'who said what before the
law passed' record"* and the highest-value single input to the position graph.

**Establish whether the responding organisation is recoverable, and report. Do not build the edge.**

The question is the same one §1 of 2D-1 asked about committee evidence, and the answer decided that
sprint: is the responder structured, or only inside the document text? If structured, this is a
metadata sweep and a large win. If it is prose, it is an extraction job and a different sprint.

Counts, not impressions. **Bytes before hypotheses.**

---

## §5 — What "done" looks like

- `voted` edges written, with evidence coverage at 100%
- The person resolution rate, with merges and **splits** reported separately
- `signed-motion` primary-sponsor edges, keyed where the id was recoverable
- A written answer on consultation responders
- **Three MPs read by hand** — pick people whose voting records you can check against a public
  source, and confirm the graph says nothing obviously wrong about them. If it does, the counts are
  decoration. 2D-1 did this with organisations and it was worth more than any of the totals.

⚠ **Nothing in this sprint becomes user-facing.** Person data stays behind the sweep's own result:
until the resolution rate is good, person entities are name clusters and must not be presented as
people.

---

## Working rules

Unchanged. **Bytes before hypotheses. Prove a check can fail before trusting it passes. An inference
must not travel as a measurement. Scoped commits by explicit path — three threads share this tree.**
Label change-log and handoff entries **GRAPH**.
