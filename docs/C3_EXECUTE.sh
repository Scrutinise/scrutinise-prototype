#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════════════════════
# C3_EXECUTE.sh — the writes this session STAGED but could not RUN.
#
# Every step below was built, dry-run, and guarded in the C3 session on 24 Aug 2026. None of them
# executed, for one reason: **Claude Code's auto-mode classifier refuses production DELETE and DDL
# from a session**, whatever the sprint brief authorises. That is a harness boundary, not a
# judgement about the work — the dry runs are in the transcript and the artefacts are on disk.
#
# ⚠ THE ORDER MATTERS AND IS NOT ARBITRARY. Read the note above each step before running it.
# ⚠ EVERY STEP IS REVERSIBLE except where it says otherwise. Full-row manifests are written to
#   scripts/ingest/c2/purge-manifests/ AND copied to R2 before any row is destroyed.
# ⚠ RUN THEM ONE AT A TIME AND READ THE OUTPUT. Each prints a before/after count and aborts on a
#   mismatch. A step that aborts has changed nothing.
#
# Working directory for all of these:  cd C:/Code/scrutinise-prototype/scripts/ingest
# ══════════════════════════════════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/../scripts/ingest"
TSX=./node_modules/.bin/tsx

echo "════════ STEP 0 — where am I? (CLAUDE.md §16: never DDL without this) ════════"
$TSX c2/c3-whichdb.ts
echo
echo "Expect: ep-old-dust-aboxi69a.eu-west-2.aws.neon.tech / neondb, 18,272,452 compiled."
echo "If the host is anything else, STOP."
read -r -p "Continue? [y/N] " a; [ "$a" = "y" ] || exit 1

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 1 — LANE E1: drop corpus_sections.\"ftsVector\" ════════"
# WHY FIRST: it makes every manifest written below smaller and cleaner, and Lane C3's House of
# Lords ingest must never be written with the column present.
#
# The column is 1,178 MB across 683,153 of 18,521,194 rows. There is NO index on it, so Postgres
# could never have answered a search from it. Its maintaining trigger function is a literal no-op
# (`BEGIN RETURN NEW; END;`) — gutted when `compiledText` was dropped — which is why 96.3% of rows
# are null. The serving path is LanceDB. `scrutinise-web/lib/search.ts` reads `ls."ftsVector"` and
# `os."ftsVector"`: those are LegislationSection and OperationalSection, DIFFERENT TABLES, untouched.
#
# The script re-derives all three facts and REFUSES if any has changed. Watched failing first:
#   $TSX c2/e1-drop-ftsvector.ts --simulate-index-exists     → "⛔ REFUSING TO DROP", exit 1
#
# ⚠ DROP COLUMN is metadata-only. The database will NOT shrink today, and the script says so.
$TSX c2/e1-drop-ftsvector.ts                 # dry run + guard
$TSX c2/e1-drop-ftsvector.ts --execute

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 2 — LANE A: the purge, layer one (Neon) ════════"
# 168,569 rows across eight collections. All eight matched their brief counts EXACTLY in the dry
# run on 24 Aug (131,650 / 20,500 / 8,000 / 129 / 5,553 / 2,089 / 143 / 505).
#
# ⚠ RE-RUN THE DRY RUN FIRST and read the eight "✓ matches" lines. If a collection has grown since
#   staging, the guarded delete ABORTS inside its transaction and nothing is removed.
# ⚠ NOTE THE STAMP IT PRINTS. Step 3 needs it, and the two layers MUST key off the same manifest.
$TSX c2/l2-purge.ts                          # dry run — writes manifests, deletes nothing
echo
echo "Read the eight '✓ matches' lines above. Then:"
read -r -p "Execute the purge? [y/N] " a; [ "$a" = "y" ] || exit 1
$TSX c2/l2-purge.ts --execute
# Expected after: 18,103,883 compiled sections.
# ⚠ The brief says 18,103,866. The brief is 17 low: 18,272,452 − 168,569 = 18,103,883.

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 3 — LANE A: the purge, layer three (the SERVING index) ════════"
# ⚠⚠ WITHOUT THIS STEP THE PURGE IS THE DEFECT IT WAS MEANT TO FIX. Deleting the database rows and
# leaving corpus_fts / corpus_chunks / corpus_vec means the rows keep being returned to users, now
# with no source row behind them.
#
# PUT THE STAMP FROM STEP 2 IN THE LINE BELOW. It reads that run's *.ids.txt files rather than
# re-querying, so the two layers cannot drift.
#
# Measured in the 24 Aug dry run (15m53s for the COUNTING pass alone; the deletes are extra):
#     corpus_fts     168,569 rows to remove, 161,749 et-decisions survivors
#     corpus_chunks  170,789 rows to remove, 373,036 survivors
#     corpus_vec     170,789 rows to remove, 373,036 survivors
# Budget 45–75 minutes. It aborts if any predicate matches zero — see the header for the
# silent-no-op trap that guard exists to catch.
STAMP="PUT_THE_STAMP_FROM_STEP_2_HERE"
if [ "$STAMP" = "PUT_THE_STAMP_FROM_STEP_2_HERE" ]; then
  echo "⛔ Edit STAMP in this script to the stamp step 2 printed, then re-run from here."
  exit 1
fi
$TSX c2/l2-purge-index.ts --stamp="$STAMP"              # dry run
$TSX c2/l2-purge-index.ts --stamp="$STAMP" --execute

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 4 — redeploy the two serving processes ════════"
# ⚠ `fts-serve` and `vector-serve` call openTable() ONCE at boot with no readConsistencyInterval.
# Until they are redeployed they serve the pre-delete snapshot and NOTHING ABOVE HAS REACHED A USER.
# Restarting is not deploying new code, but here a restart is exactly what is needed — the code is
# unchanged and only the snapshot must move.
echo "Redeploy fts-serve and vector-serve on Railway now (staggered, per CLAUDE.md), then continue."
read -r -p "Both redeployed? [y/N] " a; [ "$a" = "y" ] || exit 1

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 5 — the acceptance test, which is NOT a row count ════════"
# Watched at 0/3 at 00:29 UTC on 24 Aug, BEFORE anything was touched, with BOTH sides of all three
# probes returning 10 hits — so the probe is sound and the failure was the real broken state.
# It must now read 3/3. If the retired side still returns hits, step 4 did not take.
$TSX labels/verify-retired-gone.ts

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 6 — the retired-label sweep ════════"
# Same operation as the purge, one layer along; blocked by the same classifier in an earlier session.
$TSX labels/remove-retired.ts --apply

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 7 — LANE B3: the partial-repeal backfill ════════"
# Writes the ~32,040 `partial-dot-leader` records that have never existed, AND the ~1,487 whole-body
# dot leaders `section_repeals` never held (the `12ZA . . . .` class — a provision number with a
# multi-letter suffix, which defeated the guard until this sprint).
#
# ⚠ NO INDEX REBUILD AND NO REDEPLOY. search-gateway.ts reads section_repeals live, so both the new
# labels and the new suppressions take effect on the next request.
# ⚠ Resumable: re-run with --resume if it is interrupted.
$TSX c2/b3-backfill-partial.ts --dry-run --limit=20000
read -r -p "Execute the backfill? [y/N] " a; [ "$a" = "y" ] || exit 1
$TSX c2/b3-backfill-partial.ts --execute

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ STEP 8 — LANE B5: refresh the legislation titles into the index ════════"
# ⚠ THE CODE FIX ALONE CHANGES NOTHING A USER SEES. `loadActTitles` is read at INDEX BUILD time and
# the Act title is baked into the corpus_fts body. 54.2% → 99.1% is true of the resolver today and
# will not be true of a search result until the rows are rewritten.
# ⚠ This moves BM25 document frequencies. Take no baseline across it.
$TSX search/fts-refresh.ts --corpus=primary-acts-pre-2000 --from=db --dry-run
read -r -p "Execute the refresh? [y/N] " a; [ "$a" = "y" ] || exit 1
$TSX search/fts-refresh.ts --corpus=primary-acts-pre-2000 --from=db
echo "Then redeploy fts-serve again, and re-run:  $TSX c2/check-b5-regnal.ts"

# ══════════════════════════════════════════════════════════════════════════════════════════════
echo
echo "════════ NOT IN THIS SCRIPT — ots-reports. It is a DECISION, not a step. ════════"
cat <<'NOTE'
`ots-reports` was classified but NOT deleted, deliberately.

The brief authorises removing "the news and speech rows" and estimates ~69. Measured against the
gov.uk content API, row by row, 497 of 497 readable:

    76  published by the Office of Tax Simplification      ← the real collection
   421  published by somebody else                        ← 187 HMRC, 69 HM Treasury, 53 GDS…
     0  unreadable

The collection is 84.7% not-OTS, not 14%. The cause is in the seeder:
`sources/gov-scraper.ts:176` runs a FREE-TEXT RELEVANCE SEARCH — `searchGovUk('office of tax
simplification report', 'ots-reports', 500)` — with no publisher filter. That query reports
**347,938** total results and we kept the first 500. Ranks 481–485 are Spring Budget 2017, Summer
Budget 2015 and customs notices. Ten bodies read at random included "Renew your driving licence",
"Apply online for a UK passport" and "Report an immigration or border crime".

⚠ `document_type` CANNOT make the cut, exactly as the brief anticipated: nine types carry BOTH
verdicts (policy_paper is 23 KEEP / 62 DELETE). The brief's own rule — delete news/speech types —
removes 68 rows, of which **27 are genuine OTS press releases**, and leaves 380 non-OTS rows serving.

Deleting 421 rather than ~69 is a 6× expansion of an authorised action on the strength of my own
re-measurement, and 148 of the 421 are held in no other collection. That is Charlie's call.

  Charlie decides D-1 in docs/INGEST_C3_REPORT.md, then:
     ./node_modules/.bin/tsx c2/ots-filter.ts --classify     # re-classify (the list must be fresh)
     ./node_modules/.bin/tsx c2/ots-filter.ts --report
     ./node_modules/.bin/tsx c2/ots-filter.ts --apply        # deletes the DELETE rows
NOTE

echo
echo "Done. Now re-run docs/census/C2_L2_purge_index.<stamp>.execute.json against the report."
