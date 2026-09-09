export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B18 §4 — RUN THE STATUTORY CONSEQUENCES PASS ON THE MEASURES THAT NOW HAVE A TARGET.
//
// `b18-link-instruments.ts` wrote five `IdeaLegislation` rows. The pass that reads them is a
// DEEPENING pass, not a build pass — none of the eleven build passes touches it — so linking
// alone changes nothing until this runs. That is why *"What else refers to this law"* was
// still empty on all twelve after the links were written.
//
// ⚠ IT RUNS ONLY WHERE A LINK EXISTS. `identifiedInstruments()` also accepts legislation the
// sift kept, but a link is the strong source and the point of §4 is to exercise it. A
// measure with no link is skipped and said so, not run and reported empty.
//
// ⚠ THE TWO KNOWN DEFECTS TRAVEL INTO THE OUTPUT AND ARE NOT HIDDEN (CCW-B18 §4):
//   · 60 of CRA 2005's 120 instruments quote enacting words that do not name the Act. The
//     link is real; the recorded BASIS for those 60 is not evidenced.
//   · `nisr/2010/381` is a verified misattribution.
// The count is never to be printed unqualified.
//
//   npx tsx --env-file=.env scripts/b18-run-consequences.ts             (plan)
//   npx tsx --env-file=.env scripts/b18-run-consequences.ts --go
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { claimPass, runPass } from '../lib/lex/deepening'
import { assertRetrievalConfig } from '../lib/lex/harness-preflight'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const PASS_KEY = 'STATUTORY_CONSEQUENCES'
const GO = process.argv.includes('--go')

async function main() {
  assertRetrievalConfig('b18-consequences')

  const refs = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)
  for (const ref of refs) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }

    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue

    const links = await prisma.ideaLegislation.findMany({
      where: { ideaId },
      select: { legislationItem: { select: { legislationGovUkId: true, title: true } } },
    })
    if (!links.length) { console.log(`  ${ref}  skipped — no linked instrument`); continue }

    const build = await prisma.ideaBuild.findFirst({
      where: { ideaId }, orderBy: { version: 'desc' }, select: { version: true },
    })
    const runVersion = build?.version ?? 1

    const already = await prisma.evidenceItem.count({
      where: { ideaId, headingKey: 'REFERS_TO_THIS', runVersion },
    })

    console.log(`  ${ref}  ${links.map((l) => l.legislationItem?.legislationGovUkId).join(', ')} `
      + `· runVersion ${runVersion} · existing REFERS_TO_THIS rows at this version: ${already}`)

    if (!GO) continue
    if (already) { console.log('        already has rows at this version — not re-running'); continue }

    if (!(await claimPass(ideaId, PASS_KEY, runVersion))) {
      console.log('        could not claim the pass (already running or done)')
      continue
    }
    const outcome = await runPass(ideaId, PASS_KEY, runVersion)
    console.log(`        → ${JSON.stringify(outcome).slice(0, 400)}`)

    // ⚠ RE-READ, NOT THE COUNTER. `RunOutcome.findings` moving proves rows were counted, not
    // that any of them says anything — the rule verify-s8-deepening.ts exists to keep.
    const rows = await prisma.evidenceItem.findMany({
      where: { ideaId, headingKey: 'REFERS_TO_THIS', runVersion },
      select: { title: true, body: true },
      orderBy: { createdAt: 'asc' },
    })
    console.log(`        re-read ${rows.length} row(s):`)
    for (const r of rows.slice(0, 8)) console.log(`          · ${r.title.slice(0, 110)}`)
  }

  if (!GO) console.log('\n  PLAN ONLY — nothing run, nothing spent. Re-run with --go.')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
