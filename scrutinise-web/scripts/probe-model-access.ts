/**
 * probe-model-access.ts — BRIEF_SEARCH_S6 §2: call each provider key ONCE and report the result.
 *
 * ⚠ THE BRIEF'S INSTRUCTION IS THE WHOLE POINT: "A key in an environment file is not a working
 * credential, and this project has already lost a session to a token that authenticated and then
 * 403'd." (`VERCEL_TOKEN` — 200 on /v2/user, 403 with `"saml": true` on every project endpoint.)
 *
 * So this does three things per provider and reports them separately, because they fail separately:
 *   1. is a key PRESENT in the environment
 *   2. does the provider's model-LIST endpoint accept it   ← authentication
 *   3. does a real one-token COMPLETION come back          ← authorisation + quota
 *
 * A provider that passes 2 and fails 3 is exactly the Vercel shape, and reporting them as one
 * boolean is how that cost a session.
 *
 * Usage (from scrutinise-web):  npx tsx --env-file=.env scripts/probe-model-access.ts
 */
export {}

interface Probe {
  provider: string
  envVar: string
  keyPresent: boolean
  listStatus: string
  listCount: number | null
  callStatus: string
  callModel: string
  sample: string
  notes: string[]
}

const MASK = (k: string | undefined) => (k ? `${k.slice(0, 6)}…${k.slice(-4)} (${k.length} chars)` : '—')
const TIMEOUT = 25_000

async function timed(url: string, init: RequestInit = {}): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    return { status: res.status, body: (await res.text()).slice(0, 4000) }
  } catch (e) {
    return { status: 0, body: `network: ${(e as Error).message}` }
  } finally { clearTimeout(t) }
}

// ── Gemini ──────────────────────────────────────────────────────────────────────────────────────
async function gemini(): Promise<Probe> {
  const key = process.env.GEMINI_API_KEY
  const p: Probe = { provider: 'Google Gemini', envVar: 'GEMINI_API_KEY', keyPresent: !!key,
    listStatus: '—', listCount: null, callStatus: '—', callModel: 'gemini-2.5-flash', sample: '', notes: [] }
  if (!key) { p.notes.push('no key in the environment'); return p }
  const list = await timed(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`)
  p.listStatus = String(list.status)
  if (list.status === 200) {
    const names = [...list.body.matchAll(/"name"\s*:\s*"models\/([^"]+)"/g)].map((m) => m[1])
    p.listCount = names.length
    const interesting = names.filter((n) => /^gemini-(2\.5|3)/.test(n) && !/embedding|tts|image|live|native-audio/.test(n))
    p.notes.push(`reachable gemini-2.5+ text models: ${interesting.slice(0, 12).join(', ')}`)
  }
  const call = await timed(`https://generativelanguage.googleapis.com/v1beta/models/${p.callModel}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
      generationConfig: { maxOutputTokens: 8, thinkingConfig: { thinkingBudget: 0 } } }),
  })
  p.callStatus = String(call.status)
  p.sample = (/"text"\s*:\s*"([^"]{0,40})"/.exec(call.body)?.[1] ?? call.body.slice(0, 90)).trim()
  return p
}

// ── Anthropic ───────────────────────────────────────────────────────────────────────────────────
async function anthropic(): Promise<Probe> {
  const key = process.env.ANTHROPIC_API_KEY
  const p: Probe = { provider: 'Anthropic Claude', envVar: 'ANTHROPIC_API_KEY', keyPresent: !!key,
    listStatus: '—', listCount: null, callStatus: '—', callModel: '', sample: '', notes: [] }
  if (!key) { p.notes.push('no key in the environment'); return p }
  const h = { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
  const list = await timed('https://api.anthropic.com/v1/models?limit=100', { headers: h })
  p.listStatus = String(list.status)
  let ids: string[] = []
  if (list.status === 200) {
    ids = [...list.body.matchAll(/"id"\s*:\s*"([^"]+)"/g)].map((m) => m[1])
    p.listCount = ids.length
    p.notes.push(`reachable models: ${ids.slice(0, 14).join(', ')}`)
  }
  // ⚠ Call whatever the LIST said exists rather than a remembered string — a model id from memory
  // is the commonest reason a "dead key" turns out to be a dead model name.
  p.callModel = ids.find((i) => /haiku/.test(i)) ?? ids[0] ?? 'claude-haiku-4-5-20251001'
  const call = await timed('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: h,
    body: JSON.stringify({ model: p.callModel, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] }),
  })
  p.callStatus = String(call.status)
  // Anthropic returns content: [{type:'text', text:'ok'}] — match the text INSIDE the block, not
  // the first "text" key in the envelope.
  p.sample = (/"type"\s*:\s*"text"\s*,\s*"text"\s*:\s*"([^"]{0,40})"/.exec(call.body)?.[1]
    ?? /"text"\s*:\s*"([^"]{0,40})"/.exec(call.body)?.[1] ?? call.body.slice(0, 90)).trim()
  return p
}

// ── xAI Grok ────────────────────────────────────────────────────────────────────────────────────
async function grok(): Promise<Probe> {
  const key = process.env.GROK_API_KEY
  const p: Probe = { provider: 'xAI Grok', envVar: 'GROK_API_KEY', keyPresent: !!key,
    listStatus: '—', listCount: null, callStatus: '—', callModel: '', sample: '', notes: [] }
  if (!key) { p.notes.push('no key in the environment'); return p }
  const h = { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
  const list = await timed('https://api.x.ai/v1/models', { headers: h })
  p.listStatus = String(list.status)
  let ids: string[] = []
  if (list.status === 200) {
    ids = [...list.body.matchAll(/"id"\s*:\s*"([^"]+)"/g)].map((m) => m[1])
    p.listCount = ids.length
    p.notes.push(`reachable models: ${ids.slice(0, 14).join(', ')}`)
  }
  p.callModel = ids.find((i) => /grok-4/.test(i)) ?? ids[0] ?? 'grok-4'
  const call = await timed('https://api.x.ai/v1/chat/completions', {
    method: 'POST', headers: h,
    body: JSON.stringify({ model: p.callModel, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] }),
  })
  p.callStatus = String(call.status)
  p.sample = (/"content"\s*:\s*"([^"]{0,40})"/.exec(call.body)?.[1] ?? call.body.slice(0, 90)).trim()
  return p
}

// ── OpenAI ──────────────────────────────────────────────────────────────────────────────────────
async function openai(): Promise<Probe> {
  const key = process.env.OPENAI_API_KEY
  const p: Probe = { provider: 'OpenAI', envVar: 'OPENAI_API_KEY', keyPresent: !!key,
    listStatus: '—', listCount: null, callStatus: '—', callModel: '', sample: '', notes: [] }
  if (!key) { p.notes.push('NO KEY ON THIS MACHINE — the brief lists OpenAI as available to Charlie, so the key exists somewhere it is not here'); return p }
  const h = { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
  const list = await timed('https://api.openai.com/v1/models', { headers: h })
  p.listStatus = String(list.status)
  let ids: string[] = []
  if (list.status === 200) {
    ids = [...list.body.matchAll(/"id"\s*:\s*"([^"]+)"/g)].map((m) => m[1])
    p.listCount = ids.length
    p.notes.push(`reachable models (first 14): ${ids.slice(0, 14).join(', ')}`)
  }
  p.callModel = ids.find((i) => /^gpt-5|^gpt-4\.1|^o4/.test(i)) ?? ids[0] ?? 'gpt-4.1-mini'
  const call = await timed('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: h,
    body: JSON.stringify({ model: p.callModel, max_completion_tokens: 8, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] }),
  })
  p.callStatus = String(call.status)
  p.sample = (/"content"\s*:\s*"([^"]{0,40})"/.exec(call.body)?.[1] ?? call.body.slice(0, 120)).trim()
  return p
}

// ── others already in .env, reported because they exist and nobody wrote them down ─────────────
async function others(): Promise<Probe[]> {
  const out: Probe[] = []
  for (const [provider, envVar, url, hdr] of [
    ['Voyage (embeddings)', 'VOYAGE_API_KEY', 'https://api.voyageai.com/v1/embeddings', 'bearer'],
    ['Together', 'TOGETHER_API_KEY', 'https://api.together.xyz/v1/models', 'bearer'],
  ] as const) {
    const key = process.env[envVar]
    const p: Probe = { provider, envVar, keyPresent: !!key, listStatus: '—', listCount: null,
      callStatus: 'not called', callModel: '', sample: '', notes: [] }
    if (!key) { p.notes.push('no key'); out.push(p); continue }
    const res = hdr === 'bearer' && url.endsWith('/models')
      ? await timed(url, { headers: { authorization: `Bearer ${key}` } })
      : await timed(url, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'voyage-3', input: ['ok'] }) })
    p.listStatus = String(res.status)
    if (res.status === 200) p.listCount = [...res.body.matchAll(/"id"\s*:\s*"([^"]+)"/g)].length || null
    p.notes.push(res.status === 200 ? 'key works' : `body: ${res.body.slice(0, 110)}`)
    out.push(p)
  }
  return out
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗')
  console.log('║  §2 — WHICH MODEL KEYS ACTUALLY WORK.  Each key called ONCE, for real.          ║')
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝')
  console.log('  ⚠ list status and call status are reported SEPARATELY. A key that lists and does')
  console.log('    not call is the VERCEL_TOKEN shape, and reporting one boolean is how that cost')
  console.log('    a session.\n')

  const probes = [...await Promise.all([gemini(), anthropic(), grok(), openai()]), ...await others()]
  for (const p of probes) {
    // ⚠ 'not called' is its OWN verdict. Labelling an embeddings key "lists but will not call"
    // when no completion was ever attempted is the same mislabel this file exists to prevent.
    const verdict = !p.keyPresent ? '✗ NO KEY'
      : p.callStatus === 'not called' ? (p.listStatus === '200' ? '✓ KEY VALID (no completion attempted — not a chat model)' : '✗ KEY REJECTED')
        : p.callStatus === '200' ? '✓ WORKS'
          : p.listStatus === '200' ? '⚠ LISTS BUT WILL NOT CALL — the VERCEL_TOKEN shape'
            : '✗ KEY REJECTED'
    console.log(`  ── ${p.provider} (${p.envVar}) ──`)
    console.log(`     ${verdict}`)
    console.log(`     key            ${MASK(process.env[p.envVar])}`)
    console.log(`     model list     HTTP ${p.listStatus}${p.listCount != null ? ` · ${p.listCount} ids` : ''}`)
    if (p.callModel) console.log(`     one real call  HTTP ${p.callStatus} on ${p.callModel} → ${JSON.stringify(p.sample).slice(0, 80)}`)
    for (const nt of p.notes) console.log(`     · ${nt}`)
    console.log()
  }
  const working = probes.filter((p) => p.callStatus === '200').map((p) => p.provider)
  console.log(`  WORKING FOR COMPLETIONS: ${working.join(', ') || 'none'}`)
}
main().catch((e) => { console.error('[probe-model-access] FATAL', e); process.exit(1) })
