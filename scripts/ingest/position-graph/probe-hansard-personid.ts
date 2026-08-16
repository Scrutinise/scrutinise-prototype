/**
 * probe-hansard-personid.ts — BRIEF_GRAPH_2D2 §2, the half the register cannot answer.
 *
 * §2 says the Parliament person id "sits on 98.5% of Hansard speeches and has never been parsed",
 * and §2 also forbids building `spoke-in` this sprint because name-matching 8.8M speeches "would
 * merge distinct people wholesale". Both of those are claims about a population, and this measures
 * them instead of repeating them.
 *
 * ⚠ IT IS A MEASUREMENT, NOT AN INGEST. It reads a bounded random sample of TWFY day-files, counts
 * (speakername, person_id) pairs, and reports the two error rates name-matching would produce on
 * the real Hansard population:
 *
 *   MERGE RATE  one name form used by MORE THAN ONE person   → name-matching fuses distinct people
 *   SPLIT RATE  one person appearing under MORE THAN ONE name → name-matching shatters one person
 *
 * ⚠ WHY THE ID IS NOT ALSO WRITTEN TO THE GRAPH. The id here is TheyWorkForYou's
 * (`uk.org.publicwhip/person/N`), not Parliament's MNIS. The one file that crosswalks the two is
 * mySociety's `parlparse/members/people.json`, whose data licence is unstated (repo LICENSE.txt
 * covers the software as AGPL-3.0; GitHub reports NOASSERTION) — the same unresolved-obligation
 * question as Public Whip's ODbL, and Charlie's call rather than an ingest decision. Storing a
 * second identity space that cannot be joined to the first would add rows and no capability, so
 * this reports and stops. See schema-2d2.sql's §2 header.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/probe-hansard-personid.ts [--files 120]
 */
import { listPwdataFiles, fetchPwdataFile } from '../sources/twfy-pwdata'

export {}

const FILES = Number(process.argv[process.argv.indexOf('--files') + 1]) || 120
const CORPUS = 'pwdata-debates'
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

/**
 * ⚠ THE IDENTIFIER IS NOT ONE ATTRIBUTE AND IT IS NOT ONE ID SPACE. Measured from the bytes
 * (probe-speech-markup.ts, 16 Aug 2026) rather than assumed:
 *
 *   1975 · 1985 · 1995 · 2005 →  speakerid="uk.org.publicwhip/member/N"   a MEMBERSHIP id
 *   2015 · 2019 · 2024        →  person_id="uk.org.publicwhip/person/N"   a PERSON id
 *
 * The first version of this probe looked only for `person_id` and reported entire decades at
 * exactly 0.0% coverage — which is what a parser gap looks like, not what a source gap looks like.
 * A membership is not a person: one person holds many memberships across their career, so a
 * membership id identifies a SEAT-TERM and collapsing the two would split every long-serving member
 * into one actor per Parliament. Both are counted here, and counted separately.
 */
const PERSON = /person_id="uk\.org\.publicwhip\/person\/(\d+)"/
const MEMBERSHIP = /speakerid="uk\.org\.publicwhip\/member\/(\d+)"/
const UNKNOWN_ID = /(speakerid|person_id)="unknown"/
const SPEAKER = /speakername="([^"]*)"/
const NOSPEAKER = /nospeaker="true"/

async function main() {
  head('§2b HANSARD person_id — MEASURED, NOT ASSUMED')
  const all = await listPwdataFiles(CORPUS)
  console.log(`   ${all.length} ${CORPUS} day-files at source`)

  // Deterministic spread across the whole archive rather than a random draw: the archive spans
  // 1919→2026 and the markup changed over that period, so a sample clustered in one era would
  // measure that era and label it "Hansard".
  const step = Math.max(1, Math.floor(all.length / FILES))
  const picked = all.filter((_, i) => i % step === 0).slice(0, FILES)
  console.log(`   sampling every ${step}th file → ${picked.length} files, ${picked[0]?.docId} … ${picked[picked.length - 1]?.docId}`)

  let speeches = 0, withPerson = 0, withMembership = 0, unknownId = 0, withSpeaker = 0
  let noSpeaker = 0, neither = 0, filesRead = 0, filesFailed = 0, filesNoSpeeches = 0
  const nameToPeople = new Map<string, Set<string>>()
  const personToNames = new Map<string, Set<string>>()
  const byEra = new Map<string, { sp: number; pid: number; mid: number }>()

  for (const f of picked) {
    let xml: string | null
    try { xml = await fetchPwdataFile(CORPUS, f.docId) } catch { filesFailed++; continue }
    if (!xml) { filesFailed++; continue }
    filesRead++
    const era = `${f.docId.replace(/[^0-9-]/g, '').slice(0, 4).slice(0, 3)}0s`
    const tags = xml.match(/<speech\b[^>]*>/g) ?? []
    // A day-file with no <speech> at all is a superseded scrape-version stub, not a silent day.
    if (!tags.length) filesNoSpeeches++
    for (const t of tags) {
      speeches++
      const e = byEra.get(era) ?? { sp: 0, pid: 0, mid: 0 }; e.sp++
      const p = PERSON.exec(t)
      const m = MEMBERSHIP.exec(t)
      const s = SPEAKER.exec(t)
      if (p) { withPerson++; e.pid++ }
      if (m) { withMembership++; e.mid++ }
      if (UNKNOWN_ID.test(t)) unknownId++
      byEra.set(era, e)
      if (s?.[1]) withSpeaker++
      if (NOSPEAKER.test(t)) noSpeaker++
      if (!p && !m && !s?.[1] && !NOSPEAKER.test(t)) neither++
      // Only the PERSON id can answer the merge/split question. A membership id would report one
      // person per Parliament and make the split rate look enormous for the wrong reason.
      if (p && s?.[1]) {
        const name = s[1].trim()
        let a = nameToPeople.get(name); if (!a) nameToPeople.set(name, a = new Set()); a.add(p[1])
        let b = personToNames.get(p[1]); if (!b) personToNames.set(p[1], b = new Set()); b.add(name)
      }
    }
  }

  const pc = (n: number) => `${((100 * n) / Math.max(1, speeches)).toFixed(1)}%`
  head('§2b COVERAGE')
  console.log(`   files read ${filesRead}, failed/absent ${filesFailed}, containing no <speech> at all ${filesNoSpeeches} (superseded scrape versions)`)
  console.log(`   <speech> elements                 ${speeches}`)
  console.log(`   carrying a PERSON id              ${withPerson}  (${pc(withPerson)})   ← usable identity`)
  console.log(`   carrying a MEMBERSHIP id only     ${withMembership}  (${pc(withMembership)})   ← a seat-term, NOT a person`)
  console.log(`   ── either                         ${withPerson + withMembership}  (${pc(withPerson + withMembership)})`)
  console.log(`   id present but literally "unknown" ${unknownId}   ← the source saying it could not identify the speaker`)
  console.log(`   carrying speakername              ${withSpeaker}  (${pc(withSpeaker)})`)
  console.log(`   marked nospeaker="true"           ${noSpeaker}   ← procedural text, NOT an unidentified person`)
  console.log(`   ⚠ neither id, name nor nospeaker  ${neither}`)
  console.log(`\n   by decade — the archive is NOT uniform, and a single headline would hide the seam:`)
  for (const [era, v] of [...byEra].sort()) {
    console.log(`      ${era}  ${String(v.sp).padStart(7)} speeches   person ${((100 * v.pid) / Math.max(1, v.sp)).toFixed(1).padStart(5)}%   membership ${((100 * v.mid) / Math.max(1, v.sp)).toFixed(1).padStart(5)}%`)
  }

  head('§2b WHAT NAME-MATCHING WOULD DO TO THIS POPULATION')
  const ambiguousNames = [...nameToPeople.entries()].filter(([, s]) => s.size > 1)
  const multiNamePeople = [...personToNames.entries()].filter(([, s]) => s.size > 1)
  const speechesUnderAmbiguousName = [...nameToPeople.entries()]
    .filter(([, s]) => s.size > 1).length
  console.log(`   distinct speaker names            ${nameToPeople.size}`)
  console.log(`   distinct people (person_id)       ${personToNames.size}`)
  console.log(`   ⚠ MERGE RISK — names used by more than one person   ${ambiguousNames.length}  (${((100 * ambiguousNames.length) / Math.max(1, nameToPeople.size)).toFixed(1)}% of names)`)
  console.log(`   ⚠ SPLIT RISK — people appearing under >1 name        ${multiNamePeople.length}  (${((100 * multiNamePeople.length) / Math.max(1, personToNames.size)).toFixed(1)}% of people)`)
  console.log(`     (${speechesUnderAmbiguousName} ambiguous name forms in this sample alone)`)

  console.log(`\n   names that would have merged distinct people:`)
  for (const [n, s] of ambiguousNames.slice(0, 12)) console.log(`      "${n}" → ${s.size} people (${[...s].slice(0, 5).join(', ')})`)
  console.log(`\n   people who would have been split apart:`)
  for (const [p, s] of multiNamePeople.slice(0, 12)) console.log(`      person/${p} → ${[...s].slice(0, 5).map((x) => `"${x}"`).join(', ')}`)

  console.log(`\n   ⚠ These rates are the argument for §2's own instruction not to build \`spoke-in\` from`)
  console.log(`     names, and they are measured on a ${filesRead}-file sample of one corpus — a floor for`)
  console.log(`     the full 8.8M-speech population, not a census of it. The merge/split figures are`)
  console.log(`     computed ONLY over speeches carrying a person id (${withPerson} of ${speeches}), because a`)
  console.log(`     membership id cannot answer the question without the member→person map.`)
  console.log(`\n   ⚠ AND THAT MAP IS THE BLOCKER, NOT THE PARSING. ${withMembership} speeches here carry a`)
  console.log(`     membership id and no person id. Turning those into people needs`)
  console.log(`     parlparse/members/people.json, whose DATA licence is unstated — so the older majority`)
  console.log(`     of Hansard cannot be person-resolved until Charlie rules on it. Parliament's own`)
  console.log(`     Members API does not publish the publicwhip crosswalk.`)
}
main().catch((e) => { console.error('[probe-hansard-personid] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
