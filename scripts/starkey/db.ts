// Shared Postgres connection for the starkey transcript corpus.
//
// Uses `pg` directly rather than Prisma: the `starkey` schema is not in
// schema.prisma and must not be, or `prisma migrate` will treat it as drift.
//
// CLAUDE.md §16 — every script that touches this connection prints host and
// database before doing anything, so a wrong-database run is visible in the
// log rather than discovered weeks later.
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'

const ENV_PATH = path.resolve(__dirname, '../../scrutinise-web/.env')

export function readEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name]
  if (!fs.existsSync(ENV_PATH)) return undefined
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '')
  }
  return undefined
}

/** Non-pooled Neon endpoint: DDL and long COPY-style loads want a direct session. */
export function connectionString(): string {
  const url = readEnvVar('DIRECT_URL') ?? readEnvVar('DATABASE_URL')
  if (!url) throw new Error('Neither DIRECT_URL nor DATABASE_URL is set')
  return url
}

export function describeTarget(): string {
  const u = new URL(connectionString())
  return `host=${u.hostname} database=${u.pathname.replace('/', '')}`
}

export function pool(): Pool {
  return new Pool({ connectionString: connectionString(), ssl: { rejectUnauthorized: false }, max: 4 })
}

/** Print the §16 banner. Call this first in every script that writes. */
export function banner(what: string): void {
  console.log(`[starkey] ${what}`)
  console.log(`[starkey] target: ${describeTarget()}`)
}
