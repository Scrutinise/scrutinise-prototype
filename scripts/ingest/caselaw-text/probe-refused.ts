/**
 * probe-refused.ts — the 26 judgments the body guard refused, looked at rather than counted.
 *
 * §6: a residual is only honest if you can say what a user sees for it. Two classes came out of
 * the sweep and they are not the same problem:
 *   - "body has N words, fewer than 50" — the AKN's <judgmentBody> is nearly empty
 *   - "body opens with a stylesheet"    — a style block the 300-document shape census did not
 *                                          contain, which is the guard earning its place
 * This prints each one whole: what the source holds, what the extractor produced, and what is
 * stored today. WRITES NOTHING.
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { aknJudgmentText, checkJudgmentBody, stripAknMeta } from '../shared/akn-text'
import { styleSpans } from '../shared/style-detect'

const ROUTE = 'text-route:akn:judgment-minus-meta'
const SHOW = parseInt(process.argv.find(a => a.startsWith('--show='))?.split('=')[1] ?? '6', 10)

;(async () => {
  const p = namesPool()
  const rows = (await p.query(
    `SELECT id, "sectionTitle", "sourceUrl", "r2Key", "r2RawKey", "wordCount", notes
       FROM corpus_sections
      WHERE corpus='tna-caselaw' AND (notes IS NULL OR notes NOT LIKE '%' || $1 || '%')
      ORDER BY id`, [ROUTE])).rows
  console.log(`${rows.length} rows were not re-compiled\n`)

  const classes: Record<string, string[]> = {}
  const detail: Array<{ r: Record<string, unknown>; raw: string; text: string | null; reason: string }> = []

  for (const r of rows) {
    const raw = await r2Get(r.r2RawKey)
    if (!raw) { (classes['raw object unreadable'] ??= []).push(r.id); continue }
    const fresh = aknJudgmentText(raw)
    if (!fresh) { (classes['no <judgmentBody>/<mainBody>'] ??= []).push(r.id); continue }
    const v = checkJudgmentBody(fresh.text)
    const key = v.reason.replace(/\d+/g, 'N')
    ;(classes[key] ??= []).push(r.id)
    detail.push({ r, raw, text: fresh.text, reason: v.reason })
  }

  for (const [k, ids] of Object.entries(classes).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(ids.length).padStart(3)}  ${k}`)
  }

  // Show the extremes of each class rather than the first N of the whole list.
  const byClass = new Map<string, typeof detail>()
  for (const d of detail) {
    const k = d.reason.replace(/\d+/g, 'N')
    byClass.set(k, [...(byClass.get(k) ?? []), d])
  }
  for (const [k, ds] of byClass) {
    console.log(`\n${'#'.repeat(100)}\nCLASS: ${k}   (${ds.length} rows)\n${'#'.repeat(100)}`)
    for (const d of ds.slice(0, SHOW)) {
      const stored = await r2Get(d.r.r2Key as string)
      console.log(`\n${'-'.repeat(100)}\n${d.r.id}\n  title  ${d.r.sectionTitle}\n  source ${d.r.sourceUrl}`)
      console.log(`  raw AKN ${d.raw.length.toLocaleString()} chars; <judgmentBody> to </judgmentBody> region:`)
      const bodyM = /<((?:\w+:)?judgmentBody)\b[^>]*>([\s\S]*?)<\/\1>/.exec(d.raw)
      console.log(`    ${bodyM ? `${bodyM[2].length.toLocaleString()} chars of XML` : 'NOT FOUND'}`)
      console.log(`  EXTRACTED (${d.text!.length} chars): ${d.text}`)
      const spans = styleSpans(d.text ?? '')
      if (spans.length) {
        console.log(`  CSS runs in the extraction: ${spans.map(s => `${s.start}-${s.end} (${s.rules} rules)`).join(', ')}`)
        console.log(`  around the first run: "${(d.text ?? '').slice(Math.max(0, spans[0].start - 120), spans[0].end + 60)}"`)
        // Where did it come from? Look for a style element outside <meta> in the raw.
        const withoutMeta = stripAknMeta(d.raw)
        const styleM = /<((?:\w+:)?style)\b[^>]*>([\s\S]{0,200})/.exec(withoutMeta)
        console.log(`  style element OUTSIDE <meta> in the raw: ${styleM ? `YES — <${styleM[1]}> "${styleM[2].replace(/\s+/g, ' ').slice(0, 160)}"` : 'no'}`)
      }
      console.log(`  STORED TODAY (${stored?.length.toLocaleString() ?? '—'} chars): ${stored?.slice(0, 240)}`)
    }
  }
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
