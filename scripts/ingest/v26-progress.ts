/** v26-progress.ts — READ-ONLY. Drain progress for the gap-fill + V25 seeds, and
 * Railway service inventory (confirms Railway = compute + idle DB only). */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

async function railwayServices() {
  const token = process.env.RAILWAY_API_TOKEN, projectId = process.env.RAILWAY_PROJECT_ID
  if (!token || !projectId) { console.log('(no Railway token/project)'); return }
  const q = `query($id:String!){ project(id:$id){ name services{ edges{ node{ name } } } } }`
  try {
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: q, variables: { id: projectId } }),
    })
    const j: any = await res.json()
    if (j.errors) { console.log('Railway API errors:', JSON.stringify(j.errors).slice(0, 300)); return }
    const proj = j.data?.project
    console.log(`Railway project: ${proj?.name}`)
    for (const e of proj?.services?.edges ?? []) console.log(`  • ${e.node.name}`)
  } catch (e: any) { console.log('Railway query failed:', e.message) }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3,
    statement_timeout: 120_000, query_timeout: 120_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })

  console.log('=== ingest_queue overall ===')
  console.table((await pool.query(`SELECT status, count(*)::int n FROM ingest_queue GROUP BY status ORDER BY n DESC`)).rows)

  console.log('=== gap-fill (priority 5 tna-legislation) + V25 drains ===')
  console.table((await pool.query(`
    SELECT corpus, status, count(*)::int n FROM ingest_queue
    WHERE (priority=5 AND "sourceType"='tna-legislation')
       OR corpus IN ('bills-api','senedd-cofnod')
    GROUP BY corpus, status ORDER BY corpus, status`)).rows)

  console.log('=== ingest heartbeat ===')
  try {
    const hb = await pool.query(`SELECT last_beat, now()-last_beat AS age FROM ingest_service_state ORDER BY last_beat DESC LIMIT 1`)
    console.log(hb.rows[0] ? `last_beat ${hb.rows[0].last_beat} (age ${hb.rows[0].age})` : '(no heartbeat row)')
  } catch (e: any) { console.log('heartbeat check err:', e.message.split('\n')[0]) }

  console.log('\n=== Railway services ===')
  await railwayServices()
  await pool.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
