// ─────────────────────────────────────────────────────────────────────────────
// measure:26x-brief — the MEASURED price of "Ask Lex to write the Brief" (BRIEF_26X §5d: "free or a few pence, measured"). Real model
// calls, on a SCRATCH copy of 452c5ade (deleted after), writing nothing (prefillBrief write:false). Each run's pence and seconds are
// printed for PREFILL_RUNS in lib/lex/action-brief-pure.ts, with what the Brief came back holding — so a run that returned an empty or
// invented Brief is seen, not averaged in.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/measure-26x-brief.ts
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma'
import { prefillBrief } from '../lib/lex/action-brief'
import type { BriefKind } from '../lib/lex/action-brief-pure'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const RUNS: Array<{ number: number; kind: BriefKind; why: string }> = [
  { number: 207, kind: 'CODE_TEXT', why: 'the Code, 17,946 characters of Action details' },
  { number: 38, kind: 'DRAFT_CLAUSE', why: 'the legislative duty, long Action details, a drafting instruction' },
  { number: 101, kind: 'OPERATING_TEXT', why: 'organisational, with an Explanation' },
]

async function main() {
  const scratch = await scratchCopy('452c5ade', '26x-brief-measure')
  console.log(`scratch copy ${scratch.id}`)
  try {
    for (const r of RUNS) {
      const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: scratch.id, number: r.number, status: 'LIVE' }, select: { id: true, commentary: true } })
      if (!a) { console.log(`#${r.number}: NOT RUN — not live on the copy`); continue }
      const res = await prefillBrief(scratch.id, a.id, r.kind, scratch.userId, { write: false })
      if (!res.ok) { console.log(`#${r.number} ${r.kind}: FAILED — ${(res as { error: string }).error}`); continue }
      const b = res.data.brief
      console.log(`RUN #${r.number} ${r.kind} (${r.why}; details ${(a.commentary ?? '').length} chars): ${res.data.pence?.toFixed(2)}p, ${res.data.seconds}s — must ${b.must.length} chars, ${b.mustInclude.length} must-include, ${b.mustNot.length} must-not, tone ${b.tone ?? 'none'}, modelled on ${b.modelledOn ? JSON.stringify(b.modelledOn) : 'none'}, fields ${Object.keys(b.kind).join(',') || 'none'}`)
      console.log(`   reason: ${res.data.reason.slice(0, 300)}`)
      console.log(`   first point: ${(b.mustInclude[0] ?? '').slice(0, 160)}`)
    }
  } finally {
    console.log(`scratch deleted: ${await deleteScratch(scratch.id)}`)
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
