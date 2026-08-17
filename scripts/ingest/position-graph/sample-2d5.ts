/**
 * sample-2d5.ts — BRIEF_GRAPH_2D5 §1: show Charlie the actual documents.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS SCRIPT EXISTS AND WHY IT COMES FIRST
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Every number in this workstream — 27 of 50, then 22 of 50 — is a summary of judgements nobody
 * outside the thread has read. The brief is blunt about it: "He is right to, and it should have
 * been offered rather than requested."
 *
 * So this dumps, for every one of the fifty hand-scored positions, the four things needed to judge
 * it without trusting me: the CLAIM as put to the extractor, the SUBMISSION in real prose, WHAT THE
 * EXTRACTOR RECORDED, and WHAT THE HAND-READ CONCLUDED. `docs/POSITION_SAMPLE.md` is then written
 * from this output by hand, because choosing twelve cases that span the failure types is a
 * judgement and should be visible as one.
 *
 * ⚠ IT DUMPS ALL FIFTY, NOT THE TWELVE I LIKED. The selection happens afterwards and in the open.
 * A generator that emitted only the chosen cases would make the choice unauditable, which is the
 * exact complaint that produced this section of the brief.
 *
 * ⚠ THE EXTRACT IS LOCATED IN THE DOCUMENT, NOT REPRINTED FROM THE ROW. The whole point is to show
 * the passage IN CONTEXT — §1.2: "Real prose, not a snippet stripped of context. If it takes 400
 * words to see why a passage is or is not a position, use 400 words." So the surrounding window is
 * taken from the R2 text at the matched offset.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/sample-2d5.ts --self-test
 *   npx tsx position-graph/sample-2d5.ts --dump            # all 50, to sample-2d5-cases.json
 *   npx tsx position-graph/sample-2d5.ts --show <id>       # one case, with a wide window
 */
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { getDocText, findExtract } from './text-2d3'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const str = (n: string, d = '') => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }

const OUT = path.join(__dirname, 'sample-2d5-cases.json')

export interface Case {
  position_id: string
  verdict: string
  failure_type: string | null
  note: string
  proposition: string
  inquiry_ref: string
  inquiry_label: string | null
  submitter: string | null
  section_id: string
  source_url: string | null
  polarity: string
  capacity: string | null
  confidence: number | null
  extract: string
  extract_found: boolean
  /** The passage with its surroundings, so a reader can judge whether it means what we said. */
  context: string
  /** Where in the document the passage sits, as a percentage — a bibliography hit shows up here. */
  position_pct: number | null
  doc_words: number
  /** The document's own opening, which is where a submitter says who they are. */
  opening: string
}

/**
 * ⚠ THE WINDOW IS TAKEN AROUND THE MATCH, AND WHEN THERE IS NO MATCH IT SAYS SO.
 *
 * `extract_found_in_source` is false on some rows — the model returned a passage that is not in the
 * document, which is itself one of the failure modes worth showing. Printing the row's own extract
 * as though it were the document would hide exactly that.
 */
export function windowAround(doc: string, offset: number, before: number, after: number): string {
  const start = Math.max(0, offset - before)
  const end = Math.min(doc.length, offset + after)
  const head = start > 0 ? '…' : ''
  const tail = end < doc.length ? '…' : ''
  return head + doc.slice(start, end).trim() + tail
}

async function dump() {
  const pool = getNeonPool()
  const { rows } = await pool.query<{
    position_id: string; verdict: string; failure_type: string | null; note: string
    proposition: string; inquiry_ref: string; inquiry_label: string | null; submitter: string | null
    section_id: string; source_url: string | null; polarity: string; capacity: string | null
    confidence: number | null; extract: string; extract_found: boolean; r2key: string; words: number
  }>(`
    SELECT r.position_id::text, r.verdict, r.failure_type, COALESCE(r.note,'') note,
           pr.text proposition, p.inquiry_ref, p.section_id, p.source_url, p.polarity, p.capacity,
           p.confidence, p.extract, p.extract_found_in_source extract_found,
           c."r2Key" r2key, c."wordCount" words,
           (SELECT MIN(ge.object_label) FROM graph_edge ge JOIN graph_evidence gv ON gv.edge_id=ge.id
             WHERE gv.section_id=p.section_id AND ge.predicate='gave-evidence-to') inquiry_label,
           (SELECT string_agg(DISTINCT en.canonical_name, '; ') FROM graph_evidence gv2
              JOIN graph_edge ge2 ON ge2.id=gv2.edge_id JOIN graph_entity en ON en.id=ge2.subject_id
             WHERE gv2.section_id=p.section_id) submitter
    FROM graph_position_review r
    JOIN graph_position p ON p.id = r.position_id
    JOIN graph_proposition pr ON pr.id = p.proposition_id
    JOIN corpus_sections c ON c.id = p.section_id
    ORDER BY r.verdict, r.failure_type NULLS FIRST, r.position_id`)

  console.log(`\n════ ${rows.length} hand-scored positions ════`)
  const cases: Case[] = []
  const docCache = new Map<string, string | null>()

  for (const r of rows) {
    if (!docCache.has(r.r2key)) docCache.set(r.r2key, await getDocText(r.r2key))
    const doc = docCache.get(r.r2key) ?? ''
    const m = doc ? findExtract(r.extract, doc) : { found: false, offset: -1 }
    cases.push({
      position_id: r.position_id,
      verdict: r.verdict,
      failure_type: r.failure_type,
      note: r.note,
      proposition: r.proposition,
      inquiry_ref: r.inquiry_ref,
      inquiry_label: r.inquiry_label,
      submitter: r.submitter,
      section_id: r.section_id,
      source_url: r.source_url,
      polarity: r.polarity,
      capacity: r.capacity,
      confidence: r.confidence,
      extract: r.extract,
      extract_found: !!m.found,
      context: m.found && m.offset >= 0 ? windowAround(doc, m.offset, 900, 1400) : '(the passage is NOT in the document)',
      position_pct: m.found && m.offset >= 0 && doc.length ? Math.round((1000 * m.offset) / doc.length) / 10 : null,
      doc_words: r.words,
      opening: doc.slice(0, 700).replace(/\s+/g, ' ').trim(),
    })
  }

  fs.writeFileSync(OUT, JSON.stringify(cases, null, 1), 'utf8')
  console.log(`  written: ${path.relative(process.cwd(), OUT)}`)

  const byType: Record<string, number> = {}
  for (const c of cases) {
    const k = c.verdict + (c.failure_type ? `/${c.failure_type}` : '')
    byType[k] = (byType[k] ?? 0) + 1
  }
  console.log('\n  the failure types the sample must span:')
  for (const [k, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${k}`)

  // ⚠ Where in the document did the quoted passage come from? A bibliography sits at the end.
  const late = cases.filter((c) => (c.position_pct ?? 0) > 85)
  console.log(`\n  ⚠ ${late.length} extracts come from the last 15% of their document (a bibliography lives there):`)
  for (const c of late) console.log(`     ${c.position_id}  ${String(c.position_pct).padStart(5)}%  ${c.verdict}${c.failure_type ? '/' + c.failure_type : ''}  "${c.extract.slice(0, 70)}…"`)
  const missing = cases.filter((c) => !c.extract_found)
  console.log(`\n  ⚠ ${missing.length} extracts cannot be located in their document at all: ${missing.map((c) => c.position_id).join(', ') || '(none)'}`)

  await endNeonPool()
}

async function show(id: string) {
  if (!fs.existsSync(OUT)) { console.log('run --dump first'); return }
  const cases: Case[] = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  const c = cases.find((x) => x.position_id === id)
  if (!c) { console.log(`no case ${id}`); return }
  console.log(`\n════ ${c.position_id} — ${c.verdict}${c.failure_type ? ` / ${c.failure_type}` : ''} ════`)
  console.log(`CLAIM      ${c.proposition}`)
  console.log(`INQUIRY    ${c.inquiry_label ?? c.inquiry_ref}`)
  console.log(`SUBMITTER  ${c.submitter ?? '(not resolved)'}`)
  console.log(`RECORDED   ${c.polarity} · ${c.capacity} · confidence ${c.confidence} · at ${c.position_pct}% of the document`)
  console.log(`EXTRACT    "${c.extract}"`)
  console.log(`HAND READ  ${c.note}`)
  console.log(`\nOPENING\n  ${c.opening}`)
  console.log(`\nCONTEXT\n${c.context.split('\n').map((l) => '  ' + l).join('\n')}`)
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const doc = 'A'.repeat(100) + 'THE PASSAGE' + 'B'.repeat(100)
  const cases: Array<[string, boolean]> = [
    ['a window includes the match', windowAround(doc, 100, 20, 20).includes('THE PASSAGE')],
    ['a window marks a truncated head', windowAround(doc, 100, 20, 20).startsWith('…')],
    ['a window marks a truncated tail', windowAround(doc, 100, 20, 20).endsWith('…')],
    ['a window at the start has no leading ellipsis', !windowAround(doc, 0, 20, 20).startsWith('…')],
    ['a window at the end has no trailing ellipsis', !windowAround(doc, doc.length, 20, 20).endsWith('…')],
    ['a window never runs off the end', windowAround(doc, doc.length - 1, 10, 9999).length <= doc.length + 2],
    ['a window never runs off the front', windowAround(doc, 0, 9999, 10).length <= doc.length + 2],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

async function main() {
  if (flag('self-test')) return selftest()
  if (flag('show')) return show(str('show'))
  await dump()
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
