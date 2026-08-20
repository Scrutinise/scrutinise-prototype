/**
 * dump-recompiled.ts — print a slice of one re-compiled judgment, for hand-reading and for
 * choosing the §2.2 gold phrase. WRITES NOTHING.
 * Run: --id="tna-caselaw:[2019] UKSC 41:1" --from=0 --len=3000
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { aknJudgmentText } from '../shared/akn-text'

const id = process.argv.find(a => a.startsWith('--id='))!.slice(5)
const from = parseInt(process.argv.find(a => a.startsWith('--from='))?.split('=')[1] ?? '0', 10)
const len = parseInt(process.argv.find(a => a.startsWith('--len='))?.split('=')[1] ?? '3000', 10)

;(async () => {
  const p = namesPool()
  const r = (await p.query(`SELECT "r2RawKey" FROM corpus_sections WHERE id=$1`, [id])).rows[0]
  const raw = await r2Get(r.r2RawKey)
  const t = aknJudgmentText(raw!)!.text
  console.log(`total ${t.length} chars\n`)
  console.log(t.slice(from, from + len))
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
