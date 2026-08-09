// ─────────────────────────────────────────────────────────────────────────────
// §20.5 — feedback capture. Two jobs, deliberately separated:
//
//   1. `scrubPersonal`  — DETERMINISTIC removal of structured personal identifiers
//      (emails, phones, postcodes, NI numbers, long digit runs, addresses, the
//      user's own name/handle). Regex catches exactly the class a model is most
//      likely to copy through verbatim, and it is repeatable and testable.
//   2. `summariseCritique` — the MODEL pass, which does the thing regex cannot:
//      drop names of third parties, personal circumstance and anything narrative
//      that identifies someone, and compress the critique to its substance.
//
// Neither is trusted alone. The model output is scrubbed AGAIN before it is shown
// to the user, and the submitted text is scrubbed a THIRD time server-side before
// anything is stored or sent — because between (1) and the send there is a text
// box the user can type into.
// ─────────────────────────────────────────────────────────────────────────────

import { SURFACE_LABELS, type FeedbackSurfaceKey } from './feedback-types'
import { geminiFinishProblem } from './gemini-finish'

export { FEEDBACK_SURFACES, SURFACE_LABELS } from './feedback-types'
export type { FeedbackSurfaceKey } from './feedback-types'

export interface Redaction {
  kind: string
  count: number
}

export interface ScrubResult {
  text: string
  redactions: Redaction[]
}

// Each rule is (kind, pattern, replacement). Order matters: the most specific
// patterns run first so a postcode inside an address is not half-eaten by the
// digit-run rule.
const RULES: { kind: string; re: RegExp; to: string }[] = [
  { kind: 'email', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/gi, to: '[email removed]' },
  {
    // Deliberately looser than the real NI-number alphabet (which excludes D, F,
    // I, Q, U, V from the prefix). Someone typing their number from memory can
    // get a letter wrong, and the shape is distinctive enough that over-capturing
    // costs nothing — whereas under-capturing means a real NI number is emailed.
    kind: 'national insurance number',
    re: /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi,
    to: '[NI number removed]',
  },
  {
    kind: 'UK postcode',
    re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi,
    to: '[postcode removed]',
  },
  {
    kind: 'phone number',
    re: /(?:\+44\s?|\b0)(?:\d[\s-]?){9,10}\d\b/g,
    to: '[phone number removed]',
  },
  {
    kind: 'street address',
    re: /\b\d{1,4}[A-Za-z]?\s+(?:[A-Z][a-z]+\s+){0,3}(?:Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Close|Drive|Dr|Way|Court|Ct|Crescent|Terrace|Place|Gardens|Grove|Park|Row|Hill|Square)\b/g,
    to: '[address removed]',
  },
  {
    kind: 'date of birth',
    re: /\b(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)?\d{2}\b/g,
    to: '[date removed]',
  },
  {
    kind: 'card or account number',
    re: /\b(?:\d[ -]?){12,19}\b/g,
    to: '[number removed]',
  },
  { kind: 'long reference number', re: /\b\d{8,}\b/g, to: '[number removed]' },
  { kind: 'social handle', re: /(^|[\s(])@[A-Za-z0-9_]{2,30}\b/g, to: '$1[handle removed]' },
]

/** Escape a literal for use inside a RegExp. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Remove structured personal identifiers. `identities` are the user's own strings
 * (name, username, email, preferred name) — the one category we can name exactly,
 * so we do, rather than hoping the model spots them.
 */
export function scrubPersonal(input: string, identities: (string | null | undefined)[] = []): ScrubResult {
  let text = input
  const redactions: Redaction[] = []

  const apply = (kind: string, re: RegExp, to: string) => {
    const matches = text.match(re)
    if (!matches || matches.length === 0) return
    text = text.replace(re, to)
    const existing = redactions.find((r) => r.kind === kind)
    if (existing) existing.count += matches.length
    else redactions.push({ kind, count: matches.length })
  }

  for (const rule of RULES) apply(rule.kind, rule.re, rule.to)

  // The user's own identifiers, longest first so "Charlie Lawrence" goes before "Charlie".
  const names = identities
    .filter((s): s is string => typeof s === 'string' && s.trim().length >= 3)
    .flatMap((s) => [s.trim(), ...s.trim().split(/\s+/).filter((p) => p.length >= 3)])
    .sort((a, b) => b.length - a.length)
  for (const n of new Set(names)) {
    apply('name', new RegExp(`\\b${esc(n)}\\b`, 'gi'), '[name removed]')
  }

  return { text: text.replace(/[ \t]{2,}/g, ' ').trim(), redactions }
}

/** True when the deterministic rules still find something — used as a post-check. */
export function hasPersonalContent(text: string, identities: (string | null | undefined)[] = []): boolean {
  return scrubPersonal(text, identities).redactions.length > 0
}

// ── The model pass ───────────────────────────────────────────────────────────

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
  },
  required: ['summary'],
}

export interface SummariseResult {
  /** What will be shown to the user, verbatim, before anything is sent. */
  summarisedText: string
  /** What the deterministic pass took out, so the user can be told plainly. */
  redactions: Redaction[]
  /** True when the model was unavailable and we fell back to the scrubbed original. */
  usedFallback: boolean
}

/**
 * Produce the summary the user is shown. Personal content is stripped twice:
 * deterministically on the way in, and deterministically again on the model's
 * output. Nothing here writes to the database or sends anything.
 */
export async function summariseCritique(input: {
  text: string
  surface: FeedbackSurfaceKey
  stage: string
  identities: (string | null | undefined)[]
}): Promise<SummariseResult> {
  const scrubbedIn = scrubPersonal(input.text, input.identities)

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.LEX_FEEDBACK_TIMEOUT_MS ?? '15000', 10)

  // Fallback: the user's own words, scrubbed. Honest and still useful — and the
  // user sees it before it goes anywhere, so consent is unaffected.
  const fallback = (): SummariseResult => ({
    summarisedText: scrubbedIn.text.slice(0, 1500),
    redactions: scrubbedIn.redactions,
    usedFallback: true,
  })

  if (!apiKey) return fallback()

  const system =
    'You are summarising a user\'s CRITICISM of an AI assistant\'s output on a UK civic policy ' +
    'platform, so the product team can act on it. Write 1–4 sentences in the third person, ' +
    'plain British English, stating what the user found wrong and what they expected instead. ' +
    'Keep the substance and the sharpness — do not soften the complaint, do not add praise, do ' +
    'not add anything they did not say. STRIP ALL PERSONAL CONTENT: no names of the user or of ' +
    'anyone else, no employers, job titles, locations, health or family details, no contact ' +
    'details, and no personal circumstances or anecdotes that could identify anyone. If the ' +
    'complaint only makes sense with a personal detail, describe it generically ("a user in ' +
    'their own case") rather than reproducing it. Return only the summary.'

  const user = [
    `Part of the output being criticised: ${SURFACE_LABELS[input.surface]}`,
    `Stage of the work: ${input.stage}`,
    `What the user said:\n${scrubbedIn.text}`,
  ].join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
            responseMimeType: 'application/json',
            responseSchema: SUMMARY_SCHEMA,
          },
        }),
      },
    )
    if (!res.ok) {
      console.warn('[lex-feedback] summarise HTTP', res.status)
      return fallback()
    }
    type Resp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = (await res.json()) as Resp
    // 600 tokens is the tightest budget of any JSON call in the app, so this is the one most
    // likely to hit the ceiling. Non-throwing: the fallback() degradation is kept, the guard
    // only stops the truncation arriving as a parse failure. See gemini-finish.ts.
    const cut = geminiFinishProblem(data?.candidates?.[0], 600, { label: 'lex-feedback' })
    if (cut) console.error(`[lex-feedback] summarise ${cut.reason} — ${cut.detail}`)
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof raw !== 'string') return fallback()
    const obj = JSON.parse(raw) as { summary?: unknown }
    if (typeof obj.summary !== 'string' || !obj.summary.trim()) return fallback()

    // Scrub the MODEL's output too. It is instructed to strip personal content; it
    // is not trusted to have done it.
    const scrubbedOut = scrubPersonal(obj.summary.trim(), input.identities)
    // Report every redaction the user's text needed, whichever pass caught it.
    const merged: Redaction[] = [...scrubbedIn.redactions]
    for (const r of scrubbedOut.redactions) {
      const e = merged.find((m) => m.kind === r.kind)
      if (e) e.count += r.count
      else merged.push(r)
    }
    return { summarisedText: scrubbedOut.text.slice(0, 1500), redactions: merged, usedFallback: false }
  } catch (err) {
    console.warn('[lex-feedback] summarise failed:', err instanceof Error ? err.message : err)
    return fallback()
  } finally {
    clearTimeout(t)
  }
}
