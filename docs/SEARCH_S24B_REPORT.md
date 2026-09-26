# SEARCH — S24b

**Written:** 2026-09-25. Continues `docs/SEARCH_S24_REPORT.md` in the same sprint window.

---

## Item 1 — Grok key

`.env` confirmed git-ignored (both root and `scrutinise-web/`, matched by pattern, neither
tracked by git).

`GROK_API_KEY` set on Railway `build-worker` via `scripts/s24b-set-grok-key.ts` and redeployed
via `scripts/s24b-deploy-grok-key.ts` (`serviceInstanceDeployV2` with an explicit commit sha,
per CLAUDE.md's Railway Operations section — never the two-argument form). Confirmed live by
`meta.commitHash` on the settled deployment, not by status alone: deployment `486ed626`,
`SUCCESS`, `sha=a7124ce90b9e` — matching local HEAD at the time.

Added `xaiKey: Boolean(process.env.GROK_API_KEY?.trim())` to `/api/health`, beside `geminiKey`
(`app/api/health/route.ts`). Uncommitted, per the no-mid-sprint-git rule — ships in the
end-of-sprint commit.

**Blocked on Charlie — orientation and build-smart's xAI panel slot run in VERCEL functions,
not on `build-worker`.** `build-worker` only runs `build.ts`; the Page-1 orientation stage
(`lib/lex/orientation/*`) and `general-chat.ts`'s chat web search both execute inside Vercel's
serverless functions, which read Vercel's own environment. Vercel env vars are still
SAML-blocked from every session (CLAUDE.md §19) — `GROK_API_KEY` cannot be set there from here.
**Once Charlie adds it in the Vercel dashboard and redeploys**, `/api/health`'s `xaiKey` will
read `true` in production and the two proofs the brief asks for become possible:

1. One real xAI call through `callModelJson` — the smart-build panel's xai branch, or a
   one-off script run against the deployed function.
2. One `x_search` call returning posts, with a `LlmSpend` ledger row (`x-orientation.ts` already
   calls `recordXaiUsage` on every call — this is wiring already built, S21).

## Item 2 — Orientation engagement

**Blocked on the same Vercel prerequisite as item 1.** Confirmed via production
`GET /api/health`: `LEX_WEB_ORIENTATION` is already `true` — the layer is live — but its X/Tier-C
half (`x-orientation.ts`) needs `GROK_API_KEY` in Vercel, which is not yet confirmed present
there. Once it is, the outstanding proof is: one real idea's Page-1 briefing → one orientation
`LlmSpend` row dated today, and a web-tier ([W]) source appearing in the rendered briefing —
reported as two separate halves (Google web tier, X tier) with cost and time each, exactly as
`calls: CallOutcome[]` in `orientation/index.ts` already records per-call.

## Item 3 — Chat web search comparison

### Correction to the brief's premise (CLAUDE.md §0)

The brief assumed "the Anthropic key already works in production; only CC's sandbox is
blocked," and proposed a temporary admin route or Railway job to run the comparison from
production instead. **Tested directly and found false for this session:** a raw `curl` from
this machine reached `api.anthropic.com`, `api.x.ai` and Google's API with proper auth
responses (401/403 — not a network-level block), and an authenticated call with Anthropic's
native `web_search` tool succeeded outright (HTTP 200, real UK citations). No admin route was
built or needed — the comparison ran as a script against the exact `webSearch()` function
`general-chat.ts` calls, so the numbers below are what a real deployment would see.

### The Anthropic adapter (new — did not exist before this session)

`WebSearchProvider` only covered `xai`/`google`; Anthropic's provider-neutral adapter did not
exist. Built `searchAnthropic()` in `lib/lex/orientation/web-search.ts`, verified live rather
than to documentation alone:

- `tools: [web_search_20250305, emit_results]` with `tool_choice: 'auto'` — the model runs the
  server-side search, then calls the client-side `emit_results` tool with structured output.
  `tool_choice` forced directly onto `emit_results` was **not** tried and may reject the server
  tool outright; `auto` is what is proven to work.
- Anthropic's URLs are already real and direct — no redirect-resolution step needed (unlike
  Google's `vertexaisearch.cloud.google.com/grounding-api-redirect/...` wrapper).
- Citation defence matches the xai adapter: only a URL appearing in the tool's own
  `web_search_tool_result` blocks is trusted; a URL the model merely typed into `emit_results`
  is dropped.
- New ledger function `recordAnthropicUsage()` (`spend-ledger.ts`) — Anthropic's `usage` block
  has no single all-in cost the way xAI's does, so it composes the rate-card token cost with the
  tool's own fee ($10/1,000 `web_search_requests`, read from `usage.server_tool_use`). Where the
  model has no rate on file, `actualUsd` stays `null` rather than showing a partial total dressed
  as a whole one — same rule `priceEntry` already applies everywhere else.

### A measured, load-bearing reliability fix

The first full run failed 5 of 10 Anthropic questions with a bare `TypeError: fetch failed` —
fast failures (60–150ms, not a timeout). Google's adapter, same script, same process, its own
back-to-back calls, never failed once. Diagnosis, in order:

1. An immediate retry re-failed 5/5 — ruled out "just try again."
2. A retry with an 800ms delay before it (and `Connection: close`) recovered most but not all —
   final run still showed 4/10 failures even with the retry in place.

**This is CLAUDE.md's "genuinely transient, retry is appropriate" case** (network-level, not a
parse failure), and the delay is now in the adapter with a comment naming why: an immediate
retry likely reuses the same bad pooled keep-alive socket. It is shipped anyway, even though it
did not fully close the gap, because a Vercel serverless cold start is the same shape — "the
first fetch to this host in a fresh process" — so the fix is not sandbox-only speculation.

**Residual caveat, stated plainly rather than smoothed over:** even with the retry, this
session's network measured a ~40% Anthropic failure rate under sustained repeated calls, while
isolated one-off calls (plain `curl`) succeeded every time. This looks like a property of this
specific sandbox's connection to `api.anthropic.com` under load, not a property of Anthropic's
service or of Vercel's network — but that is inferred, not verified from here (CLAUDE.md §19: a
fact that cannot be read must be labelled as inferred). **If Anthropic is chosen, Charlie should
run the same comparison script from a Vercel function or Railway job once, specifically to
confirm the completion rate holds outside this sandbox before relying on it.**

### The ten-question run

Ten questions matching `general-chat.ts`'s own `SEARCH_DECISION_SYSTEM` criteria (current
figures, a recent event, comparative foreign practice, a live political row), Google and
Anthropic only — xai is the existing default and out of this brief's scope; OpenAI excluded
per the brief (no key supplied). Full JSON in the session's run output;
`scripts/s24b-web-search-comparison.ts` reproduces it.

| | Google | Anthropic |
|---|---|---|
| Completion | 10/10 | 6/10 (see caveat above) |
| Avg cost / query | $0.0048 | $0.0035 per attempt, **$0.0349 per successful query** |
| Avg time / query | 11.8s | 6.8s per attempt, **12.9s per successful query** |
| Avg raw results / successful query | 7.6 | 7.3 |

**A quality defect found during this measurement, not before it.** On one question ("How does
Germany regulate short-term rental platforms like Airbnb?"), Google's structuring pass returned
**seven different real URLs carrying the exact identical sentence, verbatim**. That is not seven
sources corroborating a fact — it is one grounded-note sentence copy-pasted across every source
slot, and it would read to a reviewer as seven citations when it is actually zero independent
ones. The same pattern (one real page cited more than once) appears elsewhere in Google's output
too, but usually with a **different** extracted fact each time (e.g. four different Irish
minimum-wage age bands, all correctly sourced to the same page) — that shape is legitimate;
the Germany case is not, because the text repeats rather than varies. **Anthropic's output
carried no instance of this pattern across any of its six successful runs** — every result was a
distinct URL with distinct, on-topic text.

**Recommendation: keep Google as the default for chat web search.** It completed 10/10, costs
roughly 7× less per query, and answers faster. The duplicate-snippet defect above is real and
worth a small follow-up fix in `searchGoogle`'s structuring pass (likely: number each grounded
bullet and require the structuring call to use each source index at most once, or explicitly
forbid repeating identical text against multiple indices) — **not built here**, flagged for
whoever picks up chat web search next. **Anthropic is the stronger per-source QUALITY result**
(real named UK institutions — `bills.parliament.uk`, `gov.uk`, the Law Society, NRLA, Shelter —
turned up more often, and with zero duplication) and is worth reconsidering as a secondary or
fallback provider once (a) its completion rate is confirmed outside this sandbox and (b) the
~7× cost premium is judged worth it for a subset of queries. `DEFAULT_ORDER` in
`web-search.ts` is deliberately left unchanged (`['xai', 'google']`) — this is a
recommendation, not an applied change; adding `'anthropic'` to it is one line once the above two
conditions are settled.

### A second finding, from running the guard suite rather than the comparison

`npm run check:llm-guards` (CLAUDE.md §18) failed after the Anthropic adapter was added:
`web-search.ts` has carried a JSON-mode call site (`responseMimeType: 'application/json'`, in
the pre-existing `callGeminiRaw`) since it was written, and it never checked `finishReason` —
**a pre-existing gap, not something this session introduced**, just one the guard suite had not
been run against this file before. A truncated grounded note would have read as merely thin; a
truncated structured pass would have surfaced as `JSON.parse` failing on the caller's side and
read as a serialiser bug, exactly the failure class §18 exists to name. Fixed by wiring in the
shared `geminiFinishProblem()` helper (`gemini-finish.ts`) before either caller reads the body —
`check:llm-guards` now passes 9/9 (was 8/9), `check:model-registry` still 28/28, and a smoke
test confirmed no regression on a working Google call.

## Item 4 — Real addresses in [W] citations, chat web search included

**Already satisfied, structurally, with no new work needed.** `general-chat.ts`'s
`runChatWebSearches` calls the exact same `webSearch()` function orientation calls, so S24's
redirect-resolution fix (`resolve-redirect.ts`, applied inside `searchGoogle`) and the new
Anthropic adapter's already-direct URLs both apply to chat web search automatically — there is
only one code path, not two to keep in sync. The residual gap is the same one S24 already
reported for orientation: resolution occasionally fails for a live wrapper URL (2 instances in
this session's 10-question run, both logged as `[resolve-redirect] could not resolve … fetch
failed`), and the adapter falls back to the raw redirect URL rather than dropping the result.
Pre-existing, not new, not fixed here.

## Item 5 — Handover note

Written to `docs/HANDOVER_CHAT_WEB_SEARCH.md`.

## Item 6 — S23 step 2 (amends/repeals)

Not started — waits for the graphs conversation's function, per the brief.

## Item 7 — Git worktree per stream

Not started, per the brief's own instruction ("do not start while any stream has uncommitted
work") — this session alone leaves a large uncommitted set (this sprint's own files, plus
pre-existing untracked files from other streams visible in `git status` at session start).
