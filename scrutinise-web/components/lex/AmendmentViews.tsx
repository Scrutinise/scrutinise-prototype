'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §4b (decision 258) — THE THREE VIEWS OF A TEXTUAL AMENDMENT, under the clause on the document view's Text tab:
//
//   As it stands — the held text of the section, unchanged.
//   Marked up    — the held text with omitted words struck through and inserted words underlined, each changed line labelled in words
//                  ("omitted", "inserted", "substituted", "repealed") — never colour alone (§21).
//   As amended   — the held text with the change applied.
//
// Generated from the held text and the clause (lib/lex/textual-amendment-pure.ts), never typed. Where it cannot be drawn — the words are
// not in the held text, the section is not held, the instruction does not name it — the view SAYS SO in words and shows as-it-stands and the
// clause side by side: a finding for the owner, not an error.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { parseAmendments, heldLines, applyAmendments, asItStands, asAmended, targetFor, nonTextualLine, type Amendment, type MarkedLine } from '@/lib/lex/textual-amendment-pure'
import type { DraftProvision } from '@/lib/lex/action-draft-pure'

type Mode = 'stands' | 'marked' | 'amended'
const MODE_WORD: Record<Mode, string> = { stands: 'As it stands', marked: 'Marked up', amended: 'As amended' }

export function useParsedClause(clause: string) {
  return useMemo(() => parseAmendments(clause), [clause])
}

/** The line under the clause when there is nothing textual to mark up. */
export function proposedLine(hasAmendments: boolean, hasNonTextual: boolean): string | null {
  if (hasAmendments) return null
  return hasNonTextual ? 'As proposed — a non-textual modification; nothing to mark up.' : 'As proposed — a new section; nothing to mark up.'
}

export default function AmendmentViews({ clause, provisions, titles, held }: {
  clause: string
  provisions: DraftProvision[]
  titles: Record<string, string | null>
  held: Record<string, { text: string | null; reason: string }>
}) {
  const parsed = useParsedClause(clause)
  const [mode, setMode] = useState<Mode>('marked')
  // one block per amended section, every amendment to it applied in the clause's order
  const groups = useMemo(() => {
    const m = new Map<string, Amendment[]>()
    for (const a of parsed.amendments) { const k = `${a.act.toLowerCase()}|${a.section}`; m.set(k, [...(m.get(k) ?? []), a]) }
    return [...m.values()]
  }, [parsed])
  if (!parsed.amendments.length && !parsed.nonTextual.length && !parsed.unparsed.length) return null

  return (
    <div className="space-y-2" data-amendment-views>
      {parsed.nonTextual.map((n, i) => (
        <p key={`nt${i}`} className="border-l-4 border-zinc-900 pl-2" data-non-textual-line>
          <span className="font-semibold">{n.part != null ? `Subsection (${n.part}): ` : ''}</span>{nonTextualLine(n.subject)} Shown as proposed.
        </p>
      ))}
      {parsed.unparsed.map((u, i) => (
        <p key={`u${i}`} data-amendment-unread><span className="font-semibold">⚠ {u.part != null ? `Subsection (${u.part})` : 'The clause'} could not be read as an amendment:</span> {u.why}. It is shown as proposed — check the clause.</p>
      ))}
      {groups.length > 0 && (
        <div role="group" aria-label="View of the amended text" className="inline-flex rounded border border-zinc-400 overflow-hidden" data-amendment-toggle>
          {(['stands', 'marked', 'amended'] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} data-amendment-mode={m}
              className={`px-2 py-0.5 ${mode === m ? 'bg-zinc-900 text-white font-semibold' : 'bg-white'}`}>{mode === m ? '● ' : '○ '}{MODE_WORD[m]}</button>
          ))}
        </div>
      )}
      {groups.map((g) => <SectionBlock key={`${g[0].act}|${g[0].section}`} amendments={g} mode={mode} provisions={provisions} titles={titles} held={held} />)}
    </div>
  )
}

function SectionBlock({ amendments, mode, provisions, titles, held }: { amendments: Amendment[]; mode: Mode; provisions: DraftProvision[]; titles: Record<string, string | null>; held: Record<string, { text: string | null; reason: string }> }) {
  const a0 = amendments[0]
  const where = `section ${a0.section} of ${a0.act}`
  const by = `amended by ${amendments.map((a) => (a.part != null ? `subsection (${a.part})` : 'the clause')).join(' and ')} of this clause`
  const line = targetFor(a0, provisions.filter((p) => ['amends', 'repeals', 'modifies'].includes(p.relation)), titles)
  const h = line ? held[`${line.docUri}|${line.provisionPath ?? ''}`] : undefined
  const lines = useMemo(() => (h?.text ? heldLines(h.text, a0.section) : []), [h, a0.section])
  const marked = useMemo(() => (lines.length ? applyAmendments(lines, amendments.flatMap((a) => a.ops), `section ${a0.section}`) : null), [lines, amendments, a0.section])
  const clauseText = amendments.map((a) => `${a.part != null ? `(${a.part}) ` : ''}${a.raw}`).join('\n\n')

  const head = <p className="font-semibold" data-amendment-section={a0.section}>{where.replace(/^section/, 'Section')} — {MODE_WORD[mode].toLowerCase()} ({by})</p>
  if (!line) return (
    <div className="rounded border border-zinc-300 p-1.5 space-y-1" data-amendment-block="unmatched">{head}
      <p data-amendment-finding>⚠ The clause amends {where}, but the instruction names no such provision, so its held text was not read and the views cannot be drawn. Add the line “amends {where}” to the instruction.</p>
    </div>
  )
  if (!h?.text) return (
    <div className="rounded border border-zinc-300 p-1.5 space-y-1" data-amendment-block="not-held">{head}
      <p data-amendment-finding>⚠ The held text of {where} could not be read ({h?.reason ?? 'not read'}); the marked-up view cannot be drawn.</p>
    </div>
  )
  const failed = marked!.findings.length > 0
  return (
    <div className="rounded border border-zinc-300 p-1.5 space-y-1" data-amendment-block={failed ? 'finding' : 'drawn'}>
      {head}
      {failed && <ul className="space-y-0.5" data-amendment-findings>{marked!.findings.map((f, i) => <li key={i} data-amendment-finding className="font-semibold">⚠ {f[0].toUpperCase()}{f.slice(1)}</li>)}</ul>}
      {failed && mode !== 'stands'
        ? (
          // a finding: as it stands and the clause side by side, rather than a mark-up that would misstate the change
          <div className="grid sm:grid-cols-2 gap-2" data-amendment-side-by-side>
            <div><p className="font-semibold">As it stands</p><Lines text={asItStands(lines)} /></div>
            <div><p className="font-semibold">The clause</p><pre className="whitespace-pre-wrap font-serif">{clauseText}</pre></div>
          </div>
        )
        : mode === 'stands' ? <Lines text={asItStands(lines)} />
        : mode === 'amended' ? <Lines text={asAmended(marked!)} />
        : <Marked lines={marked!.lines} />}
    </div>
  )
}

function Lines({ text }: { text: string[] }) {
  return <div className="font-serif space-y-0.5" data-amendment-lines>{text.map((t, i) => <p key={i} className={/^\([a-z]{1,2}\)/.test(t) ? 'pl-4' : ''}>{t}</p>)}</div>
}

function Marked({ lines }: { lines: MarkedLine[] }) {
  return (
    <div className="font-serif space-y-0.5" data-amendment-marked>
      {lines.map((l, i) => (
        <p key={i} className={l.at.para ? 'pl-4' : ''} data-marked-change={l.change ?? undefined}>
          {l.label && <span className={l.insertedLine ? 'underline' : ''}>{l.label} </span>}
          {l.segs.map((s, j) => s.k === 'omitted' ? <del key={j} className="line-through">{s.text}</del> : s.k === 'inserted' ? <ins key={j} className="underline decoration-2">{s.text}</ins> : <span key={j}>{s.text}</span>)}
          {l.change && <span className="ml-1 font-sans text-[10px] font-bold uppercase tracking-wide border border-zinc-900 rounded px-1" data-change-word>{l.change}</span>}
        </p>
      ))}
    </div>
  )
}
