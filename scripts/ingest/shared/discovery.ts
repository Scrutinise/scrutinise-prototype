/**
 * discovery.ts — self-discovery logic for each source type.
 *
 * Called by the worker when claimNextChunk() returns null AND the queue is
 * genuinely empty (not just rate-limited). Returns new queue rows to insert
 * so workers can continue without a manual populator run.
 *
 * Design rules:
 * - Each function is idempotent (ON CONFLICT DO NOTHING in bulkUpsertQueueRows)
 * - Functions that call external APIs are clearly marked; fast ones use only DB state
 * - Returns [] when the source is genuinely exhausted → caller marks it isComplete
 */

import { getMaxDocIdForCorpus, getAllDocIdsForCorpus } from './queue-client'
import { FCA_KNOWN_SOURCEBOOKS } from '../sources/fca-handbook'

export interface DiscoveredRow {
  id: string
  corpus: string
  docId: string
  sourceType: string
  priority: number
}

// ── Month-chunk helpers ───────────────────────────────────────────────────────

function parseMonthEnd(docId: string): Date | null {
  const parts = docId.split(':')
  // format: "{prefix}:YYYY-MM-DD:YYYY-MM-DD"
  const endStr = parts[parts.length - 1]
  const d = new Date(endStr)
  return isNaN(d.getTime()) ? null : d
}

function buildMonthChunks(
  corpus: string,
  sourceType: string,
  priority: number,
  prefix: string,
  fromDate: Date,
  toDate: Date,
): DiscoveredRow[] {
  const rows: DiscoveredRow[] = []
  let current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
  while (current <= toDate) {
    const monthStart = current.toISOString().slice(0, 10)
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    const monthEndMs = Math.min(next.getTime() - 1, toDate.getTime())
    const monthEnd = new Date(monthEndMs).toISOString().slice(0, 10)
    const docId = `${prefix}:${monthStart}:${monthEnd}`
    rows.push({ id: `${corpus}:${docId}`, corpus, docId, sourceType, priority })
    current = next
  }
  return rows
}

// ── Written Answers / Written Statements ──────────────────────────────────────
// Time-based: generate monthly chunks from the day after the last-seeded month
// up to today. Returns [] if already current.

async function discoverWrittenChunks(
  corpus: string,
  prefix: string,
  fallbackStart: string,
): Promise<DiscoveredRow[]> {
  const maxDocId = await getMaxDocIdForCorpus(corpus)
  const lastEnd = maxDocId ? parseMonthEnd(maxDocId) : new Date(fallbackStart)
  if (!lastEnd) return []

  // Start from the month after the last-seeded end date
  const fromDate = new Date(lastEnd.getFullYear(), lastEnd.getMonth() + 1, 1)
  const today = new Date()
  if (fromDate > today) return []  // already up to date

  return buildMonthChunks(corpus, 'hansard', 2, prefix, fromDate, today)
}

// ── Hansard monthly chunks ───────────────────────────────────────────────────
// Extends already-seeded monthly chunks up to today.
// hansard-commons-a/lords-a are capped at 1980-12-31 (historical — always complete).
// hansard-commons-b/lords-b run to 2030-12-31 (all months pre-seeded — always complete).

async function discoverHansardChunks(corpus: string): Promise<DiscoveredRow[]> {
  const CORPUS_META: Record<string, { prefix: string; start: string; end: string }> = {
    'hansard-commons-a': { prefix: 'commons', start: '1800-01-01', end: '1980-12-31' },
    'hansard-commons-b': { prefix: 'commons', start: '1981-01-01', end: '2030-12-31' },
    'hansard-lords-a':   { prefix: 'lords',   start: '1800-01-01', end: '1980-12-31' },
    'hansard-lords-b':   { prefix: 'lords',   start: '1981-01-01', end: '2030-12-31' },
    'committees-a':      { prefix: '__index',  start: '', end: '' },
  }
  const meta = CORPUS_META[corpus]
  if (!meta) return []

  // Committees: single __index row — nothing to discover beyond the one row
  if (meta.prefix === '__index') return []

  // For corpora with fixed end dates already in the past, always complete
  const endDate = new Date(meta.end)
  if (endDate < new Date()) return []

  // Range extends into the future — check if any months are missing up to today
  const maxDocId = await getMaxDocIdForCorpus(corpus)
  const lastEnd = maxDocId ? parseMonthEnd(maxDocId) : new Date(meta.start)
  if (!lastEnd) return []

  const fromDate = new Date(lastEnd.getFullYear(), lastEnd.getMonth() + 1, 1)
  const today = new Date()
  if (fromDate > today) return []

  const { prefix } = meta
  return buildMonthChunks(corpus, 'hansard', 2, prefix, fromDate, today)
}

// ── TNA Caselaw ───────────────────────────────────────────────────────────────
// Discovers new Atom feed pages beyond the last seeded page number.
// Makes one API call to get current total judgment count.

async function discoverTnaCaselaw(): Promise<DiscoveredRow[]> {
  const maxDocId = await getMaxDocIdForCorpus('tna-caselaw')
  const lastPage = maxDocId ? parseInt(maxDocId.replace('page:', ''), 10) : 0

  let total = 0
  try {
    const { getTotalJudgments } = await import('../sources/tna-caselaw')
    total = await getTotalJudgments()
  } catch {
    return []
  }

  const lastNeededPage = Math.max(Math.ceil(total / 50), lastPage)
  if (lastNeededPage <= lastPage) return []

  const rows: DiscoveredRow[] = []
  for (let p = lastPage + 1; p <= lastNeededPage; p++) {
    rows.push({ id: `tna-caselaw:page:${p}`, corpus: 'tna-caselaw', docId: `page:${p}`, sourceType: 'tna-caselaw', priority: 1 })
  }
  return rows
}

// ── ECHR HUDOC ───────────────────────────────────────────────────────────────
// Discovers new paginated pages beyond the last seeded offset.
// Makes one API call to get current total UK case count.

async function discoverEchr(): Promise<DiscoveredRow[]> {
  const maxDocId = await getMaxDocIdForCorpus('echr-hudoc')
  // docId format: "page:{start}" where start is HUDOC offset (0, 50, 100, ...)
  const lastStart = maxDocId ? parseInt(maxDocId.replace('page:', ''), 10) : -50

  let total = 0
  try {
    const { countUkCases } = await import('../sources/echr-hudoc')
    total = await countUkCases()
  } catch {
    return []
  }

  if (total === 0) return []
  const rows: DiscoveredRow[] = []
  for (let start = lastStart + 50; start < total; start += 50) {
    rows.push({ id: `echr-hudoc:page:${start}`, corpus: 'echr-hudoc', docId: `page:${start}`, sourceType: 'echr', priority: 3 })
  }
  return rows
}

// ── EUR-Lex ───────────────────────────────────────────────────────────────────
// Discovers additional pages beyond the last seeded page number.
// Makes one API call to check if page max+1 has results.

async function discoverEurLex(): Promise<DiscoveredRow[]> {
  const maxDocId = await getMaxDocIdForCorpus('eur-lex')
  const lastPage = maxDocId ? parseInt(maxDocId.replace('page:', ''), 10) : 0
  const nextPage = lastPage + 1

  try {
    const { listRetainedEuPage } = await import('../sources/eurlex')
    let hasResults = false
    for await (const _doc of listRetainedEuPage(nextPage)) { hasResults = true; break }
    if (!hasResults) return []

    // Seed the next batch of pages (up to 10 more at a time)
    const rows: DiscoveredRow[] = []
    for (let p = nextPage; p <= nextPage + 9; p++) {
      rows.push({ id: `eur-lex:page:${p}`, corpus: 'eur-lex', docId: `page:${p}`, sourceType: 'eurlex', priority: 3 })
    }
    return rows
  } catch {
    return []
  }
}

// ── FCA Handbook ─────────────────────────────────────────────────────────────
// Discovers any FCA sourcebooks not yet represented in the queue.
// Pure DB check — no external API call.

async function discoverFca(): Promise<DiscoveredRow[]> {
  const existing = await getAllDocIdsForCorpus('fca-regulators')
  const rows: DiscoveredRow[] = []
  for (const code of FCA_KNOWN_SOURCEBOOKS) {
    const docId = `sourcebook:${code}`
    if (!existing.has(docId)) {
      rows.push({ id: `fca-regulators:${docId}`, corpus: 'fca-regulators', docId, sourceType: 'fca', priority: 2 })
    }
  }
  return rows
}

// ── TNA Legislation (current-year check) ─────────────────────────────────────
// For ongoing corpora (si-2010plus, primary-acts-2000plus, etc.):
// fetch only the current year's acts and add any not already in the queue.
// For historical fixed corpora (si-pre-2010, primary-acts-pre-2000): return [].

const TNA_CORPUS_META: Record<string, { types: string[]; yearMin: number; yearMax: number; sourceType: string; priority: number }> = {
  'si-pre-2010':           { types: ['uksi'],  yearMin: 1948, yearMax: 2009, sourceType: 'tna-legislation', priority: 1 },
  'si-2010plus':           { types: ['uksi'],  yearMin: 2010, yearMax: 2030, sourceType: 'tna-legislation', priority: 1 },
  'primary-acts-pre-2000': { types: ['ukpga'], yearMin: 1267, yearMax: 1999, sourceType: 'tna-legislation', priority: 1 },
  'primary-acts-2000plus': { types: ['ukpga'], yearMin: 2000, yearMax: 2030, sourceType: 'tna-legislation', priority: 1 },
  // regional now includes ssi+wsi to match WORKER_CORPORA worker 5 (plus nisi+nisr already there)
  'regional':              { types: ['asp','anaw','nia','nisi','nisr','ssi','wsi'], yearMin: 1999, yearMax: 2030, sourceType: 'tna-legislation', priority: 2 },
  'retained-eu':           { types: ['eur','eudn','eudr'], yearMin: 1960, yearMax: 2024, sourceType: 'tna-legislation', priority: 2 },
}

// Threshold below which a year is considered under-seeded and worth re-checking.
// SI years 2015–2026 were seeded with <350/yr; TNA typically has 500–1,200/yr.
const UNDER_SEEDED_THRESHOLD = 400

async function discoverTnaLegislation(corpus: string): Promise<DiscoveredRow[]> {
  const meta = TNA_CORPUS_META[corpus]
  if (!meta) return []

  const currentYear = new Date().getFullYear()
  const existing = await getAllDocIdsForCorpus(corpus)

  // Decide check range: fast (recent 2 years) vs full historical scan.
  // Full scan triggers when queue appears under-seeded for older years.
  // We detect this by counting existing rows in the year range yearMin..currentYear-2.
  // If count < (yearSpan × UNDER_SEEDED_THRESHOLD), do a full scan.
  const historicalYears = Math.max(0, currentYear - 2 - meta.yearMin)
  const historicalRows = [...existing].filter(id => {
    const m = id.match(/\/(\d{4})\//)
    if (!m) return false
    const y = parseInt(m[1])
    return y >= meta.yearMin && y <= currentYear - 2
  }).length
  const needsFullScan = historicalRows < historicalYears * UNDER_SEEDED_THRESHOLD

  const checkFrom = needsFullScan ? meta.yearMin : Math.max(meta.yearMin, currentYear - 1)
  if (needsFullScan) {
    console.log(`[discovery] ${corpus}: under-seeded (${historicalRows} rows for ${historicalYears} yrs) — full scan from ${checkFrom}`)
  }

  try {
    const { listActIds } = await import('../sources/tna-legislation')
    const rows: DiscoveredRow[] = []
    for (const type of meta.types) {
      const acts = await listActIds(type, checkFrom, meta.yearMax)
      for (const actId of acts) {
        if (!existing.has(actId)) {
          rows.push({ id: `${corpus}:${actId}`, corpus, docId: actId, sourceType: meta.sourceType, priority: meta.priority })
        }
      }
    }
    return rows
  } catch {
    return []
  }
}

// ── Single-pass sources ───────────────────────────────────────────────────────
// These iterate their whole corpus in one queue row.
// Once done, nothing to discover — caller will mark isComplete.

async function discoverSinglePass(_corpus: string): Promise<DiscoveredRow[]> {
  return []
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

const SINGLE_PASS_CORPORA = new Set([
  'hmrc-codes-guidance', 'hmrc-tiins', 'ots-reports', 'scotlawcom',
  'nilawcom', 'oecd', 'uk-treaties', 'fca-regulators',
])

export async function discoverForCorpus(corpus: string): Promise<DiscoveredRow[]> {
  // Written Answers / Statements — extend monthly chunks to today
  if (corpus === 'written-answers')    return discoverWrittenChunks(corpus, 'answers',    '2000-01-01')
  if (corpus === 'written-statements') return discoverWrittenChunks(corpus, 'statements', '1997-05-01')

  // Hansard — extend monthly chunks
  if (corpus.startsWith('hansard-') || corpus.startsWith('committees-'))
    return discoverHansardChunks(corpus)

  // TNA Legislation — current-year check
  if (corpus in TNA_CORPUS_META) return discoverTnaLegislation(corpus)

  // Paginated sources — find new pages
  if (corpus === 'tna-caselaw') return discoverTnaCaselaw()
  if (corpus === 'echr-hudoc')  return discoverEchr()
  if (corpus === 'eur-lex')     return discoverEurLex()
  if (corpus === 'fca-regulators') return discoverFca()

  // Single-pass sources — always exhausted after first pass
  if (SINGLE_PASS_CORPORA.has(corpus)) return discoverSinglePass(corpus)

  return []
}

// Returns the corpus with the highest priority that has no pending rows
// and is not yet marked isComplete. Driven by CORPUS_MANIFEST priority order.
export const DISCOVERY_CORPUS_ORDER = [
  // Priority 1
  'primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010',
  // Priority 2
  'regional', 'retained-eu', 'tna-caselaw',
  'hansard-commons-a', 'hansard-commons-b', 'hansard-lords-a', 'hansard-lords-b',
  'committees-a', 'written-answers', 'written-statements',
  'fca-regulators', 'hmrc-codes-guidance', 'hmrc-tiins', 'scotlawcom',
  // Priority 3
  'echr-hudoc', 'eur-lex', 'uk-treaties', 'nilawcom', 'ots-reports',
  // Priority 4
  'oecd',
]
