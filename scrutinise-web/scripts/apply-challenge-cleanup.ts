import { prisma } from '../lib/prisma'
import { readFileSync } from 'fs'

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-X §3 — APPLY THE CLASSIFICATION. ARCHIVE, NEVER DELETE.
//
// It reads `docs/25X_CHALLENGE_PLAN.json` — the artefact the classifier wrote and the report
// was generated from — so what is applied is exactly what was reported and read. A second
// model run here could disagree with the report Charlie approved, which would make the report
// a description of a decision nobody took.
//
// ⚠⚠ NOTHING IS DELETED. Every retired criticism becomes DISMISSED with a stated reason and
// stays on screen under previous drafts. A dismissal without a reason is an unaccountable
// veto, so every write below carries one, and every duplicate names the challenge it
// duplicates rather than merely asserting that one exists.
//
// Usage:
//   npx tsx --env-file=.env scripts/apply-challenge-cleanup.ts            (plan, writes nothing)
//   npx tsx --env-file=.env scripts/apply-challenge-cleanup.ts --write
// ─────────────────────────────────────────────────────────────────────────────────────────

const WRITE = process.argv.includes('--write')
const PLAN = '../docs/25X_CHALLENGE_PLAN.json'

/**
 * ══ ⚠⚠ THE SEVEN MERGE GROUPS CHARLIE APPROVED — NOT THE NINE THIS SPRINT FOUND ══════════
 *
 * §3d says "apply the 7 merge groups", and the seven are the ones in
 * `docs/25W_CHALLENGE_CLASSIFICATION.md`, which he read. This sprint's re-run produced NINE,
 * and two of them are the exact failure §3a exists to prevent — arriving in the merge pass
 * rather than the duplicate pass, which is why tightening one prompt did not catch it:
 *
 *   · it merged C1–C8 under "these all require legislative changes". Those are objections
 *     about the Constitutional Reform Act, the Civil Service Commission, the NAO's mandate,
 *     civil service terms, a new board's legal basis, public reporting and the Government
 *     Legal Department. Same TOPIC — seven different objections, about seven different
 *     bodies. Merging them retires six real criticisms.
 *   · it merged C13–C17 under "these all want more evidence", which is a description of what
 *     a criticism IS, not a shared point.
 *
 * ⚠ It also dropped 25-W's C25+C30 pair and found two new ones (C43+C45, C44+C47) that look
 * sound but are not approved. All of that is reported to Charlie; NONE of it is applied.
 *
 * ⚠ THE NUMBERS ARE POSITIONS IN THE CURRENT SET, ordered exactly as both classifiers ordered
 * it — `runVersion` desc-max, then `createdAt` asc. Verified stable across the two runs: every
 * title the second run printed for C24, C26, C27, C28, C31–C36, C38–C41 matches the first's.
 * The script re-derives the order and PRINTS the titles it resolved, so a drift is visible
 * rather than silently merging the wrong rows.
 */
const APPROVED_MERGE_GROUPS: Array<{ members: number[]; reason: string }> = [
  { members: [1, 2], reason: 'Both ask how new statutory duties sit with the existing constitutional framework.' },
  { members: [24, 26], reason: 'Both say responsibility without matching authority and resources is unworkable.' },
  { members: [25, 30], reason: 'Both argue primary legislation is the wrong instrument for civil service reform.' },
  { members: [27, 36], reason: 'Both say the actions are repetitive and are not a sequenced plan.' },
  { members: [28, 33, 34, 41], reason: 'All four say no guiding policy is stated — it rules nothing out and is a goal, not an approach.' },
  { members: [31, 32, 35, 40], reason: 'All four say no pivotal obstacle is named, so the diagnosis inventories rather than simplifies.' },
  { members: [38, 39], reason: 'Both say the named cause is circular or an unsupported assertion about human nature.' },
]

type Verdict = 'DUPLICATE' | 'POSSIBLY_DUPLICATE' | 'APPLICABLE' | 'SUPERSEDED' | 'ASSESSMENT' | 'UNDECIDED'
type Plan = {
  ideaId: string
  currentVersion: number
  verdicts: Array<{ id: string; runVersion: number; title: string | null; verdict: Verdict; reason: string; duplicateOf: string | null }>
}

const one = (t: string | null | undefined, n = 90) => {
  const s = (t ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n)}…` : s
}

async function main() {
  const plan = JSON.parse(readFileSync(PLAN, 'utf8')) as Plan
  if (!plan.ideaId) { console.error(`${PLAN} has no plan in it — run the classifier first.`); process.exit(1) }
  const { ideaId, currentVersion } = plan

  const rows = await prisma.deepeningIssue.findMany({
    where: { ideaId },
    select: { id: true, runVersion: true, title: true, text: true, status: true, createdAt: true },
    orderBy: [{ runVersion: 'asc' }, { createdAt: 'asc' }],
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const current = rows.filter((r) => r.runVersion === currentVersion)

  // ── the writes, assembled first and printed before anything happens ──────────────────
  const promote: string[] = []
  const archive: Array<{ id: string; reason: string; relatedId: string | null; kind: string | null }> = []
  const mark: Array<{ id: string; relatedId: string }> = []
  const untouched: Array<{ id: string; why: string }> = []

  for (const v of plan.verdicts) {
    const row = byId.get(v.id)
    if (!row) continue
    const raised = `(Raised against draft ${v.runVersion}.)`
    switch (v.verdict) {
      case 'APPLICABLE':
        promote.push(v.id)
        break
      case 'DUPLICATE': {
        const dup = v.duplicateOf ? byId.get(v.duplicateOf) : null
        // ⚠ A duplicate with nothing to point at is not archived. The reason would be
        // "this is already covered" with no way for a reader to check the claim.
        if (!dup) { untouched.push({ id: v.id, why: 'called a duplicate but named no current challenge' }); break }
        archive.push({
          id: v.id, relatedId: dup.id, kind: 'DUPLICATE',
          reason: `Already made against the current draft by "${one(dup.title ?? dup.text, 80)}". ${raised}`,
        })
        break
      }
      case 'POSSIBLY_DUPLICATE': {
        const dup = v.duplicateOf ? byId.get(v.duplicateOf) : null
        if (!dup) { untouched.push({ id: v.id, why: 'possible duplicate naming no current challenge' }); break }
        mark.push({ id: v.id, relatedId: dup.id })
        break
      }
      case 'SUPERSEDED':
        archive.push({
          id: v.id, relatedId: null, kind: null,
          reason: `The proposal no longer contains what this objected to — ${one(v.reason, 150)} ${raised}`,
        })
        break
      case 'ASSESSMENT':
        untouched.push({ id: v.id, why: '§3c — an assessment, not a criticism; never archived as one' })
        break
      default:
        untouched.push({ id: v.id, why: 'undecided — left exactly as it is' })
    }
  }

  // ── merges, resolved against the live order and printed by title ─────────────────────
  const merges: Array<{ keep: string; keepTitle: string; drop: Array<{ id: string; title: string }>; reason: string }> = []
  for (const g of APPROVED_MERGE_GROUPS) {
    const members = g.members.map((n) => current[n - 1]).filter(Boolean)
    if (members.length !== g.members.length) {
      console.error(`⚠ merge group [${g.members.join(',')}] does not resolve — the current set has ${current.length} rows. SKIPPED.`)
      continue
    }
    const [keep, ...drop] = members
    merges.push({
      keep: keep.id, keepTitle: one(keep.title ?? keep.text),
      drop: drop.map((d) => ({ id: d.id, title: one(d.title ?? d.text) })),
      reason: g.reason,
    })
  }

  console.log(`\nidea ${ideaId} — current build v${currentVersion} (${current.length} challenges), ${rows.length} total`)
  console.log(`\n── what would be written ──`)
  console.log(`  promote into the current set        : ${promote.length}`)
  console.log(`  archive as DUPLICATE                : ${archive.filter((a) => a.kind === 'DUPLICATE').length}`)
  console.log(`  archive as SUPERSEDED               : ${archive.filter((a) => a.kind === null).length}`)
  console.log(`  mark POSSIBLY DUPLICATE (kept open) : ${mark.length}`)
  console.log(`  merge groups                        : ${merges.length}, dropping ${merges.reduce((a, m) => a + m.drop.length, 0)}`)
  console.log(`  left untouched                      : ${untouched.length}`)

  console.log(`\n── the merge groups, resolved by title (check these) ──`)
  for (const m of merges) {
    console.log(`  KEEP  ${m.keepTitle}`)
    for (const d of m.drop) console.log(`   ↳ merge ${d.title}`)
  }

  if (!WRITE) { console.log('\n(plan only — pass --write)'); return }

  // ── write ────────────────────────────────────────────────────────────────────────────
  let promoted = 0, archived = 0, marked = 0, mergedIn = 0

  for (const id of promote) {
    const n = await prisma.deepeningIssue.updateMany({
      // ⚠ Guarded on OPEN. A challenge the user has since addressed or dismissed themselves
      // must not be dragged back into the current set by a batch job.
      where: { id, status: 'OPEN' },
      data: { promotedToVersion: currentVersion },
    })
    promoted += n.count
  }
  for (const a of archive) {
    const n = await prisma.deepeningIssue.updateMany({
      where: { id: a.id, status: 'OPEN' },
      data: { status: 'DISMISSED', dismissReason: a.reason, relatedIssueId: a.relatedId, relationKind: a.kind },
    })
    archived += n.count
  }
  for (const m of mark) {
    const n = await prisma.deepeningIssue.updateMany({
      where: { id: m.id, status: 'OPEN' },
      // ⚠ STATUS UNCHANGED. §3b's whole point: a close call stays visible and is marked.
      data: { relatedIssueId: m.relatedId, relationKind: 'POSSIBLY_DUPLICATE' },
    })
    marked += n.count
  }
  for (const m of merges) {
    for (const d of m.drop) {
      const n = await prisma.deepeningIssue.updateMany({
        where: { id: d.id, status: 'OPEN' },
        data: {
          status: 'DISMISSED', relatedIssueId: m.keep, relationKind: 'MERGED_INTO',
          dismissReason: `Merged into "${m.keepTitle}" — ${m.reason}`,
        },
      })
      mergedIn += n.count
    }
  }

  // ⚠ RE-READ AND REPORT THE RE-READ, not the counts the writes returned.
  const after = await prisma.deepeningIssue.findMany({
    where: { ideaId },
    select: { runVersion: true, promotedToVersion: true, status: true, relationKind: true },
  })
  const inCurrent = after.filter((r) => r.runVersion === currentVersion || r.promotedToVersion === currentVersion)
  console.log(`\n── written ──`)
  console.log(`  promoted ${promoted} · archived ${archived} · marked ${marked} · merged ${mergedIn}`)
  console.log(`\n── re-read from the database ──`)
  console.log(`  ${after.length} challenges total, ${after.filter((r) => r.status === 'OPEN').length} open`)
  console.log(`  current set (this build + promoted) : ${inCurrent.length}, of which ${inCurrent.filter((r) => r.status === 'OPEN').length} open`)
  console.log(`  DISMISSED, still on screen under previous drafts: ${after.filter((r) => r.status === 'DISMISSED').length}`)
  console.log(`  marked POSSIBLY_DUPLICATE and still open        : ${after.filter((r) => r.relationKind === 'POSSIBLY_DUPLICATE' && r.status === 'OPEN').length}`)
  console.log(`\n  ⚠ nothing was deleted: ${after.length} rows before and after.`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
