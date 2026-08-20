// ─────────────────────────────────────────────────────────────────────────────
// 25-C §4c — DOES A REAL PASS WORK ON A NON-GOOGLE MODEL?
//
// `check:model-reachability` proves a model ANSWERS. That is necessary and not sufficient: every
// build pass needs STRUCTURED output in a specific schema, and the three vendors request it three
// different ways (Gemini `responseSchema`, Anthropic a forced tool, OpenAI `json_schema` strict).
// A reachability ping would pass on all three while the structured path returned prose.
//
// So this runs the SAME call the build's instrument assessment makes — same schema, same helper —
// against one model per available vendor, and checks the object that comes back.
//
// ⚠ IT USES `callJson`, THE BUILD'S OWN ENTRY POINT, not `callModelJson` directly. Testing the
// dispatcher rather than the vendor client is the point: what has to be true is that a PASS can
// name any model in config, and passes call `callJson`.
//
// Usage: npx tsx --env-file=.env scripts/verify-model-vendors.ts
// ─────────────────────────────────────────────────────────────────────────────

import { callJson, llmOk, llmFailed } from '../lib/lex/build-llm'
import { providerFor, REACHABLE, type Provider } from '../lib/lex/model-registry'
import { hasKeyFor, KEY_ENV, closeSchema } from '../lib/lex/model-call'

/** A small schema with the shapes that break naive adapters: enum, boolean, nested required. */
const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['yes', 'no'] },
    confident: { type: 'boolean' },
    because: { type: 'string' },
  },
  required: ['verdict', 'confident', 'because'],
}

interface Shape { verdict: string; confident: boolean; because: string }

/** One model per vendor — the one a pass would plausibly be pointed at. */
const CANDIDATES: Array<{ provider: Provider; model: string }> = [
  { provider: 'google', model: 'gemini-2.5-flash' },
  { provider: 'anthropic', model: 'claude-sonnet-5' },
  // Only probed where a key exists; REACHABLE.openai is empty today, so this is skipped with a
  // reason rather than silently omitted.
  { provider: 'openai', model: REACHABLE.openai[0] ?? 'gpt-5' },
]

let pass = 0
let fail = 0
let skipped = 0

async function main() {
  console.log('── verify:model-vendors — a real structured call, per vendor, through callJson ──\n')

  // The schema adapter is pure and worth asserting before any network call.
  const closed = closeSchema(SCHEMA) as { required?: string[]; additionalProperties?: boolean }
  if (closed.additionalProperties !== false || (closed.required ?? []).length !== 3) {
    console.log('  ✗ closeSchema did not produce a strict-mode schema')
    fail++
  } else {
    console.log('  ✓ closeSchema closes the object for OpenAI strict mode')
    pass++
  }

  for (const c of CANDIDATES) {
    if (!hasKeyFor(c.provider)) {
      console.log(`  – SKIPPED ${c.provider.padEnd(10)} ${KEY_ENV[c.provider]} is not set on this machine`)
      skipped++
      continue
    }
    if (providerFor(c.model) !== c.provider) {
      console.log(`  ✗ ${c.model} does not route to ${c.provider}`)
      fail++
      continue
    }

    const r = await callJson<Shape>({
      model: c.model,
      system: 'You answer only in the given schema. Be terse.',
      user: 'Is the Companies Act 2006 an Act of the UK Parliament? Answer in the schema.',
      schema: SCHEMA,
      maxOutputTokens: 400,
      timeoutMs: 45_000,
      temperature: 0,
      label: `vendor-${c.provider}`,
    })

    if (llmFailed(r)) {
      console.log(`  ✗ ${c.provider.padEnd(10)} ${c.model} — ${r.reason}: ${r.detail.slice(0, 140)}`)
      fail++
      continue
    }
    const v = r.value
    const shapeOk = (v.verdict === 'yes' || v.verdict === 'no') && typeof v.confident === 'boolean' && !!v.because
    // ⚠ Usage must come back too — a vendor client that returned the object and forgot the tokens
    // would silently disable the build's cost ceiling for every pass pointed at it.
    const usageOk = r.usage.tokensIn > 0 && r.usage.tokensOut > 0
    console.log(`  ${shapeOk && usageOk ? '✓' : '✗'} ${c.provider.padEnd(10)} ${c.model}`)
    console.log(`      verdict=${v.verdict} confident=${String(v.confident)} tokens=${r.usage.tokensIn}/${r.usage.tokensOut}`)
    if (!shapeOk) console.log('      ✗ the object did not match the schema')
    if (!usageOk) console.log('      ✗ no usage returned — the cost ceiling would be blind on this vendor')
    shapeOk && usageOk ? pass++ : fail++
  }

  console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped for want of a key.`)
  if (skipped) console.log('⚠ A skip is a statement about this machine, not about the vendor.')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
