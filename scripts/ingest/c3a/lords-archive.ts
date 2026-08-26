/**
 * lords-archive.ts — ADDENDUM C3 §7. The House of Lords judicial archive, by a route that is not
 * a crawl of `parliament.uk`.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER SEES TODAY
 * The Lords was the UK's final court of appeal until 30 July 2009 and Find Case Law does not
 * publish it at all, so **we hold zero of it**. Ten well-known pre-2001 authorities were run through
 * the real `runSearch()` in C3: 10 of 10 absent, and 3 of 10 returned a DIFFERENT case with a
 * similar name. The absence never presents as an absence.
 *
 * GATE 1 WAS RED AND IS NOW GREEN, BY THE ROUTE §7 ASKS FOR FIRST
 * C3 measured `publications.parliament.uk` 403 with a Cloudflare challenge on every host, with and
 * without a browser User-Agent, including the site root. §7 says: before spending anything on a
 * browser fetcher, ask whether an archive copy exists that does not require crawling. Measured
 * 26 Aug 2026, from this machine, with Node's own `fetch`:
 *
 *   The National Archives UK Government Web Archive   **HTTP 405, "Human Verification"** — blocked
 *   publications.parliament.uk directly              **HTTP 403, Cloudflare** — blocked, as before
 *   BAILII                                            **HTTP 200 carrying "Making sure you're not
 *                                                      a bot!"** — a challenge wearing a 200
 *   **The Internet Archive (web.archive.org)**        **HTTP 200, 372,360 bytes of real index** ✅
 *
 * ⚠ THE BAILII LINE IS ITS OWN FINDING. `census/source-audit.ts` reports BAILII as ✅ accessible,
 * HTTP 200, `text/html` — and what it is serving is a bot check. A 200 is not the content.
 *
 * ── WHAT THIS SCRIPT DOES ──────────────────────────────────────────────────────────────────────
 *   --enumerate   walks the Internet Archive's CDX index for every archived
 *                 `publications.parliament.uk` Lords judgment page under any session and writes the list
 *   --pilot=N     fetches N of them through the archive, runs the C3 QUALITY GATE over each, and
 *                 reports the pass rate, the reasons for every rejection, and the fetch rate
 *
 * ⚠⚠ THE QUALITY GATE IS WATCHED FAILING FIRST, ON REAL BYTES. `--gate-selftest` feeds it (a) the
 * navigation-wrapped page as delivered and (b) the extracted judgment text, and REQUIRES the first
 * to be rejected. C3 refused to write this gate against invented fixtures — "a gate whose test data
 * I made up is a gate tested against my imagination" — and this run has the real bytes it needed.
 *
 * ⚠ NOTHING IS INGESTED. No R2 write, no `corpus_sections` row, no queue row. §7 asks for a pilot
 * and a cost in TIME before 760 documents are fetched, and that is all this does.
 *
 * Usage:
 *   tsx c3a/lords-archive.ts --gate-selftest
 *   tsx c3a/lords-archive.ts --enumerate
 *   tsx c3a/lords-archive.ts --pilot=20
 */
import fs from 'fs'
import path from 'path'

const OUT = path.join(__dirname, '../../../docs/census')
const SCRATCH = path.join('C:/Users/charl/AppData/Local/Temp/claude/C--Code-scrutinise-prototype',
  '17d38e3f-f6fc-4d8d-b1d8-9a29f6597fc3/scratchpad/lords')
const LIST = path.join(OUT, 'C3A_lords_archive_list.json')
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ScrutiniseBot/1.0; +https://scrutinise.org)' }
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null
const n = (x: number) => x.toLocaleString('en-GB')

/** Sessions the Lords published judgments in, 1996-97 to 2008-09 (the court closed 30 Jul 2009). */
const SESSIONS = ['199697', '199798', '199899', '199900', '200001', '200102', '200203', '200304', '200405', '200506', '200607', '200708', '200809']

async function get(url: string, tries = 4): Promise<{ status: number | null; body: string }> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(45_000) })
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (i + 1)); continue }
      return { status: r.status, body: await r.text() }
    } catch { await sleep(2500 * (i + 1)) }
  }
  return { status: null, body: '' }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE QUALITY GATE — C3 Lane C3, gate 2, unchanged in substance
//
// Parliament serves judgments as HTML wrapped in site navigation, so naive extraction stores
// "Accessibility Email alerts RSS feeds Contact us Home Parliamentary business…" as the opening of
// Pepper v Hart. The gate:
//   (a) the first 300 characters must contain the `[YYYY] UKHL n` citation and must NOT contain
//       `Accessibility`, `RSS feeds`, `Parliamentary business` or `<style`
//   (b) a stopword-density band — judicial prose runs ~4–7% "the"; navigation chrome does not
//   (c) anything under 500 words is QUARANTINED, not stored
// ════════════════════════════════════════════════════════════════════════════════════════════════
export interface GateResult { pass: boolean; reasons: string[]; words: number; theDensity: number; citation: string | null; truncated?: boolean }

export function qualityGate(text: string): GateResult {
  const reasons: string[] = []
  const flat = text.replace(/\s+/g, ' ').trim()
  const head = flat.slice(0, 300)
  const citation = /\[(19|20)\d{2}\]\s*UKHL\s*\d+/i.exec(flat)?.[0] ?? null

  for (const bad of ['Accessibility', 'RSS feeds', 'Parliamentary business', '<style', 'Email alerts']) {
    if (head.includes(bad)) reasons.push(`navigation chrome in the first 300 characters: "${bad}"`)
  }
  // ⚠⚠ THE WORD LIST IS NOT ENOUGH, AND THE HAND-READ IS WHAT FOUND IT.
  // `jd060510/hend-1.htm` PASSED every check above while opening:
  //     "Search Advanced Search Home Glossary Index Contact Us Parliament Live section...
  //      Parliamentary Publications and Archives Site Map Bills Hansard Directories …"
  // The 2005-06 template uses a completely different navigation vocabulary from the one C3's list
  // was drawn from, so a banned-word list calibrated on one era's chrome waves another era's
  // through. ⚠ THE SAME SHAPE AS THE DOT-LEADER BUG IN THREE COSTUMES: every fix strips one more
  // known thing, and the next template is a new costume.
  //
  // So the test is POSITIVE and template-independent: `extract()` cuts at the court's own formal
  // heading, so a correctly extracted judgment BEGINS with it. Anything else is a page we did not
  // understand, and it is quarantined rather than trimmed into something plausible.
  if (!/^OPINIONS OF THE LORDS OF APPEAL/i.test(flat)) {
    reasons.push('the text does not BEGIN with "OPINIONS OF THE LORDS OF APPEAL" — the extractor did not find the judgment, so whatever is at the front is page furniture')
  }
  // ⚠⚠ ADDED AFTER THE SELF-TEST ACCEPTED RAW HTML, WHICH IS WHY THE SELF-TEST EXISTS.
  // The gate as C3 specified it passed the page AS DELIVERED: the `<title>` supplies
  // "House of Lords" inside the first 300 characters, the banned navigation words all sit further
  // down the document, and HTML tags barely move the "the" density (7.3% — comfortably inside the
  // band). A gate that accepts markup is the C4 defect waiting to happen: 12.7% of embedded
  // case-law text is markup and chunk 0 is more than half markup in 77% of judgments.
  if (/<\/?(html|head|body|div|table|font|a|p|br)\b/i.test(flat) || /<[a-z][^>]*>/i.test(flat.slice(0, 2000))) {
    reasons.push('the input still contains HTML markup — this is the page, not the judgment')
  }
  // ⚠⚠ THE C3 SPEC SAID "the first 300 characters must contain the case name AND the [YYYY] UKHL n
  //    citation". MEASURED AGAINST THE REAL BYTES, BOTH HALVES ARE WRONG, AND THE SECOND WOULD HAVE
  //    THROWN AWAY EVERY JUDGMENT BEFORE 2001:
  //
  //      · the judgment opens with the court's own formal heading — "OPINIONS OF THE LORDS OF
  //        APPEAL FOR JUDGMENT IN THE CAUSE <case name> ON <date>" — and the neutral citation is
  //        NOT in it. On the 2009 pilot page `[2009] UKHL 39` first appears well past character 300.
  //      · neutral citations ([YYYY] UKHL n) were only introduced in 2001. A Lords judgment from
  //        1997 does not have one and never will, so requiring it rejects the pre-2001 authorities
  //        this whole lane exists to recover.
  //
  //    So: the HEAD must carry the court's formal heading (which carries the case name with it),
  //    and the DOCUMENT must identify itself by a neutral citation OR by the judgment date the
  //    heading states. Both halves are reported in the pilot so the amendment can be argued with.
  const headHasHeading = /OPINIONS OF THE LORDS OF APPEAL/i.test(head) || /HOUSE OF LORDS/i.test(head)
    || /\[(19|20)\d{2}\]\s*UKHL\s*\d+/i.test(head)
  if (!headHasHeading) {
    reasons.push('the first 300 characters carry neither the court\'s formal heading nor a UKHL citation')
  }
  const dateLine = /\bON\s+\d{1,2}(ST|ND|RD|TH)?\s+[A-Z]+\s+(19|20)\d{2}\b/i.test(flat.slice(0, 1200))
  if (!citation && !dateLine) {
    reasons.push('the document identifies itself by neither a [YYYY] UKHL n citation nor a judgment date')
  }
  const words = flat ? flat.split(/\s+/).length : 0
  if (words < 500) reasons.push(`${words} words — under the 500-word floor, so it is QUARANTINED rather than stored`)
  const the = (flat.match(/\bthe\b/gi) ?? []).length
  const theDensity = words ? the / words : 0
  // ⚠⚠ THE BAND IS MEASURED, NOT INHERITED. C3 specified "judicial prose runs ~4–7% 'the'". Over
  //    20 real Lords judgments fetched from the archive on 26 Aug the distribution is
  //    **min 7.2% · p10 7.7% · median 9.0% · p90 9.8% · max 10.7%** — the brief's band would have
  //    rejected EVERY ONE of them, and its first version of this file (widened to 4–9% on a guess)
  //    still rejected 6 of 20. Navigation chrome measures **0.0%**, so the separation the band
  //    exists to exploit is enormous and does not need a tight ceiling.
  //    Band set to 5–13%: wide enough for the measured distribution plus headroom, and still
  //    infinitely far from the 0% the chrome sits at.
  if (words >= 500 && (theDensity < 0.05 || theDensity > 0.13)) {
    reasons.push(`"the" density ${(theDensity * 100).toFixed(1)}% is outside the 5–13% band MEASURED on real Lords judgments`)
  }
  // ⚠⚠ ALSO FROM THE HAND-READ: two of five pilot documents END WITH THE WORD "Continue".
  // A Lords opinion is paginated across several pages, so ONE page is a fragment of one opinion —
  // not the opinion, and certainly not the judgment. Storing it would put half an argument in the
  // corpus under the case's name, which reads exactly like the whole thing.
  const truncated = /\bContinue\s*$/i.test(flat)
  if (truncated) reasons.push('the page ends with "Continue" — this is a paginated fragment; the rest of the opinion is on the next page and the ingest must follow it')

  return { pass: reasons.length === 0, reasons, words, theDensity, citation, truncated }
}

/**
 * Strip the parliament.uk page furniture and START AT THE JUDGMENT.
 *
 * ⚠ THE ANCHOR IS THE COURT'S OWN FORMAL HEADING, not a guess about where the navigation ends.
 * Every Lords judgment opens "OPINIONS OF THE LORDS OF APPEAL FOR JUDGMENT IN THE CAUSE" —
 * checked against four archived pages from four different sessions (1999-00, 2001-02, 2003-04,
 * 2005-06), where it appears at character 268, 673, 713 and 529 of the stripped text, after
 * exactly the chrome C3 warned about ("Accessibility Email alerts RSS feeds Contact us Home
 * Parliamentary business…").
 *
 * If the anchor is absent the text is returned UNCUT rather than guessed at, and the gate rejects
 * it — a page this does not understand must fail loudly, not be trimmed into something plausible.
 */
export function extract(html: string): string {
  let h = html
  h = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // the Internet Archive injects its own banner into non-`id_` captures; `id_` avoids it, and this
  // is belt and braces for any capture that slips through
  h = h.replace(/<!--\s*BEGIN WAYBACK TOOLBAR INSERT\s*-->[\s\S]*?<!--\s*END WAYBACK TOOLBAR INSERT\s*-->/gi, ' ')
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(h)?.[1] ?? h
  const text = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim()
  const i = text.toUpperCase().indexOf('OPINIONS OF THE LORDS OF APPEAL')
  return i >= 0 ? text.slice(i) : text
}

async function gateSelfTest() {
  console.log('══ THE GATE, WATCHED REJECTING REAL BYTES BEFORE IT IS TRUSTED TO ACCEPT ANY ══\n')
  const url = 'https://web.archive.org/web/20120625215950id_/http://www.publications.parliament.uk/pa/ld200809/ldjudgmt/jd090730/moore-1.htm'
  const r = await get(url)
  if (r.status !== 200 || !r.body) { console.log('⛔ could not fetch the pilot page; the self-test needs real bytes'); process.exit(1) }
  console.log(`fetched ${n(r.body.length)} bytes of real archived HTML`)

  // (1) the page AS DELIVERED — tags, navigation and all. MUST be rejected.
  //     ⚠ ON 26 AUG THIS CASE PASSED, AND THAT IS WHY THE MARKUP CHECK EXISTS. See qualityGate().
  const asDelivered = r.body.replace(/\s+/g, ' ')
  const g1 = qualityGate(asDelivered)
  console.log(`\n  raw HTML as delivered      → ${g1.pass ? '⛔ ACCEPTED (the gate is broken)' : '✓ REJECTED'}`)
  for (const x of g1.reasons) console.log(`      · ${x}`)

  // (2) a navigation-only fragment. MUST be rejected.
  const chrome = 'Accessibility Email alerts RSS feeds Contact us Home Parliamentary business ' .repeat(40)
  const g2 = qualityGate(chrome)
  console.log(`  navigation chrome only     → ${g2.pass ? '⛔ ACCEPTED (the gate is broken)' : '✓ REJECTED'}`)
  for (const x of g2.reasons.slice(0, 2)) console.log(`      · ${x}`)

  // (3) the extracted judgment. SHOULD pass — and if it does not, the extractor is what is wrong.
  const g3 = qualityGate(extract(r.body))
  console.log(`  the extracted judgment     → ${g3.pass ? '✓ ACCEPTED' : '⚠ REJECTED'}   ${n(g3.words)} words, "the" ${(g3.theDensity * 100).toFixed(1)}%, citation ${g3.citation ?? '(none found)'}`)
  for (const x of g3.reasons) console.log(`      · ${x}`)

  const ok = !g1.pass && !g2.pass
  console.log(`\n${ok ? '✓ the gate rejects what it must reject.' : '⛔ THE GATE DOES NOT FAIL ON THE BROKEN INPUT — do not use it.'}`)
  if (!ok) process.exit(1)
  if (!g3.pass) console.log('⚠ it also rejects the extracted text — read the reasons above; that is an extractor problem, not a gate problem.')
}

async function enumerate() {
  console.log('══ ENUMERATING THE ARCHIVE — Internet Archive CDX, one query per Lords session ══\n')
  const seen = new Map<string, string>()   // path → best timestamp
  for (const s of SESSIONS) {
    const u = `http://web.archive.org/cdx/search/cdx?url=publications.parliament.uk/pa/ld${s}/ldjudgmt/*`
      + `&output=json&collapse=urlkey&filter=statuscode:200&fl=original,timestamp&limit=20000`
    const r = await get(u)
    let rows: string[][] = []
    try { rows = r.body.trim() ? JSON.parse(r.body) : [] } catch { rows = [] }
    const data = rows.slice(1)
    let added = 0
    for (const [orig, ts] of data) {
      const p = orig.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '')
      if (!/\/ldjudgmt\//i.test(p) || !/\.htm$/i.test(p)) continue
      if (/\/index\.htm$/i.test(p)) continue      // a session index, not a judgment
      if (!seen.has(p)) { seen.set(p, ts); added++ }
    }
    console.log(`  ld${s}   ${String(data.length).padStart(6)} archived urls → ${String(added).padStart(4)} new judgment pages`)
    await sleep(1200)   // the archive is a free public service; do not hammer it
  }
  const list = [...seen].map(([p, ts]) => ({ path: p, timestamp: ts }))
  // a judgment can be split into -1, -2, -3 … parts; count the distinct CASES too
  const cases = new Set(list.map((x) => x.path.replace(/-\d+\.htm$/i, '')))
  console.log(`\n  ${n(list.length)} archived judgment pages · ${n(cases.size)} distinct cases`)
  console.log('  ⚠ a Lords judgment is published one opinion per page (`-1.htm`, `-2.htm`, …), so the')
  console.log('    page count is NOT the judgment count and neither is quoted as the other.')
  fs.writeFileSync(LIST, JSON.stringify({ generated: new Date().toISOString(), source: 'web.archive.org CDX', pages: list.length, cases: cases.size, list }, null, 2))
  console.log(`\nwritten: docs/census/C3A_lords_archive_list.json`)
}

async function pilot(N: number) {
  if (!fs.existsSync(LIST)) { console.error('run --enumerate first'); process.exit(1) }
  const doc = JSON.parse(fs.readFileSync(LIST, 'utf8'))
  /**
   * ⚠ `--only-first` RESTRICTS THE PILOT TO THE CASE-LEADING PAGE, AND THE FIRST PILOT IS WHY.
   * A Lords judgment is published one OPINION per page (`-1.htm`, `-2.htm`, …). Only the first
   * carries the court's formal heading and the judgment date; a continuation page opens
   * "LORD BINGHAM OF CORNHILL My Lords, …". The C3 gate is written for the first page, so run over
   * all 2,820 pages it rejects 11 of 20 for the absence of something a continuation page never has.
   * That is the gate describing the unit, not the document failing.
   */
  const ONLY_FIRST = process.argv.includes('--only-first')
  const all: any[] = ONLY_FIRST
    ? doc.list.filter((x: any) => /-1\.htm$/i.test(x.path) || !/-\d+\.htm$/i.test(x.path))
    : doc.list
  if (ONLY_FIRST) console.log(`⚠ --only-first: ${n(all.length)} case-leading pages of ${n(doc.list.length)} archived pages
`)
  // systematic, not the head — the head is one session and one alphabetic slice
  const step = Math.max(1, Math.floor(all.length / N))
  const sample = all.filter((_, i) => i % step === 0).slice(0, N)
  console.log(`══ PILOT — ${n(sample.length)} of ${n(all.length)} archived pages (every ${step}th) ══\n`)
  fs.mkdirSync(SCRATCH, { recursive: true })

  const t0 = Date.now()
  const results: any[] = []
  const jsonl = fs.createWriteStream(path.join(SCRATCH, 'pilot.jsonl'), { flags: 'w' })
  for (const s of sample) {
    const url = `https://web.archive.org/web/${s.timestamp}id_/http://www.publications.parliament.uk${s.path}`
    const t1 = Date.now()
    const r = await get(url)
    const ms = Date.now() - t1
    const text = r.status === 200 ? extract(r.body) : ''
    const g = qualityGate(text)
    const rec = { path: s.path, timestamp: s.timestamp, status: r.status, bytes: r.body.length, ms, ...g, reasons: g.reasons,
      era: /\[(19|20)\d{2}\]\s*UKHL\s*\d+/i.test(text) ? 'has-neutral-citation' : 'pre-2001-style' }
    results.push(rec)
    jsonl.write(JSON.stringify(rec) + '\n')          // written as decided, not at the end
    if (r.status === 200 && text) {
      fs.writeFileSync(path.join(SCRATCH, s.path.replace(/[^a-z0-9]/gi, '_').slice(-90) + '.txt'), text)
    }
    console.log(`  ${g.pass ? '✓' : '✗'} ${String(ms).padStart(5)}ms  ${String(g.words).padStart(6)} words  ${(g.citation ?? '—').padEnd(16)} ${s.path.slice(-52)}`)
    for (const x of g.reasons) console.log(`        · ${x}`)
    await sleep(900)
  }
  jsonl.end()
  const secs = (Date.now() - t0) / 1000
  const passed = results.filter((r) => r.pass).length
  const byEra = { 'has-neutral-citation': results.filter((r: any) => r.era === 'has-neutral-citation').length,
                  'pre-2001-style': results.filter((r: any) => r.era === 'pre-2001-style').length }
  console.log(`\n── era split: ${byEra['has-neutral-citation']} carry a [YYYY] UKHL n citation, ${byEra['pre-2001-style']} do not`)
  console.log('   (neutral citations began in 2001; the C3 gate would have rejected every one of the second group)')
  const fetched = results.filter((r) => r.status === 200).length
  const trunc = results.filter((r: any) => r.truncated).length
  console.log(`\n── ${passed}/${results.length} passed the gate · ${fetched}/${results.length} fetched at all · ${trunc} are PAGINATED fragments ending "Continue"`)
  const perDoc = secs / results.length
  console.log(`── ${secs.toFixed(0)}s for ${results.length} pages = ${perDoc.toFixed(1)}s each (including a deliberate 0.9s pause between requests)`)
  console.log(`── COST IN TIME for all ${n(all.length)} pages: ${(perDoc * all.length / 60).toFixed(0)} minutes ≈ ${(perDoc * all.length / 3600).toFixed(1)} hours, single-threaded`)
  console.log('   §7 asks whether this is an afternoon or a multi-day job. It is the answer above, and')
  console.log('   it is a FETCH time — extraction, quality-gating and ingest are on top.')
  console.log('\n⚠ FIVE HAND-READS BY A PERSON ARE STILL REQUIRED before the other pages are fetched.')
  console.log(`   The extracted text is in ${SCRATCH}`)
  fs.writeFileSync(path.join(OUT, 'C3A_lords_pilot.json'), JSON.stringify({
    generated: new Date().toISOString(), sampled: results.length, population: all.length,
    passed, fetched, secondsPerPage: perDoc, projectedHours: perDoc * all.length / 3600, results,
  }, null, 2))
  console.log('written: docs/census/C3A_lords_pilot.json')
}

async function main() {
  if (process.argv.includes('--gate-selftest')) return gateSelfTest()
  if (process.argv.includes('--enumerate')) return enumerate()
  const p = arg('pilot')
  if (p) { await gateSelfTest(); console.log(''); return pilot(parseInt(p, 10)) }
  console.log('usage: --gate-selftest | --enumerate | --pilot=20')
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
