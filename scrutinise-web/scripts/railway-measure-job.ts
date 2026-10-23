/**
 * railway-measure-job.ts - runs ONE measurement script inside Railway's datacentre and puts its output on R2.
 * This is the process the `measure-job` Railway service starts (see railway-measure-run.ts); it is not meant to be run by hand.
 *
 *   tsx --tsconfig tsconfig.json scripts/railway-measure-job.ts <jobId> <script.ts> [script args...]
 *
 * Why: the SEARCH-28/29 gold runs are memory-hungry and slow on the desktop (three silent deaths, 4-5 min a search arm), so they run here.
 * Output is read from R2 (`measure/<jobId>/<file>`) because a Railway container's disk is gone when it exits.
 *
 * Flags: every capability flag production has ON is exported as "true" (read live from /api/health) unless the caller's args already set it, so the gateway
 * arm runs under production's real flag string; the harness's own --set overrides on top of that.
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const [jobId, script, ...rest] = process.argv.slice(2)
if (!jobId || !script) { console.error('usage: railway-measure-job.ts <jobId> <script.ts> [args...]'); process.exit(2) }
const T0 = Date.now()
const census = path.join(__dirname, '../../docs/census')
const log = (m: string) => console.log(`[measure-job] ${new Date().toISOString().slice(11, 19)} ${m}`)

async function main() {
  fs.mkdirSync(census, { recursive: true }) // the harness writes to ../../docs/census; on Railway the root is scrutinise-web, so that path does not exist yet
  const env: NodeJS.ProcessEnv = { ...process.env }
  try {
    const r = await fetch(process.env.HEALTH_URL ?? 'https://www.scrutinise.org/api/health')
    const h = await r.json() as { commit?: string; capabilities?: Record<string, boolean> }
    for (const [k, v] of Object.entries(h.capabilities ?? {})) if (v && env[k] === undefined) env[k] = 'true'
    log(`flags from live /api/health (commit ${String(h.commit).slice(0, 8)}): ${Object.entries(h.capabilities ?? {}).filter(([, v]) => v).map(([k]) => k).join(' ')}`)
  } catch (e) { log(`WARNING: could not read /api/health (${(e as Error).message}); flags are whatever the service env holds`) }
  const mem = setInterval(() => log(`rss ${Math.round(process.memoryUsage().rss / 1048576)} MB (this wrapper only)`), 120_000)

  log(`job ${jobId}: tsx ${script} ${rest.join(' ')}`)
  const code: number = await new Promise((res) => {
    const c = spawn('npx', ['tsx', '--tsconfig', 'tsconfig.json', script, ...rest], { env, stdio: 'inherit', shell: process.platform === 'win32' })
    c.on('exit', (n, sig) => res(n ?? (sig ? 137 : 1)))
  })
  clearInterval(mem)
  log(`script exited with code ${code} after ${Math.round((Date.now() - T0) / 1000)} s`)

  // upload whatever the run wrote after it started (the harness writes a single json; --out names it)
  const { r2Put } = await import('../lib/r2')
  let uploaded = 0
  for (const f of fs.readdirSync(census)) {
    const p = path.join(census, f)
    if (fs.statSync(p).mtimeMs < T0) continue
    const body = fs.readFileSync(p)
    await r2Put(`measure/${jobId}/${f}`, body, 'application/json')
    log(`UPLOADED measure/${jobId}/${f} (${body.length} bytes)`)
    uploaded++
  }
  log(`DONE exit=${code} uploaded=${uploaded}`)
  process.exit(code)
}
main().catch((e) => { console.error('[measure-job] FAILED', e); process.exit(1) })
