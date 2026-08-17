/**
 * check-model-registry.ts — BRIEF_SEARCH_S6 §2's guard.
 *
 * Three things it asserts, and the third is the one that matters most:
 *   1. every pass resolves, and no registry DEFAULT names a model absent from the verified list
 *   2. an override naming an unknown or unreachable model is REFUSED at resolve time
 *   3. ⚠ the registry is ADOPTED — passes that were wired to it are still wired to it
 *
 * (3) exists because a registry nothing calls is the "built inert" failure again: the file is
 * present, the check for its existence passes, and every caller keeps its own hardcoded default.
 * This session has already shipped one inert repair (the entity decoder that decoded into a
 * variable and returned the old one), so the adoption assertion is not hypothetical.
 *
 * ⚠ Every assertion here was watched failing first.
 *
 * Usage (from scrutinise-web):  npx tsx scripts/check-model-registry.ts
 */
import fs from 'fs'
import path from 'path'
import {
  PASS_DEFAULTS, REACHABLE, KNOWN_STALE, resolveModel, providerFor, envVarFor, registrySnapshot,
  type PassName,
} from '../lib/lex/model-registry'

export {}

let pass = 0
let fail = 0
const check = (ok: boolean, name: string, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

/** Passes that MUST resolve through the registry in a real caller. Lower this only by wiring more. */
const ADOPTED: Array<{ pass: PassName; file: string }> = [
  { pass: 'deepening.adversarial', file: 'lib/lex/deepening-adversarial.ts' },
  { pass: 'deepening.gather', file: 'lib/lex/deepening-client.ts' },
  { pass: 'deepening.sift', file: 'lib/lex/deepening-sift.ts' },
  { pass: 'lex.general-chat', file: 'lib/lex/general-chat.ts' },
]

function main() {
  console.log('\n════ check:model-registry ════')

  // ── 1. the registry is internally sound ─────────────────────────────────────────────────────
  const all = Object.keys(PASS_DEFAULTS) as PassName[]
  console.log(`  ${all.length} passes registered`)
  let unresolvable = 0
  let staleDefault = 0
  for (const p of all) {
    try {
      const c = resolveModel(p)
      const reachable = (Object.values(REACHABLE) as string[][]).some((l) => l.includes(c.model))
      if (!reachable) { staleDefault++; console.log(`      ⚠ ${p} defaults to ${c.model}, which is not in the verified list`) }
    } catch (e) { unresolvable++; console.log(`      ✗ ${p}: ${(e as Error).message}`) }
  }
  check(unresolvable === 0, 'every registered pass resolves', `${unresolvable} do not`)
  check(staleDefault === 0, 'no default names a model outside the verified reachable list', `${staleDefault} do`)

  // ── 2. the refusals — each must FIRE ────────────────────────────────────────────────────────
  console.log('\n  negative controls — an override that should be refused')
  const target = 'deepening.adversarial' as PassName
  const key = envVarFor(target)
  const restore = process.env[key]
  const refuses = (value: string, why: string) => {
    process.env[key] = value
    let threw = false
    try { resolveModel(target) } catch { threw = true }
    check(threw, why, threw ? 'refused' : `ACCEPTED "${value}" — the guard is not working`)
  }
  refuses('gemini-9.9-imaginary', 'an unknown Google model is refused')
  refuses('claude-haiku-4-5-20251001', 'a KNOWN STALE id is refused')
  refuses('not-a-model-at-all', 'a string with no known provider is refused')
  refuses('gpt-5', 'an OpenAI model is refused — no key on this deployment')
  // And the positive control: a real, reachable model is ACCEPTED.
  process.env[key] = 'claude-opus-5'
  let accepted = false
  try { accepted = resolveModel(target).model === 'claude-opus-5' } catch { accepted = false }
  check(accepted, 'a reachable model IS accepted (the guard is not simply refusing everything)')
  if (restore === undefined) delete process.env[key]; else process.env[key] = restore

  check(providerFor('claude-opus-5') === 'anthropic', 'providerFor routes a Claude id to anthropic')
  check(providerFor('grok-4.3') === 'xai', 'providerFor routes a Grok id to xai')
  check(providerFor('nonsense') === null, 'providerFor returns null rather than guessing')

  // ── 3. adoption — the registry is actually called ───────────────────────────────────────────
  console.log('\n  adoption — a registry nothing calls is the "built inert" failure')
  const root = path.join(__dirname, '..')
  for (const a of ADOPTED) {
    const src = fs.readFileSync(path.join(root, a.file), 'utf8')
    const imports = /from '\.\/model-registry'/.test(src)
    const calls = new RegExp(`modelFor\\(\\s*'${a.pass.replace('.', '\\.')}'\\s*\\)`).test(src)
    check(imports && calls, `${a.file} resolves ${a.pass} through the registry`,
      imports ? (calls ? '' : 'imports it but never calls it for this pass') : 'does not import it')
  }
  const hardcoded = ADOPTED.filter((a) => /\?\?\s*'gemini-2\.5-flash'/.test(fs.readFileSync(path.join(root, a.file), 'utf8')))
  check(hardcoded.length === 0, 'no adopted file still falls back to a hardcoded model string',
    hardcoded.map((h) => h.file).join(', '))

  // ── 4. the stale ids stay flagged ───────────────────────────────────────────────────────────
  console.log('\n  the two known-stale production fallbacks')
  for (const s of KNOWN_STALE) {
    const reachable = (Object.values(REACHABLE) as string[][]).some((l) => l.includes(s.model))
    check(!reachable, `${s.model} is still absent from the reachable list`,
      reachable ? 'it is now reachable — remove it from KNOWN_STALE and fix the caller' : s.where)
  }

  console.log('\n  snapshot')
  for (const s of registrySnapshot()) {
    console.log(`    ${s.pass.padEnd(26)} ${s.model.padEnd(22)} ${s.provider.padEnd(10)}${s.overridden ? ' (overridden)' : ''}`)
  }

  console.log(`\n════ ${fail ? `${fail} FAILED` : `all ${pass} checks pass`} ════`)
  if (fail) process.exit(1)
}
main()
