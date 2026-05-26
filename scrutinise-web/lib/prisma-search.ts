/**
 * prisma-search.ts — Read-optimised Prisma client for Neon (search database).
 *
 * This is a SEPARATE client from prisma.ts. Two clients is the standard Prisma
 * pattern when connecting to two different PostgreSQL instances — Prisma does not
 * support multiple database URLs in a single client instance.
 *
 * Runtime role:
 *   - lib/prisma.ts        → Railway (application DB — handles all writes: users,
 *                            ideas, votes, legislation metadata inserts during ingests)
 *   - lib/prisma-search.ts → Neon (search DB — read-only at runtime)
 *
 * During the migration window (V.4-FTS-3 Parts 1–3), search.ts still queries
 * Railway via prisma.ts. Part 4 switches legislation search queries to this client.
 *
 * All writes continue through Railway. Neon is the read-only search replica.
 *
 * Lazy initialisation: the PrismaClient is created on first property access,
 * not at module load time. This ensures process.env.NEON_DATABASE_URL is
 * populated (via dotenv or Vercel env) before the connection is attempted.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

type GlobalWithPrismaSearch = typeof globalThis & {
  __prismaSearch?: PrismaClient
}

let _client: PrismaClient | undefined

function getClient(): PrismaClient {
  // In Next.js dev mode, reuse the global client across hot-reloads
  const g = globalThis as GlobalWithPrismaSearch
  if (g.__prismaSearch) return g.__prismaSearch

  if (_client) return _client

  if (!process.env.NEON_DATABASE_URL) {
    throw new Error(
      'NEON_DATABASE_URL is not set — add it to .env before using prisma-search.\n' +
      'Create a Neon project at neon.com and add: NEON_DATABASE_URL=postgresql://...'
    )
  }

  const adapter = new PrismaPg({ connectionString: process.env.NEON_DATABASE_URL })
  _client = new PrismaClient({ adapter })

  if (process.env.NODE_ENV !== 'production') {
    g.__prismaSearch = _client
  }

  return _client
}

/**
 * Proxy-based export so callers use `prismaSearch.xxx` without any API change.
 * The actual PrismaClient is created on first property access — after dotenv
 * (or Next.js / Vercel) has populated process.env.NEON_DATABASE_URL.
 */
export const prismaSearch = new Proxy({} as PrismaClient, {
  get(_target, key: string | symbol) {
    const client = getClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[key]
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})
