/**
 * check-s18-costing.ts — the guards for BRIEF_SEARCH_S18 §2/§3.
 *
 * ⚠⚠ EVERY ASSERTION BELOW WAS WATCHED FAILING AGAINST THE REAL BROKEN STATE, and for several of
 * them the "real broken state" is what this sprint FOUND IN PRODUCTION rather than something
 * planted. The four that matter most each correspond to a defect that was live when the sprint
 * opened:
 *
 *   1. `retrievePrecedent` joined impact assessments on the instrument gid, which appears in NONE
 *      of their 18,759 ids — so its PREDICTED and OBSERVED legs had never returned a row, and it
 *      told 952 instruments that no post-implementation review existed while holding 1,197 review
 *      sections. Guard: §1.
 *   2. The PREDICTED leg was section `:1`, the HMG front sheet — a title, an IA number and a
 *      contact telephone number. Guard: §2.
 *   3. `legForImpactSection` decided OUTCOME from the section TITLE, and 25 of 30 sections titled
 *      "Post-implementation review" are a front-sheet box promising a FUTURE review — one of them
 *      promising not to hold one. Guard: §3.
 *   4. The coverage line counted those sections as reviews and overstated the platform's own
 *      coverage by 17×. Guard: §5.
 *
 * ⚠ §6 IS THE ONE THAT CANNOT BE FAKED. Every other check reads code or a pure function; §6 asks
 * the LIVE assembler for a real instrument and asserts on what comes back. CLAUDE.md §23.3: where
 * a populated value matters, the check tests the VALUE, not the schema — "the field is declared"
 * and "these rows are produced" are different claims and only the second is about the product.
 *
 * Usage:  npx tsx --env-file=.env --tsconfig tsconfig.json scripts/check-s18-costing.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import {
  retrieveCosting, costingBlock, figureStateOf, priceBaseYearOf, COMPARISON_KIND, COSTING_NOTE,
} from '../lib/lex/costing'
import { impactLegOf, retrievePrecedent } from '../lib/lex/deepening-retrieval'

export {}

let passed = 0
const failures: string[] = []
function check(ok: boolean, label: string) {
  if (ok) { passed++; console.log(`✓ ${label}`) } else { failures.push(label); console.log(`✗ ${label}`) }
}

const SRC = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')
/** ⚠ Comments stripped before any absence assertion. A "must NOT appear" test that reads the ⚠
 *  note explaining the deletion fails on correct code — the absence-assertion trap, register entry
 *  "Absence greps read their own comments". */
const code = (p: string) => SRC(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|--)/.test(l)).join('\n')

async function main() {
  console.log('── check:s18-costing ──\n')

  // ═══ §1 — the join. The defect that made two of three legs dead. ═══════════════════════════
  console.log('§1 the impact-assessment join')
  const retrieval = code('lib/lex/deepening-retrieval.ts')
  check(/s\.corpus = 'impact-assessments' AND s\."parentDocId" = \$\{gid\}/.test(retrieval)
     || /impact-assessments' AND s\."parentDocId"/.test(retrieval),
    '⚠ impact assessments are joined on parentDocId, not on the id')
  // The positive form above can pass while the broken form is ALSO still there, so assert the
  // absence too — the two together are what pin it.
  check(!/corpus IN \('explanatory-notes', 'explanatory-memoranda', 'impact-assessments'\)[\s\S]{0,80}id LIKE/.test(retrieval),
    '⚠ the old single id-LIKE over all three collections is GONE, not merely supplemented')

  // The world fact the join rests on. ⚠ Asserted against the DATABASE, not remembered: if ingest
  // ever re-keys the collection so ids DO carry the gid, this check tells us before the join does.
  const slash = await prisma.$queryRawUnsafe<Array<{ n: number; withSlash: number }>>(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE id LIKE '%/%')::int AS "withSlash"
     FROM corpus_sections WHERE corpus = 'impact-assessments'`)
  check(slash[0].withSlash === 0,
    `⚠ 0 of ${slash[0].n.toLocaleString()} impact-assessment ids contain a '/', so an id-LIKE join on a gid can never match (found ${slash[0].withSlash})`)

  // ═══ §2 — the leg is not the cover sheet ═══════════════════════════════════════════════════
  console.log('\n§2 the PREDICTED leg is not the front sheet')
  check(/PREDICTED_PREFERENCE/.test(retrieval),
    'the leg is chosen by an explicit preference over section kinds')
  check(/PREDICTED_PREFERENCE\.length \+ 1/.test(retrieval),
    "⚠ 'summary' — the front sheet — is ranked LAST, below the unrecognised band")

  // ═══ §3 — an outcome is decided by the STAGE, never by the section title ═══════════════════
  console.log('\n§3 PREDICTED vs OBSERVED')
  check(impactLegOf('Department for Environment, Food and Rural Affairs — Post Implementation') === 'observed',
    '⚠ a Post Implementation stage assessment is OBSERVED')
  check(impactLegOf('Department of Health — Final') === 'predicted',
    '⚠⚠ a FINAL-stage assessment is PREDICTED, whatever its sections are titled')
  check(impactLegOf(null) === 'predicted',
    '⚠ an unknown stage defaults to PREDICTED — the direction that cannot overclaim')
  check(impactLegOf('Ministry of Justice — Consultation') === 'predicted',
    'a consultation-stage assessment is PREDICTED')
  check(!/impactLegOf\(r\.sectionTitle\)|legForImpactSection\(r\.sectionTitle\)/.test(retrieval),
    '⚠⚠ no leg anywhere is decided from a section TITLE — 25 of 30 sections titled "Post-implementation review" are a promise, not a review')
  check(!/legForImpactSection/.test(code('lib/lex/costing.ts')),
    '⚠ the costing layer does not use the deprecated title rule either')

  // ═══ §4 — the three figure states, and the two collapses that invert an answer ═════════════
  console.log('\n§4 a figure has three states, never two')
  check(figureStateOf('Net cost to business per year (EANDCB in 2014 prices) £4.2m') === 'PUBLISHED',
    'a figure with money and an appraisal label is PUBLISHED')
  check(figureStateOf('Net cost to business per year (EANDCB in 2014 prices) Not estimated N/A Not in scope') === 'NOT_ESTIMATED',
    '⚠⚠ "Not estimated" is the DEPARTMENT declaring it, not a gap in our corpus')
  check(figureStateOf('Cost of Preferred Option (2016 prices) Total Net Present Value Business Net Present Value') === 'NOT_EXTRACTED',
    '⚠ the same table shape with no declaration is OUR extraction losing the figure')
  check(figureStateOf('Two options are considered. Do nothing, or a ban with specified exemptions.') === null,
    '⚠⚠ ordinary prose is NOT a figure — it must not render as "we do not hold the figure for this table"')
  check(figureStateOf('Net cost to business per year £4.2m. Wider benefits have not been monetised.') === 'PUBLISHED',
    '⚠ a published figure alongside an unmonetised benefit stays PUBLISHED — the figure is not thrown away')
  // ⚠ THE ONE THAT WOULD BE UNFAIR TO GOOD LEGISLATION. There must be no path from NOT_ESTIMATED
  // to a zero, and the type is what guarantees it: assert that no arithmetic is done on the state.
  const costing = code('lib/lex/costing.ts')
  check(!/state\s*[=!]==?\s*['"]NOT_ESTIMATED['"]\s*\?\s*0|Number\(.*state|\+\s*state\b/.test(costing),
    '⚠⚠ NOT_ESTIMATED is never coerced to a number — "not monetised" must never read as zero')

  // ═══ §5 — the price base year ══════════════════════════════════════════════════════════════
  console.log('\n§5 price base year')
  check(priceBaseYearOf('Price Base Year 2008').year === 2008, 'the front-sheet form is read')
  check(priceBaseYearOf('Cost of Preferred Option (2016 prices, 2017 present value)').year === 2016,
    '⚠ the parenthesised form takes the PRICE base year, not the present-value year')
  check(priceBaseYearOf('EANDCB in 2014 prices, 2015 present value').year === 2014, 'the in-year form is read')
  check(priceBaseYearOf('there is no base year in this sentence').year === null,
    '⚠ an unreadable base year is null, never guessed — a wrong base year makes two incomparable figures look comparable')
  check(priceBaseYearOf('Price Base Year 1804').year === null,
    '⚠ a year outside the range these documents can carry is a false match, not a finding')

  // ═══ §6 — THE LIVE ASSEMBLER. The only check that is about the product. ════════════════════
  console.log('\n§6 the live block (CLAUDE.md §23.3 — assert the VALUE, not the schema)')
  const GID = 'uksi/2020/971' // the plastic-straws regulations: assessment held, review section held
  const p = await retrievePrecedent(GID)
  check(p.legs.some((l) => l.leg === 'predicted'),
    `⚠ ${GID} has a PREDICTED leg — before the join fix it had none, for any instrument`)
  check(!/impact-assessments:\d+-\d+:1$/.test(p.legs.find((l) => l.leg === 'predicted')?.id ?? ''),
    '⚠ …and it is NOT section :1, the front sheet')
  check(p.instrumentTitle !== null, '⚠ the instrument is named — the old join returned no rows, so the title was null')

  const b = await retrieveCosting('banning plastic drinking straws', { gid: GID })
  const rows = b.rows.map((r) => r.row)
  for (const want of ['PREDICTED', 'CHECKED', 'MEASURED', 'NOT KNOWN', 'COMPARABLE']) {
    check(rows.includes(want as never), `the block always renders the ${want} row`)
  }
  const predicted = b.rows.find((r) => r.row === 'PREDICTED')!
  const checked = b.rows.find((r) => r.row === 'CHECKED')!
  const notKnown = b.rows.find((r) => r.row === 'NOT KNOWN')!
  const comparable = b.rows.find((r) => r.row === 'COMPARABLE')!

  // ⚠⚠ RULE 1, ASSERTED ON THE OUTPUT AND NOT ON THE CODE. The two rows must never cite the same
  // document: that is what "a prediction rendered as an outcome" looks like from outside.
  check(!checked.source || checked.source.id !== predicted.source?.id,
    '⚠⚠ the CHECKED row never cites the PREDICTED row\'s document — a prediction is never rendered as an outcome')

  // ⚠⚠ THE GUARD ABOVE IS NOT ENOUGH, AND WATCHING IT FAIL IS HOW THAT WAS ESTABLISHED. Reverting
  // the leg rule to the pre-sprint title test — the state that put a signature page and a promised
  // review date under "what actually HAPPENED" — failed exactly ONE of the 45 checks, and it was a
  // source-code grep, not this one. The id-inequality guard cannot catch it because the promise and
  // the prediction are DIFFERENT SECTIONS of the same assessment, so the ids genuinely differ.
  //
  // The assertion that pins it has to ask the corpus what the cited document IS. A CHECKED source
  // must belong to an assessment whose STAGE is Post Implementation; anything else is a section of
  // a forward-looking assessment, however its heading reads.
  if (checked.source) {
    const stage = await prisma.$queryRawUnsafe<Array<{ attribution: string | null }>>(
      'SELECT attribution FROM corpus_sections WHERE id = $1', checked.source.id)
    const ok = impactLegOf(stage[0]?.attribution ?? null) === 'observed'
    check(ok,
      `⚠⚠ the CHECKED row cites a document whose STAGE is a post-implementation review, not a section of a forward-looking one (cited ${checked.source.id}, stage ${JSON.stringify(stage[0]?.attribution ?? null)})`)
  } else {
    check(true, '⚠ no CHECKED source for this instrument — the stage assertion is vacuous here and says so')
  }
  check(predicted.figures.every((f) => f.state !== 'PUBLISHED' || f.priceBase !== null || f.priceBaseVerbatim === null),
    '⚠ every published figure carries a price base year or says it has none')
  check(comparable.comparisonKind === COMPARISON_KIND && /by SUBJECT/.test(comparable.comparisonKind),
    '⚠ COMPARABLE states which KIND of comparison it is making')
  check(/NOT by mechanism/.test(comparable.comparisonKind ?? ''),
    '⚠ …and says explicitly that it is NOT by mechanism')
  check(notKnown.statements.length > 0,
    '⚠⚠ NOT KNOWN is a first-class row and is never empty — an empty block is the failure mode this feature exists to avoid')
  check(notKnown.statements.some((s) => /NOT SEARCHED/.test(s)),
    '⚠ NOT KNOWN names what was not searched, so "we did not look" is distinguishable from "there is nothing"')

  // ═══ §7 — the coverage line: live state, and no claim it cannot support ════════════════════
  console.log('\n§7 coverage')
  const heldNow = await prisma.$queryRawUnsafe<Array<{ assessments: number; reviews: number }>>(
    `SELECT count(DISTINCT split_part(id, ':', 2))::int AS assessments,
            count(DISTINCT split_part(id, ':', 2)) FILTER (
              WHERE trim(split_part(attribution, '—', 2)) ILIKE 'post%implementation%')::int AS reviews
     FROM corpus_sections WHERE corpus = 'impact-assessments' AND status = 'compiled'`)
  check(b.coverage.includes(heldNow[0].assessments.toLocaleString()),
    `⚠ the coverage line states the LIVE assessment count (${heldNow[0].assessments.toLocaleString()}) — generated, never hardcoded`)
  check(b.coverage.includes(heldNow[0].reviews.toLocaleString()),
    `⚠⚠ …and the LIVE count of post-implementation REVIEWS by stage (${heldNow[0].reviews}), not the 17×-larger count of sections titled that way`)
  check(/NOT BUILT, and therefore not searched/.test(b.coverage),
    '⚠ the coverage line names what is not built, so a gap is never read as an absence in the world')

  // ⚠ THE COVERAGE STRING MUST NOT STATE A FIGURE ABOUT THE CORPUS THAT NOTHING COUNTED. Every
  // number in it has to be one this call produced. The cross-reference graph enforces the same rule.
  // ⚠ `\d[\d,]*`, not `[\d,]+`: the looser form matches the bare commas in ordinary prose and
  // yields empty strings, so the check failed on a sentence rather than on a number. Watched.
  const numbers = (b.coverage.match(/\d[\d,]*/g) ?? []).map((n) => n.replace(/,+$/, '').replace(/,/g, ''))
  const allowed = new Set([
    String(heldNow[0].assessments), String(heldNow[0].reviews),
    String(b.rows.length), '0',
  ])
  // section counts for the instrument are also live
  const secs = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM corpus_sections WHERE corpus='impact-assessments' AND "parentDocId" = $1 AND status='compiled'`, GID)
  allowed.add(String(secs[0].n))
  const unexplained = numbers.filter((n) => !allowed.has(n))
  check(unexplained.length === 0,
    `⚠⚠ every number in the coverage line came from a live count (unexplained: ${JSON.stringify(unexplained)})`)

  // ═══ §8 — the caveat reaches the reader, not only the model ═══════════════════════════════
  console.log('\n§8 the note is split at construction (25-C §2.2)')
  check(/A PREDICTION IS NOT AN OUTCOME/.test(COSTING_NOTE.forUser),
    '⚠ the substance is on screen — a caveat the user cannot see cannot protect them')
  check(/PRICE BASE YEAR/.test(COSTING_NOTE.forUser) && /"Not estimated" means nobody put a number on it/.test(COSTING_NOTE.forUser),
    '⚠ …including both of the rules a reader has to apply themselves')
  check(!/\bNever\b|\bDo NOT\b/.test(COSTING_NOTE.forUser),
    '⚠⚠ no imperative addressed to the model leaks into the user half — that is what the split is for')
  check(/Never present a PREDICTED figure as an outcome/.test(COSTING_NOTE.forModel),
    'the model half carries the imperative')
  const rendered = costingBlock(b).forUser
  check(!/Say so plainly|Do NOT substitute/.test(rendered),
    '⚠ the rendered block contains no instruction addressed to nobody')

  console.log(`\n${failures.length ? `${failures.length} FAILED of ${passed + failures.length}` : `all ${passed} checks passed`}`)
  for (const f of failures) console.log(`   ✗ ${f}`)
  await prisma.$disconnect()
  if (failures.length) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
