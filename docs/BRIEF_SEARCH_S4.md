# BRIEF — SEARCH STAGE 4: WHY IS LEX ONLY LOOKING AT LEGISLATION?

**Owner:** CC-Search
**Stream:** SEARCH
**Written:** 16 August 2026
**Follows:** S3 — §7 done, §1 built and flag-gated, §2 and §3 not started

**Where this sits:**
- *Last:* S3 — the router's OFF and FAILED states separated; harnesses refuse to run degraded;
  tier-scoped fusion built behind `LEX_TIER_FUSION`, default off
- **This: S4 — establish whether the tier scope on those surfaces is correct at all, then measure
  the flag and decide it**
- *Then:* §2 batching, §3 the deepening intents

---

## §0 — Charlie's question, which is bigger than the flag

S3 reported the three tier-scoped surfaces as getting keyword search where they should get
keyword-plus-semantic, and proposed the flag as the fix. Charlie's response reframes it:

> *The Lex chat route and the search API aren't scoped not to talk about Hansard. Those are general
> functions and users on there might be talking about anything.*

**He is right, and the audit is the thing to do before the measurement.** The three callers pass
`tier: 'legislation'`, so those surfaces do not merely lack semantic search — **they never look at
committees, debates, case law or guidance at all.** A user asking Lex "what have select committees
said about this" gets nothing from committees, and not because of ranking.

**That is a scoping defect, not a retrieval one**, and it is a different and larger finding than the
one S3 acted on.

---

## §1 — Audit the tier scope, per caller, and report before changing anything

Three callers reach `gateway-legacy.ts`:

| caller | what it is | is a legislation-only scope right? |
|---|---|---|
| `app/api/ai/[ideaId]/route.ts` | **the Lex chat route** — the main conversation | ⚠ almost certainly not |
| `app/api/ideas/[id]/legislation-search/route.ts` | the legislation panel | probably yes, it is a legislation panel |
| `app/api/search/route.ts` | the search API | depends what it serves — **establish it** |

For each: **what does it show a user, and what would a user reasonably expect it to search?**

⚠ **The Lex chat route is the one that matters.** It is where pilot users will spend their time, and
if it is restricted to legislation then everything the corpus holds about debates, committee
evidence, case law and guidance is invisible in the platform's main conversation. Establish this
behaviourally — ask Lex a committee question through the running product and see what comes back —
rather than by reading the code alone.

⚠ **Do not widen a scope before reporting it.** The legislation panel probably *should* be scoped,
and widening it would be a regression dressed as a fix.

---

## §2 — Then measure the flag, and Charlie's default is the right one

His framing:

> *Why wouldn't semantic search be on for all uses other than a pure legislation or case law code
> reference?*

**Adopt that as the default and make keyword-only the exception that has to justify itself.** The
one place the exception is real is narrow: an **exact citation** — "section 172 Companies Act 2006"
— where precise matching beats semantic similarity, because semantic search on a precise reference
drifts toward things that are *about* it rather than the thing itself. The citation resolver already
exists for this.

The measurement, now cheap because the corpus is fixed and both indexes are rebuilt:

- Run the gold set with `LEX_TIER_FUSION` off, then on. Same questions, same everything else.
- Report recall and the preference metric for each, **with the resolved flag state printed beside
  the number** per S3 §7.2.
- Report latency for each, at p50 and p95.
- ⚠ **Reverse the run order** and report both directions. The last measurement of this compared
  2,295 ms against 3,710 ms on a warm cache, and cache-warming artefacts have caught this project
  before.

**Then decide it on the number rather than on the eyeball.** S3's judgement — that the swaps looked
better but were unmeasured — was the right call at the time and this is what retires it.

⚠ **If quality holds and only latency moves, that is a trade for Charlie, not a technical
verdict.** Give him both figures and a recommendation, not a conclusion.

---

## §3 — Carried from S3, still not started

**§2 batching** — one request to `vector-serve` carrying all the stream queries, rather than one per
stream. Still what makes the remaining streams and the divisions lane affordable, and still
outstanding. If §1 widens the Lex chat route to all five streams, **this stops being an optimisation
and becomes a prerequisite**: five streams per query against a service that caps at four concurrent
means one user saturates it.

**§3 the deepening intents** — `PRECEDENT` and `DEVOLUTION_SCOPE`, plus the Public sources block.

---

## §4 — Standing

Unchanged, and one worth repeating because it applies directly to §1: **a scope that was right when
it was written is not necessarily right now.** The legislation tier scope predates the router, the
five streams and most of the corpus. It was probably correct on the day it was added.
