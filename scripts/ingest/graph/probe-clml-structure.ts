/** probe-clml-structure.ts — what the target Acts' CLML actually looks like. */
import { readDoc, closeZip } from './report-common'

for (const gid of ['ukpga/2010/25', 'ukpga/1998/42']) {
  const xml = readDoc(gid)
  if (!xml) { console.log(`${gid}: NOT IN ZIP`); continue }
  console.log(`\n===== ${gid} (${(xml.length / 1024).toFixed(0)} KB) =====`)
  const tags: Record<string, number> = {}
  for (const m of xml.matchAll(/<([A-Za-z0-9]+)\b[^>]*\sid="([^"]+)"/g)) tags[m[1]] = (tags[m[1]] ?? 0) + 1
  console.log('elements carrying id=:', Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>`${k}=${v}`).join(', '))
  const ids = [...xml.matchAll(/<([A-Za-z0-9]+)\b[^>]*\sid="((?:section|part|schedule|chapter)[^"]*)"/g)].map(m => `${m[1]}#${m[2]}`)
  console.log('first 22 structural ids:', ids.slice(0, 22).join(', '))
  const p1 = xml.match(/<P1group[\s\S]{0,1500}?<\/P1group>/)
  if (p1) console.log('\nfirst P1group:\n', p1[0].slice(0, 1400))
}
closeZip()
