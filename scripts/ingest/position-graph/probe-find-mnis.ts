/** probe-find-mnis.ts — look up MNIS ids by name, so handcheck-2d2.ts names real people. */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
export {}
const pool = getNeonPool()
async function main() {
  for (const n of process.argv.slice(2)) {
    const { rows } = await pool.query(
      `SELECT mnis_id, name_display, latest_house, latest_party, membership_from,
              membership_start::text AS start, membership_end::text AS "end"
         FROM graph_member_register WHERE name_display ILIKE $1 ORDER BY mnis_id`, [`%${n}%`])
    console.log(`\n--- ${n}`); console.table(rows)
  }
  await endNeonPool()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
