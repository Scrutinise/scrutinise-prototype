// ─────────────────────────────────────────────────────────────────────────────
// 25-M §3 — WHAT THE RIGHT-HAND PANEL CAN SHOW, AGAINST WHAT THE SNAPSHOT CARRIES.
//
// ⚠ THE SNAPSHOT IS THE ONLY THING THE DOCUMENTS READ (20-B §1), and that seam is what has
// kept the document stack stable through six sprints of change underneath it. So a section
// the panel can show and the snapshot cannot carry is a section that CANNOT appear in a
// document, however the renderer is written — and the gap is invisible from the renderer's
// side, because there is nothing there to be missing.
//
// ⚠ IT COMPARES VOCABULARIES, NOT ONE IDEA'S DATA. Auditing against a single idea would
// report "no statutory consequences" for an idea that simply has none, and call a full
// pipeline a gap. The question is whether the snapshot has a PLACE for each heading, which
// is a question about types and about the assembler, not about rows.
//
// Read-only. No model call, no writes.
//
//   tsx --env-file=.env scripts/audit-25m-snapshot.ts [ideaId]
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { QUESTION_HEADINGS, type HeadingKey } from '../lib/lex/question-headings'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'

const SNAPSHOT_SRC = readFileSync(join(process.cwd(), 'lib/documents/proposal-snapshot.ts'), 'utf8')

/**
 * Where each panel heading's material would have to live in the snapshot.
 *
 * ⚠ `null` MEANS "NOWHERE", and that is the finding this audit exists to produce. It is
 * written down per heading rather than inferred, because inferring it would mean guessing
 * what a renderer might do with `evidence[]`, and the whole point is to be exact about which
 * sections a document can and cannot contain today.
 */
const CARRIER: Record<HeadingKey, { field: string | null; note: string }> = {
  LAW_NOW: { field: 'sources + evidence', note: 'retrieved refs and findings' },
  REFERS_TO_THIS: { field: 'evidence', note: 'statutory-consequences rows are EvidenceItems' },
  COURTS: { field: 'evidence', note: '' },
  TRIED_BEFORE: { field: 'evidence', note: '' },
  ELSEWHERE: { field: 'evidence', note: '' },
  ARGUED: { field: 'evidence', note: '' },
  POSITIONS: { field: null, note: 'no producer writes evidence here; 25-L put the beta review UI on it' },
  NUMBERS: { field: 'evidence', note: '' },
  DEVOLVED: { field: 'evidence', note: '' },
  AGAINST: { field: 'evidence', note: '' },
  HOW_HARD: { field: 'evidence', note: 'the smart pass prognosis, re-filed by 25-L' },
  KEY_SOURCES: { field: 'evidence', note: 'the critique’s reading list' },
  YOUR_MATERIAL: { field: 'evidence', note: 'material findings carry passKey material:<id>' },
}

async function main() {
  console.log('── 25-M §3 — snapshot coverage audit ──\n')

  // ── 1. Does the snapshot carry evidence AT ALL, and does it keep the heading? ──
  //
  // ⚠⚠ THIS IS THE QUESTION THAT DECIDES EVERYTHING BELOW. If `SnapshotEvidence` drops
  // `headingKey`, then every heading above that says "evidence" is a heading whose material
  // reaches the document as an undifferentiated list — present, but impossible to render
  // under §2b's named sections.
  const carriesHeading = /headingKey/.test(SNAPSHOT_SRC)
  console.log(`snapshot carries a heading on each evidence row : ${carriesHeading ? 'YES' : 'NO  ⚠ GAP'}`)

  for (const f of ['prioritySources', 'excludedSources', 'knownUnknowns', 'userKnowledge', 'issues']) {
    console.log(`snapshot carries ${f.padEnd(32)}: ${new RegExp(`\\b${f}\\b`).test(SNAPSHOT_SRC) ? 'YES' : 'NO  ⚠ GAP'}`)
  }

  console.log('\nheading → where it would live in the snapshot:')
  const gaps: string[] = []
  for (const h of QUESTION_HEADINGS) {
    const c = CARRIER[h.key]
    const where = c.field ?? 'NOWHERE  ⚠'
    if (!c.field) gaps.push(h.key)
    console.log(`  ${h.key.padEnd(16)} ${where.padEnd(22)} ${c.note}`)
  }

  // ── 2. What a real idea's snapshot actually contains ──────────────────────
  const ideaArg = process.argv[2]
  const idea = ideaArg
    ? await prisma.idea.findFirst({ where: { id: { startsWith: ideaArg } }, select: { id: true } })
    : await prisma.ideaBuild.findFirst({
        where: { status: 'DONE' }, orderBy: { completedAt: 'desc' },
        select: { idea: { select: { id: true } } },
      }).then((r) => r?.idea ?? null)

  if (!idea) { console.log('\n(no built idea to sample)'); return }

  const snap = await buildProposalSnapshot(idea.id)
  console.log(`\nreal snapshot for ${idea.id.slice(0, 8)}:`)
  console.log(`  fields ${snap.fields.length} · causes ${snap.causes.length} · actions ${snap.actions.length}`)
  console.log(`  evidence ${snap.evidence.length} · issues ${snap.issues.length} · knownUnknowns ${snap.knownUnknowns.length}`)
  console.log(`  sources ${snap.sources.reduce((n, g) => n + g.refs.length, 0)} in ${snap.sources.length} groups`
    + ` · priority ${snap.prioritySources?.length ?? 'ABSENT'} · excluded ${snap.excludedSources.length}`)

  // ⚠ THE ONE THAT MATTERS FOR §2b: can the document tell one heading from another?
  const byHeading = new Map<string, number>()
  for (const e of snap.evidence as Array<{ headingKey?: string | null }>) {
    const k = e.headingKey ?? '(none)'
    byHeading.set(k, (byHeading.get(k) ?? 0) + 1)
  }
  console.log('\n  evidence by heading, as the snapshot hands it to a renderer:')
  if (!byHeading.size) console.log('    (no evidence on this idea)')
  for (const [k, n] of [...byHeading.entries()].sort()) console.log(`    ${k.padEnd(16)} ${n}`)

  console.log(`\nGAPS: ${gaps.length ? gaps.join(', ') : 'none — every heading has a carrier'}`)
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
