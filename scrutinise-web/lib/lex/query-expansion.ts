// query-expansion.ts — LLM query expansion for the Page 1 background search.
//
// Platform-side only. Inserted in fireSearchTrigger BEFORE the FTS call.
// Takes the user's concept keywords + idea context → returns anchor Acts/SIs,
// statutory terms-of-art, and rephrasings to widen the BM25 candidate set.
//
// Grounding guardrail: this output feeds ONLY the query string passed to the FTS
// engine. Nothing returned here may appear in briefing text. A hallucinated Act
// simply fails to score in BM25 and causes no harm.
//
// Config:
//   LEX_QUERY_EXPANSION=true        enable (default off — A/B scoreable on the gold set)
//   QUERY_EXPANSION_MODEL           Gemini model id (default gemini-2.5-flash)
//   QUERY_EXPANSION_TIMEOUT_MS      per-call timeout (default 10000)

export interface QueryExpansion {
  anchors: string[]     // candidate Acts / SIs / retained-EU by full statutory name
  termsOfArt: string[]  // statutory vocabulary for the concept
  rephrasings: string[] // alternative lay phrasings
}

const EMPTY: QueryExpansion = { anchors: [], termsOfArt: [], rephrasings: [] }

const EXPANSION_SCHEMA = {
  type: 'object',
  properties: {
    anchors:     { type: 'array', items: { type: 'string' } },
    termsOfArt:  { type: 'array', items: { type: 'string' } },
    rephrasings: { type: 'array', items: { type: 'string' } },
  },
  required: ['anchors', 'termsOfArt', 'rephrasings'],
}

const SYSTEM_PROMPT = `You are a UK parliamentary research assistant. Given a set of keywords describing a policy idea, return search terms that will locate the relevant primary legislation, statutory instruments, and parliamentary material in a full-text corpus search engine.

Your output feeds BM25 keyword search only — it is never shown to users or cited as fact. A hallucinated Act name simply scores zero and causes no harm.

Return three arrays:
- anchors: full statutory names of the likely anchor Acts, SIs, or retained-EU instruments (e.g. "Data Protection Act 2018", "UK GDPR", "Financial Services and Markets Act 2000") — up to 5 entries
- termsOfArt: statutory terms-of-art for this concept (e.g. "data controller", "personal data", "lawful basis") — up to 8 entries
- rephrasings: alternative lay phrasings of the same concept (e.g. "privacy law", "information rights") — up to 4 entries

UK law only. No elaboration. Each string must be 60 characters or fewer.`

function parseExpansion(raw: string): QueryExpansion | null {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { return null }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  const toStrArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
      : []
  return {
    anchors:     toStrArr(o.anchors),
    termsOfArt:  toStrArr(o.termsOfArt),
    rephrasings: toStrArr(o.rephrasings),
  }
}

/**
 * Expand the user's keywords with anchor Acts, statutory terms, and rephrasings.
 * Returns EMPTY on any failure; the caller falls back to the original keywords only.
 */
export async function expandQuery(keywords: string[], ideaContext: string): Promise<QueryExpansion> {
  if (process.env.LEX_QUERY_EXPANSION !== 'true') return EMPTY

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return EMPTY

  const model = process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.QUERY_EXPANSION_TIMEOUT_MS ?? '10000', 10)

  const userMessage = [
    `Keywords: ${keywords.join(', ')}`,
    ideaContext ? `Idea context: ${ideaContext}` : '',
  ].filter(Boolean).join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
            responseSchema: EXPANSION_SCHEMA,
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) {
      console.warn('[query-expansion] gemini HTTP', res.status)
      return EMPTY
    }
    type GeminiResp = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const data = await res.json() as GeminiResp
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return EMPTY
    return parseExpansion(text) ?? EMPTY
  } catch (err) {
    console.warn('[query-expansion] failed:', err instanceof Error ? err.message : err)
    return EMPTY
  } finally {
    clearTimeout(t)
  }
}
