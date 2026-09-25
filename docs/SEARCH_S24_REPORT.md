# SEARCH — S24

**Written:** 2026-09-25. Continues the same session as `docs/SEARCH_S21_REPORT.md` /
`docs/SEARCH_S22_REPORT.md`. S20b's own close-out (deployment SHA + §6) is reported in
`docs/SEARCH_S20B_REPORT.md` §6 itself, already complete and independently re-verified this
session — see the note at the top of this file's "S20b" section below rather than a duplicate
write-up.

---

## Open select committee inquiries — report only, not built

**The gap, exactly as put:** Lex's committee-evidence document (`build-committee-evidence.ts`,
LEX 26-G) can compose written evidence but has no way to tell a user WHICH inquiry it is for,
because the corpus holds **published** evidence — by construction, evidence submitted to an
inquiry that has already closed. A live, open inquiry and its terms of reference are not the kind
of thing that ever gets ingested as a corpus document.

**Source found, and it is real, open, and already the right shape** —
`committees-api.parliament.uk`, the SAME host `scripts/verify-citations.ts` already uses (25-V
§1a/§1c) to get past the exact 403/Cloudflare-challenge wall that blocks a plain fetch of
`committees.parliament.uk` and `api.parliament.uk`. Checked live, this session, rather than
assumed from that precedent:

- `GET committees-api.parliament.uk/swagger/v1/swagger.json` — **200**, a full OpenAPI 3.0 spec,
  39 documented paths, no auth, no challenge.
- `GET /api/CommitteeBusiness?CurrentlyAcceptingEvidence=true&Take=5` — **200**, real data, right
  now: five live pieces of committee business, two of them type `"Inquiry"` (`isInquiry: true`),
  each with an `openSubmissionPeriods` array whose `statusMessage` is the literal call-for-evidence
  text ("The committee welcomes responses from anyone with answers to the questions in the call
  for evidence.").
- `GET /api/CommitteeBusiness/{id}` (detail, one of the five above — "Electronic voting", id 8885)
  — **200**, and `scope` is a full prose paragraph: exactly what "terms of reference" means here
  ("This inquiry will look at the pros and cons of the current operation of divisions in the House
  of Commons and the potential merits and pitfalls of introducing electronic voting
  arrangement..."). `hcNumbers` gives the paper number and session.

**What is NOT yet confirmed:** the committee's own name does not appear on either the list item or
the detail record above — both carry `contact: null` and no `committee` field. The endpoint
supports filtering BY `CommitteeId`, which implies the link exists server-side, but reading it back
per-business-item was not resolved this session (a `/api/Committees` list-and-cross-reference, or a
field further down the response schema this session's probing did not reach). This is the one gap
between "source found and fetchable" and "a user-facing list that says who to send evidence to" —
small, and the next thing to check before building.

**Effort, given the source exists and is this cooperative:**

- One ingest-shaped script: `GET /api/CommitteeBusiness?CurrentlyAcceptingEvidence=true&Take=100`
  (paginate on `totalResults`/`Skip` — response already carries both), keeping `id`, `title`,
  `type.isInquiry`, `openDate`, and `scope` (fetched per-item from the detail endpoint, or possibly
  already present on a fuller list call not yet tried with more query params). This is a small,
  well-bounded read — dozens of open items at any time, not thousands — closer to a live lookup
  than a corpus ingest.
- Resolving the missing committee name is the one open sub-task, estimated at under an hour once
  picked up (a single `/api/Committees` call, cross-referenced by id, or re-reading the
  `CommitteeBusinessSummary` schema in the swagger spec already fetched).
- No new corpus table, no schema change, no R2 storage — this is exactly the "structured DB join /
  live lookup, not a text search" shape `docs/SEARCH_S23_REPORT.md`'s own §3 step 2 already
  recommends for a related feature (amends/repeals), for the same reason: it changes hourly, and a
  corpus ingest would only ever show a stale snapshot of something whose whole value is currency.

**Why this is worth the small effort, as put:** without it, the committee-evidence document is a
template the user has to go and match to a real inquiry themselves. With a live "is there an open
inquiry this fits, and what does it actually want to know" check, it becomes something they can
send.

---

## S20b — deployment SHA and §6, verified not re-run

Per the brief's own first item. `docs/SEARCH_S20B_REPORT.md` §6 already reports the full off/off/on
measurement (all 8 §1 predictions scored, recommendation: do not flip), committed by the other
SEARCH-stream session in this repository (`ba990fd` the code, `4cfa26b` the measurement) earlier in
this session's own timeline.

**Independently re-verified, this session, before accepting it rather than re-running it:**

```
vector-serve: status=SUCCESS commit=ba990fd6d7d3
fts-serve:    status=SUCCESS commit=ba990fd6d7d3
```

Both match the commit `docs/SEARCH_S20B_REPORT.md` §6 itself claims (`/api/health` read
`ba990fd…`), read independently via the Railway API rather than trusted from the report's own
text. Per Charlie's own direction this session: **accepted as-is, not re-run** — re-running the
off/off/on measurement would mean flipping `LEX_SEARCH_WITHIN_DOC` in production a second time to
duplicate a result that already exists, at real latency cost (the original measurement ran 195
queries against live retrieval services). `LEX_SEARCH_WITHIN_DOC` remains OFF, per that report's
own recommendation, unchanged.

---

## Router vocabulary — S23 step 3

**Built:** `ROUTER_PROMPT_BILL_VOCAB` (`lib/lex/query-expansion.ts`), appended — never woven into
`ROUTER_PROMPT_BASE` — behind a new flag `LEX_ROUTER_BILL_VOCAB` (default off), same pattern as
`ROUTER_PROMPT_APPRAISAL` (S18 §1.3). States plainly, additively, that `legislation` also holds a
bill's own amendment papers, memoranda and impact assessments, naming the exact vocabulary S23 §2
measured as the failure — "amendments tabled", "marshalled list", "written evidence on [a bill]",
"impact assessment for [a bill]" — as `legislation`-stream triggers, in addition to whatever else a
question already routes to.

**⚠ Found in passing, before the measurement could even run: `routeQueryDetailed()` refuses to
call the router at all with `LEX_QUERY_ROUTER` off, and this machine's `.env` does not set it.**
The harness forces it on explicitly now (matching production's own confirmed value) — worth
flagging because any earlier local measurement script that didn't do this (this session did not
audit `measure-s18-appraisal.ts` for the same gap) would have silently measured nothing rather
than measuring the router, with no error, only a `route_outcome=disabled` log line easy to miss
in a long run.

**Measured live: `npx tsx --env-file=.env scripts/measure-s24-bill-vocab.ts` (real data), then
`--control` (noise floor).** The 10 bill questions are RECONSTRUCTED from `SEARCH_S23_REPORT.md`
§2's own table (the original measurement script was a throwaway, per CLAUDE.md §22) — worded to
match that table's descriptions as closely as the surviving record allows, not a verbatim replay.

| | legislation named, majority of 3 rolls |
|---|---|
| OFF | 6/10 |
| **ON** | **10/10** |

**10 of 10 — the target.** Exactly the four questions S23 §2 identified as failing at the router
(two more amendment questions than my reconstruction happened to also fail on) now name
`legislation` in addition to whatever else they already routed to; the two amendment questions
already at 1/1 (Illegal Migration Bill, Pension Schemes Bill, Border Security HRM) stayed there,
unchanged — matching the design's own "additive, never a replacement" constraint.

**"Through the product" — not verified.** `runSearch({ keywords, intent: 'AD_HOC_RESEARCH' })` was
run for all 10 with the flag on, but `FTS_SEARCH_URL` is unset on this machine (this session's
standing limitation) so every call returned `results: 0, failed: false` — the router selection is
proven, the retrieval leg is not. Re-run `scripts/measure-s24-bill-vocab.ts` from an environment
with the search services reachable to close this gap; S23 §2's own finding (once `legislation` is
searched directly, every one of these bills ranks 1st or 3rd) is the reason to expect it will hold,
not a substitute for checking.

**The regression gate — real, not noise, and honestly a genuine cost, not a clean win.** Measured
against its own control (both arms off — the established discipline this session's other router
measurements already use, `measure-s18-appraisal.ts`), on the accepted gold set
(GOLD_CORPUS + GOLD_V2, 68 questions after both ACCEPT filters):

| | lost ANY stream | gained legislation (over-firing) |
|---|---:|---:|
| CONTROL (noise floor) | 3/68 | 1/68 |
| **REAL (off → on)** | **8/68** | **6/68** |

**Net over the noise floor: ~5 extra questions lose a stream, ~5 extra gain `legislation` they
didn't have before.** One question (G1, guidance) is unstable in both runs — a noisy question
regardless of this flag — so the REAL new cost is closer to 7 than 8. The losses are concentrated
in exactly the shape the codebase's own precedent warns about (`ROUTER_PROMPT_APPRAISAL`'s and
`ROUTER_PROMPT_V2_STREAMS`'s headers: "adding options to a choice can change the choice even when
the options' descriptions do not"):

- **C5 (committees) lost its OWN committees stream** — the one loss worth naming specifically,
  since every other loss is a stream the question's own collection didn't need.
- Q16/Q19 (legislation) losing `committees`/`caselaw`, I6/N7/N10 losing `debates`/`committees`/
  `guidance` — all still keep their OWN collection's stream; these are secondary streams a
  now-longer prompt apparently crowds out on some rolls.
- The 6 over-firings (I3/I5/I10 impact-assessments, N1/N5 consultations, C3 committees) gaining
  `legislation` are the least concerning of the two effects: impact assessments and consultation
  responses are already legislation-adjacent by subject, and S18's own appraisal work already
  accepts some `legislation` over-firing as the cost of fixing a real gap.

**Recommendation: measured, not flipped — Charlie's call on the trade-off.** This is a genuine
10/10 fix on a real, evidenced gap (S23 §2), at a real (not noise) cost of roughly 5–7 of 68 gold
questions losing a secondary stream, one of them (C5) losing its primary one. `LEX_ROUTER_BILL_VOCAB`
ships OFF. Before flipping: (1) close the "through the product" gap above from an environment with
working retrieval, and (2) decide whether C5's loss specifically needs the prompt narrowed (e.g.
naming "amendments to a BILL" more sharply against "raised … with ministers", C5's own question
shape) before accepting the trade-off wholesale.

Full per-question data: `docs/census/s24-bill-vocab.json` (real run) and
`docs/census/s24-bill-vocab-control.json` (noise floor) — the script's first version wrote both
runs to the same path (fixed to match `measure-s18-appraisal.ts`'s own two-output convention; the
real-run file was re-generated after the fix so it matches this report exactly).

---

## Redirect links — Google grounding URLs

**The defect:** since S6 (6 August), every Tier B source and every `[W]`-cited Google result has
stored and shown `groundingChunks[].web.uri` directly — a
`vertexaisearch.cloud.google.com/grounding-api-redirect/…` wrapper, Google's own citation-tracking
indirection, never the actual page. A citation a reader cannot hover, copy into a browser and
recognise by domain, or judge for trustworthiness at a glance.

**Built:** `lib/lex/orientation/resolve-redirect.ts` (new) — `resolveGroundingUrls(urls)`, one
function, `GET` with `redirect: 'follow'` (fetch's default, named because it's the one thing this
call does), reading `response.url` for the final address without downloading the body (S21 §4's
own rule: this is not an extraction pass, fetched content never needs to be read here). Wired in at
the ONE place each — `web-orientation.ts`'s `callGemini` and `web-search.ts`'s `callGeminiRaw` —
resolved BEFORE the source list is built, so nothing downstream (the structuring call's own SOURCES
block, the final `OrientationSource`/`WebSearchResult`) ever sees the wrapper as the primary URL
again. **Both kept**: `url` is now the resolved address (what is shown/cited); `redirectUrl` is
Google's original wrapper, kept for provenance on both `OrientationSource` and `WebSearchResult`.

**⚠ "Dead" and "blocked" are NOT the same fact, and conflating them would overstate a defect that
isn't there.** The first version of this measured `ok: response.ok` and reported plain "dead" —
live testing immediately showed `ofwat.gov.uk` (a completely real, current page) counted as "dead"
because it returns **403** to an automated fetch, the identical bot-blocking this session already
measured on `parliament.uk`/`hansard.parliament.uk` (`docs/SEARCH_S21_REPORT.md` §7). `fetch`'s
`response.url` reports the correct final address even when the destination itself then refuses the
request — so a 403/404/500 still means the redirect RESOLVED; it means our own fetch was refused or
the page doesn't exist. Revised: `dead` is reserved for the case where no address could be obtained
at all (network error, timeout, DNS failure); a resolved address that answers 4xx/5xx is reported
separately as "resolved-but-blocked".

**Measured live, three real orientation-shaped queries, 18 grounding chunks total:**

| query | chunks | resolved | dead | resolved-but-blocked (non-2xx) |
|---|---:|---:|---:|---:|
| Ofwat sewage enforcement | 5 | 5 | 0 | 4 (all `ofwat.gov.uk`, 403) |
| Renters Reform Bill eviction | 5 | 5 | 0 | 0 |
| Sentencing Council guideline update | 8 | 8 | 0 | 1 |
| **Total** | **18** | **18 (100%)** | **0** | **5 (28%)** |

**Every single grounding redirect resolved to a real address.** Zero were genuinely dead. The real
pages recovered include `ofwat.gov.uk`, `theguardian.com`, `hansard.parliament.uk`,
`gov.uk`, `shelter.org.uk`, `keystonelaw.com`, `ussc.gov`, `forbes.com` — recognisable, citable
domains, in place of an opaque Google redirect string. Roughly a quarter of resolved addresses are
government/news hosts that refuse an automated fetch (matching this session's own earlier finding
about `.parliament.uk`) — real, current pages, just ones this measurement's own bot cannot confirm
are alive by fetching them. Neither `resolveGroundingUrls` nor any caller treats a "blocked" result
as a reason to withhold or drop the URL — the resolved address is stored and shown either way,
since a 403 to OUR fetch says nothing about whether a human reader's browser would see the page.

**Files:** `lib/lex/orientation/resolve-redirect.ts` (new), `lib/lex/orientation/types.ts`
(`OrientationSource.redirectUrl`), `lib/lex/orientation/web-orientation.ts`,
`lib/lex/orientation/web-search.ts` (`WebSearchResult.redirectUrl`).

---

## Orphans in builds

**Yes — confirmed, not hypothetical.** `build-research.ts`'s `retrieveFor()` (the ONE place a
build's research pass pulls `SearchResult[]` from `runSearch()`) pushed every result straight into
`candidates` with no check on `r.orphaned`. Those candidates flow into the sift → gather → merge
pipeline and, for anything the gather pass decides is a `FINDING`, straight into a real
`EvidenceItem` row (`citation: src.citation, url: src.url`) and into `CitedFinding[]` — the
build's own shown-and-stored evidence, not a chat answer. An orphaned hit's `citation`/`url` are
exactly S19 §1.1's own description (empty, or the collection's bare name) — presented as a real,
citable source backing a proposal's evidence, which is a worse place for this defect to surface
than a Lex chat answer.

**Fixed:** the same exclusion `general-chat.ts` already applies, at the ONE place
`SearchResult[]` enters `build-research.ts` — before sift, before gather, before anything is
written. A count is logged when it fires (`[25b:research] excluded orphaned hit(s)`), matching
`search-gateway.ts`'s own "count and log, never silently drop the fact" discipline.

**⚠⚠ Found while fixing it, wider than asked: the identical pattern exists in `deepening.ts`**
(the Deepening's own research loop, writing to the SAME `EvidenceItem` table via the same
`citation: src.citation, url: src.url` shape) — **fixed the same way**, since leaving it broken
would leave the exact symptom live through a second door into the same table. **Also found,
NOT fixed this session** (same `.citation`/`.url` read-through-from-a-SearchResult shape, not
independently confirmed to reach a stored or shown artefact the way the two fixed ones do, and
each would need its own trace before touching):

- `lib/lex/build-smart.ts:929` — `citation: src.citation`
- `lib/lex/build-highlights.ts:275` — `citation: r.citation`
- `lib/lex/build-client.ts:184`, `lib/lex/deepening-client.ts:193`,
  `lib/lex/deepening-sift.ts:186` — citation/url rendered directly into a model prompt (lower
  severity than a stored `EvidenceItem` — a model reading a bad citation in its own working
  context is not the same as a user reading one in a finished document, but still worth a
  specific check)
- `lib/lex/chat-retrieval.ts:269-272`, `lib/lex/gateway-legacy.ts:228-231`,
  `lib/lex/agenda.ts:269-270`, `lib/lex/facts.ts:92`, `lib/lex/costing.ts:468` — not traced this
  session; listed so the next pass through this doesn't have to re-discover them from a `grep`.

**Recommendation:** the two fixed here were the two that write into `EvidenceItem` — the
highest-severity case (a build's own persisted evidence). The rest are a follow-up, not a fire —
each needs the same one-line trace this session did for `build-research.ts`/`deepening.ts` (does
`.citation`/`.url` reach something stored or shown, or only a model's own scratch context) before
deciding whether it needs the filter too.

**⚠ Found in passing, fixed, unrelated to this section's own change but caught while touching the
same files:** two check scripts had drifted stale from EARLIER in this session's own work (not
from the orphan fix) and were failing silently until run just now —
`check-deepening.ts`'s literal-regex assertion on the retrieval push line (broken by this
section's own added `.filter()`, fixed to tolerate a filter while still rejecting the
panel-grouped list), a second `check-deepening.ts` assertion on 25-V §7's adversarial-issues
fallback (stale from an EARLIER, unrelated reshaping, not this session's doing), and
`check-lex-25r.ts`'s literal-text assertion on `user-material.ts`'s injection warning (broken by
this session's own S21 step-4 refactor — the shared `fetchedContentIsData()` — which replaced an
inline string the check searched for verbatim). All three re-run clean: `check:deepening` all
pass, `check:lex-25r` 52/0/2-not-checked/10-controls.

**Files:** `lib/lex/build-research.ts`, `lib/lex/deepening.ts`,
`scripts/check-deepening.ts` (two stale assertions fixed), `scripts/check-lex-25r.ts` (one stale
assertion fixed).

---

## Cost alert schedule — Railway cron

**Decision 6, resolved this session:** "Railway cron on the Ops service" turned out not to be
buildable as stated — Ops's own config cannot run `scrutinise-web` code (confirmed by reading its
`rootDirectory`/`startCommand` before touching anything). Reconfirmed with CCh: a genuinely new
Railway service, `rootDirectory=scrutinise-web`, Railway's native `cronSchedule` field rather than
an external scheduler.

**Built:** `cost-alert-cron` (service id `14c05090-c751-4cd9-8858-3df46b214e18`, same project/
environment as every other service). `serviceCreate` + `serviceInstanceUpdate`:

- `rootDirectory: scrutinise-web`, `startCommand: npx tsx scripts/cost-alert.ts`
- `cronSchedule: 0 8 * * *` — once daily, 08:00 UTC
- `watchPatterns` matching build-worker's own convention (`scripts/cost-alert.ts`, `lib/**`,
  `prisma/**`, `package.json`, `package-lock.json`)
- Secrets (`DATABASE_URL`, `RESEND_API_KEY`) copied from build-worker's own `variables()` read —
  never printed in full, only confirmed present by length — plus `LEX_COST_ALERT_EMAIL`

**First deploy failed, and the reason is the same class of trap this file's earlier sections keep
finding — a status without a cause is not evidence.** Nixpacks auto-detected the app as a normal
Next.js build and ran `npm run build`, which ran `next build`, which failed prerendering
`/communities` and `/_not-found` on a missing Clerk publishable key — a key this service has no
reason to hold, because it never serves a page. Fixed by mirroring build-worker's own override
exactly (`buildCommand: npx prisma generate`, `builder: RAILPACK`), which was sitting right there
to copy and should have been checked before the first deploy, not after it failed.

**No auto-deploy trigger, as documented above for build-worker (same root cause — a
Project-Access-Token cannot create one):** deployed explicitly with `serviceInstanceDeployV2`
against the verified local HEAD, `1417350dcf814bb303d2010c3363053957862635` (fetched and confirmed
matching `origin/Main` before use). Second deploy (`208620e8-a763-463c-998d-37db9c840e9e`) read
back `SUCCESS` with `meta.commitHash` matching in full.

**⚠ A `SUCCESS` build status on a cron service proves the image built — nothing about whether the
job has ever run.** Railway does not execute a cron service's start command on deploy; it waits for
the schedule. `deploymentLogs` on the fresh deployment came back empty, which is what confirmed
this rather than assumed it. The deliverable was "one real run", so the run was forced rather than
waited for 08:00 UTC: `deploymentInstanceExecutionCreate(serviceInstanceId)` — the same mutation
Railway's own dashboard "Trigger" button uses, found by introspecting the schema for a cron-shaped
mutation, since none of `deploymentRedeploy`/`deploymentRestart` execute on a schedule-gated
service.

**The run, read from the container's own logs (`deploymentLogs`, deployment
`208620e8-a763-463c-998d-37db9c840e9e`, 2026-09-25 10:23:15 UTC):**

```
thresholds: $20, $50
════ cost-alert — 2026-09 (UTC) ════
MTD spend: $21.4462 across 4918 call(s)
  $20 — ALERTED cl@scrutinise.org (Resend id 01a0d817-3845-76c3-9a22-749a07f4ecf8), recorded in CostAlertSent
  $50 — not yet passed
════ done ════
```

**Independently verified against the database, not just the log line** — `SELECT * FROM
"CostAlertSent" WHERE month = '2026-09'` returns exactly one row, `thresholdUsd=20`,
`providerId=01a0d817-3845-76c3-9a22-749a07f4ecf8` (matches the Resend id in the log byte for byte),
`sentAt=2026-09-25T10:23:15.630Z` (matches the log's run to the millisecond). MTD spend was already
past $20 going into this session (a real send, not a synthetic threshold as S22's original $0.01
proof run used), so this is production's first real cost-alert send.

**State at close:** `cost-alert-cron` deployed and live on `Main`, cron scheduled for 08:00 UTC
daily, one real triggered run proven end-to-end (container log → Resend id → DB row, three
independent reads agreeing). The $50 threshold is untested live (MTD spend has not reached it) but
shares the same code path already proven at $20.
