#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# DELIVERY CHECK 4 for LEX 25-G — read a string this sprint introduced OFF THE
# RUNNING SITE, with controls that prove the probe can see anything at all.
#
# ⚠⚠ THE HTML OF `/ideas/build` IS USELESS AND LOOKS EXACTLY LIKE A FAILURE.
# The route is Clerk-gated, so an unauthenticated fetch returns a ~13KB sign-in
# shell. Grepping it for 25-G markers returns 0 — and grepping it for 25-F markers
# ALSO returns 0, which is the tell: "every marker absent" is equally what a probe
# that cannot see the bundle returns. 25-E recorded this exact trap.
#
# So this reads the CLIENT BUNDLE. Next names its chunks by content hash, so a
# string added this sprint appears in a chunk only once the new build is deployed.
#
# ⚠ AND IT CARRIES CONTROLS IN BOTH DIRECTIONS:
#   · 25-F markers must be PRESENT — proves the probe is reading the right bundle
#     rather than reading nothing.
#   · A string that exists nowhere must be ABSENT — proves a "found" is not the
#     grep matching everything.
# ─────────────────────────────────────────────────────────────────────────────
set -u
SITE="${SITE:-https://www.scrutinise.org}"

echo "── delivery check 4 · $SITE ──"

# The build page's shell still lists the chunks the route loads.
SHELL_HTML="$(curl -s "$SITE/ideas/build")"
CHUNKS=$(grep -o '/_next/static/chunks/[A-Za-z0-9._-]*\.js' <<<"$SHELL_HTML" | sort -u)
if [ -z "$CHUNKS" ]; then
  echo "  ✗ no chunk URLs in the shell — the probe cannot see the bundle, so it can prove nothing"
  exit 1
fi
echo "  reading $(wc -l <<<"$CHUNKS") chunk(s) referenced by /ideas/build"

BUNDLE="$(mktemp)"
trap 'rm -f "$BUNDLE"' EXIT
for c in $CHUNKS; do curl -s "$SITE$c" >> "$BUNDLE"; done
# The route's own page chunk is loaded lazily, so sweep the whole build manifest too.
for c in $(grep -o '/_next/static/chunks/[A-Za-z0-9._/-]*\.js' "$BUNDLE" | sort -u | head -60); do
  curl -s "$SITE$c" >> "$BUNDLE"
done
echo "  $(wc -c < "$BUNDLE") bytes of JavaScript"

pass=0; fail=0
want() {  # want <label> <string>
  if grep -qF "$2" "$BUNDLE"; then echo "  ✓ $1"; pass=$((pass+1))
  else echo "  ✗ $1 — NOT on the running site"; fail=$((fail+1)); fi
}
absent() {
  if grep -qF "$2" "$BUNDLE"; then echo "  ✗ CONTROL FAILED — $1 is present and should not be"; fail=$((fail+1))
  else echo "  ✓ control: $1 is absent, so a hit means something"; pass=$((pass+1)); fi
}

echo
echo "  25-G markers:"
want "§3 A1 the permanent feedback route"   "Something wrong with this? Tell us"
want "§3 A6 the unsaved-answer prompt"      "Leave without sending that?"
want "§1a the reuse sentence"               "Re-running from the research already gathered"
want "§1b the explicit re-search"           "Search again from scratch"
want "§2 the surface switch names itself"   "You’re looking at"
want "§4c a fork says what is decided"      "The pivotal obstacle"

echo
echo "  controls — 25-F strings that must ALREADY be there:"
want "25-F §1 the findings heading"         "What the record actually says"
want "25-E resume"                          "Picking up where you left off"

echo
absent "a string that exists nowhere"       "ZZZ_THIS_STRING_IS_NOT_IN_THE_CODEBASE_25G"

echo
echo "  $pass passed, $fail failed."
[ "$fail" -eq 0 ]
