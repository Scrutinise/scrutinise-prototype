import 'dotenv/config'
import { PrismaClient } from '../generated/stats-client'
import { PrismaPg } from '@prisma/adapter-pg'

let _prisma: PrismaClient | null = null

/**
 * Stats-DB Prisma client. Reads STATS_DATABASE_URL — deliberately a different env
 * var from the app's DATABASE_URL so a misconfigured .env can't silently point an
 * ingest script at the corpus DB (see docs/CLAUDE.md §16, the whichdb incident).
 */
export function getStatsPrisma(): PrismaClient {
  if (_prisma) return _prisma
  const url = process.env.STATS_DATABASE_URL
  if (!url) throw new Error('STATS_DATABASE_URL not set — refusing to guess. See docs/STATS_SCHEMA.md.')
  const adapter = new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } })
  _prisma = new PrismaClient({ adapter })
  return _prisma
}
