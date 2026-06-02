import { AdaptiveThrottle } from '../shared/adaptive-throttle'

const FCA_BASE = 'https://www.handbook.fca.org.uk'
const throttle = new AdaptiveThrottle({ floor: 500, ceiling: 60_000 })
const UA = 'Scrutinise-Ingest/1.0 (civic research; +https://scrutinise.org/about)'

export interface FcaSection {
  id: string
  sourcebook: string
  title: string
  url: string
}

async function fetchHtml(url: string): Promise<string | null> {
  await throttle.wait()
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429) { throttle.backoff(); return null }
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) return null
  throttle.success()
  return res.text()
}

// Known FCA Handbook sourcebook codes, used as fallback if the index page scrape fails.
// These are the main blocks of the FCA Handbook as of 2026.
export const FCA_KNOWN_SOURCEBOOKS = [
  // Block 1 — High Level Standards
  'PRIN', 'SYSC', 'APER', 'TC', 'GEN', 'FEES', 'COCON',
  // Block 2 — Prudential Standards
  'GENPRU', 'BIPRU', 'INSPRU', 'IPRU-INS', 'IPRU-INV', 'IPRU-BSOC',
  // Block 3 — Business Standards
  'COBS', 'ICOBS', 'MCOB', 'BCOBS', 'CMCOB', 'CASS',
  // Block 4 — Regulatory Processes
  'SUP', 'AUTH', 'REC', 'DEPP', 'EG',
  // Block 5 — Redress
  'DISP', 'COMP', 'CONRED',
  // Block 6 — Specialist Sourcebooks
  'MAR', 'DTR', 'LR', 'PR', 'FUND', 'COLL', 'CREDS', 'RPPD', 'CRAR',
]

// Scrape the main handbook index to discover sourcebook codes.
// Falls back to KNOWN_SOURCEBOOKS if the page is unavailable.
async function discoverSourcebooks(): Promise<string[]> {
  const html = await fetchHtml(`${FCA_BASE}/handbook`)
  if (!html) {
    console.log('[fca-handbook] index unavailable — using fallback sourcebook list')
    return FCA_KNOWN_SOURCEBOOKS
  }

  // Handbook index links sourcebooks as /handbook/{CODE} where CODE is 2–12 uppercase chars
  const codes = new Set<string>()
  const rx = /href="\/handbook\/([A-Z][A-Z0-9\-]{1,11})\b[^"]*"/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(html)) !== null) {
    const code = m[1]
    // Exclude generic navigation paths (e.g. SMCR, but keep IPRU-INS style codes)
    if (code.length >= 2) codes.add(code)
  }

  const discovered = Array.from(codes)
  return discovered.length >= 5 ? discovered : FCA_KNOWN_SOURCEBOOKS
}

// For a given sourcebook code, fetch its TOC page and extract section links.
// Section URLs follow the pattern /handbook/{CODE}/{chapter}[/{section}]
async function getSourcebookSections(sourcebook: string): Promise<FcaSection[]> {
  const html = await fetchHtml(`${FCA_BASE}/handbook/${sourcebook}`)
  if (!html) return []

  const sections: FcaSection[] = []
  const seen = new Set<string>()

  // Match links to chapter/section pages within this sourcebook
  // Pattern: /handbook/COBS/2 or /handbook/COBS/2/1
  const rx = new RegExp(
    `href="(\\/handbook\\/${sourcebook}\\/([\\d][\\d.A-Z]*))(?:[?#][^"]*)??"`,
    'gi'
  )
  let m: RegExpExecArray | null
  while ((m = rx.exec(html)) !== null) {
    const path = m[1]
    const chapterPart = m[2]
    if (seen.has(path)) continue
    seen.add(path)

    const id = `${sourcebook}/${chapterPart}`
    sections.push({
      id,
      sourcebook,
      title: `${sourcebook} ${chapterPart}`,
      url: `${FCA_BASE}${path}`,
    })
  }

  return sections
}

// List sections for a single sourcebook — used by per-sourcebook queue rows.
export async function* listFcaSectionsForSourcebook(sourcebook: string): AsyncGenerator<FcaSection> {
  const sections = await getSourcebookSections(sourcebook)
  console.log(`[fca-handbook] ${sourcebook}: ${sections.length} section(s) found`)
  for (const sec of sections) yield sec
}

export async function* listFcaSections(): AsyncGenerator<FcaSection> {
  const sourcebooks = await discoverSourcebooks()
  console.log(`[fca-handbook] discovered ${sourcebooks.length} sourcebooks`)

  for (const sb of sourcebooks) {
    const sections = await getSourcebookSections(sb)
    if (sections.length === 0) {
      console.log(`[fca-handbook] ${sb}: no sections found — skipping`)
      continue
    }
    console.log(`[fca-handbook] ${sb}: ${sections.length} section(s) found`)
    for (const sec of sections) yield sec
  }
}

// Extract plain text from an FCA Handbook section page.
// Uses rawToText pattern: strip scripts/styles then all tags.
export async function fetchSectionText(url: string): Promise<string | null> {
  const html = await fetchHtml(url)
  if (!html) return null

  // FCA Handbook uses <main> for rule content; fall back to full page
  const mainMatch =
    /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html) ??
    /<div[^>]+id="content"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
  const body = mainMatch ? mainMatch[1] : html

  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text || null
}
