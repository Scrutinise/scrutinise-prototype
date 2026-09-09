#!/bin/bash
# run-edm-sweep.sh — the full EDM signature sweep, restarted if it dies.
#
# ⚠⚠ WHY A RESTART LOOP RATHER THAN A BARE RUN. The sweep is a multi-hour job on a machine that is
# short of memory: the harness killed three of this sprint's background tasks at once with "the system
# is running low on memory", and the biggest consumers were a dozen unrelated processes rather than
# anything of ours. So a single long-lived process WILL be interrupted, and the interruption is not a
# failure to diagnose — it is a condition to survive.
#
# It is safe to restart because `edm_signatory_fetch` is the resume key: the work list is every motion
# with no status-200 row, so a restart re-asks only for what it never got. A batch in flight when the
# process dies is re-fetched; nothing is lost and nothing is double-counted (the signature id is the
# primary key).
#
# ⚠ ONE process at a time, always. Two sweeps have two independent brakes and would double the request
# rate the limiter is measuring while each believes it is behaving — and the penalty for being wrong
# about that is an hour, not a slow minute. That is also why the priority motions are `--first`
# (an ORDERING inside one run) rather than a separate `--motions` run.
#
# Usage (from scripts/ingest):
#   bash position-graph/run-edm-sweep.sh
cd C:/Code/scrutinise-prototype/scripts/ingest

# The 17 motions that real ideas resolve to (probe-edm-idea-targets.ts). Fetched first so §3's
# prediction can be scored while the rest is still running.
FIRST="63844,65948,1767,60849,44322,64791,64141,51613,44681,65442,35544,46751,66018,26985,61582,17572,59515"

# ⚠ THE GAP IS 250ms AND THAT NUMBER WAS RAISED FROM 400 ON MEASUREMENT, NOT ON IMPATIENCE.
# 400ms/worker was measured at **2.00 motions/s** over a 30-second window — an 8.4-hour run — and it
# drew **zero 429s in its first 713 motions**. The three data points that bound the safe band:
#
#     35 req/s   tripped immediately (the first --apply run: 429 on 101 of 119 motions)
#     12 req/s   ran 1,460 consecutive motions clean (probe-edm-dup-signatures.ts)
#      2 req/s   ran 713 consecutive motions clean (this sweep, before the change)
#
# 250ms/worker at concurrency 2 is ~4 motions/s — a third of the fastest pace ever observed running
# clean, and a ninth of the pace that tripped it. ⚠ It is still a bet, and the loser's stake is an
# hour: if it trips, the controller doubles the gap PERMANENTLY and the run finishes slower than the
# 400ms version would have. The reason to take it is that the alternative is 8.4 hours on a machine
# that has already killed three of this sprint's background tasks for memory, and a shorter run is a
# run with fewer chances to be interrupted.
for attempt in $(seq 1 40); do
  echo "════ attempt $attempt — $(date -u '+%Y-%m-%d %H:%M:%S UTC') ════"
  ./node_modules/.bin/tsx position-graph/sweep-edm-signatures.ts \
      --apply --conc 2 --gap 250 --first "$FIRST" 2>&1
  CODE=$?
  echo "── exit $CODE at $(date -u '+%H:%M:%S UTC')"

  # ⚠ THE LOOP ENDS ON "NOTHING TO DO", NOT ON A ZERO EXIT. A clean exit is also what a completed
  # pass looks like when there is still work left after a mid-run kill, so exit code alone would stop
  # the loop early. The DATABASE says whether there is work left, and it is the only thing that can.
  LEFT=$(./node_modules/.bin/tsx -e "
const {getNeonPool,endNeonPool}=require('./shared/neon-pool');
(async()=>{const p=getNeonPool();
const r=await p.query(\"SELECT COUNT(*)::text n FROM edm_sponsor s WHERE NOT EXISTS (SELECT 1 FROM edm_signatory_fetch f WHERE f.motion_id=s.motion_id AND f.http_status=200)\");
process.stdout.write('LEFT='+r.rows[0].n); await endNeonPool();})()" 2>/dev/null | grep -o 'LEFT=[0-9]*' | cut -d= -f2)
  echo "── motions still unfetched: ${LEFT:-unknown}"
  if [ "${LEFT:-1}" = "0" ]; then
    echo "════ SWEEP COMPLETE — every motion answered $(date -u '+%H:%M:%S UTC') ════"
    exit 0
  fi
  sleep 20
done
echo "⚠ 40 attempts used and work remains. Re-run this script; it resumes."
exit 1
