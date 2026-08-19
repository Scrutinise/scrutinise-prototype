# SEARCH S8 §6 — STREAM CONCURRENCY 3 vs 4

*Generated 2026-08-19T09:23:37.495Z. Both caps in ONE process, alternating per question and*
*per repeat, against the same warm services. First query discarded as a warm-up.*

```
[config] fts=fts-serve-production.up.railway.app vector=vector-serve-production.up.railway.app streams=legislation,caselaw,guidance router=ON fully-configured
[engagement] fts+185  vector+100
```

## The prediction, recorded before the run

From the change log (2026-08-19 09:01 UTC): raising the cap to 4 should cut p50/p95 by roughly
the cost of one serialised batch wave, without saturating the services. And my own sharper
version: **five streams at a cap of 3 takes two waves (3+2); at a cap of 4 it also takes two
(4+1)** — the second wave shrinks from two tasks to one rather than disappearing — so a real
but MODEST p95 improvement, not a step change.

## Latency

| arm | p50 | p95 | mean | n |
|---|---:|---:|---:|---:|
| cap 3 | 5671 ms | 13125 ms | 5950 ms | 20 |
| cap 4 | 5433 ms | 19885 ms | 6609 ms | 20 |
| **delta** | **-238 ms** | **6760 ms** | **659 ms** | |

### Five-stream questions only — the case the cap actually binds on

| arm | p50 | p95 | mean | n |
|---|---:|---:|---:|---:|
| cap 3 | 7205 ms | 13071 ms | 8422 ms | 5 |
| cap 4 | 11136 ms | 19885 ms | 11410 ms | 5 |

## ⚠ The engagement check — did the cap bind at all?

| arm | maxInFlight observed | of observations |
|---|---|---:|
| cap 3 | 3 | 7 of 7 that could bind |
| cap 4 | 4 | 5 of 5 that could bind |

⚠⚠ **A BLANK `maxInFlight` MEANS THE CAP COULD NOT BIND, NOT THAT NOTHING WAS MEASURED.** The
limiter logs only when there are more streams than slots, so a question routed to three streams
at a cap of three produces no observation — correctly, because there was nothing to limit.
Of 20 question-runs per arm, **7 could bind at cap 3 and
5 at cap 4** — and that difference is itself the mechanism: raising the cap
removes the constraint from some questions entirely rather than speeding them up.

✅ The cap of 4 was actually reached, so the two arms really did differ in what they did.

## Errors and timeouts

None. 40 searches, 0 failures, 0 timeouts, in either arm.

## Recommendation

# ⚠⚠ DO NOT RAISE IT. THE PREDICTION IS REFUTED, AND THE MECHANISM IS VISIBLE.

*(Analysis written after the run, against the numbers above.)*

Both predictions said 4 would be faster. **On the case the cap actually binds — five-stream
questions — every statistic moved the wrong way:**

| five-stream questions | cap 3 | cap 4 | |
|---|---:|---:|---|
| p50 | 7,205 ms | 11,136 ms | **+3,931 ms worse** |
| p95 | 13,071 ms | 19,885 ms | **+6,814 ms worse** |
| mean | 8,422 ms | 11,410 ms | **+2,988 ms worse** |

**Why: 4 is exactly `vector-serve`'s width.** Read off its own `/stats` during this run:

```
"concurrency": { "max": 4, "maxQueue": 64, "queueHighWaterMark": 4, "rejections": 0 }
```

Per-stream fusion means each routed stream issues a BM25 call **and** a vector call. At a cap of 3,
three concurrent streams put three vector calls into a four-wide service and leave a slot. At a cap
of 4, four concurrent streams fill it exactly — `queueHighWaterMark` reached **4** — so the fifth
stream's vector call queues behind a fully-occupied service instead of slotting into spare
capacity. Raising the cap does not buy a wave; it buys saturation.

⚠ **This is precisely the failure the batching was built to prevent.** S5 §2 capped at 3 because
"five streams against a four-wide service was one user saturating it". The number 3 was chosen as
*one under the service width*, and this measurement is that reasoning holding up under test.

**Recommendation: leave `LEX_STREAM_CONCURRENCY` at 3.** The p95 on the chat route stays
"acceptable-ish, not good", and the lever that would actually move it is **more width on
`vector-serve`**, not more concurrency on the client — at which point the cap should follow the
width up, still one below it.

### ⚠ How far to trust this

- **n is small on the subset that matters:** 5 five-stream observations per arm, from 20
  question-runs per arm over 2 repeats. The direction is consistent across p50, p95 and mean, and
  the mechanism is independently visible in the service's own counters — but this is a strong
  signal, not a precise price.
- **Routing is an LLM call, so the two arms are not guaranteed to select the same streams for the
  same question.** That adds variance the alternating order cannot remove.
- **0 errors and 0 timeouts in either arm**, so nothing here is an outage effect.
- `served` moved (`fts+185 vector+100`), so the run genuinely reached both services.

⚠ **`LEX_STREAM_CONCURRENCY` is a Vercel variable and Charlie's to set** — it is not readable or
settable from this machine (SAML). This is a recommendation with numbers under it.

## Per observation

| rep/query | cap | ms | streams | maxInFlight | results |
|---|---:|---:|---:|---:|---:|
| 1. companies act 2006 directors duties | 3 | 13071 | 5 | 3 | 20 |
| 1. companies act 2006 directors duties | 4 | 19885 | 5 | 4 | 20 |
| 2. data protection lawful basis for processing pe | 4 | 7428 | 2 | — | 20 |
| 2. data protection lawful basis for processing pe | 3 | 5841 | 2 | — | 20 |
| 3. equality act public sector equality duty | 3 | 6801 | 5 | 3 | 20 |
| 3. equality act public sector equality duty | 4 | 6396 | 5 | 4 | 20 |
| 4. what have select committees said about water c | 4 | 4095 | 1 | — | 10 |
| 4. what have select committees said about water c | 3 | 3648 | 1 | — | 10 |
| 5. what did MPs argue in the debate on assisted d | 3 | 4613 | 1 | — | 10 |
| 5. what did MPs argue in the debate on assisted d | 4 | 4032 | 1 | — | 10 |
| 6. how have the courts interpreted the duty to ma | 4 | 7020 | 5 | 4 | 20 |
| 6. how have the courts interpreted the duty to ma | 3 | 8175 | 5 | 3 | 20 |
| 7. government guidance on procurement social valu | 3 | 5824 | 4 | 3 | 20 |
| 7. government guidance on procurement social valu | 4 | 4659 | 4 | — | 20 |
| 8. what evidence did witnesses give on leasehold  | 4 | 3579 | 1 | — | 10 |
| 8. what evidence did witnesses give on leasehold  | 3 | 3590 | 1 | — | 10 |
| 9. has parliament scrutinised the rollout of univ | 3 | 4263 | 3 | — | 10 |
| 9. has parliament scrutinised the rollout of univ | 4 | 4207 | 3 | — | 10 |
| 10. what was said about buy now pay later regulati | 4 | 5433 | 3 | — | 10 |
| 10. what was said about buy now pay later regulati | 3 | 4292 | 2 | — | 10 |
| 11. companies act 2006 directors duties | 4 | 12612 | 5 | 4 | 20 |
| 11. companies act 2006 directors duties | 3 | 13125 | 1 | — | 10 |
| 12. data protection lawful basis for processing pe | 3 | 5671 | 2 | — | 20 |
| 12. data protection lawful basis for processing pe | 4 | 5772 | 2 | — | 20 |
| 13. equality act public sector equality duty | 4 | 11136 | 5 | 4 | 20 |
| 13. equality act public sector equality duty | 3 | 6858 | 5 | 3 | 20 |
| 14. what have select committees said about water c | 3 | 3592 | 1 | — | 10 |
| 14. what have select committees said about water c | 4 | 3477 | 1 | — | 10 |
| 15. what did MPs argue in the debate on assisted d | 4 | 4063 | 1 | — | 10 |
| 15. what did MPs argue in the debate on assisted d | 3 | 3706 | 1 | — | 10 |
| 16. how have the courts interpreted the duty to ma | 3 | 7205 | 5 | 3 | 20 |
| 16. how have the courts interpreted the duty to ma | 4 | 4689 | 1 | — | 10 |
| 17. government guidance on procurement social valu | 4 | 9748 | 4 | — | 20 |
| 17. government guidance on procurement social valu | 3 | 6168 | 4 | 3 | 20 |
| 18. what evidence did witnesses give on leasehold  | 3 | 4070 | 1 | — | 10 |
| 18. what evidence did witnesses give on leasehold  | 4 | 4032 | 1 | — | 10 |
| 19. has parliament scrutinised the rollout of univ | 4 | 5761 | 3 | — | 10 |
| 19. has parliament scrutinised the rollout of univ | 3 | 4191 | 3 | — | 10 |
| 20. what was said about buy now pay later regulati | 3 | 4288 | 2 | — | 10 |
| 20. what was said about buy now pay later regulati | 4 | 4148 | 2 | — | 10 |
