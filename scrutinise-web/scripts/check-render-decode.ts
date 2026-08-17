/**
 * check-render-decode.ts — THE RENDER-SIDE DECODE IS APPLIED, IS NOT INERT, AND HAS NOT DRIFTED.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY EACH CHECK EXISTS. Every one of them is a failure that has already happened here, once.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  §1  DRIFT — the decoder is duplicated (the Next build root cannot import from `scripts/`), and
 *      a copy nobody compares is a copy that diverges. The ingest side decides what is STORED,
 *      this side decides what is SHOWN; the two disagreeing about a document is the defect class
 *      the whole entity-decode line of work exists to remove.
 *  §2  BEHAVIOUR AT THE POINT OF USE — the ingest self-test proves the decoder works where it is
 *      DEFINED. This proves it works where it is IMPORTED, which is a different claim: a bad
 *      re-export, a wrong alias or a tree-shaken const would pass §1 and still ship nothing.
 *  §3  INERTNESS — the 17 Aug fix shipped inert first: it decoded into a new variable and returned
 *      the old one. `tsc` was clean, the check passed, and nothing was repaired. So the adapters
 *      are RUN here, against a stubbed search service that serves a contaminated hit, and the
 *      SearchResult that comes out the other end is inspected.
 *  §4  COVERAGE — a read path added later inherits nothing. The table below is the list of places
 *      corpus text reaches a user, and each carries the decode it is required to apply.
 *  §5  SAFETY — decoding turns `&lt;script&gt;` back into `<script>`, which is inert as React text
 *      and live inside `dangerouslySetInnerHTML`. The allowlist keeps "corpus text is never
 *      rendered as raw HTML" a checked fact rather than a remembered one.
 *
 * ⚠ §3 needs the database (the adapters hydrate from Neon) and NO search service — the fetch is
 * stubbed. It is read-only: the ids in the fixture do not exist, so the hydrate returns no rows.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const WEB = resolve(__dirname, '..')
const INGEST_DECODER = resolve(WEB, '../scripts/ingest/shared/html-entities.ts')
const WEB_DECODER = join(WEB, 'lib/html-entities.ts')

const CORE_START = '// SHARED CORE — BYTE-IDENTICAL ACROSS'
const CORE_END = '═ END SHARED CORE'

let failures = 0
const pass = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string) => { console.log(`  ✗ ${m}`); failures++ }
const ok = (cond: boolean, m: string) => (cond ? pass(m) : fail(m))

/** The region both copies must share, byte for byte. */
function sharedCore(path: string): string {
  const src = readFileSync(path, 'utf8')
  const i = src.indexOf(CORE_START)
  const j = src.indexOf(CORE_END, i + CORE_START.length)
  if (i < 0 || j < 0) throw new Error(`${path}: SHARED CORE markers not found`)
  return src.slice(i, src.indexOf('\n', j))
}

// ── §4's table: where corpus text reaches a user, and what each must decode ──────────────────────
// A file is listed here because it reads text from R2, from the FTS/vector index, or from a column
// the census found contaminated. The `must` strings are the decode calls that file is required to
// contain — checked as text, which is weaker than §3's behavioural test and catches the case §3
// cannot reach (a route with no adapter in front of it).
const READ_PATHS: Array<{ file: string; why: string; must: string[] }> = [
  { file: 'lib/lex/fts-search.ts', why: 'sparse hits — snippet/title built from R2', must: ['decodeMaybe(h.sectionTitle)', 'decodeMaybe(h.speaker)', 'decodeForDisplay(h.snippet ?? \'\')', 'decodeForDisplay(r.title)'] },
  { file: 'lib/lex/vector-search.ts', why: 'dense hits — same index text', must: ['decodeForDisplay(h.snippet ?? \'\')', 'decodeForDisplay(r.title)'] },
  { file: 'lib/search.ts', why: 'legacy legislation + operational FTS (1,838 / 4,874 / 12 dirty rows)', must: ['decodeForDisplay(r.actTitle)', 'decodeMaybe(r.sectionTitle)', 'decodeForDisplay(r.snippet)', 'decodeMaybe(r.pageTitle)'] },
  { file: 'lib/lex/gateway-legacy.ts', why: 'R2 compiled text + lex summary for the panel', must: ['decodeForDisplay(compiledText)', 'decodeMaybe(lexSummary)'] },
  { file: 'lib/lex/repeal-status.ts', why: '"repealed by X" names a corpus_acts title', must: ['decodeMaybe(row.title)'] },
  { file: 'app/api/ideas/[id]/legislation-search/route.ts', why: 'legacy fallback, same tables + R2', must: ['decodeMaybe(compiledText)', 'decodeMaybe(lexSummary)', 'decodeForDisplay(r.actTitle)'] },
  { file: 'app/api/legislation/test-sections/route.ts', why: 'public research tool, shows stored + compiled text', must: ['decodeMaybe(s.sectionTitle)', 'decodeMaybe(compiledText)', 'decodeMaybe(s.originalText)'] },
  { file: 'app/api/legislation/search/route.ts', why: 'browse list is titles and nothing else', must: ['decodeMaybe(i.title)'] },
  { file: 'app/api/legislation/[itemId]/route.ts', why: 'JSON twin of the Act page', must: ['decodeForDisplay(item.title)', 'decodeMaybe(s.sectionTitle)'] },
  { file: 'app/legislation/[itemId]/page.tsx', why: 'the Act page — no search step in front of it', must: ['decodeForDisplay(item.title)', 'decodeMaybe(s.sectionTitle)'] },
]

/** Files allowed to render raw HTML. Corpus text must never reach one. */
const RAW_HTML_ALLOWLIST = ['app/support/page.tsx']

async function main() {
  console.log('════ check:render-decode ════\n§1 the decoder has not drifted')
  try {
    const a = sharedCore(INGEST_DECODER)
    const b = sharedCore(WEB_DECODER)
    if (a === b) {
      pass(`shared core identical in both copies (${Buffer.byteLength(a)} bytes)`)
    } else {
      let at = 0
      while (at < a.length && at < b.length && a[at] === b[at]) at++
      fail(`SHARED CORE DIVERGED at byte ${at}: ingest ${JSON.stringify(a.slice(at, at + 60))} vs web ${JSON.stringify(b.slice(at, at + 60))}`)
    }
  } catch (e) {
    fail((e as Error).message)
  }

  console.log('\n§2 the decoder behaves where it is IMPORTED, not only where it is defined')
  const { decodeForDisplay, decodeMaybe, hasLiteralEntity } = await import('../lib/html-entities')
  ok(decodeForDisplay('Barbara&#xa0;Rayment') === 'Barbara Rayment', 'the numeric nbsp — the form the ingest list missed')
  ok(decodeForDisplay('Docks, &amp;c.') === 'Docks, &c.', 'the escaped statutory "&c." reads as the Act prints it')
  ok(decodeForDisplay('&#xA3;5,000') === '£5,000', 'a hex pound sign is a number a user reads')
  ok(decodeForDisplay('&#145;inadvertent breach&#146;') === '‘inadvertent breach’', '⚠ Windows-1252: &#145; is a quote mark, NOT an invisible control')
  ok(decodeForDisplay('preven&#xad;tative') === 'preventative', 'a soft-hyphenated word is rejoined')
  ok(decodeForDisplay('Weights and Measures &c; Act') === 'Weights and Measures &c; Act', '⚠ REFUSAL: the bare &c; of old statute is left alone')
  ok(decodeForDisplay('x &frobnicate; y') === 'x &frobnicate; y', '⚠ REFUSAL: an unknown named entity is left alone')
  ok(decodeMaybe(null) === null && decodeMaybe(undefined) === undefined, 'decodeMaybe preserves null/undefined rather than inventing \'\'')
  ok(decodeForDisplay('Marks & Spencer') === 'Marks & Spencer', 'a bare ampersand is untouched')
  // The fixtures below are only a test if they are genuinely dirty to begin with.
  ok(hasLiteralEntity('SCS069 &#xa0; Submission') && !hasLiteralEntity('SCS069 Submission'),
    'negative control: the fixtures are contaminated before decoding and clean after')

  console.log('\n§3 the decode is APPLIED, not merely present — the adapters are run')
  await behavioural()

  console.log('\n§4 every read path carries its decode')
  for (const { file, why, must } of READ_PATHS) {
    const path = join(WEB, file)
    if (!existsSync(path)) { fail(`${file} — MISSING (read path removed or moved?)`); continue }
    const src = readFileSync(path, 'utf8')
    if (!/from '@\/lib\/html-entities'/.test(src)) { fail(`${file} — does not import the decoder (${why})`); continue }
    const missing = must.filter((m) => !src.includes(m))
    if (missing.length) fail(`${file} — decode missing: ${missing.join(', ')}`)
    else pass(`${file.padEnd(48)} ${why}`)
  }

  console.log('\n§5 decoding is safe because corpus text is never raw HTML')
  const raw = grepFiles(['app', 'components', 'lib'], /dangerouslySetInnerHTML\s*[=:]/)
  const unexpected = raw.filter((f) => !RAW_HTML_ALLOWLIST.includes(f))
  if (unexpected.length) {
    fail(`dangerouslySetInnerHTML in ${unexpected.join(', ')} — if any of these can receive corpus text, `
      + 'the decode becomes an injection vector: escape AFTER decoding, and add the file to the allowlist only once that is true')
  } else {
    pass(`raw-HTML rendering confined to the allowlist (${RAW_HTML_ALLOWLIST.join(', ')})`)
  }

  console.log(failures ? `\n════ ${failures} CHECK(S) FAILED ════` : '\n════ all checks pass ════')
  process.exit(failures ? 1 : 0)
}

/**
 * §3 — run the real adapters against a stubbed search service.
 *
 * The stub serves ONE hit whose every text field is contaminated. If the decode is inert — applied
 * to a copy that is then thrown away, which is exactly how the 17 Aug fix first shipped — the
 * entity survives into the SearchResult and this fails.
 */
async function behavioural() {
  const DIRTY_SNIPPET = 'the committee system SCS069 &#xa0; Submission by Dr Danielle Beswick'
  const DIRTY_TITLE = 'Docks, &amp;c. &#8212; evidence'
  const DIRTY_SPEAKER = '&#10;   Dr. DRUMMOND&#13;&#10;   SHIELS'
  // ⚠ THE FIXTURE'S id/corpus/tier ARE COPIED FROM A REAL LIVE HIT, not invented. The first
  // version used tier `evidence`, which no `corpusToType` case matches, so the adapter dropped
  // the hit and the check reported "no results" — a fixture that cannot reach the code it tests.
  const realFetch = globalThis.fetch

  process.env.FTS_SEARCH_URL = 'http://stub.invalid'
  process.env.VECTOR_SEARCH_URL = 'http://stub.invalid'

  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = String(url)
    const isVector = u.includes('/vector-search')
    const body = isVector
      ? { results: [{ id: 'committees-evidence:writtenevidence:102412:147661', corpus: 'committees-evidence', tier: 'parliamentary', score: 0.9, snippet: DIRTY_SNIPPET }], tier: null, corpora: null, excludeCorpora: null }
      : { results: [{ id: 'committees-evidence:writtenevidence:102412:147661', corpus: 'committees-evidence', tier: 'parliamentary', jurisdiction: 'uk', sectionTitle: DIRTY_TITLE, itemDate: '2025-01-01', speaker: DIRTY_SPEAKER, parentDocId: 'writtenevidence:102412', score: 12.5, snippet: DIRTY_SNIPPET }], corpora: null, excludeCorpora: null }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof globalThis.fetch

  try {
    const { runFtsSearch } = await import('../lib/lex/fts-search')
    const { runVectorSearch } = await import('../lib/lex/vector-search')
    const { hasLiteralEntity } = await import('../lib/html-entities')

    const fts = await runFtsSearch(['committee', 'evidence'], 5)
    if (fts.failed) {
      fail(`fts adapter could not run (${fts.reason}) — §3 proves nothing without it`)
    } else if (!fts.results.length) {
      fail('fts adapter returned no results for the stub — the fixture no longer maps to a Lex type')
    } else {
      const r = fts.results[0]
      ok(!hasLiteralEntity(r.snippet), `fts snippet decoded → ${JSON.stringify(r.snippet.slice(30, 78))}`)
      ok(!hasLiteralEntity(r.title), `fts title decoded → ${JSON.stringify(r.title)}`)
      ok(!hasLiteralEntity(r.citation ?? ''), 'fts citation decoded')
    }

    const vec = await runVectorSearch(['committee', 'evidence'], 5)
    if (!vec.results.length) fail('vector adapter returned no results for the stub')
    else ok(!hasLiteralEntity(vec.results[0].snippet), 'vector snippet decoded')
  } catch (e) {
    fail(`§3 could not run: ${(e as Error).message}`)
  } finally {
    globalThis.fetch = realFetch
  }
}

/** Files under `dirs` matching `needle`, relative to the web root. Directory walk, no shell.
 * ⚠ A REGEX ON THE CALL, not the word: matching the bare identifier flagged this file and
 * `reading-legislation-content.ts`, both of which only DISCUSS raw HTML in a comment. */
function grepFiles(dirs: string[], needle: RegExp): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) { walk(full); continue }
      if (!/\.(ts|tsx)$/.test(name)) continue
      if (needle.test(readFileSync(full, 'utf8'))) out.push(full.slice(WEB.length + 1).replace(/\\/g, '/'))
    }
  }
  for (const d of dirs) walk(join(WEB, d))
  return out
}

main().catch((e) => { console.error(e); process.exit(1) })
