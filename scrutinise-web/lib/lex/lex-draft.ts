// ─────────────────────────────────────────────────────────────────────────────
// 26-N §6a — LEX DRAFTS INTO ANY FIELD, WHETHER OR NOT ITS STAGE IS OPEN.
//
// Charlie: asked to fill "What it rules out" while it was waiting on Chosen approach, Lex refused. His rule:
// Lex writes the draft and says *"I've put that in as a draft waiting for you — you'll need to complete this
// stage before you can edit it."* ⚠ **The gate controls ACCEPTANCE, not drafting.**
//
// ⚠⚠ DETERMINISTIC, LIKE EVERY OTHER WRITE LEX CAUSES. The platform decides that the user asked for a draft of a
// NAMED field (a drafting verb and the field's label, in the message), tells Lex so, and files the draft itself
// — Lex is never given a way to write anywhere it was not asked to. A field Lex was not asked about is still
// refused, exactly as before.
//
// ⚠ A DRAFT IS NEVER OVER THE USER'S WORDS: it goes through `offerRedraft` (lib/lex/field-machine.ts), which
// becomes the pending proposal only where there is none of the user's text and otherwise sits BESIDE it.
// ⚠ NOTHING IS ACCEPTED. The user accepts, edits or dismisses; for a gated field that happens once the stage is open.
// ─────────────────────────────────────────────────────────────────────────────

import { PAGE_SEQUENCE } from './page1-config'
import { offerRedraft } from './field-machine'
import { validateFieldValue } from './proposal-schema'
import type { CanonicalState } from './page1-config'

/** The kernel text/structured fields Lex may draft on request. Loops, references and derived fields are not here. */
export const DRAFTABLE_FIELDS: ReadonlySet<string> = new Set([
  'summaryDiagnosis', 'whatItRulesOut', 'leverage', 'anticipatedResponses', 'conditionsForSuccess',
  'summaryGuidingPolicy', 'coherenceCheck', 'costSummary', 'summaryCoherentActions',
])

const DRAFT_VERB = /\b(?:draft|write|fill|compose|complete|propose|redraft|put together|come up with|generate)\b/i

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

export interface DraftRequest {
  key: string
  label: string
  /** The stage is not open for this field: an earlier required field is unfinished, or the page is locked. */
  gated: boolean
}

/**
 * Did the user ask Lex to draft a named field? Returns the field, or null. Conservative: a drafting verb AND the
 * field's own label (as the screen prints it) in the same message.
 */
export function requestedDraftField(
  message: string, pages: CanonicalState['pages'],
): DraftRequest | null {
  if (!DRAFT_VERB.test(message)) return null
  const text = ` ${norm(message)} `
  for (const page of PAGE_SEQUENCE) {
    for (const f of page.fields) {
      if (!DRAFTABLE_FIELDS.has(f.key)) continue
      if (!text.includes(` ${norm(f.label)} `)) continue
      const cp = pages.find((p) => p.key === page.key)
      const idx = page.fields.findIndex((x) => x.key === f.key)
      const earlierUnfinished = page.fields.slice(0, idx).some((x) => {
        const cf = cp?.fields.find((y) => y.key === x.key)
        return !!x.required && cf && cf.status !== 'ACCEPTED' && cf.status !== 'SKIPPED'
      })
      return { key: f.key, label: f.label, gated: !cp || cp.status === 'locked' || earlierUnfinished || (!!cp && !cp.reachable) }
    }
  }
  return null
}

/** The block Lex is handed when the user has asked for a draft of a named field. */
export function draftRequestBlock(req: DraftRequest): string {
  const structured = req.key === 'anticipatedResponses'
  return [
    `THE USER HAS ASKED YOU TO DRAFT "${req.label}" (field key "${req.key}").`,
    `Do it now, even though it is not the current field${req.gated ? ' and its stage is not open yet' : ''}: return a proposal with`,
    `proposal.fieldKey "${req.key}" and ${structured ? 'proposal.valueObject (slots avoidance, gaming, enforcementBurden, legalChallenge, politicalAttack)' : 'proposal.valueText'}.`,
    'The platform files it as a DRAFT waiting for them — nothing is accepted — and adds the sentence about where it is.',
    'In chatText, say in one sentence what you drafted. Do NOT say it is saved or accepted, and do NOT refuse because of the stage.',
  ].join('\n')
}

/** The sentence the platform appends — the user's own rule, verbatim for the gated case. */
export function draftFiledSentence(req: DraftRequest): string {
  return req.gated
    ? 'I’ve put that in as a draft waiting for you — you’ll need to complete this stage before you can edit it.'
    : `I’ve put that in as a draft for “${req.label}” — it is waiting for you to accept, edit or dismiss.`
}

/**
 * File Lex's proposal for the requested field as a draft. Returns whether anything was filed. Never throws.
 */
export async function fileLexDraft(
  ideaId: string, req: DraftRequest,
  proposal: { fieldKey?: string; valueText?: string | null; valueObject?: Record<string, unknown> | null; rationale?: string | null } | null | undefined,
): Promise<boolean> {
  try {
    if (!proposal || proposal.fieldKey !== req.key) return false
    const raw = req.key === 'anticipatedResponses' ? proposal.valueObject : proposal.valueText
    const value = validateFieldValue(req.key, raw)
    if (value === undefined || value === null) return false
    const outcome = await offerRedraft(ideaId, req.key, {
      value, againstPolicyId: '', rationale: proposal.rationale?.trim() || 'Drafted by Lex at your request.',
    })
    return outcome === 'proposed' || outcome === 'beside'
  } catch (err) {
    console.error('[lex-draft] filing THREW', { ideaId, key: req.key, error: err instanceof Error ? err.message : err })
    return false
  }
}
