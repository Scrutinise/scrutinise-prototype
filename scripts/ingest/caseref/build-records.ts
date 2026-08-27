/**
 * build-records.ts — §2. One reference record per distinct case.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ NOTHING IN THIS COLLECTION CONTAINS TEXT FROM A JUDGMENT WE DO NOT HOLD.
 *
 * A record is: the citation, the names seen beside it, the court where the citation itself says so,
 * whether we hold the judgment, how many documents cite it, and up to five places in OUR corpus
 * where it is discussed. Where a Law Commission report or a select committee characterises what the
 * case decided, that sentence is quoted WITH ATTRIBUTION AND A LINK — it is OGL/Open Justice
 * material we hold. Nothing is written from a source we do not hold, and nothing is generated.
 *
 * **If nothing we hold says what a case decided, the record says the case exists and is cited N
 * times, and says nothing about its content.** An unknown fact is unknown, not absent and not
 * guessed.
 *
 * ── HELD / NOT HELD / UNKNOWN, AND WHY THERE ARE THREE ─────────────────────────────────────────
 *   held        a `tna-caselaw` row exists under this neutral citation — the id IS the citation
 *   not-held    a law-report citation dated before 2003, the measured start of our English case law
 *   unknown     a law-report citation dated 2003 or later. We may well hold the judgment under its
 *               NEUTRAL citation and simply not have linked the two. ⚠ Claiming "not held" here
 *               would be a guess wearing the clothes of a measurement, and it would tell a user we
 *               lack something we have.
 *
 * ── LINKS OUT ──────────────────────────────────────────────────────────────────────────────────
 * BAILII's terms were READ, not assumed (www.bailii.org/bailii/copyright.html, 27 Aug 2026):
 * *"BAILII has no objection to links from other websites to material on BAILII's website, and
 * encourages this practice."* So a link is permitted. But a link we cannot construct correctly is
 * worse than none:
 *
 *   · a NEUTRAL citation maps onto BAILII's documented path scheme, so the link is DERIVED and
 *     flagged `derived: true` — it has not been fetched, because fetching BAILII automatically is
 *     what their terms forbid and §4 rules out.
 *   · a LAW-REPORT citation has no derivable path. The record carries BAILII's case-search page and
 *     the citation to search for. **No URL is invented.**
 *
 * Usage:
 *   tsx caseref/build-records.ts --top=200      # build records for the N most-cited
 *   tsx caseref/build-records.ts --probes       # just the ten authorities, for the report
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from '../c2/db'
import { findDiscussion, type Discussion } from './discussion'
import { tidyName } from './citations'

const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null
const TOP = arg('top') ? parseInt(arg('top')!, 10) : null
const PROBES = process.argv.includes('--probes')
const n = (x: number) => x.toLocaleString('en-GB')

/** Courts the citation itself names. Anything else stays null rather than being inferred. */
const COURT_FROM_NEUTRAL: Record<string, string> = {
  UKSC: 'Supreme Court', UKHL: 'House of Lords', UKPC: 'Privy Council',
  EWCA: 'Court of Appeal (England and Wales)', EWHC: 'High Court (England and Wales)',
  EWCOP: 'Court of Protection', EWFC: 'Family Court', UKUT: 'Upper Tribunal',
  UKFTT: 'First-tier Tribunal', UKEAT: 'Employment Appeal Tribunal', EAT: 'Employment Appeal Tribunal',
  CSIH: 'Court of Session (Inner House)', CSOH: 'Court of Session (Outer House)',
  HCJAC: 'High Court of Justiciary (Appeal Court)', NICA: 'Court of Appeal (Northern Ireland)',
  NIQB: "High Court (Northern Ireland, Queen's Bench)",
}
/**
 * ⚠ A LAW-REPORT SERIES DOES NOT NAME A COURT and must not be made to. `[1990] 2 AC 605` is an
 * Appeal Cases report — which covers the House of Lords, the Privy Council and now the Supreme
 * Court. Guessing "House of Lords" would be right most of the time and wrong often enough to put a
 * false fact on a page about a case we do not hold. Only `SC (HL)` is unambiguous.
 */
const COURT_FROM_SERIES: Record<string, string> = { 'SC (HL)': 'House of Lords (on appeal from Scotland)' }

export interface CaseReference {
  /** the identity — the citation, normalised. NEVER a name. */
  citation: string
  kind: 'neutral' | 'law-report'
  year: number
  /** every case name observed immediately before this citation, with how often. Variants, not truth. */
  names: Array<{ name: string; seen: number }>
  /** the most frequently observed name. Labelled OBSERVED, because that is all it is. */
  observedName: string | null
  court: string | null
  /**
   * WHERE the court came from, because "House of Lords" derived from a citation and "House of
   * Lords" copied off a curated list are different claims and a reader deserves to know which.
   *   'citation' — the citation itself names the court (UKSC, UKHL, EWCA, SC (HL))
   *   'curated'  — a hand-checked list in this repository says so
   *   null       — nothing we hold determines it, and it is left EMPTY rather than inferred
   */
  courtSource: 'citation' | 'curated' | null
  held: 'held' | 'not-held' | 'unknown'
  heldNote: string
  heldId: string | null
  citedBy: { documents: number; byCorpus: Record<string, number> }
  /**
   * ⚠ TRUE when one citing "document" was the case ITSELF and has been subtracted. A judgment's
   * header carries its own neutral citation — "Neutral Citation Number: [2013] EWCA Civ 1146" —
   * and 176 of a random 200 (88.0%) contain their own citation in the body. Left uncorrected,
   * every case we hold reads as cited once more than it is.
   */
  selfCitationRemoved: boolean
  discussion: Discussion[]
  /** a sentence from a source WE HOLD, with attribution. null when nothing we hold says anything. */
  description: { text: string; sourceId: string; sourceCorpus: string; sourceTitle: string } | null
  links: { label: string; url: string; derived: boolean }[]
}

/** BAILII's own path scheme for neutral citations. Derived, never fetched. */
function bailiiFromNeutral(citation: string): string | null {
  const m = /^\[(\d{4})\]\s+([A-Z]+)\s*(?:([A-Z][a-z]+)\s+)?(\d+)/.exec(citation)
  if (!m) return null
  const [, year, court, division, num] = m
  const map: Record<string, string> = {
    UKSC: 'uk/cases/UKSC', UKHL: 'uk/cases/UKHL', UKPC: 'uk/cases/UKPC',
    EWCA: `ew/cases/EWCA/${division ?? 'Civ'}`, EWHC: `ew/cases/EWHC/${division ?? 'QB'}`,
    UKUT: 'uk/cases/UKUT', UKEAT: 'uk/cases/UKEAT', CSIH: 'scot/cases/ScotCS', CSOH: 'scot/cases/ScotCS',
    NICA: 'nie/cases/NICA', NIQB: 'nie/cases/NIQB',
  }
  const p = map[court]
  return p ? `https://www.bailii.org/${p}/${year}/${num}.html` : null
}

/**
 * The one hand-curated input, and it is small and named on purpose: the court for the ten
 * authorities in `docs/pre2001_probe.json`, which a person wrote down and checked. Every record
 * built from it carries `courtSource: 'curated'`, so no reader mistakes it for something the
 * citation told us.
 */
const CURATED_COURT = new Map<string, string>(
  (JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/pre2001_probe.json'), 'utf8')).results as any[])
    .map((r) => [r.probe.citation as string, r.probe.court as string]),
)

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  // ── which citations to build records for
  let wanted: Array<{ citation: string; kind: any; year: number; series: string; docs: number; byCorpus: Record<string, number>; names: Record<string, number>; samples: any[] }> = []
  const jsonl = path.join(OUT, 'CASEREF_citations.jsonl')
  const pilotl = path.join(OUT, 'CASEREF_citations.pilot.jsonl')
  const src = fs.existsSync(jsonl) ? jsonl : pilotl
  console.log(`citations from: ${path.basename(src)}`)
  const all = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  console.log(`  ${n(all.length)} distinct citations on file`)

  if (PROBES) {
    const probes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/pre2001_probe.json'), 'utf8')).results.map((r: any) => r.probe)
    const byCite = new Map(all.map((a) => [a.citation, a]))
    for (const pr of probes) {
      const found = byCite.get(pr.citation)
      // ⚠ A probe citation absent from the extraction is REPORTED as absent, with a zero count —
      //   never silently dropped, and never given a made-up count.
      wanted.push(found ?? { citation: pr.citation, kind: 'law-report', year: pr.year, series: '', docs: 0, byCorpus: {}, names: { [pr.authority]: 1 }, samples: [] })
    }
  } else {
    wanted = all.sort((a, b) => b.docs - a.docs).slice(0, TOP ?? 200)
  }
  console.log(`  building ${n(wanted.length)} records\n`)

  const records: CaseReference[] = []
  for (const w of wanted) {
    // ⚠ `tidyName` is applied HERE as well as at extraction time, because the trim landed while the
    //   full run was already in flight. Two spellings of one variant are merged by summing their
    //   counts — a display tidy-up on a NAME, which is never an identity, so nothing can be merged
    //   wrongly by it.
    const merged = new Map<string, number>()
    for (const [raw, seen] of Object.entries(w.names ?? {})) {
      const k = tidyName(raw)
      if (!/\sv\.?\s/.test(k)) continue
      merged.set(k, (merged.get(k) ?? 0) + (seen as number))
    }
    const names = [...merged].map(([name, seen]) => ({ name, seen })).sort((a, b) => b.seen - a.seen)
    const observedName = names[0]?.name ?? null

    // ── held?
    let held: CaseReference['held'] = 'unknown'
    let heldId: string | null = null
    let heldNote = ''
    if (w.kind === 'neutral') {
      const row = (await q(`SELECT id FROM corpus_sections WHERE corpus='tna-caselaw' AND id LIKE $1 LIMIT 1`, [`tna-caselaw:${w.citation}:%`]))[0]
      if (row) { held = 'held'; heldId = row.id; heldNote = 'the judgment is in tna-caselaw under this neutral citation' }
      else { held = 'not-held'; heldNote = 'no tna-caselaw row carries this neutral citation' }
    } else if (w.year < 2003) {
      held = 'not-held'
      heldNote = 'our English case law begins in 2003; no pre-2003 judgment is held, and this is a permanent boundary — BAILII refused in writing on 16 June 2026 and The National Archives will not license digitisation of its pre-2001 paper holdings'
    } else {
      held = 'unknown'
      heldNote = 'a law-report citation dated 2003 or later: we may hold this judgment under its neutral citation and simply not have linked the two. Not claimed either way.'
    }

    let court = w.kind === 'neutral'
      ? (COURT_FROM_NEUTRAL[w.series] ?? null)
      : (COURT_FROM_SERIES[w.series] ?? null)
    let courtSource: CaseReference['courtSource'] = court ? 'citation' : null
    if (!court && CURATED_COURT.has(w.citation)) { court = CURATED_COURT.get(w.citation)!; courtSource = 'curated' }

    // ── where our corpus discusses it
    const { hits } = await findDiscussion(w.citation, observedName, w.year, 5)

    // ── the description: quoted from something we hold, or nothing at all
    /**
     * ⚠⚠ A DESCRIPTION MUST MENTION THE CASE. The first version took the top discussion hit's
     * snippet and got an Explanatory Note about remedial powers under *Anisminic*'s name. So the
     * sentence must itself carry the citation or the case name — and if none does, the record
     * carries NO description at all. An unknown fact is unknown, not absent and not guessed.
     */
    let description: CaseReference['description'] = null
    /**
     * ⚠ TIGHTENED TO THE CITATION ALONE. A name-based test let a committee report's sentence about
     * a DIFFERENT case attach itself to `[1948] 1 KB 223`, whose own name we had not observed — so
     * the record would have shown an empty name beside a quotation naming somebody else, and a
     * reader would reasonably have read the two together. The citation is the identity; a quotation
     * that does not carry it does not belong to this record.
     */
    const mentionsCase = (text: string) => text.toLowerCase().includes(w.citation.toLowerCase())
    const quotable = hits.find((h) => h.snippet.length > 80 && mentionsCase(h.snippet))
    if (quotable) {
      description = { text: quotable.snippet, sourceId: quotable.id, sourceCorpus: quotable.corpus, sourceTitle: quotable.title }
    }

    const links: CaseReference['links'] = []
    if (held === 'held' && heldId) links.push({ label: 'Read the judgment in our corpus', url: `/legislation/${encodeURIComponent(heldId)}`, derived: false })
    const bailii = w.kind === 'neutral' ? bailiiFromNeutral(w.citation) : null
    if (bailii) links.push({ label: 'Read the judgment on BAILII', url: bailii, derived: true })
    else links.push({ label: `Search BAILII for ${w.citation}`, url: 'https://www.bailii.org/form/search_cases.html', derived: false })
    if (w.kind === 'neutral' && w.year >= 2003) {
      links.push({ label: 'Find Case Law (The National Archives)', url: 'https://caselaw.nationalarchives.gov.uk/', derived: false })
    }

    records.push({
      citation: w.citation, kind: w.kind, year: w.year, names, observedName, court, courtSource,
      selfCitationRemoved: false,
      held, heldNote, heldId,
      citedBy: { documents: w.docs, byCorpus: w.byCorpus ?? {} },
      discussion: hits, description, links,
    })
    process.stdout.write(`\r  ${records.length}/${wanted.length}   `)
  }
  process.stdout.write('\n')

  /**
   * ⚠ THE SELF-CITATION CORRECTION, MEASURED PER RECORD RATHER THAN ASSUMED AT 88%.
   *
   * One batched read of the held judgments' own bodies: if a judgment contains its own citation, it
   * counted itself, and exactly one is subtracted. Where it does not, nothing is subtracted. The
   * alternative — subtracting 1 from every held case because 88% do it — would be right most of the
   * time and quietly wrong for the rest, which is the kind of number this whole layer exists to
   * stop producing.
   */
  const heldRecords = records.filter((r) => r.heldId)
  if (heldRecords.length) {
    const { connectLance, FTS_TABLE } = await import('../search/lance')
    const db = await connectLance()
    const tbl = await db.openTable(FTS_TABLE)
    const esc = (x: string) => x.replace(/'/g, "''")
    const ids = heldRecords.map((r) => r.heldId!) as string[]
    const bodies = await tbl.query()
      .where(`id IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`)
      .select(['id', 'body']).toArray() as Array<{ id: string; body: string }>
    const byId = new Map(bodies.map((x) => [x.id, String(x.body ?? '')]))
    let corrected = 0
    for (const r of heldRecords) {
      const body = byId.get(r.heldId!)
      if (body && body.includes(r.citation) && r.citedBy.documents > 0) {
        r.citedBy.documents -= 1
        const c = r.citedBy.byCorpus['tna-caselaw']
        if (c && c > 0) r.citedBy.byCorpus['tna-caselaw'] = c - 1
        r.selfCitationRemoved = true
        corrected++
      }
    }
    console.log(`── self-citation: ${n(corrected)} of ${n(heldRecords.length)} held records counted themselves; one subtracted from each`)
  }

  const outPath = path.join(OUT, PROBES ? 'CASEREF_records.probes.json' : 'CASEREF_records.json')
  fs.writeFileSync(outPath, JSON.stringify({ generated: new Date().toISOString(), source: path.basename(src), records }, null, 2))
  console.log(`\nwritten: docs/census/${path.basename(outPath)}`)

  const withDesc = records.filter((r) => r.description).length
  const heldN = records.filter((r) => r.held === 'held').length
  const notHeld = records.filter((r) => r.held === 'not-held').length
  console.log(`\n── ${n(records.length)} records · ${n(heldN)} held · ${n(notHeld)} NOT held · ${n(records.length - heldN - notHeld)} unknown`)
  console.log(`── ${n(withDesc)} carry a description quoted from a source we hold; ${n(records.length - withDesc)} say only that the case exists and is cited`)
  await p.end()
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
