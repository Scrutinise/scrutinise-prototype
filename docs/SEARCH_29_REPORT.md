# SEARCH-29 — report (Option B and five-ideas measured 19 Nov; stage 2 on the 65 still waiting on spend approval)

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

## MEASURED 19 Nov 2026 (cc-search, Railway measure-job at `meta.commitHash = 239658bb`, production's flags) — scored against the predictions above

**In plain English.**
- **Option B (two places per routed source)** reshapes the answer context on most questions but decides the right answer on only one of 65. It is harmless and small.
- **The five-ideas run** could not measure stage 2. The same idea searched twice in exactly the same way returns very different documents (12 to 36 of 40 differ), so anything stage 2 adds is lost in that noise. Making the idea-level search repeatable comes before measuring stage 2 again.
- **Stage 2 on the 65 gold questions** was not run: it needs about £5–8 of stage-1 calls, over tonight's approval. That's a QUESTION to CCh.

**Option B**, read from the paired before/after inside tonight's four SEARCH-28 gold runs (no extra spend). The OFF arms are production's configuration.

| | OFF-1 | OFF-2 | prediction | |
|---|---|---|---|---|
| questions where a routed source reached none of the 16 context places | 42 | 38 | 20–35 | **WRONG** (commoner than modelled) |
| questions where the context changes at all | 48 | 43 | 30–50 | held |
| gold document in the context, net | +1 (S10-Q12) | +1 (S10-Q12) | +1 (−2 to +4) | held |
| losses | 0 | 0 | 0–3 | held |

With the bill-vocab flag ON, the context changes on 34 questions and the net is 0 / −1 (S10-Q4 lost on one run).

**Five real ideas** (`measure-orientation-stage2.ts`, `docs/census/s29-five-ideas-19nov.json`; 452c5ade, 2ef5358b, 5c7287d2, a379e439, 31055aef). ⚠ This ran the 22 Oct stage-1 code on origin/Main. Tonight's SEARCH-30 noise-filter change was local only; it doesn't affect vocabulary.

| idea | stage 1 | WITHOUT-1 vs WITHOUT-2 differ by (noise) | found by stage 2 | lost |
|---|---|---|---|---|
| 452c5ade | 45 s · 12.4p | 36 | 19 | 2 |
| 2ef5358b | 32 s · 7.3p | 30 | 18 | 5 |
| 5c7287d2 | 39 s · 13.7p | 26 | 8 | 3 |
| a379e439 | 38 s · 9.7p | 12 | 14 | 12 |
| 31055aef | 30 s · 21.2p | 26 | 2 | 1 |

- **Stage 1 cost and time:** 7.3–21.2p and 30–45 s. Predicted 8–15p and 25–45 s; mostly held, with 31055aef over.
- **Stage 2's extra cost and time on the search:** about +0.04p, and no slower (24.5 s against 27.4 s). Predicted under 1p and under 3 s; **held**.
- **Noise floor** (symmetric difference of the two identical WITHOUT runs' first 20): **12–36**. Predicted 2–6, so **WRONG by a wide margin**.
- **Consequence:** "found by stage 2" (2–19 per idea) is the same size as the noise floor. Stage 2's effect at idea level is **not measurable** with this design. The prediction "no more than 2 beyond noise" can't be scored either way.
- **Why the floor is that large (inferred, not measured):** the build's search goes through two LLM steps (the query writer, then the router). Each can produce different stream queries on a rerun, and per-stream results then diverge.
- **Before stage 2 is measured again:** make the two LLM steps repeatable (temperature 0, as was done tonight for the X filter), re-measure the floor, and only then run with and without terms.

---

## SEARCH-31 item 1: the noise floor at temperature 0 (CCh-Search 0908Z GO)

### Correction to the paragraph above, written 2026-11-19 13:14 UTC

"The query writer, then the router" was half wrong. `measure-orientation-stage2.ts` writes the opening query **once per idea** and
reuses it for both WITHOUT runs. So the query writer cannot have made those two runs differ. What can: the router (a Gemini call
at 0.2), the query expansion (the same helper, 0.2), a search leg that timed out or was shed (latency-dependent), and anything
non-repeatable in the serves. The reranker is already at temperature 0.

### What changed (local commit, not pushed)

- `query-expansion.ts`: the router and the query expansion move from 0.2 to `SEARCH_LLM_TEMPERATURE`, default 0.
- `build-query.ts`: the build's query writer moves from 0.3 to `QUERY_WRITER_TEMPERATURE`, default 0.
- ⚠ **This changes production behaviour once pushed:** every build and every Lex search routes at temperature 0. The env
  overrides exist only so that a measurement can run the old value on the same code.

### PREDICTIONS — recorded 2026-11-19 13:14 UTC, before either run

Design: the five ideas, two identical WITHOUT runs each, `--floor-only` (no stage 1). Run **locally** against the production serves,
under production's flag string, at 0.2 and then at 0, on the same code. Both arms therefore share the network path, unlike last
night's Railway run.
- At **0.2** locally, the floor is in the same range as on Railway last night: **10 to 36** per idea. The routed streams differ
  between the two runs on **at least 3 of 10** searches.
- At **0**, the routed streams are identical on **all 10** searches, or 9 of 10. The floor falls to **6 or fewer on at least 4 of 5
  ideas**, against 12 to 36.
- Cost: under **5p** for both arms together. Time: about **3 to 5 minutes** per arm.
- **What would change my mind:** if the streams match at 0 but the floor stays above 10, the variation is downstream of the
  router. The suspects in order: a failed or degraded leg (the run records which), the per-stream query wording (not recorded),
  then the serves. If that happens, stage 2 does NOT run (the GO's rule), and the report names which.

### MEASURED 19 Nov 13:16–13:29 UTC (local, production serves, production flags at db705682)

Files: `docs/census/s31-floor-t02-19nov.json` and `s31-floor-t0-19nov.json`.

| | temperature 0.2 | temperature 0 | prediction | |
|---|---|---|---|---|
| noise floor per idea (452c5ade, 2ef5358b, 5c7287d2, a379e439, 31055aef) | 2, 8, 32, 0, 26 | **38**, 2, 16, 4, 0 | 0.2: 10–36. 0: ≤6 on ≥4 of 5 | 0.2 **WRONG** (3 of 5 below 10). 0 **WRONG** (3 of 5) |
| searches routed to the same streams in both runs | 8 of 10 | **10 of 10** | 0.2: ≤7. 0: 9–10 | 0.2 **WRONG** (narrowly). 0 **held** |
| per-stream result lists identical, content and order | 26 of 48 | **39 of 46** | — | |
| searches identical in every stream | 1 of 10 | 7 of 10 | — | |
| cost (both runs, all five ideas) | 4.9p | 3.4p | under 5p for both arms | **WRONG** (8.3p; the reranker is 0.2p a call) |
| search time (both runs, all five ideas) | 5.9 min | 5.7 min | 3–5 min an arm | **WRONG** |
| failed or degraded search legs | 0 of 20 | 0 of 20 | — | |

**Why the floor stays high on two ideas, measured.** I called the router six times on identical input:
- At temperature 0 it returns **2 distinct outputs in 6 calls** on each of two ideas. On 452c5ade, all four stream queries are
  reworded (for example "Public Services (Social Value) Act 2012…" against "Public Bodies Act 2011…"). On 5c7287d2, only the
  guidance query changes.
- That matches the floor run exactly. 452c5ade's 38 is one search where every stream differs. 5c7287d2's 16 is the
  guidance stream alone.
- A fixed `seed` changed nothing: still 2 distinct outputs in 6, on both ideas. **gemini-2.5-flash is not repeatable at
  temperature 0, with or without a seed.** No seed is sent.
- The two small floors (2 and 4) have identical per-stream lists in both runs. They come from the reranker's order (an LLM call,
  already at 0).

**Also measured, not explained:** at 0.2, this local run's floor (median 8) is much lower than last night's Railway run at the same
temperature (median 26). The two runs differ in machine, time of day and serve load, and last night's run did not record why
each run came out as it did. So the 12–36 of last night may include something about that environment as well as the router.

**Decision (the GO's rule).** The floor did not fall to a level where a stage-2 effect could be seen on every idea: two of five are
still at 16 and 38. So **stage 2 on the 20 gold questions was not run**, and nothing was spent on it.

**What would make idea-level search repeatable.** The router has two answers for the same input, and temperature cannot remove
that. Two options; neither is built:
1. Reuse the router's decision for identical input within one build, so a build's searches agree with each other. Cheap; no
   schema. It doesn't make a rebuild repeat.
2. Store the decision per idea and query, so a rebuild repeats too. That needs a table, so it is Charlie's decision.
For measurement, the honest alternative is the gold design (SEARCH-28): paired runs per arm, judged on hit or miss. That
tolerates this noise because one reworded query rarely moves a gold document across the 20 line.

⚠ **The temperature change is committed locally, not pushed, and is a production behaviour change.** Its effect on answer quality
is NOT measured: the 65 gold questions have not been run at 0. A two-run gold check at 0 should come before the push.

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
