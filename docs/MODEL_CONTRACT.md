# MODEL CONTRACT — which models we can call, what they cost, and what each is for

**Status:** STANDING REFERENCE. ⚠ **Whoever changes which models we call updates this file in the
same commit.** A drifted contract is worse than none.
**Last verified:** 17 August 2026 — **every key below was called once, for real**, by
`scrutinise-web/scripts/probe-model-access.ts`. Re-run it rather than trusting this page.
**Owner:** CC-Search (this sprint). **Audience:** anyone about to hardcode a model string.

---

## 1. Which keys exist, and which actually work

⚠ **PRESENCE, AUTHENTICATION AND AUTHORISATION ARE REPORTED SEPARATELY, and that is the point.**
This project lost a session to `VERCEL_TOKEN`: it returned 200 on `/v2/user` and then 403 with
`"saml": true` on every project endpoint. **A key in an environment file is not a working
credential**, and one boolean cannot tell those apart.

| provider | env var | key present | model list | **one real completion** | verdict |
|---|---|:--:|:--:|:--:|---|
| **Google Gemini** | `GEMINI_API_KEY` | ✓ 39 chars | HTTP 200 | **HTTP 200** on `gemini-2.5-flash` → `"ok"` | ✅ **works** |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | ✓ 108 chars | HTTP 200, 5 ids | **HTTP 200** on `claude-opus-5` → `"ok"` | ✅ **works** |
| **xAI Grok** | `GROK_API_KEY` | ✓ 84 chars | HTTP 200, 7 ids | **HTTP 200** on `grok-4.20-0309-non-reasoning` → `"ok"` | ✅ **works** |
| **OpenAI** | `OPENAI_API_KEY` | ✗ **absent** | — | — | ❌ **no key on this machine** |
| Voyage (embeddings) | `VOYAGE_API_KEY` | ✓ 46 chars | HTTP 200 | not attempted — not a chat model | ✅ key valid |
| Together | `TOGETHER_API_KEY` | ✓ 50 chars | HTTP 200 | not attempted | ✅ key valid |

▶ **CHARLIE: OpenAI is named in the brief as available and there is no key in
`scrutinise-web/.env`.** Nothing here can reach it. If it is meant to be usable, the key needs to
land in the environment; if it is not, this row should say so permanently.

⚠ **"not attempted" is its own verdict.** An embeddings key that lists successfully has not been
shown to complete anything, and labelling it "lists but will not call" — as my first draft of the
probe did — would have invented a failure.

---

## 2. Which models are reachable, with their exact strings

**Read off `/v1/models` on 17 Aug 2026. A model id from memory is the commonest reason a "dead key"
turns out to be a dead model name.**

**Google Gemini** — `gemini-2.5-flash`, `gemini-2.5-pro`
⚠ `gemini-2.5-flash-lite` is priced in `build-cost.ts` but **did not appear in the list response**;
treat it as unconfirmed until a call succeeds.

**Anthropic Claude** — `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`, `claude-opus-4-8`,
`claude-opus-4-7`
⚠ **`claude-haiku-4-5-20251001` — the fallback `docs/CLAUDE.md` §6 names for `compile.ts` — is NOT in
the list.** Either the account no longer has it or the id has moved. **A configured fallback that
does not exist is worse than none**, because it only fails when the primary already has.

**xAI Grok** — `grok-4.20-0309-non-reasoning`, `grok-4.20-0309-reasoning`,
`grok-4.20-multi-agent-0309`, `grok-4.3`, `grok-4.5`, `grok-4.6`, `grok-build-0.1`
⚠ **`grok-3-fast-beta` — hardcoded as Lex's fallback in two production routes — is NOT in the list**,
which the orientation sprint flagged on 6 Aug and which is still true.

---

## 3. Price per million tokens

| model | in (USD/M) | out (USD/M) | source |
|---|---:|---:|---|
| `gemini-2.5-flash` | 0.30 | 2.50 | Google published pricing, recorded 2026-08-17 in `build-cost.ts` |
| `gemini-2.5-flash-lite` | 0.10 | 0.40 | same |
| `gemini-2.5-pro` | 1.25 | 10.00 | same |
| **Anthropic — every model** | ⚠ **not recorded** | ⚠ **not recorded** | — |
| **xAI — every model** | ⚠ **not recorded** | ⚠ **not recorded** | — |

⚠⚠ **THE MISSING RATES ARE LEFT MISSING ON PURPOSE.** `build-cost.ts`'s rule is that **a model we
cannot price costs `null`, not zero** — zero is a claim, and it is the claim most likely to be
believed, because a build that ran four calls and reports "£0.00" also tells the cost ceiling
nothing. I will not fill these in from recollection.

▶ **What is needed:** the two published price pages, read by someone who can see them, pasted into
`LEX_BUILD_RATES` or into `build-cost.ts`'s defaults. **Until then, any pass on Claude or Grok
reports UNPRICED and the ceiling cannot hold on it.**

**What is measured rather than listed** — per-call costs for the X orientation pass, same question,
same schema, 6 Aug 2026:

| model | latency | cost per call | tool calls |
|---|---:|---:|---:|
| `grok-4.5` | 57.1s | $0.2322 | 18 |
| `grok-4.3` | 21.2s | **$0.0344** | 3 |
| `grok-4.20-0309-non-reasoning` | 16.9s | $0.1084 | 12 |

`grok-4.3` gives comparable output for **one seventh** of `grok-4.5`'s cost, which is why it is the
default. ⚠ `max_tool_calls` was **not honoured** by `grok-4.5` (18 calls against a cap of 4), so it
is not relied on as a cost control.

---

## 4. What each is currently used for — confirmed, not repeated

| where | model | how it is set |
|---|---|---|
| Lex chat, field machine, query expansion, query router, general chat, the Deepening (client, sift, adversarial), feedback | `gemini-2.5-flash` | `LEX_*_MODEL` env vars falling back to `QUERY_EXPANSION_MODEL`, then a hardcoded default |
| Build passes (25-A) | `gemini-2.5-flash` | `build-llm.ts` — Gemini only, no other provider wired |
| Web orientation | `gemini-2.5-flash` | `ORIENTATION_WEB_MODEL` |
| X / social orientation | `grok-4.3` | `ORIENTATION_X_MODEL` |
| Graph position extraction | `gemini-2.5-flash` | `GRAPH_2D3_MODEL` |
| Embeddings (corpus vectors) | `gemini-embedding-001` | `scripts/ingest/search/*` |
| ⚠ `compile.ts` fallback | `claude-haiku-4-5-20251001` | **hardcoded, and the model is not in the account's list** |
| ⚠ Two Lex API routes' fallback | `grok-3-fast-beta` | **hardcoded, and the model is not in the account's list** |

**So: Gemini Flash does almost everything, Grok does the social pass, and both configured Claude and
Grok fallbacks point at model ids the accounts do not list.** That is the confirmation the brief
asked for, and it corrects the folk memory in two places.

---

## 5. What each is plausibly best at — ⚠ THIS IS AN OPINION

**Labelled as one, because the four-model comparison showed the variance came from how the question
was framed, not from the badge on the model.** Nothing below is a measurement, and none of it should
be quoted as one.

- **Gemini 2.5 Flash** — the right default for high-volume structured extraction: cheap, fast, honours
  `responseSchema`, and every guard in this codebase is written against its failure modes.
- **Gemini 2.5 Pro** — worth trying where Flash's judgement is the binding constraint rather than its
  throughput.
- **Claude (Opus 5 / Sonnet 5)** — plausibly the strongest at *adversarial reading*: finding the
  weakness in an argument, and declining to assert. Untested here. Given 2D-4's finding that our
  position extractor's failure is **over-attribution rather than misreading**, a model that declines
  more readily is the one worth measuring next.
- **Grok** — the only one with live social retrieval, which is why it owns that pass. `grok-4.3` over
  `grok-4.5` on measured cost, not on reputation.
- **⚠ Nobody should pick a model on this section alone.** Any adoption should be an A/B on a gold set,
  the way expansion, the router and the reranker each were — and the reranker was *refused* on that
  evidence.

---

## 6. Model choice per call is now configurable

25-A §7 asks for it. **It is a lookup where a string was hardcoded, not a rewrite.**

`scrutinise-web/lib/lex/model-registry.ts` resolves a model for a named PASS:

```ts
import { modelFor } from '@/lib/lex/model-registry'
const model = modelFor('deepening.adversarial')   // env override → registry default
```

- One place. Every pass name and its default is listed in that file.
- Override any single pass with `LEX_MODEL__<PASS>` (dots become double underscores):
  `LEX_MODEL__DEEPENING__ADVERSARIAL=claude-opus-5`
- ⚠ **An unknown model string is refused at resolve time, not at call time.** A typo in an env var
  otherwise surfaces as a provider 404 inside one pass, hours later, in a log nobody reads.
- ⚠ **The registry does not make a provider reachable.** Setting a pass to a Claude model only works
  once a Claude *client* exists; `build-llm.ts` speaks Gemini only. `modelFor` returns the string and
  `providerFor` names the provider so a caller can fail loudly rather than send a Claude id to
  Google.

---

## How to re-verify this document

```
cd scrutinise-web && npx tsx --env-file=.env scripts/probe-model-access.ts
npm run check:model-registry
```

The first calls every key once and prints the table in §1. The second asserts that every pass name
resolves, that no default names a model absent from the reachable list recorded here, and that the
two known-stale hardcoded fallbacks are still flagged.
