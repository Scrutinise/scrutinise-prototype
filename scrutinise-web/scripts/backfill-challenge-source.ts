// ─────────────────────────────────────────────────────────────────────────────
// 25-Q §7 — MOVE THE ATTRIBUTION OUT OF THE SENTENCE ON CHALLENGES ALREADY WRITTEN.
//
// Every coverage challenge in the database begins with eleven words of its own provenance:
//
//   ANOTHER MODEL MADE THIS POINT AND OUR PROPOSAL DOES NOT ADDRESS IT — <the point> (<model>). <why>
//
// ⚠⚠ THIS IS A DETERMINISTIC BACKFILL BECAUSE THE FORMAT IS OURS. We wrote that template in
// `build.ts`; it is not model output and it does not vary. So the prefix can be stripped and the
// model lifted out of its brackets with no guessing at all — which is the only reason this is a
// backfill rather than a "leave the old rows alone".
//
// ⚠ AND IT DOES NOT INVENT TITLES. A title is a judgement about what a point is ABOUT, and 25-D
// §3's rule is that the producer tags it, never a downstream reader. Old rows therefore get their
// `sourceModel` and keep a null `title`, which renders as no title rather than as a guess.
// New runs get both. That asymmetry is reported rather than papered over.
//
// ⚠ DRY RUN BY DEFAULT. `--write` applies.
//
// Usage: npm run backfill:challenge-source [-- --write]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

const WRITE = process.argv.includes('--write')

/**
 * The template `build.ts` used to write. ⚠ ANCHORED AT THE START and case-sensitive: a challenge
 * whose own text happens to discuss another model must not be rewritten by this.
 */
const PREFIX = /^ANOTHER MODEL MADE THIS POINT AND OUR PROPOSAL DOES NOT ADDRESS IT\s*—\s*/
/** `(<model>).` immediately before the "why it matters" sentence. */
const NAMED_BY = /\s*\(([^()]{1,80})\)\.\s*/
/**
 * ⚠⚠ AND A SECOND PIECE OF NOISE, FOUND BY READING THE ROWS RATHER THAN THE CODE. A third of
 * these open `[16] (claude-sonnet-5) The proposer's own distinction…` — the panel answer's own
 * index and model name, carried into `point` by the model that copied the point "verbatim".
 * So the attribution was in the sentence TWICE and the point began with a bracket number.
 *
 * ⚠ ANCHORED AT THE START. A bracketed number anywhere else in a challenge is the user's or a
 * citation, and is none of this script's business.
 */
const POINT_INDEX = /^\s*\[\d{1,3}\]\s*(?:\(([^()]{1,80})\)\s*)?/

function split(text: string): { text: string; sourceModel: string | null } | null {
  if (!PREFIX.test(text)) return null
  let body = text.replace(PREFIX, '')

  // The trailing `(<model>).` the template wrote.
  let named: string | null = null
  const m = NAMED_BY.exec(body)
  if (m) {
    named = m[1].trim()
    body = (body.slice(0, m.index) + ' ' + body.slice(m.index + m[0].length))
  }

  // The leading `[16] (claude-sonnet-5)` the point arrived with. ⚠ Its model is used only if
  // the template's own was missing — the template's is the one we wrote and know the shape of.
  const idx = POINT_INDEX.exec(body)
  if (idx) {
    if (!named && idx[1]) named = idx[1].trim()
    body = body.slice(idx[0].length)
  }

  return { text: body.replace(/\s+/g, ' ').trim(), sourceModel: named }
}

async function main() {
  console.log(`\n── 25-Q §7 — challenge attribution ${WRITE ? '(WRITING)' : '(dry run)'} ──\n`)

  const rows = await prisma.deepeningIssue.findMany({
    where: { text: { startsWith: 'ANOTHER MODEL MADE THIS POINT' } },
    select: { id: true, text: true, sourceModel: true },
  })
  const total = await prisma.deepeningIssue.count()
  console.log(`${total} challenges in all; ${rows.length} carry the prefix.\n`)
  if (!rows.length) { console.log('Nothing to do.'); return }

  const planned = rows
    .map((r) => ({ id: r.id, ...(split(r.text) ?? {}) }))
    .filter((p): p is { id: string; text: string; sourceModel: string | null } => !!p.text)

  const named = planned.filter((p) => p.sourceModel).length
  console.log(`  ${planned.length} can be split; ${named} name a model, ${planned.length - named} do not.`)
  console.log('\n── two, before and after ──')
  for (const p of planned.slice(0, 2)) {
    const before = rows.find((r) => r.id === p.id)!.text
    console.log(`\n  before: ${before.slice(0, 150)}`)
    console.log(`  after:  ${p.text.slice(0, 190)}`)
    console.log(`  source: ${p.sourceModel ?? '(none named)'}`)
  }

  // ⚠ A CONTROL, RUN ON THE REAL DATA. A row without the prefix must come back untouched —
  // otherwise this script's own regex is the thing that needs checking, not the rows.
  const control = await prisma.deepeningIssue.findFirst({
    where: { NOT: { text: { startsWith: 'ANOTHER MODEL' } } },
    select: { text: true },
  })
  console.log(`\n  control — a challenge without the prefix is left alone: `
    + `${control ? (split(control.text) === null ? 'yes' : 'NO — THE REGEX IS TOO WIDE') : 'no such row to test'}`)

  if (!WRITE) { console.log('\nDry run. Nothing written. Re-run with --write.\n'); return }

  let wrote = 0
  for (const p of planned) {
    await prisma.deepeningIssue.update({
      where: { id: p.id },
      data: { text: p.text, sourceModel: p.sourceModel },
    })
    wrote++
  }
  // ⚠⚠ RE-READ AND REPORT THE RE-READ. "Updated" is a claim about a call.
  const left = await prisma.deepeningIssue.count({
    where: { text: { startsWith: 'ANOTHER MODEL MADE THIS POINT' } },
  })
  const withSource = await prisma.deepeningIssue.count({ where: { sourceModel: { not: null } } })
  console.log(`\nwrote ${wrote}.`)
  console.log(`re-read: ${left} still carry the prefix; ${withSource} now name their source in its own column.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
