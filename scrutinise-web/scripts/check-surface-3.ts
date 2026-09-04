/**
 * check-surface-3.ts — SURFACE 3 §1 and §2.
 *
 * ⚠⚠ WHAT THIS EXISTS TO PREVENT, IN THE BRIEF'S OWN WORDS: a coverage statement that is a
 * DECORATION — "a caveat that looks right, reads well, and would say exactly the same words if
 * the corpus doubled or emptied". So every assertion here has a paired negative that is watched
 * FIRING, and the two the brief names by name are:
 *
 *   · watch it fail against a build with the statement HARDCODED;
 *   · watch it fail against a build where a signal type with NO DATA is omitted rather than named.
 *
 * ⚠ AND THE VALUE ASSERTIONS READ THE RUNNING SYSTEM (CLAUDE.md §25). The dates in the coverage
 * block are compared against a direct query of `divisions`; the document assertions RENDER the
 * three documents through the real builders and read the text out. A grep would pass on a page
 * nobody can reach.
 *
 * ⚠ THE DOCUMENT CASE IS A COLD READ (CLAUDE.md §26) WHERE IT CAN BE. Its subject is whatever
 * idea already carries filed positions, chosen by what has happened rather than by what the check
 * needs; where no such idea exists it is reported NOT CHECKED, never skipped silently.
 *
 *   npm run check:surface-3
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { getNeonPool } from '../lib/pg-pool'
import {
  getPositionCoverage, describePositionCoverage, coverageSentences, ladder,
  resetPositionCoverageCache, ANSWER_KEY_TABLE, type PositionCoverage,
} from '../lib/graph/position-coverage'
import { POSITION_CONFIG } from '../lib/graph/position-config'
import { extractPhrasesFrom, extractPhrases } from '../lib/graph/phrases'
import { positionForDocument, POSITIONS_PASS_KEY, coverageTitle } from '../lib/graph/position-block'
import type { ActorPosition } from '../lib/graph/positions'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument } from '../lib/documents/build-proposal'
import { buildEvidencePackDocument } from '../lib/documents/build-evidence-pack'
import { buildMeetingPackDocument } from '../lib/documents/build-meeting-pack'
import type { Block } from '../lib/documents/model'

const ROOT = join(__dirname, '..')
let pass = 0, fail = 0, notChecked = 0

function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
function unchecked(label: string, why: string) {
  notChecked++
  console.log(`  ? ${label} — NOT CHECKED: ${why}`)
}

const breaks: Array<{ label: string; fired: boolean }> = []
/** Run `propertyHolds` on DELIBERATELY BROKEN input and require it to be false. */
function expectBreak(label: string, propertyHolds: () => boolean) {
  let held: boolean
  try { held = propertyHolds() } catch { held = false }
  breaks.push({ label, fired: !held })
}

/**
 * Which files import a component, by name. ⚠ §23.1: "It is written down" and "it is reached" are
 * different claims, and only the second is about the product.
 */
function importersOf(name: string): string[] {
  const out: string[] = []
  for (const dir of ['components/lex', 'components/admin', 'app/ideas', 'app/admin', 'components']) {
    let entries: string[] = []
    try { entries = readdirSync(join(ROOT, dir)) } catch { continue }
    for (const f of entries) {
      if (!/\.tsx?$/.test(f)) continue
      const rel = `${dir}/${f}`
      let src = ''
      try { src = read(rel) } catch { continue }
      // The component's own file is not an importer of itself.
      if (new RegExp(`^${name}\.tsx?$`).test(f)) continue
      if (new RegExp(`import[^\n]*${name}[^\n]*from|from '[^']*/${name}'`).test(src)) out.push(rel)
    }
  }
  return out
}

/** ⚠ Normalised on read — a Python edit helper writes CRLF on Windows. */
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
}

/** Every quoted string and template literal in a file, minus SQL. */
function stringsIn(src: string): string[] {
  return [...src.matchAll(/`([^`]*)`|'([^'\n]*)'/g)].map((m) => m[1] ?? m[2] ?? '')
}

/**
 * ⚠ THE RULE, AS ONE FUNCTION, SO THE ASSERTION AND ITS CONTROL CANNOT DRIFT.
 * CLAUDE.md §26.5: a shared function beats a guard against drift. The first draft of this check
 * had the predicate written out twice — once for the file and once for the planted violation —
 * which asserts that two copies of a regex agree.
 */
function figuresAboutTheGraph(src: string): string[] {
  return stringsIn(src).filter((s) =>
    !/SELECT|FROM|WHERE|GROUP BY|ORDER BY|COUNT|FILTER|::|\$\d|information_schema/.test(s) &&
    FIGURE.test(s))
}

/**
 * ⚠⚠ A NUMBER FOLLOWED BY A UNIT — AND THE PERCENTAGE CASE IS ITS OWN ALTERNATIVE, BECAUSE THE
 * OBVIOUS FORM CANNOT MATCH ONE.
 *
 * The natural way to write this is a single alternation ending in a word boundary:
 *
 *     /\b\d[\d,.]* \s*(rows|%|signals|…)\b/i
 *
 * That expression can NEVER flag "46%". `%` is a non-word character and so is the space after it,
 * so the trailing `\b` has no boundary to sit on and the whole match fails. The rule looked
 * complete, read as complete, and was blind to the single commonest way of stating a figure about
 * a corpus. Found by planting "we hold 46% of divisions" and watching the control come back DEAD.
 *
 * ⚠ `scripts/ingest/graph/check-4a-coverage.ts` carries the same construction and therefore the
 * same blind spot. That file belongs to the graph stream; it is reported in
 * `docs/SURFACE_3_REPORT.md` rather than edited here.
 *
 * ⚠ AND BARE "of" IS NOT A UNIT. It was in the first draft and fired on "§2 of the design
 * document" — a section reference, not a figure. "13 of 29 rows" is still caught, by "29 rows".
 */
const FIGURE =
  /\b\d[\d,.]*\s*%|\b\d[\d,.]*\s*(rows|signals|divisions|votes|members|people|records|entries)\b/i

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
        for (const r of b.refs) {
          out.push([r.title, r.citation, r.url, r.snippet, r.date].filter(Boolean).join(' · '))
        }
        break
      case 'note': out.push(b.text); break
      case 'rule': break
      // ⚠ A block kind added later must break this check rather than be silently dropped, which
      // is how the first version of this flattener produced a FALSE NEGATIVE about the product.
      default: { const never: never = b; out.push(JSON.stringify(never)) }
    }
  }
  return out.join('\n')
}

async function main() {
  const pool = getNeonPool()
  resetPositionCoverageCache()

  // ══ §1a — NO FIGURE ABOUT THE GRAPH MAY BE HARDCODED ═══════════════════════════════════════
  console.log('\n── §1a — the coverage statement is generated, never written down ──')
  const covSrc = read('lib/graph/position-coverage.ts')
  const offenders = figuresAboutTheGraph(covSrc)
  ok('no string in position-coverage.ts states a figure about the graph',
    offenders.length === 0,
    offenders.length ? `offenders: ${offenders.slice(0, 3).map((o) => JSON.stringify(o.slice(0, 60))).join(' | ')}`
      : `${stringsIn(covSrc).length} strings scanned`)
  // ⚠ THE BRIEF'S FIRST NAMED CONTROL: a build with the statement hardcoded must FAIL.
  expectBreak('§1a break: the statement hardcoded — "the Commons record holds 2,361 divisions"',
    () => figuresAboutTheGraph(
      covSrc.replace('const lines: string[] = []',
        'const lines: string[] = []\n  const bad = `the Commons record holds 2,361 divisions`')).length === 0)
  expectBreak('§1a break: a percentage about the corpus',
    () => figuresAboutTheGraph(
      covSrc.replace('const lines: string[] = []',
        "const lines: string[] = []\n  const bad = 'we hold 46% of divisions'")).length === 0)

  // ⚠ AND THE SAME RULE OVER THE SURFACES, because a caveat moved into a component is a caveat
  // that stopped being generated. §23.1: the assertion has to be about what a user sees.
  for (const rel of ['components/lex/ClaimReview.tsx', 'lib/graph/position-block.ts']) {
    const bad = figuresAboutTheGraph(read(rel))
    ok(`${rel} states no figure about the graph either`, bad.length === 0,
      bad.length ? bad.slice(0, 2).map((b) => JSON.stringify(b.slice(0, 50))).join(' | ') : 'clean')
  }

  // ══ §1b — EVERY SIGNAL TYPE IS NAMED, INCLUDING THE ONES WITH NO DATA ══════════════════════
  console.log('\n── §1b — every signal type in the ladder is named on every run ──')
  const cov = await getPositionCoverage()
  const block = describePositionCoverage(cov).join('\n')
  const configTypes = Object.keys(POSITION_CONFIG.halfLifeYears)

  ok('the ladder is DERIVED from the config, not restated',
    ladder().length === configTypes.length && ladder().every((t) => configTypes.includes(t)),
    `${ladder().length} types: ${ladder().join(', ')}`)
  ok('every signal type in the config appears in the coverage block',
    configTypes.every((t) => block.includes(t)),
    configTypes.filter((t) => !block.includes(t)).join(', ') || 'all present')
  // ⚠ THE BRIEF'S SECOND NAMED CONTROL: a build that OMITS a type with no data must fail.
  expectBreak('§1b break: a signal type with no data omitted rather than named',
    () => {
      const withoutOne = describePositionCoverage({
        ...cov, layers: cov.layers.filter((l) => l.status !== 'no-source-data'),
      }).join('\n')
      return configTypes.every((t) => withoutOne.includes(t))
    })

  const absent = cov.layers.filter((l) => l.status === 'no-source-data')
  ok('the types with no source data are reported as such, by name',
    absent.length > 0 && absent.every((l) => l.heldRows === 0),
    absent.length ? absent.map((l) => l.signalType).join(', ') : 'NONE — every type has data')
  ok('a type with no source data is NEVER reported as "searched and found nothing"',
    !cov.layers.some((l) => l.heldRows === 0 && l.status === 'searched-none'))
  // ⚠ AND `used` MUST NOT BE ABLE TO PROMOTE A TYPE THAT HOLDS NOTHING. The order of the tests in
  // `getPositionCoverage` is what enforces it; this is the case that would catch a reordering.
  const forced = await getPositionCoverage({
    used: Object.fromEntries(configTypes.map((t) => [t, { n: 99 }])),
  })
  ok('a caller claiming a type contributed cannot promote one that holds no rows',
    forced.layers.filter((l) => l.heldRows === 0).every((l) => l.status === 'no-source-data'),
    forced.layers.filter((l) => l.heldRows === 0).map((l) => `${l.signalType}=${l.status}`).join(', '))

  // ══ §1c — THE FIGURES MOVE WITH THE DATABASE ═══════════════════════════════════════════════
  console.log('\n── §1c — the figures are read from the database, not from this repository ──')
  const { rows: dv } = await pool.query<{ house: string; earliest: string; n: string }>(
    `SELECT house, MIN(division_date)::text earliest, COUNT(*)::bigint n FROM divisions GROUP BY 1`)
  for (const h of dv) {
    const w = cov.records.find((r) => r.id === `divisions:${h.house}`)
    ok(`the ${h.house} window matches a direct query of divisions`,
      w?.earliest === h.earliest && w?.rows === Number(h.n),
      `block says ${w?.earliest}/${w?.rows}, the table says ${h.earliest}/${h.n}`)
  }
  const commons = dv.find((d) => d.house === 'commons')
  if (commons) {
    const sentences = coverageSentences(cov).join(' ')
    ok('the Commons start date is stated in ordinary words on the user surface',
      sentences.includes(String(new Date(`${commons.earliest}T00:00:00Z`).getUTCFullYear())),
      `earliest ${commons.earliest}`)
    expectBreak('§1c break: the block asserting a date the table does not hold',
      () => describePositionCoverage(cov).join('\n').includes('1901-01-01'))
  }

  // ══ §1d — THE ESTIMATE SAYS IT HAS NEVER BEEN SCORED, AND SAYS IT LIVE ═════════════════════
  console.log('\n── §1d — the answer key is probed, not assumed ──')
  const { rows: [tbl] } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::int n FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1`, [ANSWER_KEY_TABLE])
  ok('the answer-key probe agrees with information_schema',
    cov.answerKey.exists === (Number(tbl.n) > 0),
    `probe says ${cov.answerKey.exists}, schema says ${Number(tbl.n) > 0}`)
  ok('an unscored estimate is described as unscored, in ordinary words',
    cov.answerKey.scored > 0
      ? coverageSentences(cov).join(' ').includes('scored against')
      : coverageSentences(cov).join(' ').includes('never been scored against a verified answer key'),
    `${cov.answerKey.scored} scored cases`)
  // ⚠ THE SENTENCE MUST FLIP BY ITSELF when a key lands. Fed a coverage object with a scored key,
  // the "never been scored" sentence must be gone — otherwise it is a decoration.
  expectBreak('§1d break: the "never scored" sentence surviving a populated answer key',
    () => coverageSentences({
      ...cov, answerKey: { table: ANSWER_KEY_TABLE, exists: true, scored: 40 },
    }).join(' ').includes('never been scored'))
  ok('a user judgement is never counted as an answer key',
    !coverageSentences({ ...cov, corroboration: { judgements: 9, judges: 3 } }).join(' ')
      .replace(/never been scored against a verified answer key/, '')
      .includes('scored against'),
    'judgements are reported as corroboration')

  // ══ §1e — THE STATEMENT REACHES A SURFACE ═════════════════════════════════════════════════
  // §23.1: an assertion about what a user sees must first prove the file is reached.
  console.log('\n── §1e — the statement is reachable from a route and a component ──')
  const claimRoute = read('app/api/graph/claim/route.ts')
  const adminRoute = read('app/api/admin/positions/route.ts')
  const claimUi = read('components/lex/ClaimReview.tsx')
  ok('the user-facing claim route imports the coverage module',
    /position-coverage/.test(claimRoute))
  ok('the admin positions route imports it too', /position-coverage/.test(adminRoute))
  ok('the component renders the sentences it is given',
    /coverageNotes/.test(claimUi) && /CoverageStatement/.test(claimUi))
  ok('the empty path carries the statement as well as the answered one',
    (claimRoute.match(/coverageNotes: coverageSentences/g) ?? []).length >= 2,
    `${(claimRoute.match(/coverageNotes/g) ?? []).length} references`)
  // ⚠ §23.1 — AN ASSERTION ABOUT WHAT A USER SEES MUST FIRST PROVE THE FILE IS RENDERED. A
  // component nothing imports cannot be what a user sees, and a negative control cannot catch
  // that: corrupting a dead file still makes the assertion reject it.
  const importers = importersOf('ClaimReview')
  ok('ClaimReview has an importer, so these assertions are not over dead code',
    importers.length > 0, importers.join(', ') || 'NONE — this whole section is about dead code')
  expectBreak('§1e break: a component nothing imports must not pass the reachability test',
    () => importersOf('NoSuchComponentXyz').length > 0)

  // ══ §2a — A POSITION CANNOT EXIST WITHOUT ITS GROUNDS ═════════════════════════════════════
  console.log('\n── §2a — the claim and its grounds are ONE object ──')
  const bareActor = {
    actorId: 'x', name: 'A Member', kind: 'person', identityTier: 't',
    identityStatement: 'Stable external key', identityCaveat: null, parlMemberId: 1,
    stanceScore: 0.5, consistency: 0.5, confidence: 0.5, confidenceWording: 'some recorded signals',
    stanceWording: 'supported', signalCounts: {}, claim: 'supported — for "X" (2020-01-01)',
    claimCaveat: null, byTarget: [], divided: false, signalCount: 0,
    grounds: [],
  } as unknown as ActorPosition
  const ctx = { targetLabel: 'X', targetKey: 'division:commons:1', matchedPhrase: 'x y', matchedWords: 2, asOf: '2026-09-03' }
  ok('an actor with no grounds yields NO position object at all',
    positionForDocument(bareActor, ctx) === null)
  const withGround = positionForDocument({
    ...bareActor,
    grounds: [{
      targetType: 'division', targetId: 'commons:1', targetLabel: 'X', date: '2020-01-01',
      signalType: 'vote', derivation: null, direction: -1, weight: 0.9, sourceUrl: 'https://x',
      evidenceIds: ['e'],
    }],
  } as unknown as ActorPosition, ctx)
  ok('an actor WITH grounds yields one, carrying them', withGround !== null && withGround.grounds.length === 1)
  ok('the object carries the freeze — the date and the config version',
    !!withGround && withGround.asOf === '2026-09-03' && /^3c\./.test(withGround.configVersion),
    withGround?.configVersion)

  // ══ §2b — THE PHRASE MATCHER, ON CONSTRUCTED CASES ════════════════════════════════════════
  console.log('\n── §2b — the idea→target matcher ──')
  ok('a single word is never offered as a match',
    extractPhrases('diversity permanent equity appointed').every((p) => p.words >= 2))
  ok('a phrase with only one content word is rejected',
    !extractPhrases('the public and private').some((p) => p.text === 'public and private'),
    'public and private → 1 content word')
  ok('a real subject survives',
    extractPhrases('the civil service is plagued by problems').some((p) => p.text === 'civil service'))
  ok('a phrase is not built across a full stop',
    !extractPhrases('reform of bureaucracy. The civil service is slow')
      .some((p) => p.text.includes('bureaucracy the')))
  ok('a title phrase outranks a body phrase',
    (() => {
      const ph = extractPhrasesFrom('Civil Service Accountability', 'a long body about northern ireland')
      const civil = ph.findIndex((p) => p.text === 'civil service')
      const ni = ph.findIndex((p) => p.text === 'northern ireland')
      return civil >= 0 && ni >= 0 && civil < ni
    })(),
    'the proposer’s own title is the only thing that can tell a subject from a mention')
  // ⚠ THE ORIGINAL DEFECT, AS A CASE: the whole problem statement as one pattern matches nothing.
  expectBreak('§2b break: the old whole-string match — a 200-char statement as one ILIKE pattern',
    () => {
      const statement = 'The civil service is plagued by the same issues as any bureaucracy, but '
        + 'worse because it is a public service so it has none of the pressures that keep a '
        + 'private sector organisation honest about its own performance over time'
      // A division title would have to CONTAIN this entire sentence for the old code to match.
      return 'Civil Service pensions'.toLowerCase().includes(statement.toLowerCase())
    })

  // ══ §2c — THE COLD READ: DOES THE DOCUMENT ACTUALLY CARRY IT? ═════════════════════════════
  console.log('\n── §2c — the cold read: what the three documents actually print ──')
  // ⚠ SUBJECT CHOSEN BY WHAT HAS HAPPENED, NOT BY WHAT THE CHECK NEEDS (§26). Nothing is filed
  // here; an idea that already carries filed positions is read as it stands.
  const subject = await prisma.evidenceItem.findFirst({
    where: { headingKey: 'POSITIONS', passKey: POSITIONS_PASS_KEY },
    select: { ideaId: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!subject) {
    unchecked('the documents carry a filed position',
      `no idea has rows at passKey='${POSITIONS_PASS_KEY}' yet — run "npm run positions:file -- --all"`)
  } else {
    const snapshot = await buildProposalSnapshot(subject.ideaId)
    const rows = snapshot.evidence.filter((e) => e.headingKey === 'POSITIONS'
      && e.passKey === POSITIONS_PASS_KEY)
    ok('the snapshot carries the filed positions', rows.length > 0, `${rows.length} rows`)

    const docs: Array<[string, Block[]]> = [
      ['long report', buildProposalDocument(snapshot).model.blocks],
      ['evidence pack', buildEvidencePackDocument(snapshot).model.blocks],
      ['meeting pack', buildMeetingPackDocument(snapshot).model.blocks],
    ]
    const HEADING = 'Key people and groups likely to support or oppose'
    for (const [name, blocks] of docs) {
      const text = flatten(blocks)
      ok(`${name}: the POSITIONS heading is present`, text.includes(HEADING))
      // ⚠ THE ACT, NOT THE ASSESSMENT. A document carrying a stance with no dated act behind it
      // is the thing §2 forbids, so this asserts the ACT reached the page.
      const anyRow = rows.find((r) => /recorded acts bearing on/.test(r.title))
      if (anyRow) {
        ok(`${name}: a position's own title reaches the page`, text.includes(anyRow.title))
      } else {
        unchecked(`${name}: a position's title reaches the page`,
          'this idea filed a coverage row but no position row')
      }
      // ⚠ THE COVERAGE STATEMENT, AT LEAST ONCE, IN SOME FORM. The brief asks for it to be
      // carried into the document; the three builders print different fields, so the assertion is
      // that SOMETHING of it survives in each, and the strength is reported rather than assumed.
      const full = text.includes('no data at all of these kinds')
      const oneLine = /have no source data/.test(text)
      ok(`${name}: the coverage statement reaches it`, full || oneLine,
        full ? 'in full' : oneLine ? 'as a one-line summary' : 'ABSENT')
      ok(`${name}: the method and date travel with it`,
        /method 3c\./.test(text) || /under method/.test(text))
    }
    expectBreak('§2c break: a snapshot with the positions rows removed must not pass',
      () => {
        const stripped = { ...snapshot, evidence: snapshot.evidence.filter((e) => e.passKey !== POSITIONS_PASS_KEY) }
        return flatten(buildProposalDocument(stripped).model.blocks).includes('recorded acts bearing on')
      })
  }

  // ══ §2d — THE COVERAGE TITLE CARRIES SUBSTANCE, GENERATED ════════════════════════════════
  console.log('\n── §2d — the summary documents get more than a promise ──')
  const title = coverageTitle(cov)
  ok('the coverage row’s title states what is missing, not just that something is',
    title.length > 'What this section does not cover'.length,
    title.slice(0, 90))
  expectBreak('§2d break: a coverage title with no live figures in it',
    () => coverageTitle({
      ...cov, layers: [], records: [],
    } as PositionCoverage).length > 'What this section does not cover'.length)

  // ── the tally ────────────────────────────────────────────────────────────────────────────
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
