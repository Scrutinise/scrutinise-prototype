// ─────────────────────────────────────────────────────────────────────────────
// 25-U — REMOVE THE PROMPT'S OWN EXAMPLE FROM STORED RESEARCH GAPS.
//
// `deepening-client.ts` rule 5 used to illustrate itself with a sentence about plastic bags in
// waterways. A model copied it verbatim into its output for the CIVIL SERVICE ACCOUNTABILITY
// proposal, and it renders in the outward-facing report as a genuine gap in the research:
//
//     "No source quantifies how many bags enter waterways each year."
//
// The prompt is fixed, so this cannot recur. This removes the rows already written.
//
// ⚠⚠ PLAN BY DEFAULT, AND IT NEVER TOUCHES A PROPOSAL THE EXAMPLE IS ACTUALLY ABOUT. A gap about
// bags is a legitimate gap on the plastic-bag proposal, and deleting it there would be destroying
// real research to tidy up after ours. The guard is the idea's own subject, and it is applied per
// row rather than assumed.
//
// ⚠ IT REWRITES ONE JSON ARRAY, MINUS ONE ENTRY — it does not delete a row, and it re-reads and
// prints the stored value afterwards, because "deleted" is a claim about the database and not
// about the call that was made.
//
// Usage:
//   npx tsx --env-file=.env scripts/purge-leaked-prompt-examples.ts            (plan)
//   npx tsx --env-file=.env scripts/purge-leaked-prompt-examples.ts --write
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

const WRITE = process.argv.includes('--write')

/** The sentence the prompt supplied, in the forms a model might echo it. */
const LEAKED = /bags enter waterways/i
/** A proposal the example is genuinely about — never touched. */
const ON_TOPIC = /bag|plastic|litter|waterway|waste|packaging/i

async function main() {
  const rows = await prisma.deepeningPass.findMany({
    select: { id: true, ideaId: true, passKey: true, runVersion: true, knownUnknowns: true },
  })
  const titles = new Map(
    (await prisma.idea.findMany({ select: { id: true, title: true } })).map((i) => [i.id, i.title ?? '']),
  )

  let touched = 0
  for (const r of rows) {
    const arr = Array.isArray(r.knownUnknowns) ? (r.knownUnknowns as Array<Record<string, unknown>>) : []
    const bad = arr.filter((u) => typeof u?.question === 'string' && LEAKED.test(u.question))
    if (!bad.length) continue

    const title = titles.get(r.ideaId) ?? ''
    if (ON_TOPIC.test(title)) {
      console.log(`· KEEPING on "${title}" (${r.passKey}) — the example is genuinely about this proposal`)
      continue
    }

    console.log(`\n⚠ LEAK on "${title}" — ${r.passKey} runV=${r.runVersion}`)
    for (const b of bad) console.log(`    "${String(b.question)}"`)
    console.log(`    ${arr.length} unknowns → ${arr.length - bad.length} after removal`)
    touched++

    if (!WRITE) continue
    const kept = arr.filter((u) => !(typeof u?.question === 'string' && LEAKED.test(u.question)))
    await prisma.deepeningPass.update({
      where: { id: r.id }, data: { knownUnknowns: kept as never },
    })
    // ⚠ RE-READ. Not the intent — the stored value.
    const after = await prisma.deepeningPass.findUnique({
      where: { id: r.id }, select: { knownUnknowns: true },
    })
    const now = Array.isArray(after?.knownUnknowns) ? (after!.knownUnknowns as unknown[]) : []
    const stillThere = JSON.stringify(now).match(LEAKED)
    console.log(`    re-read: ${now.length} unknowns stored, leaked sentence ${stillThere ? 'STILL PRESENT ⚠' : 'gone'}`)
  }

  console.log(`\n${touched} row(s) ${WRITE ? 'rewritten' : 'would be rewritten'}.`)
  if (!WRITE && touched) console.log('Plan only. Nothing written. Re-run with --write.\n')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
