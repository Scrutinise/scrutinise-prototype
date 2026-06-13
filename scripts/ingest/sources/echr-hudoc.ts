/**
 * echr-hudoc.ts — HUDOC (ECHR case-law database), V22 revival.
 *
 * The V-era routes died Jun 2026 ("endpoint changed, 404"); the V20 probe
 * found the live ones and V22 implements them (re-verified 13 Jun 2026):
 *
 *   /app/query/results?query={q}&select=…&sort=&start&length
 *     — 200 JSON with browser UA + Referer. The OLD grammar (country:GBR)
 *       404s; the working grammar is field:"value" with contentsitename:
 *       `contentsitename:ECHR AND respondent:"GBR" AND languageisocode:"ENG"`
 *       = resultcount 4,471 (13 Jun 2026) — exactly the V20-measured GBR
 *       universe (584 of them documentcollectionid2:"JUDGMENTS").
 *   /app/conversion/pdf/?library=ECHR&id={itemid}
 *     — 200 real PDF (%PDF magic, ~350KB typical). html conversion 404s,
 *       docx 404s (V20 + 13 Jun re-verified).
 *
 * Licence (verified 13 Jun 2026, echr.coe.int/copyright-and-disclaimer):
 * website texts may be reproduced free of charge with source acknowledged
 * (© ECHR-CEDH) for private/information/education purposes; commercial use
 * requires prior written permission → licence code `echr-nc`.
 */
import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const HUDOC_BASE = 'https://hudoc.echr.coe.int'
// Browser UA + Referer are load-bearing: the honest ingest UA draws 404s on
// /app/query/results (V20 finding, re-verified 13 Jun 2026).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const HEADERS = { 'User-Agent': UA, Referer: `${HUDOC_BASE}/eng` }
const FETCH_TIMEOUT_MS = 60_000

const GBR_QUERY = 'contentsitename:ECHR AND respondent:"GBR" AND languageisocode:"ENG"'

const throttle = new AdaptiveThrottle({
  floor: 500,
  ceiling: 120_000, // must exceed suspendThresholdMs or onSuspend never fires (V22)
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('echr', delayMs * 2)
      .catch(err => console.warn('[echr] suspend write failed:', err))
  },
})

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

export interface EchrDoc {
  itemId: string
  docName: string
  date: string        // kpdate, e.g. '2025-09-23T00:00:00'
  docType: string     // HEJUD/HEDEC/CLIN/…
  importance: string
  url: string         // human page
}

async function queryResults(start: number, length: number, extraQuery?: string, sort = ''):
  Promise<{ resultcount: number; docs: EchrDoc[] } | null> {
  await throttle.wait()
  const q = extraQuery ? `${GBR_QUERY} AND ${extraQuery}` : GBR_QUERY
  const url = `${HUDOC_BASE}/app/query/results` +
    `?query=${encodeURIComponent(q)}` +
    `&select=itemid,docname,kpdate,doctype,importance&sort=${encodeURIComponent(sort)}&start=${start}&length=${length}`
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal, headers: HEADERS })
    clear()
    if (res.status === 429 || res.status === 503 || res.status === 403) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    const data = await res.json() as {
      resultcount?: number
      results?: Array<{ columns?: { itemid?: string; docname?: string; kpdate?: string; doctype?: string; importance?: string } }>
    }
    if (typeof data.resultcount !== 'number' || !Array.isArray(data.results)) return null
    const docs: EchrDoc[] = []
    for (const r of data.results) {
      const c = r.columns
      if (!c?.itemid) continue
      docs.push({
        itemId: c.itemid,
        docName: c.docname ?? '',
        date: c.kpdate ?? '',
        docType: c.doctype ?? '',
        importance: c.importance ?? '',
        url: `${HUDOC_BASE}/eng#{"itemid":["${c.itemid}"]}`,
      })
    }
    return { resultcount: data.resultcount, docs }
  } catch (err) {
    clear()
    throttle.backoff() // socket failure = rate signal
    console.warn(`[echr] query fetch error start=${start}: ${err}`)
    return null
  }
}

// Total GBR ENG docs (the corpus universe).
export async function countGbrDocs(): Promise<number | null> {
  const page = await queryResults(0, 1)
  return page ? page.resultcount : null
}

// One listing page of the GBR ENG universe — kpdate-sorted so pagination is
// stable across the enumeration walk (verified 13 Jun 2026).
export async function listGbrDocsPage(start: number, length = 50):
  Promise<{ resultcount: number; docs: EchrDoc[] } | null> {
  return queryResults(start, length, undefined, 'kpdate Ascending')
}

// Metadata for a single doc by itemid (1 fetch) — used by the processor so
// queue rows stay docId-only.
export async function getDocMeta(itemId: string): Promise<EchrDoc | null> {
  const page = await queryResults(0, 1, `itemid:"${itemId}"`)
  if (!page || page.docs.length === 0) return null
  return page.docs[0]
}

// Document text: PDF conversion is the only live format (html/docx 404).
export async function fetchDocPdf(itemId: string): Promise<Buffer | null> {
  await throttle.wait()
  const url = `${HUDOC_BASE}/app/conversion/pdf/?library=ECHR&id=${encodeURIComponent(itemId)}`
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal, headers: HEADERS })
    clear()
    if (res.status === 429 || res.status === 503 || res.status === 403) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    const buf = Buffer.from(await res.arrayBuffer())
    // soft-404 guard: the conversion endpoint can serve an HTML error page
    if (buf.length < 4 || buf.toString('latin1', 0, 4) !== '%PDF') return null
    return buf
  } catch (err) {
    clear()
    throttle.backoff()
    console.warn(`[echr] pdf fetch error ${itemId}: ${err}`)
    return null
  }
}
