# Railway LegislationSection retirement — report (19 Jun 2026)

*Task B of the S1b-adjacent housekeeping. Reversible canary executed; the destructive DROP remains Charlie's separate call (V26 §6, after one clean usage cycle).*

Script: `scripts/ingest/railway-legsection-retire.ts` (`--check` read-only · `--rename` · `--rename-back`).
Railway = `DATABASE_URL` (local .env → `switchback.proxy.rlwy.net`). Neon = `NEON_DATABASE_URL` (`ep-old-dust-aboxi69a…neon.tech`).

## 1. S1a EXPLAIN — panel hits Neon's GIN index ✓
The live legislation-search/panel query (`app/api/ideas/[id]/legislation-search/route.ts`, via `lib/prisma` → `DATABASE_URL` → Neon in prod) EXPLAINed on Neon:

```
Bitmap Heap Scan on "LegislationSection" ls
  Recheck Cond: ("ftsVector" @@ ...)
  ->  Bitmap Index Scan on "LegislationSection_ftsVector_idx"
        Index Cond: ("ftsVector" @@ ...)
```
**Verdict: GIN-index served, no Seq Scan.** (V26 repoint confirmed live.)

## 2. Grep — nothing reads Railway post-cutover ✓ (REPORT, not acted on)
- `lib/prisma.ts` → `DATABASE_URL` (Vercel env → Neon pooled since the 18 Jun cutover).
- `lib/prisma-search.ts` → `prismaSearch` is now just an **alias of `prisma`** (dual client collapsed in V26). No separate Neon/Railway split remains in the web app.
- `lib/pg-pool.ts` `getRailwayPool()` is a **misnomer** — it reads `DATABASE_URL`, not a hard-coded Railway string, and is **called only by offline `scripts/legislation/*`** (`check-railway-counts`, `diag-compilation-status`, `transfer-to-neon`) — never by web runtime.
- No hard-coded `*.railway.*` / `rlwy` connection string anywhere in `scrutinise-web`.

**Does any data live ONLY on Railway post-cutover?** No — exact parity on the legacy tables:

| table | Railway | Neon |
|---|---|---|
| LegislationSection | 914,274 | 914,274 |
| LegislationItem | 135,531 | 135,531 |

(V26 also copied all 24 app tables / 62,394 rows to Neon at exact parity; corpus gap-fill went to `corpus_sections` on Neon. The Railway DB is a full intact rollback copy, nothing unique.)

## 3. Rename — DONE (reversible canary)
Clean on every check → executed `--rename` on **Railway only** (guarded so it can never fire on a Neon endpoint):

```
RAILWAY: "LegislationSection" → "LegislationSection_DEPRECATED_2026-06-19"
```
Verified after: Railway `LegislationSection` = ABSENT, `LegislationSection_DEPRECATED_2026-06-19` = present, `LegislationItem` untouched; **Neon `LegislationSection` = 914,274 untouched**, panel still GIN-served.

**Reversal (seconds):** `tsx scripts/ingest/railway-legsection-retire.ts --rename-back`.

### Rollback-path note (soak, → ~25 Jun)
Railway is the V26 cutover rollback path during the soak. This rename mutates that path: a full env-flip rollback to Railway would now leave legislation search broken until `--rename-back` is run first (one command; the rest of the app DB is unaffected). The web app has been verified on Neon since 18 Jun, so this is the intended canary — if anything anywhere still read the Railway copy it would error immediately and visibly.

## 4. Next (Charlie's call — destructive)
After one clean usage cycle with nothing erroring, Charlie drops `LegislationSection_DEPRECATED_2026-06-19` (Railway) deliberately — folds into the V26 §6 step (verified Neon backup → drop legacy `Legislation*` on both DBs → decommission Railway Postgres, ahead of the 28 Jun Pro→Hobby downgrade).
