# SPRINT V18 — REFILL THE QUEUE
**Written:** 10 Jun 2026, by CCh. **Repo:** `C:/Code/scrutinise-prototype`, branch `Main` (capital M), HEAD ~`56a08aa`.
**Read first:** `handoff_summary.md`, `INGEST_PLAYBOOK.md` (three-layer doctrine, §breakers, §cost model, source access priority bulk → HTML → API → PDF).

---

## 0. CONTEXT

V17 is live and verified: `Ingest` (one process, `WORKER_CONCURRENCY=20`, exit-on-empty) + `Ops` (hourly email, 15-min breakers/liveness). The queue is empty — the machine is starved, not broken. Charlie has approved: **seed the full pwdata backlog at once, plus all quick wins, and raise the Neon storage headroom to 20GB.** The design criterion stands: spend only while sections are being written, and every issue must surface in the email or trip a breaker — never silently persist.

Seeding scripts are written by CC but **executed in Charlie's terminal** (pwsh; `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` first line) — per playbook rule on spawned-process verification. All seeders: checkpoint/resume-safe, batch inserts, bounded pool, dedup against `corpus_sections`.

---

## 1. CARRY-OVER VERIFICATION (do first, ~minutes)

1. **Resolve the count discrepancy:** V17 report said `corpus_sections` = 884,982; the hourly email says 1,790,298 from the same database. Run `SELECT count(*) FROM corpus_sections;` on Neon, identify which reporting path was wrong (or what each was counting), fix the wrong one, and record the explanation in CHANGE_LOG. A 2× disagreement between our own instruments cannot stand.
2. Delete the 8 `echr-hudoc` test rows from V17 verification.
3. Clean the `tna-caselaw` pre-V4 overhang rows (page:7489 etc.) flagged in V17 so caselaw discovery can finish its last ~270 sections.
4. Update the email's storage denominator 10GB → 20GB (display constant only; the real Neon setting, if one exists, is console-side — Charlie's job, see §7).

---

## 2. TASK — pwdata FULL BACKLOG SEED (the main event)

Seed the complete historical depth of all pwdata corpora from TWFY bulk XML: `pwdata-debates` (~2M sections est), `pwdata-lords` (~500k), `pwdata-wrans` (~537k), `pwdata-lordswrans`, `pwdata-wms`, `pwdata-lordswms`, `pwdata-westminster` (~100k). One queue row per day-file, dedup via `corpus_sections` (the V17 dedup fix).

- **Priorities:** tails and small corpora P1–P2 (so they complete fast), pwdata P3 — pwdata becomes the long-running floor the loops fall back to. This is deliberate: parallelism across sources is the throughput lever; small sources must never queue behind a 2M-row backlog.
- **Rate limit:** confirm/insert a `source_rate_limits` row for `twfy-pwdata` at a polite rate (TWFY is a charity's static file server — choose conservatively, document the number and reasoning in the playbook).
- **Report after seeding:** rows seeded per corpus, estimated sections, and a predicted duration + cost line (rows ÷ observed throughput; Railway ~$1–2/day while running). Prediction goes in CHANGE_LOG so we can score it.

## 3. TASK — committees unblock (curl)

1. Install curl in the `Ingest` container via the builder config — **verify which builder the service actually uses** (V16 notes say Railpack/mise; use `nixpacks.toml` or the Railpack equivalent accordingly) and document the choice.
2. From the deployed container, curl-test `committees.parliament.uk` (`reports-responses` listing first). Report whether Railway's IP passes Cloudflare — this was never testable before.
3. **If Railway passes:** reset the 2,896 empty-`done` committees-document rows to pending; the 1,186 seeded per-document rows process normally; run the retirement SQL for `committees-portal` rows (in handoff) **only after** sections are verifiably being written; clear the committees breaker per playbook procedure.
4. **If Railway is blocked:** stop, report. Fallback (local fetch from Charlie's machine) is a Charlie decision, not a CC default.

## 4. TASK — HMRC full-depth manuals seed

Seed the full-depth HMRC manuals corpus (~626k est beyond the completed codes/TIINs). Same seeder rules; P2.

## 5. TASK — gov.uk direct-download small corpora

Seed the proven direct-download set from `corpus_targets`/horizon docs (PACE codes, Green Book, Cabinet Manual, white papers, etc.). Small volumes, P1 — they validate breadth cheaply and clear fast.

## 6. TASK — retained-eu viability check

Sample ~200 unsampled retained-eu items; report the `hasNoProvisions` rate and an estimated real remaining-section count. **Report with recommendation; do not reseed or retire unilaterally** — Charlie decides (AI-as-decision-support rule).

---

## 7. CHARLIE'S PARALLEL ACTIONS

- Neon console (CC has no console access — connection string only): check Project → Settings/Billing for any configured storage limit; if one exists, raise to 20GB. If none exists, nothing to do — billing is per-GB automatically.
- Run seeders in his terminal when CC hands them over.
- Usage-page check the morning after pwdata starts: expected ~$1–2/day Railway + ~$0.60/day Neon compute while running.

## 8. VERIFICATION

1. After seeding: ops detects pending > 0 and starts `Ingest` unaided (the V17 loop, now at scale).
2. The deferred V17 memory check is now meaningful: confirm ≤ ~600MB at concurrency 20 under a real backlog; report claim latency.
3. Sections-vs-rows divergence stays ~0 on pwdata (each day-file must yield sections; the zero-output breaker is the backstop).
4. 24h throughput report: sections/hour overall and per source; compare against the predicted duration from §2.

## 9. OUT OF SCOPE

HUDOC endpoint re-discovery, NAO, uk-treaties, SSRN (CCh research first); BAILII (awaiting contact); Railway-DB → Neon migration; search/embeddings work.

## 10. GIT DISCIPLINE

No git during the sprint. Single `commit-all.sh`; Charlie approves on Vercel preview; execute and delete. Docs (playbook, handoff, CHANGE_LOG) updated before commit — including the §2 prediction line.
