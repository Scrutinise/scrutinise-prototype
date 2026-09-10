export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §1 — THE CRITIQUE, PER MEASURE, FOR ALL TWELVE, WITH THE SPREAD.
//
// One file per measure (`B22_CRITIQUE_M-XX.md`) so CCW can place each beside its own measure
// in Volume 2, plus `B22_ALTERNATIVES.md`. Same shape as `B20_CRITIQUE_M-01.md`: the
// prompt-size table across builds, the four passes, the nine tests, the kernel.
//
// ══ ⚠⚠ WHAT IS RE-RUN HERE AND WHAT IS READ OFF THE BUILD, AND WHY THE LINE IS THERE ═════
//
//   KERNEL_CHECK   RE-RUN, TWICE (or --readings N). Takes a kernel string and a model.
//   LOGIC_CHECK    RE-RUN, TWICE. Same.
//   ADVERSARIAL    RE-RUN ONCE, READ-ONLY — and faithfully, because its prompt is assembled
//                  from the build's OWN stored carry (`carry.smart`, `carry.verification`)
//                  read off the pass log, not from a restatement of it. `costLinesFor` and
//                  `testimonyForPrompt` are imported; nothing about the prompt is retyped.
//   SMART          ⚠⚠ **NOT RE-RUN, AND THIS IS A POLICY LIMIT, NOT A CAPABILITY ONE.**
//                  `smartPass` calls `setProposal` on up to five kernel fields, and since the
//                  B18 fix those rewrites are visible to every marker that follows. Running it
//                  would change the twelve measures while CCW is writing the report from them
//                  — CCW-B21a §5 by name. Its build output is carried here verbatim and
//                  labelled with which code path produced it.
//
// ⚠⚠ NOTHING IN THIS SCRIPT WRITES TO THE DATABASE. The passes in `build.ts` also record
// `DeepeningIssue` / `EvidenceItem` rows; Appendix B is being built out of those rows, so the
// verdicts go to disk and the rows are left exactly as they are.
//
// ══ ⚠ THE SPREAD IS THE POINT OF §1 ═════════════════════════════════════════════════════
// B21 measured, on M-01/02/06, that KERNEL_CHECK is stable to within one test of nine while
// LOGIC_CHECK's verdict flipped on an unchanged kernel. The brief asks whether the other nine
// behave the same way. So every measure is read at least twice and the spread is printed —
// a single verdict per measure would be the thing that finding says not to publish.
//
//   npx tsx --env-file=.env scripts/b22-critique-per-measure.ts            (plan)
//   npx tsx --env-file=.env scripts/b22-critique-per-measure.ts --go
//   npx tsx --env-file=.env scripts/b22-critique-per-measure.ts --go --only M-03 --readings 3
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { kernelText, costLinesFor } from '../lib/lex/build'
import {
  runKernelCompliance, runLogicCheck, verifyModel, KERNEL_TESTS,
  complianceIssueText, logicIssueText,
} from '../lib/lex/build-verify'
import { generateAdversarialIssues } from '../lib/lex/deepening-adversarial'
import { modelForPass } from '../lib/lex/build-config'
import { elicitationContext } from '../lib/lex/elicitation'
import { testimonyForPrompt } from '../lib/lex/testimony'
import { evidenceForBuild } from '../lib/lex/evidence-scope'
import { readKnownUnknowns } from '../lib/lex/deepening'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT = join(__dirname, '../../docs/report_run/critique')
const CRITIQUE = ['SMART', 'KERNEL_CHECK', 'LOGIC_CHECK', 'ADVERSARIAL'] as const

const GO = process.argv.includes('--go')
const onlyArg = process.argv.indexOf('--only')
const ONLY = onlyArg > -1 ? process.argv[onlyArg + 1] : null
const readArg = process.argv.indexOf('--readings')
const READINGS = readArg > -1 ? Math.max(2, parseInt(process.argv[readArg + 1], 10)) : 2

const ALL = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)

interface PassEntry {
  key: string; status: string; output?: string | null; failureReason?: string | null
  carry?: Record<string, string> | null
  usages?: Array<{ model: string; tokensIn: number; tokensOut: number; echoedModel?: string }> | null
  startedAt?: string | null; completedAt?: string | null
}

interface Reading {
  kernelTokensIn: number | null
  passed: number; failed: number; verdict: string
  failedTests: Array<{ id: string; test: string; whatFails: string }>
  chainHolds: boolean | null; chainAsRead: string | null
  defects: Array<{ kind: string; problem: string }>
  error: string | null
}

function esc(s: string) { return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ') }
function fence(s: string) { return s.replace(/\r/g, '').trimEnd() }

/**
 * ⚠ WHICH CODE PATH MARKED A BUILD, STATED RATHER THAN ASSUMED.
 *
 * `kernelText` read the empty canonical columns until 9 September; a build marked before the
 * fix was handed a title and two lists. The prompt SIZE is the discriminator — a complete
 * kernel runs to 2,800–3,900 tokens and a starved one to 1,800–2,400 — and it is a
 * measurement rather than a date comparison, so a build run from an old checkout after the
 * fix still classifies correctly.
 */
function pathOf(tokensIn: number | null): 'complete kernel' | 'STARVED kernel' | 'unknown' {
  if (tokensIn === null) return 'unknown'
  return tokensIn >= 2600 ? 'complete kernel' : 'STARVED kernel'
}

async function readOnce(ideaId: string): Promise<Reading> {
  const r: Reading = {
    kernelTokensIn: null, passed: 0, failed: 0, verdict: '', failedTests: [],
    chainHolds: null, chainAsRead: null, defects: [], error: null,
  }
  const kernel = await kernelText(ideaId)
  if (!kernel.trim()) { r.error = 'no kernel — nothing was drafted'; return r }
  const usages: Array<{ model: string; tokensIn: number; tokensOut: number }> = []
  const kc = await runKernelCompliance({ kernel, model: verifyModel('KERNEL_CHECK'), onUsage: (u) => usages.push(u) })
  if (!kc) { r.error = 'the kernel-compliance check did not complete'; return r }
  r.kernelTokensIn = usages[0]?.tokensIn ?? null
  const failed = kc.results.filter((x) => !x.passes)
  r.passed = kc.results.length - failed.length
  r.failed = failed.length
  r.verdict = kc.verdict
  r.failedTests = failed.map((x) => {
    const t = KERNEL_TESTS.find((y) => y.id === x.id)!
    return { id: x.id, test: t.test, whatFails: x.whatFails }
  })
  const lc = await runLogicCheck({ kernel, model: verifyModel('LOGIC_CHECK'), onUsage: (u) => usages.push(u) })
  if (lc) {
    r.chainHolds = lc.chainHolds
    r.chainAsRead = lc.chainAsRead ?? null
    r.defects = lc.defects.map((d) => ({ kind: d.kind, problem: d.problem }))
  } else {
    r.error = (r.error ? `${r.error}; ` : '') + 'the logic check did not complete'
  }
  return r
}

/**
 * The hostile clerk, re-run outside a build and writing nothing.
 *
 * ⚠ THE PROMPT IS THE BUILD'S, NOT A RECONSTRUCTION OF IT. `passMethod` carries the SMART
 * critique and the verification carry exactly as `adversarialPass` composes them — read off
 * the stored pass log rather than re-derived — plus the proposer's testimony through the same
 * `testimonyForPrompt` the pass uses. Where the build has no such carry, the block is omitted
 * exactly as the pass omits it.
 */
async function adversarialOnce(
  ideaId: string, userId: string, buildVersion: number, log: PassEntry[],
): Promise<{ issues: string[] | null; tokensIn: number; tokensOut: number; model: string; note: string | null }> {
  const model = modelForPass('ADVERSARIAL')
  const kernel = await kernelText(ideaId)
  const costLines = await costLinesFor(ideaId)
  const ctx = await elicitationContext(ideaId, userId)
  const evidence = await prisma.evidenceItem.findMany({
    where: { ...evidenceForBuild(ideaId, buildVersion), status: { not: 'REJECTED' } },
    orderBy: { createdAt: 'asc' },
    select: { kind: true, title: true, body: true },
  })
  const gapRows = await prisma.deepeningPass.findMany({
    where: { ideaId, runVersion: buildVersion }, select: { knownUnknowns: true },
  })
  const knownUnknowns = gapRows.flatMap((g) => readKnownUnknowns(g.knownUnknowns)).map((g) => g.question).slice(0, 40)

  const smartCarry = log.find((p) => p.key === 'SMART')?.carry?.smart ?? ''
  // ⚠ The verification carry accumulates: LOGIC_CHECK's entry holds the kernel check's too.
  const verifyCarry = log.find((p) => p.key === 'LOGIC_CHECK')?.carry?.verification
    ?? log.find((p) => p.key === 'KERNEL_CHECK')?.carry?.verification ?? ''

  const usages: Array<{ tokensIn: number; tokensOut: number }> = []
  const issues = await generateAdversarialIssues({
    idea: kernel,
    costLines,
    findings: evidence.map((e) => ({ kind: e.kind as 'FINDING', title: e.title, body: e.body, sourceId: '' })),
    passMethod: [
      'This is the COMPLETE proposal after research and revision — the diagnosis, the approach, ',
      'the instrument and the actions, with every finding attached. You are not covering one angle ',
      'of it; you are reading all of it, cold, for the first time.',
      smartCarry
        ? `\n═══ A CRITIQUE HAS ALREADY BEEN MADE OF THIS PROPOSAL ═══\n${smartCarry}\n`
          + '⚠ DO NOT RESTATE ANY OF THAT. Those points are already on the user\'s list. Your value is '
          + 'what it did NOT see — go somewhere else, and if you genuinely cannot find anything it '
          + 'missed, say so rather than paraphrasing it.'
        : '',
      verifyCarry
        ? `\n═══ AND IT HAS BEEN MARKED AGAINST THE METHOD ═══\n${verifyCarry}\n`
          + '⚠ Same rule: these failures are recorded. Press on what they leave open.'
        : '',
      '',
      ctx ? testimonyForPrompt(ctx, 3000) : '',
    ].filter(Boolean).join('\n'),
    knownUnknowns,
  }, { model, label: 'b22-adversarial', stream: 'build', onUsage: (u) => usages.push(u) })

  return {
    issues,
    tokensIn: usages.reduce((a, b) => a + (b.tokensIn ?? 0), 0),
    tokensOut: usages.reduce((a, b) => a + (b.tokensOut ?? 0), 0),
    model,
    note: ctx ? null : 'no elicitation row — the proposer\'s testimony was not in the prompt',
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const refs = (ONLY ? [ONLY] : ALL)
  console.log(`${refs.length} measure(s) · ${READINGS} readings of KERNEL_CHECK + LOGIC_CHECK each · `
    + 'ADVERSARIAL once, read-only · SMART carried from the build, not re-run\n')
  if (!GO) { console.log('PLAN ONLY — nothing called, nothing spent. Re-run with --go.'); await prisma.$disconnect(); return }

  const altLines: string[] = []
  const index: Array<{ ref: string; title: string; kernel: string; logic: string; path: string }> = []

  for (const ref of refs) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { console.log(`  ${ref}  no export — skipped`); continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true, creatorId: true } })
    if (!idea) { console.log(`  ${ref}  no idea row — skipped`); continue }

    const builds = await prisma.ideaBuild.findMany({
      where: { ideaId },
      select: { id: true, version: true, status: true, startedAt: true, completedAt: true, passes: true, estCostPence: true },
      orderBy: { version: 'asc' },
    })
    const target = [...builds].reverse().find((b) => b.status === 'DONE') ?? builds[builds.length - 1]
    if (!target) { console.log(`  ${ref}  no build — skipped`); continue }
    const log = (Array.isArray(target.passes) ? target.passes : []) as unknown as PassEntry[]
    const pass = (k: string) => log.find((p) => p.key === k)

    // ── the readings ──────────────────────────────────────────────────────
    const readings: Reading[] = []
    for (let i = 0; i < READINGS; i++) {
      const t = Date.now()
      const r = await readOnce(ideaId)
      readings.push(r)
      console.log(`  ${ref} reading ${i + 1}/${READINGS}  ${r.kernelTokensIn ?? '—'} tok  ${r.passed} of ${r.passed + r.failed}  `
        + `${r.chainHolds === null ? 'logic —' : r.chainHolds ? 'chain holds' : `chain FAILS (${r.defects.length})`}  ${((Date.now() - t) / 1000).toFixed(0)}s`)
    }
    const adv = await adversarialOnce(ideaId, idea.creatorId, target.version, log)
    console.log(`  ${ref} adversarial      ${adv.issues?.length ?? 'null'} issue(s)  ${adv.tokensIn} in / ${adv.tokensOut} out`)

    // ── the file ──────────────────────────────────────────────────────────
    const L: string[] = []
    const scores = readings.map((r) => r.passed)
    const kernelSpread = Math.min(...scores) === Math.max(...scores)
      ? `${scores[0]} of 9 on all ${readings.length} readings`
      : `**${Math.min(...scores)}–${Math.max(...scores)} of 9** across ${readings.length} readings`
    const dirs = readings.map((r) => r.chainHolds)
    const logicStable = dirs.every((d) => d === dirs[0])
    const logicSpread = dirs[0] === null ? 'did not complete'
      : logicStable
        ? `${dirs[0] ? 'holds' : '**does NOT hold**'} on all ${readings.length} readings`
        : `⚠⚠ **UNSTABLE — the verdict changed between readings**`

    L.push(`# ${ref} — ${idea.title}`)
    L.push('')
    L.push(`*The critique, per measure. Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.*`)
    L.push('')
    L.push(`- idea \`${ideaId}\``)
    L.push(`- build \`${target.id}\` — **v${target.version} ${target.status}**, `
      + `${target.startedAt?.toISOString().slice(0, 16).replace('T', ' ')} UTC · `
      + `${Number(target.estCostPence ?? 0).toFixed(2)}p`)
    L.push('')
    L.push('> **No model wrote anything to the database to produce this file, and no build was run.**')
    L.push('> `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` were re-run against the current kernel;')
    L.push('> `SMART` is carried from the build because re-running it rewrites the kernel.')
    L.push('')
    L.push('## The headline, before anything else')
    L.push('')
    L.push('| | |')
    L.push('|---|---|')
    L.push(`| KERNEL_CHECK | ${kernelSpread} |`)
    L.push(`| LOGIC_CHECK | ${logicSpread} |`)
    L.push(`| Kernel the marker read | ${pathOf(readings[0]?.kernelTokensIn ?? null)}, ${readings[0]?.kernelTokensIn ?? '—'} prompt tokens |`)
    L.push('')

    // ── was the kernel complete when the BUILD marked it ──────────────────
    L.push('## Was the kernel complete when the build marked it?')
    L.push('')
    L.push('`kernelText()` read the empty canonical `Idea` columns until 9 September, so a build marked')
    L.push('before that fix was handed a title and two lists. The prompt SIZE is the discriminator, and')
    L.push('it is a measurement rather than a date comparison.')
    L.push('')
    L.push('| build | when | KERNEL_CHECK tokens in | what it read | score |')
    L.push('|---|---|---|---|---|')
    for (const b of builds) {
      const bl = (Array.isArray(b.passes) ? b.passes : []) as unknown as PassEntry[]
      const kc = bl.find((p) => p.key === 'KERNEL_CHECK')
      const tin = kc?.usages?.[0]?.tokensIn ?? null
      L.push(`| v${b.version} ${b.status} | ${b.startedAt?.toISOString().slice(0, 16).replace('T', ' ')} | ${tin ?? '—'} `
        + `| ${pathOf(tin)} | ${esc((kc?.output ?? '—').replace(/ — marked by.*$/, ''))} |`)
    }
    L.push(`| **this export** | **just now** | **${readings[0]?.kernelTokensIn ?? '—'}** | **${pathOf(readings[0]?.kernelTokensIn ?? null)}** | ${kernelSpread} |`)
    L.push('')

    // ── the readings, in full ─────────────────────────────────────────────
    L.push(`## KERNEL_CHECK — ${readings.length} readings of the same kernel`)
    L.push('')
    L.push('| reading | prompt tokens | score | failing criteria |')
    L.push('|---|---|---|---|')
    readings.forEach((r, i) => {
      L.push(`| ${i + 1} | ${r.kernelTokensIn ?? '—'} | **${r.passed} of ${r.passed + r.failed}** `
        + `| ${r.failedTests.length ? r.failedTests.map((f) => `\`${f.id}\``).join(', ') : '—'} |`)
    })
    L.push('')
    const allFailed = new Map<string, { test: string; whatFails: string[]; seen: number }>()
    for (const r of readings) {
      for (const f of r.failedTests) {
        const e = allFailed.get(f.id) ?? { test: f.test, whatFails: [], seen: 0 }
        e.seen++; e.whatFails.push(f.whatFails); allFailed.set(f.id, e)
      }
    }
    if (allFailed.size) {
      L.push('### The criteria that failed, and on how many readings')
      L.push('')
      for (const [id, e] of allFailed) {
        L.push(`**\`${id}\` — ${e.test}** · failed on ${e.seen} of ${readings.length} readings`
          + (e.seen < readings.length ? ' ⚠ **not on every reading**' : ''))
        L.push('')
        L.push(`> ${fence(e.whatFails[0])}`)
        L.push('')
      }
    } else {
      L.push('*Every criterion passed on every reading.*')
      L.push('')
    }

    L.push(`## LOGIC_CHECK — ${readings.length} readings`)
    L.push('')
    L.push('| reading | verdict | defects |')
    L.push('|---|---|---|')
    readings.forEach((r, i) => {
      L.push(`| ${i + 1} | ${r.chainHolds === null ? '—' : r.chainHolds ? 'the chain holds' : '⚠ **does NOT hold**'} | ${r.defects.length} |`)
    })
    L.push('')
    if (!logicStable) {
      L.push('⚠⚠ **The verdict is not stable on this measure.** It changed between readings of a kernel')
      L.push('that did not change. A single verdict from this pass cannot be quoted as a property of the')
      L.push('kernel; what can be reported is that the readings disagree.')
      L.push('')
    }
    for (const [i, r] of readings.entries()) {
      if (!r.defects.length && !r.chainAsRead) continue
      L.push(`**Reading ${i + 1}**${r.chainAsRead ? ` — read as: *${esc(r.chainAsRead)}*` : ''}`)
      L.push('')
      for (const d of r.defects) L.push(`- **${d.kind}** — ${d.problem}`)
      L.push('')
    }

    // ── adversarial ───────────────────────────────────────────────────────
    L.push('## ADVERSARIAL — re-run, read-only')
    L.push('')
    L.push(`Model \`${adv.model}\` · ${adv.tokensIn} in / ${adv.tokensOut} out.`
      + (adv.note ? ` ⚠ ${adv.note}.` : ''))
    L.push('')
    L.push('⚠ The prompt is the build\'s own: the SMART critique and the verification carry are read off')
    L.push('the stored pass log rather than re-derived, and the cost lines and the proposer\'s testimony')
    L.push('come through the same functions the pass uses.')
    L.push('')
    if (adv.issues?.length) {
      adv.issues.forEach((s, i) => { L.push(`**${i + 1}.** ${fence(s)}`); L.push('') })
    } else {
      L.push('⚠ **The pass returned nothing.** That is recorded as a failure to produce a reading, never')
      L.push('as "there is nothing to object to" — the same rule the pass itself holds.')
      L.push('')
    }

    // ── smart, from the build ─────────────────────────────────────────────
    const smart = pass('SMART')
    const smartTokens = smart?.usages?.[0]?.tokensIn ?? null
    L.push('## SMART — carried from the build, not re-run')
    L.push('')
    L.push('⚠⚠ **This pass rewrites the kernel.** `smartPass` calls `setProposal` on up to five fields,')
    L.push('and since the B18 fix those rewrites reach every marker that follows it. Re-running it here')
    L.push('would change the measure while the report is being written from it, so it is not re-run.')
    L.push('')
    L.push(`**${smart?.status ?? 'no entry'}** — ${esc(smart?.output ?? smart?.failureReason ?? '(no output recorded)')}`)
    L.push('')
    L.push(`⚠ Produced by the build above, on a **${pathOf(pass('KERNEL_CHECK')?.usages?.[0]?.tokensIn ?? null)}**`
      + `${smartTokens ? ` (its own prompt: ${smartTokens} tokens)` : ''}.`)
    L.push('')
    const smartCarry = smart?.carry?.smart
    if (smartCarry?.trim()) {
      L.push('<details><summary>The critique in full</summary>')
      L.push('')
      L.push('```')
      L.push(fence(smartCarry))
      L.push('```')
      L.push('')
      L.push('</details>')
      L.push('')
    }

    // ── the nine tests, imported ──────────────────────────────────────────
    L.push('## The nine kernel tests, as the marker has them')
    L.push('')
    for (const t of KERNEL_TESTS) L.push(`- \`${t.id}\` — ${t.test}`)
    L.push('')

    const kernel = await kernelText(ideaId)
    L.push('## The kernel that was marked')
    L.push('')
    L.push(`⚠ Read live at export time. ${kernel.length} characters.`)
    L.push('')
    L.push('```')
    L.push(fence(kernel))
    L.push('```')
    L.push('')

    const file = join(OUT, `B22_CRITIQUE_${ref}.md`)
    writeFileSync(file, L.join('\n'), 'utf8')
    console.log(`  ${ref} → ${file}`)
    index.push({
      ref, title: idea.title, kernel: kernelSpread, logic: logicSpread,
      path: pathOf(readings[0]?.kernelTokensIn ?? null),
    })

    // ── alternatives ──────────────────────────────────────────────────────
    const forks = await prisma.buildFork.findMany({
      where: { buildId: target.id },
      orderBy: [{ forkKey: 'asc' }, { alternativeIndex: 'asc' }],
      select: {
        forkKey: true, fieldKey: true, chosen: true, alternative: true,
        caseForAlternative: true, recommendationReason: true, resolved: true, alternativeIndex: true,
      },
    })
    altLines.push(`\n## ${ref} — ${idea.title}`)
    altLines.push(`\n*Build v${target.version}. ${forks.length} alternative(s) across `
      + `${new Set(forks.map((f) => f.forkKey)).size} decision point(s).*`)
    if (!forks.length) altLines.push('\n*No forks recorded on this build.*')
    let last = ''
    for (const f of forks) {
      if (f.forkKey !== last) {
        last = f.forkKey
        altLines.push(`\n### ${f.forkKey}  ·  field \`${f.fieldKey}\`${f.resolved ? '' : '  ·  **unresolved**'}`)
        altLines.push(`\n**What Lex chose.** ${fence(f.chosen)}`)
        altLines.push(f.recommendationReason
          ? `\n*Why:* ${fence(f.recommendationReason)}`
          : '\n*No recommendation reason recorded on this row — rendered as absent, not guessed.*')
      }
      altLines.push(`\n**Alternative ${f.alternativeIndex + 1}.** ${fence(f.alternative)}`)
      altLines.push(`\n*The case for it:* ${fence(f.caseForAlternative)}`)
    }
  }

  const alt = [
    '# CCW-B22 — the alternatives, all twelve measures',
    '',
    '*The choices each build made and the roads it did not take. These are the decisions that require',
    `a human. Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from \`BuildFork\`; no model was called.*`,
    '',
    '⚠ **`chosen` is what Lex proposed, not what Charlie decided.** A fork marked *unresolved* is one',
    'nobody has been through.',
    ...altLines,
    '',
  ]
  if (!ONLY) writeFileSync(join(OUT, 'B22_ALTERNATIVES.md'), alt.join('\n'), 'utf8')

  // ── the index, which is what §1 is really asking for ──────────────────
  if (index.length) {
    const idx = [
      '# CCW-B22 §1 — the four tests across all twelve measures',
      '',
      `*Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. ${READINGS} readings per measure.*`,
      '',
      '**Does the finding hold across all twelve?** B21 measured, on three measures, that the nine',
      'criteria are stable to within one test while the chain-of-reasoning verdict is not. This is the',
      'same question asked of the other nine.',
      '',
      '| Measure | Title | Kernel read | KERNEL_CHECK | LOGIC_CHECK |',
      '|---|---|---|---|---|',
      ...index.map((r) => `| [${r.ref}](B22_CRITIQUE_${r.ref}.md) | ${esc(r.title)} | ${r.path} | ${r.kernel} | ${r.logic} |`),
      '',
    ]
    const unstable = index.filter((r) => r.logic.includes('UNSTABLE'))
    const kernelMoved = index.filter((r) => r.kernel.includes('–'))
    idx.push(`**${kernelMoved.length} of ${index.length} measures had KERNEL_CHECK move between readings at all**`
      + `${kernelMoved.length ? ` (${kernelMoved.map((r) => r.ref).join(', ')})` : ''}.`)
    idx.push('')
    idx.push(unstable.length
      ? `⚠⚠ **${unstable.length} of ${index.length} measures had the LOGIC_CHECK verdict CHANGE between `
        + `readings of an unchanged kernel: ${unstable.map((r) => r.ref).join(', ')}.**`
      : `✔ **The LOGIC_CHECK verdict held on all ${index.length} measures across ${READINGS} readings each.** `
        + '⚠ That is a weaker statement than it looks: B21 saw M-01 flip once in four readings, so two '
        + 'readings agreeing is consistent with a verdict that flips less than half the time. It bounds '
        + 'the instability; it does not disprove it.')
    idx.push('')
    writeFileSync(join(OUT, 'B22_FOUR_TESTS_INDEX.md'), idx.join('\n'), 'utf8')
    console.log('\n' + idx.slice(6).join('\n'))
  }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
