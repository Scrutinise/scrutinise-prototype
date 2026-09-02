// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-B §7 — MERGING PERSPECTIVES WITHOUT AVERAGING THEM AWAY.
//
// The evidence for running more than one: asked the same question, four models found
// substantially different things — a decision frame, an empirical case study, an
// official review, the constitutional depth. "Ask one and you get roughly a quarter of
// the available material."
//
// ⚠ THE MERGE IS THE PART THAT CAN DESTROY THE VALUE, WHICH IS WHY IT IS ITS OWN FILE
// WITH ITS OWN CHECK. The naive merge — dedupe, keep what most perspectives agreed on —
// would delete exactly what the exercise is for. A finding only ONE perspective produced
// is not noise to be filtered by consensus; it is the reason the other perspectives were
// run. §7: the merge "deduplicates and explicitly preserves divergence".
//
// So `unique: true` findings are KEPT, MARKED, and COUNTED, and `divergence` is reported
// to the user. If the count of unique findings is zero, the extra perspectives bought
// nothing on this idea and Charlie should be able to see that in the number rather than
// infer it from a wall of prose.
// ─────────────────────────────────────────────────────────────────────────────

import type { RawFinding, GatherResult } from './deepening-client'
import type { Perspective } from './build-config'

/** One perspective's attempt. `result` is null when that perspective's call failed. */
export interface PerspectiveRun {
  perspective: Perspective
  result: GatherResult | null
}

export interface MergedFinding extends RawFinding {
  /** Which perspectives produced this finding, by label. Never empty. */
  perspectives: string[]
  /** TRUE when exactly one perspective produced it — the point of the exercise. */
  unique: boolean
}

export interface MergedGather {
  findings: MergedFinding[]
  /** ⚠ 25-V §7 — an issue carries a title. See `deepening-client.ts`'s `issues` for why. */
  issues: Array<{ title: string | null; text: string }>
  answered: string[]
  gaps: string[]
  /** §7 — what the extra perspectives actually bought, as numbers rather than prose. */
  divergence: {
    perspectivesRun: number
    perspectivesFailed: string[]
    findingsTotal: number
    /** Produced by exactly one perspective. */
    findingsUnique: number
    /** Produced by more than one. */
    findingsShared: number
    /** How many findings each perspective contributed that no other one did. */
    uniqueByPerspective: Record<string, number>
    /**
     * ⚠ THE HONEST DENOMINATOR, ADDED AFTER THE FIRST COMPARISON RUN OVERSTATED ITSELF.
     *
     * On 2026-08-19 a three-perspective run reported 64 of 73 findings as "unique to one
     * perspective" — 88% divergence, which reads as overwhelming support for running
     * several. It is an UPPER BOUND, not a measurement: `findingKey` includes the
     * finding's own wording, so two perspectives making the SAME point about the SAME
     * source in different words are counted as two distinct findings.
     *
     * These two count the same thing at the SOURCE level, where wording cannot inflate
     * it: how many sources did more than one perspective draw a finding from? Low overlap
     * here means the perspectives really are reading different material; high overlap
     * means they are largely rephrasing each other and the finding-level number is noise.
     */
    sourcesTotal: number
    sourcesShared: number
  }
}

/**
 * The dedup key.
 *
 * Source id plus a normalised claim, NOT source id alone: two perspectives can read the
 * same document and report genuinely different things about it, and collapsing those on
 * the source would throw away the divergence at the moment it appears. It is also not
 * the full body — a paraphrase of the same claim is the same claim, and keeping both
 * would report agreement as divergence, which inflates the number §7 asks Charlie to
 * judge the spend against.
 */
function findingKey(f: RawFinding): string {
  const claim = f.title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .slice(0, 8)
    .join(' ')
  return `${f.sourceId}::${claim}`
}

/** Dedupe a list of strings case-insensitively, keeping the first spelling seen. */
/**
 * ⚠ 25-V §7 — the same rule as `dedupeText`, on the field that decides identity. Two perspectives
 * raising the same challenge under different headings are one challenge; the first title wins
 * rather than both being kept, and a titleless duplicate never overwrites a titled one.
 */
function dedupeIssues(values: Array<{ title: string | null; text: string }>): Array<{ title: string | null; text: string }> {
  const byText = new Map<string, { title: string | null; text: string }>()
  for (const v of values) {
    const key = v.text.trim().toLowerCase()
    if (!key) continue
    const seen = byText.get(key)
    if (!seen) byText.set(key, v)
    else if (!seen.title && v.title) byText.set(key, v)
  }
  return [...byText.values()]
}

function dedupeText(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const k = v.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(v.trim())
  }
  return out
}

export function mergePerspectives(runs: PerspectiveRun[]): MergedGather {
  const byKey = new Map<string, MergedFinding>()
  const failed: string[] = []
  let ran = 0

  for (const run of runs) {
    if (!run.result) {
      // ⚠ A FAILED PERSPECTIVE IS NAMED, NOT ABSORBED. Three perspectives configured and
      // two that answered is a different run from three that answered, and a merge that
      // reported them identically would be the §18 corollary all over again.
      failed.push(run.perspective.label)
      continue
    }
    ran++
    for (const f of run.result.findings) {
      const key = findingKey(f)
      const existing = byKey.get(key)
      if (existing) {
        if (!existing.perspectives.includes(run.perspective.label)) {
          existing.perspectives.push(run.perspective.label)
        }
        // Keep the longer body: two readings of the same claim are rarely equally full,
        // and truncating to the first one seen discards detail for no reason.
        if (f.body.length > existing.body.length) existing.body = f.body
        // CONTRADICTS survives a merge with anything else. A perspective that read this
        // source as cutting against the proposal has said something the user needs, and
        // letting a later SUPPORTS overwrite it would suppress exactly the finding the
        // sceptical perspective exists to produce.
        if (f.kind === 'CONTRADICTS') existing.kind = 'CONTRADICTS'
        continue
      }
      byKey.set(key, { ...f, perspectives: [run.perspective.label], unique: true })
    }
  }

  const findings = [...byKey.values()]
  for (const f of findings) f.unique = f.perspectives.length === 1

  const uniqueByPerspective: Record<string, number> = {}
  for (const f of findings) {
    if (!f.unique) continue
    const label = f.perspectives[0]
    uniqueByPerspective[label] = (uniqueByPerspective[label] ?? 0) + 1
  }

  // Source-level overlap — the wording-proof half. See the note on `sourcesShared`.
  const perspectivesBySource = new Map<string, Set<string>>()
  for (const f of findings) {
    const set = perspectivesBySource.get(f.sourceId) ?? new Set<string>()
    for (const p of f.perspectives) set.add(p)
    perspectivesBySource.set(f.sourceId, set)
  }
  const sourcesShared = [...perspectivesBySource.values()].filter((s) => s.size > 1).length

  const ok = runs.filter((r) => r.result)
  return {
    // Unique findings FIRST. They are what the extra spend bought, and burying them
    // under the consensus ones is a quieter way of averaging them away.
    findings: [...findings].sort((a, b) => Number(b.unique) - Number(a.unique)),
    // ⚠ 25-V §7 — an issue is now { title, text }, so it dedupes on its TEXT and keeps the first
    // title seen. Deduping on the whole object would keep two copies of one challenge whenever two
    // perspectives happened to title it differently, which is the opposite of what dedupe is for.
    issues: dedupeIssues(ok.flatMap((r) => r.result!.issues)),
    answered: dedupeText(ok.flatMap((r) => r.result!.answered)),
    gaps: dedupeText(ok.flatMap((r) => r.result!.gaps)),
    divergence: {
      perspectivesRun: ran,
      perspectivesFailed: failed,
      findingsTotal: findings.length,
      findingsUnique: findings.filter((f) => f.unique).length,
      findingsShared: findings.filter((f) => !f.unique).length,
      uniqueByPerspective,
      sourcesTotal: perspectivesBySource.size,
      sourcesShared,
    },
  }
}

/** The line the report and the panel show. Says nothing when only one perspective ran. */
export function divergenceLine(d: MergedGather['divergence']): string | null {
  if (d.perspectivesRun <= 1 && !d.perspectivesFailed.length) return null
  const parts = [
    `${d.perspectivesRun} perspective${d.perspectivesRun === 1 ? '' : 's'} ran`,
    `${d.findingsTotal} finding${d.findingsTotal === 1 ? '' : 's'} after merging`,
    d.findingsUnique
      ? `at most ${d.findingsUnique} of them found by only one perspective`
      : 'none of them found by only one perspective — the extra readings agreed throughout',
    // The wording-proof half, always shown beside the finding-level count so the upper
    // bound is never read on its own.
    d.sourcesTotal
      ? `${d.sourcesShared} of ${d.sourcesTotal} sources were read by more than one`
      : '',
  ].filter(Boolean)
  if (d.perspectivesFailed.length) parts.push(`⚠ ${d.perspectivesFailed.join(' and ')} did not complete`)
  return `${parts.join('; ')}.`
}
