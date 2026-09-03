// ─────────────────────────────────────────────────────────────────────────────────────────
// check:lex-25y — a document the user uploaded must reach every pass of every build.
//
// CLAUDE.md §23, §25 (assert the data present in the output) and §26 (the cold read) apply.
//
// ⚠⚠ §1d IS A COLD READ AND IT HAS TO BE. The subject is the pilot proposal: four documents
// the user uploaded, 38 findings extracted at build v1, and nine builds since. This check
// creates none of it and touches none of it — it calls `buildHighlights`, which is the
// function the finished-build screen calls, for a build EIGHT VERSIONS LATER than the one that
// read the documents, and asks whether those findings are in the output. Before this sprint
// they were not, and no fixture could have shown that: the defect is entirely in the seam
// between a version-scoped read and a version-less fact.
//
// Usage: npm run check:lex-25y
// ─────────────────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { buildHighlights } from '../lib/lex/build-highlights'
import { evidenceForBuild, VERSIONLESS_SOURCE_TYPES } from '../lib/lex/evidence-scope'
import { frameQuery } from '../lib/lex/build-config'
import { elicitationContext } from '../lib/lex/elicitation'

const PILOT = '452c5ade-3153-400a-bf48-3b71aaa52773'
let passed = 0, failed = 0, dead = 0, controls = 0
const notChecked: string[] = []

function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
function control(label: string, holdsOnBroken: () => boolean) {
  controls++
  if (holdsOnBroken()) { dead++; console.log(`  ⚠ DEAD CONTROL — ${label}`) }
  else console.log(`  ✓ fired — ${label}`)
}
function skip(label: string, why: string) { notChecked.push(`${label} — ${why}`); console.log(`  · NOT CHECKED ${label} — ${why}`) }

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

async function main() {
  console.log('\n── check:lex-25y — the user\'s documents reach every build ──\n')

  // ══ §1e — the shape of the problem, measured on live rows ════════════════════════════
  console.log('§1e — how much was stranded')
  const docFindings = await prisma.evidenceItem.findMany({
    where: { ideaId: PILOT, sourceType: 'USER_DOCUMENT' },
    select: { id: true, runVersion: true, title: true, status: true },
  })
  const materials = await prisma.ideaUserMaterial.findMany({
    where: { ideaId: PILOT }, select: { label: true, findingCount: true, findingsAt: true },
  })
  const builds = await prisma.ideaBuild.findMany({
    where: { ideaId: PILOT }, select: { version: true }, orderBy: { version: 'desc' }, take: 1,
  })
  const latest = builds[0]?.version ?? 0
  const readAt = [...new Set(docFindings.map((f) => f.runVersion))]
  ok('the pilot idea has uploaded documents with findings',
    materials.length > 0 && docFindings.length > 0,
    `${materials.length} document(s), ${docFindings.length} finding(s)`)
  ok('and those findings are stamped at an EARLIER version than the latest build',
    readAt.length > 0 && Math.max(...readAt) < latest,
    `findings at v${readAt.join(',')} · latest build v${latest}`)

  // ══ §1c — the exemption, at the seam ═════════════════════════════════════════════════
  console.log('\n§1c — the read scope')
  const scope = evidenceForBuild(PILOT, latest)
  const reachable = await prisma.evidenceItem.count({ where: { ...scope, status: { not: 'REJECTED' } } })
  const versionOnly = await prisma.evidenceItem.count({
    where: { ideaId: PILOT, runVersion: latest, status: { not: 'REJECTED' } },
  })
  ok('§1c — the shared scope reaches MORE than the version-only filter did',
    reachable > versionOnly, `${reachable} vs ${versionOnly}`)
  const docsInScope = await prisma.evidenceItem.count({
    where: { ...scope, sourceType: 'USER_DOCUMENT' },
  })
  ok('§1c — and every user-document finding is inside it',
    docsInScope === docFindings.length, `${docsInScope} of ${docFindings.length}`)

  // ⚠ THE CONTROL PERFORMS THE OLD FILTER. The property is "a build at the latest version can
  // see the user's documents"; on `runVersion: latest` alone it cannot.
  control('the old version-only filter could not see them', () => {
    const oldScope = { ideaId: PILOT, runVersion: latest, sourceType: 'USER_DOCUMENT' }
    return oldScope.runVersion === Math.max(...readAt)
  })

  ok('§1c — only the user\'s own material is exempted, not everything Lex retrieved',
    VERSIONLESS_SOURCE_TYPES.length === 1 && VERSIONLESS_SOURCE_TYPES[0] === 'USER_DOCUMENT',
    VERSIONLESS_SOURCE_TYPES.join(','))

  // ⚠ Source-shaped and legitimately so: the property is that no read site RESTATES the rule.
  // A second copy of the predicate is a copy that will disagree (CLAUDE.md §25 rule 3).
  for (const f of ['lib/lex/build.ts', 'lib/lex/build-highlights.ts']) {
    const src = stripComments(code(f))
    ok(`§1c — ${f} imports the shared scope rather than restating it`,
      /evidenceForBuild\(/.test(src) && !/sourceType: 'USER_DOCUMENT'/.test(src))
  }

  // ══ §1d — END TO END, ON A BUILD EIGHT VERSIONS LATER. THE COLD READ. ═════════════════
  console.log(`\n§1d — a v${readAt[0]} document finding in the output of build v${latest}`)
  const highlights = await buildHighlights(PILOT, latest)
  const shown = [...highlights.leading, ...highlights.supporting, ...highlights.judgements]
  const fromDocs = shown.filter((h) => h.sourceType === 'USER_DOCUMENT')
  ok(`§1d — the finished-build screen for v${latest} carries the user's own document findings`,
    fromDocs.length > 0, `${fromDocs.length} of ${shown.length} shown`)
  if (fromDocs.length) {
    console.log(`      e.g. "${String(fromDocs[0].title ?? '').slice(0, 80)}"`)
    const ids = new Set(docFindings.map((d) => d.id))
    ok('§1d — and they are the SAME rows the extraction wrote, not lookalikes',
      fromDocs.every((h) => ids.has(h.id)))
  } else {
    skip('§1d the identity check', 'no document finding reached the output')
  }

  // ══ §1a/§1b — the build knows the documents exist, and says so truthfully ═════════════
  console.log('\n§1a/§1b — the prompt every pass receives')
  const ctx = await elicitationContext(PILOT, (await prisma.idea.findUnique({
    where: { id: PILOT }, select: { creatorId: true },
  }))!.creatorId)
  if (!ctx) skip('§1a', 'the pilot idea has no elicitation row')
  else {
    ok('§1a — the elicitation context now carries the uploaded documents',
      ctx.materials.length > 0, `${ctx.materials.length} document(s)`)
    ok('§1b — and `read` is the truth, not a hardcoded false',
      ctx.materials.some((m) => m.read),
      ctx.materials.map((m) => `${m.read ? 'read' : 'unread'}:${m.findingCount}`).join(' '))
    const framed = frameQuery('B_CONTEXTUALISED', ctx)
    ok('§1a — and every pass\'s prompt block names them',
      ctx.materials.every((m) => framed.promptBlock.includes(m.label)),
      `${ctx.materials.length} named`)
    ok('§1b — the prompt states findings were taken, rather than that nothing was read',
      /read, \d+ finding/.test(framed.promptBlock) && !/NOT YET READ/.test(framed.promptBlock))

    // ⚠ THE NAIVE ARM MUST NOT CARRY THEM. `A_NAIVE` is the control arm of the framing
    // experiment; leaking context into it would quietly end the experiment.
    const naive = frameQuery('A_NAIVE', ctx)
    control('the naive framing arm would have leaked the documents', () =>
      ctx.materials.some((m) => naive.promptBlock.includes(m.label)))
  }

  const elicit = stripComments(code('lib/lex/elicitation.ts'))
  ok('§1b — the literal `read: false` is gone from the context',
    !/read: false/.test(elicit))

  // ══ §2b — the merge bar ══════════════════════════════════════════════════════════════
  console.log('\n§2b — the merge prompt is at the duplicate prompt\'s bar')
  const classifier = stripComments(code('scripts/classify-stale-challenges-v2.ts'))
  ok('§2b — the merge prompt states the one-answer test',
    /Could ONE answer satisfy both of them completely/.test(classifier))
  ok('§2b — and names the two mistakes that were actually made',
    /SAME AREA OF LAW OR POLICY/.test(classifier) && /SAME KIND OF COMPLAINT/.test(classifier))

  // §2a — the loose merges were never applied. A live read, not a memory.
  const merged = await prisma.deepeningIssue.count({
    where: { ideaId: PILOT, relationKind: 'MERGED_INTO' },
  })
  const LOOSE_EIGHT = [
    'Amendments to Civil Service Commission powers', 'Legislative changes to NAO mandate',
    'Revision of civil service terms', 'Legal basis of new accountability board',
    'Legislative provisions for public reporting', 'Changes to Government Legal Department',
  ]
  const looseStillOpen = await prisma.deepeningIssue.count({
    where: { ideaId: PILOT, title: { in: LOOSE_EIGHT }, status: 'OPEN', relationKind: null },
  })
  ok('§2a — the six distinct objections the loose group would have collapsed are all still separate',
    looseStillOpen === LOOSE_EIGHT.length, `${looseStillOpen} of ${LOOSE_EIGHT.length} open and unmerged`)
  ok('§2a — only the approved seven merges were ever applied',
    merged === 11, `${merged} MERGED_INTO rows (7 groups, 11 members dropped)`)

  console.log(`\n── ${passed} passed, ${failed} failed, ${notChecked.length} NOT CHECKED, ` +
    `${controls} controls (${dead} dead) ──`)
  for (const n of notChecked) console.log(`  · NOT CHECKED: ${n}`)
  if (failed || dead) process.exitCode = 1
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
