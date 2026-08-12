# BRIEF — INGEST V36: THE 17,261 MISSING INSTRUMENTS

**Owner:** CC-Ingest
**Stream:** INGEST
**Written:** 12 August 2026
**Priority:** highest open item in the project. Everything else in search is tuning; this is
the corpus not containing the law.

**Where this sits:**
- *Last:* V34 (political sources ingested) → V35 (indexed on both halves, complete)
- **This: V36 — recover the legislation that was never ingested**
- *Blocks:* the `LegislationSection` DROP, and the recall ceiling on every search measurement we take
- *Next:* the DROP, once `corpus_sections` is a genuine superset

---

## §0 — What CC-Search found, and why it outranks everything else

Chasing a single retrieval failure — UK GDPR absent from the top 20 — CC-Search established that it
is **not in the corpus at all**. Nor is the **Companies Act 2006** (1,665 sections). Nor are
**17,261 other instruments** known to the legacy `LegislationItem` table: **ukpga 8,896 · uksi 4,668
· eur 2,268 · ssi 732**, carrying roughly **77,000 sections and 61.2M characters**. The Law of
Property Act 1925, the Housing Benefit Regulations 2006 and the Jobseeker's Allowance Regulations
1996 are among them.

Two consequences, both measured rather than argued:

1. **This is the binding constraint on search quality.** The recall diagnosis over the preference
   pairs came out ABSENT 9 · RANKING 5 · CANDIDATES 3 · ROUTING 0 · TYPING 0. No probe count, no
   reranker and no candidate-set change can retrieve a document that is not in the index.
2. **`LegislationSection` holds the only copy.** The DROP must not proceed, and CC-Search stopped
   the repoints on that evidence. The legacy path is live coverage: it returns Companies Act 2006
   s.656 at rank 1 and UK GDPR Articles 9 and 6 at ranks 2 and 7 on the exact queries where the
   corpus path returns nothing.

⚠ **A user asking about company directors' duties or data protection today gets an answer with the
principal instrument missing from it.** That is the worst failure mode this platform has — not a
wrong answer, but a confident, well-cited answer with the central provision silently absent. It is
directly against the never-claim discipline, and it is invisible to the user.

---

## §1 — Establish what happened before deciding how to fix it

**Bytes before hypotheses**, and this step may change the rest of the brief.

The corpus has been reported at 99.12% *reachable* for two sprints, which measured whether an
indexed collection could be selected by a stream. **Nobody has measured whether the collections are
complete.** Those are different questions and the difference has cost us a fortnight of tuning
against a ceiling we did not know was there.

1. **Are the 17,261 a coherent set or a scatter?** By doctype, by year, by whether they were ever in
   `corpus_targets`, by whether a queue row exists and in what state. A systematic gap (a failed
   sweep, a truncated enumeration, a date window) is one fix; 17,261 individual failures is another.
2. **Were they attempted?** Check `corpus_targets` and the queue for `done`, `failed` and absent
   rows separately. A `done` row with no section is the V34 failure class — R2 object present,
   section row absent, resume logic short-circuiting — and if that is what happened here, the same
   defect may be live elsewhere.
3. **Is 17,261 the whole gap, or only the part the legacy table happens to know about?** This is the
   question I most want answered. The legacy table is itself a partial snapshot. **Reconcile against
   legislation.gov.uk's own totals per doctype and year**, not against `LegislationItem`. If the
   true gap is larger, we need to know now.
4. **Does the legacy text match the source?** If `LegislationSection` holds usable text for some of
   these, migrating from it is far cheaper than re-fetching — but only if it is current. Sample and
   compare against legislation.gov.uk before assuming either way.

**Report before ingesting.** The route depends entirely on what §1 finds.

---

## §2 — Recover them

Route chosen from §1's findings, in the standing priority order: **bulk download → HTML → API.**
legislation.gov.uk publishes CLML in bulk and we already run that pipeline, so this is most likely a
re-run of an existing route over a defined list rather than new machinery.

Requirements:

- **Predict cost, sections and wall-clock in `CHANGE_LOG` before starting**, and score it after. V35
  scored $4.87 against $4.50 predicted, which is the standard now.
- **Reconcile against the source's own totals**, not against a count of what we fetched. The V34
  Commons enumerator would have reported success having ingested 25 of 2,361 rows, and the only
  thing that would have caught it was reconciliation against `searchTotalResults`.
- **Classify every gap.** An instrument that cannot be fetched is recorded with its reason, never
  dropped. Known unknowns beat silent absences.

## §3 — Then index, as V35 did

Chunk, embed under a `--max-cost` ceiling, FTS build, ANN rebuild, `vector-serve` redeploy, and
`verify-vector-index.ts` watched failing first. **77,000 sections is roughly 2.4× the V35 delta**, so
expect an embed in the region of $12–15 — predict it properly rather than taking that figure.

⚠ `vector-serve` does not auto-deploy from GitHub. ⚠ `fts-serve` calls `openTable()` once at boot, so
an after-measurement without a restart is meaningless. ⚠ The heavy job is **`vector-reindex`**, not
`vector-index`.

## §4 — Report

Instruments recovered against the 17,261; sections added; the reconciliation against source totals;
gaps classified with reasons; predicted versus actual cost. And the number CC-Search needs:
**re-run `diagnose-recall.ts` and report the new ABSENT count.** That is the acceptance test for
this sprint — not the row count.

---

## §5 — A standing addition to the playbook

**Reachability is not completeness, and we have been measuring only the first.** Add a completeness
check to the corpus reachability matrix: per collection, sections held against the source's own
published total, with the date of the last reconciliation. A collection that is 60% ingested and
100% reachable currently reports as healthy.

That is the instrument that would have caught this in June rather than in August.
