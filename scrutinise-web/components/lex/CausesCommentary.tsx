'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-O §5 — THE COMMENTARY THAT OPENS THE CAUSES SECTION.
//
// ⚠⚠ IT SITS **ABOVE** THE CAUSES, BEFORE ANY CHOICE IS OFFERED, and that placement is the
// whole feature. §5: the user is asked to choose between causes at a granular level with no
// account of the terrain. A commentary underneath the list is a footnote to a decision already
// made; above it, it is the briefing.
//
// ⚠ THIS IS THE ONE PLACE ON THE SURFACE WHERE §19-E's "AFTER THE WORK, NEVER BEFORE IT" RULE
// IS DELIBERATELY INVERTED, so it is worth saying why. That rule is about Lex's FRAMING — the
// "don't trust any of this" disclaimer, which before the work reads as an excuse and after it
// reads as an invitation to argue. This is not framing. It is the evidence about the choice,
// and evidence handed to somebody after they have chosen is evidence they cannot use.
//
// ⚠⚠ THE CONFLICTS ARE THE PART THAT MUST NOT BE FOLDED AWAY BY DEFAULT. Charlie's own finding
// is the reason this component exists: a single 2014 Lords remark was accepted, used to change
// Lex's mind, and never questioned. A collapsed "disagreements" section is a section nobody
// opens, and the whole point is that the contested evidence meets the reader before the choice.
//
// ⚠ AND IT DESCRIBES; IT DOES NOT DECIDE. Nothing here ranks a cause or recommends one — the
// guiding-policy mechanics land in 25-P (§0), and a commentary that quietly chose would make
// that design a retrofit around something already shipped.
//
// ⚠ NOT A COLOUR (docs/CLAUDE.md §21 — Charlie is colour blind). The complexity verdict is a
// WORD; the conflicts carry a "⚠ against this" label and a left border, never a red tint alone.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import type { CausesCommentary as Commentary } from '@/lib/lex/build-commentary'

/** The three verdicts, as a user reads them. §5: it names the level of complexity. */
const COMPLEXITY: Record<string, { label: string; blurb: string }> = {
  SINGLE_CAUSE: {
    label: 'One cause does most of the work',
    blurb: 'Remove it and the problem largely goes. A strategy can aim at one thing.',
  },
  SEVERAL_BIND: {
    label: 'Several causes each bind',
    blurb: 'Fixing one of these on its own leaves the problem standing. That is a harder strategy, '
      + 'and it is better to know now.',
  },
  UNCLEAR: {
    label: 'The evidence does not settle how many causes bind',
    blurb: 'This is a real answer rather than a gap — it says the next useful step is finding out, '
      + 'not choosing.',
  },
}

export default function CausesCommentaryPanel({ ideaId }: { ideaId: string }) {
  const [data, setData] = useState<{ commentary: Commentary | null; buildVersion: number | null } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/commentary`)
      if (!res.ok) return
      setData(await res.json())
    } catch { /* a commentary that cannot load renders nothing rather than a broken shell */ }
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  // ⚠ NOTHING AT ALL UNTIL THERE IS SOMETHING TO SAY. An empty "the terrain" heading above the
  // causes would be furniture on every idea built before this sprint — and worse, it would read
  // as a section that failed rather than one that has not run.
  if (!data?.commentary) return null
  const c = data.commentary
  const verdict = COMPLEXITY[c.complexity] ?? COMPLEXITY.UNCLEAR

  return (
    <section
      aria-label="Before you choose"
      className="rounded-xl border-2 border-zinc-300 bg-zinc-50/70 p-3 mb-3 space-y-2.5"
    >
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 flex-1">Before you choose</h3>
        {data.buildVersion != null && (
          <span className="text-[11px] text-zinc-500">from build {data.buildVersion}</span>
        )}
      </div>

      <p className="text-sm text-zinc-800 leading-relaxed">{c.terrain}</p>

      {/* ⚠ THE VERDICT IS A SENTENCE, NOT A BADGE. "SEVERAL_BIND" is our word; the thing the
          user needs is what follows from it. */}
      <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold text-zinc-900">{verdict.label}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{verdict.blurb}</p>
        <p className="text-xs text-zinc-700 mt-1.5">{c.complexityWhy}</p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          How the pieces fit
        </p>
        <p className="text-sm text-zinc-700 leading-relaxed mt-0.5">{c.howPiecesFit}</p>
      </div>

      {/* ══ §5 — CONTRARY EVIDENCE, NAMED AS CONTRARY, OPEN BY DEFAULT ══════════ */}
      {c.conflicts.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Where the sources disagree ({c.conflicts.length})
          </p>
          <ul className="mt-1 space-y-2">
            {c.conflicts.map((x, i) => (
              <li key={i} className="border-l-2 border-amber-400 pl-2.5">
                <p className="text-sm text-zinc-800">{x.claim}</p>
                <p className="text-sm text-zinc-700 mt-0.5">
                  <span className="font-medium">⚠ Against this:</span> {x.against}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">{x.whyItMatters}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // ⚠ AN HONEST "NOTHING CONFLICTED", WITH WHAT WAS LOOKED AT. The alternative — saying
        // nothing — is indistinguishable from not having looked, which is exactly the failure
        // §5 exists to fix.
        c.noConflictFound && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Where the sources disagree
            </p>
            <p className="text-sm text-zinc-700 mt-0.5">{c.noConflictFound}</p>
          </div>
        )
      )}

      {/* ⚠ §0/§5 — SAID OUT LOUD, because a well-written briefing reads like a recommendation
          whether or not it is one, and the choice mechanics are not built yet. */}
      <p className="text-[11px] text-zinc-500 border-t border-zinc-200 pt-2">
        This describes the ground; it does not choose for you. The causes below are yours to
        weigh, and you can disagree with any of this.
      </p>
    </section>
  )
}
