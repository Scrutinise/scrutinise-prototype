// ─────────────────────────────────────────────────────────────────────────────
// Run a command with the legacy DB and R2 credentials in its environment.
//
// ⚠ THE SECRETS NEVER REACH A TERMINAL. They are read from the Railway service's own
// variables and passed straight into the child process's environment — not printed, not
// written to a file, not interpolated into a shell string where they would land in history.
//
//   tsx ops/with-legacy-env.ts tsx ops/dump-legacy-db.ts --verify
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process'
import { rail } from './audit-sleep'
import { SERVICES, ENV_ID } from './sleep-state'

const WANTED = [
  'DATABASE_PUBLIC_URL',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
]

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length) { console.error('usage: with-legacy-env.ts <command> [args…]'); process.exitCode = 1; return }

  const v = await rail<{ variables: Record<string, string> }>(`
    query V($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }
  `, {
    projectId: '68707c61-5c68-4f37-88fc-c301fd6b90e7',
    environmentId: ENV_ID,
    serviceId: SERVICES['scrutinise-db'],
  })

  const env: Record<string, string> = { ...process.env as Record<string, string> }
  const missing: string[] = []
  for (const k of WANTED) {
    const val = v.variables?.[k]
    if (!val) { missing.push(k); continue }
    env[k] = val
  }
  // The dump reads the DB under its own name, so the mapping is explicit rather than
  // relying on two variables happening to share a spelling.
  if (v.variables?.DATABASE_PUBLIC_URL) env.LEGACY_DATABASE_URL = v.variables.DATABASE_PUBLIC_URL
  if (missing.length) console.error(`⚠ not found on the service: ${missing.join(', ')}`)
  console.error(`(passing ${WANTED.length - missing.length} credentials into the child; none printed)`)

  const child = spawn(argv[0], argv.slice(1), { stdio: 'inherit', env, shell: true })
  child.on('exit', (code) => { process.exitCode = code ?? 1 })
}

main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
