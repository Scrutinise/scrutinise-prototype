'use client'
// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Z §3 (decision 346) — THE WHERE AM I? MENU: Stage · Chapter · Panel, as a sheet from the edge it was opened from.
//
// ⚠ ORDER BY EDGE: from the top bar, Stage → Chapter → Panel downwards; from the bottom bar, Panel → Chapter → Stage upwards — the nearest
//   level is always under the thumb. The DOM order IS the visual order, so keyboard and screen-reader order match it (§3, accessibility).
// ⚠ TWO WAYS TO CHOOSE, BOTH ALWAYS WORKING: drag — the finger moves over a level and it opens; lifting on an item goes there — and tap — the
//   first tap on a level opens it, a tap on an item goes. Keyboard: focusing a level opens it; Enter on an item goes.
// ⚠ NEVER COLOUR ALONE (docs/CLAUDE.md §21): the current item carries ● against ○, bold, a 2px border and the words "You are here".
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { PANEL_PLACE_WORD, WHERE_SENTENCES, WHERE_UI } from '@/lib/lex/screen-labels'
import { levelOrder, nearestLevel, PANEL_PLACE, type Edge, type Level, type PanelN } from '@/lib/lex/where-am-i'

export interface MenuStage { n: number; name: string; state: string; href: string | null; current: boolean }
export interface MenuChapter { n: number; label: string; state: string; mark: string; href: string | null; current: boolean }
export interface MenuPanel { n: PanelN; name: string; current: boolean }

export interface WhereAmIMenuProps {
  edge: Edge
  stages: MenuStage[]
  /** Development's seven chapters, or — outside Development — one line saying what that stage holds. */
  chapters: MenuChapter[] | { outside: string }
  panels: MenuPanel[]
  explainerOpen: boolean
  onExplainer: (open: boolean) => void
  onGoPanel: (n: PanelN) => void
  onGoHref: (href: string) => void
  onClose: () => void
}

type ItemKey = string // `stage:2`, `chapter:5`, `panel:3`

/**
 * ⚠ A DRAG THAT CLOSES THE MENU CLOSES IT AFTER THE TOUCH HAS ENDED, not on `pointerup`. `pointerup` arrives before the same touch's
 * `touchend`; unmounting the sheet in between left Chromium's tap detection broken, and the NEXT tap anywhere fired no click (measured 18 Nov:
 * 5 of 5 — pointerdown, pointerup, no click). On a phone that is "I tapped the bar and nothing happened".
 */
const afterTouch = (f: () => void) => { setTimeout(f, 60) }

export default function WhereAmIMenu(p: WhereAmIMenuProps) {
  const order = levelOrder(p.edge)
  const [open, setOpen] = useState<Level>(nearestLevel(p.edge))
  const [hot, setHot] = useState<ItemKey | null>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null)
  const suppressClick = useRef(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const headDrag = useRef<number | null>(null)

  // Escape closes; focus moves into the sheet so a keyboard user starts at its first control.
  // ⚠ THE PAGE BEHIND DOES NOT SCROLL WHILE THE MENU IS OPEN. Measured 18 Nov: without this, swiping the sheet closed scrolled the page under
  //   it by a screen or more — the user's place moved — and the momentum then swallowed the next tap. Locked on open, restored on close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); p.onClose() } }
    window.addEventListener('keydown', onKey)
    sheetRef.current?.querySelector<HTMLElement>('[data-level-head]')?.focus({ preventScroll: true })
    const html = document.documentElement
    const was = { overflow: html.style.overflow, overscroll: html.style.overscrollBehavior }
    html.style.overflow = 'hidden'; html.style.overscrollBehavior = 'none'
    return () => { window.removeEventListener('keydown', onKey); html.style.overflow = was.overflow; html.style.overscrollBehavior = was.overscroll }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- once, on open

  const activate = (key: ItemKey) => {
    const [kind, n] = key.split(':')
    if (kind === 'panel') return p.onGoPanel(Number(n) as PanelN)
    const href = kind === 'stage' ? p.stages.find((s) => String(s.n) === n)?.href : Array.isArray(p.chapters) ? p.chapters.find((c) => String(c.n) === n)?.href : null
    if (href) p.onGoHref(href)
  }

  // ── drag: the finger moves over a level → it opens; over an item → it is marked; lifted on an item → go ──
  const under = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return { level: (el?.closest('[data-level]') as HTMLElement | null)?.dataset.level as Level | undefined, item: (el?.closest('[data-item]') as HTMLElement | null)?.dataset.item }
  }
  const onPointerDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId } }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return
    d.moved = true
    const u = under(e.clientX, e.clientY)
    if (u.level && u.level !== open) setOpen(u.level)
    setHot(u.item ?? null)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || !d.moved) return // a tap: the click handlers decide
    suppressClick.current = true // the click that follows a drag is not a second choice
    setTimeout(() => { suppressClick.current = false }, 0)
    const u = under(e.clientX, e.clientY)
    setHot(null)
    if (u.item) { const item = u.item; afterTouch(() => activate(item)) }
  }

  const levelTitle: Record<Level, string> = { stage: WHERE_UI.stage, chapter: WHERE_UI.chapter, panel: WHERE_UI.panel }
  const currentLine: Record<Level, string> = {
    stage: (() => { const s = p.stages.find((x) => x.current); return s ? `${s.n} ${s.name}` : '—' })(),
    chapter: Array.isArray(p.chapters) ? (() => { const c = p.chapters.find((x) => x.current); return c ? `${c.n} ${c.label}` : 'none open' })() : p.chapters.outside,
    panel: (() => { const x = p.panels.find((q) => q.current); return x ? `${x.n} ${x.name}` : '—' })(),
  }

  const itemClass = (current: boolean, key: ItemKey, enabled = true) =>
    `w-full text-left min-h-[44px] rounded-lg px-3 py-2 ${current ? 'border-2 border-zinc-900 bg-white font-bold' : 'border border-zinc-200 bg-white'} ${hot === key ? 'ring-2 ring-zinc-900' : ''} ${enabled ? '' : 'border-dashed text-zinc-500'}`
  const click = (key: ItemKey) => () => { if (!suppressClick.current) activate(key) }

  const body = (l: Level) => {
    if (l === 'stage') return (
      <ol className="space-y-1" aria-label={WHERE_UI.stage}>
        {p.stages.map((s) => (
          <li key={s.n}>
            <button type="button" data-item={`stage:${s.n}`} onClick={click(`stage:${s.n}`)} disabled={!s.href && !s.current} {...(s.current ? { 'aria-current': 'step' as const } : {})} className={itemClass(s.current, `stage:${s.n}`, !!s.href || s.current)}>
              <span aria-hidden>{s.current ? '●' : '○'}</span> <span>{s.n}. {s.name}</span>
              {s.current && <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide">· {WHERE_UI.youAreHere}</span>}
              <span className="block text-xs font-normal text-zinc-600">{s.state}</span>
            </button>
          </li>
        ))}
      </ol>
    )
    if (l === 'chapter') return Array.isArray(p.chapters) ? (
      <ol className="space-y-1" aria-label={WHERE_UI.chapter}>
        {p.chapters.map((c) => (
          <li key={c.n}>
            <button type="button" data-item={`chapter:${c.n}`} onClick={click(`chapter:${c.n}`)} disabled={!c.href} {...(c.current ? { 'aria-current': 'step' as const } : {})} className={itemClass(c.current, `chapter:${c.n}`, !!c.href)}>
              <span aria-hidden>{c.mark}</span> <span>{c.n}. {c.label}</span>
              {c.current && <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide">· {WHERE_UI.youAreHere}</span>}
              <span className="block text-xs font-normal text-zinc-600">{c.state}</span>
            </button>
          </li>
        ))}
      </ol>
    ) : <p className="text-sm text-zinc-700 px-1">{p.chapters.outside}</p>
    // ── panels: a small picture of the desktop, seven labelled blocks ──
    const block = (n: PanelN, extra = '') => {
      const x = p.panels.find((q) => q.n === n)!
      const label = `${WHERE_UI.panel} ${n} · ${x.name} · ${PANEL_PLACE_WORD[PANEL_PLACE[n]]}`
      return (
        <button key={n} type="button" data-item={`panel:${n}`} data-panel-block={n} onClick={click(`panel:${n}`)} aria-label={label} title={label}
          {...(x.current ? { 'aria-current': 'location' as const } : {})}
          className={`min-h-[44px] rounded-md px-1.5 py-1 text-left text-xs leading-tight ${x.current ? 'border-2 border-zinc-900 bg-zinc-900 text-white font-bold' : 'border-2 border-zinc-300 bg-white text-zinc-800'} ${hot === `panel:${n}` ? 'ring-2 ring-offset-1 ring-zinc-900' : ''} ${extra}`}>
          <span aria-hidden>{x.current ? '●' : '○'} {n}</span> <span>{x.name}</span>
          {x.current && <span className="block text-[10px] uppercase tracking-wide">{WHERE_UI.youAreHere}</span>}
        </button>
      )
    }
    return (
      <div className="grid gap-1 grid-cols-[1fr_1.4fr_1fr]" data-panel-visual aria-label={WHERE_UI.panel}>
        <div className="col-span-3">{block(1, 'w-full')}</div>
        <div className="flex flex-col gap-1">{block(2)}{block(3)}{block(4)}</div>
        <div className="flex flex-col gap-1">{block(5)}{block(6, 'flex-1')}</div>
        <div className="flex flex-col gap-1">{block(7, 'flex-1')}</div>
      </div>
    )
  }

  const sheet = (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={WHERE_UI.button} data-where-menu data-edge={p.edge}
      className={`fixed inset-x-0 ${p.edge === 'top' ? 'top-0 rounded-b-2xl pt-[env(safe-area-inset-top)]' : 'bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]'} z-[61] mx-auto max-w-[760px] max-h-[88vh] overflow-y-auto overscroll-contain bg-zinc-50 border-2 border-zinc-900 shadow-xl`}>
      {/* §3 — "swiping it back": a drag on this header toward the edge it came from closes it (the levels below use drags to choose). */}
      {/* ⚠ TOUCH EVENTS, AND THE BROWSER'S OWN touch-action. Measured 18 Nov: a swipe under `touch-action: none` that closed the sheet left
          Chromium swallowing the NEXT tap (4–5 of 5). Touch events still end when the browser has taken the gesture, so none is needed here. */}
      <div className="flex items-center gap-2 px-3 pt-2" data-where-head
        onTouchStart={(e) => { headDrag.current = e.touches.length === 1 ? e.touches[0].clientY : null }}
        onTouchEnd={(e) => { const y0 = headDrag.current; headDrag.current = null; if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; if ((p.edge === 'top' && dy < -50) || (p.edge === 'bottom' && dy > 50)) afterTouch(p.onClose) }}>
        <h2 className="flex-1 text-sm font-bold text-zinc-900">{WHERE_UI.button}</h2>
        <button type="button" onClick={() => p.onExplainer(!p.explainerOpen)} aria-expanded={p.explainerOpen} aria-label={WHERE_UI.explainLabel} title={WHERE_UI.explainLabel} data-where-explain
          className="min-w-[44px] min-h-[44px] rounded-full border-2 border-zinc-300 bg-white text-sm font-bold">{WHERE_UI.explain}</button>
        <button type="button" onClick={p.onClose} data-where-close className="min-h-[44px] px-3 rounded-full border-2 border-zinc-300 bg-white text-sm font-medium">{WHERE_UI.close}</button>
      </div>
      {p.explainerOpen && (
        <div className="mx-3 mt-2 rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-800 space-y-1" data-where-explainer>
          <p>{WHERE_SENTENCES.stages}</p>
          <p>{WHERE_SENTENCES.chapters}</p>
          <p>{WHERE_SENTENCES.panels}</p>
          <button type="button" onClick={() => p.onExplainer(false)} data-where-got-it className="min-h-[44px] px-4 rounded-full bg-zinc-900 text-white text-sm font-semibold">{WHERE_UI.gotIt}</button>
        </div>
      )}
      {/* The levels: touch-action none so a drag across them is a choice, not a scroll (the sheet fits a 740 px phone with one level open). */}
      <div className="p-3 space-y-2" style={{ touchAction: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; setHot(null) }}>
        {order.map((l) => (
          <section key={l} data-level={l} className={`rounded-xl ${open === l ? 'border-2 border-zinc-900 bg-white' : 'border-2 border-zinc-200 bg-white'}`}>
            <button type="button" data-level-head={l} aria-expanded={open === l} onFocus={() => setOpen(l)} onClick={() => setOpen(l)}
              className="w-full min-h-[44px] flex items-baseline gap-2 px-3 py-2 text-left">
              <span aria-hidden className="text-xs">{open === l ? '▾' : '▸'}</span>
              <span className="text-sm font-bold uppercase tracking-wide text-zinc-900">{levelTitle[l]}</span>
              <span className="flex-1 truncate text-sm text-zinc-700">● {currentLine[l]}</span>
            </button>
            {open === l && <div className="px-2 pb-2">{body(l)}</div>}
          </section>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* Tapping outside closes it. A button, so it is reachable and named — not a div with a click handler. */}
      <button type="button" aria-label={WHERE_UI.close} data-where-backdrop onClick={p.onClose} className="fixed inset-0 z-[60] bg-black/30 cursor-default" style={{ touchAction: 'none' }} tabIndex={-1} />
      {sheet}
    </>
  )
}
