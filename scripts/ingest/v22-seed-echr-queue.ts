/**
 * v22-seed-echr-queue.ts — V22 §2: HUDOC revival seed (GBR ENG universe).
 *
 * ⚠️ RUN ONLY AFTER THE V22 PUSH (doc:{itemid} form needs the rewritten
 * processEchr — playbook §8: seed-after-push).
 *
 * Enumerates the 4,471-doc universe (V20 measured, re-verified 13 Jun 2026:
 * `contentsitename:ECHR AND respondent:"GBR" AND languageisocode:"ENG"`)
 * via kpdate-sorted listing pages and seeds one doc:{itemid} row per doc.
 * --canary N seeds only the first N docs.
 *
 * Checkpointed per page; on completion unblocks corpus_targets.echr-hudoc.
 */
import * as fs from 'fs'
import * as path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listGbrDocsPage } from './sources/echr-hudoc'

const CORPUS = 'echr-hudoc'
const CHECKPOINT = path.join(__dirname, 'seed-echr-checkpoint.json')
const PAGE = 50

async function main() {
  const canaryArg = process.argv.indexOf('--canary')
  const canary = canaryArg >= 0 ? Number(process.argv[canaryArg + 1] ?? 5) : 0

  const pool = getNeonPool()
  const ckpt: { start: number; total: number } = !canary && fs.existsSync(CHECKPOINT)
    ? JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) : { start: 0, total: 0 }

  let resultcount = 0
  let complete = false
  for (let start = ckpt.start; ; start += PAGE) {
    if (canary && ckpt.total >= canary) break
    let page = await listGbrDocsPage(start, PAGE)
    for (let attempt = 1; page === null && attempt <= 3; attempt++) {
      console.warn(`[seed] start=${start}: fetch failed — cooling 60s (retry ${attempt}/3)`)
      await new Promise(r => setTimeout(r, 60_000))
      page = await listGbrDocsPage(start, PAGE)
    }
    if (page === null) {
      console.warn(`[seed] start=${start}: still failing — stopping (checkpoint saved, rerun to resume)`)
      break
    }
    resultcount = page.resultcount
    if (page.docs.length === 0) { complete = true; break }
    const docs = canary ? page.docs.slice(0, canary - ckpt.total) : page.docs
    const { affected } = await bulkInsertQueueRows(docs.map(d => ({
      id: `${CORPUS}:doc:${d.itemId}`,
      corpus: CORPUS,
      docId: `doc:${d.itemId}`,
      sourceType: 'echr',
      priority: 2,
    })))
    ckpt.start = start + PAGE
    ckpt.total += affected
    if (!canary) fs.writeFileSync(CHECKPOINT, JSON.stringify(ckpt))
    if (start % 500 === 0) console.log(`[seed] start=${start}/${resultcount}: +${affected} (total new ${ckpt.total})`)
    if (start + PAGE >= resultcount) { complete = true; break }
  }

  console.log(`[seed] echr-hudoc: ${ckpt.total} new rows (universe ${resultcount})`)
  if (!canary && complete) {
    await pool.query(`
      UPDATE corpus_targets
      SET est_sections = $2, est_is_confirmed = false, blocked = false, blocked_reason = NULL,
          notes = 'V22 revival: live routes (/app/query/results + conversion/pdf, browser UA + Referer). Universe = GBR ENG resultcount, enumerated at seed. Licence echr-nc. Re-baseline at drain.'
      WHERE corpus_key = $1`, [CORPUS, resultcount])
    console.log(`[targets] ${CORPUS} unblocked, est=${resultcount}`)
  } else if (!canary) {
    console.log('[targets] walk incomplete — est NOT updated (V20 partial-universe rule)')
  }
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
