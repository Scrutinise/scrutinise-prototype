# CC INGEST — Statistics Layer Phase A: machine-transfer handoff

*Written 31 Jul 2026 on the desktop, for continuing this exact workstream on the laptop.
This is a transfer note, not a permanent spec — the permanent docs are listed below and
should be trusted over this file once you're up and running; this just gets you there fast.*

## Read this first, then read these in order

1. Root `CLAUDE.md` → `docs/CLAUDE.md` (project rules, §16 whichdb incident, §12 git discipline)
2. `docs/handoff_summary.md` — **top CURRENT STATE section** is titled "STATS: Phase A (UK
   spine) built, DB choice pending Charlie" — that's this workstream, already up to date
3. `docs/STATS_LAYER_SPEC.md` + `docs/STATS_PHASE_A_BRIEF.md` — the governing brief (read
   before touching any stats code — this is what everything below executes)
4. `docs/STATS_SCHEMA.md` + `docs/STATS_REFRESH.md` — the as-built schema/refresh design
5. `docs/CHANGE_LOG.md` — three STATS entries, top of file, have the full scorecard

Everything substantive from this session is already in those files and pushed to `Main` — this
file exists only because a fresh session on a new machine has no conversation memory, and the
git history alone doesn't tell you *what to do next* as fast as a punch list does.

## Exactly where things stand

**Repo state:** clean, pushed. This session's three commits (confirmed via `git log`, still
present after another concurrent session added unrelated commits on top — not a conflict):

```
107ac78 docs: statistics layer — DB choice decided (Neon), provisioning blocked pending credentials
7c7c5b0 feat(stats): statistics layer Phase A — SDMX schema, ONS/OBR/PESA/HMRC ingest
f330f26 docs: statistics layer Phase A — spec, brief, schema, refresh design, scorecard
```

`git pull origin Main` on the laptop gets all of this. Nothing is stashed or laptop-only —
everything was built and committed from the desktop this session.

**What's built (`scripts/stats/`, its own npm project — see gotchas below):**
- SDMX Prisma schema: `stat_dataset` / `stat_dimension` / `stat_series` / `stat_observation` +
  `stat_cofog_function` reference table
- Source modules, each verified against **live** endpoints this session: `sources/ons-beta.ts`,
  `sources/ons-cdid.ts`, `sources/obr.ts`, `sources/pesa.ts`, `sources/hmrc.ts`
- `measure-pilot.ts` — read-only, fetches+parses real data, counts, **never writes to a DB**
- `seed-catalogue.ts` + `ingest-handlers.ts` + `refresh-scheduler.ts` — the real write path,
  built but **never run** (no DB exists yet)
- `query/stats-query.ts` — Lex/analysis read layer
- Initial migration SQL already generated **offline** (no DB was needed to produce it):
  `scripts/stats/prisma/migrations/20260730235112_init/migration.sql`

> **SUPERSEDED 2026-08-01 — the database is now provisioned and loaded.** Everything below in
> this section described the pre-provisioning state; steps 1–5 are DONE. Neon project
> `scrutinise-stats` (`winter-frost-26605722`), `aws-eu-west-2`, PG 17, separate project from
> the corpus DB. Both migrations applied, catalogue seeded, all 7 datasets ingested. Credentials
> are in **`scripts/stats/.env`** (gitignored) — note that location: NOT `scrutinise-web/.env`
> as step 1 below originally suggested, because the stats scripts run with `scripts/stats` as
> cwd and `dotenv/config` reads the cwd's `.env`. On a fresh clone you still need step 2
> (`npm install`) and you need to recreate `.env` (ask Charlie for the connection strings, or
> read them from the Neon console). See `STATS_SCHEMA.md` for the full connection details and
> `CHANGE_LOG.md` "STATS — database provisioned" for what the first live run found.
>
> **Still open:** step 6 (the Railway cron) — held because it is a paid resource, see
> `STATS_REFRESH.md` for the exact wiring it needs. And step 7.

## Next steps, in order

1. ~~**Provision the Neon project.**~~ **DONE 2026-08-01** — see the note above. Historical
   detail: Charlie confirmed the DB choice is a new, separate Neon project (not Hetzner); the
   30 Jul desktop session couldn't provision it (no stored API key, `neonctl` login needs a
   browser). Resolved by Charlie issuing an **organisation-scoped** Neon API key — note a
   *project-scoped* key cannot create projects (`"project-scoped keys are not allowed to create
   projects"`), which cost a round trip.
2. ~~`cd scripts/stats && npm install`~~ **DONE** — but still required after every fresh
   clone/pull, since `node_modules` isn't committed (see gotcha #1).
3. ~~Apply the migration~~ **DONE** — `npx prisma migrate deploy --config=prisma.config.ts` from
   `scripts/stats/`. **Run `npx tsx --tsconfig ../tsconfig.json whichdb.ts` first, every time**
   (`docs/CLAUDE.md` §16) — it hard-fails if either URL resolves to the corpus endpoint.
4. ~~`seed-catalogue.ts`~~ **DONE** — 10 COFOG codes + 7 `StatDataset` rows.
5. ~~`refresh-scheduler.ts` first real ingest~~ **DONE.** Worth knowing: the first live run
   found **six** real bugs that the offline build could not have surfaced, three of which
   silently produced wrong or missing data behind a green status. Use
   `npx tsx --tsconfig ../tsconfig.json verify.ts` — it prints the per-dataset scorecard and,
   importantly, **reconciles attempted-vs-stored observation counts**, which is how the silent
   overwrites were caught. Any `** ROWS LOST **` line means duplicate observation keys.
6. **Wire the scheduled job (Railway cron) — STILL OPEN, needs Charlie's go-ahead** because it
   is a paid resource. Exact wiring in `STATS_REFRESH.md`.
7. Longer-term, explicitly out of scope for Phase A (don't start these without a fresh brief):
   full Lex tool-calling integration, Phase B (OECD/IMF/World Bank/Eurostat), Phase C (other
   countries), broadening ONS Beta API coverage past the one pilot dataset, PESA past Chapter 5,
   HMRC past tax-gap Table 1.1.

## Gotchas for a fresh session (non-obvious, cost real time to work out this session)

- **`scripts/stats` has its own `node_modules`**, separate from `scrutinise-web`'s. Prisma 7's
  client generator resolves `@prisma/client` relative to the schema file's own directory tree,
  not `cwd` — the trick `scripts/legislation` uses (TS `paths` remap to `scrutinise-web`'s
  `node_modules`) doesn't work for a *second* Prisma schema. Don't try to "fix" this by removing
  the local `node_modules` — it's intentional.
- **Prisma 7 dropped `datasource.url` from `schema.prisma`.** Connection config lives in
  `scripts/stats/prisma.config.ts` (`datasource.url`), mirroring `scrutinise-web/prisma.config.ts`'s
  pattern. `PrismaClient` itself is constructed with a `@prisma/adapter-pg` `PrismaPg` adapter
  in `lib/db.ts`, same pattern as `scripts/whichdb.ts`.
- **New env vars: `STATS_DATABASE_URL` / `STATS_DIRECT_URL`** — deliberately separate from the
  app's `DATABASE_URL`/`DIRECT_URL`, so a stale `.env` can never point a stats script at the
  corpus/app DB (see `docs/CLAUDE.md` §16, the whichdb incident this guards against).
- **OBR downloads are gated** behind a WordPress Download-Monitor nonce on `obr.uk/data/`. A
  bare/no-cookie request 302s to `/no-access/`; a stale/no-Referer token 403s. `sources/obr.ts`'s
  `resolveObrDownloadUrl()` does the right thing (fresh cookie jar from `/data/`, matching
  Referer) — don't simplify this away if refactoring, it'll silently start 302ing.
- **ONS CDID endpoint 429s under rapid requests** (hit this live while probing). `lib/fetch-utils.ts`'s
  `politeFetch()` already paces every call — don't bypass it with a raw `fetch()` for CDID.
- **PESA/HMRC asset URLs are dated, static, and WILL rotate** at the next publication (e.g.
  `PESA_2025_CP_Chapter_5_tables.xlsx`, tax gap "2026 edition"). `ingest-handlers.ts` hardcodes
  the current URLs — when a scheduled refresh starts 404ing, that's expected (annual/monthly
  publication cycle), not a bug; re-resolve via the gov.uk statistics page (pattern in
  `docs/STATS_PHASE_A_BRIEF.md`'s probing notes / this session's approach) rather than guessing
  the next URL.
- **Every commit trailer needs a real UTC timestamp** — `[DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm")`
  in PowerShell, never guessed/copied forward (`docs/CLAUDE.md` root file, git policy section).
- **Standard git discipline still applies:** no mid-sprint git except `handoff_summary.md`/
  `CHANGE_LOG.md` updates; batch everything else into a `commit-all.sh`, execute once, delete.
