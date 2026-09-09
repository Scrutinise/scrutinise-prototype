# ADDENDUM TO BRIEF INGEST C3 — after the first pass (v2)

**Written:** 26 August 2026 · **Author:** CCh-Ingest for Charlie
**Read with:** `docs/BRIEF_INGEST_C3_EXECUTE.md` (still the governing brief) and `docs/INGEST_C3_REPORT.md`.
**v2 supersedes the 24 Aug version**, which is withdrawn. Two things changed: the `ots-reports`
remedy was wrong in v1, and the dot-leader work now belongs to a different brief.

C3 landed B2/B4, B3, B5, B6, C2, E3 and F4, and proved Lane A without executing it. Everything else
in C3 stands unchanged. This addendum settles the five open decisions and amends three lanes.

---

## ⚠ Ownership, before anything else

`BRIEF_INGEST_REPEALED.md` was written by **CCh-Search** and targets **CC-Ingest**, the same stream
this addendum targets. Two architect conversations are now briefing one implementation stream.

**Split as follows, and do not let the two overlap:**

- **`BRIEF_INGEST_REPEALED.md` owns everything about dot leaders and repeals** — the detector, the
  repeal records, the user-facing wording, the *as enacted* fetch, and the partial repeals.
  **v1 of this addendum had a section on the dot-leader detector. It is deleted.** REPEALED's §2.1
  is the better instruction and is now the only one.
- **This addendum owns the rest of C3** — `ots-reports`, the treaty streams, the Lords archive, the
  tribunal boundary, Lane D and the register.

Where they touch, REPEALED wins.

---

## 1. `ots-reports` — D-1 answered: delete the 421, keep the 76, then re-seed to 222

**The rule in C3 Lane A was wrong and CC was right to refuse it.** I wrote it against "≥69 of 497
contaminated" and specified deleting only news and speech rows. Measured against the publisher's own
organisation field: **421 of 497 (84.7%) were not published by the OTS at all.** My rule would have
deleted **27 genuine OTS press releases** — including *"Government announces closure of the Office of
Tax Simplification"* — and left **380 non-OTS rows serving**. Worse than doing nothing.

**v1 of this addendum then said "purge all 497 and re-seed". That is also wrong**, more mildly: it
throws away 76 documents we already hold correctly and pays to fetch them again. Adopt CC's version.

1. Delete the **421** rows the publisher's `filter_organisations` field says are not OTS, and their
   vectors. Keep the 76.
2. Re-seed from `filter_organisations=office-of-tax-simplification`, which returns **222** documents.
   We hold 76 of them, so this is a 146-document fetch, not a 497-document one.
3. The OTS was abolished in 2023, so 222 is a **closed and finite universe.** Mark the collection
   `MEASURED` with 222 as a real denominator — one of the few collections that can honestly be
   complete.
4. Of the 421 leaving, 273 are duplicates of collections that hold them properly. **~148 are held
   nowhere else, and ~50 of those are substantive.** Do not retain them under a false label; list
   them, and re-ingest them into `consultations` or `govuk-content` from the right source as a
   separate item.

**Then sweep for the cause, which is not the rows.** The seeder is
`sources/gov-scraper.ts:176` — a free-text relevance search with **no publisher filter**, over a
query returning `total: 347,938`, of which we kept the first 500. Relevance decays continuously, so
there is no category of contamination to remove; the cut has to come from outside the query.
**Report every other collection seeded by a capped free-text search, with its cap, before fixing any
of them.**

## 2. `source-audit.ts` has been checking the wrong thing since V1 — sweep it

It asserts `minSize: 5000` on `/government/collections/office-of-tax-simplification-reports`, which
**404s**. A gov.uk 404 page comfortably satisfies a 5,000-byte floor, so the check has passed for
months against a URL that does not exist.

> **A size threshold is not an existence check.**

Audit every rule in `source-audit.ts` for the same shape: a threshold standing in for a fact. Report
the list before changing any of it. This is the same class as the denominator that equalled its own
numerator and the delete that matched nothing — **a check that cannot fail.**

## 3. D-2 — the two unreachable treaty collections: measure, then decide

▶ **Adopt CC's recommendation.** 3,574 sections are unreachable at any setting while their sibling
`uk-treaties-fcdo` answers treaty questions purely because it happens to be typed DEBATE. Gold v2 has
11 debates questions, so a scope change can ship with a before-and-after, which is the established
rule.

Measure both options and decide on the number: admitting the TREATY type to the debates stream costs
nothing per query; a sixth stream costs one extra retrieval call against `vector-serve`'s concurrency
cap of 4. ⚠ **This is a search-stream change. Provide the measurement and the recommendation; do not
edit their files.**

## 4. D-3 — the ~1,487 dot leaders never held: write the records, leave the index alone

▶ **Adopt CC's recommendation.** Writing the records (step 7 of `C3_EXECUTE.sh`) stops them being
returned immediately at zero risk, because the gateway exclusion reads from `section_repeals`.

⚠ **Do not delete them from `corpus_fts`.** That moves BM25 document frequencies across the whole
table and voids every recall number taken before it. They stay in the index costing query time,
correctly, and invisibly. Revisit only alongside a planned baseline re-take.

## 5. D-4 — `historic-hansard`'s `1013-06-24`: record it, and let REPEALED confirm the cause

▶ **Adopt CC's recommendation** — record as an open item and move on. It is one row's parse artefact
and no user-facing surface facets on that date today. ⚠ It becomes urgent the moment a date filter
ships over 4.6 million sections. REPEALED §5 already asks for the cause to be confirmed; leave it
there rather than duplicating the work here.

## 6. D-5 — Lane D's prediction: log it first, without exception

▶ **Adopt CC's recommendation.** A prediction written after the measurement is not a prediction.
Lane D is the largest remaining piece of ingest work and the one where a wrong cost estimate is
expensive. This sprint has already shown why: prediction 6 was refuted at 7.4 minutes because the
probes it rested on used quoted identifiers and were measuring nothing — **a suspiciously good number
was read as good news.**

## 7. Lane C3 — the House of Lords archive needs a different route

Gate 1 is red: `parliament.uk` returns 403 with a Cloudflare challenge **on every host**, not just
the one already documented. A plain fetcher cannot reach the archive.

Do not spend more time on the fetcher. In this order:

1. Ask whether an archive copy exists that does not require crawling — the Parliamentary Archives, or
   the National Archives UK Government Web Archive, which holds `parliament.uk` snapshots and does
   not challenge.
2. If not, a browser-capable fetch is the only route. Pilot 20, hand-read 5, and keep the C3 quality
   gate unchanged — it is still the part that must be watched failing first.
3. Report the cost in time before fetching 760 documents. If a browser route makes this a multi-day
   job rather than an afternoon, it moves behind Lane D.

## 8. Lane C2 — the 503 tribunal orphans are mostly a boundary, not a fetch

Only **10.5% (≈53) have a judgment available at all.** The rest are Scottish employment tribunal
decisions from before 2013, which are not published. Fetch the 53. Declare the remainder as a
coverage boundary in the same form as B1: *"Scottish employment tribunal decisions before 2013 are
not published and are not held."*

## 9. B1 remains the highest-value unstarted item in this brief

Ten well-known pre-2003 authorities still return either nothing or a different case with a similar
name. B1 is ~2 days, needs no fetching and no licence, and is the thing a user notices first.

⚠ **Sequencing, now that two briefs are live.** REPEALED §2 ships the repeal labelling and is
independently valuable. B1 ships the case-law boundary. **They are the same idea applied to two
corpora — say what we do not hold, rather than going quiet — and they should land together or in
consecutive sprints, not months apart.** Whichever runs first, the wording must match.

---

## Standing rules added by this sprint

- **A predicate that matches nothing must abort, not succeed.** LanceDB accepts a double-quoted
  identifier, matches zero rows, and raises nothing: `id = 'x'` returns 1, `"id" = 'x'` returns 0. A
  `delete()` written that way removes nothing and reports success. Count before deleting; refuse to
  run on a zero match. Now in `l2-purge.ts`; it belongs everywhere.
- **Sweep the codebase for quoted identifiers in LanceDB predicates.** Anywhere else this appears is
  silently doing nothing and reporting success. Report the list before changing any of it.
- **Suspiciously good is a symptom.** The quoted form is ~70× faster because it prunes every
  fragment. Speed arriving without a cause is a reason to look, not to celebrate.
- **A size threshold is not an existence check.** A 404 page satisfies `minSize: 5000`.
- **Predict from measurement, not from the brief's framing.** The `ots-reports` prediction (60–110)
  was refuted at 421 because it restated my number instead of testing it. **A prediction that agrees
  with the brief is not evidence** — it is the brief, repeated.
- **A step printed as "not done here" is not a step.** `l2-purge.ts` ended by printing
  `NEXT (index layer, not done here)` — the same defect the purge exists to fix, one layer along.
- **Write incrementally, not at the end.** `l2-measure.ts` produced every measurement it was asked
  for and then crashed on its last query before its single `writeFileSync`.
