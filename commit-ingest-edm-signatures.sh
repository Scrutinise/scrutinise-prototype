#!/bin/bash
# commit-ingest-edm-signatures.sh — BRIEF_INGEST_EDM_SIGNATURES.
#
# ⚠ Scoped by EXPLICIT PATH. Never `git add -A`, never a directory-level add: two other sessions
# share this repository and `git add .` in one of them stages the other's half-finished work
# (root CLAUDE.md §0 — that rule exists because breaking it once shipped a Prisma schema twelve
# hours before its migration).
#
# ⚠ Nothing owned by CC-Graph, CC-Search or CC-Surface is staged here. The two changes those
# streams need are DECISIONS 2 and 3 in docs/INGEST_EDM_SIGNATURES_REPORT.md, with the exact patch,
# and are deliberately not made by this sprint (brief §5).
#
# ⚠ Every `Date:` trailer below is set by this script from the REAL system clock in UTC at commit
# time. Root CLAUDE.md: never guess a stamp, never copy one forward, never use local time — and the
# machine clock has been ~14h wrong mid-session before now, so it is cross-checked against an HTTP
# date header first and the script REFUSES if the two disagree by more than five minutes.
set -e
cd C:/Code/scrutinise-prototype

# ── the clock, checked rather than trusted ────────────────────────────────────────────────────────
LOCAL_EPOCH=$(date -u +%s)
HTTP_DATE=$(curl -sI https://www.cloudflare.com/cdn-cgi/trace | grep -i '^date:' | cut -d' ' -f2-)
if [ -z "$HTTP_DATE" ]; then
  echo "❌ could not read an HTTP date header to cross-check the clock. Refusing to stamp." >&2
  exit 1
fi
REMOTE_EPOCH=$(date -u -d "$HTTP_DATE" +%s)
SKEW=$(( LOCAL_EPOCH > REMOTE_EPOCH ? LOCAL_EPOCH - REMOTE_EPOCH : REMOTE_EPOCH - LOCAL_EPOCH ))
if [ "$SKEW" -gt 300 ]; then
  echo "❌ system clock is ${SKEW}s from the network clock ($HTTP_DATE). Refusing to stamp." >&2
  exit 1
fi
STAMP=$(date -u '+%Y-%m-%d %H:%M')
echo "clock checked: local within ${SKEW}s of the network. Stamping $STAMP UTC"

TRAILER="Date: $STAMP UTC
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D5y9FZCrniNbseqJhsxvXR"

# ── 1 · the audit, which changed the sprint's shape twice ─────────────────────────────────────────
git add scripts/ingest/position-graph/probe-edm-signatures.ts \
        scripts/ingest/position-graph/audit-edm-signatures.ts \
        scripts/ingest/position-graph/probe-edm-dup-signatures.ts \
        scripts/ingest/position-graph/probe-edm-public-page.ts
git commit -m "audit(ingest): the EDM signature route carries a member id and a date on every row, and the date is not the tabling date

GET /EarlyDayMotion/{id} returns Response.Sponsors[]: Member.MnisId on 5,739 of 5,739 sampled rows
and CreatedWhen on 5,739 of 5,739. So no identity is ever merged on similarity anywhere in this
sprint, and the brief's stop-and-report condition does not arise.

80.4% of signatures were added AFTER the motion was tabled - 4,614 of 5,739, with 1,116 on the day
and 9 before it. edm_sponsor.date_tabled, the only date we held, is the wrong observed_at for four
signatures in five, and the design's decay applies to when the act happened.

SponsorsCount means two different things on two endpoints. On the LIST endpoint it equals the detail
array length on 150 of 150 motions and includes the primary sponsor, so 2,125,547 published minus
60,995 sponsors held = 2,064,552 to gain. On the DETAIL endpoint it came back 0 on 150 of 150
motions whose Sponsors array was not empty. Reading the count off the response that carries the
signatures would have reported loading an infinite share of nothing.

The sample is drawn by md5(motion_id), not by id: motion_id ascends with the tabling date, so an
id-ordered sample would have been one session's motions. Signatories came back for every tabling
year from 1990 to 2026, dated 100% throughout.

One member signs one motion twice on 0.48% of motions, and 6 of 7 such pairs have exactly one side
withdrawn - so after the withdrawn filter there were no double-counted live signals in 1,460
motions, which is asserted over the whole load rather than over the sample.

$TRAILER"

# ── 2 · the rate limit, and the probe that could not measure it ───────────────────────────────────
git add scripts/ingest/position-graph/probe-edm-rate-limit.ts \
        scripts/ingest/position-graph/probe-edm-quota.ts \
        scripts/ingest/position-graph/probe-edm-client-difference.ts
git commit -m "audit(ingest): the publisher's limit is a Cloudflare rule whose penalty is an hour, and the probe written to measure it measured one lockout five times

The audit costed the sweep at 32 minutes from 0 x 429 in 150 calls at concurrency 4. That was a
check that could not fail: 150 requests finish before this host's limiter reacts. The first real run
drew 429 on 101 of its first 119 motions and then stopped dead, because fetch() has no default
timeout and four hung sockets are the whole worker pool.

What is there, read off the wire: HTTP 429, Server: cloudflare, error code: 1015, and a Retry-After
of 3,146 seconds that counted down by exactly 60 per minute toward one fixed wall-clock instant -
identically on the list route and the detail route, so there is no second budget to fall back on.
One trip puts an hour on the clock.

probe-edm-rate-limit.ts is committed even though its verdict is useless, and the reason is in its
own header. It ran five concurrency and gap settings, every one drew a 429, and it concluded that
the sweep needs a backoff rather than a rate. True, and it says nothing whatever about concurrency:
every setting also reported Retry-After counting down to the SAME instant, so one lockout was
already in force before the first setting ran. The number a broken measurement produces is the
number that ends up in a report.

probe-edm-quota.ts separates the three questions that got conflated - whether the list and detail
routes share a budget, whether any bulk route exists, and when the lockout clears - and spends one
request a minute rather than a burst to answer the third.

And a correction to my own first reading, which was too strong. I wrote that one trip costs an hour
and built a readiness test on it, and then a single curl received 200 while node's fetch received 429
for the identical URL eleven seconds later with 1,384 seconds still on the clock. Four controlled
requests inside one minute settled it: during the mitigation a minority of requests are answered
anyway. So a single-probe readiness test is worthless here - mine reported CLEARED with twenty-three
minutes of the window left to run - and readiness is now five consecutive 200s.

probe-edm-client-difference.ts is committed with a header saying it is NOT used by the sweep, and why.
That one client got through where another did not is a fact about the limiter's internals; swapping
HTTP client to get past a mitigation a public service has deliberately applied to us would be
circumventing it. The sweep's answer to a rate limit is to stay under it.

$TRAILER"

# ── 3 · the schema, with the column the first load died on ────────────────────────────────────────
git add scripts/ingest/position-graph/schema-edm-signatures.sql \
        scripts/ingest/position-graph/setup-edm-signatures.ts \
        scripts/ingest/position-graph/migrate-edm-signatory-order-int.ts
git commit -m "feat(ingest): one row per signature, with what was attempted written before what was stored

edm_signatory is keyed on the publisher's own signature id rather than on (motion, member), because
keying on the pair would assume a member signs a motion at most once and that is an assumption
rather than a measurement.

edm_signatory_fetch records what was ATTEMPTED, one row per motion, with the status and the array
length the API returned. A 60,995-request sweep will be interrupted, and status 200 with
sponsors_seen 0 is a motion with no signatories - a different fact from a motion never fetched.
Only this table can tell them apart, so only this table makes a resume safe. Nothing else in the
sprint can reconcile 2.3 million rows against a total nobody can decompose.

Member.Party and Member.Constituency are on the wire and are refused. They are the member's party
and seat as at the REQUEST: the endpoint returns the same block for a 1993 signature as for
yesterday's. A column called party beside a 1993 date is the error SURFACE 4 fixed from the other
direction.

sponsoring_order is INTEGER because the first load died on it. The field is not 1..n - the API
returns 99999 as a sentinel where no order was recorded - and 99999 is outside SMALLINT. The
sentinel is documented as one and nothing reads the column as an ordinal.

setup-edm-signatures.ts refuses to create or replace any object this sprint does not own, the
graph's position_signal objects included: redefining one from an ingest script is how the next
setup-3b or setup-3c run silently reverts it. It also does not print the 17.5 GiB ops alert line,
because GRAPH 3C retired it; the honest number is a cost and that is what prints.

$TRAILER"

# ── 4 · the sweep ────────────────────────────────────────────────────────────────────────────────
git add scripts/ingest/position-graph/sweep-edm-signatures.ts         scripts/ingest/position-graph/run-edm-sweep.sh
git commit -m "feat(ingest): the sweep paces itself, and the first 429 stops it speeding up for good

With an hour-long penalty per trip, picking a rate and hoping is a bet whose downside is the whole
run, and textbook additive-increase multiplicative-decrease would trip it periodically by design.
So the pace starts slow, speeds up only while nothing has objected, and freezes permanently at the
first 429 - it converges on a safe pace and holds there rather than re-finding the ceiling every
hour.

Retry-After is honoured in full rather than capped. The first draft capped it at 120 seconds, which
walks straight back into a mitigation that has not expired, draws another 429, and busy-waits
through an hour instead of sleeping through it. One brake, shared by every worker, because four
workers each backing off alone keep the aggregate rate exactly where the limiter objected to it.

Every request carries an AbortController timeout. Without it a hung socket is not an error, it is a
stall, and from outside it looks like a slow API.

Two bugs in that controller were caught by watching it run, and neither was a crash. Both applied a
slowdown for a reason that was not evidence about this run's pace.

The slowdown was per WORKER rather than per MITIGATION. Both workers hit the same active mitigation
within milliseconds, each called the throttle handler, and each doubled the shared gap: 400 to 800 to
1,600 ms from one rate objection. Two workers at 1,600 ms is 1.2 requests a second, so a four-hour
sweep becomes a fourteen-hour one and nothing looks broken, only slow.

And a resume was punished for the mitigation it walked into. The sweep is restarted after every kill,
and a restart's first requests land inside whatever mitigation the previous run left behind; halving
the pace on that basis halves it again on the next restart, compounding on somebody else's mistake. A
429 drawn before 50 successful requests this run now sleeps in full but does not slow the run down,
and the decision is printed so a run that declines to slow down says why.

The work list is ordered by md5(motion_id) rather than by id. That is not only about sampling bias:
it makes a PARTIAL load an unbiased sample of the corpus rather than a recent slice of it, which is
what lets a half-finished sweep be reported honestly. --first moves the 17 motions that real ideas
resolve to the front of that order, so the surface can be measured while the rest is still running.

run-edm-sweep.sh restarts the sweep until the work is done, because three of this sprint's background
tasks were killed at once for low memory and the twelve largest consumers on the machine were
unrelated processes. Its loop condition is the DATABASE and not the exit code: a clean exit is also
what a completed pass looks like when a kill left work behind, so it asks how many motions still have
no status-200 row and stops only at zero.

$TRAILER"

# ── 5 · the signal, and the correction to 60,995 dates ───────────────────────────────────────────
git add scripts/ingest/position-graph/derive-edm-signature-signals.ts         scripts/ingest/position-graph/fix-edm-duplicate-signals.ts         scripts/ingest/position-graph/finish-edm-signatures.sh
git commit -m "feat(ingest): signatures become dated signals, and the sponsorships get the date they should always have had

Signatures land as edm_signature at the config's own 0.6, direction +1, observed_at the date signed,
evidence the motion's corpus section, derivation signatory:v1.

The brief asks for distinct signal TYPES and this delivers distinct DERIVATIONS at the same weight,
which is a real gap and is decision 2 in the report rather than a silent choice. A distinct weight
needs a distinct SignalType, and the type union, the weight table and the half-life table all live
in lib/graph/position-config.ts, which is CC-Graph's; brief section 5 says report the change instead
of making it. Nothing is lost permanently, which is the part of the requirement that matters:
derivation is stored per row and position_raw_weight already takes it, so applying a different
weight later is one UPDATE over rows that already know which act they are - not the rewriting of two
million immutable rows schema-3a.sql warns about.

Re-using the existing type is also what keeps three graph-owned things working untouched, and that
was checked rather than hoped: position_signal_for() reaches the new rows through its existing
stored arm, build-position-estimates.ts's attention-ceiling assertion stays correct, and
position-coverage.ts's LAYER_WORDS still compiles.

fix-edm-duplicate-signals.ts exists because check C2 failed once all 60,995 motions were in - 42
(actor, motion) pairs with two live signals, concentrated on Michael Foster (21 motions), Harold Walker
(11) and Robert Hughes (4), all historic records. Of 271 duplicate pairs in the publisher's data, 183
have one side withdrawn and 9 have both. A member cannot sign a motion twice without withdrawing in
between and neither row is withdrawn, so the second row is a duplicate RECORD and not a second ACT: the
earliest is kept and the later retired with superseded_by pointing at the survivor, so the fact that the
publisher held two remains visible. 42 of 2,002,626 is 0.002% and changes no reported number; it is here
because one act, one signal is either true or it is not.

The 59,925 sponsorship signals carried date_tabled because it was the only date we held. They are
corrected the way design section 2 says a correction happens - a new row with superseded_by set on
the old one, never an UPDATE of the fact - in ONE statement, so it cannot half-apply and leave a
sponsor with two live signals. Where the new date equals the old one the ON CONFLICT fires and the
existing row is left alone, correctly, so the corrected count is below 60,995 rather than equal to
it.

$TRAILER"

# ── 6 · the assertions, and the hand-check sheet ──────────────────────────────────────────────────
git add scripts/ingest/position-graph/verify-edm-signatures.ts \
        scripts/ingest/position-graph/handcheck-edm-signatures.ts \
        scripts/ingest/position-graph/project-edm-signatures.ts
git commit -m "test(ingest): twenty-two assertions, and the three that were wrong about their own subject

--self-test plants a counter-example into each assertion that carries one and reports which refused
it. B2's plant is not synthetic: graph_edm_signature_edge_all really does return 59,925 rows whose
subject is the motion's own sponsor, while graph_edm_signature_edge returns 0, so the exclusion that
stops one act being counted twice is doing measurable work.

A1 was the finding. It counted rows from a subquery with LIMIT 20 in it, so on an incomplete sweep
it reported 20 when the real figure was 60,931 - a verdict that was right and a quantity that was
fiction, which is the worse of the two failures because nobody re-reads a number that agrees with
them. The count is now uncapped and the examples are capped separately. Caught by watching the check
fail on purpose.

A3 was asserting the wrong invariant, and its first real failure is what showed that. It said the
publisher's count equals the array it returned, which held on 150 of 150 motions in the audit and then
failed on 5 at around 2,100 - every one of them a motion tabled in June or July 2026 whose array had
MORE rows than the count. count_expected is edm_sponsor.sponsors_count and edm_sponsor was swept on 16
August, while the detail endpoint is being read now: motion 66381 was 1 in August and is 10 today. The
mismatch is staleness in our own baseline, not disagreement in the publisher's data, and it grows as
the sweep reaches more 2026 motions - so the equality would have failed thousands of times by the end
of the run and drowned the signal it exists to carry.

The assertion is now the direction that can only mean a defect: the API must never return FEWER rows
than its own count, because a signature does not disappear (a withdrawn one stays in the array with
IsWithdrawn set), so a short array means a truncated fetch. Growth is reported beside it, and A3b
asserts that every instance of it is a RECENT motion - growth on a 2008 motion would be a different
and much worse fact. A3's plant is a live counter-example rather than a synthetic one.

A6 was the same mistake a second time. It said exactly one primary sponsor per motion, held on every
audited motion, and failed on 10 at around 20,500 - all of them the ZERO shape. On motion 62502 the
orders run 2,3,4,5,6 and the member edm_sponsor names as its sponsor is not in the Sponsors array at
all; all ten were tabled on 2024-10-07. That is the case the edge view's second exclusion clause was
written for, and both directions are now measured on the whole load rather than argued for: the sponsor
leaks into the signature edges 0 times (A6b) and the order-1 clause has dropped a real signature 0
times (A6c). The assertion is now never MORE than one, because two order-1 rows is the shape that would
make the exclusion discard a real signature, while zero is absence and absence is what the identity
half of the clause handles.

C7 asserts the read path the SURFACE uses, which is position_signal_for(), not the position_signal
view. They are two code paths and the surface only ever reads one of them; a signal that reaches the
view and not the function reaches no user. It errored on its first run with 'function
array_agg(unknown) is not unique' - a literal has no type until it is given one - which is a
reminder that a check that has never run is not yet a check.

handcheck-edm-signatures.ts prints the sheet for section 3's 30 signatures in the order the
publisher's page shows them, and chooses motions by SIZE on purpose: the failure being looked for
shows up in the middle of a long list, not at either end.

project-edm-signatures.ts extrapolates the finished load from the part that has landed, which is only
legitimate because the work list is md5-ordered and a partial load is therefore an unbiased sample of
the corpus. Its first error bar was wrong in the dangerous direction: it read sd x sqrt(N) x
sqrt((N-n)/(N-1)), which has no sqrt(n) in it and so does not shrink as the sample grows, and it
reported plus or minus 16,392 - which made a 99,000 shortfall against the published target look like a
five-sigma discrepancy that had to be explained. The correct estimator for a total is N x (sd/sqrt(n))
x sqrt(1 - n/N), which is plus or minus 69,218 on the same numbers. A falsely narrow interval does not
overstate precision, it manufactures findings. It now prints the gap in sigmas and refuses to explain
one at 5% sampled, because sd is about equal to the mean and a normal interval understates the spread
of a sum.

$TRAILER"

# ── 7 · the surface probes, before and after ──────────────────────────────────────────────────────
git add scrutinise-web/scripts/probe-edm-idea-targets.ts \
        scrutinise-web/scripts/probe-edm-coverage-statement.ts \
        scrutinise-web/scripts/probe-edm-surface-latency.ts
git commit -m "test(ingest): 21 of the 23 ideas that resolve to a target resolve to a MOTION, and every one showed exactly one actor

Measured with the surface's own functions rather than an approximation of them: extractPhrasesFrom,
then findTargetsByPhrases, then positionsFor at the idea surface's own limit of 5. The two ideas
whose target is a division show 189 and 254 actors. So the thin positions panel is not an edge case,
it is nearly every idea we hold.

The ranking check cannot be answered by reading ranking.note, and that is why the probe renders the
paragraph. renderPositionBody prints the 'Who else is here' sentence only when ofMatched > shown,
and with one actor and a limit of five that is false - correctly, and indistinguishably from the
SURFACE 4 bug where the sentence was computed and then thrown away. The only way to tell those apart
is to render it and look for the words.

probe-edm-surface-latency.ts measures the read path before and after, and its last row is a DIVISION
rather than a motion. That row is the point of the table: it reads the same position_signal_for()
whose stored arm this sprint multiplies by roughly 35, so a regression there would not show anywhere
in the EDM numbers. GRAPH 3B found this exact read path at 9,048 ms once. A table with only EDM rows
in it would have been a check that could not fail in the direction that matters.

All three probes are read-only, and none calls filePositionsForIdea, which writes EvidenceItem rows.

$TRAILER"

# ── 8 · the report, the change log and the handoff ────────────────────────────────────────────────
git add docs/INGEST_EDM_SIGNATURES_REPORT.md \
        docs/CHANGE_LOG.md \
        docs/handoff_summary.md \
        commit-ingest-edm-signatures.sh
git commit -m "docs(ingest): the EDM signature report, with the rate limit as the sprint's real shape

Predictions were logged in CHANGE_LOG.md before the run and are scored against what happened,
including the one that was wrong: the audit's own 32-minute cost estimate.

Decisions for Charlie are numbered, each with a recommendation and the consequence of the
alternative. Two of them are changes this sprint deliberately did not make because the files belong
to CC-Graph and CC-Surface, and each carries the exact patch.

$TRAILER"

echo
echo "════ DONE ════"
git log --oneline -8
echo
echo "⚠ NOT PUSHED. Review, then: git pull --rebase && git push origin Main"
