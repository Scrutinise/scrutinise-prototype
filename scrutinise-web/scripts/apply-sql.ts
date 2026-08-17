// Apply a hand-written additive SQL file to the database named by DIRECT_URL.
//
// Exists because Prisma 7's `db execute` dropped `--schema`/`--url` and now reads its
// datasource from a config file, which makes "apply THIS file to THAT database, and let
// me see the host first" awkward at exactly the moment §16 requires it to be obvious.
//
// Usage:  npx tsx --env-file=.env scripts/apply-sql.ts prisma/<file>.sql
//
// It prints the host before it writes anything. If the host is not the one you expect,
// stop — that is the whole point of docs/CLAUDE.md §16.

import { readFileSync } from 'node:fs'
import { Client } from 'pg'

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: apply-sql.ts <path-to-sql>')
    process.exit(2)
  }
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error('No DIRECT_URL or DATABASE_URL in the environment.')
    process.exit(2)
  }
  const host = new URL(url).host
  console.log(`file : ${file}`)
  console.log(`host : ${host}`)

  const sql = readFileSync(file, 'utf8')
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(sql)
    console.log('applied OK')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
