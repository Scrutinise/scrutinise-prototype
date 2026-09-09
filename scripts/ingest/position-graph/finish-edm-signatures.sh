#!/bin/bash
# finish-edm-signatures.sh — everything that happens AFTER the fetch, in the order the brief requires.
#
# ⚠ IT REFUSES TO RUN WHILE THE SWEEP IS STILL GOING. Deriving signals from a half-loaded table would
# produce a number that looks final and is not, and rebuilding estimates over it would bake that number
# into 2.3M rows. The gate is the database — motions with no status-200 row — because that is the only
# thing that knows, and because a clean sweep exit is also what a killed pass looks like.
#
# ⚠ THE ORDER IS THE BRIEF'S, NOT CONVENIENCE. §2: "Recompute estimates after loading, not during. The
# signal layer is immutable and the estimate layer is derived; that separation exists precisely so a
# large load is safe."
#
# Usage (from scripts/ingest):
#   bash position-graph/finish-edm-signatures.sh
#   bash position-graph/finish-edm-signatures.sh --allow-partial   # deliberate, and it says so
set -e
cd C:/Code/scrutinise-prototype/scripts/ingest

ALLOW_PARTIAL=0
[ "$1" = "--allow-partial" ] && ALLOW_PARTIAL=1

LEFT=$(./node_modules/.bin/tsx -e "
const {getNeonPool,endNeonPool}=require('./shared/neon-pool');
(async()=>{const p=getNeonPool();
const r=await p.query(\"SELECT COUNT(*)::text n FROM edm_sponsor s WHERE NOT EXISTS (SELECT 1 FROM edm_signatory_fetch f WHERE f.motion_id=s.motion_id AND f.http_status=200)\");
process.stdout.write('LEFT='+r.rows[0].n); await endNeonPool();})()" 2>/dev/null | grep -o 'LEFT=[0-9]*' | cut -d= -f2)

echo "motions still unfetched: ${LEFT:-unknown}"
if [ "${LEFT:-1}" != "0" ] && [ "$ALLOW_PARTIAL" = "0" ]; then
  echo "❌ the sweep has not finished. Refusing to derive and rebuild over a partial load."
  echo "   Re-run with --allow-partial only if that is what you mean."
  exit 1
fi

echo
echo "════ 1 · SIGNALS (append-only; the sponsorship dates corrected in one statement) ════"
./node_modules/.bin/tsx position-graph/derive-edm-signature-signals.ts --apply --fix-sponsor-dates

echo
echo "════ 2 · ESTIMATES (truncate-and-rebuild; offline, and §2.5 re-established that nobody serves from it) ════"
cd ../graph
../ingest/node_modules/.bin/tsx build-position-estimates.ts
cd ../ingest

echo
echo "════ 3 · ASSERTIONS — the self-test FIRST, because a check that cannot fail is not a check ════"
./node_modules/.bin/tsx position-graph/verify-edm-signatures.ts --self-test
echo
./node_modules/.bin/tsx position-graph/verify-edm-signatures.ts

echo
echo "════ 4 · THE LOAD, AGAINST THE PUBLISHED FIGURE ════"
./node_modules/.bin/tsx position-graph/project-edm-signatures.ts

echo
echo "════ DONE. Still to run by hand, from scrutinise-web: ════"
echo "   tsx --env-file=.env scripts/probe-edm-idea-targets.ts        # the surface, after"
echo "   tsx --env-file=.env scripts/probe-edm-surface-latency.ts     # with its division CONTROL"
echo "   tsx --env-file=.env scripts/probe-edm-coverage-statement.ts  # the sentence that is now false"
