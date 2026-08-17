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

  // ── 5. the S6 §3 ADDENDUM — the metering is visible, and it still controls nothing ──────────
  console.log('\n  the spend addendum (S6 §3 addendum)')

  const sql = fs.readFileSync(path.join(root, 'prisma/llm_spend.sql'), 'utf8')
  check(/ADD COLUMN IF NOT EXISTS "groupId"/.test(sql),
    '⚠ the group column exists in the DDL — added before there is history to regret')
  const webLedger = fs.readFileSync(path.join(root, 'lib/lex/spend-ledger.ts'), 'utf8')
  const ingestLedger = fs.readFileSync(path.join(root, '../scripts/ingest/shared/spend-ledger.ts'), 'utf8')
  check(/"groupId"/.test(webLedger) && /"groupId"/.test(ingestLedger),
    '⚠ BOTH writers record it — a column only one writer fills is worse than none')

  // ⚠⚠ THE INSTRUCTION MOST LIKELY TO BE QUIETLY UNDONE. Charlie: "build the measurement, do not
  // switch on any user-facing spend control. Until it's the user's own money, the only thing being
  // measured is what this costs him." A ceiling wired into a route later, by somebody who
  // reasonably believes the feature is finished, is exactly what this asserts against.
  const ceilingCallers: string[] = []
  const walkFor = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walkFor(rel)
      else if (/\.(ts|tsx)$/.test(e.name) && !rel.endsWith('lib/lex/spend-ledger.ts')) {
        // ⚠ COMMENTS ARE STRIPPED FIRST, and the first version did not strip them: it reported
        // lib/lex/spend-admin.ts as a caller because that file's header EXPLAINS that the ceiling
        // is deliberately unwired. A guard that fires on the sentence describing the rule is a
        // guard somebody switches off. (Watching it fire on that comment was also the proof it is
        // not inert — the check does fire.)
        const src = fs.readFileSync(path.join(root, rel), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        if (/checkUserCeiling\s*\(/.test(src)) ceilingCallers.push(rel)
      }
    }
  }
  walkFor('lib'); walkFor('app'); walkFor('components')
  check(ceilingCallers.length === 0,
    '⚠⚠ NO user-facing spend control is switched on — checkUserCeiling is called by nothing',
    ceilingCallers.join(', '))

  const section = fs.readFileSync(path.join(root, 'components/admin/SpendSection.tsx'), 'utf8')
  check(!/method:\s*'(POST|PATCH|DELETE|PUT)'/i.test(section),
    '   …and the admin spend page has no mutating action of any kind')
  check(/LlmSpendKind/.test(sql) && /'unclassified'/.test(sql),
    '⚠ the search / everything-else split has a THIRD bucket, so an unclassified pass stays visible')
  // A negative control that is RUN rather than asserted: the rule must really route an
  // unrecognised pass to `unclassified` instead of quietly inflating "everything else".
  const classify = (p: string) => /^search\./.test(p) ? 'search'
    : /^(lex|build|deepening|orientation|graph)\./.test(p) ? 'everything-else' : 'unclassified'
  check(classify('search.query-router') === 'search' && classify('build.draft') === 'everything-else'
    && classify('rerank.score') === 'unclassified',
    '   …and an unrecognised pass really does land in it (negative control)')

  // ⚠⚠ THE LEDGER WAS INERT AFTER S6, AND THIS IS THE CHECK THAT WOULD HAVE SAID SO.
  // S6 built recordSpend() and wired it into nothing on the web side: the table held rows from
  // two ingest scripts and from no user-facing path at all. An Admin spend page on top of that
  // would have shown a platform that costs almost nothing — the most flattering possible bug,
  // and one nobody would think to question. Every file that reads Gemini's own usage numbers
  // must also record them, or be named here with a reason.
  const UNMETERED_BY_DESIGN: Record<string, string> = {}
  const unmetered: string[] = []
  const walkUsage = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) { walkUsage(rel); continue }
      if (!/\.ts$/.test(e.name)) continue
      const src = fs.readFileSync(path.join(root, rel), 'utf8')
      // ⚠ WIDENED FROM usageMetadata TO 'calls Gemini at all'. The first version only caught files
      // that READ the usage numbers — a file that calls the API and ignores them entirely was
      // invisible to it, which is the worse case: it spends and reports nothing.
      if (!/generativelanguage\.googleapis\.com/.test(src)) continue
      if (/recordGeminiUsage|recordSpend|recordUsage/.test(src)) continue
      if (rel in UNMETERED_BY_DESIGN) continue
      unmetered.push(rel)
    }
  }
  walkUsage('lib')
  check(unmetered.length === 0,
    '⚠⚠ every file that CALLS Gemini also records the spend — the ledger is not inert',
    unmetered.join(', '))

  console.log('\n  snapshot')
  for (const s of registrySnapshot()) {
    console.log(`    ${s.pass.padEnd(26)} ${s.model.padEnd(22)} ${s.provider.padEnd(10)}${s.overridden ? ' (overridden)' : ''}`)
  }

  console.log(`\n════ ${fail ? `${fail} FAILED` : `all ${pass} checks pass`} ════`)
  if (fail) process.exit(1)
}
main()
