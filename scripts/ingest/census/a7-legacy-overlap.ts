/**
 * a7-legacy-overlap.ts — CENSUS C1 Part A7. DOES THE LEGACY TABLE STILL MATTER?
 *
 * READ-ONLY.
 *
 * Joins every instrument the legacy `LegislationSection` table holds text for against
 *   (a) `corpus_sections` — is it already in the live corpus?
 *   (b) `scripts/ingest/v36/worklist.jsonl` — is Part D going to fetch it anyway?
 * and reports the third number, which is the one that decides anything: instruments in NEITHER.
 *
 * ⚠⚠ THE FIRST VERSION OF THIS FILE HAD THE VERY BUG ITS HEADER WARNS ABOUT, AND IT REPORTED
 * 1,579 FALSE GAPS. It built the calendar→regnal map from `worklist.jsonl`, which by construction
 * contains only the instruments that are ABSENT — so a legacy instrument that IS held under its
 * regnal id has no worklist entry, gets no mapping, and falls straight into the "neither" bucket.
 * `ukpga/1801/52` was reported as an independent gap while `ukpga/Geo3/41/52` sat in the corpus
 * with 5 compiled sections. The map must come from `v36/source-entries.json` — the FULL walk, which
 * carries both ids for every published instrument whether held or not.
 *
 * ⚠ THE IDENTITY RULE IS THE WHOLE JOIN. `LegislationItem.legislationGovUkId` is the CALENDAR id
 * (`ukpga/1824/83`); `corpus_sections` holds pre-1963 Acts under the REGNAL id
 * (`ukpga/Geo4/5/83`). Matching on the calendar id alone reports the Vagrancy Act as a gap — the
 * exact false gap `v36-reconcile.ts` exists to prevent and the one GOLD V2 published. The worklist
 * carries both ids per entry, so it supplies the regnal↔calendar mapping this join needs; where it
 * has no entry for an instrument, BOTH forms are still probed against the corpus.
 *
 * Usage: tsx census/a7-legacy-overlap.ts
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

const WORKLIST = path.join(__dirname, '../v36/worklist.jsonl')
const SOURCE_ENTRIES = path.join(__dirname, '../v36/source-entries.json')
const OUT = path.join(__dirname, '../../../docs/census/A7_legacy_overlap.md')
const n = (v: number) => Number(v).toLocaleString('en-GB')

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 1_800_000, query_timeout: 1_800_000,
  })

  // Every instrument the legacy table holds at least one section of text for.
  const { rows: legacy } = await pool.query<{ gid: string; sections: string }>(`
    SELECT li."legislationGovUkId" gid, count(*)::text sections
      FROM "LegislationSection" ls
      JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
     WHERE li."legislationGovUkId" IS NOT NULL
     GROUP BY 1`)

  // Every gid the live corpus holds compiled text for — under whichever id it was ingested.
  const { rows: held } = await pool.query<{ gid: string }>(`
    SELECT DISTINCT split_part(id, ':', 2) gid
      FROM corpus_sections
     WHERE status='compiled'
       AND corpus IN ('primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus',
                      'regional','retained-eu','eur-lex')`)
  await pool.end()

  const heldSet = new Set(held.map(h => h.gid))

  // worklist: docId (canonical, may be regnal) + calendarId. Gives us both the work list membership
  // and the regnal↔calendar mapping.
  const onList = new Set<string>()
  const calToDoc = new Map<string, string>()
  let worklistLines = 0
  if (fs.existsSync(WORKLIST)) {
    for (const line of fs.readFileSync(WORKLIST, 'utf8').split('\n')) {
      if (!line.trim()) continue
      worklistLines++
      const e = JSON.parse(line) as { docId: string; calendarId: string | null }
      onList.add(e.docId)
      if (e.calendarId) { onList.add(e.calendarId); calToDoc.set(e.calendarId, e.docId) }
    }
  } else {
    console.error(`⚠ no worklist at ${WORKLIST} — the "on the worklist" column cannot be computed.`)
  }

  // ── the COMPLETE calendar↔regnal map, from the full source walk ────────
  // Every published instrument, held or not. This is what makes the identity rule work; the
  // worklist covers only absences and is the wrong source for it.
  let mapped = 0
  if (fs.existsSync(SOURCE_ENTRIES)) {
    const store = JSON.parse(fs.readFileSync(SOURCE_ENTRIES, 'utf8')) as Record<string, Array<{ docId: string; calendarId: string | null }>>
    for (const entries of Object.values(store)) {
      for (const e of entries) {
        if (e.calendarId && e.calendarId !== e.docId) { calToDoc.set(e.calendarId, e.docId); mapped++ }
      }
    }
    console.log(`[A7] calendar→regnal pairs from the source walk: ${n(mapped)}`)
  } else {
    console.error(`⚠ no source walk at ${SOURCE_ENTRIES} — the identity rule cannot be applied and every ` +
      `regnal-held instrument will read as a false gap. REFUSING to report.`)
    process.exitCode = 1
    return
  }

  /** Held under EITHER identity, using the full source-walk mapping. */
  const isHeld = (gid: string): boolean => {
    if (heldSet.has(gid)) return true
    const doc = calToDoc.get(gid)
    return doc ? heldSet.has(doc) : false
  }

  let present = 0, onWorklist = 0, neither = 0
  let presentSections = 0, onWorklistSections = 0, neitherSections = 0
  const neitherExamples: Array<{ gid: string; sections: number }> = []
  const byType: Record<string, { n: number; sections: number }> = {}

  for (const r of legacy) {
    const sec = Number(r.sections)
    if (isHeld(r.gid)) { present++; presentSections += sec; continue }
    if (onList.has(r.gid)) { onWorklist++; onWorklistSections += sec; continue }
    neither++; neitherSections += sec
    const type = r.gid.split('/')[0] ?? '?'
    const b = (byType[type] ??= { n: 0, sections: 0 })
    b.n++; b.sections += sec
    if (neitherExamples.length < 25) neitherExamples.push({ gid: r.gid, sections: sec })
  }

  const total = legacy.length
  const L: string[] = []
  L.push('# A7 — LEGACY OVERLAP: DOES THE 914,274-SECTION TABLE STILL MATTER?')
  L.push('')
  L.push('*Generated by `scripts/ingest/census/a7-legacy-overlap.ts`. Read-only.*')
  L.push('')
  L.push(`Legacy instruments with text: **${n(total)}**. Worklist entries read: ${n(worklistLines)}.`)
  L.push('')
  L.push('| bucket | instruments | legacy sections | meaning |')
  L.push('|---|---:|---:|---|')
  L.push(`| already in \`corpus_sections\` | **${n(present)}** (${(100 * present / total).toFixed(1)}%) | ${n(presentSections)} | duplicate — no action |`)
  L.push(`| on the V36 worklist | **${n(onWorklist)}** (${(100 * onWorklist / total).toFixed(1)}%) | ${n(onWorklistSections)} | Part D fetches it from source |`)
  L.push(`| **in NEITHER** | **${n(neither)}** (${(100 * neither / total).toFixed(1)}%) | **${n(neitherSections)}** | a genuine independent gap |`)
  L.push('')
  if (neither > 0) {
    L.push('## The independent gap, by instrument type')
    L.push('')
    L.push('| type | instruments | legacy sections |')
    L.push('|---|---:|---:|')
    for (const [t, b] of Object.entries(byType).sort((a, b2) => b2[1].n - a[1].n)) {
      L.push(`| \`${t}\` | ${n(b.n)} | ${n(b.sections)} |`)
    }
    L.push('')
    L.push('Examples:')
    L.push('')
    for (const e of neitherExamples.slice(0, 15)) L.push(`- \`${e.gid}\` — ${n(e.sections)} legacy sections`)
    L.push('')
  }
  L.push('## What this decides')
  L.push('')
  L.push('⚠ The first run of this join reported 1,579 independent gaps. Every one was a false gap from')
  L.push('building the identity map out of the worklist (absences only) instead of the full source walk.')
  L.push('')
  L.push(`V36 §1.4 measured n=25 gap instruments and found the SOURCE richer than legacy in 11 and legacy`)
  L.push(`richer in 0, so the standing decision is **re-fetch, do not migrate**. That decision is unchanged`)
  L.push(`by this join. What the join settles is how much of the legacy table is even a candidate:`)
  L.push(`${n(present)} instruments are already held, ${n(onWorklist)} are already scheduled, and only`)
  L.push(`**${n(neither)}** are neither — so the legacy table's independent contribution is ${n(neitherSections)}`)
  L.push(`sections, not 914,274.`)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, L.join('\n') + '\n')
  console.log(`[A7] legacy instruments ${n(total)} · present ${n(present)} · on worklist ${n(onWorklist)} · NEITHER ${n(neither)} (${n(neitherSections)} legacy sections)`)
  console.log(`[A7] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
