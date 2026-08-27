#!/bin/bash
# s15-run.sh — SEARCH S15's entry point for the baseline retake, and it exists to make ONE point.
#
# ⚠⚠ THE THROTTLE IS GONE, AND THAT IS THE MEASUREMENT.
#
# `s14-run.sh` had to run the gold set at `LEX_STREAM_CONCURRENCY=1` and `VECTOR_TIMEOUT_MS=90000`,
# and its own comment says why in terms:
#
#     "IT IS NOT A CONVENIENCE — IT IS WHAT MAKES THE MEASUREMENT POSSIBLE AT ALL. vector-serve
#      runs 4 requests wide behind a 64-deep queue, and a client abort does not cancel work already
#      queued... the default configuration FEEDS the queue faster than the service drains it."
#
# So every S14 figure was taken through a client deliberately crippled to protect a service that
# could not carry production's own settings. S15 fixed the service: 16 wide, a queue bounded at 2x
# the width, and abandoned work cancelled rather than executed. This runner therefore uses
# **production's values**, and the fact that it completes at all is the acceptance criterion.
#
#   LEX_STREAM_CONCURRENCY  1  ->  3   (the platform's real default, lib/lex/stream-batch.ts)
#   VECTOR_TIMEOUT_MS   90,000  ->  25,000  (the platform's real default, lib/lex/vector-search.ts)
#
# ⚠ Everything else is IDENTICAL to s14-run.sh on purpose. The retrieval configuration must not
# differ in any other respect or the retake would not be comparable with the figures it supersedes.
#
# ⚠ `${VAR-default}` and NOT `${VAR:-default}` — the colon form substitutes the default when the
# variable is set to the EMPTY STRING too, so `LEX_VECTOR_STREAMS= bash s15-run.sh ...` (the way a
# keyword-only control arm is taken) would silently run the four-stream configuration and report it
# as fully-configured. An override that means "off" must be able to say so. This bit s14.
#
# Usage:
#   bash scripts/s15-run.sh measure --json ../docs/census/s15-arms.json
#   bash scripts/s15-run.sh audit-scores [args...]
#   bash scripts/s15-run.sh check        [args...]
set -e
cd "$(dirname "$0")/.."

export FTS_SEARCH_URL="${FTS_SEARCH_URL:-https://fts-serve-production-4cea.up.railway.app}"
export VECTOR_SEARCH_URL="${VECTOR_SEARCH_URL:-https://vector-serve-production.up.railway.app}"
export LEX_QUERY_ROUTER="${LEX_QUERY_ROUTER:-true}"
export LEX_VECTOR_STREAMS="${LEX_VECTOR_STREAMS-legislation,caselaw,guidance,committees}"

# PRODUCTION VALUES. See the header — these being usable is the point of the sprint.
export LEX_STREAM_CONCURRENCY="${LEX_STREAM_CONCURRENCY:-3}"
export VECTOR_TIMEOUT_MS="${VECTOR_TIMEOUT_MS:-25000}"
export FTS_TIMEOUT_MS="${FTS_TIMEOUT_MS:-60000}"

echo "[s15-run] streams=$LEX_VECTOR_STREAMS concurrency=$LEX_STREAM_CONCURRENCY vectorTimeout=${VECTOR_TIMEOUT_MS}ms (production values, no throttle)"

what="$1"; shift || true
case "$what" in
  audit-scores) exec npx tsx --env-file=.env scripts/audit-s14-scores.ts "$@" ;;
  measure)      exec npx tsx --env-file=.env scripts/measure-s14-merge.ts "$@" ;;
  check)        exec npx tsx --env-file=.env scripts/check-s14-merge.ts "$@" ;;
  *) echo "unknown target '$what' — expected audit-scores | measure | check" >&2; exit 2 ;;
esac
