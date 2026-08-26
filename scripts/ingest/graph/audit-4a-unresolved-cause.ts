/**
 * audit-4a-unresolved-cause.ts — GRAPH 4A §3, follow-up.
 *
 * ⚠⚠ T3 answered the brief's question (29.9%) and then the top-twenty list
 * refused the brief's framing. OI-18 describes the unresolved spans as
 * *"short forms (the Taxes Act 1988), pre-1963 Acts under the other id form,
 * and Acts we do not hold"*, and the decision the brief hangs on the number is
 * whether to build SHORT-FORM RESOLUTION.
 *
 * But the commonest unresolved name in the whole corpus is
 * "the Interpretation Act (Northern Ireland) 1954" — a FULL statutory title, not
 * an abbreviation of anything. Short-form resolution would not recover one of
 * those spans.
 *
 * So this classifies the top unresolved names by CAUSE, because the cause
 * decides the fix and the two fixes are unrelated pieces of work:
 *
 *   short-form        the span is an abbreviation ("the Taxes Act 1988") and the
 *                     full Act IS in corpus_acts under its real title
 *   title-absent      a full title with NO row in corpus_acts under any title —
 *                     a corpus/ingest gap, not a resolution gap
 *   title-mismatch    the Act is in corpus_acts but under a title that does not
 *                     normalise to this span — a title-data gap
 *
 * Reads only.
 *
 *   npx tsx graph/audit-4a-unresolved-cause.ts [--json out.json]
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { normTitle, loadActTitles } from './extract-citation-edges'

type Cause = 'short-form' | 'title-absent' | 'title-mismatch'

/** "…the Taxes Act 1988" → the trailing year, and the words before it. */
function yearOf(span: string): string | null {
  return span.match(/\b(\d{4})\s*$/)?.[1] ?? null
}

async function main() {
  const pool = getNeonPool()
  const t3 = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-4a-t3-spans.json'), 'utf8'))
  const top: Array<[string, number]> = t3.topUnresolvedNames
  const titles = await loadActTitles()

  console.log(`[cause] classifying the ${top.length} commonest unresolved names ` +
    `(${top.reduce((n, t) => n + t[1], 0).toLocaleString()} of ${t3.unresolvedTotal.toLocaleString()} spans)\n`)

  const rows: Array<{ span: string; spans: number; cause: Cause; evidence: string }> = []
  const totals: Record<Cause, number> = { 'short-form': 0, 'title-absent': 0, 'title-mismatch': 0 }

  for (const [span, n] of top) {
    const yr = yearOf(span)
    // Does ANY instrument in corpus_acts carry a title ending in these words?
    const { rows: exact } = await pool.query(
      `SELECT gid, title FROM corpus_acts WHERE lower(title) LIKE $1 LIMIT 3`, [`%${span}`])
    // Is there an Act OF THAT YEAR whose title contains the last distinctive word?
    const lastWords = span.replace(/\s*\d{4}\s*$/, '').split(/\s+/).slice(-2).join(' ')
    const { rows: near } = await pool.query(
      `SELECT gid, title FROM corpus_acts
       WHERE title ILIKE $1 AND ($2::text IS NULL OR title ILIKE '%' || $2) LIMIT 3`,
      [`%${lastWords}%`, yr])

    let cause: Cause
    let evidence: string
    if (exact.length > 0) {
      // the full title IS held — so the span failed on normalisation, not coverage
      cause = titles.has(normTitle(span)) ? 'short-form' : 'title-mismatch'
      evidence = `corpus_acts has ${exact[0].gid} "${String(exact[0].title).slice(0, 70)}"`
    } else if (near.length > 0) {
      cause = 'title-mismatch'
      evidence = `nearest: ${near[0].gid} "${String(near[0].title).slice(0, 70)}"`
    } else {
      cause = 'title-absent'
      evidence = 'no instrument of that name in corpus_acts under any title'
    }
    // A span that is a strict SUFFIX of a longer held title is a short form.
    if (cause === 'title-mismatch' && exact.length > 0 && !titles.has(normTitle(span))) {
      const t = String(exact[0].title).toLowerCase()
      if (t.length > span.length + 3 && t.endsWith(span)) { cause = 'short-form'; evidence = `short for "${String(exact[0].title).slice(0, 70)}" (${exact[0].gid})` }
    }
    totals[cause] += n
    rows.push({ span, spans: n, cause, evidence })
  }

  for (const r of rows.slice(0, 25)) {
    console.log(`  ${String(r.spans).padStart(5)}  ${r.cause.padEnd(15)} ${r.span}`)
    console.log(`         ${r.evidence}`)
  }

  const counted = Object.values(totals).reduce((a, b) => a + b, 0)
  console.log(`\n══ CAUSE, weighted by spans (top ${top.length} names = ${counted.toLocaleString()} spans) ══`)
  for (const [k, v] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${String(v).padStart(6)}  ${(100 * v / counted).toFixed(1)}%`)
  }
  console.log(`\n  ▶ short-form resolution addresses ${(100 * totals['short-form'] / counted).toFixed(1)}% of these spans.`)
  console.log(`    The rest is corpus and title coverage — a different piece of work, and the`)
  console.log(`    one the numbers point at. ⚠ OI-18 lists all three causes; what it does not`)
  console.log(`    say is which dominates, and the brief's decision assumed the short forms did.`)

  const out = { at: new Date().toISOString(), namesClassified: top.length, spansCounted: counted, totals, rows }
  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[cause] → ${process.argv[jsonIx + 1]}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[cause] FATAL', e); process.exit(1) })
}
