# SEARCH-29 — report (DRAFT, in progress)

*Started 2026-10-21. Written for Charlie: plain English first, detail after. Sections marked **PENDING** have not been measured; nothing in them is a result.*

## PREDICTIONS — recorded 2026-10-21 23:35 UTC, before any stage-2 gold run, any Option B run, or any five-ideas run

(What I had seen when I wrote these: stage 1 run once on two real ideas, filter on and off — its numbers are in "What has been measured" below, as observed, not predicted. I had not read the output of the one-idea stage-2 smoke test that was running.)

**Stage 2 on the 65 gold questions** (document in the first 20; production's flag string; arms differ by the per-question terms and nothing else; the terms are stage 1 run on each question's text, so this is the weakest fair test of stage 2):
- Headline against the baseline: **within noise** — a difference of 3 or fewer. Most likely **+1** (range −4 to +4). The questions are already phrased in the vocabulary of the thing they ask about, so there is little for stage 1 to add.
- Gains concentrate in **legislation** questions where stage 1 names a statute (2 to 4 gains). Losses are **2 to 5** questions that hit without terms and miss with them, in debates, committees and case law, where extra vocabulary pulls the router's stream queries away from the question.
- **What would change my mind:** a net of +5 or more means stage 2 does real work at question level and I mis-modelled how much vocabulary the questions lack; −5 or worse means the terms are doing damage (I have already seen stage 1 return an off-topic statute among its terms, so that is a live possibility, not a remote one).
- Stage-1 generation for the 65: **at least 90% of questions get a non-empty term list**; cost **£3 to £6 in all**; median **25 to 40 seconds** a question.

**Option B (two places per routed source in the 16-place answer context), paired on the same searches:**
- Questions where a routed source reached **none** of today's context: **20 to 35 of 65**.
- Questions where the context changes at all: **30 to 50 of 65**.
- Gold **document** in the context: net **+1** (range −2 to +4). Gains **1 to 4**, losses **0 to 3**: the floor puts a weak stream's best hits in, and a loss happens only when it displaces a gold document that sat at place 15 or 16.
- **What would change my mind:** 5 or more losses means the floor is taking places the right answer needed; 0 gains and 0 losses means the stream-loss S14 made is real but never decided a gold question, which is a finding in itself.

**Five real ideas, stage 1 then stage 2:**
- Stage 1: **8 to 15p and 25 to 45 seconds** per idea. Stage 2's search with terms costs **under 1p more** and **under 3 seconds more** than without.
- "Found by stage 2" (in the first 20 with terms, in neither of two runs without): the two runs without terms will differ from each other by **2 to 6** documents on their own (the router is an LLM call). I predict stage 2 adds **no more than 2 documents per idea beyond that**, and that on **at least one of five ideas** a statute named in the vocabulary appears in the first 20 that was absent from both runs without terms.
- **What would change my mind:** 5 or more new documents on most ideas, past the noise floor, means stage 2 is the largest retrieval gain in this programme; none on any idea means orientation's vocabulary adds nothing the user's words and the router did not already supply.

---

## What has been measured so far

### Why orientation produced nothing — found, and it is not what the brief guessed

The brief offered two causes: rows in the ledger (it runs and the result is lost) or none (never called). **None. It is never called.**

- The ledger: the last `orientation.*` row is **2026-09-25 01:19 UTC**, and all 32 `orientation.*` rows ever written fall between 24 September 02:19 and 25 September 01:19 UTC. **Zero since 25 September**, while `/api/health` has read `LEX_WEB_ORIENTATION: true` throughout.
- Why: `runOrientation` (v1) is called from exactly one place in the product, `fireSearchTrigger`, the legacy Page-1 briefing trigger. The build pipeline's ORIENT pass (`build.ts` `orientPass`) never imported it. It writes its own "orientation" — Lex's reading of the corpus — and has no web or X step at all.
- What is stored: 2 of 64 ideas have an `orientation` value, and both have `calls: []` (nothing attempted: they were written when the flag was off).

**Fix:** `orientPass` now calls orientation v2 (below), concurrently with its query-writing call, behind `LEX_ORIENTATION_V2` (default off, needs `LEX_WEB_ORIENTATION` too) — and stores the result on the idea.

### Stage 1 — orientation v2 on two real ideas

`lib/lex/orientation/v2.ts`. Given the user's full input, it runs Gemini web search and Grok X search together and returns the arguments being made (claim, reason, side, source) and the vocabulary around them (key terms, statutory terms, people, organisations, places). It keeps an argument that has no date (flagged), merges restatements instead of dropping them, and logs every drop with its reason. The X half is told to read about 30 posts; **the cap is advisory and logged, because X's search has no maximum-results setting** — the provider's own post count is recorded against it (18 and 24 posts on the first idea, 10 and 10 on the second; the cap was not exceeded).

| | Idea 452c5ade (civil service accountability, 5,698 characters in) | Idea 2ef5358b (illegal immigrant deportation, 650 characters in) |
|---|---|---|
| Filter ON | 21 arguments (14 web, 7 X), 6 dropped, 8p, 39 s | 21 arguments (14 web, 7 X), 3 dropped, 7p, 32 s |
| Filter OFF | 28 arguments (14 web, 14 X), 0 dropped, 10p, 25 s | 22 arguments (14 web, 8 X), 0 dropped, 7p, 28 s |
| Ledger rows (one idea, both runs) | 6: `orientation.web` ×4, `orientation.x` ×2, all `measurement` | 6, same shape |

**What the noise filter removes** (X side only; the web side is not filtered): on the first idea 7 X arguments with it on against 14 with it off; **all 6 logged drops are "no argument" (5) or "pile-on" (1), none abuse and none sarcasm.** They were bare links and one partisan jab. On the second idea 1 fewer X argument and 3 logged drops, all "no argument". So on these two ideas the filter removes posts that carry no argument; it did not find abuse to remove. ⚠ A comparison of the two runs' arguments by wording matched nothing in either direction (the web search words every run differently), so "what the filter removed" is read from the model's own logged drops and the X counts, not from matching items. Two ideas is two ideas.

**Vocabulary quality, said plainly:** useful terms (Ministerial Code, accounting officers, Illegal Migration Act 2023, Hardial Singh principles) sit beside noise — an off-topic planning statute and a district council local plan appeared among the deportation idea's statutory terms. That is why stage 2 is measured rather than assumed.

*(Stage 2, Option B and the five-ideas run follow, PENDING — they are to run on Railway.)*
