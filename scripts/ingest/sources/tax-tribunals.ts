/**
 * tax-tribunals.ts — financeandtax.decisions.tribunals.gov.uk (V20 probe 2,
 * approved tax source with standing auto-upgrade).
 *
 * The HMCTS finance & tax decisions archive: VAT & Duties, Special
 * Commissioners, Customs/Excise + modern FTT (Tax Chamber) TC decisions —
 * Apr 2003 → present (id 13,037 = TC 09248, 11 Jun 2024 at probe time; the
 * archive is continuously updated, far deeper than FCL's ukftt/tc coverage).
 *
 * Route (verified 12 Jun 2026): GET /Aspx/view.aspx?id={N} for N in 1..max —
 * plain GET, honest UA accepted (only the WebForms search POST is UA-fussy;
 * we never need it — the id space is dense). Decision files live under
 * /judgmentfiles/j{id}/{file}.doc (OLE2 Word — word-extractor) or .pdf.
 * Universe at probe time: max id 13,037 (binary-searched; 13,038 invalid).
 */
import { AdaptiveThrottle } from '../shared/adaptive-throttle'
import { suspendSource } from '../shared/queue-client'

const BASE = 'https://financeandtax.decisions.tribunals.gov.uk'
const UA = 'Scrutinise-Ingest/1.0 (legal corpus research)'
const FETCH_TIMEOUT_MS = 60_000

const throttle = new AdaptiveThrottle({
  floor: 1000,
  suspendThresholdMs: 60_000,
  onSuspend: (delayMs) => {
    suspendSource('tax-tribunals', delayMs * 2)
      .catch(err => console.warn('[tax-tribunals] suspend write failed:', err))
  },
})

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

export interface TaxTribunalDecision {
  id: number
  decisionNumber: string | null
  appellant: string | null
  respondent: string | null
  chairmen: string | null
  decisionDate: string | null   // YYYY-MM-DD
  category: string | null
  subcategory: string | null
  fileUrls: string[]            // absolute URLs under /judgmentfiles/
  // true when the id resolved but carries no decision metadata (gap in id space)
  empty: boolean
}

function field(html: string, label: string): string | null {
  // Metadata renders as <td>Label:</td><td>value</td>; labels may contain <br>
  // between words (e.g. "Chairmen / Special<br>Commissioners:").
  const labelRx = label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/\s+/g, '(?:\\s|<br\\s*/?>)*')
  const rx = new RegExp(`${labelRx}\\s*:\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i')
  const m = rx.exec(html)
  if (!m) return null
  const v = m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return v || null
}

export async function fetchTaxTribunalDecision(id: number): Promise<TaxTribunalDecision | null> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/Aspx/view.aspx?id=${id}`, { signal, headers: { 'User-Agent': UA } })
    clear()
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    const html = await res.text()
    if (!/Decision Number\s*:/i.test(html)) {
      return { id, decisionNumber: null, appellant: null, respondent: null, chairmen: null, decisionDate: null, category: null, subcategory: null, fileUrls: [], empty: true }
    }
    const rawDate = field(html, 'Date Of Decision')
    let decisionDate: string | null = null
    const dm = rawDate ? /([0-9]{2})\/([0-9]{2})\/([0-9]{4})/.exec(rawDate) : null
    if (dm) decisionDate = `${dm[3]}-${dm[2]}-${dm[1]}`
    const fileUrls = [...html.matchAll(/href="([^"]*judgmentfiles\/[^"]+)"/gi)]
      .map(m => new URL(m[1], `${BASE}/Aspx/`).toString())
    return {
      id,
      decisionNumber: field(html, 'Decision Number'),
      appellant: field(html, 'Appellant'),
      respondent: field(html, 'Respondent'),
      chairmen: field(html, 'Chairmen / Special Commissioners'),
      decisionDate,
      category: field(html, 'Main Category'),
      subcategory: field(html, 'Main Subcategory'),
      fileUrls: [...new Set(fileUrls)],
      empty: false,
    }
  } catch (err) {
    clear()
    console.warn(`[tax-tribunals] fetch error id=${id}: ${err}`)
    return null
  }
}

export async function fetchTaxTribunalFile(url: string): Promise<Buffer | null> {
  await throttle.wait()
  const { signal, clear } = withTimeout(FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal, headers: { 'User-Agent': UA } })
    clear()
    if (res.status === 429 || res.status === 503) { throttle.backoff(); return null }
    if (!res.ok) return null
    throttle.success()
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    clear()
    console.warn(`[tax-tribunals] file fetch error ${url}: ${err}`)
    return null
  }
}

// OLE2 .doc → text via word-extractor (pure JS; no PowerShell/binary helpers
// in ingest pipelines — CLAUDE.md §14 long-term remediation).
export async function docToText(buf: Buffer): Promise<string | null> {
  try {
    const { default: WordExtractor } = await import('word-extractor')
    const extractor = new WordExtractor()
    const doc = await extractor.extract(buf)
    const text = doc.getBody()
    return text && text.trim().length > 0 ? text : null
  } catch (err) {
    console.warn(`[tax-tribunals] doc extraction failed: ${err}`)
    return null
  }
}
