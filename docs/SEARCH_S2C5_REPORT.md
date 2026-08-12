# SEARCH STAGE 2C-5 — THE PROBES ARE UP, THE METRIC IS HONEST, AND THE RERANKER IS NOT AUTHORISED

**Executes:** `docs/BRIEF_SEARCH_S2C5.md` §1, §2, §3. §4 follows below. §5 deliberately not started.
**Written:** 12 August 2026
**Stream:** SEARCH (per §6's labelling rule)

**The three headlines:**

1. **`VECTOR_NPROBES` is 64 in production**, verified positively from the process itself. Latency cost
   is real but small (p50 +13.9%); **the recall gain did NOT materialise at gold** (vector-alone
   69.2% → 68.6%), which is a finding worth more than the change.
2. **The ordering metric now scores only where an ordering decision exists** — 15 of 20 pairs; the 5
   cross-stream pairs are excluded because no product surface orders two streams by relevance.
3. **The PECR-leading regression does NOT reproduce** (DPA 2018 at rank 2, PECR absent from the top
   20). Preference accuracy is **66.7%**, but its denominator is **9**, and only **4** pairs actually
   compared two retrieved documents. **The reranker is not authorised, and the reason is that the
   metric's own denominator says the problem is retrieval, not ordering.**

---

## §1 — nprobes 24 → 64, as a measured A/B

### What was verified before anything changed

⚠ **The baseline in the brief was stale, which is why it said to re-read it.** Read at 22:31 UTC on
11 Aug, from the same process that had been up since 00:44:

| | brief's figure (02:31) | re-read (22:31) |
|---|---|---|
| `/stats` warm p50 | 3,647 ms | **2,957 ms** |
| `/stats` warm p95 | 4,355 ms | **5,447 ms** |
| warm n | 12 | 28 |

⚠ **And 28 samples cannot carry a p95** — it is one or two data points, and a restart resets the
counters to zero, so a fresh 28-sample p95 compared against it would be two pieces of noise with a
percentage between them. So the A/B is measured with `vector-latency-ab.ts`: the **same 20 queries, in
the same order, sequentially, with `noCache`**, so the only thing differing between runs is the
setting. `/stats` is recorded either side, never instead.

**Pre-change, controlled (n=20):** uncached **p50 2,763 ms · p95 5,615 ms · mean 2,793 ms**; cached
repeat pass p50 733 ms; 0 failures, 0 empty.
**Revert criterion fixed BEFORE the change:** uncached p95 above **8,423 ms** (+50%).

### Engagement verified positively, not by absence of errors

The setting could not be read from outside the process at all, so "it took effect" would have been an
inference. `vector-core` now exports `retrievalConfig()`, `/stats` serves it, and the service prints it
at boot. The sequence was:

1. deploy the instrumentation → `/stats` reports **`nprobes: 24`** — the *old* value, which is what
   makes the next reading mean something;
2. set `VECTOR_NPROBES=64`, restart;
3. `/stats` reports **`config: {nprobes: 64, chunkOverscan: 5, refineFactor: 2, cosine,
   gemini-embedding-001@768d}`**.

⚠ **Two operational facts found on the way, both of which had been silently true:**

- **vector-serve does not auto-deploy from GitHub.** My push touched
  `scripts/ingest/search/**` — the Railway watch pattern for both serve services. **fts-serve
  deployed (SUCCESS, 22:36:32Z, commit 69775e5). vector-serve created no deployment at all**, and its
  uptime kept climbing. That is why it had been sitting on **7 August** code while fts-serve tracked
  Main. It needs an explicit `vector-serve-run.ts redeploy`. Cause not established — the trigger
  simply does not fire; its last two deploys were both manual `redeploy`s.
- **A rebuild could not have confounded this A/B, and that was checked rather than assumed:** all five
  files making up vector-serve's runtime (`vector-query-service`, `vector-core`, `vector-common`,
  `lance`, `query-cache`) were **byte-identical** between its running build `e04a2a7` and HEAD.
- ⚠ **What restarted the process is NOT established.** The explicit `restart` returned *"Cannot
  redeploy yet, please wait for the original deployment to finish building"*, and moments later the
  service was up with `nprobes: 64`. Most likely the in-flight code redeploy finished and its new
  container read the new variable. So I cannot claim "a variable change alone does not restart the
  service" — the observation is confounded and is recorded as such.

### The latency half

Same 20 queries, same order, `noCache`:

| | before (24) | after (64) | delta |
|---|---:|---:|---|
| uncached **p50** | 2,763 ms | 3,148 ms | **+385 ms (+13.9%)** |
| uncached **p95** | 5,615 ms | 3,874 ms | **−1,741 ms (−31.0%)** |
| uncached mean | 2,793 ms | 3,047 ms | +254 ms (+9.1%) |
| cached repeat p50 | 733 ms | 766 ms | +33 ms (+4.5%) |
| failures / empty | 0 / 0 | 0 / 0 | — |

**Within the revert criterion, comfortably.** The central tendency rose ~9–14%; the tail did not get
worse in this sample. ⚠ The p95 *improvement* should not be banked — a p95 over 20 samples moves with
one outlier, and the before-run had one. The defensible statement is: **p50 up ~14%, tail unchanged
within the resolution of this sample.** The after-run also ran on a freshly-booted process, which if
anything penalises it.

### The recall half — and this is the part that matters

Gold set against the **real** `corpus_fts` + `corpus_vec`, same harness, twice, only nprobes differing
(`vector-gold-reconfirm`, cpx42, 5.1 and 6.4 min, €0.013 + €0.017, peak 2.5 and 3.0 GB):

| | 24 probes | 64 probes | delta |
|---|---:|---:|---|
| BM25-alone (n=26) | 62.2% | 62.2% | **0.0pp — negative control** |
| vector-alone | 69.2% | **68.6%** | **−0.6pp** |
| fused @0.7 | 67.3% | **68.6%** | **+1.3pp** |

By archetype, fused @0.7 — the legislation stream is A, B and C:

| archetype | stream | 24 | 64 | delta |
|---|---|---:|---:|---|
| **A** | legislation | 90.0% | 90.0% | 0.0 |
| **B** | legislation | 25.0% | **30.6%** | **+5.6pp** |
| **C** | legislation + guidance | 80.0% | 80.0% | 0.0 |
| D | citation graph | 93.3% | **86.7%** | **−6.6pp** |
| E | debates | 90.0% | 90.0% | 0.0 |
| F | bills + debates | 60.0% | 60.0% | 0.0 |

**BM25-alone identical to the decimal across both runs is a clean negative control**: the harness is
deterministic and only the vector arm moved, so these deltas are real changes in retrieval rather than
measurement noise.

⚠ **But real is not the same as material, and the sample forbids the stronger claim.** Each archetype
holds 5–6 queries, so one query shifting is worth ±17–20pp. B's +5.6pp and D's −6.6pp are each about
one query's worth of movement. **The honest summary is that gold recall did not materially change in
either direction.**

⚠ **AND THE DISTINCTION THAT MATTERS MOST — two different metrics were conflated, and one of them was
mine to keep straight.** S2C4 measured **overlap with an exhaustive probe**: how much of what the index
*could* return at full probing actually comes back. That was 70.4% at 24 probes and ~85% at 64. The
brief translated it as "+12.7pp of dense recall". **It is not gold recall, and the two did not move
together**: candidate-set fidelity improved substantially while gold recall@20 moved −0.6pp
(vector-alone). The explanation is mechanical — more probes surface more near-neighbours, and a
*larger* candidate set can push a gold document out of a fixed top-20 just as easily as it can pull one
in. **A better candidate set is a necessary condition for better answers, not a sufficient one.**

### Where that leaves the setting

The brief's decision was "run it" with a single revert trigger on p95, and that trigger was not hit, so
**64 is in place**. But the justification has weakened and Charlie should see that plainly:

> We are currently paying **~14% on p50** for a **materially better candidate set** whose benefit at
> gold is **not demonstrated**. That is a defensible trade if the next build consumes candidates
> better — a reranker or a fusion change — and a poor one if nothing does.

I have not reverted it: the brief decided to run it, the revert criterion was explicit and unmet, and
unilaterally undoing an instructed change on a different criterion than the one set would be worse than
reporting it. **It is one variable and one restart to put back.**

---

## §2 — The ordering metric, fixed on its own, before any baseline

Landed as its own commit with no baseline number, per the brief.

**20 pairs authored → 15 scoreable (within-stream) → 5 EXCLUDED (cross-stream), named in the output.**

The five are excluded because **no surface in the product orders two streams by relevance** — verified
by reading both candidates rather than assuming:

- `results` is **round-robin** (`interleave.ts`): between streams, position is the `STREAMS`
  declaration order plus the per-stream floor, by construction;
- `grouped` is a **stable filter** over that list — per-type caps, incoming order preserved.

⚠ **A stale comment nearly produced the opposite conclusion.** `interleave.ts` still said
*"NOT FIXED HERE: `groupForPanel` still does exactly the global cross-stream score sort"*. Reading it, I
concluded a cross-stream surface existed and was about to score all five pairs against it. **That sort
was deleted on 2026-08-09** (`score-scope.ts` holds the account and the assertion that stops it coming
back). The comment is corrected in place, with a note on why: *a comment describing a fix that has
already landed is not harmless, it is a false map.* Same family as everything else this week — a
true-looking sentence with its provenance stripped off.

The five are **not deleted** and their reasoning still stands. They become scoreable the moment a real
cross-stream ordering exists — which is what a reranker *is* — so they are the ready-made acceptance
test for one.

---

## §3 — The baseline, and the reranker decision

### The benchmark: the regression does not reproduce

Measured on the **product path** — routed, per-stream fused, `LEX_VECTOR_STREAMS=legislation`, the
interleaved list before `groupForPanel`:

| instrument | rank |
|---|---|
| **Data Protection Act 2018** | **2** (and again at 11) |
| PECR 2003 (uksi/2003/2426) | **absent from the top 20** |
| UK GDPR (eur/2016/679) | absent from the top 20 |

**→ A principal instrument outranks PECR. The 4 August regression does NOT reproduce.** The prediction
recorded in the brief, and mine, are confirmed. The top 20 is visibly interleaved across all five
streams, which is the S2A §1 fix working as designed.

⚠ **UK GDPR being absent is a retrieval finding in its own right** and is not good news hiding inside
good news: the amending SI (`uksi/2019/419`) is retrieved at 16 while the instrument it amends is not
retrieved at all.

### ⚠ A harness defect found by running it, which would have produced the opposite conclusion

The first run printed **"PECR still leads the principal instruments. The ordering problem is REAL."**
from a ranking of **zero documents**. `DATABASE_URL` was absent from the env I passed,
`prisma.$queryRaw` threw, `fts-search` returned empty *"NOT a stub"* exactly as designed — and the
benchmark's verdict logic turned that emptiness into the most alarming available conclusion, because
with nothing retrieved neither principal instrument outranks PECR.

Had that run been reported, it would have been evidence for building a reranker, manufactured from a
missing environment variable. **Fixed:** an empty ranking now refuses to conclude and exits non-zero;
an all-three-absent ranking reports VACUOUS as a retrieval finding rather than an ordering one. Same
family as the invisible fail-open (§18): *a failure wearing the face of a result.*

### The baseline number, and its honest denominator

```
preference accuracy   66.7%  (6/9)
cross-stream excluded 5
vacuous (excluded)    6      ← neither side retrieved
```

**20 authored → 5 cross-stream excluded → 15 scoreable → 6 vacuous → denominator 9.**

⚠ **The number is 66.7% and the denominator is what should be read.** The proposal's own warning
applies: *a shrinking denominator is a warning, not a win.* Decomposing all 15 scoreable pairs by what
actually happened, which is what "report recall lost separately from ordering changed" requires:

| outcome | n | what it measures |
|---|---:|---|
| **both sides retrieved, order correct** | **2** | a genuine ordering PASS |
| **both sides retrieved, order wrong** | **2** | a genuine ordering FAIL |
| preferred retrieved, dispreferred absent | 4 | scored a pass — but this is a **recall** win, not an ordering one |
| preferred absent, dispreferred retrieved | 1 | scored a fail — but this is a **recall** loss |
| neither retrieved (vacuous) | 6 | a **recall** gap; excluded from the denominator |

**Only 4 of 15 pairs compared two documents the system actually returned. On those, the split is 2/4.**
Eleven of fifteen pairs were decided by whether a document was retrieved at all.

The three failures, most-wrong first:

1. **HSWA 1974 (11) vs sector-specific SIs (2)** — a real ordering failure: the general duties that
   frame every sector regulation sit nine places below one of them.
2. **LTA 1985 (2) vs HA 1988 (1)** — a real ordering failure, but adjacent ranks; the repairing
   covenant is LTA 1985 s.11.
3. **UK GDPR (absent) vs DPPEC 2019 (16)** — scored a fail, but it is a **recall** miss: the amended
   regime never arrived.

### The reranker decision

**Not authorised, and the evidence points somewhere else.**

- The single observed regression that motivated it **does not reproduce**.
- The genuine-ordering evidence is **4 pairs, 2 wrong**. Four pairs cannot authorise a sprint.
- **11 of 15 pairs turned on retrieval, not order.** A reranker reorders the set it is given; it cannot
  promote a document that never arrived. On this evidence the binding constraint is recall.

The pairs are not the problem — they were authored before any reranker existed, which is what makes
them trustworthy. The problem is that **the system does not yet retrieve both sides of most of them**,
and that is a retrieval finding, not an ordering one.

**Recommended next**, on this evidence rather than intuition: raise the *candidate* count reaching the
scorer (the vacuous six are the target), and re-measure. If preference accuracy then still sits near
two-thirds with a denominator worth the name, the reranker case becomes real and this same harness will
show it.

### What was carried, and what was NOT measured

- **Archetype D exclusion (D2–D5):** the brief asks the excluded count be stated. **It does not bite
  here** — the preference set contains no archetype-D query at all, so nothing was excluded on that
  ground. The D2–D5 exclusion applies to the gold *recall* harness, where it stands.
- **"Recall lost to scoping — 10 questions, not 12":** carried, and **NOT re-measured in this sprint.**
  It needs a routed-versus-unrouted comparison; I measured the routed product path only. Reporting it
  as if it had been re-measured would be exactly the error §0 of the previous brief praised avoiding.
- **Which path each number came from:** §1's gold table is the **ingest-side untiered** harness
  (`score-vector-full.ts`, real indexes, no router). §3's benchmark and baseline are the **routed
  product path** (`runSearch`, per-stream fusion, interleaved, pre-grouping). They are different
  measurements and are not comparable — the EN2 finding is why this sentence exists.
- **`caselaw` 36/36 → 22/36: still NOT answered.** The brief expects this gold run to settle it, but
  neither harness I ran measures *router stream selection* over that 36-query set — the ordering
  harness reports selection only for its own 16 queries, and the ingest-side harness is untiered.
  Answering it needs a router-selection count, which is a small separate run. Not done, not fudged.

---

## §4 — The legacy DROP unblock: its two unknowns are now settled, the repoints are not done

**The eight read paths are all still live.** Re-audited rather than assumed — the tree has moved a great
deal since the 9 August brief, so several might have been repointed in passing. None have:

| # | path | reads |
|---|---|---|
| A | `lib/lex/gateway-legacy.ts:287` | `legislationSection.findMany` — Lex chat, panel, `/api/search` |
| B | `app/legislation/[itemId]/page.tsx:13,26` | `legislationItem.findUnique` — public page |
| C | `app/api/legislation/[itemId]/route.ts:9` | same |
| D | `app/api/legislation/test-sections/route.ts:10` | `legislationSection.findMany` |
| E | `app/api/ideas/[id]/field-approval/route.ts:165` | `legislationItem.findUnique` |
| F | `app/api/legislation/link/route.ts` | writes `IdeaLegislation` |
| G | `lib/search.ts:177–178` | raw SQL join — filtered `/api/search` is served ONLY by this |
| H | `app/api/ideas/[id]/legislation-search/route.ts:75–76` | raw SQL join, the fallback |

**I have NOT repointed them.** That is a deliberate stop, not an oversight: eight runtime paths across
Lex chat, a public page and five API routes, each needing rendered-output verification, ending in a
repoint-confirm that authorises an irreversible 1.73 GB DROP. Starting that at the end of a long session
is the wrong trade, and the brief's own ordering puts it after §3 precisely so it gets a clean run.

**What I did instead was settle its two open unknowns, read-only, so the next session starts with them
in hand rather than spending its first hour finding them.**

### The `IdeaLegislation` row — MIGRATE, and the evidence says why

One row, unchanged since 29 May 2026:

```
IdeaLegislation  linkType 'relevant'  addedBy 32c15f4f…  createdAt 2026-05-29T00:43:23Z
  Idea  374c54e5…  "Abolish the Supreme Court"  STAGE_1  creator 32c15f4f…
  →  LegislationItem 2ecb9cd9…  ukpga/2005/4  "Constitutional Reform Act 2005"
  →  corpus_acts     ukpga/2005/4  "Constitutional Reform Act 2005"  leg_type ukpga  year 2005  ✓ present
```

**This is real user work, not test junk, and the content is what proves it:** the Constitutional Reform
Act 2005 is the Act that *created* the Supreme Court, linked from an idea called "Abolish the Supreme
Court" by the idea's own creator fourteen minutes after making it. That is a considered, substantively
correct legal link — no random fixture produces that. **Decision 2 applies: migrate to the gid form**,
and `corpus_acts` carries the gid, so the target exists. One row, one `UPDATE`.

### The filters — `corpus_acts` can already serve them, with one caveat that needs a decision

The brief's decision 3 is confirmed and the fields exist. Measured:

| | |
|---|---|
| `corpus_acts` rows | **250,808** |
| `leg_type` populated | **250,808 (100%)** |
| `year` populated | 249,198 (99.4%) |
| `title` populated | **135,531 (54.0%)** |
| existing indexes | `corpus_acts_year_idx`, `corpus_acts_leg_type_idx`, `corpus_acts_browse_idx`, `corpus_acts_title_trgm_idx`, `corpus_acts_jurisdiction_idx`, `corpus_acts_in_corpus_idx` |
| legacy `LegislationItem` rows | 135,531 |

**No new indexes are needed** — the brief's "index them if needed" is already satisfied, including a
composite `browse_idx` and a trigram index on title.

⚠ **But "wider coverage" needs reading carefully before it ships.** Coverage moves 135,531 → 250,808
(+85%), and **the titled subset of `corpus_acts` is exactly 135,531 — the same number as the legacy
table.** So the extra 115,277 instruments are precisely the ones with **no title**: `celex` 90,260,
`eur` 25,248, `eudn` 13,897 dominate them — EU-derived material. A type/year filter moved onto
`corpus_acts` as-is would therefore return up to 46% untitled rows.

That does not undo decision 3 — filtering by type and year over the full instrument set is still the
better feature, and `leg_type` is 100% populated — but **it is a product decision the brief did not
have the number for**: either render untitled instruments with their gid as the display label, or
filter to `title IS NOT NULL` and accept the legacy coverage. **Charlie's call, and it is the first
thing §4 should settle** rather than being discovered halfway through the repoint.

---

## Costs

| item | cost |
|---|---|
| `vector-gold-reconfirm` × 2 (cpx42, 5.1 + 6.4 min) | €0.013 + €0.017 |
| ~120 live query embeddings (latency A/B + benchmark + baseline) | fractions of a cent |
| Production changes | one Railway variable, two restarts |

**Total spend: €0.030.**
