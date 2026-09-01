'use client'

import { useEffect, useState } from 'react'

/**
 * ══ 25-Q §1d — WHAT WAS THERE BEFORE, KEPT AND ATTRIBUTED ═══════════════════════════
 *
 * §1d is a standing principle rather than a feature of this sprint: *"the user's own words are
 * testimony, kept verbatim and attributed, never overwritten by an edited version. An accepted
 * rewrite supersedes; it does not delete."*
 *
 * ⚠⚠ SURVIVING IN THE DATABASE IS NOT THE SAME AS SURVIVING. A `FieldRevision` row nobody can
 * see is a record, not testimony — the user has still watched their sentence disappear. This is
 * the half that makes the claim true from the outside.
 *
 * ⚠ CLOSED BY DEFAULT, WITH THE COUNT READABLE WHILE SHUT. The current text is what the panel is
 * for; the history is there for the moment somebody asks "what did I write originally?" — which
 * is a question that gets asked once, urgently, and never otherwise.
 *
 * ⚠ AND IT SAYS WHOSE WORDS THEY WERE. "Your earlier wording" and "Lex's earlier draft" are
 * different facts and only the first is testimony; a history that flattened them would let a
 * later reader treat a model's discarded draft as the proposer's own voice.
 */
export interface PriorVersion {
  id: string
  previousText: string
  previousSource: string
  createdAt: string
}

export function priorVersionLabel(source: string): string {
  return source === 'USER' ? 'Your earlier wording' : 'Lex’s earlier draft'
}

export default function PriorVersions({
  ideaId,
  fieldKey,
  targetId,
  nonce,
}: {
  ideaId: string
  fieldKey: string
  /** The child row, where the field's content lives in one. */
  targetId?: string | null
  /** Bumped by the parent after an accepted rewrite, so the list catches up in place. */
  nonce?: number
}) {
  const [rows, setRows] = useState<PriorVersion[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const qs = new URLSearchParams({ fieldKey, ...(targetId ? { targetId } : {}) })
    fetch(`/api/ideas/${ideaId}/field-edit?${qs}`)
      .then((r) => (r.ok ? r.json() : { revisions: [] }))
      .then((d) => { if (!cancelled) setRows(d.revisions ?? []) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [ideaId, fieldKey, targetId, nonce])

  // ⚠ NOTHING RENDERS WHEN NOTHING HAS BEEN SUPERSEDED. An empty "previous versions" control on
  // every card would be furniture on a screen 25-N spent a sprint clearing.
  if (!rows?.length) return null

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[10px] text-zinc-500 hover:text-zinc-800"
      >
        {/* Two different characters plus a word — never hue alone. */}
        {open ? 'hide −' : 'show +'}{' '}
        {rows.length === 1 ? '1 earlier version, kept' : `${rows.length} earlier versions, kept`}
      </button>
      {open && (
        <ul className="mt-1 space-y-1.5 border-l-2 border-zinc-200 pl-2">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {priorVersionLabel(r.previousSource)}
                {' · '}
                {r.createdAt.slice(0, 10)}
              </div>
              <p className="text-[11px] text-zinc-600 whitespace-pre-wrap leading-relaxed">
                {r.previousText}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
