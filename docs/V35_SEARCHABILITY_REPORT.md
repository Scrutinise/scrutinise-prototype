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

### ⚠ Status: shards 0 and 1 in flight, shard 2 FAILED and needs a re-run

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

## §3 — ANN rebuild + `vector-serve` restart — NOT DONE, blocked on §1

Both halves still required once the embed completes:

```
tsx ../ops/heavy-job/run.ts run vector-index      # 32 GB class — never Railway (CLAUDE.md §17)
tsx search/vector-serve-run.ts redeploy           # it does NOT auto-deploy from GitHub
tsx search/verify-vector-index.ts                 # expect unindexed = 0
```

---

## §4 — Report

**`vector-serve` /stats BEFORE (2026-08-12 11:35 UTC):**

```
started_at 2026-08-11T22:46:25.910Z   uptime 42,275 s   served 95   errors 0
config.nprobes 64   chunkOverscan 5   refineFactor 2   distance cosine
model gemini-embedding-001   dims 768
warm_p50 2,423 ms   warm_p95 3,843 ms   memory rss 1,697 MB / cap 7,629 MB
```

`started_at` is the S2C5 restart, i.e. the service has not been redeployed since. **AFTER is
outstanding** — it must be taken after the redeploy in §3, and the `started_at` must have moved,
or the restart did not happen and any after-measurement is meaningless.

**Sections indexed per corpus** — before is in §2; after is outstanding.

**Embed cost predicted vs actual** — predicted $4.50; actual outstanding.

**ANN unindexed count** — outstanding, expect 0.

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
