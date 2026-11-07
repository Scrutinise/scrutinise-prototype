// ─────────────────────────────────────────────────────────────────────────────
// 26-X X2 §5e — THE #207 MIGRATION, AS A PROPOSAL. Charlie's text at the head of #207's Action details ("THE ITEMS THE ACCOUNTABILITY AND
// DELIVERY CODE MUST CARRY …") is a Brief, not an explanation. This proposes the split — which paragraphs go to the Brief, which stay as
// the Action details — as ONE proposal on both fields (a BRIEF_PROPOSAL carrying the Action details as they would then stand). NOTHING MOVES
// until Charlie uses it on the screen ("Accept the split"); acceptance writes a FieldRevision with the old Action details.
//
// The split is by the text's OWN structure, never by paraphrase:
//   must        — the heading, the three decisions under it and the "The Accountability and Delivery Code" line, word for word
//   mustInclude — items 1–15, one point each, word for word (an item keeps its lettered parts: 8a–8k, 12.a–12.i); the "N." is the point's number
//   stays       — from "Issues" to the end: the issue, the open point, and PART TWO (A–H, which Charlie marked "CHECK")
//   left for Charlie — tone, modelled on, and the code's own fields (issued by, laid before, applies to, revision rule): Part Two B1/B2/A1
//                 hold them but stay in the Action details, so copying them would put one sentence in two places
// A LOSSLESS assertion runs before anything is written: every non-empty line of the details is in the Brief or in what stays, verbatim.
// Also: the instrumentLike sweep of 452c5ade's live actions (§5e's last line), reported.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/propose-26x-207-split.ts            (dry run: prints, writes nothing)
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/propose-26x-207-split.ts --apply    (writes the one proposal)
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma'
import { briefView, writeBriefProposal } from '../lib/lex/action-brief'
import { briefBody, parseBrief, type Brief } from '../lib/lex/action-brief-pure'
import { instrumentLike } from '../lib/lex/document-drafting-pure'

const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'
const APPLY = process.argv.includes('--apply')

export function splitDetails(detail: string): { brief: Brief; stays: string; problems: string[] } {
  const text = detail.replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  const problems: string[] = []
  const head = lines.findIndex((l) => /^THE ITEMS THE ACCOUNTABILITY AND DELIVERY CODE MUST CARRY\s*$/.test(l.trim()))
  const issues = lines.findIndex((l, i) => i > head && /^Issues\s*$/.test(l.trim()))
  const codeLine = lines.findIndex((l, i) => i > head && /^The Accountability and Delivery Code\s*$/.test(l.trim()))
  if (head !== 0) problems.push(`the details do not open with the items heading (found at line ${head + 1})`)
  if (issues < 0) problems.push('no "Issues" line to split at')
  if (codeLine < 0 || codeLine > issues) problems.push('no "The Accountability and Delivery Code" line before "Issues"')
  if (problems.length) return { brief: parseBrief('CODE_TEXT', {}), stays: text, problems }
  const must = lines.slice(head, codeLine + 1).join('\n').trim()
  // items: a top-level "N.<tab>" line starts one; everything until the next top-level line belongs to it (its lettered parts too)
  const body = lines.slice(codeLine + 1, issues)
  const items: string[] = []
  for (const l of body) {
    const m = /^(\d{1,2})\.\t(.*)$/.exec(l)
    if (m) items.push(m[2])
    else if (items.length) items[items.length - 1] += `\n${l}`
    else if (l.trim()) problems.push(`a line before item 1 would be lost: “${l.slice(0, 60)}”`)
  }
  const mustInclude = items.map((s) => s.replace(/\n{3,}/g, '\n\n').trim())
  const stays = lines.slice(issues).join('\n').trim()
  return { brief: parseBrief('CODE_TEXT', { must, mustInclude, mustNot: [], tone: null, modelledOn: null, kind: {} }), stays, problems }
}

/** Every non-empty line of the original, in the Brief or in what stays, word for word (a top-level item's "N." is its point number). */
export function lossless(detail: string, brief: Brief, stays: string): string[] {
  const keptText = [brief.must, ...brief.mustInclude, stays].join('\n')
  const kept = new Set(keptText.split('\n').map((l) => l.trim()).filter(Boolean))
  return detail.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => l.replace(/^\d{1,2}\.\t?\s*/, (p) => (/^\d{1,2}\.\t/.test(p) ? '' : p)).trim() || l)
    .filter((l) => !kept.has(l) && !kept.has(l.replace(/^\d{1,2}\.\s+/, '')))
}

async function main() {
  const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: IDEA, number: 207, status: 'LIVE' }, select: { id: true, commentary: true } })
  if (!a?.commentary) throw new Error('#207 is not live, or has no Action details')
  const { brief, stays, problems } = splitDetails(a.commentary)
  if (problems.length) throw new Error(`split not made: ${problems.join('; ')}`)
  const lost = lossless(a.commentary, brief, stays)
  console.log(`#207 Action details: ${a.commentary.length} characters`)
  console.log(`  → Brief: must ${brief.must.length} chars; ${brief.mustInclude.length} Must include points (${brief.mustInclude.map((p) => p.length).join(', ')} chars)`)
  console.log(`  → stays as the Action details: ${stays.length} chars, from “${stays.split('\n')[0]}”`)
  console.log(`  LOSSLESS: ${lost.length === 0 ? 'every non-empty line is kept, word for word' : `${lost.length} line(s) would be LOST: ${lost.slice(0, 5).map((l) => `“${l.slice(0, 50)}”`).join('; ')}`}`)
  if (lost.length) throw new Error('not lossless — nothing written')
  const view = await briefView(IDEA, a.id)
  if (!view.ok) throw new Error((view as { error: string }).error)
  const kinds = view.data.kinds.map((k) => k.kind)
  console.log(`  #207's draft kinds: ${kinds.join(', ') || 'none'}`)
  if (!kinds.includes('CODE_TEXT')) throw new Error('#207 does not need a code text, so a code text Brief would not be its draft — nothing written')
  const k = view.data.kinds.find((x) => x.kind === 'CODE_TEXT')!
  if (k.proposal?.split) { console.log(`  a proposed split is ALREADY waiting (proposal ${k.proposal.v}) — not written again`); return sweep() }
  console.log('\n----- the Brief as proposed -----\n' + briefBody('CODE_TEXT', brief).slice(0, 1500) + '\n…')
  if (APPLY) {
    const reason = 'The proposed split of #207’s Action details (BRIEF_26X §5e), made by the build from the text’s own structure — not by a Lex model call, and nothing reworded. '
      + 'The heading and the three decisions under it become “What this draft must do”; items 1–15 become the 15 “Must include” points, each with its lettered parts. '
      + 'The Issues, the open point and Part Two (A–H, marked “CHECK”) stay as the Action details. Tone, “Modelled on” and the code’s own fields (issued by, laid before, applies to, revision rule) are left for you: Part Two B1, B2 and A1 hold them, and they stay in the Action details. Using it moves the text; the old Action details are kept in the history.'
    const w = await writeBriefProposal(IDEA, a.id, 'CODE_TEXT', brief, { reason, pence: 0, split: { detailAfter: stays, from: a.commentary } })
    if (!w.ok) throw new Error((w as { error: string }).error)
    // read back (§20): the proposal row, as stored
    const row = await prisma.actionDocumentVersion.findFirst({ where: { documentId: w.data.documentId, role: 'BRIEF_PROPOSAL', v: w.data.v } })
    const back = parseBrief('CODE_TEXT', row?.payload)
    const split = (row?.payload as { split?: { detailAfter?: string; fromChars?: number } } | null)?.split
    console.log(`\nWRITTEN ${w.data.d} BRIEF_PROPOSAL v${w.data.v}; READ BACK: answer=${row?.answer ?? 'waiting'}, ${back.mustInclude.length} points, must ${back.must.length} chars, stays ${split?.detailAfter?.length} chars, cut from ${split?.fromChars} chars`)
    const now = await prisma.lexCoherentAction.findUnique({ where: { id: a.id }, select: { commentary: true } })
    console.log(`  #207's Action details UNCHANGED: ${now?.commentary === a.commentary} (${now?.commentary?.length} chars)`)
  } else console.log('\n(dry run — nothing written; --apply writes the proposal)')
  await sweep()
}

/** §5e's last line: every live action on 452c5ade whose Action details read as an instrument. */
async function sweep() {
  const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: IDEA, status: 'LIVE' }, select: { number: true, commentary: true }, orderBy: { number: 'asc' } })
  const hits = rows.filter((r) => instrumentLike(r.commentary ?? '').yes)
  console.log(`\nSWEEP: ${rows.length} live actions on 452c5ade; instrument-like Action details: ${hits.length} — ${hits.map((r) => `#${r.number} (${instrumentLike(r.commentary ?? '').provisions} provisions, ${(r.commentary ?? '').length} chars)`).join(', ') || 'none'}`)
}

if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
