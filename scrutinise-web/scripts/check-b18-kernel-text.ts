// ─────────────────────────────────────────────────────────────────────────────
// CCW-B18 §2 — DOES THE KERNEL THE VERIFICATION PASSES MARK CONTAIN THE KERNEL?
//
// ⚠ IT IMPORTS `kernelText` AND DOES NOT RESTATE IT. A check that re-implements the
// function under test asserts that two pieces of code agree, which they do until one of
// them is fixed. (CLAUDE.md §25.3, and the `admits()`/`extraCorpora` case that produced it.)
//
// ⚠ IT IS A COLD READ. The subjects are the twelve report-run measures exactly as the
// builds of 2 September and the M-01 re-run of 9 September left them. Nothing is created,
// nothing is accepted, and no build is run first. (CLAUDE.md §26.)
//
// The property: for an idea whose build completed, the string handed to KERNEL_CHECK and
// LOGIC_CHECK carries the four things a kernel is made of — a problem, a diagnosis, a
// guiding policy and a plan. Before this sprint it carried a title, some causes and some
// actions, on every idea in the database.
//
//   npx tsx --env-file=.env scripts/check-b18-kernel-text.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { kernelText } from '../lib/lex/build'

const INPUTS = join(__dirname, '../../docs/report_run/lex_build_inputs.json')
const BUILDS = join(__dirname, '../../docs/report_run/builds')

let pass = 0
const failures: string[] = []
const controls: { name: string; fired: boolean }[] = []

function ok(cond: boolean, what: string) {
  if (cond) pass++
  else failures.push(what)
}

/** The sections a kernel must carry. `TITLE`, `CAUSES` and `ACTIONS` are deliberately NOT
 *  in this list: those three were present all along, and asserting on them would be an
 *  assertion that cannot fail. */
const REQUIRED = [
  'THE PROBLEM:', 'ROOT CAUSE:', 'PIVOTAL OBSTACLE:', 'THE DIAGNOSIS:',
  'THE APPROACH:', 'THE GUIDING POLICY:', 'THE PLAN:',
] as const

async function main() {
  const inputs = JSON.parse(readFileSync(INPUTS, 'utf8')) as { measures: Array<{ ref: string }> }

  const subjects: Array<{ ref: string; ideaId: string; title: string }> = []
  for (const m of inputs.measures) {
    let ideaId: string
    try {
      ideaId = JSON.parse(readFileSync(join(BUILDS, `${m.ref}.json`), 'utf8')).idea.id
    } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue
    subjects.push({ ref: m.ref, ideaId, title: idea.title })
  }
  console.log(`── cold read: ${subjects.length} measures, as their builds left them ──\n`)

  for (const s of subjects) {
    const text = await kernelText(s.ideaId)
    const missing = REQUIRED.filter((r) => !text.includes(r))
    console.log(`  ${s.ref}  ${String(text.length).padStart(6)} chars  `
      + `${missing.length ? `⚠ MISSING ${missing.join(' ')}` : 'all 7 kernel sections present'}   ${s.title.slice(0, 42)}`)
    ok(missing.length === 0, `${s.ref}: the kernel string is missing ${missing.join(', ')}`)
    ok(text.length > 1000, `${s.ref}: the kernel string is only ${text.length} chars — too short to be a kernel`)
    // The draft note has to be there, because none of these has been confirmed by anyone.
    ok(/awaiting the proposer's confirmation/.test(text),
      `${s.ref}: the kernel is drafted-not-confirmed and the string does not say so`)
  }

  // ══ CONTROLS ══════════════════════════════════════════════════════════════
  //
  // ⚠ Each returns whether the PROPERTY holds, not whether some string still matches.

  // 1. An idea that does not exist has no kernel. If this returns text, the function is
  //    manufacturing one and every assertion above is worthless.
  const ghost = await kernelText('00000000-0000-0000-0000-000000000000')
  controls.push({ name: 'a non-existent idea yields no kernel', fired: ghost === '' })

  // 2. An idea that exists but has never been built must NOT carry the seven sections.
  //    This is the control that would have caught the old behaviour: under the column
  //    reader, a built idea and an unbuilt one produced the SAME near-empty kernel.
  const unbuilt = await prisma.idea.findFirst({
    where: { builds: { none: {} }, deletedAt: null },
    select: { id: true, title: true },
  })
  if (unbuilt) {
    const t = await kernelText(unbuilt.id)
    const present = REQUIRED.filter((r) => t.includes(r))
    controls.push({
      name: `an unbuilt idea does not carry a drafted kernel (${unbuilt.title.slice(0, 30)}: ${present.length}/7 sections)`,
      fired: present.length < REQUIRED.length,
    })
  } else {
    console.log('\n  ⚠ NOT CHECKED: no unbuilt idea exists to use as the discrimination control.')
  }

  console.log('\n── controls ──')
  for (const c of controls) console.log(`  ${c.fired ? '✔ fired' : '✗ DEAD'}  ${c.name}`)

  console.log(`\n${failures.length ? '⚠⚠' : '✅'} check:b18-kernel-text — ${pass} passed, ${failures.length} failed,`
    + ` ${controls.length} controls, ${controls.filter((c) => !c.fired).length} dead`)
  for (const f of failures) console.log(`   ✗ ${f}`)

  await prisma.$disconnect()
  process.exit(failures.length || controls.some((c) => !c.fired) ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
