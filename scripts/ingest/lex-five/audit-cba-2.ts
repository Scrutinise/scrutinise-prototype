/**
 * audit-cba-2.ts — BRIEF_INGEST_CBA_1 §5.1/§5.2, second pass. Read-only.
 * §3 precedent Acts (EN + IA held?), MPM annex addressing, NAO/PAC cost material, licences.
 * Output: docs/ingest_traces/cba1_audit_2.json
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const ACTS: [string, string][] = [
  ['Building Safety Act 2022', 'ukpga/2022/30'],
  ['Financial Services and Markets Act 2000', 'ukpga/2000/8'],
  ['Financial Services (Banking Reform) Act 2013', 'ukpga/2013/33'],
  ['Financial Services Act 2012', 'ukpga/2012/21'],
  ['Corporate Manslaughter and Corporate Homicide Act 2007', 'ukpga/2007/19'],
  ['Local Government Act 1972', 'ukpga/1972/70'],
  ['Local Government and Housing Act 1989', 'ukpga/1989/42'],
  ['Health and Care Act 2022', 'ukpga/2022/31'],
  ['Constitutional Reform and Governance Act 2010', 'ukpga/2010/25'],
]

async function main() {
  const { Client } = await import('pg')
  const url = process.env.NEON_DATABASE_URL!
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 900_000, query_timeout: 900_000 })
  await c.connect()
  console.log('HOST', new URL(url).host)
  const out: any = { acts: [] }

  for (const [name, uri] of ACTS) {
    const en = await c.query(`select count(*)::int n, sum(coalesce("wordCount",0))::int w from corpus_sections where corpus='explanatory-notes' and status='compiled' and id like $1`, [`explanatory-notes:${uri}:%`])
    const ia = await c.query(`select "parentDocId" doc, count(*)::int n, min(attribution) att, min("sourceUrl") url from corpus_sections where corpus='impact-assessments' and status='compiled' and ("parentDocId" = $1 or "parentDocId" like $2) group by 1`, [uri, `${uri}/%`])
    // An IA for a BILL is often keyed to nothing on legislation.gov.uk; look by title too.
    const short = name.replace(/ \d{4}$/, '')
    const iat = await c.query(`select "parentDocId" doc, count(*)::int n, min("sectionTitle") t, min(id) id from corpus_sections where corpus='impact-assessments' and "sectionTitle" ilike $1 group by 1 limit 10`, [`%${short}%`])
    const rec = { name, uri, enSections: en.rows[0].n, enWords: en.rows[0].w, iaByInstrument: ia.rows, iaByTitle: iat.rows }
    out.acts.push(rec)
    console.log(`\n${name} (${uri}): EN ${rec.enSections} sec / ${rec.enWords}w | IA by instrument ${ia.rows.length} | IA by title ${iat.rows.length}`)
    for (const r of ia.rows) console.log(`   IA ${r.doc} ${r.n} sec ${r.url} ${String(r.att).slice(0, 120)}`)
    for (const r of iat.rows) console.log(`   IA-title ${r.id} ${r.n} sec | ${String(r.t).slice(0, 120)}`)
  }

  const iaShape = await c.query(`select count(distinct split_part(id,':',2))::int docs, count(*)::int secs, count(*) filter (where "parentDocId" is null)::int nullparent, min("itemDate")::text d0, max("itemDate")::text d1 from corpus_sections where corpus='impact-assessments'`)
  out.iaShape = iaShape.rows[0]
  console.log('\nIA collection', JSON.stringify(iaShape.rows[0]))

  const mpm = await c.query(`select id, "sectionTitle", "wordCount", "itemDate"::text d, licence from corpus_sections where corpus='govuk-core-docs' and "parentDocId"='government/publications/managing-public-money' and ("sectionTitle" ~* 'Annex 4\\.6|Chapter 3 .* 3\\.3|Annex 4\\.' ) order by id limit 12`)
  out.mpmSample = mpm.rows
  console.log('\nMPM sample'); for (const r of mpm.rows) console.log(`   ${r.id} | ${r.wordCount}w | ${r.d} | ${r.licence} | ${r.sectionTitle}`)

  const gb = await c.query(`select id, "sectionTitle", "wordCount", format, "itemDate"::text d, "sourceUrl", licence from corpus_sections where corpus='govuk-core-docs' and ("parentDocId" ~* 'green-book|magenta|orange-book|aqua' ) and "sectionTitle" !~* ' › ' order by id`)
  out.coreDocsUnsplit = gb.rows
  console.log('\nGreen/Magenta/Orange/Aqua whole-document rows'); for (const r of gb.rows) console.log(`   ${r.id} | ${r.format} ${r.wordCount}w | ${r.d} | ${r.licence} | ${r.sectionTitle} | ${r.sourceUrl}`)
  const split = await c.query(`select "parentDocId" doc, count(*)::int n, count(*) filter (where "sectionTitle" ~ ' › ')::int headed from corpus_sections where corpus='govuk-core-docs' and "parentDocId" ~* 'green-book|magenta|orange-book|aqua|managing-public-money' group by 1`)
  out.coreDocsSplit = split.rows
  console.log('\nheaded vs total'); for (const r of split.rows) console.log(`   ${r.doc}: ${r.headed} headed of ${r.n}`)

  const nao = await c.query(`select count(*)::int n, count(*) filter (where "sectionTitle" ~* 'major project|senior responsible|accounting officer|project delivery|written off|write-off')::int topical from corpus_sections where corpus='nao-reports'`)
  const pac = await c.query(`select count(*)::int n from corpus_sections where corpus='committees-reports' and "sectionTitle" ~* 'public accounts committee|committee of public accounts'`)
  out.nao = nao.rows[0]; out.pac = pac.rows[0]
  console.log('\nNAO', JSON.stringify(nao.rows[0]), 'PAC-titled committee reports', pac.rows[0].n)

  const lic = await c.query(`select corpus, licence, count(*)::int n from corpus_sections where corpus in ('govuk-core-docs','impact-assessments','nao-reports','explanatory-notes','committees-reports','departmental-accounts','independent-reviews') group by 1,2 order by 1,3 desc`)
  out.licences = lic.rows
  console.log('\nLicences'); for (const r of lic.rows) console.log(`   ${r.corpus} | ${r.licence} | ${r.n}`)

  const cb = await c.query(`select source, count(*)::int n, min("priceYear") p0, max("priceYear") p1 from "CostBenchmark" group by 1 order by 2 desc`)
  out.costBenchmarkBySource = cb.rows
  console.log('\nCostBenchmark by source'); for (const r of cb.rows) console.log(`   ${r.n} | ${r.source} | price years ${r.p0}–${r.p1}`)
  const ds = await c.query(`select min(year) y0, max(year) y1, count(*)::int n, max("updatedAt")::text upd from "DeflatorSeries"`)
  out.deflator = ds.rows[0]
  console.log('\nDeflatorSeries', JSON.stringify(ds.rows[0]))

  fs.writeFileSync(path.join(__dirname, '../../../docs/ingest_traces/cba1_audit_2.json'), JSON.stringify(out, null, 2))
  console.log('\nWROTE docs/ingest_traces/cba1_audit_2.json')
  await c.end()
}
main().catch(e => { console.error(e); process.exit(1) })
