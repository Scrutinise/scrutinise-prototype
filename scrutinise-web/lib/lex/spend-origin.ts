// What an UNATTRIBUTED ledger row most likely IS, from its stream and pass — so the dashboard's
// "Unattributed" line is diagnosable without a second query. This is a LABEL, not attribution: a row
// classed 'measurement' is still unattributed, and stays on the line. It only says whether the gap is
// expected (no user exists for ingest, a benchmark, an admin test) or a defect (a user's build, chat or
// search that lost its attribution).

export type SpendOrigin = 'user-facing' | 'measurement' | 'platform' | 'unknown'

const MEASUREMENT = /^(s24b\.|reachability|CLASSIFY_STALE|BACKFILL_TITLE|MERGE_TIGHTENED|graph\.edm-test|meter-verify)/
const PLATFORM = /^(graph\.|orientation\.web-search$|smart-vocabulary\.)/

export function spendOriginOf(stream: string, pass: string): SpendOrigin {
  if (MEASUREMENT.test(pass)) return 'measurement'
  if (stream === 'ingest' || stream === 'graph' || PLATFORM.test(pass)) return 'platform'
  if (stream === 'admin') return 'measurement'
  // build / deepening / lex(chat, search) with no user: something a person caused lost its attribution.
  if (['build', 'deepening', 'lex', 'orientation'].includes(stream)) return 'user-facing'
  return 'unknown'
}
