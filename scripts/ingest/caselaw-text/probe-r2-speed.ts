/**
 * probe-r2-speed.ts — why the date sweep ran at 6 documents/second when the text re-compile, which
 * reads TWO whole objects per document, ran at 71. Measures the two read paths side by side on the
 * same keys rather than reasoning about them. WRITES NOTHING.
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get, r2GetRange } from '../shared/r2-client'
import { judgmentDateFromAkn } from '../shared/caselaw-name'

const n = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '120', 10)
const C = parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? '24', 10)

async function mapPool<A, R>(items: A[], k: number, fn: (a: A) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length); let i = 0
  await Promise.all(Array.from({ length: Math.min(k, items.length) }, async () => {
    for (;;) { const j = i++; if (j >= items.length) return; out[j] = await fn(items[j]) }
  }))
  return out
}

;(async () => {
  const p = namesPool()
  const rows = (await p.query(
    `SELECT "r2RawKey" AS k FROM corpus_sections WHERE corpus='tna-caselaw' AND "r2RawKey" IS NOT NULL
      ORDER BY md5(id || 'speed') LIMIT $1`, [n])).rows.map(r => r.k as string)

  for (const [label, fn] of [
    ['r2GetRange(32 KB)', async (k: string) => (await r2GetRange(k, 32_768))?.length ?? -1],
    ['r2Get(whole object)', async (k: string) => (await r2Get(k))?.length ?? -1],
  ] as const) {
    const t = Date.now()
    const lens = await mapPool(rows, C, fn)
    const secs = (Date.now() - t) / 1000
    const nulls = lens.filter(l => l < 0).length
    console.log(`${label.padEnd(22)} ${rows.length} keys at concurrency ${C}: ${secs.toFixed(1)}s = ` +
      `${(rows.length / secs).toFixed(1)}/s   nulls ${nulls}   mean ${Math.round(lens.filter(l => l >= 0).reduce((a, b) => a + b, 0) / Math.max(1, rows.length - nulls)).toLocaleString()} chars`)
  }

  // And the thing the sweep actually asks: does the range window contain the date?
  const heads = await mapPool(rows.slice(0, 40), C, async k => await r2GetRange(k, 32_768))
  const found = heads.filter(h => h && judgmentDateFromAkn(h)).length
  console.log(`\nFRBRdate present in the 32 KB window: ${found}/40 — a miss here forces a SECOND, full read`)
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
