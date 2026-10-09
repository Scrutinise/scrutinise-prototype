'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-E §3d (built in 26-R) — "ADD SOURCE" IN EVERY EDITABLE BOX IN THE MIDDLE PANEL.
//
// A drop-in for `<textarea>`: the same props, plus a small "Add source" menu beneath it listing the idea's numbered sources in number
// order. Choosing one INSERTS ITS REFERENCE, `[Ref: n]`, AT THE CURSOR (or replaces the selection). Anything in the draft that rests
// on a source then shows that number, and the number is the registry's — the same one the notebook and the documents cite.
//
// ⚠ THE IDEA ID COMES FROM CONTEXT (`IdeaIdContext`, provided once by FieldsPanel), so the twelve boxes in nine sub-components do not
//   each have to be handed it. With no context (a surface outside the idea) it is a plain textarea — never a broken menu.
// ⚠ INSERTION GOES THROUGH THE NATIVE VALUE SETTER AND AN `input` EVENT, so a CONTROLLED textarea (every box here is one) receives it
//   as an ordinary change and its own `onChange` runs — nothing is written behind React's back.
// ⚠ THE LIST IS SHARED AND SHORT-LIVED (one fetch per idea per 30 s, however many boxes are on screen), and an unreachable list says
//   so in the menu rather than leaving it empty.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'

export const IdeaIdContext = createContext<string | null>(null)

interface SourceOption { id: string; number: number; title: string }
const cache = new Map<string, { at: number; list: SourceOption[]; inflight?: Promise<SourceOption[]> }>()
const TTL = 30_000

async function loadSources(ideaId: string, force = false): Promise<SourceOption[]> {
  const hit = cache.get(ideaId)
  if (hit && !force && Date.now() - hit.at < TTL) return hit.list
  if (hit?.inflight && !force) return hit.inflight
  const p = fetch(`/api/ideas/${ideaId}/source-registry`)
    .then((r) => r.json())
    .then((j) => (Array.isArray(j.sources) ? (j.sources as SourceOption[]) : []))
  cache.set(ideaId, { at: hit?.at ?? 0, list: hit?.list ?? [], inflight: p })
  const list = await p
  cache.set(ideaId, { at: Date.now(), list })
  return list
}

/**
 * PURE: where a reference goes. Inserted at the cursor, or over the selection; a space is added before it only when the text before
 * it does not already end in whitespace (so "see" + [Ref: 3] reads "see [Ref: 3]", and a reference at the start of a line has none).
 */
export function spliceReference(value: string, start: number, end: number, token: string): { next: string; caret: number } {
  const s = Math.max(0, Math.min(start, value.length)), e = Math.max(s, Math.min(end, value.length))
  const before = value.slice(0, s)
  const after = value.slice(e)
  // a space before, unless the text already ends in one; a space after, unless what follows is whitespace or closing punctuation
  const insert = `${before.length > 0 && !/\s$/.test(before) ? ' ' : ''}${token}${after.length > 0 && !/^[\s.,;:!?)\]]/.test(after) ? ' ' : ''}`
  return { next: `${before}${insert}${after}`, caret: s + insert.length }
}

/** Insert text at the cursor of a controlled textarea so React's own onChange sees it. */
export function insertAtCursor(el: HTMLTextAreaElement, text: string): void {
  const start = el.selectionStart ?? el.value.length
  const { next, caret } = spliceReference(el.value, start, el.selectionEnd ?? start, text)
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter) setter.call(el, next); else el.value = next
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
  el.setSelectionRange(caret, caret)
}

const RefTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function RefTextarea(props, fwd) {
  const ideaId = useContext(IdeaIdContext)
  const inner = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(fwd, () => inner.current as HTMLTextAreaElement)
  const [list, setList] = useState<SourceOption[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!ideaId) return
    try { setList(await loadSources(ideaId)); setFailed(false) } catch { setFailed(true) }
  }, [ideaId])
  useEffect(() => { if (list === null && ideaId && typeof window !== 'undefined') void load() }, [ideaId, list, load])

  if (!ideaId) return <textarea ref={inner} {...props} />
  return (
    <div className="space-y-0.5">
      <textarea ref={inner} {...props} />
      <div className="flex items-center gap-1.5">
        <select
          value=""
          aria-label="Add source — insert a reference at the cursor"
          onFocus={() => void load()}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (inner.current && n) insertAtCursor(inner.current, `[Ref: ${n}]`)
            e.target.value = ''
          }}
          className="text-[11px] border border-zinc-300 rounded px-1 py-0.5 bg-white text-zinc-700 max-w-[14rem]"
        >
          <option value="">+ Add source…</option>
          {failed && <option value="" disabled>(the source list could not be loaded)</option>}
          {list?.length === 0 && <option value="" disabled>(no sources yet — add one under Sources)</option>}
          {(list ?? []).map((s) => <option key={s.id} value={s.number}>[Ref: {s.number}] {s.title.slice(0, 60)}</option>)}
        </select>
      </div>
    </div>
  )
})
export default RefTextarea
