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

**Phase 2 (embed) — COMPLETE.** 539,454 chunks → 14 shards of 40,000. ⚠ At ~788 tokens per
case-law chunk a 40,000-chunk shard is ~31.5M estimated tokens, far above the Batch tier's
enqueued-token ceiling, so `embedShardViaBatch` split each one transparently into 7–8 sequential
sub-jobs — ~98 batch jobs in total, paced throughout by `create 429 (quota bucket) — waiting 90s`.

```
shards        14 / 14        vectors 539,454        misses 0
spend         $31.8994       ← plan $31.88 · Charlie approved ~$31
checkpoint    phase=done
```

✅ **THE SPEND ESTIMATE DID NOT RUN LOW, WHICH IS WORTH RECORDING BECAUSE IN THIS PROJECT IT
USUALLY DOES.** The corpus embed was gated at ~$600 and came in at $430–520. This one was priced at
$31.88 by `--plan` and cost **$31.8994** — a 0.04% error, because the plan counted the real chunker's
real output rather than modelling it.

**The guards, over the whole population, after the run:**

```
population scanned: 539,454 chunks · 539,454 vectors (ALL rows of 'tna-caselaw', no limit applied)
G1 orphan vectors   0  ✅        G2 un-embedded  0  ✅        G3 counts equal  539,454 = 539,454  ✅
```

✅ **AND THE ORPHAN SWEEP FIRED — `sweeping 1 orphan vectors`.** The pilot could not exercise that
branch (a single shard's range spanned every old id) and this report said so. It has now run on
exactly the case it was written for: one old chunk id sorting above the highest new one, which no
range delete could reach. **The unexercised branch is now exercised, on the real collection.**

⚠ **The mid-flight guard went red exactly as designed** — at one point `G1: 18,779 orphans ❌ ·
G3: 539,454 vs 558,233 ❌`, the R3 state the brief calls worse than doing nothing, **visible rather
than silent** — and resolved to green as the shards landed.

⚠ **A "killed" notification for this job was FALSE and was checked rather than believed.** The log
grew 248 bytes over a 45-second window immediately afterwards. This project has had 9 such
notifications, 7 of them false; the 45-second delta settles it and is worth the 45 seconds.

### §2.2 Chunk 0 — the acceptance criterion, whole population AND the 30 by hand

⚠ §2 asks for 30 documents read by hand. That is exactly the shape of check that has failed this
project three sprints running, so the CSS detection ran over **every chunk-0 row in the collection**
and the 30 extracts are printed *in addition* (§6):

| | before (300-doc census) | after (74,894, whole population) |
|---|---:|---:|
| chunk 0 that IS a stylesheet | **77%** | **0 — 0.00%** |
| CSS share of chunk-0 characters | **12.7%** | **0.00%** |
| hand-read clean | 0 of 30 | **30 of 30** |

```
 1. ✅ tna-caselaw:[2003] EWCA Civ 1008:1
    "Case No: A3/2002/2354 Neutral Citation No [2003] EWCA Civ 1008 IN THE SUPREME COURT OF
     JUDICATURE COURT OF APPEAL (CIVIL DIVISION) ON APPEAL FROM MR. JUSTICE JACOB …"
```

⚠ 74,894 documents have a chunk 0, not 74,896 — the two the National Archives publishes with no
text at all, which the plan also counted as `body misses: 2`. The arithmetic closes.

### §2.3 Isolation, on the real run this time

`check-s12-isolation --compare` over **74 of 74 collections, every row of both tables, no
sampling**: `tna-caselaw` 558,233 → 539,454 as expected, **0 unexpectedly changed**, and the four
collections an ordinal shift would have hit are byte-identical:

```
✅ uk-treaties 12,543   ✅ uk-treaties-fcdo 56,215   ✅ written-answers 1,138   ✅ written-statements 994
```

**That is the empirical refutation of the boundary-shift fear, on the collection it was raised about.**

### §2.4 ⚠⚠ THE BRIEF NAMES THE WRONG HEAVY JOB, AND THE RIGHT ONE IS DOCUMENTED AS THE TRAP

§2 says to run **`vector-index`**. That job is the FULL-CORPUS build — chunk manifest + batch embed
+ ANN index, 32 GB peak — and running it would re-embed all 22.7M chunks. Worse, it would not even
do that: its own registry entry records that both its scripts are checkpointed `phase: "done"`, so
it *"would print 'already done — nothing to do' and 'DONE', create nothing, and destroy the box — a
job that reports success while doing NOTHING."*

The correct job is **`vector-reindex`** (`--index-only`), which rebuilds only the IVF_PQ ANN index.
⚠ This exact confusion is already in the change log: V35 recorded *"`v33-vec-catchup.ts` was telling
the next reader to run `vector-index`, which reports success and builds NOTHING … `vector-reindex`
is the one; fixed."* The brief inherited the wrong name; the registry caught it.

⚠ And the design held: `vec-replace` used its own per-corpus checkpoint and never touched the
global one, so `vector-reindex` still read `doneShards=1821` from the July build and went straight
to the ANN block over the current 22,670,808 rows — exactly as intended.

### §2.5 The ANN rebuild — predicted, then measured

`vector-reindex` on a cpx62, provisioned → run → verified → **destroyed**.

| | predicted | measured | |
|---|---|---|---|
| peak RSS | 6–7 GB | **5.9 GB** | ✅ (registry recorded 5.8 GB) |
| build time | 15–25 min | **30.4 min** (1,825 s) | ⚠ **REFUTED — under-predicted** |
| cost | ~€0.10 | **€0.156** | ⚠ **REFUTED**, and it follows from the time |
| unindexed after | 0 | **0 of 22,670,808** | ✅ |

```
[verify-vec] vector_idx (IVF_PQ) on [vector]: indexed=22,670,808 unindexed=0
[verify-vec] ✅ ANN index present and covers all 22,670,808 rows
```

⚠ I under-predicted the time by ~50% and the cost followed it. The registry now has a fifth
data point; `expectedPeakGb` for this job is left as it is, on the same rule the `fts-index` entry
carries — one run at the record on more data is not headroom.

---

## §2.6 ⚠⚠ A REDEPLOY IS NOT A REBUILD, AND MY OWN §2.1 CLAIM WAS WRONG ABOUT IT

§2.1 ended: *"It requires the `vector-serve` redeploy that §2 already calls for, so it costs no
extra operational step."* **That is wrong, and the live check caught it.**

`v33-restart-serve.ts vector-serve` proved a genuine restart — `started_at`
**2026-08-16T02:03:34 → 2026-08-23T00:13:19**, `served` reset to 0. ⚠ Note the previous value: the
service had been up **seven days**, so it had also never seen S11's work.

Then the two-sided check on the thing the restart was for:

| | before the restart | after |
|---|---|---|
| caselaw snippets that are a **stylesheet** | present | **0 of 20 ✅** |
| caselaw snippets that are **EMPTY** | 5 of 10 | **still 5 of 10, 9 of 20 ❌** |

**The data half landed; the code half did not.** `deploymentRedeploy` re-runs the SAME BUILD
ARTEFACT — which is exactly why the root `CLAUDE.md` prefers it over `serviceInstanceRedeploy` for
worker restarts. It picks up new *data* and never new *code*. The deployed artefact dates from
16 August; the snippet fix was committed on 22 August (`bf8eeb1`, present in `HEAD`, three
occurrences of `SNIPPET_ROWS_PER_SECTION`).

⚠ And `vector-serve` **does not auto-deploy from GitHub** — already recorded in the change log:
*"the same push deployed `fts-serve` and produced no `vector-serve` deployment at all, which is why
it had been serving 7 August code."* So a push does not ship it either.

▶ **The fix is committed, pushed, and NOT DEPLOYED.** Shipping it needs a build from source
(`serviceInstanceRedeploy`, or a manual deploy from the Railway dashboard) — a different and larger
action than the restart, and it is named as such rather than folded into "redeploy".

⚠ **The bug diagnosis itself is unchanged and still holds**: the empty rate scales exactly as the
shared-budget arithmetic predicts — 0 of 1, 1 of 3, 5 of 10, **9 of 20** — and the new 20-result
reading is a fourth point on the same line, taken after the restart on new data. It is the delivery
claim that was wrong, not the finding.

### §2.7 ⚠⚠ AND THE REBUILD DID NOT SHIP IT EITHER — `vector-serve` IS PINNED TO A 12 AUGUST COMMIT

Having established that a *redeploy* ships data and not code (§2.6), I built the service **from
source** (`serviceInstanceRedeploy`) and verified with a probe rather than with `started_at`.

```
✅ RESTART PROVEN — started_at 2026-08-23T00:13:19 → 2026-08-23T00:24:27
   empty caselaw snippets at limit=10:  5/10  →  5/10
⚠⚠ RESTART PROVEN BUT DEPLOYMENT NOT PROVEN
```

**The tool refused to record it as shipped, which is what it is for.** Then the deployment metadata
settled why:

```
deployment f14b5848  2026-08-23T00:23:57  SUCCESS
  repo   Scrutinise/scrutinise-prototype    branch  Main
  commitHash  c70f53d01b9afa5b9c8bb3afb9ff62979f5219fd
```

`c70f53d` is **"docs(search,ingest): the recall constraint is 17,261 instruments that were never
ingested" — 12 August**. `git merge-base --is-ancestor bf8eeb1 c70f53d` → **NO**: the snippet fix is
not in it. The service reports `branch: Main` and builds a commit eleven days behind `Main`'s head.

▶ **So `vector-serve` is pinned, and neither mechanism advances it:**

| action | result |
|---|---|
| `deploymentRedeploy` | re-runs the same artefact — new data, never new code |
| `serviceInstanceRedeploy` | rebuilds **from the service's pinned commit**, still `c70f53d` |
| a push to `Main` | ⚠ does not deploy it at all (CHANGE_LOG, 11 Aug) |

⚠⚠ **This finally explains a recurring mystery rather than adding to it.** The change log has twice
recorded `vector-serve` "serving 7 August code" and "not auto-deploying from GitHub" without a
cause. The cause is that its source ref does not track the branch it names.

▶ **CHARLIE — this is a Railway configuration change and I have deliberately not made it.**
Repointing a production service's source ref is deployment infrastructure, not code, and it may
have been pinned on purpose. In the Railway dashboard: `vector-serve` → Settings → Source → set the
deploy to track `Main` (or trigger a deploy of a specific commit), then redeploy.
*Observable signal:* `empty caselaw snippets at limit=10` goes **5/10 → 0/10**, verifiable in one
request with `tsx deploy-serve-from-source.ts vector-serve --check-only`.

⚠ **What this means for the baseline in §3, stated rather than left implicit:** it was taken against
`vector-serve` running `c70f53d` — i.e. **the code that has been serving all along**. The numbers
therefore describe production as it actually is. The snippet fix affects displayed text, not which
documents are retrieved or their order, so it does not move recall either way.

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

**Taken through `runSearch()` — the real gateway — on 23 Aug 2026, after §2 landed.**

**Question set:** 65 recall-scoreable — `SCOREABLE` (44) + `SCOREABLE_V2` (21, validated 22 Aug).
The 3 negative controls are behaviour-scored and excluded.
**Index state, stamped either side of the run and unchanged across it:**
`corpus_fts` **v7308** (18,272,377 rows) · `corpus_vec` **v4011** (22,670,808) · `corpus_chunks`
**v18447** (22,670,808).
**Configuration:** `QUERY_ROUTER=ON` · `SEARCH_VECTOR=ON` ·
`LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees` · both services reachable.

| collection | set | n | recall@20 | recall@5 | hit | DILUTED | NOT-RETRIEVED | NOT-ROUTED |
|---|---|---:|---|---|---:|---:|---:|---:|
| consultations | S10 | 9 | **7/9 78%** | 4/9 44% | 7 | 2 | 0 | 0 |
| caselaw | S10 | 6 | **4/6 67%** | 1/6 17% | 4 | 1 | 1 | 0 |
| legislation | **V2** | 10 | **4/10 40%** | 2/10 20% | 4 | 4 | 2 | 0 |
| committees | S10 | 10 | 3/10 30% | 2/10 20% | 3 | 2 | 5 | 0 |
| guidance | S10 | 10 | 2/10 20% | 0/10 0% | 2 | **6** | 2 | 0 |
| **debates** | **V2** | 11 | **0/11 0%** | 0/11 0% | 0 | 2 | **9** | 0 |
| impact-assessments | S10 | 9 | 0/9 0% | 0/9 0% | 0 | 4 | 1 | **4** |
| **ALL** | | **65** | **20/65 31%** | **9/65 14%** | | | | |
| *S10 set only* | | 44 | 16/44 36% | | | | | |
| *GOLD V2 only* | | 21 | 4/21 19% | | | | | |

⚠⚠ **THIS SUPERSEDES S10'S PER-COLLECTION NUMBERS AND IS NOT A DELTA AGAINST THEM.** S10's figures
are **void** — the 20 Aug case-law re-compile moved BM25 document frequencies table-wide and S11
measured 0 of 5 sampled rankings reproducing. 31% is not "34% minus 3"; the two were taken against
different corpora and only one of them recorded which.

### ⚠⚠ THE HEADLINE IS THE FIRST NUMBER DEBATES HAS EVER HAD, AND IT IS ZERO

**`debates` scores 0 of 11**, with **9 NOT-RETRIEVED** — the stream ran, returned its results, and
the key was not among them. Not a routing failure, not dilution: retrieval. This is the stream
carrying the most traffic and the largest collection family in the corpus (~12M sections), and it
has never been measured before because it had no questions.

⚠ **One contributor is mine, and it is a question-design property rather than a search defect.** A
debates key is a **single speech** — `pwdata-debates:debates2024-11-29d:3` is one of 200 speeches in
one day's sitting. A committees key is a whole report. Finding one specific speech inside 12M is a
materially harder target than finding a document, and the two are not comparable as "recall".
▶ **Before treating 0/11 as a verdict on the debates stream, the keys should be widened to accept
any speech from the right debate** — several questions ("what did MPs argue for and against…") are
answered by any of ~200 speeches, and the key names two. That is a change to the question set, so
it is Charlie's, and it is the first thing I would do next.

### ⚠ Guidance: 6 of 10 DILUTED, and that is S11's gain being eaten by the interleave

S11 measured the re-tier at guidance **3/10 → 8/10 IN-STREAM**. Merged, it is **2/10**, with **6
DILUTED — the key IS in the guidance stream's own list and does not survive into the merged top
20.** The re-tier worked exactly as measured; the interleave is where it is lost. That is S10's
interleave finding, now with a much larger number on it, and it is the strongest evidence yet for
taking it as its own sprint.

### ⚠ Impact assessments: 0 of 9, with 4 NOT-ROUTED

Unchanged in mechanism from S10: with `LEX_ROUTER_STREAMS_V2` off, an impact-assessment question can
only reach `legislation`, and 4 of 9 were not routed there at all.

### And the `limit` fan-out is now visible in every log line

`limit: 'asked 20 → got 300 across 5 stream(s) (15×)'` — S11's `meta.requested` instrumentation
doing its job. The 15× is exactly the shape documented in `SEARCH_CONTRACT.md` §2.

---

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

1. ⚠⚠ **The snippet fix is committed, pushed, and NOT DEPLOYED** — `vector-serve` is pinned to
   commit `c70f53d` (12 Aug) and neither a redeploy, a source rebuild nor a push advances it (§2.7).
   A Railway configuration change, deliberately not made by me.
2. ⚠⚠ **`debates` scores 0 of 11 and the keys may be unfairly narrow** (§3). Before that is treated
   as a verdict on the stream, the keys should be widened to accept any speech from the right
   debate. That is a change to a validated question set, so it is Charlie's.
3. ⚠ **The interleave is untouched** and is now the largest single loss in the measurement —
   6 of 10 guidance questions DILUTED, S11's in-stream gain not reaching the user. Its own sprint.
4. ⚠ **The treaties remain unreachable** (§4). Now *measurable* for the first time, since GOLD V2
   gives `debates` questions — but the change itself is Charlie's decision and was not shipped.
5. ⚠ **`build-vector-index.ts`'s resume hazard is unfixed** — design B in §1, recommended as a
   standalone follow-up rather than ridden along behind an embedding change.
6. ⚠ **`vec-replace` phase 1 still deletes a collection's chunks in one statement** (§1). Named,
   not patched mid-flight.
7. ⚠ **28 pre-existing `tsc -p scripts/ingest` errors** are not mine and are not fixed (§6).
8. ⚠ **No browser walk, and none is claimed.**

---

## ▶ DECISIONS AND ACTIONS FOR CHARLIE

**Q1 — Repoint `vector-serve`'s source ref so code can reach it.** Dashboard → `vector-serve` →
Settings → Source → track `Main`, then redeploy.
*Signal:* `empty caselaw snippets at limit=10` **5/10 → 0/10**, one request via
`tsx deploy-serve-from-source.ts vector-serve --check-only`.
⚠ Not done by me: repointing a production service's source is infrastructure config and it may be
pinned deliberately.

**Q2 — Widen the `debates` answer keys, then re-run the baseline.** Several V2 questions ("what did
MPs argue for and against…") are answered by any of ~200 speeches and the key names two. ▶
**Recommend: accept any speech sharing the key's `parentDocId`.** That is a one-line scoring change
and a re-run; the current 0/11 should not be quoted as a property of the debates stream until it is
done. *Consequence if not done:* the largest stream in the corpus carries a headline zero that is
partly an artefact of how I wrote its keys.

**Q3 — Give the interleave its own sprint.** 6 of 10 guidance questions are DILUTED: the key is in
the owning stream's list and does not survive the merge. S11's re-tier gain (3/10 → 8/10 in-stream)
is real and is being lost here. ▶ **Recommend: yes, and it is now the highest-value retrieval work
outstanding.** *Consequence of deferring:* every future in-stream improvement is measured and then
discarded at the same step.

**Q4 — `LEX_ROUTER_STREAMS_V2`.** 4 of 9 impact-assessment questions were NOT ROUTED, unchanged from
S10. ▶ **Recommend: flip it on**, now that there is a baseline to compare against on the same index.

**Q5 — The treaty collections (§4).** Admitting `TREATY` to `debates` is now measurable. ▶
**Recommend: do it in the interleave sprint**, where a debates before/after is being taken anyway.

---

## RESULTS — ALL SECTIONS COMPLETE

| § | outcome |
|---|---|
| §0 | GOLD V2 validated mid-sprint; baseline set 44 → **65**; both states recorded |
| §1 | REPLACE path designed, built, piloted; guard watched failing on the real broken state; blast radius measured at **0.31%** |
| §2 | Re-embed **$31.8994** vs $31.88 planned · chunk 0 stylesheet **77% → 0.00%** over 74,894 · isolation **0 of 74** disturbed · ANN **unindexed=0** |
| §3 | New baseline, **65 questions**, index version stamped: **20/65 (31%) recall@20**, 9/65 (14%) recall@5 |
| §4 | Sweep: **0 type-blocked, 0 tier-blocked**, 2 affected — the two already known |
| §5 | Drift detection closed on **both** indexes |
| §6 | Every check whole-population; three watched failing; a typecheck that had never passed, named |
| §7 | Report, contract note, change log, handoff, scoped commits |

**Spend:** $31.8994 (embed) + €0.156 (ANN rebuild) + $0.038 (pilot) + €0.056 (S11 FTS rebuild).
