# SEARCH-30: why search was slow, and a stable noise filter (CCh 22 Oct, "SEARCH — priorities changed")

Written 2026-11-19 00:06 UTC. Laptop session (cc-search). **No gold run has been made**: CCh asked for this report first.

## 1. Why fts-serve took 86 s (Lex, 22 Oct ~00:45 UTC)

### What the evidence shows

| | finding | how it was read |
|---|---|---|
| A | **vector-serve was about 14× slower from its 20 Oct 08:15 restart onwards, and was waiting on storage.** warm p50 46–48 s, p95 78–94 s, ANN p50 36 s, **cpu/wall 0.13**, queue 0, rejections 0. | `/stats` snapshots inside the 23 Oct census files (`s28-gold-off-2`, `-on-1`, `-on-2`, `s29-railway-smoke`, all `vectorServeBefore/After`) |
| B | The same service on its previous boot (26 Sep) was healthy: p50 3.3 s, ANN 2.5 s, **cpu/wall 1.31** (CPU-bound). | `s28-gold-off-1` (taken 20 Oct 07:40, before the restart) |
| C | fts-serve was redeployed **two minutes earlier**, at 20 Oct 08:13 (`80bbb264`, commit 42ec7730, Ingest's LEX_FIVE push; no change to service code). | Railway `deployments` |
| D | It was **not contention**. At 00:45 the only spend in the ledger is Lex's own check turn; Search's measurement runs ended at 23:37; no build was running. fts-serve CPU across the whole night peaked at 0.15 of 8 vCPU (15-minute average). | `LlmSpend` at minute resolution; Railway `metrics` |
| E | **Today the condition is gone.** Lex's exact query, replayed against fts-serve on its own: 4.2–7.5 s; zero-match control 14 ms (so there is no un-indexed tail); short queries under 1 s. Both services: warm p50 3.5–4 s, no queue, no rejections, memory 28% and 10% of cap. | live `/fts-search` replay and `/stats`, 18 Nov 23:49 UTC |
| F | Production traffic is tiny: **7 queries per service since 14 Nov 03:19** (4.8 days). | `/stats.served` |

**Cause, as far as it can be established.** After the 20 Oct restarts, both services were spending their time waiting on R2 range reads. Both open the Lance tables straight off R2, with no local cache, so every query is a series of HTTP range reads. fts-serve's own `/stats` from that boot were never captured, so its share of A is **inferred** from the same-minute restart and the matching symptom, not measured (`docs/CLAUDE.md` §19).

**Not established.** *Why* R2 reads were slow for that boot. Railway reports `region: null` on every deployment, so placement can't be read back. The 20 Oct deployment's logs have expired. A Lance version listing over R2 did not finish in 30 minutes and was stopped. The purge ledger shows no index deletes before 20 Oct. One of the later restarts (25 Oct, 4 Nov, 14 Nov) ended the slow condition; which one is unknown.

### What made it worse, and is still true

1. **Fan-out.** One Lex `search_corpus` call (`runSearch`, AD_HOC_RESEARCH) sends **8 fts-serve and 8 vector-serve requests at `limit` 60**: it asks for 12 results and fetches 300 ("25×"). With three streams in flight, the slowest fts leg takes 11–16 s, against 4–7 s for the same query on its own. Total for the search is 20–29 s today, reproduced twice through the real gateway under production's flags. Any slowdown in storage is multiplied by this.
2. **The alert could not fire usefully.** The daily digest flags a service when p95 > 5 s (`cost-digest-data.ts`, `P95_ALERT_MS`). vector-serve's *healthy* September p95 was already 10.6 s, and both services sit above 5 s today. The alert was firing every day before 20 Oct, so a 14× jump looked the same as normal. The signal that would have caught it is **cpu/wall falling from about 1.3 to about 0.1**.
3. **Lex's 120 s timeout (decision 234)** doesn't fix any of this; it only makes a slow search wait longer before it fails. It should go back to 75 s once item 2 below is live.

### Proposed fix (cheapest first). None applied; items 2–4 need Charlie

1. **Search, no spend.** Replace the fixed 5 s p95 alert with two alerts that can't be on all the time: **cpu/wall below 0.4 for 10 or more warm queries** (storage-bound), and **warm p50 above 3× the last healthy boot's p50**. That would have caught the 20 Oct state in the next digest. Lex's timeout can be lowered once this is in place.
2. **Restart on detection (Ingest/ops).** A storage-bound boot was cleared by a restart. The Ops service could restart a serve with `deploymentRedeploy` (same artefact) when alert 1 fires twice in a row, and prove the restart from `/stats.started_at`.
3. **Take R2 off the per-query path (Ingest, needs a decision and some spend).** Copy the Lance tables to a Railway volume when an index is rebuilt and open them locally. That removes the dependency on R2 latency entirely. It needs a size and cost figure first; not measured here.
4. **Fan-out (Search + Lex, a recall trade-off).** For `search_corpus`, fetch `limit` 20 per stream instead of 60. That's a third of the index work per search, but it changes what the judged merge sees, so it needs a gold measurement before it ships.

## 2. Noise filter: same idea, three runs

**Change** (`lib/lex/orientation/v2.ts`, `x-orientation.ts`). The X call no longer *drops* anything. It returns every post it read, each tagged `argument | abuse | sarcasm | pile-on | no-argument`, at **temperature 0** (it was 0.2). `applyNoiseRule()`, a pure function of those tags, decides what is dropped and logs each drop with its reason and the post URL. A label the model didn't give from the list reads as `argument`, so the rule only drops what was positively tagged. The call is now identical whether the filter is on or off; only the rule differs. Every tag is kept on the result (`xTags`).

**Result** (`scripts/measure-s30-noise.ts`, idea 2ef5358b, the one that went 21 → 6; `docs/census/s30-noise.json`; 31.8p, ledgered as a measurement):

| | before (SEARCH-29) | after, run 1 / 2 / 3 |
|---|---|---|
| kept | 21, then 6 | **30 / 25 / 25** |
| dropped | 3, then 14 | **1 / 1 / 2** |
| X posts seen in more than one run that got the **same tag every time** | not measurable | **6 of 6 (100%)** |

⚠ **The decision is stable; the content is not.** Live X search returned **33 different posts across the three runs, and only 1 came back in all three**, and the grounded web search varies the same way. Kept arguments with a near-match in every other run: 1 / 0 / 1. That variation is retrieval, which the filter can't control. If Lex needs the *same* arguments every time, the answer is to run stage 1 once per idea and reuse the stored result, not to rerun it per build. That's a decision for Lex and CCh.

**Checks:** `check:search-29` 42 passed, 0 failed, 6 controls fired, 0 dead (9 new assertions on the rule, 2 new controls). Web `tsc` clean.

## 3. The rest of CCh's 22 Oct list

- **763c620 deployed:** yes. It's an ancestor of production's commit (`a95a6d9c` at 23:49 UTC 18 Nov, read off `/api/health`).
- **Railway token:** tested read-only and it works (`projectToken`, `deployments`, `metrics`). The one-off job path (`railway-measure-run/-job`, ba49e10) was built and used on 23 Oct. SEARCH-28 item 3's 23 Oct gold runs (on-1, on-2, off-2) and the Railway smoke run **all aborted after 10 of 65 questions**, stopped by the harness's own guard (ector-serve warm p95 78–84 s exceeded --p95-abort 25000ms). That's a second, independent record of §1's slow state. Only off-1 (20 Oct, 65 questions) is complete, so item 3 still has to be run. **SEARCH-29 measurements: not run, waiting for CCh's go after this report.**
- **NEON_API_KEY:** still absent. Neon consumption report not run.
- **For Lex:** the noise filter is now consistent, but this code is **not committed or deployed**, so it isn't Search's go-ahead yet for switching on Stage 1 v2.

## 4. Files

- `scrutinise-web/lib/lex/orientation/v2.ts`: tag-then-rule, `applyNoiseRule`, `readKind`, `xTags`, temperature 0.
- `scrutinise-web/lib/lex/orientation/x-orientation.ts`: `callGrok` takes `temperature` (default 0.2, unchanged for v1).
- `scrutinise-web/scripts/check-search-29.ts`: rule assertions.
- `scrutinise-web/scripts/measure-s30-noise.ts`: new.
- `docs/census/s30-noise.json`: new.
