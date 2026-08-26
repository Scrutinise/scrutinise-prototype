/**
 * freetext-seeds.ts — ADDENDUM C3 §1, the sweep: "Report every other collection seeded by a capped
 * free-text search, with its cap, before fixing any of them."
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE SEEDER IS THE UNIT, NOT THE ROWS
 *
 * `ots-reports` is 84.7% not-OTS because of one line:
 *
 *     searchGovUk('office of tax simplification report', 'ots-reports', 500)
 *
 * A relevance search over 348,062 results, truncated at 500. Relevance decays continuously, so
 * there is no category of contamination to strip — the cut has to come from outside the query.
 * Every other collection seeded the same way has the same shape, whatever its contamination rate
 * happens to be, and the rate is what this script measures.
 *
 * ── WHAT IS MEASURED, PER COLLECTION ───────────────────────────────────────────────────────────
 *   query + cap        parsed out of `sources/gov-scraper.ts`, not retyped
 *   universe           the `total` the query reports LIVE — the denominator the cap cuts into
 *   coverage           cap ÷ universe: the share of its own query the collection could ever hold
 *   contamination      a random sample of held rows, read through the gov.uk content API and
 *                      tested against a claim DECLARED PER COLLECTION below
 *
 * ⚠ THE CLAIM IS THE POINT. "Contamination" is meaningless without saying what the collection
 * asserts about its rows. Each one gets an explicit, falsifiable test — a publisher, a document
 * type, or a URL path — written down here where it can be argued with. A collection with no
 * testable claim is reported as UNTESTABLE rather than given a flattering zero.
 *
 * ⚠ NOTHING IS DELETED, RE-SEEDED OR EDITED. §1 asks for the list first.
 *
 * Usage:
 *   tsx c3a/freetext-seeds.ts              # 25 rows sampled per collection
 *   tsx c3a/freetext-seeds.ts --sample=60
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from '../c2/db'

const SRC = path.join(__dirname, '../sources/gov-scraper.ts')
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null
const SAMPLE = parseInt(arg('sample') ?? '25', 10)
const UA = { 'User-Agent': 'ScrutiniseBot/1.0 (+https://www.scrutinise.org)' }
const n = (x: number) => x.toLocaleString('en-GB')

/**
 * What each collection CLAIMS about a row, as a test that can fail.
 *  org   — the gov.uk publishing organisation that must appear
 *  types — the document_type(s) that must appear
 *  path  — a URL path fragment every row must carry
 */
const CLAIM: Record<string, { how: string; test: (d: any, url: string) => boolean } | null> = {
  'hmrc-manuals': {
    how: 'the URL must be under /hmrc-internal-manuals — that is what the query asks for with `site:`',
    test: (_d, url) => /\/hmrc-internal-manuals\//i.test(url),
  },
  'college-of-policing': {
    how: 'published by the College of Policing, or hosted on college.police.uk',
    test: (d, url) => orgs(d).includes('college-of-policing') || /college\.police\.uk/i.test(url),
  },
  'hocl-briefings': {
    how: 'published by the House of Commons Library, or hosted on commonslibrary.parliament.uk',
    test: (d, url) => orgs(d).includes('house-of-commons-library') || /commonslibrary\.parliament\.uk/i.test(url),
  },
  'explanatory-notes': {
    how: 'an explanatory note or memorandum — by document_type, or by a legislation.gov.uk /notes path',
    test: (d, url) => /explanatory/i.test(String(d?.document_type ?? '')) || /legislation\.gov\.uk\/.*\/(notes|memorandum)/i.test(url),
  },
  'impact-assessments': {
    how: 'document_type impact_assessment, or a legislation.gov.uk /ukia/ path',
    test: (d, url) => String(d?.document_type ?? '') === 'impact_assessment' || /\/ukia\//i.test(url),
  },
  'consultations': {
    how: 'a consultation or call for evidence, by document_type',
    test: (d) => /consultation|call_for_evidence/i.test(String(d?.document_type ?? '')),
  },
  'hmrc-tiins': {
    how: 'published by HMRC (the TIIN collection is HMRC\'s own series)',
    test: (d) => orgs(d).includes('hm-revenue-customs'),
  },
  'ots-reports': {
    how: 'published by the Office of Tax Simplification — the collection this whole lane is about',
    test: (d) => orgs(d).includes('office-of-tax-simplification'),
  },
  'nao-reports': {
    how: 'published by the National Audit Office, or hosted on nao.org.uk',
    test: (d, url) => orgs(d).includes('national-audit-office') || /nao\.org\.uk/i.test(url),
  },
  'fca-publications': null,   // retired and blocked in corpus_targets — no live claim to test
}

function orgs(d: any): string[] {
  const l = d?.links ?? {}
  return [...new Set([l.organisations, l.primary_publishing_organisation, l.original_primary_publishing_organisation]
    .flat().filter(Boolean).map((o: any) => String(o.base_path ?? '').replace('/government/organisations/', '')))] as string[]
}

interface Seed { line: number; fn: 'searchGovUk' | 'searchGovUkByOrg'; arg: string; corpus: string; cap: number }

function parseSeeds(): Seed[] {
  const lines = fs.readFileSync(SRC, 'utf8').split('\n')
  const out: Seed[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/yield\*\s+(searchGovUk|searchGovUkByOrg|searchGovUkByOrgFiltered)\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*(\d+)/)
    if (!m) continue
    out.push({ line: i + 1, fn: m[1] === 'searchGovUk' ? 'searchGovUk' : 'searchGovUkByOrg', arg: m[2], corpus: m[3], cap: parseInt(m[4], 10) })
  }
  return out
}

async function universeOf(s: Seed): Promise<number | null> {
  const url = s.fn === 'searchGovUk'
    ? `https://www.gov.uk/api/search.json?q=${encodeURIComponent(s.arg)}&count=0`
    : `https://www.gov.uk/api/search.json?filter_organisations=${encodeURIComponent(s.arg)}&count=0`
  try {
    const r = await fetch(url, { headers: UA })
    if (!r.ok) return null
    return (await r.json() as any).total ?? null
  } catch { return null }
}

async function main() {
  const seeds = parseSeeds()
  console.log(`── ${seeds.length} gov.uk-seeded collections parsed out of sources/gov-scraper.ts\n`)
  const p = pool()
  const results: any[] = []

  for (const s of seeds) {
    const held = (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus=$1`, [s.corpus])).rows[0].n
    const universe = await universeOf(s)
    const kind = s.fn === 'searchGovUk' ? 'FREE-TEXT RELEVANCE SEARCH' : 'publisher-filtered'
    console.log(`══ ${s.corpus}   (gov-scraper.ts:${s.line})`)
    console.log(`   ${kind}: ${JSON.stringify(s.arg)}`)
    console.log(`   cap ${n(s.cap)}   ·   universe ${universe == null ? 'UNREADABLE' : n(universe)}   ·   held ${n(held)}`)
    if (s.fn === 'searchGovUk' && universe != null) {
      const cov = s.cap / universe
      console.log(`   the cap is ${(cov * 100).toFixed(cov < 0.01 ? 3 : 1)}% of what the query returns` +
        `${cov < 0.05 ? '  ⚠ the other ' + (100 - cov * 100).toFixed(1) + '% is cut by RELEVANCE RANK, which is not a category' : ''}`)
    }

    const claim = CLAIM[s.corpus]
    if (!claim) {
      console.log('   claim: UNTESTABLE — no live claim declared for this collection (retired/blocked)\n')
      results.push({ ...s, held, universe, sampled: 0, failing: 0, claim: null })
      continue
    }
    console.log(`   claim: ${claim.how}`)
    if (held === 0) {
      console.log('   ⚠ HOLDS NOTHING — nothing to sample. A seeder that produced no rows is its own finding.\n')
      results.push({ ...s, held, universe, sampled: 0, failing: 0, claim: claim.how })
      continue
    }
    const rows = (await p.query(
      `SELECT id, "sourceUrl" u FROM corpus_sections WHERE corpus=$1 AND "sourceUrl" IS NOT NULL ORDER BY md5(id) LIMIT $2`,
      [s.corpus, SAMPLE])).rows
    let ok = 0, fail = 0, unread = 0
    const failures: any[] = []
    for (const r of rows) {
      let d: any = null
      try {
        const bp = new URL(r.u).hostname.endsWith('gov.uk') ? new URL(r.u).pathname : null
        if (bp) {
          const res = await fetch(`https://www.gov.uk/api/content${bp}`, { headers: UA })
          if (res.ok) d = await res.json()
        }
      } catch { /* d stays null */ }
      const verdict = claim.test(d, r.u)
      if (verdict) ok++
      else if (!d && !/gov\.uk/i.test(r.u)) { unread++ }        // a non-gov.uk URL the API cannot judge
      else { fail++; failures.push({ id: r.id, url: r.u, title: d?.title ?? null, type: d?.document_type ?? null, orgs: orgs(d) }) }
    }
    const rate = fail / Math.max(rows.length - unread, 1)
    console.log(`   sampled ${rows.length}: ${ok} match the claim · ${fail} DO NOT · ${unread} not judgeable from gov.uk`)
    console.log(`   → contamination ${(rate * 100).toFixed(1)}%${rate > 0.2 ? '   ⚠⚠' : rate > 0.05 ? '   ⚠' : ''}`)
    for (const f of failures.slice(0, 4)) console.log(`      ✗ [${f.type ?? '?'}] ${String(f.title ?? f.url).slice(0, 78)}`)
    console.log('')
    results.push({ ...s, held, universe, sampled: rows.length, matching: ok, failing: fail, unjudgeable: unread, contamination: rate, claim: claim.how, failures })
    fs.writeFileSync(path.join(OUT, 'C3A_freetext_seeds.json'), JSON.stringify({ generated: new Date().toISOString(), sampleSize: SAMPLE, results }, null, 2))
  }

  console.log('── SUMMARY, worst first')
  for (const r of [...results].sort((a, b) => (b.contamination ?? -1) - (a.contamination ?? -1))) {
    const c = r.contamination == null ? '   —  ' : `${(r.contamination * 100).toFixed(1).padStart(5)}%`
    console.log(`   ${c}  ${r.corpus.padEnd(22)} cap ${String(r.cap).padStart(5)} of ${r.universe == null ? '?' : n(r.universe)}   held ${n(r.held)}`)
  }
  console.log('\nwritten: docs/census/C3A_freetext_seeds.json')
  console.log('⚠ NOTHING WAS CHANGED. §1 requires the list before any fix.')
  await p.end()
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
