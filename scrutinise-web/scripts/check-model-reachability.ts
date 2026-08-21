// ─────────────────────────────────────────────────────────────────────────────
// check:model-reachability — EVERY MODEL IN CONFIG, ACROSS ALL VENDORS, THE WAY PRODUCTION
// ACTUALLY CALLS THEM.
//
// ⚠⚠ 25-D §1c — THIS CHECK CERTIFIED A MODEL ON WHICH EVERY REAL CALL WOULD HAVE FAILED.
//
// It reported `claude-sonnet-5` as OK. `claude-sonnet-5` rejects `temperature` with a hard 400,
// which every structured build call sends, so the model was green here and unusable in
// production. **The check tested that the door opens. It did not test that you can walk
// through it.** A check that certifies an unusable model is worse than no check at all, because
// it is trusted — and the failure it hid was found by a separate script somebody happened to
// write, not by the thing whose whole job this is.
//
// SO THE PROBE IS NOW THE PRODUCTION CALL: `callModelJson`, the same entry point every pass
// uses, with a real JSON schema, structured-output mode, and the same sampling parameters. The
// probe is small — it asks for two short strings — but its SHAPE is identical, and the shape is
// what fails.
//
// ⚠⚠ AND THE RULE CHARLIE SET, unchanged: A KEY THAT IS PRESENT BUT REJECTED MUST FAIL LOUDLY,
// NEVER SILENTLY FALL BACK. There are now FIVE outcomes and they must not be collapsed:
//
//   OK          the structured call succeeded and the echoed model matches
//   SUBSTITUTED it succeeded and a DIFFERENT model answered           → FAIL, loudly
//   REJECTED    a key is present and the provider refused the call    → FAIL, loudly
//   UNUSABLE    the provider accepted it and we could not USE what came back
//               (truncated · blocked · unparseable · empty · no structured client) → FAIL
//   NO KEY      no credential on this deployment                      → reported, NOT a failure
//
// ⚠ UNUSABLE IS THE VERDICT 25-C DID NOT HAVE, and it is the one the whole rewrite is for.
// "Reachable" and "usable" are different claims, and the gap between them is where
// `claude-sonnet-5` lived.
//
// ⚠ xAI IS AN HONEST EXCEPTION, STATED RATHER THAN PAPERED OVER. `callModelJson` has no
// structured-output client for xAI, so no representative call is possible — the check says so
// per model and returns UNUSABLE for any xAI model a PASS actually uses, because a pass pointed
// at one would fail on its first call. An xAI model that no pass uses is reported, not failed:
// it is reachable, and reachability is all we are entitled to claim about it.
//
// Usage:
//   npx tsx --env-file=.env scripts/check-model-reachability.ts
//   npx tsx --env-file=.env scripts/check-model-reachability.ts --json
//   npx tsx --env-file=.env scripts/check-model-reachability.ts --controls
// ─────────────────────────────────────────────────────────────────────────────

import { PASS_DEFAULTS, REACHABLE, providerFor, envVarFor, type PassName, type Provider } from '../lib/lex/model-registry'
import { KEY_ENV, hasKeyFor, callModelJson } from '../lib/lex/model-call'
// ⚠ `llmFailed`, not `!res.ok`. This package compiles with `strict: false`, under which a
// boolean-literal discriminant does NOT narrow a union — reading `res.reason` after an
// `if (!res.ok)` is a type error, not a narrowing. The predicate helpers exist for exactly
// this and are the same ones every production caller uses.
import { llmFailed } from '../lib/lex/build-llm'
import { requiresThinking } from '../lib/lex/model-thinking'
import { REJECTS_TEMPERATURE, acceptsTemperature } from '../lib/lex/model-sampling'

type Verdict = 'OK' | 'SUBSTITUTED' | 'REJECTED' | 'UNUSABLE' | 'NO KEY'

interface Result {
  model: string
  provider: Provider
  verdict: Verdict
  /** What the response said it was. Null when the vendor does not echo it. */
  echoed: string | null
  /** TRUE when the probe was the production call shape; FALSE when it could only be a ping. */
  representative: boolean
  detail: string
}

const TIMEOUT_MS = 45_000

/**
 * A REPRESENTATIVE schema — the same shape our passes ask for, small enough to run over a dozen
 * models cheaply.
 *
 * ⚠ IT IS NOT A ONE-FIELD SCHEMA. Every real schema in this codebase nests an array of objects
 * (findings, alternatives, causes), and the three vendors handle nesting differently —
 * Anthropic through a forced tool's `input_schema`, OpenAI through `strict` mode which requires
 * every nested object closed. A flat `{answer: string}` would pass on a model whose nested
 * handling is broken, which is the same "tested the door" error one level down.
 */
const PROBE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          detail: { type: 'string' },
        },
      },
    },
  },
  required: ['verdict', 'notes'],
} as const

interface ProbeAnswer {
  verdict?: unknown
  notes?: unknown
}

const PROBE_SYSTEM =
  'You are answering a machine-readable reachability probe. Answer in the requested JSON shape and nothing else.'
const PROBE_USER =
  'Set "verdict" to the single word ok. Put exactly one entry in "notes", with label "probe" and detail "ok".'

/**
 * The output ceiling the probe asks for.
 *
 * ⚠ GENEROUS ON PURPOSE (CLAUDE.md §18 rule 5). Output tokens are billed on what is generated,
 * so a large ceiling on a call that emits a tiny object costs nothing — and a tight one turns a
 * perfectly reachable model into a `truncated` failure that reads like a broken model. A model
 * that must think needs more again, because thinking tokens count against the same budget.
 */
const probeBudget = (model: string) => (requiresThinking(model) ? 8_000 : 2_000)

/** Did the answer actually come back in the shape we asked for? */
function shapeIsRight(v: ProbeAnswer): boolean {
  return typeof v?.verdict === 'string' && Array.isArray(v?.notes)
}

/**
 * One representative structured call per model — the production entry point, production
 * parameters, production structured-output mode.
 */
async function probe(model: string, provider: Provider): Promise<Result> {
  if (!hasKeyFor(provider)) {
    return {
      model, provider, verdict: 'NO KEY', echoed: null, representative: false,
      detail: `${KEY_ENV[provider]} is not set on this deployment`,
    }
  }

  // ⚠ xAI — `callModelJson` refuses it by design ('unroutable'), so there is no production call
  // to imitate. Probed for reachability ONLY, and labelled as such: see the header.
  if (provider === 'xai') return probeXaiReachabilityOnly(model)

  const res = await callModelJson<ProbeAnswer>({
    model,
    system: PROBE_SYSTEM,
    user: PROBE_USER,
    schema: PROBE_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: probeBudget(model),
    timeoutMs: TIMEOUT_MS,
    // ⚠ THE PARAMETER THAT CAUSED THIS REWRITE. Sent exactly as a pass sends it, and dropped by
    // the same per-model gate — so a model that refuses it is probed the way production would
    // call it, rather than probed in a mode production never uses.
    temperature: 0.4,
    label: `reachability:${model}`,
    stream: 'lex',
    pass: 'reachability',
  })

  const echoed = res.usage.echoedModel ?? null
  const matches = !echoed || echoed === model || echoed.startsWith(model)

  if (llmFailed(res)) {
    // An HTTP refusal is the provider saying no. Everything else means the provider said yes and
    // the answer was unusable — a different fact, and the one this check used to miss.
    const verdict: Verdict = res.reason === 'no-key' ? 'NO KEY'
      : res.reason === 'http' || res.reason === 'unroutable' ? 'REJECTED'
      : 'UNUSABLE'
    return { model, provider, verdict, echoed, representative: true, detail: `${res.reason} — ${res.detail}` }
  }

  if (!matches) {
    return {
      model, provider, verdict: 'SUBSTITUTED', echoed, representative: true,
      detail: `asked for ${model}, ${echoed} answered`,
    }
  }
  if (!shapeIsRight(res.value)) {
    // It answered, and not in the shape it was told to. A pass would get an object it cannot
    // read — reachable, and unusable.
    return {
      model, provider, verdict: 'UNUSABLE', echoed, representative: true,
      detail: `answered outside the requested schema: ${JSON.stringify(res.value).slice(0, 140)}`,
    }
  }
  const dropped = acceptsTemperature(model) ? '' : ' (temperature omitted — this model rejects it)'
  return {
    model, provider, verdict: 'OK', echoed, representative: true,
    detail: `structured call answered in shape${dropped}`,
  }
}

/**
 * xAI: a plain chat call, and the result is labelled `representative: false`.
 *
 * ⚠ REPORTED AS UNUSABLE WHEN A PASS USES IT. `orientation.x` names `grok-4.3` today and goes
 * through its own client, not through `callModelJson` — so reachability is the right claim for
 * it. A pass pointed at an xAI model through the build's `callJson` would fail on its first
 * call, and this check must say so rather than showing a green tick.
 */
async function probeXaiReachabilityOnly(model: string): Promise<Result> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROK_API_KEY}` },
      body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return {
        model, provider: 'xai', verdict: 'REJECTED', echoed: null, representative: false,
        detail: `HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 160)}`,
      }
    }
    const data = await res.json() as { model?: string }
    const echoed = data.model ?? null
    if (echoed && echoed !== model) {
      return {
        model, provider: 'xai', verdict: 'SUBSTITUTED', echoed, representative: false,
        detail: `asked for ${model}, ${echoed} answered`,
      }
    }
    return {
      model, provider: 'xai', verdict: 'OK', echoed, representative: false,
      detail: 'reachable — NOT a structured call; there is no xAI structured-output client',
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      model, provider: 'xai', verdict: 'REJECTED', echoed: null, representative: false,
      detail: aborted ? `no answer within ${TIMEOUT_MS}ms` : err instanceof Error ? err.message : String(err),
    }
  } finally { clearTimeout(timer) }
}

// ── the control: watch the check fail ────────────────────────────────────────

/**
 * ⚠⚠ THE CONTROL THAT MAKES THIS CHECK WORTH TRUSTING.
 *
 * A check nobody has watched fail is a check asserting nothing. So: send `claude-sonnet-5` the
 * SAME structured request WITH the parameter the per-model gate now drops, and require a hard
 * refusal. If this control comes back green, `temperature` is no longer rejected, the gate is
 * unnecessary — and, more to the point, the representative probe above has stopped being able
 * to detect the class of fault it was built for.
 *
 * It bypasses `callModelJson` deliberately. Putting an "ignore the safety rule" switch inside
 * the library so a test could flip it would be a backdoor in production code; reproducing the
 * request here costs twenty lines and leaves the library with no such switch.
 */
async function controlRejectedParameter(model: string): Promise<{ fired: boolean; detail: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { fired: false, detail: 'ANTHROPIC_API_KEY not set — control could not run' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: probeBudget(model),
        temperature: 0.4, // ⚠ the whole point of the control
        system: PROBE_SYSTEM,
        messages: [{ role: 'user', content: PROBE_USER }],
        tools: [{ name: 'emit', description: 'Return the result.', input_schema: PROBE_SCHEMA }],
        tool_choice: { type: 'tool', name: 'emit' },
      }),
    })
    if (res.ok) {
      return { fired: false, detail: `HTTP ${res.status} — ${model} ACCEPTED temperature; the rule may be stale` }
    }
    const body = await res.text().catch(() => '')
    return { fired: true, detail: `HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 200)}` }
  } catch (err) {
    return { fired: false, detail: err instanceof Error ? err.message : String(err) }
  } finally { clearTimeout(timer) }
}

async function runControls(): Promise<boolean> {
  console.log('── controls: the check watched failing ──\n')
  let allFired = true
  for (const model of [...REJECTS_TEMPERATURE].filter((m) => REACHABLE.anthropic.includes(m))) {
    const r = await controlRejectedParameter(model)
    console.log(`  ${r.fired ? '✓ fired' : '✗ DID NOT FIRE'}  ${model.padEnd(26)} ${r.detail}`)
    if (!r.fired) allFired = false
  }
  console.log('\n  A fired control = the provider refused the parameter, so the representative probe')
  console.log('  above is testing something real. A control that does NOT fire means either the')
  console.log('  vendor has changed its mind or the probe has stopped being representative.\n')
  return allFired
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const asJson = process.argv.includes('--json')
  const withControls = process.argv.includes('--controls')

  // ⚠ EVERY MODEL IN CONFIG — the pass defaults AND the allow-list. A model that no pass currently
  // uses is still one somebody may point a pass at tomorrow with a single env var, and discovering
  // then that it is unreachable is the situation this check exists to prevent.
  const fromPasses = new Set(Object.values(PASS_DEFAULTS) as string[])
  const fromAllowList = new Set((Object.values(REACHABLE) as string[][]).flat())
  const models = [...new Set([...fromPasses, ...fromAllowList])].sort()

  if (!asJson) {
    console.log('── check:model-reachability ──')
    console.log('Every probe is a REAL STRUCTURED CALL through callModelJson, in the shape a pass makes.')
    console.log(`${models.length} models named in config · ${fromPasses.size} of them in use by a pass\n`)
  }

  const results: Result[] = []
  for (const model of models) {
    const provider = providerFor(model)
    if (!provider) {
      results.push({ model, provider: 'google', verdict: 'REJECTED', echoed: null, representative: false, detail: 'names no known provider' })
      continue
    }
    results.push(await probe(model, provider))
  }

  // ⚠ An xAI model a PASS uses through the build's entry point cannot work — no structured
  // client. `orientation.x` uses its own client and is excluded by name below.
  const XAI_OWN_CLIENT: string[] = [PASS_DEFAULTS['orientation.x']]
  for (const r of results) {
    if (r.provider === 'xai' && r.verdict === 'OK' && fromPasses.has(r.model) && !XAI_OWN_CLIENT.includes(r.model)) {
      r.verdict = 'UNUSABLE'
      r.detail = 'a pass names this model, and callModelJson has no xAI structured-output client'
    }
  }

  if (asJson) { console.log(JSON.stringify(results, null, 2)); process.exit(0) }

  const ICON: Record<Verdict, string> = { OK: '✓', SUBSTITUTED: '✗', REJECTED: '✗', UNUSABLE: '✗', 'NO KEY': '–' }
  for (const r of results) {
    const inUse = fromPasses.has(r.model) ? ' (in use)' : ''
    const how = r.representative ? '' : '  [ping only]'
    console.log(`  ${ICON[r.verdict]} ${r.verdict.padEnd(11)} ${r.model.padEnd(30)} ${r.provider.padEnd(10)}${inUse}${how}`)
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

  // ⚠ AND A PROBE THAT COULD NOT BE REPRESENTATIVE IS NAMED. A green tick beside a ping and a
  // green tick beside a production-shaped call must not read the same — that equivalence is the
  // whole 25-C defect, one level up.
  const pings = results.filter((r) => !r.representative && r.verdict !== 'NO KEY')
  if (pings.length) {
    console.log(`\n⚠ ${pings.length} model(s) could only be PINGED, not called the way production calls them:`)
    for (const r of pings) console.log(`    ${r.model} (${r.provider}) — ${r.detail}`)
    console.log('  Reachable is a weaker claim than usable, and these carry only the weaker one.')
  }

  const substituted = results.filter((r) => r.verdict === 'SUBSTITUTED')
  const rejected = results.filter((r) => r.verdict === 'REJECTED')
  const unusable = results.filter((r) => r.verdict === 'UNUSABLE')
  const noKey = results.filter((r) => r.verdict === 'NO KEY')

  console.log(`\n${results.filter((r) => r.verdict === 'OK').length} usable · ${rejected.length} rejected · `
    + `${unusable.length} unusable · ${substituted.length} substituted · ${noKey.length} no key here`)

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

  if (unusable.length) {
    console.log('\n⚠⚠ THE PROVIDER ACCEPTED THE CALL AND WE COULD NOT USE THE ANSWER. This is the verdict')
    console.log('   25-C did not have, and it is where `claude-sonnet-5` lived — green on a ping, 400 on')
    console.log('   every real call:')
    for (const r of unusable) console.log(`    ${r.model} — ${r.detail}`)
  }

  if (rejected.length) {
    console.log('\n⚠⚠ A KEY IS PRESENT AND THE MODEL WAS REFUSED. This is a live configuration fault:')
    for (const r of rejected) {
      const pass = (Object.keys(PASS_DEFAULTS) as PassName[]).find((p) => PASS_DEFAULTS[p] === r.model)
      console.log(`    ${r.model} — ${r.detail}`)
      if (pass) console.log(`      ⚠ IN USE by "${pass}". Override: ${envVarFor(pass)}`)
    }
  }

  let controlsOk = true
  if (withControls) {
    console.log('')
    controlsOk = await runControls()
  }

  // ⚠ NO KEY does not fail. Rejected, unusable and substituted do — and so does a control that
  // did not fire, because that means the probe has stopped proving anything.
  const failed = rejected.length + substituted.length + unusable.length
  process.exit(failed || !controlsOk ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
