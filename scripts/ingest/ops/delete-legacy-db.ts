// ─────────────────────────────────────────────────────────────────────────────
// DECOMMISSION scrutinise-db. ⚠⚠ IRREVERSIBLE. Charlie runs this, not the assistant.
//
// ⚠⚠ WHY THIS IS NOT RUN AUTOMATICALLY. Deleting a Railway service destroys its volume;
// there is no undo and no trash. That is a permanent deletion of data, and the assistant
// does not perform those — it prepares them, proves the backup, and hands over one command.
//
// ⚠⚠ AND WHY THE BACKUP MATTERED MORE THAN IT LOOKED. `pg_stat_user_tables` reported **0
// live rows for all 68 tables**. The real counts are **1,251,338 rows over 2,029 MB**,
// including 29 Users and 54 Ideas from before the Neon migration. Anyone reading the stats
// view would have concluded this database was empty and deleted it. It is not empty.
//
// THE GUARD BELOW IS THE POINT: this refuses to delete unless it has just re-verified the
// R2 backup against the live database, table by table, in the same run. A backup taken
// yesterday and a deletion today is two facts nobody checked together.
//
//   tsx ops/with-legacy-env.ts "node_modules\.bin\tsx.cmd" ops/delete-legacy-db.ts --check
//   tsx ops/with-legacy-env.ts "node_modules\.bin\tsx.cmd" ops/delete-legacy-db.ts --yes-destroy-scrutinise-db
// ─────────────────────────────────────────────────────────────────────────────

import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { Client } from 'pg'
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { rail } from './audit-sleep'
import { SERVICES } from './sleep-state'

const KEY = 'backups/scrutinise-db/legacy-railway-postgres.sql.gz'
const CONFIRM = '--yes-destroy-scrutinise-db'

function r2() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  })
}
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

/** Re-verify the backup against live, in THIS run. Returns true only if every table matches. */
async function backupIsGood(): Promise<boolean> {
  const head = await r2().send(new HeadObjectCommand({ Bucket: BUCKET, Key: KEY })).catch(() => null)
  if (!head) { console.log(`✗ no backup at r2://${BUCKET}/${KEY}`); return false }
  console.log(`backup: ${((head.ContentLength ?? 0) / 1024 / 1024).toFixed(1)} MB`)

  const obj = await r2().send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }))
  const rl = createInterface({
    input: (obj.Body as unknown as Readable).pipe(createGunzip()),
    crlfDelay: Infinity,
  })
  const perTable = new Map<string, number>()
  let current: string | null = null
  let copyBlocks = 0
  let terminators = 0
  for await (const line of rl) {
    if (current !== null) {
      if (line === '\\.') { terminators++; current = null; continue }
      perTable.set(current, (perTable.get(current) ?? 0) + 1)
      continue
    }
    const m = /^COPY "([^"]+)"\."([^"]+)" \(/.exec(line)
    if (m) { copyBlocks++; current = `${m[1]}.${m[2]}`; perTable.set(current, perTable.get(current) ?? 0) }
  }
  if (copyBlocks !== terminators) { console.log('✗ the dump is truncated'); return false }

  const c = new Client({ connectionString: process.env.LEGACY_DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const r = await c.query<{ schema: string; name: string }>(`
      SELECT n.nspname AS schema, c.relname AS name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')`)
    let bad = 0
    let total = 0
    for (const t of r.rows) {
      const q = await c.query(`SELECT count(*)::bigint AS n FROM "${t.schema}"."${t.name}"`)
      const live = Number(q.rows[0].n)
      total += live
      const got = perTable.get(`${t.schema}.${t.name}`)
      if (got !== live) { console.log(`  ✗ ${t.schema}.${t.name}: backup ${got ?? 'MISSING'}, live ${live}`); bad++ }
    }
    console.log(bad === 0
      ? `✓ backup matches live: ${r.rows.length} tables, ${total.toLocaleString()} rows`
      : `✗ ${bad} table(s) disagree`)
    return bad === 0
  } finally { await c.end() }
}

async function main() {
  const good = await backupIsGood()
  if (!process.argv.includes(CONFIRM)) {
    console.log(`\n(check only — nothing deleted)`)
    console.log(good
      ? `To decommission, re-run with ${CONFIRM}`
      : `⚠ the backup does NOT verify. Do not delete.`)
    return
  }
  if (!good) {
    console.log(`\n⚠ REFUSING TO DELETE — the backup did not verify in this run.`)
    process.exitCode = 1
    return
  }

  console.log(`\ndeleting service scrutinise-db (${SERVICES['scrutinise-db']})…`)
  await rail(`mutation D($id: String!) { serviceDelete(id: $id) }`, { id: SERVICES['scrutinise-db'] })

  // ⚠ RE-READ. "The mutation returned" and "the service is gone" are different facts.
  const proj = await rail<{ project: { services: { edges: Array<{ node: { id: string; name: string } }> } } }>(
    `query P($id: String!) { project(id: $id) { services { edges { node { id name } } } } }`,
    { id: '68707c61-5c68-4f37-88fc-c301fd6b90e7' },
  )
  const still = proj.project.services.edges.find((e) => e.node.id === SERVICES['scrutinise-db'])
  console.log(still ? `✗ STILL PRESENT: ${still.node.name}` : `✓ re-read: scrutinise-db is gone`)
  if (still) process.exitCode = 1
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
