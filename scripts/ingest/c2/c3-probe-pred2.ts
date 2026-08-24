import fs from 'fs'; import path from 'path'
import { connectLance, FTS_TABLE } from '../search/lance'
import { VEC_TABLE, CHUNKS_TABLE } from '../search/vector-common'
async function main() {
  const ids = fs.readFileSync(path.join(__dirname,'purge-manifests','et-decisions-landing.2026-08-24T00-34-43-701Z.ids.txt'),'utf8').split('\n').map(s=>s.trim()).filter(Boolean)
  const db = await connectLance()
  const esc=(s:string)=>s.replace(/'/g,"''")
  for (const [t,key] of [[FTS_TABLE,'id'],[CHUNKS_TABLE,'sectionId'],[VEC_TABLE,'sectionId']] as [string,string][]) {
    const tbl = await db.openTable(t)
    console.log(`\n── ${t}  key=${key}`)
    for (const variant of [key, `"${key}"`]) {
      const one = ids[0]
      let a=-1,b=-1,err=''
      try { a = await tbl.countRows(`${variant} = '${esc(one)}'`) } catch(e:any){ err=e.message }
      const list = ids.slice(0,2000).map(i=>`'${esc(i)}'`).join(',')
      const t0=Date.now()
      try { b = await tbl.countRows(`${variant} IN (${list})`) } catch(e:any){ err=e.message }
      console.log(`   ${variant.padEnd(12)} eq=${a}  in2000=${b}  ${((Date.now()-t0)/1000).toFixed(1)}s  ${err}`)
    }
  }
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
