/** If the 421 non-OTS rows go, is any of that content lost to the corpus entirely? */
import fs from 'fs'; import path from 'path'
import { pool, OUT } from './db'
async function main() {
  const vs = fs.readFileSync(path.join(OUT,'C3_ots_classification.jsonl'),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l))
  const del = vs.filter((v:any)=>v.verdict==='DELETE')
  const urls = del.map((v:any)=>v.url).filter(Boolean)
  const p = pool(); const q = async (s:string,a:any[]=[]) => (await p.query(s,a)).rows
  const held = await q(`SELECT "sourceUrl", array_agg(DISTINCT corpus) cs, count(*)::int n
      FROM corpus_sections WHERE "sourceUrl" = ANY($1) AND corpus <> 'ots-reports' GROUP BY 1`, [urls])
  console.log(`rows to delete: ${del.length}`)
  console.log(`of those, sourceUrl also held in ANOTHER collection: ${held.length}  (${(held.length/del.length*100).toFixed(1)}%)`)
  const other = new Map<string,number>()
  for (const h of held) for (const c of h.cs) other.set(c, (other.get(c)??0)+1)
  console.log('\n── where the duplicates live')
  for (const [c,n] of [...other].sort((a,b)=>b[1]-a[1])) console.log(`   ${String(n).padStart(4)}  ${c}`)
  const heldSet = new Set(held.map((h:any)=>h.sourceUrl))
  const uniqueOnly = del.filter((v:any)=>!heldSet.has(v.url))
  console.log(`\n── ${uniqueOnly.length} would be held NOWHERE ELSE. By document_type:`)
  const t = new Map<string,number>()
  for (const v of uniqueOnly) t.set(v.documentType ?? '(none)', (t.get(v.documentType ?? '(none)')??0)+1)
  for (const [k,n] of [...t].sort((a,b)=>b[1]-a[1])) console.log(`   ${String(n).padStart(4)}  ${k}`)
  console.log('\n── 15 of the ones held nowhere else')
  for (const v of uniqueOnly.slice(0,15)) console.log(`   [${v.documentType}] ${v.title}`)
  // and the 76 keepers, for the record
  const keep = vs.filter((v:any)=>v.verdict==='KEEP')
  console.log(`\n── the 76 genuine OTS rows, by document_type`)
  const kt = new Map<string,number>()
  for (const v of keep) kt.set(v.documentType ?? '(none)', (kt.get(v.documentType ?? '(none)')??0)+1)
  for (const [k,n] of [...kt].sort((a,b)=>b[1]-a[1])) console.log(`   ${String(n).padStart(4)}  ${k}`)
  await p.end()
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
