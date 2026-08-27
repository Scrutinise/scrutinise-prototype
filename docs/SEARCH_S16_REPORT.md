# SEARCH S16 — WHY HALF THE QUESTIONS FIND NOTHING

**From:** CC-Search · **Executes:** `docs/BRIEF_SEARCH_S16.md`
**Report opened** 2026-08-27 14:10 UTC · every timestamp in this file is UTC.
**Measurement of record:** `docs/census/s15-arms.json` — `streams=legislation,caselaw,guidance,committees`,
`router=ON`, **`degraded: []`**, taken 10:40 UTC, n = **64**.
**Autopsy artefact:** `docs/census/s16-autopsy.json`.

⚠ **This is not a report about a fixed platform.** Today 45 of 64 questions return nothing correct.
Everything below either explains why or moves one of them.

---

## §0 — THE HEADLINE, WHICH IS NOT WHAT THE BRIEF EXPECTED

The brief asked why retrieval finds nothing for 32 of 64 questions. The autopsy says:

| class | n | owner |
|---|---:|---|
| **NOT-MATCHED** — the right stream was searched and the key did not come back | **19** | search / argument |
| **RANKING** — retrieved by its stream, below rank 20 | **4** | search |
| **NOT-ROUTED** — reachable, but that stream was not routed | **4** | search |
| **UNREACHABLE** — in the corpus, in a collection **no stream admits** | **4** | search |
| **ABSENT** — not in the corpus, or a placeholder | **1** | ingest |
| *(unit modifier — a long document scored whole)* | *12* | argument |

⚠⚠ **AND THEN THE FINDING THAT CHANGES WHAT "NOT-MATCHED" MEANS.** Probing the committees failures
individually, as §3.3 required, the documents turn out to be **indexed and retrievable** — searching
each key's own title returns it at ranks **1, 1, 2 and 4**. The retriever is not failing to find
them. **The answer keys are not what the questions ask for.**

- **10 of committees' 19 answer keys are `Correspondence:` — ministerial letters** — against **0 of
  19 in every other collection**, while the questions ask what a *committee* said or examined.
- **3 more are a single written-evidence submission drawn from an inquiry holding many equally valid
  ones**: S10-Q8's key is **1 of 525**, S10-Q6's **1 of 115**, S10-Q9's **1 of 54**.
- ⚠ **The control is exact: the one evidence-keyed question committees DOES find, S10-Q7, has the
  smallest class — 1 of 26.**

▶ **So a substantial part of "retrieval finds nothing" is the measuring instrument, not the
platform.** That does not make the platform good — it makes the number untrustworthy in a direction
nobody had checked, and it is the same defect already known for debates.

---

## §1 — `fts-serve`: HARDENED, AND ONE PREMISE OF THE BRIEF CORRECTED

*(Written first because the brief says do it first. §2 is the sprint's deliverable and follows.)*

### 1.1 ⚠ The width was already 16, not 4 — read off the running service

The brief says `fts-serve` has *"the same copied width of 4"*. **It does not.** `/stats` on the
running service reports:

```
concurrency: { max: 16, inFlight: 0, queued: 0, maxQueue: null, rejections: null }
```

The **code default** is 4 (`FTS_MAX_CONCURRENT ?? '4'`), and `FTS_MAX_CONCURRENT` is set on Railway,
so reading the file tells you the wrong number. This is precisely why S15's §5 requires the width to
be read off `/stats` rather than off configuration, and it is worth stating plainly: **the brief's
premise here came from the code, and the code is not the configuration.**

The two real defects were the other two, and both are now fixed.

### 1.2 ⚠⚠ The index question — asked, and the answer is NO

S15's actual cause was a stale index nobody had counted. `check-index-coverage.ts` now asks that of
**every index the serving path depends on**, and states row counts rather than existence:

| table | index | column | rows | indexed | **unindexed** | verdict |
|---|---|---|---:|---:|---:|---|
| `corpus_fts` | `body_idx` | body | 18,272,377 | 18,272,377 | **0** | COVERED |
| `corpus_vec` | `vector_idx` | vector | 22,670,808 | 22,670,808 | **0** | COVERED |
| `corpus_chunks` | `sectionId_idx` | sectionId | 22,670,808 | 22,670,808 | **0** | COVERED |

▶ **`fts-serve` does not have S15's defect.** A negative result, reported because it was asked.

⚠ **The check is watched failing, against a real unindexed column rather than a planted string.**
`--self-test` adds `corpus_chunks.chunkId` — measured in S15 to have no index at all — and requires
MISSING. It reports `0 indexed · 22,670,808 unindexed (100.0%) MISSING` and exits 3. **A checker
that only ever says COVERED is indistinguishable from one that cannot fail.**

⚠ Noted in passing, not chased: `corpus_fts` holds **18,272,377** rows against `corpus_vec`'s
**22,670,808**. These are different units — sections versus chunks — so it is not prima facie a gap,
but nobody has reconciled them and it is the sort of difference that hides one.

### 1.3 What was fixed

Applied from S15 §2/§3, with `BUILD = 'S16-fts-cancel-bounded'` on `/health` and `/stats`:

- **Cancellation.** Client disconnect is detected on the response; the flag is checked **before the
  queue** and **again after a slot is granted** — the second is the one that makes a queue drain.
  `pump()` skips abandoned waiters instead of granting them a slot; `pruneWaiters()` drops them so a
  dead request cannot hold a place a live one is refused for.
- **A bounded queue.** `FTS_MAX_QUEUE`, defaulting to `2 × width`, replacing **unbounded**. A full
  queue returns **503 with `reason: 'overloaded'`**, machine-readable so the adapter can tell a
  saturated service from a broken one.
- **`/stats` can now say it.** `maxQueue` and `rejections` were **`null`** — honestly so, because an
  unbounded queue can never refuse — and are real numbers now, alongside `abandoned`, `cpu_p50_ms`
  and `cpu_over_wall`.

⚠ **A difference from the dense service, stated so it is not read as drift:** `fts-serve` has no
result cache and no single-flight coalescing, so abandonment is per **request** rather than per
cache key. There is never another caller waiting on the same computation to strand.

⚠ **`os.cpus()` on `/stats` is the HOST's, not the container's quota** — S15 §1.3's correction,
carried here so this service's `host.cpus` is not misread the same way.

### 1.4 ✅ Proven on the running service, both paths, both directions

Deployed and verified live — **`fts-serve` has a repo trigger, so the push rebuilt it**, and the
probe is genuinely two-sided: the old build had **no `build` field and `maxQueue: null`**.

```
$ curl .../health
{"ok":true,"dataset":"s3://…/corpus_fts","build":"S16-fts-cancel-bounded"}
$ curl .../stats  →  max: 16 · maxQueue: 32 · rejections: 0 · abandoned: 0
```

**`check-fts-shed.ts` — 9 assertions, 0 failures**, at 16 wide with a 32-deep queue (capacity 48):

| assertion | observed |
|---|---|
| **filled to exactly 48 refuses nothing** *(the negative control)* | **0 shed, 48/48 returned 200** |
| 56 fired → the excess is shed | **8 shed for 8 excess**, 48 served |
| every refusal is fast | **slowest 468 ms** |
| every refusal is machine-readable | `{"reason":"overloaded","queued":32,"maxQueue":32}` |
| a shed is a 503, never a 500 | statuses observed: 200, 503 |
| rejections are counted on `/stats` | +8 for 8 observed sheds |

**`check-fts-cancel.ts` — 3 assertions, 0 failures.** 40 requests, every client aborted at
t+1,229 ms, none completed first:

```
t+3s · served  +0 · abandoned  +0 · inFlight 16 · queued 24
t+6s · served +16 · abandoned +24 · inFlight  0 · queued  0
```

▶ **The arithmetic is exact: `served +16` is precisely the width — the requests already running —
and `abandoned +24` is precisely the 24 that were queued. 16 + 24 = 40, recovery 6 seconds.**
Before this change all 40 would have run.

⚠ **The failing side of the cancellation check cannot be shown on this service**, because the fix
deployed with the same push. The two-sided evidence for this defect class is
`check-vector-cancel.ts`'s, taken against the real unfixed dense service (S15 §2: **12 of 12
executed after every client was killed, 19-second recovery**). Stated in the script's own header
rather than left to be assumed.

---

## §2 — THE AUTOPSY: ALL 32 FAILURES, ONE AT A TIME

**This is the sprint.** `scripts/autopsy-s16.ts`; artefact `docs/census/s16-autopsy.json`.

⚠ **The classifier refuses to run against a degraded artefact.** S14's numbers were read for a
fortnight as though dense retrieval were live while its own file said `streams=NONE … DEGRADED(1)`;
this exits 2 rather than let that happen twice. It prints the flag string and the degraded state of
its input on every run.

⚠ **Tier comes from the INDEX, not from the corpus name.** `corpus_sections` has no tier column, and
`stream-scopes.ts` is explicit that the tier that matters is *"baked into the index at build
time — not `tierFor(corpus)` as it reads today"*. Tier is therefore read from
`corpus_reachability.json` (which measured it by scanning `corpus_fts` and `corpus_vec`), while
**reachability is recomputed live from `STREAM_SCOPES`** so a scope change is reflected rather than
inherited. The artefact's own generation date is printed on every run.

*(The full per-question table is in the artefact; what follows is every row, grouped by class.)*

### ABSENT — 1. **Ingest's, not search's**

| id | collection | what was found |
|---|---|---|
| S10-Q28 | guidance | key row exists, **10 words**, `status=compiled` — a stub, not text |

⚠ **A search sprint that "fixed" this by loosening matching would have made the platform worse.**
Handed to ingest.

### UNREACHABLE — 4. **In the corpus, in a collection no stream admits**

| id | collection | corpus | index tier |
|---|---|---|---|
| S10-Q25 | guidance | `cps-guidance` | `other` |
| S10-Q26 | guidance | `cps-guidance` | `other` |
| S10-Q27 | guidance | `cps-guidance` | `other` |
| V2-Q8 | debates | `scottish-parliament-or` | `other` |

Both collections sit in the index under tier **`other`**, and **no stream selects `other`**. The
documents are ingested, compiled and indexed, and no query can reach them. **Three of the ten
guidance questions are unreachable CPS guidance** — a single collection accounting for 30% of that
collection's failures.

### NOT-ROUTED — 4. **All impact-assessments, and V2 covers every one**

| id | admitted by | actually routed | V2 stream that covers it |
|---|---|---|---|
| S10-Q33 | `legislation` | debates, committees, guidance | `impact-assessments` |
| S10-Q34 | `legislation` | debates, committees, guidance | `impact-assessments` |
| S10-Q35 | `legislation` | debates, committees, guidance | `impact-assessments` |
| S10-Q39 | `legislation` | debates, committees, guidance | `impact-assessments` |

This is exactly the class the brief said was "already known to be non-empty", and §3.1 measures the
fix.

### RANKING — 4. **Retrieved, below the window**

| id | collection | stream | in-stream rank | unit |
|---|---|---|---:|---|
| S10-Q3 | committees | committees | 30 | |
| S10-Q4 | committees | committees | 20 | ⚠ 2,118 w |
| V2-Q2 | debates | debates | 39 | ⚠ 2,634 w |
| V2-Q9 | debates | debates | 33 | ⚠ 1,551 w |

⚠ S10-Q4 is at rank **20** — one place outside a 20-window.

### NOT-MATCHED — 19. **The largest class, and the one §3.3 reinterprets**

committees 6 · debates 8 · legislation 2 · caselaw 1 · guidance 1 · impact-assessments 1.
**12 of the 32 failures carry the unit modifier** (key ≥ 1,500 words, scored whole).

*(Per-question rows in the artefact. §3.3 shows that for committees these are largely key defects
rather than retrieval defects.)*

---

## §4 — THE QUERIES WE ACTUALLY ISSUE

`scripts/audit-s16-queries.ts`, reading the route cache S15's measured run used — so these are the
strings that **were issued**, not fresh ones from a second routing call.

### 4.1 The validated questions do NOT travel through the builder the brief indicts

The brief quotes a real build issuing:

```
civil service public failure accountability responsibility cost deliver sector process
accountable those system pr
```

**The gold set does not look like that.** Ten failing questions, every routed stream, printed in
full — a representative three:

| question | stream | issued query |
|---|---|---|
| *Has a committee looked at the Post Office Horizon compensation scheme?* | committees | `"Post Office Horizon compensation scheme inquiry evidence"` |
| *What did witnesses tell the committee about special educational needs?* | committees | `"special educational needs committee evidence witnesses"` |
| *Did MPs argue for or against letting terminally ill people choose to die?* | debates | `"MPs debate assisted dying terminally ill people"` |

Over **41 issued queries** across the 19 NOT-MATCHED questions:

| property | count |
|---|---:|
| ends mid-token | **0** |
| orphan referent (`those`, `these`, `them`…) | **0** |
| empty | **0** |
| duplicated term | 2 *(both legitimate — "Phase 1 Phase 2")* |
| every stream given the SAME string | **0 of 19** |
| tokens per query | min 6 · **median 7** · max 9 |

▶ **These are written queries, not extracted ones. The query defect the brief cites is on the BUILD
path and is not reachable from here** — `BRIEF_25F.md` §4 owns it. **Handed to the Lex stream, with
this measurement as the contrast.**

### 4.2 ⚠⚠ The guard, and the way it caught a fault in *itself* first

`--check` asserts no issued query is extracted rather than written, and `--self-test` runs it
against **the real bad string above**, not an invented one.

**On its first run the self-test FAILED — and it was right to.** My assertion counted stopwords and
failed at three or more. The real defect contains exactly **one** (`those`), so **the check could
not catch the only example it exists for**. A threshold of one would have flagged every good query,
because *"duty to investigate deaths in custody"* legitimately contains "to" and "in".

**The discriminator is not the count, it is which word.** A written query may carry grammatical
function words; it never carries an **orphan referent** — `those`, `these`, `them`, `their` — which
points at something outside the query and matches nothing. Rewritten on that basis:

```
SELF-TEST  flags: ENDS-MID-TOKEN · ORPHAN-REFERENT(those)   ✅ both fired
CHECK      ✅ 41 of 41 issued queries are written, not extracted
```

⚠ **A threshold picked by feel is exactly the kind of guard this project keeps finding cannot
fail.** It was caught only because the self-test used the real string.

---

## §3 — THE CHEAP WINS, MEASURED. ONE WORKS, ONE DOES NOT, AND I PREDICTED BOTH WRONG-WAY-ROUND

Predictions were logged in `CHANGE_LOG.md` at 14:06 UTC before either result was read.

### 3.1 `LEX_ROUTER_STREAMS_V2` — ⚠ **NOT RECOMMENDED. My prediction was wrong in direction.**

`docs/census/s16-routerv2-arms.json`, n = 64, `degraded: []`.

| | S15 baseline | **V2 on** | |
|---|---:|---:|---|
| **in-stream@20** — what retrieval finds | **32/64** | **29/64** | ⚠ **worse** |
| merged@20, round-robin | 19/64 | 21/64 | better |
| merged@20, judged + reranker | 30/64 | 32/64 | better |
| @5, round-robin | 8/64 | 13/64 | better |
| **impact-assessments in-stream** | **4/9** | **2/9** | ⚠ **worse** |
| consultations in-stream | 9/9 | 8/9 | ⚠ worse |

**I predicted in-stream@20 would rise to 34–36 and impact-assessments to 8 or 9 of 9. Both fell.**

⚠⚠ **The mechanism, and it is not what the flag is for.** Given eight streams instead of five, the
router becomes *more* selective rather than broader. The fan-out tally:

| streams routed | 1 | 2 | 3 | 4 | 5 | 7 |
|---|---:|---:|---:|---:|---:|---:|
| S15 (5 available) | 20 | 4 | 15 | 12 | 13 | — |
| **V2 (8 available)** | **34** | 7 | 7 | 4 | 11 | 1 |

**34 of 64 questions now route to a single stream, against 20 before.** Per question, on
impact-assessments:

| id | S15 routed → rank | V2 routed → rank | |
|---|---|---|---|
| S10-Q33 | debates, committees, guidance → **not found** | `impact-assessments` → **1** | ✅ the NOT-ROUTED class, fixed exactly |
| S10-Q31 | legislation, +3 → **8** | `impact-assessments` → **47** | ❌ lost the legislation stream |
| S10-Q36 | legislation, +3 → **9** | `impact-assessments` → not found | ❌ |
| S10-Q38 | legislation, +3 → **5** | legislation, +3 → not found | ❌ |
| S10-Q37 | → 17 | → 15 | ✓ |

▶ **The dedicated stream WORKS — S10-Q33 went from unreachable to rank 1 — and enabling it costs
more than it gains, because it collapses the router's fan-out on questions that have nothing to do
with the new streams.**

⚠ **THE COMPARISON IS CONFOUNDED AND I AM NOT GOING TO PRETEND OTHERWISE.** The V2 run used
`--reroute`, so routes were re-rolled; routing is an LLM decision and two rolls of the same question
differ. Some of the −3 is V2 and some is routing noise, and **this run cannot separate them.**
What is *not* confounded is the mechanism: `impact-assessments` can only appear as a routed stream
with V2 on, so the single-stream collapse on those questions is real. **What would settle the
magnitude is a re-route run with V2 OFF** — one control run, not done here.

⚠ **And a side-effect worth naming: `--reroute` silently overwrote the shared route cache**
(`scripts/gold/s14-routes.json`) that S15's baseline was measured against, destroying its
provenance. Restored from git, and the V2 routes preserved separately as
`docs/census/s16-routerv2-routes.json`. **A generator that eats its own input** — the same shape
that has bitten this repository twice before.

### 3.2 Dense retrieval for `debates` — ✅ **RECOMMENDED. 0 of 11 → 3 of 11, nothing lost.**

`scripts/measure-s16-debates-dense.ts`. Both arms alternate **in one process**, because
`fusedStream` reads `vectorStreams()` per call — so the two arms share the same warm services, the
same routing and the same index. Two processes would have compared two warm-ups.

| question | BM25 only | **+ dense** |
|---|---|---|
| V2-Q3 *Stormont green energy scheme* | not found | **rank 2** |
| V2-Q9 *prepayment meters* | rank 34 | **rank 9** |
| V2-Q2 *peers on assisted dying* | rank 40 | **rank 11** |
| V2-Q5 *subpostmasters' convictions* | not found | rank 25 |
| V2-Q4 *benefit cap* | not found | rank 28 |
| **in-stream@20** | **0 / 11** | **3 / 11** |
| **found anywhere in 60** | **2 / 11** | **5 / 11** |
| gained / lost | — | **3 gained, 0 lost**, ranks moved on 5 of 11 |

▶ **This reverses the June decision.** That measurement asked *"does this find the right debate?"*,
where keyword matching is near-unbeatable. Asked *"does this find the right passage?"*, dense
retrieval finds three answers keyword search never returns at all and loses nothing. The mechanism
is that `corpus_vec` is **chunk-level** and `vectorSearchSections` collapses chunks to their parent
section — so dense matches at roughly paragraph scale, which is the remedy for exactly the unit
mismatch the autopsy flags on debates.

⚠ **Do not treat this as final, per the brief.** n is 11, the debates answer keys are under review,
and the question that would settle it is the argument set in `BRIEF_ARGUMENT_1A.md`. **It is,
however, enough to justify the flag** — 3 gained and 0 lost is a strictly-better result on the only
set we have.

⚠ **The arrival check caught a fault in ITSELF first, and the record is worth keeping.** It asserted
the dense leg had arrived by looking for `scorer: 'fused'` or `'vector'`, and reported *"the dense
leg did NOT arrive"* on all eleven questions — while three of them were simultaneously gaining the
answer, which is impossible if no dense leg ran. `fuseWeightedRrf` **overwrites** the scorer with
**`'rrf'`**. A positive check looking for the wrong token is a false alarm that would have
discredited a real result; the corrected version also asserts arm A is **not** fused, so the two
arms are provably distinct.

### 3.3 Committees at 2 of 10 — **the documents are fine; the keys are not**

Five failures probed individually (`scripts/probe-s16-committees.ts`), two probes each:

| id | key's own title → rank | raw question → rank |
|---|---|---|
| S10-Q10 | **1** of 100 | not found |
| S10-Q2 | **1** of 100 | not found |
| S10-Q5 | **2** of 100 | 5 |
| S10-Q4 | **4** of 100 | 17 |

▶ **Every key is indexed and retrievable.** This is not an index defect and not a scope defect. See
§0 and §5 for what it is: **5 of 10 keys are ministerial `Correspondence:` letters and 3 more are a
single evidence submission out of 54–525 equally valid ones.**

⚠ The haystack is real but is not the explanation: `committees-reports` holds **344,773** sections
and `committees-evidence` **142,315** — and a document from it comes back at **rank 1** when asked
for by name.

---

## §5 — WHAT IS HANDED TO WHICH STREAM, WITH COUNTS

⚠ **Nothing owned by ingest, graph, lex or the argument stream has been edited.** Each item below is
a report, not a change.

### → INGEST — 1 question, plus a collection-level finding

| | |
|---|---|
| **S10-Q28** | `guidance` key row exists with **10 words** and `status=compiled` — a stub. *"What guidance does HMRC give its own staff on money laundering"* cannot be answered from it. |

⚠ **And a bigger one that is not in the 32 because it never reaches a question:** `cps-guidance` and
`scottish-parliament-or` are ingested, compiled and indexed **under tier `other`, which no stream
selects** (§2, UNREACHABLE ×4). Whether the fix is an ingest re-tier or a search scope change is
**D-2** — the two teams should not both assume the other owns it.

### → THE ARGUMENT STREAM — 12 questions carry the unit modifier

**12 of the 32 failures have an answer key of 1,500 words or more, scored as a single document.**
Concentrated in debates (median key **2,634 words**) and caselaw (**25,163 words** on S10-Q16).
`BRIEF_ARGUMENT_1A.md`'s question set is the instrument that would separate *"the retriever cannot
find this document"* from *"the retriever found the document and the answer is one paragraph inside
it"* — which this sprint cannot do, because every question here is keyed at document level.

### → THE LEX STREAM — the build-side query

§4.1's measurement is the contrast: the gold path issues **41 of 41 written queries**, median 7
tokens, none truncated, none carrying an orphan referent. The build path issued a 13-token term
dump ending `… those system pr`. **Same platform, two builders, and only one of them is measured.**
`BRIEF_25F.md` §4 owns it. ⚠ `audit-s16-queries.ts --self-test` is reusable as-is against build-side
strings and is offered.

### → THE GOLD SET / CCh-SEARCH — ⚠⚠ 8 of the 10 committees questions cannot be scored fairly

This is the sprint's most consequential handover and it is **not** a code change.

| shape | n | what it means |
|---|---:|---|
| key is a `Correspondence:` ministerial letter, question asks what a **committee** said | **5** | the key does not answer the question as posed |
| key is **one** written-evidence submission out of an inquiry holding many equally valid ones | **3** | 1 of 525 · 1 of 115 · 1 of 54 |
| key is a Report or a small evidence set | **2** | ✅ **both are the two questions committees FINDS** |

⚠ **The control is exact.** The only evidence-keyed question committees finds, S10-Q7, is drawn
from the smallest class — **1 of 26**. With a 20-wide window and 525 equally-good documents, perfect
retrieval scores **wrong** roughly 96% of the time.

▶ **Recommendation: committees needs the same re-key debates is already having** (**D-3**). Until
then `committees 2/10` should be quoted as *"2 of 10 against a key set that 8 of them cannot match"*,
not as a retrieval figure.

---

## §6 — WHAT THIS SUPERSEDES, AND WHAT IT DOES NOT

**Superseded:**

| figure | where | replaced by |
|---|---|---|
| *"`fts-serve` has the same copied width of 4"* | this brief, §1 | **16**, read off `/stats` (§1.1) |
| `fts-serve` `maxQueue: null`, `rejections: null` | its own `/stats` | real numbers — the queue is bounded (§1.3) |
| *"debates dense is 15 points worse"* | June measurement | **0/11 → 3/11 in-stream, 0 lost** (§3.2) — a different question, honestly |
| *"impact assessments … a routing failure"* | this brief, §0 | confirmed as **NOT-ROUTED ×4**, and the obvious fix makes it **worse** (§3.1) |

**NOT superseded, and stated so nobody assumes otherwise:**

- **S15's baseline stands.** 32/64 in-stream, 19/64 displayed, 30/64 with the judged merge. Nothing
  in this sprint changed a production flag, so nothing changed those numbers.
- ⚠ **`committees 2/10` and `debates 0/11` are not retrieval measurements** and should stop being
  quoted as though they were (§5).
- **n is 64 throughout.** Every per-collection figure states its own n.

---

## §7 — WHAT IS NOT DONE, NAMED

1. ⚠ **The V2 control run was not done** — a re-route with V2 OFF, which is the only thing that
   separates the −3 from routing noise (§3.1). One run. It would not change the recommendation, but
   it would change how firmly it can be stated.
2. **Debates dense is measured but NOT enabled.** `LEX_VECTOR_STREAMS` is unchanged in production;
   D-1 is the decision.
3. **The `other` tier is not fixed.** `cps-guidance` and `scottish-parliament-or` remain
   unreachable by any stream (§2, ×4). Whether that is an ingest re-tier or a search scope change
   is **D-2** — deliberately not decided unilaterally, because it crosses a boundary §7 of the
   brief forbids me to cross alone.
4. **19 NOT-MATCHED failures have a class but not a cause.** The autopsy establishes that the right
   stream was searched and the key did not come back. For committees §3.3 shows why; for the other
   13 it does not, and the unit modifier is a hypothesis rather than a measurement.
5. **`corpus_fts` 18.27M rows vs `corpus_vec` 22.67M is unreconciled** (§1.2). Different units, but
   nobody has checked.
6. ⚠ **`fts-serve`'s cancellation was not watched FAILING on `fts-serve`** — the fix deployed with
   the same push, so the broken build is gone. The defect class's two-sided evidence is the dense
   service's (§1.4). The shed path *was* watched both ways.

---

## DECISIONS FOR CHARLIE

**D-1 — Give `debates` a dense leg?** *(Recommended: yes.)*
Measured this sprint: **in-stream@20 0/11 → 3/11, three gained, none lost**, with one answer moving
from not-found to **rank 2**. One environment variable —
`LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees,debates`. The service has the capacity
(S15: eight concurrent users, 0 rejections). *Consequence of no:* debates stays the one stream that
cannot find an argument, on a June measurement that asked a different question.

**D-2 — Who fixes the `other` tier: ingest re-tiers, or search widens a scope?**
*(Recommended: search adds a scope, as the smaller change.)*
`cps-guidance` and `scottish-parliament-or` are ingested, compiled, indexed — and **unreachable by
any query**, accounting for 4 of the 32 failures including 3 of guidance's. A re-tier means
rebuilding index rows; a scope change is a line in `stream-scopes.ts`. ⚠ **I have not made it,**
because the tier is baked into the index and I would be widening a stream to admit a tier called
`other` whose other contents I have not enumerated. *Consequence of no:* three CPS-guidance
questions can never be answered however good retrieval becomes.

**D-3 — Re-key committees, as debates is already being re-keyed?** *(Recommended: yes, and it is the
highest-value item here.)*
**8 of 10 committees questions cannot be scored fairly as posed** — 5 keyed to ministerial letters
when the question asks what a committee said, 3 to one submission out of 54–525 equally valid ones.
`scripts/audit-s16-gold-keys.ts` reproduces the count. *Consequence of no:* our largest evidence
collection keeps reporting 2/10 and every sprint keeps trying to fix a retriever that is working.

**D-4 — Enable `LEX_ROUTER_STREAMS_V2`?** *(Recommended: no, not yet.)*
It fixes exactly what it was built for — S10-Q33 goes from unreachable to **rank 1** — but drops
in-stream@20 from **32 to 29** by collapsing the router's fan-out (34 of 64 questions to a single
stream, against 20). The displayed figures improve (30 → 32 with the reranker), but that gain is
inside the re-route confound. *Consequence of yes now:* a production flag flipped on a comparison
that cannot separate the flag from routing noise. *Consequence of no:* four NOT-ROUTED questions
stay unrouted — worth less than the three the flag loses.

**D-5 — Should the next sprint be the argument set?** *(Recommended: yes.)*
**12 of the 32 failures are long documents scored whole**, and both §3.2's result and the debates
autopsy point the same way: the unit is wrong, not the retriever. `BRIEF_ARGUMENT_1A.md` is the
instrument. *Consequence of no:* the largest remaining class stays a hypothesis.

---

## STANDING-RULE NOTES

- **Every guard states what it counted.** `check-index-coverage` prints rows / indexed / unindexed
  per index; the autopsy prints a class and its evidence per question; the query audit prints counts
  per property. None of them asserts that something exists.
- **Two guards of mine were caught being wrong, by their own self-tests, before they were trusted.**
  The query check could not catch the only real defect it exists for (a stopword *threshold* where
  the discriminator is *which* word). The debates arrival check looked for the wrong scorer token
  and cried wolf on eleven of eleven. Both are recorded in place rather than quietly fixed.
- **A negative result is reported as a result.** `fts-serve` does not have S15's index defect; the
  gold-set queries are not the ones the brief indicts. Both were asked and both are written down.
- **Predictions logged before measurement, and scored honestly** — §3.1's was wrong in direction,
  which is the more useful outcome and is reported as such.
- **Git:** three code commits mid-sprint, because `fts-serve` deploys from Main and §7 requires new
  code proven running. Scoped by explicit path.
