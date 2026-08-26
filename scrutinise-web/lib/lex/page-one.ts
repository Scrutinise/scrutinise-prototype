// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-H §1/§2 — THE ELICITATION IS PAGE ONE, AND IT IS A PROJECTION.
//
// ⚠⚠ THE DEFECT, STATED PRECISELY, BECAUSE THE BRIEF'S VERSION OF IT WAS WRONG AND THE
// CORRECTION IS THE WHOLE DESIGN.
//
// The brief says the old page-one fields sit empty "because nothing writes them any more".
// That is not so: `confirmElicitation` writes both — `submitBox('ideaNarrative', problem)`
// and `submitBox('youAndIdeaNarrative', …)` — and on a genuine walk they hold real content
// (idea 452c5ade: 2,934 and 1,478 characters). The empty boxes Charlie saw came from a
// verification copy whose elicitation was created already-CONFIRMED, which skipped the only
// code that fills them.
//
// **THE REAL DEFECT IS THAT THEY ARE WRITTEN ONCE AND NEVER REFRESHED.** A one-time copy at
// confirm is fine for exactly as long as nothing ever changes afterwards — and §3 is about
// to make every answer editable. Edit the problem through a pill and `ideaNarrative` still
// holds last week's words, silently, with nothing on any screen to say the two disagree.
// Building a better WRITE path would have shipped the same defect with fresher initial data.
//
// So page one is a PROJECTION of the elicitation, recomputed on every canonical-state read.
// The elicitation is the store; these fields are a view of it.
//
// ── §2 — AND THE PROVENANCE RULE, WHICH IS WHY THERE ARE TWO FIELDS AND NOT ONE ──────
//
//   `yourAccount`    THE USER'S OWN WORDS. Verbatim, DERIVED, never editable. This is
//                    testimony: it is what makes the proposal theirs, it is what §24's
//                    reviewers and an MP's office would want to see, and it is the one
//                    thing in the kernel that must survive every rewrite.
//   `ideaNarrative`  THE AGREED STATEMENT. Seeded from the account ONCE as a proposal,
//                    then owned by the user. Editing it never touches the account.
//
// ⚠ ONE FIELD CANNOT DO BOTH. Before this sprint `ideaNarrative` held the verbatim problem
// AND was labelled "The idea" AND was editable — so the first edit destroyed the testimony,
// with no copy anywhere. That is a provenance failure, not a UI preference.
//
// ⚠ AND `youAndIdeaNarrative` IS RETIRED. It mashed the goal, the ruled-outs, the
// own-knowledge and the reading into one blob, which is why Charlie could not find the new
// page-one answers: they were there, concatenated, under a heading naming none of them.
// Retiring a field needs Charlie's explicit instruction (CLAUDE.md §11) and §1 is it.
// `migrateLegacyPageOne` moves any content across before it goes.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { GOAL_KINDS } from './elicitation-config'

/**
 * The page-one fields DERIVED from the elicitation.
 *
 * ⚠ A DERIVED FIELD IS NOT WRITEABLE BY A USER, and `field-machine` enforces it rather
 * than the panel merely declining to render an input. The panel is one caller; the API
 * route is another, and a rule that lives in a component is a rule with a hole in it.
 */
export const DERIVED_PAGE_ONE_FIELDS = [
  'yourAccount', 'yourGoal', 'yourKnowledge', 'yourReading',
] as const

export type DerivedPageOneField = (typeof DERIVED_PAGE_ONE_FIELDS)[number]

export function isDerivedPageOneField(key: string): key is DerivedPageOneField {
  return (DERIVED_PAGE_ONE_FIELDS as readonly string[]).includes(key)
}

/** The field seeded FROM the account and then owned by the user. */
export const AGREED_IDEA_FIELD = 'ideaNarrative'

/** The blob 25-H §1 retires. Kept as a constant so the migration and the checks agree. */
export const RETIRED_PAGE_ONE_FIELD = 'youAndIdeaNarrative'

/** What the elicitation says right now, rendered per field. */
export function projectedValues(row: {
  problem: string | null
  goalKind: string | null
  goalDetail: string | null
  ruledOut: string | null
  ownKnowledge: string | null
  readingUrl: string | null
  readingFileName: string | null
}): Record<DerivedPageOneField, string> {
  const goalLabel = GOAL_KINDS.find((g) => g.key === row.goalKind)?.label
  return {
    // ⚠ VERBATIM. No trimming beyond whitespace, no summary, no prefix. The moment this
    // renders anything but the user's own words it stops being testimony.
    yourAccount: (row.problem ?? '').trim(),
    yourGoal: [
      goalLabel ? `What I want to happen: ${goalLabel}` : '',
      (row.goalDetail ?? '').trim(),
      (row.ruledOut ?? '').trim() ? `Already ruled out: ${(row.ruledOut ?? '').trim()}` : '',
    ].filter(Boolean).join('\n\n'),
    yourKnowledge: (row.ownKnowledge ?? '').trim(),
    // ⚠⚠ 25-H §4 — THIS LINE USED TO PRODUCE "Given to read, NOT yet read by Lex", AND
    // IT WAS TELLING THE TRUTH.
    //
    // The build door's reading step captured a URL string and a FILENAME string onto
    // `IdeaElicitation` and stopped. There was no file input on that screen at all — no
    // bytes were ever transmitted — so nothing was stored, nothing extracted, no findings
    // produced, and none reached any pass. Charlie attached a Word document about private
    // sector accountability and asked afterwards why none of it appeared. It appeared
    // nowhere because it never left his machine.
    //
    // The `IdeaUserMaterial` pipeline that does all of this properly already existed
    // (25-D §4 / §25.6) and was rendered only by `QuestionPanel` on the OLD door. §4's fix
    // is to connect the new door to it, and this field now reports what is actually
    // attached rather than what was typed. `materialSummary` fills it in.
    yourReading: '',
  }
}

/**
 * ⚠⚠ THE REFRESH PATH. Runs on EVERY canonical-state read.
 *
 * Idempotent and cheap: it reads one row, compares four strings, and writes only what
 * differs. The alternative — recomputing the fields at render time without storing them —
 * would have meant every other reader of `IdeaFieldState` (the export, the proposal
 * snapshot, `accepted-context`, the document stack) seeing something different from the
 * panel, which is the disagreement this codebase spends its time removing.
 *
 * ⚠ IT NEVER TOUCHES `ideaNarrative` AFTER THE FIRST SEED. That field is the user's, and
 * the whole point of §2 is that the account and the agreed statement move independently.
 * The seed is a PROPOSAL, so even the first version is something they accept rather than
 * something we assert on their behalf.
 */
export async function projectElicitationOntoPageOne(ideaId: string): Promise<{
  refreshed: DerivedPageOneField[]
  seededAgreedIdea: boolean
}> {
  const row = await prisma.ideaElicitation.findUnique({
    where: { ideaId },
    select: {
      problem: true, goalKind: true, goalDetail: true, ruledOut: true,
      ownKnowledge: true, readingUrl: true, readingFileName: true,
    },
  })
  // No elicitation ⇒ this idea came through the old door and page one is its own. Nothing
  // to project, and projecting emptiness over it would erase a legacy idea's content.
  if (!row) return { refreshed: [], seededAgreedIdea: false }

  const want = projectedValues(row)

  // ⚠ 25-H §4 — WHAT IS ACTUALLY ATTACHED, AND WHAT WAS TAKEN FROM IT. Three states are
  // named apart, exactly as `YourMaterial` names them on screen: read and yielded findings,
  // read and yielded nothing, could not be read at all. A document that failed says so
  // here too, because this field is what the drafting passes see.
  const materials = await prisma.ideaUserMaterial.findMany({
    where: { ideaId },
    select: { label: true, kind: true, status: true, findingCount: true, failureReason: true },
    orderBy: { createdAt: 'asc' },
  })
  if (materials.length) {
    want.yourReading = materials.map((m) => {
      const what = m.kind === 'LINK' ? 'link' : 'document'
      if (m.failureReason) return `⚠ ${m.label} (${what}) — could not be read: ${m.failureReason}`
      if (!m.findingCount) return `${m.label} (${what}) — read, and nothing in it bore on this proposal`
      return `${m.label} (${what}) — read; ${m.findingCount} finding${m.findingCount === 1 ? '' : 's'} taken from it`
    }).join('\n')
  } else if (row.readingUrl || row.readingFileName) {
    // ⚠ THE HONEST SENTENCE FOR THE OLD SHAPE. An idea whose reading step ran before §4
    // has a filename and no document. Saying so is better than showing the filename as
    // though we had read it — which is exactly the silent failure §4 is about.
    want.yourReading =
      `${[row.readingUrl, row.readingFileName].filter(Boolean).join(' · ')} — NAMED but never `
      + 'uploaded, so nothing was read from it. Attach it again and I will read it.'
  }
  const existing = await prisma.ideaFieldState.findMany({
    where: { ideaId, fieldKey: { in: [...DERIVED_PAGE_ONE_FIELDS, AGREED_IDEA_FIELD] } },
    select: { fieldKey: true, status: true, value: true, proposal: true },
  })
  const byKey = new Map(existing.map((r) => [r.fieldKey, r]))

  const refreshed: DerivedPageOneField[] = []
  for (const key of DERIVED_PAGE_ONE_FIELDS) {
    const value = want[key]
    const current = byKey.get(key)
    // An answer the user never gave stays EMPTY rather than becoming an accepted blank —
    // "they skipped this" and "they wrote nothing" are the same on screen, and neither
    // should read as a field they filled in.
    if (!value) {
      if (current && current.status !== 'EMPTY') {
        await prisma.ideaFieldState.update({
          where: { ideaId_fieldKey: { ideaId, fieldKey: key } },
          data: { status: 'EMPTY', value: null, proposal: undefined },
        })
        refreshed.push(key)
      }
      continue
    }
    if (current?.value === value && current.status === 'ACCEPTED') continue
    await prisma.ideaFieldState.upsert({
      where: { ideaId_fieldKey: { ideaId, fieldKey: key } },
      // ⚠ ACCEPTED, NOT AWAITING_CONFIRMATION. These are the user's own words — there is
      // nothing for them to agree to, and a "Proposed by Lex" badge over a sentence they
      // wrote themselves would be the §19-D claim-nobody-made defect inverted.
      update: { status: 'ACCEPTED', value, proposal: undefined },
      create: { ideaId, fieldKey: key, status: 'ACCEPTED', value },
    })
    refreshed.push(key)
  }

  // ── The agreed statement, seeded once. ────────────────────────────────────
  let seededAgreedIdea = false
  const agreed = byKey.get(AGREED_IDEA_FIELD)
  const untouched = !agreed || (agreed.status === 'EMPTY' && !agreed.value)
  if (untouched && want.yourAccount) {
    await prisma.ideaFieldState.upsert({
      where: { ideaId_fieldKey: { ideaId, fieldKey: AGREED_IDEA_FIELD } },
      update: { status: 'AWAITING_CONFIRMATION', proposal: { value: want.yourAccount, rationale: null } },
      create: {
        ideaId, fieldKey: AGREED_IDEA_FIELD, status: 'AWAITING_CONFIRMATION',
        proposal: { value: want.yourAccount, rationale: null },
      },
    })
    seededAgreedIdea = true
  }

  if (refreshed.length || seededAgreedIdea) {
    console.log('[lex-diag] 25h page one projected from the elicitation', {
      ideaId, refreshed, seededAgreedIdea,
    })
  }
  return { refreshed, seededAgreedIdea }
}

/**
 * §1 — "Migrate any content in existing ideas across; report the count."
 *
 * ⚠ IT MOVES CONTENT ONLY WHERE THE PROJECTION CANNOT PRODUCE IT. An idea with an
 * elicitation gets its page one from the projection, which is better than anything the old
 * blob held; the migration is for ideas that have content in the retired field and NO
 * elicitation to project from — the ones made at the old door. Those keep their words, in
 * `yourAccount`, where nothing will overwrite them.
 */
export async function migrateLegacyPageOne(): Promise<{
  examined: number; migrated: number; skipped: number
}> {
  const rows = await prisma.ideaFieldState.findMany({
    where: { fieldKey: RETIRED_PAGE_ONE_FIELD, value: { not: null } },
    select: { ideaId: true, value: true },
  })
  let migrated = 0
  let skipped = 0
  for (const r of rows) {
    const text = (r.value ?? '').trim()
    if (!text) { skipped++; continue }
    const hasElicitation = await prisma.ideaElicitation.findUnique({
      where: { ideaId: r.ideaId }, select: { ideaId: true },
    })
    if (hasElicitation) { skipped++; continue }
    const existing = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId: r.ideaId, fieldKey: 'yourKnowledge' } },
      select: { value: true },
    })
    if (existing?.value?.trim()) { skipped++; continue }
    await prisma.ideaFieldState.upsert({
      where: { ideaId_fieldKey: { ideaId: r.ideaId, fieldKey: 'yourKnowledge' } },
      update: { status: 'ACCEPTED', value: text },
      create: { ideaId: r.ideaId, fieldKey: 'yourKnowledge', status: 'ACCEPTED', value: text },
    })
    migrated++
  }
  return { examined: rows.length, migrated, skipped }
}
