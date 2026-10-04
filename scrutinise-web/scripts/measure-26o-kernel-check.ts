// BRIEF_26O §2b — "Re-run the kernel check on Charlie's idea after the switch and report any verdict that changed."
//
//   npx tsx --env-file=.env scripts/measure-26o-kernel-check.ts 452c5ade
//
// BEFORE = the kernel text as `kernelText` rendered it before 26-O: "THE APPROACH" carried the statement and "THE GUIDING
// POLICY" carried the SUMMARY. AFTER = today's: "THE GUIDING POLICY" is the statement and the summary is labelled context.
// Same idea, same wording, same models — only that one labelling differs.
//
// ⚠ A model is not deterministic, so a changed verdict could be noise. Each arm is run TWICE, and a verdict is reported as
// CHANGED only where BEFORE agrees with itself, AFTER agrees with itself, and the two differ. Everything else is "unstable"
// (the model disagreed with itself on the same input) and said to be.
// ⚠ Spends ~35p (8 gemini-2.5-pro calls). Writes nothing to the idea; attributed to the ledger as `test.26o-kernel-check`.

import { prisma } from '../lib/prisma'
import { kernelText } from '../lib/lex/build'
import { runKernelCompliance, runLogicCheck, KERNEL_TESTS } from '../lib/lex/build-verify'
import { recordSpend } from '../lib/lex/spend-ledger'
import type { LlmUsage } from '../lib/lex/model-call'

const PREFIX = process.argv[2] ?? '452c5ade'

/** Today's text back to the pre-26-O labelling: the statement was "THE APPROACH", the summary "THE GUIDING POLICY". */
function asBefore(after: string): string {
  const lines = after.split('\n')
  const gp = lines.findIndex((l) => l.startsWith('THE GUIDING POLICY:'))
  const sm = lines.findIndex((l) => l.startsWith('SUMMARY OF THE GUIDING POLICY'))
  if (gp >= 0) lines[gp] = lines[gp].replace('THE GUIDING POLICY:', 'THE APPROACH:')
  if (sm >= 0) lines[sm] = lines[sm].replace(/^SUMMARY OF THE GUIDING POLICY[^:]*:/, 'THE GUIDING POLICY:')
  return lines.join('\n')
}

async function main() {
  const idea = await prisma.idea.findFirstOrThrow({ where: { id: { startsWith: PREFIX } }, select: { id: true, creatorId: true } })
  const after = await kernelText(idea.id)
  const before = asBefore(after)
  const usages: LlmUsage[] = []
  const onUsage = (u: LlmUsage) => usages.push(u)

  type Arm = { kernel: Map<string, boolean>; chain: boolean | null; defects: number }
  const run = async (text: string): Promise<Arm> => {
    const [k, l] = await Promise.all([runKernelCompliance({ kernel: text, onUsage }), runLogicCheck({ kernel: text, onUsage })])
    return { kernel: new Map((k?.results ?? []).map((r) => [r.id, r.passes])), chain: l ? l.chainHolds : null, defects: l?.defects.length ?? -1 }
  }
  const [b1, b2, a1, a2] = [await run(before), await run(before), await run(after), await run(after)]

  console.log(`kernel check on ${PREFIX} — ${KERNEL_TESTS.length} tests; BEFORE ×2, AFTER ×2\n`)
  let changed = 0, unstable = 0
  for (const t of KERNEL_TESTS) {
    const vb = [b1, b2].map((a) => a.kernel.get(t.id)), va = [a1, a2].map((a) => a.kernel.get(t.id))
    const bAgree = vb[0] === vb[1], aAgree = va[0] === va[1]
    const tag = bAgree && aAgree ? (vb[0] !== va[0] ? 'CHANGED' : 'same') : 'unstable'
    if (tag === 'CHANGED') changed++
    if (tag === 'unstable') unstable++
    const show = (v: Array<boolean | undefined>) => v.map((x) => (x === undefined ? '?' : x ? 'pass' : 'FAIL')).join('/')
    console.log(`  ${tag.padEnd(9)} ${t.id.padEnd(28)} before ${show(vb)}  after ${show(va)}  — ${t.test.slice(0, 70)}`)
  }
  const chain = (a: Arm) => (a.chain == null ? '?' : a.chain ? 'holds' : `does NOT hold (${a.defects} defects)`)
  console.log(`\n  chain (logic check): before ${chain(b1)} / ${chain(b2)} · after ${chain(a1)} / ${chain(a2)}`)
  console.log(`\n  ${changed} verdict(s) CHANGED beyond the model's own run-to-run variation; ${unstable} unstable (the model disagreed with itself).`)

  let total = 0
  for (const u of usages) total += (await recordSpend({ stream: 'lex', pass: 'test.26o-kernel-check', model: u.model, tokensIn: u.tokensIn, tokensOut: u.tokensOut, ideaId: idea.id, userId: idea.creatorId })).pence ?? 0
  console.log(`  spend: ${total.toFixed(1)}p over ${usages.length} calls`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
