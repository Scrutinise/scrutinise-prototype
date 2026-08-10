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
import fs from 'fs'
import path from 'path'
import { corpusToType, corpusDisplayName, EXCLUDED_BY_DESIGN } from '../lib/lex/corpus-type-map'
import { STREAM_SCOPES, streamCanSelect, type StreamScope } from '../lib/lex/stream-scopes'
import { ANNOTATION_CORPORA, annotatedGidFromId, annotationTitle, isAnnotationCorpus } from '../lib/lex/annotation-title'
import type { SearchResultType } from '../lib/lex/page1-config'

const root = path.join(__dirname, '..')
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8')

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

// ── 5. S2C2 §1 — the tenth display type ──────────────────────────────────────
section('§1 — EXPLANATORY_NOTE, and the isLeg property that must not come back')
{
  for (const corpus of ANNOTATION_CORPORA) {
    const { tier, id } = REAL[corpus]
    ok(`${corpus} types EXPLANATORY_NOTE`, corpusToType(corpus, tier, id) === 'EXPLANATORY_NOTE',
       String(corpusToType(corpus, tier, id)))
  }

  // THE property the brief asked to preserve WITH a check. isLeg rewrites the title to the Act's
  // and the URL to a legislation.gov.uk PROVISION link; an annotation taking that path would be
  // rendered as enacted text. Asserted at SOURCE in both adapters, because the value is computed
  // inline in each and there is no shared constant to import.
  for (const file of ['lib/lex/fts-search.ts', 'lib/lex/vector-search.ts']) {
    const src = read(file)
    const m = src.match(/const isLeg\s*=\s*([^\n]*(?:\n\s*[^\n]*)?)/)
    ok(`${file} defines isLeg`, !!m)
    ok(`${file}: isLeg does NOT include EXPLANATORY_NOTE`, !!m && !m[1].includes('EXPLANATORY_NOTE'), m?.[1]?.trim())
  }
  // …and prove that detector can fail, against a line that WOULD be the defect.
  const wouldBeDefect = "const isLeg = type === 'PRIMARY_LEGISLATION' || type === 'EXPLANATORY_NOTE'"
  ok('the isLeg detector matches a line that would reintroduce it',
     /const isLeg\s*=\s*([^\n]*)/.exec(wouldBeDefect)![1].includes('EXPLANATORY_NOTE'))

  // ⚠ THE SILENT-INVISIBILITY TRAP. BackgroundPanel renders `TYPE_ORDER.map(...)`, not the
  // results, so a display type missing from that ARRAY renders nowhere — and the array is a plain
  // list, which tsc cannot check the way it checks the Record beside it. Same in
  // build-initial-background.ts, where even the Record is `Record<string, string>`.
  const UNION = read('lib/lex/page1-config.ts')
    .split('export type SearchResultType =')[1].split('export interface SearchResult')[0]
    .match(/'([A-Z_]+)'/g)!.map((s) => s.replace(/'/g, ''))
  ok('the union parsed sanely (10 types)', UNION.length === 10, UNION.join(','))
  // Matched against the DECLARATION, not against the first mention of the name — both files
  // now carry a comment warning about this array, and splitting on the bare word picked up the
  // comment instead of the code.
  const declaredList = (src: string, name: string) =>
    (new RegExp(`const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`).exec(src)?.[1] ?? '')
      .match(/'([A-Z_]+)'/g)?.map((s) => s.replace(/'/g, '')) ?? []
  const declaredKeys = (src: string, name: string) =>
    (new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src)?.[1] ?? '')
      .match(/^\s*([A-Z_]+):/gm)?.map((s) => s.trim().replace(':', '')) ?? []
  for (const [file, orderName, labelName] of [
    ['components/lex/BackgroundPanel.tsx', 'TYPE_ORDER', 'TYPE_LABELS'],
    ['lib/documents/build-initial-background.ts', 'TYPE_ORDER', 'TYPE_LABELS'],
    ['components/admin/LexGeneralChat.tsx', '', 'TYPE_LABEL'],
  ] as const) {
    const src = read(file)
    const labels = declaredKeys(src, labelName)
    const missingLabel = UNION.filter((t) => !labels.includes(t))
    ok(`${file}: ${labelName} covers every display type`, labels.length > 0 && missingLabel.length === 0,
       labels.length ? `missing ${missingLabel.join(', ')}` : 'parsed nothing — the detector is broken, not the file')
    if (!orderName) continue
    const order = declaredList(src, orderName)
    const missingOrder = UNION.filter((t) => !order.includes(t))
    ok(`${file}: ${orderName} covers every display type (a missing entry renders NOWHERE)`,
       order.length > 0 && missingOrder.length === 0,
       order.length ? `missing ${missingOrder.join(', ')}` : 'parsed nothing — the detector is broken, not the file')
  }
  // Prove THAT can fail: a union with an 11th type must be reported missing.
  {
    const order = ['PRIMARY_LEGISLATION']
    ok('the coverage detector reports a type absent from TYPE_ORDER',
       ['PRIMARY_LEGISLATION', 'A_NEW_TYPE'].filter((t) => !order.includes(t)).length === 1)
  }
  ok('the panel label says it explains the law rather than naming a term of art',
     /EXPLANATORY_NOTE:\s*'What the law was for'/.test(read('components/lex/BackgroundPanel.tsx')))
}

// ── 6. S2C2 §2 — annotation titles name the Act, and only annotations do ──────
section('§2 — the annotation title rule fires for annotations and nothing else')
{
  ok('isAnnotationCorpus accepts both annotation corpora',
     ANNOTATION_CORPORA.every((c) => isAnnotationCorpus(c)))
  for (const c of ['primary-acts-2000plus', 'si-pre-2010', 'eur-lex', 'hansard', 'erskine-may', 'explanatory-other']) {
    ok(`…and rejects ${c}`, !isAnnotationCorpus(c))
  }

  // The gid is segment 2 of a FOUR-part id — segment 1 is the en/em discriminator, which is
  // exactly why the ordinary gidFromId returns null for these.
  ok('annotatedGidFromId reads the Act gid off a real note id',
     annotatedGidFromId('explanatory-notes:en:ukpga/2022/30:1-0030') === 'ukpga/2022/30')
  ok('…and off a real memorandum id',
     annotatedGidFromId('explanatory-memoranda:em:uksi/2002/1070:1') === 'uksi/2002/1070')
  ok('…and returns null for an ordinary 3-part legislation id (no false positives)',
     annotatedGidFromId('primary-acts-2000plus:ukpga/2022/30:section-1') === null)
  ok('…and null when segment 2 is not gid-shaped',
     annotatedGidFromId('explanatory-notes:en:notagid:1') === null)

  // ⚠ FALL BACK TO THE CURRENT STRING, NEVER TO A BLANK OR A PARTIAL. A gid is ugly; an empty
  // title, or "Explanatory Notes —" with nothing after it, is a defect.
  const resolved = annotationTitle('explanatory-notes', 'Building Safety Act 2022', 'Explanatory Notes: ukpga/2022/30 (7)')
  ok('a resolved note names the Act', resolved.title === 'Explanatory Notes — Building Safety Act 2022', resolved.title)
  const unresolved = annotationTitle('explanatory-notes', null, 'Explanatory Notes: ukpga/1999/16 (1)')
  ok('an unresolved note keeps the string it had', unresolved.title === 'Explanatory Notes: ukpga/1999/16 (1)', unresolved.title)
  ok('…and never produces a dangling separator', !/—\s*$/.test(unresolved.title) && !/—\s*$/.test(resolved.title))
  for (const [label, v] of [['title', unresolved.title], ['citation', unresolved.citation]] as const) {
    ok(`an unresolved note has a non-empty ${label}`, v.trim().length > 0, JSON.stringify(v))
  }
  const noTitleAtAll = annotationTitle('explanatory-memoranda', null, corpusDisplayName('explanatory-memoranda'))
  ok('a row with no sectionTitle at all still reads as prose, not a corpus key',
     !noTitleAtAll.title.includes('-'), noTitleAtAll.title)
}

// ── 7. S2C2 §3 — Holyrood must not be mistakable for Westminster ─────────────
section('§3 — scottish-parliament-or is in debates, and says which parliament it is')
{
  const debates = STREAM_SCOPES.find((s) => s.name === 'debates')!
  ok('the debates stream lists scottish-parliament-or in extraCorpora',
     !!debates.extraCorpora?.includes('scottish-parliament-or'))
  ok('it is selectable by debates', streamCanSelect(debates, 'scottish-parliament-or', 'other', 'DEBATE'))
  ok('…and NOT by guidance (extraCorpora is per-stream, not global)',
     !streamCanSelect(STREAM_SCOPES.find((s) => s.name === 'guidance')!, 'scottish-parliament-or', 'other', 'DEBATE'))
  ok('…and would NOT be reachable on tier alone', debates.tier !== 'other')

  // 1,043,264 of 1,044,188 rows carry a sectionTitle beginning "Scottish Parliament: …", so the
  // jurisdiction is in the rendered title for 99.91% of them by data. This closes the 924 that
  // carry no title and would otherwise have rendered as the literal corpus key.
  const fallback = corpusDisplayName('scottish-parliament-or')
  ok('an untitled Scottish row names the parliament', /Scottish Parliament/.test(fallback), fallback)
  ok('…and is not the raw corpus key', fallback !== 'scottish-parliament-or', fallback)
  ok('corpusDisplayName leaves unnamed collections exactly as they are',
     corpusDisplayName('hansard') === 'hansard')
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
