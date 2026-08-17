/**
 * committees-doc-index.ts — capture the documentId for every committee publication, so a citation
 * can be addressed at a URL that actually opens.
 *
 * BRIEF_INGEST_CORPUS_FRESHNESS §1, cost item 1 ("re-crawl and update the ids"), done as what the
 * measurement showed it actually is: not a renumbering, an ADDRESSING problem.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT `committees-freshness.ts` ESTABLISHED, AND WHY THIS IS THE FIX
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A committee publication is addressable three ways and we store the one that never works:
 *
 *     /publications/{id}/                      404 for every publication (the V19-E finding)
 *     /publications/{id}/html/                 200 only where an HTML rendition exists
 *     /publications/{id}/documents/{docId}/default/   200 for BOTH classes — measured on one of each
 *
 * So the durable form is the third, and the only thing missing from our data is `documentId`.
 * The Publications LIST endpoint carries it — the same lesson sweep-committees.ts learned: the list
 * carries what the detail carries, so this is ~260 calls at Take=200 rather than 45,610 detail calls.
 *
 * ⚠⚠ `document_id IS NULL` MEANS "NO FILE LISTED IN THE API". IT DOES **NOT** MEAN "NOTHING TO OPEN",
 * AND MY FIRST VERSION OF THIS HEADER SAID IT DID. Measured afterwards on 60 held publications with
 * no API file: **27 of them (45.0%, 95% CI 33.1–57.5%) still return 200 at `/publications/{id}/html/`.**
 * An HTML rendition can exist on the website with no corresponding file in the API.
 *
 * So the resolver rule is:
 *   document_id present  → `/publications/{id}/documents/{docId}/default/`  (measured 200 for both
 *                          the HTML and the PDF-only classes — the durable form)
 *   document_id NULL     → `/publications/{id}/html/` is the best available guess and opens about
 *                          45% of the time. It is NOT a link that can be dropped on the strength of
 *                          this table alone; dropping it would remove working citations.
 *
 * The class that genuinely cannot be opened is narrower: `/html/` 404s AND there is no file. That is
 * what `committees-freshness.ts` calls `no-document` and measures at 21.9% of held publications —
 * do not read this table's NULL count as that number.
 *
 * Usage (from scripts/ingest):
 *   npx tsx committees-doc-index.ts --predict     # counts + cost, writes nothing
 *   npx tsx committees-doc-index.ts --pilot 5     # 5 pages, then write
 *   npx tsx committees-doc-index.ts               # the full sweep (~260 calls)
 *   npx tsx committees-doc-index.ts --verify      # coverage against corpus_sections, changes nothing
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(`--${f}`)
const num = (f: string, d: number) => {
  const i = argv.indexOf(`--${f}`)
  const v = i >= 0 ? parseInt(argv[i + 1] ?? '', 10) : NaN
  return Number.isFinite(v) ? v : d
}
const PREDICT = has('predict')
const VERIFY = has('verify')
const PILOT = num('pilot', 0)
const TAKE = num('take', 200)
const THROTTLE_MS = num('throttle', 350)

const API = 'https://committees-api.parliament.uk/api'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const n = (v: number) => Number(v).toLocaleString('en-GB')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const DDL = `
CREATE TABLE IF NOT EXISTS committee_publication_document (
  publication_id INTEGER PRIMARY KEY,
  -- NULL = the API lists no file for this publication. ⚠ NOT "nothing to open": 45.0% of these
  -- still open at /publications/{id}/html/ (n=60, CI 33.1-57.5%). See the header.
  document_id    INTEGER,
  document_count INTEGER NOT NULL DEFAULT 0,
  file_name      TEXT,
  file_format    TEXT,
  title          TEXT,
  committee      TEXT,
  published_on   DATE,
  checked_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS committee_publication_document_has_doc_idx
  ON committee_publication_document ((document_id IS NOT NULL));
`

/**
 * The URL to offer for a publication, and how much it can be trusted. ONE definition, shared by the
 * downstream resolver and the tests.
 *
 * ⚠ THE BARE `/publications/{id}/` FORM IS NEVER RETURNED — it 404s for every publication there is.
 */
export function publicationUrl(publicationId: number, documentId: number | null):
  { url: string; confidence: 'measured' | 'best-guess' } {
  const base = `https://committees.parliament.uk/publications/${publicationId}`
  // The document form was probed on both an HTML publication and a PDF-only one: 200 for each.
  if (documentId != null) return { url: `${base}/documents/${documentId}/default/`, confidence: 'measured' }
  // No file in the API. `/html/` opens for 45.0% of these (n=60, CI 33.1–57.5%) — worth offering,
  // NOT worth presenting as certain, and NOT to be dropped, which would remove working citations.
  return { url: `${base}/html/`, confidence: 'best-guess' }
}

async function getJson(url: string): Promise<any | null> {
  for (let i = 0; i < 4; i++) {
    await sleep(THROTTLE_MS)
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.ok) return await res.json()
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * (i + 1)); continue }
      return null
    } catch { await sleep(2000 * (i + 1)) }
  }
  return null
}

interface Row {
  publicationId: number; documentId: number | null; documentCount: number
  fileName: string | null; fileFormat: string | null
  title: string | null; committee: string | null; publishedOn: string | null
}

/** One list item → the row we store. The only place the API's shape is interpreted. */
export function parsePublication(raw: any): Row | null {
  const id = Number(raw?.id)
  if (!Number.isFinite(id)) return null
  const docs: any[] = Array.isArray(raw.documents) ? raw.documents : []
  const doc = docs[0]
  const file = Array.isArray(doc?.files) ? doc.files[0] : undefined
  const date = typeof raw.publicationStartDate === 'string' ? raw.publicationStartDate.slice(0, 10) : null
  return {
    publicationId: id,
    documentId: Number.isFinite(Number(doc?.documentId)) ? Number(doc.documentId) : null,
    documentCount: docs.length,
    fileName: typeof file?.fileName === 'string' ? file.fileName.slice(0, 300) : null,
    fileFormat: typeof file?.fileDataFormat === 'string' ? file.fileDataFormat : null,
    title: typeof raw.description === 'string' ? raw.description.slice(0, 500) : null,
    committee: typeof raw.committee?.name === 'string' ? raw.committee.name.slice(0, 200) : null,
    publishedOn: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  }
}

async function verify(pool: ReturnType<typeof getNeonPool>) {
  const { rows: [cov] } = await pool.query<{ held: string; indexed: string; withDoc: string; noDoc: string }>(
    `WITH held AS (
       SELECT DISTINCT split_part("parentDocId", ':', 2)::int AS pub
         FROM corpus_sections
        WHERE corpus='committees-reports'
          AND "sourceUrl" LIKE 'https://committees.parliament.uk/publications/%'
          AND split_part("parentDocId", ':', 2) ~ '^[0-9]+$'
     )
     SELECT (SELECT COUNT(*) FROM held)::text AS held,
            (SELECT COUNT(*) FROM held h JOIN committee_publication_document d ON d.publication_id = h.pub)::text AS indexed,
            (SELECT COUNT(*) FROM held h JOIN committee_publication_document d ON d.publication_id = h.pub AND d.document_id IS NOT NULL)::text AS "withDoc",
            (SELECT COUNT(*) FROM held h JOIN committee_publication_document d ON d.publication_id = h.pub AND d.document_id IS NULL)::text AS "noDoc"`)
  const held = Number(cov.held), indexed = Number(cov.indexed), withDoc = Number(cov.withDoc), noDoc = Number(cov.noDoc)
  console.log('\n════ COVERAGE against the publications we actually hold ════')
  console.log(`  publications held in corpus_sections   ${n(held)}`)
  console.log(`  of those, indexed here                 ${n(indexed)}  (${((100 * indexed) / Math.max(1, held)).toFixed(1)}%)`)
  console.log(`  ✓ a file in the API → durable URL      ${n(withDoc)}  (${((100 * withDoc) / Math.max(1, indexed)).toFixed(1)}% of indexed)`)
  console.log(`  ⚠ NO file in the API                   ${n(noDoc)}  (${((100 * noDoc) / Math.max(1, indexed)).toFixed(1)}% of indexed)`)
  console.log(`      ⚠ this is NOT "nothing to open": 45.0% of these still open at /html/ (n=60,`)
  console.log(`        CI 33.1–57.5%). The unopenable class is /html/ 404 AND no file — 21.9% of`)
  console.log(`        held publications, measured by committees-freshness.ts, not by this table.`)
  console.log(`  ⚠ not indexed                          ${n(held - indexed)} — a publication we hold that the API's list does not return`)
  const { rows: ex } = await pool.query<{ publication_id: number; title: string | null }>(
    `SELECT publication_id, title FROM committee_publication_document WHERE document_id IS NULL LIMIT 3`)
  for (const e of ex) console.log(`      no document: ${e.publication_id}  ${(e.title ?? '').slice(0, 70)}`)
}

async function main() {
  const pool = getNeonPool()
  try {
    const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
    const host = /@([^/:?]+)/.exec(url)?.[1] ?? '(unparsed)'
    console.log(`════ committees document index ════\n  host ${host}`)
    if (!/ep-old-dust-aboxi69a/.test(host)) {
      console.error('  ❌ not the Neon production host recorded in docs/CLAUDE.md §16. Refusing.'); process.exit(1)
    }

    if (VERIFY) { await verify(pool); return }

    const first = await getJson(`${API}/Publications?Take=1&Skip=0`)
    const total = Number(first?.totalResults ?? 0)
    if (!total) { console.error('  ❌ the API returned no total — refusing to sweep blind'); process.exit(1) }
    const pages = Math.ceil(total / TAKE)
    console.log(`  ${n(total)} publications at source · ${n(pages)} pages at Take=${TAKE} · ${THROTTLE_MS}ms throttle`)
    console.log(`  predicted wall clock ≈ ${Math.ceil((pages * THROTTLE_MS) / 1000 / 60)} min · no LLM, no R2, ~0 cost`)
    if (PREDICT) { console.log('\n--predict: nothing written.'); return }

    await pool.query(DDL)

    let seen = 0, withDoc = 0, noDoc = 0, written = 0
    const limit = PILOT ? Math.min(pages, PILOT) : pages
    for (let p = 0; p < limit; p++) {
      const d = await getJson(`${API}/Publications?Take=${TAKE}&Skip=${p * TAKE}`)
      const items: any[] = d?.items ?? []
      if (!items.length) { console.log(`  ⚠ GAP at page ${p + 1} — recorded, not treated as the end`); continue }
      const rows = items.map(parsePublication).filter((r): r is Row => !!r)
      seen += rows.length
      withDoc += rows.filter((r) => r.documentId != null).length
      noDoc += rows.filter((r) => r.documentId == null).length

      const vals: string[] = []; const params: unknown[] = []
      rows.forEach((r, i) => {
        const b = i * 8
        vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`)
        params.push(r.publicationId, r.documentId, r.documentCount, r.fileName, r.fileFormat, r.title, r.committee, r.publishedOn)
      })
      const { rowCount } = await pool.query(
        `INSERT INTO committee_publication_document
           (publication_id, document_id, document_count, file_name, file_format, title, committee, published_on)
         SELECT v.pub::int, v.doc::int, v.cnt::int, v.fname::text, v.fmt::text, v.title::text, v.cmte::text, v.pub_on::date
           FROM (VALUES ${vals.join(',')}) AS v(pub, doc, cnt, fname, fmt, title, cmte, pub_on)
         ON CONFLICT (publication_id) DO UPDATE SET
           -- The API is the authority here, so a re-run REFRESHES rather than preserving: a
           -- publication that gains a document later must stop reading as having none.
           document_id = EXCLUDED.document_id,
           document_count = EXCLUDED.document_count,
           file_name = EXCLUDED.file_name, file_format = EXCLUDED.file_format,
           title = EXCLUDED.title, committee = EXCLUDED.committee,
           published_on = EXCLUDED.published_on, checked_at = now()`, params)
      written += rowCount ?? 0
      if ((p + 1) % 25 === 0 || p + 1 === limit) {
        console.log(`  page ${p + 1}/${limit} — ${n(seen)} seen · ${n(withDoc)} with a document · ${n(noDoc)} with none`)
      }
    }

    console.log(`\n  ${n(seen)} publications indexed · ${n(withDoc)} openable · ${n(noDoc)} with nothing to open · ${n(written)} rows written`)
    await verify(pool)
  } finally {
    await endNeonPool()
  }
}

if (require.main === module) main().catch((e) => { console.error('[doc-index] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
