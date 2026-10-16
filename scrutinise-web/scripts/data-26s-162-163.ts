// 26-S decisions 162, 163 (data half) — PLAN BY DEFAULT; `--write` makes the changes. Counts before AND after are printed.
//   npx tsx --env-file=.env scripts/data-26s-162-163.ts            (plan: counts + samples, writes nothing)
//   npx tsx --env-file=.env scripts/data-26s-162-163.ts --write    (runs when Charlie reports the browser pass done — same step as 8e)
//
//   162a  the 22 citations whose link is in the wrong address space  → `scripts/backfill-committee-urls.ts --write` (run separately; it reads
//         Parliament's API and re-reads each row). This script only COUNTS them before/after.
//   162b  the stored challenge texts carrying the internal vocabulary ("KERNEL TEST FAILED", "THE ROAD TAKEN AT"): the marker is removed and the
//         rest of the sentence kept; nothing else about the row changes. A row whose text would be left empty is reported, not written.
//   163   every challenge with text and no title gets one from its own text (<= 12 words) — lib/lex/issue-title.ts, the SAME function the
//         write path now uses. Any idea, not only 452c5ade.
import { prisma } from '../lib/prisma'
import { titleFromText } from '../lib/lex/issue-title'

const WRITE = process.argv.includes('--write')
const MARKERS = ['KERNEL TEST FAILED', 'THE ROAD TAKEN AT']
const WRONG_URL = /^https?:\/\/(?:www\.)?committees\.parliament\.uk\/publications\/\d+\/(?:html\/?)?$/i

/** Remove the internal markers, and the punctuation they leave behind, keeping the sentence. */
export function stripMarkers(text: string): string {
  let t = text
  for (const m of MARKERS) t = t.replace(new RegExp(`\\s*[—–-]?\\s*${m}\\s*[:—–-]?\\s*`, 'g'), ' ')
  return t.replace(/\s{2,}/g, ' ').replace(/^[\s:—–-]+/, '').trim()
}

async function counts() {
  const [untitled, marked, urls] = await Promise.all([
    prisma.deepeningIssue.count({ where: { OR: [{ title: null }, { title: '' }], NOT: { text: '' } } }),
    prisma.deepeningIssue.count({ where: { OR: MARKERS.map((m) => ({ text: { contains: m } })) } }),
    prisma.evidenceItem.findMany({ where: { url: { contains: 'committees.parliament.uk/publications/' } }, select: { id: true, url: true } }),
  ])
  return { untitledIssues: untitled, markedIssues: marked, wrongCommitteeUrls: urls.filter((u) => WRONG_URL.test(u.url ?? '')).length }
}

async function main() {
  const before = await counts()
  console.log('BEFORE', JSON.stringify(before))
  const marked = await prisma.deepeningIssue.findMany({ where: { OR: MARKERS.map((m) => ({ text: { contains: m } })) }, select: { id: true, ideaId: true, text: true, title: true } })
  console.log(`\n162b — ${marked.length} challenge texts carry the internal vocabulary; ideas: ${[...new Set(marked.map((m) => m.ideaId.slice(0, 8)))].join(', ')}`)
  for (const m of marked.slice(0, 3)) console.log(`   BEFORE: ${m.text.slice(0, 160).replace(/\s+/g, ' ')}\n   AFTER : ${stripMarkers(m.text).slice(0, 160)}`)
  const empties = marked.filter((m) => !stripMarkers(m.text))
  if (empties.length) console.log(`   ⚠ ${empties.length} would be left EMPTY — not written`)

  const untitled = await prisma.deepeningIssue.findMany({ where: { OR: [{ title: null }, { title: '' }], NOT: { text: '' } }, select: { id: true, ideaId: true, text: true } })
  const byIdea: Record<string, number> = {}
  for (const u of untitled) byIdea[u.ideaId.slice(0, 8)] = (byIdea[u.ideaId.slice(0, 8)] ?? 0) + 1
  console.log(`\n163 — ${untitled.length} untitled challenges; by idea: ${JSON.stringify(byIdea)}`)
  for (const u of untitled.slice(0, 3)) console.log(`   "${titleFromText(stripMarkers(u.text))}"  ←  ${u.text.slice(0, 100).replace(/\s+/g, ' ')}`)

  if (!WRITE) { console.log('\nPLAN ONLY — nothing written. Re-run with --write.'); await prisma.$disconnect(); return }

  let cleared = 0, titled = 0
  for (const m of marked) {
    const next = stripMarkers(m.text)
    if (!next) continue
    await prisma.deepeningIssue.update({ where: { id: m.id }, data: { text: next } })
    cleared++
  }
  for (const u of untitled) {
    const title = titleFromText(stripMarkers(u.text))
    if (!title) continue
    await prisma.deepeningIssue.update({ where: { id: u.id }, data: { title } })
    titled++
  }
  console.log(`\nWRITTEN: ${cleared} texts cleared, ${titled} titles set.`)
  console.log('AFTER ', JSON.stringify(await counts()))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
