/**
 * vultr-build-run.ts — stand up + drive a TRANSIENT Vultr instance for the vector
 * ANN compact+reindex rebuild (Hetzner CCX* is dedicated-core-quota-blocked on this
 * account; DigitalOcean's Memory-Optimized class is new-account-gated). Mirrors
 * hetzner-build-run.ts's command shape (setup / run / logs / teardown) and cloud-init
 * pattern (git clone Main, inject creds, retry-wrapped build command, R2 stdout tail)
 * so monitoring (R2 checkpoint polling, hetzner-logtail.ts) is unchanged.
 *
 * CREDS:
 *   - VULTR_API_TOKEN — read from scrutinise-web/.env. Money-spending credential —
 *     same discipline as HETZNER_API_TOKEN (never logged, remove after the job).
 *   - NEON_DATABASE_URL + CLOUDFLARE_R2_* + GEMINI_API_KEY — injected onto the box via
 *     cloud-init user_data, same set hetzner-build-run.ts injects.
 *
 * Usage:
 *   tsx search/vultr-build-run.ts setup ["<build cmd>"]  — INERT: validate token+env, render cloud-init, create NOTHING
 *   tsx search/vultr-build-run.ts run   "<build cmd>"    — SPEND: create the instance with cloud-init (Charlie-triggered)
 *   tsx search/vultr-build-run.ts logs                   — tail the box's stdout (via R2); also prints Vultr instance status
 *   tsx search/vultr-build-run.ts teardown                — DELETE the instance via API (frees compute)
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const VULTR_API = 'https://api.vultr.com/v2'
const REPO_URL = 'https://github.com/Scrutinise/scrutinise-prototype.git'
const BRANCH = 'Main'

const PLAN = process.env.VULTR_PLAN ?? 'voc-g-32c-128gb-640s-amd' // 32 vCPU / 128GB
const REGION = process.env.VULTR_REGION ?? 'lhr'
const OS_ID = parseInt(process.env.VULTR_OS_ID ?? '2284', 10) // Ubuntu 24.04 LTS x64
const LABEL = process.env.VULTR_LABEL ?? 'scrutinise-build'

const STATE_KEY = path.join(__dirname, '.vultr-build-instance-id')
const LOG_TAIL_KEY = process.env.HETZNER_LOG_TAIL_KEY ?? '_search/hetzner-build.tail.log' // same key — fts-watch/monitoring unchanged

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

function token(): string {
  const t = process.env.VULTR_API_TOKEN
  if (!t) throw new Error('VULTR_API_TOKEN not set in scrutinise-web/.env')
  return t
}

async function vq<T>(method: string, pathname: string, body?: unknown): Promise<T> {
  const res = await fetch(`${VULTR_API}${pathname}`, {
    method,
    headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(`Vultr ${method} ${pathname} -> ${res.status}: ${JSON.stringify(json)}`)
  return json as T
}

function saveState(s: { id: string; createdAt: string }) { fs.writeFileSync(STATE_KEY, JSON.stringify(s, null, 2), 'utf8') }
function loadState(): { id: string; createdAt: string } {
  if (!fs.existsSync(STATE_KEY)) throw new Error(`no instance recorded — run "run" first (${STATE_KEY})`)
  return JSON.parse(fs.readFileSync(STATE_KEY, 'utf8'))
}

function collectEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of NEEDED) {
    const v = process.env[k]
    if (!v) { if (k === 'CLOUDFLARE_R2_BUCKET_NAME') continue; throw new Error(`${k} not in env — cannot configure the build box`) }
    out[k] = v
  }
  return out
}

function resolveBuildCmd(argvCmd: string | undefined): string {
  const cmd = (argvCmd ?? process.env.VULTR_BUILD_CMD ?? '').trim()
  if (!cmd) throw new Error('no build command — pass it as the next arg or set VULTR_BUILD_CMD')
  return cmd
}

// Same shape as hetzner-build-run.ts's cloud-init: creds in a quoted heredoc, build
// command in its own file, retry-wrapped (checkpoint-resumable → any nonzero exit is
// safe to retry), stdout tailed to R2 via the existing hetzner-logtail.ts.
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

cat > /root/scrutinise.env <<'ENVEOF'
${envBlock}
ENVEOF
set -a; . /root/scrutinise.env; set +a

cat > /root/build.sh <<'CMDEOF'
${buildCmd}
CMDEOF
chmod +x /root/build.sh

LOG=/var/log/scrutinise-build.log
touch "$LOG"
nohup npx tsx search/hetzner-logtail.ts "$LOG" "${LOG_TAIL_KEY}" 30 >/var/log/logtail.log 2>&1 &
LOGTAIL_PID=$!

echo "[hetzner-build] starting: ${buildCmd}" | tee -a "$LOG"
RETRY_MAX=\${HETZNER_BUILD_RETRY_MAX:-20}
RETRY_SLEEP=\${HETZNER_BUILD_RETRY_SLEEP:-30}
CODE=1
for ATTEMPT in \$(seq 1 \$RETRY_MAX); do
  echo "[hetzner-build] attempt \$ATTEMPT/\$RETRY_MAX" | tee -a "$LOG"
  bash /root/build.sh 2>&1 | tee -a "$LOG"
  CODE=\${PIPESTATUS[0]}
  if [ \$CODE -eq 0 ]; then break; fi
  echo "[hetzner-build] attempt \$ATTEMPT failed code=\$CODE — checkpoint is R2-resumable, retrying in \${RETRY_SLEEP}s" | tee -a "$LOG"
  sleep \$RETRY_SLEEP
done
echo "[hetzner-build] build exited code=\$CODE (attempt \$ATTEMPT/\$RETRY_MAX)" | tee -a "$LOG"

npx tsx search/hetzner-logtail.ts "$LOG" "${LOG_TAIL_KEY}" 1 & FLUSH=$!; sleep 3; kill $FLUSH 2>/dev/null || true
kill $LOGTAIL_PID 2>/dev/null || true
echo "[hetzner-build] DONE (exit \$CODE) — box idle; teardown via API from the runner" | tee -a "$LOG"
`
}

async function setup(argvCmd?: string) {
  console.log('preflight (INERT — no instance will be created):')
  const env = collectEnv()
  console.log(`  creds present: ${Object.keys(env).join(', ')}`)
  const buildCmd = (argvCmd ?? process.env.VULTR_BUILD_CMD ?? '').trim()
  console.log(buildCmd ? `  build cmd: ${buildCmd}` : '  build cmd: (none yet)')

  const plans = await vq<{ plans: Array<{ id: string; locations: string[] }> }>('GET', '/plans?per_page=500')
  const plan = plans.plans.find(p => p.id === PLAN)
  if (!plan) throw new Error(`plan "${PLAN}" not found`)
  if (!plan.locations.includes(REGION)) throw new Error(`plan "${PLAN}" not offered in region "${REGION}" (offered: ${plan.locations.join(',')})`)
  console.log(`  ✓ plan ${PLAN} verified available in ${REGION}`)

  const ci = renderCloudInit(env, buildCmd || 'echo "NO BUILD CMD — supply at run time"')
  const b64 = Buffer.from(ci).toString('base64')
  const out = path.join(__dirname, '.vultr-cloud-init.preview.sh')
  fs.writeFileSync(out, ci, 'utf8')
  console.log(`  cloud-init rendered -> ${out} (${ci.length} bytes plain, ${b64.length} b64; <32KB limit ${b64.length < 32768 ? 'ok' : 'EXCEEDED'})`)
  console.log('\nINERT. To spend (Charlie-triggered):')
  console.log(`  npx tsx search/vultr-build-run.ts run "${buildCmd || '<build cmd>'}"`)
}

async function run(argvCmd?: string) {
  if (fs.existsSync(STATE_KEY)) throw new Error(`an instance is already recorded (${STATE_KEY}). teardown first, or delete the file if stale.`)
  const env = collectEnv()
  const buildCmd = resolveBuildCmd(argvCmd)
  const ci = renderCloudInit(env, buildCmd)
  const userData = Buffer.from(ci).toString('base64')
  if (userData.length >= 32768) throw new Error(`cloud-init b64 ${userData.length} bytes exceeds Vultr's 32KB user_data limit`)

  console.log(`creating ${PLAN} in ${REGION} (Ubuntu 24.04) — build: ${buildCmd}`)
  const created = await vq<{ instance: { id: string } }>('POST', '/instances', {
    region: REGION, plan: PLAN, os_id: OS_ID, label: LABEL, hostname: LABEL,
    user_data: userData, backups: 'disabled', tags: ['scrutinise', 'build'],
  })
  const id = created.instance.id
  saveState({ id, createdAt: new Date().toISOString() })
  console.log(`  instance id=${id} (saved -> ${STATE_KEY})`)
  console.log('\nprovisioning (~2-4 min boot + apt/node/npm install) then the build starts. Monitor:')
  console.log('  • stdout tail:      npx tsx search/vultr-build-run.ts logs')
  console.log('  • teardown when done: npx tsx search/vultr-build-run.ts teardown')
}

async function instanceStatus(id: string): Promise<string> {
  try {
    const r = await vq<{ instance: { status: string; power_status: string; server_status: string; main_ip: string } }>('GET', `/instances/${id}`)
    return `${r.instance.status}/${r.instance.power_status}/${r.instance.server_status} ip=${r.instance.main_ip}`
  } catch { return '?' }
}

async function logs() {
  const { id } = loadState()
  const { r2Get } = await import('../shared/r2-client')
  console.log(`tailing ${LOG_TAIL_KEY} (Ctrl-C to detach; the build keeps running)…`)
  let lastLen = 0
  for (let i = 0; i < 240; i++) {
    const status = await instanceStatus(id)
    const body = await r2Get(LOG_TAIL_KEY)
    if (body && body.length !== lastLen) {
      const fresh = lastLen && body.length > lastLen ? body.slice(lastLen) : body
      process.stdout.write(fresh.endsWith('\n') ? fresh : fresh + '\n')
      lastLen = body.length
      if (body.includes('[hetzner-build] DONE')) { console.log(`\n>>> build reported completion (status=${status}). Run teardown.`); return }
    } else {
      console.log(`  [${new Date().toISOString().slice(11, 19)}Z] instance=${status} (no new output)`)
    }
    await sleep(15_000)
  }
  console.log('logs window elapsed — re-attach with: vultr-build-run.ts logs')
}

async function teardown() {
  const { id } = loadState()
  console.log(`deleting instance ${id}`)
  await vq('DELETE', `/instances/${id}`)
  fs.unlinkSync(STATE_KEY)
  console.log('deleted. compute freed.')
}

const mode = process.argv[2]
const arg = process.argv[3]
const fn = mode === 'setup' ? () => setup(arg)
  : mode === 'run' ? () => run(arg)
  : mode === 'logs' ? logs
  : mode === 'teardown' ? teardown
  : null
if (!fn) { console.error('usage: vultr-build-run.ts setup ["<cmd>"] | run "<cmd>" | logs | teardown'); process.exit(1) }
fn().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
