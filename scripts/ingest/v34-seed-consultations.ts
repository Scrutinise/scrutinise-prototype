/**
 * v34-seed-consultations.ts — §C of BRIEF_INGEST_POLITICAL_SOURCES.
 *
 *   --measure   per-type counts and a reconciled enumeration. Writes nothing.
 *   --pilot     fetch a handful end-to-end across all three types and print
 *               what would be stored, including the attachment classification.
 *               Writes nothing.
 *   --seed      enumerate all three types, bulk-insert one queue row each.
 *   --verify    attempted-vs-stored reconciliation after a run.
 *
 * sourceType 'consultations', corpus 'consultations'. NEW sourceType ⇒ seed
 * POST-PUSH (INGEST_PLAYBOOK §8).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import {
  CONSULTATION_TYPES, countType, listConsultations, fetchConsultation,
  compileConsultationText, type ConsultationType, type ConsultationListEntry,
} from './sources/consultations'

const SOURCE = 'consultations'
const CORPUS = 'consultations'

async function enumerateAll(): Promise<{ entries: ConsultationListEntry[]; expected: Record<string, number>; complete: boolean }> {
  const entries: ConsultationListEntry[] = []
  const expected: Record<string, number> = {}
  let complete = true
  for (const type of CONSULTATION_TYPES) {
    expected[type] = await countType(type)
    const before = entries.length
    const seen = new Set<string>()
    for await (const page of listConsultations(type)) {
      for (const e of page) if (!seen.has(e.link)) { seen.add(e.link); entries.push(e) }
      process.stdout.write(`  ${type}: ${entries.length - before}/${expected[type]}\r`)
    }
    const got = entries.length - before
    // The search index shifts under a deep walk (documents get published
    // mid-enumeration), so an exact match is not required — but a walk that is
    // more than 2% short is a paging failure, not churn, and must not be seeded.
    const shortfall = expected[type] - got
    const ok = shortfall <= Math.max(5, expected[type] * 0.02)
    if (!ok) complete = false
    console.log(`\n  ${type.padEnd(21)} expected ${String(expected[type]).padStart(5)}  walked ${String(got).padStart(5)}  ${ok ? '✓' : `✗ ${shortfall} SHORT`}`)
  }
  return { entries, expected, complete }
}

async function measure() {
  console.log('GOV.UK consultation universe.\n')
  let total = 0
  for (const type of CONSULTATION_TYPES) {
    const n = await countType(type)
    console.log(`  ${type.padEnd(21)} ${String(n).padStart(6)}`)
    total += n
  }
  console.log(`  ${'TOTAL'.padEnd(21)} ${String(total).padStart(6)}`)
  console.log('\n  ⚠ document_type `consultation` returns 0 — it is not a real type on')
  console.log('    GOV.UK. Filtering on it produces a silent empty ingest.')
  console.log('  ⚠ Committee consultations are NOT included here — they are already')
  console.log('    covered by `committees-evidence` and duplicating them would double-')
  console.log('    count the same body stating the same position once.')
  console.log('\nNow reconciling by walking the index:\n')
  const { entries, complete } = await enumerateAll()
  console.log(`\n  walked ${entries.length} unique paths — ${complete ? 'RECONCILED' : '⚠ NOT RECONCILED, do not seed'}`)
}

async function pilot() {
  for (const type of CONSULTATION_TYPES) {
    const it = listConsultations(type, 3)
    const first = (await it.next()).value as ConsultationListEntry[] | undefined
    for (const e of (first ?? []).slice(0, 1)) {
      const c = await fetchConsultation(e.link, type)
      if (!c) { console.log(`\n${type}: ${e.link} — FETCH FAILED`); continue }
      const text = compileConsultationText(c)
      console.log(`\n════ [${type}] ${c.title.slice(0, 80)}`)
      console.log(`  ${c.path}`)
      console.log(`  opened=${c.openingDate} closed=${c.closingDate} firstPublished=${c.firstPublishedAt}`)
      console.log(`  organisations: ${c.organisations.join(', ') || '(none)'}`)
      console.log(`  body ${c.bodyHtml.length} chars html; compiled ${text.length} chars`)
      console.log(`  attachments (${c.attachments.length}):`)
      for (const a of c.attachments.slice(0, 8)) {
        console.log(`    [${a.kind.padEnd(22)}] ${a.title.slice(0, 62)}`)
        if (a.rawOrganisationName) console.log(`       raw org: "${a.rawOrganisationName}"  →  normalised: "${a.normalisedOrganisationName}"`)
      }
      const kinds = c.attachments.reduce<Record<string, number>>((m, a) => { m[a.kind] = (m[a.kind] ?? 0) + 1; return m }, {})
      console.log(`  kind breakdown: ${JSON.stringify(kinds)}`)
      console.log(`  ── compiled tail ──`)
      console.log(text.split('\n').slice(-8).map(l => '     ' + l).join('\n'))
      await new Promise(r => setTimeout(r, 400))
    }
  }
}

async function seed() {
  const pool = getNeonPool()
  const { entries, complete } = await enumerateAll()
  if (!complete) throw new Error('consultation enumeration not reconciled — refusing to seed a partial universe')

  const rows = entries.map(e => ({
    id: `${CORPUS}:${e.link.replace(/^\//, '').replace(/\//g, '_')}`,
    corpus: CORPUS,
    docId: `${e.type}|${e.link}`,
    sourceType: SOURCE,
    priority: 3,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`\n${rows.length} consultations → ${affected} new queue rows`)

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, notes, updated_at)
    VALUES ($1, $2, $3, true, $4, NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET
      display_label = $2, est_sections = $3, est_is_confirmed = true, blocked = false, blocked_reason = NULL,
      notes = $4, updated_at = NOW()
  `, [CORPUS, 'Consultations (GOV.UK)', entries.length,
      'V34 §C: gov.uk Search + Content API. One section per consultation carrying the body, the ' +
      'government response, and every attachment WITH its kind — an individually published response ' +
      'and a departmental summary of responses are recorded as different things and must not be ' +
      'presented as equivalent. Committee consultations excluded (see committees-evidence). OGL v3.0.'])
  console.log('corpus_targets upserted')
}

async function verify() {
  const pool = getNeonPool()
  const q = await pool.query(`SELECT status, COUNT(*)::int n FROM ingest_queue WHERE corpus=$1 GROUP BY status`, [CORPUS])
  const s = await pool.query(`
    SELECT COUNT(*)::int AS sections, SUM("wordCount")::bigint AS words,
           MIN("itemDate") AS oldest, MAX("itemDate") AS newest
    FROM corpus_sections WHERE corpus=$1`, [CORPUS])
  let expected = 0
  for (const t of CONSULTATION_TYPES) expected += await countType(t)
  console.log(`queue           : ${q.rows.map(r => `${r.status}=${r.n}`).join(' ') || '(none)'}`)
  console.log(`corpus_sections : ${JSON.stringify(s.rows[0])}`)
  console.log(`RECONCILIATION  : ${s.rows[0].sections}/${expected} (API total right now)`)
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
