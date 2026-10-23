// BRIEF_26S2 §2 + CCh 17 Oct item I — THE FIELD-MAPPING REPORT. READ ONLY: this script writes nothing.
//   npx tsx --env-file=.env scripts/report-26s2-field-mapping.ts
// For every idea that has Coherent Actions: how many rows, and how many hold each field; who WROTE it (as far as the database can say);
// and what the brief's mapping (Impl → Who, Enforce → How, Friction → Against) would do to the values that are there.
import { prisma } from '../lib/prisma'

const nonEmptyJson = (v: unknown): boolean => {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.values(v as object).some((x) => x != null && String(x).trim() !== '')
  return true
}
const hasText = (s: string | null | undefined) => !!s && s.trim().length > 0

async function main() {
  const ideas = await prisma.idea.findMany({ where: { lexCoherentActions: { some: {} } } as never, select: { id: true, title: true, deletedAt: true, archivedAt: true } }).catch(async () => {
    const ids = await prisma.lexCoherentAction.findMany({ distinct: ['ideaId'], select: { ideaId: true } })
    return prisma.idea.findMany({ where: { id: { in: ids.map((i) => i.ideaId) } }, select: { id: true, title: true, deletedAt: true, archivedAt: true } })
  })
  console.log(`ideas with Coherent Actions: ${ideas.length} (${ideas.filter((i) => !i.deletedAt && !i.archivedAt).length} live, ${ideas.filter((i) => i.deletedAt).length} deleted, ${ideas.filter((i) => i.archivedAt && !i.deletedAt).length} archived)`)

  const rows = await prisma.lexCoherentAction.findMany({ where: { status: 'LIVE', ideaId: { in: ideas.map((i) => i.id) } } })
  const liveIdeas = new Map(ideas.filter((i) => !i.deletedAt).map((i) => [i.id, i]))
  const rowsLive = rows.filter((r) => liveIdeas.has(r.ideaId))
  console.log(`LIVE actions on live ideas: ${rowsLive.length} (on all ideas incl. deleted: ${rows.length})`)

  const fields: Array<[string, (r: (typeof rows)[number]) => boolean]> = [
    ['body (practicalStep)', (r) => hasText(r.practicalStep)], ['title', (r) => hasText(r.title)], ['Who (whoImplements)', (r) => hasText(r.whoImplements)],
    ['Target (targetOrganisation)', (r) => hasText(r.targetOrganisation)], ['wording (legislative text)', (r) => hasText(r.wording)], ['mechanismType', (r) => hasText(r.mechanismType)],
    ['Impl (implementationCost JSON)', (r) => nonEmptyJson(r.implementationCost)], ['Enforce (enforcementCost JSON)', (r) => nonEmptyJson(r.enforcementCost)],
    ['Friction (regulatoryFriction JSON)', (r) => nonEmptyJson(r.regulatoryFriction)], ['benefits JSON', (r) => nonEmptyJson(r.benefits)],
    ['Link', (r) => hasText(r.link)], ['Sequence', (r) => hasText(r.sequence)], ['before-ids', (r) => r.beforeIds.length > 0],
    ['avenue', (r) => hasText(r.avenue)], ['causes (targetCauseIds)', (r) => r.targetCauseIds.length > 0], ['heading', (r) => !!r.headingId],
    ['facetProposal pending', (r) => nonEmptyJson(r.facetProposal)], ['policy test verdict', (r) => hasText(r.policyTestVerdict)],
  ]
  console.log('\n## Non-empty counts, LIVE actions on live ideas')
  console.log(`| field | non-empty | of ${rowsLive.length} |`)
  for (const [name, f] of fields) console.log(`| ${name} | ${rowsLive.filter(f).length} | ${(100 * rowsLive.filter(f).length / Math.max(rowsLive.length, 1)).toFixed(0)}% |`)

  console.log('\n## By idea (live ideas): rows · Who · Impl · Enforce · Friction · Link · Sequence · before · avenue · causes · costLines')
  const costLines = await prisma.costLine.groupBy({ by: ['actionId'], _count: { _all: true } }).catch(() => [] as Array<{ actionId: string; _count: { _all: number } }>)
  const clByAction = new Map(costLines.map((c) => [c.actionId, c._count._all] as [string, number]))
  const per = new Map<string, typeof rowsLive>()
  for (const r of rowsLive) per.set(r.ideaId, [...(per.get(r.ideaId) ?? []), r])
  for (const [id, rs] of [...per.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const c = (f: (r: (typeof rows)[number]) => boolean) => rs.filter(f).length
    console.log(`${id.slice(0, 8)} "${(liveIdeas.get(id)?.title ?? '').slice(0, 38)}" · ${rs.length} · Who ${c((r) => hasText(r.whoImplements))} · Impl ${c((r) => nonEmptyJson(r.implementationCost))} · Enf ${c((r) => nonEmptyJson(r.enforcementCost))} · Fr ${c((r) => nonEmptyJson(r.regulatoryFriction))} · Link ${c((r) => hasText(r.link))} · Seq ${c((r) => hasText(r.sequence))} · before ${c((r) => r.beforeIds.length > 0)} · avenue ${c((r) => hasText(r.avenue))} · causes ${c((r) => r.targetCauseIds.length > 0)} · costLines ${rs.filter((r) => (clByAction.get(r.id) ?? 0) > 0).length}`)
  }

  console.log('\n## What the cost-shaped fields actually hold (shape of the JSON, LIVE rows)')
  for (const key of ['implementationCost', 'enforcementCost', 'regulatoryFriction', 'benefits'] as const) {
    const filled = rowsLive.filter((r) => nonEmptyJson(r[key]))
    const shapes = new Map<string, number>()
    let userOverride = 0, withBasis = 0, textual = 0
    for (const r of filled) {
      const v = r[key] as Record<string, unknown>
      const k = typeof v === 'object' && v ? Object.keys(v).sort().join(',') : typeof v
      shapes.set(k, (shapes.get(k) ?? 0) + 1)
      if (v && typeof v === 'object' && (v as { userOverride?: unknown }).userOverride) userOverride++
      if (v && typeof v === 'object' && hasText(String((v as { basis?: unknown }).basis ?? ''))) withBasis++
      if (typeof v === 'string') textual++
    }
    console.log(`${key}: ${filled.length} filled · with a basis sentence ${withBasis} · user-overridden ${userOverride} · stored as plain text ${textual}`)
    for (const [k, n] of [...shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) console.log(`   ${n} × {${k}}`)
    const sample = filled.slice(0, 2).map((r) => JSON.stringify(r[key]).slice(0, 200))
    for (const s of sample) console.log(`   e.g. ${s}`)
  }

  console.log('\n## Who writes each field — what the database can and cannot say')
  const src = new Map<string, number>(); for (const r of rowsLive) src.set(r.source, (src.get(r.source) ?? 0) + 1)
  console.log(`row creator (source): ${[...src.entries()].map(([k, n]) => `${k} ${n}`).join(' · ')}`)
  const wsrc = (f: (r: (typeof rows)[number]) => boolean) => { const m = new Map<string, number>(); for (const r of rowsLive.filter(f)) m.set(r.source, (m.get(r.source) ?? 0) + 1); return [...m.entries()].map(([k, n]) => `${k} ${n}`).join(' · ') || '—' }
  for (const [name, f] of fields.filter(([n]) => /Who|Impl|Enforce|Friction|Link|Sequence|before|avenue|causes|Target|wording/.test(n))) console.log(`  ${name}: filled on rows created by → ${wsrc(f)}`)

  // Classify runs (ledger) and Lex tool calls per idea: the only evidence of a machine hand on facets. No per-field writer is recorded.
  const classify = await prisma.$queryRawUnsafe<Array<{ ideaId: string; n: number; first: Date; last: Date }>>(
    `SELECT "ideaId", count(*)::int n, min("createdAt") first, max("createdAt") last FROM "LlmSpend" WHERE pass = 'actions.facets' AND "ideaId" IS NOT NULL GROUP BY 1`)
  const tools = await prisma.lexToolCall.groupBy({ by: ['ideaId', 'tool'], where: { tool: { in: ['set_action_facets', 'accept_action_facets', 'classify_actions', 'update_action', 'add_action', 'set_facets'] } }, _count: { _all: true } }).catch(() => [])
  const classifyBy = new Map(classify.map((c) => [c.ideaId, c]))
  console.log(`\n"Classify with Lex" (ledger pass actions.facets): ${classify.reduce((a, c) => a + c.n, 0)} runs on ${classify.length} ideas`)
  let facetOnClassified = 0, facetOnNever = 0, facetRowsClassified = 0, facetRowsNever = 0
  for (const [id, rs] of per) {
    const had = classifyBy.has(id)
    const withFacet = rs.filter((r) => hasText(r.link) || hasText(r.sequence) || r.beforeIds.length > 0 || hasText(r.avenue) || r.targetCauseIds.length > 0).length
    if (had) { facetOnClassified += withFacet; facetRowsClassified += rs.length } else { facetOnNever += withFacet; facetRowsNever += rs.length }
  }
  console.log(`rows with ANY facet (link/sequence/before/avenue/causes): on ideas where Classify has run ${facetOnClassified} of ${facetRowsClassified}; on ideas where it never ran ${facetOnNever} of ${facetRowsNever}  ← the second figure can only be hand-set (or Lex chat tools)`)
  console.log(`Lex chat-tool calls touching actions: ${tools.map((t) => `${t.tool} ${t._count._all}`).join(' · ') || 'none recorded'}`)
  const cu = await prisma.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int n FROM "LlmSpend" WHERE pass LIKE 'build.%' AND "ideaId" IN (SELECT "ideaId" FROM "LexCoherentAction" WHERE status='LIVE')`)
  console.log(`build passes on ideas with actions (ledger rows): ${cu[0]?.n ?? 0}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
