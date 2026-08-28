/**
 * audit-4b-tax.ts — GRAPH 4B §3. What Layer 2 unlocks for tax and treaties.
 *
 * ⚠ REPORT ONLY. Nothing here fetches, ingests or writes — §3 says the fetch is
 * an ingest job. Three questions, answered against live state and live bytes:
 *
 *   1. Does Layer 2 with schedules recover any of the double taxation Orders
 *      whose scheduled agreement GRAPH 4A found missing, and how many?
 *      ⚠⚠ Answered on BOTH readings, because they give different numbers:
 *         (a) does the ENABLING LAYER recover them — no, structurally; and
 *         (b) do the BULK CLML BYTES hold the schedule the corpus dropped —
 *             which is the question anyone reading (a) actually wants answered.
 *
 *   2. Is the graph queryable in the REVERSE direction? TIOPA 2010 s.6 gives
 *      these agreements effect *despite anything in any enactment*, so the
 *      useful question for a tax proposal is not only "what does my change
 *      break" but "does a treaty already prevent this".
 *
 *   3. Do we hold OECD Multilateral Instrument positions? The MLI modifies many
 *      agreements at once WITHOUT amending each Order, so an agreement read off
 *      legislation.gov.uk can be out of date without saying so.
 *
 *   npx tsx graph/audit-4b-tax.ts [--json <path>]
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { ZipReader } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { CITATION_TABLE } from './setup-citation-edge-table'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
/** TIOPA 2010 — the Act under which double taxation Orders are made. */
const TIOPA = 'ukpga/2010/8'
/** A schedule shorter than this is a form or a signature block, not a treaty. */
const TREATY_MIN_CHARS = 4000

function slowPool(): Pool {
  return new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })
}

export type TaxAudit = {
  measuredAt: string
  q1: {
    orders: number
    corpusHoldsSchedule: number
    corpusLacksSchedule: number
    /** ⚠ reading (a): enabling rows are preamble facts and carry no schedule */
    recoveredByTheEnablingLayer: number
    /** reading (b): the bytes we already have on disk */
    clmlSampled: number
    clmlHasSubstantialSchedule: number
    clmlHasNothing: number
    clmlNotInTheBulkFile: number
    recoverableFromBytesWeHold: number
  }
  q2: {
    outboundRows: number
    inboundRows: number
    /** both directions indexed? read from pg_indexes, not assumed */
    indexes: string[]
    reverseAnswerable: boolean
    worked: { question: string; rows: number; sample: string[] }
  }
  q3: {
    mliTitleMatches: number
    mliCandidates: Array<{ gid: string; title: string }>
    held: boolean
  }
}

async function main() {
  const pool = slowPool()

  // ── Q1 ──────────────────────────────────────────────────────────────────────
  const { rows: orderRows } = await pool.query(
    `SELECT gid, title FROM corpus_acts WHERE title ILIKE '%double taxation%' AND leg_type = 'uksi' ORDER BY gid`)
  const orderGids = orderRows.map((r: { gid: string }) => r.gid)
  const { rows: schedRows } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) gid FROM corpus_sections
     WHERE corpus IN ('si-2010plus','si-pre-2010') AND id ~ ':schedule'`)
  const hasSchedule = new Set<string>(schedRows.map((r: { gid: string }) => r.gid))
  const lacking = orderGids.filter((g: string) => !hasSchedule.has(g))

  // reading (a): does the enabling layer touch them at all?
  const { rows: enab } = await pool.query(
    `SELECT COUNT(DISTINCT source_gid)::bigint n FROM ${CITATION_TABLE}
     WHERE detection = 'enabling' AND source_gid = ANY($1::text[])`, [lacking])
  // ⚠ An enabling row is a PREAMBLE fact. It says which Act granted the power.
  // It cannot carry a scheduled treaty, so this number is what the layer
  // recovers of the missing TEXT: zero, by construction. Counted anyway, because
  // "by construction" is how a wrong assumption survives.
  const enablingRowsOnLacking = Number(enab[0].n)

  // reading (b): are the schedule bytes in the bulk CLML we already hold?
  const wanted = new Set<string>(lacking)
  let clmlSampled = 0, substantial = 0, nothing = 0
  const zip = new ZipReader(ZIP_PATH)
  const found = new Set<string>()
  for (const e of zip.entries) {
    const m = e.name.match(ENTRY_RX)
    if (!m) continue
    const gid = gidFromEntry(m)
    if (!wanted.has(gid) || found.has(gid)) continue
    found.add(gid)
    clmlSampled++
    const xml = zip.readText(e)
    const schedules = [...xml.matchAll(/<Schedule\b[\s\S]*?<\/Schedule>/g)]
    const biggest = schedules.reduce((a, s) => Math.max(a, s[0].length), 0)
    if (biggest >= TREATY_MIN_CHARS) substantial++
    else nothing++
  }
  zip.close()
  const notInBulk = lacking.length - clmlSampled

  // ── Q2 — the reverse direction ──────────────────────────────────────────────
  const { rows: idx } = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`, [CITATION_TABLE])
  const indexes = idx.map((r: { indexname: string }) => r.indexname)
  const outbound = Number((await pool.query(
    `SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE source_gid = ANY($1::text[])`, [orderGids])).rows[0].n)
  const inboundN = Number((await pool.query(
    `SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE target_act_id = ANY($1::text[])`, [orderGids])).rows[0].n)
  // The question a tax proposal actually asks, run as a query:
  // "I want to change TIOPA 2010 — which double taxation Orders stand on it?"
  const { rows: workedRows } = await pool.query(
    `SELECT DISTINCT source_gid FROM ${CITATION_TABLE}
     WHERE detection = 'enabling' AND target_act_id = $1 AND source_gid = ANY($2::text[])
     ORDER BY source_gid LIMIT 5`, [TIOPA, orderGids])
  const workedCount = Number((await pool.query(
    `SELECT COUNT(DISTINCT source_gid)::bigint n FROM ${CITATION_TABLE}
     WHERE detection = 'enabling' AND target_act_id = $1`, [TIOPA])).rows[0].n)

  // ── Q3 — MLI ────────────────────────────────────────────────────────────────
  const { rows: mli } = await pool.query(
    `SELECT gid, title FROM corpus_acts
     WHERE title ILIKE '%multilateral%' AND (title ILIKE '%tax%' OR title ILIKE '%base erosion%' OR title ILIKE '%treaty%')
     ORDER BY gid LIMIT 20`)
  const mliAll = Number((await pool.query(
    `SELECT COUNT(*)::bigint n FROM corpus_acts WHERE title ILIKE '%multilateral%'`)).rows[0].n)

  const out: TaxAudit = {
    measuredAt: new Date().toISOString(),
    q1: {
      orders: orderGids.length,
      corpusHoldsSchedule: orderGids.length - lacking.length,
      corpusLacksSchedule: lacking.length,
      recoveredByTheEnablingLayer: 0,
      clmlSampled, clmlHasSubstantialSchedule: substantial, clmlHasNothing: nothing,
      clmlNotInTheBulkFile: notInBulk,
      recoverableFromBytesWeHold: substantial,
    },
    q2: {
      outboundRows: outbound, inboundRows: inboundN, indexes,
      reverseAnswerable: indexes.some(i => i.includes('target_act')) && indexes.some(i => i.includes('source_gid')),
      worked: {
        question: `which instruments are made under ${TIOPA} (TIOPA 2010)?`,
        rows: workedCount,
        sample: workedRows.map((r: { source_gid: string }) => r.source_gid),
      },
    },
    q3: {
      mliTitleMatches: mliAll,
      mliCandidates: mli.map((r: { gid: string; title: string }) => ({ gid: r.gid, title: r.title })),
      held: false,
    },
  }

  console.log('\n══ §3.1 — DOES LAYER 2 RECOVER THE MISSING TREATY TEXT? ══')
  console.log(`  ${out.q1.orders} double taxation Orders · ${out.q1.corpusHoldsSchedule} hold a schedule section · ${out.q1.corpusLacksSchedule} do not`)
  console.log(`  (a) recovered by the ENABLING LAYER: ${out.q1.recoveredByTheEnablingLayer}`)
  console.log(`      ⚠ Zero, and not by accident. An enabling row is a PREAMBLE fact — which Act granted`)
  console.log(`      the power. The missing thing is a SCHEDULE. ${enablingRowsOnLacking} of the ${out.q1.corpusLacksSchedule} do carry an`)
  console.log(`      enabling row, so they are visible to the graph; the treaty still is not in it.`)
  console.log(`  (b) present in the bulk CLML we already hold on disk:`)
  console.log(`      ${out.q1.clmlHasSubstantialSchedule} of ${out.q1.clmlSampled} carry a schedule of ≥${TREATY_MIN_CHARS.toLocaleString()} characters`)
  console.log(`      ${out.q1.clmlHasNothing} carry no substantial schedule · ${out.q1.clmlNotInTheBulkFile} are not in the bulk file at all`)
  console.log(`  ▶ RECOVERABLE WITHOUT FETCHING ANYTHING: ${out.q1.recoverableFromBytesWeHold}`)

  console.log('\n══ §3.2 — IS THE REVERSE DIRECTION ANSWERABLE TODAY? ══')
  console.log(`  indexes on ${CITATION_TABLE}: ${indexes.join(', ')}`)
  console.log(`  outbound (an Order → what it points at): ${outbound.toLocaleString()} rows`)
  console.log(`  inbound  (→ an Order): ${inboundN.toLocaleString()} rows`)
  console.log(`  worked: ${out.q2.worked.question} → ${out.q2.worked.rows.toLocaleString()} instruments`)
  console.log(`    e.g. ${out.q2.worked.sample.join(', ')}`)
  console.log(`  ▶ ${out.q2.reverseAnswerable ? 'YES — both columns are indexed and the query runs.' : '⚠ NO'}`)

  console.log('\n══ §3.3 — ARE MLI POSITIONS HELD? ══')
  console.log(`  ${out.q3.mliTitleMatches} corpus_acts titles contain "multilateral"; tax/treaty-shaped candidates:`)
  for (const c of out.q3.mliCandidates) console.log(`    ${c.gid.padEnd(18)} ${c.title.slice(0, 110)}`)
  console.log(`  ▶ ${out.q3.held ? 'HELD' : 'NOT HELD — and the coverage block must say so.'}`)

  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[audit-4b-tax] wrote ${process.argv[jsonIx + 1]}`)
  }
  await pool.end()
}

if (require.main === module) {
  main().catch(e => { console.error('[audit-4b-tax] FATAL', e); process.exit(1) })
}
