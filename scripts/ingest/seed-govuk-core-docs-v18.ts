/**
 * seed-govuk-core-docs-v18.ts — V18 §5: gov.uk direct-download small corpora.
 *
 * ⚠️ RUN ONLY AFTER THE V18 PUSH — rows use the new 'govuk-content' sourceType.
 *
 * Seeds the proven direct-download set at P1 (validates breadth cheaply,
 * clears fast):
 *   - PACE Codes A–H (links extracted live from the gov.uk guidance page)
 *   - Treasury Green / Magenta / Aqua / Orange Books
 *   - Cabinet Manual, Civil Service Code, Ministerial Code
 *   - White papers: gov.uk has no white_paper document type (probed 10 Jun
 *     2026 — total 0); seeds policy_paper results for q="white paper" whose
 *     title actually says "white paper" (~hundreds).
 *
 * Run (pwsh):
 *   $env:NODE_PATH = 'scrutinise-web/node_modules'
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-govuk-core-docs-v18.ts
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { fetchGovukContent, searchByQuery } from './sources/govuk-content'

const CORPUS = 'govuk-core-docs'

const STATIC_PATHS = [
  'government/publications/the-green-book-appraisal-and-evaluation-in-central-government',
  'government/publications/the-magenta-book',
  'government/publications/the-aqua-book-guidance-on-producing-quality-analysis-for-government',
  'government/publications/orange-book',
  'government/publications/cabinet-manual',
  'government/publications/civil-service-code',
  'government/publications/ministerial-code',
]

async function paceCodePaths(): Promise<string[]> {
  const page = await fetchGovukContent('guidance/police-and-criminal-evidence-act-1984-pace-codes-of-practice')
  if (!page.bodyHtml) return []
  const paths = new Set<string>()
  const re = /href="(?:https:\/\/www\.gov\.uk)?(\/government\/publications\/pace-code-[^"#?]+)"/g
  let m
  while ((m = re.exec(page.bodyHtml)) !== null) paths.add(m[1].replace(/^\//, ''))
  return [...paths]
}

async function main() {
  const pool = getNeonPool()

  // same rate-limit row as hmrc-manuals (idempotent)
  await pool.query(`
    INSERT INTO source_rate_limits ("sourceKey", "intervalMs", "maxConcurrentWorkers", suspended, "isComplete", "updatedAt")
    VALUES ('govuk-content', 150, 10, false, false, NOW())
    ON CONFLICT ("sourceKey") DO UPDATE
      SET "isComplete" = false, suspended = false, "updatedAt" = NOW()
  `)

  const pace = await paceCodePaths()
  console.log(`PACE code publications found: ${pace.length}`)

  const whitePapers: string[] = []
  for await (const hits of searchByQuery('"white paper"', 'policy_paper')) {
    for (const h of hits) {
      if (/white paper/i.test(h.title)) whitePapers.push(h.link.replace(/^\//, ''))
    }
  }
  console.log(`white papers (title-confirmed): ${whitePapers.length}`)

  const all = [...new Set([...STATIC_PATHS, ...pace, ...whitePapers])]
  const ingestedRes = await pool.query<{ id: string }>(
    `SELECT id FROM corpus_sections WHERE corpus = $1`, [CORPUS]
  )
  const ingested = new Set(ingestedRes.rows.map(r => r.id.split(':')[1]))

  const rows = all
    .filter(docId => !ingested.has(docId))
    .map(docId => ({
      id: `${CORPUS}:${docId}`,
      corpus: CORPUS,
      docId,
      sourceType: 'govuk-content',
      priority: 1,
    }))
  const { affected } = await bulkInsertQueueRows(rows)

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
    VALUES ($1, 'Gov.uk core documents (PACE, Treasury books, white papers)', $2, false, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE
      SET display_label = EXCLUDED.display_label, est_sections = EXCLUDED.est_sections, blocked = false, blocked_reason = NULL
  `, [CORPUS, all.length * 2])  // body + ~1 PDF per doc on average

  console.log(`\nDONE — ${affected} rows seeded at P1 (${all.length} docs total)`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
