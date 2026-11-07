/**
 * audit-cba.ts — BRIEF_INGEST_CBA_1 §5.1. Read-only. Writes nothing to Neon or R2.
 *
 * What the corpus already holds of the brief's §1–§3 items: per item, the corpora, documents,
 * section counts, formats, and whether section titles look numbered (section-addressable).
 * Also the CostBenchmark / DeflatorSeries tables (§2 rows 1–2).
 *
 * Output: docs/ingest_traces/cba1_audit.json + printed summary.
 */
import fs from 'fs'
import path from 'path'

try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const ITEMS: { key: string; re: string }[] = [
  { key: 'green-book', re: 'green[- ]book' },
  { key: 'managing-public-money', re: 'managing[- ]public[- ]money' },
  { key: 'magenta-book', re: 'magenta[- ]book' },
  { key: 'better-regulation-framework', re: 'better[- ]regulation[- ]framework' },
  { key: 'ia-template', re: 'impact[- ]assessment[- ](template|toolkit|guidance)' },
  { key: 'aqua-book', re: 'aqua[- ]book' },
  { key: 'orange-book', re: 'orange[- ]book' },
  { key: 'gdp-deflators', re: 'gdp[- ]deflator' },
  { key: 'optimism-bias', re: 'optimism[- ]bias' },
  { key: 'discount-rate', re: 'discount(ing)?[- ]rate|social[- ]time[- ]preference' },
  { key: 'civil-service-statistics', re: 'civil[- ]service[- ]statistics' },
  { key: 'pesa', re: 'public[- ]expenditure[- ]statistical[- ]analys|\\bpesa\\b' },
  { key: 'unit-cost-database', re: 'unit[- ]cost[- ]database|unit[- ]costs? of health' },
  { key: 'costs-of-crime', re: 'costs? of crime' },
]

async function main() {
  const { Client } = await import('pg')
  const url = process.env.NEON_DATABASE_URL!
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 900_000, query_timeout: 900_000 })
  await c.connect()
  console.log('HOST', new URL(url).host)

  const cols = await c.query(`select column_name, data_type from information_schema.columns where table_name='corpus_sections' order by ordinal_position`)
  console.log('COLUMNS', cols.rows.map(r => r.column_name).join(', '))
  const has = (n: string) => cols.rows.some(r => r.column_name === n)

  const out: any = { host: new URL(url).host, at: new Date().toISOString(), items: {} }

  // Corpora list (cheap enough with the corpus index).
  const corpora = await c.query(`select corpus, count(*)::int n from corpus_sections group by 1 order by 1`)
  out.corpora = corpora.rows
  console.log('\nCORPORA', corpora.rows.length)
  for (const r of corpora.rows) console.log(' ', r.corpus, r.n)

  // Exclude the giant speech/case corpora from the title scan — they cite these documents, they do not hold them.
  const SKIP = corpora.rows.filter(r => /hansard|pwdata|caselaw|bailii|judgments|echr|eur-lex|primary-acts|si-|retained-eu|regional|debates/i.test(r.corpus)).map(r => r.corpus)
  out.skippedCorpora = SKIP

  for (const it of ITEMS) {
    const titleCols = ['"sectionTitle"', '"parentDocId"', '"sourceUrl"'].filter(x => has(x.replace(/"/g, '')))
    const where = titleCols.map(col => `${col} ~* $1`).join(' or ')
    const q = await c.query(
      `select corpus, "parentDocId" doc, count(*)::int sections, min(format) fmt, sum(coalesce("wordCount",0))::int words,
              min("sourceUrl") url,
              (array_agg("sectionTitle" order by id))[1:6] titles
         from corpus_sections
        where corpus <> all($2) and status='compiled' and (${where})
        group by 1,2 order by 1,3 desc limit 60`, [it.re, SKIP])
    out.items[it.key] = q.rows
    console.log(`\n== ${it.key}: ${q.rows.length} doc groups`)
    for (const r of q.rows) console.log(`  ${r.corpus} | ${r.doc} | ${r.sections} sec | ${r.fmt} | ${r.words}w | ${r.url}\n     ${JSON.stringify(r.titles).slice(0, 300)}`)
  }

  for (const t of ['"CostBenchmark"', '"DeflatorSeries"']) {
    try {
      const r = await c.query(`select * from ${t} limit 500`)
      out[t.replace(/"/g, '')] = r.rows
      console.log(`\n== ${t}: ${r.rows.length} rows`)
      for (const row of r.rows.slice(0, 60)) console.log('  ', JSON.stringify(row).slice(0, 260))
    } catch (e: any) { console.log(`\n== ${t}: ERROR ${e.message}`) }
  }

  const dir = path.join(__dirname, '../../../docs/ingest_traces')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'cba1_audit.json'), JSON.stringify(out, null, 2))
  console.log('\nWROTE docs/ingest_traces/cba1_audit.json')
  await c.end()
}
main().catch(e => { console.error(e); process.exit(1) })
