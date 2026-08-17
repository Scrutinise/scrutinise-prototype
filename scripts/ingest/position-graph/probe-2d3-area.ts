/**
 * probe-2d3-area.ts — BRIEF_GRAPH_2D3 §1, "the area", measured rather than chosen.
 *
 * Reads the ranking back OUT OF THE GRAPH (not out of 2D-1's report), scopes the top area, and
 * prices the extraction population before a single token is spent. Reads only; writes nothing.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-2d3-area.ts
 *   npx tsx position-graph/probe-2d3-area.ts --area "Environmental Audit Committee"
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const areaArg = (() => { const i = argv.indexOf('--area'); return i >= 0 ? argv[i + 1] : null })()

/** `object_label` is "{inquiry title} ({committee})" — the committee is the trailing parenthetical. */
const COMMITTEE_RE = String.raw`\(([^()]*Committee[^()]*)\)\s*$`
const n = (v: unknown) => Number(v).toLocaleString('en-GB')

async function main() {
  const pool = getNeonPool()
  try {
    // ── the ranking, recomputed from the graph ────────────────────────────────────────────────
    const { rows: ranked } = await pool.query<{ committee: string; orgs_multi: string; orgs: string; inquiries: string; subs: string }>(`
      WITH e AS (
        SELECT ge.id AS edge_id, ge.subject_id, ge.object_ref,
               (regexp_match(ge.object_label, '${COMMITTEE_RE}'))[1] AS committee
        FROM graph_edge ge
        JOIN graph_entity en ON en.id = ge.subject_id AND en.kind = 'organisation'
        WHERE ge.predicate = 'gave-evidence-to'
      ), m AS (
        SELECT committee, subject_id, COUNT(DISTINCT object_ref) ni FROM e WHERE committee IS NOT NULL GROUP BY 1, 2
      ), inq AS (
        SELECT committee, COUNT(DISTINCT object_ref)::text inquiries FROM e WHERE committee IS NOT NULL GROUP BY 1
      ), sub AS (
        SELECT e.committee, COUNT(DISTINCT gv.section_id)::text subs
        FROM e JOIN graph_evidence gv ON gv.edge_id = e.edge_id WHERE e.committee IS NOT NULL GROUP BY 1
      )
      SELECT m.committee,
             COUNT(*) FILTER (WHERE ni > 1)::text AS orgs_multi,
             COUNT(*)::text AS orgs, inq.inquiries, sub.subs
      FROM m JOIN inq USING (committee) JOIN sub USING (committee)
      GROUP BY m.committee, inq.inquiries, sub.subs
      ORDER BY COUNT(*) FILTER (WHERE ni > 1) DESC
      LIMIT 10`)

    console.log('\n════ §1 THE AREA — ranked by organisations appearing in more than one inquiry ════')
    console.log('  (2D-1 §4\'s own primary signal, recomputed from graph_edge rather than quoted)\n')
    console.log('  rank  committee                                             orgs>1  orgs   inquiries  submissions')
    ranked.forEach((r, i) => console.log(
      `  ${String(i + 1).padStart(4)}  ${r.committee.slice(0, 52).padEnd(52)} ${n(r.orgs_multi).padStart(6)} ${n(r.orgs).padStart(6)} ${n(r.inquiries).padStart(10)} ${n(r.subs).padStart(12)}`))

    const AREA = areaArg ?? ranked[0].committee
    console.log(`\n  CHOSEN: ${AREA}${areaArg ? '  (--area override)' : '  (top of the ranking; the data chose it)'}`)
    if (!areaArg) console.log(`  RUNNER-UP: ${ranked[1].committee} (${n(ranked[1].orgs_multi)} orgs in >1 inquiry, ${((Number(ranked[1].orgs_multi) / Number(ranked[0].orgs_multi) - 1) * 100).toFixed(1)}%)`)

    // ── scope and price the area ──────────────────────────────────────────────────────────────
    const areaFilter = `(regexp_match(ge.object_label, '${COMMITTEE_RE}'))[1] = $1`
    const { rows: [scope] } = await pool.query<Record<string, string>>(`
      WITH e AS (
        SELECT ge.id edge_id, ge.subject_id, ge.object_ref, ge.object_label, en.kind
        FROM graph_edge ge JOIN graph_entity en ON en.id = ge.subject_id
        WHERE ge.predicate = 'gave-evidence-to' AND ${areaFilter}
      ), sec AS (
        SELECT DISTINCT gv.section_id FROM e JOIN graph_evidence gv ON gv.edge_id = e.edge_id
      )
      SELECT
        (SELECT COUNT(DISTINCT object_ref) FROM e)::text                                    AS inquiries,
        (SELECT COUNT(DISTINCT subject_id) FROM e WHERE kind='organisation')::text          AS orgs,
        (SELECT COUNT(DISTINCT subject_id) FROM e WHERE kind='person')::text                AS people,
        (SELECT COUNT(*) FROM e)::text                                                      AS edges,
        (SELECT COUNT(*) FROM sec)::text                                                    AS sections,
        (SELECT COUNT(*) FROM sec s JOIN corpus_sections c ON c.id=s.section_id WHERE c."r2Key" IS NOT NULL)::text AS with_r2,
        (SELECT COALESCE(SUM(c."wordCount"),0) FROM sec s JOIN corpus_sections c ON c.id=s.section_id)::text       AS words,
        (SELECT ROUND(AVG(c."wordCount")) FROM sec s JOIN corpus_sections c ON c.id=s.section_id)::text            AS avg_words,
        (SELECT MIN(c."itemDate") FROM sec s JOIN corpus_sections c ON c.id=s.section_id)::text                    AS first_date,
        (SELECT MAX(c."itemDate") FROM sec s JOIN corpus_sections c ON c.id=s.section_id)::text                    AS last_date
      `, [AREA])

    console.log(`\n════ SCOPE OF "${AREA}" ════`)
    for (const [k, v] of Object.entries(scope)) console.log(`  ${k.padEnd(12)} ${String(v).padStart(12)}`)

    // ── the inquiries, by submissions held ────────────────────────────────────────────────────
    const { rows: inqs } = await pool.query<{ object_ref: string; label: string; orgs: string; secs: string; words: string; d: string }>(`
      WITH e AS (
        SELECT ge.id edge_id, ge.subject_id, ge.object_ref, ge.object_label
        FROM graph_edge ge JOIN graph_entity en ON en.id = ge.subject_id
        WHERE ge.predicate='gave-evidence-to' AND ${areaFilter}
      )
      SELECT e.object_ref, MIN(e.object_label) label,
             COUNT(DISTINCT e.subject_id)::text orgs,
             COUNT(DISTINCT gv.section_id)::text secs,
             COALESCE(SUM(DISTINCT c."wordCount"),0)::text words,
             MAX(c."itemDate")::text d
      FROM e JOIN graph_evidence gv ON gv.edge_id=e.edge_id
             JOIN corpus_sections c ON c.id=gv.section_id
      GROUP BY e.object_ref ORDER BY COUNT(DISTINCT gv.section_id) DESC LIMIT 25`, [AREA])
    console.log(`\n════ TOP 25 INQUIRIES IN THE AREA, by submissions held ════`)
    console.log('  inquiry                                                          orgs   subs   latest')
    for (const r of inqs) console.log(`  ${(r.label ?? '').replace(/ \([^()]*\)$/, '').slice(0, 62).padEnd(62)} ${n(r.orgs).padStart(5)} ${n(r.secs).padStart(6)}   ${(r.d ?? '').slice(0, 10)}`)

    // ── word-count distribution, because the cost is a token count ────────────────────────────
    const { rows: [dist] } = await pool.query<Record<string, string>>(`
      WITH e AS (
        SELECT ge.id edge_id FROM graph_edge ge JOIN graph_entity en ON en.id=ge.subject_id
        WHERE ge.predicate='gave-evidence-to' AND ${areaFilter}
      ), sec AS (SELECT DISTINCT gv.section_id FROM e JOIN graph_evidence gv ON gv.edge_id=e.edge_id)
      SELECT
        percentile_disc(0.5)  WITHIN GROUP (ORDER BY c."wordCount")::text p50,
        percentile_disc(0.9)  WITHIN GROUP (ORDER BY c."wordCount")::text p90,
        percentile_disc(0.99) WITHIN GROUP (ORDER BY c."wordCount")::text p99,
        MAX(c."wordCount")::text mx,
        COUNT(*) FILTER (WHERE c."wordCount" > 20000)::text over20k
      FROM sec s JOIN corpus_sections c ON c.id=s.section_id`, [AREA])
    console.log(`\n════ SUBMISSION LENGTH (words) ════`)
    console.log(`  p50 ${dist.p50}   p90 ${dist.p90}   p99 ${dist.p99}   max ${n(dist.mx)}   over 20k words: ${dist.over20k}`)

    // ── EDMs: how many are propositions at all? ───────────────────────────────────────────────
    // Amendment 1 §1 says an EDM's text is usually a single compound proposition. That claim is
    // checked here rather than taken: a congratulatory motion is not contestable.
    const { rows: [edm] } = await pool.query<Record<string, string>>(`
      SELECT COUNT(*)::text total,
             COUNT(*) FILTER (WHERE "sectionTitle" ~* '(congratulat|anniversary|birthday|retirement|award|tribute|death of|passing of|centenary|jubilee|achiev|winner|champion)')::text celebratory,
             COUNT(*) FILTER (WHERE "sectionTitle" ~* '(health|nhs|social care|hospital|patient|gp |general practi|nurs|dentist|mental health|care home|ambulance|pharmac|maternity|cancer|obesity|smoking|vaping|alcohol|drug|disabilit|carers)')::text health_ish
      FROM corpus_sections WHERE corpus='early-day-motions'`)
    console.log(`\n════ EARLY DAY MOTIONS — is the text a proposition? ════`)
    console.log(`  total ${n(edm.total)}   title matches a celebratory pattern ${n(edm.celebratory)} (${(100 * +edm.celebratory / +edm.total).toFixed(1)}%)   title matches a health pattern ${n(edm.health_ish)}`)
    console.log('  ⚠ both are keyword counts on the TITLE — an indication of shape, not a classification.')
  } finally {
    await endNeonPool()
  }
}
// ⚠ GUARDED: this module exports helpers, and an unguarded main() means an IMPORT runs the
// script. trial-positions.ts imports prefixKey from extract-positions and triggered its $8.51
// population report mid-trial. A module that does work on import cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[probe-2d3-area] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
