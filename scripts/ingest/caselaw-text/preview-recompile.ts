/**
 * preview-recompile.ts — the new extractor run against real AKN, side by side with what is
 * stored today. WRITES NOTHING. This is the "watch it before you trust it" step for §2.1, and
 * the place the §2.2 gold phrase was chosen from.
 *
 * Run: --id="tna-caselaw:[2019] UKSC 41:1"   or   --n=3 for deterministic samples
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { aknJudgmentText, checkJudgmentBody } from '../shared/akn-text'
import { styleChars, firstStyleOffset } from '../shared/style-detect'
import { chunkBody } from '../search/chunk'

const idArg = process.argv.find(a => a.startsWith('--id='))?.slice(5)
const n = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '3', 10)

;(async () => {
  const p = namesPool()
  const rows = idArg
    ? (await p.query(`SELECT id, "sectionTitle", "r2Key", "r2RawKey" FROM corpus_sections WHERE id=$1`, [idArg])).rows
    : (await p.query(
        `SELECT id, "sectionTitle", "r2Key", "r2RawKey" FROM corpus_sections
          WHERE corpus='tna-caselaw' AND "r2RawKey" IS NOT NULL ORDER BY md5(id || 'prev') LIMIT $1`, [n])).rows

  if (!rows.length) console.log('no rows matched')

  for (const r of rows) {
    const raw = await r2Get(r.r2RawKey)
    const old = await r2Get(r.r2Key)
    console.log(`\n${'='.repeat(100)}\n${r.id}\n  ${r.sectionTitle}`)
    if (!raw) { console.log('  raw AKN missing'); continue }

    const fresh = aknJudgmentText(raw)
    if (!fresh) { console.log('  extractor returned NULL — unrecognised shape'); continue }
    const v = checkJudgmentBody(fresh.text)

    console.log(`\n  STORED TODAY  ${old ? old.length.toLocaleString() : '—'} chars, ` +
      `${old ? styleChars(old).toLocaleString() : '—'} of them CSS, first CSS at ${old ? firstStyleOffset(old) : '—'}`)
    console.log(`  head: ${old?.slice(0, 260)}`)
    console.log(`\n  RE-COMPILED   ${fresh.text.length.toLocaleString()} chars, ` +
      `${v.styleChars.toLocaleString()} of them CSS, first CSS at ${v.firstStyleOffset}, ${v.words.toLocaleString()} words`)
    console.log(`  head: ${fresh.text.slice(0, 260)}`)
    console.log(`\n  GUARD: ${v.ok ? 'ACCEPT' : 'REJECT'} — ${v.reason}`)

    const oldChunks = chunkBody(old ?? '')
    const newChunks = chunkBody(fresh.text)
    console.log(`\n  CHUNK 0 TODAY (${oldChunks.length} chunks): ${oldChunks[0]?.slice(0, 200)}`)
    console.log(`  CHUNK 0 AFTER (${newChunks.length} chunks): ${newChunks[0]?.slice(0, 200)}`)
  }
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
