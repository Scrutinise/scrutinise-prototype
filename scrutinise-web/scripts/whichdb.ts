// whichdb — the mandatory pre-DDL check from docs/CLAUDE.md §16.
//
// The root `scripts/whichdb.ts` cannot run: there is no root node_modules, so it
// cannot resolve @prisma/client. That made a MANDATORY check un-runnable, which is
// the same failure class as a guard that cannot fail. This one runs from
// scrutinise-web, where the dependencies actually live, using `pg` directly so it
// needs no generated client:
//
//   npm run whichdb
//
// It prints host, database, user, and the last 5 _prisma_migrations rows. Paste the
// output before running any schema-altering or destructive SQL. If the host is not
// the one you expect, STOP.

import { Client } from 'pg'

const which = process.argv[2] ?? 'DATABASE_URL'
const url = process.env[which]

if (!url) {
  console.error(`✗ ${which} is not set in the environment.`)
  console.error('  Run with: npm run whichdb            (checks DATABASE_URL)')
  console.error('        or: npm run whichdb -- DIRECT_URL')
  process.exit(1)
}

function describe(raw: string) {
  // Never print the password. Parse rather than regex the whole string.
  const u = new URL(raw)
  return {
    host: u.hostname,
    port: u.port || '5432',
    database: u.pathname.replace(/^\//, ''),
    user: decodeURIComponent(u.username),
    pooled: u.hostname.includes('-pooler'),
  }
}

async function main() {
  const d = describe(url!)
  console.log(`env var : ${which}`)
  console.log(`host    : ${d.host}`)
  console.log(`port    : ${d.port}`)
  console.log(`database: ${d.database}`)
  console.log(`user    : ${d.user}`)
  console.log(`pooled  : ${d.pooled}`)

  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const now = await client.query<{ db: string; usr: string; addr: string | null }>(
      'select current_database() as db, current_user as usr, inet_server_addr()::text as addr'
    )
    console.log(`\nserver reports: database=${now.rows[0].db} user=${now.rows[0].usr}`)

    const migrations = await client.query<{
      migration_name: string
      finished_at: Date | null
      applied_steps_count: number
    }>(
      `select migration_name, finished_at, applied_steps_count
         from _prisma_migrations
        order by coalesce(finished_at, started_at) desc
        limit 5`
    )
    console.log('\nlast 5 _prisma_migrations:')
    if (migrations.rows.length === 0) {
      console.log('  (none)')
    }
    for (const r of migrations.rows) {
      console.log(
        `  ${r.finished_at ? r.finished_at.toISOString() : 'UNFINISHED'.padEnd(24)}  ` +
          `${r.migration_name}  (steps=${r.applied_steps_count})`
      )
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  // Print the whole error, not just .message — a pg connection failure can carry an
  // empty message with the actual cause in `code`/`errno`/`cause`, and "✗ failed:"
  // with nothing after it is not a diagnosis.
  console.error('✗ whichdb failed:', err)
  process.exit(1)
})
