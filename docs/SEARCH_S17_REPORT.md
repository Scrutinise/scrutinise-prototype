# SEARCH S17 — THE INSTRUMENT, THE `other` TIER, AND THE FLAGS

**Sprint:** SEARCH S17 · **Executes:** `BRIEF_SEARCH_S17.md` (S16 D-2, D-3, and the `/api/health`
capability offer) · **Written:** 2026-08-28 · **Report of record for this sprint.**

---

## THE HEADLINE, IN THREE SENTENCES

1. **The committees answer keys are re-keyed and every one of the fifty new keys was read back out
   of R2 and confirmed.** `docs/GOLD_COMMITTEES_REKEY.md`. **Nothing is scored** — the gold set is
   unchanged until Charlie validates it, which is what the brief asks for.
2. ⚠⚠ **S16'S `UNREACHABLE` CLASS IS ZERO, NOT FOUR — AND THE THING THAT MADE IT FOUR IS STILL IN
   THE TREE.** `cps-guidance` has been in the `guidance` tier of the served index since 21 August,
   and the guidance stream returns all three of its keys today. The autopsy called them unreachable
   because it read a tier artefact generated **one day before** the re-tier, and because it
   re-implemented the scope test in a way that cannot see an extra leg. Both are fixed.
3. **`/api/health` now reports every capability flag as the app resolves it**, closing a blindness
   that has cost this project three separate incidents. `npm run check:s17-flags` — **11 passed**,
   with the leak detector watched catching a planted secret and one of my own assertions caught
   being wrong about the world.

**No recall figure is published in this report and none is superseded.** §4 says why.

---

## §0 — THE CONFIGURATION EVERY NUMBER BELOW WAS TAKEN UNDER

Recorded in the artefacts themselves (`docs/census/s17-other-tier.json`), not in memory of the run:

```
[capabilities] QUERY_EXPANSION=off QUERY_ROUTER=off WEB_ORIENTATION=off SEARCH_VECTOR=off
SEARCH_RERANKER=off SEARCH_GRAPH=off COHERENCE_CORPUS=off SEARCH_STUB=off TIER_FUSION=off
BUILD_PERSPECTIVES=off ROUTER_STREAMS_V2=off STATS_STREAM=off FUSION_WEIGHTS=off
SEARCH_JUDGED_MERGE=off ROUTER_CONFIDENCE=off
| VECTOR_SEARCH_URL=set LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees GEMINI_API_KEY=set
| FTS_SEARCH_URL=set
degraded: (none)
fts-serve: fts-serve-production-4cea.up.railway.app, build S16-fts-cancel-bounded
```

⚠ **The §2b ranks were taken twice, once degraded and once not, and both are printed** — because the
first run had `LEX_VECTOR_STREAMS` unset and was therefore BM25-only. S14 published a fortnight of
figures that described a keyword-only system; the difference is recorded rather than smoothed over.

---

## §1 — THE KEY-KIND DISTRIBUTION, PER COLLECTION

**This is the durable artefact, and it comes first because it is how a second instance would be
found.** `npm run audit:s17-kinds` (`scripts/audit-s17-key-kinds.ts`) reproduces every figure.

**69 recall questions · 95 distinct keys · 95 resolved in `corpus_sections` · 0 absent.**

| collection | n questions | keys | kind mix | off-kind | group size (basis) |
|---|---:|---:|---|---:|---|
| caselaw | 10 | 10 | judgment 10 | **0.0%** | median 1 · max 1 (id-prefix) |
| **committees** | 10 | 19 | ⚠ **correspondence 10** · written evidence 7 · report 2 | **52.6%** | median 2 · **max 525** (parent/inquiry) |
| consultations | 9 | 11 | consultation 11 | **0.0%** | median 1 · max 1 (id-prefix) |
| debates | 11 | 14 | debate speech 14 | **0.0%** | **median 369 · max 3,594** (parent) |
| guidance | 10 | 11 | guidance page 11 | **0.0%** | median 1 · max 1 (parent) |
| impact-assessments | 9 | 18 | impact assessment 18 | **0.0%** | median 12 · max 57 (parent) |
| legislation | 10 | 13 | legislation provision 13 | **0.0%** | **median 200 · max 1,139** (id-prefix) |

**The primary kinds are DECLARED in the script, not inferred from the keys** — inferring them from
the data would define the defect away, because a collection whose keys are all of the wrong kind
would simply make that kind "primary".

### What it says

▶ **There is no second instance of the WRONG-KIND defect.** Committees is at 52.6% off-kind and
every other collection is at exactly **0.0%** — 76 keys across six collections, not one of them of a
kind its question does not ask for. S16's *"10 of 19 against 0 of 19"* holds when the question is
asked of all seven collections rather than two.

⚠⚠ **But the ONE-OF-MANY hazard is not confined to committees, and the group column is how you see
it.** Three collections carry keys drawn from large groups:

| collection | group | what a large group means there |
|---|---|---|
| committees (evidence) | the **inquiry** | ⚠⚠ **The defect.** 525 submissions all answer *"what did witnesses tell the committee about SEND"*. Perfect retrieval scores wrong ~96% of the time. |
| debates | the **sitting day** (median 369, max 3,594) | ⚠ A hazard, not a defect. The other speeches that day are not equally valid answers — but a hit on a *different speech in the right debate* scores wrong while giving the user what they asked for. |
| legislation | the **Act** (median 200, max 1,139) | ⚠ The same hazard, weaker: the other sections of the Act are usually not answers. |
| impact-assessments | the **document** (median 12) | ⚠ The same hazard, and the mildest: a hit on another chunk of the right impact assessment. |

**These are different problems with the same symptom and they must not be treated alike.** The
committees case is fixed by re-keying, because the siblings genuinely are equal answers. The other
three are fixed — if at all — by a **document-level match rule** in the scorer, which is D-1 below.

⚠ **The first version of this measurement printed `1` for caselaw and legislation and the 1 was a
default.** Those corpora carry a NULL `parentDocId`, the lookup missed, and `?? 1` supplied a number
that looked measured — "this key is one document out of one" is the strongest possible result and it
was arriving from an absent field. Legislation's real figure is **median 200**. A row whose group
cannot be determined now prints `n/a` and is counted.

---

## §1b — THE RE-KEY ITSELF

**`docs/GOLD_COMMITTEES_REKEY.md`**, generated by `npm run rekey:s17`. Ten questions, one VERDICT
line each, the keyed document's own text printed underneath.

**What the run counted:** questions re-keyed **10** · keys proposed **50** · bodies read out of R2
**50** · bodies containing their declared confirming term **50** · keys with no row or no readable
body **0** · keys whose body reads as front matter **0**.

⚠ **That last zero is only worth having because the detector was watched firing.**
`npm run rekey:s17-selftest` runs it against two chunks known to be cover pages and one known to be
substantive: **3 of 3 as expected**, two FLAG and one silent.

### The rule applied, stated so it can be argued with

> **A key set must contain every document in the corpus that answers the question as posed.** If
> that set is small and enumerable, key all of it. If it is large, the QUESTION is under-specified
> and the question is what changes. Keying one arbitrary member of a large set marks the platform
> wrong every time it is right.

| # | verdict | what changed |
|---|---|---|
| C1 | KEEP, KEYS NARROWED | ⚠ The one key that was right all along is **the report's cover page** — crest, membership list, clerk's phone number, contents. It retrieves because it carries the title and it answers nothing. Dropped; the Summary and the finding keyed instead. **This may turn a pass into a fail, and that would be the truer reading.** |
| C2 | RE-KEY | letter → the Business and Trade Committee's 16th Report on Horizon redress |
| C3 | KEEP, KEYS WIDENED | ⚠ **The one correspondence key that was always right, and S16 swept it up with the others.** *"What has Parliament been TOLD"* asks for a letter. The defect was 1-of-8, not wrong-kind. All eight keyed. |
| C4 | RE-KEY | letter → PAC's *Progress in implementing Universal Credit* |
| C5 | RE-WORD AND RE-KEY | *"Has anyone raised leasehold with ministers"* is answered by any of a dozen letters and its answer is "yes". Re-worded; keyed to the pre-legislative scrutiny report's conclusions. |
| C6 | RE-WORD AND RE-KEY | 1 of **115** → names the Ada Lovelace Institute |
| C7 | KEEP, KEYS WIDENED | all **26** submissions keyed. ⚠ Says what it measures: reachability, not ranking. |
| C8 | RE-WORD AND RE-KEY | 1 of **525** → names the National Association of Head Teachers |
| C9 | RE-WORD AND RE-KEY | 1 of **54** → names the National Police Chiefs' Council |
| C10 | RE-KEY | two letters → the **five** PAC reports on NHS waiting times, 2014–2025, all keyed |

### Two findings that came out of doing it

⚠ **A `%Grenfell%` title match takes `publication:22805` — correspondence from *Michael Grenfell* of
the CMA about EU-exit regulation.** A surname, not the tower. A re-key done by title substring would
have keyed it, and nothing downstream would ever have said so.

⚠⚠ **The leasehold report is held THREE TIMES: standard (101 chunks), Large Print (114 chunks) and
Easy Read (2 chunks), as three separate documents.** A hit on the Large Print copy scores WRONG
today while handing the user the right report. **This is this sprint's own defect arriving from the
ingest side** and is reported, not fixed — `scrutinise-web` does not own the corpus.

---

## §2 — THE `other` TIER: ENUMERATED, AND THE PREMISE REFUTED

`npm run audit:s17-other` (`scripts/audit-s17-other-tier.ts`). **Twelve collections probed. Every
tier below is read back off `fts-serve` from hits the service itself returned, carrying their own
`tier` field — not from an artefact.**

| collection | Neon rows | artefact tier (20 Aug) | **SERVED tier** | display type | streams that admit it |
|---|---:|---|---|---|---|
| scottish-parliament-or | 1,044,188 | other | other | DEBATE | **debates** (extra leg) |
| early-day-motions | 60,737 | other | other | DEBATE | **NONE** |
| petitions | 49,529 | other | other | DEBATE | **NONE** |
| cma-cases | 22,898 | other | ⚠ **guidance** | GUIDANCE | guidance |
| ofgem | 17,161 | other | ⚠ **guidance** | GUIDANCE | guidance |
| ofcom | 4,169 | other | ⚠ **guidance** | GUIDANCE | guidance |
| members-interests | 3,448 | other | other | **null** | NONE (excluded by design) |
| erskine-may | 2,038 | other | other | GUIDANCE | **guidance** (extra leg) |
| independent-reviews | 667 | other | ⚠ **guidance** | GUIDANCE | guidance |
| **cps-guidance** | 270 | other | ⚠ **guidance** | GUIDANCE | **guidance** |
| inquiry-evidence | 90 | other | ⚠ **guidance** | GUIDANCE | guidance |
| lgsco | 40 | other | ⚠ **guidance** | GUIDANCE | guidance |

**Seven of the twelve disagree with the artefact.** They are S11's re-tier, which landed on 21
August — **one day after `corpus_reachability.json` was generated.**

### §2b — the four questions S16 called UNREACHABLE, asked again through the owning stream

Not a re-classification from a table. The stream is searched and the rank of the key in what it
returned is printed, out of how many results.

| id | stream | BM25-only (degraded) | fused BM25+dense (production config) |
|---|---|---|---|
| S10-Q25 | guidance | **rank 36** of 100 | **rank 70** of 100 |
| S10-Q26 | guidance | **rank 2** of 100 | **rank 34** of 100 |
| S10-Q27 | guidance | **rank 18** of 100 | **rank 33** of 100 |
| V2-Q8 | debates | not found in 100 | not found in 100 |

⚠ **The question is asked RAW here; the measured run routes it first, so these are evidence about
REACHABILITY and are not comparable with an in-stream rank.** ⚠ **And do not read the two columns as
"dense is worse":** n=3, one raw query each, and no control. It is recorded because it was observed,
not because it is a finding.

### So: the mapping, one line of reasoning each

| collection | proposal | why |
|---|---|---|
| scottish-parliament-or | **no change** | already reached by the debates stream's extra leg; S16's contrary note came from a copy of the scope test that cannot see extra legs |
| cps-guidance | **no change** | already in the `guidance` tier and returned by the guidance stream; the fix landed in S11 and nobody re-read the index |
| cma-cases, ofgem, ofcom, independent-reviews, inquiry-evidence, lgsco | **no change** | same re-tier, same stream, already reachable |
| erskine-may | **no change** | parliamentary procedure, deliberately an extra leg on `guidance` rather than a tier member |
| members-interests | **no change** | `EXCLUDED_BY_DESIGN` with a written reason — named individuals against declared financial interests, a people-graph input |
| early-day-motions (60,737) | **no change, and it is a DECISION not an oversight** | `DEFERRED_TO_GRAPH`: *"a named list of members endorsing a proposition on a date — a high-confidence position-graph edge, not a document to retrieve and read"* |
| petitions (49,529) | **no change**, same | `DEFERRED_TO_GRAPH`: *"the same shape as an EDM but for public salience"* |

▶▶ **THE ANSWER TO D-2 IS THEREFORE: NOBODY NEEDS TO FIX THE `other` TIER. NEITHER AN INGEST RE-TIER
NOR A SCOPE WIDENING.** The two collections the brief names are already reachable; the two that are
not reachable are deliberately so, with reasons on record. **A scope change made on S16's account
would have widened a stream to admit collections it already admits.**

⚠ **What was counted, and what was not.** The served tier for each collection is read off the top
40 hits of one corpus-prefiltered query (2 for `lgsco`, which holds 40 rows). For `cps-guidance` that
is 40 of 270 rows, all `guidance`. It is not an exhaustive scan and does not prove that no row of any
of these collections is still under `other`.

### What was fixed so this cannot recur

`scripts/autopsy-s16.ts`, two changes:

1. ⚠⚠ **`admits()` was a re-implementation and it disagreed with the function the router dispatches
   on.** It compared `s.tier !== tier` FIRST and never looked at `extraCorpora` — but an extra leg
   is a second, corpus-only retrieval call that skips the tier prefilter, which is exactly why
   `streamCanSelect` tests it before the tier. `stream-scopes.ts`'s own header warns about this
   ("a copy is how the matrix would keep saying reachable for a month after someone narrowed a
   filter"); this was that failure from the other direction — **the copy said UNREACHABLE where the
   original says reachable.** The scope test is now imported.
2. **The tier now comes from `docs/census/s17-other-tier.json` where that file exists**, with the
   provenance of every overridden collection printed. A tier from a week-old file and a tier read
   off the serving index must not look alike on the page.

### The corrected class distribution

`npm run autopsy:s17-recount` → `docs/census/s17-autopsy-recount.json`. **Same 32 failures, same S15
arms data, same 64 questions — only the tier source and the scope test changed.**

| class | S16 published | **S17 recount** | why it moved |
|---|---:|---:|---|
| ABSENT | 1 | **1** | — |
| **UNREACHABLE** | **4** | **0** | all four were reachable |
| NOT-ROUTED | 4 | **5** | S10-Q27: guidance admits it, the router sent the query to caselaw |
| RANKING | 4 | **6** | S10-Q25 and S10-Q26, retrieved at in-stream 27 and 22 — outside the 20-window, not outside the corpus |
| NOT-MATCHED | 19 | **20** | V2-Q8, searched by debates and not returned |
| *(unit modifier)* | *12* | **15** | ⚠ arithmetic, not a new finding: the modifier is only set on NOT-MATCHED and RANKING, and three of the four reclassified questions are ≥1,500 words (4,680 · 3,878 · 2,084). 12 + 3 = 15. |
| **owned by search** | 12 | **11** | |
| **owned by search/argument** | 19 | **20** | |

⚠ **`SEARCH_S16_REPORT.md` §2's UNREACHABLE table and D-2 are superseded by this section.** S16's
artefact `docs/census/s16-autopsy.json` is left exactly as it was — the recount is written to its own
path, because overwriting another sprint's evidence is how a correction becomes unauditable.

---

## §3 — FLAG STATE, READABLE IN ONE REQUEST

`/api/health` now carries the resolved state of all **15** capability flags plus three presence
booleans, alongside the commit SHA it already reported.

```json
{ "status": "ok", "commit": "…", "env": "production", "mail": true,
  "capabilities": { "LEX_QUERY_ROUTER": true, "LEX_SEARCH_VECTOR": false, … 15 keys … },
  "retrieval": { "vectorSearchUrl": true, "ftsSearchUrl": true, "geminiKey": true } }
```

- ⚠ **Read through `capabilitySnapshot()`, which calls the same `flagEnabled()` every read site
  calls.** The endpoint reports what is **in force**, not what was **set** — the distinction that
  makes it worth building at all.
- **Names and booleans only.** No key, no length, no prefix, no model id, no URL, no stream list. A
  capability name is the same class of public fact as the commit SHA beside it.
- `retrieval` carries the three things that decide whether an ON flag can do anything, as presence
  booleans in the same class as the existing `mail`. A router that is on with no `GEMINI_API_KEY`
  degrades silently and the flags alone would still mislead.

**`npm run check:s17-flags` — 11 passed, 0 failed.** What it counted: 15 declared flags against 15
returned; 15 of 15 boolean; 563 bytes of payload scanned against 23 secret-shaped values in this
environment, 0 found.

⚠ **The leak detector was watched CATCHING one.** It plants a real secret value into the payload and
requires the scanner to name it — a leak detector that has never caught a leak is not a leak
detector. It named `ANTHROPIC_API_KEY`.

⚠⚠ **AND ONE OF MY OWN ASSERTIONS WAS WRONG ABOUT THE WORLD AND THE FIRST RUN CAUGHT IT.** I asserted
that a capitalised `TRUE` must report **false**, on the strength of the 2026-08-08 incident. It
reports **true** — correctly, because that incident was caused by read sites comparing `=== 'true'`
and `lib/env-flags.ts` was written to remove exactly that. The property that actually separates IN
FORCE from SET is a value that is set and **unrecognised**: `LEX_QUERY_ROUTER='enabled'` is truthy to
any naive `process.env` reader and is FALSE to the app, and that is the case now asserted. Both are
kept, so the check fails in both directions. The wrong version is recorded in the file rather than
quietly rewritten — **asserting that a fixed bug still exists is its own way of measuring nothing.**

`SEARCH_CONTRACT.md` §4's paragraph *"the live flag state is NOT readable from a development
machine"* is replaced with the request that now answers it, and says explicitly that the SAML block
on `VERCEL_TOKEN` is unchanged — what changed is that the answer no longer has to come from a
dashboard.

---

## §4 — MEASUREMENT: WHAT WAS NOT RE-RUN, AND WHY

**The 64-question baseline was NOT re-run and no recall figure is published here.** The brief is
explicit: re-run after §1's re-keys are *validated by Charlie*, not before, and *"if they are not
back in time, report without them and say so — do not score against unvalidated keys."* They are not
back. This is that sentence.

**S15's baseline stands as the figure of record** (in-stream@20 **32 of 64**; judged+reranker **30 of
64**; today's production configuration **19 of 64**). Nothing in this sprint changes it, because
nothing in this sprint changed retrieval: no scope was widened, no flag was flipped, no index row was
rewritten.

⚠⚠ **WHEN THE RE-KEY IS VALIDATED AND THE BASELINE IS RE-RUN, EXPECT THE HEADLINE TO RISE FOR A
REASON THAT IS NOT AN IMPROVEMENT IN SEARCH.** Re-keying committees fairly should raise the number
because the instrument was wrong, not because retrieval got better. Anyone reading that rise as a
retrieval gain will be reading it wrong, and the report that publishes it must say so in those words.

⚠ **A second, smaller version of the same warning applies to C7 and C10**, which now carry 26 and 5
keys. Those questions get easier by construction. C7's own entry says what it measures —
reachability, not ranking — and any per-collection figure that includes them should repeat it.

---

## §5 — WHAT IS NOT DONE, NAMED

1. **The gold set is unchanged.** `scripts/gold/s10-gold-set.ts` still holds the old committees keys
   and questions. The re-key is a proposal in a file; landing it is a separate, small change after
   validation, and `scripts/check-s10-gold.ts` asserts the file agrees with
   `docs/GOLD_CANDIDATES_S8.md`, so **the markdown of record has to move with it.**
2. **No recall measurement of any kind.** See §4.
3. **The document-level match rule is not built** (D-1). Until it is, C2, C4, C5 and C10 are keyed to
   the two-or-so chunks that were actually read, and a hit on a different chunk of the *same correct
   report* still scores wrong.
4. **The `other`-tier tier reads are samples, not scans** — 40 hits per collection (2 for `lgsco`).
   A full scan of `corpus_fts` projecting (corpus, tier) is what `corpus-reachability.ts` does and it
   was not re-run; the artefact it produced is now eight days old and **wrong for seven
   collections**, and regenerating it is D-3.
5. **The debates and legislation group-size hazards are measured and not addressed** (§1). They are
   not the committees defect and should not be re-keyed on this sprint's account.
6. **The three CPS questions are reclassified, not fixed.** Two are RANKING and one is NOT-ROUTED;
   nothing was done about either.
7. **`/api/health`'s new field is not verified live** — it has not been pushed at the time of
   writing. §20 check 4 is the gate and it is named in the delivery section below, not claimed.

---

## DECISIONS FOR CHARLIE

**D-1 — Add a DOCUMENT-LEVEL match rule to the scorer?** *(Recommended: yes.)*
Today a key is a chunk id. A committee report is 33 chunks, an Act is 200 sections, a sitting day is
369 speeches. Retrieval that returns **the right report at the wrong paragraph** is scored wrong.
The change is small: score a hit when the returned row's `parentDocId` (or id-prefix, where
`parentDocId` is NULL) matches the key's, and record both figures during the transition.
*Consequence of yes:* the committees and legislation numbers rise, again for an instrument reason,
and the report saying so has to say it twice. *Consequence of no:* four of the ten re-keyed questions
stay keyed to two chunks of a thirty-chunk document and keep the defect this sprint exists to remove,
in miniature.

**D-2 — Validate the ten re-keys?** *(Recommended: yes, and it is the gate on everything else.)*
`docs/GOLD_COMMITTEES_REKEY.md`, ten VERDICT lines with the document's own words printed underneath.
Three questions are re-worded and seven keep their wording. *Consequence of yes:* the gold set is
landed, the baseline is re-run, and committees becomes measurable for the first time.
*Consequence of no:* our largest evidence collection keeps reporting 2 of 10 while working, and every
sprint keeps aiming at a retriever that is not the problem.

**D-3 — Regenerate `corpus_reachability.json`?** *(Recommended: yes, and soon.)*
It is the input three scripts trust for the indexed tier, it is eight days old, and it is **wrong for
seven collections** — which is what produced a published failure class of four that should have been
zero. It is a full scan of `corpus_fts` and `corpus_vec` (18M and 22M rows) and belongs on a machine
that can hold it (§17). *Consequence of no:* the next thing to read it inherits the same wrong tiers,
and the S17 override only covers the twelve collections this sprint probed.

**D-4 — Should `/api/health` also report the resolved `LEX_VECTOR_STREAMS` list?** *(Recommended:
yes, as a list of stream names.)*
§3's rule was names and booleans, so it is deliberately not there. But that one string being silently
empty is what made a fortnight of S14 figures describe a keyword-only system, and stream names are
not account configuration — they are `legislation`, `caselaw`, `guidance`, `committees`.
*Consequence of yes:* the single most consequential piece of search configuration becomes readable in
the same request as the flags. *Consequence of no:* "is dense retrieval live in production?" stays a
question only the dashboard answers, and the endpoint answers the easier half of it.

**D-5 — Does C7 stay a set-answered question with 26 keys?** *(Recommended: yes, labelled.)*
*"What evidence was submitted about net zero and trade?"* is a real question and all 26 submissions
answer it. With 26 correct answers in a 20-wide window it tests reachability rather than ranking, and
its entry says so. *Consequence of yes:* one committees question is easy by construction and must
carry that label wherever it is reported. *Consequence of no:* the archetype disappears from the set
and all four evidence questions become named-submitter lookups.

---

## STANDING-RULE NOTES

- **Every guard states what it counted.** The re-key run prints keys proposed / bodies read / terms
  found / missing / front-matter. The kinds audit prints questions, keys, resolved, absent, and the
  basis of every group figure. The flags check prints bytes scanned and values compared. None of them
  asserts that something exists.
- **Every check was watched failing.** The front-matter detector fires on two known cover pages and
  stays silent on a substantive chunk (3/3). The leak detector names a planted secret. The in-force
  assertion passes on `'true'`/`'TRUE'` and fails a naive reader on `'enabled'`.
- ⚠ **Two of my own instruments were wrong and both were caught by running them.** A group-size
  column printed a default as a measurement; an assertion required a fixed bug to still exist. Both
  are recorded in place.
- **A negative result is reported as a result.** There is no second instance of the wrong-kind
  defect — 0.0% off-kind across six collections and 76 keys — and that was worth measuring even
  though it found nothing.
- ⚠ **Auto-deploy on `vector-serve` was NOT triggered and I checked before saying so.** This sprint
  edits **no file under `scripts/ingest/search/`** — every new script is under `scrutinise-web/`. No
  measurement was interrupted and no service was restarted.
- **Git:** no git during the sprint; one `commit-search-s17.sh`, scoped by explicit path.
- **Delivery:** `tsc --noEmit` clean; `scripts/check-clean-build.sh --fast` PASS (0 cross-package
  files). §20 checks 1–4 are run against the push, not claimed in advance.
