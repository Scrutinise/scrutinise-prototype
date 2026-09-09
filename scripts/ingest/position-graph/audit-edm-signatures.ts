/**
 * audit-edm-signatures.ts — BRIEF_INGEST_EDM_SIGNATURES §1, the gate.
 *
 * ⚠ READ-ONLY on the database and the API. Nothing is written anywhere.
 *
 * §1 asks four questions and the brief makes the sprint conditional on the answers:
 *   1. the endpoint, the fields per signature, and whether the DATE SIGNED is carried
 *   2. what identifies the signatory — a member id, or a name (if a name: stop and report)
 *   3. whether the SPONSOR is distinguishable from the signatories
 *   4. the cost: requests, rate limit, elapsed time, storage
 *
 * probe-edm-signatures.ts found the route. This script measures it against the whole 61k history
 * rather than against today's motions, because "the API carries CreatedWhen" is a claim about 2026
 * until it has been read on 2005.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/audit-edm-signatures.ts
 *   npx tsx position-graph/audit-edm-signatures.ts --sample 200
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const SAMPLE = Number(argv[argv.indexOf('--sample') + 1]) || 120

const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const n = (x: any) => Number(x).toLocaleString()

interface Fetched { status: number; ms: number; body: any }
async function getJson(url: string, attempts = 3): Promise<Fetched> {
  let last: Fetched = { status: -1, ms: 0, body: null }
  for (let i = 0; i < attempts; i++) {
    const t0 = Date.now()
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      const ms = Date.now() - t0
      if (res.ok) return { status: res.status, ms, body: await res.json() }
      last = { status: res.status, ms, body: null }
      if (res.status !== 429 && res.status < 500) return last
    } catch (e) {
      last = { status: -1, ms: Date.now() - t0, body: e instanceof Error ? e.message : String(e) }
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
  }
  return last
}

async function pooled<T, R>(items: T[], fn: (t: T) => Promise<R>, conc: number): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let idx = 0
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, async () => {
    for (;;) { const i = idx++; if (i >= items.length) return; out[i] = await fn(items[i]) }
  }))
  return out
}

async function main() {
  head('§0 WHERE WE ARE POINTED')
  const { rows: [who] } = await pool.query<{ db: string; host: string }>(
    `SELECT current_database() AS db, inet_server_addr()::text AS host`)
  console.log(`   database ${who.db}   server ${who.host}`)
  console.log(`   url host ${(process.env.NEON_DATABASE_URL ?? '').replace(/:[^:@]*@/, ':***@').split('@')[1]?.split('/')[0]}`)

  // ────────────────────────────────────────────────────────────────────────────────────────────
  head('§1.A WHAT WE HOLD TODAY, AND WHAT THE PUBLISHED COUNT ACTUALLY IS')
  const { rows: [held] } = await pool.query<Record<string, string>>(`
    SELECT COUNT(*)::text                                        AS motions,
           COUNT(*) FILTER (WHERE mnis_id IS NOT NULL)::text      AS keyed,
           COALESCE(SUM(sponsors_count),0)::text                  AS sig_sum,
           COUNT(*) FILTER (WHERE sponsors_count > 1)::text       AS multi,
           COUNT(*) FILTER (WHERE sponsors_count = 0)::text       AS zero,
           COUNT(*) FILTER (WHERE sponsors_count IS NULL)::text    AS nullc,
           MIN(date_tabled)::text                                 AS first_tabled,
           MAX(date_tabled)::text                                 AS last_tabled,
           MIN(fetched_at)::text                                  AS swept
      FROM edm_sponsor`)
  console.log(`   edm_sponsor rows                 ${n(held.motions)}`)
  console.log(`   with an MNIS id                  ${n(held.keyed)}`)
  console.log(`   SUM(sponsors_count)              ${n(held.sig_sum)}   ← the brief's 2,125,547`)
  console.log(`   motions with sponsors_count > 1  ${n(held.multi)}`)
  console.log(`   ⚠ sponsors_count = 0             ${n(held.zero)}      (0 is not "no signatories": see §1.C)`)
  console.log(`   ⚠ sponsors_count IS NULL         ${n(held.nullc)}`)
  console.log(`   date_tabled range                ${held.first_tabled} → ${held.last_tabled}`)
  console.log(`   swept at                         ${held.swept}`)

  const list1 = await getJson(`${BASE}/EarlyDayMotions/list?parameters.take=1&parameters.skip=0`)
  const apiTotal = list1.body?.PagingInfo?.Total ?? 0
  console.log(`\n   API list Total today             ${n(apiTotal)}`)
  console.log(`   ⚠ drift since the 2D-2 sweep     ${n(apiTotal - Number(held.motions))} motions tabled since`)

  const { rows: [sec] } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM corpus_sections WHERE corpus='early-day-motions'`)
  console.log(`   corpus_sections we can evidence  ${n(sec.n)}`)

  // ────────────────────────────────────────────────────────────────────────────────────────────
  head('§1.B THE SIGNAL AND ESTIMATE LAYERS AS THEY STAND')
  const { rows: sig } = await pool.query<{ storage: string; signal_type: string; derivation: string | null; n: string }>(`
    SELECT storage, signal_type, derivation, COUNT(*)::text AS n
      FROM position_signal GROUP BY 1,2,3 ORDER BY 4 DESC`)
  for (const r of sig) console.log(`   ${r.storage.padEnd(8)} ${r.signal_type.padEnd(22)} ${(r.derivation ?? '—').padEnd(30)} ${n(r.n).padStart(11)}`)
  const { rows: [est] } = await pool.query<Record<string, string>>(`
    SELECT COUNT(*)::text AS rows,
           COUNT(*) FILTER (WHERE target_type='edm')::text AS edm,
           COUNT(DISTINCT config_version)::text AS versions,
           MAX(computed_at)::text AS latest
      FROM position_estimate`)
  console.log(`\n   position_estimate rows           ${n(est.rows)}   (edm targets: ${n(est.edm)})`)
  console.log(`   distinct config_version          ${est.versions}, latest build ${est.latest}`)

  // ────────────────────────────────────────────────────────────────────────────────────────────
  head('§1.C SponsorsCount — WHAT IT MEANS ON EACH ENDPOINT')
  console.log(`   ⚠ the probe found SponsorsCount = 0 on the DETAIL response for a motion whose`)
  console.log(`     Sponsors array held 24 rows. If the LIST value is also unreliable, the brief's`)
  console.log(`     2.06m target is unreliable with it — so both are read here, on the same motions.`)
  // Take a spread of motions across the whole id range and compare list SponsorsCount vs the
  // detail Sponsors array length.
  const { rows: spread } = await pool.query<{ motion_id: number; sponsors_count: number | null; date_tabled: string | null }>(`
    SELECT motion_id, sponsors_count, date_tabled::text AS date_tabled
      FROM edm_sponsor
     WHERE date_tabled IS NOT NULL
     ORDER BY md5(motion_id::text)
     LIMIT $1`, [SAMPLE])
  console.log(`\n   ${spread.length} motions sampled by md5(motion_id) — NOT by id, which orders by date`)

  const t0 = Date.now()
  const results = await pooled(spread, async (m) => {
    const r = await getJson(`${BASE}/EarlyDayMotion/${m.motion_id}`)
    const resp = r.body?.Response ?? null
    const sponsors: any[] = Array.isArray(resp?.Sponsors) ? resp.Sponsors : []
    return { m, status: r.status, ms: r.ms, resp, sponsors }
  }, 4)
  const elapsed = Date.now() - t0

  let ok = 0, http = new Map<number, number>(), withDate = 0, withMnis = 0, withoutMnis = 0
  let order1 = 0, order1IsPrimary = 0, withdrawn = 0, withdrawnDated = 0
  let listMatchesDetail = 0, listPlusOne = 0, listOther = 0
  let dateBeforeTabled = 0, dateAfterTabled = 0, dateSameAsTabled = 0
  let totalSponsors = 0, detailZeroCount = 0
  const byYear = new Map<string, { motions: number; sponsors: number; dated: number }>()
  const mismatches: any[] = []

  for (const r of results) {
    http.set(r.status, (http.get(r.status) ?? 0) + 1)
    if (r.status !== 200) continue
    ok++
    const listCount = r.m.sponsors_count
    const detailCount = r.sponsors.length
    totalSponsors += detailCount
    if ((r.resp?.SponsorsCount ?? null) === 0 && detailCount > 0) detailZeroCount++
    if (listCount === detailCount) listMatchesDetail++
    else if (listCount != null && listCount + 1 === detailCount) listPlusOne++
    else { listOther++; if (mismatches.length < 12) mismatches.push({ motion: r.m.motion_id, list: listCount, detail: detailCount, tabled: r.m.date_tabled }) }

    const yr = (r.m.date_tabled ?? '????').slice(0, 4)
    const y = byYear.get(yr) ?? { motions: 0, sponsors: 0, dated: 0 }
    y.motions++; y.sponsors += detailCount

    const primary = r.resp?.PrimarySponsor?.MnisId ?? null
    for (const s of r.sponsors) {
      const mnis = s?.Member?.MnisId ?? s?.MemberId ?? null
      if (mnis != null) withMnis++; else withoutMnis++
      if (s?.CreatedWhen) { withDate++; y.dated++ }
      if (s?.SponsoringOrder === 1) { order1++; if (mnis != null && mnis === primary) order1IsPrimary++ }
      if (s?.IsWithdrawn) { withdrawn++; if (s?.WithdrawnDate) withdrawnDated++ }
      if (s?.CreatedWhen && r.m.date_tabled) {
        const d = String(s.CreatedWhen).slice(0, 10)
        if (d < r.m.date_tabled) dateBeforeTabled++
        else if (d > r.m.date_tabled) dateAfterTabled++
        else dateSameAsTabled++
      }
    }
    byYear.set(yr, y)
  }

  console.log(`\n   HTTP  ${[...http].map(([s, c]) => `${s}×${c}`).join('  ')}`)
  console.log(`   elapsed ${(elapsed / 1000).toFixed(1)}s at concurrency 4 → ${(elapsed / results.length).toFixed(0)}ms/motion wall`)
  console.log(`   median latency ${results.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(results.length / 2)]}ms`)

  console.log(`\n   §1.1 THE DATE SIGNED`)
  console.log(`     sponsor rows read              ${n(totalSponsors)}`)
  console.log(`     with CreatedWhen               ${n(withDate)}   ${totalSponsors ? ((withDate / totalSponsors) * 100).toFixed(2) : '0'}%`)
  console.log(`     ⚠ signed BEFORE date_tabled    ${n(dateBeforeTabled)}`)
  console.log(`       signed ON date_tabled        ${n(dateSameAsTabled)}`)
  console.log(`       signed AFTER date_tabled     ${n(dateAfterTabled)}   ← the fact the brief says matters`)

  console.log(`\n   §1.2 WHAT IDENTIFIES THE SIGNATORY`)
  console.log(`     with an MNIS id                ${n(withMnis)}`)
  console.log(`     ⚠ WITHOUT one (name only)      ${n(withoutMnis)}   ← >0 means STOP AND REPORT`)

  console.log(`\n   §1.3 SPONSOR vs SIGNATORY`)
  console.log(`     rows with SponsoringOrder = 1  ${n(order1)}   (motions read OK: ${n(ok)})`)
  console.log(`     of those, = PrimarySponsor     ${n(order1IsPrimary)}`)
  console.log(`     IsWithdrawn = true             ${n(withdrawn)}   (with a WithdrawnDate: ${n(withdrawnDated)})`)

  console.log(`\n   §1.C SponsorsCount RECONCILIATION`)
  console.log(`     list count == detail length    ${n(listMatchesDetail)}`)
  console.log(`     list count + 1 == detail       ${n(listPlusOne)}   ← list EXCLUDES the primary sponsor`)
  console.log(`     neither                        ${n(listOther)}`)
  console.log(`     ⚠ detail SponsorsCount = 0 while Sponsors non-empty: ${n(detailZeroCount)} of ${n(ok)}`)
  if (mismatches.length) { console.log(`     examples that are neither:`); console.table(mismatches) }

  console.log(`\n   BY YEAR TABLED — does the API carry signatories for OLD motions?`)
  const years = [...byYear.entries()].sort()
  for (const [yr, y] of years) {
    console.log(`     ${yr}  motions ${String(y.motions).padStart(4)}   sponsor rows ${String(y.sponsors).padStart(6)}   avg ${(y.sponsors / y.motions).toFixed(1).padStart(6)}   dated ${y.sponsors ? ((y.dated / y.sponsors) * 100).toFixed(0) : '—'}%`)
  }

  // ────────────────────────────────────────────────────────────────────────────────────────────
  head('§1.4 COST — REQUESTS, TIME, STORAGE')
  const perMotion = elapsed / results.length
  const totalMotions = apiTotal
  console.log(`   requests needed                  ${n(totalMotions)}  (one detail call per motion)`)
  console.log(`   at the measured ${perMotion.toFixed(0)}ms/motion  → ${(totalMotions * perMotion / 1000 / 60).toFixed(0)} min at concurrency 4`)
  console.log(`   429s seen                        ${http.get(429) ?? 0}`)
  const avgSponsors = ok ? totalSponsors / ok : 0
  console.log(`   avg sponsor rows per motion      ${avgSponsors.toFixed(2)}`)
  console.log(`   → projected signature rows       ${n(Math.round(avgSponsors * totalMotions))}`)

  const { rows: [dbsz] } = await pool.query<{ pretty: string; bytes: string }>(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS pretty, pg_database_size(current_database())::text AS bytes`)
  console.log(`\n   database size now                ${dbsz.pretty}  (${n(dbsz.bytes)} bytes)`)
  console.log(`   the ops ALERT line               17.5 GiB — schema-3a.sql measured 0.82 GiB free`)
  console.log(`   headroom to that line            ${((17.5 * 1024 ** 3 - Number(dbsz.bytes)) / 1024 ** 3).toFixed(2)} GiB`)

  const { rows: sizes } = await pool.query<{ t: string; pretty: string; rows: string; bpr: string }>(`
    SELECT c.relname AS t, pg_size_pretty(pg_total_relation_size(c.oid)) AS pretty,
           c.reltuples::bigint::text AS rows,
           CASE WHEN c.reltuples > 0 THEN round(pg_total_relation_size(c.oid) / c.reltuples)::text ELSE '—' END AS bpr
      FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname='public' AND c.relkind='r'
       AND c.relname IN ('edm_sponsor','division_votes','position_signal_stored','position_estimate','graph_entity')
     ORDER BY pg_total_relation_size(c.oid) DESC`)
  console.log(`\n   measured per-row cost on THIS database:`)
  for (const s of sizes) console.log(`     ${s.t.padEnd(24)} ${s.pretty.padStart(10)}  ${n(s.rows).padStart(11)} rows  ${s.bpr} B/row`)

  // ────────────────────────────────────────────────────────────────────────────────────────────
  head('§2 WHO ELSE READS position_estimate')
  console.log(`   (grepped separately — see the report; this section records the DB-side dependents)`)
  const { rows: deps } = await pool.query<{ dependent: string; kind: string }>(`
    SELECT DISTINCT dc.relname AS dependent, dc.relkind::text AS kind
      FROM pg_depend d
      JOIN pg_rewrite r ON r.oid = d.objid
      JOIN pg_class dc ON dc.oid = r.ev_class
      JOIN pg_class sc ON sc.oid = d.refobjid
     WHERE sc.relname IN ('position_estimate','position_signal','position_signal_stored')
       AND dc.relname NOT IN ('position_estimate','position_signal','position_signal_stored')`)
  console.log(deps.length ? deps.map((d) => `     view ${d.dependent}`).join('\n') : '     no database-side views read them')

  await endNeonPool()
}
main().catch((e) => { console.error('[audit-edm-signatures] FATAL', e instanceof Error ? e.stack : e); process.exit(1) })
