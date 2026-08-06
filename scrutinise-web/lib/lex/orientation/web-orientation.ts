// ─────────────────────────────────────────────────────────────────────────────
// §6d — the WEB half of orientation (Tier B). Gemini Google-grounding: the
// current web state — news, government announcements, consultations, academia,
// and comparative/foreign practice.
//
// ⚠ TWO CALLS, FOR A MEASURED REASON, NOT A STYLISTIC ONE.
// Gemini rejects grounding and JSON mode together:
//
//     tools:[{google_search:{}}] + responseMimeType:'application/json'
//     → HTTP 400 "Tool use with a response mime type: 'application/json' is
//       unsupported"   (probed 2026-08-06; also true with no responseSchema)
//
// This is the same wall the stats tool hit (`query_stats`, LEX_PLAYBOOK §13) and
// it is answered the same way: one call does the grounded work, a second,
// tools-free call turns the result into schema-validated JSON.
//
// The second call is also the SAFETY step, not just a formatting step. It is
// given the numbered list of sources Google actually grounded on and may only
// cite by index into that list. A URL the model writes itself cannot survive:
// an out-of-range index drops the item. That is what stops "dated, cited" from
// meaning "dated and cited to a plausible-looking URL that does not exist".
//
// Config:
//   ORIENTATION_WEB_MODEL       default gemini-2.5-flash
//   ORIENTATION_WEB_TIMEOUT_MS  default 40000 (PER CALL — the grounded call
//                               measured 18–34s on its own, so 30s left no margin.
//                               The whole stage is separately bounded by
//                               ORIENTATION_TOTAL_BUDGET_MS in index.ts.)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ComparativeItem, OrientationSource, RecencyItem, RecencyScan, VoiceItem, ArgumentItem,
} from './types'
import { EMPTY_RECENCY, toStance } from './types'
import { dedupeRecency, normaliseDate, withinWindow } from './noise-filter'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface WebOrientationOutput {
  recency: RecencyScan
  comparative: ComparativeItem[]
  /** Tier B arguments — the published case for and against. */
  argumentsMined: ArgumentItem[]
  costUsd: number
}

export const EMPTY_WEB: WebOrientationOutput = {
  recency: EMPTY_RECENCY, comparative: [], argumentsMined: [], costUsd: 0,
}

// gemini-2.5-flash list price, USD per 1M tokens (docs, 2026-08-06). Used only to
// report spend; nothing branches on it.
const FLASH_IN_PER_M = 0.3
const FLASH_OUT_PER_M = 2.5

// Gemini's responseSchema is the OpenAPI subset — no additionalProperties, and
// `integer` rather than `number` where an int is meant.
const ITEM = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    detail: { type: 'string' },
    date: { type: 'string' },
    sourceIndex: { type: 'integer' },
  },
  required: ['headline', 'detail', 'date', 'sourceIndex'],
}

const STRUCTURE_SCHEMA = {
  type: 'object',
  properties: {
    recentDevelopments: { type: 'array', items: ITEM },
    liveControversies: { type: 'array', items: ITEM },
    politicalRisks: { type: 'array', items: ITEM },
    whoIsTalking: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          who: { type: 'string' },
          position: { type: 'string' },
          date: { type: 'string' },
          sourceIndex: { type: 'integer' },
        },
        required: ['who', 'position', 'date', 'sourceIndex'],
      },
    },
    comparativePractice: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          jurisdiction: { type: 'string' },
          whatTheyDid: { type: 'string' },
          outcome: { type: 'string' },
          date: { type: 'string' },
          sourceIndex: { type: 'integer' },
        },
        required: ['jurisdiction', 'whatTheyDid', 'outcome', 'date', 'sourceIndex'],
      },
    },
    argumentsForAndAgainst: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          reason: { type: 'string' },
          stance: { type: 'string', enum: ['for', 'against', 'nuanced'] },
          date: { type: 'string' },
          sourceIndex: { type: 'integer' },
        },
        required: ['claim', 'reason', 'stance', 'date', 'sourceIndex'],
      },
    },
    salience: { type: 'integer' },
  },
  required: [
    'recentDevelopments', 'liveControversies', 'politicalRisks', 'whoIsTalking',
    'comparativePractice', 'argumentsForAndAgainst', 'salience',
  ],
}

// ⚠ COMPACT BULLETS AND PER-SECTION CAPS ARE LOad-BEARING, NOT HOUSE STYLE.
// The first version of this prompt asked for six sections of open-ended prose and
// hit finishReason MAX_TOKENS on EVERY call at 4096 output tokens (probed four
// ways, 2026-08-06). A truncated grounded response sometimes comes back with no
// groundingMetadata at all — and with no grounding chunks there is nothing to
// cite, so the whole Tier B half was being discarded intermittently. Caps + an
// 8192 budget produced finishReason STOP and 28–37 chunks on every repeat.
function groundedPrompt(recencyDays: number): string {
  return `You are a UK policy researcher preparing background for someone developing a legislative proposal.

Search the web and report, in COMPACT BULLETS — one or two sentences each, no preamble, no closing summary:
1. RECENT DEVELOPMENTS (max 6) — what has happened on this in the last ${recencyDays} days: government announcements, consultations, published reviews, litigation, new rules, incidents that moved the issue.
2. LIVE CONTROVERSIES (max 4) — what is actually contested right now, and by whom.
3. POLITICAL RISKS (max 4) — where a proposal in this area would meet resistance, and from which quarter.
4. WHO IS TALKING (max 6) — the named organisations, ministers, committees, campaigners and academics engaging with it, and the position each takes.
5. COMPARATIVE PRACTICE (max 4) — what other jurisdictions have done about the same problem and how it went. Not time-bounded.
6. ARGUMENTS FOR AND AGAINST (max 6) — the strongest published case on each side, each with the reason given. Not time-bounded.

Watch particularly for anything that CHANGES THE INSTITUTIONAL PICTURE — a regulator being abolished, merged or replaced, a bill in progress, a white paper, a commencement date, a policy reversal. A briefing that describes a regulator which is being wound up is worse than no briefing.

Rules: UK-focused unless the item is explicitly comparative. Give a date for every item — if you cannot date it, leave it out. State what sources say; do not adjudicate. Be concrete: named bodies, named instruments, real dates. Do not write an introduction or a conclusion.`
}

const STRUCTURE_SYSTEM = `You convert a research note into JSON. You add NOTHING. Every item must already appear in the note.

You are given a numbered SOURCES list. \`sourceIndex\` must be the number of the source that supports that item. If no source in the list supports an item, omit the item entirely — never guess an index and never invent a URL.

Every item needs a real date in yyyy-mm-dd form. If the note gives only a month or a year, use the first day of it. If the note gives no date at all, omit the item.

\`salience\` is 0–3: 0 = nothing is happening in this area right now; 1 = occasional coverage; 2 = actively discussed; 3 = a live, contested issue in the news now.`

interface GeminiCallResult {
  text: string
  sources: OrientationSource[]
  costUsd: number
}

async function callGemini(opts: {
  model: string
  apiKey: string
  timeoutMs: number
  system?: string
  user: string
  grounded: boolean
  schema?: object
  maxOutputTokens: number
}): Promise<GeminiCallResult | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: opts.maxOutputTokens,
        ...(opts.schema
          ? { responseMimeType: 'application/json', responseSchema: opts.schema, thinkingConfig: { thinkingBudget: 0 } }
          : {}),
      },
    }
    if (opts.system) body.system_instruction = { parts: [{ text: opts.system }] }
    // Grounding and JSON mode are mutually exclusive — see the header note.
    if (opts.grounded) body.tools = [{ google_search: {} }]

    const res = await fetch(`${GEMINI_BASE}/${opts.model}:generateContent?key=${opts.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.warn('[orientation:web] gemini HTTP', res.status, (await res.text()).slice(0, 300))
      return null
    }
    type Resp = {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> }
      }>
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
    }
    const data = (await res.json()) as Resp
    const cand = data.candidates?.[0]
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('')
    const chunks = cand?.groundingMetadata?.groundingChunks ?? []
    const sources: OrientationSource[] = chunks
      .map((c) => c.web)
      .filter((w): w is { uri?: string; title?: string } => !!w)
      .map((w) => ({ label: (w.title ?? '').trim() || 'web source', url: (w.uri ?? '').trim(), date: '', tier: 'B' as const }))
      .filter((s) => s.url.length > 0)
    const inTok = data.usageMetadata?.promptTokenCount ?? 0
    const outTok = data.usageMetadata?.candidatesTokenCount ?? 0
    const costUsd = (inTok * FLASH_IN_PER_M + outTok * FLASH_OUT_PER_M) / 1_000_000
    if (!text.trim()) return null
    return { text, sources, costUsd }
  } catch (err) {
    console.warn('[orientation:web] failed:', err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface RawItem { headline?: unknown; detail?: unknown; date?: unknown; sourceIndex?: unknown }

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }

/**
 * Resolve one structured item against the VERIFIED source list. Returns null —
 * i.e. the item is dropped — when the date is unusable or the index does not
 * point at a source Google actually grounded on.
 */
function resolve(
  raw: RawItem, sources: OrientationSource[],
): { headline: string; detail: string; date: string; source: OrientationSource } | null {
  const headline = str(raw.headline)
  const date = normaliseDate(raw.date)
  const idx = typeof raw.sourceIndex === 'number' ? Math.trunc(raw.sourceIndex) : NaN
  if (!headline || !date) return null
  const source = sources[idx - 1]
  if (!source) return null
  return { headline, detail: str(raw.detail), date, source: { ...source, date } }
}

/**
 * Run the web (Tier B) orientation pass. Returns null on failure — the caller
 * records that the call did not complete, which is a different fact from "the
 * web had nothing to say".
 */
export async function runWebOrientation(
  topic: string,
  ideaContext: string,
  recencyDays: number,
): Promise<WebOrientationOutput | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[orientation:web] GEMINI_API_KEY not set — web orientation skipped')
    return null
  }
  const model = process.env.ORIENTATION_WEB_MODEL ?? 'gemini-2.5-flash'
  // Kept BELOW the stage budget in index.ts, so one hung call cannot consume the
  // whole stage: the budget is the outer bound, this is the inner one.
  const timeoutMs = parseInt(process.env.ORIENTATION_WEB_TIMEOUT_MS ?? '40000', 10)

  // Call 1 — grounded. Prose out, plus the sources Google actually used.
  const userMessage = [
    `Policy idea: ${topic}`,
    ideaContext ? `Context the person gave: ${ideaContext}` : '',
  ].filter(Boolean).join('\n')

  const ground = () => callGemini({
    model, apiKey, timeoutMs,
    system: groundedPrompt(recencyDays),
    user: userMessage,
    grounded: true,
    maxOutputTokens: 8192,
  })

  // A "grounded" answer with no grounding chunks is the model answering from
  // memory. Tier B means CITED; with no sources there is nothing to cite, so it
  // is discarded rather than downgraded. Whether the model searches at all is
  // its own decision and is observably non-deterministic on identical input, so
  // one retry — and only one, logged, never a loop.
  let grounded = await ground()
  if (grounded && !grounded.sources.length) {
    console.warn('[orientation:web] grounded call returned no grounding chunks — retrying once')
    grounded = await ground()
  }
  if (!grounded) return null
  if (!grounded.sources.length) {
    console.warn('[orientation:web] grounded call returned no grounding chunks on retry — discarding')
    return null
  }

  // Call 2 — structure. No tools, so JSON mode is available. The model may only
  // cite by index into the list below.
  const sourceList = grounded.sources
    .map((s, i) => `${i + 1}. ${s.label} — ${s.url}`)
    .join('\n')
  const structured = await callGemini({
    model, apiKey, timeoutMs,
    system: STRUCTURE_SYSTEM,
    user: `RESEARCH NOTE:\n${grounded.text}\n\nSOURCES:\n${sourceList}`,
    grounded: false,
    schema: STRUCTURE_SCHEMA,
    maxOutputTokens: 8192,
  })
  if (!structured) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(structured.text) as Record<string, unknown>
  } catch {
    console.warn('[orientation:web] structuring call returned unparseable JSON')
    return null
  }

  const arr = (v: unknown): RawItem[] => (Array.isArray(v) ? (v as RawItem[]) : [])
  const toRecency = (v: unknown, windowed: boolean): RecencyItem[] =>
    arr(v)
      .map((r) => resolve(r, grounded.sources))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => !windowed || withinWindow(r.date, recencyDays))
      .map((r) => ({ headline: r.headline, detail: r.detail, date: r.date, tier: 'B' as const, source: r.source }))

  // §6d.1: the recency bound applies to the RECENCY SCAN only. Developments and
  // controversies are windowed; political risks are the standing shape of the
  // opposition and are not (a risk does not stop being a risk at 91 days).
  const recentDevelopments = dedupeRecency(toRecency(parsed.recentDevelopments, true), (i) => `${i.headline} ${i.detail}`)
  const liveControversies = dedupeRecency(toRecency(parsed.liveControversies, true), (i) => `${i.headline} ${i.detail}`)
  const politicalRisks = dedupeRecency(toRecency(parsed.politicalRisks, false), (i) => `${i.headline} ${i.detail}`)

  const whoIsTalking: VoiceItem[] = arr(parsed.whoIsTalking)
    .map((raw): VoiceItem | null => {
      const r = raw as { who?: unknown; position?: unknown; date?: unknown; sourceIndex?: unknown }
      const who = str(r.who)
      const date = normaliseDate(r.date)
      const idx = typeof r.sourceIndex === 'number' ? Math.trunc(r.sourceIndex) : NaN
      const source = grounded.sources[idx - 1]
      if (!who || !date || !source) return null
      return { who, position: str(r.position), date, tier: 'B', source: { ...source, date } }
    })
    .filter((v): v is VoiceItem => v !== null)

  const comparative: ComparativeItem[] = arr(parsed.comparativePractice)
    .map((raw): ComparativeItem | null => {
      const r = raw as { jurisdiction?: unknown; whatTheyDid?: unknown; outcome?: unknown; date?: unknown; sourceIndex?: unknown }
      const jurisdiction = str(r.jurisdiction)
      const date = normaliseDate(r.date)
      const idx = typeof r.sourceIndex === 'number' ? Math.trunc(r.sourceIndex) : NaN
      const source = grounded.sources[idx - 1]
      if (!jurisdiction || !date || !source) return null
      return { jurisdiction, whatTheyDid: str(r.whatTheyDid), outcome: str(r.outcome), date, tier: 'B', source: { ...source, date } }
    })
    .filter((c): c is ComparativeItem => c !== null)

  const argumentsMined: ArgumentItem[] = arr(parsed.argumentsForAndAgainst)
    .map((raw): ArgumentItem | null => {
      const r = raw as { claim?: unknown; reason?: unknown; stance?: unknown; date?: unknown; sourceIndex?: unknown }
      const claim = str(r.claim)
      const date = normaliseDate(r.date)
      const stance = toStance(r.stance)
      const idx = typeof r.sourceIndex === 'number' ? Math.trunc(r.sourceIndex) : NaN
      const source = grounded.sources[idx - 1]
      if (!claim || !date || !stance || !source) return null
      return { claim, reason: str(r.reason), stance, date, tier: 'B', source: { ...source, date }, repetitions: 1 }
    })
    .filter((a): a is ArgumentItem => a !== null)

  const salienceRaw = typeof parsed.salience === 'number' ? Math.trunc(parsed.salience) : 0
  const salience = Math.max(0, Math.min(3, salienceRaw)) as 0 | 1 | 2 | 3

  // sources[] is the set actually CITED by a surviving item, each carrying that
  // item's date (§6d.1 "sources[] each with date"). A grounding chunk nothing
  // ended up citing is not a source of anything and is not listed — a source
  // list padded with unused chunks would overstate what the pass found.
  const citedSources: OrientationSource[] = []
  for (const s of [
    ...recentDevelopments.map((i) => i.source),
    ...liveControversies.map((i) => i.source),
    ...politicalRisks.map((i) => i.source),
    ...whoIsTalking.map((i) => i.source),
  ]) {
    if (!citedSources.some((c) => c.url === s.url && c.date === s.date)) citedSources.push(s)
  }

  return {
    recency: {
      recentDevelopments, liveControversies, politicalRisks, whoIsTalking,
      salience,
      sources: citedSources,
    },
    comparative,
    argumentsMined,
    costUsd: grounded.costUsd + structured.costUsd,
  }
}
