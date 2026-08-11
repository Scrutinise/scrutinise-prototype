/**
 * run.ts — the Heavy Job Runner. Provision → run → verify → DESTROY → report cost.
 *
 * WHY THIS EXISTS
 * ---------------
 * The FTS index rebuild failed three times in three ways (June OOM-loop, 2 Aug
 * optimize() OOM + eight-cycle restart loop, 3 Aug SIGKILL against Railway Hobby's
 * measured 8 GB per-replica cap). Every one was the same gap: no standard home for
 * memory-bound jobs. Railway's "48 GB per service" is an aggregate across replicas —
 * a single-process job only ever gets the per-replica limit — so Hobby cannot run this
 * job at any setting, and Pro's 24 GB is a ceiling the growing corpus would hit anyway.
 *
 * BUILT ON WHAT ALREADY WORKED. `search/hetzner-build-run.ts` already provisions the
 * exact CCX43 this needs, with a proven cloud-init (repo clone, npm install, env
 * injection, R2 log tailing, crash-retry). This does NOT replace it. It adds the three
 * things it lacked, which are the three things that made it a scramble each time:
 *
 *   1. NAMED JOBS      — jobs.ts, so a new heavy job is an entry not a script.
 *   2. DESTROY BY DEFAULT — teardown was a separate manual command, which is precisely
 *      how a 64 GB box was once left idle and billing for four days. Here the server is
 *      destroyed in a `finally`: on success, on failure, on a thrown error. `--keep`
 *      opts out, deliberately loudly.
 *   3. COST REPORTED   — size, minutes alive, and the charge, priced from the live
 *      Hetzner API rather than a hardcoded guess that silently goes stale.
 *
 * // Teardown is the default because a forgotten 64 GB box is the only way this becomes expensive.
 *
 * ORPHAN SAFETY. If this process dies mid-run (a killed terminal, a dropped laptop) the
 * server survives, because only this process can delete it — the Hetzner token is
 * deliberately never placed on the box. `reap` exists for exactly that: it lists and
 * destroys any runner-created server, and should be run if a session ever ends oddly.
 *
 * Usage (from scripts/ingest so the tsx + deps resolve):
 *   tsx ../ops/heavy-job/run.ts list
 *   tsx ../ops/heavy-job/run.ts plan  fts-index          # INERT: validate, create nothing
 *   tsx ../ops/heavy-job/run.ts run   fts-index [--keep]  # SPEND: create, run, destroy
 *   tsx ../ops/heavy-job/run.ts reap                      # destroy any orphaned box
 */
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getJob, JOBS, type HeavyJob } from './jobs'

const HETZNER_API = 'https://api.hetzner.cloud/v1'
const REPO_URL = 'https://github.com/Scrutinise/scrutinise-prototype.git'
const BRANCH = process.env.HEAVY_JOB_BRANCH ?? 'Main'
const IMAGE = process.env.HETZNER_IMAGE ?? 'ubuntu-24.04'
/** Every server this runner creates is named so `reap` can find it unambiguously. */
const NAME_PREFIX = 'scrutinise-heavy'

// Credentials the job needs ON the box. The Hetzner token is NOT among them — the job
// never calls Hetzner, and a box that cannot delete itself cannot delete anything else.
const NEEDED = [
  'NEON_DATABASE_URL',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
]

const log = (m: string) => console.log(`[heavy-job] ${m}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function token(): string {
  const t = process.env.HETZNER_API_TOKEN
  if (!t) throw new Error('HETZNER_API_TOKEN not set (scrutinise-web/.env or the shell)')
  return t
}

async function hz<T>(method: string, pathname: string, body?: unknown): Promise<T> {
  const res = await fetch(`${HETZNER_API}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Hetzner ${method} ${pathname} → ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : {}) as T
}

function collectEnv(job?: HeavyJob): Record<string, string> {
  const out: Record<string, string> = {}
  // A job's own extras are required just as strictly as the standard set: a box that boots without
  // the one credential its job needs fails on the first call, minutes and euros in.
  for (const k of [...NEEDED, ...(job?.extraEnv ?? [])]) {
    const v = process.env[k]
    if (!v) {
      if (k === 'CLOUDFLARE_R2_BUCKET_NAME') continue // r2-client defaults
      throw new Error(`${k} missing from scrutinise-web/.env — the box would boot unable to work`)
    }
    out[k] = v
  }
  return out
}

// ── pricing, read live rather than hardcoded ─────────────────────────────────
interface ServerType { name: string; cores: number; memory: number; cpu_type?: string; prices: Array<{ location: string; price_hourly: { gross: string }; price_monthly: { gross: string } }> }

async function serverTypeInfo(name: string): Promise<ServerType> {
  const { server_types } = await hz<{ server_types: ServerType[] }>('GET', '/server_types?per_page=100')
  const found = server_types.find((s) => s.name === name)
  if (!found) throw new Error(`server_type "${name}" not offered — got: ${server_types.map((s) => s.name).join(', ')}`)
  return found
}

/**
 * Two Hetzner refusals mean "try a different box", not "stop":
 *   resource_limit_exceeded — the ACCOUNT may not have this size (dedicated-core quota)
 *   resource_unavailable / "error during placement" — the REGION is out of stock
 * Anything else (bad image, auth, malformed user_data) is a real error and must surface.
 */
function isSizeOrPlacementRefusal(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e)
  return /resource_limit_exceeded|limit exceeded|resource_unavailable|error during placement/i.test(m)
}

/** Preferred regions, in order. Anything outside this list is ignored (data locality). */
const LOCATIONS = (process.env.HETZNER_LOCATIONS ?? 'fsn1,nbg1,hel1').split(',').map((l) => l.trim())

/**
 * Which (server type, datacenter) pairs the account can ACTUALLY create right now.
 *
 * Asking rather than guessing, because guessing cost three failed attempts on 4 Aug:
 * cx53 was out of stock in every EU region, and cpx51 is not offered in fsn1 at all.
 * Hetzner publishes both facts — /datacenters lists `server_types.available` per
 * datacenter — so the runner reads them instead of probing combinations.
 */
async function availablePlacements(): Promise<Map<string, string[]>> {
  const [{ server_types }, { datacenters }] = await Promise.all([
    hz<{ server_types: Array<ServerType & { id: number; architecture?: string }> }>('GET', '/server_types?per_page=100'),
    hz<{ datacenters: Array<{ name: string; location: { name: string }; server_types: { available: number[] } }> }>('GET', '/datacenters?per_page=50'),
  ])
  const byId = new Map(server_types.map((t) => [t.id, t]))
  const out = new Map<string, string[]>()
  for (const dc of datacenters) {
    if (!LOCATIONS.includes(dc.location.name)) continue
    for (const id of dc.server_types.available) {
      const t = byId.get(id)
      if (!t || t.architecture === 'arm') continue // Lance native bindings are untested on ARM
      if (!out.has(t.name)) out.set(t.name, [])
      // The API's `datacenter` field was deprecated 2025-12-16 and is now rejected, so
      // collapse datacenters to their LOCATION, which is what create still accepts.
      const locs = out.get(t.name)!
      if (!locs.includes(dc.location.name)) locs.push(dc.location.name)
    }
  }
  return out
}

function typesFor(job: HeavyJob): string[] {
  return job.serverTypes?.length ? job.serverTypes : ['cx53', 'cpx51', 'ccx43']
}

function hourlyGross(st: ServerType, location?: string): number {
  const p = st.prices.find((x) => x.location === (location ?? LOCATIONS[0])) ?? st.prices[0]
  return parseFloat(p.price_hourly.gross)
}

// ── cloud-init ───────────────────────────────────────────────────────────────
// Mirrors the proven template in search/hetzner-build-run.ts. Two differences: the
// command comes from the job registry, and the box writes a terminal marker line so the
// orchestrator can tell "finished" from "still going" without guessing.
function renderCloudInit(env: Record<string, string>, job: HeavyJob, logKey: string): string {
  const envBlock = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n')
  const script = job.verify ? `${job.command}\nJOBCODE=$?\n${job.verify}\nexit $JOBCODE` : job.command
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

cat > /root/job.sh <<'CMDEOF'
${script}
CMDEOF
chmod +x /root/job.sh

LOG=/var/log/scrutinise-heavy.log
touch "$LOG"
nohup npx tsx search/hetzner-logtail.ts "$LOG" "${logKey}" 20 >/var/log/logtail.log 2>&1 &
LOGTAIL_PID=$!

echo "[heavy-job] starting ${job.name}" | tee -a "$LOG"
# Peak RSS of the job process tree, sampled every 5s — this is what fills in
# expectedPeakGb in jobs.ts, so the next size decision is evidence not guesswork.
( PEAK=0
  while true; do
    CUR=$(ps -eo rss= --sort=-rss | head -1 | tr -d ' ')
    [ -n "$CUR" ] && [ "$CUR" -gt "$PEAK" ] && PEAK=$CUR && echo "[heavy-job] peak-rss ${'$'}((PEAK/1024))MB" >> "$LOG"
    sleep 5
  done ) & PEAKPID=$!

bash /root/job.sh 2>&1 | tee -a "$LOG"
CODE=\${PIPESTATUS[0]}
kill $PEAKPID 2>/dev/null || true

echo "[heavy-job] EXIT_CODE=\$CODE" | tee -a "$LOG"
npx tsx search/hetzner-logtail.ts "$LOG" "${logKey}" 1 & FLUSH=$!; sleep 4; kill $FLUSH 2>/dev/null || true
kill $LOGTAIL_PID 2>/dev/null || true
echo "[heavy-job] TERMINAL" | tee -a "$LOG"
`
}

// ── R2 log reading (the box tails stdout to R2; Hetzner has no log API) ──────
async function readLog(logKey: string): Promise<string | null> {
  const { r2Get } = require(path.join(__dirname, '../../ingest/shared/r2-client')) as
    { r2Get: (k: string) => Promise<Buffer | null> }
  try {
    const buf = await r2Get(logKey)
    return buf ? buf.toString('utf8') : null
  } catch { return null }
}

// ── commands ─────────────────────────────────────────────────────────────────
function list() {
  for (const j of Object.values(JOBS)) {
    console.log(`${j.name.padEnd(18)} ${(j.serverTypes?.[0]) ?? 'ccx43'}  peak=${j.expectedPeakGb ?? '?'}GB  ${j.description.split('.')[0]}`)
  }
}

/** INERT — validates everything and renders the cloud-init. Creates nothing, spends nothing. */
async function plan(jobName: string) {
  const job = getJob(jobName)
  const env = collectEnv(job)
  const candidates = typesFor(job)
  const st = await serverTypeInfo(candidates[0])
  const hourly = hourlyGross(st)
  log(`job:      ${job.name} — ${job.description}`)
  log(`sizes:    ${candidates.join(' → ')} (first the account allows wins)`)
  log(`command:  ${job.command}`)
  if (job.verify) log(`verify:   ${job.verify}`)
  log(`server:   ${st.name} (${st.cores} vCPU / ${st.memory} GB), regions ${LOCATIONS.join(' → ')}, image ${IMAGE}`)
  log(`price:    €${hourly.toFixed(4)}/hour gross — a 30-minute run costs about €${(hourly / 2).toFixed(2)}`)
  log(`env:      ${Object.keys(env).join(', ')} (Hetzner token deliberately NOT injected)`)
  // Rendered with the secret VALUES redacted: the point of the artefact is to inspect
  // the shell, and a file full of live credentials sitting in the repo tree is exactly
  // the accident that gitignore is a last line of defence against, not a first.
  const redacted = Object.fromEntries(Object.keys(env).map((k) => [k, `<${k}>`]))
  const out = path.join(__dirname, `.cloud-init-${job.name}.rendered.sh`)
  fs.writeFileSync(out, renderCloudInit(redacted, job, `_ops/heavy-job/${job.name}-plan.log`))
  log(`cloud-init rendered (secrets redacted) for inspection → ${out}`)
  log('PLAN ONLY — nothing created.')
}

async function run(jobName: string, keep: boolean) {
  const job = getJob(jobName)
  const env = collectEnv(job)
  const candidates = typesFor(job)
  const started = Date.now()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const serverName = `${NAME_PREFIX}-${job.name}-${stamp.slice(0, 16)}`
  const logKey = `_ops/heavy-job/${job.name}-${stamp}.log`

  // Walk the preference list: a size the account cannot have is a fallback, not a
  // failure. Anything else (bad image, bad region, auth) is real and stops here.
  let st: ServerType | null = null
  let created: { id: number; public_net: { ipv4: { ip: string } } } | null = null
  const placements = await availablePlacements()
  const attempts = candidates.flatMap((name) => (placements.get(name) ?? []).map((dc) => ({ name, dc })))
  if (!attempts.length) {
    throw new Error(
      `none of [${candidates.join(', ')}] is available in [${LOCATIONS.join(', ')}] right now. ` +
      `Available there: ${[...placements.keys()].join(', ') || '(nothing)'}`,
    )
  }
  log(`available placements: ${attempts.map((a) => `${a.name}@${a.dc}`).join(', ')}`)

  let usedLocation = ''
  for (const attempt of attempts) {
    const candidate = await serverTypeInfo(attempt.name)
    log(`creating ${candidate.name} (${candidate.cores} vCPU ${candidate.cpu_type ?? ''} / ${candidate.memory} GB) in ${attempt.dc}`)
    try {
      const res = await hz<{ server: { id: number; public_net: { ipv4: { ip: string } } } }>(
        'POST', '/servers',
        {
          name: serverName, server_type: candidate.name, image: IMAGE, location: attempt.dc,
          start_after_create: true, user_data: renderCloudInit(env, job, logKey),
          labels: { purpose: 'heavy-job', job: job.name },
        },
      )
      st = candidate
      created = res.server
      usedLocation = attempt.dc
      break
    } catch (e) {
      // Stock can change between the availability read and the create, so a refusal
      // here is still just "try the next one".
      if (!isSizeOrPlacementRefusal(e)) throw e
      log(`  ${candidate.name}@${attempt.dc} refused — trying the next placement`)
    }
  }
  if (!st || !created) throw new Error(`every available placement refused: ${attempts.map((a) => a.name + '@' + a.dc).join(', ')}`)
  const hourly = hourlyGross(st, usedLocation)
  const serverId = created.id
  log(`server ${serverId} (${created.public_net.ipv4.ip}) on ${st.name} in ${usedLocation} created — bootstrapping`)

  let exitCode: number | null = null
  let peakMb = 0
  try {
    const deadlineMs = parseInt(process.env.HEAVY_JOB_TIMEOUT_MIN ?? '120', 10) * 60_000
    let seen = 0
    while (Date.now() - started < deadlineMs) {
      await sleep(20_000)
      const text = await readLog(logKey)
      if (text) {
        const lines = text.split('\n')
        for (const l of lines.slice(seen)) if (l.trim()) console.log(`   ${l}`)
        seen = lines.length
        for (const m of text.matchAll(/peak-rss (\d+)MB/g)) peakMb = Math.max(peakMb, parseInt(m[1], 10))
        const code = text.match(/EXIT_CODE=(\d+)/)
        if (code) { exitCode = parseInt(code[1], 10); break }
      } else {
        log(`  … waiting for the box (${Math.round((Date.now() - started) / 1000)}s)`)
      }
    }
    if (exitCode === null) log(`!! no terminal marker within the timeout — treating as FAILED`)
  } finally {
    const minutes = (Date.now() - started) / 60_000
    const cost = (minutes / 60) * hourly
    if (keep) {
      log(`--keep: server ${serverId} LEFT RUNNING and still billing. Destroy it with: run.ts reap`)
    } else {
      try {
        await hz('DELETE', `/servers/${serverId}`)
        log(`server ${serverId} destroyed`)
      } catch (e) {
        log(`!! DESTROY FAILED for ${serverId}: ${(e as Error).message}`)
        log(`!! RUN "run.ts reap" NOW — the box is billing.`)
      }
    }
    log(`COST: ${st.name} × ${minutes.toFixed(1)} min @ €${hourly.toFixed(4)}/h = €${cost.toFixed(3)}`)
    if (peakMb) log(`PEAK RSS: ${(peakMb / 1024).toFixed(1)} GB — record this in jobs.ts expectedPeakGb`)
  }

  if (exitCode !== 0) {
    log(`job "${job.name}" FAILED (exit ${exitCode ?? 'unknown'})`)
    process.exitCode = 1
  } else {
    log(`job "${job.name}" succeeded`)
  }
}

/** Destroy any server this runner created — the net for an orchestrator that died. */
async function reap() {
  const { servers } = await hz<{ servers: Array<{ id: number; name: string; created: string; server_type: { name: string } }> }>(
    'GET', '/servers?per_page=50',
  )
  const mine = servers.filter((s) => s.name.startsWith(NAME_PREFIX))
  if (!mine.length) { log('no runner-created servers exist — nothing to reap'); return }
  for (const s of mine) {
    const ageMin = (Date.now() - new Date(s.created).getTime()) / 60_000
    log(`destroying ${s.id} ${s.name} (${s.server_type.name}, alive ${ageMin.toFixed(0)} min)`)
    await hz('DELETE', `/servers/${s.id}`)
  }
  log(`reaped ${mine.length} server(s)`)
}

const [mode, arg] = process.argv.slice(2)
const keep = process.argv.includes('--keep')
const fn =
  mode === 'list' ? async () => list()
    : mode === 'plan' ? () => plan(arg)
      : mode === 'run' ? () => run(arg, keep)
        : mode === 'reap' ? reap
          : null
if (!fn) {
  console.error('usage: run.ts list | plan <job> | run <job> [--keep] | reap')
  process.exit(1)
}
fn().catch((e) => { console.error('[heavy-job] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
