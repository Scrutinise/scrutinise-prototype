// check:spend-keys — the provider ADMIN keys are held only where the reconciliation job runs.
//
// The web app (app/, lib/, components/) must never name them: a key the web code can read is a key that is
// in the Vercel environment, and an admin key can read the whole organisation's billing. Only
// scripts/reconcile-spend.ts may reference them. ⚠ WHAT THIS CANNOT SEE: the Vercel environment itself is
// SAML-blocked from this machine (docs/CLAUDE.md §19) — Charlie must confirm there is no OPENAI_ADMIN_KEY /
// ANTHROPIC_ADMIN_KEY in Vercel. This check proves only that no web code would read them if it were.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const KEYS = ['OPENAI_ADMIN_KEY', 'ANTHROPIC_ADMIN_KEY', 'XAI_MANAGEMENT_KEY']
const WEB = ['app', 'lib', 'components']

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.next') continue
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(f)) out.push(p.split(sep).join('/'))
  }
  return out
}

let fails = 0
let checked = 0
for (const root of WEB) {
  for (const file of walk(root)) {
    checked++
    const src = readFileSync(file, 'utf8')
    for (const k of KEYS) {
      if (src.includes(k)) { console.log(`✗ ${file} names ${k} — the web app must never read an admin key`); fails++ }
    }
  }
}
const recon = readFileSync('scripts/reconcile-spend.ts', 'utf8')
const guard = recon.includes('process.env.VERCEL')
console.log(guard ? '✓ the reconciliation job refuses to run on Vercel' : '✗ the reconciliation job has no Vercel guard')
if (!guard) fails++
// Control: the scan must be able to see a key name at all, or "0 hits" proves nothing.
const control = recon.includes('OPENAI_ADMIN_KEY')
console.log(control ? '✓ control fired — the key names are found where they are allowed' : '✗ control did not fire — the key names moved; this check is now blind')
if (!control) fails++
console.log(`${checked} web files scanned, ${fails} failures`)
process.exit(fails ? 1 : 0)
