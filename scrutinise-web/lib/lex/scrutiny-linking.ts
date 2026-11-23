// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-AC part (a) (BRIEF_26AC §3; decision 370): THE SOURCE-LINKING EXERCISE. Server only.
//
// Lex PROPOSES links between each section (the idea in one page, a heading, an action, its draft) and the filed sources that support it;
// the owner accepts or rejects each one (proposals beside, never over: a proposal changes nothing until it is accepted). Sections left with
// no link are listed. It runs on a DRAFT edition only, and it is PRICED BEFORE IT RUNS AND ASKS FIRST, as "Draft it" does: the caller
// passes the price the owner agreed, and a run is refused if the price has moved above it.
//
// ⚠ A PROPOSAL MAY NAME ONLY A FILED SOURCE THAT EXISTS AND A SECTION THAT IS IN THE EDITION. Anything else the model returns is dropped,
//   and what was dropped is SAID (in the result's `dropped`), never silently.
// ⚠ THE PRICE IS MEASURED (LINK_RUNS), PER 1,000 WORDS OF WHAT IS SENT. With no measurement the exercise is refused in words ("not offered
//   yet"), never run at a guessed price.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { DRAFT_MODEL } from './action-draft'
import { priceWords } from './document-drafting-pure'
import { loadEdition, viewOf } from './scrutiny-edition'
import { blocksText, linkTargets, linkPrice, type LinkTargetRow } from './scrutiny-linking-pure'
import { PUBLISHED_REFUSED, editionName } from './scrutiny-edition-pure'
import type { Result } from './action-structure'

export { linkPrice, LINK_RUNS } from './scrutiny-linking-pure'

type Call = typeof callModelJson
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

interface LinkAnswer { links: Array<{ target: string; ref: number; claim: string; reason: string }> }

const SCHEMA = {
  type: 'object',
  properties: {
    links: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'The section id exactly as given, e.g. "A:<id>".' },
          ref: { type: 'integer', description: 'The filed source number, [Ref: n].' },
          claim: { type: 'string', description: 'The words in the section this source supports, quoted briefly; empty when it supports the whole section.' },
          reason: { type: 'string', description: 'One sentence: what in the source supports it.' },
        },
        required: ['target', 'ref', 'claim', 'reason'],
      },
    },
  },
  required: ['links'],
}

const SYSTEM = [
  'You link the sections of a policy proposal to the filed sources that SUPPORT them. You never invent a source and never name one that is not listed.',
  'For each section, propose a link only where a listed source, from its title, citation and extract, plainly supports what the section says. A section with no supporting source gets no link: say nothing for it.',
  'Each link names the section id exactly as given and the source number. Keep the claim to a short quotation from the section, or empty for the whole section. The reason is one sentence about the source.',
  'The owner accepts or rejects every proposal, so propose only what you would defend; fewer, better links are worth more than many weak ones.',
].join('\n')

export interface FiledSource { id: string; number: number; title: string; citation: string | null; snippet: string | null }

export async function filedSources(ideaId: string): Promise<FiledSource[]> {
  const rows = await prisma.ideaSource.findMany({ where: { ideaId, archivedAt: null, number: { not: null } }, orderBy: { number: 'asc' }, select: { id: true, number: true, title: true, citation: true, snippet: true } })
  return rows.map((r) => ({ id: r.id, number: r.number!, title: r.title, citation: r.citation, snippet: r.snippet }))
}

/** What the run would send, and its price, without running it: the owner sees this before agreeing. */
export async function linkingEstimate(ideaId: string, editionId: string): Promise<Result<{ sections: number; sources: number; words: number; pence: number | null; priceWords: string | null; basis: string }>> {
  const e = await loadEdition(editionId)
  if (!e || e.ideaId !== ideaId) return fail('That scrutiny edition is not on this idea.')
  if (e.status !== 'DRAFT') return fail(PUBLISHED_REFUSED(e.number))
  const [targets, sources] = [linkTargets(viewOf(e)), await filedSources(ideaId)]
  const prompt = userPrompt(targets, sources)
  const words = prompt.split(/\s+/).filter(Boolean).length
  const p = linkPrice(words)
  return { ok: true, data: { sections: targets.length, sources: sources.length, words, pence: p.pence, priceWords: p.pence == null ? null : priceWords(p.pence), basis: p.basis } }
}

function userPrompt(targets: LinkTargetRow[], sources: FiledSource[]): string {
  return [
    'FILED SOURCES:',
    ...sources.map((s) => `[Ref: ${s.number}] ${s.title}${s.citation ? ` — ${s.citation}` : ''}${s.snippet ? `\n    extract: ${clip(s.snippet.replace(/\s+/g, ' '), 500)}` : ''}`),
    '',
    'SECTIONS:',
    ...targets.map((t) => `<section id="${t.key}">\n${t.label}\n${t.text}\n</section>`),
  ].join('\n')
}

/**
 * Run the exercise on a DRAFT edition. `agreedPence` is the price the owner agreed on the estimate; a run whose price is now higher is
 * refused. Writes PROPOSED links only (never ACCEPTED), skipping any target + source pair the edition already has.
 */
export async function runLinking(ideaId: string, editionId: string, userId: string, agreedPence: number, opts: { call?: Call; measuring?: boolean } = {}): Promise<Result<{ proposed: number; dropped: string[]; unlinked: string[]; pence: number | null }>> {
  const e = await loadEdition(editionId)
  if (!e || e.ideaId !== ideaId) return fail('That scrutiny edition is not on this idea. Nothing was proposed.')
  if (e.status !== 'DRAFT') return fail(PUBLISHED_REFUSED(e.number))
  const targets = linkTargets(viewOf(e))
  const sources = await filedSources(ideaId)
  if (!sources.length) return fail('This idea has no filed sources to link to. File sources first (Sources, on the Development page). Nothing was proposed.')
  if (!targets.length) return fail(`${editionName(e.number)} has no sections to link. Nothing was proposed.`)
  const user = userPrompt(targets, sources)
  const price = linkPrice(user.split(/\s+/).filter(Boolean).length)
  // measuring: scripts/measure-26ac-linking.ts only (the route never passes it) — the run that MAKES the measured price, on a scratch copy
  if (opts.measuring) { /* the price gate is the thing being measured */ } else if (price.pence == null) return fail(`The source-linking exercise is not offered yet: ${price.basis}. Nothing was run.`)
  else if (price.pence > agreedPence + 0.05) return fail(`The price is about ${priceWords(price.pence)}, not the ${priceWords(agreedPence)} you agreed — look again and agree the price. Nothing was run.`)

  const call = opts.call ?? callModelJson
  const res = await call<LinkAnswer>({
    model: DRAFT_MODEL, system: SYSTEM, user, schema: SCHEMA as never, maxOutputTokens: 16_000, timeoutMs: 180_000, reasoningEffort: 'low',
    label: 'scrutiny-linking', stream: 'lex', pass: 'scrutiny.link', ideaId, userId,
  })
  const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: 'scrutiny.link', ideaId, userId, failed: !res.ok }))
  const pence = priced.pence ?? null
  if (!res.ok) return fail(`The source-linking exercise did not complete: ${(res as { detail?: string }).detail ?? (res as { reason?: string }).reason ?? 'no reason given'}. Nothing was proposed.${pence ? ` It cost ${pence.toFixed(1)}p.` : ''}`)

  const byKey = new Map(targets.map((t) => [t.key, t]))
  const byRef = new Map(sources.map((s) => [s.number, s]))
  const have = new Set(e.links.map((l) => `${l.targetKind}:${l.targetId ?? ''}:${l.sourceId}`))
  const dropped: string[] = []
  const rows: Array<{ t: LinkTargetRow; s: FiledSource; claim: string | null; reason: string }> = []
  for (const l of res.value.links ?? []) {
    const t = byKey.get(l.target); const s = byRef.get(l.ref)
    if (!t) { dropped.push(`a link to “${clip(String(l.target), 40)}”, which is not a section of this edition`); continue }
    if (!s) { dropped.push(`a link from ${t.label} to [Ref: ${l.ref}], which is not a filed source`); continue }
    const k = `${t.kind}:${t.id ?? ''}:${s.id}`
    if (have.has(k)) continue
    have.add(k)
    rows.push({ t, s, claim: l.claim?.trim() ? clip(l.claim.trim(), 400) : null, reason: clip(String(l.reason ?? '').trim(), 600) })
  }
  const each = pence != null && rows.length ? Math.round((pence / rows.length) * 100) / 100 : null
  if (rows.length) await prisma.scrutinySourceLink.createMany({ data: rows.map((r) => ({ id: randomUUID(), editionId, targetKind: r.t.kind, targetId: r.t.id, claim: r.claim, sourceId: r.s.id, status: 'PROPOSED', proposedBy: 'LEX', reason: r.reason || null, pence: each })) })
  const linkedKeys = new Set([...rows.map((r) => r.t.key), ...e.links.filter((l) => l.status !== 'REJECTED').map((l) => targets.find((t) => t.kind === l.targetKind && t.id === l.targetId)?.key).filter(Boolean)])
  return { ok: true, data: { proposed: rows.length, dropped, unlinked: targets.filter((t) => !linkedKeys.has(t.key)).map((t) => t.label), pence } }
}

export { blocksText }
