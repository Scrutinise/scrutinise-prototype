/**
 * handcheck-2d3.ts — BRIEF_GRAPH_2D3 §1's acceptance test, which is not a count.
 *
 * > *"Read fifty extracted positions by hand against their source passages and report the error
 * > rate. ⚠ Do not report an extraction rate as an accuracy rate."*
 *
 * This script does the two mechanical halves of that — draw a defensible sample, and put each
 * position next to the passage IN ITS DOCUMENT CONTEXT so the reader can see what the submission
 * was actually saying around it — and then records the verdicts. The judging is a person's job and
 * the script cannot do it; what it can do is make the judging honest:
 *
 *   · **Stratified, not cherry-picked.** The sample is drawn across polarities and across
 *     propositions in proportion, with the not-found passages included at their true rate. A sample
 *     of fifty `for` positions from one inquiry would report an accuracy that means nothing.
 *   · **Deterministic.** Ordered by md5 of the row id, so the same fifty come back on a re-run and
 *     the score cannot be improved by redrawing.
 *   · **Context, not just the quotation.** ±400 characters either side, because the commonest real
 *     failure is a passage that says what the model claims while the sentence before it reverses
 *     the sense.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/handcheck-2d3.ts --draw 50            # print the sample to read
 *   npx tsx position-graph/handcheck-2d3.ts --record verdicts.json
 *   npx tsx position-graph/handcheck-2d3.ts --score              # the error rate, by failure type
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { getDocText, findExtract, normaliseForMatch } from './text-2d3'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }
const str = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }

async function draw(pool: ReturnType<typeof getNeonPool>, n: number) {
  // Stratified by polarity in proportion, deterministic within each stratum.
  const { rows } = await pool.query<{
    id: string; polarity: string; extract: string; found: boolean | null; capacity: string
    confidence: number; prop: string; org: string; section_id: string; r2key: string; d: string; inquiry: string
  }>(`
    WITH ranked AS (
      SELECT p.id::text, p.polarity, p.extract, p.extract_found_in_source found, p.capacity, p.confidence,
             pr.text prop, en.canonical_name org, p.section_id, c."r2Key" r2key, p.observed_on::text d,
             ge.object_label inquiry,
             ROW_NUMBER() OVER (PARTITION BY p.polarity ORDER BY md5(p.id::text)) rn,
             COUNT(*) OVER (PARTITION BY p.polarity) cnt,
             COUNT(*) OVER () tot
      FROM graph_position p
      JOIN graph_proposition pr ON pr.id = p.proposition_id
      JOIN graph_entity en ON en.id = p.entity_id
      JOIN corpus_sections c ON c.id = p.section_id
      LEFT JOIN LATERAL (
        SELECT ge2.object_label FROM graph_edge ge2 JOIN graph_evidence gv2 ON gv2.edge_id = ge2.id
        WHERE gv2.section_id = p.section_id AND ge2.subject_id = p.entity_id LIMIT 1) ge ON TRUE
      WHERE p.polarity <> 'no-position'
    )
    SELECT * FROM ranked WHERE rn <= GREATEST(1, ROUND($1::numeric * cnt / tot)) ORDER BY polarity, rn`, [n])
  return rows.slice(0, n)
}

async function main() {
  const pool = getNeonPool()
  try {
    if (flag('draw')) {
      const rows = await draw(pool, num('draw', 50))
      const out: any[] = []
      console.log(`\n════ HAND-CHECK SAMPLE — ${rows.length} positions, stratified by polarity ════`)
      const cache = new Map<string, string>()
      for (const [i, r] of rows.entries()) {
        let doc = cache.get(r.r2key)
        if (doc === undefined) { doc = (await getDocText(r.r2key)) ?? ''; cache.set(r.r2key, doc) }
        const m = findExtract(r.extract, doc)
        let context = '(passage not located in the document)'
        if (m.offset !== null) {
          const from = Math.max(0, m.offset - 400)
          context = (from ? '…' : '') + doc.slice(from, m.offset + r.extract.length + 400).replace(/\s+/g, ' ')
        }
        console.log(`\n──── ${i + 1}/${rows.length}  position ${r.id} ────`)
        console.log(`PROPOSITION : ${r.prop}`)
        console.log(`POLARITY    : ${r.polarity.toUpperCase()}   capacity=${r.capacity}  confidence=${r.confidence}  passage-found=${r.found}`)
        console.log(`SUBMITTER   : ${r.org}   (${r.d})`)
        console.log(`INQUIRY     : ${(r.inquiry ?? '').replace(/ \([^()]*\)$/, '')}`)
        console.log(`EXTRACT     : "${r.extract}"`)
        console.log(`CONTEXT     : ${context}`)
        out.push({ position_id: r.id, proposition: r.prop, polarity: r.polarity, extract: r.extract, org: r.org })
      }
      const f = path.join(__dirname, 'handcheck-2d3-sample.json')
      fs.writeFileSync(f, JSON.stringify(out, null, 1))
      console.log(`\n  sample written to ${f} — verdicts go in a matching file for --record`)
      return
    }

    if (flag('record')) {
      const file = str('record', '')
      const verdicts: Array<{ position_id: string; verdict: string; failure_type?: string | null; note?: string }> =
        JSON.parse(fs.readFileSync(file, 'utf8'))
      for (const v of verdicts) {
        await pool.query(
          `INSERT INTO graph_position_review (position_id, verdict, failure_type, note, reviewer)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (position_id) DO UPDATE SET verdict=EXCLUDED.verdict,
             failure_type=EXCLUDED.failure_type, note=EXCLUDED.note`,
          [v.position_id, v.verdict, v.failure_type ?? null, v.note ?? null, 'CC-Graph (hand-read against source)'])
      }
      console.log(`  ${verdicts.length} verdicts recorded.`)
    }

    // ── the score ─────────────────────────────────────────────────────────────────────────────
    const { rows: [s] } = await pool.query<Record<string, string>>(`
      SELECT COUNT(*)::text n,
             COUNT(*) FILTER (WHERE verdict='correct')::text ok,
             COUNT(*) FILTER (WHERE verdict='partly')::text partly,
             COUNT(*) FILTER (WHERE verdict='wrong')::text wrong
      FROM graph_position_review`)
    if (s.n === '0') { console.log('  no verdicts recorded yet'); return }
    const n = Number(s.n)
    console.log(`\n════ THE ACCEPTANCE TEST — ${n} positions read by hand against their source ════`)
    console.log(`  correct                    ${String(s.ok).padStart(3)}   ${(100 * Number(s.ok) / n).toFixed(1)}%`)
    console.log(`  partly right               ${String(s.partly).padStart(3)}   ${(100 * Number(s.partly) / n).toFixed(1)}%`)
    console.log(`  wrong                      ${String(s.wrong).padStart(3)}   ${(100 * Number(s.wrong) / n).toFixed(1)}%`)
    console.log(`  ── ERROR RATE (wrong + partly) ${(100 * (Number(s.wrong) + Number(s.partly)) / n).toFixed(1)}% ──`)
    const { rows: types } = await pool.query<{ failure_type: string; n: string }>(
      `SELECT COALESCE(failure_type,'(none)') failure_type, COUNT(*)::text n FROM graph_position_review
        WHERE verdict<>'correct' GROUP BY 1 ORDER BY 2 DESC`)
    console.log(`\n  failures by TYPE — this is what decides whether the method generalises:`)
    for (const t of types) console.log(`    ${t.failure_type.padEnd(24)} ${t.n}`)
    const { rows: notes } = await pool.query<{ position_id: string; verdict: string; failure_type: string; note: string }>(
      `SELECT position_id::text, verdict, COALESCE(failure_type,'') failure_type, COALESCE(note,'') note
         FROM graph_position_review WHERE verdict<>'correct' ORDER BY position_id`)
    console.log(`\n  every failure, named:`)
    for (const nt of notes) console.log(`    #${nt.position_id} ${nt.verdict}/${nt.failure_type} — ${nt.note}`)
  } finally { await endNeonPool() }
}
// ⚠ GUARDED. verify-2d3.ts imports classifySurface/holderOn from here; without this an
// import RAN THE SCRIPT, which ended the shared pool underneath the caller ('Called end on pool
// more than once'). A module that does work on import is a module that cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[handcheck-2d3] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
