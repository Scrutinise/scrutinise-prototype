/** B5 — does the alias actually recover the titles, measured through the REAL loaders? */
import { pool } from './db'
import { loadActTitles } from '../search/fts-record'
import { loadActIndex } from '../search/citation-resolver'
async function main() {
  const p = pool(); const q = async (s:string,a:any[]=[])=>(await p.query(s,a)).rows
  const titles = await loadActTitles(p as any)
  const gids: string[] = (await q(`SELECT DISTINCT split_part(id,':',2) g FROM corpus_sections WHERE corpus='primary-acts-pre-2000' AND status='compiled'`)).map((r:any)=>r.g).filter(Boolean)
  const hit = gids.filter(g => titles.has(g)).length
  console.log(`\npre-2000 instruments resolving to a title THROUGH loadActTitles(): ${hit} of ${gids.length} = ${(100*hit/gids.length).toFixed(1)}%`)
  console.log(`   (measured at 54.2% before this change)`)
  for (const g of ['ukpga/Geo4/5/83','ukpga/1824/83','ukpga/Vict/24-25/97']) console.log(`   ${g.padEnd(24)} → ${titles.get(g) ?? '(no title)'}`)
  const idx = await loadActIndex(p as any)
  for (const t of ['vagrancy act 1824','malicious damage act 1861']) console.log(`   citation "${t}" → ${idx.byTitle.get(t) ?? '(unresolved)'}`)
  await p.end()
}
main().catch(e=>{console.error('FAIL',e);process.exit(1)})
