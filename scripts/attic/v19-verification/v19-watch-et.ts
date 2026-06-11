import { getNeonPool } from './shared/neon-pool'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function snap(pool: any) {
  const r = await pool.query(`
    SELECT count(*) FILTER (WHERE status='failed')::int failed,
           count(*) FILTER (WHERE status='done')::int done
    FROM ingest_queue WHERE corpus='et-decisions'`)
  return r.rows[0]
}
async function main() {
  const pool = getNeonPool()
  const a = await snap(pool)
  console.log('t0:', JSON.stringify(a))
  await sleep(90_000)
  const b = await snap(pool)
  console.log('t+90s:', JSON.stringify(b), '| delta failed:', b.failed - a.failed, 'done:', b.done - a.done)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
