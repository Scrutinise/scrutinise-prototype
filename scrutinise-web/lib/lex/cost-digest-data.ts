// ─────────────────────────────────────────────────────────────────────────────
// cost-digest-data.ts — S25 §4. The data-gathering half of the £ cost digest, shared
// between `scripts/cost-digest.ts` (the daily email) and `/api/admin/cost-digest` (the raw
// counters link the email points to) — one source, not two computing the same numbers.
//
// See `scripts/cost-digest.ts`'s own header for the package-boundary reasoning: Railway
// per-service cost, Neon storage, and search-serving health are gathered here with thin,
// minimal, OWN calls (a GraphQL fetch, a raw `pg` query, an HTTP `/stats` fetch) rather than
// importing `scripts/ingest/**`, which this package cannot do (docs/CLAUDE.md §20 Check A).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../prisma'
import { r2Get } from '../r2'
import { USD_TO_GBP, purposeFor, type SpendPurpose } from './spend-ledger'
import { providerFor } from './model-registry'
import type { CostDigestLine } from '../email'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const RAILWAY_PROJECT_ID = '68707c61-5c68-4f37-88fc-c301fd6b90e7'
// Source of truth for the SERVICE ID → name map: `scripts/ingest/ops/sleep-state.ts`'s
// `SERVICES` — keep in sync by hand if a service is added/removed there (twin, not shared).
const RAILWAY_SERVICE_NAMES: Record<string, string> = {
  'c268ec09-e489-4cfa-837a-7740d95c24c7': 'fts-serve',
  'ae95be0a-3140-409a-8b9a-fd9c81229da4': 'vector-serve',
  '0ef0f6a5-5805-4c92-af69-9ee4d0486356': 'fts-build',
  'fdd32248-1bd5-4264-8ab0-54de78545151': 'fts-pilot',
  '2f0ef638-332c-4ed6-b8da-13384d90b87f': 'scrutinise-db',
  'a7f4d75f-d844-4e1c-8edf-2569346b31c9': 'Ingest',
  'f3397bee-e588-4b95-921f-2e0f2f169cc5': 'Ops',
  'c0d9fd39-9226-4d85-a9c5-a616341a542f': 'build-worker',
  '14c05090-c751-4cd9-8858-3df46b214e18': 'cost-alert-cron',
}

export async function railwayCosts(): Promise<Array<{ name: string; usd: number }> | null> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) return null
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  try {
    const res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Project-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query U($projectId: String!, $startDate: DateTime!, $endDate: DateTime!) {
          usage(measurements: [MEMORY_USAGE_GB, CPU_USAGE, DISK_USAGE_GB], projectId: $projectId, startDate: $startDate, endDate: $endDate, groupBy: [SERVICE_ID]) {
            measurement value tags { serviceId }
          }
        }`,
        variables: { projectId: RAILWAY_PROJECT_ID, startDate: start.toISOString(), endDate: now.toISOString() },
      }),
    })
    const body = await res.json() as { data?: { usage: Array<{ measurement: string; value: number; tags: { serviceId?: string | null } }> }; errors?: Array<{ message: string }> }
    if (body.errors?.length || !body.data) return null

    const perService = new Map<string, Record<string, number>>()
    for (const u of body.data.usage) {
      const name = RAILWAY_SERVICE_NAMES[u.tags.serviceId ?? ''] ?? (u.tags.serviceId ?? 'unknown')
      const row = perService.get(name) ?? {}
      row[u.measurement] = (row[u.measurement] ?? 0) + u.value
      perService.set(name, row)
    }
    const minutes = ((now.getTime() - start.getTime()) / 60_000) || 1
    const avg = (sum: number) => sum / minutes
    // Railway's published rates: $10/GB-month memory, $20/vCPU-month, $0.15/GB-month disk.
    return [...perService.entries()].sort().map(([name, m]) => ({
      name,
      usd: avg(m.MEMORY_USAGE_GB ?? 0) * 10 + avg(m.CPU_USAGE ?? 0) * 20 + avg(m.DISK_USAGE_GB ?? 0) * 0.15,
    }))
  } catch (e) {
    console.warn('[cost-digest-data] Railway usage query failed:', e instanceof Error ? e.message : e)
    return null
  }
}

// Same $0.35/GB-month, $15 budget as serve-observer.ts's NEON_STORAGE_USD_PER_GB_MONTH /
// NEON_STORAGE_ALERT_USD (GRAPH 3C §5). Compute is NOT captured — no Neon compute-billing
// API exists anywhere in this repo or was found live.
export async function neonStorageUsd(): Promise<number | null> {
  const url = process.env.NEON_DATABASE_URL
  if (!url) return null
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 30_000 })
  try {
    const r = await pool.query<{ gb: string }>(`SELECT pg_database_size(current_database())/1024.0/1024/1024 AS gb`)
    return parseFloat(r.rows[0].gb) * 0.35
  } catch { return null } finally { await pool.end().catch(() => {}) }
}

const MEM_ALERT_PCT = 70, CRASH_LOOP_THRESHOLD = 3, CRASH_LOOP_WINDOW_MS = 3600_000

/**
 * SEARCH-30 — THE LATENCY ALERTS, REPLACING "p95 > 5 s".
 *
 * ⚠ The old rule could not do its job. vector-serve's HEALTHY p95 was 10.6 s (Sept) and both services sit above 5 s on a quiet
 * day (fts 6.0 s, vector 8.2 s, 18 Nov), so the alert was on every day — and on 20 Oct, when a restart left both services
 * ~14× slower (vector p50 3.3 s → 46 s), the digest said exactly what it had said the day before.
 *
 * What DID change that day was the shape of the time: cpu/wall fell from 1.31 (computing) to 0.13 (waiting on R2 range reads).
 * So two rules, each quiet on a healthy day and loud on that one, measured from the services' own /stats:
 *   STORAGE-BOUND — cpu/wall < 0.4 over at least 10 warm queries (healthy: 0.6–1.4; 20 Oct: 0.13).
 *   SLOW          — warm p50 > 15 s over at least 5 warm queries (healthy: 3.3–4.0 s, i.e. ~4×; 20 Oct: 46 s).
 * Both need a minimum sample so the first cold-ish queries after a restart cannot trip them.
 */
export const STORAGE_BOUND_CPU_OVER_WALL = 0.4, STORAGE_BOUND_MIN_N = 10, SLOW_P50_MS = 15_000, SLOW_MIN_N = 5

export interface ServeStatsShape {
  memory?: { peak_pct_of_cap?: number }
  warm_p50_ms?: number | null; warm_n?: number | null
  /** fts-serve reports cpu/wall at the top level… */
  cpu_over_wall?: number | null
  /** …vector-serve inside `stages` */
  stages?: { cpu_over_wall?: number | null }
  concurrency?: { rejections?: number | null }
}

/** Pure: the exception lines one service's /stats produces. Exported for check:serving-alerts. */
export function servingAlerts(name: string, s: ServeStatsShape): string[] {
  const out: string[] = []
  if (s.memory?.peak_pct_of_cap != null && s.memory.peak_pct_of_cap > MEM_ALERT_PCT) out.push(`${name} memory at ${s.memory.peak_pct_of_cap}% of cap`)
  const n = s.warm_n ?? 0
  const cow = s.cpu_over_wall ?? s.stages?.cpu_over_wall ?? null
  if (cow != null && n >= STORAGE_BOUND_MIN_N && cow < STORAGE_BOUND_CPU_OVER_WALL)
    out.push(`${name} is waiting on storage, not computing (cpu/wall ${cow} over ${n} queries; healthy is 0.6 or more) — restart it and check /stats again`)
  if (s.warm_p50_ms != null && n >= SLOW_MIN_N && s.warm_p50_ms > SLOW_P50_MS)
    out.push(`${name} is slow (warm p50 ${Math.round(s.warm_p50_ms / 100) / 10} s over ${n} queries; healthy is about 4 s)`)
  if (s.concurrency?.rejections != null && s.concurrency.rejections > 0) out.push(`${name} shed ${s.concurrency.rejections} request(s)`)
  return out
}

/**
 * Pure: what the serve-observer's persisted state adds to the digest line. Two things the digest cannot compute itself:
 *  - "p50 over 3× the last healthy boot": only the observer keeps that baseline. Read for the boot running now only.
 *  - the observer's automatic restarts in the last 24 h, with why and how each went.
 * The storage-bound rule is NOT repeated from here; servingAlerts() computes it live.
 */
export function observerServingLines(
  name: string,
  state: { verdict?: Record<string, { bootAt: string | null; slow: boolean; reasons: string[] }>; autoRestartLog?: Record<string, Array<{ at: string; reasons: string[]; outcome?: string; detail?: string }>> },
  liveBootAt: string | null, nowMs: number,
): string[] {
  const out: string[] = []
  const v = state.verdict?.[name]
  if (v?.slow && v.bootAt && v.bootAt === liveBootAt)
    for (const r of v.reasons.filter((x) => /× the last healthy boot/.test(x))) out.push(`${name} is slow: ${r}`)
  for (const e of state.autoRestartLog?.[name] ?? []) {
    if (nowMs - Date.parse(e.at) > 24 * 3600_000) continue
    const how = e.outcome === 'failed' ? `the restart FAILED (${e.detail ?? 'no detail'})` : e.outcome === 'skipped-off' ? 'not restarted (automatic restart is switched off)' : 'restarted automatically'
    out.push(`${name} ${how} at ${e.at.slice(11, 16)} UTC because: ${e.reasons.join('; ')}`)
  }
  return out
}

export interface RawServiceStats { name: string; ok: boolean; stats?: unknown; error?: string }

/** Reads serve-observer's OWN persisted R2 state (data, not code) plus a live /stats fetch. */
export async function searchServingHealth(): Promise<{ line: string; raw: RawServiceStats[] }> {
  const exceptions: string[] = []
  const raw: RawServiceStats[] = []
  let state: {
    restartLog?: Record<string, Array<{ at: string; kind: string }>>; downSince?: Record<string, string>
    /** SEARCH-31: the observer's own verdict (it holds the last-healthy-boot baseline the 3× rule needs) and its automatic restarts. */
    verdict?: Record<string, { bootAt: string | null; slow: boolean; reasons: string[] }>
    autoRestartLog?: Record<string, Array<{ at: string; reasons: string[]; outcome?: string; detail?: string }>>
  } = {}
  try {
    const rawState = await r2Get('_search/serve-observer-state.json')
    if (rawState) state = JSON.parse(rawState)
  } catch { /* state unreadable — fall through to live-only signals */ }

  const targets: Array<[string, string | undefined]> = [
    ['fts-serve', process.env.FTS_SEARCH_URL ?? process.env.FTS_SERVE_URL],
    ['vector-serve', process.env.VECTOR_SERVE_URL ?? process.env.VECTOR_SEARCH_URL],
  ]
  let anyConfigured = false
  for (const [name, url] of targets) {
    if (!url) continue
    anyConfigured = true
    if (state.downSince?.[name]) exceptions.push(`${name} down since ${state.downSince[name]}`)
    const crashes = (state.restartLog?.[name] ?? []).filter((e) => e.kind === 'crash' && Date.now() - Date.parse(e.at) <= CRASH_LOOP_WINDOW_MS).length
    if (crashes >= CRASH_LOOP_THRESHOLD) exceptions.push(`${name} crash-looping (${crashes} in the last hour)`)
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/stats`, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) { exceptions.push(`${name} is not responding (HTTP ${res.status})`); raw.push({ name, ok: false, error: `HTTP ${res.status}` }); continue }
      const s = await res.json() as ServeStatsShape & { started_at?: string }
      raw.push({ name, ok: true, stats: s })
      exceptions.push(...servingAlerts(name, s))
      exceptions.push(...observerServingLines(name, state, s.started_at ?? null, Date.now()))
    } catch (e) {
      exceptions.push(`${name} is not responding`)
      raw.push({ name, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  if (!anyConfigured) return { line: 'search-serving health: not checked (FTS_SEARCH_URL/VECTOR_SERVE_URL not configured on this deployment)', raw }
  return { line: exceptions.length ? exceptions.join('; ') : 'all services healthy', raw }
}

interface Totals { pence: number | null; unpricedCalls: number; calls: number }
export function foldSpend(rows: Array<{ estCostPence: unknown; unpriced: boolean }>): Totals {
  let pence: number | null = 0, unpricedCalls = 0
  for (const r of rows) {
    if (r.unpriced || r.estCostPence == null) { unpricedCalls++; pence = null; continue }
    if (pence != null) pence += Number(r.estCostPence)
  }
  return { pence, unpricedCalls, calls: rows.length }
}

async function spendRows(since: Date, until: Date) {
  return prisma.$queryRaw<Array<{ pass: string; model: string; estCostPence: unknown; unpriced: boolean; userId: string | null; ideaId: string | null }>>`
    SELECT pass, model, "estCostPence", unpriced, "userId", "ideaId" FROM "LlmSpend"
    WHERE "createdAt" >= ${since} AND "createdAt" < ${until}`
}

function groupBy<T, K extends string>(rows: T[], key: (r: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const r of rows) { const k = key(r); (out[k] ??= []).push(r) }
  return out
}

export interface CostDigestData {
  dateUtc: string
  yesterday: { gbp: number | null; unpricedCalls: number }
  monthToDate: { gbp: number | null; usd: number | null; unpricedCalls: number; projectedUsd: number | null; thresholds: number[] }
  byPurpose: CostDigestLine[]
  unmappedPasses: string[]
  bySupplier: CostDigestLine[]
  railwayServices: Array<{ name: string; usd: number }>
  neon: { storageUsd: number | null; computeCaptured: false }
  vercelCaptured: false
  topIdeas: CostDigestLine[]
  topUsers: CostDigestLine[]
  attributionNote: string
  healthLine: string
  rawServiceStats: RawServiceStats[]
}

/** Gathers everything the £ cost digest needs — email and the raw-counters admin page both
 *  call this, so the numbers can never drift between the two surfaces. */
export async function buildCostDigestData(now: Date = new Date()): Promise<CostDigestData> {
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayStart = new Date(todayUtc.getTime() - 86_400_000)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const dateUtc = yesterdayStart.toISOString().slice(0, 10)

  const [yRows, mRows, railway, neonUsd, health] = await Promise.all([
    spendRows(yesterdayStart, todayUtc),
    spendRows(monthStart, todayUtc),
    railwayCosts(),
    neonStorageUsd(),
    searchServingHealth(),
  ])

  const yTotal = foldSpend(yRows)
  const mTotal = foldSpend(mRows)
  const mtdGbp = mTotal.pence == null ? null : mTotal.pence / 100
  const mtdUsd = mtdGbp == null ? null : mtdGbp / USD_TO_GBP
  const daysElapsed = Math.max(1, Math.floor((now.getTime() - monthStart.getTime()) / 86_400_000))
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const projectedUsd = mtdUsd == null ? null : (mtdUsd / daysElapsed) * daysInMonth

  const purposeGroups = groupBy(yRows, (r) => (purposeFor(r.pass) ?? '__unmapped__') as SpendPurpose | '__unmapped__')
  const unmappedPasses = [...new Set(yRows.filter((r) => purposeFor(r.pass) == null).map((r) => r.pass))].sort()
  const byPurpose: CostDigestLine[] = Object.entries(purposeGroups)
    .filter(([k]) => k !== '__unmapped__')
    .map(([label, rows]) => { const t = foldSpend(rows); return { label, gbp: t.pence == null ? null : t.pence / 100, calls: t.calls } })
    .sort((a, b) => (b.gbp ?? 0) - (a.gbp ?? 0))

  const supplierGroups = groupBy(yRows, (r) => (providerFor(r.model) ?? 'unknown'))
  const bySupplier: CostDigestLine[] = Object.entries(supplierGroups)
    .map(([label, rows]) => { const t = foldSpend(rows); return { label, gbp: t.pence == null ? null : t.pence / 100, calls: t.calls } })
    .sort((a, b) => (b.gbp ?? 0) - (a.gbp ?? 0))

  // Top 5 ideas/users (month to date). ⚠ Attribution measured present on well under 1% of
  // rows (18 userId / 42 ideaId of 7,823, 25 Sep 2026) — a thin, not representative, slice.
  const ideaGroups = groupBy(mRows.filter((r) => r.ideaId), (r) => r.ideaId as string)
  const ideaTitles = await prisma.idea.findMany({ where: { id: { in: Object.keys(ideaGroups) } }, select: { id: true, title: true } })
  const titleById = new Map(ideaTitles.map((i) => [i.id, i.title]))
  const topIdeas: CostDigestLine[] = Object.entries(ideaGroups)
    .map(([id, rows]) => { const t = foldSpend(rows); return { label: titleById.get(id) ?? id, gbp: t.pence == null ? null : t.pence / 100, calls: t.calls } })
    .sort((a, b) => (b.gbp ?? 0) - (a.gbp ?? 0)).slice(0, 5)

  const userGroups = groupBy(mRows.filter((r) => r.userId), (r) => r.userId as string)
  const users = await prisma.user.findMany({ where: { id: { in: Object.keys(userGroups) } }, select: { id: true, preferredName: true } }).catch(() => [] as Array<{ id: string; preferredName: string | null }>)
  const nameById = new Map(users.map((u) => [u.id, u.preferredName]))
  const topUsers: CostDigestLine[] = Object.entries(userGroups)
    .map(([id, rows]) => { const t = foldSpend(rows); return { label: nameById.get(id) ?? id, gbp: t.pence == null ? null : t.pence / 100, calls: t.calls } })
    .sort((a, b) => (b.gbp ?? 0) - (a.gbp ?? 0)).slice(0, 5)

  return {
    dateUtc,
    yesterday: { gbp: yTotal.pence == null ? null : yTotal.pence / 100, unpricedCalls: yTotal.unpricedCalls },
    monthToDate: { gbp: mtdGbp, usd: mtdUsd, unpricedCalls: mTotal.unpricedCalls, projectedUsd, thresholds: [20, 50] },
    byPurpose,
    unmappedPasses,
    bySupplier,
    railwayServices: railway ?? [],
    neon: { storageUsd: neonUsd, computeCaptured: false },
    vercelCaptured: false,
    topIdeas,
    topUsers,
    attributionNote: `only ${Object.keys(userGroups).length} user(s) / ${Object.keys(ideaGroups).length} idea(s) carry attribution this month — most LlmSpend rows have no userId/ideaId, so this is a thin, not a representative, slice.`,
    healthLine: health.line,
    rawServiceStats: health.raw,
  }
}
