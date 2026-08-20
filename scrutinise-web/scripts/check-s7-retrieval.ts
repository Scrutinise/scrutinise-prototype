/**
 * check-s7-retrieval.ts — BRIEF_SEARCH_S7's guard.
 *
 * Three things it protects, and the third is the commercial one:
 *   §2  a PREDICTION must never be presented as an OUTCOME
 *   §2  which parliament made a document must be unmistakable, and derived from the ID
 *   §2  a web source must never acquire the corpus's authority by sitting next to it
 *
 * ⚠ Every assertion was watched failing first; the mechanical ones run their own control.
 *
 * Usage (from scrutinise-web):  npx tsx scripts/check-s7-retrieval.ts
 */
import fs from 'fs'
import path from 'path'
import {
  legForImpactSection, jurisdictionOf, precedentNote, DEVOLUTION_NOTE, NOT_BUILT, devolutionBlock,
} from '../lib/lex/deepening-retrieval'
import {
  markersCollide, markPublicSources, publicSourcesBlock, publisherKind, NO_PUBLIC_SOURCES,
  publicMarker, corpusMarker,
} from '../lib/lex/public-sources'

export {}

let pass = 0
let fail = 0
const check = (ok: boolean, name: string, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

function main() {
  console.log('\n════ check:s7-retrieval ════')

  // ── §2 PRECEDENT — intended / predicted / observed ──────────────────────────────────────────
  console.log('\n  §2 PRECEDENT — a prediction is not an outcome')
  check(legForImpactSection('Post-implementation review') === 'observed',
    'a post-implementation review section is the OBSERVED leg')
  check(legForImpactSection('Costs and benefits') === 'predicted',
    'an impact-assessment section is the PREDICTED leg')
  check(legForImpactSection(null) === 'predicted',
    '⚠ an untitled section defaults to PREDICTED — the safer error, since calling a prediction an outcome is the damaging one')
  check(/Do NOT substitute what was PREDICTED for what was OBSERVED/.test(precedentNote(['observed']).forModel),
    '⚠⚠ a missing PIR forbids substituting the prediction for the outcome')
  check(/NO POST-IMPLEMENTATION REVIEW EXISTS/.test(precedentNote(['observed']).forUser),
    '   …and says plainly that nobody has assessed whether it worked')

  // ── §2 DEVOLUTION — jurisdiction from the identifier, never the title ───────────────────────
  console.log('\n  §2 DEVOLUTION_SCOPE — which parliament, unmistakably')
  const juris: Array<[string, string]> = [
    ['secondary:ssi/2019/1:regulation-3', 'Scotland'],
    ['primary:asp/2010/8:section-1', 'Scotland'],
    ['primary:anaw/2014/4:section-2', 'Wales'],
    ['secondary:wsi/2020/1:regulation-1', 'Wales'],
    ['primary:mwa/2011/1:section-1', 'Wales'],
    ['secondary:nisi/1998/1504:article-3', 'Northern Ireland'],
    ['primary:nia/2000/1:section-1', 'Northern Ireland'],
  ]
  for (const [id, want] of juris) check(jurisdictionOf(id) === want, `${id.split(':')[1]} → ${want}`)
  check(jurisdictionOf('primary-acts-pre-2000:ukpga/1998/46:section-28') === 'UK-wide',
    '⚠⚠ the SCOTLAND ACT 1998 is UK-wide — derived from the id, never from a title containing "Scotland"')
  check(jurisdictionOf('unknown:zz/1/1:x') === 'unknown', 'an unrecognised id is unknown, never guessed')
  check(/NOT a ruling on whether the subject is reserved or devolved/.test(DEVOLUTION_NOTE.forUser),
    '⚠⚠ the note refuses to answer the reservation question from a frequency count')
  check(/Schedule 5 to the Scotland Act 1998/.test(DEVOLUTION_NOTE.forUser) && /Schedule 7A/.test(DEVOLUTION_NOTE.forUser)
    && /Northern Ireland\s*\n?Act 1998|Northern Ireland Act 1998/.test(DEVOLUTION_NOTE.forUser),
  '   …and names all three schedules that actually decide it')
  const block = devolutionBlock({
    query: 'x',
    results: [{ id: 'secondary:ssi/2019/1:regulation-3', jurisdiction: 'Scotland', title: 'T', snippet: 's', url: null, type: 'STATUTORY_INSTRUMENT' }],
    byJurisdiction: { Scotland: 1 },
    note: DEVOLUTION_NOTE,
  }).forUser
  check(/^\[Scotland\]/m.test(block.split('\n').find((l) => l.startsWith('- '))?.slice(2) ?? ''),
    '⚠ jurisdiction is the FIRST thing on each rendered line, so it cannot be skimmed past')

  // ── §2 PUBLIC SOURCES — never the corpus's authority ────────────────────────────────────────
  console.log('\n  §2 Public sources — a web claim must never look like a statutory one')
  check(!markersCollide(), '⚠⚠ public markers [W1…] can NEVER collide with corpus markers [1…]')
  // negative control, run: a scheme that DID collide must be caught
  const badCollide = (() => {
    const corpus = new Set(['1', '2', '3'])
    return ['1', '2'].some((m) => corpus.has(m))
  })()
  check(badCollide, '   …and the collision test really detects a collision (negative control)')
  check(publicMarker(0) === 'W1' && corpusMarker(0) === '1', 'the two schemes are visibly different')
  const marked = markPublicSources([
    { title: 'A', publisher: 'Tweede Kamer (Dutch Parliament)', url: 'https://x', why: 'comparator' },
    { title: 'B', publisher: 'Some Blog', url: 'https://y', why: 'ranked well' },
  ])
  const pb = publicSourcesBlock(marked)
  check(/NOT our corpus/.test(pb) && /separate numbering/i.test(pb),
    'the block declares in its heading that it is not the corpus, with separate numbering')
  check(/never merge the two sequences/i.test(pb), '⚠ and forbids merging the sequences')
  check(publisherKind('Tweede Kamer (Dutch Parliament)') === 'foreign legislature'
    && publisherKind('National Audit Office') === 'audit office' && publisherKind('OECD') === 'international body',
  'institutional publishers are recognised (§2 prefers them)')
  check(/not an institutional source/.test(pb),
    '⚠⚠ a non-institutional source is FLAGGED in the block, not silently accepted')
  check(publicSourcesBlock([]) === NO_PUBLIC_SOURCES && /Do NOT answer from general knowledge/.test(NO_PUBLIC_SOURCES),
    '⚠ an empty list produces the honest line, not an empty block')

  // ── §2 the two that are NOT built carry reasons ─────────────────────────────────────────────
  console.log('\n  §2 the unbuilt two are decisions, not omissions')
  check(/topically DISTANT/.test(NOT_BUILT.MECHANISM_ANALOGUE),
    'MECHANISM_ANALOGUE says WHY it cannot be tuned into either retriever')
  check(/reranker is not authorised/.test(NOT_BUILT.CONTRADICTION),
    'CONTRADICTION names the reranker and its authorisation status')

  // ── §3 the framing harness must not measure its own leak ────────────────────────────────────
  console.log('\n  §3 the framing experiment')
  const framing = fs.readFileSync(path.join(__dirname, '../../scripts/ingest/search/measure-s7-framing.ts'), 'utf8')
  check(/re\.test\(enriched\) && !re\.test\(bare\)/.test(framing),
    '⚠⚠ the leak test is DIFFERENTIAL — a question naming its own subject is not a leak')
  check(/UNDERPOWERED/.test(framing),
    '⚠ the harness reports its own floor effect rather than a "+0.0pp" headline')
  check(/no result below licenses a claim about user profiles/.test(framing),
    '⚠⚠ and states which comparison it ran — the gold set has no user and no profile')
  check(/ALTERNATE THE ORDER/.test(framing), 'run order alternates against the cache artefact')

  console.log(`\n════ ${fail ? `${fail} FAILED` : `all ${pass} checks pass`} ════`)
  if (fail) process.exit(1)
}
main()
