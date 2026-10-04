// 26-P §2b — LEX SEES THE WHOLE IDEA, EVERY TURN, AS A COMPACT SNAPSHOT.
//
// ⚠ ORDERED STABLE-FIRST SO CACHING WORKS. Two parts, because they change at different rates:
//   • `stable`  — kernel fields, causes, candidates, actions, sources, challenges. Changes only when the
//                 idea changes. Sent as a SECOND cached system block, after the method/site prefix.
//   • `volatile` — where the user is, what is waiting. Changes every turn. Sent LAST (in the final user
//                 message) so it can never invalidate the cached prefix (Anthropic caches by prefix: one
//                 byte change anywhere invalidates everything after it).
//
// ⚠ NOTHING HERE WRITES. `computeCanonicalState` is exactly what the browser calls on every page load
// (CLAUDE.md §26.3), and the rest are plain `prisma.*.findMany` — NOT `readPolicyState`, whose
// `ensureNumbered` writes numbers as a side effect and would make the snapshot manufacture the state it
// then reports (§26.2).
//
// IDS ARE 8-CHARACTER PREFIXES — enough to be unambiguous inside one idea and a quarter of the tokens.
// Tools resolve a prefix against the idea's own rows (`resolvePrefix`), so a prefix from another idea
// resolves to nothing. Candidates are addressed by their stable number, as the user sees them.

import { prisma } from '@/lib/prisma'
import { computeCanonicalState } from '@/lib/lex/state'
import { pendingMaterialSince } from '@/lib/lex/update-pass'

export const short = (id: string) => id.slice(0, 8)

/** A filed source is a root-cause-analysis source when its title or address says so. Exported for the check. */
export const RCA_SOURCE = /root[\s-]*cause|\bRCA\b|5[\s-]*whys?|five[\s-]*whys?|fishbone|ishikawa/i

const clip = (s: unknown, n: number): string => {
  const t = typeof s === 'string' ? s : s == null ? '' : JSON.stringify(s)
  const flat = t.replace(/\s+/g, ' ').trim()
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat
}

/** Resolve an 8+ char id prefix against rows that are ALREADY scoped to this idea. null = none OR ambiguous. */
export function resolvePrefix<T extends { id: string }>(rows: T[], idOrPrefix: string): T | null {
  const p = (idOrPrefix ?? '').trim().toLowerCase()
  if (p.length < 6) return null
  const hits = rows.filter((r) => r.id.toLowerCase().startsWith(p))
  return hits.length === 1 ? hits[0] : null
}

export interface UiContext {
  /** The Lex stage the user is looking at: idea | strategy | deepening. */
  stage?: string | null
  /** The panel/tab they have open, if the client says. */
  panel?: string | null
}

export interface Snapshot {
  stable: string
  volatile: string
  /** For the log and the checks: what was counted. */
  counts: { fields: number; causes: number; candidates: number; actions: number; sources: number; challenges: number }
}

export async function buildSnapshot(ideaId: string, ui: UiContext = {}): Promise<Snapshot> {
  const [state, candidates, sources, decisions, challenges, idea, pending] = await Promise.all([
    computeCanonicalState(ideaId),
    prisma.policyOption.findMany({
      where: { ideaId, mergedIntoId: null }, orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, number: true, approach: true, status: true, kind: true, source: true, disposition: true, phase: true, ruleOutReason: true, rulesOut: true },
    }),
    prisma.ideaUserMaterial.findMany({
      where: { ideaId, archivedAt: null }, orderBy: { createdAt: 'asc' },
      select: { id: true, kind: true, label: true, url: true, status: true, findingCount: true, failureReason: true },
    }),
    prisma.ideaSourceDecision.groupBy({ by: ['status'], where: { ideaId }, _count: { _all: true } }),
    prisma.deepeningIssue.findMany({
      where: { ideaId, status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 30,
      select: { id: true, title: true, text: true },
    }),
    prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true, chosenApproach: true } }),
    pendingMaterialSince(ideaId).catch(() => ({ count: 0, materialIds: [] as string[], lastRunAt: null as string | null })),
  ])

  const lines: string[] = []
  lines.push(`IDEA: ${clip(idea?.title, 160) || '(untitled)'}`)

  // ── kernel fields ──
  let fieldCount = 0
  lines.push('', 'KERNEL FIELDS (key — label — status — current wording; “proposal waiting” means a draft is pending the user’s accept/edit/dismiss):')
  for (const page of state?.pages ?? []) {
    lines.push(`# page ${page.key} (${page.label}) — ${page.status}${page.reachable ? '' : ', not reachable yet'}`)
    for (const f of page.fields) {
      fieldCount++
      const bits = [`${f.key} — ${f.label} — ${f.status}`]
      if (f.value != null && f.value !== '') bits.push(`“${clip(f.value, 320)}”`)
      if (f.proposal) bits.push(`proposal waiting: “${clip(f.proposal.value, 200)}”`)
      if (f.redraft) bits.push(`redraft waiting beside the user's words`)
      if (f.stale) bits.push(`STALE: ${clip(f.stale.reason, 100)}`)
      lines.push(`- ${bits.join(' · ')}`)
    }
  }

  // ── causes ──
  const causes = state?.diagnosisCauses ?? []
  lines.push('', `CAUSES (${causes.length}):`)
  for (const c of causes) lines.push(`- cause ${c.number ?? '?'}${c.isRootCause ? ' [root]' : ''} (${c.source}): ${clip(c.cause, 180)}`)

  // ── candidates ──
  lines.push('', `CANDIDATE POLICIES — addressed by number (${candidates.length}):`)
  for (const p of candidates) {
    const tags = [p.status, p.kind, `source ${p.source}`, p.disposition !== 'UNDISPOSITIONED' ? p.disposition : '', p.phase === 'LATER' ? 'later phase' : ''].filter(Boolean)
    lines.push(`- #${p.number ?? '?'} [${tags.join(', ')}]: ${clip(p.approach, 220)}${p.ruleOutReason ? ` (ruled out: ${clip(p.ruleOutReason, 80)})` : ''}`)
  }
  if (idea?.chosenApproach?.trim()) lines.push(`GUIDING POLICY (settled): “${clip(idea.chosenApproach, 320)}”`)

  // ── actions ──
  const actions = state?.actions ?? []
  lines.push('', `COHERENT ACTIONS (${actions.length}):`)
  // 26-Q — addressed by NUMBER, as the user sees it ("put 7 and 12 under Transparency"), with the title, heading and what is parked.
  const headingName = new Map((state?.actionHeadings ?? []).map((h) => [h.id, h.name]))
  const untitled = actions.filter((a) => !a.title?.trim()).length
  for (const a of actions) {
    lines.push(`- #${a.number ?? '?'} (${a.source})${a.title ? ` “${clip(a.title, 80)}”` : ''}${a.headingId && headingName.get(a.headingId) ? ` [heading: ${headingName.get(a.headingId)}]` : ''}${a.parked ? ' [later phase]' : ''}: ${clip(a.practicalStep, 180)}`)
  }
  if (actions.length) lines.push(`(${untitled} untitled, ${actions.filter((a) => a.titleProposal).length} with a proposed title, ${actions.filter((a) => a.facetProposal).length} with a proposed classification, ${actions.filter((a) => !a.targetCauseIds.length).length} with no recorded cause; ${(state?.setAsideActions ?? []).length} set aside; ${(state?.actionHeadings ?? []).length} headings)`)

  // ── sources ──
  lines.push('', `FILED SOURCES — the user's own material (${sources.length}):`)
  for (const s of sources) {
    lines.push(`- ${short(s.id)} ${s.kind} “${clip(s.label, 90)}”${s.url ? ` ${clip(s.url, 90)}` : ''} — ${s.status}${s.status === 'FAILED' ? ` (${clip(s.failureReason, 80)})` : `, ${s.findingCount} findings`}`)
  }
  // 26-P addendum §6a — "ground the method text in the user's filed RCA sources where they exist". The method
  // block is the cached stable prefix and cannot depend on the idea, so the grounding is HERE: which of THIS
  // user's READY sources are about root-cause analysis, named so Lex can read_source and cite them.
  const rca = sources.filter((s) => s.status === 'READY' && RCA_SOURCE.test(`${s.label} ${s.url ?? ''}`))
  if (rca.length) lines.push(`ROOT-CAUSE-ANALYSIS SOURCES THE USER HAS FILED (ground cause-finding advice in these and cite them): ${rca.map((s) => `${short(s.id)} “${clip(s.label, 70)}”`).join('; ')}`)
  if (decisions.length) lines.push(`Source decisions on corpus items: ${decisions.map((d) => `${d._count._all} ${d.status}`).join(', ')}`)

  // ── challenges ──
  lines.push('', `OPEN CHALLENGES (${challenges.length}):`)
  for (const c of challenges) lines.push(`- ${short(c.id)}: ${clip(c.title || c.text, 140)}`)

  const stable = lines.join('\n')

  const waiting: string[] = []
  if (state?.currentField) waiting.push(`current field: ${state.currentField.key} (${state.currentField.status})`)
  if (state?.nextPage) waiting.push(`the page is complete; next is ${state.nextPage.label}`)
  if (pending.count) waiting.push(`${pending.count} filed source(s) not yet compared against the strategy`)
  const volatile = [
    'WHERE THE USER IS NOW',
    `stage: ${ui.stage || '(not stated)'}${ui.panel ? ` · panel: ${ui.panel}` : ''}`,
    `lex page: ${state?.stage ?? '(unknown)'}`,
    waiting.length ? `waiting: ${waiting.join('; ')}` : 'waiting: nothing',
  ].join('\n')

  return {
    stable, volatile,
    counts: { fields: fieldCount, causes: causes.length, candidates: candidates.length, actions: actions.length, sources: sources.length, challenges: challenges.length },
  }
}
