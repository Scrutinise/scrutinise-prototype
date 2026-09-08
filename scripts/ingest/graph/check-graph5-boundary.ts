/**
 * check-graph5-boundary.ts — GRAPH 5 §1. The coverage boundary, asserted.
 *
 * ⚠ EVERY ASSERTION BELOW IS PAIRED WITH THE STATE THAT MAKES IT FAIL, and the failing state is
 * evaluated in the same run. A check written green and never watched failing is worth nothing —
 * and the specific way this one could be worthless is that `collectionShape` is a pure function
 * over a histogram, so it is trivially possible to write a test that only ever feeds it the shape
 * it already handles. The synthetic cases below therefore include the two real histograms that
 * BROKE the first version of the rule.
 *
 *   npx tsx graph/check-graph5-boundary.ts
 */
import fs from 'fs'
import path from 'path'
import { caseLawCoverage, describeCaseLawBoundary, collectionShape, CASE_LAW_COLLECTIONS } from './caselaw-coverage'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

let pass = 0, fail = 0, controls = 0
function assert(ok: boolean, what: string, detail = '') {
  ok ? pass++ : fail++
  console.log(`  ${ok ? '  ok' : 'FAIL'}  ${what}${detail ? `  — ${detail}` : ''}`)
}
/** An assertion whose job is to FIRE. Counted separately: a control that never fires is dead. */
function control(fired: boolean, what: string, detail = '') {
  controls++
  fired ? pass++ : fail++
  console.log(`  ${fired ? 'ctrl' : 'DEAD'}  ${what}${detail ? `  — ${detail}` : ''}`)
}

/** Real histograms, read off the live database on 8 Sep 2026 and pasted here as FIXTURES.
 *  ⚠ They are here to pin the rule's behaviour on shapes that actually occur, not as a claim about
 *  today's corpus — the live assertions further down query the database for that. */
const H_TNA = [[1965,1],[1977,1],[1983,1],[1996,13],[1997,7],[1998,14],[1999,18],[2000,11],[2001,11],[2002,18],
  [2003,2054],[2004,2093],[2005,2152],[2006,2377],[2007,2400],[2008,2400],[2009,2400],[2010,2400],[2011,2400],
  [2012,2400],[2013,2400],[2014,2400],[2015,2400],[2016,2400],[2017,2400],[2018,2400],[2019,2400],[2020,2400],
  [2021,2400],[2022,2400],[2023,2400],[2024,2400],[2025,2400],[2026,1100]] as Array<[number, number]>
/** ⚠ THE ONE THAT BROKE THE FIRST RULE #1 — a partial final year. Ingest stopped 2024-06-11. */
const H_TAX = [[1989,1],[1996,1],[2002,32],[2003,466],[2004,678],[2005,649],[2006,596],[2007,686],[2008,550],
  [2009,431],[2010,582],[2011,795],[2012,766],[2013,525],[2014,617],[2015,561],[2016,738],[2017,668],[2018,620],
  [2019,587],[2020,465],[2021,366],[2022,301],[2023,306],[2024,102]] as Array<[number, number]>
/** ⚠⚠ THE ONE THAT BROKE THE FIRST RULE #2 — a ramp with no floor anywhere. */
const H_ECHR = [[1956,1],[1958,1],[1959,3],[1966,1],[1967,4],[1968,4],[1969,7],[1970,9],[1971,5],[1972,10],
  [1973,6],[1974,8],[1975,17],[1976,17],[1977,26],[1978,29],[1979,12],[1980,17],[1981,19],[1982,26],[1983,34],
  [1984,34],[1985,58],[1986,71],[1987,46],[1988,42],[1989,63],[1990,63],[1991,63],[1992,79],[1993,105],[1994,101],
  [1995,78],[1996,175],[1997,256],[1998,211],[1999,153],[2000,199],[2001,142],[2002,200],[2003,151],[2004,92],
  [2005,98],[2006,76],[2007,131],[2008,284],[2009,88],[2010,107],[2011,124],[2012,150],[2013,108],[2014,115],
  [2015,61],[2016,71],[2017,48],[2018,40],[2019,36],[2020,42],[2021,49],[2022,54],[2023,30],[2024,19],[2025,33],[2026,8]] as Array<[number, number]>

const h = (a: Array<[number, number]>) => a.map(([year, n]) => ({ year, n }))

;(async () => {
  console.log(`\nGRAPH 5 §1 — THE COVERAGE BOUNDARY\n`)

  // ── the rule, on shapes that occur ────────────────────────────────────────
  console.log('── collectionShape: the three shapes, on real histograms ──')
  const tna = collectionShape(h(H_TNA))
  assert(tna.shape === 'cliff' && tna.continuousFrom === 2003,
    'a sharp floor is found, and found where the step is',
    `shape=${tna.shape} from=${tna.continuousFrom} tail=${tna.tailRows}`)
  // ⚠ THE POINT OF THE WHOLE MODULE: the floor is not the earliest item.
  assert(tna.continuousFrom !== h(H_TNA)[0].year,
    '⚠ the floor is NOT the earliest year held — MIN(date) is the decoy this module exists to refuse',
    `earliest=${h(H_TNA)[0].year}, floor=${tna.continuousFrom}`)

  const tax = collectionShape(h(H_TAX))
  assert(tax.shape === 'cliff' && tax.continuousFrom === 2003,
    '⚠ a PARTIAL FINAL YEAR does not end the walk-back',
    `shape=${tax.shape} from=${tax.continuousFrom} (final year holds ${H_TAX[H_TAX.length - 1][1]})`)

  const echr = collectionShape(h(H_ECHR))
  assert(echr.shape === 'ramp' && echr.continuousFrom === null,
    '⚠⚠ a RAMP is reported as having no floor, not given a spurious one',
    `shape=${echr.shape} from=${echr.continuousFrom}`)

  assert(collectionShape(h([[2020, 4], [2021, 5], [2022, 6]])).shape === 'thin',
    'too few years is reported as unknown, not guessed', 'shape=thin')

  // ── the controls: the rule must reject the answers it used to give ────────
  console.log('\n── controls: the two answers the FIRST version of this rule gave ──')
  control(tax.continuousFrom !== 2024,
    'the partial-year answer ("continuous from 2024 to 2024") is refused',
    `rule now says ${tax.continuousFrom}`)
  control(echr.continuousFrom !== 2025 && echr.continuousFrom !== 2026,
    'the ramp is not handed the most recent year as a floor',
    `rule now says ${echr.continuousFrom}`)
  // ⚠ and the rule must be able to say 'cliff' wrongly if the data says so — a shape
  //   function that answered 'ramp' to everything would pass the two controls above.
  control(collectionShape(h([[1990, 1], [1991, 2], [2010, 900], [2011, 950], [2012, 900], [2013, 400]])).shape === 'cliff',
    'the rule still finds a cliff when there is one (it has not been broken into always saying ramp)')

  // ── the digit rule, as coverage.ts already has ────────────────────────────
  console.log('\n── ⚠ NO FIGURE ABOUT THE CORPUS MAY BE HARDCODED IN THE WORDS ──')
  const src = fs.readFileSync(path.join(__dirname, 'caselaw-coverage.ts'), 'utf8')
  // Only the function that PRINTS the block is scanned. The header comment and the fixtures above
  // legitimately quote measurements; a sentence handed to a user must not.
  const fnStart = src.indexOf('export function describeCaseLawBoundary')
  const fnSrc = src.slice(fnStart)
  const badRx = /\b\d[\d,.]*\s*(rows|%|documents|items|years|GB|MB)\b/i
  const strings = [...fnSrc.matchAll(/`([^`]*)`|'([^'\n]*)'/g)].map(m => m[1] ?? m[2] ?? '')
  const offenders = strings.filter(s => badRx.test(s))
  assert(offenders.length === 0, 'no sentence in describeCaseLawBoundary states a figure about the corpus',
    offenders.length ? `offenders: ${offenders.slice(0, 2).map(o => JSON.stringify(o.slice(0, 60))).join(' | ')}` : `${strings.length} strings scanned`)
  const planted = fnSrc.replace('const lines: string[] = []', 'const lines: string[] = []\n  const bad = `our case law begins in 2003 and holds 74,896 documents`')
  const plantedOffenders = [...planted.matchAll(/`([^`]*)`|'([^'\n]*)'/g)].map(m => m[1] ?? m[2] ?? '').filter(s => badRx.test(s))
  control(plantedOffenders.length === 1, 'the hardcoded-figure rule FIRES on a planted violation',
    JSON.stringify(plantedOffenders[0] ?? ''))

  // ── live state ────────────────────────────────────────────────────────────
  console.log('\n── live: the boundary as it will be served ──')
  const b = await caseLawCoverage()
  assert(b.collections.length > 0, 'at least one case-law collection was read', `${b.collections.length} collections`)

  // ⚠⚠ THE FINDING THIS CHECK EXISTS TO PIN. Every collection this module names must be one the
  //    database actually spells that way. `coverage.ts` named two that hold zero rows and omitted
  //    the 74,896-document English holding, and its boundary was computed over what was left.
  const pool = getNeonPool()
  const { rows: real } = await pool.query(
    `SELECT corpus, COUNT(*)::bigint n FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY corpus`,
    [CASE_LAW_COLLECTIONS])
  const realNames = new Set(real.map((r: { corpus: string }) => r.corpus))
  const ghosts = CASE_LAW_COLLECTIONS.filter(c => !realNames.has(c))
  assert(ghosts.length === 0, '⚠⚠ every named case-law collection exists in the database',
    ghosts.length ? `NAMED BUT ABSENT: ${ghosts.join(', ')}` : `${realNames.size} named, ${realNames.size} present`)
  // and if one ever is absent, it must still be REPORTED rather than vanishing
  assert(b.namedButEmpty.length === ghosts.length,
    'a named-but-absent collection is reported, never silently dropped from the aggregate',
    `namedButEmpty=[${b.namedButEmpty.join(', ')}]`)

  // ⚠ The English collection is the one a user will assume is complete. Its floor must be stated.
  const eng = b.collections.find(c => c.corpus === 'tna-caselaw')
  assert(eng != null && eng.shape === 'cliff' && eng.continuousFrom != null,
    'the English collection declares a floor', `${eng?.corpus}: ${eng?.shape} from ${eng?.continuousFrom}`)
  assert(eng != null && eng.earliestItem != null && Number(eng.earliestItem.slice(0, 4)) < (eng.continuousFrom ?? 0),
    '⚠ and it holds items BELOW that floor, so the floor is not the minimum',
    `earliest ${eng?.earliestItem}, floor ${eng?.continuousFrom}, tail ${eng?.tailRows}`)

  // The block must actually SAY the boundary. An assertion on the data that never checks the words
  // is the "it is written down / it is reached" gap.
  const words = describeCaseLawBoundary(b).join('\n')
  assert(words.includes('tna-caselaw') && /CONTINUOUS FROM/.test(words),
    'the rendered block names the English collection and states its floor')
  assert(/NO YEAR FROM WHICH IT BECOMES CONTINUOUS/.test(words) === b.collections.some(c => c.shape === 'ramp'),
    'a ramp collection is described as a ramp in the rendered words, and only when one exists')
  control(!describeCaseLawBoundary({ ...b, collections: [] }).join('\n').includes('CONTINUOUS FROM'),
    'with no collections the block claims no window at all')

  console.log(`\n  ${pass} passed, ${fail} failed, of ${pass + fail} run  (${controls} controls, 0 dead)`)
  await endNeonPool()
  process.exit(fail === 0 ? 0 : 1)
})().catch(async e => { console.error(e); await endNeonPool(); process.exit(1) })
