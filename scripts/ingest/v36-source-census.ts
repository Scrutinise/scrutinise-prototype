/**
 * v36-source-census.ts — V36 §1.3: reconcile the corpus against legislation.gov.uk's
 * OWN published totals, per doctype and year. Not against LegislationItem, which is
 * itself a partial snapshot and is the reason the gap has been mis-sized twice.
 *
 * Two modes, both checkpointed per (type, year) so a throttled run resumes:
 *
 *   --totals    one request per (type, year): read <openSearch:totalResults> from
 *               the year feed. Cheap — but ⚠ NOT the instrument to reconcile on.
 *               legislation.gov.uk emits totalResults only on feeds that do NOT
 *               carry range buckets: ukpga/1925 has it, uksi/2010 and ssi/2010 and
 *               eur/2016 do not, and those are precisely the dense years where the
 *               count matters. Measured, not assumed — a first pass recorded 226
 *               ukpga years and ZERO uksi years. Kept because the sparse-year
 *               numbers are a free cross-check on the enumeration, and because a
 *               later reader would otherwise try the same endpoint again.
 *
 *   --enumerate THE INSTRUMENT. Full entry walk per (type, year), recording BOTH ids the source
 *               publishes: the canonical <id> (REGNAL for pre-1963 Acts, e.g.
 *               ukpga/Geo5/15-16/20) and the calendar identity from
 *               <ukm:Year>/<ukm:Number> (ukpga/1925/20). Those are the same Act.
 *               LegislationItem names it by the calendar id, the corpus holds it
 *               under the regnal id, and nothing until now has joined the two —
 *               which is why the Law of Property Act 1925 reads as "missing".
 *
 * Politeness: TNA 429'd a 200ms sweep in V19; the playbook's budget rule says halve,
 * so local enumeration runs at TNA_THROTTLE_FLOOR_MS=500. Set before importing the
 * source module, which reads it at construction.
 *
 * Usage:
 *   tsx v36-source-census.ts --totals [--types ukpga,uksi] [--from 1801] [--to 2026]
 *   tsx v36-source-census.ts --enumerate --types ukpga
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '500'
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

const OUT_DIR = path.join(__dirname, 'v36')
const TOTALS_PATH = path.join(OUT_DIR, 'source-totals.json')
const ENUM_PATH = path.join(OUT_DIR, 'source-entries.json')

/** Year ranges are the source's own, not ours: the first year legislation.gov.uk
 *  publishes a feed for, through the current year. Where a type genuinely starts
 *  later (devolved bodies) the earlier years return 0 and that is recorded as 0,
 *  never inferred. */
const TYPE_RANGES: Record<string, [number, number]> = {
  ukpga: [1801, 2026],
  uksi:  [1948, 2026],
  ssi:   [1999, 2026],
  asp:   [1999, 2026],
  wsi:   [1999, 2026],
  anaw:  [2012, 2026],
  asc:   [2020, 2026],
  nisr:  [1922, 2026],
  nia:   [2000, 2026],
  nisi:  [1972, 2026],
  eur:   [1952, 2020],
  eudn:  [1952, 2020],
  eudr:  [1952, 2020],
}

const TNA_BASE = 'https://www.legislation.gov.uk'
const UA = 'ScrutiniseBot/1.0 (+https://www.scrutinise.org; corpus completeness reconciliation)'

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}

const MODE_TOTALS = process.argv.includes('--totals')
const MODE_ENUM = process.argv.includes('--enumerate')
const TYPES = (arg('types') ?? Object.keys(TYPE_RANGES).join(',')).split(',').filter(Boolean)
const FROM = arg('from') ? Number(arg('from')) : null
const TO = arg('to') ? Number(arg('to')) : null

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function loadJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as T } catch { return fallback }
}
function saveJson(p: string, v: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(v, null, 1))
}

/**
 * Read a year feed's own totalResults. Returns:
 *   number  — the source's published count for that (type, year)
 *   null    — retryable (429/5xx/network): the caller must NOT record a 0
 *   0       — a real, deterministic empty year (404 or a feed with total 0)
 *
 * The null/0 split is the whole point: recording a throttled year as 0 would
 * manufacture a coverage gap out of a rate limit, which is the V19 failure in a
 * different costume.
 */
async function fetchYearTotal(type: string, year: number): Promise<number | null> {
  const url = `${TNA_BASE}/${type}/${year}/data.feed`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/atom+xml' } })
      if (res.status === 404) return 0
      if (res.status === 429 || res.status >= 500) {
        await sleep(2000 * attempt)
        continue
      }
      if (!res.ok) return null
      const xml = await res.text()
      const m = /<openSearch:totalResults>(\d+)<\/openSearch:totalResults>/.exec(xml)
      if (!m) return null
      return Number(m[1])
    } catch {
      await sleep(2000 * attempt)
    }
  }
  return null
}

async function runTotals() {
  const store = loadJson<Record<string, number>>(TOTALS_PATH, {})
  let fetched = 0, cached = 0, failed: string[] = []

  for (const type of TYPES) {
    const range = TYPE_RANGES[type]
    if (!range) { console.warn(`[v36] unknown type ${type} — skipped`); continue }
    const y0 = FROM ?? range[0], y1 = TO ?? range[1]
    let typeTotal = 0
    for (let year = y0; year <= y1; year++) {
      const key = `${type}/${year}`
      if (key in store) { typeTotal += store[key]; cached++; continue }
      const total = await fetchYearTotal(type, year)
      if (total === null) {
        failed.push(key)
        console.warn(`[v36] ${key}: unreadable — NOT recorded (would fake a gap)`)
      } else {
        store[key] = total
        typeTotal += total
        fetched++
        if (fetched % 25 === 0) { saveJson(TOTALS_PATH, store); console.log(`[v36] …${fetched} years fetched (last ${key}=${total})`) }
      }
      await sleep(500)
    }
    console.log(`[v36] ${type}: ${typeTotal.toLocaleString()} instruments published across ${y1 - y0 + 1} years`)
  }
  saveJson(TOTALS_PATH, store)
  console.log(`[v36] totals: ${fetched} fetched, ${cached} from checkpoint, ${failed.length} unreadable`)
  if (failed.length) console.log(`[v36] unreadable years (re-run to retry): ${failed.join(', ')}`)
}

async function runEnumerate() {
  const { listActEntriesYear } = await import('./sources/tna-legislation')
  const store = loadJson<Record<string, { docId: string; calendarId: string | null }[]>>(ENUM_PATH, {})
  let fetched = 0, cached = 0
  const failed: string[] = []

  for (const type of TYPES) {
    const range = TYPE_RANGES[type]
    if (!range) { console.warn(`[v36] unknown type ${type} — skipped`); continue }
    const y0 = FROM ?? range[0], y1 = TO ?? range[1]
    for (let year = y0; year <= y1; year++) {
      const key = `${type}/${year}`
      if (key in store) { cached++; continue }
      const entries = await listActEntriesYear(type, year)
      if (entries === null) {
        failed.push(key)
        console.warn(`[v36] ${key}: throttled — NOT recorded`)
        await sleep(5000)
        continue
      }
      store[key] = entries.map(e => ({ docId: e.docId, calendarId: e.calendarId }))
      fetched++
      console.log(`[v36] ${key.padEnd(12)} ${String(entries.length).padStart(5)} entries`)
      if (fetched % 10 === 0) saveJson(ENUM_PATH, store)
    }
  }
  saveJson(ENUM_PATH, store)
  const n = Object.values(store).reduce((a, v) => a + v.length, 0)
  console.log(`[v36] enumerate: ${fetched} fetched, ${cached} cached, ${failed.length} throttled; ${n.toLocaleString()} entries held`)
  if (failed.length) console.log(`[v36] throttled years (re-run to retry): ${failed.join(', ')}`)
}

async function main() {
  if (!MODE_TOTALS && !MODE_ENUM) throw new Error('pass --totals or --enumerate')
  fs.mkdirSync(OUT_DIR, { recursive: true })
  if (MODE_TOTALS) await runTotals()
  if (MODE_ENUM) await runEnumerate()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
