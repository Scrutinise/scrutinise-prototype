# BRIEF — SEARCH S15: FIND THE BLOCK, THEN REMOVE IT

**For:** CC-Search
**Written:** 27 August 2026, by CCh-Search. **Supersedes the earlier S15 draft**, which led with
fixes before the cause was known — Charlie's objection, and it was right.
**Executes:** `SEARCH_S14_REPORT.md` §0 (D-1). Charlie has chosen **fix, not throttle**;
`LEX_VECTOR_STREAMS` stays at `legislation,caselaw,guidance,committees`, and capacity spend is
authorised.
**Format:** diagnose, then fix. **§1 is a diagnosis with decisive tests. Nothing is provisioned or
paid for until it reports.** No git during the sprint; one **`commit-search-s15.sh`** at the end.

---

## §0 — THE QUESTION THIS SPRINT ANSWERS

**Why can our own search over our own data only do four things at once?**

The observed behaviour: `vector-serve` processes 4 requests concurrently behind a 64-deep queue.
Under four dense streams, worst-case wait went **7,698 ms → 706,954 ms** and was still climbing forty
minutes after every client had been killed.

⚠ **Nobody has ever measured what one dense query costs us.** Not the time, not the dominant stage,
not the memory, not the bytes moved. Every capacity decision on this service — including the choice
of 4, and the stream concurrency cap of 3 that was set to accommodate it — rests on an unmeasured
number. **That is the actual defect. The queue behaviour is a symptom.**

**Nothing here is an external limit.** We are not calling another provider for this. It is our own
index over our own paragraphs. So the block is ours, and it is one of four things, each with a
different fix and a very different price.

---

## §1 — THE DIAGNOSIS: FOUR HYPOTHESES, FOUR DECISIVE TESTS

**Record a prediction for each before testing.** Report all four results even where the first is
conclusive — this service has never been characterised and the numbers are worth having.

### H1 — It is an arbitrary constant

**Test:** read the code. Is the concurrency a config value, a hard-coded number, or derived
(`os.cpus().length`, a pool size, a library default)? Print the line.
**If true:** the fix may be free. ⚠ **Raise it and re-measure — do not assume it helps.** Raising the
stream cap from 3 to 4 once made things *worse*, because 4 was exactly this service's width.

### H2 — Processor-bound

**Test:** run one dense query in isolation and record CPU utilisation across the box, and the wall time
broken down by stage: embedding the query · opening or seeking the index · the nearest-neighbour
search · assembling the response. **Which stage dominates?**
**If true:** utilisation pins near 100% on all cores during the search stage. Fix is a bigger box or
more replicas, and §5 sizes it.

### H3 — Memory-bound

**Test:** report the on-disk size of the vector index, the resident memory of the process at rest and
under load, and the box's total. ⚠ 22.7 million paragraphs at 768 dimensions is roughly **70 GB
uncompressed**, so the index is necessarily compressed and/or partitioned. **Establish which, and
whether the working set fits in RAM.**
**If true:** the box is paging or re-reading index fragments per query. Fix is memory, and it is the
cheapest big win if this is the cause.

### H4 — Storage or network-bound

**Test:** is the index on the instance's own disk, on a mounted volume, or fetched from object storage
per query? Measure bytes read per query and where they come from.
**If true:** more processor buys nothing. Fix is to co-locate the index with the service.
⚠ **This is the hypothesis most likely to be true and least likely to be looked for**, because the
corpus lives in object storage and "it's just a database query" hides a network round trip.

### And the arithmetic that turns the answer into a number

From the measured mean service time and the arrival rate four dense streams produce, **state the width
at which the queue stops growing.** ⚠ **Report the arithmetic.** "As much capacity as possible" is
authorisation to spend; it is not a specification, and a service sized by feel gets resized by feel.

▶ **Report §1 before provisioning.** If any hypothesis has a fix that is free or under about $50 a
month, **apply it in this sprint and re-measure.**

---

## §2 — DO NOT SPEND OUR FOUR SLOTS ON PEOPLE WHO HAVE LEFT

⚠ **Framing correction, because the earlier draft got this wrong.** This is not abandoning a user's
search. The user has already gone — their request timed out twenty-five seconds ago and they have
seen an error or closed the tab. **We currently run that work anyway**, occupying slots while the
person actually waiting sits behind ghosts. That is why the queue kept growing after every client
was killed.

- On client disconnect, mark the queued job cancelled and **check the flag before starting work**. A
  job already running may finish; a job that has not started must not begin.
- **Prove it by reproduction:** start a request, kill the client, show the work still executing today,
  then show it not executing after the fix. Watch the check fail against the current build first.
- **Report the recovery time** — how long after the last client dies does the queue reach zero. Today
  it was still climbing at forty minutes.

---

## §3 — A QUEUE THAT CANNOT KEEP ITS PROMISES

64 deep on a 4-wide service means the last request waits sixteen service times. Cap it at a small
multiple of the measured width (§1), and refuse immediately when full.

⚠ **Framing correction here too, and it matters for how this is built.** *"I could not search"* is a
**last-resort safety net that should essentially never fire once §1's fix lands** — not a normal
path, and not something a user should meet in ordinary use. **If the rejection rate is not
approximately zero after §1 and §5, the capacity fix has not worked and that is the finding.**

But when it does fire, the alternative is worse: returning an empty result set means Lex says *"I
found nothing"* about a corpus it never searched, and a user cannot tell that from the subject not
existing. So a rejection **must** set `GatewayResult.failed`, which `SEARCH_CONTRACT.md` §6 already
requires Lex to report as a gap rather than an absence.

**Report the rejection rate under the §6 load test.** It is the acceptance measure for the whole
sprint.

---

## §4 — FOUR REQUESTS PER SEARCH IS A CHOICE, NOT A LAW

Each dense-enabled stream issues its own request, so enabling the fourth stream quadrupled the load
from a single search. **Scope, cost, and build if §1 supports it:** one request carrying all four
stream-scoped queries, executed inside the service.

Likely the largest single win: it removes three of every four requests from the queue while doing the
same work, and the searches inside can share one index open and one warm cache instead of contending.

⚠ **A batch must fail per-stream, not as a whole** — one stream's error must not fail the other three.
⚠ Report whether this makes `LEX_STREAM_CONCURRENCY=3` obsolete; it was set to accommodate a width
that may no longer exist.

---

## §5 — THEN BUY WIDTH, SIZED BY §1

- **Vertical first** if H1 or H2; **memory first** if H3; **co-location first** if H4.
- Replicas only where the audit says memory allows it, with **cost per month stated against the
  current bill** — compute already runs about eight times storage.
- ⚠ **Prove the new width is real by reading it off `/stats` on the running service**, never from the
  configuration you set. A limiter that silently failed open would look identical to one that worked;
  this project has shipped that exact defect once already.

---

## §6 — THE ACCEPTANCE TEST

1. **Two simultaneous users, all four dense streams**, the real production flag string. Report p50 and
   p95 per stream, and the rejection rate (§3).
2. **Retake the baseline.** ⚠ Every figure this project holds was measured with **one** dense stream;
   production runs four, and S14 sizes the unmeasured gap at roughly 12 points. **Name every figure
   this supersedes** — there are three baselines in circulation and two are void. n is **64**.
3. **Only then** recommend switching on the judged merge (S14 D-2/D-4). It lifts displayed correct
   answers from 14 to 19 of 64 — and adds work to the service this sprint exists to protect.
   ⚠ **State plainly in the report that 45 of 64 questions still return nothing correct.** The merge
   is no longer the constraint; retrieval is. That is the next sprint, and this report should not read
   as though the platform is fixed.

---

## §7 — THE DEPLOY TRAP

⚠ **`vector-serve` does not auto-deploy from GitHub, and a redeploy re-runs the existing artefact.**
S14 found it pinned to a **12 August** commit while reporting `branch: Main` — which finally explained
a recurring note nobody had a cause for.

Nothing here is delivered until new code is **proven running**, with a probe that is false on the old
build and true on the new. Not a process restarting, not a mutation returning an id, not an absence of
errors. If the source ref must be repointed in Railway, that is Charlie's action — **name it, with the
one-request signal that confirms it.**

---

## §8 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s15.sh`; nothing owned by ingest, graph or lex
  edited — report needed changes instead.
- Every check watched failing against the **real** reproduced failure.
- **Report `docs/SEARCH_S15_REPORT.md`:** §1's four answers first, with the service-time breakdown and
  the derived width — **the first characterisation this service has ever had, and the durable artefact
  of the sprint.** Then the fix applied and why. Then the load test. Then actual monthly cost. Then
  what is NOT done, named. Decisions for Charlie as numbered questions with a recommendation and the
  consequence of each option.
- Change-log, contract and handoff entries labelled **SEARCH**.
