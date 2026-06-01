import { WorkerCheckpoint } from '../shared/checkpoint'

export type CorpusId =
  | 'primary-acts-pre-2000' | 'primary-acts-2000plus'
  | 'si-pre-2010' | 'si-2010plus'
  | 'regional' | 'retained-eu'
  | 'fca-regulators' | 'hmrc-codes-guidance'
  | 'tna-caselaw' | 'international'
  | 'hansard-commons-a' | 'hansard-commons-b'
  | 'hansard-lords-a' | 'committees-a'
  | 'hansard-lords-b' | 'committees-b'
  | 'bailii-tribunals' | 'bailii-eat' | 'bailii-privy-ni'
  | 'echr-hudoc' | 'eur-lex' | 'uk-treaties' | 'oecd'

const PHASE1_CORPUS: Record<number, CorpusId> = {
  1: 'primary-acts-pre-2000',
  2: 'primary-acts-2000plus',
  3: 'si-pre-2010',
  4: 'si-2010plus',
  5: 'regional',
  6: 'retained-eu',
  7: 'fca-regulators',
  8: 'hmrc-codes-guidance',
  9: 'tna-caselaw',
  10: 'international',
}

const PHASE2_CORPORA: Record<number, CorpusId[]> = {
  1: ['hansard-commons-a'],
  2: ['hansard-commons-b'],
  3: ['hansard-lords-a', 'committees-a'],
  4: ['hansard-lords-b', 'committees-b'],
  5: ['bailii-tribunals'],
  6: ['bailii-eat'],
  7: ['bailii-privy-ni'],
  8: [], // Worker 8 is a single corpus — no Phase 2
  9: [], // Worker 9 is a single corpus — no Phase 2
  10: ['uk-treaties'], // echr-hudoc / eur-lex / oecd handled in Phase 1; uk-treaties not yet implemented
}

export function getPhase1Corpus(workerId: number): CorpusId {
  return PHASE1_CORPUS[workerId] ?? 'primary-acts-pre-2000'
}

export function getPhase2Corpora(workerId: number): CorpusId[] {
  return PHASE2_CORPORA[workerId] ?? []
}

export function currentCorpus(cp: WorkerCheckpoint, workerId: number): CorpusId {
  if (!cp.phase1Complete) return getPhase1Corpus(workerId)
  const phase2 = getPhase2Corpora(workerId)
  // Find the first corpus in phase 2 that isn't done
  return (phase2.find(c => cp.corpus !== c) ?? phase2[0] ?? getPhase1Corpus(workerId)) as CorpusId
}

export const CORPUS_LABELS: Record<CorpusId, string> = {
  'primary-acts-pre-2000': 'UK Primary Acts pre-2000',
  'primary-acts-2000plus': 'UK Primary Acts 2000+',
  'si-pre-2010':           'UK Statutory Instruments pre-2010',
  'si-2010plus':           'UK Statutory Instruments 2010+',
  'regional':              'Regional Legislation (Scot/Wales/NI)',
  'retained-eu':           'Retained EU Law',
  'fca-regulators':        'FCA Handbook + Regulators',
  'hmrc-codes-guidance':   'HMRC Manuals + Codes + Guidance',
  'tna-caselaw':           'TNA Find Case Law (2001+)',
  'international':         'ECHR + EUR-Lex + Treaties + OECD',
  'hansard-commons-a':     'Hansard Commons A (pre-1981)',
  'hansard-commons-b':     'Hansard Commons B (1981+)',
  'hansard-lords-a':       'Hansard Lords A (pre-1981)',
  'committees-a':          'Parliamentary Committees A',
  'hansard-lords-b':       'Hansard Lords B (1981+)',
  'committees-b':          'Parliamentary Committees B',
  'bailii-tribunals':      'BAILII Tribunals',
  'bailii-eat':            'BAILII Employment Appeals',
  'bailii-privy-ni':       'BAILII Privy Council + NI',
  'echr-hudoc':            'ECHR HUDOC (UK cases)',
  'eur-lex':               'EUR-Lex (retained EU instruments)',
  'uk-treaties':           'UK Treaties',
  'oecd':                  'OECD Free Tier',
}
