// api-handbook.fca.org.uk — JSON API backend for handbook.fca.org.uk (the SPA).
// Discovered 7 Jun 2026: the SPA fetches from this REST API; direct HTTP works
// without any browser/Playwright.
//
// Enumeration strategy:
//   1. GetAllHandbook  → 63 sourcebooks (modules) with their chapter IDs
//   2. GetAllHandBookProvisionsSortedOrderByChapter/{chapterId}
//      → all provisions for a chapter, grouped by sectionId
//   3. Yield one FcaSection per unique sectionId (concatenated provision text)

const API_BASE  = 'https://api-handbook.fca.org.uk'
const SITE_BASE = 'https://handbook.fca.org.uk'
const HEADERS   = {
  'User-Agent': 'Scrutinise-Ingest/1.0',
  'Origin':     SITE_BASE,
  'Referer':    `${SITE_BASE}/`,
}
// Polite delay between chapter fetches
const CHAPTER_DELAY_MS = 200

export interface FcaHandbookModule {
  entityId:   string  // lowercase API ID, e.g. 'cobs'
  code:       string  // uppercase display code, e.g. 'COBS'
  name:       string  // full name, e.g. 'COBS Conduct of Business Sourcebook'
  chapterIds: string[]
}

export interface FcaSection {
  sectionId:      string  // API section ID, e.g. 'cobs1s1'
  chapterId:      string  // API chapter ID, e.g. 'cobs1'
  moduleEntityId: string  // e.g. 'cobs'
  title:          string  // formatted, e.g. 'COBS 1.1'
  text:           string  // concatenated provision text
  sourceUrl:      string
}

type ApiPart = {
  entityId: string
  name:     string
  type:     string
  parts?:   ApiPart[]
}

type ApiResponse<T> = {
  Result:  T
  Success: boolean
  Error:   string | null
}

type ApiProvision = {
  entityId:    string
  sectionId:   string | null
  isDeleted:   boolean
  contentText: string | null
}

type ApiChapterResult = {
  chapterId:    string | null
  chapterName:  string | null
  provisions:   ApiProvision[]
}

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS })
    if (!res.ok) {
      console.warn(`[fca-handbook] HTTP ${res.status} for ${path}`)
      return null
    }
    const data = (await res.json()) as ApiResponse<T>
    return data.Success ? data.Result : null
  } catch (err) {
    console.warn(`[fca-handbook] fetch error ${path}:`, err)
    return null
  }
}

export async function getAllHandbookModules(): Promise<FcaHandbookModule[]> {
  const result = await apiGet<{ headers: ApiPart[] }>('/Handbook/GetAllHandbook')
  if (!result) return []

  const modules: FcaHandbookModule[] = []
  for (const block of result.headers) {
    for (const part of block.parts ?? []) {
      if (part.type !== 'sourcebook') continue
      const chapterIds = (part.parts ?? [])
        .filter(ch => ch.type === 'chapter')
        .map(ch => ch.entityId)
      modules.push({
        entityId:   part.entityId,
        code:       part.entityId.toUpperCase(),
        name:       part.name,
        chapterIds,
      })
    }
  }
  return modules
}

// 'cobs1s1' → 'COBS 1.1', 'cobs2as3' → 'COBS 2A.3', 'prinsch1' → 'PRIN SCH1'
function formatSectionTitle(sectionId: string): string {
  const m = sectionId.match(/^([a-z]+?)(\d+[a-z]*)s(\d+)$/i)
  if (m) return `${m[1].toUpperCase()} ${m[2].toUpperCase()}.${m[3]}`
  return sectionId.toUpperCase().replace(/(\d+)S(\d+)/, '$1.$2')
}

// ── Backward-compat exports ───────────────────────────────────────────────────
// Used by legacy files: worker-main.ts, discovery.ts, queue-populator.ts,
// source-counts.ts. These were built against the old SPA-scraper approach.

export const FCA_KNOWN_SOURCEBOOKS = [
  // Derived from GetAllHandbook (7 Jun 2026 — 63 modules)
  'PRIN', 'SYSC', 'COCON', 'COND', 'APER', 'FIT', 'FINMAR', 'TC', 'GEN', 'FEES',
  'GENPRU', 'INSPRU', 'MIFIDPRU', 'MIPRU', 'IPRUFSOC', 'IPRUINS', 'IPRUINV',
  'COBS', 'ICOBS', 'MCOB', 'BCOBS', 'CMCOB', 'FPCOB', 'PDCOB', 'CASS',
  'MAR', 'PROD', 'ESG',
  'SUP', 'DEPP', 'DISP', 'CONRED', 'COMP', 'ATCS',
  'COLL', 'CREDS', 'CONC', 'CTPS', 'FUND', 'PROF', 'RCB', 'SECN',
  'REC', 'EMIRR', 'UKLR', 'PRM', 'DTR', 'DISC',
  'EMPS', 'OMPS', 'SERV', 'BENCH', 'BFSAG', 'COLLG',
  'ENFG', 'FCG', 'FCTR', 'PERG', 'RFCCBS', 'RPPD', 'UNFCOG', 'WDPG', 'M2G',
]

export async function* listFcaSections(): AsyncGenerator<FcaSection> {
  const modules = await getAllHandbookModules()
  for (const m of modules) yield* listSectionsForModule(m)
}

// Legacy stub — text now comes from provision contentText, not a separate HTTP fetch
export async function fetchSectionText(_url: string): Promise<string | null> { return null }

// ── Per-module section generator ──────────────────────────────────────────────

export async function* listSectionsForModule(
  module: FcaHandbookModule,
): AsyncGenerator<FcaSection> {
  for (const chapterId of module.chapterIds) {
    await new Promise(r => setTimeout(r, CHAPTER_DELAY_MS))

    const chapter = await apiGet<ApiChapterResult>(
      `/Handbook/GetAllHandBookProvisionsSortedOrderByChapter/${chapterId}?IsDeleted=false`,
    )
    if (!chapter?.provisions) {
      console.log(`[fca-handbook] ${chapterId}: no data — skipping`)
      continue
    }

    // Group provisions by sectionId; skip deleted/empty
    const sectionMap = new Map<string, string[]>()
    for (const p of chapter.provisions) {
      if (p.isDeleted || !p.contentText?.trim()) continue
      const sid = p.sectionId ?? chapterId
      if (!sectionMap.has(sid)) sectionMap.set(sid, [])
      sectionMap.get(sid)!.push(p.contentText.trim())
    }

    if (sectionMap.size === 0) {
      console.log(`[fca-handbook] ${chapterId}: 0 active provisions`)
      continue
    }

    console.log(`[fca-handbook] ${chapterId}: ${sectionMap.size} section(s), ${chapter.provisions.length} provision(s)`)

    for (const [sid, texts] of sectionMap) {
      yield {
        sectionId:      sid,
        chapterId,
        moduleEntityId: module.entityId,
        title:          formatSectionTitle(sid),
        text:           texts.join('\n\n'),
        sourceUrl:      `${SITE_BASE}/handbook/${module.code}/${chapterId.replace(module.entityId, '')}`,
      }
    }
  }
}
