// ─────────────────────────────────────────────────────────────────────────────
// 25-Q §1 — THE WRITE THAT AN ACCEPTED REWRITE PERFORMS.
//
// ⚠⚠ IT LIVES HERE SO THE CHECK CAN RUN THE CODE THE ROUTE RUNS. CLAUDE.md §25.3, added last
// sprint: *"Import the function under test; never re-implement it in the check. A
// re-implementation asserts that two pieces of code agree, which they do until one is fixed."*
// The first version of `check:lex-25q` performed the transaction itself and would have gone on
// passing after any change to the real one.
//
// The route keeps auth and validation; this is everything after them.
//
// ⚠ IT RETURNS A REFUSAL RATHER THAN THROWING, and the refusals NAME THE POLICY — "policy 4 was
// rejected since that was written" is something a user can act on; "invalid request" sends them
// looking for a fault that is not there.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { setProposal } from '@/lib/lex/field-machine'
import { EDITABLE_TEXT_FIELDS, EDIT_TARGET_LABELS } from '@/lib/lex/field-edit'
import { validateProposal } from '@/lib/lex/proposal-schema'

export interface FieldEditInput {
  ideaId: string
  userId: string
  kind: 'POLICY_OPTION' | 'TEXT_FIELD'
  fieldKey: string
  number?: number | null
  text: string
}

export type FieldEditResult =
  | { ok: true; wrote: { fieldKey: string; number: number | null; label: string } }
  | { ok: false; status: 404 | 409 | 422; error: string }

/**
 * ⚠⚠ A USER-DEFINED TYPE PREDICATE, NOT `!result.ok`. This project compiles with
 * `strict: false`, under which TypeScript does not narrow a discriminated union on a negated
 * boolean discriminant — so `if (!result.ok) return result.error` is a compile error and the
 * obvious fix (casting) throws the type safety away at the one place it is doing work.
 * The same shape is already used for LLM results elsewhere in this codebase.
 */
export function fieldEditFailed(
  r: FieldEditResult,
): r is Extract<FieldEditResult, { ok: false }> {
  return r.ok === false
}

export async function applyFieldEdit(input: FieldEditInput): Promise<FieldEditResult> {
  const { ideaId: id, userId, kind, fieldKey, number, text } = input
  const label = EDIT_TARGET_LABELS[fieldKey] ?? fieldKey

  // ── A POLICY OPTION, ADDRESSED BY ITS 25-P STABLE NUMBER ───────────────────
  if (kind === 'POLICY_OPTION') {
    if (fieldKey !== 'policyOptions') {
      return { ok: false, status: 422, error: 'That is not a policy field.' }
    }
    if (number == null) {
      return { ok: false, status: 422, error: 'Which one? The offer has to name a policy number.' }
    }
    const row = await prisma.policyOption.findFirst({
      where: { ideaId: id, number },
      select: { id: true, approach: true, source: true, status: true, mergedIntoId: true },
    })
    // ⚠ NAMED REFUSALS. "Policy 4 has been rejected since" is something the user can act on;
    // "invalid request" sends them to look for a fault that is not there.
    if (!row) return { ok: false, status: 404, error: `There is no policy ${number} on this idea.` }
    if (row.mergedIntoId) {
      return {
        ok: false, status: 409,
        error: `Policy ${number} has been merged into another since that was written, so this rewrite no longer has a home.`,
      }
    }
    if (row.status === 'RULED_OUT') {
      return {
        ok: false, status: 409,
        error: `Policy ${number} was rejected since that was written. Restore it first if you want it back.`,
      }
    }
    if (row.approach.trim() === text.trim()) {
      return { ok: false, status: 409, error: 'That is what it already says.' }
    }

    // ⚠⚠ §1d — THE SUPERSEDED TEXT IS KEPT BEFORE IT IS REPLACED, in the same transaction as the
    // replacement. Written afterwards, a failure between the two loses exactly the thing the
    // principle exists to protect.
    await prisma.$transaction([
      prisma.fieldRevision.create({
        data: {
          ideaId: id, fieldKey, targetId: row.id, targetNumber: number,
          previousText: row.approach, previousSource: row.source,
          newText: text, acceptedById: userId, origin: 'CHAT_REWRITE',
        },
      }),
      prisma.policyOption.update({ where: { id: row.id }, data: { approach: text } }),
    ])

    console.log('[lex-diag] 25q chat rewrite accepted', { fieldKey, number, chars: text.length })
    return { ok: true, wrote: { fieldKey, number: number ?? null, label } }
  }

  // ── A WHOLE TEXT FIELD ─────────────────────────────────────────────────────
  if (!EDITABLE_TEXT_FIELDS.has(fieldKey)) {
    return { ok: false, status: 422, error: `${label} cannot be rewritten from the chat.` }
  }
  const existing = await prisma.ideaFieldState.findUnique({
    where: { ideaId_fieldKey: { ideaId: id, fieldKey } },
    select: { value: true, status: true },
  })
  const previous = typeof existing?.value === 'string'
    ? existing.value
    : existing?.value != null ? JSON.stringify(existing.value) : ''

  // ⚠ VALIDATED WITH THE SAME VALIDATOR THE PANEL USES. A rewrite that the panel would reject
  // must not get in through a different door — that asymmetry is exactly what §1a found.
  const valid = validateProposal({ fieldKey, value: text })
  if (!valid) {
    return { ok: false, status: 422, error: `That does not fit ${label} — it was not written.` }
  }

  await prisma.$transaction([
    prisma.fieldRevision.create({
      data: {
        ideaId: id, fieldKey, targetId: null, targetNumber: null,
        previousText: previous,
        // Nothing records who wrote a field's current value, so this says what is known rather
        // than guessing: an accepted field was the user's to accept, a proposal was Lex's draft.
        previousSource: existing?.status === 'ACCEPTED' ? 'USER' : 'LEX',
        newText: String(valid.value), acceptedById: userId, origin: 'CHAT_REWRITE',
      },
    }),
  ])
  // ⚠ IT LANDS AS A PROPOSAL, NOT AS AN ACCEPTED VALUE. The user accepted a REWRITE; the field's
  // own Save is still theirs to press, and short-circuiting it would take away the review step
  // every other route into that box goes through.
  await setProposal(id, fieldKey, { value: valid.value, rationale: 'Rewritten in the chat, at your request.' })

  console.log('[lex-diag] 25q chat rewrite accepted', { fieldKey, chars: text.length })
  return { ok: true, wrote: { fieldKey, number: null, label } }
}
