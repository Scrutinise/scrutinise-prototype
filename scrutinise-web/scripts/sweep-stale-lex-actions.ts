// ─────────────────────────────────────────────────────────────────────────────
// 26-B — SWEEP THE ACTIONS EARLIER BUILDS LEFT ON AN IDEA.
//
// Until 17 Sep 2026 the actions pass APPENDED its LEX actions to the previous build's (`createActions`
// appends; nothing deleted). Every idea built more than once carries every build's actions under
// ACTIONS in `kernelText`, in the documents and in front of every marker — Angus's idea had twelve
// after three builds, v1's contaminated steps among them; `452c5ade` has forty. The pass now
// supersedes (build.ts, actions pass). This sweep does the same, once, for ideas built before that.
//
// ⚠ STAGED, GUARDED, REVERSIBLE, ONE COMMAND (memory: destructive steps). Dry run by default: it
// prints, per idea, what it would keep and what it would remove, and writes nothing. `--write`
// deletes only LEX-sourced rows OUTSIDE the latest build's own block (the last N rows by
// `orderIndex`, N = the latest build's ACTIONS pass count read off its pass log), re-reads every
// idea afterwards and prints the re-read. USER-sourced actions are never touched. Cost lines on
// removed rows cascade — they costed steps that no longer exist.
//
//   npx tsx --env-file=.env scripts/sweep-stale-lex-actions.ts            # dry run
//   npx tsx --env-file=.env scripts/sweep-stale-lex-actions.ts --write    # do it, then re-read
//   npx tsx --env-file=.env scripts/sweep-stale-lex-actions.ts --idea <id> [--write]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

const WRITE = process.argv.includes('--write')
const ONLY = process.argv[process.argv.indexOf('--idea') + 1]

function actionsWrittenBy(passes: unknown): number | null {
  if (!Array.isArray(passes)) return null
  const p = (passes as Array<{ key: string; output?: string }>).find((x) => x.key === 'ACTIONS')
  const m = /^(\d+) actions drafted/.exec(p?.output ?? '')
  return m ? parseInt(m[1], 10) : null
}

async function main() {
  console.log(`── sweep-stale-lex-actions — ${WRITE ? '⚠ WRITE' : 'dry run'} ──`)
  const latest = await prisma.ideaBuild.findMany({
    where: { status: 'DONE', ...(ONLY && process.argv.includes('--idea') ? { ideaId: ONLY } : {}) },
    orderBy: [{ ideaId: 'asc' }, { version: 'desc' }], distinct: ['ideaId'],
    select: { ideaId: true, version: true, passes: true, idea: { select: { title: true } } },
  })
  let totalRemove = 0
  const plan: Array<{ ideaId: string; remove: string[]; keep: number; title: string; version: number }> = []
  for (const b of latest) {
    const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: b.ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true, source: true, practicalStep: true } })
    const lex = rows.filter((r) => r.source === 'LEX')
    const n = actionsWrittenBy(b.passes)
    if (n == null) { console.log(`  ${b.ideaId.slice(0, 8)} v${b.version} — SKIPPED: the latest build's pass log names no action count (${lex.length} LEX rows left as they are)`); continue }
    if (lex.length <= n) continue
    const keep = new Set(lex.slice(-n).map((r) => r.id))
    const remove = lex.filter((r) => !keep.has(r.id))
    plan.push({ ideaId: b.ideaId, remove: remove.map((r) => r.id), keep: n, title: b.idea.title, version: b.version })
    totalRemove += remove.length
    console.log(`  ${b.ideaId.slice(0, 8)} v${b.version} "${b.idea.title.slice(0, 50)}" — ${lex.length} LEX rows, keep the latest build's ${n}, remove ${remove.length}`)
    for (const r of remove.slice(0, 3)) console.log(`      − ${r.practicalStep.slice(0, 100)}`)
    if (remove.length > 3) console.log(`      … and ${remove.length - 3} more`)
  }
  console.log(`\n${plan.length} idea(s), ${totalRemove} row(s) to remove.`)
  if (!WRITE) { console.log('Dry run — nothing written. Re-run with --write.'); return }

  for (const p of plan) {
    const res = await prisma.lexCoherentAction.deleteMany({ where: { id: { in: p.remove }, source: 'LEX' } })
    const after = await prisma.lexCoherentAction.count({ where: { ideaId: p.ideaId, source: 'LEX' } })
    console.log(`  ${p.ideaId.slice(0, 8)} — removed ${res.count}; re-read: ${after} LEX rows remain (expected ${p.keep})${after === p.keep ? '' : '  ⚠ MISMATCH'}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
