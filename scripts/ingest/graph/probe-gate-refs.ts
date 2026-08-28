/** probe-gate-refs.ts — do the gate provisions exist under the ids T3 will ask for? */
import { readDocWithVersion, provisionSlice, flattenClml, closeZip, versionsHeld } from './report-common'

const WANT: Array<[string, string, string[]]> = [
  ['ukpga/1998/46', 'Scotland Act 1998', ['section-29', 'schedule-6']],
  ['ukpga/2006/32', 'Government of Wales Act 2006', ['section-108A', 'section-108a', 'section-108']],
  ['ukpga/1998/47', 'Northern Ireland Act 1998', ['section-6', 'schedule-10', 'section-76', 'section-75']],
]

for (const [gid, name, refs] of WANT) {
  const d = readDocWithVersion(gid)
  console.log(`\n=== ${name} ${gid} — versions ${versionsHeld(gid).join('/')} , using ${d?.version} (${d ? (d.xml.length/1024).toFixed(0) : 0} KB) ===`)
  if (!d) continue
  for (const r of refs) {
    const s = provisionSlice(d.xml, r)
    console.log(`  ${r.padEnd(14)} ${s ? `FOUND ${s.length} bytes` : 'not found'}`)
    if (s) console.log(`       ${flattenClml(s).slice(0, 170)}…`)
  }
  // what schedule / part ids exist
  const ids = [...new Set([...d.xml.matchAll(/<(Schedule|Part)\b[^>]*\sid="([^"]+)"/g)].map(m => `${m[1]}#${m[2]}`))]
  console.log(`  schedule/part ids: ${ids.slice(0, 22).join(', ')}`)
  // fair employment
  const fe = [...d.xml.matchAll(/fair employment/gi)].length
  console.log(`  "fair employment" occurrences: ${fe}`)
  // supreme court / judicial committee
  console.log(`  "Supreme Court": ${[...d.xml.matchAll(/Supreme Court/g)].length}, "Judicial Committee": ${[...d.xml.matchAll(/Judicial Committee/g)].length}`)
}
closeZip()
