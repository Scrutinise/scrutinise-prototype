/**
 * audit-4b-schedules.ts — GRAPH 4B §2.2. THE GATE.
 *
 * ⚠ The brief: "Confirm statutory instrument schedules are ingested before
 * building. Extractors commonly drop them, and §3 depends entirely on them. If
 * they are absent, STOP AND REPORT — that is an ingest sprint, not something to
 * work around here."
 *
 * ⚠⚠ TWO SIDES, BECAUSE ONE SIDE IS NOT A CONFIRMATION. A count of schedule
 * rows in `corpus_sections` says the ingest kept them. It says nothing about
 * the 1.4 GB bulk CLML the enabling extractor actually reads. §3's question —
 * do we hold the treaty scheduled to a double taxation Order — is answerable
 * only if BOTH are true, and 4A already found the case where the corpus row
 * exists and the agreement does not.
 *
 * Reads only. Exit 3 if either side is empty, so a caller cannot proceed.
 *
 *   npx tsx graph/audit-4b-schedules.ts [--json <path>] [--zip-sample N]
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { ZipReader } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'


/** ⚠ A dedicated pool, not the shared one. Two of the queries below scan every
 *  SI row in `corpus_sections` (776k) and the shared pool's 60s client-side
 *  `query_timeout` kills them mid-scan — which reads as a database problem
 *  rather than as a query that needs longer. Same pattern as v37's census. */
function slowPool(): Pool {
  return new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })
}


const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const SI_CORPORA = ['si-2010plus', 'si-pre-2010']
const SI_TYPES = new Set(['uksi', 'ssi', 'nisr', 'wsi', 'nisro', 'uksro', 'nisi'])

export type ScheduleAudit = {
  measuredAt: string
  corpus: {
    byCorpus: Array<{ corpus: string; sections: number; schedules: number; docsWithSchedule: number }>
    totalSchedules: number
  }
  clml: {
    sampled: number
    withScheduleElement: number
    scheduleElements: number
    medianScheduleChars: number
    pct: number
  }
  /** ⚠⚠ The comparison that matters: the SAME documents, both sides. A corpus
   *  ratio set against a zip ratio is two different denominators and would hide
   *  a systematic drop. */
  matched: {
    sampledInCorpus: number
    clmlHasScheduleCorpusHas: number
    clmlHasScheduleCorpusLacks: number
    clmlLacksCorpusHas: number
    neither: number
    /** share of schedule-bearing documents whose schedule reached the corpus */
    retentionPct: number
  }
  dta: {
    orders: number
    withScheduleSection: number
    withoutScheduleSection: number
    pctHeld: number
  }
  verdict: 'INGESTED' | 'ABSENT'
}

async function main() {
  const pool = slowPool()

  // ── side 1: the corpus ──────────────────────────────────────────────────────
  const { rows: byCorpus } = await pool.query(`
    SELECT corpus,
           COUNT(*)::bigint sections,
           COUNT(*) FILTER (WHERE id ~ ':schedule')::bigint schedules,
           COUNT(DISTINCT split_part(id, ':', 2)) FILTER (WHERE id ~ ':schedule')::bigint docs_with_schedule
    FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1 ORDER BY 1`, [SI_CORPORA])
  const corpusRows = byCorpus.map((r: Record<string, string>) => ({
    corpus: r.corpus, sections: Number(r.sections),
    schedules: Number(r.schedules), docsWithSchedule: Number(r.docs_with_schedule),
  }))
  const totalSchedules = corpusRows.reduce((a: number, r: { schedules: number }) => a + r.schedules, 0)

  // ── side 2: the bytes the extractor will read ───────────────────────────────
  const sampleIx = process.argv.indexOf('--zip-sample')
  const sampleN = sampleIx >= 0 ? parseInt(process.argv[sampleIx + 1] ?? '400', 10) : 400
  let sampled = 0, withScheduleElement = 0, scheduleElements = 0
  const lengths: number[] = []
  /** gid → does the CLML carry a <Schedule>? Kept so the two sides can be
   *  compared on the SAME documents. */
  const clmlSchedule = new Map<string, boolean>()
  if (fs.existsSync(ZIP_PATH)) {
    const zip = new ZipReader(ZIP_PATH)
    const entries = zip.entries
      .map(e => ({ e, m: e.name.match(ENTRY_RX) }))
      .filter((x): x is { e: typeof zip.entries[0]; m: RegExpMatchArray } => x.m != null && SI_TYPES.has(x.m[1]))
    // ⚠ A STRIDE across the whole list, never "the first N". These ids sort
    // chronologically, so a first-N sample of this corpus is one year of it —
    // the trap that made a 400-row pilot say 76.1% where the corpus says 26.9%.
    const step = Math.max(1, Math.floor(entries.length / sampleN))
    for (let i = 0; i < entries.length && sampled < sampleN; i += step) {
      const xml = zip.readText(entries[i].e)
      sampled++
      const schedules = [...xml.matchAll(/<Schedule\b[\s\S]*?<\/Schedule>/g)]
      clmlSchedule.set(gidFromEntry(entries[i].m), schedules.length > 0)
      if (schedules.length > 0) {
        withScheduleElement++
        scheduleElements += schedules.length
        for (const s of schedules) lengths.push(s[0].length)
      }
    }
    zip.close()
  }
  lengths.sort((a, b) => a - b)
  const medianScheduleChars = lengths.length === 0 ? 0 : lengths[Math.floor(lengths.length / 2)]

  // ── the matched comparison, same documents both sides ───────────────────────
  // ⚠ Pull the two SI gid sets whole and match in memory. The obvious query —
  // `WHERE split_part(id, ':', 2) = ANY($1)` — cannot use the id index and
  // timed out on the first run: a function on the indexed column throws the
  // plan away and scans 776k rows per lookup.
  const { rows: allSi } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) gid FROM corpus_sections WHERE corpus = ANY($1::text[])`, [SI_CORPORA])
  const { rows: schedSi } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) gid FROM corpus_sections WHERE corpus = ANY($1::text[]) AND id ~ ':schedule'`, [SI_CORPORA])
  const ingested = new Set<string>(allSi.map((r: { gid: string }) => r.gid))
  const withSchedule = new Set<string>(schedSi.map((r: { gid: string }) => r.gid))
  const corpusHas = new Map<string, boolean>(
    [...ingested].map(gid => [gid, withSchedule.has(gid)]))
  let bothHave = 0, clmlOnly = 0, corpusOnly = 0, neither = 0, inCorpus = 0
  for (const [gid, hasClml] of clmlSchedule) {
    if (!corpusHas.has(gid)) continue          // not ingested at all — a different question
    inCorpus++
    const hasCorpus = corpusHas.get(gid)!
    if (hasClml && hasCorpus) bothHave++
    else if (hasClml && !hasCorpus) clmlOnly++
    else if (!hasClml && hasCorpus) corpusOnly++
    else neither++
  }

  // ── §3's dependant: the double taxation Orders ──────────────────────────────
  // ⚠ `ILIKE 'double taxation%'` returns ZERO — every title begins "The ". The
  // first version of this query did exactly that and read as an honest absence.
  const { rows: dtaRows } = await pool.query(
    `SELECT gid FROM corpus_acts WHERE title ILIKE '%double taxation%' AND leg_type = 'uksi'`)
  const dtaGids = dtaRows.map((r: { gid: string }) => r.gid)
  const dtaOrders = dtaGids.length
  const dtaWith = dtaGids.filter((g: string) => withSchedule.has(g)).length

  const out: ScheduleAudit = {
    measuredAt: new Date().toISOString(),
    corpus: { byCorpus: corpusRows, totalSchedules },
    clml: {
      sampled, withScheduleElement, scheduleElements, medianScheduleChars,
      pct: sampled === 0 ? 0 : 100 * withScheduleElement / sampled,
    },
    matched: {
      sampledInCorpus: inCorpus,
      clmlHasScheduleCorpusHas: bothHave,
      clmlHasScheduleCorpusLacks: clmlOnly,
      clmlLacksCorpusHas: corpusOnly,
      neither,
      retentionPct: bothHave + clmlOnly === 0 ? 0 : 100 * bothHave / (bothHave + clmlOnly),
    },
    dta: {
      orders: dtaOrders, withScheduleSection: dtaWith,
      withoutScheduleSection: dtaOrders - dtaWith,
      pctHeld: dtaOrders === 0 ? 0 : 100 * dtaWith / dtaOrders,
    },
    verdict: totalSchedules > 0 && withScheduleElement > 0 ? 'INGESTED' : 'ABSENT',
  }

  console.log('\n══ §2.2 SIDE 1 — SCHEDULES IN THE CORPUS ══')
  for (const r of corpusRows) {
    console.log(`  ${r.corpus.padEnd(14)} ${r.sections.toLocaleString().padStart(9)} sections · ${r.schedules.toLocaleString().padStart(8)} schedule sections over ${r.docsWithSchedule.toLocaleString()} instruments`)
  }
  console.log('\n══ §2.2 SIDE 2 — SCHEDULES IN THE BULK CLML THE EXTRACTOR READS ══')
  console.log(`  ${withScheduleElement.toLocaleString()} of ${sampled.toLocaleString()} sampled SI documents carry a <Schedule> element (${out.clml.pct.toFixed(1)}%)`)
  console.log(`  ${scheduleElements.toLocaleString()} schedule elements · median ${medianScheduleChars.toLocaleString()} characters`)
  console.log('\n══ §2.2 THE MATCHED COMPARISON — SAME DOCUMENTS, BOTH SIDES ══')
  console.log(`  ${inCorpus.toLocaleString()} of the sampled documents are in the corpus at all`)
  console.log(`    CLML has a schedule, corpus has one   : ${bothHave.toLocaleString()}`)
  console.log(`    CLML has a schedule, corpus has NONE  : ${clmlOnly.toLocaleString()}  ⚠ the drop`)
  console.log(`    CLML has none, corpus has one         : ${corpusOnly.toLocaleString()}`)
  console.log(`    neither                               : ${neither.toLocaleString()}`)
  console.log(`  schedule retention: ${out.matched.retentionPct.toFixed(1)}% of schedule-bearing instruments kept their schedule`)

  console.log('\n══ §3 DEPENDANT — DOUBLE TAXATION ORDERS ══')
  console.log(`  ${dtaOrders} Orders · ${dtaWith} hold a schedule section (${out.dta.pctHeld.toFixed(1)}%) · ${out.dta.withoutScheduleSection} do not`)
  console.log(`\n  VERDICT: schedules are ${out.verdict}`)
  if (out.verdict === 'ABSENT') {
    console.log('  ⚠⚠ STOP. §2.2 says this is an ingest sprint, not something to work around here.')
  }

  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`[audit-4b-schedules] wrote ${process.argv[jsonIx + 1]}`)
  }
  await pool.end()
  process.exit(out.verdict === 'INGESTED' ? 0 : 3)
}

main().catch(e => { console.error('[audit-4b-schedules] FATAL', e); process.exit(1) })
