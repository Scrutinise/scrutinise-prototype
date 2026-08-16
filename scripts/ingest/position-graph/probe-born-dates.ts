/**
 * probe-born-dates.ts — is the register's earliest name-history date a DATE OF BIRTH, or just the
 * day the member took a seat?
 *
 * The lifespan screen only means anything if it is testing against a birth date. For MNIS 8 the
 * first nameHistory row starts 1956-10-01, which is Theresa May's birthday. For MNIS 5162 the
 * earliest date is 2024-07-04, which is a general election. Killing a match because a witness was
 * active before their election is the tenure error again, wearing a different hat — so the two
 * cases have to be told apart before the screen can be trusted.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
export {}

const pool = getNeonPool()
const t = async (label: string, sql: string) => {
  const r = await pool.query(sql)
  console.log(`\n--- ${label}`); console.table(r.rows)
}

async function main() {
  await t('does the earliest name-history date PRECEDE the member taking a seat?', `
    WITH x AS (
      SELECT r.mnis_id, r.membership_start,
             MIN(n.start_date) FILTER (WHERE n.source='name-history') AS nh_min
        FROM graph_member_register r LEFT JOIN graph_member_name n ON n.mnis_id=r.mnis_id
       GROUP BY 1,2)
    SELECT COUNT(*)::int AS members,
           COUNT(*) FILTER (WHERE nh_min IS NULL)::int AS no_history,
           COUNT(*) FILTER (WHERE nh_min < membership_start)::int AS looks_like_birth,
           COUNT(*) FILTER (WHERE nh_min = membership_start)::int AS equals_seat,
           COUNT(*) FILTER (WHERE nh_min > membership_start)::int AS after_seat
      FROM x`)

  await t('the gap between that date and the seat, in years — a birth date is decades before', `
    WITH x AS (
      SELECT r.mnis_id, r.membership_start,
             MIN(n.start_date) FILTER (WHERE n.source='name-history') AS nh_min
        FROM graph_member_register r LEFT JOIN graph_member_name n ON n.mnis_id=r.mnis_id
       GROUP BY 1,2)
    SELECT width_bucket(EXTRACT(YEAR FROM age(membership_start, nh_min))::int, 0, 100, 10) AS bucket,
           MIN(EXTRACT(YEAR FROM age(membership_start, nh_min))::int) AS min_years,
           MAX(EXTRACT(YEAR FROM age(membership_start, nh_min))::int) AS max_years,
           COUNT(*)::int AS members
      FROM x WHERE nh_min IS NOT NULL AND membership_start IS NOT NULL
     GROUP BY 1 ORDER BY 1`)

  await t('the specific members the screen killed wrongly', `
    SELECT r.mnis_id, r.name_display, r.membership_start,
           MIN(n.start_date) FILTER (WHERE n.source='name-history') AS nh_min,
           COUNT(*) FILTER (WHERE n.source='name-history')::int AS history_rows
      FROM graph_member_register r LEFT JOIN graph_member_name n ON n.mnis_id=r.mnis_id
     WHERE r.mnis_id IN (5162, 5258, 5248, 4757, 1079, 1307, 1109)
     GROUP BY 1,2,3 ORDER BY 1`)
  await endNeonPool()
}
main().catch((e) => { console.error('FATAL', e instanceof Error ? e.message : e); process.exit(1) })
