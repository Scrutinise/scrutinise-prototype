/**
 * measure-s28-bills.ts - SEARCH-28 item 3, arm 1. Does `LEX_ROUTER_BILL_VOCAB` get the right bill PAPER into the first 20, through the product?
 *
 *   LEX_QUERY_ROUTER=true npx tsx --env-file=.env --env-file=<worker.env> --tsconfig tsconfig.json scripts/measure-s28-bills.ts [--rolls 3]
 *
 * Same definition S27 used (docs/SEARCH_S27_REPORT.md section 1), so the numbers are comparable: `runSearch` under production's flag string, the
 * two arms differing by `LEX_ROUTER_BILL_VOCAB` and nothing else; a HIT is a `bills-api` row of the right bill AND the right publication type in
 * the first 20 results; the type is rejoined live from the Bills API (`/Bills/{id}/Publications`, matched on the publication id in the document's sourceUrl); 3 rolls per question
 * per arm because the router is an LLM call; the verdict is the majority of rolls.
 *
 * ⚠ THE TEN ARE S24's RECONSTRUCTION OF S23's, not its literal text (S23's script was thrown away). Said in every printout.
 * ⚠ A row whose publication type cannot be established is counted as UNKNOWN and is not a hit - never silently one.
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { enterPurpose } from '../lib/lex/build-context'

enterPurpose('measurement')
export {}

const argv = process.argv.slice(2)
const ROLLS = parseInt(argv[argv.indexOf('--rolls') + 1] || '3', 10) || 3
const OUT = path.join(__dirname, '../../docs/census/s28-bills.json')
const HEALTH = 'https://www.scrutinise.org/api/health'
const BILLS_API = 'https://bills-api.parliament.uk/api/v1'

interface BillQ { n: number; question: string; billLike: string; typeRe: RegExp; typeWords: string }
const TEN: BillQ[] = [
  { n: 1, question: 'What detention amendments were tabled to the Illegal Migration Bill?', billLike: '%illegal migration%', typeRe: /amendment/i, typeWords: 'amendment paper' },
  { n: 2, question: 'What amendments were tabled to the Nationality and Borders Bill at Report stage?', billLike: '%nationality and borders%', typeRe: /amendment/i, typeWords: 'amendment paper' },
  { n: 3, question: 'What amendments did the Commons give reasons for on the Safety of Rwanda Bill?', billLike: '%safety of rwanda%', typeRe: /amendment|reasons/i, typeWords: 'amendment paper / reasons' },
  { n: 4, question: 'What do the Commons amendments to the Pension Schemes Bill text say?', billLike: '%pension schemes%', typeRe: /^bill$|bill\b/i, typeWords: 'bill text' },
  { n: 5, question: "What do the Mental Health Bill's Explanatory Notes say?", billLike: '%mental health%', typeRe: /explanatory/i, typeWords: 'explanatory notes' },
  { n: 6, question: "What does the Institute for Apprenticeships Bill's Delegated Powers Memorandum say?", billLike: '%apprenticeships%', typeRe: /delegated powers/i, typeWords: 'delegated powers memorandum' },
  { n: 7, question: 'What written evidence was submitted on the Border Security, Asylum and Immigration Bill?', billLike: '%border security%', typeRe: /written evidence|evidence/i, typeWords: 'written evidence' },
  { n: 8, question: "What does the Border Security, Asylum and Immigration Bill's Human Rights Memorandum say?", billLike: '%border security%', typeRe: /human rights|ECHR|convention/i, typeWords: 'human rights memorandum' },
  { n: 9, question: "What does the Pension Schemes Bill's impact assessment say?", billLike: '%pension schemes%', typeRe: /impact assessment/i, typeWords: 'impact assessment' },
  { n: 10, question: 'What does the Keeling schedule showing amendments to the Mental Health Act 1983 say?', billLike: '%mental health%', typeRe: /keeling/i, typeWords: 'keeling schedule' },
]

type Pub = { id: string; title: string; type: string }
const pubCache = new Map<string, Pub[]>()
async function pubsFor(billId: string): Promise<Pub[]> {
  if (pubCache.has(billId)) return pubCache.get(billId)!
  let out: Pub[] = []
  try {
    const j: any = await (await fetch(`${BILLS_API}/Bills/${billId}/Publications`)).json()
    out = (j.publications ?? []).map((p: any) => ({ id: String(p.id), title: String(p.title ?? ''), type: String(p.publicationType?.name ?? '') }))
  } catch { /* an unreadable bill is reported as UNKNOWN rows below, not as a miss */ }
  pubCache.set(billId, out)
  return out
}

async function main() {
  const prod: any = await (await fetch(HEALTH)).json()
  if (!prod?.capabilities) throw new Error('/api/health unreadable - refusing to run under an unknown flag string (CLAUDE.md section 19)')
  const setProd = () => { for (const [k, v] of Object.entries(prod.capabilities)) process.env[k] = v ? 'true' : 'false'; process.env.LEX_VECTOR_STREAMS = (prod.retrieval?.vectorStreams ?? []).join(',') }
  setProd()
  const { runSearch } = await import('../lib/lex/search-gateway')

  const billIds = new Map<string, Set<string>>()
  for (const q of TEN) {
    if (billIds.has(q.billLike)) continue
    const rows = await prisma.$queryRawUnsafe<Array<{ b: string }>>(`SELECT DISTINCT split_part(id, ':', 2) b FROM corpus_sections WHERE corpus = 'bills-api' AND "sectionTitle" ILIKE $1`, q.billLike)
    billIds.set(q.billLike, new Set(rows.map((r) => r.b)))
  }

  const arms = [{ name: 'OFF', vocab: 'false' }, { name: 'ON', vocab: 'true' }]
  const result: Record<string, Array<{ n: number; rolls: Array<{ hit: boolean; rank: number | null; unknownRows: number; streams: string }> ; majority: boolean }>> = {}
  console.log(`measure-s28-bills - flag string from /api/health commit ${String(prod.commit).slice(0, 7)}; ${ROLLS} rolls per question per arm; the ten are S24's reconstruction of S23's, not its text\n`)
  for (const arm of arms) {
    result[arm.name] = []
    for (const q of TEN) {
      const rolls: Array<{ hit: boolean; rank: number | null; unknownRows: number; streams: string }> = []
      for (let r = 0; r < ROLLS; r++) {
        setProd(); process.env.LEX_ROUTER_BILL_VOCAB = arm.vocab
        const out = await runSearch({ keywords: q.question.split(/\s+/).filter(Boolean), intent: 'AD_HOC_RESEARCH', limit: 20 })
        const top = out.results.slice(0, 20)
        const wanted = billIds.get(q.billLike)!
        const bills = top.map((x, i) => ({ x, i })).filter(({ x }) => x.id.startsWith('bills-api:') && wanted.has(x.id.split(':')[1]))
        let rank: number | null = null, unknown = 0
        if (bills.length) {
          const src = await prisma.$queryRawUnsafe<Array<{ id: string; u: string | null }>>(`SELECT id, "sourceUrl" u FROM corpus_sections WHERE id = ANY($1)`, bills.map((b) => b.x.id))
          const urlOf = new Map(src.map((s) => [s.id, s.u]))
          for (const { x, i } of bills) {
            const pubs = await pubsFor(x.id.split(':')[1])
            const u = urlOf.get(x.id)
            const pubId = u?.match(/\/Publications\/(\d+)\//)?.[1]
            const pub = pubId ? pubs.find((p) => p.id === pubId) : undefined
            if (!pub) { unknown++; continue }
            if (q.typeRe.test(`${pub.type} ${pub.title}`)) { rank = i + 1; break }
          }
        }
        rolls.push({ hit: rank !== null, rank, unknownRows: unknown, streams: out.meta.perStream?.map((s) => s.stream).join(',') ?? '(no routing)' })
      }
      const majority = rolls.filter((r) => r.hit).length * 2 > ROLLS
      result[arm.name].push({ n: q.n, rolls, majority })
      console.log(`  ${arm.name.padEnd(3)} #${String(q.n).padEnd(2)} ${rolls.filter((r) => r.hit).length}/${ROLLS}${majority ? ' HIT ' : ' miss'}  ranks ${rolls.map((r) => r.rank ?? '-').join(',')}  unknown-type rows ${rolls.map((r) => r.unknownRows).join(',')}  routed: ${rolls.map((r) => r.streams).join(' | ')}`)
    }
    console.log(`  ${arm.name} majority-of-rolls: ${result[arm.name].filter((r) => r.majority).length} of ${TEN.length}\n`)
  }
  fs.writeFileSync(OUT, JSON.stringify({ takenAt: new Date().toISOString(), commit: prod.commit, rolls: ROLLS, reconstructed: true, result }, null, 2))
  console.log(`wrote ${OUT}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
