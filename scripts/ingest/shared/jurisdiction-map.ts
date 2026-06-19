/**
 * jurisdiction-map.ts — corpus → jurisdiction (V28 §1.2).
 *
 * Single source of truth for the per-section jurisdiction label written at
 * ingest (db-metadata.ts) and backfilled by v28-jurisdiction-column.ts. The
 * labels match scripts/ingest/search/corpus-map.ts jurisdictionFor() exactly so
 * the FTS indexer and the corpus_sections.jurisdiction column never disagree.
 *
 * First approximation only: corpus-level. Some UK-wide Acts have territorial
 * extent differences not captured here — refine per-section later where ranking
 * needs it (see the column comment).
 */
export type Jurisdiction = 'uk' | 'wales' | 'scotland' | 'ni'

export function jurisdictionForCorpus(corpus: string): Jurisdiction {
  if (corpus.startsWith('senedd')) return 'wales'
  if (corpus.startsWith('scottish') || corpus === 'scotlawcom') return 'scotland'
  if (corpus === 'niassembly-hansard' || corpus === 'ni-judgments' || corpus === 'nilawcom') return 'ni'
  return 'uk'
}
