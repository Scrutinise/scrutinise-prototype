/**
 * verify-2d4.ts — the checks that decide whether 2D-4's two halves can be believed.
 *
 * Same rule as verify-2d2 and verify-2d3: a check that cannot fail is not a check, so the ones that
 * would be true by construction are written as NEGATIVE CONTROLS that must fire.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/verify-2d4.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { classifySurface, holderOn } from './resolve-offices'
import { suspectExtract } from './trial-checks'
import { normPost, parseBiography, iso } from './sweep-posts'

export {}

let pass = 0
let fail = 0
const line = (ok: boolean, name: string, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

async function main() {
  const pool = getNeonPool()
  try {
    const one = async <T = any>(sql: string, p: unknown[] = []): Promise<T> => (await pool.query(sql, p)).rows[0] as T
    console.log(`\n════ VERIFY 2D-4 ════`)

    // ── §1 the trials ─────────────────────────────────────────────────────────────────────────
    console.log(`\n  §1 — the position trials`)
    const t = await one<{ trials: string; rows: string }>(
      `SELECT COUNT(DISTINCT trial)::text trials, COUNT(*)::text rows FROM graph_position_trial`)
    console.log(`      ${t.trials} trials · ${Number(t.rows).toLocaleString('en-GB')} rows`)

    const untouched = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_position`)
    line(untouched.n === '37657', 'the graph of record is UNCHANGED by the trials',
      `graph_position holds ${Number(untouched.n).toLocaleString('en-GB')} rows (2D-3 wrote 37,657)`)

    const reviews = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_position_review`)
    line(reviews.n === '50', 'the hand-score is still the same fifty', `${reviews.n} reviews`)

    // A trial must cover the SAME sections the hand-score covered, or it is not a comparison.
    const cover = await one<{ missing: string }>(`
      SELECT COUNT(*)::text missing FROM (
        SELECT DISTINCT p.section_id FROM graph_position p JOIN graph_position_review r ON r.position_id=p.id
        EXCEPT SELECT DISTINCT section_id FROM graph_position_trial WHERE trial='v2') x`)
    line(cover.missing === '0', 'v2 covered every hand-scored submission', `${cover.missing} not covered`)

    const discards = await one<{ n: string }>(
      `SELECT COUNT(*)::text n FROM graph_position_trial WHERE polarity LIKE 'discarded-%'`)
    line(Number(discards.n) > 0, 'mechanical discards are RECORDED, not dropped',
      `${discards.n} discard rows — without these, "the model declined" and "we threw it away" look identical`)

    const badPol = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM graph_position_trial
      WHERE polarity NOT IN ('for','against','balanced','qualified-for','qualified-against','discarded-prefix','discarded-prose')`)
    line(badPol.n === '0', 'every trial polarity is a known value', `${badPol.n} unknown`)

    const qualNoCond = await one<{ n: string }>(
      `SELECT COUNT(*)::text n FROM graph_position_trial WHERE polarity LIKE 'qualified%' AND condition IS NULL`)
    line(qualNoCond.n === '0', 'every qualified position carries its condition', `${qualNoCond.n} without one`)

    // ── §2 the posts ──────────────────────────────────────────────────────────────────────────
    console.log(`\n  §2 — the tenure source`)
    const f = await one<{ n: string; ok: string }>(
      `SELECT COUNT(*)::text n, COUNT(*) FILTER (WHERE status='ok')::text ok FROM graph_member_post_fetch`)
    line(f.n === f.ok, 'every member biography fetched cleanly', `${f.ok}/${f.n} ok`)
    const reg = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_member_register`)
    line(f.n === reg.n, 'the sweep covered the whole register', `${f.n} of ${reg.n}`)

    const p = await one<{ n: string; dated: string }>(
      `SELECT COUNT(*)::text n, COUNT(*) FILTER (WHERE start_date IS NOT NULL)::text dated FROM graph_member_post`)
    console.log(`      ${Number(p.n).toLocaleString('en-GB')} post spells, ${p.dated} with a start date`)
    line(p.n === p.dated, 'every stored post spell carries a start date', `${Number(p.n) - Number(p.dated)} undated`)

    const off = await one<{ office: string; sim: string; total: string }>(`
      SELECT COUNT(*) FILTER (WHERE classification='office')::text office,
             COUNT(*) FILTER (WHERE classification='simultaneous')::text sim,
             COUNT(*)::text total FROM graph_office_post`)
    console.log(`      ${off.total} posts classified · ${off.office} offices · ${off.sim} refused as simultaneous`)
    line(Number(off.office) > 100, 'the posts source yields real offices', `${off.office} (2D-3's name source yielded 1)`)

    const overlap = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM (
        SELECT a.post_norm FROM graph_office_post_holder a JOIN graph_office_post_holder b
          ON a.post_norm=b.post_norm AND a.mnis_id < b.mnis_id
        WHERE a.start_date <= COALESCE(b.end_date,'9999-12-31') AND b.start_date <= COALESCE(a.end_date,'9999-12-31')) x`)
    line(overlap.n === '0', 'no post called an office has two simultaneous holders', `${overlap.n} overlap`)

    const promoted = await one<{ n: string }>(
      `SELECT COUNT(*)::text n FROM graph_entity WHERE key_source = 'office-by-date'`)
    line(promoted.n === '0', 'NO entity was stamped office-by-date',
      'resolution is per-occurrence; an office cluster is several actors and stamping one would build a composite')

    // ── §3 ────────────────────────────────────────────────────────────────────────────────────
    console.log(`\n  §3 — the register-ambiguous name matches`)
    const amb = await one<{ n: string }>(`
      WITH shared AS (SELECT surface_norm FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1)
      SELECT COUNT(*)::text n FROM graph_entity e JOIN shared s ON s.surface_norm = e.name_norm
      WHERE e.kind='person' AND e.parl_member_id IS NOT NULL AND e.key_source='name-match'`)
    line(amb.n === '0', 'no name match stands on a register-ambiguous surface', `${amb.n} remain`)
    const logged = await one<{ n: string }>(
      `SELECT COUNT(*)::text n FROM graph_merge_log WHERE source='fix-ambiguous-matches-2d4'`)
    line(logged.n === '3', 'each cleared claim is recoverable from graph_merge_log', `${logged.n} logged`)
    const edgesKept = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM graph_edge g
      WHERE g.subject_id IN (SELECT kept_entity_id FROM graph_merge_log WHERE source='fix-ambiguous-matches-2d4')`)
    line(Number(edgesKept.n) >= 6, 'the cleared entities KEPT their edges', `${edgesKept.n} edges still attached`)

    // ── negative controls ─────────────────────────────────────────────────────────────────────
    console.log(`\n  negative controls — each of these must FAIL to pass`)
    line(classifySurface([{ mnisId: 1, start: '2000-01-01', end: null, name: 'a' },
      { mnisId: 2, start: '2005-01-01', end: null, name: 'b' }]) === 'simultaneous',
    'the office test REFUSES two open-ended holders')
    line(holderOn([{ mnisId: 1, start: '2000-01-01', end: '2004-01-01', name: 'a' },
      { mnisId: 2, start: '2002-01-01', end: '2006-01-01', name: 'b' }], '2003-01-01') === null,
    'an overlapping date resolves to NOBODY, never the first holder')
    line(normPost('Minister of State (Care)') !== normPost('Minister of State'),
      'a post qualifier is NOT stripped — two posts stay two posts')
    line(iso('rubbish') === null, 'a malformed date becomes null rather than today')
    line(parseBiography({ governmentPosts: [{ name: '', startDate: '2000-01-01' }] }).length === 0,
      'a blank post name is refused')
    const doc = 'x'.repeat(5000) + ' We believe funding must rise across every trust. '
    line(!suspectExtract('We believe funding must rise across every trust.', doc).suspect,
      'the suspect rule does NOT flag a real argument')
    line(suspectExtract('Liddle, J. et al (2022) A Qualitative Evaluation', doc).suspect,
      'the suspect rule DOES flag a citation')

    console.log(`\n════ ${pass} passed, ${fail} failed ════`)
    if (fail) process.exitCode = 1
  } finally { await endNeonPool() }
}
if (require.main === module) main().catch((e) => { console.error('[verify-2d4] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
