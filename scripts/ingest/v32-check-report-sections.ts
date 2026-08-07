/**
 * v32-check-report-sections.ts — proves the report splitter before it is allowed to write
 * anything. `npm run check:report-sections`
 *
 * Two halves, and the second is the one that matters:
 *
 *   1. Unit assertions over hand-built fixtures — the whitespace repairs, the numbered-finding
 *      detection, the "9980." false-positive guard, and a NEGATIVE control proving the
 *      losslessness invariant can actually fail (an invariant that cannot fail proves nothing).
 *   2. A live pass over real report bodies from R2, asserting losslessness on every one and
 *      reporting the section-count distribution. A splitter validated only on fixtures has been
 *      validated against my idea of a committee report, not against committee reports.
 *
 * Read-only. Usage: tsx v32-check-report-sections.ts [--sample N]
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'
import { splitReportBody, unwrap, assertLossless, TARGET_CHARS, MAX_CHARS } from './shared/report-sections'

const SAMPLE = (() => { const i = process.argv.indexOf('--sample'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 120 })()

let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function fixtures() {
  console.log('\n── 1. Fixtures ──────────────────────────────────────────────────────────────')

  // The exact defect from the audit: a phrase split across a PDF line break.
  const wrapped = 'rank as one of the most important public \nhealth failures the United Kingdom has ever experienced.'
  check('a phrase split by a PDF line break is NOT contiguous before the repair',
    !wrapped.includes('most important public health failures'))
  check('unwrap() makes it contiguous',
    unwrap(wrapped).includes('most important public health failures'), JSON.stringify(unwrap(wrapped).slice(0, 60)))

  // Justified-text double spacing, also from the audit.
  const justified = 'housing  and  working  conditions  played  a  significant  role.'
  check('unwrap() collapses justification spacing',
    unwrap(justified) === 'housing and working conditions played a significant role.', JSON.stringify(unwrap(justified)))

  // Hyphenation across a line break.
  check('unwrap() mends a word hyphenated across a line break',
    unwrap('an inde-\npendent review').includes('independent review'), JSON.stringify(unwrap('an inde-\npendent review')))

  // Numbered findings become unit boundaries.
  const numbered = '1. The first finding is here. 2. The second finding is here. 3. The third finding is here.'
  const uw = unwrap(numbered)
  check('numbered findings are split onto their own lines', uw.split('\n').length === 3, JSON.stringify(uw))

  // The false-positive guard: a figure reference must not open a finding.
  const figure = '1. We looked at this. As set out in table 9980. The number is large. 2. We then looked at that.'
  const figUw = unwrap(figure)
  const opened = figUw.split('\n').filter(l => /^9980\./.test(l)).length
  check('a stray "9980." does not open a finding (sequence guard)', opened === 0 || splitReportBody(figure).every(s => s.startPara !== 9980))

  // Losslessness on a realistic body — findings that actually end in a full stop.
  const body = Array.from({ length: 60 }, (_, i) => `${i + 1}. ${'Finding text goes here. '.repeat(10)}`).join('\n')
  const secs = splitReportBody(body)
  check('a 60-finding report splits into more than one section', secs.length > 1, `got ${secs.length}`)
  check('no section exceeds the hard maximum',
    secs.every(s => s.text.length <= MAX_CHARS + 1), `max ${Math.max(...secs.map(s => s.text.length))}`)
  check('findings are numbered from the report', secs[0].startPara === 1, `got ${secs[0].startPara}`)

  // The case the first fixture run actually caught: no sentence punctuation at all, so the
  // whole report is ONE indivisible unit. Without the oversize-line split this returned a
  // single 15,830-character section — the exact blob this sprint exists to break up.
  const unpunctuated = Array.from({ length: 60 }, (_, i) => `${i + 1} ${'Finding text '.repeat(20)}`).join(' ')
  const oversize = splitReportBody(unpunctuated)
  check('a body with no sentence punctuation is still broken up',
    oversize.length > 1, `got ${oversize.length} section(s) of max ${Math.max(...oversize.map(s => s.text.length))} chars`)
  check('…and no resulting section exceeds the hard maximum',
    oversize.every(s => s.text.length <= MAX_CHARS + 1), `max ${Math.max(...oversize.map(s => s.text.length))}`)
  check('…and it loses no content (whitespace-insensitive comparison)',
    oversize.map(s => s.text).join(' ').replace(/\s+/g, ' ') === unwrap(unpunctuated).replace(/\s+/g, ' '))

  // C0 control bytes. PDF extraction leaves these in the text, and a NUL reaching a
  // `sectionTitle` is a hard Postgres error (22021) — it killed the first full pass at
  // publication 275 of 3,802. docs/CLAUDE.md §13 lists the class; this pins the fix.
  const NUL = String.fromCharCode(0)
  const SOH = String.fromCharCode(1)   // the same codepoint unwrap uses as its sentinel
  const dirty = `1. A finding with a ${NUL}NUL and a ${SOH}SOH inside it. 2. And a second finding here.`
  const cleaned = unwrap(dirty)
  check('unwrap() strips NUL', !cleaned.includes(NUL), JSON.stringify(cleaned))
  check('unwrap() strips a stray U+0001 so it cannot forge a paragraph break',
    !cleaned.includes(SOH) && cleaned.split('\n').length === 2, JSON.stringify(cleaned))
  check('…and the surrounding words survive intact',
    cleaned.includes('with a NUL and a SOH inside it'), JSON.stringify(cleaned))
  check('a body carrying control bytes still splits losslessly',
    (() => { try { splitReportBody(dirty); return true } catch { return false } })())

  // NEGATIVE CONTROLS — the invariant must be able to fail, and it is the REAL exported
  // assertion being exercised here, not a re-implementation of it.
  const realText = unwrap(body)
  const realSections = splitReportBody(body).map(s => s.text)

  check('assertLossless accepts the genuine partition (positive control)',
    (() => { try { assertLossless(realText, realSections); return true } catch { return false } })())

  check('assertLossless rejects a DROPPED section (negative control)',
    (() => { try { assertLossless(realText, realSections.slice(0, -1)); return false } catch { return true } })())

  check('assertLossless rejects a DUPLICATED section (negative control)',
    (() => { try { assertLossless(realText, [...realSections, realSections[0]]); return false } catch { return true } })())

  check('assertLossless rejects a section with content EDITED out (negative control)',
    (() => {
      const tampered = [...realSections]
      tampered[0] = tampered[0].replace('Finding', 'Findng')
      try { assertLossless(realText, tampered); return false } catch { return true }
    })())
}

async function live() {
  console.log(`\n── 2. Live pass over ${SAMPLE} real report bodies ───────────────────────────────`)
  const p = getNeonPool()
  const { rows } = await p.query<{ id: string; sectionTitle: string | null; r2Key: string; wordCount: number }>(
    // Sample the ORIGINAL, UNSPLIT blob bodies — the only thing that exercises the splitter on
    // real input. Two traps, both hit for real:
    //
    //  1. Sections this splitter wrote keep their parent's "Report: …" title, so an unfiltered
    //     sample fills with 2.5k-char sections that trivially split into one. That dropped the
    //     observed numbered-finding rate to 12/80 and looked exactly like a splitter regression.
    //  2. Once the corpus is fully split there are NO unsplit rows left, and a query for them
    //     returns nothing — the check then "passes" 0 bodies and proves nothing.
    //
    // So this reconstructs the blob R2 key from a split section's id and reads that. The rechunk
    // retires the blob DB ROW but never deletes the R2 object, so the original bodies are still
    // there: `…:{documentId}-0001` → `committees-reports/{docId}/sections/{documentId}/compiled.txt`.
    `SELECT DISTINCT ON ("parentDocId")
            id,
            "sectionTitle",
            'committees-reports/' || "parentDocId" || '/sections/'
              || substring(id from ':([0-9]+)-[0-9]{4}$') || '/compiled.txt' AS "r2Key",
            "wordCount"
     FROM corpus_sections
     WHERE corpus='committees-reports' AND status='compiled'
       AND id ~ ':[0-9]+-[0-9]{4}$'
       AND ("sectionTitle" ILIKE 'Report:%' OR "sectionTitle" ILIKE 'Special Report:%' OR "sectionTitle" ILIKE 'Government Response:%')
     ORDER BY "parentDocId", md5(id)
     LIMIT $1`, [SAMPLE])

  let lossy = 0, totalSections = 0, numbered = 0, empty = 0
  let reportKind = 0, reportNumbered = 0
  let maxSections = 0, maxSecChars = 0
  const distribution: number[] = []
  for (const r of rows) {
    const body = await r2Get(r.r2Key)
    if (!body) continue
    let secs
    try { secs = splitReportBody(body) } catch (e) { lossy++; console.log(`  ✗ LOSSY on ${r.id}: ${(e as Error).message}`); continue }
    if (secs.length === 0) { empty++; continue }
    totalSections += secs.length
    distribution.push(secs.length)
    const isReportKind = /^Report:/i.test(r.sectionTitle ?? '')
    const hasNumbers = secs.some(s => s.startPara !== null)
    if (hasNumbers) numbered++
    if (isReportKind) { reportKind++; if (hasNumbers) reportNumbered++ }
    maxSections = Math.max(maxSections, secs.length)
    maxSecChars = Math.max(maxSecChars, ...secs.map(s => s.text.length))
  }

  // A live pass over zero bodies is not a pass. Guard it explicitly.
  check('the live sample actually found real bodies to split', rows.length > 0 && distribution.length > 0,
    `${rows.length} selected, ${distribution.length} readable from R2`)
  check(`losslessness holds on all ${rows.length} real bodies`, lossy === 0, `${lossy} lossy`)
  check('no real body produced zero sections', empty === 0, `${empty} empty`)
  // Assert on `Report:` documents specifically. The claim in report-sections.ts is that numbered
  // findings are present in every SUBSTANTIVE report and absent from procedural ones — and
  // `Government Response:` / `Special Report:` documents frequently are not numbered at all. A
  // per-publication sample across all three kinds lands near 50%, which says nothing about the
  // claim either way. Measuring the kind the claim is about is the fix; lowering the threshold to
  // make the number pass would have been fitting the test to the result.
  check('numbered findings detected in the majority of `Report:` documents',
    reportKind > 0 && reportNumbered / reportKind > 0.5, `${reportNumbered}/${reportKind} reports`)
  console.log(`  (all kinds, for context: ${numbered}/${rows.length} — responses and special reports are often unnumbered)`)

  distribution.sort((a, b) => a - b)
  const med = distribution[Math.floor(distribution.length / 2)] ?? 0
  console.log(`\n  sections per report: median ${med}, max ${maxSections}, mean ${(totalSections / Math.max(distribution.length, 1)).toFixed(1)}`)
  console.log(`  longest single section: ${maxSecChars} chars`)
  console.log(`  ${rows.length} reports → ${totalSections} sections (×${(totalSections / Math.max(rows.length, 1)).toFixed(1)})`)
  await endNeonPool()
}

async function main() {
  fixtures()
  await live()
  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} checks pass`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[check] FATAL', e); process.exit(1) })
