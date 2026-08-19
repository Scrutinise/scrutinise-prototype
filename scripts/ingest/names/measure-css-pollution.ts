/**
 * measure-css-pollution.ts — a finding this sprint TRIPPED OVER rather than went looking for.
 *
 * `rawToText` emits the Akoma Ntoso `<meta>` block, so a compiled `tna-caselaw` document opens
 * with the generator's embedded stylesheet. Two consequences, and the second is user-visible today:
 *
 *   1. it is indexed — the CSS is in the FTS body, so `font-family` and `Times New Roman` are
 *      searchable terms in the case-law tier;
 *   2. it is SERVED — `fts-serve` returns the head of the body as the snippet, and for case law
 *      that snippet is a stylesheet. A live query returns:
 *
 *        "snippet": "UKSC 2019 41 [2019] UKSC 41 0.26.19 c08dfb9d… 7.4.0 #judgment { font-family:
 *                    'Times New Roman'; font-size: 12pt; } #judgment .Normal { font-size: 12pt; } …"
 *
 *      — which is what Lex is handed as the EVIDENCE for R (Miller) v The Prime Minister.
 *
 * This measures how much of the corpus it is. It writes nothing: fixing it means re-compiling
 * 74,896 documents and rebuilding the index, which is a sprint, not a footnote.
 */
import { namesPool, endNamesPool } from './names-pool'
import { r2Get } from '../shared/r2-client'
import { stripAknPreamble } from '../shared/caselaw-name'

;(async () => {
  const p = namesPool()
  const n = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '100', 10)
  const rows = (await p.query(
    `SELECT id, "r2Key" FROM corpus_sections WHERE corpus='tna-caselaw' AND "r2Key" IS NOT NULL
      ORDER BY md5(id || 'css') LIMIT $1`, [n])).rows

  let withCss = 0, totalChars = 0, cssChars = 0
  const shares: number[] = []
  for (const r of rows) {
    const t = await r2Get(r.r2Key)
    if (!t) continue
    const body = stripAknPreamble(t)
    const cut = t.length - body.length
    totalChars += t.length
    cssChars += cut
    if (cut > 0) { withCss++; shares.push(cut / t.length) }
  }
  shares.sort((a, b) => a - b)
  const pctile = (q: number) => shares.length ? (100 * shares[Math.floor(q * (shares.length - 1))]).toFixed(1) : '—'
  console.log(`sampled ${rows.length} tna-caselaw compiled documents`)
  console.log(`  documents opening with an AKN <meta>/CSS preamble: ${withCss}/${rows.length} (${(100 * withCss / rows.length).toFixed(1)}%)`)
  console.log(`  characters that are preamble rather than judgment: ${cssChars.toLocaleString()} of ${totalChars.toLocaleString()} (${(100 * cssChars / totalChars).toFixed(2)}%)`)
  console.log(`  per-document preamble share: p10 ${pctile(0.1)}%  p50 ${pctile(0.5)}%  p90 ${pctile(0.9)}%  max ${pctile(1)}%`)
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
