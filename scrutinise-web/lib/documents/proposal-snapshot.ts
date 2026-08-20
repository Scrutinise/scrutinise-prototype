// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-B/D §1 — THE SNAPSHOT. One seam, so two sprints cannot collide.
//
// `buildProposalSnapshot(ideaId, version?)` is the ONLY thing in the document
// stack that reads idea state. Everything downstream — the Proposal builder, the
// Summary builder, the published version, the share resolver — reads the object
// it returns and nothing else.
//
// ⚠ WHY, CONCRETELY. 25-C is changing how findings are labelled, how the known-
// unknowns list is collapsed, and what the review agenda contains, IN THIS TREE,
// RIGHT NOW. A renderer that reached into those shapes would render yesterday's
// data and would break on their next commit. When 25-C's shapes change, ONLY THIS
// FILE changes. Same reasoning as the search gateway, which has paid for itself
// there repeatedly.
//
// ⚠ AND IT READS PRISMA, NOT `lib/lex/deepening*`. Importing their modules would
// re-couple the two sprints through the back door: the seam is not "we call one
// function of theirs", it is "we depend on the TABLES, which are stable, and not
// on the CODE, which is mid-flight". `check:20bd` asserts the import ban over
// this whole directory, not by intention.
//   // If the document renderer imports anything from lib/lex/deepening*, the seam has failed.
//
// ⚠ NOTHING HERE GENERATES CONTENT. There is no model call in this file and there
// must never be one. §20.0: the document is a RENDERING OF CANONICAL STATE, not a
// new authored artefact. If a value is not in the database it does not appear.
//
// SUPPORTEDNESS IS STRUCTURAL, NOT JUDGED. The never-claim rule (§19-C) says a
// claim with no source must be visibly marked rather than quietly presented. The
// claims CHECK — Lex reading the draft and listing its assertions — is 20-C and is
// deliberately not here. What IS here is the structural fact: a kernel field, a
// cause or an action either has ACCEPTED evidence attached to it in the record, or
// it has none. `supported: false` means "nothing in the record backs this",
// which is exactly what the reader needs to know and requires no generation.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { PAGE_SEQUENCE, type FieldDef } from '@/lib/lex/page1-config'
import { SLOT_LABELS } from '@/lib/lex/page2-config'
import { repairRefUrl } from '@/lib/lex/legislation-url'

/**
 * The shape version. Stored snapshots outlive the code that wrote them: a version
 * published today must still render in six months, when this interface has moved
 * on. A renderer that meets a shape it does not know says so rather than rendering
 * a partial document — see `assertRenderableSnapshot`.
 */
export const SNAPSHOT_VERSION = 1

// ── the object ───────────────────────────────────────────────────────────────

export interface SnapshotField {
  key: string
  label: string
  /** ACCEPTED | SKIPPED | AWAITING_CONFIRMATION | EMPTY, verbatim from the field machine. */
  status: string
  /** Plain text, or the decoded object for a structured field. Null when unset. */
  value: string | Record<string, unknown> | string[] | null
  /** Slot labels for a structured field, so a renderer never has to know the shape. */
  slots: { key: string; label: string; value: string }[]
  /** Accepted evidence attached to this field, by id into `evidence`. */
  evidenceIds: string[]
  /** No accepted evidence in the record bears on this field. */
  supported: boolean
}

export interface SnapshotCause {
  id: string
  cause: string
  whyPersisted: string | null
  evidenceLine: string | null
  isRootCause: boolean
  classification: string
  parentCauseId: string | null
  /** USER or LEX_CORPUS — the user's own knowledge is never blended into Lex's prose. */
  source: string
  evidenceIds: string[]
  supported: boolean
}

export interface SnapshotOption {
  id: string
  approach: string
  mechanismTypes: string[]
  caseFor: string | null
  caseAgainst: string | null
  status: string
  ruleOutReason: string | null
  source: string
}

export interface SnapshotCostFigure {
  low: number | null
  high: number | null
  unit: string | null
  /** The stated assumption. NULL is rendered as "no basis stated", never as £0. */
  basis: string | null
  benchmarkId: string | null
  userOverride: boolean
  priceYear: number | null
}

export interface SnapshotCostLine {
  id: string
  actionId: string
  label: string
  costType: string
  category: string
  staffLevel: string | null
  fteCount: number | null
  durationMonths: number | null
  low: number | null
  high: number | null
  unit: string | null
  basis: string | null
  benchmarkId: string | null
  priceYear: number | null
}

export interface SnapshotAction {
  id: string
  practicalStep: string
  mechanismType: string | null
  whoImplements: string | null
  targetOrganisation: string | null
  wording: string | null
  /** TRUE when this action names a target instrument or carries drafting intent. */
  legislative: boolean
  benefits: Record<string, unknown> | null
  implementationCost: SnapshotCostFigure | null
  enforcementCost: SnapshotCostFigure | null
  regulatoryFriction: SnapshotCostFigure | null
  costLines: SnapshotCostLine[]
  source: string
  evidenceIds: string[]
  supported: boolean
}

export interface SnapshotEvidence {
  id: string
  passKey: string
  fieldRef: string | null
  kind: string
  title: string
  body: string
  citation: string | null
  url: string | null
  sourceType: string | null
  /** The sift's one-line reason this source bears on the proposal. Null pre-sift. */
  siftReason: string | null
}

export interface SnapshotIssue {
  id: string
  passKey: string
  text: string
  status: string
  /** A dismissal without a stated reason is an unaccountable veto — it is rendered. */
  dismissReason: string | null
  resolutionNote: string | null
}

export interface SnapshotUnknown {
  question: string
  why: string
  passKey: string
}

export interface SnapshotFork {
  id: string
  forkKey: string
  fieldKey: string
  chosen: string
  alternative: string
  caseForAlternative: string
  resolved: boolean
}

export interface SnapshotSource {
  /** Grouped by corpus type; the label is the group's heading. */
  group: string
  label: string
  refs: { id: string; title: string; citation: string; url: string; snippet?: string; date?: string }[]
}

/** §3c — defined in the snapshot, deliberately NOT built. */
export interface SnapshotScaffold {
  key: 'EVIDENCE_PACK' | 'ONLINE_VIEW' | 'LEGISLATIVE_ANNEX'
  label: string
  /** Which snapshot members it would render from, so building it is not a redesign. */
  readsFrom: string[]
  /** Stated in the object rather than only in a document nobody reads. */
  status: 'scaffolded'
  why: string
}

export interface ProposalSnapshot {
  snapshotVersion: number
  ideaId: string
  /** ⚠ VOLATILE. Excluded from `snapshotHash` — otherwise every read mints a version. */
  generatedAt: string
  title: string
  summaryDescription: string | null
  owner: { id: string; name: string }
  /** §25 elicitation — what the user told us, kept apart from what was retrieved. */
  userKnowledge: { text: string; provenance: string } | null
  fields: SnapshotField[]
  causes: SnapshotCause[]
  options: SnapshotOption[]
  actions: SnapshotAction[]
  costs: {
    lines: SnapshotCostLine[]
    /** The Page-4 aggregate as stored. Never recomputed here — that would be a claim. */
    summary: Record<string, unknown> | null
    /** The Page-2 problem cost, which the headline is set against. */
    problemCost: string | null
  }
  evidence: SnapshotEvidence[]
  issues: SnapshotIssue[]
  knownUnknowns: SnapshotUnknown[]
  forks: { open: SnapshotFork[]; resolved: SnapshotFork[] }
  sources: SnapshotSource[]
  /** Which deepening passes have run, so "no findings" and "never searched" differ. */
  passes: { passKey: string; status: string; completedAt: string | null; failureReason: string | null }[]
  scaffolded: SnapshotScaffold[]
  /** How much of the kernel is unevidenced — computed, so §3's marking is auditable. */
  coverage: { fieldsTotal: number; fieldsSupported: number; actionsTotal: number; actionsSupported: number }
}

/** Why a snapshot could not be built — stated, never papered over. */
export class SnapshotUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SnapshotUnavailableError'
  }
}

// ── source grouping (shared vocabulary with the briefing export) ──────────────

const TYPE_LABELS: Record<string, string> = {
  PRIMARY_LEGISLATION: 'Primary legislation',
  STATUTORY_INSTRUMENT: 'Statutory instruments',
  EU_LEGISLATION: 'Retained EU law',
  EXPLANATORY_NOTE: 'What the law was for',
  IMPACT_ASSESSMENT: 'What it was expected to cost',
  DEBATE: 'Debates',
  DIVISION: 'How they voted',
  CONSULTATION: 'Who was asked',
  COMMITTEE: 'Committee reports',
  CASE_LAW: 'Case law',
  BILL: 'Bills',
  TREATY: 'Treaties',
  GUIDANCE: 'Guidance & regulators',
}
const TYPE_ORDER = [
  'PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION', 'EXPLANATORY_NOTE',
  'IMPACT_ASSESSMENT', 'DEBATE', 'DIVISION', 'COMMITTEE', 'CONSULTATION',
  'CASE_LAW', 'BILL', 'TREATY', 'GUIDANCE',
]

interface StoredRef {
  id?: string
  type?: string
  title?: string
  citation?: string
  url?: string
  snippet?: string
  date?: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function decodeFieldValue(def: FieldDef, raw: string | null): SnapshotField['value'] {
  if (raw == null) return null
  if (def.type === 'structured') {
    try {
      const parsed = JSON.parse(raw)
      return parsed as Record<string, unknown>
    } catch {
      // A structured field whose stored JSON no longer parses is shown as its raw
      // text rather than dropped. Losing a sentence on export is worse than
      // showing an ugly one.
      return raw
    }
  }
  return raw
}

function slotsFor(value: SnapshotField['value']): SnapshotField['slots'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
    .map(([k, v]) => ({ key: k, label: SLOT_LABELS[k] ?? k, value: String(v).trim() }))
}

function figure(v: unknown): SnapshotCostFigure | null {
  const r = v as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return null
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null)
  return {
    low: num(r.low),
    high: num(r.high),
    unit: str(r.unit),
    basis: str(r.basis),
    benchmarkId: str(r.benchmarkId),
    userOverride: r.userOverride === true,
    priceYear: num(r.priceYear),
  }
}

/**
 * ⚠ The fieldRef vocabulary is the EVIDENCE LAYER'S, not ours: `"challenge"`,
 * `"causes:<id>"`, `"actions:<id>"`, or null for evidence about the idea at large.
 * Parsing it here — in the seam — is deliberate: it is the one place that has to
 * know it, and it is a schema comment rather than a shape 25-C is changing.
 */
function refKeyFor(prefix: 'causes' | 'actions', id: string): string {
  return `${prefix}:${id}`
}

// ── the assembler ────────────────────────────────────────────────────────────

/**
 * Build the snapshot from live state, or return the STORED snapshot of a version.
 *
 * ⚠ THE `version` ARGUMENT DOES NOT REBUILD. A stored version is returned exactly
 * as it was written, because a version that got recomputed from today's rows would
 * be the very thing versioning exists to prevent — "the version that was shared"
 * would shift under the recipient every time a row moved.
 */
export async function buildProposalSnapshot(
  ideaId: string,
  version?: number,
): Promise<ProposalSnapshot> {
  if (version !== undefined) {
    const stored = await prisma.proposalVersion.findUnique({
      where: { ideaId_versionNumber: { ideaId, versionNumber: version } },
      select: { snapshot: true },
    })
    if (!stored) {
      throw new SnapshotUnavailableError(`There is no version ${version} of this proposal.`)
    }
    return stored.snapshot as unknown as ProposalSnapshot
  }

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      id: true, title: true, summaryDescription: true, deletedAt: true,
      legislationRefs: true, costSummary: true, whoAffectedImpactCost: true,
      creator: { select: { id: true, preferredName: true, name: true } },
      elicitation: { select: { ownKnowledge: true, ownKnowledgeProvenance: true } },
    },
  })
  if (!idea || idea.deletedAt) {
    throw new SnapshotUnavailableError('That idea no longer exists.')
  }

  const [fieldRows, causeRows, optionRows, actionRows, costLineRows,
    evidenceRows, issueRows, passRows, forkRows] = await Promise.all([
    prisma.ideaFieldState.findMany({
      where: { ideaId },
      select: { fieldKey: true, status: true, value: true },
    }),
    prisma.diagnosisCause.findMany({
      where: { ideaId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.policyOption.findMany({
      where: { ideaId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.lexCoherentAction.findMany({
      where: { ideaId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.costLine.findMany({
      where: { action: { ideaId } },
      orderBy: [{ actionId: 'asc' }, { orderIndex: 'asc' }],
    }),
    // ⚠ ACCEPTED ONLY. A PROPOSED finding is one Lex offered and the user has not
    // agreed to; putting it in the artefact that leaves the building would publish
    // a judgement nobody made. A REJECTED one they said no to.
    prisma.evidenceItem.findMany({
      where: { ideaId, status: 'ACCEPTED' },
      orderBy: [{ passKey: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.deepeningIssue.findMany({
      where: { ideaId },
      orderBy: [{ passKey: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.deepeningPass.findMany({ where: { ideaId }, orderBy: { passKey: 'asc' } }),
    prisma.buildFork.findMany({ where: { ideaId }, orderBy: { createdAt: 'asc' } }),
  ])

  const statusByKey = new Map(fieldRows.map((r) => [r.fieldKey, r]))

  // Evidence indexed by what it bears on, so every consumer asks the same question
  // the same way.
  const evidenceByRef = new Map<string, string[]>()
  for (const e of evidenceRows) {
    if (!e.fieldRef) continue
    const list = evidenceByRef.get(e.fieldRef) ?? []
    list.push(e.id)
    evidenceByRef.set(e.fieldRef, list)
  }

  const fields: SnapshotField[] = PAGE_SEQUENCE.flatMap((page) => page.fields).map((def) => {
    const row = statusByKey.get(def.key)
    const value = decodeFieldValue(def, row?.value ?? null)
    const evidenceIds = evidenceByRef.get(def.key) ?? []
    return {
      key: def.key,
      label: def.label,
      status: row?.status ?? 'EMPTY',
      value,
      slots: slotsFor(value),
      evidenceIds,
      supported: evidenceIds.length > 0,
    }
  })

  const causes: SnapshotCause[] = causeRows.map((c) => {
    const evidenceIds = evidenceByRef.get(refKeyFor('causes', c.id)) ?? []
    return {
      id: c.id,
      cause: c.cause,
      whyPersisted: c.whyPersisted,
      evidenceLine: c.evidence,
      isRootCause: c.isRootCause,
      classification: c.classification,
      parentCauseId: c.parentCauseId,
      source: c.source,
      evidenceIds,
      // ⚠ The one-line `evidence` string counts. It is the user's own stated
      // evidence for the cause, and treating it as nothing would mark a cause the
      // user evidenced themselves as unsupported — the never-claim rule pointed
      // the wrong way.
      supported: evidenceIds.length > 0 || Boolean(c.evidence && c.evidence.trim()),
    }
  })

  const options: SnapshotOption[] = optionRows.map((o) => ({
    id: o.id,
    approach: o.approach,
    mechanismTypes: o.mechanismTypes,
    caseFor: o.caseFor,
    caseAgainst: o.caseAgainst,
    status: o.status,
    ruleOutReason: o.ruleOutReason,
    source: o.source,
  }))

  const linesByAction = new Map<string, SnapshotCostLine[]>()
  const costLines: SnapshotCostLine[] = costLineRows.map((l) => {
    const line: SnapshotCostLine = {
      id: l.id,
      actionId: l.actionId,
      label: l.label,
      costType: l.costType,
      category: l.category,
      staffLevel: l.staffLevel ?? null,
      fteCount: l.fteCount ?? null,
      durationMonths: l.durationMonths ?? null,
      low: l.low ?? null,
      high: l.high ?? null,
      unit: l.unit ?? null,
      basis: l.basis ?? null,
      benchmarkId: l.benchmarkId ?? null,
      priceYear: l.priceYear ?? null,
    }
    const list = linesByAction.get(l.actionId) ?? []
    list.push(line)
    linesByAction.set(l.actionId, list)
    return line
  })

  const actions: SnapshotAction[] = actionRows.map((a) => {
    const evidenceIds = evidenceByRef.get(refKeyFor('actions', a.id)) ?? []
    return {
      id: a.id,
      practicalStep: a.practicalStep,
      mechanismType: a.mechanismType,
      whoImplements: a.whoImplements,
      targetOrganisation: a.targetOrganisation,
      wording: a.wording,
      // §20.4 — "where the instrument is legislative". Derived from what is
      // stored (a named target or captured drafting intent), never guessed from
      // the prose.
      legislative: Boolean((a.wording && a.wording.trim()) || (a.targetOrganisation && a.targetOrganisation.trim())),
      benefits: (a.benefits as Record<string, unknown> | null) ?? null,
      implementationCost: figure(a.implementationCost),
      enforcementCost: figure(a.enforcementCost),
      regulatoryFriction: figure(a.regulatoryFriction),
      costLines: linesByAction.get(a.id) ?? [],
      source: a.source,
      evidenceIds,
      supported: evidenceIds.length > 0,
    }
  })

  const evidence: SnapshotEvidence[] = evidenceRows.map((e) => ({
    id: e.id,
    passKey: e.passKey,
    fieldRef: e.fieldRef,
    kind: e.kind,
    title: e.title,
    body: e.body,
    citation: e.citation,
    url: e.url,
    sourceType: e.sourceType,
    siftReason: e.siftReason,
  }))

  const issues: SnapshotIssue[] = issueRows.map((i) => ({
    id: i.id,
    passKey: i.passKey,
    text: i.text,
    status: i.status,
    dismissReason: i.dismissReason,
    resolutionNote: i.resolutionNote,
  }))

  // ⚠ READ AS DATA, NOT THROUGH 25-C's COLLAPSE HELPER. `lib/lex/known-unknowns.ts`
  // is theirs and is uncommitted in this shared tree; importing it would put a
  // file on Main whose import does not resolve — the exact `build-cost.ts`
  // incident in CLAUDE.md §20. The JSON column is the stable surface.
  const knownUnknowns: SnapshotUnknown[] = []
  for (const p of passRows) {
    const raw = Array.isArray(p.knownUnknowns) ? p.knownUnknowns : []
    for (const u of raw as unknown[]) {
      const o = u as Record<string, unknown>
      const question = typeof o?.question === 'string' ? o.question.trim() : ''
      if (!question) continue
      knownUnknowns.push({
        question,
        why: typeof o?.why === 'string' ? o.why : '',
        passKey: p.passKey,
      })
    }
  }

  const forksAll: SnapshotFork[] = forkRows.map((f) => ({
    id: f.id,
    forkKey: f.forkKey,
    fieldKey: f.fieldKey,
    chosen: f.chosen,
    alternative: f.alternative,
    caseForAlternative: f.caseForAlternative,
    resolved: f.resolved,
  }))

  const refs: StoredRef[] = Array.isArray(idea.legislationRefs)
    ? (idea.legislationRefs as unknown as StoredRef[])
    : []
  const sources: SnapshotSource[] = TYPE_ORDER
    .map((t) => ({
      group: t,
      label: TYPE_LABELS[t] ?? t,
      refs: refs
        .filter((r) => r.type === t)
        .map((r) => ({
          id: r.id ?? '',
          title: r.title?.trim() || 'Untitled source',
          citation: r.citation?.trim() || '',
          // Repaired on the way out, exactly as the briefing export does — a
          // source whose link does not open is not a source.
          url: repairRefUrl(r.type, r.id, r.url)?.trim() || '',
          snippet: r.snippet?.trim() || undefined,
          date: r.date?.trim() || undefined,
        })),
    }))
    .filter((g) => g.refs.length > 0)

  const whoAffected = idea.whoAffectedImpactCost as Record<string, unknown> | null
  const problemCost = typeof whoAffected?.cost === 'string' && whoAffected.cost.trim()
    ? whoAffected.cost.trim()
    : null

  // Only kernel fields the user has actually settled count toward coverage; an
  // EMPTY field is not an unsupported claim, it is an absent one.
  const settled = fields.filter((f) => f.status === 'ACCEPTED' && f.value !== null)

  return {
    snapshotVersion: SNAPSHOT_VERSION,
    ideaId: idea.id,
    generatedAt: new Date().toISOString(),
    title: idea.title,
    summaryDescription: idea.summaryDescription ?? null,
    owner: {
      id: idea.creator.id,
      name: idea.creator.preferredName || idea.creator.name,
    },
    userKnowledge: idea.elicitation?.ownKnowledge?.trim()
      ? {
          text: idea.elicitation.ownKnowledge.trim(),
          provenance: idea.elicitation.ownKnowledgeProvenance,
        }
      : null,
    fields,
    causes,
    options,
    actions,
    costs: {
      lines: costLines,
      summary: (idea.costSummary as Record<string, unknown> | null) ?? null,
      problemCost,
    },
    evidence,
    issues,
    knownUnknowns,
    forks: {
      open: forksAll.filter((f) => !f.resolved),
      resolved: forksAll.filter((f) => f.resolved),
    },
    sources,
    passes: passRows.map((p) => ({
      passKey: p.passKey,
      status: p.status,
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
      failureReason: p.failureReason,
    })),
    scaffolded: SCAFFOLDED,
    coverage: {
      fieldsTotal: settled.length,
      fieldsSupported: settled.filter((f) => f.supported).length,
      actionsTotal: actions.length,
      actionsSupported: actions.filter((a) => a.supported).length,
    },
  }
}

/**
 * §3c — the three outputs whose PLACE IN THE SNAPSHOT is defined and whose
 * rendering is deliberately not written. Named here rather than only in a report,
 * so that building one is reading a field, not rediscovering a design.
 */
const SCAFFOLDED: SnapshotScaffold[] = [
  {
    key: 'EVIDENCE_PACK',
    label: 'The Evidence Pack',
    readsFrom: ['evidence', 'sources', 'costs.lines', 'options (RULED_OUT + ruleOutReason)'],
    status: 'scaffolded',
    why: 'Every source grouped, the cost basis, and the ruled-out alternatives with reasons — all three are already in the snapshot. What is missing is only the rendering, and half a rendering is worse than none.',
  },
  {
    key: 'ONLINE_VIEW',
    label: 'The Online View',
    readsFrom: ['the whole snapshot, plus live corpus links from sources[].url'],
    status: 'scaffolded',
    why: 'The share resolver reads the pinned version and offers the documents; the full page with live corpus links and comments is §20.3 and needs the comment surface, which does not exist for proposals yet.',
  },
  {
    key: 'LEGISLATIVE_ANNEX',
    label: 'The Legislative Annex (standalone)',
    readsFrom: ['actions where legislative === true (targetOrganisation, wording)'],
    status: 'scaffolded',
    why: 'It renders INSIDE the Proposal today. Standalone is §20-E and its substance — target section, operation, linked case law — waits on the AMENDABLE_SECTION search intent, which has not landed.',
  },
]

/**
 * The content hash of a snapshot: sha-256 over everything EXCEPT the volatile
 * members.
 *
 * ⚠ `generatedAt` MUST be excluded or the hash changes on every read, every read
 * looks like a change, and "an unchanged proposal does not mint a new version"
 * becomes false while still appearing to work. Watched failing in `check:20bd`.
 */
export function snapshotHash(snapshot: ProposalSnapshot): string {
  const { generatedAt: _ignored, ...stable } = snapshot
  return createHash('sha256').update(stableStringify(stable)).digest('hex')
}

/**
 * Key-ordered JSON. `JSON.stringify` preserves insertion order, and two objects
 * built by different code paths (a fresh build vs a round-trip through JSONB)
 * can carry the same values in a different order — which would hash differently
 * and mint a version for no change at all.
 *
 * ⚠ THIS IS NOT A THEORETICAL CONCERN, AND IT WAS MEASURED RATHER THAN ASSUMED.
 * Postgres `jsonb` does not preserve key order: it stores keys sorted by length
 * then bytewise. `{affectedGroups, impact, cost}` comes back as
 * `{cost, impact, affectedGroups}`. Verified against Neon, not inferred from the
 * documentation. Anything comparing two snapshots — the hash here, AND
 * `describeChange` in proposal-version.ts — must go through this function or it
 * will report a field as edited every time a stored snapshot is one side of the
 * comparison. `describeChange` did exactly that on the first live run.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/**
 * A renderer's guard. A stored snapshot from a FUTURE shape version is refused
 * rather than rendered half-understood — CLAUDE.md §18's rule that a degradation
 * must announce itself with its cause attached.
 */
export function assertRenderableSnapshot(snapshot: ProposalSnapshot): void {
  if (typeof snapshot?.snapshotVersion !== 'number') {
    throw new SnapshotUnavailableError(
      'This stored version has no shape version recorded, so it cannot be rendered safely.',
    )
  }
  if (snapshot.snapshotVersion > SNAPSHOT_VERSION) {
    throw new SnapshotUnavailableError(
      `This version was written by a newer build (snapshot shape ${snapshot.snapshotVersion}, this build understands ${SNAPSHOT_VERSION}). It is not rendered rather than rendered wrongly.`,
    )
  }
}
