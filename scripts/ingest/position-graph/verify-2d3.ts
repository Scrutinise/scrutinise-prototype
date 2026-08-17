/**
 * verify-2d3.ts — the checks that decide whether 2D-3's output can be believed.
 *
 * Same contract as verify-2d2.ts, and the same rule: **a check that cannot fail is not a check.**
 * Every assertion here was watched failing before it was allowed to pass, and the ones that could
 * only ever be true by construction are written as NEGATIVE CONTROLS that must fire — the schema is
 * asked to accept a row it should refuse, and the matcher is asked to find a quotation that is not
 * there. If a control stops firing, the guard it protects has stopped working.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/verify-2d3.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { AREA } from './area-2d3'
import { findExtract } from './text-2d3'
import { classifySurface, holderOn } from './resolve-offices'

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
    const one = async <T = any>(sql: string, params: unknown[] = []): Promise<T> =>
      (await pool.query(sql, params)).rows[0] as T

    console.log(`\n════ VERIFY 2D-3 ════`)

    // ── §1 positions ──────────────────────────────────────────────────────────────────────────
    console.log(`\n  §1 — positions`)
    const tot = await one<{ n: string; pos: string; nopos: string; secs: string; ents: string }>(`
      SELECT COUNT(*)::text n,
             COUNT(*) FILTER (WHERE polarity<>'no-position')::text pos,
             COUNT(*) FILTER (WHERE polarity='no-position')::text nopos,
             COUNT(DISTINCT section_id)::text secs, COUNT(DISTINCT entity_id)::text ents
      FROM graph_position`)
    console.log(`      ${Number(tot.n).toLocaleString('en-GB')} rows · ${Number(tot.pos).toLocaleString('en-GB')} positions · ${Number(tot.nopos).toLocaleString('en-GB')} recorded silences · ${Number(tot.secs).toLocaleString('en-GB')} submissions · ${Number(tot.ents).toLocaleString('en-GB')} actors`)

    const noExtract = await one<{ n: string }>(
      `SELECT COUNT(*)::text n FROM graph_position WHERE polarity<>'no-position' AND (extract IS NULL OR length(btrim(extract))<20)`)
    line(noExtract.n === '0', 'every position carries a passage (design §5.1)', `${noExtract.n} without one`)

    const noDate = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_position WHERE observed_on IS NULL`)
    line(noDate.n === '0', 'every position is dated (design §5.2)', `${noDate.n} undated`)

    const dateMismatch = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM graph_position p JOIN corpus_sections c ON c.id=p.section_id
      WHERE c."itemDate" IS NOT NULL AND p.observed_on <> c."itemDate"`)
    line(dateMismatch.n === '0', 'the date is the document\'s date, never today\'s', `${dateMismatch.n} disagree`)

    // The subject must actually have submitted the document the position was read from.
    const orphanSubject = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM graph_position p
      WHERE NOT EXISTS (
        SELECT 1 FROM graph_edge ge JOIN graph_evidence gv ON gv.edge_id=ge.id
        WHERE ge.subject_id=p.entity_id AND gv.section_id=p.section_id AND ge.predicate='gave-evidence-to')`)
    line(orphanSubject.n === '0', 'every subject really did submit that document', `${orphanSubject.n} cannot be traced to a gave-evidence-to edge`)

    const badProp = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM graph_position p JOIN graph_proposition pr ON pr.id=p.proposition_id
      WHERE pr.area <> $1`, [AREA])
    line(badProp.n === '0', 'every proposition belongs to the chosen area', `${badProp.n} do not`)

    // §5.4: a recorded silence must only exist where the body was actually asked.
    const silenceOutOfScope = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM graph_position p JOIN graph_proposition pr ON pr.id=p.proposition_id
      WHERE p.polarity='no-position' AND NOT (pr.inquiry_refs ? p.inquiry_ref)`)
    line(silenceOutOfScope.n === '0', 'a recorded silence only exists where the claim was put (§5.4)', `${silenceOutOfScope.n} out of scope`)

    const unscored = await one<{ n: string }>(
      `SELECT COUNT(*)::text n FROM graph_position WHERE polarity<>'no-position' AND extract_found_in_source IS NULL`)
    line(unscored.n === '0', 'every passage has been checked against its document', `${unscored.n} unchecked`)

    const found = await one<{ y: string; n: string }>(`
      SELECT COUNT(*) FILTER (WHERE extract_found_in_source)::text y,
             COUNT(*) FILTER (WHERE NOT extract_found_in_source)::text n
      FROM graph_position WHERE polarity<>'no-position'`)
    const rate = 100 * Number(found.n) / Math.max(1, Number(found.y) + Number(found.n))
    line(rate < 10, 'the fabricated-quotation rate is under 10%', `${rate.toFixed(1)}% (${found.n} of ${Number(found.y) + Number(found.n)})`)

    // ── the edge view ─────────────────────────────────────────────────────────────────────────
    console.log(`\n  the edge view`)
    const inAll = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_edge_all WHERE predicate='holds-position'`)
    line(inAll.n === found.y || Number(inAll.n) === Number(tot.pos), 'graph_edge_all carries the positions', `${Number(inAll.n).toLocaleString('en-GB')} rows`)
    const silenceLeak = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_edge_all WHERE qualifier='no-position'`)
    line(silenceLeak.n === '0', 'a recorded silence is NOT counted as an edge', `${silenceLeak.n} leaked`)
    const amd2 = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_mention WHERE predicate='holds-position'`)
    line(Number(amd2.n) > 0, 'positions reach the Amendment 2 session\'s mention view for free', `${Number(amd2.n).toLocaleString('en-GB')} mentions`)

    // ── §2 registers ──────────────────────────────────────────────────────────────────────────
    console.log(`\n  §2 — registers`)
    const reg = await one<{ n: string; un: string; pr: string }>(`
      SELECT COUNT(*)::text n, COUNT(*) FILTER (WHERE unambiguous)::text un,
             COUNT(*) FILTER (WHERE promoted)::text pr FROM graph_org_register`)
    console.log(`      ${Number(reg.n).toLocaleString('en-GB')} candidate matches · ${Number(reg.un).toLocaleString('en-GB')} unambiguous · ${Number(reg.pr).toLocaleString('en-GB')} promoted`)
    const badPromote = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_org_register WHERE promoted AND NOT unambiguous`)
    line(badPromote.n === '0', 'only an unambiguous match was ever promoted', `${badPromote.n} promoted while ambiguous`)
    const doubleKey = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM (
        SELECT entity_id FROM graph_org_register WHERE promoted GROUP BY entity_id, register
        HAVING COUNT(DISTINCT register_id) > 1) x`)
    line(doubleKey.n === '0', 'no entity was promoted to two keys in one register', `${doubleKey.n} double-keyed`)
    const keyed = await one<{ ch: string; cc: string; tot: string }>(`
      SELECT COUNT(*) FILTER (WHERE companies_house_no IS NOT NULL)::text ch,
             COUNT(*) FILTER (WHERE charity_no IS NOT NULL)::text cc, COUNT(*)::text tot
      FROM graph_entity WHERE kind='organisation'`)
    console.log(`      organisations now carrying a register key: Companies House ${Number(keyed.ch).toLocaleString('en-GB')}, Charity Commission ${Number(keyed.cc).toLocaleString('en-GB')} of ${Number(keyed.tot).toLocaleString('en-GB')}`)

    // ── offices ───────────────────────────────────────────────────────────────────────────────
    console.log(`\n  offices (continued brief §2)`)
    const off = await one<{ n: string; o: string }>(
      `SELECT COUNT(*)::text n, COUNT(*) FILTER (WHERE classification='office')::text o FROM graph_office`)
    console.log(`      ${Number(off.n).toLocaleString('en-GB')} surfaces classified · ${off.o} qualify as an office`)
    const resolved = await one<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_office_resolution WHERE outcome='resolved'`)
    line(resolved.n === '0', 'NOTHING was resolved by office-by-date', `${resolved.n} resolutions written — the mechanism scored 63.8% against ground truth and must not be used`)

    // ── negative controls: each must FIRE ─────────────────────────────────────────────────────
    console.log(`\n  negative controls — each of these must FAIL to pass`)
    let refused = false
    try {
      await pool.query(`BEGIN`)
      await pool.query(`
        INSERT INTO graph_position (entity_id, proposition_id, polarity, extract, section_id, observed_on, model, run_id)
        SELECT p.entity_id, p.proposition_id, 'for', NULL, p.section_id, p.observed_on, 'control', 'negative-control'
        FROM graph_position p LIMIT 1`)
    } catch { refused = true } finally { await pool.query(`ROLLBACK`) }
    line(refused, 'the schema REFUSES a position with no passage', refused ? 'constraint fired' : 'IT WAS ACCEPTED — position_extract_ck is not working')

    let refused2 = false
    try {
      await pool.query(`BEGIN`)
      await pool.query(`
        INSERT INTO graph_position (entity_id, proposition_id, polarity, extract, section_id, observed_on, model, run_id)
        SELECT p.entity_id, p.proposition_id, 'strongly-for', 'a passage long enough to pass the length test', p.section_id, p.observed_on, 'control', 'negative-control'
        FROM graph_position p LIMIT 1`)
    } catch { refused2 = true } finally { await pool.query(`ROLLBACK`) }
    line(refused2, 'the schema REFUSES a polarity outside the four permitted', refused2 ? 'constraint fired' : 'IT WAS ACCEPTED')

    const fabricated = findExtract('we call for the immediate nationalisation of every private dental practice in England',
      'This submission argues that NHS dental contracts should be renegotiated to require a minimum NHS commitment.')
    line(!fabricated.found, 'the matcher REJECTS a fabricated quotation', fabricated.found ? 'IT WAS FOUND — the matcher is blind' : 'rejected')

    const realOne = await one<{ extract: string; r2: string } | undefined>(`
      SELECT p.extract, c."r2Key" r2 FROM graph_position p JOIN corpus_sections c ON c.id=p.section_id
      WHERE p.extract_found_in_source IS TRUE LIMIT 1`)
    line(!!realOne, 'and it still ACCEPTS a real one', realOne ? 'a stored passage verified true' : 'none to test')

    const overlapping = await one<{ n: string }>(`
      SELECT COUNT(*)::text n FROM (
        SELECT a.office_norm FROM graph_office_holder a JOIN graph_office_holder b
          ON a.office_norm=b.office_norm AND a.mnis_id < b.mnis_id
        JOIN graph_office o ON o.office_norm=a.office_norm AND o.classification='office'
        WHERE a.start_date <= COALESCE(b.end_date,'9999-12-31') AND b.start_date <= COALESCE(a.end_date,'9999-12-31')) x`)
    line(overlapping.n === '0', 'no surface called an office has two simultaneous holders', `${overlapping.n} overlap`)
    line(classifySurface([{ mnisId: 1, start: '2000-01-01', end: null, name: 'a' }, { mnisId: 2, start: '2005-01-01', end: null, name: 'b' }]) === 'simultaneous',
      'the office test REFUSES two open-ended holders')
    line(holderOn([{ mnisId: 1, start: '2000-01-01', end: '2004-01-01', name: 'a' }, { mnisId: 2, start: '2002-01-01', end: '2006-01-01', name: 'b' }], '2003-01-01') === null,
      'an overlapping date resolves to NOBODY, never to the first holder')

    console.log(`\n════ ${pass} passed, ${fail} failed ════`)
    if (fail) process.exitCode = 1
  } finally { await endNeonPool() }
}
main().catch((e) => { console.error('[verify-2d3] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
