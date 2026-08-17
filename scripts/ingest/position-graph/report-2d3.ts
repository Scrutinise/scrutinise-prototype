/**
 * report-2d3.ts — read 2D-3's output back OUT of the database, never off a run's own counters.
 *
 * Same reason as report.ts and report-2d2.ts: a sweep's counters report what the sweep believed it
 * did. Three of 2D-1's defects were found only because the report re-read the tables, and V36's
 * corrections all came from reading the artefact rather than the counter.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/report-2d3.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { AREA, RUNNER_UP } from './area-2d3'

export {}

const n = (v: unknown) => Number(v).toLocaleString('en-GB')

async function main() {
  const pool = getNeonPool()
  try {
    const q = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> => (await pool.query(sql, params)).rows as T[]
    const one = async <T = any>(sql: string, params: unknown[] = []): Promise<T> => (await q<T>(sql, params))[0]

    console.log(`\n╔══════════════════════════════════════════════════════════════════════════════════╗`)
    console.log(`║  GRAPH 2D-3 — POSITIONS AND REGISTER KEYS, READ BACK FROM THE DATABASE            ║`)
    console.log(`╚══════════════════════════════════════════════════════════════════════════════════╝`)
    console.log(`  area          ${AREA}   (runner-up: ${RUNNER_UP})`)

    // ── §1 the vocabulary ─────────────────────────────────────────────────────────────────────
    const v = await one(`SELECT COUNT(*)::text props, SUM(n_candidates)::text cands,
      COUNT(*) FILTER (WHERE jsonb_array_length(inquiry_refs)>1)::text cross_cutting FROM graph_proposition WHERE area=$1`, [AREA])
    const cands = await one(`SELECT COUNT(*)::text total, COUNT(*) FILTER (WHERE proposition_id IS NULL)::text dropped
      FROM graph_proposition_candidate WHERE area=$1`, [AREA])
    console.log(`\n── §1a THE VOCABULARY ──`)
    console.log(`  candidate claims derived        ${n(cands.total)}   (${n(cands.dropped)} dropped at clustering)`)
    console.log(`  canonical propositions          ${n(v.props)}`)
    console.log(`  cross-cutting (>1 inquiry)      ${n(v.cross_cutting)}`)

    // ── §1 positions ──────────────────────────────────────────────────────────────────────────
    const p = await one(`SELECT COUNT(*)::text rows,
        COUNT(*) FILTER (WHERE polarity<>'no-position')::text positions,
        COUNT(*) FILTER (WHERE polarity='no-position')::text silences,
        COUNT(DISTINCT section_id)::text subs, COUNT(DISTINCT entity_id)::text actors,
        COUNT(DISTINCT proposition_id)::text props_used,
        MIN(observed_on)::text first, MAX(observed_on)::text last FROM graph_position`)
    console.log(`\n── §1b THE POSITIONS ──`)
    console.log(`  holds-position edges            ${n(p.positions)}`)
    console.log(`  recorded silences (§5.4)        ${n(p.silences)}`)
    console.log(`  submissions read                ${n(p.subs)}`)
    console.log(`  actors holding a position       ${n(p.actors)}`)
    console.log(`  propositions actually used      ${n(p.props_used)} of ${n(v.props)}`)
    console.log(`  date range                      ${p.first} → ${p.last}`)

    const pol = await q(`SELECT polarity, COUNT(*)::text n FROM graph_position WHERE polarity<>'no-position' GROUP BY 1 ORDER BY 2 DESC`)
    console.log(`\n  by polarity:`)
    for (const r of pol) console.log(`    ${r.polarity.padEnd(10)} ${n(r.n).padStart(8)}   ${(100 * Number(r.n) / Number(p.positions)).toFixed(1)}%`)

    const cap = await q(`SELECT COALESCE(capacity,'(null)') capacity, COUNT(*)::text n FROM graph_position
      WHERE polarity<>'no-position' GROUP BY 1 ORDER BY 2 DESC`)
    console.log(`\n  by capacity (design §5.3 — the modes that mislead):`)
    for (const r of cap) console.log(`    ${r.capacity.padEnd(16)} ${n(r.n).padStart(8)}   ${(100 * Number(r.n) / Number(p.positions)).toFixed(1)}%`)

    const ev = await one(`SELECT COUNT(*) FILTER (WHERE extract_found_in_source)::text yes,
      COUNT(*) FILTER (WHERE NOT extract_found_in_source)::text no FROM graph_position WHERE polarity<>'no-position'`)
    console.log(`\n  evidence coverage:`)
    console.log(`    positions carrying a passage  ${n(p.positions)}   100.0%  (the schema cannot hold one without)`)
    console.log(`    passage FOUND in the document ${n(ev.yes)}   ${(100 * Number(ev.yes) / Number(p.positions)).toFixed(1)}%`)
    console.log(`    ⚠ passage NOT found           ${n(ev.no)}   ${(100 * Number(ev.no) / Number(p.positions)).toFixed(1)}%  ← the fabricated-quotation rate`)

    // ── contestedness, MEASURED rather than asserted ──────────────────────────────────────────
    const con = await q(`
      WITH s AS (
        SELECT proposition_id,
               COUNT(*) FILTER (WHERE polarity='for') f,
               COUNT(*) FILTER (WHERE polarity='against') a,
               COUNT(*) FILTER (WHERE polarity='balanced') b
        FROM graph_position WHERE polarity<>'no-position' GROUP BY 1)
      SELECT COUNT(*) FILTER (WHERE f>0 AND a>0)::text contested,
             COUNT(*) FILTER (WHERE f>0 AND a=0)::text unanimous_for,
             COUNT(*) FILTER (WHERE a>0 AND f=0)::text unanimous_against,
             COUNT(*)::text total FROM s`)
    const c = con[0]
    console.log(`\n  ⚠ CONTESTEDNESS, MEASURED — the derivation ASSERTED these claims were contested:`)
    console.log(`    propositions with both sides  ${n(c.contested)} of ${n(c.total)}   ${(100 * Number(c.contested) / Number(c.total)).toFixed(1)}%  ← genuinely contested`)
    console.log(`    unanimous FOR                 ${n(c.unanimous_for)}`)
    console.log(`    unanimous AGAINST             ${n(c.unanimous_against)}`)

    console.log(`\n  the ten most contested propositions (both sides, most positions):`)
    const top = await q(`
      SELECT pr.text, COUNT(*) FILTER (WHERE p.polarity='for')::text f,
             COUNT(*) FILTER (WHERE p.polarity='against')::text a,
             COUNT(*) FILTER (WHERE p.polarity='balanced')::text b
      FROM graph_position p JOIN graph_proposition pr ON pr.id=p.proposition_id
      WHERE p.polarity<>'no-position' GROUP BY pr.id, pr.text
      HAVING COUNT(*) FILTER (WHERE p.polarity='for')>0 AND COUNT(*) FILTER (WHERE p.polarity='against')>0
      ORDER BY COUNT(*) DESC LIMIT 10`)
    for (const r of top) console.log(`    for ${String(r.f).padStart(4)} · against ${String(r.a).padStart(3)} · balanced ${String(r.b).padStart(3)}   ${r.text.slice(0, 92)}`)

    console.log(`\n  the ten actors holding the most positions:`)
    const actors = await q(`
      SELECT en.canonical_name, en.key_source, COUNT(*)::text n,
             COUNT(DISTINCT p.proposition_id)::text props
      FROM graph_position p JOIN graph_entity en ON en.id=p.entity_id
      WHERE p.polarity<>'no-position' GROUP BY en.id, en.canonical_name, en.key_source
      ORDER BY COUNT(*) DESC LIMIT 10`)
    for (const r of actors) console.log(`    ${n(r.n).padStart(4)} positions on ${String(r.props).padStart(3)} propositions   ${r.canonical_name.slice(0, 58).padEnd(58)} [${r.key_source}]`)

    // ── §2 registers ──────────────────────────────────────────────────────────────────────────
    console.log(`\n── §2 COMPANIES HOUSE AND THE CHARITY COMMISSION ──`)
    const orgs = await one(`SELECT COUNT(*)::text n FROM graph_entity WHERE kind='organisation'`)
    for (const reg of ['charity-commission', 'companies-house']) {
      const r = await one(`SELECT COUNT(*)::text matches, COUNT(DISTINCT entity_id)::text entities,
        COUNT(*) FILTER (WHERE unambiguous)::text un, COUNT(*) FILTER (WHERE promoted)::text promoted,
        COUNT(*) FILTER (WHERE match_method='exact-name-norm-alias')::text via_alias
        FROM graph_org_register WHERE register=$1`, [reg])
      const splits = await one(`SELECT COUNT(*)::text n FROM (SELECT entity_id FROM graph_org_register
        WHERE register=$1 GROUP BY entity_id HAVING COUNT(DISTINCT register_id)>1) x`, [reg])
      const merges = await one(`SELECT COUNT(*)::text n FROM (SELECT register_id FROM graph_org_register
        WHERE register=$1 GROUP BY register_id HAVING COUNT(DISTINCT entity_id)>1) x`, [reg])
      console.log(`\n  ${reg}`)
      console.log(`    candidate matches             ${n(r.matches)}   (${n(r.via_alias)} via an alias rather than the canonical name)`)
      console.log(`    entities matched              ${n(r.entities)}   ${(100 * Number(r.entities) / Number(orgs.n)).toFixed(1)}% of ${n(orgs.n)} organisations`)
      console.log(`    unambiguous both ways         ${n(r.un)}`)
      console.log(`    PROMOTED to a stable key      ${n(r.promoted)}`)
      console.log(`    ⚠ SPLITS  (our name → >1 row) ${n(splits.n)}`)
      console.log(`    ⚠ MERGES  (>1 name → one row) ${n(merges.n)}`)
    }
    const keyed = await one(`SELECT
      COUNT(*) FILTER (WHERE companies_house_no IS NOT NULL OR charity_no IS NOT NULL)::text reg,
      COUNT(*) FILTER (WHERE key_source='parl-cis-id')::text cis, COUNT(*)::text tot
      FROM graph_entity WHERE kind='organisation'`)
    console.log(`\n  organisations now carrying an external register key   ${n(keyed.reg)}  (${(100 * Number(keyed.reg) / Number(keyed.tot)).toFixed(1)}%)`)
    console.log(`  organisations keyed on parl-cis-id (2D-1)             ${n(keyed.cis)}  (${(100 * Number(keyed.cis) / Number(keyed.tot)).toFixed(1)}%)`)

    console.log(`\n  ten promoted matches, so the join can be spot-checked:`)
    const sample = await q(`SELECT r.register, r.register_id, r.register_name, r.matched_surface, r.status
      FROM graph_org_register r WHERE r.promoted ORDER BY md5(r.id::text) LIMIT 10`)
    for (const s of sample) console.log(`    ${s.register === 'companies-house' ? 'CH' : 'CC'} ${String(s.register_id).padEnd(10)} ${String(s.register_name).slice(0, 44).padEnd(44)} ← ${String(s.matched_surface).slice(0, 40)}  [${s.status ?? '?'}]`)

    // ── offices ───────────────────────────────────────────────────────────────────────────────
    console.log(`\n── CONTINUED BRIEF §2 — OFFICE BY DATE ──`)
    const off = await q(`SELECT classification, COUNT(*)::text n FROM graph_office GROUP BY 1 ORDER BY 2 DESC`)
    for (const o of off) console.log(`    ${o.classification.padEnd(16)} ${n(o.n).padStart(6)}`)
    const res = await one(`SELECT COUNT(*)::text n FROM graph_office_resolution`)
    console.log(`    resolutions written  ${n(res.n)}   ⚠ the mechanism scored 63.8% against ground truth and was NOT applied`)

    // ── the acceptance test ───────────────────────────────────────────────────────────────────
    const hc = await one(`SELECT COUNT(*)::text n, COUNT(*) FILTER (WHERE verdict='correct')::text ok,
      COUNT(*) FILTER (WHERE verdict='partly')::text partly, COUNT(*) FILTER (WHERE verdict='wrong')::text wrong
      FROM graph_position_review`)
    console.log(`\n── §1 THE ACCEPTANCE TEST (hand-read against source) ──`)
    if (hc.n === '0') console.log(`    NOT YET DONE — an extraction count is not an accuracy claim`)
    else {
      console.log(`    read by hand      ${hc.n}`)
      console.log(`    correct           ${hc.ok}   ${(100 * Number(hc.ok) / Number(hc.n)).toFixed(1)}%`)
      console.log(`    partly right      ${hc.partly}`)
      console.log(`    wrong             ${hc.wrong}`)
      console.log(`    ERROR RATE        ${(100 * (Number(hc.wrong) + Number(hc.partly)) / Number(hc.n)).toFixed(1)}%`)
      const t = await q(`SELECT COALESCE(failure_type,'(unclassified)') ft, COUNT(*)::text n
        FROM graph_position_review WHERE verdict<>'correct' GROUP BY 1 ORDER BY 2 DESC`)
      for (const x of t) console.log(`      ${x.ft.padEnd(24)} ${x.n}`)
    }

    // ── storage ───────────────────────────────────────────────────────────────────────────────
    const sz = await q(`SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) s
      FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
      WHERE ns.nspname='public' AND relname IN ('graph_position','graph_proposition','graph_proposition_candidate',
        'graph_org_register','graph_position_review','graph_office','graph_office_holder','graph_office_resolution')
      ORDER BY pg_total_relation_size(c.oid) DESC`)
    console.log(`\n── STORAGE ──`)
    for (const s of sz) console.log(`    ${s.relname.padEnd(30)} ${s.s}`)
  } finally { await endNeonPool() }
}
// ⚠ GUARDED: this module exports helpers, and an unguarded main() means an IMPORT runs the
// script. trial-positions.ts imports prefixKey from extract-positions and triggered its $8.51
// population report mid-trial. A module that does work on import cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[report-2d3] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
