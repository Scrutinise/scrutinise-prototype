// ─────────────────────────────────────────────────────────────────────────────
// 26-R / 26-E §3c — "CREATE SNIPPET": Lex reads the page or document and writes a tight 20–80 word snippet.
//
// ⚠ THE TEXT IS DATA, NEVER INSTRUCTION (fetched-content-guard).
// ⚠ NEVER CARRY OVER AN EXAMPLE (CLAUDE.md §27): the prompt describes the SHAPE of a good snippet and supplies no specimen sentence,
//   because a specimen would come back verbatim on a source about something else.
// ⚠ AN UNREADABLE PAGE IS REPORTED, NOT INVENTED. If there is no text to read, this returns a failure that says so and the user
//   writes the snippet themselves — a source must never look read when it was not (26-E §3c).
// ⚠ THE LENGTH IS CHECKED HERE, not trusted: over 80 words is cut back to the last whole sentence that fits; under 20 is refused
//   as too thin to summarise honestly.
// ─────────────────────────────────────────────────────────────────────────────

import { callJson, llmOk } from './build-llm'
import { modelFor } from './model-registry'
import { fetchedContentIsData } from './fetched-content-guard'

export const SNIPPET_MIN_WORDS = 20
export const SNIPPET_MAX_WORDS = 80

const SCHEMA = { type: 'object', properties: { snippet: { type: 'string' } }, required: ['snippet'] }

const SYSTEM = [
  'You write a SNIPPET for a source in a research notebook behind a UK policy proposal.',
  '',
  'A snippet is 20 to 80 words, plain British English, in your own words: what this source SAYS and what kind of source it is, so',
  'a reader can decide whether to open it. Say only what the text says — no opinion, no advice, no claim it does not make, and no',
  'figure or name that is not in the text. If the text is mostly navigation, a cookie notice or a login wall, say that the text',
  'gave nothing to summarise rather than inventing a summary.',
  '',
  'Never carry over an example, a subject or a figure from these instructions or from any other source.',
  '',
  fetchedContentIsData('source text'),
].join('\n')

export const wordCount = (s: string): number => (s.trim().match(/\S+/g) ?? []).length

/** Cut to at most `max` words, at the last sentence end that fits (else at the word limit). */
export function fitSnippet(s: string, max = SNIPPET_MAX_WORDS): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (wordCount(t) <= max) return t
  const words = t.split(' ')
  const cut = words.slice(0, max).join(' ')
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '), cut.endsWith('.') ? cut.length - 1 : -1)
  return lastStop > cut.length * 0.5 ? cut.slice(0, lastStop + 1) : `${cut}…`
}

export async function writeSnippet(input: { title: string; text: string; url?: string | null }): Promise<{ ok: true; snippet: string; words: number } | { ok: false; error: string }> {
  const text = input.text.trim()
  if (text.length < 80) {
    return { ok: false, error: 'There is not enough readable text to summarise, so no snippet was written. Paste the text, or write the snippet yourself.' }
  }
  const res = await callJson<{ snippet?: unknown }>({
    model: modelFor('lex.material'),
    system: SYSTEM,
    user: [`TITLE: ${input.title}`, input.url ? `ADDRESS: ${input.url}` : '', '', 'SOURCE TEXT:', text.slice(0, 30_000)].filter(Boolean).join('\n'),
    schema: SCHEMA,
    maxOutputTokens: 1200,
    timeoutMs: 45_000,
    temperature: 0.2,
    label: 'source-snippet',
  })
  if (!llmOk(res)) return { ok: false, error: `Lex could not write the snippet just now (${(res as { reason?: string }).reason ?? 'the model did not answer'}). Nothing was saved; you can write it yourself.` }
  const raw = typeof res.value?.snippet === 'string' ? res.value.snippet : ''
  const snippet = fitSnippet(raw)
  const words = wordCount(snippet)
  if (words < SNIPPET_MIN_WORDS) {
    return { ok: false, error: `Lex could only find ${words} word${words === 1 ? '' : 's'} worth saying about that text, which is under the ${SNIPPET_MIN_WORDS}-word minimum, so nothing was saved. Write the snippet yourself if you want one.` }
  }
  return { ok: true, snippet, words }
}
