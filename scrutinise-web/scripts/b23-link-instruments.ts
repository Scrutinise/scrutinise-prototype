export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B23 §4 — LINK THE SEVEN MEASURES B18 §4 LEFT UNLINKED, AND SAY WHOSE NAMING IT IS.
//
// B18 §4 linked five measures to the enactment DAVID names and refused the other seven,
// because "linking them would mean naming an instrument David did not name". B23 §4 asks
// for the schedule across all twelve. The route that keeps B18's rule intact is this:
//
//   ⚠⚠ THE INSTRUMENT IS THE ONE THE BUILD'S OWN DRAFTED KERNEL NAMES — the legal landscape,
//   chosen approach and coherent actions Lex drafted from his words — and every link says
//   so in its `notes`. It is Lex's naming, not David's, and the schedule prints that
//   provenance on every measure so a reader never mistakes one for the other.
//
// Each entry below quotes the kernel (read from `IdeaFieldState` on 11 Sep 2026) and grades
// how far the draft TARGETS the Act, as against merely naming it as the framework it works
// within. Where the draft names an Act only as the current framework (M-05, M-10), the link
// is written — the brief asks for it — and the grade travels with it.
//
// ⚠ A gid not held in `LegislationItem` is refused, as in B18: `identifiedInstruments` reads
// the gid off the join and cannot follow a link to a row we do not hold.
// ⚠ `MAX_INSTRUMENTS = 3` in the consequences pass: M-12's four links are all written for the
// schedule; the pass will read the first three.
//
//   npx tsx --env-file=.env scripts/b23-link-instruments.ts            (plan — writes nothing)
//   npx tsx --env-file=.env scripts/b23-link-instruments.ts --write
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const WRITE = process.argv.includes('--write')

type Grade =
  | 'the draft proposes to amend or use this Act'
  | 'the draft names this Act as the framework it works within; it does not propose to change it'
  | 'the draft names this Act as one of the enactments the omnibus would repeal or amend'

interface Target { gid: string; grade: Grade; because: string }

const TARGETS: Record<string, Target[]> = {
  'M-04': [{
    gid: 'ukpga/2011/24', grade: 'the draft proposes to amend or use this Act',
    because: 'chosenApproach: "Utilise and extend the Public Bodies Act 2011 to establish a unified accountability framework"; '
      + 'legalLandscape names s.1, s.2, s.12 and Schedules 1–2.',
  }],
  'M-05': [{
    gid: 'ukpga/2022/35', grade: 'the draft names this Act as the framework it works within; it does not propose to change it',
    because: 'legalLandscape: "The Judicial Review and Courts Act 2022 made modest changes to judicial review"; the draft\'s own '
      + 'instrument is new, targeted primary legislation defining ouster clauses — a Bill that does not exist yet. Judicial '
      + 'review itself is a common law jurisdiction (B18 §4).',
  }],
  'M-06': [{
    gid: 'ukpga/2010/25', grade: 'the draft proposes to amend or use this Act',
    because: 'legalLandscape: "primarily governed by Part 1 of the Constitutional Reform and Governance Act 2010"; the v2 '
      + 'coherent actions open with "Draft and introduce a Government Bill to repeal Part 1 of the Constitutional Reform and '
      + 'Governance Act 2010". B18 §4 left the 1854-settlement-or-CRAG choice to Charlie; the 1854 settlement is not an '
      + 'enactment, so CRAG is the only linkable candidate.',
  }],
  'M-08': [{
    gid: 'ukpga/2010/15', grade: 'the draft proposes to amend or use this Act',
    because: 'legalLandscape: "primarily the Equality Act 2010, specifically Section 149"; chosenApproach: "Clarify and narrow '
      + 'the interpretation of the Public Sector Equality Duty (PSED) through official guidance". The same Act as M-02, '
      + 'approached through guidance rather than repeal.',
  }],
  'M-09': [{
    gid: 'ukpga/2010/15', grade: 'the draft proposes to amend or use this Act',
    because: 'chosenApproach: "issue clear, updated guidance under the Equality Act 2010, reflecting the Supreme Court\'s ruling '
      + 'that \'sex\' means biological sex"; the v1 actions open with "Draft an amendment to the Equality Act 2010 to define '
      + '\'sex\' explicitly as biological sex". ⚠ The Gender Recognition Act 2004 is named as framework only and is NOT '
      + 'linked — B18 §4: linking it would assert it provides for self-identification, which it does not.',
  }],
  'M-10': [{
    gid: 'ukpga/2011/25', grade: 'the draft names this Act as the framework it works within; it does not propose to change it',
    because: 'legalLandscape: "charities in the UK are governed by the Charities Act 2011 and guidance from the Charity '
      + 'Commission (CC9)"; the draft\'s instrument is standardised grant conditions, not legislation.',
  }],
  'M-12': [
    { gid: 'ukpga/1998/42', grade: 'the draft names this Act as one of the enactments the omnibus would repeal or amend',
      because: 'legalLandscape: "The current legal framework includes the Human Rights Act 1998"' },
    { gid: 'ukpga/2005/4', grade: 'the draft names this Act as one of the enactments the omnibus would repeal or amend',
      because: 'legalLandscape: "The Constitutional Reform Act 2005 also made significant changes"' },
    { gid: 'ukpga/2000/36', grade: 'the draft names this Act as one of the enactments the omnibus would repeal or amend',
      because: 'legalLandscape names the Freedom of Information Act 2000 among "other key legislation from the 1997-2010 period"' },
    { gid: 'ukpga/1998/46', grade: 'the draft names this Act as one of the enactments the omnibus would repeal or amend',
      because: 'legalLandscape names the Scotland Act 1998 among the devolution Acts. ⚠ The measure\'s scope is a DATE RANGE '
        + '(B18 §4); these four are the ones the draft names, not the list.' },
  ],
}

async function main() {
  let written = 0, already = 0, notHeld = 0
  for (const ref of Object.keys(TARGETS).sort()) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue
    console.log(`\n${ref}  ${idea.title}`)
    const existing = await prisma.ideaLegislation.findMany({
      where: { ideaId }, select: { legislationItem: { select: { legislationGovUkId: true } }, notes: true },
    })
    for (const e of existing) console.log(`  already linked: ${e.legislationItem?.legislationGovUkId} — ${(e.notes ?? '').slice(0, 60)}`)
    for (const t of TARGETS[ref]) {
      const item = await prisma.legislationItem.findFirst({
        where: { legislationGovUkId: t.gid }, select: { id: true, title: true },
      })
      if (!item) { notHeld++; console.log(`  ⚠⚠ ${t.gid} IS NOT IN LegislationItem — refusing to write a link the pass cannot follow`); continue }
      if (existing.some((e) => e.legislationItem?.legislationGovUkId === t.gid)) { already++; console.log(`  = ${t.gid} already linked`); continue }
      console.log(`  → ${t.gid}  ${item.title.slice(0, 60)}`)
      console.log(`     (${t.grade})`)
      if (!WRITE) continue
      await prisma.ideaLegislation.create({
        data: {
          ideaId, legislationItemId: item.id,
          linkType: 'target',
          // ⚠ The provenance travels with the link, and the first words say whose naming it is.
          notes: `CCW-B23 §4 — NAMED BY THE BUILD'S DRAFTED KERNEL, NOT BY DAVID. ${t.grade}. ${t.because}`.slice(0, 2000),
        },
      })
      const back = await prisma.ideaLegislation.findFirst({
        where: { ideaId, legislationItemId: item.id }, select: { notes: true, legislationItem: { select: { legislationGovUkId: true } } },
      })
      written++
      console.log(`     ✔ written and read back: ${back?.legislationItem?.legislationGovUkId ?? 'NOT FOUND ⚠⚠'} — ${(back?.notes ?? '').slice(0, 70)}`)
    }
  }
  console.log(`\n${WRITE ? 'written' : 'would write'}: ${WRITE ? written : 'see above'} · already: ${already} · not held: ${notHeld}`)
  if (!WRITE) console.log('PLAN ONLY — nothing written. Re-run with --write.')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
