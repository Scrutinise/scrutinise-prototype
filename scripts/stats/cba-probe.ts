// cba-probe.ts — BRIEF_INGEST_CBA_1_EXECUTE §3, READ-ONLY. Fetches the three statistics sources and
// their gov.uk publication records, caches the files, and prints what each sheet actually holds, so the
// loader is written against bytes rather than recollection. Writes nothing to any database.
//
//   npx tsx cba-probe.ts [sheetName ...]
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as XLSX from 'xlsx'

export const CACHE = path.join(os.tmpdir(), 'scrutinise-cba-stats')
const UA = 'Scrutinise/1.0 (civic-tech)'

export const SOURCES = {
  css: {
    page: 'government/statistics/civil-service-statistics-2026',
    url: 'https://assets.publishing.service.gov.uk/media/6ad7476437f279373fa3c9c9/Statistical_tables_-_Civil_Service_Statistics_2026_V2.ods',
    file: 'civil-service-statistics-2026-v2.ods',
  },
  deflOct: {
    page: 'government/statistics/gdp-deflators-at-market-prices-and-money-gdp-october-2026-budget',
    url: 'https://assets.publishing.service.gov.uk/media/6ae32ab0a5c2f99e3a7b82e3/GDP_Deflators_Budget_October_2026_update.xlsx',
    file: 'gdp-deflators-oct-2026-budget.xlsx',
  },
  deflJun: {
    page: 'government/statistics/gdp-deflators-at-market-prices-and-money-gdp-june-2026-quarterly-national-accounts',
    url: 'https://assets.publishing.service.gov.uk/media/6a43dbc7167a99cf0018d9a0/GDP_Deflators_Qtrly_National_Accounts_June_2026_update.xlsx',
    file: 'gdp-deflators-june-2026-qna.xlsx',
  },
  pesa: {
    page: 'government/statistics/public-expenditure-statistical-analyses-2025',
    url: 'https://assets.publishing.service.gov.uk/media/6874fe4582370235232f9343/PESA_2025_CP_Chapter_5_tables.xlsx',
    file: 'pesa-2025-ch5.xlsx',
  },
} as const

export async function fetchCached(url: string, file: string): Promise<Buffer> {
  fs.mkdirSync(CACHE, { recursive: true })
  const p = path.join(CACHE, file)
  if (fs.existsSync(p)) return fs.readFileSync(p)
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  const b = Buffer.from(await r.arrayBuffer())
  fs.writeFileSync(p, b)
  return b
}

/** gov.uk content API: the publication's own dates and the attachment list (to find which page owns a URL). */
export async function govukRecord(page: string): Promise<any> {
  const r = await fetch(`https://www.gov.uk/api/content/${page}`, { headers: { 'User-Agent': UA } })
  if (!r.ok) return { status: r.status }
  const j: any = await r.json()
  const atts = (j.details?.attachments ?? []).map((a: any) => ({ title: a.title, url: a.url }))
  return { status: r.status, title: j.title, first_public_at: j.first_published_at, public_updated_at: j.public_updated_at, attachments: atts }
}

async function main() {
  const only = process.argv.slice(2)
  for (const [k, s] of Object.entries(SOURCES)) {
    const rec = await govukRecord(s.page)
    const owns = rec.attachments?.some((a: any) => a.url === s.url)
    console.log(`\n######## ${k}: ${s.page}\n  status=${rec.status} title=${rec.title}\n  first=${rec.first_public_at} updated=${rec.public_updated_at} ownsAttachment=${owns}`)
    if (!owns && rec.attachments) console.log('  attachments:', rec.attachments.map((a: any) => a.url).slice(0, 12))
    const buf = await fetchCached(s.url, s.file)
    const wb = XLSX.read(buf, { type: 'buffer' })
    console.log(`  bytes=${buf.length} sheets=${wb.SheetNames.length}: ${wb.SheetNames.join(', ')}`)
    for (const n of wb.SheetNames) {
      if (only.length && !only.includes(n)) continue
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, blankrows: false })
      const [a, b] = (process.env.ROWS ?? `0:${only.length ? 40 : 6}`).split(':').map(Number)
      const width = Number(process.env.WIDTH ?? 300)
      console.log(`  --- ${n} (${rows.length} rows)`)
      for (const r of rows.slice(a, b)) console.log('     ' + (r ?? []).map((v) => (v == null ? '' : String(v))).join(' | ').slice(0, width))
    }
  }
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
