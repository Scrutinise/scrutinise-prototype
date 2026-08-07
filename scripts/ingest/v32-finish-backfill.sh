#!/bin/bash
# v32-finish-backfill.sh — drives the §2 Wayback backfill to completion, then hands off.
#
# WHY A DRIVER LOOP AND NOT ONE LONG RUN. Measured 7 Aug 2026: the Wayback Machine never
# rate-limits this workload (no 429, no 503, ever). What fails is the PROCESS — after ~30-50
# requests Node's keep-alive pool goes stale and every fetch dies with `TypeError: fetch failed`,
# permanently. A fresh process fetching the same URLs succeeds immediately with no pacing. So the
# backfill exits cleanly at `--max` and this loop restarts it. Waiting longer cannot reopen a dead
# socket; only a new process can.
#
# Safe to stop at any point (Ctrl-C, or kill the node process) and safe to re-run: the backfill
# skips publications that already have `arc-` sections, and R2 is written before Neon so a kill
# never leaves a row pointing at a body that is not there.
#
# Usage:  bash v32-finish-backfill.sh [log-path]
set -u
cd "$(dirname "$0")"
LOG="${1:-./v32-backfill.log}"

echo "[driver] starting $(date -u +%Y-%m-%dT%H:%MZ) — log: $LOG"
for i in $(seq 1 400); do
  BACKFILL_CONCURRENCY=2 ./node_modules/.bin/tsx v32-backfill-archive.ts --commit --max 40 >> "$LOG" 2>&1
  # "considered 0" means the resumable filter found nothing left to do.
  if grep -aq "publications considered     0" "$LOG"; then
    echo "[driver] all targets processed at batch $i" | tee -a "$LOG"
    break
  fi
  echo "[driver] batch $i done $(date -u +%H:%M:%SZ)" | tee -a "$LOG"
done

echo ""
echo "[driver] BACKFILL COMPLETE. The index work is NOT optional and is NOT done — run, in order:"
echo "   npx tsx v32-metadata-pass.ts --commit            # §3 onto the new rows"
echo "   npx tsx search/fts-hygiene.ts audit --corpus=committees-reports"
echo "   npx tsx search/fts-hygiene.ts export --corpus=committees-reports"
echo "   npx tsx search/fts-hygiene.ts delete-orphans --corpus=committees-reports --apply"
echo "   npx tsx search/fts-catchup.ts --corpus=committees-reports"
echo "   npx tsx ../ops/heavy-job/run.ts run fts-index    # 19.8 GB peak — NEVER Railway (CLAUDE.md §17)"
echo "   # then redeploy fts-serve, or it keeps serving the pre-merge snapshot"
echo "   npx tsx v32-state-check.ts                       # both stores must reconcile"
echo "   npx tsx v32-loop-test.ts                         # §4 Carillion scrutiny loop"
echo "   npx tsx v32-acceptance-live.ts                   # phrases, against the live service"
