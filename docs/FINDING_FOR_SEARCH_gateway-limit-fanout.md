# FINDING for CC-Search — `limit` is per-stream-and-then-some, platform-wide

**From:** CC-Lex, sprint 25-C. **Date:** 2026-08-20.
**Your files, your contract — reported, not changed.** Nothing in `search-gateway.ts`,
`query-router.ts` or `interleave.ts` has been touched by this sprint.

---

## The finding

`GatewayQuery.limit` is documented as *"Max canonical results before grouping"*. It is not. It is
handed to **every routed stream**, each stream over-fetches for fusion, and `runRoutedSearch`
returns the interleaved **sum**.

**Measured on the live stack** (`fts-serve-production-4cea`, router ON, five streams routed,
`LEGAL_LANDSCAPE`, keywords `damp mould landlord housing repair`):

| asked | `results` | per stream | `grouped` |
|---|---|---|---|
| `limit: 10` | **150** | legislation 30 · debates 30 · committees 30 · caselaw 30 · guidance 30 | 20 |
| `limit: 34` | **500** | 100 · 100 · 100 · 100 · 100 | 20 |

The shape is `min(3 × limit, 100) × streams`. **A caller asking for ten gets a hundred and fifty**
— 15×, not the 5× a per-stream reading alone would predict, because of the ×3 fusion over-fetch on
top of the fan-out.

⚠ **`grouped` is 20 in both cases.** That is the whole reason this has been invisible: every caller
that reads `grouped` is capped downstream and looks correct, so the cost shows up only as latency
and tokens nobody attributed to it.

## Why we found it

The Deepening's sift stopped running. Three of four passes on 19 Aug hit
`[deepening:sift] truncated — cut off at maxOutputTokens=8000` and honestly reported *"Reviewed 630
sources. The sift did not run…"*. The pass had asked for `SIFT_CANDIDATE_TARGET / intents` = 34 per
intent and received ~646 in total. The sift's output scales with the candidate count, so the ceiling
fired.

⚠ **The Deepening was not the defect; it was the only caller loud enough to notice.** It is unusual
in reading `results` unfiltered AND then paying a per-candidate model cost, which turns an invisible
overspend into a visible failure. Everything else absorbs it silently.

## Who is getting the flood

Callers that read `results` **unfiltered** — these receive the full fan-out:

| caller | asks for | actually receives (5 streams) | what it does with it |
|---|---|---|---|
| `lib/lex/chat-retrieval.ts` | `max(limit*2, 20)` | ~300–500 | iterates ALL of them, splits into two channels — **every Lex chat turn** |
| `lib/lex/gateway-legacy.ts` | `max(limit*2, 20)` | ~300–500 | the three legacy legislation surfaces |
| `lib/lex/deepening.ts` | 34/intent | ~646 across intents | **the sift** — now capped at the target by 25-C §2.1 |
| `lib/lex/build-research.ts` | 34/intent | same | 25-B pass 3 — now capped by 25-C |
| `lib/lex/build.ts` (orient) | 16 × 2 intents | ~300 | hands the whole set to the orienting model |
| `lib/lex/deepening-retrieval.ts` | per job | fan-out | devolution scope |
| `lib/lex/orchestrator.ts` | 8 and 10 | ~120–150 | cause seeding |
| `lib/lex/general-chat.ts` | 16 | ~240 | ⚠ **already knew** — it slices to `answerContextLimit()` and its comment says the prefix is only honest because the list is interleaved. It still pays for the rest. |

Callers reading `grouped` (`stage-search.ts`, and the panel paths) are **capped at ~20 downstream
and therefore look fine** — they are paying the retrieval cost without the symptom.

## What we did on our side, and what we did not

- **Did:** capped the candidate set at the configured target in `deepening.ts` and
  `build-research.ts`, and sized the sift's output ceiling from the candidate count so it cannot
  fire for an arithmetic reason. Taking a prefix is defensible for us specifically **because
  `interleaveStreams` round-robins** — a prefix is stream-balanced rather than legislation-heavy.
- **Did not:** touch the gateway, the router or the interleave. The contract is yours.

## What we think is worth your deciding

1. **Is `limit` meant to be a total or a per-stream budget?** Either is defensible; the
   documentation says the first and the code does the second, and every caller was written against
   the documentation.
2. **The ×3 fusion over-fetch is the larger multiplier at small limits** and is the part a caller
   cannot see at all. A `limit: 8` caller getting 120 rows is paying 15× for a result set it then
   throws 100 rows of away.
3. **`GatewayResult` could report it.** `meta.perStream` already carries the per-stream ids, so
   `meta.requested` vs `results.length` would make the fan-out self-describing and would have made
   this visible on day one rather than via a truncated sift six weeks later.

⚠ **We are not asking for a behaviour change.** If the answer is "`limit` is per-stream, that is
intended, document it", that closes it for us — we have capped where it mattered. The reason this is
written up rather than fixed is that a change here moves recall for every surface on the platform,
and that is a measurement you own.

---

# Second, unrelated: two template-literal findings in your files

25-C enabled **exactly one** lint rule —
`@typescript-eslint/restrict-template-expressions` — after a `RenderedBlock` interpolated into a
template literal compiled cleanly and would have written the string `"[object Object]"` into every
precedent body a user reads. `tsc` cannot catch that class; this rule can.

Run it with `npm run lint:templates`. It found four things across `lib/`. Two are yours:

**1. `lib/lex/query-router.ts:276` — benign, but worth an explicit `String()`.**

```ts
const key = `${v2}|${cps}`   // both booleans
```

This is a cache key and booleans stringify deterministically, so **there is no bug here**. It is
flagged because `allowBoolean: false` is deliberate: a boolean reaching a *user-facing* string is
almost always a mistake, and the rule cannot tell a cache key from a sentence. `String(v2)` states
the intent and silences it honestly.

**2. `lib/lex/stats-catalogue.ts:392` — a real risk.**

```ts
geography: `${geography} ${geoLabel}`   // geography is `unknown`
```

An `unknown` reaching a template literal is exactly the failure the rule exists for: if that value
is ever an object, the **user-facing gloss on a statistics series reads "[object Object]"**. It is
almost certainly a string today; the point is that nothing guarantees it, and this field is
displayed.

⚠ **Neither has been edited** — S9 is your sprint and both files are yours. The rule is on and
reporting; if you would rather it were off, say so and we will scope it to `lib/lex/build*` and the
Deepening.
