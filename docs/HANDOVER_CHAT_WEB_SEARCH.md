# Handover — chat web search, for the Lex conversation

**Written:** 2026-09-25 (SEARCH S24b). Why a note rather than an edit: idea-chat's files belong
to the Lex stream; this describes what SEARCH built so Lex can decide when and how to call it.

## What exists, and where

`general-chat.ts` (`lib/lex/general-chat.ts`) is the corpus-chat surface — the "no idea
attached" Lex thread. It already has a working chat-web-search layer, flag-gated and OFF by
default (`LEX_CHAT_WEB_SEARCH`, unmeasured until this sprint — see below). If idea-chat wants
the same capability, the pieces below are what to call; none of it is specific to
"no idea attached."

### The decision: should this turn search the web at all?

`decideWebSearch(question, corpusSummary)` in `general-chat.ts` — a structured Gemini call
(`SEARCH_DECISION_SCHEMA`/`SEARCH_DECISION_SYSTEM`) that returns 0–2 short search queries and a
reason. **The model decides whether to search; nothing else about this is a model choice** — the
search itself, the cap, and the ledger stamping are code. Not reusable as-is (it is a private
function), but the pattern is: ask for a structured decision, act on it deterministically. An
idea-chat caller would want its own version of `SEARCH_DECISION_SYSTEM` — the corpus context is
different (an idea's fields, not "the corpus retrieval already shown"), and the decision should
almost certainly stay narrow: "does this need something the corpus/idea cannot hold", never "let
me answer from memory instead of the idea's own material."

### The two-searches cap

`CHAT_WEB_SEARCH_MAX_PER_TURN = 2` (exported from `general-chat.ts`). Enforced in code — a
`.slice(0, CHAT_WEB_SEARCH_MAX_PER_TURN)` on the model's returned query list, never trusted from
the schema's `maxItems` alone (some vendors ignore it). Any caller adding chat web search
elsewhere should reuse this constant rather than inventing a second cap that can drift from it.

### The actual search: `webSearch()`

`lib/lex/orientation/web-search.ts` — the provider-neutral primitive. `webSearch({ query,
provider?, exclude?, stream, pass, label, userId, ideaId })` tries providers in order (default
`['xai', 'google']`), stops at the first one that completes (even with zero results — an honest
"found nothing" is not a failure), and returns `{ ok, provider, results, costUsd, ms, attempted,
reason? }`. Never throws.

**S24b added a third provider: Anthropic.** `WebSearchProvider` is now `'xai' | 'google' |
'anthropic'`. `DEFAULT_ORDER` is unchanged (`['xai', 'google']`) — Anthropic is built and
measured but not yet defaulted-to; see the comparison below before deciding whether idea-chat
should request it explicitly.

Every result carries a REAL, resolved URL — Google's grounding-redirect wrapper is resolved to
the actual page before this function returns it (`resolve-redirect.ts`), and both xAI's and
Anthropic's native search tools return direct URLs with no wrapper to begin with. Whatever
citation surface idea-chat builds, it can trust `result.url` as the address to show or link,
with no separate resolution step required.

### The [W] citation boundary — never merge with corpus [n]

`public-sources.ts`'s `markPublicSources()`/`publicSourcesBlock()` — a web result becomes a
`[W1]`, `[W2]`… source, in a numbering sequence that **never merges** with the corpus's `[n]`
sequence (decision 85). `general-chat.ts`'s `runChatWebSearches()` is the worked example: it
calls `webSearch()` up to twice, converts hits into `PublicSource` objects (title, publisher,
url, why), marks them, and hands the resulting block to the answer prompt as an additional,
clearly-delimited section. If idea-chat wires this in, reuse `markPublicSources`/
`publicSourcesBlock` directly rather than re-deriving the `[W]` convention — it is already the
platform's one answer to "how does a web source cite differently from a corpus one."

### The ledger

Every `webSearch()` call stamps a `LlmSpend` row through `recordGeminiUsage`/`recordXaiUsage`/
`recordAnthropicUsage` inside the relevant adapter — nothing extra to wire up. Pass `userId` (and
`ideaId`, if the caller has one) into `webSearch()`'s options so the row attributes correctly;
`general-chat.ts`'s admin-only caller passes `stream: 'admin'` because Charlie's own corpus-chat
spend should count in the platform total.

## The provider comparison (S24b, `docs/SEARCH_S24B_REPORT.md` item 3)

Ten questions, Google vs Anthropic (xai untested in this round — it is already the existing
default first try):

| | Google | Anthropic |
|---|---|---|
| Completion | 10/10 | 6/10 (see the report's reliability caveat — likely sandbox-specific, not confirmed on Vercel) |
| Avg cost / successful query | $0.0048 | $0.0349 (≈7×) |
| Avg time / successful query | 11.8s | 12.9s |
| Avg results / successful query | 7.6 | 7.3, but **zero duplication** vs a real defect found in Google's output (see report) |

**Recommendation stands as: Google stays the default.** Cheaper, completes reliably, fast
enough. Anthropic produced cleaner, more clearly-sourced UK institutional citations on the
questions it did answer, and is worth a second look once its completion rate is confirmed
outside CC's sandbox — but that is a future decision, not a change made in this sprint.
`DEFAULT_ORDER` was deliberately left as `['xai', 'google']`.

## What idea-chat would need to decide, not inherit

- Its own search-decision prompt (the corpus-chat one assumes "no idea, no on-topic
  constraint" — see `general-chat.ts`'s own header comment on why this surface exists
  separately from an idea's field chat).
- Whether idea-chat's web search should count toward a user's own AI rate limit (root
  `CLAUDE.md` §7: "AI 50/hr per user") the way idea-bound Lex calls already do — corpus chat is
  admin-only today and does not need this.
- Whether `[W]` sources should be persisted anywhere idea-bound (an `EvidenceItem`, a
  `PublicSource` table row) rather than living only in the chat transcript, the way corpus
  chat's do (corpus chat is explicitly stateless — "the transcript lives in the browser tab and
  dies with it").
