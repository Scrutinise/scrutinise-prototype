/**
 * v34-seed-impact-assessments.ts — §B of BRIEF_INGEST_POLITICAL_SOURCES.
 *
 *   --measure   the universe, per year, reconciled against each feed's own
 *               openSearch:totalResults. Writes nothing. Records the gap years
 *               explicitly rather than reporting a single flattering total.
 *   --pilot     fetch + extract + section a handful of real IAs spread across
 *               the whole range, and print what would be stored. Writes nothing.
 *   --seed      enumerate every year, bulk-insert one queue row per IA carrying
 *               the feed metadata, upsert corpus_targets.
 *   --verify    attempted-vs-stored reconciliation after a run.
 *
 * sourceType 'impact-assessments', corpus 'impact-assessments'. NEW sourceType
 * ⇒ seed POST-PUSH (INGEST_PLAYBOOK §8).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { pdfToText } from './shared/compile'
import {
  UKIA_YEARS, listUkiaYear, ukiaYearTotal, sectionImpactAssessment, type ImpactAssessment,
} from './sources/impact-assessments'

const SOURCE = 'impact-assessments'
const CORPUS = 'impact-assessments'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

function docId(ia: ImpactAssessment): string {
  // Feed metadata travels on the queue row — the year feed gives 20 items per
  // request, so re-deriving it per row would multiply the walk by 20×.
  return ['ukia', ia.year, ia.number, ia.pdfUrl, ia.instrumentId ?? '', ia.stage ?? '', ia.department ?? '', ia.date ?? ''].join('|')
}

async function measure() {
  console.log('Universe of impact assessments on legislation.gov.uk, year by year.\n')
  let total = 0
  const held: number[] = []
  for (const y of UKIA_YEARS) {
    const t = await ukiaYearTotal(y)
    const items = await listUkiaYear(y)
    const withInstrument = items.filter(i => i.instrumentId).length
    const ok = items.length === t
    console.log(`  ${y}: feed says ${String(t).padStart(4)}, walked ${String(items.length).padStart(4)} ${ok ? '✓' : '✗ MISMATCH'}   with an instrument link: ${withInstrument}/${items.length}`)
    total += items.length
    if (items.length) held.push(y)
    await new Promise(r => setTimeout(r, 300))
  }
  console.log(`\n  TOTAL: ${total} impact assessments across ${held.length} years`)
  console.log('\n  ⚠ KNOWN GAPS, stated rather than smoothed over:')
  console.log('    2008–2016 and 2024–2025 have NO deposits on legislation.gov.uk.')
  console.log('    That is a fact about this source, NOT a claim that no impact')
  console.log('    assessments were published in those years. gov.uk holds 1,932')
  console.log('    documents typed `impact_assessment` and is the second route;')
  console.log('    the overlap between the two has not been measured yet.')
}

async function pilot() {
  const picks: Array<[number, number]> = [[2007, 1], [2019, 1], [2023, 1], [2026, 1]]
  for (const [year, n] of picks) {
    const items = (await listUkiaYear(year)).slice(0, n)
    for (const ia of items) {
      console.log(`\n════ ${ia.ukiaId} — "${ia.title.slice(0, 80)}"`)
      console.log(`  dept="${ia.department}" stage="${ia.stage}" date=${ia.date} instrument=${ia.instrumentId ?? 'NONE'}`)
      const res = await fetch(ia.pdfUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120_000) })
      if (!res.ok) { console.log(`  PDF ${res.status} — FETCH FAILED`); continue }
      const buf = Buffer.from(await res.arrayBuffer())
      const text = await pdfToText(buf, ia.pdfUrl)
      const secs = sectionImpactAssessment(text ?? '')
      console.log(`  pdf ${buf.length}B → ${text?.length ?? 0} chars → ${secs.length} sections`)
      if (!secs.length) { console.log(`  ⚠ would be stored as availability_status='pdf-only' (scanned — a reported gap, not a drop)`); continue }
      const lens = secs.map(s => s.text.length)
      console.log(`  section sizes: min=${Math.min(...lens)} max=${Math.max(...lens)} mean=${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)}`)
      for (const s of secs.slice(0, 6)) console.log(`    ${String(s.n).padStart(2)}. ${s.title.padEnd(34)} ${String(s.text.length).padStart(6)} chars  | ${s.text.replace(/\s+/g, ' ').slice(0, 70)}`)
      if (secs.length > 6) console.log(`    … and ${secs.length - 6} more`)
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

async function seed() {
  const pool = getNeonPool()
  const all: ImpactAssessment[] = []
  for (const y of UKIA_YEARS) {
    const t = await ukiaYearTotal(y)
    const items = await listUkiaYear(y)
    if (items.length !== t) throw new Error(`ukia ${y}: walked ${items.length} of ${t} — refusing to seed a partial year`)
    all.push(...items)
    console.log(`  ${y}: ${items.length}`)
    await new Promise(r => setTimeout(r, 300))
  }
  const rows = all.map(ia => ({
    id: `${CORPUS}:${ia.year}-${ia.number}`,
    corpus: CORPUS,
    docId: docId(ia),
    sourceType: SOURCE,
    priority: 3,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`\n${rows.length} impact assessments → ${affected} new queue rows`)

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, notes, updated_at)
    VALUES ($1, $2, $3, false, $4, NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET
      display_label = $2, est_sections = $3, est_is_confirmed = false, blocked = false, blocked_reason = NULL,
      notes = $4, updated_at = NOW()
  `, [CORPUS, 'Impact assessments (legislation.gov.uk)', all.length * 8,
      'V34 §B: legislation.gov.uk /ukia/ bulk feed, PDF-sectioned on the IA proforma. ' +
      'est_sections is documents × ~8 sections and is NOT confirmed — score it after the drain. ' +
      '⚠ KNOWN GAPS 2008-2016 and 2024-2025: no deposits on this source for those years. OGL v3.0.'])
  console.log('corpus_targets upserted (est_is_confirmed=false — a per-document count is not a section count)')
}

async function verify() {
  const pool = getNeonPool()
  const q = await pool.query(`SELECT status, COUNT(*)::int n FROM ingest_queue WHERE corpus=$1 GROUP BY status`, [CORPUS])
  const s = await pool.query(`
    SELECT COUNT(*)::int AS sections, COUNT(DISTINCT "parentDocId")::int AS instruments,
           COUNT(*) FILTER (WHERE availability_status = 'pdf-only') AS scanned,
           SUM("wordCount")::bigint AS words
    FROM corpus_sections WHERE corpus=$1`, [CORPUS])
  console.log(`queue           : ${q.rows.map(r => `${r.status}=${r.n}`).join(' ') || '(none)'}`)
  console.log(`corpus_sections : ${JSON.stringify(s.rows[0])}`)
  console.log(`⚠ 'scanned' is a REPORTED absence, not a failure — surface it, never drop it.`)
}

async function main() {
  const mode = process.argv.find(a => ['--measure', '--pilot', '--seed', '--verify'].includes(a)) ?? '--measure'
  if (mode === '--measure') await measure()
  else if (mode === '--pilot') await pilot()
  else if (mode === '--verify') await verify()
  else await seed()
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
