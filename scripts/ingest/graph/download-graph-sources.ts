/**
 * download-graph-sources.ts — pull the TNA bulk amendments (effects) ZIPs from
 * research.legislation.gov.uk into graph/data/ (gitignored). Bulk before API:
 * this replaces ~290k per-act Changes-API fetches with 8 files (~330 MB).
 *
 * Vintage (verified by HEAD, 2026-07-05): secondary types (uksi/ssi/nisr/wsi)
 * regenerate daily; primary + EU types last regenerated 2025-10-30. Effects
 * deployed after a file's vintage are missing until TNA refreshes it — recorded
 * in the edge `source` tag so staleness is queryable.
 *
 * Auth: HTTP Basic (research.legislation.gov.uk discovery creds, see
 * docs/Archive/V2.76_bulk_data_inventory.md §1). OGL v3.0 content.
 *
 *   npx tsx graph/download-graph-sources.ts          — download all (skips complete files)
 *   npx tsx graph/download-graph-sources.ts --check  — HEAD-only status table
 */
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const BASE = 'https://research.legislation.gov.uk/data/downloads/amendments'
const AUTH = 'Basic ' + Buffer.from('research:n3w_s!te').toString('base64')
export const DATA_DIR = path.join(__dirname, 'data')

// Aggregate "all years" ZIPs. to-primary covers all primary types affected
// (ukpga/asp/nia/anaw/…); the four fresh secondary types supersede their slice
// of to-secondary, which is still fetched for the remainder (nisro etc.);
// EU types are separate (retained-EU corpus needs them — MiFIR-class revocations).
const FILES = [
  'to-primary/amendments-to-primary.zip',
  'to-secondary/amendments-to-secondary.zip',
  'to-uksi/amendments-to-uksi.zip',
  'to-ssi/amendments-to-ssi.zip',
  'to-nisr/amendments-to-nisr.zip',
  'to-wsi/amendments-to-wsi.zip',
  'to-eur/amendments-to-eur.zip',
  'to-eudn/amendments-to-eudn.zip',
  'to-eudr/amendments-to-eudr.zip',
]

async function head(url: string): Promise<{ ok: boolean; length: number; lastModified: string }> {
  const res = await fetch(url, { method: 'HEAD', headers: { Authorization: AUTH } })
  return {
    ok: res.ok,
    length: parseInt(res.headers.get('content-length') ?? '0', 10),
    lastModified: res.headers.get('last-modified') ?? '?',
  }
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: { Authorization: AUTH } })
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`)
  const tmp = dest + '.part'
  await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), fs.createWriteStream(tmp))
  fs.renameSync(tmp, dest)
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  fs.mkdirSync(DATA_DIR, { recursive: true })
  let failures = 0
  for (const rel of FILES) {
    const url = `${BASE}/${rel}`
    const dest = path.join(DATA_DIR, path.basename(rel))
    const h = await head(url)
    if (!h.ok) { console.error(`  MISSING ${rel} (HTTP not ok)`); failures++; continue }
    const have = fs.existsSync(dest) ? fs.statSync(dest).size : 0
    const state = have === h.length ? 'complete' : have > 0 ? `partial ${have}/${h.length}` : 'absent'
    console.log(`${path.basename(rel).padEnd(36)} ${String(h.length).padStart(10)}B  ${h.lastModified}  [${state}]`)
    if (checkOnly || state === 'complete') continue
    process.stdout.write(`  downloading… `)
    const t0 = Date.now()
    await download(url, dest)
    const got = fs.statSync(dest).size
    if (got !== h.length) { console.error(`SIZE MISMATCH ${got} != ${h.length}`); failures++; continue }
    console.log(`done ${(got / 1e6).toFixed(1)}MB in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  if (failures > 0) { console.error(`[download] ${failures} failure(s)`); process.exit(1) }
  console.log('[download] all files present + size-verified')
}
main().catch(e => { console.error('[download] FATAL', e); process.exit(1) })
