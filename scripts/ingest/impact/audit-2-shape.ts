/**
 * audit-2-shape.ts — BRIEF_INGEST_IMPACT_NUMBERS §1.2. "Print three real assessments end to end
 * and report the shape."
 *
 * Dumps the HELD text (what a caller would actually get) for named assessments to
 * docs/census/impact_samples/, and prints the region around each proforma cost heading so the
 * layout can be read rather than assumed.
 *
 * Usage: tsx impact/audit-2-shape.ts <ukiaUrlOrId> [...]
 */
import fs from 'fs'
import path from 'path'
import { pool } from '../c2/db'
import { r2Get } from '../shared/r2-client'

const OUT = path.join(__dirname, '../../../docs/census/impact_samples')

/** The headings whose neighbourhood carries the figures. */
const PROBES: Array<[string, RegExp]> = [
  ['EANDCB',            /equivalent annual net (?:direct )?cost to business|EANDCB|net cost to business per year/i],
  ['price base year',   /price base\s*year|price base\b/i],
  ['NPV',               /net present value|NPV|present value/i],
  ['business pop',      /business population|businesses? (?:in scope|affected)|number of businesses/i],
  ['benefits',          /total benefit|benefits \(£m\)|monetised benefit/i],
  ['non-monetised',     /non[- ]monetised benefit|other key non[- ]monetised/i],
  ['RPC opinion',       /RPC opinion|Regulatory Policy Committee/i],
  ['review clause',     /will the policy be reviewed|review date|sunset clause/i],
]

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const p = pool()
  fs.mkdirSync(OUT, { recursive: true })

  for (const a of args) {
    const url = a.startsWith('http') ? a : `https://www.legislation.gov.uk/${a.replace(/^ukia\//, 'ukia/')}`
    const rows = (await p.query(
      `SELECT id, "sectionTitle", "r2Key", "wordCount"
         FROM corpus_sections WHERE corpus='impact-assessments' AND "sourceUrl"=$1
        ORDER BY (regexp_replace(id, '^.*:', ''))::int`, [url])).rows as any[]
    if (!rows.length) { console.log(`NOT HELD: ${url}`); continue }

    const parts: string[] = []
    for (const r of rows) {
      const body = r.r2Key ? await r2Get(r.r2Key) : null
      parts.push(`\n\n═══════ [${r.id}] ${r.sectionTitle}  (${r.wordCount} words) ═══════\n${body ?? '(NO BODY IN R2)'}`)
    }
    const doc = parts.join('')
    const slug = url.replace(/^.*\/ukia\//, '').replace(/\//g, '-')
    fs.writeFileSync(path.join(OUT, `ukia-${slug}.txt`), doc)

    console.log(`\n\n████ ${url} — ${rows.length} sections, ${doc.length} chars → docs/census/impact_samples/ukia-${slug}.txt`)
    console.log(`sections: ${rows.map(r => r.sectionTitle).join(' | ')}`)
    for (const [name, re] of PROBES) {
      const m = doc.match(re)
      if (!m || m.index == null) { console.log(`\n── ${name}: ABSENT`); continue }
      console.log(`\n── ${name} @${m.index} ──\n${doc.slice(Math.max(0, m.index - 120), m.index + 700).replace(/\n{3,}/g, '\n')}`)
    }
  }
  await p.end()
}
main().catch(e => { console.error(e); process.exit(1) })
