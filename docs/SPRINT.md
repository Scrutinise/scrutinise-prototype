# SPRINT — SEARCH S26 (2026-09-27)

> Handed over in chat, written to disk per the sprint-brief protocol (`docs/CLAUDE.md` §12).
> Continues `docs/SEARCH_S25_REPORT.md` — S25 confirmed delivered before this sprint starts:
> production `/api/health` reports commit `98c239872705a60e05fb6ea73730ddf4333ea815`, matching
> local `HEAD` exactly (2026-09-27).
> ⚠ `docs/CHANGE_LOG.md` has no S25 entry — commit `bd58d31` claimed "S25 report, CHANGE_LOG and
> handoff_summary" but its diff only touched `SEARCH_S25_REPORT.md`, `SPRINT.md` and
> `handoff_summary.md`. Backfill this sprint.

## Why

Charlie's design (26 Sep): research starts from the user's own words, which rarely match
statutory language, and a single provider can miss what others know. Three rounds —
orientation, corpus search seeded by its vocabulary, then a focused four-provider check — aim
to ensure Lex's kernel misses no significant issue. Search builds the stages; Lex wires them
into the build.

## Scope — the three stages

**Stage 1 — orientation v2.** Gemini web search plus X search (30-post cap), given the user's
full input. Output, as structured data: debates, issues, objections, each with sources; plus
vocabulary — key terms, statutory terms if found, people, organisations, jurisdictions. Web and
X results keep [W] labelling.

**Stage 2 — corpus search seeded by stage 1.** Pass the vocabulary into the router alongside
the user's own words, so each stream's query uses both. Measure on the gold set with and
without the vocabulary: questions with the right document in the top 20. Record the prediction
first.

**Stage 3 — four-model check.** Gemini, Anthropic (Haiku), OpenAI (Luna), xAI (with X search,
30 posts). Each receives the problem and a compact summary of stages 1–2, and Charlie's
question: what has been tried, failed, succeeded or caused controversy anywhere; what
legislation, debates and proposals have dominated; what each would recommend; who has been most
prominent and how they fared — with an explicit instruction to list what the summary lacks. Run
the four in parallel.

**Merge.** One list of points, each labelled with the providers that raised it. Recommendations
labelled as model suggestions, never evidence. Any claim about a named person without a source
link is dropped; MPs and peers cross-checked against the people graph. Fetched content goes
through the shared isolation guard.

**Cost cap** $2 per build, checked before each new search round. On reaching it: stop new
searches, keep results, record "partial: N of 4 providers", email Charlie. Every call writes to
the ledger with the build's user and idea.

**Measure on five real ideas:** cost and time per stage, points found only in stage 3, points
found by only one provider.

**Handover note** for the Lex conversation, `docs/HANDOVER_RESEARCH_SEQUENCE.md`: the three
functions, their inputs and outputs, where each belongs in the build, and what the kernel
drafting receives. Lex decides the wiring.

**Report** in `docs/SEARCH_S26_REPORT.md`.

## Amendment 1 (Charlie, 26 Sep) — what stages 1 and 3 produce

- Output is **arguments, not facts**: each point records the argument, which side makes it, and
  a source where one exists. Lex presents arguments without endorsing them; facts come from the
  corpus.
- **Keep every argument actually being made, however weak.** Discard only noise (abuse,
  sarcasm, pile-ons, posts with no argument) and ultra-minority/extremist views unless
  genuinely relevant. Log every exclusion internally with its reason.
- Sources on everything except summaries of widely held views; claims about named people always
  sourced, otherwise dropped.
- Provider labels ("found by Gemini, xAI") are stored for our analysis and shown in admin
  diagnostics, not to users.
- Superseded on disputed-claim wording by Amendment 2 below; "claims about named people need a
  source… or dropped" stands, as does "a model's recommendation is presented as a suggestion,
  never as evidence."

## Amendment 2 (Charlie, 26 Sep) — disputed claims (replaces Amendment 1's warning-label point)

No warning labels. Two neutral forms only:

- "Disputed by [side], e.g. in [debate/source]" — where the corpus shows the dispute.
- "We haven't been able to find the evidence behind that" — where Lex judges a claim unlikely
  and finds no supporting evidence.

Use sparingly, chiefly on highly emotional arguments. Same test for both sides; count per side
in build diagnostics only, not shown to users. No pause after stage 1: users add information at
any later stage.

## Amendment 3 — reusable stages

Stages 2 and 3 must accept their seed as a parameter: stage 2 a list of terms (not only stage
1's output), stage 3 an optional "angle" string that narrows the question ("how does the
private sector handle this"). Why: the Lex conversation is likely to build an update pass that
runs these on new material or a user-named angle without a full rebuild. Note this in the
handover document.

## Corrections to the architecture survey (Charlie, 27 Sep) — read before building

1. **The people graph already exists**, built by the graphs stream (positions, signals,
   estimates, EDM signatures — see GRAPH reports and `handoff_summary.md` GRAPH THREAD). Read
   its tables for the MP/peer cross-check; do not build a new people module. Anything missing
   goes to the graphs stream as a request, not built here.
2. **`OPENAI_API_KEY` is live** in `.env` and Vercel. Item 6 (Luna) is a **live test**: run the
   adapter for real and record a ledger row — not a build task.
3. **Cap-breach email** reuses S25's alert path and its one-email-per-incident rule. No new
   notification helper.
4. **Audit the orientation noise filter before reusing it.** Report what it discards on two
   real ideas. Per Amendment 1, it must keep every argument actually made, however weak, and
   drop only abuse, sarcasm, pile-ons and posts with no argument.

## Build order

1. Confirm S25 landed and deployed SHA matches HEAD — **done above**, before writing this file.
2. **Stage 2's gold-set measurement first** — it is the evidence the whole design adds value.
   Record the prediction before running with/without-vocabulary top-20 numbers.
3. Noise-filter audit (correction 4) — needed before stage 1 v2 can reuse it.
4. Stage 1 v2 (vocabulary extraction on top of existing orientation output).
5. Stage 3 (four-model check via existing `callModelJson`) + live Luna verification.
6. Merge, cost cap (reusing S25 alert path), disputed-claim wording, people-graph cross-check.
7. Five-idea measurement, handover doc, sprint report.

## Known reuse (from the architecture survey, corrected above)

- Stage 1: `lib/lex/orientation/` already runs Gemini web + Grok X-search concurrently, already
  caps X at 30 posts, already produces `ArgumentItem[]`, already has a generic isolation guard
  (`fetchedContentIsData()`). Vocabulary extraction is the only new part.
- Stage 3: `lib/lex/model-call.ts`'s `callModelJson()` already dispatches to Google/Anthropic/
  OpenAI/xAI uniformly. OpenAI Luna (`searchOpenAI()`, `gpt-6-luna` in the model registry,
  `recordOpenaiUsage`) is code-complete — needs a live run, not new code (correction 2).
- Stage 2 seam: `lib/lex/query-expansion.ts`'s `routeQuery(keywords, ideaContext)`. Existing
  gold-set harness: `scripts/gold/gold-v2-set.ts` and related S8/S14/S19 measurement scripts.
- Ledger: `lib/lex/spend-ledger.ts`'s `recordSpend()` plus provider one-liners
  (`recordGeminiUsage`, `recordXaiUsage`, `recordAnthropicUsage`, `recordOpenaiUsage`). No
  per-build $2 cap exists yet — needs a `checkBuildCeiling`-style analog to the existing
  `checkUserCeiling`.
- People graph: exists per correction 1 — read its tables, don't rebuild.

## Out of scope this sprint

- LEX-stream items from CCh reply 106 and BRIEF_26H §8 — moved to the LEX stream, not this one.
