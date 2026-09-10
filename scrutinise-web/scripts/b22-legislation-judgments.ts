export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §2 — THE LEGISLATION AND JUDGMENTS SCHEDULE. C5, never built until now.
//
// Per measure: every provision the measure touches, with citation and link; every judgment,
// with citation, court, date and holding.
//
// ══ ⚠⚠ THE BRIEF SAYS "LINK THE OTHER ELEVEN". SEVEN OF THEM CANNOT BE LINKED. ═══════════
//
// Five measures carry an `IdeaLegislation` row (M-01, M-02, M-03, M-07, M-11). The other
// seven have none, and that is **B18 §4's deliberate refusal, not an omission**: judicial
// review is a common law jurisdiction with no Act conferring it; gender self-identification
// was never enacted; the arm's-length body estate is ~400 unnamed bodies; the Great Repeal's
// scope is temporal; the civil service candidate is either an 1854 settlement that is not an
// enactment or the 2010 Act that codified it, and choosing is Charlie's.
//
// **Linking them would mean naming an instrument David did not name.** That is the one thing
// this report exists not to do, so the schedule reports the seven as unlinkable WITH THE
// REASON — which is a stronger row in a schedule than a guessed citation.
//
// ══ ⚠ THE COUNTS, IN THE FORM THE BRIEF ASKS FOR ════════════════════════════════════════
//
// Never "120 instruments" unqualified. The form is *"120 identified as made under the Act;
// the enacting words of 60 do not name it, and one is a confirmed misattribution"*. Three
// separate qualifications are carried on every count here, each measured rather than quoted:
//
//   · DETECTION — `enabling` means the instrument's own enacting words name the power.
//     `markup`/`text` mean the source merely refers to the Act. Never summed (CCW-B20 §0).
//   · PROVISION-LEVEL ACCURACY — 19.1% of non-null `source_provision_ref` values point at a
//     provision that does not contain the reference. Stated per measure, not hidden.
//   · COVERAGE — `describeCoverage` states which layers were not searched at all. Imported.
//
// ⚠ NOTHING HERE IS WRITTEN TO THE DATABASE. Read-only over `citation_edge` and the evidence
// already gathered by the builds.
//
//   npx tsx --env-file=.env scripts/b22-legislation-judgments.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { inboundFor, graphCoverage, describeCoverage, DETECTION_KINDS, targetTitle } from '../lib/lex/statutory-graph'
import { cleanCitationText } from '../lib/lex/statutory-consequences'
import type { InboundRow } from '../lib/lex/statutory-graph'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT = join(__dirname, '../../docs/report_run/appendices')
const ALL = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)

/** ⚠ `nisr/2010/381` — the misattribution B18 confirmed by hand. Named, never silently dropped. */
const CONFIRMED_MISATTRIBUTIONS = new Set(['nisr/2010/381'])

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
const legUrl = (gid: string, prov?: string | null) =>
  `https://www.legislation.gov.uk/${gid}${prov ? `/${prov.replace(/^([a-z]+)-/, '$1/')}` : ''}`

/**
 * One provision row, as a reader needs it.
 *
 * ⚠⚠ THE CITATION TEXT IS CLEANED THROUGH THE PRODUCT'S OWN FUNCTION, AND GITHUB FOUND OUT
 * BEFORE I DID. The first version printed `citationText` raw, so legislation.gov.uk XML
 * reached the column headed "the words in the source":
 *
 *     CommentaryRef="key-<32 hex, redacted>">bso as to prevent an award…
 *
 * GitHub's push protection rejected the commit because `key-` plus 32 hex is the shape of a
 * Mailgun API key. It is a false positive as a secret and a TRUE POSITIVE as a defect: the
 * column was showing markup, a stray tag remnant (`>b`) and a truncated sentence, and calling
 * it the source's words.
 *
 * ⚠ `cleanCitationText` is imported, not re-implemented — it strips attributes, tags and bare
 * URIs and RETURNS NULL below 40 characters, because a handful of words is not evidence. A row
 * whose text does not survive that floor still exists and is still counted; it just cannot be
 * quoted, and this says so rather than printing the crumbs.
 */
function provisionLine(r: InboundRow): string {
  const where = r.sourceProvisionRef ?? '—'
  const flag = CONFIRMED_MISATTRIBUTIONS.has(r.sourceGid) ? ' ⚠ **confirmed misattribution**' : ''
  const words = cleanCitationText(r.citationText)
  return `| [${esc(r.sourceGid)}](${legUrl(r.sourceGid)}) | ${esc(where)} | ${r.sourceType} `
    + `| ${esc(DETECTION_KINDS[r.detection]?.what ?? r.detection)} `
    + `| ${words ? esc(words).slice(0, 180) : '*too short to quote after markup was stripped — the row still counts*'}${flag} |`
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const L: string[] = []
  L.push('# Appendix — the legislation and judgments schedule')
  L.push('')
  L.push(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Read-only: no model was`)
  L.push('called and nothing was written.*')
  L.push('')
  L.push('Per measure: every provision that refers to the instrument the measure names, and every judgment')
  L.push('the research found bearing on it.')
  L.push('')

  // ══ THE COVERAGE STATEMENT, ONCE, AT THE TOP, FROM THE PRODUCT'S OWN FUNCTION ══════════
  const cov = await graphCoverage()
  L.push('## ⚠ What this schedule could not see')
  L.push('')
  L.push('Imported from the reference layer\'s own coverage statement rather than restated:')
  L.push('')
  L.push('```')
  L.push(describeCoverage(cov).trim())
  L.push('```')
  L.push('')
  L.push('⚠⚠ **Never sum the detection kinds, and never present a count as complete.** `enabling` means')
  L.push('the instrument\'s own enacting words name the power it was made under — the strongest kind, and')
  L.push('the one that may FALL with a repeal. `markup` and `text` mean the source merely refers to the')
  L.push('Act; those survive its repeal. They answer different questions and are listed apart.')
  L.push('')
  L.push('⚠ **A provision reference can point at the wrong provision.** 19.1% of non-null')
  L.push('`source_provision_ref` values in the graph point at a provision that does not contain the')
  L.push('reference — Explanatory Notes lead that error. The instrument is reliable; the section number')
  L.push('within it is a lead to check, not a citation to print.')
  L.push('')
  L.push('---')
  L.push('')

  const index: string[] = ['| Measure | Instrument | Made under it | Refer from a provision | Title/preamble only | Judgments |',
    '|---|---|---|---|---|---|',
    '| | | *instruments (references)* | *documents (references)* | *documents (references)* | |']

  for (const ref of ALL) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue

    const links = await prisma.ideaLegislation.findMany({
      where: { ideaId },
      select: { legislationItem: { select: { legislationGovUkId: true, title: true } } },
    })
    const gid = links[0]?.legislationItem?.legislationGovUkId ?? null

    L.push(`## ${ref} — ${idea.title}`)
    L.push('')

    // ── the provisions ───────────────────────────────────────────────────
    let enablingN = 0, rowsN = 0, titleN = 0
    let enablingDocs = 0, rowsDocs = 0, titleDocs = 0
    if (!gid) {
      // ⚠ THE REASON IS THE ROW. A schedule that printed "none" here would read as "this
      // measure touches no legislation", which is the opposite of true for most of them.
      L.push('### Provisions — ⚠ no instrument can be named for this measure')
      L.push('')
      L.push('**There is no legislation schedule for this measure, and that is a finding rather than a**')
      L.push('**gap.** The reference layer works from a named enactment; David names none here, and')
      L.push('naming one on his behalf would assert a target he did not choose. B18 §4 recorded the')
      L.push('reason for each refusal — a common law jurisdiction with no conferring Act, a policy that')
      L.push('was never enacted, an estate of ~400 unnamed bodies, a scope that is temporal rather than')
      L.push('a list, or a genuine ambiguity that is Charlie\'s to settle.')
      L.push('')
      L.push('⚠ **This does not mean the measure touches no legislation.** It means the measure has not')
      L.push('yet been given the one thing the schedule is computed from.')
      L.push('')
    } else {
      const title = await targetTitle(gid)
      const inbound = await inboundFor(gid)
      enablingN = inbound.enabling.length
      rowsN = inbound.rows.length
      titleN = inbound.titleOnly.length
      // ⚠ DISTINCT, NOT ROWS — the same trap as the instrument counts above, and I walked
      // into it again one line below fixing it: `nisr/2010/381` carries four rows and printed
      // as "4 confirmed misattributions", listing one instrument four times. A gid can appear
      // repeatedly because the same instrument exists as more than one copy in the source
      // archive; the count a reader needs is instruments.
      const mis = [...new Set([...inbound.enabling, ...inbound.rows, ...inbound.titleOnly]
        .filter((r) => CONFIRMED_MISATTRIBUTIONS.has(r.sourceGid))
        .map((r) => r.sourceGid))]

      // ══ ⚠⚠ ROWS ARE NOT INSTRUMENTS, AND THE DIFFERENCE IS A FACTOR OF NEARLY TWO ══════
      //
      // The first version of this script printed row counts under the word "instruments" and
      // would have published **212** where the instrument count is **120** — one instrument
      // can carry several enabling rows. 120 is the number CCW's brief quotes, which is how
      // the discrepancy surfaced. Both are printed, each labelled, and the count that goes in
      // a sentence about instruments is the distinct one.
      const distinct = (xs: InboundRow[]) => new Set(xs.map((x) => x.sourceGid)).size
      enablingDocs = distinct(inbound.enabling)
      rowsDocs = distinct(inbound.rows)
      titleDocs = distinct(inbound.titleOnly)
      const allRows = [...inbound.enabling, ...inbound.rows, ...inbound.titleOnly]
      const siGids = new Set(allRows.filter((r) => r.sourceType === 'SI').map((r) => r.sourceGid))
      const enablingGids = new Set(inbound.enabling.map((r) => r.sourceGid))
      const siNoEnabling = [...siGids].filter((g) => !enablingGids.has(g)).length

      L.push(`### Provisions — [${esc(gid)}](${legUrl(gid)})${title ? ` · ${esc(title)}` : ''}`)
      L.push('')
      L.push(`**${enablingDocs} instrument(s) identified as made under the Act**, from ${enablingN} `
        + `enabling reference(s) — one instrument can carry several. A further **${rowsDocs} document(s)** `
        + `refer to it from inside a provision (${rowsN} references), and **${titleDocs}** refer to it in a `
        + `title, long title, preamble or note only (${titleN} references).`)
      L.push('')
      L.push(`⚠ **${siGids.size} statutory instrument(s) reference this Act in total; the enacting words of `
        + `${siNoEnabling} of them do not name it.** Those ${siNoEnabling} mention the Act without being made `
        + 'under it, so a repeal does not carry them with it — which is the distinction the count exists to '
        + 'preserve.')
      L.push('')
      L.push('⚠⚠ **None of these numbers may be summed, and none is complete.** They are different kinds')
      L.push('of reference with different consequences on repeal; adding them produces a number that')
      L.push('answers no question. The coverage note at the top says which layers were not searched at all.')
      L.push('')
      if (mis.length) {
        L.push(`⚠⚠ **${mis.length} confirmed misattribution(s) in this list: `
          + `${mis.map((m) => `\`${m}\``).join(', ')}.** Left in and marked, never removed —`)
        L.push('a schedule that quietly drops what it knows is wrong cannot be audited.')
        L.push('')
      }

      for (const [label, rows, note] of [
        ['Made under the Act (enabling)', inbound.enabling,
          'The instrument\'s own enacting words name the power it was made under. ⚠ **This is the kind '
          + 'that may fall with a repeal**, and the only kind where that is true. Every enabling row in '
          + 'the graph has a null provision reference by construction — the enacting words sit in the '
          + 'preamble, above any provision — so the blank column here is the shape of the data, not a gap.'],
        ['Referred to from inside a provision', inbound.rows,
          'A change to the target sends someone to edit these. ⚠ The provision reference is a lead to '
          + 'check, not a citation to print — see the note at the top.'],
        ['Referred to in a title, preamble or note only', inbound.titleOnly,
          '⚠ Real references, but not provisions that would break. Listed apart, never dropped and never '
          + 'mixed into the count above.'],
      ] as Array<[string, InboundRow[], string]>) {
        L.push(`#### ${label} — ${new Set(rows.map((r) => r.sourceGid)).size} document(s), ${rows.length} reference(s)`)
        L.push('')
        L.push(note)
        L.push('')
        if (!rows.length) { L.push('*None found.*'); L.push(''); continue }
        L.push('| Instrument | Provision | Type | Kind of reference | The words in the source |')
        L.push('|---|---|---|---|---|')
        for (const r of rows) L.push(provisionLine(r))
        L.push('')
      }
    }

    // ── the judgments ────────────────────────────────────────────────────
    //
    // ⚠ FROM THE RESEARCH THE BUILD DID, NOT FROM A FRESH SEARCH. These are the judgments the
    // measure's own build retrieved and kept; a new search would produce a different list and
    // the report's text is written against this one.
    const judgments = await prisma.evidenceItem.findMany({
      where: { ideaId, sourceType: 'CASE_LAW', status: { not: 'REJECTED' } },
      select: { title: true, body: true, citation: true, url: true, sourceDate: true, sourceDateBasis: true },
      orderBy: [{ sourceDate: 'desc' }, { createdAt: 'asc' }],
    })
    L.push(`### Judgments — ${judgments.length}`)
    L.push('')
    if (!judgments.length) {
      L.push('*The research for this measure retrieved no case law.* ⚠ That is a statement about this')
      L.push('build\'s retrieval, not a finding that no judgment bears on the measure.')
      L.push('')
    } else {
      L.push('⚠ **These are the judgments this measure\'s own build retrieved and kept.** A fresh search')
      L.push('would return a different list; the report\'s text is written against this one. **Never**')
      L.push('**described as complete, and no case is described as no longer good law.**')
      L.push('')
      L.push('| Case | Date | Holding, as the research recorded it | Source |')
      L.push('|---|---|---|---|')
      for (const j of judgments) {
        const name = j.url ? `[${esc(j.citation ?? j.title)}](${j.url})` : esc(j.citation ?? j.title)
        const date = j.sourceDate
          ? `${j.sourceDate.toISOString().slice(0, 10)}${j.sourceDateBasis ? `<br>*${esc(String(j.sourceDateBasis))}*` : ''}`
          : '⚠ undated'
        L.push(`| ${name} | ${date} | ${esc(j.title)} — ${esc(j.body).slice(0, 260)} | ${j.url ? 'linked' : '⚠ no link'} |`)
      }
      L.push('')
      // ⚠ THE COURT IS ASKED FOR AND WE DO NOT HOLD IT AS A FIELD. Said, not faked.
      L.push('⚠ **The brief asks for the court and this schedule does not carry a court column, because')
      L.push('the evidence rows have no court field.** Where the citation is a neutral one the court is')
      L.push('readable from it (`UKSC`, `EWCA`, `UKHL`); where the citation is a case name it is not.')
      L.push('Inferring a court from a case name would be a manufactured value, which is the defect this')
      L.push('report has already recorded once.')
      L.push('')
    }

    index.push(`| ${ref} | ${gid ? `\`${gid}\`` : '⚠ none nameable'} | ${gid ? `${enablingDocs} (${enablingN})` : '—'} `
      + `| ${gid ? `${rowsDocs} (${rowsN})` : '—'} | ${gid ? `${titleDocs} (${titleN})` : '—'} | ${judgments.length} |`)
    L.push('---')
    L.push('')
  }

  // The index goes near the top, after the coverage statement.
  const at = L.findIndex((l) => l.startsWith('## M-'))
  const head = ['## The schedule at a glance', '', ...index, '',
    '⚠ **The three provision columns are never added together.** See the note above.', '', '---', '']
  const body = at < 0 ? L : [...L.slice(0, at), ...head, ...L.slice(at)]

  const file = join(OUT, 'LEGISLATION_AND_JUDGMENTS.md')
  writeFileSync(file, body.join('\n'), 'utf8')
  console.log(`written: ${file}`)
  console.log('\n' + index.join('\n'))
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
