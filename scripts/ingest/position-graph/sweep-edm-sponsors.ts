/**
 * sweep-edm-sponsors.ts — BRIEF_GRAPH_2D2 §3: the primary sponsor, keyed rather than name-matched.
 *
 * `corpus_sections.speaker` already carries the sponsor's display name on all 60,737 EDM rows, so
 * the EDGE is free. What is NOT free, and what this recovers, is the sponsor's IDENTITY: the API's
 * list item carries `PrimarySponsor.MnisId` and a top-level `MemberId`, and processEarlyDayMotions
 * keeps neither — the same shape of loss the brief points at everywhere else in this project.
 *
 * ⚠ WHAT THIS IS NOT. `signed-motion` in Amendment 1 §1 means a SIGNATURE, and an EDM's other
 * `SponsorsCount - 1` signatories are not on this endpoint. Every row written here is stamped
 * 'primary-sponsor' in the view, and the count of signatures we do NOT hold is reported, because a
 * sponsor count printed beside a sponsor edge invites exactly the reading that the edges are the
 * signatures.
 *
 * ⚠ NOR IS IT A RE-INGEST. Nothing here touches corpus_sections, R2 or the queue. It reads the same
 * list endpoint the ingest already reads and writes one narrow table of ids.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/sweep-edm-sponsors.ts --probe   # 3 pages, report shape, write nothing
 *   npx tsx position-graph/sweep-edm-sponsors.ts --apply   # the full sweep
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const PROBE = argv.includes('--probe') || !APPLY

const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const TAKE = 100
const CONCURRENCY = 3       // the ingest's own rate discipline for this host
const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

async function getJson(url: string, attempts = 4): Promise<any | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.ok) return await res.json()
      // Not a rate limit and not a server fault → it is an answer. Retrying it is the V36 defect.
      if (res.status !== 429 && res.status < 500) { console.log(`   HTTP ${res.status} ${url}`); return null }
    } catch { /* transient */ }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
  }
  return null
}

async function pooled<T>(items: T[], fn: (t: T, i: number) => Promise<void>, n = CONCURRENCY) {
  let idx = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = idx++; if (i >= items.length) return; await fn(items[i], i) }
  }))
}

interface Row {
  motion_id: number; mnis_id: number | null; sponsor_name: string; party: string | null
  constituency: string | null; date_tabled: string | null; sponsors_count: number | null; uin: string | null
}

const mapRow = (r: any): Row => ({
  motion_id: r.Id,
  // Two ids are on the wire and they are not the same field. PrimarySponsor.MnisId is the sponsor;
  // the top-level MemberId is used as a fallback only, and how often they differ is REPORTED.
  mnis_id: r.PrimarySponsor?.MnisId ?? r.MemberId ?? null,
  sponsor_name: (r.PrimarySponsor?.Name ?? '').trim(),
  party: r.PrimarySponsor?.Party ?? null,
  constituency: r.PrimarySponsor?.Constituency ?? null,
  date_tabled: r.DateTabled ? String(r.DateTabled).slice(0, 10) : null,
  sponsors_count: r.SponsorsCount ?? null,
  uin: r.UINWithAmendmentSuffix ?? (r.UIN != null ? String(r.UIN) : null),
})

async function main() {
  head('§3 EDM PRIMARY SPONSORS')
  const first = await getJson(`${BASE}/EarlyDayMotions/list?parameters.take=1&parameters.skip=0`)
  const total: number = first?.PagingInfo?.Total ?? 0
  if (!total) { console.error('   ❌ Total = 0 — refusing to sweep an empty list'); process.exit(1) }

  const { rows: [held] } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM corpus_sections WHERE corpus='early-day-motions'`)
  console.log(`   API says ${total} motions; we hold ${held.n} sections`)
  console.log(`   ⚠ the gap of ${total - Number(held.n)} is motions tabled since the last ingest — this sweep does`)
  console.log(`     not close it, and an edge is only written where we hold the section to evidence it.`)

  const pages = Array.from({ length: Math.ceil(total / TAKE) }, (_, i) => i * TAKE)
  const use = PROBE ? pages.slice(0, 3) : pages
  console.log(`   ${use.length} list calls at take=${TAKE}${PROBE ? '  (PROBE — writes nothing)' : ''}`)

  const rows: Row[] = []
  let failed = 0, done = 0, idMismatch = 0, sponsorIdMissing = 0
  await pooled(use, async (skip) => {
    const d = await getJson(`${BASE}/EarlyDayMotions/list?parameters.take=${TAKE}&parameters.skip=${skip}`)
    if (!d || !Array.isArray(d.Response)) { failed++; return }
    for (const r of d.Response) {
      if (r?.Id == null) continue
      if (r.PrimarySponsor?.MnisId == null) sponsorIdMissing++
      if (r.PrimarySponsor?.MnisId != null && r.MemberId != null && r.PrimarySponsor.MnisId !== r.MemberId) idMismatch++
      rows.push(mapRow(r))
    }
    if (++done % 100 === 0) console.log(`     ${done}/${use.length} pages … ${rows.length} motions`)
  })

  head('§3 WHAT CAME BACK')
  console.log(`   pages that failed outright        ${failed}`)
  console.log(`   motions read                      ${rows.length}`)
  console.log(`   with a PrimarySponsor.MnisId      ${rows.filter((r) => r.mnis_id != null).length}`)
  console.log(`   ⚠ WITHOUT one                     ${sponsorIdMissing}   (recorded as NULL, not dropped)`)
  console.log(`   ⚠ MnisId ≠ top-level MemberId     ${idMismatch}   (they are different fields; the sponsor's id wins)`)
  console.log(`   distinct sponsors                 ${new Set(rows.map((r) => r.mnis_id).filter(Boolean)).size}`)
  const sig = rows.reduce((a, r) => a + (r.sponsors_count ?? 0), 0)
  console.log(`   signatures these motions carry    ${sig}`)
  console.log(`   ⚠ signatures this sprint CAN name ${rows.filter((r) => r.mnis_id != null).length} — the primary sponsor only.`)
  console.log(`     ${sig - rows.filter((r) => r.mnis_id != null).length} signatures exist in the record and are NOT in this graph.`)

  if (failed > use.length * 0.02) {
    console.error(`   ❌ ${failed} of ${use.length} pages failed (>2%). Refusing to write a partial sweep.`); process.exit(1)
  }
  if (PROBE) {
    console.log(`\n   sample:`)
    for (const r of rows.slice(0, 5)) console.log(`      ${r.motion_id}  MNIS ${r.mnis_id}  ${r.sponsor_name}  ${r.date_tabled}  ${r.sponsors_count} sigs`)
    console.log(`\n   PROBE — nothing written. Re-run with --apply.`)
    return
  }

  head('§3 WRITING')
  let wrote = 0
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400)
    const vals: any[] = []
    const ph = chunk.map((r, j) => {
      vals.push(r.motion_id, r.mnis_id, r.sponsor_name || '(none given)', r.party, r.constituency,
        r.date_tabled, r.sponsors_count, r.uin)
      const b = j * 8
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`
    }).join(',')
    const res = await pool.query(
      `INSERT INTO edm_sponsor (motion_id, mnis_id, sponsor_name, party, constituency, date_tabled, sponsors_count, uin)
       VALUES ${ph}
       ON CONFLICT (motion_id) DO UPDATE SET mnis_id=EXCLUDED.mnis_id, sponsor_name=EXCLUDED.sponsor_name,
         party=EXCLUDED.party, constituency=EXCLUDED.constituency, date_tabled=EXCLUDED.date_tabled,
         sponsors_count=EXCLUDED.sponsors_count, uin=EXCLUDED.uin, fetched_at=now()`, vals)
    wrote += res.rowCount ?? 0
  }
  console.log(`   edm_sponsor ← ${wrote} rows`)

  // ⚠ THE CHECK THAT MAKES THE RECOVERY WORTH ANYTHING. The point of the sweep is that the id and
  // the name we already had agree; if they disagree, one of them is wrong about who sponsored the
  // motion, and that is a finding rather than a rounding error.
  const { rows: [agree] } = await pool.query<{ both: string; same: string; differ: string }>(
    `SELECT COUNT(*)::text AS both,
            COUNT(*) FILTER (WHERE lower(btrim(s.sponsor_name)) = lower(btrim(c.speaker)))::text AS same,
            COUNT(*) FILTER (WHERE lower(btrim(s.sponsor_name)) <> lower(btrim(c.speaker)))::text AS differ
       FROM edm_sponsor s JOIN corpus_sections c ON c.id = 'early-day-motions:' || s.motion_id || ':1'
      WHERE c.speaker IS NOT NULL`)
  console.log(`\n   cross-check against the name our ingest already stored:`)
  console.log(`     motions where both exist   ${agree.both}`)
  console.log(`     name agrees                ${agree.same}`)
  console.log(`     ⚠ name DISAGREES           ${agree.differ}`)
  if (Number(agree.differ) > 0) {
    const { rows: ex } = await pool.query(
      `SELECT s.motion_id, s.sponsor_name AS from_api_now, c.speaker AS from_ingest_then
         FROM edm_sponsor s JOIN corpus_sections c ON c.id = 'early-day-motions:' || s.motion_id || ':1'
        WHERE lower(btrim(s.sponsor_name)) <> lower(btrim(c.speaker)) LIMIT 10`)
    console.table(ex)
  }

  const { rows: [edges] } = await pool.query<{ n: string; people: string }>(
    `SELECT COUNT(*)::text AS n, COUNT(DISTINCT subject_id)::text AS people FROM graph_signed_motion_edge`)
  console.log(`\n   graph_signed_motion_edge now yields ${edges.n} edges over ${edges.people} people`)
  await endNeonPool()
}
main().catch((e) => { console.error('[sweep-edm-sponsors] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
