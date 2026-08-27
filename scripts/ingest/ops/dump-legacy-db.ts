// ─────────────────────────────────────────────────────────────────────────────
// DUMP scrutinise-db (the legacy Railway Postgres) to R2, before it is decommissioned.
//
// ⚠⚠ THIS DATABASE IS NOT EMPTY, AND `pg_stat` SAYS IT IS.
// `pg_stat_user_tables.n_live_tup` reported **0 rows for all 68 tables**. Real counts:
// **1,251,182 rows over 2,029 MB**, including 29 Users and 54 Ideas from before the Neon
// migration. Statistics reset; the data did not. Deleting on the strength of that reading
// would have destroyed the pre-Neon production database irreversibly.
//
// ⚠ NOT `pg_dump`, BECAUSE THERE IS NO `pg_dump` ON THIS MACHINE (no Postgres client, no
// Docker — checked). This does the same job through the wire protocol: DDL reconstructed
// from the catalogue, and every table streamed with `COPY … TO STDOUT`, which is the same
// text format `pg_dump` emits. The output is a single gzipped `.sql` restorable with
// `psql -f`.
//
// ⚠ AND IT IS VERIFIED BY RE-READING THE OBJECT FROM R2, not by trusting the upload. A
// dump nobody has read back is a backup nobody has taken. `--verify` re-downloads, gunzips,
// and counts the COPY blocks and data lines against the live database.
//
//   tsx ops/dump-legacy-db.ts            # dump and upload
//   tsx ops/dump-legacy-db.ts --verify   # re-read what is in R2 and check it against live
// ─────────────────────────────────────────────────────────────────────────────

import { createGzip, createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { PassThrough, Readable } from 'node:stream'
import { createWriteStream, statSync, readFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createHash } from 'node:crypto'
import { Client } from 'pg'
import { to as copyTo } from 'pg-copy-streams'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const KEY = 'backups/scrutinise-db/legacy-railway-postgres.sql.gz'
const LOCAL = 'C:/Users/charl/AppData/Local/Temp/claude/legacy-db-dump.sql.gz'

function r2() {
  const account = process.env.CLOUDFLARE_R2_ACCOUNT_ID
  const keyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secret = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  if (!account || !keyId || !secret) throw new Error('R2 credentials not set')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: keyId, secretAccessKey: secret },
  })
}
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

function connect(): Client {
  const url = process.env.LEGACY_DATABASE_URL
  if (!url) throw new Error('LEGACY_DATABASE_URL not set')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

interface TableRef { schema: string; name: string; rows: number }

async function tables(c: Client): Promise<TableRef[]> {
  const r = await c.query<{ schema: string; name: string }>(`
    SELECT n.nspname AS schema, c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')
    ORDER BY n.nspname, c.relname`)
  const out: TableRef[] = []
  for (const t of r.rows) {
    // ⚠ A REAL COUNT PER TABLE. This is both the manifest and the thing `--verify` checks
    // the dump against, so it cannot be an estimate.
    const q = await c.query(`SELECT count(*)::bigint AS n FROM "${t.schema}"."${t.name}"`)
    out.push({ schema: t.schema, name: t.name, rows: Number(q.rows[0].n) })
  }
  return out
}

/** Column list in ordinal order — COPY needs it explicit so a restore cannot mis-map. */
async function columns(c: Client, t: TableRef): Promise<string[]> {
  const r = await c.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position`, [t.schema, t.name])
  return r.rows.map((x) => x.column_name)
}

async function dump() {
  const c = connect()
  await c.connect()
  const out = new PassThrough()
  const gz = createGzip({ level: 9 })
  const file = createWriteStream(LOCAL)
  const done = pipeline(out, gz, file)

  try {
    const ts = await tables(c)
    const totalRows = ts.reduce((n, t) => n + t.rows, 0)
    console.log(`dumping ${ts.length} tables, ${totalRows.toLocaleString()} rows`)

    const w = (s: string) => new Promise<void>((res, rej) =>
      out.write(s, (e) => (e ? rej(e) : res())))

    await w(`-- scrutinise-db (legacy Railway Postgres) — logical dump\n`)
    await w(`-- taken ${new Date().toISOString()}\n`)
    await w(`-- ⚠ pg_stat reported 0 rows for every table; these are REAL counts.\n`)
    await w(`-- tables: ${ts.length}, rows: ${totalRows}\n`)
    for (const t of ts) await w(`--   ${t.schema}.${t.name} = ${t.rows}\n`)
    await w(`\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\n\n`)

    // ── schema ────────────────────────────────────────────────────────────
    // Reconstructed from the catalogue rather than shelled out to pg_dump.
    const schemas = [...new Set(ts.map((t) => t.schema))]
    for (const s of schemas) {
      if (s !== 'public') await w(`CREATE SCHEMA IF NOT EXISTS "${s}";\n`)
    }
    await w('\n')

    for (const t of ts) {
      const cols = await c.query<{ column_name: string; data_type: string; udt_name: string
        is_nullable: string; column_default: string | null; character_maximum_length: number | null }>(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2
        ORDER BY ordinal_position`, [t.schema, t.name])
      const defs = cols.rows.map((col) => {
        // USER-DEFINED means an enum or composite; the udt_name is the real type.
        const type = col.data_type === 'USER-DEFINED' ? `"${col.udt_name}"`
          : col.data_type === 'ARRAY' ? `${col.udt_name.replace(/^_/, '')}[]`
            : col.character_maximum_length ? `${col.data_type}(${col.character_maximum_length})`
              : col.data_type
        const nn = col.is_nullable === 'NO' ? ' NOT NULL' : ''
        const def = col.column_default ? ` DEFAULT ${col.column_default}` : ''
        return `  "${col.column_name}" ${type}${def}${nn}`
      })
      await w(`CREATE TABLE IF NOT EXISTS "${t.schema}"."${t.name}" (\n${defs.join(',\n')}\n);\n`)
    }
    await w('\n')

    // ── data ──────────────────────────────────────────────────────────────
    let written = 0
    for (const t of ts) {
      const cols = await columns(c, t)
      const colList = cols.map((x) => `"${x}"`).join(', ')
      await w(`\nCOPY "${t.schema}"."${t.name}" (${colList}) FROM stdin;\n`)
      if (t.rows > 0) {
        const stream = c.query(copyTo(
          `COPY (SELECT ${colList} FROM "${t.schema}"."${t.name}") TO STDOUT`,
        )) as unknown as NodeJS.ReadableStream
        await new Promise<void>((res, rej) => {
          stream.on('data', (chunk: Buffer) => { out.write(chunk) })
          stream.on('end', () => res())
          stream.on('error', rej)
        })
      }
      await w(`\\.\n`)
      written += t.rows
      if (t.rows > 1000) console.log(`  ${t.schema}.${t.name}: ${t.rows.toLocaleString()}`)
    }
    await w(`\n-- end of dump; ${written} rows\n`)
    out.end()
    await done

    const size = statSync(LOCAL).size
    const sha = createHash('sha256').update(readFileSync(LOCAL)).digest('hex')
    console.log(`\nlocal dump: ${(size / 1024 / 1024).toFixed(1)} MB  sha256 ${sha.slice(0, 16)}…`)

    // ── upload ────────────────────────────────────────────────────────────
    await r2().send(new PutObjectCommand({
      Bucket: BUCKET, Key: KEY, Body: readFileSync(LOCAL),
      ContentType: 'application/gzip',
      Metadata: { rows: String(written), tables: String(ts.length), sha256: sha },
    }))
    const head = await r2().send(new HeadObjectCommand({ Bucket: BUCKET, Key: KEY }))
    console.log(`uploaded r2://${BUCKET}/${KEY}`)
    console.log(`re-read size: ${head.ContentLength} (local ${size}) ${head.ContentLength === size ? '✓' : '✗ MISMATCH'}`)
  } finally {
    await c.end()
  }
}

/**
 * ⚠⚠ STREAMED, BECAUSE THE FIRST VERSION COULD NOT READ ITS OWN BACKUP.
 *
 * It decompressed the archive into a single string and died on
 * `Cannot create a string longer than 0x1fffffe8 characters` — V8's ~512 MB string cap,
 * against 2 GB of SQL. **A verification step that cannot run on the real artefact verifies
 * nothing**, and it would have failed at exactly the size where a backup matters most.
 *
 * So it gunzips through a pipe and counts line by line: constant memory, and it reads every
 * byte rather than a prefix.
 */
async function verify() {
  // ⚠ RE-DOWNLOAD. Verifying the local file would only prove the local file exists.
  const obj = await r2().send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }))
  const head = await r2().send(new HeadObjectCommand({ Bucket: BUCKET, Key: KEY }))
  console.log(`r2://${BUCKET}/${KEY} — ${((head.ContentLength ?? 0) / 1024 / 1024).toFixed(1)} MB`)

  const body = obj.Body as unknown as Readable
  const gunzip = createGunzip()
  const rl = createInterface({ input: body.pipe(gunzip), crlfDelay: Infinity })

  // Counted while streaming: the current COPY target and its data lines.
  const perTable = new Map<string, number>()
  let creates = 0
  let copyBlocks = 0
  let terminators = 0
  let current: string | null = null
  let bytes = 0

  for await (const line of rl) {
    bytes += line.length + 1
    if (current !== null) {
      if (line === '\\.') { terminators++; current = null; continue }
      perTable.set(current, (perTable.get(current) ?? 0) + 1)
      continue
    }
    if (line.startsWith('CREATE TABLE')) { creates++; continue }
    const m = /^COPY "([^"]+)"\."([^"]+)" \(/.exec(line)
    if (m) { copyBlocks++; current = `${m[1]}.${m[2]}`; perTable.set(current, perTable.get(current) ?? 0) }
  }

  console.log(`decompressed ${(bytes / 1024 / 1024).toFixed(1)} MB of SQL ✓ (gzip integrity OK)`)
  console.log(`CREATE TABLE: ${creates}   COPY blocks: ${copyBlocks}   terminators: ${terminators}`)
  if (copyBlocks !== terminators) {
    console.log('✗ a COPY block is unterminated — the dump is TRUNCATED. DO NOT DELETE.')
    process.exitCode = 1
    return
  }

  // ── against the LIVE database, table by table ─────────────────────────
  const c = connect()
  await c.connect()
  try {
    const ts = await tables(c)
    let bad = 0
    let total = 0
    for (const t of ts) {
      const key = `${t.schema}.${t.name}`
      const got = perTable.get(key)
      total += t.rows
      if (got === undefined) { console.log(`  ✗ ${key} MISSING from the dump`); bad++; continue }
      if (got !== t.rows) {
        console.log(`  ✗ ${key}: dump ${got.toLocaleString()}, live ${t.rows.toLocaleString()}`)
        bad++
      }
    }
    console.log(bad === 0
      ? `\n✓ all ${ts.length} tables match, ${total.toLocaleString()} rows accounted for.`
      : `\n✗ ${bad} table(s) disagree — DO NOT DELETE.`)
    process.exitCode = bad === 0 ? 0 : 1
  } finally {
    await c.end()
  }
}

/**
 * Upload a dump already on disk.
 *
 * ⚠ SEPARATE FROM `dump()` BECAUSE THE FIRST RUN FAILED AT THE UPLOAD, AFTER 585 MB OF
 * PERFECTLY GOOD WORK. The R2 credentials live on the Railway service rather than in this
 * shell, and re-running the whole dump to fix a missing environment variable would have
 * thrown away twenty minutes and hammered a database I am about to decommission.
 */
async function upload() {
  if (!existsSync(LOCAL)) throw new Error(`no local dump at ${LOCAL} — run without --upload first`)
  const body = readFileSync(LOCAL)
  const sha = createHash('sha256').update(body).digest('hex')
  console.log(`local dump: ${(body.length / 1024 / 1024).toFixed(1)} MB  sha256 ${sha.slice(0, 16)}…`)
  await r2().send(new PutObjectCommand({
    Bucket: BUCKET, Key: KEY, Body: body,
    ContentType: 'application/gzip',
    Metadata: { sha256: sha },
  }))
  const head = await r2().send(new HeadObjectCommand({ Bucket: BUCKET, Key: KEY }))
  console.log(`uploaded r2://${BUCKET}/${KEY}`)
  console.log(`re-read size: ${head.ContentLength} (local ${body.length}) ${head.ContentLength === body.length ? '✓' : '✗ MISMATCH'}`)
}

async function main() {
  if (process.argv.includes('--verify')) await verify()
  else if (process.argv.includes('--upload')) await upload()
  else await dump()
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
