// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25v — §9's acceptance criteria, asserted on RENDERED documents and on live rows.
//
// CLAUDE.md §25 (assert rendered data), §26 (the cold read) and the new §27 (what a prompt shows
// reaches the output) all apply. The subject is the pilot proposal — a document nobody in this
// check created — and every document assertion reads the flattened `DocumentModel` the docx and
// PDF renderers consume, not the source that builds it.
//
// Usage: npm run check:lex-25v
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument, buildSummaryDocument } from '../lib/documents/build-proposal'
import { buildEvidencePackDocument } from '../lib/documents/build-evidence-pack'
import { buildMeetingPackDocument } from '../lib/documents/build-meeting-pack'
import { EVIDENCE_DISCLOSURE, BETA_MARKER, PILOT_WELCOME_LINE } from '../lib/lex/beta-disclosure'
import { committeeUrl } from '../lib/lex/committee-url'
import type { Block, DocumentModel } from '../lib/documents/model'

const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'
let passed = 0, failed = 0, dead = 0, controls = 0
const notChecked: string[] = []

function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
function control(label: string, holdsOnBroken: () => boolean) {
  controls++
  if (holdsOnBroken()) { dead++; console.log(`  ⚠ DEAD CONTROL — ${label}`) }
  else console.log(`  ✓ fired — ${label}`)
}
/**
 * ⚠⚠ COMMENTS ARE STRIPPED BEFORE ANY ABSENCE IS ASSERTED. The first run of this file failed §4
 * on correct code: the ⚠ note in `deepening-client.ts` explaining the fix QUOTES the sentence that
 * was removed, so a grep for "bags enter waterways" found the explanation of its own deletion.
 * (CLAUDE.md, 30 Aug — an absence assertion that reads its own comments.)
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

function textOf(m: DocumentModel): string {
  const out: string[] = [m.title, m.subtitle ?? '', m.sourceLabel]
  for (const b of m.blocks as Block[]) {
    if (b.kind === 'section') out.push(b.title)
    else if (b.kind === 'heading' || b.kind === 'paragraph') out.push(b.runs.map((r) => r.text).join(''))
    else if (b.kind === 'bullets') for (const it of b.items) out.push(it.map((r) => r.text).join(''))
    else if (b.kind === 'note') out.push(b.text)
    // ⚠ THE DATE AND THE SNIPPET ARE PART OF WHAT A READER SEES. Leaving them out of this
    // flattening made §6 fail on a document that carried the corrected stamp — the check could not
    // see the very field it was asserting about.
    else if (b.kind === 'sources') for (const r of b.refs) out.push(`${r.title} ${r.citation} ${r.url} ${r.date ?? ''} ${r.snippet ?? ''}`)
  }
  return out.join('\n')
}

async function main() {
  console.log('\n── check:lex-25v — the document made printable ──\n')
  const snapshot = await buildProposalSnapshot(IDEA)
  const docs: Array<[string, DocumentModel]> = [
    ['long proposal', buildProposalDocument(snapshot).model],
    ['summary', buildSummaryDocument(snapshot).model],
    ['evidence pack', buildEvidencePackDocument(snapshot).model],
    ['meeting pack', buildMeetingPackDocument(snapshot).model],
  ]
  const texts = new Map(docs.map(([n, m]) => [n, textOf(m)]))
  const all = [...texts.values()].join('\n')

  // ══ §1 — the citation links ══════════════════════════════════════════════
  console.log('§1 — citations and links')
  // ⚠ FIXED PERMANENTLY, not disclosed: the builder can no longer emit the address at all.
  ok('the wrong committee address cannot be constructed any more',
    committeeUrl('https://committees.parliament.uk/publications/6912/') === ''
    && committeeUrl('https://committees.parliament.uk/publications/6912/html/') === '')
  control('the pre-25-V builder would have returned the /html/ form',
    () => committeeUrl('https://committees.parliament.uk/publications/6912/') === 'https://committees.parliament.uk/publications/6912/html/')
  ok('and it still fixes the written-evidence family it was written for',
    committeeUrl('https://committees.parliament.uk/writtenevidence/121125/')
      === 'https://committees.parliament.uk/writtenevidence/121125/html/')

  const bad = await prisma.evidenceItem.count({
    where: { url: { contains: 'committees.parliament.uk/publications/' } },
  })
  ok('no stored citation still points into the written-evidence id space', bad === 0, `${bad} rows`)
  // ⚠ SCOPED TO THE ROWS THE REPAIR TOUCHED. A first version counted every row with no url and no
  // citation and failed on 65 that never had either — user testimony and model reasoning, which
  // are not citations and never were. An assertion that fails on data it was not about is an
  // assertion nobody will keep.
  const committeeRows = await prisma.evidenceItem.findMany({
    where: { sourceId: { startsWith: 'committees-reports:publication:' } },
    select: { citation: true },
  })
  const lostCitation = committeeRows.filter((r) => !r.citation?.trim()).length
  ok('every committee citation the repair touched still carries its citation',
    lostCitation === 0, `${committeeRows.length} rows, ${lostCitation} without a citation`)

  // ══ §2 — the document has a centre ═══════════════════════════════════════
  console.log('\n§2 — the candidates reach the document')
  const long = texts.get('long proposal')!
  ok('the report no longer prints only "no approach has been committed"',
    !/No approach has been committed to on this proposal yet\./.test(long))
  const liveOptions = (snapshot.options ?? []).filter((o) => o.status !== 'RULED_OUT')
  ok('every live candidate appears in the report by its own text',
    liveOptions.every((o) => long.includes(o.approach.slice(0, 60))),
    `${liveOptions.length} candidates`)
  control('a report printing none of them would fail that',
    () => liveOptions.every((o) => ''.includes(o.approach.slice(0, 60))))
  ok('the sort\'s own reasoning reaches the page',
    liveOptions.filter((o) => o.kindReason).every((o) => long.includes(o.kindReason!.slice(0, 50))))
  ok('and the snapshot carries what the sort wrote',
    liveOptions.some((o) => !!o.kind) && liveOptions.some((o) => !!o.sorted))

  // ══ §3 — our vocabulary is out of the reader's way ═══════════════════════
  console.log('\n§3 — internal language')
  for (const term of ['KERNEL TEST FAILED', 'THE ROAD TAKEN AT', 'Drafted by Lex from the toolkit']) {
    ok(`"${term}" appears in no generated document`, !all.includes(term))
  }
  control('a document still containing one would fail that',
    () => !'…KERNEL TEST FAILED — x…'.includes('KERNEL TEST FAILED'))
  const stored = await prisma.deepeningIssue.count({
    where: { OR: [{ text: { contains: 'KERNEL TEST FAILED' } }, { text: { contains: 'THE ROAD TAKEN AT' } }] },
  })
  ok('and no stored challenge still carries them either', stored === 0, `${stored} rows`)

  // ══ §4 — a prompt example cannot come back as content ════════════════════
  console.log('\n§4 — prompt examples')
  const dc = stripComments(code('lib/lex/deepening-client.ts'))
  ok('rule 5 no longer supplies a liftable specimen sentence',
    !/bags enter waterways/.test(dc))
  // ⚠ ASSERTED ON A FRAGMENT INSIDE ONE STRING LITERAL, NOT ON THE WHOLE SENTENCE. The prompt
  // is an array of wrapped lines, so "Never carry over an example, a subject or a figure" exists
  // in the PROMPT the model receives and never exists contiguously in the SOURCE. Asserting the
  // joined sentence against the file failed on correct code — the same shape as reading a
  // comment, one level down: the check must read what the model reads.
  const prompt = dc.replace(/',[\s\r\n]*'/g, '').replace(/\s+/g, ' ')
  ok('and it tells the model not to carry an example across',
    /Never carry over an example, a subject or a figure from these instructions/.test(prompt))

  // ══ §5 — the counts agree ════════════════════════════════════════════════
  console.log('\n§5 — the arithmetic')
  ok('the source label no longer claims findings are accepted without counting them',
    !/\d+ accepted finding/.test(all))
  const acceptedInLabel = long.match(/(\d+) findings \((\d+) accepted by the proposer\)/)
  const realAccepted = snapshot.evidence.filter((e) => e.status === 'ACCEPTED').length
  ok('and the label\'s accepted count equals the real one',
    !!acceptedInLabel && Number(acceptedInLabel[2]) === realAccepted,
    `label ${acceptedInLabel?.[2]} vs actual ${realAccepted}`)

  // ══ §6 — dates ═══════════════════════════════════════════════════════════
  console.log('\n§6 — dates')
  ok('no flag prints a 1-January day for a date known only to a year',
    !/From \d{4}-01-01/.test(all))
  control('a flag printing 2010-01-01 would fail that',
    () => !/From \d{4}-01-01/.test('From 2010-01-01, 16 years old.'))
  ok('and a year-only date still prints its year and its age',
    /From \d{4}, \d+ years old/.test(all))

  // ══ §8 — every open decision names a route ═══════════════════════════════
  console.log('\n§8 — open decisions')
  const openForks = snapshot.forks.open.length
  if (openForks) {
    const routes = (long.match(/What would settle it:/g) ?? []).length
    ok('every open decision states what would resolve it', routes >= openForks, `${routes} of ${openForks}`)
  } else notChecked.push('§8 — this proposal has no open forks, so the resolution line could not be asserted on it')

  // ══ §11 — the beta marker, the disclosure, the welcome line ══════════════
  console.log('\n§11 — beta and disclosure')
  for (const [name, t] of texts) {
    ok(`the ${name} carries the Beta marker`, t.includes(BETA_MARKER))
    ok(`the ${name} carries the evidence disclosure, verbatim`, t.includes(EVIDENCE_DISCLOSURE))
  }
  control('a document with neither would fail that',
    () => ''.includes(EVIDENCE_DISCLOSURE))
  ok('the research panel carries the same disclosure, from the same constant',
    code('lib/lex/panel-layout.ts').includes('EVIDENCE_DISCLOSURE'))
  ok('the welcome email carries the pilot line, in html and in plain text',
    (code('lib/email.ts').match(/PILOT_WELCOME_LINE/g) ?? []).length >= 2)
  // ⚠ §11c — the disclosure must NOT be widened to cover mislabelled citations, because §1 fixed
  // that rather than disclosing it. A disclosure that apologised for a defect we do not have would
  // teach a reader to distrust 141 citations that are sound.
  ok('and the disclosure does not claim citations may be mislabelled',
    !/citation/i.test(EVIDENCE_DISCLOSURE) && !/verified against the source/i.test(PILOT_WELCOME_LINE))

  console.log(`\n── ${notChecked.length} NOT CHECKED ──`)
  for (const n of notChecked) console.log(`  · ${n}`)
  console.log(`\n${passed} passed, ${failed} failed, ${notChecked.length} not checked, ${controls} controls (${dead} dead)\n`)
  await prisma.$disconnect()
  if (failed || dead) process.exit(1)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
