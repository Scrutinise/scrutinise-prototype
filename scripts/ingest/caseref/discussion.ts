/**
 * discussion.ts — "where in our corpus is this case DISCUSSED?", by targeted search rather than scan.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY NOT SCAN. `historic-hansard` holds 4,641,117 sections and the `pwdata-*` family about 9
 * million. At the read rate measured on this table today — **32 documents/second, and the cost is
 * the read, not the parse** — scanning them is roughly **five days**. The reference record needs at
 * most five discussion links per case; a full scan buys a count nobody asked for at a price nobody
 * would pay.
 *
 * So the big collections are QUERIED, once per case, through the same `fts-serve` the platform
 * uses. That is seconds per case instead of days for the corpus.
 *
 * ⚠⚠ AND THE RESULT IS FILTERED ON THE CITATION, NOT ON THE NAME. This is the §1.3 trap in its
 * live form: a search for "Caparo" returns *Unite The Union v Caparo Atlas Fastenings Ltd* — a real
 * 2017 case about a company of that name — and the platform ALREADY returns exactly that, at rank 3,
 * for the leading negligence authority. So a hit counts as a discussion of the case only if the
 * retrieved body contains **the citation itself**, or the full case name with the year adjacent.
 * A name match alone is recorded as `nameOnly` and never presented as a discussion.
 *
 * Usage:
 *   tsx caseref/discussion.ts --probe        # the ten authorities, with the filter's before/after
 *   tsx caseref/discussion.ts --top=200      # the top N citations from the extraction
 */
import fs from 'fs'
import path from 'path'
import { OUT } from '../c2/db'
import { sentenceAround } from './citations'

const FTS = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null
const n = (x: number) => x.toLocaleString('en-GB')

/** The collections that DISCUSS a case, as opposed to citing it in passing. */
export const DISCUSSION_CORPORA = [
  'lawcom', 'scotlawcom',                       // whole reports on what a case held
  'committees-reports', 'committees-evidence',  // select committees quoting authority
  'historic-hansard', 'pwdata-debates', 'pwdata-lords', 'pwdata-westminster',
  'explanatory-notes', 'nao-reports',
]

export interface Discussion {
  id: string
  corpus: string
  title: string
  date: string | null
  /** why this counts: the body carried the citation, or the full name with its year */
  evidence: 'citation' | 'name-and-year'
  snippet: string
}

async function search(body: any, attempt = 0): Promise<any[]> {
  try {
    const r = await fetch(`${FTS}/fts-search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (r.status >= 500 && attempt < 3) { await new Promise((s) => setTimeout(s, 1500 * (attempt + 1))); return search(body, attempt + 1) }
    if (!r.ok) throw new Error(`FTS ${r.status}`)
    return ((await r.json()) as any).results ?? []
  } catch (e) {
    if (attempt < 3) { await new Promise((s) => setTimeout(s, 1500 * (attempt + 1))); return search(body, attempt + 1) }
    throw e
  }
}

/** Loose enough to survive typesetting, strict enough that it is still THE citation. */
function citationVariants(citation: string): RegExp {
  const parts = citation.match(/^[\[\(](\d{4})[\]\)]\s*(\d{1,3}\s+)?(.+?)\s+(\d{1,4})$/)
  if (!parts) return new RegExp(citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const [, year, vol, series, page] = parts
  const v = vol ? `\\s*${vol.trim()}\\s+` : '\\s*(\\d{1,3}\\s+)?'
  const ser = series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\.?\\s*')
  return new RegExp(`[\\[\\(]${year}[\\]\\)]${v}${ser}\\.?\\s*${page}\\b`, 'i')
}

/**
 * Find where a case is discussed. Returns only hits whose BODY agrees — the citation, or the full
 * name plus its year. `nameOnly` counts what was rejected, because a filter whose rejections are
 * invisible is a filter nobody can check.
 */
export async function findDiscussion(
  citation: string, name: string | null, year: number, limit = 5,
): Promise<{ hits: Discussion[]; considered: number; nameOnly: number }> {
  const query = [name, citation].filter(Boolean).join(' ')
  const rows = await search({ query, limit: 40, corpora: DISCUSSION_CORPORA })
  const rx = citationVariants(citation)
  const hits: Discussion[] = []
  let nameOnly = 0
  for (const r of rows) {
    const body = String(r.body ?? r.snippet ?? '')
    const title = String(r.sectionTitle ?? r.title ?? '')
    const hay = `${title}\n${body}`
    let evidence: Discussion['evidence'] | null = null
    if (rx.test(hay)) evidence = 'citation'
    else if (name && hay.toLowerCase().includes(name.toLowerCase()) && hay.includes(String(year))) evidence = 'name-and-year'
    if (!evidence) { if (name && hay.toLowerCase().includes(name.split(' v ')[0].toLowerCase())) nameOnly++; continue }
    /**
     * ⚠⚠ THE SNIPPET IS THE SENTENCE THE CITATION IS IN — NOT THE FIRST 300 CHARACTERS OF THE
     * DOCUMENT. The first version took the head of the body, and the dry run showed what that
     * produces: the record for *Anisminic* [1969] 2 AC 147 quoted an Explanatory Note about
     * remedial powers that merely happened to cite it further down. **A quotation that is not about
     * the case is the confident-wrong-answer this whole sprint exists to remove, reproduced inside
     * the fix.** If the citation cannot be located in the body, the snippet is empty and the record
     * says nothing rather than something plausible.
     */
    const flat = body.replace(/\s+/g, ' ')
    const at = flat.search(rx)
    const near = at >= 0 ? sentenceAround(flat, at, citation.length)
      : (name && flat.toLowerCase().indexOf(name.toLowerCase()) >= 0
          ? sentenceAround(flat, flat.toLowerCase().indexOf(name.toLowerCase()), name.length) : '')
    hits.push({
      id: String(r.id), corpus: String(r.corpus), title, date: r.itemDate ?? null, evidence,
      snippet: near.slice(0, 400),
    })
    if (hits.length >= limit) break
  }
  return { hits, considered: rows.length, nameOnly }
}

async function probe() {
  const probes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/pre2001_probe.json'), 'utf8')).results.map((r: any) => r.probe)
  console.log('══ THE TEN AUTHORITIES — where our own corpus discusses them ══')
  console.log('   (a hit counts only if the BODY carries the citation, or the full name with its year)\n')
  const out: any[] = []
  for (const p of probes) {
    const { hits, considered, nameOnly } = await findDiscussion(p.citation, p.authority, p.year)
    console.log(`── ${p.authority.slice(0, 58)}  ${p.citation}`)
    console.log(`   ${considered} retrieved · ${hits.length} agree on the citation or the name+year · ${nameOnly} matched the NAME ONLY and were rejected`)
    for (const h of hits) console.log(`      [${h.evidence}] ${h.corpus.padEnd(20)} ${h.title.slice(0, 62)}`)
    if (!hits.length) console.log('      (nothing in our corpus discusses it under a form we can verify)')
    out.push({ authority: p.authority, citation: p.citation, considered, nameOnly, hits })
  }
  const withAny = out.filter((o) => o.hits.length).length
  console.log(`\n── ${withAny}/${out.length} authorities have at least one verifiable discussion in our corpus`)
  console.log(`── ${n(out.reduce((s, o) => s + o.nameOnly, 0))} name-only matches rejected across the ten — every one of those is a`)
  console.log('   candidate for the confident-wrong-answer the platform gives today.')
  fs.writeFileSync(path.join(OUT, 'CASEREF_discussion_probe.json'), JSON.stringify({ generated: new Date().toISOString(), results: out }, null, 2))
  console.log('\nwritten: docs/census/CASEREF_discussion_probe.json')
}

async function main() {
  if (process.argv.includes('--probe')) return probe()
  console.log('usage: --probe  (or import findDiscussion from the record builder)')
}

// ⚠ Only when RUN, never when IMPORTED. `build-records.ts` imports findDiscussion from here, and
//   without this guard the import printed a usage line into the middle of the builder's output —
//   harmless, and exactly the kind of noise that makes a real warning easy to miss.
if (require.main === module) main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
