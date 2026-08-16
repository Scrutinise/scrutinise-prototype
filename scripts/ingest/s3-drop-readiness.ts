/**
 * s3-drop-readiness.ts — is the `LegislationSection` DROP unblocked?
 *
 * The block has stood since June for one reason: the legacy table was the only copy
 * of ~77,000 sections. V36 recovered 73,467, and §1.4 measured the SOURCE as richer
 * than the legacy copy in 11 of 25 sampled instruments and poorer in none. So the
 * corpus may now be a genuine superset — but "may" is not a basis for dropping 1.73 GB.
 *
 * THE TEST, per instrument rather than in aggregate: does `corpus_sections` now hold
 * at least as many sections as `LegislationSection`? An aggregate total can be a
 * superset while individual instruments are still short, and it is the per-instrument
 * answer that decides whether anything becomes unreachable on the drop.
 *
 * ⚠ THE REGNAL ALIAS, which would otherwise manufacture false gaps. V36 §1: pre-1963
 * Acts are cited by REGNAL session and the source's canonical id follows
 * (`ukpga/Geo5/15-16/20`) while `LegislationItem` carries the CALENDAR id. A naive
 * join reports those instruments as absent from the corpus when they are present under
 * another name — the same 1,227-false-gap class V37 found. They are counted and
 * reported SEPARATELY here rather than silently swelling the blocking set.
 *
 * ⚠ AND THE DOT LEADERS. 11.44% of the corpus is repealed-provision placeholders, and
 * the legacy table has its own. Counting raw rows on both sides is the CONSERVATIVE
 * comparison Charlie asked for — "at least as many" — so no attempt is made here to
 * net them out. If a corpus instrument is short only because the legacy copy counts
 * dot leaders the corpus retracted, that shows up as a gap and is reported as one; it
 * is better to investigate a false blocker than to drop on a flattering number.
 *
 * Read-only. Writes nothing, drops nothing.
 *
 * Usage: tsx s3-drop-readiness.ts [--sample 20]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import fs from 'fs'
import { getNeonPool, endNeonPool } from './shared/neon-pool'

// The SAME alias map V37 uses, built from legislation.gov.uk's own year feeds.
// ⚠ A first pass here classified the alias set by asking whether the *LegislationItem*
// id looks regnal. It never does — `LegislationItem` carries the CALENDAR id BY DESIGN,
// which is the entire V36 §1 finding — so the test returned 0 aliases and reported
// 1,618 pre-1963 Acts as real absences. Resolve identity against the map, not a guess
// at the string's shape.
const ALIAS_PATH = path.join(__dirname, 'v36', 'source-entries.json')

function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>()
  if (!fs.existsSync(ALIAS_PATH)) {
    console.warn(`⚠ no alias map at ${ALIAS_PATH} — regnal/calendar false gaps will NOT be resolved`)
    return map
  }
  const store: Record<string, { docId: string; calendarId: string | null }[]> = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'))
  for (const entries of Object.values(store)) {
    for (const e of entries) {
      if (e.calendarId && e.calendarId !== e.docId) {
        map.set(e.calendarId, e.docId)
        map.set(e.docId, e.calendarId)
      }
    }
  }
  return map
}

const SAMPLE = (() => { const i = process.argv.indexOf('--sample'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 20 })()
const n = (v: any) => Number(v).toLocaleString('en-GB')

async function main() {
  const pool = getNeonPool()

  // Per-instrument legacy vs corpus counts. The corpus instrument is the middle
  // segment of the section id: `primary-acts-2000plus:ukpga/2006/46:section-1`.
  const { rows } = await pool.query(`
    WITH legacy AS (
      SELECT li."legislationGovUkId" AS gid, count(*)::int AS legacy_sections
        FROM "LegislationSection" ls
        JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
       GROUP BY 1
    ), corpus AS (
      SELECT split_part(id, ':', 2) AS gid, count(*)::int AS corpus_sections
        FROM corpus_sections
       GROUP BY 1
    )
    SELECT l.gid, l.legacy_sections, COALESCE(c.corpus_sections, 0) AS corpus_sections
      FROM legacy l LEFT JOIN corpus c ON c.gid = l.gid
     ORDER BY (COALESCE(c.corpus_sections, 0) - l.legacy_sections) ASC, l.legacy_sections DESC`)

  // Fold the alias twin's corpus count into each legacy instrument before judging it.
  const alias = buildAliasMap()
  console.log(`alias map: ${n(alias.size / 2)} regnal/calendar pairs`)
  const { rows: corpusRows } = await pool.query(
    `SELECT split_part(id, ':', 2) AS gid, count(*)::int AS c FROM corpus_sections GROUP BY 1`)
  const corpusBy = new Map<string, number>()
  for (const r of corpusRows) corpusBy.set(r.gid, Number(r.c))

  for (const r of rows as any[]) {
    const twin = alias.get(r.gid)
    r.twin = twin ?? null
    r.twin_sections = twin ? (corpusBy.get(twin) ?? 0) : 0
    // The document is one document; either identity holding it counts.
    r.effective = Math.max(Number(r.corpus_sections), Number(r.twin_sections))
  }

  const covered = rows.filter((r: any) => r.effective >= r.legacy_sections)
  const short   = rows.filter((r: any) => r.effective > 0 && r.effective < r.legacy_sections)
  const absent  = rows.filter((r: any) => r.effective === 0)
  const rescued = rows.filter((r: any) => r.twin_sections > Number(r.corpus_sections))
  console.log(`instruments whose count improves via the alias twin: ${n(rescued.length)}`)

  const legacyTotal = rows.reduce((a: number, r: any) => a + r.legacy_sections, 0)
  console.log(`LegislationSection instruments with text: ${n(rows.length)}  (${n(legacyTotal)} sections)`)
  console.log(`\n  ✅ corpus >= legacy : ${n(covered.length)}`)
  console.log(`  ⚠ corpus SHORT     : ${n(short.length)}   (${n(short.reduce((a: number, r: any) => a + (r.legacy_sections - r.corpus_sections), 0))} sections behind)`)
  console.log(`  ⚠ corpus ABSENT    : ${n(absent.length)}   (${n(absent.reduce((a: number, r: any) => a + r.legacy_sections, 0))} sections)`)

  // Split the absent set by whether the id is REGNAL — those are the alias class and
  // are very likely present in the corpus under the source's canonical id.
  // An absent instrument that HAS a known twin has been checked under both identities
  // and is still absent — a real absence. One with NO twin in the map is unjudged:
  // the map only covers what the V36 source walk enumerated.
  const absentWithTwin = absent.filter((r: any) => r.twin)
  const absentNoTwin   = absent.filter((r: any) => !r.twin)
  console.log(`\n  of the ABSENT: ${n(absentWithTwin.length)} were checked under BOTH identities and are still absent (REAL)`)
  console.log(`                 ${n(absentNoTwin.length)} have no twin in the alias map — unjudged, not proven absent`)
  const absentModern = absent

  console.log(`\n  worst shortfalls (EFFECTIVE corpus count, i.e. best of the two identities):`)
  for (const r of short.slice(0, SAMPLE)) {
    const via = r.twin_sections > Number(r.corpus_sections) ? ` via twin ${r.twin}` : ''
    console.log(`    ${String(r.gid).padEnd(30)} legacy ${String(r.legacy_sections).padStart(6)}  corpus ${String(r.effective).padStart(6)}  short ${r.legacy_sections - r.effective}${via}`)
  }
  console.log(`\n  absent with a MODERN id (these block the drop):`)
  for (const r of absentModern.slice(0, SAMPLE)) {
    console.log(`    ${String(r.gid).padEnd(30)} legacy ${String(r.legacy_sections).padStart(6)}  corpus 0`)
  }

  const blocking = short.length + absentModern.length
  console.log(`\n════ VERDICT ════`)
  if (blocking === 0 && absentRegnal.length === 0) {
    console.log(`  DROP IS UNBLOCKED on this test: every legacy instrument is matched or exceeded in the corpus.`)
  } else {
    console.log(`  DROP IS NOT UNBLOCKED BY THIS TEST ALONE.`)
    console.log(`  ${n(blocking)} instruments are short or genuinely absent; ${n(absentRegnal.length)} more need the regnal alias resolved before they can be judged.`)
    console.log(`  Resolving the regnal set is a mapping exercise, not an ingest one — the text may already be held.`)
  }

  await endNeonPool()
}

main().catch((e) => { console.error(e); process.exit(1) })
