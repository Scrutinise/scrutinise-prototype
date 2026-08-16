/**
 * v38-hygiene.ts — BRIEF_INGEST_V38_STORAGE §4.2 and §4.3. Measures; writes nothing.
 *
 * §4.3 — the ~288 sections pointing at R2 objects that do not exist. The V36 addendum recorded a
 * SUSPICION rather than a finding: "many of the broken keys end `schedule-N-paragraph-` with an
 * empty trailing component, which looks like a section-ref bug rather than lost objects". That is
 * settleable in SQL without touching R2 at all — a key with an empty trailing component is
 * malformed by construction, and if the population matches the malformed set then nothing was
 * lost and the fix is a ref bug, not a re-ingest.
 *
 * §4.2 — the 117,667 `specialist_queue` rows labelled `pdf-only`. The label came from a HEAD
 * request, and TNA answers HEAD on `data.pdf` with 405, so the classification is measuring the
 * wrong thing; 0 of 52 sampled actually had a PDF. This re-tests it with GET on a fresh random
 * sample, because a 52-row sample that decided the fate of 117,667 rows deserves confirming before
 * anything is rewritten.
 *
 * Usage (from scripts/ingest):  npx tsx v38-hygiene.ts [--pdf-sample 60]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}

const arg = (f: string, d: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d }
const PDF_SAMPLE = parseInt(arg('--pdf-sample', '60'), 10)
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const q = async (sql: string, a: any[] = []) => (await pool.query(sql, a)).rows
const n = (v: any) => Number(v).toLocaleString('en-GB')

async function main() {
  // ── §4.3 ────────────────────────────────────────────────────────────────────────────────────
  head('§4.3 — THE BROKEN R2 KEYS: bug or loss?')
  const [shape] = await q(`
    SELECT COUNT(*)::text AS with_key,
           COUNT(*) FILTER (WHERE "r2Key" ~ '-$')::text                     AS trailing_dash,
           COUNT(*) FILTER (WHERE "r2Key" ~ 'paragraph-/')::text            AS empty_para_component,
           COUNT(*) FILTER (WHERE "r2Key" ~ '//')::text                     AS double_slash,
           COUNT(*) FILTER (WHERE "r2Key" ~ '(^|/)[a-z-]+-$')::text         AS any_empty_tail
      FROM corpus_sections WHERE "r2Key" IS NOT NULL`) as any[]
  console.log(`   sections carrying an r2Key            ${n(shape.with_key).padStart(12)}`)
  console.log(`   ── key ends in a bare '-'             ${n(shape.trailing_dash).padStart(12)}`)
  console.log(`   ── '/paragraph-/' empty component     ${n(shape.empty_para_component).padStart(12)}`)
  console.log(`   ── '//' empty path component          ${n(shape.double_slash).padStart(12)}`)
  console.log(`   ── any empty trailing ref component   ${n(shape.any_empty_tail).padStart(12)}`)

  const malformed = await q(`
    SELECT corpus, COUNT(*)::int AS n, MIN(id) AS example_id, MIN("r2Key") AS example_key
      FROM corpus_sections
     WHERE "r2Key" IS NOT NULL AND ("r2Key" ~ '-$' OR "r2Key" ~ '//' OR "r2Key" ~ 'paragraph-/')
     GROUP BY 1 ORDER BY 2 DESC`)
  if (!malformed.length) {
    console.log(`\n   ⚠ NO malformed keys found by shape. The suspicion in the V36 addendum does NOT`)
    console.log(`     hold as stated — the ~288 unreachable objects are not explained by an empty`)
    console.log(`     trailing component, so they need an R2 probe to characterise. Recorded as a`)
    console.log(`     refuted hypothesis rather than carried forward.`)
  } else {
    let tot = 0
    console.log(`\n   malformed by shape, per corpus:`)
    for (const m of malformed) { tot += m.n; console.log(`     ${String(m.corpus).padEnd(26)} ${String(m.n).padStart(6)}   e.g. ${String(m.example_key).slice(0, 70)}`) }
    console.log(`     ${'── total'.padEnd(26)} ${String(tot).padStart(6)}`)
    console.log(`\n   ⚠ compare with the addendum's ~288. A match means the unreachable objects are a`)
    console.log(`     SECTION-REF BUG and nothing was lost; a mismatch means there is a second cause.`)
  }

  // The addendum named the corpora. Check the population it actually measured.
  console.log(`\n   the addendum's population — sections written BEFORE V36 that carry a key:`)
  console.table(await q(`
    SELECT corpus, COUNT(*)::int AS sections
      FROM corpus_sections
     WHERE "r2Key" IS NOT NULL
       AND corpus IN ('scottish-parliament-or','si-pre-2010','primary-acts-pre-2000',
                      'primary-acts-2000plus','regional')
       AND ("r2Key" ~ '-$' OR "r2Key" ~ '//')
     GROUP BY 1 ORDER BY 2 DESC`))

  // ── §4.2 ────────────────────────────────────────────────────────────────────────────────────
  head('§4.2 — THE 117,667 `pdf-only` ROWS')
  const [sq] = await q(`
    SELECT COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE status='pending')::text AS pending,
           COUNT(DISTINCT corpus)::text AS corpora
      FROM specialist_queue WHERE specialist_type='pdf-only'`) as any[]
  console.log(`   specialist_queue pdf-only rows: ${n(sq.total)}  (pending ${n(sq.pending)}, ${sq.corpora} corpora)`)
  console.table(await q(`
    SELECT corpus, COUNT(*)::int AS rows, MIN("createdAt")::text AS oldest
      FROM specialist_queue WHERE specialist_type='pdf-only' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`))

  const sample = await q(`
    SELECT corpus, "docId" FROM specialist_queue
     WHERE specialist_type='pdf-only' ORDER BY md5("docId") LIMIT $1`, [PDF_SAMPLE])
  console.log(`\n   re-testing ${sample.length} at random with GET (the original test used HEAD, which`)
  console.log(`   TNA answers 405 on data.pdf — so it could never have found a PDF):`)
  let hasPdf = 0, no404 = 0, other = 0, err = 0
  const examples: string[] = []
  for (const s of sample) {
    const url = `https://www.legislation.gov.uk/${s.docId}/data.pdf`
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
      const ct = res.headers.get('content-type') ?? ''
      const len = Number(res.headers.get('content-length') ?? '0')
      if (res.ok && /pdf/i.test(ct)) { hasPdf++; if (examples.length < 5) examples.push(`PDF  ${s.docId}  ${ct} ${len}B`) }
      else if (res.status === 404) { no404++ }
      else { other++; if (examples.length < 5) examples.push(`${res.status} ${s.docId}  ${ct}`) }
    } catch { err++ }
  }
  const tested = hasPdf + no404 + other
  console.log(`   ── genuinely serve a PDF        ${String(hasPdf).padStart(4)}  ${((100 * hasPdf) / Math.max(1, tested)).toFixed(1)}%`)
  console.log(`   ── 404, no PDF                  ${String(no404).padStart(4)}`)
  console.log(`   ── other status                 ${String(other).padStart(4)}`)
  console.log(`   ── fetch error                  ${String(err).padStart(4)}`)
  for (const e of examples) console.log(`      ${e}`)
  console.log(`\n   ⚠ The prior measurement was 0 of 52. This is an independent random draw; the two`)
  console.log(`     together are the evidence for rewriting 117,667 labels, which is a bigger act`)
  console.log(`     than either sample alone justifies and is NOT done here.`)

  await endNeonPool()
}
main().catch((e) => { console.error('[v38-hygiene] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
