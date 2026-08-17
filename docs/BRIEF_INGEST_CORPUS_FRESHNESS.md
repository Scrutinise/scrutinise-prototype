# BRIEF — INGEST: two corpus-freshness items found downstream

**Thread:** INGEST. **Written:** 17 August 2026 (CCh-Lex). **Priority:** neither is urgent; both are
cheap and both are currently making a downstream feature look worse than it is.

Corpus quality is an ongoing upgrade and neither item gates anything. They are written down because
both were found by a *consumer* rather than by ingest's own checks, which is the useful part.

---

## §1 — ~25% of committee `publications` ids are dead at source

**Found by:** Sprint 3-E Task 8, measuring a URL repair with a live probe.

**What was measured (2026-08-15, curl with a browser user-agent — the site answers a bare curl UA
with 403 on every path, which reads exactly like a dead link and is not one):**

- The stored URL form for committee documents was the bare `/{id}/`, which **404s for all three
  families**. The addressable form is `/{id}/html/`. That was a URL-construction defect and it is
  fixed at display time in `lib/lex/committee-url.ts`.
- After the repair: **written evidence and oral evidence resolve essentially 100%.**
- **`publications` does not.** Roughly a quarter of sampled ids 404 in *both* forms — bare and
  `/html/` — from a clean shell, twice. Examples include `/publications/22140/` and
  `/publications/13110/`, the latter being the very id a check had been asserting against.

**The diagnosis:** dead in both forms means the id no longer exists on `committees.parliament.uk`.
That is not a URL-form problem and cannot be fixed downstream. **The ids have been withdrawn,
renumbered or superseded at source since ingest.**

**What is wanted, in order of cost:**

1. **Measure the true rate.** The 25% figure is from a sample of 24. Run it across the
   `committees-reports` corpus properly so we know whether this is a handful or tens of thousands.
2. **Establish why.** Renumbering on republication is the obvious hypothesis — the same pattern as
   TheyWorkForYou's scrapeversion letters, which caused the `corpus_fts` orphans in August. If ids are
   reissued rather than retired, a re-crawl fixes it and a deletion would be wrong.
3. **Decide the policy.** Re-crawl and update the ids; or mark the rows unavailable so they stop being
   surfaced as sources; or leave them and accept a known dead-link rate. **Any of the three is
   defensible; the current position — surfacing them as live citations — is not.**

⚠ **Why this matters more than a broken link usually would.** A user clicks a citation *precisely* to
check whether we are telling the truth. A dead citation on a scrutiny platform is worse than no
citation, because it looks like a fabricated source rather than a stale one — and the user cannot tell
the difference.

**Not to be fixed downstream.** `check:legislation-urls --live` now asserts what the repair owns (the
stored form never opens; the repair never shuts a working link; the repair opens links that were shut)
and **reports the dead-at-source rate per family as information** rather than averaging it into a pass
rate. That was deliberate: a check that goes red for another thread's data gets deleted.

---

## §2 — Record the surface on the edge when a sweep writes one

**Found by:** the position-graph Amendment 2 report, §1.

**The gap.** `graph_mention` is meant to show **"the name as it appeared"** — the surface form of the
actor at the point of the mention. It cannot, because the surface is not recoverable per appearance:

- `graph_edge` has no surface column;
- `corpus_sections.speaker` — the obvious recovery route — is **NULL on 5,000 of 5,000 sampled
  `committees-evidence` sections** that `graph_evidence` actually points at;
- the surfaces we do hold live in `graph_alias`, keyed on (entity, source), not on the appearance.

So `graph_mention.display_name` currently carries the **entity's canonical name** with
`surface_is_per_entity = TRUE` beside it — which is honest, and the right call, because picking a
surface per appearance and presenting it as the one used would be an invented fact.

**What is wanted:** when a sweep writes an edge, **write the surface it matched on alongside it.**
One column, populated at write time. It cannot be reconstructed afterwards, which is why this is worth
doing before the next sweep rather than after.

**Why it matters downstream.** §26.3 (Advancement) wants to show a user *"this is the name as it
appeared in the record"* when surfacing who has taken a position on a comparable measure. Showing a
canonical name where the record says something else is a small dishonesty, and it is the kind that
erodes trust in everything around it.

**Related, and already flagged to CC-GRAPH rather than here:** three of the 788 register name-matches
stand on a single-word surface the register itself says belongs to more than one member (`Mr George`,
`Robinson`, `Baroness Meacher`), recorded at confidence 0.9. That is a matching-rule question, not an
ingest one.

---

## §3 — Nothing else is blocking

For the record, since it has been carried in three briefs and is now closed: the 17,261 absent
instruments are ingested, and impact assessments, consultations, explanatory notes and division votes
are all in and typed. **No corpus gap currently gates any Lex work.** Both items above are quality
improvements to material we already hold, and the Lex side degrades honestly in the meantime — a
question with nothing behind it renders as a stated gap rather than an absence.
