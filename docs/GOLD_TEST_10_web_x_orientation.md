# GOLD_TEST_10 — Web + X orientation (§6d), Stage 0

*Measured 2026-08-06 20:45 UTC. Harness: `npm run check:orientation` (with
`LEX_WEB_ORIENTATION=true`), source `scrutinise-web/scripts/check-orientation.ts`.*

---

## Why this needed a new gold set

No existing archetype covers this. A–K all ask *"does the corpus retrieval find the
right document?"*. This layer answers a different question: **does the briefing miss
something an ordinary web search would obviously find?** A corpus that is 100% correct
about the law can still produce a briefing that is embarrassing — because the regulator
it names is being abolished, or because the idea has already been fought over in public
and lost.

So the questions here are deliberately **not** retrieval questions. Each one names a fact
that is:

- trivially findable by anyone with a search box, and
- **structurally impossible** for a corpus of enacted law to hold — a white paper, a
  commencement timetable, a policy reversal, a petition.

**The answer key was written FIRST, from an independent ordinary web search, before the
layer was ever run against these questions.** Scoring a layer against its own output
would only prove that it agrees with itself.

---

## The five questions

| id | Topic | The corpus blind spot |
|----|-------|------------------------|
| **WX1** | Tightening controls on dangerous dogs | The 1991 Act and the 2023 exemption order are in the corpus. The 2026 changes to the exemption *conditions* are administrative announcements. |
| **WX2** | Ending no-fault eviction | The Housing Act 1988 and the Renters' Rights Act are in the corpus. The *commencement timetable* — when s.21 actually dies, and the transitional deadlines around it — is what a person needs. |
| **WX3** | Enforcement against water companies | **The sharpest case.** The corpus will confidently describe Ofwat as the regulator. Ofwat is being abolished. That is a white paper and a forthcoming bill, so it cannot be in a corpus of enacted law — and a briefing that misses it sends the user to design a proposal around a regulator that is going away. |
| **WX4** | Restricting tobacco and vape sales | The Act is findable; the *phased* commencement (what bites Oct 2026 vs Jan 2027) determines whether a proposal is already covered. |
| **WX5** | A national digital identity scheme | **The argument case.** There is no Act to find. What matters is entirely political: a ~2.98m-signature petition and a government reversal. |

Each question carries 2–3 *signals* — a signal counts only when **every** pattern in it
matches, so a briefing that says "1 May 2026" about something unrelated does not score.

---

## Results

| id | signals found | control (corpus only) | latency | cost | quarantine |
|----|---------------|------------------------|---------|------|------------|
| WX1 | **2/2** | 0/2 | 29.2s | $0.0827 | OK |
| WX2 | **2/2** | 0/2 | 25.5s | $0.0597 | OK |
| WX3 | **2/2** | 0/2 | 34.8s | $0.0960 | OK |
| WX4 | **1/3** | 0/3 | 31.1s | $0.0736 | OK |
| WX5 | **3/3** | 1/3 | 33.5s | $0.0695 | OK |

**Coverage 10/12 (83%). Control 1/12 (8%).**
**Added latency 30.8s per briefing (mean). Added cost $0.0763 per briefing (mean).**
**Quarantine: PASS on every question.** All three passes completed on all five questions.

The control arm is the same question run through the corpus alone (live
`fts-serve-production`, 5–8 refs per question), scored with the same patterns. Its one
hit is WX5's "civil liberties" signal, which Hansard supplies — the corpus knew the
*argument* existed and knew nothing about the petition or the U-turn.

### The two misses, stated rather than rounded off

- **WX4 signals 2 and 3** (the 2009 birth-date cut-off; the Oct-2026/Jan-2027 phasing).
  The pass returned the Act and its Royal Assent but not the implementation detail.
- ⚠ **WX4 is not stable between runs.** An earlier run of the identical harness scored
  **2/3** on WX4 (it caught the 2009 cut-off) and **1/2** on WX3 (it missed the Ofwat
  abolition). Whether Gemini's grounded pass searches deeply enough is
  **non-deterministic on identical input** — the same instability that produced the
  chunkless-response bug below. Treat 83% as a sample of one run, not a constant, and
  re-run before drawing a trend.

---

## The hard check — Tier C never appears as unqualified fact

Pass/fail, not a judgement call (§6d.3). Three mechanisms, because one of them could be
refactored into a bug:

1. **`renderTierC` is the only path.** Tier C text cannot be emitted without the marker
   `[Tier C — circulating on X · not a fact source]`, an attribution and a date.
2. **`assertQuarantine` sweeps the FINISHED text.** Every distinctive Tier C span
   (≥25 chars) must sit on a line carrying the marker, and must not appear in the
   summary at all.
3. **Fail-closed.** If the sweep fails, the whole orientation block is dropped and
   replaced with a statement that it was withheld. A briefing with no
   circulating-arguments section is survivable; one that states a tweet as fact is not.

**The check is proven to be able to fail.** The harness plants a Tier C claim restated as
bare fact and asserts the sweep *detects* it (`§0` of the run: 6 assertions), plus a
separate summary-leak case. A check that has never failed is not yet a check.

Also asserted every run: **flag OFF is byte-identical** to the pre-layer briefing (body
and summary compared directly, not reasoned about), and **the stage budget bounds the
stage** — forced with a 250ms budget, which must return in under 5s, report `failed`,
and give "abandoned at the … stage budget" as the reason rather than a provider failure.

---

## What the build learned (findings that outlived their bugs)

1. **Gemini refuses grounding and JSON mode together.** `tools:[{google_search:{}}]` +
   `responseMimeType:'application/json'` → `400 "Tool use with a response mime type:
   'application/json' is unsupported"`, with or without a schema. Hence the two-call
   shape: ground, then structure. The second call may cite **only by index into the
   grounding chunks Google actually returned**, so a model-invented URL cannot survive.
2. **xAI Live Search is dead.** `search_parameters` on `/v1/chat/completions` returns
   **HTTP 410** — "Live search is deprecated. Please switch to the Agent Tools API".
   The working shape is `POST /v1/responses` with `tools:[{type:'x_search'}]`, and
   unlike Gemini it *does* combine server-side tools with structured output
   (`text.format.json_schema`). Date bounds are per-tool: `from_date` / `to_date`.
3. **Model choice was measured, not assumed** (same question, same schema):

   | model | latency | cost | x_search calls | items |
   |-------|---------|------|----------------|-------|
   | grok-4.5 | 57.1s | $0.2322 | 18 | 8 |
   | **grok-4.3** | **21.2s** | **$0.0344** | 3 | 6 |
   | grok-4.20-0309-non-reasoning | 16.9s | $0.1084 | 12 | 7 |

   grok-4.3 is comparable output at **1/7th** of grok-4.5's cost. `max_tool_calls` is
   **not honoured** by grok-4.5 (18 calls against a cap of 4), so it is not a cost control.
4. **The grounded call was silently truncating.** Six sections of open prose hit
   `finishReason: MAX_TOKENS` on *every* call at 4096 output tokens, and a truncated
   grounded response sometimes returns **no `groundingMetadata` at all** — which
   discarded the entire Tier B half intermittently, leaving an all-Tier-C briefing (the
   exact thing the tier design exists to prevent). Compact bullets + per-section caps +
   an 8192 budget produced `STOP` and 28–37 chunks on every repeat. One retry, logged,
   covers the residual non-determinism.
5. ⚠ **Unrelated but found while probing: `grok-3-fast-beta` is no longer in
   `/v1/models`.** It is hardcoded as Lex's fallback model in
   `app/api/ai/[ideaId]/route.ts:561` and `app/api/ai/public/route.ts:148`. Reported,
   **not fixed** — out of this brief's lane.

---

## Open questions for Charlie

- **D1 — 30.8s.** The design note (§10.4) records a 1–3s latency tolerance for the
  briefing; this makes it ~31s of waiting on top of the corpus search, and the "wait for
  one complete briefing" shape was chosen against an estimate of 4–9s. If that is too
  long, the two-phase alternative (corpus briefing first, Tier B/C fills in) is a
  contained follow-up, not a rebuild.
- **D2 — $0.0763 per briefing.** Against ~$0.0003 for a query-expansion call. Fine at
  current volume; worth a per-idea cap before it is widened beyond Page 1.
- **D3 — widen or not.** The brief scoped this to the Page-1 briefing alone. The obvious
  next consumer is the rescission political layer (§6b), which the strategy names as
  this layer's first customer.
- **D4 — WX4's phased-commencement miss.** Worth one prompt iteration, or accepted as
  the boundary of what a general grounded pass returns?
