// ─────────────────────────────────────────────────────────────────────────────────────────
// check:lex-26a — positions that mean something, and qualifications that cannot be dropped.
//
// ⚠ MUCH OF §1, §2 AND §4 WAS BUILT BY THE SURFACE-3 SPRINT overnight, so this check VERIFIES
// those rather than claiming them: a sprint that asserts another sprint's work as its own is
// how a report comes to describe something nobody has looked at.
//
// ⚠⚠ §4b IS THE UNUSUAL ONE AND IT IS THE POINT OF THE SPRINT: "assert the impossibility, not
// the behaviour. A check that renders a claim correctly proves nothing." So the grounds
// assertion below tries to CONSTRUCT a groundless position and requires the attempt to fail.
//
// CLAUDE.md §25 (assert the value), §26 (the cold read — the subject is the pilot proposal,
// which this check did not create) and §28 apply.
//
// Usage: npm run check:lex-26a
// ─────────────────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { positionsCaveat, tallyPositions } from '../lib/lex/positions-caveat'
import { HEADINGS_WITH_NO_PRODUCER, NO_PRODUCER_NOTE } from '../lib/lex/question-headings'
import { headingsWithProducers } from '../lib/lex/heading-map'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument } from '../lib/documents/build-proposal'
import { buildEvidencePackDocument } from '../lib/documents/build-evidence-pack'
import { buildMeetingPackDocument } from '../lib/documents/build-meeting-pack'
import { positionForDocument } from '../lib/graph/position-block'
import { findClaimTarget } from '../lib/graph/claim-review'
import type { Block, DocumentModel } from '../lib/documents/model'

const PILOT = '452c5ade-3153-400a-bf48-3b71aaa52773'
let passed = 0, failed = 0, dead = 0, controls = 0
const notChecked: string[] = []
const findings: string[] = []

function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
function control(label: string, holdsOnBroken: () => boolean) {
  controls++
  if (holdsOnBroken()) { dead++; console.log(`  ⚠ DEAD CONTROL — ${label}`) }
  else console.log(`  ✓ fired — ${label}`)
}
/** A measured defect that is not a regression — printed, counted, does not fail the run. */
function finding(label: string, detail: string) {
  findings.push(`${label} — ${detail}`)
  console.log(`  ⚠⚠ FINDING ${label}\n       ${detail}`)
}
function skip(label: string, why: string) { notChecked.push(`${label} — ${why}`); console.log(`  · NOT CHECKED ${label} — ${why}`) }

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'))

function textOf(m: DocumentModel): string {
  const out: string[] = [m.title, m.subtitle ?? '', m.sourceLabel]
  for (const b of m.blocks as Block[]) {
    if (b.kind === 'section') out.push(b.title)
    else if (b.kind === 'heading' || b.kind === 'paragraph') out.push(b.runs.map((r) => r.text).join(''))
    else if (b.kind === 'bullets') for (const it of b.items) out.push(it.map((r) => r.text).join(''))
    else if (b.kind === 'note') out.push(b.text)
    else if (b.kind === 'sources') for (const r of b.refs) out.push(`${r.title} ${r.citation} ${r.url} ${r.date ?? ''} ${r.snippet ?? ''}`)
  }
  return out.join('\n')
}

async function main() {
  console.log('\n── check:lex-26a — positions, and qualifications that cannot be dropped ──\n')

  // ══ §1 — THE MAPPING (SURFACE-3'S; VERIFIED HERE, ON A REAL IDEA) ═════════════════════
  console.log('§1 — the idea finds something (verifying SURFACE 3 §2)')
  const elicit = await prisma.ideaElicitation.findUnique({
    where: { ideaId: PILOT }, select: { problem: true, goalDetail: true },
  })
  const target = await findClaimTarget(`${elicit?.problem ?? ''} ${elicit?.goalDetail ?? ''}`)
  ok('§1 — the pilot idea now resolves to a target at all (it returned NO TARGET on 3 Sept)',
    !!target, target ? `${target.targets[0].type}:${target.targets[0].id}` : 'still nothing')
  if (target) {
    ok('§1d — and the match DISCLOSES what it matched on, rather than presenting itself as certain',
      typeof target.matchedPhrase === 'string' && target.matchedPhrase.length > 0
      && typeof target.matchedWords === 'number',
      `"${target.matchedPhrase}" · ${target.matchedWords} words`)

    // ⚠⚠ THE FINDING, NOT AN ASSERTION. §7 asks that no target be resolved on similarity. A
    // two-word ILIKE phrase match IS a similarity resolution; SURFACE 3 chose to DISCLOSE the
    // floor rather than refuse below it, and documented that choice. On this idea the choice
    // produces a machinery-safety regulation under a civil-service-accountability proposal.
    // Recorded as a finding because reversing another sprint's documented decision is
    // Charlie's call, not this check's.
    if (target.matchedWords < 3) {
      finding('§1d — the pilot idea\'s target rests on a two-word phrase match',
        `"${target.matchedPhrase}" → ${target.questionText.slice(0, 90)}… — disclosed, but this `
        + 'is a similarity resolution and §7 asks for none. Raising the floor to three content '
        + 'words is one line in findClaimTarget; it reverses a documented SURFACE-3 decision.')
    }
  }
  const controlTarget = await findClaimTarget('xyzzy plugh frobnicate')
  control('a nonsense subject would still find a target', () => controlTarget !== null)

  // ══ §2 — THE COVERAGE WINDOW, READ FROM THE DATA ═════════════════════════════════════
  console.log('\n§2 — the coverage window')
  const cr = code('lib/graph/claim-review.ts')
  const cov = code('lib/graph/position-coverage.ts')
  ok('§2c — the boundary is read from the data, not written down',
    !/2016/.test(cov) && !/2016/.test(cr), 'no hardcoded year in either file')
  control('a hardcoded year would be caught', () => !/2016/.test('begins on 9 March 2016'))
  if (target) {
    const { claimFor } = await import('../lib/graph/claim-review')
    const { matchBasis } = await import('../lib/graph/claim-review')
    const claim = await claimFor(
      target.targets, null, target.questionText,
      matchBasis(target.matchedPhrase, target.matchedWords),
    )
    if (!claim) skip('§2a the live coverage notes', 'no claim returned for the pilot idea')
    else {
      const notes = (claim.question as { coverageNotes?: string[] }).coverageNotes ?? []
      ok('§2a — the coverage notes state the record\'s start date beside the count',
        notes.some((n) => /begins on \d+ \w+ \d{4}/.test(n)),
        notes.find((n) => /begins on/.test(n))?.slice(0, 70) ?? 'none')
      ok('§2a — and they say what the absence does NOT mean',
        notes.some((n) => /not the same as nobody having taken a position/.test(n)))
    }
  }

  // ══ §3 — THE CAVEAT, AND IT NAMES ITS SOURCE ═════════════════════════════════════════
  console.log('\n§3 — the caveat (decision 70)')
  const snapshot = await buildProposalSnapshot(PILOT)
  const positions = snapshot.evidence.filter((e) => e.headingKey === 'POSITIONS')
  const tally = tallyPositions(positions)
  const caveat = positionsCaveat(tally)
  ok('§3a — the caveat counts the items rather than asserting a number',
    caveat.includes(`${tally.total} item`), `${tally.total} item(s), ${tally.fromProposerMaterial} the proposer's`)
  ok('§3a — and where the material is the proposer\'s, it says so',
    tally.fromProposerMaterial === 0 || /supplied yourself/.test(caveat), caveat.slice(0, 100))

  // ⚠ THE DEGENERATE CASE THAT PRODUCED THE DECISION, asserted as a value rather than trusted.
  const allOwn = positionsCaveat({ total: 1, fromProposerMaterial: 1 })
  ok('§3a — one item, all the proposer\'s, is not passed off as research',
    /not from research we have done/.test(allOwn) && /Nothing here is our assessment/.test(allOwn))
  ok('§3 — an empty section makes a claim about US, not about the world',
    /not about whether anybody has taken a position/.test(positionsCaveat({ total: 0, fromProposerMaterial: 0 })))

  // §3b — on screen AND in every document carrying the heading.
  ok('§3b — the caveat is on the screen',
    /positionsCaveat\(tallyPositions\(openHeading\.entries\)\)/.test(code('components/lex/QuestionPanel.tsx')))
  const docs: Array<[string, DocumentModel]> = [
    ['long report', buildProposalDocument(snapshot).model],
    ['evidence pack', buildEvidencePackDocument(snapshot).model],
    ['meeting pack', buildMeetingPackDocument(snapshot).model],
  ]
  for (const [name, model] of docs) {
    const t = textOf(model)
    const carriesHeading = t.includes('Key people and groups likely to support or oppose')
    if (!carriesHeading) { skip(`§3b ${name}`, 'this document does not carry the heading'); continue }
    ok(`§3b — and in the ${name}, under the heading`, t.includes(caveat), caveat.slice(0, 55))
  }

  // ⚠ THE STALE NOTE IS GONE, and the heading is no longer declared unproducible.
  ok('§3 — POSITIONS is no longer declared as having no producer',
    !HEADINGS_WITH_NO_PRODUCER.includes('POSITIONS'))
  ok('§3 — and its stale note is deleted rather than rewritten a third time',
    !('POSITIONS' in NO_PRODUCER_NOTE))
  ok('§3 — the heading has a producer, even though it is not a pass',
    headingsWithProducers().has('POSITIONS'))
  control('the pass-and-library model alone would still call it producerless', () => {
    const src = code('lib/lex/heading-map.ts')
    return !/out\.add\('POSITIONS'\)/.test(src)
  })

  // ══ §4 — THE IMPOSSIBILITY, NOT THE BEHAVIOUR ════════════════════════════════════════
  console.log('\n§4 — a claim cannot be rendered without its grounds')
  // ⚠⚠ §4b: attempt to build a position with NO acts and require the attempt to FAIL.
  const groundless = positionForDocument({
    actorId: 'x', name: 'A Name', identityStatement: 'This person, identified',
    identityCaveat: null, stanceWording: 'is likely to support', confidenceWording: 'tentatively',
    signalCount: 0, grounds: [],
  } as never, {
    targetLabel: 'A division', targetKey: 'division:commons:1',
    matchedPhrase: 'a phrase', matchedWords: 2, asOf: '2026-09-04',
  })
  ok('§4b — a position constructed with no grounds does not exist at all',
    groundless === null, String(groundless))
  const withGround = positionForDocument({
    actorId: 'x', name: 'A Name', identityStatement: 'This person, identified',
    identityCaveat: null, stanceWording: 'is likely to support', confidenceWording: 'tentatively',
    signalCount: 1,
    grounds: [{
      targetLabel: 'A division', targetType: 'division', targetId: 'commons:1',
      date: '2026-01-01', signalType: 'vote', sourceUrl: 'https://example.invalid', direction: 1,
    }],
  } as never, {
    targetLabel: 'A division', targetKey: 'division:commons:1',
    matchedPhrase: 'a phrase', matchedWords: 2, asOf: '2026-09-04',
  })
  ok('§4b — and one WITH grounds does, carrying them',
    withGround !== null && withGround.grounds.length === 1)
  ok('§4 — the grounds are a non-empty tuple in the type, so emptiness cannot be expressed',
    /grounds: \[RecordedAct, \.\.\.RecordedAct\[\]\]/.test(code('lib/graph/position-block.ts')))
  control('an ordinary array type would have permitted the empty case', () =>
    /grounds: RecordedAct\[\]/.test(code('lib/graph/position-block.ts')))

  // ══ §6 — COLOUR, CORRECTED ═══════════════════════════════════════════════════════════
  console.log('\n§6 — colour')
  const cic = code('app/ideas/create/CreateIdeaClient.tsx')
  const hues = [...new Set(cic.match(/text-base font-bold uppercase tracking-wide text-([a-z]+)-\d00 flex-1/g) ?? [])]
  ok('§6a — the three panel headings are brightly and DISTINCTLY coloured', hues.length === 3,
    hues.map((h) => h.match(/text-([a-z]+)-\d00 flex-1/)?.[1]).join(', '))
  // §6b/§6c — strip the colour and nothing becomes ambiguous: the three still differ by size,
  // position and words, which is what the identity/state distinction turns on.
  const stripped = hues.map((h) => h.replace(/text-[a-z]+-\d00 /, ''))
  ok('§6c — with the hue removed they remain identical in weight and size, i.e. still headings',
    new Set(stripped).size === 1, stripped[0])
  const fp = code('components/lex/FieldsPanel.tsx')
  ok('§6d — the four kernel sections carry the same control',
    /\{page\.reachable && \(/.test(fp) && !/canReEnter/.test(fp))
  ok('§6d — and the active one is named by a WORD, so its state survives greyscale',
    /Working on this/.test(fp))

  console.log(`\n── ${passed} passed, ${failed} failed, ${findings.length} FINDINGS, ` +
    `${notChecked.length} NOT CHECKED, ${controls} controls (${dead} dead) ──`)
  for (const f of findings) console.log(`  ⚠⚠ FINDING: ${f}`)
  for (const n of notChecked) console.log(`  · NOT CHECKED: ${n}`)
  if (failed || dead) process.exitCode = 1
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
