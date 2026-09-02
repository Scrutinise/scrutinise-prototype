// ─────────────────────────────────────────────────────────────────────────────
// CCW-B14a step 3 — EXPORT ONE BUILD AS JSON.
//
//   npx tsx --env-file=.env scripts/b14-export.ts M-01
//   npx tsx --env-file=.env scripts/b14-export.ts --all
//
// Writes docs/report_run/builds/<ref>.json. READ-ONLY against the database.
//
// ⚠ WHY NOT `dump:kernel`. B14a says extend it rather than write a new exporter, and the
// intent is right — but `dump-build-kernel.ts` renders MARKDOWN for a human reviewer, and
// B14a step 3 asks for JSON with named keys that CCW writes an interlock layer against.
// Converting the markdown back would be parsing prose we had just formatted. What IS
// reused is the thing worth reusing: the set of models it reads, so this exporter covers
// the same ground rather than a subset someone guessed at.
//
// ⚠ NOTHING IS SUMMARISED. Every pass object goes in raw as well as keyed, because B14a
// asks to quote sources and not summaries of them, and because a field this exporter did
// not think to name is still in the file for CCW to find.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'

const OUT_DIR = join(__dirname, '../../docs/report_run/builds')
const INPUTS = join(__dirname, '../../docs/report_run/lex_build_inputs.json')

/** The eleven passes B14a names, in order. Absent ones are reported, not omitted. */
const EXPECTED_PASSES = [
  'ORIENT', 'DIAGNOSIS', 'APPROACH', 'ACTIONS', 'RESEARCH', 'REVISE',
  'CAUSES_COMMENTARY', 'SMART', 'KERNEL_CHECK', 'LOGIC_CHECK', 'ADVERSARIAL',
]

async function exportOne(ref: string, inputs: any) {
  const row = inputs.measures.find((m: any) => m.ref === ref)
  if (!row) throw new Error(`no measure ${ref} in the input file`)

  const idea = await prisma.idea.findFirst({
    where: { title: row.idea.title, deletedAt: null },
    select: {
      id: true, title: true, summaryDescription: true, govtArea: true, country: true,
      visibility: true, status: true, stage: true, createdAt: true,
      guidingPolicyUnresolved: true, guidingPolicyUnresolvedWhy: true,
    },
  })
  if (!idea) return { ref, written: null, note: 'no Idea row — not enqueued yet' }

  const build = await prisma.ideaBuild.findFirst({
    where: { ideaId: idea.id }, orderBy: { version: 'desc' },
  })
  const elicitation = await prisma.ideaElicitation.findUnique({ where: { ideaId: idea.id } })
  const causes = await prisma.diagnosisCause.findMany({ where: { ideaId: idea.id }, orderBy: { number: 'asc' } })
  const actions = await prisma.lexCoherentAction.findMany({ where: { ideaId: idea.id }, orderBy: { orderIndex: 'asc' } })
  const evidence = await prisma.evidenceItem.findMany({ where: { ideaId: idea.id }, orderBy: { createdAt: 'asc' } })
  const fields = await prisma.ideaFieldState.findMany({ where: { ideaId: idea.id } })
  const forks = await prisma.buildFork.findMany({ where: { buildId: build?.id ?? '' } }).catch(() => [])

  const passes: any[] = Array.isArray(build?.passes) ? (build!.passes as any[]) : []
  const byKey: Record<string, any> = {}
  for (const p of passes) byKey[p.key] = p

  // ⚠ A pass the build never wrote is DIFFERENT from one that ran and returned nothing.
  // Reported as a named absence so "no ADVERSARIAL section" cannot be read as "the
  // adversarial pass had nothing to say".
  const missing = EXPECTED_PASSES.filter(k => !byKey[k])
  const extra = passes.map(p => p.key).filter((k: string) => !EXPECTED_PASSES.includes(k))

  const doc = {
    ref,
    exported_at: new Date().toISOString(),
    sourcing: row.sourcing,
    source_proposals: row.source_proposals,

    // ⚠ CCW's row verbatim, so the export is self-contained and any later disagreement
    // about what was fed in is settled by the file rather than by memory.
    inputs_as_supplied: row,

    goal_kind_mapping: {
      supplied_by_ccw: row.elicitation.goalKind,
      stored_in_column: elicitation?.goalKind ?? null,
      why: 'GOAL_KINDS is a four-key enum (LAW_CHANGE, APPLICATION_CHANGE, INSTITUTIONAL_PRESSURE, UNSURE). '
        + 'CCW supplied prose, which elicitationContext would resolve to the label "not stated". '
        + 'The column holds the mapped key; the supplied wording is preserved above. '
        + '⚠ Awaiting CCW confirmation of the mapping before the remaining eleven.',
    },

    idea,
    elicitation: elicitation && {
      ...elicitation,
      problem_gate_note:
        'problemGateFired is MEASURED, not defaulted: these rows are created directly, which bypasses '
        + 'the chat flow, so the column was set from looksLikeASolution() — the same deterministic '
        + 'function the elicitation calls. ⚠ The MODEL press that follows it in the live flow was NOT '
        + 'exercised by this run.',
    },

    build: build && {
      id: build.id, version: build.version, status: build.status, framing: build.framing,
      mode: (build as any).mode, passesComplete: build.passesComplete, currentPass: build.currentPass,
      startedAt: build.startedAt, completedAt: build.completedAt,
      durationMs: build.startedAt && build.completedAt
        ? new Date(build.completedAt).getTime() - new Date(build.startedAt).getTime() : null,
      failureReason: build.failureReason,
      summaryMessage: build.summaryMessage,
      queryUsed: build.queryUsed,
      uncertainties: build.uncertainties,
      userCritique: build.userCritique,
    },

    // ── the kernel ────────────────────────────────────────────────────────
    kernel: {
      // ⚠ dump:kernel's §0 warning applies here too: after a successful build the canonical
      // Idea columns are EMPTY and the drafted kernel sits in IdeaFieldState at
      // AWAITING_CONFIRMATION until a human accepts it. Both are exported.
      note: 'The drafted kernel lives in field_states at AWAITING_CONFIRMATION until accepted; the canonical Idea columns stay empty until then.',
      diagnosis_field: fields.find(f => f.fieldKey.toLowerCase().includes('diagnosis')) ?? null,
      guiding_policy_field: fields.find(f => f.fieldKey.toLowerCase().includes('guiding')) ?? null,
      causes,
      coherent_actions: actions,
      guiding_policy_unresolved: idea.guidingPolicyUnresolved,
      guiding_policy_unresolved_why: idea.guidingPolicyUnresolvedWhy,
    },

    // ── every pass, keyed and raw ─────────────────────────────────────────
    passes_by_key: Object.fromEntries(EXPECTED_PASSES.map(k => [k, byKey[k] ?? null])),
    passes_raw: passes,
    passes_missing: missing,
    passes_unexpected: extra,
    pass_status: passes.map((p: any) => ({
      key: p.key, status: p.status, failureReason: p.failureReason ?? null,
      startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
    })),
    // ⚠ B14a: "A failed pass is reportable, not embarrassing." Surfaced at the top level so
    // it cannot be missed in a large file, and never suppressed or re-run away.
    failures: passes.filter((p: any) => p.failureReason || p.status === 'FAILED')
      .map((p: any) => ({ key: p.key, status: p.status, failureReason: p.failureReason ?? null })),

    // ── coverage, from the two passes that search ─────────────────────────
    coverage: {
      note: 'Whatever ORIENT and RESEARCH carried about what was searched, over what, and what was not found. Emitted raw — the shape is the engine\'s, not this exporter\'s.',
      orient: byKey.ORIENT ? { output: byKey.ORIENT.output ?? null, activity: byKey.ORIENT.activity ?? null, carry: byKey.ORIENT.carry ?? null } : null,
      research: byKey.RESEARCH ? { output: byKey.RESEARCH.output ?? null, activity: byKey.RESEARCH.activity ?? null, carry: byKey.RESEARCH.carry ?? null } : null,
    },

    // ── citations with their evidence ─────────────────────────────────────
    evidence,
    evidence_summary: {
      total: evidence.length,
      with_citation: evidence.filter(e => e.citation).length,
      with_url: evidence.filter(e => e.url).length,
      by_pass: evidence.reduce((m: any, e) => (m[e.passKey] = (m[e.passKey] ?? 0) + 1, m), {}),
      by_status: evidence.reduce((m: any, e) => (m[e.status] = (m[e.status] ?? 0) + 1, m), {}),
    },

    // ── where the evidence changed its mind ───────────────────────────────
    revise: byKey.REVISE ?? null,
    causes_commentary: (build as any)?.causesCommentary ?? null,
    forks,
    field_states: fields,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const path = join(OUT_DIR, `${ref}.json`)
  writeFileSync(path, JSON.stringify(doc, null, 2))
  return { ref, written: path, bytes: JSON.stringify(doc, null, 2).length, status: build?.status, passes: passes.length, evidence: evidence.length, missing }
}

async function main() {
  const inputs = JSON.parse(readFileSync(INPUTS, 'utf8'))
  const refs = process.argv.includes('--all')
    ? inputs.measures.map((m: any) => m.ref)
    : [process.argv[2]].filter(Boolean)
  if (!refs.length) { console.error('usage: b14-export.ts <ref> | --all'); process.exit(2) }
  for (const r of refs) {
    const res = await exportOne(r, inputs)
    console.log(res.written
      ? `${res.ref}  ${String(res.bytes).padStart(8)} bytes  status=${res.status}  passes=${res.passes}  evidence=${res.evidence}${res.missing?.length ? `  ⚠ missing passes: ${res.missing.join(',')}` : ''}`
      : `${res.ref}  ${res.note}`)
  }
  await prisma.$disconnect()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
