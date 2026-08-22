# SEARCH S12 — A SAFE WAY TO REPLACE EMBEDDINGS

**Executes:** `docs/BRIEF_SEARCH_S12.md` §0–§7.
**Date:** 2026-08-21. **Author:** CC-Search.

---

## §0 — THE CONFIRMATION THE BRIEF ASKED FOR, AND IT CHANGED MID-SPRINT

⚠ **This section originally read "GOLD V2 has NOT been validated." Charlie validated it on
22 August, so the answer — and the question set §3 must use — changed while the sprint was running.
Both states are recorded rather than the earlier one being overwritten.**

**GOLD V2 is validated: 24 of 24 reviewed — 22 ACCEPT, 2 AMEND, 0 REJECT.**

⚠ **The two AMENDs are applied, not counted as accepts.** A set that recorded an amendment as an
acceptance would be scoring questions nobody approved in that wording:

| | as drafted | as validated |
|---|---|---|
| **Q6** | "…bringing back **hanging**?" | "…bringing back **the death penalty**?" |
| **Q12** | "Can my landlord **make me leave**…?" | "Can my landlord **evict me**…?" |

⚠⚠ **Q6's amendment also reclassifies it, and the count moves with it.** It was one of the nine
questions deliberately phrased in words the document does not use — but "the death penalty" **is**
the document's own wording (`DEATH PENALTY (ABOLITION) BILL`). So it is no longer a
vocabulary-avoided question and that count drops **9 → 8** (§3 of the gold brief requires ≥3).
Charlie's wording is plainly the better question; the reclassification is recorded so the ≥3
requirement is not quietly made to look larger than it is.

### So §3's baseline uses the ENLARGED set, and this report names it wherever a number is quoted

| set | questions | streams covered |
|---|---:|---|
| `SCOREABLE` (`gold/s10-gold-set.ts`) | 44 | committees 10 · guidance 10 · impact-assessments 9 · consultations 9 · caselaw 6 |
| `SCOREABLE_V2` (`gold/gold-v2-set.ts`) — **new** | **21** | **debates 11 · legislation 10** |
| **combined, recall-scoreable** | **65** | |
| negative controls (behaviour-scored; **a 0% is a PASS**) | 3 | excluded from `SCOREABLE_V2` by construction |

✅ **`debates` and `legislation` have questions for the first time.** That closes the gap that has
held S10's §2 decisions for those two streams on absence of evidence since the set existed.

**Transcribed** to `scrutinise-web/scripts/gold/gold-v2-set.ts`, with **`npm run check:goldv2`**
asserting the transcription against the document Charlie signed off — same ids both ways, every
question text character-for-character, every verdict, every key, and the negative controls carrying
none. **24 questions · 27 keys · both directions · no sampling · ALL CHECKS PASS.**

⚠ **The keys are taken from `verify-goldv2-keys.ts`, not from the prose.** The markdown abbreviates
shared prefixes with an ellipsis (`…:78`), so a regex over the document silently drops keys — it
found 24 of 27 when tried. The verified list, every entry of which was read back out of R2, is the
authority and the check asserts both directions against it.

---

## §1 — THE REPLACE PATH: THE DESIGN DECISION, AND WHY THE OTHERS LOST

**This is the sprint's durable artefact, and it starts by correcting the premise it was given.**

### ⚠⚠ There is no global chunk numbering. The brief's diagnosis does not match the code.

The brief states the problem as: *"Chunks are numbered in one continuous sequence across the whole
corpus … Re-cutting one collection changes how many chunks it has, which shifts every number after
it … Vectors simply start describing different text than the one they are attached to — a match on
one passage displays another."*

Read the code. `scripts/ingest/search/vector-common.ts:53`:

```ts
export function chunkId(sectionId: string, k: number): string { return `${sectionId}#${k}` }
```

**A chunk id is content-addressed** — the section's own id plus its ordinal *within that section*.
Every read and write keys off it, not off a position:

```
build-vector-index.ts:158   .where(`chunkId >= '…lo' AND chunkId <= '…hi'`)          ← fetch
build-vector-index.ts:176   vecTbl.delete(`chunkId >= '…lo' AND chunkId <= '…hi'`)   ← write
```

So re-cutting collection A **cannot** cause collection B's vectors to describe someone else's text.
What is global is the **shard plan**: `build-vector-index.ts:140` slices the sorted id list by
ordinal position, and the checkpoint records only the shard *index* (`doneShards: number[]`). Change
any count and index 417 denotes a different range than when it was marked done — so a **resume
against a stale checkpoint** skips ranges and repeats others. That is a coverage fault, confined to
resumes, and it is a real hazard; it is not the mislabelling hazard the brief described.

### And the blast radius is 0.31%, measured rather than asserted (§1 audit item 2)

`tna-caselaw` sorts **69th of 74**. Chunks whose ordinal position moves at all:

| collection sorting after `tna-caselaw` | chunks |
|---|---:|
| `uk-treaties` | 12,543 |
| `uk-treaties-fcdo` | 56,215 |
| `written-answers` | 1,138 |
| `written-statements` | 994 |
| **total** | **70,890 of 22,689,587 — 0.31%, 2 shards of 568** |

### What actually goes wrong, which is a different list

| | risk | guarded by |
|---|---|---|
| **R1** | ⚠⚠ **Orphan vectors.** Re-cutting a shortened document leaves `…#6`, `…#7` in `corpus_vec` with no chunk behind them. `vector-query-service.ts:229` returns hits keyed by **sectionId** and hydrates the snippet from the section's *first* chunk — so an orphan does not display someone else's text, it makes a section **retrievable because of a passage it no longer contains.** A stale relevance signal no row count reveals. | **G1** |
| **R2** | Stale-checkpoint resume (above). | avoided by construction — own checkpoint, per corpus |
| **R3** | **Re-chunk without re-embed** — same chunkId, new text, old vector. *This* is the one that really does attach a vector to text it does not describe, and it is the brief's "both halves or neither". | **G2** |

### The three designs, and why two lost

| | design | verdict |
|---|---|---|
| **A** | *Stable per-collection chunk identifiers so numbering is never global.* | **Already true**, £0, nothing to build. The option only looked necessary because of the global-numbering premise. |
| **B** | *Recompute shard boundaries from the table* — store `lo`/`hi` in the checkpoint instead of the ordinal index, so a resume is correct whatever the counts. | Correct and cheap (~20 lines). **Lost on blast radius:** it edits the full-rebuild path — the most expensive script in the repo to get wrong, and the one holding a $430–520 button — to fix a resume hazard that the chosen design does not create. ▶ **Recommended as a standalone follow-up.** |
| **C** | *A collection-scoped replace that never consults the global plan.* | ✅ **CHOSEN.** Same shape as S11's `fts-refresh.ts` on the keyword side: bounded blast radius, its own per-corpus checkpoint, no change to the fragile path, prices itself before spending, and stops at a `--max-cost` ceiling. |

Built as **`scripts/ingest/search/vec-replace.ts`**.

### ⚠ One design fault found during the run, reported rather than patched mid-flight

Phase 1 deletes the collection's chunks in **one statement** before re-cutting, so for the ~25
minutes of the re-cut `corpus_chunks` holds no case-law rows and snippet hydration for that
collection would return empty. Phase 2 does **not** have this problem — it deletes per shard, so at
most one shard's worth of vectors is absent at any instant, which is the trade
`refresh-fts-caselaw.ts` made on the keyword side.

Phase 1 should do the same. **It was not changed once the run was in flight**, because shipping an
unexercised edit in the same commit as a proven one is how a fix becomes an incident. ▶ Named as a
follow-up. ⚠ The mitigating fact is *not* that "`vector-serve` holds its tables from boot so nobody
would notice" — S11 made that argument about `fts-serve` and then watched `fts-serve` restart
itself mid-sprint.

### The pilot — proven on a small collection before anything was spent (§1)

`inquiry-evidence`, 89 sections. To exercise the case that matters, the pilot forced a **real**
count change (`PILOT_MAX_CHUNKS=3`) rather than a no-op re-cut — a plain re-cut of an untouched
collection reproduces its chunks exactly, and would have proved nothing.

1. **`--chunk` alone → 446 chunks became 225, and the guards went RED**, as they must:
   `G1 orphan vectors: 221 ❌ · G3 counts equal: 225 vs 446 ❌`. **This is the genuine intermediate
   state the brief calls worse than doing nothing, not a planted one** (§6).
2. **`--embed` → green:** `G1 0 ✅ · G2 0 ✅ · G3 225 = 225 ✅`.
3. **Isolation — the assertion that matters:** *"a boundary shift is invisible in the collection you
   touched and visible only in the ones you did not."* `check-s12-isolation.ts` compared **74 of 74
   collections, every row of both tables, no sampling**: **0 unexpectedly changed**, with the four
   collections sorting after the pilot checked and named individually.
4. Restored to the default cut: **446 = 446, all green.** Pilot spend **$0.038**.

⚠ **The orphan-sweep branch did not execute in the pilot** — with a single shard, its `[lo,hi]`
range spanned every old id. G1 is the guarantee either way and the script exits non-zero if any
orphan survives, so the sweep cannot fail silently; but the branch is unexercised and is named here
rather than described as tested.

---

## §2 — THE CASE-LAW RE-EMBED

### Predictions, logged before the run

| | predicted | measured |
|---|---|---|
| chunk count after re-cut | **480,000–520,000** (−7% to −14%) | **539,454 (−18,779, −3.4%)** ⚠ **REFUTED** |
| cost | ~$31 (the S11 estimate) | **$31.88 estimated** |
| chunk 0 is judgment text | 30/30 | *(below)* |

⚠ **Why the chunk prediction was wrong, and it is the more useful fact.** I reasoned that removing
12.7% of the embedded text would remove a comparable share of chunks. It does not, because **the
documents in question were hitting the 8-chunk cap** (242 of 300 sampled, per the ingest report). A
capped document still caps after the stylesheet is removed — so the gain is **not fewer chunks, it
is more judgment text fitting underneath the cap**. The ~417 words per capped document that never
reached the embedder now do. The count barely moves; what is *in* the chunks changes completely.

⚠ **2 body misses of 74,896** — matching exactly the two documents the ingest sprint found the
National Archives publishes with no text at all (`uk:hash` = SHA-256 of the empty string). An
independent corroboration of someone else's finding, from a different direction.

### The run

**Phase 1 (re-cut) — COMPLETE, and it landed on the plan exactly.**

```
sections (compiled)      74,896
chunks written          539,454      ← the --plan figure, to the row
body misses                   2      ← the two documents the source publishes with no text
checkpoint            phase=embedding, resumable
```

**Phase 2 (embed) — IN FLIGHT.** 539,454 chunks → 14 shards of 40,000. ⚠ At ~788 tokens per
case-law chunk, a 40,000-chunk shard is ~31.5M estimated tokens, far above the Batch tier's
enqueued-token ceiling — so `embedShardViaBatch` splits each one transparently:

```
[gemini-batch] tna-caselaw-shard-0: ~31,469,493 est tok > job budget — 7 sequential sub-jobs
```

That is ~98 sequential batch jobs in total, each with its own upload → create → poll cycle. **This
is a multi-hour run**, and it is the reason §3 could not be taken in the same session.

⚠ **A "killed" notification for this job was FALSE and was checked rather than believed.** The
log grew 248 bytes over a 45-second window immediately afterwards, and the run had in fact just
crossed from phase 1 into phase 2. This project has had 9 such notifications, 7 of them false; the
45-second delta is the cheap way to settle it and it is worth the 45 seconds every time.

### ⚠⚠ IF THIS RUN DID NOT FINISH — THE STATE IT LEAVES, AND HOW TO FINISH IT

Interrupted mid-embed, `tna-caselaw` is in exactly the state the brief calls *worse than doing
nothing*: **new chunks, partly-old vectors**. That is R3, and it is visible rather than silent —
`--verify` reports G1/G2 red until the run completes.

```
cd scripts/ingest
npx tsx search/vec-replace.ts --corpus=tna-caselaw --verify              # is it finished?
npx tsx search/vec-replace.ts --corpus=tna-caselaw --embed --max-cost 40 # resume — NO --reset
```

⚠ **Do not pass `--reset`** on a resume: it discards the checkpoint and re-embeds every shard from
zero, at full price. The checkpoint records `doneShards`, so a plain `--embed` picks up where it
stopped and skips what is paid for.

---

## §2.1 ⚠⚠ A LIVE DEFECT FOUND WHILE ESTABLISHING THE RELOAD QUESTION — AND NEARLY MISATTRIBUTED

§2 says to establish whether `vector-serve` reloads on its own rather than assume it. Probing that
turned up something else: **`tna-caselaw` results were coming back with empty snippets**, while
`ni-judgments` — a different case-law collection, untouched by this sprint — returned real text.

**It looked exactly like the re-cut having lost the chunks.** It was not. Reading `corpus_chunks`
directly: 539,454 case-law chunks present, and chunk 0 of two sampled documents reading
*"Neutral Citation Number: [2025] EWHC 2205 (Admin) … IN THE HIGH COURT OF JUSTICE"* — judgment
text, exactly as intended.

The real cause is a **pre-existing bug in the serving path**, and the reproduction scales precisely
as its arithmetic predicts:

| request | empty snippets |
|---|---|
| `limit=1` | 0 of 1 |
| `limit=3` | **1 of 3** |
| `limit=10` | **5 of 10** |

⚠ **The same document has a snippet at `limit=3` and none at `limit=10`.** That is, word for word,
what `INGEST_CASELAW_TEXT_REPORT.md` recorded as *"its snippet hydration is inconsistent"* and
flagged for the search thread. **It is not inconsistency — it is a budget**, and this is the
mechanism:

```ts
.limit(sectionIds.length * 4)      // vector-query-service.ts, snippets()
```

The row budget is shared across all requested sections, but a section contributes **as many rows as
it has chunks** — up to `MAX_CHUNKS` (8). Case-law documents run to 8. So a few long documents
consume the whole allowance and every section after them gets **no row at all, and therefore no
snippet**. Not a truncated snippet — an absent one, rendered as an empty string that reads to a user
like a document with no text.

**Fixed** (`sectionIds.length * MAX_CHUNKS`, wired to the chunker's own constant so the two cannot
drift) and the function now **warns when any section gets no row**, because a blank snippet must not
be able to mean two different things silently. ⚠ **It requires the `vector-serve` redeploy that §2
already calls for**, so it costs no extra operational step.

⚠ **This is the second time in two sprints that bytes-before-hypotheses ran in the *exonerating*
direction.** The tempting reading was "my re-cut broke case-law snippets"; the table said otherwise
and the `limit` sweep identified a bug that predates the sprint.

### And the reload question itself, answered

Not fully. What is established: `vector-serve` has been up since at least 2026-08-20T06:27
(`peak_rss_at`), it opens both tables once at boot with no `readConsistencyInterval`, and it is
**still serving snippets for case-law sections whose chunks were deleted and rewritten during this
sprint** — so it is not tracking `corpus_chunks` version-for-version. ▶ **Treat a redeploy as
required**, as S11 concluded for `fts-serve`, and confirm it the same way: by a signal that moves.

---

## §3 — THE BASELINE

*(depends on §2 landing — see RESULTS)*

---

## §4 — THE DISPLAY-TYPE SWEEP

`scrutinise-web/scripts/sweep-s12-type-reachability.ts`. **Every collection classified, and the
section counts reconcile to the total** — 74 of 74, 18,521,164 of 18,521,164 — so nothing was
dropped by a filter (§6).

| verdict | collections | sections |
|---|---:|---:|
| reachable | **69** | 18,403,862 |
| TYPE-BLOCKED (no stream admits the type, whatever the tier) | **0** | 0 |
| TIER-BLOCKED (the S11 shape) | **0** | 0 |
| **NO-STREAM-PASSES-BOTH** | **2** | **3,588** |
| by-design (`members-interests`, `early-day-motions`, `petitions`) | 3 | 113,714 |

**The answer to §4's question: no, the accident does not reach further. Exactly two collections are
affected and they are the two already known** — `uk-treaties` (3,264) and `tax-treaties-dta` (324).
After S11 there is no remaining tier-blocked collection either.

### ⚠ And the classifier's first label was wrong, which changes the fix

I first classified them `BOTH`, meaning both axes blocked. That is false and I corrected it before
it reached this report. Their **tier is** owned by a stream (`debates` owns `parliamentary`) and
their **type is** admitted by a stream (`caselaw` applies no type filter at all). Each axis passes —
**just never in the same stream.** So the fault is not "nothing admits TREATY"; it is that no single
stream's (tier ∩ type) contains them. That materially widens the fix: admitting `TREATY` to the
`debates` stream would work, and so would moving them to a tier whose owner has no type filter.

### The proposal — separating rendering from routing. NOT implemented, per §4.

**The finding stands and is bigger than two collections:** `uk-treaties-fcdo`, **seven times
larger and the same material**, is reachable purely because it is typed `DEBATE`. Reachability is
being decided by a field chosen for how a document should be *rendered*.

| option | cost | consequence |
|---|---|---|
| **(a) Admit `TREATY` to the `debates` stream** (and drop the two from `NON_DEBATE_PARLIAMENTARY`) | one line + a before/after | Smallest change that works. ⚠ **Cannot be measured today** — the validated set has zero debates questions, so a scope change to `debates` has nothing to score against, and shipping it blind breaks the rule that a scope change ships with a measurement. |
| **(b) A sixth `treaties` stream** | one retrieval call per query against a service 4 requests wide | Gives treaties their own interleave slots. Disproportionate for 3,588 sections. |
| **(c) Separate the axes properly** — give `StreamScope` a `retrievalTypes` distinct from the display type | a day, and it touches how every result is *rendered* as well as found | The durable fix, and the one the finding actually argues for. ⚠ §4 is explicit that it must not ride along behind an embedding change, and I agree: it should be its own sprint with its own before/after. |

▶ **Recommendation: (a), once GOLD V2 is validated and debates questions exist** — then it is a
one-line change with a real measurement under it. Until then the treaties stay unreachable, which
is stated rather than left looking forgotten.

---

## §5 — DRIFT DETECTION, CLOSED ON BOTH SIDES

S11 costed the keyword-side detector as cheap and **built** it: `scripts/ingest/search/fts-drift.ts`
compares row count, title rate, word total and `itemDate` range per collection between
`corpus_sections` and `corpus_fts` — one projected scan plus one grouped query, ~28s, no writes. It
found three real defects on its first run (`bills-api` carrying **no `itemDate` at all** in the
index; `pwdata-wrans` and `pwdata-lordswrans` five days behind) and one false positive that had to
be fixed before it was usable.

⚠ **The gap S12 found: that covers the KEYWORD index only.** `corpus_chunks` and `corpus_vec` are
written by different phases and nothing asserted they agree — the meaning side had no detector at
all. Closed here as `check-s12-isolation.ts --drift`: per collection, chunks vs vectors, **every
collection in either table, no sampling**, reporting a surplus as orphan vectors and a shortfall as
un-embedded chunks. A total would net one against the other and report zero, so it is never totalled.

---

## §6 — THE RULE ABOUT CHECKS THAT CANNOT FAIL, AS APPLIED

⚠ The brief asks me to report this **as a rule I applied, not one I agree with — because the
previous three sessions also agreed with it.** So, concretely, in this sprint:

| check | population | shown failing against |
|---|---|---|
| `vec-replace` **G1/G2/G3** | every chunk and every vector of the collection; the printed line states *"ALL rows … no limit applied"* | the **real** mid-flight state: `--chunk` without `--embed`, 221 orphans, red before green |
| `check-s12-isolation --compare` | all 74 collections, both tables scanned in full, with a `countRows()` reconciliation that refuses to report on a short scan | — (it passed; its failure mode is exercised by the reconciliation guard, not planted) |
| `sweep-s12-type-reachability` | all 74 collections, and the section counts must reconcile to the corpus total or it prints MISMATCH | — |
| `vec-replace` **resume guard** | n/a — a flag-combination refusal | **both sides**: fires (exit 3) on `--chunk` against a checkpoint with completed shards; stays silent on the safe `--embed` resume |

⚠ **The resume guard was added because documenting the hazard is not guarding it.** §1 identified
that re-cutting underneath a checkpoint invalidates every completed shard index — the exact
stale-checkpoint fault this tool exists to avoid — and the first version of the tool merely told
you not to do it in a usage comment. It now refuses.

**Where I could not show a failure I have said so** rather than implying one: the orphan-sweep
branch (§1) and the isolation check's own negative case.

### ⚠ A check nobody runs, found by applying §6 to the sprint's own tooling

`tsc --noEmit` in `scrutinise-web` is clean. **`tsc --noEmit -p scripts/ingest` is not, and appears
never to have been: 30 errors across 11 files**, including web-app files pulled in through imports
(`page1-config.ts`, `repeal-status.ts`, `corpus-type-map.ts`) and several old scripts
(`s3-drop-readiness.ts`, `ann-recall-check.ts`, `v26-pooled-smoke.ts`…).

Two of those 30 were mine — `fts-refresh.ts`, shipped in S11 — and are **fixed here**. ⚠ S11's
report said "`tsc` clean"; that was the **web** tsconfig and was true of it, but the claim reads
wider than the check that produced it, and the directory holding S11's own new code was never
typechecked. None of S12's new files contribute an error.

▶ The remaining 28 are not mine to fix and are named rather than absorbed. **A typecheck that has
never passed is a check that cannot fail**, which is the section this sits under.

---

## WHAT IS NOT DONE, NAMED

1. ❌ **§2's embed did not finish in this session, and §3 therefore did not run at all.** Phase 1
   (the re-cut) is complete and verified; phase 2 is in flight and checkpointed. The Batch API is
   pacing job creation — `create 429 (quota bucket) — waiting 90s` — and with 14 shards splitting
   into ~98 sequential sub-jobs this is an overnight run. **The $31.88 is being spent as designed,
   under a $40 ceiling, and every completed shard is recorded.**
2. ❌ **§3's baseline is untaken.** The brief is explicit that it runs *after* §2 lands, and taking
   it now would produce exactly the kind of number this sprint exists to stop circulating: measured
   against an index in the middle of being replaced. **The question set (now 65), the index stamp
   and the harness are ready**; the one remaining step is pointing `measure-s10-recall.ts` at
   `SCOREABLE_V2` as well as `SCOREABLE`, deliberately left to the session that runs it.
3. ⚠ **`tna-caselaw` is in the R3 state until phase 2 completes** — new chunks, partly-old vectors.
   Visible, not silent: `--verify` reports G1/G2 red.
4. ⚠ **The phase-1 whole-collection chunk delete** (§1) is a real design fault, named and not
   patched mid-flight.
5. ⚠ **The orphan-sweep branch is unexercised** (§1).
6. ⚠ **28 pre-existing `tsc -p scripts/ingest` errors** are not mine and are not fixed (§6).
7. ⚠ **The treaties remain unreachable**, blocked on GOLD V2 (§4).
8. ⚠ **No browser walk, and none is claimed.**

---

## ▶ DECISIONS AND ACTIONS FOR CHARLIE

**Q1 — Let the case-law embed finish, or stop it?** ▶ **Recommend: let it finish.** It is
checkpointed per shard, ceiling-capped at $40, and stopping now leaves case law in the R3 state
(new chunks, old vectors) which is worse than either endpoint. To resume after any interruption —
**never with `--reset`, which re-pays for everything**:

```
cd scripts/ingest
npx tsx search/vec-replace.ts --corpus=tna-caselaw --verify               # finished?
npx tsx search/vec-replace.ts --corpus=tna-caselaw --embed --max-cost 40  # resume
```
*(The tool now refuses `--chunk` against a checkpoint with completed shards, so the dangerous
combination cannot be typed by accident.)*

**Q2 — Then run the `vector-index` heavy job.** The new vectors are un-indexed and brute-force
scanned until it does. **Never on the serving host** (docs/CLAUDE.md §17).
*Observable signal:* the job's own verify reports `unindexed=0`.

**Q3 — Then redeploy `vector-serve`.** Required for two things at once: the new vectors, and the
snippet fix in §2.1.
*Observable signal — a result that changes, never an absence of errors:*
```
POST /vector-search {"query":"judicial review of a planning decision","limit":10,"tier":"caselaw"}
```
→ **today: 5 of 10 results have an empty snippet.** After the redeploy: **0 of 10**, and every
case-law snippet is judgment text rather than CSS. `GET /stats` → `started_at` moves.

**Q4 — Then take the baseline (§3), and it is the first one that can be compared to anything
later.** Everything it needs is in place: the **65-question** set (44 + GOLD V2's 21, now
validated), the harness, and `index-state.ts` to stamp which index produced the number.
⚠ **The harness reads `SCOREABLE` only** — wiring `SCOREABLE_V2` into `measure-s10-recall.ts` is a
small change and is NOT done, because it should be made and exercised in the same session as the
run it feeds, not shipped blind ahead of it.
```
cd scrutinise-web
FTS_SEARCH_URL=https://fts-serve-production-4cea.up.railway.app \
LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees \
  npx tsx --env-file=.env scripts/measure-s10-recall.ts --retrieve
  npx tsx --env-file=.env scripts/measure-s10-recall.ts --score
```
⚠ **State the configuration and the index version beside the number**, and **do not present it as
"recall improved from 34%"** — S10's figure is void, not a comparison point. This is a new baseline.

**Q5 — ~~GOLD V2 still needs your validation pass.~~ ✅ DONE, 22 August.** 22 ACCEPT, 2 AMEND
(applied), 0 REJECT. What it unblocks, now actionable:
- **the debates/legislation evaluation** — §3's baseline can report those two streams for the first
  time;
- **§4's treaty decision** — admitting `TREATY` to the `debates` stream can now ship with a
  before/after, which is what made it undecidable yesterday;
- **the `limit` semantics decision** carried over from S11 §5.1.

---

## RESULTS

*Phase 1 complete and verified (§2). Phase 2 in flight at the time of writing; its final spend,
chunk-0 verification (`check-s12-chunk0.ts`, whole population plus 30 hand-read) and the §3 baseline
are the outstanding items above.*
