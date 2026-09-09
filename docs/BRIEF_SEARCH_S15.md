# BRIEF — SEARCH S15: MAKE THE DENSE SERVICE SURVIVE ITS OWN LOAD

**For:** CC-Search
**Written:** 27 August 2026, by CCh-Search
**Executes:** `SEARCH_S14_REPORT.md` §0 (D-1) — Charlie has chosen **fix, not throttle**, and has
approved adding capacity. `LEX_VECTOR_STREAMS` stays at `legislation,caselaw,guidance,committees`.
**Format:** audit-then-build. **§1 reports before anything is provisioned or paid for.** No git
during the sprint; one **`commit-search-s15.sh`** at the end. Scoped commits by explicit path.

---

## §0 — WHAT IS WRONG, AND WHY THE ORDER OF FIXES MATTERS

**The measurement:** `vector-serve` processes **4 requests at a time** behind a **64-deep queue**.
A client that gives up does **not** cancel work already queued. Worst-case wait went from **7,698 ms
to 706,954 ms** — 11.8 minutes — and **kept climbing for forty minutes after every client had been
killed**. The four dense-enabled streams all returned at the 25-second client timeout within 36 ms of
each other; debates, the one stream with no dense leg, returned in 4.0–6.1 s.

**In plain terms:** one search fires four requests into a service that handles four *in total, for
everybody*. One user saturates it. A user who gives up makes it worse, because the abandoned work is
still executed. The queue is a debt that only grows.

⚠⚠ **This is why capacity alone will not fix it, and it is the most important sentence in this
brief. A wider service with no cancellation and an unbounded queue fails the same way, later, having
cost money.** The fixes must land in this order:

1. **Cancel abandoned work** (§2) — this is what lets the queue drain at all.
2. **Refuse work you cannot do** (§3) — a bounded queue that sheds, and says so honestly.
3. **Reduce the demand each search creates** (§4) — four requests per search is a choice, not a law.
4. **Then add width** (§5), sized from a measured service time rather than a guess.

⚠ Nobody is using the platform yet and Charlie is holding invitations until this works. **That is the
licence to fix it properly rather than throttle it — and it expires the moment a pilot user arrives.**

---

## §1 — AUDIT. REPORT BEFORE PROVISIONING OR SPENDING.

1. **Why 4?** Is the concurrency a config value, derived from CPU count, or a consequence of memory?
   Print the code. ⚠ If it is memory-derived, width costs RAM per replica and §5 changes shape
   entirely.
2. **What is one request actually made of?** Time a single dense query end to end, broken down:
   embedding the query, loading or seeking the index, the nearest-neighbour search itself, response
   assembly. **Which stage dominates?** ⚠ Everything downstream depends on this and nobody has ever
   measured it.
3. **How big is the index in memory**, and does each worker hold its own copy or share one? This
   decides whether width is bought with replicas (multiplying memory) or with threads (not).
4. **Measure the true service time and derive the width required.** With a measured mean service time
   and the arrival rate four dense streams produce, state the width at which the queue stops growing.
   ⚠ **Report the arithmetic, not a preference.** "Add as much capacity as possible" is Charlie's
   authorisation to spend; it is not a number, and a service sized by feel will be resized by feel.
5. **What does width cost?** Railway pricing, per replica per month, at the memory each needs. ⚠ On
   the current bill compute already costs roughly eight times storage; this is the line that moves.
6. **Confirm the failure mode from the outside.** Does a client disconnect actually leave the work
   running? Prove it — start a request, kill the client, and show the work still executing. **Do not
   infer this from the code.**

▶ **Report §1 before provisioning anything.** If the audit contradicts this brief, the brief changes
on the record.

---

## §2 — CANCEL WORK NOBODY IS WAITING FOR

**The single highest-value change in the sprint**, and probably the cheapest.

- Detect client disconnect on the request, mark the queued job cancelled, and **check that flag before
  starting work and again between stages**. A job already running to completion is acceptable; a job
  that has not started must never begin.
- **Verify by reproduction, not by reading:** run the §1.6 experiment again after the fix and show the
  queue draining. ⚠ The check must be the two-sided one — **watch it fail against the current build
  first**, then pass. A cancellation path that has never been seen refusing to start a job is not a
  cancellation path.
- Report the recovery time: how long after the last client is killed does the queue reach zero?
  Today it was still climbing at forty minutes.

---

## §3 — A BOUNDED QUEUE THAT SAYS SO

A 64-deep queue on a 4-wide service means the last request in line waits sixteen service times. **That
queue depth is not resilience; it is a promise that cannot be kept.**

- Cap the queue at a small multiple of the width — a starting point is 2×, and the number comes from
  §1.4, not from this brief.
- When it is full, **reject immediately and explicitly.** A fast, honest refusal is worth far more
  than a 25-second timeout.
- ⚠ **The refusal must reach the user as a stated gap, not as an empty result.** The gateway already
  distinguishes *the search could not be completed* from *the search found nothing*
  (`GatewayResult.failed`), and `SEARCH_CONTRACT.md` §6 requires Lex to say which. **A saturated
  service must set `failed`, so Lex says "I could not search the corpus for this", never "I found
  nothing."** This is the never-claim rule reaching the one place it has never been tested.
- Keep the since-boot counters that made this diagnosable — `queueHighWaterMark`, rejections — and
  add the recovery measurement from §2.

---

## §4 — FOUR REQUESTS PER SEARCH IS A CHOICE

Each dense-enabled stream issues its own request, so enabling a fourth stream quadrupled the load
from one search. **Scope and cost, then build if the audit supports it:** one request carrying all
four stream-scoped queries, executed inside the service.

**Why this is likely the largest single win:** it removes three of every four requests from the queue
without touching the number of searches performed, and the work inside the service can share one
index open and one warm cache instead of contending for it.

⚠ **A batch must fail per-stream, not as a whole.** One stream erroring must not fail the other
three — `Promise.all` semantics here would convert one stream's fault into a total search failure,
which is the opposite of what §3 is for.

⚠ Report whether this changes the stream concurrency cap (`LEX_STREAM_CONCURRENCY`, currently 3 for
exactly this reason). If batching lands, that cap may be measuring something that no longer exists.

---

## §5 — THEN ADD WIDTH

Only after §2 and §3, and sized by §1.4.

- **Vertical first** — more concurrency within one instance, if the audit says the limit is CPU or an
  arbitrary constant rather than memory.
- **Horizontal second** — replicas, with the memory cost per replica stated and the total monthly cost
  reported against the current bill.
- ⚠ **Prove the new width is real.** Read the concurrency off `/stats` on the running service, not
  from the configuration you set. A limiter that silently failed open would look identical to one
  that worked — this project has already shipped that exact defect once, which is why
  `maxInFlight` is observed rather than assumed.
- ⚠ Heavy index builds still run on the rented large-memory box, never here. This is a capacity change
  to the serving host, not permission to run jobs on it.

---

## §6 — RESTORE, THEN MEASURE, IN THAT ORDER

1. Confirm all four dense streams run without saturation under a **two-user** load, not a one-user
   load. Report p50 and p95 per stream.
2. **Retake the baseline** with `LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees` — the
   real production string. ⚠ Every earlier figure in this project was taken with **one** dense stream.
   S14 sizes the unmeasured gap at roughly 12 points. **Name every figure this supersedes**; there are
   already three baselines in circulation and two are void.
3. **Only then** recommend turning on the judged merge (S14's D-2/D-4). It took displayed answers from
   14 to 19 of 64 — the same as what retrieval finds, meaning everything found is now shown — and it
   adds work to the service this sprint exists to protect. **Order matters: capacity, then measure,
   then switch on.**
4. n is **64**: question 15 is excluded, its answer key being a provision whose stored body is 66
   characters of dot leaders.

---

## §7 — THE DEPLOY TRAP, NAMED BECAUSE IT HAS COST THREE SPRINTS

⚠ **`vector-serve` does not auto-deploy from GitHub, and a redeploy is not a rebuild** — it re-runs
the existing artefact. S14 found it pinned to a **12 August** commit while reporting `branch: Main`,
which finally explained a recurring note nobody had a cause for.

- Nothing in this sprint is delivered until **new code is proven running on the service**.
- Prove it with a probe that is **false on the old build and true on the new** — not by a process
  restarting, not by a mutation returning an id, and not by an absence of errors.
- If the source ref must be repointed in the Railway dashboard, that is Charlie's action: **name it
  explicitly, with the one-request signal that confirms it.**

---

## §8 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s15.sh`; nothing owned by ingest, graph or lex
  edited — report needed changes instead.
- Every check watched failing against the **real** broken state, reproduced deliberately.
- Predictions logged before each measurement; bytes before hypotheses — read `/stats` off the running
  service, never the configuration.
- **Report `docs/SEARCH_S15_REPORT.md`:** §1's audit first, with the service-time breakdown and the
  derived width — that is the durable artefact and the first time this service has been characterised.
  Then recovery time after cancellation. Then the load test with all four streams, p50 and p95 per
  stream. Then cost per month, actual. Then what is NOT done, named. Decisions for Charlie as
  numbered questions with a recommendation and the consequence of each option.
- Change-log, contract and handoff entries labelled **SEARCH**.
