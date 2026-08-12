# INGEST V35 — making the political-evidence layer searchable

**Executes:** `docs/BRIEF_INGEST_V35_SEARCHABILITY.md`. §1 chunked and embedding; §2 running;
§3 pending §1; §4 below; §5/§6 recorded, not started.

**Date:** 2026-08-12. **Predicted spend $4.50, hard ceiling $8.00** (prediction recorded in
CHANGE_LOG *before* the run, per §1).

---

## §0 — The brief's sequencing note is wrong, and correcting it was the first thing done

§0 says the display typing gates the **FTS build**, and that §1 (the embed) can start immediately.
**It gates the embed too.**

`v33-vec-catchup.ts` phase 1 writes `tier: tierFor(corpus)` into every `corpus_chunks` row, and
`lib/lex/vector-search.ts` passes `tier` to the vector service as a **server-side prefilter**,
refusing the results outright if the service does not echo it back. So starting §1 before
CC-Search committed the typing would have baked `other` into **95,044 chunks** — a tier no router
stream selects. The rows would have been chunked, embedded, paid for and unreachable: the same
UNREACHABLE condition the brief's §0 is about, arrived at through the vector half rather than the
keyword half.

So S2C6 §1 was landed first, then the tiers were **verified in `corpus_chunks` before any spend**
(`scripts/ingest/v35-verify-chunk-tiers.ts`, with a negative control):

```
✓ commons-divisions-votes  18,888 chunks  tier=["parliamentary"]
✓ lords-divisions-votes    18,219 chunks  tier=["parliamentary"]
✓ impact-assessments       49,248 chunks  tier=["legislation"]
✓ consultations             8,652 chunks  tier=["guidance"]
✓ negative control: an unmapped corpus still tiers "other"
```

---

## §1 — The embed

### The prediction, recorded before spending (CHANGE_LOG 2026-08-12 11:50 UTC)

| | |
|---|---|
| unvectored delta | **32,113 sections (0.18% of 18,198,797)** |
| chunks to embed | 90,008 modelled / **95,044 actual** |
| estimated tokens | 59,938,903 (`chars/4`) |
| CPW, measured on 300 real bodies | 6.161 |
| **predicted cost** | **$4.50** at Batch $0.075/M |
| independent cross-check | V33's $36.51 for 768,085 chunks → pro-rata **$4.28** |

⚠ **V34's "~46 M tokens" forecast is 23% low** against the 59.9 M measured — V34 counted words,
this counts `chars/4` with chunk overlap, and overlapping text is embedded twice. Recorded so it
is not rediscovered as a fault.

**The delta is the V34 material and essentially nothing else**, which independently confirms V33's
closing claim that the vector index was current: 31,849 of 32,113 rows are the four V34
collections; the remaining **264 are zero-word sections** across seven older collections (183
`scottish-parliament-or`, 34 `pwdata-wrans`, …) modelling to 0 chunks. Phase 1 reported **227 body
misses**, which are those same empty rows.

### Two tooling traps closed BEFORE the run, not after

`--run <tag>` added to `v33-vec-delta.ts` and `v33-vec-catchup.ts` (default `v33`, every historical
path byte-identical):

1. The delta script **overwrites its own report every run**. Its header asks the next caller to
   save elsewhere; asking is not a mechanism, and it had already replaced the 9 Aug prediction
   with the 11 Aug acceptance measurement once. Verified after the change that
   `docs/v33_vec_delta.json` still carries `measuredAt 2026-08-09` and $35.73.
2. **The catch-up checkpoint is the dangerous one.** `_search/v33_vec_catchup.checkpoint.json` is
   `phase: "done"` with `doneShards` stored as **indices**. Against a different work list the
   shard numbering differs, so V35's shard 7 would have been skipped because V33's shard 7 was
   done — and the run would have reported success having embedded a subset. That is precisely the
   failure this script's own header describes for `build-vector-index.ts`, one level down.
3. A third, found by reading the output: `--run` correctly wrote `docs/v35_vec_delta.json` while
   the console **printed "report → docs/v33_vec_delta.json"** — a hardcoded literal beside a
   variable path. A message naming a file the code did not write is a false map. Fixed.

### Phase 1 hardened, because it failed

The chunk phase died at section 10,000 of 32,113 with
`Generic S3 error: Error performing PUT … partNumber=2 … HTTP error: error sending request` — a
transient R2 multipart fault. **Phase 2 retries its embed calls three times; phase 1 had no retry
at all**, so one network blip cost the whole phase. Now retried with the same backoff, and safe to
repeat because the batch's chunks are deleted immediately before the append. Resumed cleanly from
the checkpoint at 10,000 and completed: **95,044 chunks, 227 body misses.**

### COMPLETE — 95,044 vectors, 0 misses, **$4.87 against $4.50 predicted (+8.2%)**

| shard | vectors | misses | cost |
|---|---:|---:|---:|
| v35-shard-00001 | 40,000 | 0 | $1.951 |
| v35-shard-00000 | 40,000 | 0 | $2.072 |
| v35-shard-00002 | 15,044 | 0 | $0.844 |
| **total** | **95,044** | **0** | **$4.87** |

**The prediction is scored: $4.50 predicted, $4.87 actual, +8.2% — inside the CPW sensitivity band
whose top was $4.94.** The V33 pro-rata cross-check ($4.28) was 12% low; the token model was the
better of the two, as it should be, since it counts the chunker's real geometry rather than
assuming chunks are the same size across corpora.

**The reconciliation closes exactly**, which is the acceptance test rather than the shard log:
`corpus_vec` **22,613,652** = `corpus_chunks` **22,613,652**; 95,044 chunks in, 95,044 vectors out,
0 misses; checkpoint `phase: "done"`. `corpus_vec` moved 22,518,608 → 22,613,652, exactly +95,044.

⚠ **Shard 2 failed on the first pass and needed an explicit re-run** — it died at *job creation*
(the network fault below), so no spend was lost and `doneShards`/`spentUsd` were untouched. The
re-run planned 3 shards, found 2 done, and did only the third. **This is what the `--run <tag>`
checkpoint separation bought:** against the V33 checkpoint the same re-run would have read
`phase: "done"` and shard indices from a different work list.

### The first pass — kept, because it is the evidence for the retry rule

3 shards at 40,000 chunks. Shard 2 failed at **job creation** (before any spend) with `fetch
failed` on all 3 retries — the same network fault as below. Shards 0 and 1 were submitted and are
in flight; Gemini Batch is slow by design. `cp.doneShards` is empty and `spent=$0.00`, so a re-run
picks up exactly what is missing.

**To finish it:**

```
cd scripts/ingest
NODE_OPTIONS="--no-network-family-autoselection --dns-result-order=ipv4first" \
  ./node_modules/.bin/tsx v33-vec-catchup.ts --run v35 --embed --max-cost 8.00
```

### ⚠ The network fault, root-caused — it is not a Neon outage and not a dead key

Midway through, **every** database connection and **every** Gemini `fetch` began failing, on all
resolved addresses:

```
connect ETIMEDOUT  13.41.250.251 / 13.43.29.36 / 35.177.127.187
connect ENETUNREACH 2a05:d01c:… (×3)
```

while PowerShell `Test-NetConnection 13.41.250.251 -Port 5432` returned **TcpTestSucceeded: True**
at the same moment.

**Cause:** Neon resolves to 3 IPv4 + 3 IPv6 addresses. This machine has no IPv6 route, so every
IPv6 attempt returns ENETUNREACH immediately. Node ≥20 enables `autoSelectFamily` (happy-eyeballs)
by default and races the families on a short per-attempt timeout. When Neon's compute has
**auto-suspended**, the IPv4 connect takes ~10 s to wake it — far outside the race window — so the
whole connect is abandoned and reports as if nothing were reachable.

**Fix, verified:** `NODE_OPTIONS="--no-network-family-autoselection --dns-result-order=ipv4first"`
→ connected in 9,906 ms on the first try, three times running.

This matters beyond today: the symptom is indistinguishable from an expired credential, a
suspended project or a firewall change, and it is **intermittent by construction** — it works
whenever the compute is warm. One `Test-NetConnection` to a resolved IP separates it in seconds.
Saved to memory.

---

## §2 — The FTS index build

`fts-catchup.ts --corpora=…` scoped to the four collections. It appends with `tierFor()` at write
time, so the corrected tiers land in the index directly and **no `extraCorpora` bridge is needed** —
the first collections in a long time where the built index and the tier map agree from day one.

**Before (dry-run, 12:33 UTC):**

| corpus | sections | in `corpus_fts` | missing |
|---|---:|---:|---:|
| commons-divisions-votes | 2,361 | **0** | 2,361 |
| lords-divisions-votes | 3,284 | **0** | 3,284 |
| impact-assessments | 18,756 | **0** | 18,756 |
| consultations | 7,448 | **0** | 7,448 |
| | | | **31,849** |

Index coverage before: `indexed=18,166,926 unindexed=0 (0.00% brute-force scanned per query)`.

⚠ **A `--reindex` is NOT required for correctness** — `rankedSearch` never calls `fastSearch()`, so
LanceDB scans un-indexed fragments alongside the index and appended rows are searchable
immediately. It is a *performance* step, and 31,849 rows against 18.17 M is 0.18%, well below the
1,191,345-row backlog that made warm p50 26 s in August. Re-check `.fts-index-debt.json` after the
append and reindex if the debt is material.

**After: 31,849 written, 0 body misses**, every corpus fully closed (2,361 · 3,284 · 18,756 ·
7,448). §2 is **complete**.

⚠ **The after-measurement needed an `fts-serve` restart to mean anything.** The first `after` run
came back byte-identical to `before` — 0/620 slots, 6/6 on-target ABSENT — because `fts-serve`
calls `openTable()` once at boot and was still serving the `2026-08-11T22:37:06.994Z` snapshot.
That is the trap `docs/CLAUDE.md` §17 records for this service, and it presented exactly as "the
index build had no effect". Caught only because the harness records `started_at` on both runs and
they were identical. After `fts-serve-run.ts redeploy` → `2026-08-12T12:45:59.251Z`, and then:
**4 of 6 on-target questions answered (0 before), contamination 3.8%, no gold answer key lost, no
latency change.** The two that remain absent are the roll-calls — see `SEARCH_S2C6_REPORT.md` §1;
they are indexed and correctly typed but out-ranked by a stream 2,000× their size, and the fix is
a stream decision rather than a config line.

---

## §3 — ANN rebuild + `vector-serve` restart — DONE

**The verify was watched FAILING first, which is what makes its pass mean anything.** Immediately
after the embed and before the rebuild:

```
[verify-vec] vector_idx (IVF_PQ): indexed=22,518,608 unindexed=95,044 (0.42% brute-force per query)
[verify-vec] ❌ 95,044 unindexed rows exceeds the allowed 0 — the rebuild did not absorb the appended vectors
```

Then `heavy-job run vector-reindex`:

```
[vec-index]  ANN index built in 1130.3s
[vec-index]  DONE. corpus_vec rows=22613652 (vectors=21846364, misses=0)
[verify-vec] vector_idx (IVF_PQ): indexed=22,613,652 unindexed=0 (0.00% brute-force per query)
[verify-vec] ✅ ANN index present and covers all 22,613,652 rows
[heavy-job]  server 161891851 destroyed
[heavy-job]  COST: cpx62 × 20.5 min @ €0.2942/h = €0.101
[heavy-job]  PEAK RSS: 5.8 GB
```

Placement succeeded first time (`cpx62@nbg1`) — the dedicated-core quota that refused every
placement on 11 Aug did not bite, because this job's `serverTypes` were corrected to shared-vCPU
first. **`expectedPeakGb` updated 5.6 → 5.8** in `jobs.ts` from this second measurement; the box
size is deliberately NOT reduced, per the note there — two agreeing measurements justify recording
the number, not shrinking the headroom, and the table only grows.

⚠ **`vector-reindex`, NOT `vector-index` — and this script's own closing hint said the wrong one.**
`v33-vec-catchup.ts` printed `run.ts run vector-index`, which would have reported success and
built nothing: both of that job's scripts are checkpointed `phase: "done"` from the July build, so
it prints "already done", creates no index, and destroys the box. `jobs.ts` documents exactly this
at the `vector-reindex` definition; the hint was pointing away from it. Fixed.

**`vector-serve` redeployed** (it does not auto-deploy from GitHub — the 11 Aug finding held):

| | before | after |
|---|---|---|
| `started_at` | 2026-08-11T22:46:25.910Z | **2026-08-12T17:08:24.979Z** |
| `config.nprobes` | 64 | **64** |
| `served` | 153 | 0 (fresh boot) |

The `started_at` moved, so the service is on a new snapshot and any measurement taken against it
is about the rebuilt index rather than the 11 Aug one.

---

## §4 — Report

Everything §4 asks for, in one place.

**Sections indexed per corpus:**

| corpus | before | after |
|---|---:|---:|
| commons-divisions-votes | 0 | **2,361** |
| lords-divisions-votes | 0 | **3,284** |
| impact-assessments | 0 | **18,756** |
| consultations | 0 | **7,448** |
| | | **31,849, 0 body misses** |

**Embed cost predicted vs actual: $4.50 → $4.87 (+8.2%)**, inside the CPW band (top $4.94).
95,044 vectors, 0 misses.

**ANN unindexed count: 0** — `indexed=22,613,652 unindexed=0 (0.00% brute-force per query)`, and
the same check was watched reporting `unindexed=95,044 (0.42%)` beforehand.

**`vector-serve` /stats:**

| | BEFORE (11:35 UTC) | AFTER (17:09 UTC) |
|---|---|---|
| `started_at` | 2026-08-11T22:46:25.910Z | **2026-08-12T17:08:24.979Z** |
| `config.nprobes` | **64** | **64** |
| served / errors | 153 / 0 | 0 / 0 (fresh boot) |
| warm p50 / p95 | 2,423 / 3,843 ms | — (no traffic yet) |

⚠ The before `started_at` is the S2C5 restart — the service had not been redeployed since 11 Aug,
which is the auto-deploy gap V35 §3 flagged. It moved only because of an explicit
`vector-serve-run.ts redeploy`.

⚠ **Latency after is deliberately blank rather than 0.** `served: 0` on a fresh boot means the
counters are since-boot and there is nothing in them; quoting a p50 off an empty sample would be
the shape of number this project has already been burned by. The comparable measurement needs
traffic first.

---

## §5 / §6 — carried, unchanged

Lords eligible-peer roll · `stage_outcomes` · the gov.uk IA route overlap · Public Whip ODbL ·
ONSPD NI "BT" postcodes. None started; none blocking.

---

## ⚠ A finding for the INGEST thread that came out of the SEARCH half

`docs/SEARCH_S2C6_REPORT.md` §2/§3 has the detail. In short: **17,261 instruments known to the
legacy `LegislationItem` table are absent from `corpus_sections`** — `ukpga` 8,896, `uksi` 4,668,
`eur` 2,268, `ssi` 732 — carrying **77,000 sections and 61.2 M characters**, including the
**Companies Act 2006** (1,665 sections) and **UK GDPR** (61). They are the largest bucket in the
recall diagnosis, and they are why the V26 §6 DROP of `LegislationSection` must not proceed: it
would destroy the only copy. **Ingesting them is an INGEST task with a number on it, and it closes
a SEARCH problem at the same time.**
