// ─────────────────────────────────────────────────────────────────────────────
// check:model-reachability — 25-C §4c. EVERY MODEL IN CONFIG, ACROSS ALL THREE VENDORS.
//
// ⚠⚠ WHY A LIVE CHECK AND NOT A LIST READ. Two of this codebase's costliest model findings both
// came from believing a list:
//
//   · `gemini-2.5-pro` was in `REACHABLE`, recommended for the adversarial pass, and could not be
//     called by ANY of our clients — it rejects `thinkingBudget: 0` with a 400. A capability we
//     believed we had and did not.
//   · `grok-3-fast-beta` returned HTTP 200 for months while the body echoed back `grok-4.3`.
//     **A 200 is not proof you got the model you asked for.**
//
// So this makes a real call per model and compares what came back with what was asked for.
//
// ⚠⚠ AND THE RULE CHARLIE SET: A KEY THAT IS PRESENT BUT REJECTED MUST FAIL LOUDLY, NEVER
// SILENTLY FALL BACK. That distinction is the whole design here — there are FOUR outcomes and
// they must not be collapsed into "works / doesn't":
//
//   OK          the call succeeded and the echoed model matches
//   SUBSTITUTED the call succeeded and a DIFFERENT model answered  → FAIL, loudly
//   REJECTED    a key is present and the provider refused          → FAIL, loudly
//   NO KEY      no credential on this deployment                   → reported, NOT a failure
//
// "No key" is a fact about where the check is running; "rejected" is a fact about the config. A
// check that treated them alike would go green on a laptop and hide a broken production pass.
//
// Usage:
//   npx tsx --env-file=.env scripts/check-model-reachability.ts
//   npx tsx --env-file=.env scripts/check-model-reachability.ts --json
// ─────────────────────────────────────────────────────────────────────────────

import { PASS_DEFAULTS, REACHABLE, providerFor, envVarFor, type PassName, type Provider } from '../lib/lex/model-registry'
import { KEY_ENV, hasKeyFor } from '../lib/lex/model-call'
import { requiresThinking, thinkingConfigFor } from '../lib/lex/model-thinking'

type Verdict = 'OK' | 'SUBSTITUTED' | 'REJECTED' | 'NO KEY'

interface Result {
  model: string
  provider: Provider
  verdict: Verdict
  /** What the response said it was. Null when the vendor does not echo it. */
  echoed: string | null
  detail: string
}

const TIMEOUT_MS = 30_000

async function withTimeout(fn: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try { return await fn(ctrl.signal) } finally { clearTimeout(t) }
}

/**
 * One minimal call per model. Deliberately tiny — this runs over a dozen models and its job is
 * reachability, not quality.
 */
async function probe(model: string, provider: Provider): Promise<Result> {
  if (!hasKeyFor(provider)) {
    return {
      model, provider, verdict: 'NO KEY', echoed: null,
      detail: `${KEY_ENV[provider]} is not set on this deployment`,
    }
  }

  try {
    if (provider === 'google') {
      const res = await withTimeout((signal) => fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST', signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
            // ⚠ The SAME per-model thinking decision the real callers use. Probing with a
            // different config would prove reachability for a call we never make.
            generationConfig: { maxOutputTokens: requiresThinking(model) ? 2048 : 16, thinkingConfig: thinkingConfigFor(model) },
          }),
        },
      ))
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { model, provider, verdict: 'REJECTED', echoed: null, detail: `HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 160)}` }
      }
      const data = await res.json() as { modelVersion?: string }
      // Gemini echoes `modelVersion`. It may carry a dated suffix, so the test is a prefix match.
      const echoed = data.modelVersion ?? null
      const matches = !echoed || echoed === model || echoed.startsWith(model)
      return {
        model, provider, verdict: matches ? 'OK' : 'SUBSTITUTED', echoed,
        detail: matches ? 'answered' : `asked for ${model}, ${echoed} answered`,
      }
    }

    if (provider === 'anthropic') {
      const res = await withTimeout((signal) => fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model, max_tokens: 16,
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        }),
      }))
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { model, provider, verdict: 'REJECTED', echoed: null, detail: `HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 160)}` }
      }
      const data = await res.json() as { model?: string }
      const echoed = data.model ?? null
      const matches = !echoed || echoed === model || echoed.startsWith(model)
      return {
        model, provider, verdict: matches ? 'OK' : 'SUBSTITUTED', echoed,
        detail: matches ? 'answered' : `asked for ${model}, ${echoed} answered`,
      }
    }

    if (provider === 'openai') {
      const res = await withTimeout((signal) => fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model, max_completion_tokens: 16,
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        }),
      }))
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { model, provider, verdict: 'REJECTED', echoed: null, detail: `HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 160)}` }
      }
      const data = await res.json() as { model?: string }
      const echoed = data.model ?? null
      const matches = !echoed || echoed === model || echoed.startsWith(model)
      return {
        model, provider, verdict: matches ? 'OK' : 'SUBSTITUTED', echoed,
        detail: matches ? 'answered' : `asked for ${model}, ${echoed} answered`,
      }
    }

    // xAI — probed for reachability so a substitution is still visible, even though
    // `callModelJson` has no structured-output client for it yet.
    const res = await withTimeout((signal) => fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROK_API_KEY}` },
      body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] }),
    }))
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { model, provider, verdict: 'REJECTED', echoed: null, detail: `HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 160)}` }
    }
    const data = await res.json() as { model?: string }
    const echoed = data.model ?? null
    const matches = !echoed || echoed === model
    return {
      model, provider, verdict: matches ? 'OK' : 'SUBSTITUTED', echoed,
      detail: matches ? 'answered' : `asked for ${model}, ${echoed} answered`,
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      model, provider, verdict: 'REJECTED', echoed: null,
      detail: aborted ? `no answer within ${TIMEOUT_MS}ms` : err instanceof Error ? err.message : String(err),
    }
  }
}

async function main() {
  const asJson = process.argv.includes('--json')

  // ⚠ EVERY MODEL IN CONFIG — the pass defaults AND the allow-list. A model that no pass currently
  // uses is still one somebody may point a pass at tomorrow with a single env var, and discovering
  // then that it is unreachable is the situation this check exists to prevent.
  const fromPasses = new Set(Object.values(PASS_DEFAULTS) as string[])
  const fromAllowList = new Set((Object.values(REACHABLE) as string[][]).flat())
  const models = [...new Set([...fromPasses, ...fromAllowList])].sort()

  if (!asJson) {
    console.log('── check:model-reachability ──')
    console.log(`${models.length} models named in config · ${fromPasses.size} of them in use by a pass\n`)
  }

  const results: Result[] = []
  for (const model of models) {
    const provider = providerFor(model)
    if (!provider) {
      results.push({ model, provider: 'google', verdict: 'REJECTED', echoed: null, detail: 'names no known provider' })
      continue
    }
    results.push(await probe(model, provider))
  }

  if (asJson) { console.log(JSON.stringify(results, null, 2)); process.exit(0) }

  const ICON: Record<Verdict, string> = { OK: '✓', SUBSTITUTED: '✗', REJECTED: '✗', 'NO KEY': '–' }
  for (const r of results) {
    const inUse = fromPasses.has(r.model) ? ' (in use)' : ''
    console.log(`  ${ICON[r.verdict]} ${r.verdict.padEnd(11)} ${r.model.padEnd(30)} ${r.provider.padEnd(10)}${inUse}`)
    if (r.verdict !== 'OK') console.log(`      ${r.detail}`)
  }

  // ⚠ A PROVIDER WITH NO MODELS IN CONFIG IS PROBED ZERO TIMES AND LOOKS PERFECT.
  //
  // That is the quietest failure this check can have: `REACHABLE.openai` is `[]`, so a green run
  // says nothing whatever about OpenAI while reading as full coverage. Naming it is the
  // difference between "we checked and it is fine" and "there was nothing to check".
  const configured = new Set(results.map((r) => r.provider))
  const emptyProviders = (Object.keys(REACHABLE) as Provider[]).filter((p) => !configured.has(p))
  if (emptyProviders.length) {
    console.log(`\n⚠ ${emptyProviders.length} provider(s) have NO MODELS IN CONFIG, so nothing was probed for them:`)
    for (const p of emptyProviders) {
      const key = hasKeyFor(p) ? `${KEY_ENV[p]} IS set here` : `${KEY_ENV[p]} is not set here`
      console.log(`    ${p} — REACHABLE.${p} is empty (${key})`)
    }
    console.log('  A green result above is NOT a statement about these. Add ids to REACHABLE only')
    console.log('  after probing them where the key exists — a list read is not a callability test.')
  }

  const substituted = results.filter((r) => r.verdict === 'SUBSTITUTED')
  const rejected = results.filter((r) => r.verdict === 'REJECTED')
  const noKey = results.filter((r) => r.verdict === 'NO KEY')

  console.log(`\n${results.filter((r) => r.verdict === 'OK').length} reachable · `
    + `${rejected.length} rejected · ${substituted.length} substituted · ${noKey.length} no key here`)

  if (noKey.length) {
    // ⚠ Reported, never counted as a failure. Whether a key exists is a fact about the machine
    // this ran on; a check that failed for it would be red on every laptop and ignored everywhere.
    console.log(`\n⚠ ${noKey.length} model(s) could not be probed from here — no credential:`)
    for (const r of noKey) console.log(`    ${r.model} (${KEY_ENV[r.provider]})`)
    console.log('  That is a statement about this deployment, NOT about the model. Run it where the key is.')
  }

  if (substituted.length) {
    console.log('\n⚠⚠ A DIFFERENT MODEL ANSWERED. The call succeeds, nothing is logged, and every result')
    console.log('   attributed to the configured model came from another one:')
    for (const r of substituted) console.log(`    ${r.model} → ${r.echoed}`)
  }

  if (rejected.length) {
    console.log('\n⚠⚠ A KEY IS PRESENT AND THE MODEL WAS REFUSED. This is a live configuration fault:')
    for (const r of rejected) {
      const pass = (Object.keys(PASS_DEFAULTS) as PassName[]).find((p) => PASS_DEFAULTS[p] === r.model)
      console.log(`    ${r.model} — ${r.detail}`)
      if (pass) console.log(`      ⚠ IN USE by "${pass}". Override: ${envVarFor(pass)}`)
    }
  }

  // ⚠ NO KEY does not fail. Rejected and substituted do.
  process.exit(rejected.length + substituted.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
