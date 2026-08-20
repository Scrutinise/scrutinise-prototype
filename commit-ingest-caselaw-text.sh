#!/usr/bin/env bash
# commit-ingest-caselaw-text.sh — the single end-of-sprint commit script for
# BRIEF_INGEST_CASELAW_TEXT. Run once, from the repository root.
#
# ⚠ EVERY PATH IS EXPLICIT AND THERE IS NO `git add -A` IN THIS FILE.
# Three sessions share this working tree (CC-Lex on the Deepening display fixes, CC-Graph on 3B).
# A directory sweep here commits their half-finished work under this sprint's message. The brief
# says so in §0 and §5, and the rule is enforced by construction: adds are named files only.
#
# ⚠ Timestamps come from the system clock in UTC at commit time, per docs/CLAUDE.md.
set -euo pipefail

STAMP="$(date -u +'%Y-%m-%d %H:%M')"
TRAILER="Date: ${STAMP} UTC
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

# ⚠ BOTH the add AND the commit are limited to the named paths. `git commit -m msg` with no
# pathspec commits WHATEVER IS STAGED — and in a tree three sessions are working in, that can be
# another thread's half-finished change staged minutes ago. `git commit -- path…` commits only
# those paths whatever else sits in the index, which is the property that makes this safe to run.
commit () {  # commit <message> <path>...
  local msg="$1"; shift
  git add -- "$@"
  if git diff --cached --quiet -- "$@"; then
    echo "  (nothing to commit for: ${msg%%$'\n'*}) — skipped"
    return
  fi
  git commit -m "$msg

$TRAILER" -- "$@"
}

echo "== 1. the writer and the shared modules =="
commit "fix(ingest): the case-law body was the whole AKN document, stylesheet included

\`processTnaCaselaw\` stored \`rawToText(judgmentXml)\`. That strips tags and keeps text
nodes, and the National Archives puts its rendering stylesheet in a text node inside
\`<meta><presentation><html:style>\` — so every judgment we hold opened with the court
code, the citation, a SHA-256 build hash and 2.0k-3.4k characters of
\`#judgment { font-family: 'Times New Roman' … }\` before a word of the judgment.

Not fixed by stripping the CSS out of the output: that leaves the identifiers and the
build hash stored as if they were the judgment, and leaves the writer selecting the
wrong content. \`shared/akn-text.ts\` selects the \`<judgment>\` element without its
\`<meta>\` child instead, and returns null rather than a guess for a shape it does not
recognise. 300 documents were counted first: style outside \`<meta>\` in 0 of them.

The writer now refuses to store a body that fails the guard, so a miss is a miss we can
count rather than a success that reads like one." \
  scripts/ingest/shared/akn-text.ts \
  scripts/ingest/shared/style-detect.ts \
  scripts/ingest/workers/process-row.ts

echo "== 2. the checks, and the instrument they measure with =="
commit "test(ingest): plant a stylesheet, and watch the guard refuse it

Both halves, because a check that only tests for the absence of the bad thing passes on
an empty string. The negative half is proved by handing the guard the bytes that are in
R2 today; the positive half is a phrase from R (Miller) v The Prime Minister that cannot
occur in a stylesheet, in a metadata block, or in a truncated extraction.

The CSS detector has its own two-sided suite: 'always yes' fails four cases, 'always no'
fails three. Its first version was quadratic on brace-free text and hung the audit for 12
minutes at full CPU before being killed — the linear scan is in the file with the reason." \
  scripts/ingest/caselaw-text/check-style-detect.ts \
  scripts/ingest/caselaw-text/check-caselaw-body.ts

echo "== 3. the audit and the probes =="
commit "feat(ingest): the scoping audit that decided this was a re-compile, not a re-fetch

74,896 of 74,896 rows carry an r2RawKey and 60 of 60 sampled objects are present, are
Akoma Ntoso and carry a <judgmentBody> — so nothing was fetched from the National
Archives. The same question asked of six other case-law collections: 0 of 60 in every
one of them, so the brief's 'assume the whole collection' is true of tna-caselaw and
does not generalise.

Also here: the 12.7%-of-everything-embedded measurement, the AKN shape census over 300
documents, and the two probes that explain why the first date sweep ran at 6 rows/second." \
  scripts/ingest/caselaw-text/audit-caselaw-text.ts \
  scripts/ingest/caselaw-text/probe-akn-shape.ts \
  scripts/ingest/caselaw-text/measure-embed-delta.ts \
  scripts/ingest/caselaw-text/preview-recompile.ts \
  scripts/ingest/caselaw-text/dump-recompiled.ts \
  scripts/ingest/caselaw-text/probe-r2-speed.ts \
  scripts/ingest/caselaw-text/probe-query-speed.ts \
  scripts/ingest/caselaw-text/probe-id-prefix.ts \
  scripts/ingest/caselaw-text/probe-fts-titles.ts \
  scripts/ingest/caselaw-text/probe-vector-response.ts \
  scripts/ingest/caselaw-text/probe-refused.ts \
  scripts/ingest/caselaw-text/probe-nobody.ts \
  scripts/ingest/caselaw-text/probe-caselaw-sizes.ts \
  scripts/ingest/caselaw-text/probe-et-stubs.ts \
  scripts/ingest/caselaw-text/probe-et-landing-stubs.ts

echo "== 4. the sweeps =="
commit "feat(ingest): re-compile the backlog, move the dates, refresh the index rows

The re-compile reconciles before it reports: every document lands in exactly one bucket,
the buckets must sum to the number attempted, and a sample is read BACK out of R2 and
re-checked, because a PUT that returns 200 is not evidence.

The date sweep is D-3, authorised in the brief. A date is only moved where the source
states one; a row whose AKN carries no FRBRdate keeps what it had and is counted as
residual.

The index refresh exists because fts-catchup appends ids the index lacks and cannot
replace a body that changed. It deletes and re-adds 500 ids at a time, having read every
body first, so at most 500 rows of ~18 M are absent at any instant and a read failure can
never turn a stale row into a missing one." \
  scripts/ingest/caselaw-text/recompile-caselaw.ts \
  scripts/ingest/caselaw-text/sweep-caselaw-dates.ts \
  scripts/ingest/caselaw-text/refresh-fts-caselaw.ts

echo "== 5. the verification =="
commit "test(ingest): ask the platform's own retrieval, keyword and meaning separately

The hand-read re-fetches all thirty judgments from caselaw.nationalarchives.gov.uk
rather than comparing our stored text against our own copy of the source, which could
only ever prove the extractor consistent with itself.

The retrieval check runs the production rankedSearch against the live index and the
deployed vector service over HTTP, and reports the two halves apart — because they are
in different states and averaging them would hide that." \
  scripts/ingest/caselaw-text/handread-caselaw.ts \
  scripts/ingest/caselaw-text/verify-caselaw-retrieval.ts \
  scripts/ingest/caselaw-text/verify-recompile-coverage.ts

echo "== 6. the record =="
commit "docs(ingest): the stylesheet, what it cost, and the two things it hid

The predictions were recorded before the re-compile ran and are scored in the report.
Two of them were wrong and both are named.

⚠ The finding nobody was looking for: the keyword index carried 0 of 74,896 case-law
titles and 74,066 wrong dates. Last night's title recovery reached the database and
stopped there — nothing refreshes corpus_fts after a backfill — so no user has ever seen
a recovered case name. The index refresh in this sprint carries all three." \
  docs/INGEST_CASELAW_TEXT_REPORT.md \
  docs/CHANGE_LOG.md \
  docs/handoff_summary.md \
  commit-ingest-caselaw-text.sh

echo "== 7. the briefs that were never committed (§5) =="
# Explicit names only. AMENDMENT_25B.md and anything under docs/Archive/ are deliberately absent.
commit "docs: commit the sprint briefs that no session would claim

Our own rule is that a brief written to disk is what survives a session clear, and
untracked is not that. Several have sat untracked because no thread will commit another
thread's files. Named individually — no directory sweep, and AMENDMENT_25B.md and
docs/Archive/ are deliberately not here." \
  docs/BRIEF_25B.md \
  docs/BRIEF_25C.md \
  docs/BRIEF_CC_SEARCH_legacy-drop-unblock.md \
  docs/BRIEF_CC_V32_committees_completion.md \
  docs/BRIEF_CC_corpus-report_CDN_statsPhaseB.md \
  docs/BRIEF_GRAPH_2D1.md \
  docs/BRIEF_GRAPH_2D5.md \
  docs/BRIEF_GRAPH_3A.md \
  docs/BRIEF_GRAPH_3B.md \
  docs/BRIEF_INGEST_CASELAW_TEXT.md \
  docs/BRIEF_INGEST_NAMES.md \
  docs/BRIEF_INGEST_committees-content-gap.md \
  docs/BRIEF_INGEST_committees_ADDENDUM.md \
  docs/BRIEF_SEARCH_S2C4.md \
  docs/BRIEF_SEARCH_S2C5.md \
  docs/BRIEF_SEARCH_S3.md \
  docs/BRIEF_SEARCH_S5_LEX_SCOPE.md \
  docs/BRIEF_SEARCH_S7.md \
  docs/BRIEF_SEARCH_S8.md \
  docs/BRIEF_SEARCH_S9.md \
  docs/BRIEF_SEARCH_stats-discoverability.md \
  docs/BRIEF_SURFACE_1_REPEAL.md

echo
echo "== done. commits made: =="
git log --oneline -8
echo
echo "NOT pushed. Review, then: git pull --rebase && git push"
