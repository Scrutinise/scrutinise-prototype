// ─────────────────────────────────────────────────────────────────────────────
// measure:onward-branching — GRAPH 8 §2.1 / REPORT §1: the real branching factor of a walk.
//
// ⚠ THE PREDICTION WAS RECORDED FIRST (docs/GRAPH_8_REPORT.md §0, 23:38 UTC). This script measures it.
//
// A breadth-first walk at the grain of the INSTRUMENT, depths 1–3, de-duplicated: a node reached at
// depth 1 is not counted again at depth 2. Run over four edge sets, kept apart as the brief requires:
//
//   cites            `legislation_edges` cites only, which is what `onwardFrom()` returns as `cites`
//   cites+text       the same walk with `citation_edge`'s markup AND text references (case law
//                    excluded). This is not a reader output; it tests whether the prediction holds
//                    only once the references `cites` never received are counted as well
//   made-under       the dependency chain (the fixed parser's `enabling` rows), walked until it ends
//   strong           made-under + amends / repeals / modifies / commences
//
// ⚠ INSTRUMENT GRAIN IS THE HONEST GRAIN FOR `cites`, NOT A SIMPLIFICATION. 121,268 of 121,279 cites
// rows point at an Act as a whole (`section-act` / `act-act`), so a walk from any provision of an Act
// reaches exactly what a walk from the Act reaches. Provisions are counted too, in their own column.
//
// ⚠ EVERY HOP GOES THROUGH `legislation_identity` (§2.5): a frontier gid is expanded to all its year
// forms before it is queried, and an `ambiguous-refused` form is counted rather than guessed.
//
// Read-only. Usage: npm run measure:onward-branching [-- --json <path>]
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'fs'
import { prisma } from '../lib/prisma'

const SUBJECTS = [
  { label: 'Constitutional Reform and Governance Act 2010', gid: 'ukpga/2010/25' },
  { label: 'Civil Service (Management Functions) Act 1992', gid: 'ukpga/1992/61' },
  { label: 'Government Resources and Accounts Act 2000', gid: 'ukpga/2000/20' },
  { label: 'Equality Act 2010', gid: 'ukpga/2010/15' },
]
const MAX_DEPTH = 3
/** made-under is walked "until it ends"; this is only a guard against a cycle the data might hold. */
const DEPENDENCY_DEPTH_GUARD = 12

type EdgeSet = 'cites' | 'cites+text' | 'made-under' | 'strong'
const EDGE_TYPES: Record<Exclude<EdgeSet, 'cites+text'>, string[]> = {
  cites: ['cites'],
  'made-under': [],
  strong: ['amends', 'repeals', 'modifies', 'commences'],
}
/** citation_edge detections walked per set, beside the legislation_edges types above. made-under is
 *  read from the fixed parser's `enabling` rows, exactly as `onwardFrom()` reads it. */
const DETECTIONS: Record<EdgeSet, string[]> = {
  cites: [], 'cites+text': ['markup', 'text'], 'made-under': ['enabling'], strong: ['enabling'],
}

// ── the identity bridge, loaded once ──────────────────────────────────────────
const formsOf = new Map<string, Set<string>>()
const refused = new Set<string>()
async function loadIdentity() {
  const rows = await prisma.$queryRawUnsafe<Array<{ form: string; canonical: string | null; basis: string }>>(
    `SELECT form, canonical, basis FROM legislation_identity`)
  const byCanon = new Map<string, Set<string>>()
  for (const r of rows) {
    if (r.basis === 'ambiguous-refused' || !r.canonical) { refused.add(r.form.toLowerCase()); continue }
    const s = byCanon.get(r.canonical) ?? new Set([r.canonical])
    s.add(r.form); byCanon.set(r.canonical, s)
  }
  for (const s of byCanon.values()) for (const f of s) formsOf.set(f.toLowerCase(), s)
  return rows.length
}
let refusedHits = 0
/** One instrument's id forms. Keyed by the bridge's canonical form so two forms are one node. */
function nodeKey(gid: string): string {
  const s = formsOf.get(gid.toLowerCase())
  return s ? [...s].sort()[0] : gid
}
function expand(gids: Iterable<string>): string[] {
  const out = new Set<string>()
  for (const g of gids) {
    if (refused.has(g.toLowerCase())) refusedHits++
    out.add(g); out.add(g.toLowerCase())
    for (const f of formsOf.get(g.toLowerCase()) ?? []) { out.add(f); out.add(f.toLowerCase()) }
  }
  return [...out]
}

/** The instruments one hop inbound of a frontier, and the provisions they were reached from. */
async function step(set: EdgeSet, frontier: string[]): Promise<{ docs: string[]; provisions: number }> {
  const targets = expand(frontier)
  if (!targets.length) return { docs: [], provisions: 0 }
  const docs = new Set<string>()
  let provisions = 0
  // Chunked so one ANY() array stays a sensible size at depth 3.
  for (let i = 0; i < targets.length; i += 5000) {
    const chunk = targets.slice(i, i + 5000)
    if (DETECTIONS[set].length) {
      const r = await prisma.$queryRawUnsafe<Array<{ g: string; p: bigint }>>(
        `SELECT source_gid g, COUNT(DISTINCT coalesce(source_provision_ref,''))::bigint p FROM citation_edge
         WHERE target_act_id = ANY($1::text[]) AND detection = ANY($2::text[]) GROUP BY 1`, chunk, DETECTIONS[set])
      for (const x of r) { docs.add(x.g); provisions += Number(x.p) }
    }
    // ⚠ cites+text walks the legislation_edges cites as well — a markup row is in both tables; the de-dup is by node.
    const types = set === 'cites+text' ? ['cites'] : EDGE_TYPES[set]
    if (types.length) {
      const r = await prisma.$queryRawUnsafe<Array<{ g: string; p: bigint }>>(
        `SELECT split_part(from_id, ':', 2) g, COUNT(DISTINCT from_id)::bigint p FROM legislation_edges
         WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type = ANY($2::text[]) GROUP BY 1`, chunk, types)
      for (const x of r) { docs.add(x.g); if (set !== 'cites+text') provisions += Number(x.p) }
    }
  }
  return { docs: [...docs], provisions }
}

interface DepthRow { depth: number; reached: number; new: number; cumulative: number; provisionsAtStep: number; frontierQueried: number; ms: number }

async function walk(set: EdgeSet, start: string, maxDepth: number): Promise<{ rows: DepthRow[]; ended: number | null }> {
  const seen = new Set<string>([nodeKey(start)])
  let frontier = [start]
  const rows: DepthRow[] = []
  for (let d = 1; d <= maxDepth; d++) {
    const t = Date.now()
    const { docs, provisions } = await step(set, frontier)
    const keys = new Map<string, string>()
    for (const g of docs) keys.set(nodeKey(g), g)
    const fresh = [...keys].filter(([k]) => !seen.has(k))
    for (const [k] of fresh) seen.add(k)
    rows.push({ depth: d, reached: keys.size, new: fresh.length, cumulative: seen.size - 1, provisionsAtStep: provisions, frontierQueried: frontier.length, ms: Date.now() - t })
    frontier = fresh.map(([, g]) => g)
    if (!frontier.length) return { rows, ended: d }
  }
  return { rows, ended: null }
}

;(async () => {
  const jsonAt = process.argv.indexOf('--json')
  const identityRows = await loadIdentity()
  const book = Number((await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*)::bigint n FROM corpus_acts`))[0].n)
  console.log(`identity rows loaded ${identityRows} · statute book denominator (corpus_acts instruments) ${book}\n`)
  const out: any[] = []
  for (const s of SUBJECTS) {
    console.log(`══ ${s.label} (${s.gid})`)
    for (const set of ['cites', 'cites+text', 'made-under', 'strong'] as EdgeSet[]) {
      const depth = set === 'made-under' ? DEPENDENCY_DEPTH_GUARD : MAX_DEPTH
      const r = await walk(set, s.gid, depth)
      out.push({ subject: s.gid, label: s.label, set, ...r })
      const line = r.rows.map((x) => `d${x.depth}: +${x.new} (cum ${x.cumulative}, ${(100 * x.cumulative / book).toFixed(2)}%; ${x.provisionsAtStep} provisions; ${x.ms}ms)`).join(' · ')
      console.log(`  ${set.padEnd(11)} ${line}${r.ended ? `  — ENDS at depth ${r.ended}` : ''}`)
    }
  }
  console.log(`\nambiguous-refused forms met on a frontier: ${refusedHits}`)
  if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ measuredAt: new Date().toISOString(), book, identityRows, refusedHits, walks: out }, null, 1))
  await prisma.$disconnect()
})().catch((e) => { console.error(e); process.exit(1) })
