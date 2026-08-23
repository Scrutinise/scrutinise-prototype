#!/usr/bin/env bash
# check-clean-build.sh — DELIVERY CHECK 0. Build the way the platform builds.
#
# ════════════════════════════════════════════════════════════════════════════════════════════════
# WHY THIS EXISTS
# ════════════════════════════════════════════════════════════════════════════════════════════════
# Two production outages, two different mechanisms, one shape: `tsc` and `next build` were clean on
# a developer machine and the deployment could not do the same thing.
#
#   18 Aug 2026  lib/lex/build-cost.ts was never committed. The local build passed on a file the
#                repository does not contain. Production failed to build for ~10 hours.
#   22-24 Aug    scrutinise-web/scripts/measure-s12-baseline.ts imported across the package
#                boundary into scripts/ingest/, which imports @lancedb/lancedb. That package is in
#                the INGEST package's node_modules. Vercel installs only scrutinise-web's. The local
#                build passed because both node_modules trees exist here. Production failed for two
#                days and three sessions pushed into it without knowing.
#
# `check:committed` cannot catch the second — the file IS committed. What is missing is the
# dependency, in the place the build runs. The only check that catches both is one that reproduces
# the deployment's two constraints:
#
#   1. ONLY WHAT IS COMMITTED  — a clean checkout of HEAD, via `git worktree`, so an uncommitted
#                                file cannot satisfy the compiler.
#   2. ONLY THE WEB APP'S DEPS — `npm ci` in scrutinise-web alone, so no sibling package's
#                                node_modules is reachable.
#
# ════════════════════════════════════════════════════════════════════════════════════════════════
# USAGE
#   scripts/check-clean-build.sh --fast    boundary assertion only, seconds, no install
#   scripts/check-clean-build.sh           full clean-room build (npm ci + tsc), minutes
#
# Run --fast before every push. Run the full check before a release or after touching tsconfig,
# package.json, or any import that crosses a package boundary.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

fail() { echo; echo "FAIL: $*"; exit 1; }

# ── CHECK A — the boundary. Fast, and it is the one that catches this class. ─────────────────────
# Asserts that NO file outside scrutinise-web enters the web TypeScript program. A count, not a
# named exclusion: the next harness that imports across the boundary fails this without anyone
# having to remember to add it to a list.
echo "== A. package boundary: does the web program reach outside scrutinise-web?"
cd "$ROOT/scrutinise-web" || fail "no scrutinise-web directory"
[ -x ./node_modules/.bin/tsc ] || fail "scrutinise-web/node_modules/.bin/tsc not found — run npm install here first"
CROSS="$(./node_modules/.bin/tsc --noEmit --listFiles -p tsconfig.json 2>/dev/null \
  | grep -E "/scrutinise-prototype/scripts/" | grep -vc "^$" || true)"
CROSS="${CROSS:-0}"
if [ "$CROSS" -ne 0 ]; then
  echo "   $CROSS file(s) from outside scrutinise-web are in the web program:"
  ./node_modules/.bin/tsc --noEmit --listFiles -p tsconfig.json 2>/dev/null \
    | grep -E "/scrutinise-prototype/scripts/" | grep -v "/node_modules/" \
    | sed "s|.*/scrutinise-prototype/|     |" | sort -u | head -20
  echo "     (plus type declarations resolved from that package's node_modules)"
  fail "the web build reaches outside its own package. Vercel installs only scrutinise-web's
      dependencies, so any import that crosses this boundary breaks production the moment the
      other package's code needs a dependency the web app does not have.
      Fix the crossing import, not the missing module."
fi
echo "   OK — 0 cross-package files in the web program."

if [ "$FAST" -eq 1 ]; then
  echo
  echo "PASS (fast). ⚠ This proves the boundary only. It does NOT prove every file the build needs"
  echo "is committed — run without --fast for that."
  exit 0
fi

# ── CHECK B — the clean room. Slow, and it is the one that catches an uncommitted file. ──────────
echo
echo "== B. clean-room build: only what is committed, only the web app's dependencies"
WT="$(mktemp -d -t cleanbuild-XXXXXX)"
cleanup() {
  cd "$ROOT" || return
  git worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"
  git worktree prune >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd "$ROOT" || exit 1
echo "   checking out HEAD into a scratch worktree (committed state only)…"
git worktree add --detach "$WT" HEAD >/dev/null 2>&1 || fail "could not create a worktree at $WT"

cd "$WT/scrutinise-web" || fail "scrutinise-web missing from the checkout — is it committed?"
[ -f package-lock.json ] || fail "no package-lock.json — npm ci cannot run, and neither can Vercel"

echo "   npm ci (scrutinise-web only — no sibling package's node_modules is reachable)…"
if ! npm ci --no-audit --no-fund >/tmp/cleanbuild-npm.log 2>&1; then
  tail -20 /tmp/cleanbuild-npm.log
  fail "npm ci failed in the clean checkout. Vercel runs this exact step."
fi

echo "   tsc --noEmit …"
if ! ./node_modules/.bin/tsc --noEmit -p tsconfig.json >/tmp/cleanbuild-tsc.log 2>&1; then
  echo
  head -30 /tmp/cleanbuild-tsc.log
  fail "the clean checkout does not compile. THIS IS WHAT VERCEL SEES.
      A pass on the working tree means nothing here: that tree has files and packages the
      deployment does not."
fi

echo "   OK — a clean checkout with only the web app's dependencies compiles."
echo
echo "PASS. Both constraints reproduced: committed-only, and web-deps-only."
