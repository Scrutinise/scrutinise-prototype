/**
 * audit-caselaw-text.ts — BRIEF_INGEST_CASELAW_TEXT §1. SCOPING. WRITES NOTHING.
 *
 * Five questions, answered off the system rather than estimated:
 *   1. where the stylesheet comes from  — two documents printed end to end
 *   2. is the good text still on disk   — decides re-compile vs re-fetch
 *   3. how wide is it                   — the same question asked of every case-law collection
 *   4. what the rebuild costs           — documents, bytes
 *   5. what breaks while it runs        — read off the serving path, argued in the report
 *
 * Run: --n=<per-collection sample> (default 60), --docs=<examples to print> (default 2)
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get, r2GetRange, r2Exists } from '../shared/r2-client'
import { styleSpans, styleChars, firstStyleOffset } from '../shared/style-detect'

const COLLECTIONS = ['tna-caselaw', 'ni-judgments', 'scottish-courts', 'et-decisions', 'tax-tribunals', 'echr-hudoc', 'cma-cases']

const arg = (k: string, d: number) => parseInt(process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? String(d), 10)

function pct(a: number, b: number): string { return b ? `${(100 * a / b).toFixed(1)}%` : '—' }

async function q1Examples(p: ReturnType<typeof namesPool>, n: number) {
  console.log('\n' + '='.repeat(100))
  console.log('1.1  WHERE DOES THE STYLESHEET COME FROM — real documents, end to end')
  console.log('='.repeat(100))
  const rows = (await p.query(
    `SELECT id, "sectionTitle", "r2Key", "r2RawKey", "sourceUrl", "wordCount"
       FROM corpus_sections WHERE corpus='tna-caselaw' AND "r2RawKey" IS NOT NULL
       ORDER BY md5(id || 'q1') LIMIT $1`, [n])).rows

  for (const r of rows) {
    const raw = await r2Get(r.r2RawKey)
    const compiled = await r2Get(r.r2Key)
    console.log(`\n${'-'.repeat(100)}\n${r.id}\n  title      ${r.sectionTitle}\n  sourceUrl  ${r.sourceUrl}\n  wordCount  ${r.wordCount}`)
    if (!raw || !compiled) { console.log('  R2 object missing'); continue }

    // Which NODE is the CSS in? Print where each relevant element begins in the raw XML.
    const styleTagM = /<((?:\w+:)?style)\b[^>]*>/.exec(raw)
    const presM = /<((?:\w+:)?presentation)\b[^>]*>/.exec(raw)
    const metaM = /<((?:\w+:)?meta)\b[^>]*>/.exec(raw)
    const bodyM = /<((?:\w+:)?judgmentBody)\b[^>]*>/.exec(raw)
    const headerM = /<((?:\w+:)?header)\b[^>]*>/.exec(raw)
    console.log(`\n  RAW AKN (${raw.length.toLocaleString()} chars) — where each node begins:`)
    const nodes: Array<[string, RegExpExecArray | null]> = [
      ['<meta>', metaM], ['<presentation>', presM], ['<style>', styleTagM], ['<header>', headerM], ['<judgmentBody>', bodyM],
    ]
    for (const [label, m] of nodes) {
      console.log(`    ${label.padEnd(16)} ${m ? `offset ${m.index.toLocaleString()}  as ${m[0].slice(0, 70)}` : 'ABSENT'}`)
    }
    console.log(`\n  RAW head, chars 0-700 (verbatim):`)
    console.log('    ' + raw.slice(0, 700).replace(/\n/g, '\n    '))
    if (styleTagM) {
      console.log(`\n  RAW <style> content, first 400 chars (verbatim):`)
      console.log('    ' + raw.slice(styleTagM.index, styleTagM.index + 400).replace(/\n/g, '\n    '))
    }
    console.log(`\n  COMPILED (${compiled.length.toLocaleString()} chars) — what is STORED and INDEXED, chars 0-700 verbatim:`)
    console.log('    ' + compiled.slice(0, 700))
    const spans = styleSpans(compiled)
    const sc = styleChars(compiled)
    console.log(`\n  -> CSS runs in the compiled text: ${spans.length}  covering ${sc.toLocaleString()} of ${compiled.length.toLocaleString()} chars (${pct(sc, compiled.length)})`)
    console.log(`  -> first CSS run starts at char ${firstStyleOffset(compiled)}`)
    const after = spans.length ? compiled.slice(spans[spans.length - 1].end).replace(/^\s+/, '') : compiled
    console.log(`\n  COMPILED, first 300 chars AFTER the last CSS run — the judgment, which IS there:`)
    console.log('    ' + after.slice(0, 300))
  }
}

async function q2RawOnDisk(p: ReturnType<typeof namesPool>, n: number) {
  console.log('\n' + '='.repeat(100))
  console.log('1.2  IS THE GOOD TEXT STILL ON DISK — re-compile or re-fetch?')
  console.log('='.repeat(100))
  const counts = (await p.query(
    `SELECT COUNT(*)::int AS rows, COUNT("r2RawKey")::int AS with_raw, COUNT("r2Key")::int AS with_compiled
       FROM corpus_sections WHERE corpus='tna-caselaw'`)).rows[0]
  console.log(`  tna-caselaw rows                 ${counts.rows.toLocaleString()}`)
  console.log(`  rows carrying an r2RawKey        ${counts.with_raw.toLocaleString()} (${pct(counts.with_raw, counts.rows)})`)
  console.log(`  rows carrying an r2Key           ${counts.with_compiled.toLocaleString()} (${pct(counts.with_compiled, counts.rows)})`)

  // A DB column is a claim. Ask R2 whether the object is really there.
  const rows = (await p.query(
    `SELECT id, "r2RawKey" FROM corpus_sections WHERE corpus='tna-caselaw' AND "r2RawKey" IS NOT NULL
      ORDER BY md5(id || 'q2') LIMIT $1`, [n])).rows
  let present = 0, isAkn = 0, hasBody = 0, hasName = 0, bytes = 0
  const missing: string[] = []
  await Promise.all(rows.map(async r => {
    const exists = await r2Exists(r.r2RawKey)
    if (!exists) { missing.push(r.id); return }
    present++
    const head = await r2GetRange(r.r2RawKey, 4000)
    if (head && /akomaNtoso/i.test(head)) isAkn++
    if (head && /FRBRname/.test(head)) hasName++
    const full = await r2Get(r.r2RawKey)
    if (full) { bytes += full.length; if (/<(?:\w+:)?judgmentBody\b/.test(full)) hasBody++ }
  }))
  console.log(`\n  sampled ${rows.length} r2RawKey objects:`)
  console.log(`    object present in R2             ${present}/${rows.length} (${pct(present, rows.length)})`)
  console.log(`    is Akoma Ntoso XML               ${isAkn}/${rows.length}`)
  console.log(`    carries FRBRname                 ${hasName}/${rows.length}`)
  console.log(`    carries judgmentBody             ${hasBody}/${rows.length}`)
  console.log(`    mean raw object size             ${present ? Math.round(bytes / present).toLocaleString() : '—'} bytes`)
  if (missing.length) console.log(`    MISSING: ${missing.slice(0, 10).join(', ')}`)
  console.log(`\n  -> VERDICT: ${present === rows.length && hasBody === rows.length ? 'RE-COMPILE from what we hold. No re-fetch.' : 'INCOMPLETE — see missing list.'}`)
  return { rows: counts.rows, meanRawBytes: present ? bytes / present : 0 }
}

async function q3Width(p: ReturnType<typeof namesPool>, n: number) {
  console.log('\n' + '='.repeat(100))
  console.log('1.3  HOW WIDE IS IT — the same question asked of every case-law collection')
  console.log('='.repeat(100))
  const table: Record<string, unknown>[] = []
  for (const corpus of COLLECTIONS) {
    const rows = (await p.query(
      `SELECT id, "r2Key", "sectionTitle" FROM corpus_sections WHERE corpus=$1 AND "r2Key" IS NOT NULL
        ORDER BY md5(id || 'q3') LIMIT $2`, [corpus, n])).rows
    let read = 0, opensWithCss = 0, anyCss = 0, cssCh = 0, allCh = 0, empty = 0, shortDoc = 0
    const examples: string[] = []
    await Promise.all(rows.map(async r => {
      const t = await r2Get(r.r2Key)
      if (t === null) return
      read++
      allCh += t.length
      if (t.trim().length === 0) { empty++; return }
      if (t.trim().length < 400) shortDoc++
      const sc = styleChars(t)
      const off = firstStyleOffset(t)
      if (sc > 0) { anyCss++; cssCh += sc }
      if (off >= 0 && off < 200) {
        opensWithCss++
        if (examples.length < 1) examples.push(t.slice(0, 220))
      }
    }))
    table.push({
      corpus,
      sampled: read,
      'opens with CSS': `${opensWithCss} (${pct(opensWithCss, read)})`,
      'CSS anywhere': `${anyCss} (${pct(anyCss, read)})`,
      'CSS share of chars': pct(cssCh, allCh),
      'empty body': empty,
      'under 400 chars': shortDoc,
      'mean chars': read ? Math.round(allCh / read).toLocaleString() : '—',
    })
    if (examples.length) console.log(`\n  ${corpus} — head of a document that opens with CSS:\n    ${examples[0]}`)
  }
  console.log('')
  console.table(table)
}

async function q4Cost(p: ReturnType<typeof namesPool>, meanRawBytes: number, rows: number) {
  console.log('\n' + '='.repeat(100))
  console.log('1.4  WHAT DOES THE REBUILD COST')
  console.log('='.repeat(100))
  const w = (await p.query(
    `SELECT COUNT(*)::int AS n, SUM("wordCount")::bigint AS words, AVG("wordCount")::int AS avg_words
       FROM corpus_sections WHERE corpus='tna-caselaw'`)).rows[0]
  console.log(`  documents to re-compile          ${w.n.toLocaleString()}`)
  console.log(`  words currently stored           ${Number(w.words).toLocaleString()} (mean ${w.avg_words.toLocaleString()}/doc)`)
  console.log(`  mean raw AKN object              ${Math.round(meanRawBytes).toLocaleString()} bytes`)
  console.log(`  bytes to move (GET raw + PUT compiled) about ${((meanRawBytes * rows * 1.5) / 1e9).toFixed(1)} GB`)
  console.log(`  (timings come from the pilot, not from this estimate — see the report)`)
}

;(async () => {
  const p = namesPool()
  const n = arg('n', 60)
  const docs = arg('docs', 2)
  await q1Examples(p, docs)
  const { rows, meanRawBytes } = await q2RawOnDisk(p, n)
  await q3Width(p, n)
  await q4Cost(p, meanRawBytes, rows)
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
