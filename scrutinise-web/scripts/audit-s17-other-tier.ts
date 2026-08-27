/**
 * audit-s17-other-tier.ts — S17 §2. ENUMERATE THE `other` TIER BEFORE WIDENING ANYTHING.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE BRIEF'S INSTRUCTION, AND WHY IT IS RIGHT. S16 declined to widen a stream to admit a tier
 * called `other` without knowing what else was in it: *"widening blind is how a stream ends up
 * owning nine unrelated collections and retrieving worse for all of them."* So this enumerates
 * first and proposes second, and it changes no scope.
 *
 * ⚠⚠ IT ALSO RE-ASKS S16'S QUESTION AGAINST THE SERVED INDEX, WHICH IS THE ONLY AUTHORITY.
 * S16's autopsy took the tier from `docs/corpus_reachability.json`, generated 2026-08-20 23:59
 * UTC. That is one day BEFORE S11 re-tiered `cps-guidance` into `guidance`. An artefact that
 * predates the change it is being used to reason about cannot settle the question, so every tier
 * here is read back off `fts-serve` — from hits the service itself returns, carrying their own
 * `tier` field — and the artefact is reported beside it as the OLD value, never instead of it.
 *
 * ⚠⚠ AND IT USES THE REAL SCOPE TEST. S16's autopsy re-implemented admissibility as a local
 * `admits()` that compares `s.tier !== tier` FIRST and never looks at `extraCorpora`. The live
 * `streamCanSelect` (lib/lex/stream-scopes.ts) checks the extra leg BEFORE the tier, because that
 * leg is corpus-only and skips the tier prefilter entirely. On a collection reached through an
 * extra leg the two disagree — the copy says UNREACHABLE where the original says reachable. That
 * is the exact failure `stream-scopes.ts`'s own header warns about ("a copy is how the matrix
 * would keep saying reachable for a month after someone narrowed a filter"), arriving from the
 * other direction. This script imports the real one.
 *
 * Every line states what it counted: hits returned, tiers seen on them, rows in Neon.
 *
 * Usage:
 *   FTS_SEARCH_URL=https://fts-serve-production-4cea.up.railway.app \
 *     tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-s17-other-tier.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { STREAM_SCOPES, STREAM_SCOPES_V2, streamCanSelect } from '../lib/lex/stream-scopes'
import { corpusToType } from '../lib/lex/corpus-type-map'
import { capabilityLine } from '../lib/env-flags'

const FTS_URL = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production-4cea.up.railway.app').replace(/\/$/, '')
const REACH = path.join(__dirname, '../../docs/corpus_reachability.json')
const OUT = path.join(__dirname, '../../docs/census/s17-other-tier.json')

interface Hit { id: string; corpus: string; tier: string; sectionTitle?: string }

async function ftsSearch(query: string, limit: number, body: Record<string, unknown> = {}): Promise<{ hits: Hit[]; echoed: any }> {
  const res = await fetch(`${FTS_URL}/fts-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, ...body }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json() as any
  return { hits: (json.results ?? []) as Hit[], echoed: { corpora: json.corpora ?? null, tier: json.tier ?? null } }
}

async function main() {
  // ⚠ THE CONFIGURATION GOES IN THE ARTEFACT, NOT IN SOMEBODY'S MEMORY OF THE RUN. S14 published
  // recall figures for a fortnight that described a keyword-only system, and its own arms file said
  // so. Any rank printed below is a rank UNDER THIS STRING.
  const CONFIG = `${capabilityLine()} | FTS_SEARCH_URL=${process.env.FTS_SEARCH_URL ? 'set' : 'UNSET'}`
  const degraded: string[] = []
  if (!process.env.FTS_SEARCH_URL?.trim()) degraded.push('FTS_SEARCH_URL unset — the sparse leg searches nothing')
  if (!process.env.LEX_VECTOR_STREAMS?.trim()) degraded.push('LEX_VECTOR_STREAMS unset — no dense leg on any stream; ranks are BM25-only')
  if (!process.env.VECTOR_SEARCH_URL?.trim()) degraded.push('VECTOR_SEARCH_URL unset — no dense leg is possible')

  const reach = JSON.parse(fs.readFileSync(REACH, 'utf8'))
  const oldTiers = new Map<string, Record<string, number>>(reach.rows.map((r: any) => [r.collection, r.index_tiers ?? {}]))
  const candidates: string[] = reach.rows
    .filter((r: any) => Object.keys(r.index_tiers ?? {}).includes('other'))
    .sort((a: any, b: any) => (b.index_tiers.other ?? 0) - (a.index_tiers.other ?? 0))
    .map((r: any) => r.collection)

  console.log('── S17 §2 · THE `other` TIER, ENUMERATED ──')
  console.log(`  config    : ${CONFIG}`)
  console.log(`  degraded  : ${degraded.length ? degraded.join(' | ') : '(none)'}`)
  console.log(`  fts-serve : ${FTS_URL}`)
  console.log(`  artefact  : ${path.basename(REACH)} generated ${reach.generatedAt} — the OLD tier,`)
  console.log('              used ONLY to pick which collections to probe. Every tier below is read')
  console.log('              back off the SERVED index.')
  try {
    const stats = await (await fetch(`${FTS_URL}/stats`)).json() as any
    console.log(`  served    : build=${stats.build ?? '?'} rows=${(stats.rows ?? stats.count ?? '?').toLocaleString?.() ?? stats.rows ?? '?'} width=${stats.width ?? '?'}`)
  } catch (e) { console.log(`  served    : ⚠ /stats unreadable (${(e as Error).message})`) }
  console.log(`  probing ${candidates.length} collections that the artefact puts wholly or partly under 'other'\n`)

  const rows: any[] = []
  for (const corpus of candidates) {
    // A query the collection's own rows will match, taken from its own titles rather than invented:
    // a query that returns nothing would leave the served tier unread and look like an answer.
    const sample = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "sectionTitle", count(*) OVER () AS n FROM corpus_sections
       WHERE corpus = $1 AND "sectionTitle" IS NOT NULL AND length("sectionTitle") > 12 LIMIT 1`, corpus)
    const counts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*) AS n FROM corpus_sections WHERE corpus = $1`, corpus)
    const sections = Number(counts[0]?.n ?? 0)
    const query = String(sample[0]?.sectionTitle ?? corpus).replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 6).join(' ')

    let servedTiers: Record<string, number> = {}
    let hitsReturned = 0
    let probeError: string | null = null
    try {
      const { hits, echoed } = await ftsSearch(query, 40, { corpora: [corpus] })
      hitsReturned = hits.length
      const own = hits.filter((h) => h.corpus === corpus)
      for (const h of own) servedTiers[h.tier] = (servedTiers[h.tier] ?? 0) + 1
      if (echoed.corpora === null) probeError = 'service did not echo the corpora prefilter — tiers below may include other collections'
    } catch (e) { probeError = (e as Error).message }

    // The display type, from the live map, evaluated on a real id of this collection.
    const idRow = await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM corpus_sections WHERE corpus = $1 LIMIT 1`, corpus)
    const servedTier = Object.entries(servedTiers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const type = idRow[0] && servedTier ? corpusToType(corpus, servedTier, idRow[0].id) : null

    const admitting = servedTier && type
      ? STREAM_SCOPES.filter((s) => streamCanSelect(s, corpus, servedTier, type)).map((s) => s.name)
      : []
    const admittingV2 = servedTier && type
      ? STREAM_SCOPES_V2.filter((s) => streamCanSelect(s, corpus, servedTier, type)).map((s) => s.name)
      : []

    const old = oldTiers.get(corpus) ?? {}
    const moved = servedTier !== null && !Object.keys(old).includes(servedTier)

    console.log(`  ${corpus}`)
    console.log(`    Neon sections        ${sections.toLocaleString()}`)
    console.log(`    artefact tiers (20 Aug) ${JSON.stringify(old)}`)
    console.log(`    SERVED tier, read off ${hitsReturned} hits: ${Object.keys(servedTiers).length ? JSON.stringify(servedTiers) : '⚠ NO HITS — tier NOT READ'}` +
      `${moved ? '   ⚠⚠ DISAGREES WITH THE ARTEFACT' : ''}`)
    console.log(`    display type         ${type ?? '⚠ null — dropped by the adapter before any stream sees it'}`)
    console.log(`    streams that admit it (live streamCanSelect): ${admitting.length ? admitting.join(', ') : 'NONE'}` +
      `${admittingV2.length ? `   (V2 would add: ${admittingV2.join(', ')})` : ''}`)
    if (probeError) console.log(`    ⚠ ${probeError}`)
    console.log('')

    rows.push({ corpus, sections, artefactTiers: old, servedTiers, servedTier, hitsReturned, type, admitting, admittingV2, probeError })
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // §2b — THE FOUR QUESTIONS S16 CALLED UNREACHABLE, ASKED AGAIN THROUGH THE REAL STREAM.
  // A classification argument settled by a measurement. If a stream returns the key, the key was
  // never unreachable, whatever any table says.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  const { streams } = await import('../lib/lex/query-router')
  const S16_UNREACHABLE: Array<{ id: string; stream: string; question: string; key: string }> = [
    { id: 'S10-Q25', stream: 'guidance', question: 'What is the CPS guidance on abuse of process?', key: 'cps-guidance:prosecution-guidance/abuse-process:1' },
    { id: 'S10-Q26', stream: 'guidance', question: "How does a case get sent from the magistrates' court to the Crown Court?", key: 'cps-guidance:prosecution-guidance/allocation-sending-and-committal-sentence:1' },
    { id: 'S10-Q27', stream: 'guidance', question: 'How do I appeal a decision to the Administrative Court?', key: 'cps-guidance:prosecution-guidance/appeals-administrative-court:1' },
    { id: 'V2-Q8', stream: 'debates', question: 'What did MSPs say about making it easier to change your legal gender?', key: 'scottish-parliament-or:14066:193' },
  ]
  console.log('  ── §2b · the four S16 UNREACHABLE questions, asked through the owning stream ──')
  console.log('     Not a re-classification from a table: the stream is searched and the rank of the')
  console.log('     key in what it returned is printed, out of how many results.')
  console.log(`     ⚠ UNDER THIS CONFIGURATION: ${degraded.length ? `DEGRADED — ${degraded.join('; ')}` : 'not degraded'}`)
  console.log('     ⚠ The question is asked RAW. The measured run routes it first, so a rank here is')
  console.log('       evidence about REACHABILITY, and is not comparable with an in-stream rank.\n')
  const probes: any[] = []
  for (const q of S16_UNREACHABLE) {
    const s = streams().find((x) => x.name === q.stream)
    if (!s) { console.log(`    ${q.id}  ⚠ no stream named '${q.stream}'`); continue }
    let rank = -2, total = 0, err: string | null = null
    try {
      const hits = await s.search(q.question, 60)
      total = hits.length
      rank = hits.findIndex((h: any) => h.id === q.key)
    } catch (e) { err = (e as Error).message }
    console.log(`    ${q.id.padEnd(8)} stream '${q.stream}' → ${err ? `⚠ ${err}` : rank >= 0 ? `FOUND at rank ${rank + 1} of ${total}` : `not found in ${total} returned`}`)
    console.log(`             ${q.question}`)
    probes.push({ ...q, rank: rank >= 0 ? rank + 1 : null, total, error: err })
  }
  console.log('')

  const unreachable = rows.filter((r) => !r.admitting.length && r.type !== null)
  const unread = rows.filter((r) => r.servedTier === null)
  console.log('  ── summary ──')
  console.log(`    collections probed              ${rows.length}`)
  console.log(`    served tier could not be read   ${unread.length}${unread.length ? ` (${unread.map((r) => r.corpus).join(', ')})` : ''}`)
  console.log(`    typed and admitted by NO stream ${unreachable.length}${unreachable.length ? ` (${unreachable.map((r) => `${r.corpus} ${r.sections.toLocaleString()}`).join(', ')})` : ''}`)
  console.log(`    rows in those collections       ${unreachable.reduce((a, r) => a + r.sections, 0).toLocaleString()}`)
  console.log('  ⚠ "admitted by NO stream" is a statement about the ROUTED path. The unrouted path')
  console.log('    (router off, or its fail-open) searches every tier unfiltered — which is not a')
  console.log('    retrieval policy, it is an accident of a degraded mode.')

  fs.writeFileSync(OUT, JSON.stringify({
    takenAt: new Date().toISOString(), config: CONFIG, degraded, ftsUrl: FTS_URL,
    artefact: reach.generatedAt, rows, probes,
  }, null, 2), 'utf8')
  console.log(`\n  wrote ${OUT}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
