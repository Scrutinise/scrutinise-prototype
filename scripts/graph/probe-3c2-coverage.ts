/**
 * probe-3c2-coverage.ts — GRAPH 3C-2 §2. Can ~50 SOUND rows actually be reached?
 *
 * Brief: *"If you cannot reach ~50 sound candidates, report that rather than padding. A thin key we
 * trust beats a full key we don't."* So the number is measured before a document is written, not
 * discovered while writing one.
 *
 * The pool is the members already in the 157-row draft. ⚠ Those members were identified BY
 * AMENDMENT SPONSORSHIP, which this sprint has just rejected as a basis — and that is fine, because
 * it is being used here for RELEVANCE, not for DIRECTION. "This member engaged with this matter" is
 * exactly what an unsigned fact can tell you; it is only the direction it cannot supply. The
 * direction comes from the speech.
 *
 * Usage (from scripts/graph):  npx tsx probe-3c2-coverage.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import fs from 'fs'
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const DOC = path.join(__dirname, '../../docs/POSITION_VALIDATION_CANDIDATES.md')

/** The debate-title needle per matter — the same strings the draft used to count divisions. */
export const MATTER_TITLE: Record<string, string> = {
  M1: 'Terminally Ill Adults', M2: 'Safety of Rwanda', M3: 'Illegal Migration',
  M4: 'Nationality and Borders', M5: 'European Union (Withdrawal)', M6: 'Tobacco and Vapes',
  M7: 'Public Order Bill', M8: 'Minimum Service Levels', M9: 'Environment Bill',
  M10: 'Retained EU Law',
}
export const MATTER_NAME: Record<string, string> = {
  M1: 'Assisted dying', M2: 'Removals to Rwanda', M3: 'Illegal migration and small boats',
  M4: 'Asylum and the Nationality and Borders Act', M5: 'Leaving the European Union',
  M6: 'The generational smoking ban', M7: 'Protest and public order',
  M8: 'Employment rights and industrial action',
  M9: 'Sewage, water quality and the Environment Act', M10: 'Retained EU law and the "sunset" clause',
}

export interface Cand {
  id: string; matter: string; name: string; mnis: number; party: string; basis: string
  /**
   * The row's whole markdown body, verbatim. Carried so the rebuild can reproduce the withdrawn
   * rows in the UNSOUND section WITHOUT reading the document it is overwriting — the first version
   * read the document, overwrote it, and on a second run found its own output instead of its input.
   */
  body: string
}

/** Read the member pool out of the ORIGINAL draft. Extracted once, then frozen to a file. */
export function readCandidates(): Cand[] {
  const md = fs.readFileSync(DOC, 'utf8')
  const out: Cand[] = []
  const lines = md.split(/\r?\n/)
  let cur: Cand | null = null
  let buf: string[] = []
  const flush = () => {
    if (cur) {
      cur.body = buf.join('\n').replace(/(\s*\n---\s*)+$/, '').replace(/\s+$/, '')
        .replace(/^- \*\*Coverage \(why this row was chosen[^\n]*\n/gm, '')
      out.push(cur); cur = null
    }
    buf = []
  }
  for (const l of lines) {
    const h = /^### ((M\d+)\.\d+) — (.+?) \(MNIS (\d+)\), (.+)$/.exec(l)
    if (h) {
      flush()
      cur = { id: h[1], matter: h[2], name: h[3], mnis: Number(h[4]), party: h[5], basis: '', body: '' }
      buf = [l]
      continue
    }
    if (/^#{1,3} /.test(l)) { flush(); continue }
    if (cur) {
      const b = /^- \*\*Basis:\*\* `([^`]+)`/.exec(l)
      if (b && !cur.basis) cur.basis = b[1]
      buf.push(l)
    }
  }
  flush()
  return out
}

/**
 * Hansard spells a member differently from MNIS, so the join is on a normalised name — and it is
 * only ever accepted when it matches EXACTLY ONE MNIS person. `probe-3c2-speech2.ts` measured 0
 * ambiguous over 677 speakers on three matters, which is what makes that safe here.
 */
export const NORM_SQL = (col: string) =>
  `lower(regexp_replace(regexp_replace(${col}, '\\s*(MP|QC|KC)\\s*$', '', 'gi'), ` +
  `'^(the )?(rt\\.? hon\\.?|right honourable|sir|dame|lord|baroness|earl|viscount|mr\\.?|mrs\\.?|ms\\.?|miss|dr\\.?|prof\\.?)\\s+', '', 'gi'))`

/** Chair and procedural voices never take a position; they must never become a candidate row. */
export const CHAIR_NAMES = [
  'Lindsay Hoyle', 'Eleanor Laing', 'Nigel Evans', 'Rosie Winterton', 'Roger Gale',
  'Judith Cummins', 'Caroline Nokes', 'Nusrat Ghani', 'The Chairman of Committees',
  'A noble Lord', 'A noble Baroness', 'Several hon. Members', 'Hon. Members', 'Noble Lords',
]

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)

    const cands = readCandidates()
    console.log(`\npool: ${cands.length} rows over ${new Set(cands.map((c) => `${c.matter}:${c.mnis}`)).size} distinct (matter, member) pairs`)
    const byBasis = new Map<string, number>()
    for (const c of cands) byBasis.set(c.basis, (byBasis.get(c.basis) ?? 0) + 1)
    for (const [k, v] of byBasis) console.log(`  ${k.padEnd(22)} ${v}`)

    // ── does each candidate have a speech on their own matter? ──────────────────────────────
    console.log(`\n════ DOES EACH CANDIDATE HAVE A SPEECH ON THEIR OWN MATTER? ════`)
    console.log(`  ${'matter'.padEnd(6)} ${'cands'.padStart(6)} ${'with a speech'.padStart(14)} ${'bill-sponsor'.padStart(13)}  → sound rows available`)
    let totalSpoke = 0, totalBill = 0
    const perMatter: Record<string, { spoke: Cand[]; bill: Cand[] }> = {}
    for (const m of Object.keys(MATTER_TITLE)) {
      const list = cands.filter((c) => c.matter === m)
      const spoke: Cand[] = []
      for (const c of list) {
        const { rows: [r] } = await pool.query<{ n: string }>(`
          SELECT COUNT(*)::text AS n FROM corpus_sections cs
           WHERE cs.corpus IN ('pwdata-debates','pwdata-lords')
             AND cs."sectionTitle" ILIKE '%' || $1 || '%'
             AND cs.speaker IS NOT NULL AND cs.speaker <> ''
             AND cs."wordCount" >= 40
             AND ${NORM_SQL('cs.speaker')} = ${NORM_SQL('$2')}`,
          [MATTER_TITLE[m], c.name])
        if (Number(r.n) > 0) spoke.push(c)
      }
      const bill = list.filter((c) => c.basis === 'bill-sponsor')
      perMatter[m] = { spoke, bill }
      const sound = new Set([...spoke.map((c) => c.id), ...bill.map((c) => c.id)]).size
      totalSpoke += spoke.length; totalBill += bill.length
      console.log(`  ${m.padEnd(6)} ${String(list.length).padStart(6)} ${String(spoke.length).padStart(14)} ${String(bill.length).padStart(13)}  ${sound}`)
    }
    const soundIds = new Set<string>()
    for (const m of Object.keys(perMatter)) {
      for (const c of perMatter[m].spoke) soundIds.add(c.id)
      for (const c of perMatter[m].bill) soundIds.add(c.id)
    }
    console.log(`  ${'TOTAL'.padEnd(6)} ${String(cands.length).padStart(6)} ${String(totalSpoke).padStart(14)} ${String(totalBill).padStart(13)}  ${soundIds.size}`)
    console.log(`\n  ⇒ ${soundIds.size >= 50
      ? `${soundIds.size} sound rows reachable from the existing pool alone — the ~50 target is met without widening.`
      : `only ${soundIds.size} from the existing pool. Widening to the most prolific speakers per matter is needed, or the number gets reported as-is.`}`)

    // ── if we widen: how many members spoke substantially on each matter? ───────────────────
    console.log(`\n════ IF WIDENING IS NEEDED — members who spoke substantially, per matter ════`)
    console.log(`  (a speech of 150+ words, speaker resolving to exactly one MNIS person, chairs excluded)`)
    console.log(`  ${'matter'.padEnd(6)} ${'members'.padStart(9)} ${'parties'.padStart(9)}`)
    for (const m of Object.keys(MATTER_TITLE)) {
      const { rows: [r] } = await pool.query<{ n: string; p: string }>(`
        WITH sp AS (
          SELECT DISTINCT cs.speaker FROM corpus_sections cs
           WHERE cs.corpus IN ('pwdata-debates','pwdata-lords')
             AND cs."sectionTitle" ILIKE '%' || $1 || '%'
             AND cs.speaker IS NOT NULL AND cs.speaker <> ''
             AND cs."wordCount" >= 150
             AND cs.speaker <> ALL($2::text[])
        )
        SELECT COUNT(*) FILTER (WHERE g.id IS NOT NULL)::text AS n,
               COUNT(DISTINCT g.id)::text AS p
          FROM sp
          LEFT JOIN LATERAL (
            SELECT g.id FROM graph_entity g
             WHERE g.kind='person' AND g.parl_member_id IS NOT NULL
               AND ${NORM_SQL('g.canonical_name')} = ${NORM_SQL('sp.speaker')}
             LIMIT 2) g ON TRUE`, [MATTER_TITLE[m], CHAIR_NAMES])
      console.log(`  ${m.padEnd(6)} ${Number(r.n).toLocaleString().padStart(9)}`)
    }
  } finally {
    await endNeonPool()
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('[probe-3c2-coverage] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
