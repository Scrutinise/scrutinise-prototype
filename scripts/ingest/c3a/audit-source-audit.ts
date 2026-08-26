/**
 * audit-source-audit.ts — ADDENDUM C3 §2. Audit the auditor.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY
 *
 * `census/source-audit.ts` has asserted `minSize: 5000` on
 * `/government/collections/office-of-tax-simplification-reports` since V1. That page does not
 * exist. A gov.uk "page not found" comfortably satisfies a 5,000-byte floor, so the check has been
 * green for months against a URL that is not there.
 *
 *      A SIZE THRESHOLD IS NOT AN EXISTENCE CHECK.
 *
 * The addendum asks for every rule in that file to be read for the same shape — a threshold
 * standing in for a fact — and for the LIST to be reported before anything is changed. This script
 * produces the list. ⚠ IT CHANGES NOTHING.
 *
 * ── WHAT IT MEASURES, PER RULE ─────────────────────────────────────────────────────────────────
 * The rules are PARSED OUT OF `source-audit.ts` rather than retyped here, so this cannot silently
 * describe a file that has moved on. Each URL is then fetched and asked the questions the rule
 * itself does not ask:
 *
 *   status         the real HTTP code, and the URL actually landed on after redirects
 *   notFound       does the delivered page SAY it is a 404 / gone / "no results", whatever its code
 *   challenge      is it a Cloudflare interstitial ("Just a moment…", "Enable JavaScript")
 *   apiTotal       for gov.uk search URLs: the result count — `{"results":[]}` contains the string
 *                  `results` and passes `jsonField`, so a search returning NOTHING passes today
 *   verdict        SOUND · PASSES-ON-A-404 · PASSES-ON-EMPTY · CANNOT-PASS · CANNOT-FAIL
 *
 * ── THE FIVE SHAPES, NAMED ─────────────────────────────────────────────────────────────────────
 *   PASSES-ON-A-404   the body is an error or "not found" page and the rule's floor accepts it
 *   PASSES-ON-EMPTY   the endpoint answers correctly and reports zero items; the rule reads the
 *                     envelope, not the contents
 *   CANNOT-FAIL       the assertion is weaker than the failure it exists to catch (a floor of 200
 *                     bytes on an HTML page; a substring the site prints on every page)
 *   CANNOT-PASS       the mirror image — `jsOnly` requires `bodySnippet.length > 200`, and
 *                     `bodySnippet` is `body.slice(0, 200)`, so the length can never EXCEED 200.
 *                     That branch reports "JS SPA — no server-rendered content" for any input.
 *   SOUND             the rule asserts something the page would fail if the source broke
 *
 * Usage:
 *   tsx c3a/audit-source-audit.ts            # probe every rule live
 *   tsx c3a/audit-source-audit.ts --offline  # parse and classify by shape only, no network
 */
import fs from 'fs'
import path from 'path'

const SRC = path.join(__dirname, '../census/source-audit.ts')
const OUT = path.join(__dirname, '../../../docs/census/C3A_source_audit_rules.json')
const OFFLINE = process.argv.includes('--offline')
const UA = 'Scrutinise-Audit/1.0 (civic research; +https://scrutinise.org/about)'
const TIMEOUT_MS = 20_000

interface Rule {
  line: number
  label: string
  url: string
  opts: string
  minSize: number | null
  jsonField: string | null
  xmlTag: string | null
  jsOnly: boolean
}

interface Probe {
  /** the first 200 characters, whitespace-flattened — EXACTLY what source-audit.ts tests against */
  snippet: string
  status: number | null
  finalUrl: string | null
  bytes: number
  title: string | null
  notFound: boolean
  challenge: boolean
  apiTotal: number | null
  apiResults: number | null
  error: string | null
}

function parseRules(): Rule[] {
  const src = fs.readFileSync(SRC, 'utf8').split('\n')
  const rules: Rule[] = []
  for (let i = 0; i < src.length; i++) {
    const m = src[i].match(/auditOne\(\s*'([^']+)'\s*,\s*'([^']+)'\s*(?:,\s*(\{[^}]*\}))?\s*\)/)
    if (!m) continue
    const opts = m[3] ?? ''
    rules.push({
      line: i + 1,
      label: m[1],
      url: m[2],
      opts,
      minSize: /minSize:\s*(\d+)/.exec(opts) ? parseInt(/minSize:\s*(\d+)/.exec(opts)![1], 10) : null,
      jsonField: /jsonField:\s*'([^']+)'/.exec(opts)?.[1] ?? null,
      xmlTag: /xmlTag:\s*'([^']+)'/.exec(opts)?.[1] ?? null,
      jsOnly: /jsOnly:\s*true/.test(opts),
    })
  }
  return rules
}

const NOT_FOUND_MARKERS = [
  'page not found', 'page cannot be found', 'not found', 'no longer available',
  'we cannot find', 'sorry, we', 'error 404', '404 error', 'has been archived',
]
const CHALLENGE_MARKERS = ['just a moment', 'enable javascript and cookies', 'attention required', 'cf-browser-verification', 'cf_chl']

async function probe(url: string): Promise<Probe> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json,application/xml,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })
    const body = await res.text()
    const flat = body.replace(/\s+/g, ' ')
    const low = flat.toLowerCase()
    const title = /<title[^>]*>([^<]{0,160})</i.exec(flat)?.[1]?.trim() ?? null
    // ⚠ read the WHOLE body for the markers, not the first 200 characters. source-audit.ts checks
    //   its substrings against `bodySnippet` — a 200-char slice — which is its own separate defect.
    let apiTotal: number | null = null
    let apiResults: number | null = null
    try {
      if (low.trimStart().startsWith('{')) {
        const j = JSON.parse(body)
        apiTotal = typeof j.total === 'number' ? j.total : (typeof j.totalResults === 'number' ? j.totalResults : null)
        const arr = j.results ?? j.items ?? null
        apiResults = Array.isArray(arr) ? arr.length : null
      }
    } catch { /* not JSON, or truncated */ }
    return {
      snippet: body.slice(0, 200).replace(/\s+/g, ' '),
      status: res.status,
      finalUrl: res.url || url,
      bytes: body.length,
      title,
      notFound: !res.ok || NOT_FOUND_MARKERS.some((m) => (title ?? '').toLowerCase().includes(m)) || low.slice(0, 4000).includes('page not found'),
      challenge: CHALLENGE_MARKERS.some((m) => low.includes(m)),
      apiTotal,
      apiResults,
      error: null,
    }
  } catch (e: any) {
    return { snippet: '', status: null, finalUrl: null, bytes: 0, title: null, notFound: false, challenge: false, apiTotal: null, apiResults: null, error: String(e.message ?? e).slice(0, 120) }
  }
}

/**
 * What does `source-audit.ts` ACTUALLY PRINT for this rule? Its checks run in a fixed order and the
 * first one to fire wins, which matters more than any of them individually:
 *
 *     if (!r.ok || r.code === null)  → ⛔        ← the HTTP code short-circuits EVERYTHING below
 *     if (jsOnly && !hasContent)     → ⛔
 *     if (jsonField not in snippet)  → ⚠️
 *     if (xmlTag not in snippet)     → ⚠️
 *     if (bodySize < minSize)        → ⚠️
 *     otherwise                      → ✅
 *
 * ⚠⚠ THIS PRECEDENCE REFUTES THE ADDENDUM'S OWN §2, AND THE REFUTATION IS THE POINT.
 * §2 says the OTS rule "has passed for months against a URL that does not exist". It has not. The
 * URL returns **HTTP 404**, `!r.ok` fires first, and the rule has printed ⛔ since V1 — the
 * `minSize: 5000` line is never reached. The principle ("a size threshold is not an existence
 * check") is sound and still worth keeping. The claimed instance is not what happened here, and
 * the real defect is worse: **14 of 50 lines print ⛔ and nothing acts on the output.**
 */
function simulateSourceAudit(r: Rule, p: Probe | null): string {
  if (!p) return '?'
  if (p.error || p.status === null || p.status >= 400) return '⛔'
  if (r.jsOnly) return '⛔'                       // hasContent can never be true — see CANNOT-PASS
  if (r.jsonField && !p.snippet.includes(r.jsonField)) return '⚠️'
  if (r.xmlTag && !p.snippet.includes(r.xmlTag)) return '⚠️'
  if (r.minSize != null && p.bytes < r.minSize) return '⚠️'
  return '✅'
}

/**
 * What shape is this rule, given what the URL actually returns AND what the audit prints for it?
 *
 * The verdicts are about the DISTANCE between the two: a rule can be green on a page that is not
 * there, red on a source that is perfectly healthy, or red for two completely different reasons
 * that the output does not distinguish.
 */
function verdict(r: Rule, p: Probe | null, printed: string): { verdict: string; why: string } {
  if (r.jsOnly) {
    return {
      verdict: 'CANNOT-PASS',
      why: 'jsOnly requires bodySnippet.length > 200, and bodySnippet is body.slice(0,200) — the length can never EXCEED 200, so this branch reports "JS SPA — no server-rendered content" whatever the server sends. Measured: HTTP 200, 14 KB delivered, still ⛔.',
    }
  }
  if (!p) return { verdict: 'UNPROBED', why: 'offline' }
  if (p.error) return { verdict: 'UNREACHABLE', why: `${p.error} — prints ⛔, indistinguishable from a dead URL or a bot block` }

  // ── the two ⛔ classes the output merges into one column
  if (p.challenge) {
    return { verdict: 'RED-BOT-CHALLENGE',
      why: `HTTP ${p.status}, the delivered page is a bot challenge (title "${p.title}"). The audit prints ⛔ ERROR with the first 80 characters of a Cloudflare page — the same ⛔ a dead URL gets. "They block robots today" and "this URL no longer exists" need different answers and are shown identically.` }
  }
  if (p.notFound) {
    return { verdict: 'RED-DEAD-URL',
      why: `HTTP ${p.status}, title "${p.title}", ${p.bytes} bytes. The URL does not exist. ⚠ The ${r.minSize ? `minSize: ${r.minSize}` : 'body'} assertion is NEVER REACHED — !r.ok short-circuits first — so the rule has printed ⛔ since V1, not ✅. The page WOULD clear the floor${r.minSize && p.bytes >= r.minSize ? ` (${p.bytes} ≥ ${r.minSize})` : ''}; the status code is what saves it.` }
  }
  if (p.status && p.status >= 500) {
    return { verdict: 'RED-TRANSIENT', why: `HTTP ${p.status} — a server error, printed ⛔ exactly like a permanently dead URL` }
  }

  // ── green, but on what?
  if (printed !== '⛔' && /api\/search\.json/.test(r.url)) {
    return { verdict: 'ASSERTS-THE-SEARCH-NOT-THE-SOURCE',
      why: `the URL is a gov.uk SEARCH (${p.apiResults ?? '?'} result${p.apiResults === 1 ? '' : 's'} returned${p.apiTotal != null ? ` of ${p.apiTotal.toLocaleString('en-GB')} total` : ''}). It proves the search API answers, not that the source publishes what the collection claims. ⚠ THIS IS THE REAL "threshold standing in for a fact": 'OECD (gov.uk)' is green off q=OECD while the oecd collection holds 505 gov.uk pages and ZERO OECD documents.` }
  }
  if (r.jsonField && p.apiResults === 0) {
    return { verdict: 'PASSES-ON-EMPTY',
      why: `the endpoint answers with 0 results and the body still contains the string '${r.jsonField}', so the assertion passes on a source returning nothing${r.minSize != null && p.bytes < r.minSize ? ` — here only the ${r.minSize}-byte floor caught it, by accident of size` : ''}` }
  }
  if (r.xmlTag && !p.snippet.includes(r.xmlTag) && p.bytes > 10_000) {
    return { verdict: 'FALSE-ALARM',
      why: `prints ⚠️ "XML tag '${r.xmlTag}' not in sample" against a healthy ${p.bytes}-byte document — the tag is tested against a 200-character slice, so a long declaration or a leading BOM fails a source that is working` }
  }
  if (r.minSize != null && p.bytes > r.minSize * 20) {
    return { verdict: 'CANNOT-FAIL',
      why: `floor ${r.minSize} against ${p.bytes} bytes delivered — ${Math.round(p.bytes / r.minSize)}× headroom, so it can only fire on a total outage, which the HTTP code already catches` }
  }
  if (r.minSize == null && !r.jsonField && !r.xmlTag) {
    return { verdict: 'CANNOT-FAIL', why: 'no assertion at all beyond the HTTP code' }
  }
  return { verdict: 'SOUND', why: `HTTP ${p.status}, ${p.bytes} bytes${r.minSize ? `, floor ${r.minSize}` : ''}${p.apiResults != null ? `, ${p.apiResults} results` : ''}` }
}

async function main() {
  const rules = parseRules()
  console.log(`── ${rules.length} auditOne() rules parsed out of census/source-audit.ts`)
  console.log('   (testSparql and the five testLdaEndpoint calls assert their own shapes and are listed at the end.)\n')

  const out: any[] = []
  for (const r of rules) {
    const p = OFFLINE ? null : await probe(r.url)
    const printed = simulateSourceAudit(r, p)
    const v = verdict(r, p, printed)
    out.push({ ...r, probe: p, printedBySourceAudit: printed, ...v })
    const tag = v.verdict.padEnd(34)
    console.log(`${printed} ${tag} ${r.label}`)
    console.log(`   ${r.url}`)
    console.log(`   rule: ${r.opts || '(none)'}`)
    console.log(`   ${v.why}`)
    if (p && p.title) console.log(`   title: ${p.title}`)
    console.log('')
    // written as decided, not at the end — l2-measure.ts lost a whole run to one writeFileSync
    fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), source: 'scripts/ingest/census/source-audit.ts', rules: out }, null, 2))
  }

  const tally = new Map<string, number>()
  for (const o of out) tally.set(o.verdict, (tally.get(o.verdict) ?? 0) + 1)
  console.log('── TALLY')
  for (const [v, c] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`   ${String(c).padStart(3)}  ${v}`)
  console.log(`\nwritten: ${path.relative(path.join(__dirname, '../../..'), OUT).replace(/\\/g, '/')}`)
  console.log('\n⚠ NOTHING WAS CHANGED. The addendum requires the list first.')
}

main().catch((e) => { console.error('FAIL', e); process.exit(1) })
