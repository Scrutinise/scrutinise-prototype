# Search: state since 22 Oct (written 19 Nov 00:11 UTC, laptop, cc-search)

**In plain English.** The Search stream did part of CCh's 22 Oct list on 22–23 Oct and then went quiet for four weeks. Nothing was written up. Tonight, two things are new:
- **The 86-second search is explained.** Both search services came back from a 20 Oct restart about 14 times slower, waiting on storage. It has since cleared, and today a search's slowest leg takes 4–16 s.
- **The noise filter now makes the same decision every time.** The arguments it receives still vary, because live X and web search vary.

The gold runs CCh asked for were tried on 23 Oct and all stopped after 10 questions, because the service was too slow to measure. They still need running. Everything below was read tonight.

**1. Search latency.**
- **Cause found, not yet fixed.** vector-serve's own `/stats` show it went from p50 3.3 s (cpu/wall 1.31) on its 26 Sep boot to **p50 46–48 s, p95 78–94 s, cpu/wall 0.13** after its 20 Oct 08:15 restart. That means it was waiting on R2 reads.
- fts-serve restarted at 08:13. Lex's 86 s fits the same state; that part is inferred.
- It was not contention: at 00:45 on 22 Oct the ledger shows only Lex's own check, and fts CPU peaked at 0.15 of 8 vCPU.
- **Today:** fts-serve warm p50 3.6 s, p95 6.0 s; vector-serve p50 4.0 s, p95 8.2 s. No queue, no rejections, 7 queries each in 4.8 days.
- Lex's exact query replayed takes 4–7.5 s. Through `search_corpus` it takes 20–29 s, because it sends 16 legs at limit 60.
- No timeouts at today's 120 s.
- Proposed fixes are in `docs/SEARCH_30_REPORT.md` §1 (an alert that can fire, restart on detection, R2 off the hot path, a smaller fan-out).

**2. Noise filter: made stable tonight.**
- The X call tags every post at temperature 0; a pure rule drops by tag.
- Same idea (2ef5358b), three runs: kept 30 / 25 / 25, dropped 1 / 1 / 2. Before, it was 21 → 6 kept, dropping 3 → 14.
- Posts seen in more than one run: 6 of 6 got the same tag.
- Retrieval still varies: 33 distinct X posts, 1 in all three runs.
- Not committed yet.

**3. Six-commit push.** Done. Local Main = origin/Main = production = **`239658bb`** (`/api/health`, 19 Nov). 763c620, 041e4e3 and Graph 7 are all ancestors. Nothing Search needs is missing from this machine.

**4. Credentials.**
- `RAILWAY_API_TOKEN` works, tested read-only tonight: projectToken, deployments, metrics.
- `NEON_API_KEY` is still absent, so no Neon cost report.

**5. SEARCH-28 item 3 and SEARCH-29 measurements.**
- **Not done.**
- Gold OFF-1 (20 Oct) is complete at 65 questions.
- The 23 Oct ON-1, ON-2 and OFF-2 runs and the Railway smoke run **all aborted after 10 questions** on the harness's p95 guard (vector-serve p95 78–84 s).
- `s28-bills.json` holds 0 rows.
- So there is no result against the 19 Oct predictions and no recommendation on `LEX_ROUTER_BILL_VOCAB` yet. That's overnight item 3.
- SEARCH-29 stage 2, Option B and the five ideas: not run (overnight item 4).

**6. Web orientation stage 1.**
- Wired into `build.ts` by Search in SEARCH-29: `orientPass` calls `runOrientationV2` behind `LEX_ORIENTATION_V2`, which is **off** in production.
- **No real idea holds a v2 orientation.** The only stored orientations are v1, from August and September.
- The only orientation ledger rows since 22 Oct are tonight's measurement.

**7. Search work since 22 Oct.**
- `041e4e3` SEARCH-28a (22 Oct).
- `763c620` SEARCH-29 part 1 (22 Oct).
- `ba49e10` Railway measure job (23 Oct).
- `b3d5748` Charlie's repo-wide sync swept the 23 Oct census files (25 Oct).
- Reports: `SEARCH_28_REPORT.md` and `SEARCH_29_REPORT.md` are still DRAFT. `SEARCH_30_REPORT.md` is new tonight.
- Checks tonight: search-29 42/0, search-161 13/0, amending-text 12/0, search-purpose pass.
- **Red:**
  - (a) The digest's 5 s p95 alert sits below both services' normal p95, so it can't flag a real jump.
  - (b) Lex's `FTS_COLD_START_MS` was raised to 120 s (decision 234), the workaround CCh asked against.

**8. Waiting on Charlie.**
1. `NEON_API_KEY`.
2. Any Railway-side fix: restart-on-detection, Lance tables on a volume (needs a cost figure).
3. Push of tonight's local commits in the morning.
4. Lowering Lex's timeout back to 75 s, once the alert is in place (Lex's file).
