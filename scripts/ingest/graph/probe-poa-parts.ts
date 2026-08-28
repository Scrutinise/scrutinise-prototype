import { readDocWithVersion, closeZip } from './report-common'
const d = readDocWithVersion('ukpga/1986/64')!
console.log('Public Order Act 1986 Part ids:',
  [...new Set([...d.xml.matchAll(/<Part\b[^>]*\sid="([^"]+)"/g)].map(m => m[1]))].join(', '))
const t = [...d.xml.matchAll(/<Part\b[^>]*\sid="([^"]+)"[^>]*>\s*(?:<Number>([\s\S]*?)<\/Number>)?\s*(?:<Title>([\s\S]*?)<\/Title>)?/g)]
for (const m of t) console.log(`  ${m[1]} — ${(m[3] ?? m[2] ?? '').replace(/<[^>]+>/g,'').trim()}`)
closeZip()
