export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §7 — RUN THE SPAWN PASS. Propose, show, then (only if asked) write.
//
// Charlie: *"Identifying things that need their own idea-project is a valid output from an
// idea. It's not an ever-flowing hierarchy."*
//
// ⚠⚠ PROPOSING AND WRITING ARE TWO COMMANDS, NOT ONE FLAG ON THE SAME COMMAND. Proposing is a
// model call; writing puts ideas into somebody's workspace. A person sees the first before the
// second happens, which is what "named and queued, not automatically worked" means at the
// point where it can actually be enforced.
//
//   npx tsx --env-file=.env scripts/b22-spawn.ts                      (propose, all twelve)
//   npx tsx --env-file=.env scripts/b22-spawn.ts --only M-01
//   npx tsx --env-file=.env scripts/b22-spawn.ts --only M-01 --write  (create the ideas)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { proposeSpawns, writeSpawns, refuseToSpawn, SPAWN_MAX } from '../lib/lex/spawn'
import type { SpawnCandidate } from '../lib/lex/spawn'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT = join(__dirname, '../../docs/report_run/SPAWNED_IDEAS.md')
const WRITE = process.argv.includes('--write')
const onlyArg = process.argv.indexOf('--only')
const ONLY = onlyArg > -1 ? process.argv[onlyArg + 1] : null
const ALL = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)

interface Row {
  ref: string; title: string; ideaId: string
  refusal: string | null
  candidates: SpawnCandidate[]
  cappedAt: number | null
  returned: number
  written: Array<{ id: string; title: string; reused: boolean }>
  /** ⚠ What is ALREADY queued under this measure, read from the database rather than from
   *  this run. A propose-only run would otherwise show nothing under a measure whose queue is
   *  full, which reads as "nothing needed" and is the opposite of true. */
  alreadyQueued: Array<{ id: string; title: string; question: string | null }>
  tokensIn: number; tokensOut: number
}

async function main() {
  const refs = ONLY ? [ONLY] : ALL
  const rows: Row[] = []
  console.log(`${refs.length} measure(s) · ${WRITE ? '⚠ WILL CREATE IDEAS' : 'propose only, nothing written'}\n`)

  for (const ref of refs) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true, creatorId: true } })
    if (!idea) continue

    const alreadyQueued = (await prisma.idea.findMany({
      where: { spawnedFromIdeaId: ideaId },
      select: { id: true, title: true, spawnedQuestion: true },
      orderBy: { spawnedAt: 'asc' },
    })).map((k) => ({ id: k.id, title: k.title, question: k.spawnedQuestion }))

    const refusal = await refuseToSpawn(ideaId)
    if (refusal) {
      rows.push({ ref, title: idea.title, ideaId, refusal, candidates: [], cappedAt: null, returned: 0, written: [], alreadyQueued, tokensIn: 0, tokensOut: 0 })
      console.log(`  ${ref}  REFUSED — ${refusal}`)
      continue
    }

    const usages: Array<{ tokensIn: number; tokensOut: number }> = []
    const p = await proposeSpawns({ ideaId, onUsage: (u) => usages.push(u) })
    const row: Row = {
      ref, title: idea.title, ideaId, refusal: null,
      candidates: p?.candidates ?? [], cappedAt: p?.cappedAt ?? null, returned: p?.returned ?? 0,
      written: [], alreadyQueued,
      tokensIn: usages.reduce((a, b) => a + (b.tokensIn ?? 0), 0),
      tokensOut: usages.reduce((a, b) => a + (b.tokensOut ?? 0), 0),
    }
    if (!p) console.log(`  ${ref}  ⚠ the pass did not complete`)
    else console.log(`  ${ref}  ${p.candidates.length} candidate(s)${p.cappedAt ? ` ⚠ capped at ${p.cappedAt} of ${p.returned}` : ''}`)
    for (const c of row.candidates) console.log(`        · ${c.title}`)

    if (WRITE && row.candidates.length) try {
      // ⚠ `--extend` is deliberate and separate from `--write`, because the pass is not
      // deterministic: a second run names different questions, so re-writing lengthens the
      // queue instead of reproducing it.
      row.written = await writeSpawns(ideaId, idea.creatorId, row.candidates, 'SPAWN',
        process.argv.includes('--extend'))
      const made = row.written.filter((w) => !w.reused).length
      console.log(`        → ${made} created, ${row.written.length - made} already existed`)
    } catch (e) {
      // A refusal is a result, not a crash, and the other measures still run.
      row.refusal = (e as Error).message.replace(/^refusing to spawn: /, '')
      console.log(`        ⚠ not written — ${row.refusal}`)
    }
    rows.push(row)
  }

  // ══ THE PROOF THAT IT TERMINATES, RUN RATHER THAN ASSERTED ═══════════════════════════
  //
  // ⚠ A guard nobody watched fail is not a guard. If anything was written, the first child is
  // asked to spawn and MUST refuse — on the row, not on a prompt.
  let terminationProof = 'not exercised — nothing was written on this run'
  const firstChild = rows.flatMap((r) => r.written).find((w) => !w.reused)
  if (firstChild) {
    const r = await refuseToSpawn(firstChild.id)
    terminationProof = r
      ? `✔ asked \`${firstChild.title}\` to spawn and it refused: "${r}"`
      : '⚠⚠ A SPAWNED IDEA WAS ALLOWED TO SPAWN — the depth cap is not working'
    console.log(`\n  termination: ${terminationProof}`)
  }

  const L: string[] = []
  L.push('# The questions these proposals cannot settle')
  L.push('')
  L.push(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.*`)
  L.push('')
  L.push('> **"Identifying things that need their own idea-project is a valid output from an idea.**')
  L.push('> **It\'s not an ever-flowing hierarchy."** — Charlie')
  L.push('')
  L.push('Each entry is a question the measure above it **cannot answer within itself** — not a task,')
  L.push('not a risk, not a research errand, but something needing its own diagnosis, its own evidence')
  L.push('and its own decision.')
  L.push('')
  L.push('⚠ **A spawned idea is named and queued. It is not built, and nothing enqueues it.** It sits')
  L.push('at stage 1 carrying its question, waiting for a person to pick it up.')
  L.push('')
  L.push(`⚠ **It terminates, and on the row rather than in a prompt.** A spawned idea has`)
  L.push('`spawnedFromIdeaId` set, and the guard refuses to spawn from any row that does — so depth is')
  L.push('capped at one by construction. On this run: ' + terminationProof)
  L.push('')
  L.push(`⚠ \`SPAWN_MAX\` is ${SPAWN_MAX}, and it is a safety valve rather than a selection rule. Where it`)
  L.push('bit, the entry says so.')
  L.push('')
  L.push('| Measure | Questions | Written |')
  L.push('|---|---|---|')
  for (const r of rows) {
    L.push(`| ${r.ref} — ${r.title.replace(/\|/g, '\\|')} | ${r.refusal ? `⚠ refused: ${r.refusal}` : r.candidates.length} `
      + `| ${r.written.length ? `${r.written.filter((w) => !w.reused).length} new` : '—'} |`)
  }
  L.push('')
  L.push('---')
  L.push('')
  for (const r of rows) {
    L.push(`## ${r.ref} — ${r.title}`)
    L.push('')
    if (r.alreadyQueued.length) {
      L.push(`### Already queued — ${r.alreadyQueued.length}`)
      L.push('')
      L.push('These exist as ideas, at stage 1, unbuilt.')
      L.push('')
      for (const q of r.alreadyQueued) {
        L.push(`- **${q.title.replace(/\|/g, '\|')}** — ${(q.question ?? '').replace(/\s+/g, ' ')}  \`${q.id}\``)
      }
      L.push('')
    }
    if (r.refusal) {
      L.push(`⚠ **Not written this run:** ${r.refusal}`)
      L.push('')
      if (r.candidates.length) {
        L.push('⚠⚠ **And what it proposed this time is not what it proposed last time.** The four below')
        L.push('are from this run; the queue above is from the last one. That difference is the reason')
        L.push('the guard exists — re-writing would lengthen the queue rather than reproduce it, and')
        L.push('every addition would look like a finding.')
        L.push('')
        for (const c of r.candidates) L.push(`- *${c.title.replace(/\|/g, '\|')}*`)
        L.push('')
      }
      continue
    }
    if (!r.candidates.length) {
      L.push('**No questions that need their own proposal.** ⚠ That is a real and respectable answer —')
      L.push('most proposals do not fragment, and a list padded to look thorough turns a work programme')
      L.push('into a backlog nobody trusts.')
      L.push('')
      continue
    }
    if (r.cappedAt) {
      L.push(`⚠⚠ **Capped: showing ${r.cappedAt} of ${r.returned} returned.** The rest are not absent;`)
      L.push('they are below a bound on one pass.')
      L.push('')
    }
    r.candidates.forEach((c, i) => {
      const w = r.written[i]
      L.push(`### ${i + 1}. ${c.title}${w ? (w.reused ? '  ·  *already queued*' : '  ·  **queued**') : ''}`)
      L.push('')
      L.push(`**${c.question}**`)
      L.push('')
      L.push(`*Why it cannot be settled inside ${r.ref}:* ${c.whyNotHere}`)
      L.push('')
      if (w) L.push(`\`${w.id}\``)
      L.push('')
    })
    L.push(`*${r.tokensIn} tokens in / ${r.tokensOut} out.*`)
    L.push('')
    L.push('---')
    L.push('')
  }

  mkdirSync(join(__dirname, '../../docs/report_run'), { recursive: true })
  writeFileSync(OUT, L.join('\n'), 'utf8')
  console.log(`\nwritten: ${OUT}`)
  if (!WRITE) console.log('⚠ PROPOSED ONLY — no ideas were created. Re-run with --write.')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
