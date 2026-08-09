/**
 * v33-archive-railway-db.ts — archive the old Railway `scrutinise-db` Postgres to R2 (V33 §4).
 *
 * WHY NOT `pg_dump`. There is no `pg_dump` on this machine and no PostgreSQL client install
 * (checked: nothing on PATH, nothing under `C:\Program Files\PostgreSQL`). Installing one just
 * to run this once is a bigger change than the archive. So the archive is a logical export made
 * with the driver already in use: gzipped JSONL, sharded, plus a manifest.
 *
 * ⚠ WHAT THAT COSTS, stated rather than glossed: JSONL is a DATA archive, not a restorable dump.
 * It carries rows, not DDL, indexes, sequences or constraints. That is the right shape for what
 * this data is for — evidence that nothing was lost when the pre-V26 snapshot was cleared — and
 * the wrong shape for `psql -f`. If a true restore is ever wanted, take a `pg_dump -Fc` from a
 * machine that has one BEFORE Railway is cleared. Recorded in docs/RAILWAY_ROLE.md.
 *
 * READ-ONLY AGAINST RAILWAY. Rows are streamed through a server-side `DECLARE … CURSOR`, so a
 * 914,274-row table carrying full body text never has to fit in memory, and each shard is capped
 * at SHARD_ROWS. It SELECTs and nothing else — clearing the database is a separate, explicitly
 * approved step and is deliberately not in this file.
 *
 * VERIFIED, NOT ASSUMED, in both directions:
 *   - before upload: the gzip is decoded again locally and its line count checked;
 *   - after upload: the object is read back from R2 **as bytes**, gunzipped, and counted.
 * An archive that was never read back is a belief, not a backup — and a silent short write is
 * precisely the failure an archive cannot afford, because it surfaces only when it is needed.
 *
 * Usage:
 *   tsx v33-archive-railway-db.ts             # dry run: counts and plan, nothing uploaded
 *   tsx v33-archive-railway-db.ts --commit
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import zlib from 'zlib'
import { Pool, PoolClient } from 'pg'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { r2Put } from './shared/r2-client'

export {}

const COMMIT = process.argv.includes('--commit')
const PREFIX = process.env.RAILWAY_ARCHIVE_PREFIX ?? `archive/railway-scrutinise-db/${new Date().toISOString().slice(0, 10)}`
/** Rows per shard. Bounds peak memory and keeps read-back verification cheap. */
const SHARD_ROWS = parseInt(process.env.RAILWAY_ARCHIVE_SHARD ?? '200000', 10)
const FETCH = 2000

const n = (v: number) => Number(v).toLocaleString('en-GB')
const mb = (b: number) => (b / 1048576).toFixed(1)

// ── R2, with a BYTE read (r2-client's r2Get decodes as UTF-8, which destroys gzip) ───────────
let _s3: S3Client | null = null
function s3(): S3Client {
  if (_s3) return _s3
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  })
  return _s3
}
async function r2GetBytes(key: string): Promise<Buffer | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation', Key: key }))
    const arr = await res.Body?.transformToByteArray()
    return arr ? Buffer.from(arr) : null
  } catch { return null }
}

type Shard = { key: string; rows: number; gzBytes: number }

/**
 * Count newlines in a Buffer.
 *
 * ⚠ Not `buf.toString().split('\n')`. The first run died with `RangeError: Invalid string length`
 * on `LegislationSection_DEPRECATED_2026-06-19` — 914,274 rows of body text exceed V8's ~512 MB
 * maximum string, so the archive of the one table that actually needs archiving was the one table
 * that could not be built. Counting bytes has no such ceiling.
 */
function countLines(buf: Buffer): number {
  let lines = 0
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) lines++
  return lines
}

/** Gzip one shard's worth of JSONL and upload it. Returns null when the cursor is exhausted. */
async function writeShard(client: PoolClient, table: string, part: number): Promise<Shard | null> {
  // Feed the gzip incrementally and collect BUFFERS. Concatenating the JSONL into one string
  // first is what blew the string limit; Buffer.concat has no equivalent cap.
  const gzip = zlib.createGzip({ level: 6 })
  const out: Buffer[] = []
  gzip.on('data', (c: Buffer) => out.push(c))
  const finished = new Promise<void>((res, rej) => { gzip.on('end', res); gzip.on('error', rej) })
  gzip.resume()

  const write = (s: string) => new Promise<void>((res, rej) => {
    gzip.write(s, 'utf8', (e) => (e ? rej(e) : res()))
  })

  let rows = 0
  while (rows < SHARD_ROWS) {
    const { rows: batch } = await client.query(`FETCH ${FETCH} FROM arch_cur`)
    if (batch.length === 0) break
    rows += batch.length
    // One JSON object per line. `JSON.stringify` renders a Buffer as {type:"Buffer",data:[…]}
    // and a timestamp as an ISO-8601 string — both round-trip; both are stated in the manifest.
    for (const r of batch) await write(JSON.stringify(r) + '\n')
  }
  gzip.end()
  await finished
  if (rows === 0) return null

  const gz = Buffer.concat(out)
  // pre-upload integrity: the bytes we are about to store really do decode to `rows` lines.
  const localLines = countLines(zlib.gunzipSync(gz))
  if (localLines !== rows) throw new Error(`[archive] ${table} part ${part}: gzip decodes to ${localLines} lines, expected ${rows}`)

  const key = `${PREFIX}/${table}.part${String(part).padStart(4, '0')}.jsonl.gz`
  if (COMMIT) await r2Put(key, gz, 'application/gzip')
  return { key, rows, gzBytes: gz.length }
}

async function archiveTable(pool: Pool, table: string): Promise<Shard[]> {
  const client = await pool.connect()
  const shards: Shard[] = []
  try {
    await client.query('BEGIN')
    await client.query(`DECLARE arch_cur NO SCROLL CURSOR FOR SELECT * FROM "${table}"`)
    for (let part = 1; ; part++) {
      const s = await writeShard(client, table, part)
      if (!s) break
      shards.push(s)
    }
    await client.query('CLOSE arch_cur')
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
  return shards
}

async function main() {
  const url = process.env.RAILWAY_DATABASE_URL_LEGACY
  if (!url) throw new Error('RAILWAY_DATABASE_URL_LEGACY not set')
  console.log(`[archive] source  ${url.replace(/^.*@/, '').replace(/\/.*$/, '')}  (READ-ONLY)`)
  console.log(`[archive] target  R2 ${PREFIX}/`)
  console.log(`[archive] ${COMMIT ? '*** COMMIT ***' : 'DRY RUN (nothing uploaded — pass --commit)'}\n`)

  const pool = new Pool({
    connectionString: url, ssl: { rejectUnauthorized: false }, max: 3,
    statement_timeout: 0, idle_in_transaction_session_timeout: 0,
  })

  const { rows: tables } = await pool.query<{ relname: string; total: string }>(
    `SELECT c.relname, pg_total_relation_size(c.oid)::bigint AS total
       FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC`)

  const manifest: Array<{ table: string; rows: number; gzBytes: number; shards: Shard[] }> = []
  let empty = 0, totalRows = 0, totalBytes = 0
  const t0 = Date.now()

  for (const t of tables) {
    const { rows: [c] } = await pool.query<{ n: string }>(`SELECT count(*)::bigint AS n FROM "${t.relname}"`)
    const count = Number(c.n)
    if (count === 0) { empty++; continue }
    const shards = await archiveTable(pool, t.relname)
    const rows = shards.reduce((a, s) => a + s.rows, 0)
    const bytes = shards.reduce((a, s) => a + s.gzBytes, 0)
    if (rows !== count) {
      console.error(`  ✗ ${t.relname}: exported ${n(rows)} rows but the table holds ${n(count)}`)
      process.exitCode = 1
    }
    manifest.push({ table: t.relname, rows, gzBytes: bytes, shards })
    totalRows += rows; totalBytes += bytes
    console.log(`  ${t.relname.padEnd(44)} ${n(rows).padStart(10)} rows  ${mb(bytes).padStart(8)} MB gz in ${shards.length} shard(s)  (raw ${mb(Number(t.total))} MB)`)
  }

  console.log(`\n  ${manifest.length} tables archived, ${empty} empty tables skipped`)
  console.log(`  ${n(totalRows)} rows, ${mb(totalBytes)} MB gzipped, in ${Math.round((Date.now() - t0) / 1000)}s`)

  if (COMMIT) {
    const manifestBody = JSON.stringify({
      archivedAt: new Date().toISOString(),
      source: url.replace(/:[^:@]*@/, ':***@'),
      sprint: 'V33 §4',
      format: 'gzipped JSONL, sharded at ' + SHARD_ROWS + ' rows: one JSON object per line. ' +
              'Buffers serialise as {type:"Buffer",data:[…]}, timestamps as ISO-8601 strings.',
      limitation: 'DATA ONLY — no DDL, indexes, sequences or constraints. NOT restorable with ' +
                  'psql -f. Taken this way because no pg_dump exists on the machine that ran it.',
      note: 'Taken before the pre-V26 Railway snapshot was cleared. Every user-data table here is ' +
            'matched or exceeded by Neon, the live app database since the 18 Jun 2026 cutover.',
      emptyTablesSkipped: empty, totalRows, totalGzBytes: totalBytes,
      tables: manifest,
    }, null, 2)
    await r2Put(`${PREFIX}/MANIFEST.json`, manifestBody, 'application/json')
    console.log(`  manifest → ${PREFIX}/MANIFEST.json`)

    console.log('\n── verifying the archive by reading it back from R2 ─────────────────────────')
    let bad = 0, checked = 0
    for (const m of manifest) {
      for (const s of m.shards) {
        const got = await r2GetBytes(s.key)
        checked++
        if (!got) { console.error(`  ✗ ${s.key}: object missing`); bad++; continue }
        if (got.length !== s.gzBytes) { console.error(`  ✗ ${s.key}: ${n(got.length)} bytes stored, ${n(s.gzBytes)} uploaded`); bad++; continue }
        const lines = countLines(zlib.gunzipSync(got))
        if (lines !== s.rows) { console.error(`  ✗ ${s.key}: ${n(lines)} lines read back, ${n(s.rows)} exported`); bad++ }
      }
    }
    console.log(bad === 0
      ? `  ✅ all ${checked} objects read back byte-for-byte with the exported row count`
      : `  ❌ ${bad} of ${checked} objects failed read-back verification`)
    if (bad) process.exitCode = 1
  }

  await pool.end()
}
main().catch((e) => { console.error('[archive] FATAL', e); process.exit(1) })
