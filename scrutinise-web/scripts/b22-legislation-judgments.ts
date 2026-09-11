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
// ══ CCW-B23 §4 — ALL TWELVE, AND WHOSE NAMING EACH INSTRUMENT IS ═══════════════════════
//
// `b23-link-instruments.ts` linked the seven B18 refused — to the enactment the BUILD'S OWN
// DRAFTED KERNEL names, never one David named — and every link carries that in `notes`. This
// schedule now prints the provenance on every measure (David's words / the build's draft, with
// the grade), handles more than one instrument per measure (M-12 has four), scopes the
// judgments to the build the measure stands on (⚠ B23 §2: the unscoped query counted every
// build's case law — M-01 printed 22 where its current build holds 12), and reads the court
// off the neutral citation where one exists rather than off the case name.
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
 * B23 §4 — THE COURT, READ OFF THE CITATION AND NEVER OFF THE NAME. `sourceId` begins with the
 * neutral citation for TNA rows (`tna-caselaw:[2020] UKSC 19:1`), the judiciaryni slug names
 * the court (`2021-nica-52`), the Scottish slug carries `csoh`/`csih`, and HUDOC is Strasbourg.
 * Anything else prints `—`: a court that cannot be read is not written.
 */
function courtOf(sourceId: string | null, url: string | null): string {
  const s = sourceId ?? ''
  // `[2024] EWHC 1197 (Fam)`, `[2001] EWCA Civ 540`, `[2020] UKSC 19` — the division follows the number.
  let m = s.match(/^tna-caselaw:\[\d{4}\] ([A-Z]+(?: [A-Za-z]+)?) \d+(?: (\([A-Za-z]+\)))?/)
  if (m) return m[2] ? `${m[1]} ${m[2]}` : m[1]
  m = s.match(/^ni-judgments:\d{4}-(ni[a-z]+)-/)
  if (m) return m[1].toUpperCase()
  m = (url ?? '').match(/\/\d{4}(cs[io]h)\d+/i)
  if (m) return m[1].toUpperCase()
  if (s.startsWith('echr-hudoc:')) return 'ECtHR'
  if (s.startsWith('et-decisions:')) return 'ET'
  return '—'
}

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
  L.push('⚠⚠ **Whose naming.** Five instruments (M-01, M-02, M-03, M-07, M-11) are the enactment DAVID names, in')
  L.push('his own words (B18 §4). The other ten links, across seven measures, are the enactment **the build\'s')
  L.push('drafted kernel names** — Lex\'s reading of his words, not his words — written by `b23-link-instruments.ts`')
  L.push('on 11 September 2026 with that provenance in every row. Each measure prints which it is, and for the')
  L.push('seven, how far the draft *targets* the Act as against naming it as the framework it works within.')
  L.push('Two of the seven (M-05, M-10) are the second kind: the draft\'s own instrument is a new Bill or grant')
  L.push('conditions, and the linked Act is the law it would operate around, not the law it would change.')
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

  const index: string[] = ['| Measure | Instrument | Named by | Made under it | Refer from a provision | Title/preamble only | Judgments (current build) |',
    '|---|---|---|---|---|---|---|',
    '| | | | *instruments (references)* | *documents (references)* | *documents (references)* | |']

  for (const ref of ALL) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue

    const links = await prisma.ideaLegislation.findMany({
      where: { ideaId }, orderBy: { createdAt: 'asc' },
      select: { notes: true, legislationItem: { select: { legislationGovUkId: true, title: true } } },
    })
    const build = await prisma.ideaBuild.findFirst({
      where: { ideaId, status: 'DONE' }, orderBy: { version: 'desc' }, select: { version: true },
    })
    const buildVersion = build?.version ?? 1

    L.push(`## ${ref} — ${idea.title}`)
    L.push('')

    // ── whose naming ─────────────────────────────────────────────────────
    //
    // ⚠⚠ THE PROVENANCE IS THE FIRST LINE OF EVERY INSTRUMENT. A B18 link carries the clause of
    // David's stated intention; a B23 link says in capitals that the build's draft named it.
    // Printing them under one heading without this line would let the seven read as his.
    const provenanceOf = (notes: string | null) =>
      (notes ?? '').startsWith('CCW-B23') ? 'the build\'s drafted kernel — NOT David' : 'David\'s own words (B18 §4)'
    const perGid: Array<{ gid: string; enablingN: number; rowsN: number; titleN: number; enablingDocs: number; rowsDocs: number; titleDocs: number; prov: string }> = []

    if (!links.length) {
      L.push('### Provisions — ⚠ no instrument is linked to this measure')
      L.push('')
      L.push('⚠ **This does not mean the measure touches no legislation.** It means the measure has not')
      L.push('been given the one thing the schedule is computed from.')
      L.push('')
    }
    for (const link of links) {
      const gid = link.legislationItem?.legislationGovUkId
      if (!gid) continue
      const prov = provenanceOf(link.notes)
      const title = await targetTitle(gid)
      const inbound = await inboundFor(gid)
      const enablingN = inbound.enabling.length
      const rowsN = inbound.rows.length
      const titleN = inbound.titleOnly.length
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
      const enablingDocs = distinct(inbound.enabling)
      const rowsDocs = distinct(inbound.rows)
      const titleDocs = distinct(inbound.titleOnly)
      perGid.push({ gid, enablingN, rowsN, titleN, enablingDocs, rowsDocs, titleDocs, prov })
      const allRows = [...inbound.enabling, ...inbound.rows, ...inbound.titleOnly]
      const siGids = new Set(allRows.filter((r) => r.sourceType === 'SI').map((r) => r.sourceGid))
      const enablingGids = new Set(inbound.enabling.map((r) => r.sourceGid))
      const siNoEnabling = [...siGids].filter((g) => !enablingGids.has(g)).length

      L.push(`### Provisions — [${esc(gid)}](${legUrl(gid)})${title ? ` · ${esc(title)}` : ''}`)
      L.push('')
      L.push(`**Whose naming:** ${prov}.`)
      L.push('')
      L.push(`> ${esc((link.notes ?? '').replace(/^CCW-B\d+ §4 — /, ''))}`)
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
    //
    // ⚠⚠ SCOPED TO THE BUILD THE MEASURE STANDS ON (B23 §2). The B22 version of this query had
    // no `runVersion` filter and so listed every build's case law together — M-01 printed 22
    // judgments where its v4 build holds 12. The rows from superseded builds still exist; they
    // are not this build's research and are not listed as if they were.
    const judgments = await prisma.evidenceItem.findMany({
      where: { ideaId, sourceType: 'CASE_LAW', status: { not: 'REJECTED' }, runVersion: buildVersion },
      select: { title: true, body: true, citation: true, url: true, sourceId: true, sourceDate: true, sourceDateBasis: true },
      orderBy: [{ sourceDate: 'desc' }, { createdAt: 'asc' }],
    })
    const allVersions = await prisma.evidenceItem.count({ where: { ideaId, sourceType: 'CASE_LAW', status: { not: 'REJECTED' } } })
    L.push(`### Judgments — ${judgments.length} (build v${buildVersion}${allVersions !== judgments.length ? `; ${allVersions} across all builds, not listed` : ''})`)
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
      L.push('| Case | Court | Date | Holding, as the research recorded it | Source |')
      L.push('|---|---|---|---|---|')
      for (const j of judgments) {
        const name = j.url ? `[${esc(j.citation ?? j.title)}](${j.url})` : esc(j.citation ?? j.title)
        const date = j.sourceDate
          ? `${j.sourceDate.toISOString().slice(0, 10)}${j.sourceDateBasis ? `<br>*${esc(String(j.sourceDateBasis))}*` : ''}`
          : '⚠ undated'
        L.push(`| ${name} | ${courtOf(j.sourceId, j.url)} | ${date} | ${esc(j.title)} — ${esc(j.body).slice(0, 260)} | ${j.url ? 'linked' : '⚠ no link'} |`)
      }
      L.push('')
      // ⚠ THE COURT IS READ, NEVER INFERRED. Where the row carries no citation it prints `—`.
      L.push('⚠ **The court column is read off the neutral citation in the source id** (`UKSC`, `EWHC (Admin)`,')
      L.push('`NICA`, `CSOH`), never off the case name — 22,184 case names map to more than one citation.')
      L.push('`—` means the row carries no citation the court can be read from; it is not a missing court.')
      L.push('')
    }

    if (!perGid.length) index.push(`| ${ref} | ⚠ none linked | — | — | — | — | ${judgments.length} |`)
    perGid.forEach((g, i) => index.push(`| ${i === 0 ? ref : ''} | \`${g.gid}\` | ${g.prov.startsWith('David') ? 'David' : '⚠ the build\'s draft'} | ${g.enablingDocs} (${g.enablingN}) `
      + `| ${g.rowsDocs} (${g.rowsN}) | ${g.titleDocs} (${g.titleN}) | ${i === 0 ? judgments.length : ''} |`))
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
