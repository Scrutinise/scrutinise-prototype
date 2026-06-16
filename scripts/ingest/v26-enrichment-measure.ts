/** v26-enrichment-measure.ts — READ-ONLY. Sizes the legacy compilation/summary/
 * amendment layer (the non-duplicated derived value) so Migration A.3 builds a
 * correctly-scoped enrichment table. */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3,
    statement_timeout: 300_000, query_timeout: 300_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })

  console.log('=== LegislationSection derived-value populations ===')
  console.table((await pool.query(`
    SELECT
      count(*)::int total,
      count(*) FILTER (WHERE "compiledTextKey" IS NOT NULL)::int has_compiled,
      count(*) FILTER (WHERE "lexSummaryKey" IS NOT NULL)::int has_lexsummary,
      count(*) FILTER (WHERE "amendmentCount" > 0)::int has_amendcount,
      count(*) FILTER (WHERE "unappliedAmendments" IS NOT NULL)::int has_unapplied,
      count(*) FILTER (WHERE "compiledTextKey" IS NOT NULL OR "lexSummaryKey" IS NOT NULL
                        OR "amendmentCount">0 OR "unappliedAmendments" IS NOT NULL)::int any_enrichment
    FROM "LegislationSection"`)).rows)

  console.log('=== LegislationAmendment + LegislationCorrection + LegislationCrossRef totals ===')
  for (const t of ['LegislationAmendment', 'LegislationCorrection', 'LegislationCrossRef']) {
    try { console.log(`  ${t}: ${(await pool.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n}`) }
    catch (e: any) { console.log(`  ${t}: ERR ${e.message.split('\n')[0]}`) }
  }

  console.log('\n=== sample enriched sections (with their item gid) ===')
  console.table((await pool.query(`
    SELECT li."legislationGovUkId" gid, ls."sectionNumber" sn, ls."compiledTextKey" IS NOT NULL c,
           ls."lexSummaryKey" IS NOT NULL lx, ls."amendmentCount" ac
    FROM "LegislationSection" ls JOIN "LegislationItem" li ON li.id=ls."legislationItemId"
    WHERE ls."compiledTextKey" IS NOT NULL OR ls."lexSummaryKey" IS NOT NULL
    LIMIT 8`)).rows)

  await pool.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
