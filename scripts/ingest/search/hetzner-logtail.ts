/**
 * hetzner-logtail.ts — runs ON the Hetzner build box (started by cloud-init). Every
 * `intervalSec`, uploads the TAIL of the build's stdout log to an R2 key so the
 * `hetzner-build-run.ts logs` command can read human-readable progress from anywhere.
 *
 * WHY: Hetzner has no deployment-log API (unlike Railway's deploymentLogs). The build's
 * structured progress already checkpoints to R2 (`_search/*.checkpoint.json`) and is
 * monitored by the existing fts-watch UNCHANGED — this is the complementary
 * human-readable stdout tail, the analogue of `fts-railway-run.ts logs`.
 *
 * Uses the repo's r2-client, so it reuses the same R2 creds cloud-init injected. Never
 * touches Hetzner — only R2 (PutObject).
 *
 * Usage (from cloud-init): npx tsx search/hetzner-logtail.ts <logfile> <r2key> [intervalSec]
 */
import { r2Put } from '../shared/r2-client'
const fs = require('fs') as typeof import('fs')

const [, , LOG_FILE, R2_KEY, INTERVAL_ARG] = process.argv
if (!LOG_FILE || !R2_KEY) {
  console.error('usage: hetzner-logtail.ts <logfile> <r2key> [intervalSec]')
  process.exit(1)
}
const INTERVAL_MS = (parseInt(INTERVAL_ARG ?? '30', 10) || 30) * 1000
const TAIL_BYTES = 96 * 1024 // last ~96KB of stdout is plenty of context
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function uploadTail(): Promise<void> {
  if (!fs.existsSync(LOG_FILE)) return
  const { size } = fs.statSync(LOG_FILE)
  const start = Math.max(0, size - TAIL_BYTES)
  const len = size - start
  if (len <= 0) return
  const fd = fs.openSync(LOG_FILE, 'r')
  try {
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, start)
    await r2Put(R2_KEY, buf.toString('utf8'), 'text/plain')
  } finally {
    fs.closeSync(fd)
  }
}

async function main() {
  // eslint-disable-next-line no-constant-condition
  for (;;) {
    try { await uploadTail() } catch (e) { console.error('[logtail] upload failed', e) }
    await sleep(INTERVAL_MS)
  }
}
main()
