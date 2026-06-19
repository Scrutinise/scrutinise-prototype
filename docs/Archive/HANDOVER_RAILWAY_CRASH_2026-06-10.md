# HANDOVER — Scrutinise Ingest: Railway Crash Investigation
**Written:** 10 Jun 2026, 01:23 BST by CCh (Claude chat)
**Purpose:** Start a fresh session that works by the scientific method: observe → hypothesise → test → conclude. No code changes until a hypothesis is confirmed by direct observation.

---

## 1. THE PROBLEM IN ONE PARAGRAPH

The entire Railway project (`miraculous-nature`: 20 ingest workers, scheduler, monitor, and the `scrutinise-db` Postgres) goes fully offline every few hours of running and requires manual restarts. This has recurred for ~2 days across ~8+ incidents. Multiple fixes have been deployed; none has stopped the recurrence. The cost of repeated CC diagnostic sessions now exceeds the price of a Max subscription mid-month, and the last CC report described a healthy running system at a time when everything was offline — CC reports describe state at generation time (or assumed state) and must never be trusted without independent verification.

---

## 2. SYSTEM CONTEXT (CURRENT, POST-V16)

| Layer | What it holds | Status |
|---|---|---|
| **Railway** (compute) | 20 × `ingest-worker-N`, `Ingest-scheduler`, `ingest-monitor`, `scrutinise-db` (Postgres + volume) | Crashing repeatedly |
| **Railway Postgres** | Web-app Prisma tables only (`LegislationSection` 1,730MB, `OperationalSection` 142MB, etc. ~2.1GB total). **Zero ingest tables since V16.** | Crash epicentre? Unproven |
| **Neon Postgres** | `corpus_sections` (1.79M rows, 4.7GB of 10GB), `ingest_queue` (127k rows), `source_rate_limits`, `specialist_queue`, `scheduler_lock`, `ingest_progress_snapshots`, `corpus_targets` | Healthy throughout — never crashed |
| **Cloudflare R2** | Raw XML + compiled text (`scrutinise-legislation` bucket) | Healthy |
| **Vercel** | Next.js web app | Healthy |

**Corpus:** 1,790,186 sections (~31% of ~5.8M est). Major corpora complete: primary acts, SIs, EUR-Lex, FCA, HMRC, case law 99.6%.

**Worker code state (commit ~176dbbe):** startup jitter 0–20s; pool caps `max:2` Railway / `max:3` Neon, `idleTimeoutMillis:10s`; 5-min per-row `Promise.race` timeout; `AbortController` timeouts on TNA + EUR-Lex fetches; ECONNRESET retry loop **removed** in V16 (clean exit → Railway restarts); queue operations point at **Neon only**.

---

## 3. CRASH TIMELINE (all times BST)

| When | Event | Action taken |
|---|---|---|
| 8 Jun ~08:00 | All workers crashed after V12 push | Staggered restart; startup jitter written (V13) |
| 8 Jun ~09:30–15:35 | 6h zero output | Diagnosed: workers spinning on hasNoProvisions rows + the jitter-fix deploy itself triggered the storm it fixed |
| 8 Jun 23:48 | `all_workers_idle` alert; whole fleet NO_DEPLOY overnight | — |
| 9 Jun ~04:10 | Workers stopped | Diagnosed ECONNRESET-in-main-loop; retry loop added (later removed) |
| 9 Jun 10:28 & 11:34 | Railway DB down twice | **OOM hypothesis formed (never verified — see §5)**; pool caps reduced |
| 9 Jun ~13:40 | DB restarted by Charlie | V16 queue→Neon migration done in this window (clean, row counts exact) |
| 9 Jun ~15:09 | `all_workers_idle` alert again | — |
| 9 Jun ~16:00 | DB offline again | Restarted |
| 9 Jun 17:02 | **Last email ever received** | Scheduler died around here |
| 10 Jun 01:08 | **Entire project shows "Service is offline" — all 23 services** | Nothing restarted; investigation handed over |

**Crash cadence:** roughly every 1.5–4 hours of running, regardless of which fix was most recently deployed.

---

## 4. WHAT IS PROVEN (direct observations, trust these)

1. `max_connections = 100` on Railway Postgres; observed peak was **46** connections. Connection exhaustion is **falsified** as the cause.
2. Post-V16, `pg_stat_activity` on Railway DB showed **zero ingest worker connections** (only web app). **The crashes continued anyway.** Therefore worker DB connections were never the root cause, or not the only one.
3. Neon has never crashed under the same worker load. The instability is Railway-specific.
4. Railway worker containers **do not have `curl` installed** — discovered 9 Jun. All 2,896 "done" committees-document rows are empty (workers silently wrote nothing). Needs `nixpacks.toml` to add curl.
5. The 01:08 screenshot shows **every service including scheduler, monitor, and DB simultaneously "Service is offline."** A DB OOM does not present like this — workers would show CRASHED while the project stays up. Simultaneous project-wide "offline" suggests something at the **project or account level** stopped all workloads.
6. Railway usage this billing period: **Current $32.96 / Estimated $41.69** (CPU $12.92, Network $11.55, Memory $8.34) as of 9 Jun ~12:00.
7. CC's final report (~19:00, 9 Jun) claimed "workers running normally, 29,500 rows processed overnight" while the queue table it cited contradicted its own earlier numbers, and within hours everything was offline. **CC reports are claims, not observations.**

## 5. WHAT WAS ASSUMED BUT NEVER VERIFIED

1. **The OOM hypothesis.** CC inferred OOM from arithmetic (connections × work_mem). Nobody ever opened Railway → `scrutinise-db` → **Metrics tab** and looked at the memory graph at a crash timestamp. This is a 60-second check that was skipped through ~5 crash cycles.
2. **That restarting the DB was necessary.** At least one incident (V14 post-session) was proven to be workers crashing while the DB was healthy — the DB "looked" down because 20 connections dropped at once. Some of Charlie's DB restarts may have been restarting a healthy database.
3. **That the crashes are caused by our code at all.** Every fix has been code-side. The possibility that **Railway itself is stopping the project** (usage limit, plan enforcement, payment issue, platform incident) has never been checked.

---

## 6. HYPOTHESES FOR THE NEW SESSION — ranked, each with its test

Work through these **in order**. Do not fix anything until one is confirmed.

### H1 — Railway usage limit / billing cap is stopping the whole project ⭐ most consistent with evidence
- **Why ranked first:** explains project-wide simultaneous "Service is offline" (not CRASHED); explains recurrence despite every code fix; usage is $33→$42 projected and climbing fast under 22 always-on services; Railway hard usage limits stop **all workloads** when hit, and soft limits email warnings.
- **Test (5 min, no code):** Railway dashboard → Workspace/Account → **Usage** and **Billing** → check plan (Hobby $5 incl. / Pro $20 incl.), check whether a **usage limit** is configured, and look for any banner like "workloads stopped". Search email (including spam) for messages from Railway about usage/limits. Check Railway status page for incidents.
- **If confirmed:** raise/remove the limit or upgrade plan; everything restarts and stays up. Done.

### H2 — Railway Postgres container OOM
- **Test:** Railway → `scrutinise-db` → **Metrics** → memory graph. Find a crash timestamp from the timeline (§3) and look at memory in the preceding minutes. Spike-to-ceiling-then-drop = OOM confirmed.
- **If confirmed:** upgrade Postgres memory, or move web-app data to Neon too and delete Railway Postgres entirely (it's now only the web app's DB; Neon could hold it).

### H3 — Workers crash-loop exhausting ON_FAILURE retries, and "offline" is the residue
- **Test:** Railway deployment history per service — do worker crashes *precede* the DB going offline, or follow it? Pull exact timestamps. Also check worker deploy logs for the last lines before death.
- **Note:** restart policy is ON_FAILURE / max 3. After 3 fails a service sits dead until manually deployed. But this doesn't explain the **DB** going offline, so H3 alone is insufficient.

### H4 — Something still hitting Railway DB hard
- **Test:** while the DB is up, watch `pg_stat_activity` over 30 min. Confirm only the web app connects. Check Vercel logs for query storms (e.g. a runaway API route hammering `LegislationSection`).

### H5 — Railway platform fault on this project
- **Test:** open a Railway support ticket with the crash timestamps; ask them what *they* see killed the containers. They have the host-level logs we cannot access. This is free and should be done in parallel regardless.

---

## 7. RULES FOR THE NEW SESSION (process failures to not repeat)

1. **Observe before hypothesising.** Every diagnosis this week was formed from inference, then "fixed", then falsified by the next crash. The Metrics tab, billing page, and deployment timestamps are direct observations available the whole time and never consulted.
2. **One hypothesis at a time, stated falsifiably.** "If H1, then the billing page shows a limit hit. If it doesn't, H1 is dead."
3. **CC claims require independent verification** — an email arriving, a dashboard you can see, or a SQL count you run yourself. CC describing the system as healthy is not evidence the system is healthy.
4. **No new code, scripts, or restarts until the root cause is confirmed.** Restarting destroys evidence (deployment logs get REMOVED) and costs money.
5. **Stop running local scripts against production DBs.** (Already in playbook; restated because it was violated twice.)
6. **Cost control:** consider moving CC usage onto a Max subscription before the next long session; the pay-as-you-go credits have exceeded that price mid-month.

---

## 8. SECONDARY ISSUES (parked — do not touch until the crash is solved)

| Issue | State | Next step (later) |
|---|---|---|
| Committees (9,959 reports + 40,794 evidence) | curl absent on Railway containers → all 2,896 "done" rows empty (marked with lastError). Local seeder works via cookie-jar curl; checkpoint at ~page 35–80 of 498. | Add `nixpacks.toml` installing curl; redeploy; retest Railway IP access to committees.parliament.uk; then Option A (Railway enumeration) vs B (curl in listCommitteePublications). |
| Worker-18 | Recurring stale-deploy; sometimes needs manual "Deploy from Main" | Delete and recreate the service if it recurs |
| Queue nearly empty | Last verified: ~1,622 pending (si-2010plus only) + 2,538 failed committees rows. Most corpora complete or exhausted. | Reseed plan needed: pwdata historical depth, retained-eu viability check (what % hasNoProvisions), hmrc full-depth, new sources (Hansard API, NAO, treaties) |
| ECHR HUDOC / BAILII / SSRN / NAO / uk-treaties | Blocked, various causes | Per-source investigation using bulk→HTML→API priority rule (Playbook §9) |
| Email gaps & "+0" anomalies | Snapshot-delta artefacts around restarts; scheduler dead since ~17:02 9 Jun | Will resolve once services stay up |

---

## 9. KEY REFERENCES

- **Repo:** `C:/Code/scrutinise-prototype`, branch `Main` (capital M), last commit ~`176dbbe`
- **Docs:** `docs/INGEST_PLAYBOOK.md` (§8 failure patterns, §9 source access priority, §9a Neon migration), `handoff_summary.md`, `CHANGE_LOG.md`, root `CLAUDE.md` (Railway ops: staggered restart, `backboard.railway.com/graphql/v2` not `api.railway.app`, `deploymentRedeploy` vs `serviceInstanceRedeploy`)
- **Env:** `scrutinise-web/.env` — `DATABASE_URL` (Railway), `NEON_DATABASE_URL`, `RAILWAY_API_TOKEN`, `RAILWAY_PROJECT_ID`; env ID `991f733c-719c-4217-a6d6-1dbe80642bbe`
- **Restart procedure (only after root cause confirmed):** batches of 5 workers, 20s gaps — `scripts/ingest/restart-workers-staggered.ts`
- **Charlie's terminal:** PowerShell 7 (`pwsh`), not cmd. Local machine must not run scripts against production DBs.

---

## 10. OPENING MOVE FOR THE NEW SESSION

Morning checklist, in order, ~15 minutes, **no CC session needed for steps 1–4**:

1. Railway → Account/Workspace → **Usage & Billing**: plan, usage limit setting, any "workloads stopped" notice. Search email for Railway warnings. *(H1)*
2. Railway → `scrutinise-db` → **Metrics**: memory + CPU graphs across yesterday's crash timestamps (10:28, 11:34, ~16:00, ~17:00–01:00). *(H2)*
3. Railway → any worker → Deployments: note exact time the last deployment died vs when the DB died. *(H3)*
4. Railway status page + open a support ticket with the timestamps. *(H5)*
5. Only then: restart the DB, let services auto-recover or staggered-restart, and report findings to CCh with screenshots.

The answer to "why does it keep crashing" is almost certainly visible on a dashboard nobody has opened yet. Look first, fix second.
