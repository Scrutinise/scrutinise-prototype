/**
 * v36-reconcile.ts — V36 §1.3 and the §2 work list.
 *
 * Reconciles what legislation.gov.uk PUBLISHES (v36/source-entries.json, walked by
 * v36-source-census.ts --enumerate) against what `corpus_sections` HOLDS. Not
 * against `LegislationItem`, which is itself a partial snapshot and is what sized
 * the gap wrongly twice.
 *
 * THE IDENTITY RULE, and it is the whole reason this script exists.
 * A pre-1963 Act has two ids for the same document: the canonical REGNAL id the
 * feed publishes (`ukpga/Geo5/15-16/20`) and the CALENDAR id `LegislationItem`
 * stores (`ukpga/1925/20`). The corpus was ingested under the first and audited
 * against the second, so 8,514 Acts read as "never attempted" when the text may
 * well be there. An instrument counts as PRESENT if EITHER id has a compiled
 * section. Counting on one id alone is what produced the 17,261.
 *
 * Outputs:
 *   docs/v36_reconciliation.json  — per (type, year): published, present, absent
 *   scripts/ingest/v36/worklist.jsonl — one row per instrument to recover, with the
 *                                       id to fetch and why it is on the list
 *
 * Usage: tsx v36-reconcile.ts [--types ukpga,uksi]
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'

const LEG_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000',
  'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex',
]

const ENUM_PATH = path.join(__dirname, 'v36', 'source-entries.json')
const OUT_JSON = path.join(__dirname, '../../docs/v36_reconciliation.json')
const OUT_WORK = path.join(__dirname, 'v36', 'worklist.jsonl')

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const ONLY = arg('types')?.split(',').filter(Boolean) ?? null

/** Which corpus a recovered instrument belongs in — the same routing the original
 *  seeders used, so recovered rows land beside their neighbours rather than in a
 *  new collection nothing is wired to. */
function corpusFor(type: string, year: number | null): string {
  if (type === 'ukpga') return (year ?? 0) >= 2000 ? 'primary-acts-2000plus' : 'primary-acts-pre-2000'
  if (type === 'uksi') return (year ?? 0) >= 2010 ? 'si-2010plus' : 'si-pre-2010'
  if (['eur', 'eudn', 'eudr'].includes(type)) return 'retained-eu'
  return 'regional'  // asp/ssi/wsi/anaw/asc/nia/nisi/nisr
}

async function main() {
  if (!fs.existsSync(ENUM_PATH)) throw new Error(`no enumeration at ${ENUM_PATH} — run v36-source-census.ts --enumerate first`)
  const store: Record<string, { docId: string; calendarId: string | null }[]> = JSON.parse(fs.readFileSync(ENUM_PATH, 'utf8'))

  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 1_800_000, query_timeout: 1_800_000,
  })
  const c = await pool.connect()

  console.log('[v36] loading corpus gid state…')
  const t0 = Date.now()
  const { rows: state } = await c.query(`
    SELECT split_part(id, ':', 2) AS gid,
           count(*) FILTER (WHERE status='compiled')::int AS compiled,
           count(*) FILTER (WHERE status='unavailable' AND "errorMsg" = 'No CLML/HTML/PDF found on TNA')::int AS classb,
           count(*) FILTER (WHERE status='unavailable' AND "errorMsg" LIKE 'hasNoProvisions%')::int AS classa
    FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1`, [LEG_CORPORA])
  c.release(); await pool.end()

  const compiled = new Set<string>()
  const classb = new Set<string>()
  const classa = new Set<string>()
  for (const r of state) {
    if (r.compiled > 0) compiled.add(r.gid)
    else if (r.classb > 0) classb.add(r.gid)
    else if (r.classa > 0) classa.add(r.gid)
  }
  console.log(`[v36] corpus holds ${compiled.size.toLocaleString()} instruments with text, ` +
    `${classa.size.toLocaleString()} classified no-provisions, ${classb.size.toLocaleString()} fetch-outcome markers ` +
    `(${((Date.now() - t0) / 1000).toFixed(1)}s)`)

  const perYear: Record<string, Record<string, number>> = {}
  const perType: Record<string, Record<string, number>> = {}
  const work: string[] = []

  for (const [key, entries] of Object.entries(store)) {
    const [type, yearStr] = key.split('/')
    if (ONLY && !ONLY.includes(type)) continue
    const year = Number(yearStr)

    let present = 0, presentViaCalendar = 0, absentClassB = 0, absentClassA = 0, absentUnseen = 0
    for (const e of entries) {
      const ids = [e.docId, e.calendarId].filter(Boolean) as string[]
      if (ids.some(id => compiled.has(id))) {
        present++
        // The regnal/calendar split, counted rather than asserted: instruments whose
        // text is held ONLY under an id that is not the calendar id — i.e. exactly
        // the ones a LegislationItem-keyed audit reports as missing while the
        // corpus has them. This is the number that corrects the 17,261.
        if (e.calendarId && e.docId !== e.calendarId &&
            compiled.has(e.docId) && !compiled.has(e.calendarId)) presentViaCalendar++
        continue
      }
      const reason = ids.some(id => classb.has(id)) ? 'classb'
        : ids.some(id => classa.has(id)) ? 'classa'
        : 'unseen'
      if (reason === 'classb') absentClassB++
      else if (reason === 'classa') absentClassA++
      else absentUnseen++
      // classa is NOT work: the CLML was fetched and declares no provisions. Putting
      // it on the list would re-fetch 146,372 instruments to re-learn what we know.
      if (reason !== 'classa') {
        work.push(JSON.stringify({
          docId: e.docId, calendarId: e.calendarId, type, year,
          corpus: corpusFor(type, year), reason,
        }))
      }
    }

    perYear[key] = { published: entries.length, present, presentViaCalendar, absentClassB, absentClassA, absentUnseen }
    const t = (perType[type] ??= { published: 0, present: 0, presentViaCalendar: 0, absentClassB: 0, absentClassA: 0, absentUnseen: 0, years: 0 })
    t.published += entries.length; t.present += present; t.presentViaCalendar += presentViaCalendar
    t.absentClassB += absentClassB; t.absentClassA += absentClassA; t.absentUnseen += absentUnseen; t.years += 1
  }

  fs.mkdirSync(path.dirname(OUT_WORK), { recursive: true })
  fs.writeFileSync(OUT_WORK, work.join('\n') + (work.length ? '\n' : ''))
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generated_from: 'legislation.gov.uk year feeds (v36/source-entries.json)',
    years_enumerated: Object.keys(store).length,
    per_type: perType, per_year: perYear,
  }, null, 1))

  console.log('\n=== §1.3 RECONCILIATION AGAINST THE SOURCE\'S OWN PUBLISHED SET ===\n')
  console.log('type    years  published    present  only-regnal  absent:classB  absent:classA  absent:unseen   coverage')
  let gp = 0, gpr = 0, gb = 0, ga = 0, gu = 0
  for (const [type, t] of Object.entries(perType).sort((a, b) => b[1].published - a[1].published)) {
    const cov = t.published ? (100 * t.present / t.published) : 0
    console.log(
      `${type.padEnd(7)} ${String(t.years).padStart(4)}  ${t.published.toLocaleString().padStart(9)}  ` +
      `${t.present.toLocaleString().padStart(9)}  ${t.presentViaCalendar.toLocaleString().padStart(10)}  ` +
      `${t.absentClassB.toLocaleString().padStart(13)}  ${t.absentClassA.toLocaleString().padStart(13)}  ` +
      `${t.absentUnseen.toLocaleString().padStart(13)}   ${cov.toFixed(1)}%`)
    gp += t.published; gpr += t.present; gb += t.absentClassB; ga += t.absentClassA; gu += t.absentUnseen
  }
  console.log(`\nTOTAL published ${gp.toLocaleString()} · present ${gpr.toLocaleString()} (${(100 * gpr / gp).toFixed(1)}%) · ` +
    `absent ${(gp - gpr).toLocaleString()} = classB ${gb.toLocaleString()} + classA ${ga.toLocaleString()} + unseen ${gu.toLocaleString()}`)
  console.log(`\n[v36] work list: ${work.length.toLocaleString()} instruments → ${OUT_WORK}`)
  console.log(`[v36] reconciliation → ${OUT_JSON}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
