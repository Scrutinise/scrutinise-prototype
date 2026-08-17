# SEARCH S6 — TWO CONTRACTS, AND THE PLATFORM NOW COUNTS WHAT IT SPENDS

**Executes:** `docs/BRIEF_SEARCH_S6_CONTRACTS.md` §1–§4
**Written:** 17 August 2026, 12:59 UTC
**Owner:** CC-Search
**Cost:** $0.03 (one EDM-test run, used to prove the ledger end to end). Nothing else spent.

**The deliverables are the two documents.** This report says what was found while writing them, and
answers §3's design question.

- **§1 → `docs/SEARCH_CONTRACT.md`** — what the corpus holds, what can be asked, what cannot, how to
  ask, and what each surface actually gets.
- **§2 → `docs/MODEL_CONTRACT.md`** — which keys work, which models are reachable, what they cost,
  what each is for, plus `lib/lex/model-registry.ts` making model choice per pass configurable.
- **§3 → the spend ledger** — one table, one pricer, adopted and proven.

---

## §2's findings, and three of them are defects

**Every key was called once, for real** (`npm run probe:models`). The brief's instruction was the
whole point: *"A key in an environment file is not a working credential."*

| provider | list | one real completion | verdict |
|---|:--:|:--:|---|
| Google Gemini | 200 | **200** on `gemini-2.5-flash` | ✅ works |
| Anthropic Claude | 200 | **200** on `claude-opus-5` | ✅ works |
| xAI Grok | 200 | **200** on `grok-4.20-0309-non-reasoning` | ✅ works |
| OpenAI | — | — | ❌ **no key on this machine** |

**⚠ 1. TWO HARDCODED PRODUCTION FALLBACKS NAME MODELS THE ACCOUNTS DO NOT LIST.**

- `claude-haiku-4-5-20251001` — the Gemini-429 fallback in `scripts/legislation/compile.ts`, and the
  model `docs/CLAUDE.md` §6 names. **Not in the Anthropic list.**
- `grok-3-fast-beta` — hardcoded in two Lex API routes. **Not in the xAI list**; flagged on 6 August
  and still true.

**A configured fallback that does not exist is worse than none, because it only fails when the
primary already has.** Both are recorded in `KNOWN_STALE` and `check:model-registry` fails if either
silently becomes reachable without the caller being fixed. **Neither caller was edited** — one is
ingest's and one is Lex's.

**⚠ 2. ANTHROPIC AND xAI HAVE NO PRICES ON FILE, AND I DID NOT INVENT ANY.** `build-cost.ts` holds
Gemini's three rates, recorded from Google's published pricing. For the other two providers the rate
card is empty, so **any pass switched to Claude or Grok records tokens and a NULL cost, and every
total containing it reports NULL rather than a partial sum.** That is `build-cost.ts`'s own rule —
*a model we cannot price costs null, not zero* — carried through. ▶ **Charlie: two published price
pages, read by someone who can see them, closes this.**

**⚠ 3. OPENAI IS NAMED IN THE BRIEF AND UNREACHABLE FROM HERE.** No `OPENAI_API_KEY` in
`scrutinise-web/.env`. `REACHABLE.openai` is an empty list on purpose, so pointing a pass at an
OpenAI model fails with *"there is no openai key on this deployment"* rather than *"unknown model"*.

### Model choice per pass is now configurable

`lib/lex/model-registry.ts`: 15 passes, each with its default in one place.
`LEX_MODEL__DEEPENING__ADVERSARIAL=claude-opus-5` and that pass moves.

⚠ **An unknown or unreachable model is refused at RESOLVE time, not at call time** — a typo in an env
var otherwise surfaces as a provider 404 inside one pass, hours later, in a log nobody reads.
⚠ **The registry does not make a provider reachable.** `providerFor()` exists so a caller fails loudly
rather than sending a Claude id to Google's endpoint; `build-llm.ts` speaks Gemini only.

**Adopted, not inert** — four passes now resolve through it (`deepening.adversarial`,
`deepening.gather`, `deepening.sift`, `lex.general-chat`), legacy env vars still take precedence, and
`check:model-registry` **asserts the adoption** so it cannot regress to hardcoded defaults. That
assertion exists because this session already shipped one repair that was present and inert.

---

## §3 — the ledger: built, adopted, and proven end to end

**One append-only row per call: stream, pass, model, tokens in/out/thinking, cost in pence, user,
idea, ref, failed.** `"LlmSpend"` on Neon (applied after a whichdb check), plus `"LlmSpendDaily"`.

**⚠ It is not a fifth cost mechanism.** Sprint 25-A already built `build-llm.ts` (usage from the API's
own counters) and `build-cost.ts` (the rate card, with the unpriced-is-null rule). Both are correct
and **neither was touched.** The ledger adds the one thing they cannot do: **a record of every call
across every stream, attributable to a user and an idea.** 25-A totals a build; this totals a platform.

**⚠ Two writers, one table, and that is a build boundary rather than a choice.** `scripts/ingest` sets
`rootDir: "."`, so it cannot import anything under `scrutinise-web/`. The ingest side writes rows and
leaves them `unpriced`; **the web side is the only pricer.** What is deliberately NOT duplicated is
the rate card — two copies of a price list is how two components come to disagree about what
something cost, and the ingest twin's self-test **asserts it carries no rate card** (watched failing
with a planted `inPerM`).

**Proven, not asserted:** a real graph run wrote a row (25,497 in / 7,032 out, `graph.edm-test`),
`reprice:llm-spend` priced it at **£0.0199**, and the read-back reconciled.

**Adopted by the graph stream** (`extract-positions.ts`, `derive-propositions.ts`).
⚠ **NOT adopted on the web side, and deliberately:** the natural site is `build-llm.ts`, which is the
LEX session's **uncommitted, in-flight file**. It is one line — `recordUsage(usage, { stream:
'build', pass, userId, ideaId, ref: buildId })` — and it belongs to whoever lands 25-A.

**Totals and the ceiling:**

- `totalForIdea()` — *"this proposal cost £0.42 to produce"*, the number every later decision rests on
- `totalForUser(since?)` — the per-user running total
- `checkUserCeiling()` — **stops rather than warns**, and ⚠ **an unpriced call BLOCKS rather than
  passes**: if we cannot price what has been spent we cannot know whether the ceiling is breached, and
  the safe reading of "unknown" against a hard limit is stop
- ⚠ **a total containing an unpriced call is NULL, not a partial sum** — *"£0.31"* when two of nine
  calls had no rate reads as complete, will be quoted, and nothing on the page says it is short

**The charging is absent, as instructed.** No allowance, no 75/25 split, no payment. Counting only.

### §3's design question, answered

> *Do we let the user pick cheap/medium/expensive, or build the escalation behind the scenes and use
> the top model for the adversarial step only?*

**Behind the scenes. A user cannot judge which model to use** — someone who picks "cheap" gets a worse
proposal and has no way to know that is why. Same reasoning as the corpus picker.

**And Charlie's instinct about the adversarial step is the one the evidence supports.** GRAPH 2D-4
measured our extraction's failure as **over-attribution, not misreading** — 12 of 50 failures were
positions on claims the submission never addressed, against 2 polarity errors. **The pass that needs a
model willing to decline is the adversarial read**, and it is now a one-line override away.

**The version of user control worth keeping is not a model picker.** *"This one is important — do it
properly"* is a request anyone can make sensibly, and it maps onto a deeper pass, a stronger model and
more retrieval without asking anyone to understand any of it. **Recommended shape:** one boolean per
build — call it *thorough* — that raises the retrieval budget, adds the adversarial pass, and moves
that pass to the strongest available model. One flag, three effects, no vocabulary the user has to
learn. ▶ **Charlie's call; not built.**

---

## §1's findings

Writing the contract down surfaced two things worth naming:

**⚠ The corpus is 18,272,362 documents and 6.37 billion words across 74 collections** — and the honest
half of the contract is longer than the available half. Nine things cannot be asked for today, each
named individually with what it would take, including **phrase search**: the keyword index is built
without token positions, so a quoted string is matched as a bag of words. Nobody had written that down.

**⚠ The live defect is still live.** Not one committee document, debate or judgment reaches a user on
the platform's main conversation, on any question, ever — three gates in series, S4-measured, **S5 not
yet landed.** The contract says so in terms, and pairs it with the never-claim rule: *"I looked for
what committees have said and I can't reach committee evidence yet"* rather than *"I don't have
information on that"*, **because a user cannot tell the second from the corpus being empty.**

---

## Verification

- `npm run probe:models` — every key called once; three providers complete, OpenAI absent
- `npm run check:model-registry` — **17 checks, all pass**, including five negative controls (an
  unknown model, a known-stale id, a providerless string and an OpenAI model are each refused; a
  reachable model is accepted, so the guard is not simply refusing everything) and four adoption
  assertions
- `npx tsx shared/spend-ledger.ts --self-test` — **9/9**, including the no-rate-card assertion watched
  failing with a planted constant
- `prisma validate` clean; `migrate diff` proposes **no DROP** for `LlmSpend`
- `tsc --noEmit` clean in both runtimes

## ⚠ A file I destroyed and rebuilt

While proving the ledger's no-rate-card guard could fire, I backed the file up with `cp`, planted a
constant, and restored — and the backup was empty, so the restore truncated an untracked file to zero
bytes. Rewritten from context and re-verified; the guard was then proven to fire using in-place edits
only. **Do not round-trip an untracked file through a shell copy to test a guard** — edit it in place,
or commit first.

## What is not done

- **Web-side ledger adoption** — one line in `build-llm.ts`, left to the 25-A session
- **Anthropic and xAI rates** — needs the published pages read by someone who can see them
- **The two stale hardcoded fallbacks** — flagged, not fixed; one is ingest's, one is Lex's
- **The `thorough` flag** — recommended, not built
- **The charging** — deliberately absent
