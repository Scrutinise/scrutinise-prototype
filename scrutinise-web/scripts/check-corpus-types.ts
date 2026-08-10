/**
 * check-corpus-types.ts — the four collections no caller could receive, and the invariant that
 * keeps a DELIBERATE exclusion from looking like a defect (BRIEF_SEARCH_S2C §1).
 *
 * THE DEFECT. `corpusToType` returned null for `explanatory-notes` (18,801 sections),
 * `explanatory-memoranda` (27,428), `erskine-may` and `members-interests`. A null there is not a
 * demotion, it is a deletion: the FTS adapter drops the hit before any caller sees it. So all four
 * were indexed, searched, retrieved and discarded — and V33 had built 24,987 vectors for the two
 * explanatory corpora six hours before the reachability matrix said no user could receive them.
 *
 * THE PART THAT OUTLIVES THE FIX. Three of the four were accidents and one — `members-interests` —
 * is a decision (SEARCH_STRATEGY.md §3.1: a political-risk/people-graph input, not general
 * search). They produced the identical `null`, so the correct exclusion was indistinguishable
 * from the three defects and the next sweep of the nulls would have wired it in. This check
 * asserts the difference is now structural: the decision lives in `EXCLUDED_BY_DESIGN` with its
 * reason attached, ahead of every other rule, and the matrix prints a different word for it.
 *
 * WHAT IT CHECKS, in the order that matters:
 *   1. Every assertion is PROVEN ABLE TO FAIL first, against a deliberately wrong fixture. A
 *      check trusted to pass without having been seen to fail is worth nothing — `check:flags`
 *      spent a day passing 48/49 against correct code, and the reverse error is quieter.
 *   2. The three fixed collections map to a non-null type AND are selectable by the stream the
 *      brief names. Typing alone is not the fix for `erskine-may`: it carries tier `other`, so
 *      it also needs the guidance stream's `extraCorpora`. Asserting the type without asserting
 *      selectability would report success on half a fix.
 *   3. The annotations are NOT typed as legislation — `isLeg` in fts-search.ts would rewrite an
 *      explanatory note's title to the Act's title and its URL to a provision link, presenting
 *      the annotation as the enacted text.
 *   4. `members-interests` maps to null, has a stated reason, and NO stream can select it.
 *   5. The exclusion survives a re-tier — the mechanism it is implemented with must not be the
 *      tier it happens to sit under today.
 *
 * Usage: npm run check:corpus-types
 */
import { corpusToType, EXCLUDED_BY_DESIGN } from '../lib/lex/corpus-type-map'
import { STREAM_SCOPES, streamCanSelect, type StreamScope } from '../lib/lex/stream-scopes'
import type { SearchResultType } from '../lib/lex/page1-config'

let passed = 0
const failures: string[] = []

function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}
function section(title: string) { console.log(`\n${title}`) }

/** Which streams could select this corpus, given its INDEXED tier and its display type. */
function streamsFor(corpus: string, indexedTier: string): string[] {
  const type = corpusToType(corpus, indexedTier, `${corpus}:probe:1`)
  return STREAM_SCOPES.filter((s) => streamCanSelect(s, corpus, indexedTier, type)).map((s) => s.name)
}

// Real ids and real INDEXED tiers, read off docs/corpus_reachability.json (2026-08-09) — not the
// tier `tierFor()` would compute today, which is the distinction the whole matrix rests on.
const REAL: Record<string, { tier: string; id: string }> = {
  'explanatory-notes': { tier: 'legislation', id: 'explanatory-notes:en:ukpga/1999/17:1-0002' },
  'explanatory-memoranda': { tier: 'legislation', id: 'explanatory-memoranda:em:uksi/2002/1070:1' },
  'erskine-may': { tier: 'other', id: 'erskine-may:11162:1' },
  'members-interests': { tier: 'other', id: 'members-interests:10004:1' },
}
const LEGISLATION_TYPES: SearchResultType[] = ['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION']

// ── 1. prove the assertions can fail ─────────────────────────────────────────
section('the assertions, proven to FAIL before they are trusted to pass')
{
  // A corpus nobody has mapped, under a tier no stream selects: null, no stream. If this came
  // back typed or selectable, every "is it reachable" assertion below would be a no-op.
  const t = corpusToType('a-corpus-that-does-not-exist', 'other', 'a-corpus-that-does-not-exist:x:1')
  ok('an unmapped corpus under tier "other" still types null', t === null, String(t))
  ok('…and no stream can select it', streamsFor('a-corpus-that-does-not-exist', 'other').length === 0)

  // The selectability arithmetic must reject as well as accept.
  const guidance = STREAM_SCOPES.find((s) => s.name === 'guidance')!
  ok('streamCanSelect rejects a null type outright', !streamCanSelect(guidance, 'erskine-may', 'other', null))
  ok('streamCanSelect rejects an out-of-tier corpus not in extraCorpora',
     !streamCanSelect(guidance, 'hansard', 'parliamentary', 'DEBATE'))
  const committees = STREAM_SCOPES.find((s) => s.name === 'committees')!
  ok('…and rejects an in-tier corpus outside the stream\'s corpus list',
     !streamCanSelect(committees, 'hansard', 'parliamentary', 'COMMITTEE'))

  // The registry lookup must be a lookup, not a truthiness accident.
  ok('EXCLUDED_BY_DESIGN does not claim a corpus it has never heard of',
     !('hansard' in EXCLUDED_BY_DESIGN))
}

// ── 2. the three that were fixed ─────────────────────────────────────────────
section('§1a/§1b — the three accidental exclusions are reachable')
{
  const FIXED: Array<{ corpus: string; stream: string }> = [
    { corpus: 'explanatory-notes', stream: 'legislation' },
    { corpus: 'explanatory-memoranda', stream: 'legislation' },
    { corpus: 'erskine-may', stream: 'guidance' },
  ]
  for (const { corpus, stream } of FIXED) {
    const { tier, id } = REAL[corpus]
    const type = corpusToType(corpus, tier, id)
    ok(`${corpus} types non-null`, type !== null, `tier=${tier}`)
    const streams = streamsFor(corpus, tier)
    ok(`${corpus} is selectable by the ${stream} stream`, streams.includes(stream), `streams=[${streams.join(', ')}] type=${type}`)
  }

  // The annotations must not wear the enacted text's clothes.
  for (const corpus of ['explanatory-notes', 'explanatory-memoranda']) {
    const { tier, id } = REAL[corpus]
    const type = corpusToType(corpus, tier, id)
    ok(`${corpus} is NOT typed as legislation (isLeg would rewrite title + URL to the Act)`,
       !!type && !LEGISLATION_TYPES.includes(type), String(type))
  }

  // erskine-may's reachability rests on extraCorpora, not on its tier. Say so explicitly, so
  // that deleting the extraCorpora entry fails HERE rather than showing up as quiet zero recall.
  const guidance = STREAM_SCOPES.find((s) => s.name === 'guidance')!
  ok('the guidance stream lists erskine-may in extraCorpora', !!guidance.extraCorpora?.includes('erskine-may'))
  ok('erskine-may would NOT be reachable on tier alone (so the extra leg is load-bearing)',
     REAL['erskine-may'].tier !== guidance.tier, `indexed tier=${REAL['erskine-may'].tier}, stream tier=${guidance.tier}`)
  const withoutExtra: StreamScope = { ...guidance, extraCorpora: undefined }
  ok('…proven: drop extraCorpora and no stream can select it',
     ![...STREAM_SCOPES.filter((s) => s.name !== 'guidance'), withoutExtra]
       .some((s) => streamCanSelect(s, 'erskine-may', 'other', 'GUIDANCE')))
}

// ── 3. the one that is excluded on purpose ───────────────────────────────────
section('§1c — members-interests is excluded BY DESIGN, and says so')
{
  const { tier, id } = REAL['members-interests']
  ok('members-interests is named in EXCLUDED_BY_DESIGN', 'members-interests' in EXCLUDED_BY_DESIGN)
  const reason = EXCLUDED_BY_DESIGN['members-interests'] ?? ''
  ok('…with a non-empty reason a reader can act on', reason.trim().length > 20, JSON.stringify(reason))
  ok('…that cites where the decision was taken', /SEARCH_STRATEGY/.test(reason), reason)
  ok('it still types null', corpusToType('members-interests', tier, id) === null)
  const streams = streamsFor('members-interests', tier)
  ok('no stream can select it', streams.length === 0, `streams=[${streams.join(', ')}]`)

  // The exclusion must not be an artefact of the tier it happens to carry. It sits under `other`
  // today; a reindex that moved it to `parliamentary` must not silently wire it into `debates`.
  for (const tierNow of ['parliamentary', 'guidance', 'legislation', 'caselaw', 'other']) {
    ok(`…and survives a re-tier to "${tierNow}"`,
       corpusToType('members-interests', tierNow, id) === null && streamsFor('members-interests', tierNow).length === 0)
  }
}

// ── 4. the matrix must be able to tell the two apart ─────────────────────────
section('the verdict vocabulary — a decision and a defect must not print the same word')
{
  // The matrix computes `excluded-by-design` from this registry, so the registry has to be the
  // single place the decision is recorded. Assert it is non-empty and every reason is stated;
  // an entry with a blank reason is the old failure wearing a new field name.
  const entries = Object.entries(EXCLUDED_BY_DESIGN)
  ok('EXCLUDED_BY_DESIGN is not empty', entries.length > 0)
  for (const [corpus, why] of entries) {
    ok(`${corpus} carries a reason`, typeof why === 'string' && why.trim().length > 20, JSON.stringify(why))
    ok(`${corpus} is genuinely unreachable (the registry and the streams agree)`,
       STREAM_SCOPES.every((s) => !streamCanSelect(s, corpus, REAL[corpus]?.tier ?? 'other', corpusToType(corpus, REAL[corpus]?.tier ?? 'other', `${corpus}:probe:1`))))
  }
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
