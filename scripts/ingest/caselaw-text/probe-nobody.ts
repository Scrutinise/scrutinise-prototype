/**
 * probe-nobody.ts — the two judgments for which `aknJudgmentText` returned NULL, printed whole.
 *
 * ⚠ probe-refused labelled these "no <judgmentBody>/<mainBody>" and that label was WRONG: the
 * function returns null for two different reasons — no body element, OR a body element that yields
 * no text — and the probe attributed both to the first. Corrected here, and the distinction is
 * printed rather than assumed. WRITES NOTHING.
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { stripAknMeta } from '../shared/akn-text'
import { rawToText } from '../shared/compile'

const ROUTE = 'text-route:akn:judgment-minus-meta'
const BODY = /<(?:\w+:)?(?:judgmentBody|mainBody)[\s/>]/

;(async () => {
  const p = namesPool()
  const rows = (await p.query(
    `SELECT id, "sectionTitle", "sourceUrl", "r2Key", "r2RawKey"
       FROM corpus_sections
      WHERE corpus='tna-caselaw' AND (notes IS NULL OR notes NOT LIKE '%' || $1 || '%') ORDER BY id`, [ROUTE])).rows
  for (const r of rows) {
    const raw = await r2Get(r.r2RawKey)
    if (!raw) continue
    const hasBodyEl = BODY.test(raw)
    const text = rawToText(stripAknMeta(raw))
    if (hasBodyEl && text) continue          // extracted fine; refused for another reason

    const stored = await r2Get(r.r2Key)
    console.log(`\n${'='.repeat(100)}\n${r.id}\n  title  ${r.sectionTitle}\n  source ${r.sourceUrl}`)
    console.log(`  RAW AKN (${raw.length.toLocaleString()} chars), whole:\n${raw}`)
    console.log(`  STORED TODAY (${stored?.length ?? 0} chars): ${stored}`)
  }
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
