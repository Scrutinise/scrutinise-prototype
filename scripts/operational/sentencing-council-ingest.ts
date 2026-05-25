/**
 * Sentencing Council Guidelines — Operational Corpus Ingest
 * Sprint V.3-E
 *
 * Fetches all active Sentencing Council guidelines (offence-specific,
 * overarching principles, and supplementary information) from
 * sentencingcouncil.org.uk, stores HTML + extracted plain text in R2,
 * and writes index rows to Railway (OperationalDocument / OperationalSection).
 *
 * Guideline source:  https://www.sentencingcouncil.org.uk/guidelines/crown-court/
 *                    https://www.sentencingcouncil.org.uk/guidelines/magistrates/
 * Authority:         Coroners and Justice Act 2009 (statutory guidelines)
 * Document type:     STATUTORY_GUIDANCE
 * Jurisdiction:      UK (England and Wales courts)
 *
 * Rate-limiting: 1 req / 2s, exponential backoff on 429/503 (30s → 60s → … → 10 min).
 * Politeness:    robots.txt respected at startup; descriptive User-Agent set.
 * Audit log:     every request written to scripts/operational/sc-log.csv
 * Checkpoint:    scripts/operational/sc-checkpoint.json — resume after interruption.
 *
 * Run from scrutinise-web/ directory:
 *   npx tsx ../scripts/operational/sentencing-council-ingest.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { DocumentSourceType, OperationalIngestStatus } from '@prisma/client'
import { r2Put } from '../legislation/r2-client'

// ─────────────────────────────────────────────────────────────────────────────
// Prisma — use pg directly (PrismaPg driver adapter needs SSL config that
// lib/prisma.ts doesn't pass for local script use)
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require(path.join(__dirname, '../../scrutinise-web/node_modules/pg'))
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
})

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT    = 'Scrutinise/1.0 (civic tech; +https://scrutinise.org/about)'
const BASE_URL      = 'https://www.sentencingcouncil.org.uk'
const MIN_DELAY_MS  = 2000          // 1 req / 2s
const BACKOFF_INIT  = 30_000        // 30s first backoff
const BACKOFF_MAX   = 600_000       // 10 min cap
const FETCH_TIMEOUT = 30_000        // 30s request timeout
const LOG_FILE      = path.join(__dirname, 'sc-log.csv')
const CHECKPOINT    = path.join(__dirname, 'sc-checkpoint.json')

const PUBLISHER       = 'Sentencing Council'
const SOURCE_TYPE     = DocumentSourceType.STATUTORY_GUIDANCE
const JURISDICTION    = 'UK'            // England & Wales courts
const R2_ROOT         = 'operational/sentencing-council'

// ─────────────────────────────────────────────────────────────────────────────
// Guideline definitions — three tiers
// ─────────────────────────────────────────────────────────────────────────────

/** One entry per guideline page to scrape */
interface GuidelineDef {
  slug: string          // URL slug, used as sourceSlug and R2 key fragment
  name: string          // Full title
  courts: string        // 'Crown' | 'Magistrates' | 'Crown/Magistrates'
  acts: string          // Enabling legislation (may be empty for overarching)
  category: string      // Offence category / 'Overarching' / 'Supplementary'
  url: string           // Canonical URL of this guideline page
}

// ── Tier 1: Offence-specific guidelines (253) ─────────────────────────────
// Loaded from the pre-extracted JSON produced during Step 1 enumeration.
// File is co-located with this script.
const GUIDELINE_LIST_PATH = path.join(__dirname, 'sc-guideline-list.json')
const offenceGuidelines: GuidelineDef[] = (() => {
  if (!fs.existsSync(GUIDELINE_LIST_PATH)) {
    throw new Error(`Guideline list not found: ${GUIDELINE_LIST_PATH}`)
  }
  return JSON.parse(fs.readFileSync(GUIDELINE_LIST_PATH, 'utf-8')) as GuidelineDef[]
})()

// ── Tier 2: Overarching principles (10) ──────────────────────────────────
const OVERARCHING: GuidelineDef[] = [
  {
    slug: 'general-guideline-overarching-principles',
    name: 'General guideline: overarching principles',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/general-guideline-overarching-principles/`,
  },
  {
    slug: 'totality',
    name: 'Totality',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/totality/`,
  },
  {
    slug: 'reduction-in-sentence-for-a-guilty-plea-first-hearing-on-or-after-1-june-2017',
    name: 'Reduction in sentence for a guilty plea',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/reduction-in-sentence-for-a-guilty-plea-first-hearing-on-or-after-1-june-2017/`,
  },
  {
    slug: 'sentencing-children-and-young-people',
    name: 'Sentencing children and young people: overarching principles',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/sentencing-children-and-young-people/`,
  },
  {
    slug: 'sentencing-offenders-with-mental-disorders-developmental-disorders-or-neurological-impairments',
    name: 'Sentencing offenders with mental disorders, developmental disorders, or neurological impairments',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/sentencing-offenders-with-mental-disorders-developmental-disorders-or-neurological-impairments/`,
  },
  {
    slug: 'domestic-abuse-overarching-principles',
    name: 'Domestic abuse: overarching principles',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/domestic-abuse-overarching-principles/`,
  },
  {
    slug: 'imposition-of-community-and-custodial-sentences',
    name: 'Imposition of community and custodial sentences',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/imposition-of-community-and-custodial-sentences/`,
  },
  {
    slug: 'allocation-and-committal-for-sentence',
    name: 'Allocation (either way offences) and committal for sentence',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/allocation-and-committal-for-sentence/`,
  },
  {
    slug: 'offences-taken-into-consideration',
    name: 'Offences taken into consideration',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/offences-taken-into-consideration/`,
  },
  {
    slug: 'driving-disqualification',
    name: 'Driving disqualification',
    courts: 'Crown/Magistrates',
    acts: 'Coroners and Justice Act 2009',
    category: 'Overarching principles',
    url: `${BASE_URL}/guidelines/driving-disqualification/`,
  },
]

// ── Tier 3: Supplementary information (11) ───────────────────────────────
const SUPPLEMENTARY: GuidelineDef[] = [
  {
    slug: 'ancillary-orders',
    name: 'Ancillary orders',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/ancillary-orders/`,
  },
  {
    slug: 'approach-to-fines',
    name: 'Approach to fines',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/approach-to-fines/`,
  },
  {
    slug: 'compensation',
    name: 'Compensation',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/compensation/`,
  },
  {
    slug: 'deferred-sentences',
    name: 'Deferred sentences',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/deferred-sentences/`,
  },
  {
    slug: 'hate-crime',
    name: 'Hate crime',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/hate-crime/`,
  },
  {
    slug: 'offences-in-a-domestic-abuse-context',
    name: 'Offences in a domestic abuse context',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/offences-in-a-domestic-abuse-context/`,
  },
  {
    slug: 'other-financial-orders',
    name: 'Other financial orders',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/other-financial-orders/`,
  },
  {
    slug: 'out-of-court-disposals',
    name: 'Out-of-court disposals',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/out-of-court-disposals/`,
  },
  {
    slug: 'road-traffic-offences-disqualification',
    name: 'Road traffic offences: disqualification',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/road-traffic-offences-disqualification/`,
  },
  {
    slug: 'using-the-guidelines',
    name: 'Using the guidelines',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/using-the-guidelines/`,
  },
  {
    slug: 'victims',
    name: 'Victims',
    courts: 'Crown/Magistrates',
    acts: '',
    category: 'Supplementary information',
    url: `${BASE_URL}/supplementary-information/victims/`,
  },
]

// Full ordered list — offence guidelines first (alphabetical by slug),
// then overarching, then supplementary.
const ALL_GUIDELINES: GuidelineDef[] = [
  ...offenceGuidelines,
  ...OVERARCHING,
  ...SUPPLEMENTARY,
]

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointData {
  completedSlugs: string[]   // slugs fully ingested
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8'))
  }
  return { completedSlugs: [] }
}

function saveCheckpoint(cp: CheckpointData): void {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

function initLog(): void {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,method,url,statusCode,durationMs,notes\n')
  }
}

function logRequest(url: string, statusCode: number, durationMs: number, notes = ''): void {
  const ts   = new Date().toISOString()
  const line = `${ts},GET,${url},${statusCode},${durationMs},"${notes.replace(/"/g, "'")}"\n`
  fs.appendFileSync(LOG_FILE, line)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limiting state
// ─────────────────────────────────────────────────────────────────────────────

let lastRequestAt = 0

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - elapsed)
  lastRequestAt = Date.now()
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP fetch with exponential backoff
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithBackoff(url: string): Promise<{ html: string; status: number }> {
  let backoff = BACKOFF_INIT

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await throttle()
    const start = Date.now()
    try {
      const { status, body } = await httpGet(url)
      const duration = Date.now() - start
      logRequest(url, status, duration)

      if (status === 200) return { html: body, status }

      if (status === 429 || status === 503) {
        const wait = Math.min(backoff, BACKOFF_MAX)
        console.warn(`  ⚠ ${status} on ${url} — backing off ${wait / 1000}s`)
        logRequest(url, status, duration, `backoff ${wait}ms`)
        await sleep(wait)
        backoff = Math.min(backoff * 2, BACKOFF_MAX)
        continue
      }

      if (status === 404) {
        logRequest(url, status, duration, '404 — page absent')
        return { html: '', status }
      }

      logRequest(url, status, duration, `unexpected status`)
      return { html: '', status }

    } catch (err: unknown) {
      const duration = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)
      logRequest(url, 0, duration, `error: ${msg}`)
      const wait = Math.min(backoff, BACKOFF_MAX)
      console.warn(`  ⚠ Fetch error ${url}: ${msg} — backing off ${wait / 1000}s`)
      await sleep(wait)
      backoff = Math.min(backoff * 2, BACKOFF_MAX)
    }
  }
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: FETCH_TIMEOUT,
    }
    https.get(url, options, res => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location
        const redirect = loc.startsWith('http') ? loc : `${BASE_URL}${loc}`
        res.destroy()
        return resolve(httpGet(redirect))
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf-8'),
      }))
      res.on('error', reject)
    }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')))
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt check
// ─────────────────────────────────────────────────────────────────────────────

async function checkRobotsTxt(): Promise<void> {
  console.log('Checking robots.txt on sentencingcouncil.org.uk...')
  const { html, status } = await fetchWithBackoff(`${BASE_URL}/robots.txt`)
  if (status !== 200) {
    console.warn('  Could not fetch robots.txt — proceeding cautiously')
    return
  }

  const lines = html.split('\n').map(l => l.trim().toLowerCase())
  let inRelevantBlock = false

  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      const agent = line.replace('user-agent:', '').trim()
      inRelevantBlock = agent === '*' || agent.includes('scrutinise')
    }
    if (inRelevantBlock && line.startsWith('disallow:')) {
      const disallowed = line.replace('disallow:', '').trim()
      // Check if any of our target paths would be blocked
      const targetPaths = ['/guidelines/', '/supplementary-information/']
      for (const tp of targetPaths) {
        if (disallowed && tp.startsWith(disallowed)) {
          throw new Error(
            `robots.txt disallows "${disallowed}" — this blocks ${tp}. Cannot proceed.`
          )
        }
      }
    }
  }
  console.log('  ✓ robots.txt check passed — target paths not disallowed for Scrutinise/1.0')
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML content extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the guideline body HTML from a sentencingcouncil.org.uk page.
 *
 * Structure: <main id="main-content">
 *              … header (court badges, print button) …
 *              … guideline body (steps, tables, ranges) …
 *            [<div id="guideline-feedback-form-container"> … ]
 *
 * We take everything inside <main> up to the feedback form.
 */
function extractMainContent(html: string): string {
  const mainStart = html.indexOf('<main id="main-content">')
  if (mainStart === -1) {
    // Fallback: try <main> without id
    const fallbackStart = html.indexOf('<main')
    if (fallbackStart === -1) return html
    const mainEnd = html.indexOf('</main>', fallbackStart)
    return mainEnd !== -1 ? html.slice(fallbackStart, mainEnd + 7) : html.slice(fallbackStart)
  }

  // Cut off the feedback form — it adds noise and no substantive content
  const feedbackMarker = 'id="guideline-feedback-form-container"'
  const feedbackIdx = html.indexOf(feedbackMarker, mainStart)
  const mainEnd = feedbackIdx !== -1
    ? feedbackIdx
    : (html.indexOf('</main>', mainStart) + 7 || html.length)

  return html.slice(mainStart, mainEnd)
}

/** Extract the guideline title from <h1> inside <main> */
function extractTitle(html: string): string {
  const mainContent = extractMainContent(html)
  const h1Match = mainContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1Match) {
    return stripHtml(h1Match[1]).trim()
  }
  // Fallback to <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : ''
}

/** Strip HTML tags and decode common entities → plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2019;/g, '’')   // right single quote
    .replace(/&#x2018;/g, '‘')   // left single quote
    .replace(/&#x201c;/g, '“')   // left double quote
    .replace(/&#x201d;/g, '”')   // right double quote
    .replace(/&#x2014;/g, '—')   // em dash
    .replace(/&#x2013;/g, '–')   // en dash
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertOperationalDocument(
  client: any,
  guideline: GuidelineDef,
): Promise<string> {
  const description = [
    guideline.courts ? `[${guideline.courts}]` : '',
    guideline.acts || '',
    guideline.category !== 'Uncategorised' ? `Category: ${guideline.category}` : '',
  ].filter(Boolean).join(' — ')

  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id, "sourceType", "sourceSlug", "publisherName", title, description,
       "sourceUrl", "r2Prefix", jurisdiction, "ingestStatus", "pageCount",
       "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW(), NOW())
    ON CONFLICT ("sourceType", "sourceSlug") DO UPDATE
      SET title        = EXCLUDED.title,
          description  = EXCLUDED.description,
          "r2Prefix"   = EXCLUDED."r2Prefix",
          "ingestStatus" = $10,
          "updatedAt"  = NOW()
    RETURNING id
  `, [
    SOURCE_TYPE,
    guideline.slug,
    PUBLISHER,
    guideline.name,
    description,
    guideline.url,
    `${R2_ROOT}/${guideline.slug}`,
    JURISDICTION,
    OperationalIngestStatus.IN_PROGRESS,
    OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id
}

async function upsertOperationalSection(
  client: any,
  params: {
    documentId: string
    guideline: GuidelineDef
    pageTitle: string
    htmlKey: string
    textKey: string
    extractedText: string
    wc: number
  }
): Promise<void> {
  // chapterSlug = category slug (kebab-case)
  const chapterSlug = params.guideline.category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  await client.query(`
    INSERT INTO "OperationalSection"
      (id, "operationalDocumentId", "sourceType", "pageSlug", "chapterSlug",
       "pageTitle", "sourceUrl", "htmlKey", "textKey", "extractedText",
       "wordCount", "extractedBy", "orderIndex", "ingestStatus",
       "fetchedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       0, $12, NOW(), NOW(), NOW())
    ON CONFLICT ("operationalDocumentId", "pageSlug") DO UPDATE
      SET "pageTitle"     = EXCLUDED."pageTitle",
          "htmlKey"       = EXCLUDED."htmlKey",
          "textKey"       = EXCLUDED."textKey",
          "extractedText" = EXCLUDED."extractedText",
          "wordCount"     = EXCLUDED."wordCount",
          "chapterSlug"   = EXCLUDED."chapterSlug",
          "ingestStatus"  = EXCLUDED."ingestStatus",
          "fetchedAt"     = NOW(),
          "updatedAt"     = NOW()
  `, [
    params.documentId,
    SOURCE_TYPE,
    params.guideline.slug,    // pageSlug = guideline slug (1 section per doc)
    chapterSlug,
    params.pageTitle,
    params.guideline.url,
    params.htmlKey,
    params.textKey,
    params.extractedText,
    params.wc,
    'html-direct',
    OperationalIngestStatus.COMPLETE,
  ])
}

async function markDocumentComplete(
  client: any,
  documentId: string,
): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus" = $1, "pageCount" = 1, "lastFetchedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = $2
  `, [OperationalIngestStatus.COMPLETE, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ingest logic per guideline
// ─────────────────────────────────────────────────────────────────────────────

async function ingestGuideline(
  guideline: GuidelineDef,
  cp: CheckpointData,
  index: number,
  total: number,
): Promise<void> {
  if (cp.completedSlugs.includes(guideline.slug)) {
    process.stdout.write(`  [${index}/${total}] SKIP (checkpoint): ${guideline.slug}\n`)
    return
  }

  process.stdout.write(`  [${index}/${total}] ${guideline.slug} ... `)

  // Fetch the page
  const { html, status } = await fetchWithBackoff(guideline.url)

  if (status !== 200 || !html) {
    console.log(`✗ (HTTP ${status})`)
    logRequest(guideline.url, status, 0, `skip — non-200`)
    return
  }

  // Extract content
  const mainHtml  = extractMainContent(html)
  const plainText = stripHtml(mainHtml)
  const title     = extractTitle(html) || guideline.name
  const wc        = wordCount(plainText)

  // R2 keys — one level deep since each guideline has one page
  const htmlKey   = `${R2_ROOT}/${guideline.slug}/${guideline.slug}.html`
  const textKey   = `${R2_ROOT}/${guideline.slug}/${guideline.slug}.text`

  // Write R2
  await r2Put(htmlKey, html, 'text/html')
  await r2Put(textKey, plainText, 'text/plain')

  // Write DB
  const client = await pool.connect()
  try {
    const documentId = await upsertOperationalDocument(client, guideline)
    await upsertOperationalSection(client, {
      documentId,
      guideline,
      pageTitle: title,
      htmlKey,
      textKey,
      extractedText: plainText.slice(0, 1000),
      wc,
    })
    await markDocumentComplete(client, documentId)
  } finally {
    client.release()
  }

  cp.completedSlugs.push(guideline.slug)
  console.log(`✓ (${wc} words)`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Sentencing Council Guidelines — Operational Corpus Ingest ===')
  console.log(`User-Agent:   ${USER_AGENT}`)
  console.log(`Rate limit:   1 req / ${MIN_DELAY_MS / 1000}s`)
  console.log(`Total items:  ${ALL_GUIDELINES.length}`)
  console.log(`  Offence-specific: ${offenceGuidelines.length}`)
  console.log(`  Overarching:      ${OVERARCHING.length}`)
  console.log(`  Supplementary:    ${SUPPLEMENTARY.length}`)
  console.log(`Log file:     ${LOG_FILE}`)
  console.log(`Checkpoint:   ${CHECKPOINT}`)
  console.log('')

  initLog()
  await checkRobotsTxt()

  const cp = loadCheckpoint()
  console.log(`Checkpoint: ${cp.completedSlugs.length} of ${ALL_GUIDELINES.length} already complete`)
  console.log('')

  // Optional: --slug= flag to ingest a single guideline for testing
  const slugArg   = process.argv.find(a => a.startsWith('--slug='))
  const targetSlug = slugArg ? slugArg.replace('--slug=', '') : null
  const toIngest   = targetSlug
    ? ALL_GUIDELINES.filter(g => g.slug === targetSlug)
    : ALL_GUIDELINES

  if (toIngest.length === 0) {
    console.error(`No guideline found with slug "${targetSlug}"`)
    process.exit(1)
  }

  let ingested = 0
  let skipped  = 0
  let failed   = 0

  for (let i = 0; i < toIngest.length; i++) {
    const guideline = toIngest[i]
    const wasComplete = cp.completedSlugs.includes(guideline.slug)

    await ingestGuideline(guideline, cp, i + 1, toIngest.length)

    if (cp.completedSlugs.includes(guideline.slug)) {
      if (wasComplete) skipped++
      else {
        ingested++
        // Save checkpoint every 20 guidelines
        if (ingested % 20 === 0) saveCheckpoint(cp)
      }
    } else {
      failed++
    }
  }

  // Final checkpoint save
  saveCheckpoint(cp)

  console.log('')
  console.log('=== Ingest complete ===')
  console.log(`  Ingested: ${ingested}`)
  console.log(`  Skipped (checkpoint): ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total complete: ${cp.completedSlugs.length} / ${ALL_GUIDELINES.length}`)

  // Print word count summary from log
  console.log('')
  console.log('Run complete. Check sc-log.csv for request audit trail.')

  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
