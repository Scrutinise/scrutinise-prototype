# MODEL REVIEW — 30 September 2026 (report only; nothing in the product was changed)

Prices are USD per million tokens (input / output), read from each provider's own pricing page on 30 Sep 2026
(Anthropic, OpenAI, Google, xAI docs). Model ids were confirmed against each provider's `/models` list where the
network allowed. Measurements are one-shot runs on the **real** context of Charlie's idea (452c5ade), not estimates.
Measurement spend ≈ £2; ledger rows written by `runFourDrafts` were relabelled `model-review.*`; direct-fetch probes
were not ledgered.

## 1. The consolidation panel — top model per provider

| Provider | Top model (id) | In / out | Cached read | Notes |
|---|---|---|---|---|
| Anthropic | **Claude Fable 5.1** `claude-fable-5-1` | $10 / $50 | $0.25 | Mythos 5.1 is same price, limited access. Practical premium: **Opus 5.5** $4/$20, cache read $0.20 |
| OpenAI | **gpt-6-astra** | $10 / $50 | $1.00 | flagship per OpenAI's table. `gpt-6.1-sol` $2/$10 is a newer mid tier; `gpt-6-luna` $0.10/$0.50 is the budget tier |
| Google | **gemini-3.1-pro-preview** | $2 / $12 (≤200k) | $0.20 | no GA Gemini 3.x Pro in the account list — this is a *preview*. Flash line: 3.5–3.8 |
| xAI | **grok-4.7** | $2 / $6 | $0.50 | already on the panel |

Current panel: gemini-2.5-pro, claude-opus-5, grok-4.7, gpt-6-luna.

**Measured, one draft each, same context:**

| Model | tokens in / out | cost | time |
|---|---|---|---|
| claude-fable-5-1 | 2,559 / 2,652 | 12.50p | 44 s |
| gpt-6-astra | 1,271 / 583 | 3.31p | 22 s |
| gemini-3.1-pro-preview | 1,221 / 1,066 | 1.20p | 11 s |
| grok-4.7 | 2,528 / 5,798 | 3.01p | 75 s |
| *(claude-opus-5-5)* | 2,559 / 1,846 | 3.73p | 23 s |
| *(gpt-6.1-sol)* | 1,271 / 626 | 0.70p | 21 s |
| *(gemini-3.8-flash)* | 1,221 / 180 | 0.25p (Jan-27 rate) | 2 s |

**One Consolidate press (four drafts + judge):**
- **Current panel, measured on 28 Sep: 10.44p.**
- **Top-of-range panel (Fable/Astra/3.1 Pro/Grok 4.7) + Opus 5.5 judge: 20.02p + 2.39p = 22.4p (2.1×).**
- **Price-matched premium panel (Opus 5.5 / gpt-6.1-sol / 3.1 Pro / Grok 4.7) + Opus 5.5 judge: 8.64p + 2.39p ≈ 11.0p (1.05×).**
- "Write the final version" adds one redraft by the favourite plus one judge call (≈ one draft + 2.4p; ≈15p if Fable wins).

⚠ The like-for-like question has two defensible answers: **price-matched** ($2–$4 tier: Opus 5.5, gpt-6.1-sol, Gemini 3.1 Pro,
Grok 4.7) or **capability-top** ($10 tier: Fable, Astra). Current panel mixes a $0.10 model with $5 and $2 ones — neither.

**Compatibility findings (would break if switched, not changed):**
- `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-fable-5-1` all return **400 "tool_choice: type tool/any not supported"** — our Anthropic
  client forces a tool. Needs `tool_choice: auto` (Fable then answered in plain text in a probe) or `output_config.format`.
- Behaviour, not just price: Fable and Opus 5.5 ignore "statement in one or two sentences" (Opus 5.5's is six sentences and cross-cites
  [28],[29]); the mechanical compound flag fired on 5 of 7 new drafts (not on gpt-6-astra / gpt-6.1-sol).

## 2. Generation check

**Builds are not all Flash.** 34 builds in the ledger (rows carrying a buildId, some inferred): **29.8p/build, 220k input tokens, 26 calls.**
`gemini-2.5-pro` is 216 calls but **607p of 1,011p (60%)** — build.draft on Pro (186 calls, avg 4.3k in / 3.0k out, £5.22) and the adversarial pass.
Input is only 26.5% of build spend; **output/thinking is 73.5%**.

Projected cost per build, IDENTICAL token volumes (assumption — 3.x thinking behaviour on real build prompts NOT measured):

| All calls on… | p/build | × today |
|---|---|---|
| gemini-2.5-flash | 16.3 | 0.55 |
| gemini-3.8-flash, intro rate (to 31 Dec 2026) | 29.7 | 1.00 |
| **gemini-3.8-flash, Jan-2027 rate (use this for user pricing)** | **59.4** | **2.00** |
| gemini-3.5-flash ($1.50/$9, no promo) | 66.1 | 2.22 |
| gemini-3.1-pro-preview | 88.1 | 2.96 |
| claude-sonnet-5-5 | 79.2 | 2.66 |
| claude-opus-5-5 | 158.5 | 5.33 |

**Quality was NOT measured for builds** (that needs a shadow run of real builds on both models; I did not create builds).
**Consolidation/judge, measured (Rumelt yardstick + agreement with the current judge):**
- Judge on the four 28-Sep drafts. Opus 5 (current): 1.92p, 12.7 s. **Opus 5.5: 2.25p (+17%), 13.7 s, cause-set agreement with Opus 5 = 0.80.**
  Gemini 3.1 Pro: 1.65p, 0.79. **Gemini 3.8 Flash: 0.28p, 2.1 s, 0.63.**
- ⚠ **The current judge is not stable run to run**: Opus 5 today marked the gemini-2.5-pro draft *does not answer the obstacle*; its own
  28 Sep run marked the same draft *answers* (all four true). One verdict flipped between two runs of the same model on the same input.
- Opus 5.5 vs Opus 5 in practice costs MORE, not less, despite the 20% lower list price: it writes more (draft 1,846 vs 1,060 out tokens; 3.73p vs 3.14p).
- 3.8 Flash draft: 0.25p, 2 s, 180 output tokens — a plausible but thin one-sentence policy (SRO regime), compound-flagged.

## 3. Gemini 3.x Flash introductory pricing — CONFIRMED

Google's pricing page, 30 Sep: **Gemini 3.6 / 3.7 / 3.8 Flash: $0.75 in / $3.75 out (cache $0.075) through 31 Dec 2026; $1.50 / $7.50
(cache $0.15) from 1 Jan 2027 — exactly double.** Gemini 3.5 Flash is $1.50/$9.00 with no promotion. Every "use for pricing" figure in this
review uses the January 2027 rate. The rate table has no effective-date field, so today it would silently keep the intro rate past midnight
on 31 Dec — proposal below.

## 4. Prompt caching

**We are not using it, and we do not see it.** `cache_control`, `cachedContent`, `prompt_cache`, `cached_tokens`,
`cachedContentTokenCount`: zero references anywhere in `lib/` or `app/`. The ledger never reads a cache field, so where a provider caches
automatically the discount is invisible and our cost is overstated.

Measured on a 7.3–7.8k-token stable prefix, repeated:
| Provider | Behaviour | Measured |
|---|---|---|
| OpenAI (gpt-6-luna) | automatic | 2nd call **7,263 of 7,278 tokens cached (99.8%)**; cached input $0.01 vs $0.10 |
| xAI (grok-4.7) | automatic | 1,152 of 1,328 cached in an earlier probe; billed cost 36% below list estimate |
| Gemini 2.5 Flash **and** 3.8 Flash | "implicit" | **0 cached tokens on 3 back-to-back identical calls, both models** — an explicit `cachedContents` object is needed (read $0.03 / $0.15) |
| Anthropic | explicit `cache_control` only | on the real chat prompt: 5,893 of 11,602 tokens read from cache per turn; 2.35p → 1.61p (−31%) |

**Where repeated context is resent:**
- **Chat turn:** the system prompt (≈26k chars ≈ 6.6k tokens) is ~80% of input tokens every turn — method blocks, accepted-fields summary, facts
  block, numbered candidates, product facts — plus 20 history messages. It is not perfectly stable (question-turn blocks and the facts block change),
  so a cache prefix breaks partway: Anthropic read 51%.
- **Build pass:** 26 calls and 220k input tokens per build; the kernel and findings ride on every pass; `deepening.sift` averages 18.6k input tokens ×
  151 calls, `build-research.gather` 9.6k × 172 (corpus excerpts differ per call, so only the instruction/kernel prefix is cacheable).

**What caching would save (MODELLED — the cacheable share is an assumption: 60% of input, 90% read discount):**
- Chat turn on gemini-2.5-flash: input is 79% of the replayed turn's cost. **−0.10p of 0.24p (−42%)** on the replay; −0.085p of 0.345p (−25%) on the real
  ledger mean. On Sonnet 5.5, measured −31%.
- Build: input is only 26.5% of today's spend → **≈ −14% (≈ −4.3p of 29.8p)**. On gemini-3.8-flash at Jan-2027 rates input is 44% of spend →
  **≈ −24% (≈ −14p of 59p)**: caching matters more on the new generation.

**Ledger model (proposed, NOT built — needs a migration):** add `tokensCached` and `tokensCacheWrite` to `LlmSpend`; read
Gemini `cachedContentTokenCount`, OpenAI `prompt_tokens_details.cached_tokens`, Anthropic `cache_read_input_tokens` / `cache_creation_input_tokens`,
xAI `input_tokens_details.cached_tokens`; add per-model `cachedInPerM` and a cache-write multiplier (Anthropic 1.25×/2×) to the rate table; price
uncached + cached + write separately. Also: rate rows need an **effective date** (Gemini 3.x Flash flips on 1 Jan 2027).

## 5. Lex chat — Claude Sonnet 5.5 against the current model, measured

Six real turns from Charlie's idea, replayed with the real system prompt (≈26k chars) and the real preceding 20 messages, current state. Excludes
the tool-decider call (~0.09p) and per-turn material/feedback blocks.

| Model / config | tokens in / out | cost per turn | time |
|---|---|---|---|
| **gemini-2.5-flash (current)** | 7,876 / 258 | **0.238p** | 2.1 s |
| *real turns from the ledger, n=24* | 6,616 / 954 | *0.345p (+~0.09p decider ≈ 0.43p)* | — |
| gemini-3.8-flash, Jan-2027 rate | 7,876 / 290 | 1.105p (4.6×); intro 0.55p (2.3×) | 2.9 s |
| claude-sonnet-5-5, default (adaptive thinking) | 11,590 / 1,941 | 3.36p (14×) | 17 s |
| claude-sonnet-5-5, thinking off | 11,602 / 655 | 2.35p (9.9×) | 7.5 s |
| claude-sonnet-5-5, thinking off + prompt cache | 11,602 / 636 (5,893 cached) | 1.61p (6.8×) | 7.1 s |

- Sonnet's tokenizer counts the same text as **47–61% more input tokens** than Gemini (Anthropic states ~30% for the newer tokenizer).
- ⚠ **It cannot be dropped in.** Forced `tool_choice` → 400; constrained decoding (`output_config.format`) rejects our chat schema (**30 optional
  fields; Anthropic's limit is 24**); with `tool_choice: auto` it used the tool on 2 of 6 turns; asked for JSON in words, **0 of 6** replies were our
  JSON envelope — it answers in prose (good prose: "It isn't anywhere, Charlie, and that was my mistake"). A migration means redesigning the response
  schema, not swapping a model id.

## Decisions needed (nothing done)
1. Which "fair panel": price-matched (≈11p/press) or capability-top (≈22p/press)? Either needs the Anthropic client changed (no forced tool).
2. Whether to build cache modelling in the ledger (migration) and the rate-table effective dates — recommended before any user price is set.
3. Whether to shadow-run builds on 3.8 Flash to measure quality and real token volume before any move; on Jan-2027 pricing it is 2× today's
   build cost at equal tokens, so the case for moving builds is quality, not price.
