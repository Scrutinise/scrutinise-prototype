/**
 * walk-legislation.ts — PART B, WALKER 1. legislation.gov.uk's own index, walked entry by entry.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY AN ENTRY WALK AND NOT THE HEADER
 *
 * legislation.gov.uk emits `<openSearch:totalResults>` ONLY on feeds whose whole result set fits on
 * one page. Measured again 27 Aug on six feeds: `ukpga/2020` carries it (29), `asp/2020` carries it
 * (18), and `uksi/2020`, `apni`, `ukcm` and `nisr/2020` do not — which is to say, it is absent on
 * precisely the dense feeds where a denominator matters. V36 found the same thing in July. The
 * header is therefore recorded as a cross-check and NEVER as the denominator.
 *
 * ⚠ BOTH IDS, ALWAYS. The Vagrancy Act 1824 is `ukpga/Geo4/5/83` in the corpus and `ukpga/1824/83`
 * in `LegislationItem`; a lookup on one form returns zero rows and manufactures a false gap. A7's
 * first run reported 1,579 independent gaps and every one was false for exactly this reason. Each
 * entry carries the canonical `<id>` and the calendar identity, and the held-side match tries both.
 *
 * ⚠ A THROTTLED FEED IS NOT AN EMPTY FEED. `listActEntriesYear` returns null on 429/5xx and this
 * script records nothing for that year rather than a zero — recording a rate limit as a zero
 * manufactures a coverage gap, which is the V19 failure in a different costume.
 *
 * Checkpointed per (type, year) into docs/census/walks/legislation-entries.json, so a run that is
 * interrupted resumes where it stopped.
 *
 * Usage:
 *   tsx census/b/walk-legislation.ts                       # walk everything not yet checkpointed
 *   tsx census/b/walk-legislation.ts --types apni,ukcm     # one or more types
 *   tsx census/b/walk-legislation.ts --census-only         # skip the walk, write census rows from the checkpoint
 *   tsx census/b/walk-legislation.ts --self-test           # prove the held side can report 0%
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '500'
import fs from 'fs'
import path from 'path'
import { pool } from '../../c2/db'
import { writeCensus, selfTestHeld, WALK_DIR, type CensusRow } from './harness'

const arg = (n: string) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? '').split('=')[1] || null
const CENSUS_ONLY = process.argv.includes('--census-only')
const SELF_TEST = process.argv.includes('--self-test')
const STORE = path.join(WALK_DIR, 'legislation-entries.json')

/** The source's own year ranges. A type that genuinely starts later records 0 for the earlier
 *  years — never an inferred start date. */
const TYPE_RANGES: Record<string, [number, number]> = {
  // UK-wide primary and secondary
  ukpga: [1801, 2026],
  ukla:  [1801, 2026],   // UK Local Acts — NEW this sprint, held = 0
  uksi:  [1948, 2026],
  ukcm:  [1920, 2026],   // Church Assembly / General Synod Measures — NEW, held = 0
  ukci:  [1991, 2026],   // Church Instruments — NEW, held = 0
  // Devolved, printed individually rather than as "regional"
  asp:   [1999, 2026],   // Acts of the Scottish Parliament
  ssi:   [1999, 2026],   // Scottish Statutory Instruments
  anaw:  [2012, 2026],   // Acts of the National Assembly for Wales
  asc:   [2020, 2026],   // Acts of Senedd Cymru
  wsi:   [1999, 2026],   // Wales Statutory Instruments
  nia:   [2000, 2026],   // Acts of the Northern Ireland Assembly
  nisr:  [1922, 2026],   // NI Statutory Rules
  nisi:  [1972, 2026],   // NI Orders in Council
  mwa:   [2008, 2011],   // Measures of the National Assembly for Wales — 22 units held, never named
  apni:  [1921, 2026],   // Acts of the Northern Ireland Parliament — NEW, held = 0
  // Retained EU
  eur:   [1952, 2020],
  eudn:  [1952, 2020],
  eudr:  [1952, 2020],
}

/**
 * How each published type maps onto a corpus collection. `null` means we hold none of it and the
 * census row is the honest record of that — a collection at 0% that has never had a row before.
 * ⚠ uksi is split at 2010 because that is where OUR two collections split; the publisher does not
 * split it, so the denominator is summed per year on our side of the line, not theirs.
 */
const HELD_BY: Record<string, { corpusKeys: string[]; label: string; yearFilter?: (y: number) => boolean }[]> = {
  ukpga: [
    { corpusKeys: ['primary-acts-pre-2000'], label: 'primary-acts-pre-2000', yearFilter: y => y < 2000 },
    { corpusKeys: ['primary-acts-2000plus'], label: 'primary-acts-2000plus', yearFilter: y => y >= 2000 },
  ],
  uksi: [
    { corpusKeys: ['si-pre-2010'], label: 'si-pre-2010', yearFilter: y => y < 2010 },
    { corpusKeys: ['si-2010plus'], label: 'si-2010plus', yearFilter: y => y >= 2010 },
  ],
  // ⚠ Retained EU and devolved legislation are held in ONE corpus key each (`retained-eu`,
  // `regional`) but the publisher indexes them by type, and the brief requires the types printed
  // individually — `regional` at "89% complete" hides an `nia` at 40% behind an `ssi` at 99%. So
  // each type gets its own census row and the held side is filtered to that type's gid prefix.
  // ⚠⚠ THE EU TYPES CARRY A UNIVERSE CAVEAT AND THEIR PERCENTAGE MUST BE READ WITH IT.
  // legislation.gov.uk's /eur/, /eudn/ and /eudr/ collections publish the EU instruments it holds
  // for the UK — 159,773 across the three. Our `retained-eu` collection is scoped to ASSIMILATED
  // (formerly retained) EU law, which is a SUBSET: an EU instrument that never applied to the UK,
  // or that lapsed before exit day, is published there and is correctly not held by us. So
  // 20.2%/44.9%/63.1% is a floor on coverage of a universe that may be larger than ours, not a
  // measure of what we are missing. It is recorded as MEASURED because the walk is real, and the
  // caveat travels with it in `notes`. Settling it needs one comparison against the assimilated-law
  // list, which nobody has done — decision B-6.
  eur:  [{ corpusKeys: ['retained-eu'], label: 'retained-eu-eur' }],
  eudn: [{ corpusKeys: ['retained-eu'], label: 'retained-eu-eudn' }],
  eudr: [{ corpusKeys: ['retained-eu'], label: 'retained-eu-eudr' }],
  asp:  [{ corpusKeys: ['regional'], label: 'devolved-asp' }],
  ssi:  [{ corpusKeys: ['regional'], label: 'devolved-ssi' }],
  anaw: [{ corpusKeys: ['regional'], label: 'devolved-anaw' }],
  asc:  [{ corpusKeys: ['regional'], label: 'devolved-asc' }],
  mwa:  [{ corpusKeys: ['regional'], label: 'devolved-mwa' }],
  wsi:  [{ corpusKeys: ['regional'], label: 'devolved-wsi' }],
  nia:  [{ corpusKeys: ['regional'], label: 'devolved-nia' }],
  nisr: [{ corpusKeys: ['regional'], label: 'devolved-nisr' }],
  nisi: [{ corpusKeys: ['regional'], label: 'devolved-nisi' }],
  // These three already have corpus_targets rows holding nothing; the census row keeps their own
  // key so the email shows one line per collection, not a second orphan line beside it.
  apni: [{ corpusKeys: ['regional'], label: 'apni' }],
  ukcm: [{ corpusKeys: [], label: 'ukcm' }],
  ukci: [{ corpusKeys: [], label: 'ukci' }],
  ukla: [{ corpusKeys: [], label: 'ukla' }],
}

/** The aggregate rows the per-type rows above replace. Left in place they would double-count in
 *  any total and print a flattering blended percentage over collections at 40% and 99%. */
const SUPERSEDED_AGGREGATES = ['regional', 'retained-eu']

type Entry = { docId: string; calendarId: string | null }
type Store = Record<string, Entry[]>

const load = (): Store => { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')) } catch { return {} } }
const save = (s: Store) => { fs.mkdirSync(path.dirname(STORE), { recursive: true }); fs.writeFileSync(STORE, JSON.stringify(s)) }

async function walk() {
  const { listActEntriesYear } = await import('../../sources/tna-legislation')
  const types = (arg('types') ?? Object.keys(TYPE_RANGES).join(',')).split(',').filter(Boolean)
  const store = load()
  let fetched = 0, cached = 0
  const unreadable: string[] = []

  for (const type of types) {
    const range = TYPE_RANGES[type]
    if (!range) { console.warn(`[census] unknown type ${type} — skipped`); continue }
    for (let year = range[0]; year <= range[1]; year++) {
      const key = `${type}/${year}`
      if (key in store) { cached++; continue }
      const entries = await listActEntriesYear(type, year)
      if (entries === null) {
        unreadable.push(key)
        console.warn(`[census] ${key}: throttled — NOT recorded (a 429 is not a zero)`)
        await new Promise(r => setTimeout(r, 5000))
        continue
      }
      store[key] = entries.map(e => ({ docId: e.docId, calendarId: e.calendarId }))
      fetched++
      if (entries.length) console.log(`[census] ${key.padEnd(12)} ${String(entries.length).padStart(6)} entries`)
      if (fetched % 10 === 0) save(store)
    }
    save(store)
    const total = Object.entries(store).filter(([k]) => k.startsWith(`${type}/`))
      .reduce((s, [, v]) => s + v.length, 0)
    console.log(`[census] ${type}: ${total.toLocaleString()} published units across the walked years`)
  }
  save(store)
  console.log(`[census] walk: ${fetched} feeds fetched, ${cached} from checkpoint, ${unreadable.length} unreadable`)
  if (unreadable.length) console.log(`[census] unreadable (re-run to retry): ${unreadable.slice(0, 40).join(', ')}`)
  return unreadable
}

/**
 * Every gid we hold for a corpus key, read ONCE and cached.
 *
 * ⚠ THE OBVIOUS QUERY IS THE SLOW ONE, AND IT IS SLOW BY THREE ORDERS OF MAGNITUDE. The first
 * version asked `split_part(id,':',2) = ANY($2)` with the type's whole published id list — 109,212
 * elements for `uksi` — once per type. `split_part(id,':',2)` is an EXPRESSION with no index, so
 * each call is a sequential scan of an 18M-row table, and there are twenty types. It ran for over
 * ten minutes without producing a single row and was killed.
 *
 * One scan per CORPUS KEY, intersected in memory, is the same answer: five scans instead of twenty,
 * and the id list never crosses the wire. Same shape as [[feedback-one-object-two-readers]] — the
 * query that reads naturally is not the query the planner can serve.
 */
const gidCache = new Map<string, Set<string>>()
async function heldGidsFor(p: any, corpusKeys: string[]): Promise<Set<string>> {
  const key = corpusKeys.join(',')
  const hit = gidCache.get(key)
  if (hit) return hit
  const rows = (await p.query(
    `SELECT DISTINCT split_part(id, ':', 2) gid FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled'`, [corpusKeys])).rows
  const set = new Set<string>(rows.map((r: any) => r.gid))
  gidCache.set(key, set)
  console.log(`   [held] ${key}: ${set.size.toLocaleString()} distinct gids`)
  return set
}

/** Held-side: which of these published ids do we hold at least one compiled section for?
 *  Matches on EITHER id form, because the corpus stores pre-1963 Acts under the regnal form. */
async function heldFor(p: any, corpusKeys: string[], entries: Entry[]) {
  if (corpusKeys.length === 0 || entries.length === 0) return { held: 0, absent: entries.map(e => e.docId) }
  const heldGids = await heldGidsFor(p, corpusKeys)
  const absent: string[] = []
  let held = 0
  for (const e of entries) {
    if (heldGids.has(e.docId) || (e.calendarId && heldGids.has(e.calendarId))) held++
    else absent.push(e.docId)
  }
  return { held, absent }
}

/** Dot-leader instruments: every section is `Article 31 . . . .` — the unit is held and hollow.
 *  section_repeals is the register B2 built; it is a FLOOR (OI-6), so this is reported as one. */
/**
 * Instruments whose EVERY section is a dot leader — held, and hollow.
 *
 * ⚠ ONE QUERY PER CORPUS KEY, GROUPED BY TYPE, CACHED — for the same reason as `heldGidsFor`, and
 * this one was the worse offender. The per-type version ran a whole-corpus GROUP BY with a
 * correlated `IN (SELECT … FROM section_repeals)` once for each of twenty types, and took ~30
 * MINUTES for `primary-acts-pre-2000` alone. A LEFT JOIN counted once per corpus and bucketed by
 * type gives the identical answer in one pass.
 *
 * ⚠ The type prefix is still not decoration: `regional` holds ssi, wsi, nisr, nisi, asp, nia, anaw,
 * asc and mwa together, so an unbucketed count would attribute every devolved dot leader to
 * whichever type happened to be asking.
 */
const hollowCache = new Map<string, Map<string, number>>()
async function hollowFor(p: any, corpusKeys: string[], typePrefix: string) {
  if (corpusKeys.length === 0) return 0
  const key = corpusKeys.join(',')
  let byType = hollowCache.get(key)
  if (!byType) {
    const r = await p.query(
      `SELECT split_part(gid, '/', 1) typ, count(*)::int n FROM (
          SELECT split_part(cs.id, ':', 2) gid
            FROM corpus_sections cs
            LEFT JOIN section_repeals sr ON sr.section_id = cs.id
           WHERE cs.corpus = ANY($1) AND cs.status='compiled'
           GROUP BY 1
          HAVING count(*) = count(sr.section_id)
       ) x GROUP BY 1`, [corpusKeys])
    byType = new Map(r.rows.map((x: any) => [x.typ, x.n]))
    hollowCache.set(key, byType)
    console.log(`   [hollow] ${key}: ${[...byType].map(([t, n]) => `${t}=${n}`).join(' ') || 'none'}`)
  }
  return byType.get(typePrefix) ?? 0
}

async function main() {
  if (SELF_TEST) { await selfTestHeld('legislation'); return }
  let unreadable: string[] = []
  if (!CENSUS_ONLY) unreadable = await walk()

  const store = load()
  const p = pool()
  const walkedAt = fs.existsSync(STORE) ? fs.statSync(STORE).mtime : new Date()
  const rows: CensusRow[] = []

  for (const [type, buckets] of Object.entries(HELD_BY)) {
    for (const b of buckets) {
      const entries: Entry[] = []
      for (const [k, v] of Object.entries(store)) {
        const [t, ys] = k.split('/')
        if (t !== type) continue
        if (b.yearFilter && !b.yearFilter(Number(ys))) continue
        entries.push(...v)
      }
      if (entries.length === 0 && !(type in store)) {
        // nothing walked for this type yet — say so rather than print a zero denominator
        rows.push({ corpus_key: b.label, state: 'UNMEASURED', unit: 'instrument',
          method: `entry walk of legislation.gov.uk/${type}/<year>/data.feed — NOT YET WALKED`,
          held_units: null, published_units: null, hollow_units: 0, absent_ids: [], absent_total: 0,
          notes: 'the walk has not reached this type', walk_artifact_path: null, walked_at: null })
        continue
      }
      process.stdout.write(`  · ${b.label} (${entries.length.toLocaleString()} published) …\n`)
      const { held, absent } = await heldFor(p, b.corpusKeys, entries)
      const hollow = await hollowFor(p, b.corpusKeys, type)
      const unread = unreadable.filter(u => u.startsWith(`${type}/`))
      rows.push({
        corpus_key: b.label,
        state: 'MEASURED',
        unit: 'instrument (an Act, SI, Measure or Order the publisher lists)',
        method: `entry walk of legislation.gov.uk/${type}/<year>/data.feed, both id forms recorded`,
        walked_at: walkedAt,
        published_units: entries.length,
        held_units: held,
        hollow_units: Math.min(hollow, held),
        absent_ids: absent.slice(0, 1000),
        absent_total: absent.length,
        walk_artifact_path: path.relative(path.join(__dirname, '../../../..'), STORE).replace(/\\/g, '/'),
        notes: [
          held === entries.length && entries.length > 0
            ? `EXACT: the denominator is legislation.gov.uk's own entry walk and the numerator is a lookup of those ids against corpus_sections; the same comparison reports gaps for every other type.`
            : null,
          b.corpusKeys.length === 0 ? 'HELD = 0: no collection exists for this type yet.' : null,
          // ⚠ The caveat travels with the row, not in a report nobody re-reads.
          type === 'eur' || type === 'eudn' || type === 'eudr'
            ? '⚠ UNIVERSE CAVEAT: legislation.gov.uk publishes the EU instruments it holds for the UK; ' +
              'our collection is scoped to ASSIMILATED (formerly retained) EU law, which is a SUBSET — an ' +
              'instrument that never applied here, or lapsed before exit day, is published and correctly ' +
              'not held. Read this as a FLOOR on coverage of a larger universe, not as a measure of what ' +
              'is missing. Settling it needs one comparison against the assimilated-law list; nobody has ' +
              'done it (decision B-6).'
            : null,
          `matched on either id form (regnal and calendar).`,
          hollow > 0 ? `hollow = instruments whose every section is a dot leader; a FLOOR, section_repeals does not hold them all (OI-6).` : null,
          unread.length ? `⚠ ${unread.length} feed(s) unreadable at walk time and NOT counted: ${unread.slice(0, 10).join(', ')} — published_units is a floor.` : null,
        ].filter(Boolean).join(' '),
      })
    }
  }

  await writeCensus(p, rows, 'legislation')

  // Retire the blended aggregates the per-type rows replace, so nothing double-counts.
  const del = await p.query(
    `DELETE FROM corpus_census WHERE corpus_key = ANY($1) RETURNING corpus_key`, [SUPERSEDED_AGGREGATES])
  if (del.rowCount) {
    console.log(`\n  removed ${del.rowCount} aggregate census row(s) now covered per type: ` +
      del.rows.map((r: any) => r.corpus_key).join(', '))
  }
  await p.end()
}

main().catch(e => { console.error('FAIL', e.message, e.stack); process.exit(1) })
