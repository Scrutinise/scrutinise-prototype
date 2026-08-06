// ─────────────────────────────────────────────────────────────────────────────
// §7.1 — render the orientation segments into the Initial Background briefing.
//
// The briefing is sectioned BY STREAM for provenance. Orientation adds three of
// the standard segments, each carrying its §6d.4 tier badge:
//
//   Known issues & current context   (Tier B/C, windowed)
//   Political risks                  (Tier B/C)
//   Arguments and viewpoints         (Tier B/C, all-time)
//
// Output is markdown because that is what `Document.body` stores and what BOTH
// consumers read: the panel (react-markdown) and the docx/PDF exporter
// (lib/documents/markdown.ts). Anything used here must render in all three —
// which rules out blockquotes and tables; see quarantine.ts on the marker.
// ─────────────────────────────────────────────────────────────────────────────

import type { ArgumentItem, OrientationResult, RecencyItem, VoiceItem } from './types'
import { TIER_C_EXPLAINER, assertQuarantine, tierMark } from './quarantine'

/** A link only when the URL is real; never a bare "(source)" that goes nowhere. */
function link(label: string, url: string): string {
  return url ? `[${label}](${url})` : label
}

function recencyLine(i: RecencyItem): string {
  const mark = tierMark(i.tier)
  const detail = i.detail && i.detail !== i.headline ? ` — ${i.detail}` : ''
  return `- **${mark}** ${i.date} — ${i.headline}${detail} (${link(i.source.label, i.source.url)})`
}

function voiceLine(v: VoiceItem): string {
  return `- **${tierMark(v.tier)}** ${v.who} — ${v.position} (${v.date}, ${link(v.source.label, v.source.url)})`
}

function argumentLine(a: ArgumentItem): string {
  const seen = a.repetitions > 1 ? ` _(seen ${a.repetitions}× — how widely it circulates, not how strong it is)_` : ''
  const reason = a.reason ? ` Because: ${a.reason}` : ''
  return `- **${tierMark(a.tier)}** ${a.claim}${reason} — ${a.source.label}, ${a.date} (${link('post', a.source.url)})${seen}`
}

const STANCE_LABEL = { for: 'For', against: 'Against', nuanced: 'Nuanced' } as const

/**
 * Build the orientation segments. Returns '' when there is nothing to show —
 * the caller then renders nothing rather than an empty heading.
 *
 * `failedNote` is deliberately separate from "found nothing": a layer that did
 * not run must never read as a quiet area (§19-C 1a).
 */
export function renderOrientationSegments(o: OrientationResult): string {
  const parts: string[] = []
  const { recency, comparative, argumentsMined } = o

  const currentContext = [...recency.recentDevelopments, ...recency.liveControversies]
    .sort((a, b) => b.date.localeCompare(a.date))

  // ── Known issues & current context ──────────────────────────────────────────
  parts.push('', `### Known issues & current context (last ${o.recencyDays} days)`)
  if (currentContext.length || recency.whoIsTalking.length) {
    if (currentContext.length) parts.push(...currentContext.map(recencyLine))
    if (recency.whoIsTalking.length) {
      parts.push('', '**Who is engaging with this:**')
      parts.push(...recency.whoIsTalking.map(voiceLine))
    }
    parts.push('', `_Salience ${recency.salience}/3 — how live this is right now._`)
  } else if (o.failed) {
    parts.push('- The current-context pass did not complete, so this section is empty for that reason and not because nothing is happening. It can be re-run.')
  } else {
    parts.push(`- The current-context pass ran and found nothing dated in the last ${o.recencyDays} days.`)
  }

  // ── Political risks ─────────────────────────────────────────────────────────
  if (recency.politicalRisks.length) {
    parts.push('', '### Political risks')
    parts.push(...recency.politicalRisks.map(recencyLine))
  }

  // ── Comparative practice (Tier B only) ──────────────────────────────────────
  if (comparative.length) {
    parts.push('', '### How other jurisdictions have handled it')
    for (const c of comparative) {
      const outcome = c.outcome ? ` Outcome: ${c.outcome}` : ''
      parts.push(`- **${tierMark(c.tier)}** ${c.jurisdiction} — ${c.whatTheyDid}${outcome} (${c.date}, ${link(c.source.label, c.source.url)})`)
    }
  }

  // ── Arguments and viewpoints (all-time) ─────────────────────────────────────
  if (argumentsMined.length) {
    parts.push('', '### Arguments and viewpoints')
    for (const stance of ['for', 'against', 'nuanced'] as const) {
      const group = argumentsMined.filter((a) => a.stance === stance)
      if (!group.length) continue
      parts.push('', `**${STANCE_LABEL[stance]}:**`)
      parts.push(...group.map(argumentLine))
    }
  }

  // The explainer appears once, only if Tier C actually reached the page.
  const hasTierC =
    [...currentContext, ...recency.politicalRisks].some((i) => i.tier === 'C') ||
    recency.whoIsTalking.some((v) => v.tier === 'C') ||
    argumentsMined.some((a) => a.tier === 'C')
  if (hasTierC) parts.push('', TIER_C_EXPLAINER)

  return parts.join('\n')
}

/**
 * Render, then PROVE the quarantine on what was rendered, and fail closed.
 *
 * If the sweep finds Tier C text on an unmarked line, the whole orientation
 * block is dropped and replaced with a plain statement of that fact. Shipping a
 * briefing that states a tweet as fact is the one outcome this layer must never
 * have; shipping one without a circulating-arguments section is survivable.
 */
export function renderOrientationChecked(
  o: OrientationResult, summary: string,
): { markdown: string; quarantineOk: boolean; violations: number } {
  const markdown = renderOrientationSegments(o)
  const { ok, violations } = assertQuarantine(markdown, summary, o)
  if (ok) return { markdown, quarantineOk: true, violations: 0 }

  console.error('[orientation] QUARANTINE FAILED — dropping the orientation block', {
    violations: violations.length,
    first: violations[0],
  })
  return {
    markdown: [
      '',
      '### Known issues & current context',
      '- The current-context and circulating-arguments sections were withheld: the provenance check on this run did not pass, and unlabelled social-media content must not appear in a briefing. The corpus sections above are unaffected.',
    ].join('\n'),
    quarantineOk: false,
    violations: violations.length,
  }
}
