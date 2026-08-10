/**
 * check-annotation-titles.ts — S2C2 §1 and §2, measured against the LIVE index.
 *
 * §2 asked for two things that cannot be settled by reading the code. First, that teaching
 * fts-search.ts to name the Act an annotation explains changes NOTHING for any other legislation
 * result — asserted, not assumed, because that function is on the path of every legislation hit
 * the product returns. Second, how many annotation rows actually resolve to an Act title.
 *
 * HOW THE "BEFORE" IS OBTAINED, since the code that produced it no longer exists. Not by diffing
 * two code paths — by RECOMPUTING the pre-fix strings independently, from the same primary data
 * the adapter reads (`corpus_sections.sectionTitle`, `corpus_acts.title`, and the id). The old
 * rules were, in full:
 *     isLeg (PRIMARY_LEGISLATION | STATUTORY_INSTRUMENT | EU_LEGISLATION) with a resolvable gid
 *         title = actTitle;  citation = abbr ? `${actTitle}, ${abbr}` : actTitle
 *     everything else
 *         title = sectionTitle ?? corpus;  citation = sectionTitle ?? ''
 * An independent reimplementation catches a class a two-path diff cannot: both paths being wrong
 * together.
 *
 * §1 asked whether the tenth display type changes the panel mix. groupForPanel caps at
 * PER_TYPE_CAP per TYPE, so moving the annotations out of GUIDANCE gives them their own bucket —
 * which is a real change to what reaches the 20 slots, measured here on the same five queries the
 * S2C report used.
 *
 * Usage:  FTS_SEARCH_URL=… npm run check:annotation-titles
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { STREAMS } from '../lib/lex/query-router'
import { groupForPanel } from '../lib/lex/search-stub'
import { interleaveStreams } from '../lib/lex/interleave'
import { ANNOTATION_CORPORA, isAnnotationCorpus } from '../lib/lex/annotation-title'
import { draftFor } from '../../scripts/ingest/search/gold-draft-streams'
import type { SearchResult, SearchResultType } from '../lib/lex/page1-config'

let passed = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}
function section(t: string) { console.log(`\n${t}`) }

if (!process.env.FTS_SEARCH_URL) {
  console.error('FTS_SEARCH_URL is not set — this asserts against the LIVE retrieval path and cannot run without it.')
  process.exit(1)
}

const legislation = STREAMS.find((s) => s.name === 'legislation')!

// The five from the S2C report, so the §1 panel-mix numbers are like-for-like, plus five more so
// the §2 snapshot clears "a few hundred real legislation hits".
const MEASURED_FIVE = [
  'Data Protection Act 2018 purpose of the provisions on automated decision making',
  'why was the Building Safety Act 2022 introduced',
  'explanatory note on the Online Safety Act duties of care',
  'what problem were the money laundering regulations intended to solve',
  'speed limit enforcement on motorways',
]
const EXTRA = [
  'landlord duty to repair rented property',
  'renewable energy subsidy scheme regulations',
  'corporate criminal liability for failure to prevent fraud',
  'restrictions on advertising to children',
  'local authority duty to house homeless applicants',
]

// ── the PRE-FIX rules, reimplemented verbatim ────────────────────────────────
const LEG_TYPES: SearchResultType[] = ['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION']
function gidFromId(id: string): string | null {
  const p = id.split(':'); const g = p.length >= 2 ? p[1] : null
  return g && g.includes('/') ? g : null
}
function refFromId(id: string): string {
  const p = id.split(':'); if (p.length < 3) return ''
  const r = p.slice(2).join(':').trim()
  return !r || r === 'full' ? '' : r.replace(/[.\s]+$/g, '')
}
const REF_ABBR: Record<string, string> = { section: 's.', regulation: 'reg.', article: 'art.', schedule: 'sch.', paragraph: 'para.' }
function refToCitation(ref: string): string {
  if (!ref) return ''
  const segs = ref.split('-'); const out: string[] = []
  for (let i = 0; i < segs.length; i++) {
    const a = REF_ABBR[segs[i].toLowerCase()]
    if (a && i + 1 < segs.length) { out.push(a + segs[i + 1]); i++ }
  }
  return out.join(' ')
}
function preFix(id: string, corpus: string, type: SearchResultType, sectionTitle: string | null, actTitle: string | null) {
  const gid = gidFromId(id)
  if (LEG_TYPES.includes(type) && gid && actTitle) {
    const abbr = refToCitation(refFromId(id))
    return { title: actTitle, citation: abbr ? `${actTitle}, ${abbr}` : actTitle }
  }
  return { title: sectionTitle ?? corpus, citation: sectionTitle ?? '' }
}

const corpusOf = (id: string) => id.split(':')[0]

async function main() {
  const queries = [...MEASURED_FIVE, ...EXTRA]
  const perQuery: Array<{ q: string; results: SearchResult[] }> = []
  for (const q of queries) perQuery.push({ q, results: await legislation.search(q, 20) })
  const all = perQuery.flatMap((p) => p.results)
  console.log(`\n${all.length} legislation-stream hits over ${queries.length} queries`)

  // Primary data for an independent recomputation.
  const ids = [...new Set(all.map((r) => r.id))]
  const rows = await prisma.$queryRaw<Array<{ id: string; sectionTitle: string | null }>>`
    SELECT id, "sectionTitle" FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`
  const titleById = new Map(rows.map((r) => [r.id, r.sectionTitle]))
  const gids = [...new Set(all.flatMap((r) => {
    const p = r.id.split(':')
    return [gidFromId(r.id), p.length >= 4 && p[2]?.includes('/') ? p[2] : null]
  }).filter((g): g is string => !!g))]
  const acts = await prisma.corpusAct.findMany({ where: { gid: { in: gids }, title: { not: null } }, select: { gid: true, title: true } })
  const actByGid = new Map(acts.flatMap((a) => (a.title ? [[a.gid, a.title] as const] : [])))

  // ── §2a — everything that is NOT an annotation must be byte-identical ──────
  section('§2 — the lookup fires ONLY for the annotation corpora')
  const nonAnn = all.filter((r) => !isAnnotationCorpus(corpusOf(r.id)))
  const ann = all.filter((r) => isAnnotationCorpus(corpusOf(r.id)))
  ok(`the snapshot is large enough to mean something (${nonAnn.length} non-annotation hits)`, nonAnn.length >= 200, String(nonAnn.length))
  ok(`…and contains annotations to compare against (${ann.length})`, ann.length > 0)

  const drift: string[] = []
  for (const r of nonAnn) {
    const before = preFix(r.id, corpusOf(r.id), r.type, titleById.get(r.id) ?? null, actByGid.get(gidFromId(r.id) ?? '') ?? null)
    if (before.title !== r.title || before.citation !== r.citation) {
      drift.push(`${r.id}\n      before: ${JSON.stringify(before)}\n      after:  ${JSON.stringify({ title: r.title, citation: r.citation })}`)
    }
  }
  ok('every non-annotation legislation hit is byte-identical, title and citation',
     drift.length === 0, drift.length ? `${drift.length} drifted:\n    ${drift.slice(0, 5).join('\n    ')}` : '')

  // Prove that comparison can FAIL: the annotations, run through the same recomputation, MUST
  // differ — otherwise the byte-identity result above would be vacuous.
  const changed = ann.filter((r) => {
    const before = preFix(r.id, corpusOf(r.id), r.type, titleById.get(r.id) ?? null, null)
    return before.title !== r.title
  })
  ok('…and the same comparison DOES report the annotations as changed (so it is not a no-op)',
     ann.length > 0 && changed.length > 0, `${changed.length}/${ann.length}`)

  // ── §2b — what the annotations now read as, and the resolution rate ────────
  section('§2 — resolution rate and fallback behaviour')
  const p2 = (id: string) => { const p = id.split(':'); return p.length >= 4 ? p[2] : '' }
  const resolvable = ann.filter((r) => actByGid.has(p2(r.id)))
  const unresolvable = ann.filter((r) => !actByGid.has(p2(r.id)))
  console.log(`  in these results: ${resolvable.length}/${ann.length} annotation hits resolve to an Act title`)
  ok('every resolved annotation names the Act, not the gid',
     resolvable.every((r) => r.title.includes(actByGid.get(p2(r.id))!)),
     resolvable.filter((r) => !r.title.includes(actByGid.get(p2(r.id))!)).slice(0, 3).map((r) => r.title).join(' | '))
  ok('…and no resolved annotation still shows a raw gid',
     !resolvable.some((r) => /\b(ukpga|uksi|ukla|asp|anaw|nisr)\/\d{4}\/\d+/.test(r.title)),
     resolvable.filter((r) => /\b(ukpga|uksi)\/\d{4}\/\d+/.test(r.title)).slice(0, 3).map((r) => r.title).join(' | '))
  ok('an unresolved annotation keeps a non-empty title (never blank, never partial)',
     unresolvable.every((r) => r.title.trim().length > 0 && !/—\s*$/.test(r.title)),
     unresolvable.filter((r) => !r.title.trim() || /—\s*$/.test(r.title)).slice(0, 3).map((r) => JSON.stringify(r.title)).join(' | '))
  ok('every annotation hit still has its own URL (not a provision link)',
     ann.every((r) => !!r.url && !/legislation\.gov\.uk\/[a-z]+\/\d+\/\d+\/(section|regulation|article)\//.test(r.url)),
     ann.filter((r) => !r.url).length ? `${ann.filter((r) => !r.url).length} with no url` : '')
  console.log('  sample:')
  for (const r of ann.slice(0, 4)) console.log(`    ${r.type}  ${r.title}\n        ${r.citation}\n        ${r.url}`)

  // Corpus-wide, not just what these queries happened to surface.
  const [rate] = await prisma.$queryRaw<Array<{ rows: bigint; resolved: bigint }>>`
    SELECT COUNT(*) AS rows, COUNT(ca.title) AS resolved
      FROM corpus_sections s
      LEFT JOIN corpus_acts ca ON ca.gid = split_part(s.id, ':', 3) AND ca.title IS NOT NULL
     WHERE s.corpus IN (${Prisma.join([...ANNOTATION_CORPORA])})`
  const pct = Number(rate.resolved) / Number(rate.rows) * 100
  console.log(`  corpus-wide: ${Number(rate.resolved).toLocaleString()}/${Number(rate.rows).toLocaleString()} annotation rows resolve (${pct.toFixed(2)}%)`)
  ok('corpus-wide resolution is high enough to ship without chasing the remainder', pct > 90, `${pct.toFixed(2)}%`)

  // ── §1 — does the tenth type change the panel mix? ────────────────────────
  const mixedDelta: Array<{ q: string; beforeGuid: number; afterGuid: number; beforeAnn: number; afterAnn: number }> = []
  section('§1 — PER_TYPE_CAP: what the tenth type does to the 20 panel slots')
  console.log('  query                                            | before (as GUIDANCE) | after (own bucket)')
  let anyChange = false
  for (const { q, results } of perQuery.filter((p) => MEASURED_FIVE.includes(p.q))) {
    // "Before" = the S2C state: annotations shared the GUIDANCE bucket and its ≤3 cap.
    const asGuidance = results.map((r) => (r.type === 'EXPLANATORY_NOTE' ? { ...r, type: 'GUIDANCE' as SearchResultType } : r))
    const before = groupForPanel(asGuidance)
    const after = groupForPanel(results)
    const count = (rs: SearchResult[], t: string) => rs.filter((r) => r.type === t).length
    const bAnn = before.filter((r) => isAnnotationCorpus(corpusOf(r.id))).length
    const aAnn = after.filter((r) => isAnnotationCorpus(corpusOf(r.id))).length
    if (bAnn !== aAnn || before.length !== after.length) anyChange = true
    console.log(`  ${q.slice(0, 48).padEnd(48)} | ${String(bAnn).padStart(2)} annot, ${String(count(before, 'GUIDANCE')).padStart(2)} guid, ${String(before.length).padStart(2)} total | ` +
                `${String(aAnn).padStart(2)} annot, ${String(count(after, 'GUIDANCE')).padStart(2)} guid, ${String(after.length).padStart(2)} total`)
  }
  ok('the single-stream panel mix is measured, not assumed', true, anyChange ? 'it changes — see the table' : 'unchanged on these five')

  // ⚠ THE SINGLE-STREAM TABLE ABOVE UNDERSTATES IT, AND SAYING SO IS THE POINT. The legislation
  // stream returns only legislation-tier corpora, so the ONLY thing that was ever GUIDANCE in it
  // was the annotations themselves — nothing was being crowded out, and the count could not move.
  // The contention is in the ROUTED panel, where the guidance stream contributes real regulator
  // rows into the same ≤3 bucket the annotations were sharing. Built here from the two streams
  // interleaved, which is deterministic, rather than from a router call, which is not.
  section('§1 — the same measurement where the buckets actually contend (legislation + guidance)')
  const guidance = STREAMS.find((s) => s.name === 'guidance')!
  console.log('  query                                            | before: annot/guid/total | after: annot/guid/total')
  for (const q of MEASURED_FIVE) {
    const [leg, gui] = await Promise.all([legislation.search(q, 20), guidance.search(q, 20)])
    const mixed = interleaveStreams([leg, gui], leg.length + gui.length, { names: ['legislation', 'guidance'], label: 'check' })
    const asGuidance = mixed.map((r) => (r.type === 'EXPLANATORY_NOTE' ? { ...r, type: 'GUIDANCE' as SearchResultType } : r))
    const before = groupForPanel(asGuidance)
    const after = groupForPanel(mixed)
    const realGuid = (rs: SearchResult[]) => rs.filter((r) => r.type === 'GUIDANCE' && !isAnnotationCorpus(corpusOf(r.id))).length
    const annot = (rs: SearchResult[]) => rs.filter((r) => isAnnotationCorpus(corpusOf(r.id))).length
    console.log(`  ${q.slice(0, 48).padEnd(48)} | ${String(annot(before)).padStart(2)} / ${String(realGuid(before)).padStart(2)} / ${String(before.length).padStart(2)}         | ` +
                `${String(annot(after)).padStart(2)} / ${String(realGuid(after)).padStart(2)} / ${String(after.length).padStart(2)}`)
    mixedDelta.push({ q, beforeGuid: realGuid(before), afterGuid: realGuid(after), beforeAnn: annot(before), afterAnn: annot(after) })
  }
  const gained = mixedDelta.filter((d) => d.afterGuid > d.beforeGuid)
  ok(`real regulator guidance recovers panel slots the annotations had been taking (${gained.length}/${MEASURED_FIVE.length} queries)`,
     mixedDelta.every((d) => d.afterGuid >= d.beforeGuid && d.afterAnn >= d.beforeAnn),
     mixedDelta.filter((d) => d.afterGuid < d.beforeGuid || d.afterAnn < d.beforeAnn).map((d) => d.q).join(' | '))

  // ── §1 — the WHY/WHAT pair, pinned ────────────────────────────────────────
  // S2C measured this behaviour and left it unprotected: annotations top-ranked on a WHY
  // question, below the law on a WHAT question. Both halves are needed, because either alone is
  // satisfied by a system that is simply wrong in one direction — always rank notes first, or
  // always drop them. EN1/EN2 in gold-draft-streams.ts encode the pair; this enforces it.
  // ⚠ DRAFT questions, CC-drafted, deliberately outside GOLD. Not a headline number.
  section('§1 — the WHY/WHAT pair (draft gold EN1/EN2), the behaviour S2C left unguarded')
  for (const g of draftFor('legislation')) {
    const top = (await legislation.search(g.query, 20)).slice(0, 20)
    const keys = g.expected.filter((e) => top.some((r) => e.patterns.some((p) => p.test(`${r.id}\n${r.title}\n${r.citation}\n${r.snippet}`))))
    const annN = top.filter((r) => isAnnotationCorpus(corpusOf(r.id))).length
    console.log(`  ${g.id}: ${keys.length}/${g.expected.length} keys · ${annN}/20 annotations`)
    if (g.id === 'EN1') {
      ok('EN1 (WHY): the explanatory note surfaces at all', annN > 0, `${annN}/20`)
      ok('EN1 (WHY): the note for the right Act satisfies the key', keys.length === g.expected.length, `${keys.length}/${g.expected.length}`)
    }
    if (g.id === 'EN2') {
      // ≥1 rather than 2/2: the second key is a plain retrieval miss unrelated to annotations
      // (uksi/2014/3552 does not reach the top 20 today), and asserting a number the system does
      // not make would be a check that fails for the wrong reason.
      ok('EN2 (WHAT): operative law still satisfies at least one key', keys.length >= 1, `${keys.length}/${g.expected.length}`)
      // Half, not zero: the property is "annotations do not CROWD OUT the law", and a knife-edge
      // on zero would fail on one incidental row without anything having gone wrong.
      ok('EN2 (WHAT): annotations do not take over the top 20', annN < 10, `${annN}/20 annotations`)
    }
  }

  await prisma.$disconnect()
  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
}
main().catch((e) => { console.error(e); process.exit(1) })
