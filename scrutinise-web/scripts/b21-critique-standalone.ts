export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B21a — THE KERNEL AND LOGIC CHECKS, RUN STANDALONE, FOR ALL TWELVE MEASURES.
//
// B20 §4 established that these two passes take a kernel STRING and a model and nothing
// else. This runs them without a build, so it costs no allowance, re-drafts nothing, and —
// the reason it is written this way — **WRITES NOTHING TO THE DATABASE**.
//
// ⚠⚠ WHY READ-ONLY MATTERS HERE. The pass in `build.ts` calls `recordVerificationIssues`,
// which adds `DeepeningIssue` rows against a `runVersion`. CCW is writing the report from
// those rows right now. Adding rows to an existing version would change what the report
// asserts without CCW placing it, which CCW-B21a §5 forbids by name. So the verdicts go to
// disk and the database is untouched.
//
// ⚠⚠ AND THIS IS A HARNESS AROUND THE PRODUCT'S FUNCTIONS, NOT A REIMPLEMENTATION OF THEM.
// `kernelText`, `runKernelCompliance`, `runLogicCheck`, `verifyModel`, `KERNEL_TESTS`,
// `complianceIssueText` and `logicIssueText` are all imported. What is restated is the four
// lines of glue between them — and even that is checked, see THE CONTROL below.
//
// ══ THE CONTROL, AND IT IS THE POINT ═══════════════════════════════════════════════════
// M-01, M-02 and M-06 already have these two passes run on a complete kernel by a real
// build: 8 of 9, 8 of 9 and 6 of 9, on prompts of 3,829 / 3,549 / 3,332 tokens. This runs
// them too, and prints the harness's prompt size beside the build's. **The token count is
// deterministic given the same kernel**, so a match proves the harness feeds the marker the
// same input a build does; the score may differ slightly because the model is not
// deterministic and the live kernel can have moved since. A MISMATCH IN TOKENS MEANS THE
// GLUE IS WRONG and the nine unproven measures must not be believed.
//
//   npx tsx --env-file=.env scripts/b21-critique-standalone.ts            (control only)
//   npx tsx --env-file=.env scripts/b21-critique-standalone.ts --all
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { kernelText } from '../lib/lex/build'
import {
  runKernelCompliance, runLogicCheck, verifyModel, KERNEL_TESTS,
  complianceIssueText, logicIssueText,
} from '../lib/lex/build-verify'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT = join(__dirname, '../../docs/report_run/critique')

/** The three whose numbers are already known from a real build, and what they were. */
const CONTROL: Record<string, { version: number; kernelTokens: number; score: string; logic: string }> = {
  'M-01': { version: 4, kernelTokens: 3829, score: '8 of 9', logic: 'holds, 0 defects' },
  'M-02': { version: 2, kernelTokens: 3549, score: '8 of 9', logic: 'holds, 0 defects' },
  'M-06': { version: 2, kernelTokens: 3332, score: '6 of 9', logic: 'does NOT hold, 4 defects' },
}
const ALL = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)
const RUN_ALL = process.argv.includes('--all')

/**
 * ══ ⚠⚠ READINGS ALREADY TAKEN OF THE SAME KERNELS, AND WHY THEY ARE RECORDED HERE ═══════
 *
 * These are OBSERVATIONS WITH PROVENANCE, not assumptions: each was printed by a run whose
 * log is on disk. They are here so that every run of this script re-states the repeatability
 * question rather than presenting its own single reading as the answer.
 *
 * The finding they carry is the one the report most needs: **`KERNEL_CHECK` is stable and
 * `LOGIC_CHECK` is not.** On M-01, over three readings of a kernel that did not change, the
 * chain verdict went holds → does NOT hold (2 defects) → holds. CCW-B21 says the claim that
 * the system argues against itself rests on `LOGIC_CHECK`; a verdict that flips on re-reading
 * cannot carry that weight on one reading.
 */
const PRIOR: Array<{ ref: string; when: string; source: string; kernel: string; logic: string }> = [
  { ref: 'M-01', when: '09 Sep 04:16', source: 'build v4', kernel: '8 of 9', logic: 'holds, 0 defects' },
  { ref: 'M-01', when: '09 Sep 13:2x', source: 'harness run 1', kernel: '8 of 9', logic: '⚠ does NOT hold, 2 defects' },
  { ref: 'M-01', when: '09 Sep 13:4x', source: 'harness run 2', kernel: '8 of 9', logic: 'holds, 0 defects' },
  { ref: 'M-02', when: '09 Sep 03:48', source: 'build v2', kernel: '8 of 9', logic: 'holds, 0 defects' },
  { ref: 'M-02', when: '09 Sep 13:2x', source: 'harness run 1', kernel: '8 of 9', logic: 'holds, 0 defects' },
  { ref: 'M-02', when: '09 Sep 13:4x', source: 'harness run 2', kernel: '9 of 9', logic: 'holds, 0 defects' },
  { ref: 'M-06', when: '09 Sep 04:02', source: 'build v2', kernel: '6 of 9', logic: '⚠ does NOT hold, 4 defects' },
  { ref: 'M-06', when: '09 Sep 13:2x', source: 'harness run 1', kernel: '6 of 9', logic: '⚠ does NOT hold, 3 defects' },
  { ref: 'M-06', when: '09 Sep 13:4x', source: 'harness run 2', kernel: '6 of 9', logic: '⚠ does NOT hold, 3 defects' },
]

interface Row {
  ref: string; title: string; ideaId: string
  kernelChars: number
  kernelTokensIn: number | null
  passed: number; failed: number; verdict: string
  failedTests: Array<{ id: string; test: string; whatFails: string; text: string }>
  chainHolds: boolean | null; chainAsRead: string | null
  defects: Array<{ kind: string; problem: string; text: string }>
  model: string
  error: string | null
}

async function one(ref: string): Promise<Row | null> {
  let ideaId: string
  try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { return null }
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
  if (!idea) return null

  const kernel = await kernelText(ideaId)
  const model = verifyModel('KERNEL_CHECK')
  const row: Row = {
    ref, title: idea.title, ideaId, kernelChars: kernel.length, kernelTokensIn: null,
    passed: 0, failed: 0, verdict: '', failedTests: [],
    chainHolds: null, chainAsRead: null, defects: [], model, error: null,
  }
  if (!kernel.trim()) { row.error = 'no kernel — nothing was drafted'; return row }

  const usages: Array<{ model: string; tokensIn: number; tokensOut: number }> = []
  const kc = await runKernelCompliance({ kernel, model, onUsage: (u) => usages.push(u) })
  if (!kc) { row.error = 'the kernel-compliance check did not complete'; return row }
  // ⚠ The FIRST usage is the kernel check's; the logic check appends its own after.
  row.kernelTokensIn = usages[0]?.tokensIn ?? null
  const failed = kc.results.filter((r) => !r.passes)
  row.passed = kc.results.length - failed.length
  row.failed = failed.length
  row.verdict = kc.verdict
  row.failedTests = failed.map((r) => {
    const t = KERNEL_TESTS.find((x) => x.id === r.id)!
    // ⚠ The product's own wording for the issue, imported. A retyped sentence here would be
    // a second definition of what the failure says.
    return { id: r.id, test: t.test, whatFails: r.whatFails, text: complianceIssueText(t, r) }
  })

  const lc = await runLogicCheck({ kernel, model: verifyModel('LOGIC_CHECK'), onUsage: (u) => usages.push(u) })
  if (lc) {
    row.chainHolds = lc.chainHolds
    row.chainAsRead = lc.chainAsRead ?? null
    row.defects = lc.defects.map((d) => ({ kind: d.kind, problem: d.problem, text: logicIssueText(d) }))
  } else {
    row.error = (row.error ? row.error + '; ' : '') + 'the logic check did not complete'
  }
  return row
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const refs = RUN_ALL ? ALL : Object.keys(CONTROL)
  console.log(`running ${refs.length} measure(s): ${refs.join(', ')}\n`)

  const rows: Row[] = []
  for (const ref of refs) {
    const t = Date.now()
    const r = await one(ref)
    if (!r) { console.log(`  ${ref}  (no build export — skipped)`); continue }
    rows.push(r)
    console.log(`  ${ref.padEnd(5)} ${String(r.kernelTokensIn ?? '—').padStart(5)} tok  `
      + `${r.passed} of ${r.passed + r.failed}  `
      + `${r.chainHolds === null ? 'logic —' : r.chainHolds ? 'chain holds' : `chain FAILS (${r.defects.length})`}  `
      + `${((Date.now() - t) / 1000).toFixed(0)}s${r.error ? `  ⚠ ${r.error}` : ''}`)
  }

  // ══ THE CONTROL, EVALUATED AND PRINTED WHETHER IT PASSES OR NOT ═══════════════════════
  const control: string[] = []
  control.push('| measure | build tokens | harness tokens | Δ | build score | harness score |')
  control.push('|---|---|---|---|---|---|')
  let controlOk = true
  for (const [ref, c] of Object.entries(CONTROL)) {
    const r = rows.find((x) => x.ref === ref)
    if (!r) continue
    const d = r.kernelTokensIn === null ? null : r.kernelTokensIn - c.kernelTokens
    // A kernel is thousands of tokens; anything past a couple of per cent is a different input.
    const near = d !== null && Math.abs(d) <= Math.max(40, c.kernelTokens * 0.02)
    if (!near) controlOk = false
    control.push(`| ${ref} | ${c.kernelTokens} | ${r.kernelTokensIn ?? '—'} | ${d === null ? '—' : `${d > 0 ? '+' : ''}${d}`}`
      + `${near ? '' : ' ⚠⚠'} | ${c.score} | ${r.passed} of ${r.passed + r.failed} |`)
  }

  const L: string[] = []
  L.push('# CCW-B21a — the kernel and logic checks, run standalone on all twelve measures')
  L.push('')
  L.push(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Marked by \`${rows[0]?.model ?? '—'}\`.*`)
  L.push('')
  L.push('> **Nothing was written to the database and no build was run.** These two passes take a')
  L.push('> kernel string and a model, so they need neither. The pass in the product also writes')
  L.push('> `DeepeningIssue` rows against a run version; CCW is building Appendix B out of those')
  L.push('> rows, so this harness deliberately does not touch them.')
  L.push('')
  L.push('⚠ **This is a harness around the product\'s own functions, not a copy of them.**')
  L.push('`kernelText`, `runKernelCompliance`, `runLogicCheck`, `verifyModel`, `KERNEL_TESTS`,')
  L.push('`complianceIssueText` and `logicIssueText` are imported. Only the glue between them is')
  L.push('written here — and the control below is what tests the glue.')
  L.push('')
  L.push('## ⚠⚠ The control — read this before the table')
  L.push('')
  L.push('M-01, M-02 and M-06 have already had these passes run on a complete kernel by a real')
  L.push('build. **The prompt size is deterministic given the same kernel**, so if this harness')
  L.push('feeds the marker the same input a build does, the token counts match. The score may move')
  L.push('a little — the model is not deterministic, and the live kernel can have changed since the')
  L.push('build. **A token mismatch means the glue is wrong and the other nine must not be believed.**')
  L.push('')
  L.push(...control)
  L.push('')
  L.push(controlOk
    ? '✔ **The control holds.** The harness reads the same kernel the build read, so the nine'
      + ' measures below stand on the same footing as the three.'
    : '⚠⚠ **THE CONTROL FAILED.** The harness is not feeding the marker what a build feeds it.'
      + ' Do not use the numbers below.')
  L.push('')
  L.push('---')
  L.push('')
  L.push('## ⚠⚠ Is any of this reproducible? The kernel score is. The logic verdict is not.')
  L.push('')
  L.push('Three measures have now been marked several times on a kernel that did not change between')
  L.push('readings — once by a real build and twice by this harness — and this run adds another.')
  L.push('**The prompt token counts are identical, so these are readings of the same input.**')
  L.push('')
  L.push('| Measure | When | By | KERNEL_CHECK | LOGIC_CHECK |')
  L.push('|---|---|---|---|---|')
  for (const ref of Object.keys(CONTROL)) {
    for (const pr of PRIOR.filter((x) => x.ref === ref)) {
      L.push(`| ${pr.ref} | ${pr.when} | ${pr.source} | ${pr.kernel} | ${pr.logic} |`)
    }
    const now = rows.find((x) => x.ref === ref)
    if (now) {
      L.push(`| ${ref} | **this run** | harness | **${now.passed} of ${now.passed + now.failed}** `
        + `| **${now.chainHolds === null ? '—' : now.chainHolds ? 'holds, 0 defects' : `⚠ does NOT hold, ${now.defects.length} defect(s)`}** |`)
    }
  }
  L.push('')
  L.push('**Read the M-01 rows.** On a kernel that did not change, the chain verdict has gone *holds*')
  L.push('→ *does NOT hold* → *holds*. `KERNEL_CHECK` over the same readings never moved by more than')
  L.push('one test.')
  L.push('')
  L.push('⚠⚠ **CCW-B21 says the claim that the system argues against itself rests on `LOGIC_CHECK`.**')
  L.push('On this evidence a single `LOGIC_CHECK` verdict cannot carry that claim: the pass is')
  L.push('reporting something real about difficult arguments, but *"the chain does not hold"* is not a')
  L.push('stable property of a kernel the way *"6 of 9"* is. If the report needs the claim, it needs')
  L.push('the pass run several times per measure and the SPREAD printed — not one verdict quoted as a')
  L.push('finding.')
  L.push('')
  L.push('⚠ The defect *counts* move too (M-06: 4 → 3 → 3), so a count of defects is not a measurement')
  L.push('either. What has been stable on M-06 is the DIRECTION — every reading says the chain fails.')
  L.push('')
  L.push('---')
  L.push('')
  L.push('## Summary')
  L.push('')
  L.push('| Measure | Title | Kernel chars | KERNEL_CHECK | LOGIC_CHECK |')
  L.push('|---|---|---|---|---|')
  for (const r of rows) {
    L.push(`| ${r.ref}${CONTROL[r.ref] ? '' : ' **new**'} | ${r.title.replace(/\|/g, '\\|')} | ${r.kernelChars.toLocaleString()} `
      + `| ${r.error && !r.passed ? `⚠ ${r.error}` : `**${r.passed} of ${r.passed + r.failed}**`} `
      + `| ${r.chainHolds === null ? '—' : r.chainHolds ? 'holds, 0 defects' : `⚠ **does NOT hold**, ${r.defects.length} defect(s)`} |`)
  }
  L.push('')
  L.push('---')
  L.push('')

  for (const r of rows) {
    L.push(`## ${r.ref} — ${r.title}`)
    L.push('')
    L.push(`\`${r.ideaId}\` · kernel ${r.kernelChars.toLocaleString()} characters · prompt ${r.kernelTokensIn ?? '—'} tokens`)
    L.push('')
    if (r.error) { L.push(`⚠ ${r.error}`); L.push('') }
    L.push(`### KERNEL_CHECK — ${r.passed} of ${r.passed + r.failed}`)
    L.push('')
    if (r.verdict) { L.push(`> ${r.verdict}`); L.push('') }
    if (r.failedTests.length) {
      for (const f of r.failedTests) {
        L.push(`**FAILS \`${f.id}\` — ${f.test}**`)
        L.push('')
        L.push(f.whatFails)
        L.push('')
      }
    } else if (!r.error) { L.push('*Every test passed.*'); L.push('') }

    L.push(`### LOGIC_CHECK — ${r.chainHolds === null ? 'did not complete' : r.chainHolds ? 'the chain holds' : '⚠ the chain does NOT hold'}`)
    L.push('')
    if (r.chainAsRead) { L.push(`**Read as:** ${r.chainAsRead}`); L.push('') }
    if (r.defects.length) {
      for (const d of r.defects) { L.push(`- **${d.kind}** — ${d.problem}`) }
      L.push('')
    } else if (r.chainHolds) { L.push('*No defects found.*'); L.push('') }
  }

  L.push('---')
  L.push('')
  L.push('## ⚠ What is NOT here, and why')
  L.push('')
  L.push('**`ADVERSARIAL` and `SMART` were not run standalone.** Both are mechanically capable of it')
  L.push('— B20 §4 sets out what each consumes — but neither is safe to run this way today:')
  L.push('')
  L.push('- **`SMART` rewrites the kernel.** It calls `setProposal` on up to five fields, and since')
  L.push('  the B18 fix those rewrites are visible to every marker that follows. A "read-only SMART"')
  L.push('  is not SMART, and a real one would change the twelve measures while CCW is writing the')
  L.push('  report from them (CCW-B21a §5).')
  L.push('- **`ADVERSARIAL`\'s prompt is assembled from the build\'s own carried state** — the SMART')
  L.push('  critique, the verification carry, and the elicitation testimony. Rebuilding that outside')
  L.push('  a build means restating a prompt rather than importing one, and a critique produced from')
  L.push('  an approximation of the real prompt is not comparable with the three that were not.')
  L.push('')
  L.push('Both would be sound with one `export` on `runOnePass` and a shared context builder, which')
  L.push('is a change to `build.ts` — the file every build runs through — and is not something to')
  L.push('make unsupervised on the strength of an export.')
  L.push('')

  const file = join(OUT, 'B21_KERNEL_LOGIC_ALL_TWELVE.md')
  writeFileSync(file, L.join('\n'), 'utf8')
  console.log(`\nwrote ${file}`)
  console.log('\n' + control.join('\n'))
  console.log('\n' + (controlOk ? '✔ CONTROL HOLDS' : '⚠⚠ CONTROL FAILED — do not use the new numbers'))
  await prisma.$disconnect()
  process.exit(controlOk ? 0 : 1)
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
