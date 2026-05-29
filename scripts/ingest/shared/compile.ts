import Anthropic from '@anthropic-ai/sdk'

const GEMINI_MODEL = 'gemini-2.5-flash'
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _anthropic
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    }
  )
  if (res.status === 429 || res.status === 503) throw Object.assign(new Error(`Gemini ${res.status}`), { rateLimited: true })
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json() as Record<string, unknown>
  if ((data.error as Record<string, unknown> | undefined)?.code) {
    throw new Error(`Gemini API: ${(data.error as Record<string, unknown>).message}`)
  }
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
  return candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callHaiku(prompt: string): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = res.content[0]
  if (block.type !== 'text') throw new Error('Haiku: unexpected content type')
  return block.text
}

// ── Legislation compiler (Gemini primary, Haiku fallback) ─────────────────────

const LEG_PROMPT = (xml: string) =>
  `Convert this CLML XML section into clean, readable plain text suitable for legal research. ` +
  `Preserve all legal meaning, section numbers, cross-references, and defined terms. ` +
  `Remove XML markup. Output plain text only — no preamble.\n\nCLML XML:\n${xml}`

export async function compileLegislation(rawXml: string): Promise<string> {
  const prompt = LEG_PROMPT(rawXml)
  try {
    return await callGemini(prompt)
  } catch (err: unknown) {
    if ((err as { rateLimited?: boolean }).rateLimited) {
      console.warn('  [compile] Gemini rate limited — falling back to Haiku')
      return await callHaikuWithBackoff(prompt)
    }
    throw err
  }
}

// ── General compiler (Haiku) ──────────────────────────────────────────────────

const GEN_PROMPT = (content: string) =>
  `Extract clean readable plain text from this document. ` +
  `Preserve all factual content, headings, numbered points, and citations. ` +
  `Remove HTML/XML markup and boilerplate navigation. Output plain text only.\n\nCONTENT:\n${content}`

export async function compileGeneral(rawContent: string): Promise<string> {
  return await callHaikuWithBackoff(GEN_PROMPT(rawContent))
}

// ── Haiku with backoff ────────────────────────────────────────────────────────

async function callHaikuWithBackoff(prompt: string, maxAttempts = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callHaiku(prompt)
    } catch (err: unknown) {
      const isRateLimit = String(err).includes('429') || String(err).includes('overloaded')
      if (isRateLimit && attempt < maxAttempts) {
        const wait = attempt * 10_000
        console.warn(`  [compile] Haiku rate limited — waiting ${wait / 1000}s (attempt ${attempt}/${maxAttempts})`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw err
    }
  }
  throw new Error('Haiku: max retries exceeded')
}
