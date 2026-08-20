/**
 * verify-recompile-coverage.ts — the END-STATE number, independent of any run's own tally.
 *
 * The re-compile ran in three pieces: a 2,000-row pilot, a run that was killed at 38,500, and a
 * resumed run. Adding three self-reported counters together is exactly the kind of arithmetic that
 * hides a gap, so the coverage figure in the report comes from here instead: a count over the whole
 * collection of rows whose provenance says the new extractor wrote them, plus a guard sweep over
 * bodies read back out of R2.
 *
 * WRITES NOTHING. Run: --sweep=300
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { checkJudgmentBody } from '../shared/akn-text'

const CORPUS = 'tna-caselaw'
const SWEEP = parseInt(process.argv.find(a => a.startsWith('--sweep='))?.split('=')[1] ?? '300', 10)
const ROUTE = 'text-route:akn:judgment-minus-meta'

;(async () => {
  const p = namesPool()
  const c = (await p.query(
    `SELECT COUNT(*)::int AS rows,
            COUNT(*) FILTER (WHERE notes LIKE '%' || $2 || '%')::int AS recompiled,
            COUNT(*) FILTER (WHERE notes LIKE 'title-route:%')::int  AS titled_route,
            COUNT(NULLIF(btrim(COALESCE("sectionTitle",'')),''))::int AS titled,
            SUM("wordCount")::bigint AS words,
            AVG("wordCount")::int AS mean_words
       FROM corpus_sections WHERE corpus=$1`, [CORPUS, ROUTE])).rows[0]
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(2)}%` : '—')

  console.log(`\n  ${CORPUS} rows                          ${c.rows.toLocaleString()}`)
  console.log(`  carrying ${ROUTE}   ${c.recompiled.toLocaleString()}  ${pct(c.recompiled, c.rows)}`)
  console.log(`  NOT re-compiled                          ${(c.rows - c.recompiled).toLocaleString()}`)
  console.log(`  still carrying a title-route provenance   ${c.titled_route.toLocaleString()}  ${pct(c.titled_route, c.rows)}`)
  console.log(`  carrying a sectionTitle                   ${c.titled.toLocaleString()}  ${pct(c.titled, c.rows)}`)
  console.log(`  stored words                              ${Number(c.words).toLocaleString()} (mean ${Number(c.mean_words).toLocaleString()})`)

  if (c.rows > c.recompiled) {
    const misses = (await p.query(
      `SELECT id, notes, "wordCount" FROM corpus_sections
        WHERE corpus=$1 AND (notes IS NULL OR notes NOT LIKE '%' || $2 || '%') ORDER BY id LIMIT 20`, [CORPUS, ROUTE])).rows
    console.log(`\n  rows the re-compile did not write (first ${misses.length}):`)
    misses.forEach(m => console.log(`    ${m.id}   notes=${JSON.stringify(m.notes)}  words=${m.wordCount}`))
  }

  console.log(`\n  GUARD SWEEP over ${SWEEP} bodies read back out of R2:`)
  const rows = (await p.query(
    `SELECT id, "r2Key" FROM corpus_sections WHERE corpus=$1 AND "r2Key" IS NOT NULL
      ORDER BY md5(id || 'coverage') LIMIT $2`, [CORPUS, SWEEP])).rows
  let read = 0, ok = 0
  const reasons: Record<string, number> = {}
  const examples: string[] = []
  await Promise.all(rows.map(async r => {
    const t = await r2Get(r.r2Key)
    if (t == null) return
    read++
    const v = checkJudgmentBody(t)
    if (v.ok) ok++
    else {
      const key = v.reason.replace(/\d+/g, 'N')
      reasons[key] = (reasons[key] ?? 0) + 1
      if (examples.length < 5) examples.push(`${r.id} — ${v.reason}`)
    }
  }))
  console.log(`    ${ok}/${read} pass (${pct(ok, read)})`)
  for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`      ${String(v).padStart(5)}  ${k}`)
  examples.forEach(e => console.log(`      e.g. ${e}`))
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
