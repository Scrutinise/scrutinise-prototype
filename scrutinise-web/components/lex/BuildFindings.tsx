'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-F §1 — THE SCREEN THE USER ACTUALLY READS.
//
// ⚠ WHAT WAS HERE BEFORE: NOTHING. `BuildProgress` showed a status badge, one line per
// pass, the summary message, the uncertainties, the forks and the spend. The 70 cited
// findings the build produced — the Lords Constitution Committee's 2012 report, PASC 2014,
// CRaG 2010 ss.1–3 with Explanatory Note paragraph numbers — were in the database and on
// no screen. Charlie read "incentives encourage diffusion of responsibility" and a
// bag-of-words search query, and judged the product on that. He was right to.
//
// THE ORDER ON THIS PAGE IS THE ARGUMENT (§1):
//
//   1. WHAT I DRAFTED — because a build that displays its own working and not its output
//      is misrepresenting itself. ⚠ And it is read from the field PROPOSALS, because the
//      `Idea` columns are empty after a build and correctly so.
//   2. WHAT I'D READ FIRST, and the four judgements — how hard this will be to pass, the
//      barriers, the odds, what is most likely to go wrong.
//   3. CITED FINDINGS AND NAMED SOURCES, ranked. Contradictions lead; a citation beats an
//      abstraction. Everything below the fold is a footnote, not a peer.
//   4. TERMS OF ART — the words the field uses that the proposer had never met, split into
//      what the corpus confirmed and what it could not.
//   5. THE SOURCES, collapsed.
//
// ⚠ AN UNVERIFIED TERM IS RENDERED AS UNVERIFIED, IN AMBER, WITH THE REASON. §2b: kept and
// labelled, never asserted, never dropped. It must not be possible to skim this section and
// come away thinking the corpus confirmed something it did not.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import type { BuildHighlights, HighlightFinding } from '@/lib/lex/build-highlights'

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    CONTRADICTS: 'bg-amber-100 text-amber-900 border-amber-300',
    PRECEDENT: 'bg-violet-50 text-violet-700 border-violet-200',
    SUPPORTS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    COMPARISON: 'bg-sky-50 text-sky-700 border-sky-200',
    FINDING: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  }
  const label = kind === 'CONTRADICTS' ? 'cuts against the draft' : kind.toLowerCase()
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${map[kind] ?? map.FINDING}`}>
      {label}
    </span>
  )
}

function Finding({ f }: { f: HighlightFinding }) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-2 flex-wrap">
        <KindBadge kind={f.kind} />
        {f.headingLabel && (
          <span className="text-[10px] uppercase tracking-wide text-zinc-400">{f.headingLabel}</span>
        )}
      </div>
      <p className="text-sm font-medium text-zinc-900 mt-1">{f.title}</p>
      <p className="text-sm text-zinc-700 whitespace-pre-wrap mt-1 leading-relaxed">{f.body}</p>
      {/* ⚠ THE CITATION IS THE POINT. A finding with a named source is what separates this
          from something the user could have got from a chat window, so it is rendered as
          the source's own words and never paraphrased. A finding with none says nothing
          rather than implying one. */}
      {f.citation && (
        <p className="text-xs text-zinc-500 mt-1.5">
          {f.url ? (
            <a href={f.url} target="_blank" rel="noreferrer" className="underline hover:text-zinc-800">
              {f.citation}
            </a>
          ) : f.citation}
        </p>
      )}
    </li>
  )
}

export default function BuildFindings({ highlights }: { highlights: BuildHighlights }) {
  const [showAll, setShowAll] = useState(false)
  const [showSources, setShowSources] = useState(false)

  const nothing =
    !highlights.drafted.length && !highlights.leading.length
    && !highlights.judgements.length && !highlights.vocabulary.confirmed.length
    && !highlights.changes.length

  if (nothing) {
    // ⚠ AN EMPTY STATE THAT SAYS WHY. A blank panel under a "Done" badge is the shape that
    // made a working build read as a broken one.
    return (
      <div className="mt-4 border border-zinc-200 rounded-2xl px-4 py-3">
        <p className="text-sm text-zinc-600">
          This build finished without producing anything I can show here — no drafted fields and no
          findings were stored against it. That is a fault at our end rather than a statement about your
          idea; the passes above say where it stopped.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 border border-zinc-200 rounded-2xl overflow-hidden">
      {/* ══ 1. What I drafted ══════════════════════════════════════════════ */}
      {highlights.drafted.length > 0 && (
        <section className="px-4 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What I drafted</h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Nothing here is agreed yet — every line is a proposal you can accept, edit or throw out.
          </p>
          <dl className="mt-3 space-y-3">
            {highlights.drafted.map((d) => (
              <div key={d.key}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  {d.label}
                  {d.awaiting && <span className="ml-2 normal-case tracking-normal text-blue-600">proposed</span>}
                </dt>
                <dd className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed mt-0.5">{d.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ══ 2. The judgements — read this first ════════════════════════════ */}
      {highlights.judgements.length > 0 && (
        <section className="px-4 py-4 border-b border-zinc-100 bg-zinc-50/60">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            What I make of it
          </h3>
          <ul className="mt-2 divide-y divide-zinc-200">
            {highlights.judgements.map((f) => (
              <li key={f.id} className="py-2.5">
                <p className="text-sm font-medium text-zinc-900">{f.title}</p>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap mt-1 leading-relaxed">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ══ 3. Cited findings, ranked ══════════════════════════════════════ */}
      {highlights.leading.length > 0 && (
        <section className="px-4 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            What the record actually says
          </h3>
          <ul className="divide-y divide-zinc-100">
            {highlights.leading.map((f) => <Finding key={f.id} f={f} />)}
          </ul>

          {highlights.supporting.length > 0 && (
            <>
              {showAll && (
                <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                  {highlights.supporting.map((f) => <Finding key={f.id} f={f} />)}
                </ul>
              )}
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 text-xs font-medium text-blue-700 hover:underline"
              >
                {showAll
                  ? 'Hide the rest'
                  : `Show ${highlights.supporting.length} more finding${highlights.supporting.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}

          {/* ⚠ THE CUT IS COUNTED. §1 asks for the rubbish to be deleted rather than
              rendered at equal weight — and a silent cut reads as "this is everything
              there was", which is the claim this codebase spends most of its time
              removing. The rows are all still in the evidence panel. */}
          {highlights.demotedCount > 0 && (
            <p className="mt-2 text-[11px] text-zinc-400">
              {highlights.demotedCount} further item{highlights.demotedCount === 1 ? '' : 's'} said
              little more than their own headings and are not shown here. They are still on the idea, in
              the evidence panel.
            </p>
          )}
        </section>
      )}

      {/* ══ 3b. Where the draft moved ══════════════════════════════════════
          ⚠ ITS OWN SECTION, BELOW THE RECORD. These carry no citation because their
          source is a pass rather than a document — and with `CONTRADICTS` outranking
          everything, that combination put eight rows of "the critique rewrote
          summaryDiagnosis" above 56 cited sources on the second full rebuild. §1: cited
          findings and named sources LEAD. This is still the best sentence a build
          produces; it is simply not a finding about the world. */}
      {highlights.changes.length > 0 && (
        <section className="px-4 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Where I changed my mind
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            The research and the critique moved the draft in these places. This is our own working,
            not something the record says — so none of it carries a citation.
          </p>
          <ul className="mt-2 divide-y divide-zinc-100">
            {highlights.changes.map((f) => (
              <li key={f.id} className="py-2.5">
                <p className="text-sm font-medium text-zinc-900">{f.title}</p>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap mt-1 leading-relaxed">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ══ 4. Terms of art ════════════════════════════════════════════════ */}
      {(highlights.vocabulary.confirmed.length > 0 || highlights.vocabulary.unverified.length > 0) && (
        <section className="px-4 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            The words this field actually uses
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Terms of art other models reached for when given your own account. Anything the corpus could
            not confirm is marked — it is a lead worth following, not a finding.
          </p>
          {highlights.vocabulary.confirmed.length > 0 && (
            <ul className="mt-2 space-y-1">
              {highlights.vocabulary.confirmed.map((t) => (
                <li key={t} className="text-sm text-zinc-800">✓ {t}</li>
              ))}
            </ul>
          )}
          {highlights.vocabulary.unverified.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {highlights.vocabulary.unverified.map((u) => (
                <li key={u.term} className="text-sm text-amber-800">
                  <span className="font-medium">Unverified — {u.term}</span>
                  <span className="block text-xs text-amber-700/90">{u.why}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ══ 5. Sources, collapsed ══════════════════════════════════════════ */}
      {highlights.sources.length > 0 && (
        <section className="px-4 py-3">
          <button
            onClick={() => setShowSources((v) => !v)}
            className="text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-800"
          >
            {showSources ? '▾' : '▸'} {highlights.sources.length} source
            {highlights.sources.length === 1 ? '' : 's'} cited
          </button>
          {showSources && (
            <ul className="mt-2 space-y-1">
              {highlights.sources.map((s) => (
                <li key={s.citation} className="text-xs text-zinc-600">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-zinc-900">
                      {s.citation}
                    </a>
                  ) : s.citation}
                  {s.count > 1 && <span className="text-zinc-400"> · cited {s.count} times</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
