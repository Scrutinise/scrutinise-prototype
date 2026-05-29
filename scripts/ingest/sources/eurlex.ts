import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const EUR_LEX_BASE = 'https://eur-lex.europa.eu'
const throttle = new AdaptiveThrottle({ floor: 500 })

export interface EurLexDoc {
  celexId: string
  title: string
  date: string
  url: string
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Scrutinise-Ingest/1.0', 'Accept-Language': 'en' },
  })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// Focus on instruments cross-referenced in UK legislation.gov.uk (eudn/eur/eudr types)
// These are the ~4,000 instruments that became UK retained EU law
// We enumerate from the EUR-Lex SPARQL endpoint (no auth required for basic queries)
const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'

async function sparqlQuery(query: string): Promise<{ results?: { bindings: Array<Record<string, { value: string }>> } } | null> {
  await throttle.wait()
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=application%2Fjson`
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Scrutinise-Ingest/1.0' } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (!res.ok) return null
  throttle.success()
  try { return await res.json() } catch { return null }
}

export async function* listRetainedEuInstruments(): AsyncGenerator<EurLexDoc> {
  // Query EUR-Lex for instruments classified as UK retained (using SPARQL)
  const query = `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT ?celexId ?title ?date WHERE {
      ?doc cdm:resource_legal_id_celex ?celexId ;
           cdm:work_title_alternative ?title ;
           cdm:work_date_document ?date .
      FILTER(LANG(?title) = "en")
      FILTER(STRSTARTS(?celexId, "3"))
    } LIMIT 100
  `
  const data = await sparqlQuery(query)
  for (const row of data?.results?.bindings ?? []) {
    const celexId = row.celexId?.value
    if (!celexId) continue
    yield {
      celexId,
      title: row.title?.value ?? '',
      date: row.date?.value ?? '',
      url: `${EUR_LEX_BASE}/legal-content/EN/TXT/HTML/?uri=CELEX:${celexId}`,
    }
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
