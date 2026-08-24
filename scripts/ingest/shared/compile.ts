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
 *
 * ⚠ C2 LANE 2 — THE TWO-LETTER TEST WAS DEFEATED BY THE PROVISION'S OWN LABEL, AND THE
 * CENSUS PRINTED THE EVIDENCE WITHOUT ANYONE READING IT. `retained-eu` renders a removed
 * provision as "Article 31 . . . ." rather than the bare "31 . . . ." every other
 * collection uses, and "Article" is a word of two or more letters. The V36 repeal census
 * therefore scored retained-eu at **27 placeholders in 194,537 rows — 0.01%** and printed
 * that line directly beneath `regional` at 16.84% and `primary-acts-pre-2000` at 21.48%.
 * A rate three orders of magnitude below its neighbours is not a fact about EU law; it is
 * a broken detector, and it sat in the run's own summary output for eleven days.
 *
 * Measured consequence: ~70,516 further whole-body dot leaders in retained-eu alone —
 * 35.4% ±4.19 of the 199,197 rows the census could see and did not flag. The census's
 * 178,826 is an undercount of about 28%. Nothing in the other five legislation
 * collections was missed (0% in a 500-row sample each), because none of them uses a label.
 *
 * ⚠⚠ THE FIX STRIPS ONE LEADING LABEL, NOT EVERY WORD, AND THE DIFFERENCE IS THE WHOLE
 * POINT. A dot run also appears in a PARTIALLY repealed section — "4 1 . . . a traffic
 * regulation order shall not be made with respect to any road…" — where subsections have
 * been removed and the rest is live law. ~35,895 legislation sections are of that kind.
 * Treating a dot run as sufficient would mark live law hollow and drop it out of the
 * usable-text count. The whole body must still reduce to nothing; only the label is new.
 */
/**
 * One leading structural reference, and only at the start — the publisher's own heading for the
 * provision. Anything after it must still be dots and digits for the section to be saying nothing.
 *
 * ⚠⚠ C3 LANE B3 — THE SAME BUG IN A THIRD COSTUME, AND IT WAS THE PROVISION NUMBER ITSELF. V36
 * caught the bare form (`31 . . . .`). C2 Lane 2 caught the labelled form (`Article 31 . . . .`).
 * Neither catches a section number carrying a MULTI-LETTER SUFFIX, which is how inserted
 * provisions are numbered:
 *
 *     12ZA  . . . .      234ZA  . . . .      502GC  . . . .      164FG  . . . .
 *
 * `ZA`, `GC` and `FG` are each a run of two letters, so the "no word of two or more letters" test
 * reads them as words and the section as live law. ⚠ ONE letter was always fine — `12A . . . .`
 * matched — so the defect only appears on the deeper insertions, which is why it survived two
 * fixes. Found by reading the bodies the B3 partial census flagged: **4 of 60 sampled "partially
 * repealed" sections were whole-body dot leaders**, ~6.7%.
 *
 * ⚠ THE ONE THING THIS MUST NOT DO is swallow live text. `5A . . . as amended . . .` is V36's own
 * dangerous near-miss and must stay NOT-hollow: stripping `5A` leaves `as amended`, which still
 * carries two-letter words. The strip is bounded to a single leading token of digits-then-letters,
 * so it can never reach a word that starts with a letter.
 */
const PROVISION_LABEL = /^(?:article|regulation|section|paragraph|schedule|rule|part|chapter|annex|title)\b/i
/** A provision number with its optional inserted-provision suffix: 12, 12A, 12ZA, 234ZA, 502GC. */
const PROVISION_NUMBER = /^\s*\d+[A-Za-z]*\b/

export function isRepealedPlaceholder(text: string): boolean {
  const t = text.trim()
  if (!t) return false                    // empty is a different state — not this one
  if (!/[.·…]/.test(t)) return false      // no dot leader at all
  const body = t.replace(PROVISION_LABEL, '').replace(PROVISION_NUMBER, '')
  return !/[A-Za-z]{2}/.test(body)        // no word of two or more letters anywhere else
}

/**
 * True when a section carries LIVE LAW WITH HOLES IN IT — a publisher dot leader marking removed
 * subsections, alongside text that still says something. C3 Lane B3.
 *
 * ⚠ THIS IS THE OTHER HALF OF `isRepealedPlaceholder`, AND THE TWO MUST NEVER SHARE A RULE. That
 * is not a style preference; it is the defect C2 Lane 2's own first detector shipped and its
 * negative control caught. A whole-body dot leader says nothing and must never be returned as an
 * answer. A partially repealed section is CURRENT LAW and must stay retrievable — suppressing it
 * would drop live law out of the corpus. The only thing they have in common is the punctuation.
 *
 * ⚠ NOTHING IN THE DATABASE DISTINGUISHES THEM TODAY. `section_repeals` holds 249,256 rows and
 * every single one carries `evidence = 'dot-leader-placeholder'`; there is no column for the
 * partial case and no row for it. C2 Lane 2 surfaced "~35,895 partially-repealed sections" as an
 * uncounted estimate — this predicate is what turns that into a measurement.
 *
 * ── THE DOT RUN IS A PUBLISHER LEADER, NOT AN ELLIPSIS ──────────────────────────────────────────
 * legislation.gov.uk renders a removed provision as SPACE-SEPARATED periods — `. . . .` — which is
 * why three-in-a-row with spaces is the signal and `...` is not. Requiring the spacing is what
 * keeps ordinary prose out: an elision inside a quotation, `e.g.`, and a run-on numbered list are
 * all common in this corpus and none of them produces `. . .`.
 *
 * ⚠ AND IT EXCLUDES THE WHOLE-BODY CASE BY CONSTRUCTION rather than by a separate call site, so
 * the two populations cannot overlap however the callers are wired.
 */
const DOT_LEADER_RUN = /[.·](?:\s+[.·]){2,}/

export function isPartiallyRepealed(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (!DOT_LEADER_RUN.test(t)) return false      // no publisher leader → not this
  if (isRepealedPlaceholder(t)) return false     // says nothing at all → the OTHER population
  return true                                    // a leader, and live words beside it
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
