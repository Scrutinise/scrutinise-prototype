# SEARCH S11 — THE CORPUS IS REACHABLE, AND THE INDEXES ARE CURRENT

**Executes:** `docs/BRIEF_SEARCH_S11.md` §0–§6.
**Date:** 2026-08-21. **Author:** CC-Search.

---

## THE ONE-PARAGRAPH ANSWER

**Nine collections — 48,883 sections — could not be returned by any query, at any setting, and
seven of them now can.** Each of the nine was confirmed one at a time against the live index
rather than inferred from the pattern: 8 of 8 probed came back at rank 0–4 scoped to their own
corpus and were returned by **no** router stream when the same query was issued with that
stream's real scope. The fix is a tier move plus a rewrite of 43,893 index rows, and it was
**measured before it was built**: guidance in-stream recall@20 goes **3/10 → 8/10**, and
consultations — the collection S10's flag-based fix cost two answers — goes **4/9 → 4/9, not one
question lost and not one rank moved.** ⚠⚠ **The brief's central warning is therefore refuted as
applied to this change, and the refutation is the useful part: "widening a stream is zero-sum" is
a property of the EXTRA-LEG mechanism, where `mergeLegs` divides a fixed budget, not of the
collection or of the tier.** ⚠⚠ **And a finding nobody asked for: S10's recall numbers, taken
twenty hours earlier, no longer reproduce** — 5 of 5 sampled guidance rankings had moved, because
the 20 August case-law re-compile rewrote 74,896 bodies and a delete-and-re-add moves BM25
document frequencies for the whole table. Our own playbook already says a baseline measured across
that is void; nobody applied it to a content refresh. ❌ **The case-law re-embed (§3) was not
started and the $31 is unspent** — reasons and plan below.

---

## §1 — THE REACHABILITY AUDIT, WHOLE CORPUS

Regenerated from the live index and the live stream scopes: `docs/CORPUS_REACHABILITY.md` and
`docs/corpus_reachability.json` (2026-08-20 23:59 UTC), then confirmed collection by collection
against the running service.

**74 collections · 18,521,164 sections · 18,272,377 FTS rows · 22,689,587 vectors.**

| verdict | collections | sections | what it means |
|---|---:|---:|---|
| reachable | 62 | 18,358,567 | some router stream can select it |
| **keyword-only** | **9** | **48,883** | **no stream can — surfaces only when routing is OFF or has failed open, i.e. never in production** |
| deferred-to-graph | 2 | 110,266 | `early-day-motions`, `petitions` — routed to the position graph on purpose |
| excluded-by-design | 1 | 3,448 | `members-interests`, named with a reason |
| UNREACHABLE | 0 | 0 | — |

### ⚠ The brief expected the sweep to find collections outside the list of nine. It did not, and that is a result.

Six collections have appeared since the matrix was last generated on 10 August —
`consultations`, `impact-assessments`, `commons-divisions-votes`, `lords-divisions-votes` and two
others — and **every one of them is reachable.** The unreachable set is exactly the same nine
S10 named. The deferral list was complete; what it lacked was a price, not members.

### The nine, and the two different mechanisms inside them

⚠ **They are not one defect.** Seven are a tier-map omission; two are a display-type exclusion,
and **a tier entry would not fix those two.** Reporting them as one number would have produced one
fix and left a third of the sections behind.

| collection | sections | display type | indexed tier | mechanism | probe |
|---|---:|---|---|---|---|
| `cma-cases` | 22,898 | GUIDANCE | `other` | tier-other | rank 4, streams NONE |
| `ofgem` | 17,161 | GUIDANCE | `other` | tier-other | rank 1, streams NONE |
| `ofcom` | 4,169 | GUIDANCE | `other` | tier-other | rank 2, streams NONE |
| `independent-reviews` | 667 | GUIDANCE | `other` | tier-other | rank 0, streams NONE |
| `cps-guidance` | 270 | GUIDANCE | `other` | tier-other | rank 0, streams NONE |
| `inquiry-evidence` | 90 | GUIDANCE | `other` | tier-other | rank 0, streams NONE |
| `lgsco` | 40 | GUIDANCE | `other` | tier-other | ⚠ **not probeable — see below** |
| `uk-treaties` | 3,264 | **TREATY** | `parliamentary` | **type-excluded** | rank 1, streams NONE |
| `tax-treaties-dta` | 324 | **TREATY** | `parliamentary` | **type-excluded** | rank 1, streams NONE |

*`tier-other`* — `tierFor()` has no entry, so the rows were built under `other`, which no
`StreamScope` names. *`type-excluded`* — already inside a tier a stream owns, then excluded twice:
named in `NON_DEBATE_PARLIAMENTARY`, and typed TREATY, which neither `debates`
(`types: ['DEBATE','DIVISION']`) nor `committees` (`['COMMITTEE']`) admits.

### How the probe works, and the control that caught it being wrong

`scrutinise-web/scripts/probe-s11-reachability.ts`. Each collection is searched **by a document's
own title, inside its own collection** (probe A), then the same query is re-issued **once per
router stream with exactly the scope that stream sends** — tier, `corpora`, `excludeCorpora`, plus
the client-side display-type filter that is the fourth and last gate (probe B). A collection no
stream returns, on a query its own index answers at rank 0–4, cannot be returned by any routed
query whatever the wording.

⚠⚠ **The first version of this probe reported a REACHABLE collection as unreachable, and the
control is the only reason that is a sentence in a report rather than a defect in a decision.**
It selected each collection's LONGEST title, on the assumption that longest is most distinctive.
For `uk-treaties-fcdo` the longest title is *"Exchange of Notes between the Government of the
United Kingdom and the Turkish Government regarding Commercial Relations"* — and so is most of the
other 23,371. Corpus-scoped, its own title returned **rank −1**: every sibling matches the same
nine common terms and the one discriminating word loses to the crowd. Three controls run before
any suspect, chosen to share a display type with a suspect and differ only in the thing under
test; the run refuses to report the suspects at all if one fails. It failed, and the selection was
rewritten to S10's own standard — try candidates until one comes back at **rank 0–2 scoped to its
own corpus** — which is what makes probe B's silence mean something.

Controls after the fix: `college-of-policing` rank 0 → guidance ✅ · `uk-treaties-fcdo` rank 0 →
debates ✅ · `erskine-may` rank 1 → guidance ✅ (the last one proves the probe honours the
`extraCorpora` second leg rather than treating tier `other` as automatically fatal).

### ⚠ `lgsco` could not be probed, and the reason is a different defect

All 40 of its rows are titled, and **every title is a bare ten-character case number** —
`25 016 779`, `25 019 294`. There is no name to search by. It is included in the mapping on the
tier evidence, which is unambiguous, but it has not been behaviourally confirmed and this report
does not claim it has. **This is the same class as the `scottish-courts` and `cma-cases` display
titles the case-law report named as unfixed** — a slug or a reference stored where a name belongs
— and it is now a third instance. Not fixed here; it is an ingest question.

### ⚠ Also found: `cps-guidance` titles carry raw HTML entities

The first probe returned `&#039;Honour&#039;-Based Abuse and Forced Marriage`. The entity-decode
work of 17 August covered the legacy legislation tables and did not reach this collection.
Display-only — Postgres discards `&amp;`-shaped tokens from a tsvector, so it costs no retrieval —
but a user reads it. Reported, not fixed.

---

## §1.2 — THE MAPPING DECISION, WITH THE MEASUREMENT UNDER IT

**Seven collections move into the `guidance` tier. The two treaty collections do not move, and
that is a decision for Charlie.**

### Why one destination and not seven, and why that is not the trap the brief names

The brief warns: *"Do not put everything in `guidance` to make the number go up … S10 already
measured the mechanism: turning `cps-guidance` on inside `guidance` cost consultations two
answers, because `mergeLegs` divides a fixed budget."*

⚠⚠ **That measurement is of the extra-leg path, and the tier move is a different mechanism.** An
`extraCorpora` entry is a SECOND retrieval call whose results `mergeLegs` sorts into the main
leg's fixed budget — a quota, so a gain must be taken from something. A tier move puts the rows in
the MAIN leg, where there is no second list and nothing to divide: they have to earn their place
on score.

That is a claim, so it was measured before anything was built.
`scrutinise-web/scripts/measure-s11-tier.ts`, in-stream recall@20 on Charlie's validated set,
dense OFF, the two arms differing **only** in which rows are eligible:

| collection | n | ARM A (today) | ARM B (re-tiered) | |
|---|---:|---:|---:|---|
| guidance | 10 | 3/10 | **8/10** | **+5** — Q22, Q23, Q25, Q26, Q27 recovered |
| consultations | 9 | 4/9 | **4/9** | **0 — not one question lost, not one rank moved** |
| **total** | **19** | **7/19** | **12/19** | **+5** |

Compare S10's extra-leg arm on the same collections: guidance 2/10 → 8/10 **and consultations
6/9 → 4/9**. Same recovery, and the cost belongs to the mechanism rather than to the collection.

**The measurement did not need the rebuild, and that is not an approximation.** A stream's main
leg retrieves `tier = X`; the service also accepts a `corpora` prefilter over the same table; and
**a prefilter selects rows without rescoring them** — BM25 statistics are global. So ARM A as a
corpus list is a tier leg. ⚠ Asserting that would have been a guess, so it was controlled: the
same query issued with `corpora=[…20 guidance-tier collections]` and with `tier: 'guidance'`
returned **identical lists, id for id, on 5 of 5 questions.**

⚠ **In-stream, not merged.** These are comparable with S10's in-stream column, not with its 34%
merged figure. The round-robin interleave across streams costs six questions of 44 on its own and
is untouched here (§5.3).

### Per collection, with one line each

| collection | → | why |
|---|---|---|
| `cma-cases` 22,898 | `guidance` | CMA merger and competition decisions. A regulator's determinations; already display-typed GUIDANCE. The largest of the nine, and the one most likely to displace — it did not. |
| `ofgem` 17,161 | `guidance` | Energy regulator decisions and licence conditions. Same shape. |
| `ofcom` 4,169 | `guidance` | Communications regulator; carries gold question GD4, which was being satisfied from an unreachable collection. |
| `independent-reviews` 667 | `guidance` | Statutory and independent reviews — the tier already holds NAO and OTS reports. |
| `cps-guidance` 270 | `guidance` | S10's finding. Its flag retires with this. |
| `inquiry-evidence` 90 | `guidance` | Public inquiry evidence; `inquiry-reports` is already here, and splitting the two was never a decision anyone took. |
| `lgsco` 40 | `guidance` | Ombudsman findings on councils and care. Tier evidence only (above). |
| `uk-treaties` 3,264 | **no change** | See below. |
| `tax-treaties-dta` 324 | **no change** | See below. |

⚠ **`erskine-may` deliberately stays an extra leg** rather than joining the tier. It is
parliamentary *procedure*; filing the rules of the House under the same heading as an Ofgem
licence condition would be the label error the display types exist to prevent. It is the one
collection whose retrieval home and whose subject genuinely disagree, which is the shape
`extraCorpora` is for.

### ▶ THE TREATIES ARE A DECISION FOR CHARLIE, AND THEY CANNOT BE MEASURED TODAY

`uk-treaties` (3,264) and `tax-treaties-dta` (324) are typed TREATY inside the `parliamentary`
tier. Fixing them means **admitting a display type to the debates stream, or building a sixth
stream** — the brief makes either Charlie's call with the latency cost stated (a sixth routed
stream is a sixth retrieval call per query against a `vector-serve` concurrency cap of 4).

⚠ **And it cannot be scored:** the validated set has **zero debates questions** (S10 §7 Q5), so a
change to what the debates stream returns has nothing to measure against. Shipping it blind would
break the rule that a scope change ships with a before-and-after. **Reported, not done.**

⚠⚠ **The sharp version, which makes it worth deciding rather than deferring again:**
`uk-treaties-fcdo` — **23,372 sections, seven times larger** — *is* reachable, and only because it
happens to be display-typed DEBATE. The platform answers treaty questions from one treaty
collection and not from its sibling, on a type distinction no user has ever made.

---

## §2 — THE REINDEX

### Predictions, logged before the run

| | predicted | measured |
|---|---|---|
| rows in the table | ~18.27 M | **18,272,377** ✅ |
| un-indexed before | **118,789** | **118,789** ✅ exact |
| un-indexed after | 0 | *(see below)* |
| build time | ~570 s (linear fit on four prior runs) | *(see below)* |
| peak RSS | ~19.5 GB, under 32 GB | *(see below)* |
| cost | ~€0.05 | *(see below)* |

### 2.1 The re-tier — 43,893 rows, and a two-order-of-magnitude mistake caught by running it

`scripts/ingest/search/fts-refresh.ts --retier-all`. ⚠ The collection list is **computed from the
index**, not from a list anyone maintains: it scans `(corpus, tier)` and selects every collection
whose indexed tier disagrees with `tierFor()` today. It independently selected exactly the seven
that had been mapped, which is the check on the mapping rather than a restatement of it.

⚠⚠ **The first live run would have taken about three hours and the second took 5.3 minutes.** The
first reused `refresh-fts-caselaw`'s shape — read 500, `delete WHERE id IN (…500 ids…)`, add 500 —
and managed **3,697 rows in 15 minutes**. The cause is not the write: **`corpus_fts` has no scalar
index on `id`**, so each of the 88 delete predicates was a full scan of 18.2 M rows. Batching the
ids made the scans more numerous, not cheaper. One `corpus = '…'` predicate per collection is 7
scans instead of 88.

⚠ The safety argument had to be **restated rather than inherited**. `refresh-fts-caselaw` batched
deliberately so that at most 500 rows were absent at any instant. Deleting a whole collection
reopens that window, and it is acceptable here for reasons that would not hold there: every record
is read and mapped **before** the delete is issued; the largest collection is 21,525 rows against
case law's 74,896; and the resulting state after a crash — ids in `corpus_sections`, absent from
the index — is exactly what `fts-catchup` exists to repair. ⚠ It is **not** safe merely because
`fts-serve` holds a boot snapshot and would not notice; that is an accident of the reader.

Result: **43,893 rows moved `other` → `guidance`** (4,866 in the killed first run, 39,027 in the
second — the tool detected the three already-correct collections and skipped them, which is the
self-healing property working). Un-indexed rows **74,896 → 118,789**, as predicted exactly.

### 2.2 ⚠ WHAT THE UN-INDEXED ROWS COST WHILE THEY SIT THERE — WORSE THAN THE PRECEDENT PREDICTS

With 118,789 un-indexed rows the live service answered in **30–45 s**, against a 25 s client
timeout. The standing precedent is 1,191,345 un-indexed rows taking warm p50 from 4.5 s to
25–32 s — **ten times the un-indexed rows for less of the penalty.** The relationship is not
linear in row count, and a single earlier query on the same service that morning returned in
3.5 s. This is the strongest argument yet for the standing rule that the heavy job follows a
backfill *immediately* rather than "soon", and it is reported rather than smoothed over: **for the
window between the re-tier and the rebuild, keyword search was effectively timing out.** No user
was exposed — `fts-serve` was serving a boot snapshot — but the margin was luck, not design.

### 2.3 The build — predicted, then measured

`tsx ../ops/heavy-job/run.ts run fts-index`, cpx62 (16 vCPU / 32 GB) in nbg1, provisioned → run →
verified → **destroyed**.

| | predicted | measured | |
|---|---|---|---|
| rows | ~18.27 M | **18,272,377** | ✅ |
| un-indexed before | **118,789** | **118,789** | ✅ exact |
| un-indexed after | 0 | **0** | ✅ |
| build time | ~570 s | **546 s** | ✅ within 4% |
| peak RSS | ~19.5 GB | **16.0 GB** | ⚠ **refuted, on the safe side** |
| cost | ~€0.05 | **€0.056** | ✅ |
| sample query | — | **44,274 ms → 1,639 ms** | **27×** |

⚠ **The peak prediction was wrong and `jobs.ts` has deliberately NOT been lowered to match.** 16.0 GB
sits below the whole 18.0–19.8 GB band of the four previous runs, on a *larger* table. That file's
own rule covers this exactly — *"one run below the record on more data is noise, not more
headroom"* — so the run is recorded as a fifth data point and `expectedPeakGb` stays 19.8. The
runner prints "record this in `jobs.ts`"; declining it, with the reason, is the right reading of
the rule.

⚠⚠ **And the `before` number belongs in the sizing note: 118,789 un-indexed rows — a TENTH of the
1,191,345 that caused the August latency incident — produced a WORSE query time (44.3 s) than that
incident did (25–32 s).** The penalty is not linear in row count. "Only a few thousand rows were
appended" is not a reason to defer this job.

### 2.3.1 ⚠ The case-law titles are in the BUILT index, verified there and not in the database

The brief asks for this specifically, because finding 2 is precisely that the two are different
places. Read directly out of `corpus_fts` after the build:

```
tna-caselaw IN THE BUILT INDEX
  rows            74,896
  with a title    74,883  (99.98%)
  itemDate range  1965-08-09 .. 2026-06-11   (74,896 dated)
  sample:  2001-04-11  G, Re Application for Judicial Review
           2003-07-14  Southall & Anor, R (on the application of) v Secretary of State for
                       Foreign & Commonwealth Affairs
```

`fts-drift.ts --corpus=tna-caselaw` independently reports **no drift** against `corpus_sections` on
title rate, word total and date range.

### 2.3.2 The recall measurement reproduces after the rebuild

Re-run post-build, unchanged: **guidance 3/10 → 8/10, consultations 4/9 → 4/9.** The rebuild
absorbed 118,789 rows into the inverted index without moving the outcome, which is what makes the
pre-build measurement (§1.2) sound rather than lucky.

### 2.4 `LEX_GUIDANCE_CPS` retired

Flag, branch and constant deleted in one commit: `lib/env-flags.ts`, `lib/lex/query-router.ts`
(`guidanceCpsEnabled`, the cache key), `lib/lex/stream-scopes.ts` (`GUIDANCE_CPS_EXTRA`, and the
`cpsGuidance` parameter of `activeStreamScopes`). Deleted rather than defaulted off: left in place
it would double-retrieve a collection already in the tier, and a redundant flag that still gates a
live code path is a trap for the next reader.

⚠⚠ **SEQUENCING — THIS IS THE ONE THING IN THE SPRINT THAT CAN BRIEFLY MAKE SOMETHING WORSE.** The
flag was Charlie's stopgap and is ON. The code and the index ship separately: the index has the
re-tiered rows, but **`fts-serve` holds its table from boot.** So between Vercel deploying this
commit and `fts-serve` being redeployed, the code path is gone and the served index still has
`cps-guidance` under `other` — the collection is briefly unreachable again. **The redeploy should
follow the deploy promptly.** Named here rather than left to be discovered.

---

## §3 — THE CASE-LAW RE-EMBED — ❌ NOT STARTED, AND THE $31 IS UNSPENT

**This is the largest thing the brief asked for that this sprint did not do, and it is not a
scoping judgement dressed up as one — it is a refusal to start a job I could not finish safely.**

The brief is explicit: **both halves or neither.** Re-chunking without re-embedding leaves every
vector describing text no longer at that chunk index, so a match on one passage displays another —
*worse than doing nothing*. That makes a half-finished run the failure mode, not merely an
incomplete one.

Three things make it a sprint of its own rather than a step in this one:

1. ⚠ **`build-vector-index.ts` shards `corpus_chunks` sorted by `chunkId` and records DONE shard
   INDICES in its checkpoint.** It states, and relies on, `corpus_chunks` being immutable after the
   build. Replacing one collection's chunks renumbers every shard boundary, so a resumed run
   re-embeds the whole 21.8 M-chunk corpus — **"a four-figure mistake, not a slow one"**, in that
   file's own words. `v33-vec-delta.ts` exists precisely because of this and is an APPEND path; a
   REPLACE path does not exist and would have to be written and validated.
2. **The Batch API carries a ≤24 h SLA**, and the vector-index rebuild is a further heavy job of
   hours. Started without a completed pipeline, the realistic outcome is money spent and results
   nobody writes back.
3. The safe shape is a **staging table** (`VECTOR_CHUNKS_TABLE` / `VECTOR_VEC_TABLE` are already
   env-overridable) so the old vectors keep serving until the new ones are complete and both swap
   together. That is the design; it is not built.

**Nothing was spent and nothing was left half-done.** The recommendation stands unchanged from
`INGEST_CASELAW_TEXT_REPORT.md` Decision 1 — do it — and it should be the next search sprint's
first item, with the staging-table design above as its §1.

⚠ Until it runs, **the meaning-based half of case-law retrieval is still computing over, and
displaying, a stylesheet**: 12.7% of everything ever embedded for case law, with chunk 0 more than
half CSS in 77% of documents. The keyword half is fixed and served; the two halves now disagree
about what a case-law document says.

---

## §4 — THE STALE-INDEX DEFECT, CLOSED PROPERLY

Three tools write to `corpus_fts` and each carried its own copy of the mapping from a
`corpus_sections` row to an index record. **They had already drifted, and the drift was invisible
because it was harmless where it sat.**

⚠ `build-fts-index` and `fts-catchup` both run legislation rows through `buildCitation`, replacing
`sectionTitle` with a citation and prefixing the body with a citation header.
`refresh-fts-caselaw` does not — while its header states it uses *"exactly the record shape
`fts-catchup` writes so the two cannot drift"*. True of the fields, false of the derivation. It
cost nothing there because `tna-caselaw` is in the `caselaw` tier and the branch only fires for
`legislation`. **Generalised naively — which is what this sprint was asked to do — it would have
silently stripped the citation title from every legislation row it touched.**

Built:

- **`scripts/ingest/search/fts-record.ts`** — the ONE definition of an index record, plus the
  shared column list and act-title loader. `buildFtsRecord` **throws** rather than degrading if it
  is handed a legislation row with no act index, so a wrong call fails loudly instead of writing a
  row that differs from what a rebuild would write.
- **`scripts/ingest/search/fts-refresh.ts`** — the general refresh. Selects by `--corpus`,
  `--ids-file`, `--ids` or `--retier-all`. Two modes, and the distinction is the point:
  `--from=db` rebuilds from `corpus_sections` + R2 (a CONTENT change); `--from=index` carries the
  body and title through untouched and recomputes only the derived `tier`/`jurisdiction` (a
  RE-TIER). ⚠ The second is **not** an optimisation of the first: re-reading R2 for a re-tier would
  pick up every unrelated change since the row was written and ship it inside a change advertised
  as a tier move.
- **`scripts/ingest/search/fts-drift.ts`** — the detector, because **a refresh script nobody runs
  is not a fix.** Per collection it compares row count, title rate, total word count and
  `itemDate` range between the index and the database: one projected Lance scan plus one grouped
  SQL query, ~20–40 s, no writes, nothing provisioned. **Cheap enough to build rather than
  propose**, which is what §4 asked to be decided. It has a `--self-test` that plants a fake stale
  state and requires the check to fire, because a detector that reports "no drift" on a healthy
  corpus is indistinguishable from one that cannot report drift at all. ⚠ Its limits are printed
  in its own summary line: aggregates cannot see a rewrite that preserves all four.
- **`docs/INGEST_PLAYBOOK.md` §20 addendum** — the checklist item, as the brief asked. ⚠ This is
  an edit to an ingest-owned document, made because §4 explicitly requires it; no ingest *code*
  was touched.

---

## §4.2 ⚠⚠ THE FINDING NOBODY ASKED FOR: S10's RECALL NUMBERS NO LONGER REPRODUCE

ARM A of the tier measurement should have reproduced S10's "before" arm. It did not —
consultations measured **4/9** where S10 recorded **6/9** with the flag off, and guidance measured
3/10 against 2/10.

Two candidate causes, and they were separated rather than argued about:

1. My simulation differed from a real tier leg. **Ruled out** — `corpora`-list and `tier` legs
   returned identical lists id-for-id on 5 of 5 questions.
2. **The index moved.** Confirmed: compared against the ranked lists S10 stored during its own
   retrieval pass, **0 of 5 reproduce**; top-10 overlap 3–8 of 10; and in several cases a
   `consultations` document at rank 0 has been displaced by a `quangos-govuk` one.

**The mechanism is already written down in our own playbook** (`INGEST_PLAYBOOK.md` §20, 5 Aug
addendum): removing rows changes BM25 **document frequencies**, so ranking moves for everyone, and
*"any gold-set or answer-key baseline measured before the cleanup is void"*. A content refresh is
a delete-and-re-add, so it has the identical consequence — and on 20 August the case-law
re-compile rewrote **74,896 bodies**. Nobody connected the rule to the case, because the rule was
written about deliberate deletion and this was a repair.

⚠ **What follows, and it is uncomfortable:** S10's per-collection recall figures — the numbers
Q2, Q3 and Q4 were priced on — were taken hours before that rewrite and **are void, not merely
stale.** S10's *internal* comparisons remain sound (both arms were measured minutes apart in one
pass); its absolute numbers do not describe the index the platform serves. The same applies to
this sprint's ARM A/ARM B pair, which is why both were taken in the same minutes on the same
service.

▶ **The consequence for the process, now in the playbook: re-baseline after any content refresh,
and treat a recall number taken across one as void rather than stale.**

---

## §5 — THE ITEMS RAISED BY OTHER THREADS

### §5.1 The `limit` fan-out — made self-describing, behaviour deliberately unchanged

`GatewayQuery.limit` is a **per-stream budget**, not a total: it goes to every routed stream, each
over-fetches ×3 for fusion, and `results` is the interleaved sum — `min(3 × limit, 100) × streams`.
A caller asking for ten receives a hundred and fifty. `grouped` is 20 either way, which is why it
went unseen for six weeks.

**Done, as the brief specified:**

- `meta.requested` — `{limit, returned, streams, fanout}` on every non-empty search, beside the
  existing `meta.perStream`. The gateway also logs `asked N → got M across K stream(s) (F×)`
  rather than a bare result count, because a bare count is what every log line already had.
- `docs/SEARCH_CONTRACT.md` §2 rewritten. The contract said *"max canonical results before
  grouping"* and the code did something else, **and every caller was written against the
  documentation** — so the doc now carries the measured table, the reason it stayed invisible, and
  the pending decision.

⚠ **The behaviour is unchanged on purpose.** Making `limit` a total moves recall on every surface
on the platform, and the validated set still has no debates and no legislation questions to
measure that with. Recorded in the contract as a pending decision with an owner.

### §5.2 The two template-literal findings — one was not what it was reported to be

`lib/lex/query-router.ts:276` — a cache key over two booleans. Made explicit with `String()`
rather than suppressed. (The key is now a single boolean, since `LEX_GUIDANCE_CPS` retired; the
comment records that a scope-shaping flag must be added to it.)

⚠ **`lib/lex/stats-catalogue.ts:392` was reported as an `unknown` reaching a user-facing GEOGRAPHY
label. Running `lint:templates` rather than trusting the description showed otherwise.** The
geography line is already `String()`-wrapped and is fine; the actual `unknown` on line 392 is
**`r.cofogFunctionCode`**, one field along. Same line, different value, and a different severity:
`fields.cofog` is **tokenised, never displayed**, so an object there would not print
"[object Object]" to a user — it would put the tokens `object` and `Object` into the search index
for every series carrying a COFOG code. A quieter fault than the reported one and a worse one to
find later. Fixed at the narrowing rather than at the interpolation. `lint:templates` is now clean
across `lib/`.

### §5.3 The interleave finding, restated and left standing

S10 measured in-stream recall@20 at **48% (21/44)** against **34% merged**: with four streams
routed the merged top 20 holds ~5 per stream, and **the round-robin interleave alone costs six
questions of 44** — Q4 missed by a single position. It is not a defect (concatenation was measured
worse, S5) but a measured allocation decision.

**Not touched here, deliberately.** It is the next big architectural question; it needs debates and
legislation questions to measure; and it should be its own sprint. ⚠ Note it interacts with this
sprint: the +5 above is **in-stream**, and how much of it survives the interleave to reach a user
is exactly the quantity the interleave sprint would measure.

---

## WHAT IS NOT DONE, NAMED

1. ❌ **The case-law re-chunk and re-embed (§3).** Not started, $31 unspent, reasons and design in
   §3. The meaning-based half of case-law retrieval still serves a stylesheet.
2. ❌ **`uk-treaties` and `tax-treaties-dta` remain unreachable** — 3,588 sections. A decision for
   Charlie, unmeasurable until a debates validated set exists.
3. ❌ **`lgsco` is mapped on tier evidence only** — its titles are bare case numbers, so no probe
   could be built for it.
4. ⚠ **No browser walk, and none is claimed.** The extension has no host permission for localhost
   and no Clerk session on production from here.
5. ⚠ **The re-tier is verified by direct read of the index, NOT through `fts-serve`**, which holds
   its table from boot. Nothing in §1/§2 reaches a user until it is redeployed.
6. ⚠ **The interleave dilution is measured and unchanged** (§5.3).
7. ⚠ **`cps-guidance` HTML entities and the `lgsco` title defect** are reported, not fixed —
   ingest questions.

### ⚠ Cross-thread, raised not fixed

**`scrutinise-web/lib/lex/user-material.ts` is UNTRACKED and does not compile.**
`tsc --noEmit` returns exactly one error across the whole web app, and it is
`user-material.ts(219,34): error TS1125: Hexadecimal digit expected` — a malformed escape,
` -\u000\\u000C-`, where `` was meant. The file appears in **no
commit on any branch**. This is a half-written file from a live session, and it is the
`build-cost.ts` shape exactly: **it will break the production build the moment anything that
imports it is committed.** Not edited — it is the Lex thread's file and a half-written file from
another session is worse than an absent one. ▶ **Whoever owns it: fix the escape and commit it with
its importers, or delete it.**

Every other file in the tree typechecks clean.

---

## ▶ THE TWO THINGS ONLY CHARLIE CAN DO

**1. Redeploy `fts-serve`.** Railway → service `fts-serve`
(`c268ec09-e489-4cfa-837a-7740d95c24c7`, `https://fts-serve-production-4cea.up.railway.app`) →
Deployments → ⋮ on the latest SUCCESS → Redeploy.

*Why:* it calls `openTable()` once at boot with no `readConsistencyInterval`, so it is still
serving the pre-re-tier snapshot. **Nothing in this sprint reaches a user until it restarts.**

*Expected observable signal — a counter and a result, never an absence of errors:*
- `GET /stats` → `started_at` moves and `served` resets to 0. If `started_at` is unchanged, the
  redeploy did not happen, whatever the dashboard says.
- `POST /fts-search {"query":"domestic abuse prosecution charging","tier":"guidance","limit":20}`
  → **returns `cps-guidance` rows.** Today, against the old snapshot, it returns none. This is the
  one-line proof that the whole sprint landed.
- Warm p50 should return to low single-digit seconds from the 30–45 s of §2.2.

**2. The `LEX_GUIDANCE_CPS` environment variable can be deleted from Vercel** once the redeploy
above is done. The code no longer reads it, so it is inert either way — but leaving a retired flag
set is how the next reader comes to believe it does something.

*Expected observable signal:* `[query-router] streams in force: …` no longer prints
`LEX_GUIDANCE_CPS=…`. ⚠ **Order matters:** see §2.4 — until the redeploy, `cps-guidance` is briefly
unreachable again.

---

## ⚠⚠ THE REDEPLOY REQUIREMENT IS PROVEN, NOT ASSUMED — AND SO IS THE TEST FOR IT

"`fts-serve` holds its table from boot" is repeated in several files. It was tested rather than
repeated, from the pre-redeploy side, with a control that fires:

```
POST /fts-search {"query":"domestic abuse","tier":"guidance","corpora":["cps-guidance"]}  → 0 rows
POST /fts-search {"query":"domestic abuse","tier":"other",   "corpora":["cps-guidance"]}  → 5 rows
```

**The served index still has the collection under `other`.** After the redeploy those two results
must **swap** — that is the acceptance test, and it is two-sided, so a service that had simply
stopped returning anything could not pass it.

⚠ **One thing did reach the running service without a redeploy, and it is worth recording because
it complicates the rule:** the latency gain did. The same service went from **44 s** to **2.8–4.2 s**
on ordinary queries after the rebuild, while still serving the old tier for the rows above. So the
rebuilt index files are visible to it and the re-tiered row *content* is not. **Stated as measured;
the mechanism is not asserted.** The practical consequence is unchanged and now has evidence
under it: **the redeploy is required for the tier change, and nothing in §1 reaches a user without
it.**

---

## FILES

**New:** `scripts/ingest/search/fts-record.ts` · `scripts/ingest/search/fts-refresh.ts` ·
`scripts/ingest/search/fts-drift.ts` · `scrutinise-web/scripts/probe-s11-reachability.ts` ·
`scrutinise-web/scripts/measure-s11-tier.ts` · `docs/SEARCH_S11_REPORT.md`

**Changed:** `scripts/ingest/search/corpus-map.ts` · `scripts/ops/heavy-job/jobs.ts` ·
`scrutinise-web/lib/lex/stream-scopes.ts` · `scrutinise-web/lib/lex/query-router.ts` ·
`scrutinise-web/lib/lex/search-gateway.ts` · `scrutinise-web/lib/lex/stats-catalogue.ts` ·
`scrutinise-web/lib/env-flags.ts` · `docs/SEARCH_CONTRACT.md` · `docs/INGEST_PLAYBOOK.md` ·
`docs/CORPUS_REACHABILITY.md` · `docs/corpus_reachability.json`

**Checks:** `tsc --noEmit` clean except one pre-existing error in an untracked Lex file (above) ·
`lint:templates` **clean across `lib/`** · `fts-drift --self-test` **planted drift FIRED** ·
probe controls **3/3** · tier-leg fidelity control **5/5 id-for-id** · heavy job verify
**unindexed=0**.

**Spend:** €0.056 (index build) + £0 model cost. **The $31 case-law re-embed was not started.**
