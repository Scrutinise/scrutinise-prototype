# CCW-B10 — candidate proposals harvested from the corpus

**Run 2026-08-30 12:35 UTC.** Corpus: 285 videos, 287 transcripts, 180,092 cues (unchanged by this
brief — B10 reads, it does not load).

**Outputs, both git-ignored:**

| File | What |
|---|---|
| `docs/report_run/register_candidates.json` | the deliverable: Pass A (89) + Pass B (300, capped) |
| `docs/report_run/register_candidates_full.json` | companion: Pass B uncapped (2,025) |

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
not four. The underlying hit count is 141 occurrences across the eight videos — 109 distinct moments once the three two-transcript videos are collapsed; 89 is what those merge into. My
estimate reasoned about hits and then quoted it as candidates. It is above my own stated
"under 60 means the search is at fault" floor, so the search is not in question.

**The stopword prediction was half right in the more interesting direction** — see §5.

---

## 2. Hit counts by term group and pass

Corpus-wide totals sit beside every term, as B10 requires, so a term that matches everywhere is
visible as uninformative rather than looking significant.

⚠ **Read the "Pass A moments" column, not "Pass A occ."** `soNnF0sjF5Y`, `jnsiLNNL8s8` and
`8veLovq5NWQ` each carry **two** transcripts, so one thing said once in those three is counted
once per engine. Rows where that happens are marked ⚠. The moment count takes, per video, the
**max** over its sources — not a merge of overlapping time ranges, which chains adjacent hits from
two differently-segmented engines into one and undercounts instead (the other CC session measured a
2.5× undercount doing exactly that). Max cannot chain and equals what a single-transcript video
reports. It is a **floor**: two genuinely distinct moments, one per engine, would read as one.

**Pass B needs no such correction** — `two_transcript_videos` in the JSON confirms all three are in
Pass A, and `pass_b` equals `pass_b_distinct` for every one of the 32 terms.

⚠⚠ **Multi-word terms match inflected forms, and `surface_forms` in the JSON records what was
actually said.** He names measures the way a speaker does: **"the Equalities Act"**, 16 times. A
literal search for `equality act` cannot reach it, which is how the first version of this report
printed a wrong 0 for the thesis series (§8.4). **147 of 389 candidates contain at least one
non-literal match**, and each carries `matched_surface` and `all_literal` — a match is not a
licence to quote the term's own wording.

### Imperative

| term | Pass A occ. | **Pass A moments** | Pass B | corpus (strict) | corpus (infl) | passages (direct) | plainto_tsquery |
|---|---|---|---|---|---|---|---|
| `we should` | 18 ⚠ | **13** | 248 | 266 | 266 | 229 | **lexes to empty** |
| `we must` | 1 | **1** | 53 | 54 | 54 | 49 | 221 |
| `we need to` | 23 ⚠ | **17** | 409 | 432 | 432 | 340 | 1142 |
| `we have to` | 3 | **3** | 136 | 139 | 139 | 118 | **lexes to empty** |
| `I would` | 13 ⚠ | **12** | 664 | 677 | 677 | 579 | 1695 |
| `what I would do` | 0 | **0** | 6 | 6 | 6 | 6 | 1695 |
| `the first thing` | 2 ⚠ | **1** | 66 | 60 | 68 | 57 | 542 |
| `has to go` | 0 | **0** | 8 | 8 | 8 | 8 | 2317 |
| `must go` | 0 | **0** | 1 | 1 | 1 | 1 | 83 |
| **group total** | **60** | **47** | **1591** | | | | |

### Action verbs

| term | Pass A occ. | **Pass A moments** | Pass B | corpus (strict) | corpus (infl) | passages (direct) | plainto_tsquery |
|---|---|---|---|---|---|---|---|
| `abolish` | 0 | **0** | 86 | 42 | 86 | 38 | 67 |
| `repeal` | 7 ⚠ | **6** | 167 | 140 | 174 | 109 | 127 |
| `annul` | 0 | **0** | 2 | 0 | 2 | 0 | 1 |
| `scrap` | 2 | **2** | 8 | 4 | 10 | 4 | 5 |
| `get rid of` | 3 | **3** | 68 | 69 | 71 | 59 | 81 |
| `restore` | 16 ⚠ | **12** | 268 | 110 | 284 | 82 | 212 |
| `bring back` | 1 | **1** | 9 | 10 | 10 | 8 | 75 |
| `take back` | 2 ⚠ | **1** | 8 | 10 | 10 | 9 | 213 |
| `dismantle` | 0 | **0** | 6 | 3 | 6 | 3 | 6 |
| `reverse` | 11 ⚠ | **7** | 137 | 75 | 148 | 67 | 127 |
| **group total** | **42** | **32** | **759** | | | | |

`annul` is **never said in that exact form** — but the 2 inflected hits are not the false positives
I assumed before looking. Both are in `0N1WPuRW1Xw` *"Starmer is packing the House of Lords" |
Starkey answers questions*, at 1:54 and 2:02: *"annulled. And there is the procedure."* and
*"annulling an act of Parliament, which…"*. That is procedural constitutional language, and CCW may
want it. It is the clearest case in this run for keeping the inflected match rather than the strict.

### Named targets

| term | Pass A occ. | **Pass A moments** | Pass B | corpus (strict) | corpus (infl) | passages (direct) | plainto_tsquery |
|---|---|---|---|---|---|---|---|
| `human rights act` | 2 ⚠ | **1** | 55 | 56 | 57 | 48 | 104 |
| `equality act` | 2 ⚠ | **1** | 132 | 116 | 134 | 81 | 110 |
| `supreme court` | 5 | **5** | 212 | 216 | 217 | 158 | 159 |
| `lord chancellor` | 2 ⚠ | **1** | 87 | 88 | 89 | 55 | 60 |
| `civil service` | 12 ⚠ | **9** | 169 | 181 | 181 | 136 | 137 |
| `judicial review` | 1 | **1** | 23 | 22 | 24 | 18 | 23 |
| `quango` | 13 ⚠ | **10** | 147 | 39 | 160 | 33 | 119 |
| `climate change act` | 0 | **0** | 6 | 6 | 6 | 6 | 18 |
| `european convention` | 4 ⚠ | **3** | 87 | 91 | 91 | 86 | 93 |
| `hate speech` | 0 | **0** | 42 | 42 | 42 | 31 | 52 |
| `sentencing council` | 0 | **0** | 9 | 9 | 9 | 5 | 6 |
| `house of lords` | 0 | **0** | 108 | 108 | 108 | 90 | 116 |
| `civil service commission` | 0 | **0** | 0 | 0 | 0 | 0 | 7 |
| **group total** | **41** | **31** | **1077** | | | | |

⚠ **`civil service commission` is never uttered anywhere in 287 transcripts** — the phrase named in
WS-05's own title. Its 7 `plainto_tsquery` hits are passages containing "civil", "service" and
"commission" separately. The other session confirmed this independently three ways
(phraseto_tsquery 0, ILIKE on cue text 0, ILIKE on passage text 0, against `civil service` at 136
passages). This is the `constitutional reform` defect B9 found, in a second and worse place: that
one was a phrase that might plausibly have been said, this is the title of the measure itself.

⚠ **The thesis series barely names the statutes.** Across the eight thesis videos, as **distinct
moments**: Climate Change Act **0**, hate speech **0**, Sentencing Council **0**, House of Lords
**0**, judicial review **1**, Human Rights Act **1**, **Equality Act 1** (as *"the Equalities Act"*,
`jnsiLNNL8s8` at 5:17, in the same breath as the HRA). Same shape as B9's CRAG result, and it
points the same way: the programme in the thesis videos is stated in constitutional generalities,
and the named measures live in the other 277 videos.

## 3. Candidate counts and the cap

| | Pass A | Pass B |
|---|---|---|
| videos | 8 | 277 |
| candidates | **89** | **300** (of 2,025) |
| `capped_at` | — | **1,725** |
| by group | imperative 40, action 25, target 24 | target 150, action 100, imperative 50 |
| by source | asr 69, turboscribe 20 | asr 300 |
| dropped by group | — | imperative 1,015, target 365, action 345 |

**A note on how the cap was taken, because the obvious way was wrong.** Ranking the whole of Pass B
by group and keeping the top 300 filled every slot with `target` and silently discarded all 1,725
action and imperative candidates — the group that answers "has he proposed something outside the
twelve" would have vanished behind a `capped_at` that looked perfectly honest. The cap is now a
quota per group (150/100/50). The uncapped 2,025 are in `register_candidates_full.json` so the cap
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
- **The capped file is a strict subset of the uncapped one**, 300 ⊂ 2,025, verified by key.

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

---

## 8. Correction, after review by the other CC session

Added 2026-08-30 12:48 UTC. The session that ran B8/B9 reviewed this report. Two claims were
contested; **one of theirs was right and one of mine was.**

### 8.1 They were right: the Pass A column double-counted three videos

`soNnF0sjF5Y`, `jnsiLNNL8s8` and `8veLovq5NWQ` carry two transcripts each, and B10 counts a hit from
**each** source — which the brief requires, and which is correct for the candidate list. It is wrong
for a *count*. Fourteen of the 32 terms were inflated. Group totals as distinct moments: imperative
**47** not 60, action **32** not 42, target **30** not 39.

**The bias ran in the worst possible direction.** The inflation fell entirely on the three videos
that already have a second transcript, i.e. the ones needing no further TurboScribe credit — in a
table whose only job is choosing where the next credit goes.

`term_totals` now carries `pass_a_distinct` and `pass_b_distinct` alongside the occurrence counts,
and the JSON carries `two_transcript_videos` so the assumption is checkable rather than assumed.

**Pass B is unaffected and was verified, not assumed:** all three two-transcript videos are in Pass
A, and `pass_b === pass_b_distinct` for all 32 terms. So §3's candidate counts, §4's action-verb
video ranking and §5's outside-the-twelve scoring all stand unchanged.

**Their false start is the more useful half, and I took their fix rather than repeating it.**
Merging overlapping time ranges looks obviously right and is wrong: the two engines segment
differently, so their cue boundaries interleave and a merge *chains* — asr 229–305, turboscribe
234–314, asr 305–381 collapse into one interval. They measured a 2.5× undercount replacing a 2×
overcount. Max-over-sources cannot chain, equals what a single-transcript video reports, and is
declared as a floor.

### 8.2 I was wrong: he says "the **Equalities** Act", and all three of my checks were literal

I answered their first `equality act` correction by asserting 0 and calling it settled by three
independent checks. **The 0 was wrong and all three checks were blind in the same way.** He says
*"…the human rights act, the equalities act…"* — `jnsiLNNL8s8` at 5:17, in both transcripts,
naming two statutes in one breath.

| my check | result | why it could not see it |
|---|---|---|
| cue-stream regex `\bequality[\s,]+act\b` | no match | literal; multi-word terms had no inflection |
| `ILIKE '%equality act%'` | NONE | literal |
| every cue containing "equality" | 1, the DEI line | literal — "equalities" is a different string |

**Three checks that share an assumption are one check.** I presented them as independent because
they used different mechanisms; they were not independent, because every one of them was literal.
The check that settles it is on the **stem** — `~* '\yequal[a-z]*\y'` returns 6 cues in the eight
videos, and the two Equalities Act ones are in there. That is the query that cannot come back empty
for the wrong reason, and it is the one I should have run when challenged.

Their `phraseto_tsquery` found it because Postgres matches adjacent **stems**, not words:
`'equal' <-> 'act'` is satisfied by "Equalities Act". Here the looser tool was the correct one.

**Corrected, and it goes further than the one row.** Multi-word terms now match controlled inflected
forms. Corpus-wide `equality act` rises from 116 to **134** occurrences — 15 "equalities act", 2
"equality acts", 1 "equalities acts". Pass B rises 116 → **132**. Pass A is **1 distinct moment**,
which is the other session's number.

⚠ **The general defect, which is the part worth keeping.** A term matching is not the term being
said. `surface_forms` in the JSON now records every distinct string each pattern actually matched,
and **147 of 389 candidates contain a non-literal match**: `quango` is 112 "quangos" against 39
"quango"; `restore` is 148 "restoration" against 110 "restore"; `scrap` picks up "scrape" and
"scrappy". Every candidate carries `matched_surface` and `all_literal` — **check `all_literal`
before quoting a measure by name.**

⚠ Adding phrase inflection also introduced a false positive I caught by printing the surfaces rather
than trusting the pattern: `I would` matched **"is would"** three times, because pluralising the
one-letter word `I` produces `is`. Words under three letters are no longer inflected. This is the
same lesson twice in one section — **print what a pattern matched; never infer it.**

### 8.3 What this changes for CCW

Nothing in the disposition. Every number that moved, moved **down**, and every zero was already
zero — so "the thesis series barely names the statutes" is now better supported than when I wrote
it. The candidate JSON is unchanged in structure; only `term_totals` gained columns.
