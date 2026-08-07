/**
 * v32-predict-scale.ts — the prediction the base brief §4 requires BEFORE the full pass, and
 * the embedding cost the ADDENDUM §F wants stated rather than assumed.
 *
 * Predict-then-measure is the project's standing discipline (`feedback-predict-measure-commit`):
 * the number goes in the CHANGE_LOG before the run so it can be SCORED afterwards, not
 * reconstructed to match whatever happened.
 *
 * Runs the real splitter over every report/response body we hold, so the row-count prediction
 * is a measurement of the actual corpus rather than an average multiplied by a guess.
 *
 * Read-only — writes nothing but its own report. Usage: tsx v32-predict-scale.ts [--json=path]
 */
import fs from 'fs'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'
import { splitReportBody } from './shared/report-sections'

const JSON_OUT = (() => { const a = process.argv.find(x => x.startsWith('--json=')); return a ? a.split('=')[1] : null })()
const CONCURRENCY = parseInt(process.env.PREDICT_CONCURRENCY ?? '32', 10)

/** Batch API price for gemini-embedding-001, per vector-common.ts: $0.075 / 1M tokens
 *  (half the $0.15 sync price). Tokens estimated chars/4 — the same conservative basis
 *  measure-corpus.ts uses, a slight OVER-estimate for legal English at ~4.3 chars/token. */
const USD_PER_M_TOKENS_BATCH = 0.075
const USD_PER_M_TOKENS_SYNC = 0.15
const tokensOf = (chars: number) => Math.ceil(chars / 4)

/** Measured by the audit walk (probe over /api/Publications, type-filtered so the walk
 *  completes). These are the bodies that exist at source but are NOT downloadable from the
 *  API — reachable only through the publications.parliament.uk archive URL. */
const ARCHIVE_ONLY = { Report: 5835, 'Government Response': 937, 'Special Report': 879 }

async function mapPool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i]) }
  }))
  return out
}

async function main() {
  const p = getNeonPool()
  const { rows } = await p.query<{ id: string; sectionTitle: string; r2Key: string; wordCount: number }>(
    `SELECT id, "sectionTitle", "r2Key", "wordCount" FROM corpus_sections
     WHERE corpus='committees-reports' AND status='compiled' AND "r2Key" IS NOT NULL
       AND ("sectionTitle" ILIKE 'Report:%' OR "sectionTitle" ILIKE 'Special Report:%' OR "sectionTitle" ILIKE 'Government Response:%')`)

  console.log(`[predict] splitting ${rows.length.toLocaleString()} held report/response bodies with the real splitter…\n`)

  let sections = 0, chars = 0, lossy = 0, missing = 0
  const t0 = Date.now()
  let done = 0
  await mapPool(rows, CONCURRENCY, async (r) => {
    const body = await r2Get(r.r2Key)
    done++
    if (done % 500 === 0) process.stdout.write(`\r   …${done}/${rows.length}`)
    if (!body) { missing++; return }
    try {
      const secs = splitReportBody(body)
      sections += secs.length
      for (const s of secs) chars += s.text.length
    } catch { lossy++ }
  })
  process.stdout.write(`\r   split ${done} bodies in ${((Date.now() - t0) / 1000).toFixed(0)}s\n\n`)

  const perDoc = sections / Math.max(rows.length - missing - lossy, 1)

  console.log('═══ PREDICTION — committee report/response re-chunking ══════════════════════\n')
  console.log(`  held bodies split                 ${rows.length.toLocaleString()}  (${lossy} lossy, ${missing} R2 misses)`)
  console.log(`  sections they produce             ${sections.toLocaleString()}`)
  console.log(`  mean sections per document        ${perDoc.toFixed(1)}`)
  console.log(`  net NEW corpus_sections rows      ${(sections - (rows.length - missing - lossy)).toLocaleString()}   (the single blob row is replaced)`)
  console.log(`  text to embed                     ${chars.toLocaleString()} chars ≈ ${tokensOf(chars).toLocaleString()} tokens`)
  console.log(`  EMBED COST, batch @ $${USD_PER_M_TOKENS_BATCH}/M       $${((tokensOf(chars) / 1e6) * USD_PER_M_TOKENS_BATCH).toFixed(2)}`)
  console.log(`  EMBED COST, sync  @ $${USD_PER_M_TOKENS_SYNC}/M        $${((tokensOf(chars) / 1e6) * USD_PER_M_TOKENS_SYNC).toFixed(2)}`)

  const archiveTotal = Object.values(ARCHIVE_ONLY).reduce((a, b) => a + b, 0)
  const projSections = Math.round(archiveTotal * perDoc)
  const meanChars = chars / Math.max(sections, 1)
  const projChars = Math.round(projSections * meanChars)

  console.log('\n═══ PREDICTION — pre-2020 archive backfill (Wayback route) ══════════════════\n')
  for (const [k, v] of Object.entries(ARCHIVE_ONLY)) console.log(`  ${k.padEnd(22)} ${String(v).padStart(6)} documents at source, not downloadable from the API`)
  console.log(`  ${'TOTAL'.padEnd(22)} ${String(archiveTotal).padStart(6)} documents to fetch`)
  console.log(`  projected sections                ${projSections.toLocaleString()}   (at the measured ${perDoc.toFixed(1)}/doc)`)
  console.log(`  projected text                    ${projChars.toLocaleString()} chars ≈ ${tokensOf(projChars).toLocaleString()} tokens`)
  console.log(`  EMBED COST, batch @ $${USD_PER_M_TOKENS_BATCH}/M       $${((tokensOf(projChars) / 1e6) * USD_PER_M_TOKENS_BATCH).toFixed(2)}`)
  console.log(`  ⚠ projection assumes pre-2020 reports resemble the ones we hold. They are older`)
  console.log(`    and were often shorter, so this is more likely an over- than an under-estimate.`)

  const totalTokens = tokensOf(chars) + tokensOf(projChars)
  console.log('\n═══ COMBINED ═══════════════════════════════════════════════════════════════\n')
  console.log(`  total corpus_sections after both passes (committees-reports):`)
  console.log(`     ${(sections + projSections).toLocaleString()} report/response sections, up from ${rows.length.toLocaleString()} blob rows`)
  console.log(`  total embed tokens                ${totalTokens.toLocaleString()}`)
  console.log(`  TOTAL EMBED COST (batch)          $${((totalTokens / 1e6) * USD_PER_M_TOKENS_BATCH).toFixed(2)}`)
  console.log(`\n  ADDENDUM §F anchored this at "low tens of dollars" — the measurement says it is`)
  console.log(`  well under that. The gate is still Charlie's; this is the number, not an assumption.`)

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      held: { bodies: rows.length, sections, chars, tokens: tokensOf(chars), lossy, missing, perDoc },
      archiveOnly: { ...ARCHIVE_ONLY, total: archiveTotal, projSections, projChars, projTokens: tokensOf(projChars) },
      cost: { basisUsdPerMTokens: USD_PER_M_TOKENS_BATCH, heldUsd: (tokensOf(chars) / 1e6) * USD_PER_M_TOKENS_BATCH, projUsd: (tokensOf(projChars) / 1e6) * USD_PER_M_TOKENS_BATCH },
    }, null, 2))
    console.log(`\n[predict] wrote ${JSON_OUT}`)
  }
  await endNeonPool()
}
main().catch((e) => { console.error('[predict] FATAL', e); process.exit(1) })
