/**
 * The 65 gold questions the retrieval measurements run over — ONE definition, imported by every harness that needs "the 65"
 * (measure-s19-grain.ts, measure-gold-vocab.ts). Lifted out of measure-s19-grain.ts on 2026-10-22 (SEARCH-29) so a second script cannot
 * quietly use a different filter. The selection is unchanged: S10's ACCEPT questions that are not negative controls, and GOLD V2's recall questions.
 */
import { GOLD_CORPUS } from './s10-gold-set'
import { GOLD_V2 } from './gold-v2-set'

export interface GoldQuestion { id: string; collection: string; question: string; keys: string[]; set: 's10' | 'v2' }

export const ALL_GOLD_QUESTIONS: GoldQuestion[] = [
  ...GOLD_CORPUS.filter((q) => q.verdict === 'ACCEPT' && q.scoring !== 'negative-control')
    .map((q): GoldQuestion => ({ id: `S10-Q${q.n}`, collection: q.collection, question: q.question, keys: q.keys, set: 's10' })),
  ...GOLD_V2.filter((q) => q.scoring === 'recall')
    .map((q): GoldQuestion => ({ id: `V2-${q.id}`, collection: q.collection ?? 'unknown', question: q.query, keys: q.keys, set: 'v2' })),
]
