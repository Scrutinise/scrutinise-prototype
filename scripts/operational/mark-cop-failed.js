// Quick one-off: mark College of Policing APP as FAILED (WAF block, all IPs return 403)
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
const { Pool } = require(path.join(__dirname, '../../scrutinise-web/node_modules/pg'))
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

pool.query(
  'UPDATE "OperationalDocument" SET "ingestStatus" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING "sourceSlug", "ingestStatus"',
  ['FAILED', 'ed12db69-da06-45dd-85a2-635cfd76848e']
).then(r => {
  console.log('Updated:', JSON.stringify(r.rows))
  pool.end()
}).catch(e => {
  console.error(e)
  pool.end()
})
