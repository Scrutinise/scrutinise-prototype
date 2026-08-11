/**
 * v34-ukia-pdf-quality.ts — §B step 3. Extraction quality on a real sample,
 * BEFORE committing to a full run. The eur-lex sectioning fault is the standing
 * warning about assuming a document type sections cleanly, so this measures
 * three separate things rather than one "it worked":
 *
 *   1. Does the PDF yield text at all, or is it scanned? (chars, chars/page)
 *   2. Does it carry the standard IA proforma fields — the ones that ARE the
 *      product value ("what is the problem under consideration", "policy
 *      objectives", "options considered", costs/benefits, RPC opinion)?
 *   3. Does it section cleanly on those fields, or is it one undifferentiated
 *      blob (the eur-lex failure mode)?
 *
 * Sample is spread across every year that has content, not the newest N —
 * a pilot that only exercises recent documents has not validated the format.
 */
import fs from 'fs'
import path from 'path'
import { pdfToText } from './shared/compile'

const LEG = 'https://www.legislation.gov.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const OUT = path.join(__dirname, '../../docs/v34_probe')

// The IA proforma. Each is a heading in the standard HM Government template.
const PROFORMA: Array<[string, RegExp]> = [
  ['problem',        /what is the problem under consideration/i],
  ['objectives',     /what are the policy objectives/i],
  ['options',        /what policy options have been considered/i],
  ['preferred',      /preferred option|option \d+ is preferred|policy option \d/i],
  ['costs',          /total cost|cost of preferred|annual cost|net cost to business/i],
  ['benefits',       /total benefit|benefits \(£m\)|net benefit/i],
  ['rpc',            /RPC opinion|Regulatory Policy Committee/i],
  ['review',         /post[- ]implementation review|review date|will the policy be reviewed/i],
  ['signoff',        /I have read the Impact Assessment|Responsible.{0,20}(Minister|Owner)|signed by the responsible/i],
]

async function fetchBuf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

// Pull the PDF link straight from the feed entry — never construct it. The
// constructed form (`ukia2023199_en.pdf`) 404s; the published one is
// `ukia_20230199_en.pdf`. Two probes were burnt on that guess.
async function sampleYear(year: number, n: number): Promise<Array<{ id: string; title: string; pdf: string; dept: string; stage: string; instrument: string | null }>> {
  const res = await fetch(`${LEG}/ukia/${year}/data.feed?page=1`, { headers: { Accept: 'application/atom+xml', 'User-Agent': UA }, signal: AbortSignal.timeout(45_000) })
  const xml = await res.text()
  const out: any[] = []
  for (const entry of xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []) {
    const pdf = entry.match(/<link[^>]*type="application\/pdf"[^>]*href="([^"]+)"/i)?.[1]
    if (!pdf) continue
    out.push({
      id: entry.match(/<id>([^<]+)<\/id>/i)?.[1] ?? '',
      title: (entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim(),
      pdf: pdf.replace(/^http:/, 'https:'),
      dept: entry.match(/ukm:Department Value="([^"]*)"/i)?.[1] ?? '',
      stage: entry.match(/ukm:DocumentStage Value="([^"]*)"/i)?.[1] ?? '',
      // the join the brief wants: which instrument does this IA belong to?
      instrument: entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]*\/impacts\/[^"]*)"/i)?.[1] ?? null,
    })
    if (out.length >= n) break
  }
  return out
}

async function main() {
  const YEARS = [2005, 2006, 2007, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2026]
  const rows: any[] = []

  console.log('=== Sampling 2 IAs per year with content, across the whole range ===\n')
  for (const y of YEARS) {
    const items = await sampleYear(y, 2)
    for (const it of items) {
      const buf = await fetchBuf(it.pdf)
      if (!buf) { console.log(`  ${y} ${it.id.split('/').slice(-2).join('/')}  FETCH FAILED  ${it.pdf}`); rows.push({ y, ok: false }); continue }
      const text = await pdfToText(buf, it.pdf)
      const chars = text?.length ?? 0
      const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length || 1
      const hits = PROFORMA.filter(([, re]) => text && re.test(text)).map(([k]) => k)
      rows.push({ y, id: it.id, chars, pages, cpp: Math.round(chars / pages), hits: hits.length, dept: it.dept, stage: it.stage, instrument: it.instrument })
      console.log(`  ${y} ${String(it.id.split('/').slice(-2).join('/')).padEnd(12)} ${String(buf.length).padStart(8)}B pdf → ${String(chars).padStart(7)} chars / ~${String(pages).padStart(3)}p = ${String(Math.round(chars / pages)).padStart(5)} c/p  proforma ${hits.length}/${PROFORMA.length} [${hits.join(',')}]`)
      console.log(`       "${it.title.slice(0, 78)}"`)
      console.log(`       dept="${it.dept}" stage="${it.stage}" instrument=${it.instrument ?? 'NONE'}`)
      if (chars > 200 && rows.length <= 2) {
        fs.writeFileSync(path.join(OUT, `ukia-extract-${y}.txt`), text ?? '')
        console.log(`       head: ${String(text).replace(/\s+/g, ' ').slice(0, 260)}`)
      }
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log('\n=== VERDICT ===')
  const good = rows.filter(r => r.chars > 1000)
  const scanned = rows.filter(r => r.ok !== false && r.chars <= 1000)
  const failed = rows.filter(r => r.ok === false)
  console.log(`  fetched+extracted >1k chars : ${good.length}/${rows.length}`)
  console.log(`  low yield (likely scanned)  : ${scanned.length}/${rows.length}`)
  console.log(`  fetch failed                : ${failed.length}/${rows.length}`)
  if (good.length) {
    const avg = Math.round(good.reduce((a, r) => a + r.chars, 0) / good.length)
    const avgHits = (good.reduce((a, r) => a + r.hits, 0) / good.length).toFixed(1)
    console.log(`  mean chars per IA           : ${avg}`)
    console.log(`  mean proforma fields found  : ${avgHits}/${PROFORMA.length}`)
    console.log(`  IAs carrying an instrument link: ${rows.filter(r => r.instrument).length}/${rows.length}`)
  }
  fs.writeFileSync(path.join(OUT, 'ukia-pdf-quality.json'), JSON.stringify(rows, null, 2))
  console.log(`\n  detail → ${path.join(OUT, 'ukia-pdf-quality.json')}`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
