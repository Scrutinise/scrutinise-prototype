/**
 * check-surface-4.ts — SURFACE 4.
 *
 * ⚠⚠ THE PROPERTY THIS SPRINT EXISTS TO ESTABLISH, and it is not "the code compiles": **the
 * screen and the generated document resolve the same idea to the same target.** They did not.
 * SURFACE 3 shipped two independent paths and they disagreed on 4 of 25 of Charlie's ideas,
 * every disagreement in the direction where the document showed positions and the clickable card
 * showed nothing. That is the whole of "shows up a couple but you can't click through".
 *
 * ⚠ So the central assertion runs over EVERY LIVE IDEA, not a fixture, and its control plants a
 * divergence by calling the old shape (a text blob with the title left out) and requires the
 * agreement test to fail on it.
 *
 *   npm run check:surface-4
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { targetForIdea, targetForText, whatThisTargetCanYield, explainNoTarget } from '../lib/graph/idea-target'
import { findClaimTarget, claimFor, matchBasis } from '../lib/graph/claim-review'
import { positionForDocument, renderPositionBody, POSITIONS_PASS_KEY } from '../lib/graph/position-block'
import { positionsFor, describeConfidence } from '../lib/graph/positions'
import type { ActorPosition } from '../lib/graph/positions'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument } from '../lib/documents/build-proposal'
import type { Block } from '../lib/documents/model'

const ROOT = join(__dirname, '..')
let pass = 0, fail = 0, notChecked = 0
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
function unchecked(label: string, why: string) {
  notChecked++; console.log(`  ? ${label} — NOT CHECKED: ${why}`)
}
const breaks: Array<{ label: string; fired: boolean }> = []
function expectBreak(label: string, holds: () => boolean) {
  let held: boolean
  try { held = holds() } catch { held = false }
  breaks.push({ label, fired: !held })
}
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

function stringsIn(src: string): string[] {
  return [...src.matchAll(/`([^`]*)`|'([^'\n]*)'/g)].map((m) => m[1] ?? m[2] ?? '')
}
/** ⚠ The same rule as check-surface-3, imported in spirit: a percentage needs its own alternative. */
const FIGURE =
  /\b\d[\d,.]*\s*%|\b\d[\d,.]*\s*(rows|signals|divisions|votes|members|people|records|entries)\b/i
function figuresAbout(src: string): string[] {
  return stringsIn(src).filter((s) =>
    !/SELECT|FROM|WHERE|GROUP BY|ORDER BY|COUNT|FILTER|::|\$\d|information_schema|statement_timeout/.test(s)
    && FIGURE.test(s))
}

function flatten(blocks: Block[]): string {
  const out: string[] = []
  for (const b of blocks) {
    switch (b.kind) {
      case 'section': out.push(b.title); break
      case 'heading':
      case 'paragraph': out.push(b.runs.map((r) => r.text).join('')); break
      case 'bullets': out.push(b.items.map((i) => i.map((r) => r.text).join('')).join(' / ')); break
      case 'sources':
        out.push(b.label)
        for (const r of b.refs) out.push([r.title, r.citation, r.url, r.snippet, r.date].filter(Boolean).join(' · '))
        break
      case 'note': out.push(b.text); break
      case 'rule': break
      default: { const never: never = b; out.push(JSON.stringify(never)) }
    }
  }
  return out.join('\n')
}

async function main() {
  const ideas = await prisma.idea.findMany({
    where: { deletedAt: null }, select: { id: true, title: true }, orderBy: { updatedAt: 'desc' },
  })

  // ══ §1a — ONE RESOLVER. THE SCREEN AND THE DOCUMENT CANNOT DISAGREE ═══════════════════════
  console.log('\n── §1a — the card and the document resolve the same idea to the same target ──')
  let compared = 0, agree = 0
  const divergences: string[] = []
  for (const idea of ideas) {
    const viaResolver = await targetForIdea(idea.id)
    const viaCard = await findClaimTarget(idea.id)
    compared++
    const a = viaResolver ? `${viaResolver.target.type}:${viaResolver.target.id}` : 'NONE'
    const b = viaCard ? `${viaCard.targets[0].type}:${viaCard.targets[0].id}` : 'NONE'
    if (a === b) agree++
    else divergences.push(`${idea.id.slice(0, 8)} resolver=${a} card=${b}`)
  }
  ok('every live idea resolves identically through both paths',
    divergences.length === 0,
    divergences.length ? divergences.slice(0, 3).join(' | ') : `${agree} of ${compared} agree`)

  // ⚠ THE CONTROL: the OLD shape — a text blob with the title left out — must diverge on at
  // least one idea, or this assertion is not testing anything.
  const titleMatters: string[] = []
  for (const idea of ideas.slice(0, 40)) {
    const el = await prisma.ideaElicitation.findUnique({
      where: { ideaId: idea.id }, select: { problem: true, goalDetail: true },
    })
    const body = `${el?.problem ?? ''} ${el?.goalDetail ?? ''}`.trim()
    const withTitle = await targetForText(idea.title ?? '', body)
    const withoutTitle = await targetForText('', body)   // the pre-SURFACE-4 behaviour
    const a = withTitle ? `${withTitle.target.type}:${withTitle.target.id}` : 'NONE'
    const b = withoutTitle ? `${withoutTitle.target.type}:${withoutTitle.target.id}` : 'NONE'
    if (a !== b) titleMatters.push(`${idea.id.slice(0, 8)} ${a} vs ${b}`)
  }
  ok('dropping the title really does change the answer — so the fix was load-bearing',
    titleMatters.length > 0,
    `${titleMatters.length} ideas differ: ${titleMatters.slice(0, 2).join(' | ')}`)
  expectBreak('§1a break: the old title-less resolution must NOT agree everywhere',
    () => titleMatters.length === 0)

  // ══ §1b — NOTHING IS SHOWN THAT CANNOT BE OPENED ═════════════════════════════════════════
  console.log('\n── §1b — every act shown carries a way to open it ──')
  const filedRows = await prisma.evidenceItem.findMany({
    where: { passKey: POSITIONS_PASS_KEY, title: { contains: 'recorded acts' } },
    select: { id: true, ideaId: true, title: true, url: true, body: true },
    take: 40,
  })
  if (!filedRows.length) {
    unchecked('filed positions carry a link', 'no positions have been filed yet')
  } else {
    const noUrl = filedRows.filter((r) => !r.url)
    ok('every filed position row carries a source URL the panel can turn into a link',
      noUrl.length === 0, `${filedRows.length - noUrl.length} of ${filedRows.length} have one`)
    // ⚠ THE BODY MUST BE PLAIN TEXT. The question panel renders it with `whitespace-pre-wrap`
    // and NOT as markdown, so bold markers and list dashes show as literal characters.
    const md = filedRows.filter((r) => /\*\*|^\s*-\s/m.test(r.body ?? ''))
    ok('no filed body contains markdown the panel would print literally',
      md.length === 0, md.length ? md[0].title.slice(0, 50) : `${filedRows.length} bodies checked`)
    const urlInBody = filedRows.filter((r) => /https?:\/\//.test(r.body ?? ''))
    ok('each body spells its act out with the source beside it',
      urlInBody.length === filedRows.length,
      `${urlInBody.length} of ${filedRows.length}`)
    expectBreak('§1b break: a body with a markdown bullet must be caught',
      () => !/\*\*|^\s*-\s/m.test('- **Voted** against\n'))
  }

  // ══ §1c — THE ORDER SAYS WHAT IT IS ══════════════════════════════════════════════════════
  console.log('\n── §1c — an alphabetical slice is never presented as a ranking ──')
  const bigIdea = ideas.find((i) => /Human Rights|Sentencing/i.test(i.title ?? ''))
  if (!bigIdea) {
    unchecked('the ranking note reaches the surface', 'no idea with a large division target')
  } else {
    const t = await targetForIdea(bigIdea.id)
    if (!t) {
      unchecked('the ranking note reaches the surface', 'that idea no longer resolves to a target')
    } else {
      const r = await positionsFor([t.target], { limit: 5, actorKind: 'person' })
      ok('the graph reports the order it actually used',
        r.ranking.ofMatched > r.ranking.shown && r.ranking.note !== null,
        `${r.ranking.ofMatched} matched, ${r.ranking.shown} shown, note=${r.ranking.note ? 'present' : 'NULL'}`)
      // ⚠ AND IT REACHES THE PAYLOAD. This is the field SURFACE 3 computed and dropped, twice.
      const c = await claimFor([t.target], null, 'q', null)
      ok('the claim payload carries the ranking, not just the graph',
        !!c && c.question.ranking.ofMatched === r.ranking.ofMatched,
        `payload says ${c?.question.ranking.ofMatched}`)
      // ⚠ AND THE DOCUMENT PRINTS IT.
      const filed = await prisma.evidenceItem.findFirst({
        where: { ideaId: bigIdea.id, passKey: POSITIONS_PASS_KEY, title: { contains: 'recorded acts' } },
        select: { body: true },
      })
      ok('the generated document says how many people it is showing out of how many',
        /Who else is here/.test(filed?.body ?? ''),
        filed ? (filed.body ?? '').split('\n').find((l) => l.startsWith('Who else'))?.slice(0, 80) : 'no row')
      expectBreak('§1c break: a body with the ranking line removed must not pass',
        () => /Who else is here/.test((filed?.body ?? '').replace(/Who else is here[^\n]*/g, '')))
    }
  }

  // ══ §1d — ONE CONFIDENCE VOCABULARY ══════════════════════════════════════════════════════
  console.log('\n── §1d — every word about certainty comes from the shared function ──')
  const vocab = new Set([describeConfidence(0.9), describeConfidence(0.5), describeConfidence(0.1)])
  ok('the shared function yields exactly three bands', vocab.size === 3, [...vocab].join(' | '))
  const surfaces = ['lib/graph/position-block.ts', 'components/lex/ClaimReview.tsx',
    'lib/graph/claim-review.ts']
  const invented = surfaces.filter((f) => /\b(?:very likely|almost certain|probably|fairly confident)\b/i.test(read(f)))
  ok('no positions surface invents its own adjective for certainty',
    invented.length === 0, invented.join(', ') || `${surfaces.length} files scanned`)
  expectBreak('§1d break: an invented adjective must be caught',
    () => !/\b(?:very likely|almost certain|probably|fairly confident)\b/i.test('we are fairly confident'))
  // ⚠ AND THE DOCUMENT PRINTS THE NUMBER TOO — three bands cannot separate 0.36 from 0.64.
  const anyRow = await prisma.evidenceItem.findFirst({
    where: { passKey: POSITIONS_PASS_KEY, title: { contains: 'recorded acts' } },
    select: { body: true }, orderBy: { createdAt: 'desc' },
  })
  ok('a filed position row exists to read this off', !!anyRow)
  ok('the document prints the confidence as a number as well as in words',
    /on a scale of 0 to 1/.test(anyRow?.body ?? ''),
    (anyRow?.body ?? '').split('\n').find((l) => l.includes('Confidence:'))?.slice(0, 90) ?? 'no row')

  // ══ §1e — FACT AND ESTIMATE ARE PRESENTED DIFFERENTLY ════════════════════════════════════
  console.log('\n── §1e — a recorded act carries no hedge; an estimate says it is one ──')
  const body = anyRow?.body ?? ''
  ok('the estimate names itself as an estimate',
    /an estimate and not a finding/.test(body))
  ok('the recorded act is stated plainly, above the estimate',
    body.indexOf('What the record shows') >= 0
    && body.indexOf('What the record shows') < body.indexOf('Our reading'),
    'record first, reading second')
  expectBreak('§1e break: the reading printed above the record',
    () => {
      const bad = 'Our reading of those acts…\nWhat the record shows…'
      return bad.indexOf('What the record shows') < bad.indexOf('Our reading')
    })

  // ══ §1f — THE ASSESSMENT IS ABSENT FROM THE PAYLOAD, NOT HIDDEN IN IT ════════════════════
  console.log('\n── §1f — the blind-judgement order survives the drill-down work ──')
  const routeSrc = read('app/api/graph/claim/route.ts')
  const get = routeSrc.slice(routeSrc.indexOf('export async function GET'), routeSrc.indexOf('const PostSchema'))
  const returned = get.slice(get.lastIndexOf('return NextResponse.json'))
  ok('the GET returns the question and never the assessment',
    !/assessment/.test(returned) && /found\.question/.test(returned), returned.slice(0, 70))
  expectBreak('§1f break: a GET that leaks the assessment',
    () => !/assessment/.test('return NextResponse.json({ claim: found.question, assessment: found.assessment })'))

  // ══ §2 — THE THREE KINDS OF NOTHING ══════════════════════════════════════════════════════
  console.log('\n── §2 — an empty answer says WHICH kind of empty it is ──')
  const noPhrase = await explainNoTarget('', '')
  ok('an idea that names nothing concrete gets the design explanation, not an apology',
    noPhrase.reason === 'no-phrases' && /never of topics/.test(noPhrase.text))
  ok('none of the three sentences says "no results"',
    !/no results/i.test(noPhrase.text))
  // ⚠ AND NO FIGURE ABOUT THE GRAPH MAY BE WRITTEN INTO THESE SENTENCES. A first draft of the
  // third one said "our Commons division record begins in March 2016" — a hardcoded figure, in a
  // file no check was grepping, one sprint after the rule was written.
  const idFigures = figuresAbout(read('lib/graph/idea-target.ts'))
  ok('idea-target.ts states no figure about the graph in any string',
    idFigures.length === 0,
    idFigures.length ? idFigures.slice(0, 2).map((f) => JSON.stringify(f.slice(0, 50))).join(' | ') : 'clean')
  expectBreak('§2 break: a hardcoded coverage figure in idea-target.ts',
    () => figuresAbout(`const bad = 'our record holds 2,361 divisions'`).length === 0)

  // ⚠ AND THE LIMIT OF AN EDM TARGET IS STATED, because one name under a motion is the most a
  // motion can ever give us — a limit, not a thin result.
  ok('an EDM target explains why one name is the most it can show',
    /not the members who signed it/.test(whatThisTargetCanYield('edm'))
    && /everyone who voted/.test(whatThisTargetCanYield('division')))

  // ══ §3 — WHAT THE PRINTED DOCUMENT CARRIES ═══════════════════════════════════════════════
  console.log('\n── §3 — the printed document carries what a reader needs to check it ──')
  // ⚠⚠ THE SUBJECT MUST BE AN IDEA WHOSE TARGET IS A DIVISION. "Party at the time" comes off
  // the vote record, so an EDM-backed position legitimately has none — asserting it over an
  // arbitrary idea would fail on correct behaviour, which is a check that cries wolf and gets
  // switched off. The first run of this check did exactly that.
  let docIdea: { ideaId: string } | null = null
  for (const idea of ideas) {
    const t = await targetForIdea(idea.id)
    if (t?.target.type !== 'division') continue
    const row = await prisma.evidenceItem.findFirst({
      where: { ideaId: idea.id, passKey: POSITIONS_PASS_KEY, title: { contains: 'recorded acts' } },
      select: { ideaId: true },
    })
    if (row) { docIdea = row; break }
  }
  if (!docIdea) {
    unchecked('the long report carries a full position',
      'no idea currently resolves to a DIVISION target with filed positions — party at the time '
      + 'exists only on a vote, so this cannot be asserted over an EDM-backed idea')
  } else {
    const snap = await buildProposalSnapshot(docIdea.ideaId)
    const text = flatten(buildProposalDocument(snap).model.blocks)
    for (const [what, present] of [
      ['the actor and an identifier', /Parliament member id \d+/.test(text)],
      ['the party at the time of the act', /sitting as /.test(text)],
      ['the concrete target with its date', /recorded acts bearing on/.test(text)],
      ['the confidence in words and as a number', /on a scale of 0 to 1/.test(text)],
      ['every supporting act with its source', /https?:\/\//.test(text)],
      ['the config version and the date computed', /under method 3c\./.test(text)],
      ['the coverage statement beside the positions', /no data at all of these kinds/.test(text)],
    ] as Array<[string, boolean]>) {
      ok(`the long report carries ${what}`, present)
    }
    expectBreak('§3 break: a document with the party line stripped',
      () => /sitting as /.test(text.replace(/, sitting as [^)]*/g, '')))
  }

  // ══ THE TALLY ════════════════════════════════════════════════════════════════════════════
  console.log('\n── negative controls (each must FIRE on broken input) ──')
  let dead = 0
  for (const b of breaks) {
    console.log(`  ${b.fired ? '✓ fired' : '✗ DEAD  '}  ${b.label}`)
    if (!b.fired) dead++
  }
  console.log(`\n${pass} passed, ${fail} failed, ${notChecked} not checked, `
    + `${breaks.length} controls, ${dead} dead`)
  if (fail || dead) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
