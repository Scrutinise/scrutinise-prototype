// SEARCH-28 - how many of an Act's amending provisions resolve to text we hold, and why the rest do not.
//   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/report-amending-text.ts [gid ...]   (npm run report:amending-text)
// Read-only. Existence for every distinct amending provision; a text-narrowing sample (`mentioning` = the Act's title) for a few.
import { prisma } from '../lib/prisma'
import { amendingText, refFromEdgeId, type AmendingStatus } from '../lib/lex/amending-text'

const ACTS = process.argv.slice(2).length ? process.argv.slice(2) : ['ukpga/2010/15', 'ukpga/1998/42']
const SAMPLE = 25
async function one(gid: string) {
  const title = (await prisma.corpusAct.findFirst({ where: { gid }, select: { title: true } }))?.title ?? gid
  const rows = await prisma.$queryRaw<Array<{ from_id: string; edge_type: string; n: bigint }>>`
    SELECT from_id, edge_type, count(*) n FROM legislation_edges
    WHERE edge_type IN ('amends','repeals','modifies') AND split_part(to_id, ':', 2) = ${gid}
      AND split_part(from_id, ':', 2) <> ${gid}
    GROUP BY from_id, edge_type`
  const provisions = new Map<string, Set<string>>()
  for (const r of rows) { (provisions.get(r.from_id) ?? provisions.set(r.from_id, new Set()).get(r.from_id)!).add(r.edge_type) }
  const ids = [...provisions.keys()]
  const tally: Record<AmendingStatus | 'unparseable', number> = { text: 0, 'held-no-match': 0, 'held-no-text': 0, 'provision-not-held': 0, 'act-not-held': 0, unparseable: 0 }
  let viaExact = 0, viaParent = 0, viaDoc = 0
  const missActs = new Map<string, number>(), missProv: string[] = [], resolved: string[] = []
  for (const id of ids) {
    const ref = refFromEdgeId(id)
    if (!ref) { tally.unparseable++; continue }
    const r = await amendingText(ref, { readText: false, maxSections: 1 })
    tally[r.status]++
    if (r.status === 'text') { if (r.matchedAt === 'parent') viaParent++; else if (r.matchedAt === 'document') viaDoc++; else viaExact++ }
    if (r.status === 'act-not-held') missActs.set(`${ref.corpus}:${ref.gid.split('/')[0]}`, (missActs.get(`${ref.corpus}:${ref.gid.split('/')[0]}`) ?? 0) + 1)
    if (r.status === 'provision-not-held') missProv.push(`${id}  ->  nearest: ${(r.nearby ?? []).slice(0, 2).join(', ') || 'none'}`)
    if (r.status === 'text') resolved.push(id)
  }
  console.log(`\n=== ${title} (${gid}) ===`)
  console.log(`edge rows: ${rows.reduce((a, r) => a + Number(r.n), 0)} · distinct amending provisions: ${ids.length} (as recorded, at the feed's grain)`)
  console.log(`resolve to held text : ${tally.text}  (${Math.round((100 * tally.text) / ids.length)}%)`)
  console.log(`   of which at the grain the feed recorded: ${viaExact}; via the held parent section (feed said subsection): ${viaParent}; only as one whole-document row: ${viaDoc}`)
  console.log(`Act not in corpus    : ${tally['act-not-held']}   by collection:gid-type -> ${[...missActs].map(([k, v]) => `${k}=${v}`).join(', ') || '-'}`)
  console.log(`Act held, provision id not found: ${tally['provision-not-held']}`)
  for (const m of missProv.slice(0, 8)) console.log(`   ${m}`)
  console.log(`held but no stored body: ${tally['held-no-text']} · unparseable ids: ${tally.unparseable}`)
  // text-narrowing sample: of the provisions that resolve, does reading them find a paragraph that names this Act?
  const sample = resolved.slice(0, SAMPLE)
  let found = 0, failedRead = 0
  for (const id of sample) {
    const r = await amendingText(refFromEdgeId(id)!, { mentioning: [title], maxSections: 3 })
    if (r.status === 'text') found++; else if (r.status === 'held-no-text') failedRead++
  }
  console.log(`narrowing sample (${sample.length} resolved provisions, "mentioning" the Act's title): paragraph found for ${found}, no paragraph names it ${sample.length - found - failedRead}, unreadable ${failedRead}`)
}
async function main() { for (const g of ACTS) await one(g) }
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
