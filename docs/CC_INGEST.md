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

**What's NOT done — the one open item:** no database exists. Charlie confirmed the DB choice
is a **new, separate Neon project** (not Hetzner) — but the desktop session couldn't provision
it: no stored Neon API key, and `neonctl`'s login needs a browser this environment doesn't
have. Charlie chose to hold off rather than hand over credentials that session. **This is the
actual next step** — see below.

## Next steps, in order

1. **Provision the Neon project.** Check whether the laptop has Neon console access or an API
   key available (browser-based `neonctl auth` may just work there, unlike the desktop). Either:
   - Create a new Neon project (e.g. `scrutinise-stats`) via console yourself, grab the pooled +
     direct connection strings, and set `STATS_DATABASE_URL` (pooled) + `STATS_DIRECT_URL`
     (direct) in `scrutinise-web/.env`, **or**
   - Run `npx neonctl auth` then `npx neonctl projects create --name scrutinise-stats` if you'd
     rather have CC do it on the laptop.
   Do **not** put these in the corpus DB's project — separate project, separate cost line.
2. `cd scripts/stats && npm install` — this folder has its own `node_modules` (see gotcha #1),
   not committed, so this is required after every fresh clone/pull.
3. Apply the migration: `npx prisma migrate deploy --schema=prisma/schema.prisma --config=prisma.config.ts`
   (from `scripts/stats/`, with `STATS_DATABASE_URL`/`STATS_DIRECT_URL` set).
4. `npx tsx --tsconfig ../tsconfig.json seed-catalogue.ts` — seeds COFOG codes + the 7
   `StatDataset` rows.
5. `npx tsx --tsconfig ../tsconfig.json refresh-scheduler.ts` — first real ingest run. Sanity
   check the counts against the pilot numbers in `CHANGE_LOG.md` (same order of magnitude,
   though `obr-historical-forecasts` will ingest more sheets than the pilot's spot-check did —
   read the handler in `ingest-handlers.ts` if a count looks off).
6. Once real data is in and counts look sane: wire a scheduled job (Railway cron or equivalent)
   to invoke `refresh-scheduler.ts` periodically — not built this sprint, see `STATS_REFRESH.md`.
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
