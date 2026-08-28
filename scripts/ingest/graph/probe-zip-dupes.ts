/** probe-zip-dupes.ts — 133,361 entries but 130,096 gids. Which gid has more than
 *  one entry, what are they called, and does my index silently pick the wrong one? */
import { ZipReader } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'

const ZIP = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const zip = new ZipReader(ZIP)
const byGid = new Map<string, string[]>()
for (const e of zip.entries) {
  const m = e.name.match(ENTRY_RX)
  if (!m) continue
  const g = gidFromEntry(m)
  ;(byGid.get(g) ?? byGid.set(g, []).get(g)!).push(e.name)
}
const dupes = [...byGid.entries()].filter(([, v]) => v.length > 1)
console.log(`gids with more than one entry: ${dupes.length} of ${byGid.size}`)
const suffix: Record<string, number> = {}
for (const [, names] of byGid) for (const n of names) {
  const s = n.match(/-([a-z-]+)-data\.xml$/)?.[1] ?? '?'
  suffix[s] = (suffix[s] ?? 0) + 1
}
console.log('entry-name suffixes across the whole zip:', Object.entries(suffix).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join(', '))
console.log('\nfirst 8 duplicated gids:')
for (const [g, names] of dupes.slice(0, 8)) console.log(`  ${g}\n     ${names.join('\n     ')}`)
console.log('\nuksi/2005/384 entries:', byGid.get('uksi/2005/384'))
console.log('ukpga/2010/25 entries:', byGid.get('ukpga/2010/25'))
zip.close()
