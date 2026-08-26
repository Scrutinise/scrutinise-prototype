#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════════════════════
# C3A_EXECUTE.sh — the writes THIS session built, proved and could not run.
#
# Same reason as C3_EXECUTE.sh: Claude Code's auto-mode classifier refuses production DELETE and
# DDL from a session, whatever the sprint brief authorises. `ots-filter.ts --apply --execute` was
# attempted on 2026-08-26 and refused. Everything below is dry-run proven, guarded, and reversible.
#
# ⚠⚠ THIS SCRIPT DOES NOT REPLACE `docs/C3_EXECUTE.sh` — IT COMES AFTER IT.
#     C3_EXECUTE.sh is still unrun: measured 2026-08-26 13:05 UTC, all eight purge collections are
#     at their full counts and nothing has been deleted. Run that first, or run neither.
#
# ⚠ RUN THE STEPS IN ORDER AND READ THE OUTPUT. Each prints before/after counts and aborts on a
#   mismatch. A step that aborts has changed nothing.
#
# Working directory:  cd C:/Code/scrutinise-prototype/scripts/ingest
# ══════════════════════════════════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/../scripts/ingest"
TSX=./node_modules/.bin/tsx

echo "════════ STEP 0 — where am I? (CLAUDE.md §16) ════════"
$TSX c2/c3-whichdb.ts
echo
echo "Expect: ep-old-dust-aboxi69a.eu-west-2.aws.neon.tech / neondb."
echo "⚠ If ots-reports still reads 497, this script is in the right state. If it reads 76, step 1"
echo "  has already run; skip to step 2."
read -r -p "Continue? [y/N] " a; [ "$a" = "y" ] || exit 1

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 1 — ots-reports: delete the 421, keep the 76 (ADDENDUM §1) ════════"
# Measured against the gov.uk content API, 497 of 497 readable, TWICE — 24 Aug and 26 Aug, with
# 497 of 497 identical verdicts:
#     KEEP    76   published by office-of-tax-simplification
#     DELETE 421   published by somebody else (187 HMRC, 69 HM Treasury, 53 GDS …)
#     HOLD     0   unreadable
#
# ⚠ THE CLASSIFICATION MUST BE FRESH. --apply aborts if the collection no longer holds exactly the
#   number of rows the classification covers. Re-classify if it has been days.
# ⚠ ALL THREE LAYERS, IN ONE COMMAND. The previous version of this script ended by printing
#   "INDEX LAYER NOT DONE HERE", which is the defect the purge exists to fix, one layer along.
# ⚠ REVERSIBLE: every full row is written to c2/purge-manifests/ots-reports.<stamp>.json first.
$TSX c2/ots-filter.ts --classify          # re-read the collection; writes its own stamped file
$TSX c2/ots-filter.ts --apply             # DRY RUN across Neon + corpus_fts + corpus_chunks + corpus_vec
echo
echo "Read the three '── <table>' blocks above. Each must report a NON-ZERO id match."
read -r -p "Execute the ots-reports delete? [y/N] " a; [ "$a" = "y" ] || exit 1
$TSX c2/ots-filter.ts --apply --execute

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 2 — redeploy fts-serve and vector-serve ════════"
# ⚠ Both hold their Lance tables open from boot. Until they are redeployed the 421 rows are still
#   being served and NOTHING ABOVE HAS REACHED A USER.
echo "Redeploy both on Railway (staggered, per CLAUDE.md), then continue."
read -r -p "Both redeployed? [y/N] " a; [ "$a" = "y" ] || exit 1

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 3 — re-seed ots-reports from the publisher's own field ════════"
# ⚠⚠ ORDER IS LOAD-BEARING: THIS MUST COME AFTER STEP 1, NOT BEFORE.
#    The re-seed adds up to 146 rows. Step 1's guard requires the classification to cover the
#    collection EXACTLY as it stands, so seeding first makes the delete abort — the guard doing its
#    job, on a mess this ordering avoids.
#
# `sources/gov-scraper.ts` now seeds `filter_organisations=office-of-tax-simplification` (222
# documents, a closed universe — the OTS was abolished in 2023) instead of a free-text search over
# 348,062 results capped at 500. The script REFUSES to queue if that fix is not in the file.
# `r2Exists` skips the 76 already compiled, so this is a 146-document fetch.
$TSX c3a/ots-reseed.ts                    # dry run: enumerate, diff, attachment census
read -r -p "Queue the re-seed? [y/N] " a; [ "$a" = "y" ] || exit 1
$TSX c3a/ots-reseed.ts --execute
echo "⚠ A QUEUE ROW IS NOT A FETCH. A worker must claim it. Say 'queued' until the rows are re-read."

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 4 — give ots-reports a denominator that is not its own numerator ════════"
# corpus_targets.est_sections for ots-reports is 497 with est_is_confirmed = true — i.e. the
# estimate IS the row count, which can never disagree with itself. The real denominator is 222,
# from the publisher, and the collection can then honestly be called complete.
$TSX c3a/ots-measured.ts                  # dry run
read -r -p "Write est_sections = 222, MEASURED? [y/N] " a; [ "$a" = "y" ] || exit 1
$TSX c3a/ots-measured.ts --execute

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 5 — the 51 employment tribunal judgments that DO exist (ADDENDUM §8) ════════"
# The whole population of 503 orphans has now been read, not a 200-row sample:
#     51 carry a judgment PDF · 452 do not · 0 gone · 0 error
# The 452 are a COVERAGE BOUNDARY, declared in CORPUS_SCOPE.md: 425 of them (94%) are Scottish, by
# the six-digit pre-2013 case numbering or a 41xx Scottish office number, and gov.uk lists those
# with no judgment attached, ever. 0 of the 51 WITH a judgment are six-digit or pre-2013.
#
# ⚠ The fetch is the GENERAL PATH — a `govuk-content` queue row per document, the same code that
#   ingested the other 131,147 judgments. The landing page keeps `:1`; the judgment lands at `:2`.
$TSX c3a/et-orphans-refetch.ts            # dry run
read -r -p "Queue the 51? [y/N] " a; [ "$a" = "y" ] || exit 1
$TSX c3a/et-orphans-refetch.ts --execute

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 6 — the dot-leader and partial-repeal records (ADDENDUM §4 / D-3) ════════"
# This is STEP 7 of docs/C3_EXECUTE.sh and it is repeated here because the addendum settles it:
# WRITE THE RECORDS, LEAVE THE INDEX ALONE.
#   · ~32,040 `partial-dot-leader` records that have never existed
#   · the ~1,487 whole-body dot leaders `section_repeals` never held (the `12ZA . . . .` class)
# ⚠ INSERT-ONLY — `ON CONFLICT (section_id) DO NOTHING`, and it contains no DELETE of any kind.
#   Deleting those rows from `corpus_fts` would move BM25 document frequencies across the whole
#   table and void every recall number taken before it. They stay in the index, costing query time,
#   correctly, and invisibly. Revisit only alongside a planned baseline re-take.
# ⚠ No index rebuild and no redeploy: `search-gateway.ts` reads `section_repeals` live.
$TSX c2/b3-backfill-partial.ts --dry-run --limit=20000
read -r -p "Execute the backfill? [y/N] " a; [ "$a" = "y" ] || exit 1
$TSX c2/b3-backfill-partial.ts --execute

echo
echo "════════ DONE — and three things are deliberately NOT in this script ════════"
cat <<'NOTE'

1. THE TREATY SCOPE CHANGE (D-2) IS NOT HERE, ON PURPOSE.
   It is a search-stream change and the addendum says: provide the measurement, do not edit their
   files. Measured 2026-08-26, and the recommendation is OPTION A — admit `uk-treaties` and
   `tax-treaties-dta` to the debates stream:
     · reachability   0/12 today → 12/12 under option A, identical to what a sixth stream sees
     · displacement   0 treaty rows entered the top 20 of ANY of the 11 validated Gold v2 debates
                      questions, all 11 returning a full 20-row set
     · cost           option A is the same retrieval call; option B is a sixth concurrent call
                      against vector-serve's concurrency cap of 4
   ⚠ The recall half of the before-and-after COULD NOT BE TAKEN here: this machine's harness is
     BM25-only and 0 of 14 validated keys are retrievable even when the query is the document's own
     title. Take the definitive before-and-after through the full hybrid gateway before shipping.
   Artefact: docs/census/C3A_d2_treaty_scope.json

2. THE HOUSE OF LORDS INGEST (C3 Lane C3) IS NOT HERE.
   Gate 1 is GREEN by a route that is not a crawl: the Internet Archive answers Node's own fetch
   (the National Archives' UK Government Web Archive does NOT — 405 "Human Verification"). 2,820
   archived judgment pages, 1,088 distinct cases, ~2.2s each = under an hour of fetching.
   ⚠ BUT IT IS NOT READY TO RUN, and hand-reading five documents is what showed why:
     · 4 of 20 pilot pages END WITH THE WORD "Continue" — a Lords opinion is PAGINATED, so one page
       is a fragment of one opinion, not the judgment
     · one page passed every check while opening "Search Advanced Search Home Glossary Index
       Contact Us…" — the 2005-06 template's navigation vocabulary is not the one C3's banned-word
       list was drawn from
   The gate now tests POSITIVELY (the text must BEGIN with the court's own formal heading) and
   detects the pagination, and it is 13/20 on the raw pages. The ingest needs per-case assembly
   across `-1/-2/-3` pages AND across "Continue" pagination first.
   Artefacts: docs/census/C3A_lords_archive_list.json · C3A_lords_pilot.json

3. LANE D IS NOT HERE — ITS PREDICTION IS LOGGED AND THE RUN IS CHARLIE'S CALL.
   Per D-5, the prediction went into CHANGE_LOG.md BEFORE any of it runs. ⚠ It records a
   disagreement rather than hiding it: the C3 brief costs Lane D at ~91,500 sections, while A5's
   own pilot projects 250,725 over the same work list. One of those is wrong and the run settles it.
NOTE
