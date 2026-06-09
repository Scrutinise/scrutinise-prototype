import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const EUR_LEX_BASE = 'https://eur-lex.europa.eu'
// V6 3 Jun 2026: search.html?format=json now returns HTML (SPA redesign).
// REST API returns 404. Using CELLAR SPARQL endpoint instead — returns CELEX IDs
// for all series-3 (secondary legislation) items. ~232,000 items available.
const CELLAR_SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql'
const throttle = new AdaptiveThrottle({ floor: 500 })

export interface EurLexDoc {
  celexId: string
  title: string
  date: string
  url: string
}

const FETCH_TIMEOUT_MS = 30_000

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal, headers: { 'User-Agent': 'Scrutinise-Ingest/1.0', 'Accept-Language': 'en' } })
    clear()
    if (res.status === 429) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return res.text()
  } catch (err) { clear(); return null }
}

interface SparqlResult {
  results: { bindings: Array<{ celex: { value: string } }> }
}

// Fetch a page of CELEX IDs for series-3 (secondary legislation) via CELLAR SPARQL.
// page is 1-indexed; uses OFFSET pagination with pageSize=500.
// Note: SPARQL OFFSET without ORDER BY may not be stable across calls — r2Exists
// deduplication in processEurLex handles any overlap gracefully.
async function fetchCelexIds(page: number, pageSize: number): Promise<string[]> {
  await throttle.wait()
  const offset = (page - 1) * pageSize
  const query =
    `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>\n` +
    `SELECT ?celex WHERE {\n` +
    `  ?doc cdm:resource_legal_id_celex ?celex .\n` +
    `  FILTER(STRSTARTS(STR(?celex), "3"))\n` +
    `} LIMIT ${pageSize} OFFSET ${offset}`
  const url =
    `${CELLAR_SPARQL}?query=${encodeURIComponent(query)}&format=application%2Fsparql-results%2Bjson`
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, { signal, headers: { 'User-Agent': 'Scrutinise-Ingest/1.0', Accept: 'application/sparql-results+json' } })
  } catch { clear(); return [] }
  clear()
  if (res.status === 429) { throttle.backoff(); return [] }
  if (!res.ok) return []
  throttle.success()
  try {
    const data = await res.json() as SparqlResult
    return (data.results?.bindings ?? [])
      .map(b => b.celex?.value)
      .filter((v): v is string => !!v)
  } catch { return [] }
}

// Fetch a single page of EUR-Lex secondary legislation CELEX IDs (page is 1-indexed).
export async function* listRetainedEuPage(page: number, pageSize = 500): AsyncGenerator<EurLexDoc> {
  const celexIds = await fetchCelexIds(page, pageSize)
  for (const celexId of celexIds) {
    yield {
      celexId,
      title: '',
      date: '',
      url: `${EUR_LEX_BASE}/legal-content/EN/TXT/HTML/?uri=CELEX:${celexId}`,
    }
  }
}

// Paginate through all EUR-Lex series-3 secondary legislation CELEX IDs.
export async function* listRetainedEuInstruments(maxItems = 250_000): AsyncGenerator<EurLexDoc> {
  let page = 1
  const pageSize = 500
  let fetched = 0

  while (fetched < maxItems) {
    const celexIds = await fetchCelexIds(page, pageSize)
    if (celexIds.length === 0) break

    for (const celexId of celexIds) {
      yield {
        celexId,
        title: '',
        date: '',
        url: `${EUR_LEX_BASE}/legal-content/EN/TXT/HTML/?uri=CELEX:${celexId}`,
      }
      if (++fetched >= maxItems) return
    }

    if (celexIds.length < pageSize) break
    page++
  }
}

export async function fetchDocumentText(celexId: string): Promise<string | null> {
  const url = `${EUR_LEX_BASE}/legal-content/EN/TXT/HTML/?uri=CELEX:${celexId}`
  const html = await fetchHtml(url)
  if (!html) return null

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
