export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B18 §4 (SURFACE_5 decision 3) — GIVE EACH MEASURE ITS INSTRUMENT, WHERE HE NAMES ONE.
//
// The `STATUTORY_CONSEQUENCES` deepening pass reads `identifiedInstruments()`, whose
// strongest source is an `IdeaLegislation` row. Exactly one idea in the database has ever
// had one, which is why the pass had never run for anybody until 8 September.
//
// ⚠⚠ THE LIST BELOW IS TAKEN FROM DAVID'S OWN WORDS AND NOWHERE ELSE. Each entry quotes the
// clause of `lex_build_inputs.json` that names the enactment. Where he names none, the entry
// is `null` WITH THE REASON, and no link is written — the pass's own rule is *"This can fail.
// When it does, ask; never guess. A confidently wrong target produces a confidently wrong
// consequence list."* Inventing an instrument for him is what this whole report exists not
// to do, and it is CCW's own B15 §5 rule applied one layer down.
//
// ⚠ THE DISTRIBUTION IS ITSELF A FINDING, and it is the same one B14 recorded from the
// other end: a programme described throughout as a REPEAL programme has six of twelve
// measures with no enactment to repeal.
//
// ⚠ A GID THAT IS NOT IN `LegislationItem` IS NOT WRITTEN. `IdeaLegislation` joins on the
// row's UUID, and `identifiedInstruments` reads `legislationGovUkId` off the join — a link
// to a row we do not hold would be a link the pass silently cannot follow.
//
//   npx tsx --env-file=.env scripts/b18-link-instruments.ts            (plan — writes nothing)
//   npx tsx --env-file=.env scripts/b18-link-instruments.ts --write
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const WRITE = process.argv.includes('--write')

interface Target {
  /** `legislationGovUkId`, e.g. `ukpga/2010/15`. Null where he names no enactment. */
  gid: string | null
  /** The words in his stated intention that name it, or the reason there are none. */
  because: string
  /** How far the identification rests on his words alone. */
  confidence: 'he names the Act' | 'he names the institution, one founding statute' | 'not resolvable from his words'
}

const TARGETS: Record<string, Target> = {
  'M-01': {
    gid: 'ukpga/1998/42',
    because: '"Repeal the Human Rights Act 1998 and denounce the European Convention on Human Rights under Article 58"',
    confidence: 'he names the Act',
  },
  'M-02': {
    gid: 'ukpga/2010/15',
    because: '"Repeal the Equality Act 2010, including the public sector equality duty in section 149."',
    confidence: 'he names the Act',
  },
  'M-03': {
    gid: 'ukpga/2005/4',
    because: '"Repeal Part 3 of the Constitutional Reform Act 2005"',
    confidence: 'he names the Act',
  },
  'M-04': {
    gid: null,
    because: '"Abolish, privatise, or fully absorb into departments and Parliament the arm\'s-length body estate, '
      + 'which the proposer numbers at around four hundred." Around four hundred bodies with around four hundred '
      + 'founding instruments; he names none of them, and picking one would misrepresent the measure as narrower '
      + 'than it is.',
    confidence: 'not resolvable from his words',
  },
  'M-05': {
    gid: null,
    because: '"Narrow judicial review of executive action, by ouster clause or by statutory restriction of the '
      + 'available grounds." Judicial review is a COMMON LAW jurisdiction — there is no Act conferring it to '
      + 'repeal, which is why his own goal kind is "restrict a common law jurisdiction by statute". The '
      + 'instrument here is a Bill that does not exist yet, not an enactment that does.',
    confidence: 'not resolvable from his words',
  },
  'M-06': {
    gid: null,
    because: '"Reverse the permanent appointed civil service model, restoring ministerial control over senior '
      + 'appointments and removals." ⚠ DELIBERATELY UNRESOLVED. The candidates are the Northcote-Trevelyan '
      + 'settlement of 1854 (not an enactment at all) and Part 1 of the Constitutional Reform and Governance Act '
      + '2010, which codified it. `b14-enqueue.ts` recorded the same ambiguity when it mapped the goal kind. '
      + 'Choosing between them is a judgement about what the measure IS, and it is Charlie\'s, not this script\'s.',
    confidence: 'not resolvable from his words',
  },
  'M-07': {
    gid: 'ukpga/1998/11',
    because: '"Reverse the operational independence of the Bank of England conferred in 1998." The 1998 '
      + 'conferral is the Bank of England Act 1998; he names the year and the effect, and there is exactly one '
      + 'enactment that did it.',
    confidence: 'he names the institution, one founding statute',
  },
  'M-08': {
    gid: null,
    because: '"End the diversity, equity and inclusion agenda in the civil service." His own goal kind is '
      + 'APPLICATION_CHANGE — a complaint about practice, not about an enactment. B17 §2 measured retrieval '
      + 'agreeing: this measure returned guidance 24, the highest of the run.',
    confidence: 'not resolvable from his words',
  },
  'M-09': {
    gid: null,
    because: '"Reverse gender self-identification." ⚠ Self-identification was never enacted, so there is no '
      + 'statute to repeal — B17 §3 reached this from three independent directions. Linking the Gender '
      + 'Recognition Act 2004 would assert that the Act provides for self-identification, which is the opposite '
      + 'of what it provides for.',
    confidence: 'not resolvable from his words',
  },
  'M-10': {
    gid: null,
    because: '"Prevent publicly funded charities from campaigning against government policy." His goal kind is '
      + 'UNSURE and he names no instrument; legislation, grant conditions and guidance are all available.',
    confidence: 'not resolvable from his words',
  },
  'M-11': {
    gid: 'ukpga/2009/25',
    because: '"Remove sentencing guidance from an independent council and return it to Parliament or to '
      + 'ministers." The Sentencing Council is created by Part 4 of the Coroners and Justice Act 2009; he names '
      + 'the body, and one enactment constitutes it.',
    confidence: 'he names the institution, one founding statute',
  },
  'M-12': {
    gid: null,
    because: '"One Act repealing the constitutional legislation passed between 1997 and 2010." ⚠ The scope is '
      + 'TEMPORAL, not a list of instruments — B5 and B17 §3 both reached this. The target of this measure is '
      + 'every Act in a date range, and a single link would misdescribe the omnibus as a single repeal.',
    confidence: 'not resolvable from his words',
  },
}

async function main() {
  const rows: Array<{ ref: string; ideaId: string; title: string; t: Target }> = []
  for (const ref of Object.keys(TARGETS).sort()) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue
    rows.push({ ref, ideaId, title: idea.title, t: TARGETS[ref] })
  }

  console.log(`── ${rows.length} measures ──\n`)
  let willWrite = 0, already = 0, notHeld = 0, refused = 0

  for (const r of rows) {
    const existing = await prisma.ideaLegislation.findMany({
      where: { ideaId: r.ideaId },
      select: { legislationItem: { select: { legislationGovUkId: true, title: true } } },
    })

    if (!r.t.gid) {
      refused++
      console.log(`  ${r.ref}  NO INSTRUMENT NAMED — no link written`)
      console.log(`        ${r.t.because.slice(0, 150)}${r.t.because.length > 150 ? '…' : ''}`)
      if (existing.length) console.log(`        ⚠ but it already has ${existing.length} link(s): `
        + existing.map((e) => e.legislationItem?.legislationGovUkId).join(', '))
      continue
    }

    const item = await prisma.legislationItem.findFirst({
      where: { legislationGovUkId: r.t.gid },
      select: { id: true, title: true, legislationGovUkId: true },
    })
    if (!item) {
      notHeld++
      console.log(`  ${r.ref}  ⚠⚠ ${r.t.gid} IS NOT IN LegislationItem — refusing to write a link the pass cannot follow`)
      continue
    }
    if (existing.some((e) => e.legislationItem?.legislationGovUkId === r.t.gid)) {
      already++
      console.log(`  ${r.ref}  already linked to ${r.t.gid} — ${item.title.slice(0, 50)}`)
      continue
    }

    willWrite++
    console.log(`  ${r.ref}  → ${r.t.gid}  ${item.title.slice(0, 55)}`)
    console.log(`        (${r.t.confidence}) ${r.t.because.slice(0, 130)}${r.t.because.length > 130 ? '…' : ''}`)
    if (WRITE) {
      await prisma.ideaLegislation.create({
        data: {
          ideaId: r.ideaId,
          legislationItemId: item.id,
          // ⚠ `target`, not `relevant`. The three link types mean different things and
          // `identifiedInstruments` treats an IdeaLegislation row as "somebody explicitly
          // linked this Act to this idea" — which is only true of a target. A `relevant`
          // link would put a merely-related Act into a consequence list as the thing the
          // proposal changes.
          linkType: 'target',
          // ⚠ THE JUSTIFICATION TRAVELS WITH THE LINK. A row that says only "this idea
          // points at this Act" cannot be audited later; this one carries the clause of
          // his own stated intention that put it there.
          notes: `CCW-B18 §4 — ${r.t.confidence}. ${r.t.because}`.slice(0, 2000),
        },
      })
      const back = await prisma.ideaLegislation.findFirst({
        where: { ideaId: r.ideaId, legislationItemId: item.id },
        select: { legislationItem: { select: { legislationGovUkId: true } } },
      })
      console.log(`        ✔ written and read back: ${back?.legislationItem?.legislationGovUkId ?? 'NOT FOUND ⚠⚠'}`)
    }
  }

  console.log(`\n── ${WRITE ? 'written' : 'plan'} ──`)
  console.log(`  linked (or would be) : ${willWrite}`)
  console.log(`  already linked       : ${already}`)
  console.log(`  gid not held         : ${notHeld}`)
  // ⚠ THE NUMBER IS COUNTED, NOT WRITTEN OUT. A sentence that says "six of twelve" beside a
  // variable that says seven is how a stale figure reaches a report.
  console.log(`  no instrument named  : ${refused} of ${rows.length}  ← the finding, not a gap`)
  if (!WRITE) console.log('\n  PLAN ONLY — nothing written. Re-run with --write.')

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
