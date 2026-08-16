// ─────────────────────────────────────────────────────────────────────────────
// §19-D Task 5 — the legislation links must open.
//
// Two modes:
//   (default)  pure assertions on the ref→path conversion. No network, no DB.
//   --live     samples real corpus_sections ids from the DB, derives the URL the
//              panel would render, and REQUESTS IT. This is the mode that caught
//              the bug: the conversion looked right for years while the value the
//              panel actually used came from sourceUrl and 404'd.
//
// // A link check that never fetches is a link check that cannot fail.
// ─────────────────────────────────────────────────────────────────────────────

import { legislationUrl, refFromId, refToPath, refToCitation, resolveResultUrl, repairRefUrl } from '../lib/lex/legislation-url'
import { committeeUrl } from '../lib/lex/committee-url'

// ⚠ committees.parliament.uk answers a bare fetch/curl User-Agent with 403 on EVERY
// path, including ones that plainly exist. In --live mode that reads exactly like a
// dead link and is not one, so the probe sends a browser UA. Without this the live
// committee check reports 100% broken and sends the next reader after a phantom.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

let failures = 0
function ok(label: string, cond: boolean, detail = '') {
  if (!cond) failures++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`)
}

function pure() {
  console.log('\n── ref → path ──')
  ok('section-288AB → section/288AB', refToPath('section-288AB') === 'section/288AB', refToPath('section-288AB'))
  ok('schedule-24-paragraph-7 → schedule/24/paragraph/7',
    refToPath('schedule-24-paragraph-7') === 'schedule/24/paragraph/7', refToPath('schedule-24-paragraph-7'))
  ok('schedule-paragraph-2 → schedule/paragraph/2',
    refToPath('schedule-paragraph-2') === 'schedule/paragraph/2', refToPath('schedule-paragraph-2'))
  ok('regulation-3 → regulation/3', refToPath('regulation-3') === 'regulation/3')
  ok('article-58A → article/58A', refToPath('article-58A') === 'article/58A')
  ok('unknown leaf is dropped, not guessed', refToPath('section-12-gubbins-4') === 'section/12', refToPath('section-12-gubbins-4'))
  ok('a ref that starts unaddressable yields the act', refToPath('nonsense-4') === '')

  console.log('\n── whole-document refs resolve to the act, not a 404 ──')
  ok('full-doc-html is not a provision', refFromId('si-pre-2010:uksi/1950/891:full-doc-html') === '')
  ok('  → act URL', legislationUrl('uksi/1950/891', refFromId('si-pre-2010:uksi/1950/891:full-doc-html'))
    === 'https://www.legislation.gov.uk/uksi/1950/891')

  console.log('\n── the derived URL beats the stored sourceUrl for legislation ──')
  const broken = 'https://www.legislation.gov.uk/ukpga/1995/46/section-288AB' // what corpus_sections holds
  ok('legislation: derived wins',
    resolveResultUrl('PRIMARY_LEGISLATION', 'primary-acts-pre-2000:ukpga/1995/46:section-288AB', broken)
      === 'https://www.legislation.gov.uk/ukpga/1995/46/section/288AB')
  ok('non-legislation: stored url is used as-is',
    resolveResultUrl('DEBATE', 'pwdata-debates:debates1983-03-11a:1', 'https://www.theyworkforyou.com/x.xml')
      === 'https://www.theyworkforyou.com/x.xml')
  // §19-E Task 8 — THIS ASSERTION USED TO SAY THE OPPOSITE, and it passed, because it
  // asserted what we CONSTRUCT rather than what RESOLVES. The bare form 404s for all
  // three committee families; `/html/` is the addressable document. Measured 2026-08-15.
  console.log('\n── committee documents: the bare form 404s, /html/ resolves ──')
  ok('written evidence gains /html/',
    resolveResultUrl('COMMITTEE', 'committees-evidence:writtenevidence:121125:1', 'https://committees.parliament.uk/writtenevidence/121125/')
      === 'https://committees.parliament.uk/writtenevidence/121125/html/',
    resolveResultUrl('COMMITTEE', 'committees-evidence:writtenevidence:121125:1', 'https://committees.parliament.uk/writtenevidence/121125/'))
  ok('oral evidence gains /html/',
    committeeUrl('https://committees.parliament.uk/oralevidence/5900/') === 'https://committees.parliament.uk/oralevidence/5900/html/')
  ok('publications gain /html/',
    resolveResultUrl('COMMITTEE', 'committees-reports:publication:45000:1', 'https://committees.parliament.uk/publications/45000/')
      === 'https://committees.parliament.uk/publications/45000/html/')
  ok('a URL that already has /html/ is left alone',
    committeeUrl('https://committees.parliament.uk/publications/45000/html/') === 'https://committees.parliament.uk/publications/45000/html/')
  ok('a /pdf/ URL is left alone', committeeUrl('https://committees.parliament.uk/writtenevidence/121125/pdf/')
    === 'https://committees.parliament.uk/writtenevidence/121125/pdf/')
  ok('an inquiry /work/ page is NOT rewritten (it resolves in the bare form)',
    committeeUrl('https://committees.parliament.uk/work/road-safety') === 'https://committees.parliament.uk/work/road-safety')
  ok('the legacy publications.parliament.uk PDF archive is left alone',
    committeeUrl('http://www.publications.parliament.uk/pa/cm201719/cmselect/cmpubacc/1000/1000.pdf')
      === 'http://www.publications.parliament.uk/pa/cm201719/cmselect/cmpubacc/1000/1000.pdf')
  // Never guesses: a lookalike on another host must not be rewritten.
  ok('a lookalike on another host is untouched',
    committeeUrl('https://evil.example.com/writtenevidence/121125/') === 'https://evil.example.com/writtenevidence/121125/')
  ok('non-legislation, non-committee stored urls still pass through',
    resolveResultUrl('DEBATE', 'pwdata-debates:debates1983-03-11a:1', 'https://www.theyworkforyou.com/x.xml')
      === 'https://www.theyworkforyou.com/x.xml')
  // The stored-ref repair path (BackgroundPanel, exported briefings, EvidenceItem rows
  // written before this sprint) must get the same correction.
  ok('repairRefUrl fixes a committee ref stored before this sprint',
    repairRefUrl('COMMITTEE', 'committees-evidence:writtenevidence:121125:1', 'https://committees.parliament.uk/writtenevidence/121125/')
      === 'https://committees.parliament.uk/writtenevidence/121125/html/')

  console.log('\n── citations still read as citations ──')
  ok('section-288AB → s.288AB', refToCitation('section-288AB') === 's.288AB', refToCitation('section-288AB'))
  ok('schedule-1-paragraph-7 → sch.1 para.7',
    refToCitation('schedule-1-paragraph-7') === 'sch.1 para.7', refToCitation('schedule-1-paragraph-7'))
}

async function live(sampleSize: number) {
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

  const CORPORA = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'retained-eu']
  const per = Math.max(2, Math.round(sampleSize / CORPORA.length))
  let checked = 0, opened = 0
  const broken: string[] = []

  for (const corpus of CORPORA) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; sourceUrl: string | null }>>(
      `SELECT id, "sourceUrl" FROM corpus_sections WHERE corpus = $1 ORDER BY random() LIMIT ${per}`, corpus)
    for (const r of rows) {
      const gid = r.id.split(':')[1]
      const url = legislationUrl(gid, refFromId(r.id))
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' }).catch(() => null)
      const code = res?.status ?? 0
      checked++
      if (code >= 200 && code < 400) opened++
      else broken.push(`${code} ${r.id} → ${url}`)
    }
  }
  console.log(`\n── live: ${opened}/${checked} derived legislation URLs opened ──`)
  for (const b of broken) console.log('   ', b)
  // The bar: the derived form must open for essentially everything. Below this the
  // conversion is wrong, not merely incomplete, and the panel is shipping 404s again.
  ok(`≥95% of sampled legislation links open`, checked > 0 && opened / checked >= 0.95,
    `${((opened / Math.max(1, checked)) * 100).toFixed(1)}%`)

  // ── §19-E Task 8: the same treatment for committees, INCLUDING the before ──
  // The stored form is fetched too, not just the repaired one. A repair that reports
  // "100% open" without showing what it replaced proves nothing about whether it was
  // needed — and this pair is what turns "the link Charlie clicked was dead" from a
  // report into a measurement.
  // ⚠ WHAT THIS SECTION ASSERTS, AND WHY IT IS NOT A PERCENTAGE.
  //
  // The first version asserted "≥90% of repaired committee links open" and failed at
  // 87.5%, then at 74% on a second sample. Chasing the number would have been the wrong
  // response, because the shortfall is NOT the repair: a good proportion of the
  // committee ids in the corpus are dead AT SOURCE and 404 in BOTH forms —
  // /publications/28244/, /writtenevidence/112958/ and /publications/13110/ (the very id
  // this check used to assert) all 404 bare AND at /html/, re-probed in isolation from a
  // clean shell. That is a corpus-freshness problem for the ingest thread.
  //
  // A pass rate that moves with somebody else's stale data is a check that goes red for
  // reasons its owner cannot fix, and a check that goes red for reasons nobody can fix
  // gets deleted. So this asserts the property the REPAIR owns, which stale ids cannot
  // perturb:
  //
  //   1. the stored bare form NEVER opens          (so the repair is necessary)
  //   2. the repair never breaks a working link    (no row where stored opens and
  //                                                 repaired does not — the regression
  //                                                 this change could actually cause)
  //   3. the repair opens links that were shut     (so it does real work)
  //
  // and REPORTS the dead-at-source rate per family as information, loudly, rather than
  // averaging it into a score that hides which of the two problems anyone should fix.
  const COMMITTEE_CORPORA = ['committees-evidence', 'committees-reports']
  const byFamily = new Map<string, { before: number; after: number; n: number }>()
  let unrunnable = 0
  let regressions = 0
  const cBroken: string[] = []
  const deadAtSource: string[] = []
  for (const corpus of COMMITTEE_CORPORA) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; sourceUrl: string | null }>>(
      `SELECT id, "sourceUrl" FROM corpus_sections
       WHERE corpus = $1 AND "sourceUrl" LIKE 'https://committees.parliament.uk/%'
       ORDER BY random() LIMIT ${per}`, corpus)
    for (const r of rows) {
      const stored = r.sourceUrl ?? ''
      const repaired = committeeUrl(stored)
      const family = stored.match(/committees\.parliament\.uk\/([a-z]+)\//)?.[1] ?? 'other'
      const b = await probe(stored)
      const a = await probe(repaired)
      if (a < 0 || b < 0) { unrunnable++; continue }
      const acc = byFamily.get(family) ?? { before: 0, after: 0, n: 0 }
      acc.n++
      const storedOpens = b >= 200 && b < 400
      const repairedOpens = a >= 200 && a < 400
      if (storedOpens) acc.before++
      if (repairedOpens) acc.after++
      else cBroken.push(`${a} ${r.id} → ${repaired}`)
      // The regression this change could cause, and the only one worth failing on.
      if (storedOpens && !repairedOpens) { regressions++; console.log(`   ⚠ REGRESSION ${r.id}: stored ${b}, repaired ${a}`) }
      // Dead in BOTH forms ⇒ the id no longer exists at source. Not our URL to fix.
      if (!storedOpens && !repairedOpens) deadAtSource.push(`${r.id} (${b}/${a})`)
      byFamily.set(family, acc)
    }
  }
  await prisma.$disconnect()

  if (unrunnable) {
    console.log(`\n── live: committee links SKIPPED (${unrunnable} unprobeable — no curl on this machine) ──`)
    return
  }

  console.log('\n── live: committee links, by family (stored open → repaired open) ──')
  let totalBefore = 0, totalAfter = 0, totalN = 0
  for (const [family, a] of byFamily) {
    console.log(`   ${family.padEnd(16)} ${a.before}/${a.n} → ${a.after}/${a.n}  (${a.n - a.after} still shut)`)
    totalBefore += a.before
    totalAfter += a.after
    totalN += a.n
  }

  ok('the stored bare form NEVER opens — if this fails, the repair is unnecessary',
    totalBefore === 0, `${totalBefore}/${totalN} opened as stored`)
  ok('the repair never shuts a link that was open',
    regressions === 0, `${regressions} regression(s)`)
  ok('the repair opens links that were shut',
    totalN === 0 || totalAfter > totalBefore, `${totalAfter}/${totalN} open after, ${totalBefore} before`)

  // ── REPORTED, not asserted: somebody else's stale data ────────────────────
  if (deadAtSource.length) {
    console.log(`\n   ⚠ ${deadAtSource.length}/${totalN} sampled committee ids are DEAD AT SOURCE — 404 in BOTH forms.`)
    console.log('     Not a URL-form defect and not fixable here: the ids no longer exist on')
    console.log('     committees.parliament.uk. A corpus-freshness item for the ingest thread.')
    for (const d of deadAtSource.slice(0, 8)) console.log('      ', d)
    for (const [family, a] of byFamily) {
      console.log(`     ${family}: ${(((a.n - a.after) / a.n) * 100).toFixed(0)}% dead at source (n=${a.n})`)
    }
  }
}

/**
 * HEAD with a browser User-Agent. Returns the status, or 0 on a network error.
 *
 * ⚠ VIA CURL, NOT `fetch`, AND THIS IS NOT FUSSINESS. committees.parliament.uk sits
 * behind bot protection that rejects Node's `fetch` with 403 on EVERY path — measured
 * 2026-08-15: bare HEAD, HEAD with the browser UA, GET with the UA, and HEAD with the
 * UA plus full Accept/Accept-Language headers ALL return 403, while `curl` with the
 * same UA returns 200 on the same URL in the same second. It is a TLS/HTTP-client
 * fingerprint block, so no header combination fixes it.
 *
 * // A 403 from `fetch` against this host means the CLIENT was refused, not that the
 * // document is missing. Reading it as a dead link would have "proved" that the
 * // repair does not work, when the repair is exactly right.
 *
 * If curl is absent the probe returns -1 and the caller SKIPS rather than failing —
 * an unrunnable measurement must not masquerade as a failed one.
 */
async function probe(url: string): Promise<number> {
  if (!url) return 0
  if (!(await curlAvailable())) return -1
  const { execFile } = await import('child_process')
  return new Promise((resolve) => {
    execFile(
      'curl',
      ['-s', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', '-w', '%{http_code}',
        '-I', '-L', '--max-time', '25', '-A', BROWSER_UA, url],
      (err, stdout) => resolve(err && !stdout ? 0 : parseInt(String(stdout).trim(), 10) || 0),
    )
  })
}

let curlOk: boolean | null = null
async function curlAvailable(): Promise<boolean> {
  if (curlOk !== null) return curlOk
  const { execFile } = await import('child_process')
  curlOk = await new Promise<boolean>((resolve) =>
    execFile('curl', ['--version'], (err) => resolve(!err)))
  if (!curlOk) console.log('   (curl not found — the committee live probe is SKIPPED, not failed)')
  return curlOk
}

async function main() {
  pure()
  if (process.argv.includes('--live')) {
    const n = parseInt(process.argv[process.argv.indexOf('--live') + 1] ?? '25', 10)
    await live(Number.isFinite(n) ? n : 25)
  } else {
    console.log('\n(run with `--live 25` to fetch real URLs against legislation.gov.uk)')
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main()
