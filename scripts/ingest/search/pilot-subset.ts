/**
 * pilot-subset.ts — build the validated pilot subset id-list (vector bake-off).
 *
 * The pilot embeds a ~50–100k-section SUBSET, not the full 16.5M corpus. For the
 * measurement to be valid the subset MUST contain (brief §Subset):
 *   (a) EVERY gold-query expected-source document that exists in the corpus — else
 *       recall is capped by the subset, not the model (we'd measure the wrong thing);
 *   (b) a stratified distractor sample keeping each corpus's proportions — the
 *       realistic non-answer noise that makes retrieval genuinely hard (without it
 *       every model scores ~100% and the pilot can't separate them).
 *
 * We LOCATE gold answers two ways, mirroring how score-fts.ts matches (regex over
 * `id \n sectionTitle \n body`):
 *   - ID-probe patterns (a gov.uk path / corpus:ref, e.g. `ukpga/1988/50:section-21`)
 *     → resolved on NEON by `id LIKE '%literal%'` (the PK btree; body not needed —
 *     the pattern lives in the id). Batched into ONE LIKE-ANY scan.
 *   - TEXT-probe patterns (body/title prose, e.g. `data protection act 2018`,
 *     `grainger`) → resolved on the LANCE corpus_fts BM25 index by a targeted search
 *     on the pattern's own words, then the exact JS regex confirms the hit.
 * Every scoreable expected source is reported found/MISS with an example id — a MISS
 * is surfaced loudly (a gold answer genuinely absent from the corpus is a fair, equal
 * 0 for BM25/vector/hybrid alike, but it is NEVER silently dropped).
 *
 * Distractors: proportional per-corpus id-ordered head (PK-index cheap), deduped
 * against the gold set, topped up to the target. Intra-corpus order is not
 * randomised — the same noise is shown to every model, so it cannot bias the
 * comparison; the stratification across corpora is what buys realism.
 *
 * Output → R2 `_search/pilot/subset.json` (+ local docs/PILOT_SUBSET.md report).
 *
 * Run: tsx search/pilot-subset.ts            (target from PILOT_SUBSET_TARGET, def 60000)
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { tierFor } from './corpus-map'
import { GOLD, GoldQuery } from './gold-queries'
import { r2Put } from '../shared/r2-client'

const TARGET = parseInt(process.env.PILOT_SUBSET_TARGET ?? '60000', 10)
const PER_SOURCE_CAP = parseInt(process.env.PILOT_PER_SOURCE_CAP ?? '30', 10)
const TEXT_POOL = parseInt(process.env.PILOT_TEXT_POOL ?? '150', 10)
const SUBSET_KEY = '_search/pilot/subset.json'
const OUT_MD = path.join(__dirname, '../../../docs/PILOT_SUBSET.md')

type ProbeKind = 'id' | 'text'
type Probe = { kind: ProbeKind; re: RegExp; like?: string; terms?: string }

/** Classify one expected-source pattern as an ID-probe (path/ref in the id) or a
 *  TEXT-probe (prose in title/body), and derive the resolution key. */
function classify(re: RegExp): Probe {
  // RegExp.source escapes forward slashes (`ukpga\/1988\/50`) and dots; unescape the
  // literal path chars so the leading id run is recognised (else it stops at the `\`).
  const src = re.source.replace(/\\([/.:_-])/g, '$1')
  const lead = src.match(/^[A-Za-z0-9/:._-]+/)?.[0] ?? ''
  if (lead && (lead.includes('/') || lead.includes(':'))) {
    return { kind: 'id', re, like: `%${lead}%` }
  }
  // TEXT: strip regex metachars → plain words for a BM25 search
  const terms = src.replace(/\\b/g, ' ').replace(/[^A-Za-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
  return { kind: 'text', re, terms }
}

type SourceCoverage = {
  queryId: string; archetype: string; label: string
  found: boolean; method: string; nIds: number; exampleId: string | null
}

async function main() {
  console.log(`[pilot-subset] target=${TARGET} per-source-cap=${PER_SOURCE_CAP}`)
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3, statement_timeout: 300_000 })
  const conn = await connectLance()
  const table = await conn.openTable(FTS_TABLE)

  // Only queries the scorer actually scores: scoreable recall@20 (A/B incl B6, C/D/E/F).
  const scored: GoldQuery[] = GOLD.filter((q) => q.metric === 'recall@20' && q.scoreable)
  console.log(`[pilot-subset] locating gold answers for ${scored.length} scoreable recall@20 queries`)

  // ── collect every ID-probe LIKE across all sources, resolve in ONE Neon scan ──
  const idLikes = new Set<string>()
  for (const q of scored) for (const s of q.expected) for (const re of s.patterns) {
    const p = classify(re); if (p.kind === 'id' && p.like) idLikes.add(p.like)
  }
  console.log(`[pilot-subset] ${idLikes.size} distinct id-LIKE probes → one Neon scan…`)
  const idHitRows: { id: string }[] = idLikes.size
    ? (await pool.query<{ id: string }>(
        `SELECT id FROM corpus_sections WHERE status='compiled' AND id LIKE ANY($1::text[])`,
        [[...idLikes]])).rows
    : []
  const idHitList = idHitRows.map((r) => r.id)
  console.log(`[pilot-subset] id-LIKE scan returned ${idHitList.length} candidate rows`)

  // ── resolve each expected source ──────────────────────────────────────────────
  const goldIds = new Set<string>()
  const coverage: SourceCoverage[] = []
  // small cache of text-probe searches (same term reused across queries)
  const textCache = new Map<string, { id: string; hay: string }[]>()

  async function textCandidates(terms: string): Promise<{ id: string; hay: string }[]> {
    if (textCache.has(terms)) return textCache.get(terms)!
    let rows: any[] = []
    try {
      rows = await table.search(terms, 'fts', 'body').limit(TEXT_POOL).toArray()
    } catch (e) {
      console.warn(`[pilot-subset] text search failed for "${terms}": ${(e as Error).message}`)
    }
    const out = rows.map((r) => ({ id: r.id as string, hay: `${r.id}\n${r.sectionTitle ?? ''}\n${r.body ?? ''}` }))
    textCache.set(terms, out)
    return out
  }

  for (const q of scored) {
    for (const s of q.expected) {
      const ids: string[] = []
      const methods = new Set<string>()
      for (const re of s.patterns) {
        const p = classify(re)
        if (p.kind === 'id') {
          for (const id of idHitList) {
            if (re.test(id)) { ids.push(id); methods.add('id') ; if (ids.length >= PER_SOURCE_CAP) break }
          }
        } else if (p.terms) {
          const cands = await textCandidates(p.terms)
          for (const c of cands) {
            if (re.test(c.hay)) { ids.push(c.id); methods.add('text'); if (ids.length >= PER_SOURCE_CAP) break }
          }
        }
        if (ids.length >= PER_SOURCE_CAP) break
      }
      const uniq = [...new Set(ids)].slice(0, PER_SOURCE_CAP)
      uniq.forEach((id) => goldIds.add(id))
      coverage.push({
        queryId: q.id, archetype: q.archetype, label: s.label,
        found: uniq.length > 0, method: [...methods].join('+') || '—',
        nIds: uniq.length, exampleId: uniq[0] ?? null,
      })
    }
    const qCov = coverage.filter((c) => c.queryId === q.id)
    console.log(`  ${q.id} ${q.archetype}: ${qCov.filter((c) => c.found).length}/${qCov.length} sources located`)
  }

  const misses = coverage.filter((c) => !c.found)
  console.log(`\n[pilot-subset] gold answers: ${goldIds.size} ids across ${coverage.length} sources (${misses.length} sources MISS)`)
  if (misses.length) {
    console.log('[pilot-subset] MISS (not in corpus / unlocatable — reported, an equal 0 for all methods):')
    for (const m of misses) console.log(`   - ${m.queryId} ${m.archetype}: ${m.label}`)
  }

  // ── stratified distractors (proportional per corpus, id-ordered head) ─────────
  const { rows: corpora } = await pool.query<{ corpus: string; n: string }>(
    `SELECT corpus, count(*)::bigint AS n FROM corpus_sections WHERE status='compiled' GROUP BY corpus`)
  const totalCompiled = corpora.reduce((a, r) => a + Number(r.n), 0)
  const distractorBudget = Math.max(0, TARGET - goldIds.size)
  console.log(`[pilot-subset] distractor budget=${distractorBudget} across ${corpora.length} corpora (total corpus=${totalCompiled})`)

  const distractors = new Set<string>()
  // proportional need per corpus (largest first so top-ups land in big corpora)
  const plan = corpora
    .map((r) => ({ corpus: r.corpus, count: Number(r.n), need: Math.round(distractorBudget * Number(r.n) / totalCompiled) }))
    .sort((a, b) => b.count - a.count)
  for (const p of plan) {
    if (p.need <= 0) continue
    // pull a bit extra to absorb overlap with gold ids; PK-ordered → index-cheap
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM corpus_sections WHERE corpus=$1 AND status='compiled' ORDER BY id LIMIT $2`,
      [p.corpus, p.need + 50])
    let added = 0
    for (const r of rows) {
      if (added >= p.need) break
      if (goldIds.has(r.id) || distractors.has(r.id)) continue
      distractors.add(r.id); added++
    }
  }
  // top up any rounding shortfall from the biggest corpus
  if (distractors.size < distractorBudget) {
    const big = plan[0]
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM corpus_sections WHERE corpus=$1 AND status='compiled' ORDER BY id LIMIT $2`,
      [big.corpus, distractorBudget + goldIds.size + 100])
    for (const r of rows) {
      if (distractors.size >= distractorBudget) break
      if (goldIds.has(r.id) || distractors.has(r.id)) continue
      distractors.add(r.id)
    }
  }
  console.log(`[pilot-subset] distractors=${distractors.size}`)

  await pool.end()

  // ── assemble + persist ────────────────────────────────────────────────────────
  const goldArr = [...goldIds]
  const distArr = [...distractors]
  const all = [...new Set([...goldArr, ...distArr])]
  const subset = {
    generatedAt: new Date().toISOString(),
    target: TARGET,
    total: all.length,
    goldAnswerCount: goldArr.length,
    distractorCount: distArr.length,
    coverage,
    goldAnswerIds: goldArr,
    distractorIds: distArr,
  }
  await r2Put(SUBSET_KEY, JSON.stringify(subset), 'application/json')
  console.log(`[pilot-subset] wrote R2 ${SUBSET_KEY} (${all.length} ids)`)

  // tier mix of the subset (realism check)
  const tierMix: Record<string, number> = {}
  // recompute tier per id from its corpus prefix is not trivial from id alone;
  // report tier mix of distractors by corpus plan instead
  for (const p of plan) tierMix[tierFor(p.corpus)] = (tierMix[tierFor(p.corpus)] ?? 0)

  const md: string[] = []
  md.push('# PILOT_SUBSET — validated vector-pilot subset', '')
  md.push(`*Generated ${subset.generatedAt}. Target ${TARGET}. Total **${all.length}** sections = ${goldArr.length} gold-answer + ${distArr.length} distractor.*`, '')
  md.push('## Gold-answer coverage (scoreable recall@20 sources)', '')
  md.push(`**${coverage.filter((c) => c.found).length}/${coverage.length} sources located in corpus.** ${misses.length} MISS (reported below — an equal 0 for BM25/vector/hybrid, never silently dropped).`, '')
  md.push('| query | arch | source | located | method | #ids | example id |', '|---|---|---|---|---|---|---|')
  for (const c of coverage) {
    md.push(`| ${c.queryId} | ${c.archetype} | ${c.label.replace(/\|/g, '\\|').slice(0, 70)} | ${c.found ? '✓' : '**MISS**'} | ${c.method} | ${c.nIds} | ${c.exampleId ? '`' + c.exampleId.slice(0, 48) + '`' : '—'} |`)
  }
  md.push('')
  if (misses.length) {
    md.push('### MISS detail', '')
    for (const m of misses) md.push(`- **${m.queryId}** (${m.archetype}) — ${m.label}`)
    md.push('')
  }
  md.push('## Distractor plan (proportional per corpus)', '')
  md.push('| corpus | tier | corpus size | distractors |', '|---|---|---|---|')
  for (const p of plan.filter((x) => x.need > 0).slice(0, 40)) {
    md.push(`| ${p.corpus} | ${tierFor(p.corpus)} | ${p.count} | ${p.need} |`)
  }
  md.push('')
  fs.writeFileSync(OUT_MD, md.join('\n'))
  console.log(`[pilot-subset] wrote ${OUT_MD}`)
  console.log(`\n[pilot-subset] DONE — subset of ${all.length} (${goldArr.length} gold + ${distArr.length} distractor). ${misses.length} source MISS.`)
}

main().catch((e) => { console.error('[pilot-subset] FATAL', e); process.exit(1) })
