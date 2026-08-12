import Anthropic from '@anthropic-ai/sdk'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number; numrender: number }>

const GEMINI_MODEL = 'gemini-2.5-flash'
const GPT4O_MINI_MODEL = 'gpt-4o-mini'
const LLAMA_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _anthropic
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY not set'), { rateLimited: true })

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

async function callGpt4oMini(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw Object.assign(new Error('OPENAI_API_KEY not set'), { rateLimited: true })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GPT4O_MINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  })
  if (res.status === 429 || res.status === 503) throw Object.assign(new Error(`GPT-4o mini ${res.status}`), { rateLimited: true })
  if (!res.ok) throw new Error(`GPT-4o mini HTTP ${res.status}`)
  const data = await res.json() as Record<string, unknown>
  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined
  return choices?.[0]?.message?.content ?? ''
}

async function callLlama(prompt: string): Promise<string> {
  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) throw Object.assign(new Error('TOGETHER_API_KEY not set'), { rateLimited: true })

  const res = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: LLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  })
  if (res.status === 429 || res.status === 503) throw Object.assign(new Error(`Llama ${res.status}`), { rateLimited: true })
  if (!res.ok) throw new Error(`Llama HTTP ${res.status}`)
  const data = await res.json() as Record<string, unknown>
  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined
  return choices?.[0]?.message?.content ?? ''
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

// ── Prompts ───────────────────────────────────────────────────────────────────

const LEG_PROMPT = (xml: string) =>
  `Convert this CLML XML section into clean, readable plain text suitable for legal research. ` +
  `Preserve all legal meaning, section numbers, cross-references, and defined terms. ` +
  `Remove XML markup. Output plain text only — no preamble.\n\nCLML XML:\n${xml}`

const GEN_PROMPT = (content: string) =>
  `Extract clean readable plain text from this document. ` +
  `Preserve all factual content, headings, numbered points, and citations. ` +
  `Remove HTML/XML markup and boilerplate navigation. Output plain text only.\n\nCONTENT:\n${content}`

// ── Legislation compiler: Gemini → GPT-4o mini → Llama 3.3 70B → Haiku ──────

export async function compileLegislation(_rawXml: string): Promise<string> {
  throw new Error('LLM compilation disabled — use rawToText() instead')
}

// ── General compiler: GPT-4o mini → Llama 3.3 70B → Haiku ───────────────────

export async function compileGeneral(_rawContent: string): Promise<string> {
  throw new Error('LLM compilation disabled — use rawToText() instead')
}

// ── Tag-stripping compiler (no LLM — used by ingest workers) ─────────────────

// Entity fidelity set mirrors historic-hansard's parser (V23): decode what has
// a real character, drop unknown named entities as whitespace. Pre-V23 rows
// carry literal numeric entities (&#xa0; seen in committees oral transcripts).
const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  pound: '£', euro: '€', sect: '§', copy: '©', reg: '®', deg: '°', middot: '·',
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  frac12: '½', frac14: '¼', frac34: '¾',
}

/**
 * True when a compiled section carries no words — only the punctuation and numbering
 * legislation.gov.uk uses to render a REPEALED provision in the revised CLML.
 *
 * V36. `uksi/1999/303` ingested as 137 sections and 4,521 "words", every one of them
 * a dot: the source publishes `<Text>. . . . . . . .</Text>` for each repealed
 * regulation, and `rawToText` faithfully returned it. Across the pilots, 44 of 113
 * sampled sections were this, and one instrument in fourteen was ENTIRELY this. The
 * ingest is not wrong — the corpus is: each of those becomes a chunk that is
 * embedded at full price and is retrievable as a document that says nothing. Same
 * family as the placeholder that looked like data.
 *
 * Strict on purpose. A section number followed by dots ("1 . . . .") must match; a
 * section number followed by any real word ("1 This Order may be cited") must not,
 * which is what the two-letter-run test below guarantees.
 */
export function isRepealedPlaceholder(text: string): boolean {
  const t = text.trim()
  if (!t) return false                    // empty is a different state — not this one
  if (!/[.·…]/.test(t)) return false      // no dot leader at all
  return !/[A-Za-z]{2}/.test(t)           // no word of two or more letters anywhere
}

export function rawToText(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')   // remove all XML/HTML tags
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => HTML_ENTITIES[name.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim()
}

// ── PDF text extraction ───────────────────────────────────────────────────────
// Uses pdf-parse for machine-readable PDFs. Scanned/image PDFs return low or
// empty text — callers should check the return length and flag for OCR.

export async function pdfToText(buffer: Buffer, sourceUrl = ''): Promise<string | null> {
  try {
    const data = await pdfParse(buffer)
    const text = data.text?.trim() ?? ''
    if (text.length > 100) return text
    // Low yield — likely a scanned PDF. Return what we have (may be empty).
    console.warn(`[pdf] low text yield (${text.length} chars) for ${sourceUrl || 'unknown'} — likely scanned`)
    return text || null
  } catch (err) {
    console.warn(`[pdf] parse failed for ${sourceUrl || 'unknown'}:`, err)
    return null
  }
}

// ── Haiku with backoff (last resort) ─────────────────────────────────────────

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
