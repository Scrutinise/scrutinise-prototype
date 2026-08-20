/**
 * probe-caselaw-sizes.ts — the §1.3 audit noticed that 26 of 60 sampled `et-decisions` bodies are
 * under 400 characters. That is not a stylesheet problem and is not fixed by this sprint, so it is
 * going in the report's NOT-DONE list — with a real number rather than a sample impression.
 * Pure aggregate over `wordCount`; touches no R2. WRITES NOTHING.
 */
import { namesPool, endNamesPool } from '../names/names-pool'

const COLLECTIONS = ['tna-caselaw', 'ni-judgments', 'scottish-courts', 'et-decisions', 'tax-tribunals', 'echr-hudoc', 'cma-cases']

;(async () => {
  const p = namesPool()
  const { rows } = await p.query(
    `SELECT corpus,
            COUNT(*)::int                                            AS rows,
            COUNT(*) FILTER (WHERE "wordCount" < 50)::int            AS under_50_words,
            COUNT(*) FILTER (WHERE "wordCount" < 200)::int           AS under_200_words,
            percentile_disc(0.5) WITHIN GROUP (ORDER BY "wordCount") AS median_words,
            AVG("wordCount")::int                                    AS mean_words
       FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY corpus ORDER BY rows DESC`,
    [COLLECTIONS])
  const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(1)}%`
  console.table(rows.map(r => ({
    corpus: r.corpus,
    rows: Number(r.rows).toLocaleString(),
    'median words': Number(r.median_words).toLocaleString(),
    'mean words': Number(r.mean_words).toLocaleString(),
    'under 50 words': `${Number(r.under_50_words).toLocaleString()} (${pct(r.under_50_words, r.rows)})`,
    'under 200 words': `${Number(r.under_200_words).toLocaleString()} (${pct(r.under_200_words, r.rows)})`,
  })))
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
