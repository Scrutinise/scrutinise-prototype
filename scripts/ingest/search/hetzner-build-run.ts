/**
 * hetzner-build-run.ts — stand up + drive a TRANSIENT Hetzner build box that runs a
 * heavy build (e.g. the vector layer) on a 16 vCPU / 64 GB CCX43 in Falkenstein, then
 * tears it down via the Hetzner API. The Railway-equivalent is `fts-railway-run.ts`;
 * this mirrors its command shape (setup / run / logs / teardown).
 *
 * WHY Hetzner (not Railway) for the heavy single-shot builds:
 *   - Railway's plan caps RAM/cores; the vector layer needs a 64 GB box for a few
 *     hours, not a persistent service. A CCX43 is cheap by the hour and disposable.
 *   - Spend is one event: server creation. So creation is GATED — `run` is the
 *     Charlie-triggered spend; `setup` is INERT (validates + stages, creates nothing).
 *
 * MONITORING — fts-watch is UNCHANGED. The build checkpoints progress to R2 exactly as
 * on Railway (`_search/<table>.checkpoint.json`); fts-watch polls that R2 object
 * directly and is oblivious to where the build runs. (Its Railway deployment-status
 * calls just read `dep=?` against a Hetzner id — harmless; the R2-checkpoint progress /
 * stall / done detection all still fire.) For human-readable stdout, the box runs
 * hetzner-logtail.ts → R2, and `logs` here tails that — the analogue of the Railway
 * `logs` command (Hetzner has no deployment-log API).
 *
 * CREDS:
 *   - HETZNER_API_TOKEN (Read & Write) — read from the SHELL ENV only. Never written to
 *     a file, never injected onto the box (the build never calls Hetzner).
 *   - NEON_DATABASE_URL + CLOUDFLARE_R2_* — read from scrutinise-web/.env and injected
 *     onto the box via cloud-init, same four the indexer needs. (Same set as
 *     fts-railway-run's NEEDED.)
 *
 * Usage:
 *   tsx search/hetzner-build-run.ts setup ["<build cmd>"]   — INERT: validate token+env+region, render cloud-init, create NOTHING
 *   tsx search/hetzner-build-run.ts run   "<build cmd>"     — SPEND: create the CCX43 with cloud-init, save server id (Charlie-triggered)
 *   tsx search/hetzner-build-run.ts logs                    — tail the box's stdout (via R2); also prints Hetzner server status
 *   tsx search/hetzner-build-run.ts teardown               — DELETE the server via API (frees compute)
 *
 * The build command may also be supplied via HETZNER_BUILD_CMD (argv wins). The
 * vector-layer build runs in two steps on the box (chunk manifest, then batch-embed +
 * ANN); see docs/VECTOR_EMBED_REPORT.md for the full runbook:
 *   HETZNER_BUILD_CMD="R2_MAX_SOCKETS=256 npx tsx search/build-corpus-chunks.ts && npx tsx search/build-vector-index.ts"
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const HETZNER_API = 'https://api.hetzner.cloud/v1'
const REPO_URL = 'https://github.com/Scrutinise/scrutinise-prototype.git'
const BRANCH = 'Main'

// Box spec — overridable for future builds, defaults to the brief's CCX43/Falkenstein.
const SERVER_TYPE = process.env.HETZNER_SERVER_TYPE ?? 'ccx43' // 16 vCPU dedicated / 64 GB
const IMAGE = process.env.HETZNER_IMAGE ?? 'ubuntu-24.04'
const LOCATION = process.env.HETZNER_LOCATION ?? 'fsn1' // Falkenstein
const SERVER_NAME = process.env.HETZNER_SERVER_NAME ?? 'scrutinise-build'
// Optional: attach an existing Hetzner SSH key (by name) for debug access. Not required —
// cloud-init is fully unattended and reports via R2.
const SSH_KEY_NAME = process.env.HETZNER_SSH_KEY_NAME

const STATE_KEY = path.join(__dirname, '.hetzner-build-server-id')
// Human-readable stdout tail the box uploads + `logs` reads. Distinct from the build's
// own machine checkpoint (`_search/*.checkpoint.json`) that fts-watch consumes.
const LOG_TAIL_KEY = process.env.HETZNER_LOG_TAIL_KEY ?? '_search/hetzner-build.tail.log'

// Neon + R2 + Gemini creds to inject (NOT the Hetzner token). GEMINI_API_KEY is required
// by the STEP-2 batch embed (gemini-batch.ts) — without it every shard fails client-side.
const NEEDED = [
  'NEON_DATABASE_URL',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'GEMINI_API_KEY',
] as const

const fs = require('fs') as typeof import('fs')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Hetzner API ────────────────────────────────────────────────────────────────
function token(): string {
  const t = process.env.HETZNER_API_TOKEN
  if (!t) throw new Error('HETZNER_API_TOKEN not set in shell env (never store it in a file). export it before running.')
  return t
}

async function hz<T>(method: string, pathname: string, body?: unknown): Promise<T> {
  const res = await fetch(`${HETZNER_API}${pathname}`, {
    method,
    headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(`Hetzner ${method} ${pathname} → ${res.status}: ${JSON.stringify(json.error ?? json)}`)
  return json as T
}

function saveState(s: { id: number; ip: string; createdAt: string }) {
  fs.writeFileSync(STATE_KEY, JSON.stringify(s, null, 2), 'utf8')
}
function loadState(): { id: number; ip: string; createdAt: string } {
  if (!fs.existsSync(STATE_KEY)) throw new Error(`no server recorded — run "run" first (${STATE_KEY})`)
  return JSON.parse(fs.readFileSync(STATE_KEY, 'utf8'))
}

// ── env collection ───────────────────────────────────────────────────────────
function collectEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of NEEDED) {
    const v = process.env[k]
    if (!v) {
      if (k === 'CLOUDFLARE_R2_BUCKET_NAME') continue // r2-client defaults to scrutinise-legislation
      throw new Error(`${k} not in env (scrutinise-web/.env) — cannot configure the build box`)
    }
    out[k] = v
  }
  return out
}

function resolveBuildCmd(argvCmd: string | undefined): string {
  const cmd = (argvCmd ?? process.env.HETZNER_BUILD_CMD ?? '').trim()
  if (!cmd) throw new Error('no build command — pass it as the next arg or set HETZNER_BUILD_CMD, e.g. "npx tsx search/build-vector-index.ts"')
  return cmd
}

// ── cloud-init ───────────────────────────────────────────────────────────────
// Renders the unattended provisioning script. Secrets land in a quoted heredoc (literal,
// no shell expansion); the build command lands in its own script file so its quoting can
// never break the outer script.
function renderCloudInit(env: Record<string, string>, buildCmd: string): string {
  const envBlock = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n')
  return `#!/bin/bash
set -uxo pipefail
exec > /var/log/cloud-init-scrutinise.log 2>&1
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y git curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

cd /root
git clone --depth 1 --branch ${BRANCH} ${REPO_URL} repo
cd /root/repo/scripts/ingest
npm install --no-audit --no-fund

# Neon + R2 creds (NOT the Hetzner token — the build never calls Hetzner)
cat > /root/scrutinise.env <<'ENVEOF'
${envBlock}
ENVEOF
set -a; . /root/scrutinise.env; set +a

# Build command isolated in its own file so any quoting inside is inert.
cat > /root/build.sh <<'CMDEOF'
${buildCmd}
CMDEOF
chmod +x /root/build.sh

LOG=/var/log/scrutinise-build.log
touch "$LOG"
# background: tail stdout -> R2 every 30s so the runner's \`logs\` can read it
nohup npx tsx search/hetzner-logtail.ts "$LOG" "${LOG_TAIL_KEY}" 30 >/var/log/logtail.log 2>&1 &
LOGTAIL_PID=$!

echo "[hetzner-build] starting: ${buildCmd}" | tee -a "$LOG"
bash /root/build.sh 2>&1 | tee -a "$LOG"
CODE=\${PIPESTATUS[0]}
echo "[hetzner-build] build exited code=\$CODE" | tee -a "$LOG"

# final flush of the stdout tail, then stop the background tailer
npx tsx search/hetzner-logtail.ts "$LOG" "${LOG_TAIL_KEY}" 1 & FLUSH=$!; sleep 3; kill $FLUSH 2>/dev/null || true
kill $LOGTAIL_PID 2>/dev/null || true
echo "[hetzner-build] DONE (exit \$CODE) — box idle; teardown via API from the runner" | tee -a "$LOG"
`
}

// ── commands ─────────────────────────────────────────────────────────────────

// INERT: validate token + creds + region/type/image against the live API (read-only),
// render the cloud-init, write it locally for inspection. Creates NO server.
async function setup(argvCmd?: string) {
  console.log('preflight (INERT — no server will be created):')
  const env = collectEnv()
  console.log(`  creds present: ${Object.keys(env).join(', ')}`)
  const buildCmd = (argvCmd ?? process.env.HETZNER_BUILD_CMD ?? '').trim()
  if (!buildCmd) console.log('  build cmd: (none yet — supply at `run` time or via HETZNER_BUILD_CMD)')
  else console.log(`  build cmd: ${buildCmd}`)

  // Read-only checks against the live API (verifies the token + that the spec exists).
  const st = await hz<{ server_types: Array<{ name: string; cores: number; memory: number }> }>('GET', `/server_types?per_page=50`)
  const found = st.server_types.find(s => s.name === SERVER_TYPE)
  if (!found) throw new Error(`server_type "${SERVER_TYPE}" not offered — got: ${st.server_types.map(s => s.name).join(', ')}`)
  console.log(`  ✓ ${SERVER_TYPE}: ${found.cores} vCPU / ${found.memory} GB (verified against API)`)
  const locs = await hz<{ locations: Array<{ name: string; city: string }> }>('GET', `/locations`)
  if (!locs.locations.find(l => l.name === LOCATION)) throw new Error(`location "${LOCATION}" not found`)
  console.log(`  ✓ location ${LOCATION} verified`)
  if (SSH_KEY_NAME) {
    const keys = await hz<{ ssh_keys: Array<{ name: string }> }>('GET', `/ssh_keys`)
    if (!keys.ssh_keys.find(k => k.name === SSH_KEY_NAME)) throw new Error(`HETZNER_SSH_KEY_NAME "${SSH_KEY_NAME}" not in account`)
    console.log(`  ✓ ssh key "${SSH_KEY_NAME}" verified`)
  }

  // Render + stash the cloud-init for inspection (contains creds → write next to state,
  // which is git-ignored like the Railway *-service-id files).
  const ci = renderCloudInit(env, buildCmd || 'echo "NO BUILD CMD — supply at run time"')
  const out = path.join(__dirname, '.hetzner-cloud-init.preview.sh')
  fs.writeFileSync(out, ci, 'utf8')
  console.log(`  cloud-init rendered → ${out} (${ci.length} bytes; <32KB limit ${ci.length < 32768 ? 'ok' : 'EXCEEDED'})`)
  console.log('\nINERT. To spend (Charlie-triggered):')
  console.log(`  HETZNER_API_TOKEN=… npx tsx search/hetzner-build-run.ts run "${buildCmd || '<build cmd>'}"`)
}

// SPEND: create the server with cloud-init. Charlie-triggered.
async function run(argvCmd?: string) {
  if (fs.existsSync(STATE_KEY)) throw new Error(`a server is already recorded (${STATE_KEY}). teardown first, or delete the file if stale.`)
  const env = collectEnv()
  const buildCmd = resolveBuildCmd(argvCmd)
  const userData = renderCloudInit(env, buildCmd)
  if (userData.length >= 32768) throw new Error(`cloud-init ${userData.length} bytes exceeds Hetzner's 32KB user_data limit`)

  let sshKeys: string[] | undefined
  if (SSH_KEY_NAME) sshKeys = [SSH_KEY_NAME]

  console.log(`creating ${SERVER_TYPE} "${SERVER_NAME}" (${IMAGE}, ${LOCATION}) — build: ${buildCmd}`)
  const created = await hz<{ server: { id: number; public_net: { ipv4: { ip: string } } } }>('POST', '/servers', {
    name: SERVER_NAME,
    server_type: SERVER_TYPE,
    image: IMAGE,
    location: LOCATION,
    start_after_create: true,
    user_data: userData,
    ssh_keys: sshKeys,
    labels: { app: 'scrutinise', role: 'build' },
  })
  const s = { id: created.server.id, ip: created.server.public_net?.ipv4?.ip ?? '(pending)', createdAt: new Date().toISOString() }
  saveState(s)
  console.log(`  server id=${s.id} ip=${s.ip} (saved → ${STATE_KEY})`)
  console.log('\nprovisioning (~3-5 min: apt + node + npm install) then the build starts. Monitor:')
  console.log('  • progress (R2 checkpoint, unchanged): npx tsx fts-watch.ts')
  console.log('  • stdout tail:                         npx tsx search/hetzner-build-run.ts logs')
  console.log('  • teardown when done:                  npx tsx search/hetzner-build-run.ts teardown')
}

async function serverStatus(id: number): Promise<string> {
  try {
    const r = await hz<{ server: { status: string } }>('GET', `/servers/${id}`)
    return r.server.status
  } catch { return '?' }
}

// Tail the box's stdout via the R2 mirror (Hetzner has no log API). Mirrors the shape of
// fts-railway-run's logs: poll, print only what's new, surface a completion sentinel.
async function logs() {
  const { id } = loadState()
  const { r2Get } = await import('../shared/r2-client')
  console.log(`tailing ${LOG_TAIL_KEY} (Ctrl-C to detach; the build keeps running on Hetzner)…`)
  let lastLen = 0
  for (let i = 0; i < 240; i++) { // ~60 min at 15s
    const status = await serverStatus(id)
    const body = await r2Get(LOG_TAIL_KEY)
    if (body && body.length !== lastLen) {
      const fresh = lastLen && body.length > lastLen ? body.slice(lastLen) : body
      process.stdout.write(fresh.endsWith('\n') ? fresh : fresh + '\n')
      lastLen = body.length
      if (body.includes('[hetzner-build] DONE')) { console.log(`\n>>> build reported completion (server status=${status}). Run teardown.`); return }
    } else {
      console.log(`  [${new Date().toISOString().slice(11, 19)}Z] server=${status} (no new output)`)
    }
    await sleep(15_000)
  }
  console.log('logs window elapsed — re-attach with: hetzner-build-run.ts logs')
}

async function teardown() {
  const { id } = loadState()
  console.log(`deleting server ${id}`)
  await hz('DELETE', `/servers/${id}`)
  fs.unlinkSync(STATE_KEY)
  console.log('deleted. compute freed.')
}

// ── dispatch ─────────────────────────────────────────────────────────────────
const mode = process.argv[2]
const arg = process.argv[3]
const fn = mode === 'setup' ? () => setup(arg)
  : mode === 'run' ? () => run(arg)
  : mode === 'logs' ? logs
  : mode === 'teardown' ? teardown
  : null
if (!fn) { console.error('usage: hetzner-build-run.ts setup ["<cmd>"] | run "<cmd>" | logs | teardown'); process.exit(1) }
fn().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
