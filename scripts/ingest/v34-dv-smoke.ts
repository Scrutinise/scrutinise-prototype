/**
 * v34-dv-smoke.ts — proves the structured write path against the REAL tables
 * before 5,645 rows go through it, and proves it on the case that would break:
 * a division with a NULL date (the bare ''::date literal Postgres rejects).
 *
 * Writes to `divisions` / `division_votes`, reads back, then DELETES what it
 * wrote. Not a substitute for the post-drain reconciliation — it is the
 * "built inert hides write-path bugs" check done before the drain rather than
 * discovered during it.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { fetchDivisionDetail, type DivisionDetail } from './sources/division-votes'

async function write(pool: any, d: DivisionDetail): Promise<number> {
  await pool.query(`
    INSERT INTO divisions (house, division_id, division_number, division_date, title,
      bill_title, stage, amendment, context_provenance, motion_notes,
      aye_count, no_count, absent_count, absence_known, source_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT (house, division_id) DO UPDATE SET title = EXCLUDED.title
  `, [d.house, d.divisionId, d.number, d.date, d.title,
      d.context.billTitle, d.context.stage, d.context.amendment, d.context.provenance, d.motionNotes,
      d.ayeCount, d.noCount, d.absentCount, d.absenceKnown,
      `https://votes.parliament.uk/Votes/${d.house === 'commons' ? 'Commons' : 'Lords'}/Division/${d.divisionId}`])
  if (!d.members.length) return 0
  const vals: any[] = []
  const tuples = d.members.map((m, i) => {
    const b = i * 9
    vals.push(d.house, d.divisionId, m.memberId, m.name, m.party, m.partyAbbreviation, m.constituency, m.vote, m.teller)
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},NULLIF('${d.date ?? ''}','')::date)`
  })
  await pool.query(`
    INSERT INTO division_votes (house, division_id, member_id, member_name, party,
      party_abbrev, constituency, vote, teller, division_date)
    VALUES ${tuples.join(',')}
    ON CONFLICT (house, division_id, member_id) DO UPDATE SET vote = EXCLUDED.vote
  `, vals)
  return d.members.length
}

async function main() {
  const pool = getNeonPool()
  const cases: Array<['commons' | 'lords', number]> = [['commons', 2411], ['commons', 2], ['lords', 3698], ['lords', 19]]
  const written: Array<[string, number]> = []

  for (const [house, id] of cases) {
    const d = await fetchDivisionDetail(house, id)
    if (!d) { console.log(`  ${house}:${id} fetch FAILED`); continue }
    const n = await write(pool, d)
    written.push([house, id])
    console.log(`  ${house}:${id} (${d.date}) → 1 division + ${n} member rows, absenceKnown=${d.absenceKnown}`)
  }

  // The null-date case, synthesised because the API has no such division today
  // but the column allows it and the old literal would have thrown.
  const base = await fetchDivisionDetail('commons', 2411)
  if (base) {
    const nullDated: DivisionDetail = { ...base, divisionId: 999999, date: null, members: base.members.slice(0, 5) }
    const n = await write(pool, nullDated)
    written.push(['commons', 999999])
    console.log(`  commons:999999 (date=NULL, synthetic) → 1 division + ${n} member rows  ← the case that would have thrown`)
  }

  const chk = await pool.query(`
    SELECT d.house, d.division_id, d.division_date, d.absence_known, d.bill_title, d.stage, d.amendment,
           COUNT(v.*)::int AS members,
           COUNT(*) FILTER (WHERE v.vote='aye')::int AS aye,
           COUNT(*) FILTER (WHERE v.vote='no')::int AS no,
           COUNT(*) FILTER (WHERE v.vote='absent')::int AS absent,
           COUNT(*) FILTER (WHERE v.party IS NOT NULL)::int AS with_party
    FROM divisions d LEFT JOIN division_votes v USING (house, division_id)
    GROUP BY 1,2,3,4,5,6,7 ORDER BY 1,2`)
  console.log('\nREAD BACK:')
  for (const r of chk.rows) console.log(`  ${r.house}:${r.division_id} date=${r.division_date ? String(r.division_date).slice(0,10) : 'NULL'} members=${r.members} aye=${r.aye} no=${r.no} absent=${r.absent} party=${r.with_party} absKnown=${r.absence_known} bill=${JSON.stringify(r.bill_title)} stage=${JSON.stringify(r.stage)} amdt=${JSON.stringify(r.amendment)}`)

  for (const [house, id] of written) {
    await pool.query(`DELETE FROM division_votes WHERE house=$1 AND division_id=$2`, [house, id])
    await pool.query(`DELETE FROM divisions WHERE house=$1 AND division_id=$2`, [house, id])
  }
  const left = await pool.query(`SELECT (SELECT COUNT(*)::int FROM divisions) d, (SELECT COUNT(*)::int FROM division_votes) v`)
  console.log(`\nCLEANED UP → divisions=${left.rows[0].d} division_votes=${left.rows[0].v} (both must be 0)`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
