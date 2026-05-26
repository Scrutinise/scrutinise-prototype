/**
 * test-neon-connection.ts — Verify Neon DB is reachable via prisma-search client.
 *
 * Runs SELECT 1 via the Neon Prisma client. Also reports PostgreSQL version
 * and checks pgvector availability.
 *
 * Run:
 *   cd scrutinise-web
 *   npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/legislation/test-neon-connection.ts
 */

import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { prismaSearch } from '../../scrutinise-web/lib/prisma-search'

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) {
    console.error('NEON_DATABASE_URL not set in .env')
    process.exit(1)
  }

  // Mask credentials for log output
  const hostPart = url.replace(/postgresql:\/\/[^@]+@/, 'postgresql://(credentials)@')
  console.log(`Connecting to Neon: ${hostPart}`)

  // SELECT 1 — basic connectivity
  const pingResult = await prismaSearch.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`
  console.log(`  SELECT 1 → ${pingResult[0].ok} ✓`)

  // PostgreSQL version
  const verResult = await prismaSearch.$queryRaw<{ pg_version: string }[]>`SELECT version() AS pg_version`
  console.log(`  PostgreSQL: ${verResult[0].pg_version}`)

  // pgvector availability
  const extResult = await prismaSearch.$queryRaw<{ name: string; default_version: string }[]>`
    SELECT name, default_version
    FROM pg_available_extensions
    WHERE name = 'vector'
  `
  if (extResult.length > 0) {
    console.log(`  pgvector: available (v${extResult[0].default_version}) ✓`)
  } else {
    console.log('  pgvector: NOT available on this Neon instance')
  }

  // Existing tables
  const tableResult = await prismaSearch.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `
  if (tableResult.length === 0) {
    console.log('  Tables: none (fresh DB — schema push required)')
  } else {
    console.log(`  Tables: ${tableResult.length} existing`)
    tableResult.slice(0, 10).forEach((r: { tablename: string }) =>
      console.log(`    ${r.tablename}`)
    )
    if (tableResult.length > 10) {
      console.log(`    ... (${tableResult.length - 10} more)`)
    }
  }

  console.log('\nNeon connection verified ✓')
  await prismaSearch.$disconnect()
}

main().catch(async err => {
  console.error('Neon connection failed:', err.message)
  await prismaSearch.$disconnect().catch(() => {})
  process.exit(1)
})
