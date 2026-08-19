// ─────────────────────────────────────────────────────────────────────────────
// check-s8-config-hygiene.ts — BRIEF_SEARCH_S8 §7.
//
// Three items, each cheap now and expensive rediscovered:
//   1. Anthropic and xAI prices are unrecorded, so any pass on those models reports "unpriced"
//      and the cost ceiling cannot bind.  → no configured model may resolve to "unpriced".
//   2. Two configured fallback models do not exist in the accounts — a fallback that fails only
//      when the primary already has.       → identify them; replace with models VERIFIED PRESENT
//                                             by a live 1-token call, or remove the fallback.
//   3. OpenAI has no API key on the machine. → record whether anything is configured to want it.
//
// ⚠ Item 2's verification needs the network and a key. `--probe` runs the live 1-token calls and
// logs each result; without it the check runs offline and says so rather than pretending the
// models were verified. A check that claims a live verification it did not perform is worse than
// one that admits it ran offline.
//
//   npm run check:s8-config          # offline: pricing + the OpenAI question
//   npm run check:s8-config -- --probe   # …plus live 1-token calls against each account
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { rates } from '../lib/lex/build-cost'
import { PASS_DEFAULTS, REACHABLE, KNOWN_STALE, providerFor, type PassName } from '../lib/lex/model-registry'

const PROBE = process.argv.includes('--probe')
let pass = 0
let fail = 0
function check(ok: boolean, name: string, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? `  — ${detail}` : ''}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? `  — ${detail}` : ''}`) }
}
const note = (s: string) => console.log(`        ${s}`)

// ── item 1: no configured model resolves to "unpriced" ───────────────────────────────────────

function itemOne() {
  console.log('\n§7.1 — every configured model has a price on file\n')
  const table = rates()

  // ⚠ THE SET THAT MATTERS IS "COULD BE CONFIGURED", not "is configured today". A pass pointed at
  // Claude by one env var is one deploy away, and the failure mode — `pence: null`, ceiling stops
  // binding — only shows up on the run that uses it.
  const configured = new Set<string>(Object.values(PASS_DEFAULTS))
  const reachable = new Set<string>(Object.values(REACHABLE).flat())
  const stale = new Set(KNOWN_STALE.map((s) => s.model))

  const unpricedDefaults = [...configured].filter((m) => !table[m])
  check(unpricedDefaults.length === 0, 'no PASS_DEFAULTS model resolves to "unpriced"',
    unpricedDefaults.join(', ') || `${configured.size} distinct models, all priced`)

  const unpricedReachable = [...reachable].filter((m) => !table[m])
  check(unpricedReachable.length === 0,
    'no model an env var could legally select resolves to "unpriced" either',
    unpricedReachable.join(', ') || `${reachable.size} reachable models, all priced`)

  // The two stale ids are priced too — a fallback that fires and then cannot be costed is the
  // same defect one level down.
  const unpricedStale = [...stale].filter((m) => !table[m])
  check(unpricedStale.length === 0, '   …and so do the KNOWN_STALE fallback ids',
    unpricedStale.join(', ') || [...stale].join(', '))

  // Provenance: a price with no source and no date cannot be refreshed or audited.
  const src = readFileSync(join(__dirname, '..', 'lib', 'lex', 'build-cost.ts'), 'utf8')
  check(/Source: https:\/\/platform\.claude\.com/.test(src) && /Checked 2026-08-19/.test(src),
    'the Anthropic rates carry a source URL and a date-checked')
  check(/Source: https:\/\/docs\.x\.ai/.test(src) && /Checked 2026-08-19/.test(src),
    'the xAI rates carry a source URL and a date-checked')
  check(/PROMPT LENGTH/i.test(src),
    '⚠ …and the xAI prompt-length tiering is DECLARED, with the error direction named',
    'one rate per model against a two-band price understates long prompts by up to 2×')
  check(/introductory rate/i.test(src) && /'claude-sonnet-5': \{ inPerM: 3\.00/.test(src),
    '⚠ Sonnet 5 records the LIST price, not the promotion that expires on 2026-08-31')

  for (const [p, model] of Object.entries(PASS_DEFAULTS) as Array<[PassName, string]>) {
    const r = table[model]
    if (!r) note(`⚠ ${p} → ${model}: UNPRICED`)
  }
  note(`priced models on file: ${Object.keys(table).length}`)
}

// ── item 2: the two fallbacks that name models the accounts do not list ──────────────────────

interface ProbeResult {
  model: string; provider: string; status: number; ok: boolean; detail: string
  /** ⚠ The model the RESPONSE says it used. The whole point of §7.2: a 200 is not proof you got
   *  the model you asked for — xAI silently served grok-4.3 for the retired `grok-3-fast-beta`
   *  on every call, for months, with no error anywhere. */
  served: string | null
}
const servedFrom = (body: string): string | null => body.match(/"model"\s*:\s*"([^"]+)"/)?.[1] ?? null

async function oneToken(model: string): Promise<ProbeResult> {
  const provider = providerFor(model) ?? 'unknown'
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30_000)
  try {
    if (provider === 'anthropic') {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) return { model, provider, status: 0, ok: false, detail: 'ANTHROPIC_API_KEY not set', served: null }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      })
      const body = (await res.text()).slice(0, 400)
      return { model, provider, status: res.status, ok: res.ok, detail: body, served: servedFrom(body) }
    }
    if (provider === 'xai') {
      const key = process.env.GROK_API_KEY
      if (!key) return { model, provider, status: 0, ok: false, detail: 'GROK_API_KEY not set', served: null }
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      })
      const body = (await res.text()).slice(0, 400)
      return { model, provider, status: res.status, ok: res.ok, detail: body, served: servedFrom(body) }
    }
    return { model, provider, status: 0, ok: false, detail: 'no probe for this provider', served: null }
  } catch (e) {
    return { model, provider, status: 0, ok: false, detail: `network: ${(e as Error).message}`, served: null }
  } finally { clearTimeout(t) }
}

async function itemTwo() {
  console.log('\n§7.2 — the fallback models the brief calls non-existent\n')

  // ⚠⚠ THE BRIEF'S PREMISE IS FALSE, AND THE LIVE CALLS ARE WHAT SHOWED IT. §7 says "two
  // configured fallback models do not exist in the accounts — a fallback that fails only when
  // the primary already has". Probed on 19 Aug 2026, BOTH returned HTTP 200. Neither would ever
  // have failed. The real defect was different and worse on one of them:
  //
  //   claude-haiku-4-5-20251001 → 200, echoing its OWN id. Callable; never stale. The registry
  //                               had excluded it on the strength of a /v1/models read.
  //   grok-3-fast-beta          → 200, echoing "grok-4.3". xAI SILENTLY SUBSTITUTES, so the
  //                               model our config named was not the model any user got — with
  //                               no error, on every Lex turn that path served.
  //
  // So the guard worth having is not "is it in the list" and not even "does it 200". It is
  // **does the response echo the model you asked for.** That is what this asserts.
  check(KNOWN_STALE.length === 0,
    'KNOWN_STALE is empty — neither original entry survived a live call',
    KNOWN_STALE.map((s) => s.model).join(', ') || 'both corrected; see model-registry.ts')

  const src = readFileSync(join(__dirname, '..', 'lib', 'lex', 'model-registry.ts'), 'utf8')
  // Whitespace-collapsed, because the sentence wraps across a comment line break.
  check(/A MODEL-LIST READ IS NOT A CALLABILITY TEST/.test(src.replace(/[\s*]+/g, ' ')),
    'the registry records WHY both entries were wrong, so it is not rediscovered')

  // The two Lex routes must no longer name the substituted id.
  for (const rel of ['app/api/ai/[ideaId]/route.ts', 'app/api/ai/public/route.ts']) {
    const r = readFileSync(join(__dirname, '..', rel), 'utf8')
    const code = r.replace(/\/\/.*$/gm, '')
    check(!/'grok-3-fast-beta'/.test(code) && /model: 'grok-4\.3'/.test(code),
      `${rel} names the model actually served`)
  }

  if (!PROBE) {
    note('')
    note('⚠ RAN OFFLINE — pass --probe to make the live 1-token calls. The claims above are')
    note('  recorded from the 19 Aug 2026 probe; this run did not re-confirm them.')
    return
  }

  console.log('\n  live 1-token calls — the requested id, and the id the response ECHOES:')
  const targets = ['claude-haiku-4-5-20251001', 'claude-haiku-4-5', 'grok-4.3', 'grok-3-fast-beta']
  const results: ProbeResult[] = []
  for (const m of targets) {
    const r = await oneToken(m)
    results.push(r)
    const verdict = !r.ok ? 'DEAD      ' : r.served === m ? 'AS ASKED  ' : 'SUBSTITUTED'
    console.log(`    ${verdict} ${m.padEnd(28)} HTTP ${String(r.status).padEnd(4)} served=${r.served ?? '(none)'}`)
  }
  const by = new Map(results.map((r) => [r.model, r]))

  check(by.get('claude-haiku-4-5-20251001')?.ok === true
    && by.get('claude-haiku-4-5-20251001')?.served === 'claude-haiku-4-5-20251001',
    '⚠⚠ the "missing" Anthropic fallback is LIVE and serves what it is asked for',
    `HTTP ${by.get('claude-haiku-4-5-20251001')?.status}, served ${by.get('claude-haiku-4-5-20251001')?.served}`)
  check(by.get('claude-haiku-4-5')?.served === 'claude-haiku-4-5-20251001',
    '   …and the alias resolves to the same dated id, so the two are one model',
    `claude-haiku-4-5 → ${by.get('claude-haiku-4-5')?.served}`)
  check(by.get('grok-4.3')?.ok === true && by.get('grok-4.3')?.served === 'grok-4.3',
    'the xAI model the routes now name serves what it is asked for',
    `served ${by.get('grok-4.3')?.served}`)

  // ⚠ THE FINDING, ASSERTED SO IT CANNOT QUIETLY REVERSE. If xAI ever starts 404ing the retired
  // id instead of substituting, this fails and the note above needs rewriting — which is the
  // right outcome, because the reasoning behind the route change would have changed.
  const stale = by.get('grok-3-fast-beta')
  check(stale?.ok === true && stale?.served !== 'grok-3-fast-beta',
    '⚠⚠ the retired xAI id still 200s and is SILENTLY SUBSTITUTED — a 200 is not proof of model',
    `requested grok-3-fast-beta, served ${stale?.served ?? '(none)'}`)
}

// ── item 3: does anything actually want an OpenAI key? ───────────────────────────────────────

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...tsFiles(p))
    else if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(p)
  }
  return out
}

function itemThree() {
  console.log('\n§7.3 — is anything configured to want an OpenAI key?\n')
  const roots = [join(__dirname, '..', 'lib'), join(__dirname, '..', 'app'), join(__dirname, '..', '..', 'scripts')]
  const hits: string[] = []
  for (const root of roots) {
    let files: string[] = []
    try { files = tsFiles(root) } catch { continue }
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      if (/process\.env\.OPENAI_API_KEY/.test(src)) {
        hits.push(f.replace(/\\/g, '/').split('/scrutinise-prototype/')[1] ?? f)
      }
    }
  }
  note(`server-side reads of process.env.OPENAI_API_KEY: ${hits.length}`)
  for (const h of hits) note(`  ${h}`)

  // ⚠ The finding is not the count — it is that every one of them is UNREACHABLE.
  const compile = readFileSync(join(__dirname, '..', '..', 'scripts', 'ingest', 'shared', 'compile.ts'), 'utf8')
  const disabled = /export async function compileGeneral[\s\S]{0,200}?throw new Error\('LLM compilation disabled/.test(compile)
    && /export async function compileLegislation[\s\S]{0,200}?throw new Error\('LLM compilation disabled/.test(compile)
  check(disabled, '⚠ the only server-side OpenAI leg sits behind two entry points that THROW',
    'compileLegislation / compileGeneral both raise "LLM compilation disabled — use rawToText() instead"')

  const called = /^\s*(?!async function )[^\n]*\bcallGpt4oMini\(/m.test(compile.replace(/async function callGpt4oMini\(/, ''))
  check(!called, '   …and callGpt4oMini has no caller anywhere — it is dead code, not a live dependency')

  // The one place an OpenAI key legitimately appears is the compare page, and it is the USER'S key.
  const compare = readFileSync(join(__dirname, '..', 'app', 'legislation-compare', 'LegislationCompareClient.tsx'), 'utf8')
  check(/OpenAI API key/.test(compare) && !/process\.env\.OPENAI_API_KEY/.test(compare),
    '/legislation-compare asks the USER for their own key — it never reads a server one')

  console.log('')
  note('CONCLUSION: nothing live wants an OpenAI key. Do not add one.')
  note('⚠ ONE THING WORTH FIXING SEPARATELY, FOUND HERE AND NOT FIXED: in compile.ts a missing key')
  note('  throws `Object.assign(new Error("OPENAI_API_KEY not set"), { rateLimited: true })`, so a')
  note('  configuration error would present to the ingest retry layer as a TRANSIENT RATE LIMIT and')
  note('  be retried rather than reported. Harmless today because the path is dead; it is a live')
  note('  trap the moment anybody re-enables it, and the same shape sits on the TOGETHER_API_KEY leg.')
}

async function main() {
  console.log('\n════ S8 §7 — config hygiene ════')
  itemOne()
  await itemTwo()
  itemThree()
  console.log(`\n════ ${fail ? `${fail} FAILED, ${pass} passed` : `all ${pass} checks pass`} ════${PROBE ? '' : '  (offline — §7.2 not live-verified)'}\n`)
  if (fail) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
