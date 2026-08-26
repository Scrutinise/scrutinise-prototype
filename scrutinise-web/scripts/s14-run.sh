#!/bin/bash
# s14-run.sh — SEARCH S14's ONE ENTRY POINT, so every arm is taken under the SAME configuration.
#
# ⚠⚠ WHY A RUNNER AND NOT AN INLINE COMMAND. Every S14 number is only comparable with the others
# if the retrieval configuration is identical, and the local `.env` carries NEITHER `FTS_SEARCH_URL`
# NOR any `LEX_*` flag — so a harness invoked by hand runs BM25-only, with the router off, and
# reports a regression that is really an unset variable (docs/CLAUDE.md, harness-preflight.ts, and
# three previous sprints that lost a day to it). Putting the configuration in one file means a
# figure cannot be taken under a different one by accident.
#
# ⚠⚠ `LEX_VECTOR_STREAMS` IS THE FOUR-STREAM PRODUCTION STRING, NOT S13's SINGLE `legislation`.
# BRIEF_SEARCH_S14 §5: Charlie has confirmed production reads
# `legislation,caselaw,guidance,committees`. Every S13 absolute figure was taken with
# `legislation` alone and therefore describes a configuration nobody runs.
#
# Usage (from anywhere):
#   bash scripts/s14-run.sh audit-scores [args…]
#   bash scripts/s14-run.sh measure      [args…]
#   bash scripts/s14-run.sh check        [args…]
set -e
cd "$(dirname "$0")/.."

export FTS_SEARCH_URL="${FTS_SEARCH_URL:-https://fts-serve-production-4cea.up.railway.app}"
export LEX_QUERY_ROUTER="${LEX_QUERY_ROUTER:-true}"
# ⚠ `${VAR-default}` AND NOT `${VAR:-default}`. The colon form substitutes the default when the
# variable is set to the EMPTY STRING as well as when it is unset — so `LEX_VECTOR_STREAMS= bash
# s14-run.sh …`, the way a keyword-only control arm is taken, silently ran the four-stream dense
# configuration instead and the preflight line reported it as `fully-configured`. An override that
# means "off" must be able to say so.
export LEX_VECTOR_STREAMS="${LEX_VECTOR_STREAMS-legislation,caselaw,guidance,committees}"

# ⚠⚠ THE THROTTLE, AND IT IS NOT A CONVENIENCE — IT IS WHAT MAKES THE MEASUREMENT POSSIBLE AT ALL.
#
# `vector-serve` runs 4 requests wide behind a 64-deep queue, and **a client abort does not cancel
# work already queued**: a timed-out dense leg is still executed after the caller has walked away.
# So the default configuration — 3 streams in flight, each with its own dense leg, at a 25 s client
# timeout — FEEDS the queue faster than the service drains it. Measured on the first attempt at this
# sprint's own measurement: `inFlight 4 · queued 64/64 · rejections 101`, `warm_p95` 7.7 s → **206 s**,
# and every dense leg after that returning nothing while the ranking silently fell back to BM25.
#
# One stream at a time keeps at most two dense calls in flight, which the service serves in ~5 s.
# The longer client timeout is the other half: it lets a slow call COMPLETE rather than being
# abandoned, and an abandoned call is exactly what fills the queue.
#
# ⚠ These values are for the HARNESS. They are not a recommendation for production, where the
# question is the service's shape rather than the client's patience — see SEARCH_S14_REPORT §0.
export LEX_STREAM_CONCURRENCY="${LEX_STREAM_CONCURRENCY:-1}"
export VECTOR_TIMEOUT_MS="${VECTOR_TIMEOUT_MS:-90000}"
export FTS_TIMEOUT_MS="${FTS_TIMEOUT_MS:-60000}"

what="$1"; shift || true
case "$what" in
  audit-scores) exec npx tsx --env-file=.env scripts/audit-s14-scores.ts "$@" ;;
  measure)      exec npx tsx --env-file=.env scripts/measure-s14-merge.ts "$@" ;;
  check)        exec npx tsx --env-file=.env scripts/check-s14-merge.ts "$@" ;;
  *) echo "unknown target '$what' — expected audit-scores | measure | check" >&2; exit 2 ;;
esac
