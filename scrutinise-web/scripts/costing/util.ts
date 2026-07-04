// ─────────────────────────────────────────────────────────────────────────────
// Shared plumbing for the costing extraction scripts (COSTING Phase 2a s2 —
// cc_extraction_manifest in docs/cost-benchmarks-seed-v2-additions.json).
// Each M-script: download the named source → extract the named values → verify
// against the actual bytes → insert with source + priceYear. Repeatable on
// source updates (re-run with the new URL).
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export function neonPrisma(): PrismaClient {
  const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
  if (!connectionString) {
    console.error('No NEON_DATABASE_URL or DATABASE_URL set.')
    process.exit(1)
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const UA = 'Scrutinise/1.0 (civic policy platform; scrutinise.org)'

/** Download a source file to a local cache path (skips if already present, so a
 *  re-run parses the same bytes; delete the cache file to force a re-download). */
export async function download(url: string, cachePath: string): Promise<Buffer> {
  if (existsSync(cachePath)) {
    console.log(`  using cached ${cachePath}`)
    return readFileSync(cachePath)
  }
  console.log(`  downloading ${url}`)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, buf)
  console.log(`  saved ${buf.length.toLocaleString()} bytes → ${cachePath}`)
  return buf
}

/** Local cache dir for downloaded sources (gitignored scratch, not the repo). */
export const CACHE_DIR = join(
  process.env.TEMP ?? process.env.TMP ?? '/tmp',
  'scrutinise-costing-sources',
)

export const APPLY = process.argv.includes('--apply')

// ── Minimal zip reader (ONS publishes ASHE tables as zips of xlsx). Standard
// central-directory walk + inflateRawSync — no new dependency. Handles the
// stored (0) and deflate (8) methods, which covers ONS zips. ────────────────────
import { inflateRawSync } from 'zlib'

export function unzipEntry(zip: Buffer, nameMatch: RegExp): { name: string; data: Buffer } {
  // Find End Of Central Directory (EOCD) — scan back for its signature.
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65536); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('EOCD not found — not a zip?')
  const count = zip.readUInt16LE(eocd + 10)
  let off = zip.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central-directory entry')
    const method = zip.readUInt16LE(off + 10)
    const compSize = zip.readUInt32LE(off + 20)
    const nameLen = zip.readUInt16LE(off + 28)
    const extraLen = zip.readUInt16LE(off + 30)
    const commentLen = zip.readUInt16LE(off + 32)
    const localOff = zip.readUInt32LE(off + 42)
    const name = zip.subarray(off + 46, off + 46 + nameLen).toString('utf8')
    if (nameMatch.test(name)) {
      // Local header: name/extra lengths there may differ from the central copy.
      const lNameLen = zip.readUInt16LE(localOff + 26)
      const lExtraLen = zip.readUInt16LE(localOff + 28)
      const start = localOff + 30 + lNameLen + lExtraLen
      const raw = zip.subarray(start, start + compSize)
      const data = method === 8 ? inflateRawSync(raw) : method === 0 ? Buffer.from(raw) : null
      if (!data) throw new Error(`unsupported zip method ${method} for ${name}`)
      return { name, data }
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`no zip entry matching ${nameMatch}`)
}
