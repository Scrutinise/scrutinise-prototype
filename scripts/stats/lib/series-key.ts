// THE SERIES IDENTITY DEFINITION. One place, so the ingest path, the backfill and the
// search thread's catalogue index can never disagree about what "the same series" means.
//
// WHY THIS EXISTS
// `stat_series.id` is a cuid: unique, but not stable. Anything that changes how a series
// key is computed mints a NEW row beside the old one, and the upsert can no longer reach
// the old one — which is exactly how 27 stale HMRC tax-gap series came to sit next to 30
// correct ones, double-counting 540 observations (1 Aug 2026). The natural key is no help
// on its own either: 3,404 series collapse onto 3,244 distinct
// (datasetId, measure, geography, cofogFunctionCode, forecastVintage) tuples, because
// sourceSeriesId is null for 2,925 of them and the distinguishing detail — which
// department, which tax, which wellbeing band — lives only in seriesLabel.
//
// THE DEFINITION
//   seriesKey = sha256_hex( datasetId ␟ measure ␟ geography ␟ cofog ␟ vintage ␟ seriesLabel )
//   ␟ = U+001F (unit separator).  A null field is written as U+001E (record separator).
// Both are C0 control characters that cannot occur in a spreadsheet label, a slug or an
// ISO code, so no value can impersonate a separator or a null.
//
// WHAT IS DELIBERATELY *NOT* IN THE KEY
//   unit            — corrigible metadata about the same line of data. §2 of the 4 Aug brief
//                     recovers OBR's unit='UNKNOWN' series; if unit were in the key, that
//                     repair would orphan all 2,807 of them and re-create the very duplicate
//                     class this column exists to end.
//   sourceSeriesId  — same reasoning: backfilling a source id must not re-key the series.
//   id / createdAt  — not identity, just bookkeeping.
//
// WHAT IS IN, AND THE COST OF IT
//   seriesLabel is in, because without it the key is not unique (see above). The price is
//   that a source which RE-WORDS a label mints a new series. That is the correct trade for
//   this data — labels here are derived from stable source structure (sheet names, COFOG
//   names, tax names), and a genuinely new wording usually does mean a new line — but it is
//   the thing to check first if duplicate series ever reappear.
//
// SQL MIRROR — the backfill migration computes the identical value in Postgres:
//   encode(sha256(convert_to(
//     "datasetId" || E'\x1f' || measure || E'\x1f' || geography || E'\x1f' ||
//     coalesce("cofogFunctionCode", E'\x1e') || E'\x1f' ||
//     coalesce("forecastVintage",  E'\x1e') || E'\x1f' || "seriesLabel", 'UTF8')), 'hex')
// If you change one, change both, and re-run `npm run verify`.
import { createHash } from 'node:crypto'

const SEP = '\u001f'          // U+001F UNIT SEPARATOR
const NULL_MARKER = '\u001e'  // U+001E RECORD SEPARATOR — stands in for a null field

export interface SeriesIdentity {
  datasetId: string
  measure: string
  geography: string
  cofogFunctionCode: string | null
  forecastVintage: string | null
  seriesLabel: string
}

/** The canonical pre-hash string. Exported so a mismatch can be diffed, not guessed at. */
export function seriesKeyCanonical(k: SeriesIdentity): string {
  return [
    k.datasetId,
    k.measure,
    k.geography,
    k.cofogFunctionCode ?? NULL_MARKER,
    k.forecastVintage ?? NULL_MARKER,
    k.seriesLabel,
  ].join(SEP)
}

/** The stable join key. 64 lowercase hex chars. */
export function computeSeriesKey(k: SeriesIdentity): string {
  return createHash('sha256').update(seriesKeyCanonical(k), 'utf8').digest('hex')
}
