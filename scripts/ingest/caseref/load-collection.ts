/**
 * load-collection.ts — §2. Stage the `case-references` collection.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ NOT ONE CHARACTER OF ANY JUDGMENT WE DO NOT HOLD GOES INTO THIS COLLECTION.
 *
 * A record's body is written HERE, from three things and nothing else:
 *   1. the citation and the case names observed beside it in documents we hold
 *   2. counts of our own corpus — how many documents cite it, and where
 *   3. where relevant, ONE quoted sentence from a document we hold, with its source named
 *
 * §4 of the brief, restated because a loader is where it would be broken: we do not fetch from
 * BAILII, we do not reproduce judgment text we do not hold, and we do not claim to hold what we do
 * not. Every record for an absent case says so on its face, in the body, in the first line.
 *
 * ── WHAT IT WRITES ─────────────────────────────────────────────────────────────────────────────
 *   R2                `case-references/<slug>/1.compiled.txt`   the record as text
 *   corpus_sections   one row, `corpus='case-references'`, `format='reference'`
 *
 * ⚠ NO INDEX WRITE HERE. A row in `corpus_sections` is not a row a user can find: the FTS and
 * vector indexes are built separately, and a field corrected in the database has not reached a user
 * until the index is refreshed AND the refresh is verified. The next step is printed at the end and
 * is NOT claimed to have happened.
 *
 * Usage:
 *   tsx caseref/load-collection.ts                # DRY RUN — builds and prints, writes nothing
 *   tsx caseref/load-collection.ts --execute
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from '../c2/db'

const EXECUTE = process.argv.includes('--execute')
const n = (x: number) => x.toLocaleString('en-GB')

interface Rec {
  citation: string; kind: string; year: number; court: string | null; courtSource: string | null
  observedName: string | null; names: Array<{ name: string; seen: number }>
  held: string; heldNote: string; heldId: string | null
  citedBy: { documents: number; byCorpus: Record<string, number> }
  discussion: Array<{ id: string; corpus: string; title: string; evidence: string; snippet: string }>
  description: { text: string; sourceId: string; sourceCorpus: string; sourceTitle: string } | null
  links: Array<{ label: string; url: string; derived: boolean }>
}

/** A stable id from the citation — the identity — never from the name. */
const slugOf = (citation: string) => citation.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * The record, as a user would read it. Written here, in this function, so that everything a reader
 * sees can be traced to a line of code and a number rather than to a model.
 */
export function renderRecord(r: Rec): string {
  const L: string[] = []
  const name = r.observedName ?? '(no case name recorded)'
  L.push(`${name} ${r.citation}`)
  if (r.court) L.push(r.courtSource === 'curated' ? `${r.court}` : `${r.court}`)
  L.push('')

  if (r.held === 'held') {
    L.push('Held in our corpus.')
  } else if (r.held === 'not-held') {
    L.push('NOT HELD IN OUR CORPUS. Our English case law begins in 2003.')
    L.push('This is a permanent boundary, not a backlog: BAILII refused permission in writing on')
    L.push('16 June 2026 and The National Archives has confirmed it will not digitise or license')
    L.push('digitisation of its pre-2001 paper holdings.')
  } else {
    L.push('WHETHER WE HOLD THIS JUDGMENT IS UNKNOWN. It is cited here in law-report form; we may')
    L.push('hold it under its neutral citation without the two being linked. Not claimed either way.')
  }
  L.push('')

  const cited = r.citedBy.documents
  if (cited > 0) {
    const where = Object.entries(r.citedBy.byCorpus).sort((a, b) => b[1] - a[1])
      .map(([c, k]) => `${n(k)} in ${c}`).join(', ')
    L.push(`Cited in ${n(cited)} document${cited === 1 ? '' : 's'} we hold (${where}).`)
  } else {
    L.push('Not cited in any document we have scanned. That is a statement about our scan, not about the case.')
  }

  if (r.discussion.length) {
    L.push(`Discussed in ${n(r.discussion.length)} document${r.discussion.length === 1 ? '' : 's'} we hold:`)
    for (const d of r.discussion) L.push(`  · ${d.title} (${d.corpus})`)
  } else {
    L.push('No document we hold discusses it in a form we can verify.')
  }
  L.push('')

  if (r.description) {
    L.push('What a source we hold says about it:')
    L.push(`  "${r.description.text.trim()}"`)
    L.push(`  — ${r.description.sourceTitle} (${r.description.sourceCorpus})`)
  } else {
    // ⚠ THE HONEST EMPTY STATE. An unknown fact is unknown, not absent and not guessed.
    L.push('Nothing we hold says what this case decided, so this record does not say.')
  }
  L.push('')

  if (r.names.length > 1) {
    L.push(`Also cited as: ${r.names.slice(1, 5).map((v) => v.name).join(' · ')}`)
  }
  for (const l of r.links) L.push(`${l.label}: ${l.url}${l.derived ? '  (link derived from the citation; not verified by fetching)' : ''}`)
  return L.join('\n')
}

async function main() {
  const recPath = fs.existsSync(path.join(OUT, 'CASEREF_records.json'))
    ? path.join(OUT, 'CASEREF_records.json') : path.join(OUT, 'CASEREF_records.probes.json')
  const records: Rec[] = JSON.parse(fs.readFileSync(recPath, 'utf8')).records
  console.log(`records: ${path.basename(recPath)}  (${n(records.length)})`)
  console.log(EXECUTE ? '\n⚠ EXECUTE — R2 objects and corpus_sections rows will be written.\n' : '\nDRY RUN — nothing is written.\n')

  // ⚠ THE GUARD THAT MATTERS: no record may contain judgment text we do not hold. The only quoted
  //   material is `description`, which comes from a source in OUR corpus and carries its id.
  let unsourced = 0
  for (const r of records) {
    if (r.description && !r.description.sourceId) unsourced++
  }
  if (unsourced) {
    console.log(`⛔ ABORT — ${unsourced} record(s) carry a quotation with no source id. A quotation whose`)
    console.log('   source cannot be named is exactly what this collection must never contain.')
    process.exit(1)
  }
  console.log(`✓ ${n(records.filter((r) => r.description).length)} records quote a source, and every one names the document it came from`)

  const p = pool()
  const existing = (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus='case-references'`)).rows[0].n
  console.log(`✓ corpus_sections currently holds ${n(existing)} case-references rows`)

  console.log('\n── one rendered record, in full, so a person can read what would be stored ──\n')
  const example = records.find((r) => r.description) ?? records[0]
  console.log(renderRecord(example).split('\n').map((l) => '   ' + l).join('\n'))

  if (!EXECUTE) {
    console.log(`\nDRY RUN — would write ${n(records.length)} R2 objects and ${n(records.length)} corpus_sections rows.`)
    console.log('⚠ AND THEY WOULD NOT BE FINDABLE. corpus_fts and the vector index are built separately;')
    console.log('  until they are rebuilt and the rebuild is verified, no user can retrieve one of these.')
    await p.end(); return
  }

  const { r2Put } = await import('../shared/r2-client')
  let written = 0
  for (const r of records) {
    const slug = slugOf(r.citation)
    const key = `case-references/${slug}/1.compiled.txt`
    const text = renderRecord(r)
    await r2Put(key, text)
    await p.query(
      `INSERT INTO corpus_sections (id, corpus, "sourceUrl", "r2Key", "wordCount", status, format, "sectionTitle", "itemDate")
       VALUES ($1,'case-references',$2,$3,$4,'compiled','reference',$5,$6)
       ON CONFLICT (id) DO UPDATE SET "r2Key"=EXCLUDED."r2Key", "wordCount"=EXCLUDED."wordCount",
         "sectionTitle"=EXCLUDED."sectionTitle", status='compiled'`,
      [`case-references:${slug}:1`, r.links[0]?.url ?? null, key, text.split(/\s+/).length,
       `${r.observedName ?? r.citation} ${r.citation}`, `${r.year}-01-01`])
    written++
    if (written % 25 === 0) process.stdout.write(`\r   ${written}/${records.length}   `)
  }
  process.stdout.write('\n')
  const after = (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus='case-references'`)).rows[0].n
  console.log(`   ${n(existing)} → ${n(after)} rows  ${after >= written ? '✓' : '⚠ MISMATCH'}`)
  console.log('\n⚠ NOT YET FINDABLE. Next: rebuild corpus_fts for this collection, then VERIFY by')
  console.log('  retrieving one record through the real gateway. Until then this is a table, not a feature.')
  await p.end()
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
