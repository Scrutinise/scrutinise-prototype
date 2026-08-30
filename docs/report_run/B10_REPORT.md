# CCW-B10 — candidate proposals harvested from the corpus

**Run 2026-08-30 12:35 UTC.** Corpus: 285 videos, 287 transcripts, 180,092 cues (unchanged by this
brief — B10 reads, it does not load).

**Outputs, both git-ignored:**

| File | What |
|---|---|
| `docs/report_run/register_candidates.json` | the deliverable: Pass A (89) + Pass B (300, capped) |
| `docs/report_run/register_candidates_full.json` | companion: Pass B uncapped (2,013) |

**Tool:** `scripts/starkey/b10-candidates.ts`, new. `--compare` reproduces §5 below.

Per B10 step 3 this maps nothing to legislation, deduplicates nothing across videos and drops nothing
for being vague. **These are sentences he said. Nothing here is a finding about what he proposes.**

---

## 1. Prediction, and how it scored

Logged in `docs/report_run/B10_PREDICTION.md` before the script existed.

| Predicted | Actual | |
|---|---|---|
| Pass A: 110–140 candidates (point 120) | **89** | ✗ over by ~26% |
| Pass B surfaces a target outside the twelve | **yes, all six I named** | ✓ |
| `search.ts` returns 0 for the stopword phrases | **2 of 5 — and the other 3 failed the opposite way** | ✗ half right |

**Pass A missed low, and the reason is mechanical, not substantive.** A candidate is a *merged*
±30s window, so a video where he says "we should" four times in ninety seconds yields one candidate,
not four. The underlying hit count is 141 across the eight videos; 89 is what those merge into. My
estimate reasoned about hits and then quoted it as candidates. It is above my own stated
"under 60 means the search is at fault" floor, so the search is not in question.

**The stopword prediction was half right in the more interesting direction** — see §5.

---

## 2. Hit counts by term group and pass

Corpus-wide totals sit beside every term, as B10 requires, so a term that matches everywhere is
visible as uninformative rather than looking significant. `Pass A` + `Pass B` = `corpus (infl)`.

### Imperative

| term | Pass A | Pass B | corpus (strict) | corpus (infl) | passages (direct) | plainto_tsquery |
|---|---|---|---|---|---|---|
| `we should` | 18 | 248 | 266 | 266 | 229 | **lexes to empty** |
| `we must` | 1 | 53 | 54 | 54 | 49 | 221 |
| `we need to` | 23 | 409 | 432 | 432 | 340 | 1142 |
| `we have to` | 3 | 136 | 139 | 139 | 118 | **lexes to empty** |
| `I would` | 13 | 664 | 677 | 677 | 579 | 1695 |
| `what I would do` | 0 | 6 | 6 | 6 | 6 | 1695 |
| `the first thing` | 2 | 58 | 60 | 60 | 57 | 542 |
| `has to go` | 0 | 8 | 8 | 8 | 8 | 2317 |
| `must go` | 0 | 1 | 1 | 1 | 1 | 83 |
| **group total** | **60** | **1,583** | | | | |

### Action verbs

| term | Pass A | Pass B | corpus (strict) | corpus (infl) | passages (direct) | plainto_tsquery |
|---|---|---|---|---|---|---|
| `abolish` | 0 | 86 | 42 | 86 | 38 | 67 |
| `repeal` | 7 | 167 | 140 | 174 | 109 | 127 |
| `annul` | 0 | 2 | **0** | 2 | 0 | 1 |
| `scrap` | 2 | 8 | 4 | 10 | 4 | 5 |
| `get rid of` | 3 | 66 | 69 | 69 | 59 | 81 |
| `restore` | 16 | 268 | 110 | 284 | 82 | 212 |
| `bring back` | 1 | 9 | 10 | 10 | 8 | 75 |
| `take back` | 2 | 8 | 10 | 10 | 9 | 213 |
| `dismantle` | 0 | 6 | 3 | 6 | 3 | 6 |
| `reverse` | 11 | 137 | 75 | 148 | 67 | 127 |
| **group total** | **42** | **757** | | | | |

`annul` is **never said in that exact form** — but the 2 inflected hits are not the false positives
I assumed before looking. Both are in `0N1WPuRW1Xw` *"Starmer is packing the House of Lords" |
Starkey answers questions*, at 1:54 and 2:02: *"annulled. And there is the procedure."* and
*"annulling an act of Parliament, which…"*. That is procedural constitutional language, and CCW may
want it. It is the clearest case in this run for keeping the inflected match rather than the strict.

### Named targets

| term | Pass A | Pass B | corpus (strict) | corpus (infl) | passages (direct) | plainto_tsquery |
|---|---|---|---|---|---|---|
| `human rights act` | 2 | 54 | 56 | 56 | 48 | 104 |
| `equality act` | **0** | 116 | 116 | 116 | 81 | 110 |
| `supreme court` | 5 | 211 | 216 | 216 | 158 | 159 |
| `lord chancellor` | 2 | 86 | 88 | 88 | 55 | 60 |
| `civil service` | 12 | 169 | 181 | 181 | 136 | 137 |
| `judicial review` | 1 | 21 | 22 | 22 | 18 | 23 |
| `quango` | 13 | 147 | 39 | 160 | 33 | 119 |
| `climate change act` | **0** | 6 | 6 | 6 | 6 | 18 |
| `european convention` | 4 | 87 | 91 | 91 | 86 | 93 |
| `hate speech` | **0** | 42 | 42 | 42 | 31 | 52 |
| `sentencing council` | **0** | 9 | 9 | 9 | 5 | 6 |
| `house of lords` | **0** | 108 | 108 | 108 | 90 | 116 |
| `civil service commission` | **0** | **0** | **0** | 0 | 0 | 7 |
| **group total** | **39** | **1,056** | | | | |

⚠ **`civil service commission` is never uttered anywhere in 287 transcripts** — the phrase named in
WS-05's own title. Its 7 `plainto_tsquery` hits are passages containing "civil", "service" and
"commission" separately. This is the `constitutional reform` defect the other session found in B9,
in a second place.

⚠ **The thesis series barely names the statutes.** Equality Act, Climate Change Act, hate speech,
Sentencing Council and House of Lords are all **zero** across the eight thesis videos, and Human
Rights Act appears twice. This is the same shape as B9's CRAG result and it points the same way:
the programme in the thesis videos is stated in constitutional generalities, and the named measures
live in the other 277 videos.

---

## 3. Candidate counts and the cap

| | Pass A | Pass B |
|---|---|---|
| videos | 8 | 277 |
| candidates | **89** | **300** (of 2,013) |
| `capped_at` | — | **1,713** |
| by group | imperative 40, action 25, target 24 | target 150, action 100, imperative 50 |
| by source | asr 69, turboscribe 20 | asr 300 |
| dropped by group | — | imperative 1,008, target 362, action 343 |

**A note on how the cap was taken, because the obvious way was wrong.** Ranking the whole of Pass B
by group and keeping the top 300 filled every slot with `target` and silently discarded all 1,713
action and imperative candidates — the group that answers "has he proposed something outside the
twelve" would have vanished behind a `capped_at` that looked perfectly honest. The cap is now a
quota per group (150/100/50). The uncapped 2,013 are in `register_candidates_full.json` so the cap
costs nothing; the capped file is still the deliverable B10 asked for.

`top_action_videos_outside_thesis` is computed from **uncapped** hits, so the cap cannot move it.

---

## 4. The five videos outside the thesis series with the most action-verb hits

**Two rankings, because they disagree, and the disagreement is the point.** The inflected count
(what the search naturally does) also counts *restoration* and *reversal* — nouns. That promotes
videos **about** the Restoration over videos **proposing** something.

| # | strict | infl | video | published | title |
|---|---|---|---|---|---|
| 1 | **21** | 21 | `jl0S4mR2hAc` | 2026-05-30 | "Restore supporters are DELUDED!" … to Jack Hadfield |
| 2 | **17** | 22 | `aJrmFUS4GNk` | 2026-04-10 | "I can't forgive Nigel Farage!" … to Connor Tomlinson |
| 3 | **13** | 16 | `VaPKzYLcZ7Y` | 2026-05-20 | The Historical Importance of Brexit at 10 Years |
| 4 | **13** | 16 | `dgZ4gyMQ2o8` | 2026-05-22 | "Brexit started a revolution — that's why they want to reverse it" |
| 5 | **13** | 19 | `gmDhVw5H0jU` | 2025-10-11 | "British have been put second by their own governments" … to Charlie Rowley |

Ranked on the inflected count instead, `zjcd6wBI2dA` *Britain Needs a New Restoration* (2024-10-12)
enters at #3 on 21 and the Reform conference speech `5txQ4A-1p24` at #6 on 18 — but on strict verbs
they are 11 and 8, falling to #7 and #10. **Both are titled around the noun.** CCW should treat the
strict column as the ranking and the inflected as a reading list.

⚠ **One caveat on #1 that I could not resolve mechanically.** `jl0S4mR2hAc` scores 21 strict
`restore` hits, but its title is *"Restore supporters are DELUDED!"* — "Restore" there is very
likely the name of a political organisation, not the verb. A proper-noun/verb split needs a human
eye, and it is the single row in this table I would check first.

---

## 5. What made me doubt the search — and it was the tool the brief named

B10 says to use `scripts/starkey/search.ts`. **It cannot serve this brief**, and the failure runs in
both directions at once. `search.ts` is `plainto_tsquery('english', …)`.

**Direction 1 — the query dissolves.** `we`, `should`, `i`, `what`, `do`, `the`, `has`, `to`, `of`
are Postgres English stopwords. `we should` and `we have to` lex to the **empty tsquery** and match
zero rows. Direct matching finds them in **229** and **118** passages. A zero that means "the query
dissolved" is indistinguishable from "he never said it".

**Direction 2 — and this is the larger error.** plainto_tsquery ANDs the *surviving* lexemes across
a whole 60–90s passage. It is not a phrase search:

| term | passages, direct | passages, plainto_tsquery | |
|---|---|---|---|
| `has to go` | 8 | 2,317 | **290× — it is searching for `go`** |
| `what I would do` | 6 | 1,695 | **283× — it is searching for `would`** |
| `I would` | 579 | 1,695 | 2.9× |
| `must go` | 1 | 83 | 83× |
| `take back` | 9 | 213 | 24× |
| `civil service commission` | **0** | 7 | all spurious |
| `annul` | 0 | 1 | all spurious |

`what I would do` and `I would` return **the identical number**, 1,695: a four-word phrase and a
two-word phrase are indistinguishable once the stopwords are stripped.

**Where it is fine.** Two-word content phrases come back at ~1.0×: `supreme court` 1.0×,
`civil service` 1.0×, `lord chancellor` 1.1×, `european convention` 1.1×. B9's terms are of exactly
this shape, so **B9's numbers are not in question** — a point the other session confirmed
independently by printing each term's lexed form.

**The direction of the error decides how much to worry** (the other session's point from B9, and it
holds here): a term the *loose* method scores zero on is a real absence, because tightening cannot
resurrect it. A term only the loose method finds is the one that needs checking — which is how
`civil service commission` turned out to be 0 real and 7 spurious.

**What B10 used instead.** Direct regex over the joined cue stream per `(video_id, source)`, with an
offset→cue map so every match resolves to a real timestamp. This also catches a term split across a
cue boundary, which passage-level matching loses.

### Second doubt: the term list cannot discover an unknown target

The `target` group contains **only measures already in the twelve workstreams**. By construction it
cannot surface a thirteenth. Anything new has to arrive through the action/imperative windows, where
the object of the verb is in the surrounding prose. Scoring my six predicted outside-the-twelve
targets by direct match (controls first, so a zero would mean something):

| | Pass B hits | Pass B videos | Pass A hits |
|---|---|---|---|
| *control* Human Rights Act (WS-01) | 54 | 35 | 2 |
| *control* Supreme Court (WS-02) | 211 | 76 | 5 |
| *control* Equality Act (WS-04) | 116 | 48 | 0 |
| *control* civil service (WS-05) | 169 | 60 | 12 |
| **universities / Office for Students** | **249** | **88** | 4 |
| **BBC / licence fee** | **177** | **41** | 2 |
| **House of Lords as a chamber** | **121** | **54** | 0 |
| **devolution / Scotland Act** | **103** | **32** | 2 |
| **Bank of England** | **78** | **49** | 7 |
| **Church of England / establishment** | **72** | **37** | 1 |
| monarchy / the Crown / coronation | 627 | 105 | 14 |
| immigration / asylum | 29 | 22 | 0 |
| trade unions | 19 | 16 | 0 |
| honours system / peerage | 7 | 6 | 0 |

All six predicted targets clear their controls. **Universities and the BBC each out-score three of
the four in-programme controls.** The monarchy's 627 is almost certainly his day job as a Tudor
historian rather than a proposal, and should not be read as one without sampling.

**This is a pointer, not a finding.** Presence of a phrase is not a proposal about it — establishing
that is CCW's judgement, from the candidate text, and the two are not the same thing.

### Third doubt: inflection is a real choice and both numbers are published

Single-word terms match an inflectional tail, so `repeal`→repealed, `quango`→quangos,
`restore`→restoration. Without it the search under-returns badly on speech; with it, `restore` goes
from 110 to 284 and `quango` from 39 to 160. Both counts are in `term_totals` for every term.

---

## 6. Checks that were built to be able to fail

- **Nothing quoted from `2Khgz5sMMBU` after 20:20.** 11 candidates, latest hit **19:36** (1,176.2s),
  limit 1,220s — **0 violations**. The check is not vacuous: the same filter on the untruncated
  46-minute lecture `EMbRv6aaQrs` returns **7** candidates after the same timestamp. B7's coverage
  flag holds.
- **Every candidate's text contains one of its own `matched_terms`** — 389/389. An offset error in
  the cue mapping would break this and nothing else would show it.
- **No candidate's `hit_start_s` falls outside its own window** — 0/389.
- **Both engines are represented** for Parts 1–3: every one yields `asr` *and* `turboscribe`
  candidates (69 asr / 20 turboscribe in Pass A).
- **The capped file is a strict subset of the uncapped one**, 300 ⊂ 2,013, verified by key.

### The two engines disagree where it matters

Part 3 at 1:27, the same sentence:

| source | text |
|---|---|
| `asr` | "…your position is on **Northcut Travelion** and the reform of the civil service" |
| `turboscribe` | "…your position is on **Northcote Trevelyan** and the reform of the civil service" |

and in the same window, `asr` "talking mainly to the politicized you know people party" against
`turboscribe` "talking mainly to the politicised… people of the Labour Party" — the ASR loses a
named party. A quotation taken
from the ASR alone would have printed both errors. This is why B10 returns the hit from each source.

---

## 7. What I did not do

- **No mapping to legislation.** B5, and a separate evidence trail.
- **No cross-video deduplication.** He repeats himself; the repetition is evidence.
- **Nothing dropped for vagueness.**
- **B5 remains blocked** — `docs/report_run/register_proposals.json` is still not on disk, checked
  again at the end of this run.
