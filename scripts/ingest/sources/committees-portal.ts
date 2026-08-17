/**
 * committees-portal.ts — Parliamentary Committees portal scraper.
 *
 * Scrapes committees.parliament.uk/publications/ — freely accessible HTML portal.
 * Bypasses the api.parliament.uk which returns 403 from Railway IPs.
 *
 * Rate limit: 500ms between page requests. Max 3 concurrent workers.
 * Content: HTML at publications.parliament.uk (preferred), PDF fallback via portal redirect.
 *
 * Confirmed accessible (9 Jun 2026 V15):
 *   reports-responses:  9,959 publications, 498 pages
 *   other-publications: 40,794 publications, ~2,040 pages
 *
 * WHY browser User-Agent: committees.parliament.uk is behind Cloudflare bot protection.
 * Plain curl/Node fetch returns 403. Browser UA is sufficient — no JS rendering needed.
 */

const BASE_URL = 'https://committees.parliament.uk'
const CONTENT_BASE = 'https://publications.parliament.uk'

// WHY: committees.parliament.uk requires a browser-like User-Agent to bypass
// Cloudflare bot detection. No JS rendering needed — just the header.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

import { decodeForIndex } from '../shared/html-entities'

export type CommitteePublicationType = 'reports-responses' | 'other-publications'

export interface CommitteePublication {
  pubId: string
  docId: string
  title: string
  committeeNames: string[]
  publishedDate: string
  publicationType: string
  paperNumber: string
  pdfUrl: string | null    // absolute URL via committees.parliament.uk redirect
  htmlUrl: string | null   // absolute URL on publications.parliament.uk
  sourceUrl: string
}

/**
 * Fetch one listing page and extract all publication cards.
 * Returns empty array if page is empty or an error occurs.
 */
export async function listCommitteePublications(
  page: number,
  type: CommitteePublicationType = 'reports-responses',
): Promise<CommitteePublication[]> {
  const url = `${BASE_URL}/publications/${type}/?page=${page}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  })

  if (!res.ok) {
    throw new Error(`committees-portal: HTTP ${res.status} for ${url}`)
  }

  const html = await res.text()
  return parsePublicationCards(html, type)
}

/**
 * Parse publication cards from a listing page HTML.
 * Structure confirmed from live inspection (9 Jun 2026):
 *   <div class="card card-button card-publication">
 *     <div class="primary-info">{title}</div>
 *     <div class="dropdown-menu">
 *       <a href="/publications/{pubId}/documents/{docId}/default/">Open PDF</a>
 *       <a href="https://publications.parliament.uk/...">Open HTML</a>
 *     </div>
 *     <div class="list">...<span class="label">Committees</span> {name}</div>
 *     <time datetime="{YYYY-MM-DD}">...</time>
 *     <div class="indicator">HC {N}</div>
 *     <div class="indicator">Report</div>
 */
export function parsePublicationCards(html: string, type: CommitteePublicationType): CommitteePublication[] {
  const publications: CommitteePublication[] = []

  // Extract individual card blocks
  const cardRx = /<div class="card[^"]*card-publication[^"]*">([\s\S]*?)(?=<div class="card[^"]*card-publication|<\/div>\s*<\/div>\s*<\/ul>)/g
  let m: RegExpExecArray | null

  while ((m = cardRx.exec(html)) !== null) {
    const card = m[1]

    // Same hand-written list as the body stripper had, and the same omission. One decoder now.
    const rawTitle = extractText(card, /<div class="primary-info">([^<]+)<\/div>/)
    const title = rawTitle ? decodeForIndex(rawTitle).trim() : undefined
    if (!title) continue

    // PDF URL: /publications/{pubId}/documents/{docId}/default/
    const pdfRelM = /href="(\/publications\/(\d+)\/documents\/(\d+)\/default\/)"/.exec(card)
    const pdfRelUrl = pdfRelM?.[1] ?? null
    const pubId = pdfRelM?.[2] ?? ''
    const docId = pdfRelM?.[3] ?? ''

    if (!pubId) continue

    const pdfUrl = pdfRelUrl ? `${BASE_URL}${pdfRelUrl}` : null

    // HTML URL: absolute link to publications.parliament.uk
    const htmlUrlM = /href="(https:\/\/publications\.parliament\.uk\/[^"]+\.html?)"/.exec(card)
    const htmlUrl = htmlUrlM?.[1] ?? null

    // Committee names (may be multiple — join with comma)
    const committeeNames: string[] = []
    const commRx = /<span class="label">Committees<\/span>\s*([^<]+)/g
    let commM: RegExpExecArray | null
    while ((commM = commRx.exec(card)) !== null) {
      const name = commM[1].trim()
      if (name) committeeNames.push(name)
    }

    // Published date
    const dateM = /datetime="(\d{4}-\d{2}-\d{2})"/.exec(card)
    const publishedDate = dateM?.[1] ?? ''

    // Paper number (HC/HL number)
    const paperM = /<div class="indicator"><span[^>]*><\/span>(HC\s+[\d-]+|HL\s+[\d-]+|HL\s+Paper\s+[\d-]+|[A-Z]+ \d+)<\/div>/.exec(card)
    const paperNumber = paperM?.[1]?.trim() ?? ''

    // Publication type (Report, Correspondence, Evidence, etc.)
    const typeM = /<div class="indicator"><span[^>]*>[^<]*<\/span>\s*([^<]+)<\/div>\s*<\/div>/.exec(card)
    const publicationType = typeM?.[1]?.trim() ?? ''

    const sourceUrl = `${BASE_URL}/publications/${pubId}/documents/${docId}/default/`

    publications.push({
      pubId,
      docId,
      title,
      committeeNames,
      publishedDate,
      publicationType: publicationType || (type === 'reports-responses' ? 'Report' : 'Publication'),
      paperNumber,
      pdfUrl,
      htmlUrl,
      sourceUrl,
    })
  }

  return publications
}

/**
 * Fetch the text content of an HTML publication from publications.parliament.uk.
 * Uses curl subprocess — Node.js Undici is blocked by Cloudflare TLS fingerprinting
 * on all parliament.uk hosts regardless of User-Agent headers. curl's TLS fingerprint
 * is accepted. Railway Linux containers have curl installed by default.
 */
export async function fetchPublicationHtml(htmlUrl: string): Promise<string | null> {
  return fetchPublicationHtmlViaCurl(htmlUrl)
}

export async function fetchPublicationHtmlViaCurl(htmlUrl: string): Promise<string | null> {
  // WHY spawnSync pattern: curl -f causes failures on valid redirects. We check the
  // response content directly instead of relying on curl's exit code.
  const { spawnSync } = await import('child_process')
  const r = spawnSync('curl', [
    '-s', '--max-time', '30',
    '-A', BROWSER_UA,
    '-H', 'Accept: text/html,application/xhtml+xml',
    '-H', 'Accept-Language: en-GB,en;q=0.9',
    htmlUrl,
  ], { timeout: 35_000, maxBuffer: 5 * 1024 * 1024, encoding: 'utf8' })
  if (r.error || r.status !== 0 || !r.stdout || r.stdout.length < 200) return null
  return extractReportText(r.stdout as string) ?? null
}

/**
 * Extract readable text from a publications.parliament.uk HTML report page.
 * These pages follow a standard Parliament report template.
 */
function extractReportText(html: string): string | null {
  // Try main content area first
  const mainM = /<div[^>]+id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<footer|<script)/i.exec(html)
  const body = mainM?.[1] ?? html

  // Strip scripts, styles, nav, header, footer
  const stripped = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
  // ⚠ THIS LINE REPLACED A HAND-WRITTEN LIST, AND THE LIST IS WHY 12% OF THIS CORPUS IS DAMAGED.
  // It decoded `&nbsp;` and not `&#xa0;` — the numeric form of the SAME CHARACTER — so
  // `Barbara&#xa0;Rayment` was written to R2 verbatim, 5,212 times in a 200-document sample.
  // `shared/html-entities.ts` is now the only decoder; `npm run check:entity-decode` fails if a
  // hand-rolled list reappears in any source. See BRIEF_INGEST_ENTITY_DECODE.
  const decoded = decodeForIndex(stripped)
    .replace(/\s{3,}/g, '\n\n')
    .trim()

  return decoded.length > 100 ? decoded : null
}

function extractText(html: string, rx: RegExp): string | null {
  return rx.exec(html)?.[1] ?? null
}

/**
 * Get the total number of pages for a given publication type.
 * Returns 498 for reports-responses (confirmed), estimates for others.
 */
export async function getCommitteeTotalPages(type: CommitteePublicationType): Promise<number> {
  const url = `${BASE_URL}/publications/${type}/?page=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' },
  })
  if (!res.ok) return type === 'reports-responses' ? 498 : 2040

  const html = await res.text()
  const lastPageM = /page=(\d+)[^"]*"\s*(?:aria-label="Last|>Last)/.exec(html)
  if (lastPageM) return parseInt(lastPageM[1], 10)

  // Fallback: find max page= value
  const pageNums = [...html.matchAll(/page=(\d+)/g)].map(m => parseInt(m[1], 10))
  return pageNums.length > 0 ? Math.max(...pageNums) : (type === 'reports-responses' ? 498 : 2040)
}
