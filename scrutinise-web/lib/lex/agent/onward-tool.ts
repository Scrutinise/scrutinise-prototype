// GRAPH 8 — `statute_onward`: one step of the onward reader (docs/BRIEF_GRAPH_8_ONWARD.md).
//
// Registered in `MODEL_TOOLS` (tools.ts). `tools.ts` imports this module; this module reaches back for
// `untrustedBlock` only inside `run`, so neither file needs the other while loading.

import { z } from 'zod'
import { onwardFrom } from '@/lib/lex/onward'
import {
  ONWARD_RULES, ONWARD_KINDS, CASELAW_KIND, MENTIONS_KIND, STRENGTH_HEADING, ENABLING_ROLE_WORDS, KIND_LABEL, PROVISION_POWER_WORDS,
  PROVISION_POWER_CONFIDENCE, describeOnwardSummary, citingTextForDisplay, zoneLabel, withheldAt,
} from '@/lib/lex/onward-pure'
import type { ToolDefinition, ToolResult } from './types'

const fail = (error: string): ToolResult => ({ ok: false, error })

export const STATUTE_ONWARD_DESCRIPTION =
  'One step outward from an Act or provision: what is made under it, what operates on it (the official record), and what refers to it — '
  + 'each row labelled with its kind and its strength, never merged. Read from a STORED COPY, not live. Pass a row’s `node` back as `target` to take the next step, '
  + 'and pass `depth` as the step number. RULES: ' + ONWARD_RULES.map((r, i) => `(${i + 1}) ${r}`).join(' ')

export const statuteOnward: ToolDefinition = {
  name: 'statute_onward', category: 'search', tier: 'free',
  description: STATUTE_ONWARD_DESCRIPTION,
  schema: z.object({
    target: z.string().min(3).max(200).describe('legislation.gov.uk id such as "ukpga/2010/25" or "ukpga/2010/25/section/20", or a `node` from a previous step'),
    provision: z.string().max(60).optional().describe('optional provision id such as "section-20", if not already in target'),
    kinds: z.array(z.enum(ONWARD_KINDS)).max(ONWARD_KINDS.length).optional().describe(`default: all ${ONWARD_KINDS.length}. made-under (the enacting words name this as the power exercised) is the strongest; enacting-unresolved is for a human to read; cites and enacting-mention are references only`),
    include_mentions: z.boolean().default(false).describe('the target’s name found in running text (not marked up) — weaker than cites, never counted with them; not walked by default'),
    include_case_law: z.boolean().default(false).describe('judgments citing the target — interpretation, never a drafting consequence; not walked by default'),
    depth: z.number().int().min(1).max(12).default(1).describe('which step of the walk this is: 1 for the target itself'),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async run(ctx, { target, provision, kinds, include_mentions, include_case_law, depth, limit }) {
    let r
    try {
      r = await onwardFrom(target, {
        provision, limit, depth,
        kinds: [...(kinds ?? ONWARD_KINDS), ...(include_mentions ? [MENTIONS_KIND] : []), ...(include_case_law ? [CASELAW_KIND] : [])],
      })
    } catch (err) {
      // ⚠ FAILED ≠ EMPTY.
      return fail(`the onward lookup did not complete: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (r.unaddressable) {
      return { ok: true, data: { unaddressable: r.unaddressable.reason, code: r.unaddressable.code, note: 'This is not an empty answer: the question cannot be asked of our records in this form.', freshness: r.freshness.caveat } }
    }
    // ⚠ Rule 2 is ENFORCED here, not only described: past the measured limit a set is counted, never shown.
    const withheld = r.perKind.filter((c) => withheldAt(c.strength, depth) && c.counted > 0)
    const shown = r.rows.filter((row) => !withheldAt(row.strength, depth))
    const words: string[] = []
    const rows = shown.map((row, i) => {
      const display = citingTextForDisplay(row.citingText, row.sourceZone)
      if (display) words.push(`[row ${i + 1}] ${display}`)
      return {
        n: i + 1, node: row.provision, title: row.actTitle ?? undefined, kind: row.kind, kind_reads: KIND_LABEL[row.kind], strength: row.strength,
        heading: STRENGTH_HEADING[row.strength].heading,
        // ⚠ GRAPH 9 §4: a note is not part of the law — said on the row, not only inside the fenced words.
        not_part_of_the_law: row.sourceZone && row.sourceZone !== 'body' ? zoneLabel(row.sourceZone) ?? undefined : undefined,
        // ⚠ GRAPH 9 §2: what the provision named says of itself — low confidence, always.
        provision_confers_power: row.provisionPower
          ? { state: row.provisionPower.state, reads: PROVISION_POWER_WORDS[row.provisionPower.state], basis: row.provisionPower.basis, confidence: PROVISION_POWER_CONFIDENCE }
          : undefined,
        sub_type: row.subType || undefined, changes_the_words: row.changeKind ?? undefined,
        reading: row.changeKind && row.changeKind !== 'textual' ? row.changeReason ?? undefined : undefined,
        bears_on: row.thisEndProvision ?? 'the Act as a whole', scope: row.scope,
        stored_words: row.citingTextState ?? undefined, has_words: display ? true : undefined,
        // ⚠ Decision 271: on made-under / enacting-mention, whether the enacting words name this as the power exercised.
        enabling_role: row.enablingRole ?? undefined,
        enabling_role_reads: row.enablingRole ? ENABLING_ROLE_WORDS[row.enablingRole] : undefined,
        origin: row.origin ?? `unrecognised source: ${row.source}`, source: row.source,
      }
    })
    return {
      ok: true,
      data: {
        target: `${r.target.title ?? r.target.gid}${r.target.provision ? ` ${r.target.provision}` : ''}`,
        depth,
        // The scope split is shown only for a provision: on a whole Act every row bears on it.
        summary: describeOnwardSummary(r.target.provision ? r.perKind : r.perKind.map(({ scope: _s, ...c }) => c)),
        provision_itself: r.targetProvisionPower
          ? { state: r.targetProvisionPower.state, reads: PROVISION_POWER_WORDS[r.targetProvisionPower.state], confidence: PROVISION_POWER_CONFIDENCE }
          : undefined,
        mention_only: r.mentionOnly ?? undefined,
        notes_not_law: r.perKind.some((c) => c.zones && (c.zones.notes || c.zones.undetermined))
          ? r.perKind.filter((c) => c.zones && (c.zones.notes || c.zones.undetermined))
            .map((c) => `${c.kind}: ${c.zones!.notes} of ${c.counted} rows quote an explanatory note, which is not part of the law; ${c.zones!.undetermined} rows’ place in the document was not determined`)
          : undefined,
        weak: depth === 2 && r.perKind.some((c) => c.strength === 'reference' && c.counted > 0)
          ? 'This is depth 2: the references here refer to something that refers to the target. Label them as a weak set for review, if you show them at all.'
          : undefined,
        withheld: withheld.length
          ? withheld.map((c) => `${c.kind}: ${c.counted} rows counted and NOT shown — depth ${depth} is past the limit for this strength. Say the number; do not walk it.`)
          : undefined,
        truncated: r.truncated.filter((t) => t.returned < t.counted),
        not_walked: r.notWalked.length ? r.notWalked : undefined,
        rows,
        freshness: r.freshness.caveat,
        rules: ONWARD_RULES,
        note: r.examined.rowsCounted === 0 ? 'The lookup ran and found no rows of these kinds pointing at this target.' : undefined,
      },
      // The stored words are third-party prose: they leave in their own fenced channel (§4c), loaded lazily
      // so this module does not import `tools.ts` at load time (it will be imported BY it).
      untrusted: words.length
        ? (await import('./tools')).untrustedBlock(ctx, 'stored words from citing and enabling provisions (our extraction; cut short at both ends)', words.join('\n'))
        : undefined,
    }
  },
}
