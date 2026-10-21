# Handover to the Lex stream — the research sequence, stages 1 and 2 (SEARCH-29, 21–22 Oct 2026)

*From Search. Stage 3 (the four-provider check) is SEARCH-30 and does not exist yet. Everything below is built, checked offline (`npm run check:search-29`), and **off by default**; whether stage 2 helps retrieval is measured in `docs/SEARCH_29_REPORT.md` — read that before you switch anything on for users.*

## The two stages, in one paragraph each

**Stage 1 — orientation v2** (`lib/lex/orientation/v2.ts`). Give it a person's full input. It searches the web (Gemini grounding) and X (Grok `x_search`) at the same time and returns **the arguments being made** — claim, reason, side (for / against / nuanced), source, tier — and **the vocabulary around them** — key terms, statutory terms *if the source names them*, people, organisations, places it has been tried. About 30 seconds and 7–15p per call, measured on two real ideas.

**Stage 2 — library search with that vocabulary.** `runSearch` (the gateway) now takes `extraTerms?: string[]`. They go to the **router** as one extra line in its message, beside the person's own words, which remain the question. The router decides, per stream, whether a term belongs in that stream's query.

## How to call them

```ts
import { runOrientationV2, termsForSearch } from '@/lib/lex/orientation/v2'
import { runSearch } from '@/lib/lex/search-gateway'

const o = await runOrientationV2({ input: 'the person\'s own words' })   // never throws; check o.failed
const terms = termsForSearch(o)                                          // statutory terms, then key terms, then organisations; max 20
const out = await runSearch({ keywords, intent, ideaContext, extraTerms: terms })
```

### Stage 2 takes ANY list of terms — this is the seam for your two callers

`extraTerms` does not know or care that stage 1 produced it.

- **The update pass** — when the user adds or changes something, pass the new text's own terms (or run stage 1 on just the new text) as `extraTerms`. No stage-1 call is needed if you already have the terms.
- **"Research an angle"** — run `runOrientationV2({ input: <the angle, in the user's words> })`, then `runSearch` with its `termsForSearch(...)`.
- Anything else with a list of words the person has not used but the field does.

`extraTerms` is read **only by the router**, and **only when the router is on** (`LEX_QUERY_ROUTER`). It never enters briefing text or a citation; it steers retrieval. With none given, the router's message is byte-for-byte what it was.

## Where it is wired today

`orientPass` in `lib/lex/build.ts` runs stage 1 **concurrently with the opening-query writer**, stores the result on `Idea.orientation` (`{ version: 2, … }`; nothing else reads that column), and — only if `LEX_ORIENTATION_TERMS` is on — hands the terms to both of the pass's `runSearch` calls.

| Flag | Does | Default |
|---|---|---|
| `LEX_ORIENTATION_V2` (and `LEX_WEB_ORIENTATION`) | the ORIENT pass runs stage 1 and stores it | **off** |
| `LEX_ORIENTATION_TERMS` | the ORIENT pass hands stage 1's terms to the router | **off** |
| `LEX_ANSWER_STREAM_FLOOR` | Option B — two places per routed source in the 16-place answer context (`lib/lex/answer-context.ts`, used by `general-chat.ts`) | **off** |

## Things you will want to know before you build on it

1. **Orientation had never run in the product.** v1 was only reachable from the legacy Page-1 trigger; the build never called it, and the last `orientation.*` ledger row was 25 September. v2 is the first thing to call it from a build.
2. **Never show Tier C (X) as fact or as "public opinion".** Each argument carries `source.tier`: `B` is web, cited by index into Google's grounded source list (never a URL the model typed); `C` is what is circulating on X. v1's `quarantine.ts` rules still apply to anything you render.
3. **The vocabulary is noisy.** Useful terms and wrong ones arrive together (an off-topic planning statute turned up among a deportation idea's statutory terms). That is why the router is told to use a term "only where that stream's documents would plausibly use it", and why stage 2 is measured. Do not display the vocabulary to a user as if it were checked.
4. **Arguments can be undated or unverified.** v2 keeps an argument with no date (`undated: true`) and one the search could not tie to a listed source (`source.verified: false`). v1 dropped both. Say so where you show them.
5. **The noise filter drops only abuse, sarcasm, pile-ons and posts with no argument — and logs each** (`o.dropped`). On two ideas it dropped posts with no argument and one pile-on; it found no abuse. `runOrientationV2({ noiseFilter: false })` runs the same call unfiltered.
6. **The X post cap (30) is advisory.** `x_search` has no maximum-results setting; the model is told the cap and `postsFetched` (the provider's own count) is recorded against it. `o.xCapExceeded` says when it was passed.
7. **A failure names itself.** `o.failed` is true only when both calls failed; each call's `reason` is in `o.calls`. An empty result with `failed: false` means it ran and found nothing.
8. **Spend is on the ledger** as `orientation.web` (Gemini: the grounded call and the structuring call, two rows) and `orientation.x` (Grok, with `postsFetched`), attributed to the idea when the build context is set. Scripts label theirs `measurement`.
9. **Time.** About 30 seconds, and the web and X calls run in parallel. The ORIENT pass already waits for the opening-query call, so stage 1 adds no wall-clock unless it is the slower of the two — it usually is. Budget: `ORIENTATION_TOTAL_BUDGET_MS`, default 90 s; a call that overruns is abandoned and recorded as such.

## What is NOT done

- Stage 3 (the four-provider check) — SEARCH-30.
- Nothing renders stage 1's arguments to a user. They are stored; the build's later passes do not yet read them.
- Stage 2's effect on retrieval — see the report; until it says otherwise, assume none.
