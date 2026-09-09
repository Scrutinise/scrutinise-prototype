// ─────────────────────────────────────────────────────────────────────────────
// B18 §2 — WHAT DOES THE KERNEL CHECK ACTUALLY READ?
//
// `kernelText(ideaId)` (build.ts:3391) assembles the string the KERNEL_CHECK and
// LOGIC_CHECK passes mark, and it reads the CANONICAL `Idea` COLUMNS —
// challenge / summaryDiagnosis / rootCause / pivotalObstacle / chosenApproach /
// summaryGuidingPolicy / summaryCoherentActions — plus two child tables.
//
// The drafting passes do not write those columns. `diagnosisPass` calls
// `setProposal(ideaId, 'challenge', …)`, which writes `IdeaFieldState` at
// AWAITING_CONFIRMATION and leaves the column alone until a human accepts it —
// which `dump-build-kernel.ts`'s own §0 note says in as many words.
//
// This script does not re-implement `kernelText`; it prints the underlying facts on
// both sides so the disagreement is visible as data rather than as a code reading.
//
// Read-only.
//
//   npx tsx --env-file=.env scripts/_b18-kernel-source.ts <ideaId> [<ideaId> …]
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma'

/** Exactly the scalar columns `kernelText` selects, in its order. */
const KERNEL_COLUMNS = [
  'title', 'challenge', 'whoAffectedImpactCost', 'rootCause', 'pivotalObstacle',
  'summaryDiagnosis', 'legalLandscape', 'chosenApproach', 'summaryGuidingPolicy',
  'summaryCoherentActions',
] as const

function present(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some((x) => typeof x === 'string' && x.trim())
  return false
}

function preview(v: unknown, n = 70): string {
  if (v == null) return '—'
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.replace(/\s+/g, ' ').slice(0, n)
}

async function main() {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!ids.length) { console.error('usage: _b18-kernel-source.ts <ideaId> …'); process.exit(2) }

  for (const ideaId of ids) {
    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      select: {
        id: true, title: true, challenge: true, summaryDiagnosis: true, rootCause: true,
        pivotalObstacle: true, chosenApproach: true, summaryGuidingPolicy: true,
        summaryCoherentActions: true, legalLandscape: true, whoAffectedImpactCost: true,
        _count: { select: { diagnosisCauses: true, lexActions: true } },
      },
    })
    if (!idea) { console.log(`\n${ideaId}: NOT FOUND`); continue }

    const states = await prisma.ideaFieldState.findMany({
      where: { ideaId },
      select: { fieldKey: true, status: true, value: true, proposal: true },
    })
    const byKey = new Map(states.map((s) => [s.fieldKey, s]))

    console.log(`\n══ ${idea.title} ══`)
    console.log(`   ${ideaId}`)
    console.log(`   child tables the kernel string DOES read: diagnosisCauses ${idea._count.diagnosisCauses} · lexActions ${idea._count.lexActions}`)
    console.log('')
    console.log('   field                    | Idea column (what kernelText reads) | IdeaFieldState (what the build wrote)')
    console.log('   -------------------------|-------------------------------------|--------------------------------------')
    let columnsPresent = 0
    let statesPresent = 0
    for (const k of KERNEL_COLUMNS) {
      const col = (idea as Record<string, unknown>)[k]
      const st = byKey.get(k)
      const prop = (p: unknown) => (p && typeof p === 'object' && 'value' in (p as any)) ? (p as any).value : p
      const stVal = st ? (present(st.value) ? st.value : prop(st.proposal)) : null
      const colOk = present(col)
      const stOk = present(stVal)
      if (colOk) columnsPresent++
      if (stOk) statesPresent++
      console.log(`   ${k.padEnd(24)} | ${(colOk ? `SET  ${preview(col, 28)}` : 'EMPTY').padEnd(35)} | `
        + `${stOk ? `${st?.status ?? '?'}  ${preview(stVal, 30)}` : (st ? `${st.status} (empty)` : 'no row')}`)
    }
    console.log('')
    console.log(`   → of ${KERNEL_COLUMNS.length} kernel fields: ${columnsPresent} present in the Idea columns,`
      + ` ${statesPresent} present in IdeaFieldState.`)
    const accepted = states.filter((s) => s.status === 'ACCEPTED').length
    console.log(`   → IdeaFieldState rows: ${states.length} total, ${accepted} ACCEPTED,`
      + ` ${states.filter((s) => s.status === 'AWAITING_CONFIRMATION').length} AWAITING_CONFIRMATION.`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
