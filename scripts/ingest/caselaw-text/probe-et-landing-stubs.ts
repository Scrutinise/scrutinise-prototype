/**
 * probe-et-landing-stubs.ts — one of the five sampled `et-decisions` bodies was not a short
 * judgment but a LANDING PAGE: the whole stored text is "Read the full decision in Ms A Walker v
 * Ampulla Ltd: 2406400/2019 - Partial Dismissal ." — the link text on gov.uk, stored as if it were
 * the decision. The other four were genuine short judgments (a withdrawal order really is 41
 * words), so the two populations must be told apart before either is described.
 *
 * `sourceUrl` separates them without reading a single body: assets.publishing.service.gov.uk is
 * the PDF itself, www.gov.uk is the page that links to it. The sample then confirms the split.
 * WRITES NOTHING.
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'

const LANDING_MARK = /^Read the full decision in\b/i

;(async () => {
  const p = namesPool()
  const { rows } = await p.query(
    `SELECT CASE WHEN "sourceUrl" LIKE '%assets.publishing.service.gov.uk%' THEN 'PDF (assets.publishing…)'
                 WHEN "sourceUrl" LIKE '%www.gov.uk%'                       THEN 'landing page (www.gov.uk)'
                 ELSE 'other' END AS kind,
            COUNT(*)::int AS rows,
            percentile_disc(0.5) WITHIN GROUP (ORDER BY "wordCount") AS median_words,
            COUNT(*) FILTER (WHERE "wordCount" < 50)::int AS under_50
       FROM corpus_sections WHERE corpus='et-decisions' GROUP BY 1 ORDER BY rows DESC`)
  console.table(rows.map(r => ({
    'sourceUrl kind': r.kind,
    rows: Number(r.rows).toLocaleString(),
    'median words': Number(r.median_words).toLocaleString(),
    'under 50 words': Number(r.under_50).toLocaleString(),
  })))

  // Confirm the label rather than trust the URL: read 40 landing-page bodies and count how many
  // literally begin "Read the full decision in".
  const sample = (await p.query(
    `SELECT id, "r2Key" FROM corpus_sections
      WHERE corpus='et-decisions' AND "sourceUrl" LIKE '%www.gov.uk%' AND "r2Key" IS NOT NULL
      ORDER BY md5(id || 'landing') LIMIT 40`)).rows
  let mark = 0, read = 0
  await Promise.all(sample.map(async r => {
    const t = await r2Get(r.r2Key)
    if (t == null) return
    read++
    if (LANDING_MARK.test(t.trim())) mark++
  }))
  console.log(`\n  of ${read} sampled www.gov.uk-sourced bodies, ${mark} begin "Read the full decision in" ` +
    `(${read ? ((100 * mark) / read).toFixed(1) : '—'}%)`)
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
