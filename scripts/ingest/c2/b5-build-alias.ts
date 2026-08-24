/**
 * b5-build-alias.ts — C3 Lane B5. Emit the regnal↔calendar alias map as a committed artefact.
 *
 * The pairing is the PUBLISHER'S OWN, taken from `v36/source-entries.json` (a full entry walk of
 * legislation.gov.uk's year feeds, 12 Aug 2026), which carries `docId` and `calendarId` on every
 * entry. It is never inferred from titles looking alike — `citation-resolver.ts` already records
 * 173 normalised titles carrying more than one gid.
 *
 * The 23 MB walk file is not something fts-serve should parse at boot, so this reduces it to the
 * pairs alone and writes them next to the resolvers that use them.
 */
import fs from 'fs'; import path from 'path'
const SRC = path.join(__dirname, '..', 'v36', 'source-entries.json')
const OUT = path.join(__dirname, '..', 'search', 'regnal-alias.json')
const store: Record<string, Array<{ docId: string; calendarId: string | null }>> = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const pairs: Record<string, string> = {}
let k = 0
for (const list of Object.values(store)) for (const e of list) {
  if (!e.calendarId || e.calendarId === e.docId) continue
  pairs[e.docId] = e.calendarId; pairs[e.calendarId] = e.docId; k++
}
fs.writeFileSync(OUT, JSON.stringify(pairs))
console.log(`${k.toLocaleString()} pairs → ${Object.keys(pairs).length.toLocaleString()} keys`)
console.log(`${path.relative(process.cwd(), OUT)}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`)
console.log(`spot check: ukpga/Geo4/5/83 → ${pairs['ukpga/Geo4/5/83'] ?? '(absent)'}`)
console.log(`spot check: ukpga/1824/83   → ${pairs['ukpga/1824/83'] ?? '(absent)'}`)
