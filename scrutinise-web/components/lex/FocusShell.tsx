'use client'
// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Z §4–§6.1 (decisions 345, 347, 348) — ONE PANEL AT A TIME: the mobile layout, and Focus view on the desktop.
//
// ⚠ ONE COMPONENT TREE FOR BOTH (§5): below 768 px the workspace forces it; on a desktop the "Focus view" toggle chooses it. Same bars, same
//   menu, same gestures (by keyboard on a desktop: ← back, → forward, W opens Where am I?, Esc closes).
// ⚠ THE PAGE SCROLLS NATURALLY: the panel is in the document flow, so the window scrolls, never a fixed-height box inside it. The one exception
//   is Lex (panel 3): a conversation keeps its typing box in view, so that panel is sized to the VISUAL viewport (the part not under the
//   on-screen keyboard) less the two bars, and the bottom bar rides above the keyboard.
// ⚠ THE BARS CARRY ONE BUTTON EACH (345, Charlie's amendment): "Where am I?". The top bar adds the address as text; it hides on scroll down and
//   returns on scroll up. The bottom bar is clear of the home indicator (safe-area inset).
// ⚠ EVERY PANEL STAYS MOUNTED (hidden when not shown), so a half-typed message, an open record or a scroll inside a table survives a switch.
// ⚠ STORAGE MAY BE MISSING OR MAY THROW: every read and write goes through `safeStore`; with storage blocked the page works and simply does not
//   restore.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import WhereAmIMenu, { type MenuChapter, type MenuStage } from './WhereAmIMenu'
import { PANEL_WORD, WHERE_UI } from '@/lib/lex/screen-labels'
import {
  PANEL_NUMBERS, STORE_KEY, address, addressSpelled, back as histBack, classifySwipe, forward as histForward, isBareUrl, isPanel, panelName, panelOf,
  parseHistory, parsePosition, parseUrlState, pushPlace, safeStore, samePageExceptPanel, swipeAction, withPanel,
  type Edge, type History, type PanelN, type Position, type UrlState,
} from '@/lib/lex/where-am-i'

const local = safeStore(() => (typeof window === 'undefined' ? null : window.localStorage))
const session = safeStore(() => (typeof window === 'undefined' ? null : window.sessionStorage))

/** A choice made inside a panel (panel 5's chapters and actions) goes through the shell, so it enters the history and back returns to it. */
const FocusNav = createContext<((href: string) => void) | null>(null)

const TOP_BAR_PX = 48
const BOTTOM_BAR_PX = 56

export interface FocusShellProps {
  ideaId: string
  stages: MenuStage[]
  chapters: MenuChapter[] | { outside: string }
  /** The seven panels' contents. */
  slots: Record<PanelN, ReactNode>
  /** Told whenever the panel changes (the workspace keeps its own copy for the panels that care, e.g. Lex's focus). */
  onPanel?: (n: PanelN) => void
}

/**
 * §6.1 — on arrival, BEFORE the idea is drawn. A BARE link to the idea (`/ideas/create?ideaId=…`, nothing chosen) is sent back to where the
 * user last was on this device, and the shell then says "Back where you were". Anything more in the URL is a choice — the user's or a link's
 * — and wins. Every other arrival records the place, so the next bare link comes back here. Returns true when it is navigating away.
 * Storage blocked: it records nothing and restores nothing, and the page loads as it always has.
 */
export function restoreOnArrival(ideaId: string): boolean {
  const l = window.location
  const saved = parsePosition(local.get(STORE_KEY.position(ideaId)))
  if (saved && isBareUrl(l.pathname, l.search, l.hash) && saved.url !== `${l.pathname}${l.search}`) {
    session.set(STORE_KEY.restored, '1')
    l.replace(saved.url)
    return true
  }
  local.set(STORE_KEY.position(ideaId), JSON.stringify({ url: `${l.pathname}${l.search}${l.hash}`, panel: saved?.panel ?? 2, scroll: saved?.scroll ?? {}, at: new Date().toISOString() }))
  return false
}

const here = () => (typeof window === 'undefined' ? { pathname: '/ideas/create', search: '', hash: '' } : window.location)
const currentUrl = () => { const l = here(); return `${l.pathname}${l.search}${l.hash}` }

/** §4 — a swipe must not fire inside anything that takes its own sideways or text gestures. */
export function swipeExcluded(target: EventTarget | null, root: HTMLElement | null): boolean {
  let el = target instanceof Element ? (target as HTMLElement) : null
  while (el && el !== root) {
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true
    if (el.hasAttribute('data-no-swipe') || el.getAttribute('role') === 'separator' || el.getAttribute('role') === 'dialog') return true
    const cs = getComputedStyle(el)
    if (cs.touchAction === 'none') return true // a drag handle, a board card, the menu's levels
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return true // a table, the board
    el = el.parentElement
  }
  return false
}

export default function FocusShell({ ideaId, stages, chapters, slots, onPanel }: FocusShellProps) {
  const [url, setUrl] = useState<UrlState>(() => { const l = here(); return parseUrlState(l.pathname, l.search, l.hash) })
  const panel = panelOf(url)
  const [menu, setMenu] = useState<Edge | null>(null)
  const [barHidden, setBarHidden] = useState(false)
  const [explainer, setExplainer] = useState(false)
  const [spelledFirst, setSpelledFirst] = useState(false)
  const [showSpelled, setShowSpelled] = useState(false)
  const [restored, setRestored] = useState(false)
  const [nothingBack, setNothingBack] = useState(false)
  const [vv, setVv] = useState<{ h: number; kb: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const hist = useRef<History>(parseHistory(session.get(STORE_KEY.history(ideaId))))
  const pos = useRef<Position | null>(parsePosition(local.get(STORE_KEY.position(ideaId))))

  const saveHist = () => session.set(STORE_KEY.history(ideaId), JSON.stringify(hist.current))
  const savePos = useCallback((p: PanelN, scrollY?: number) => {
    const prev = pos.current
    const scroll = { ...(prev?.scroll ?? {}) }
    if (scrollY != null) scroll[p] = Math.round(scrollY)
    pos.current = { url: currentUrl(), panel: p, scroll, at: new Date().toISOString() }
    local.set(STORE_KEY.position(ideaId), JSON.stringify(pos.current))
  }, [ideaId])

  /** A scroll the page makes itself (a restore) is not the user scrolling: it must not hide the top bar. */
  const quietUntil = useRef(0)
  const scrollQuietly = (y: number) => { quietUntil.current = Date.now() + 700; window.scrollTo(0, y) }

  // ── on arrival: this place enters the history; the address is spelled out once; a remembered scroll comes back ──
  useEffect(() => {
    const start = withPanel(here().pathname, here().search, here().hash, panel)
    window.history.replaceState(window.history.state, '', start)
    hist.current = pushPlace(hist.current, start); saveHist()
    if (!local.get(STORE_KEY.addressSeen)) { setSpelledFirst(true); local.set(STORE_KEY.addressSeen, '1') }
    if (!local.get(STORE_KEY.explainerSeen)) setExplainer(true)
    const wasRestored = session.get(STORE_KEY.restored) === '1'
    session.set(STORE_KEY.restored, null)
    const y = pos.current && pos.current.url === start ? pos.current.scroll[panel] : undefined
    if (y != null && y > 0) {
      // twice: once now, once after late content (the record, the research) has drawn
      requestAnimationFrame(() => scrollQuietly(y))
      setTimeout(() => { if (Math.abs(window.scrollY - y) > 4) scrollQuietly(y) }, 400)
    }
    if (wasRestored || (y != null && y > 0)) { setRestored(true); setTimeout(() => setRestored(false), 2600) }
    savePos(panel)
    const onHash = () => setUrl(parseUrlState(here().pathname, here().search, here().hash))
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- arrival only

  useEffect(() => { onPanel?.(panel) }, [panel, onPanel])

  // ── the top bar hides on scroll down and returns on scroll up; the scroll is kept per panel (throttled) ──
  useEffect(() => {
    let last = window.scrollY
    let t: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      const y = window.scrollY
      if (Date.now() < quietUntil.current) { last = y; return void (t ??= setTimeout(() => { t = null; savePos(panelRef.current, window.scrollY) }, 500)) }
      if (y > last + 6 && y > TOP_BAR_PX * 2) setBarHidden(true)
      else if (y < last - 6 || y <= TOP_BAR_PX) setBarHidden(false)
      last = y
      if (!t) t = setTimeout(() => { t = null; savePos(panelRef.current, window.scrollY) }, 500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (t) clearTimeout(t) }
  }, [savePos])
  const panelRef = useRef(panel)
  panelRef.current = panel

  // ── §4 Lex: the visual viewport (what the keyboard leaves) sizes panel 3 and lifts the bottom bar ──
  useEffect(() => {
    const v = window.visualViewport
    const read = () => {
      const h = v ? v.height : window.innerHeight
      const kb = v ? Math.max(0, Math.round(window.innerHeight - v.height - v.offsetTop)) : 0
      setVv({ h: Math.round(h), kb })
    }
    read()
    v?.addEventListener('resize', read); v?.addEventListener('scroll', read); window.addEventListener('resize', read)
    return () => { v?.removeEventListener('resize', read); v?.removeEventListener('scroll', read); window.removeEventListener('resize', read) }
  }, [])

  // ── moving ──
  /** Show panel n on this page. `record`: a number opens that record (by `hashchange`, which the Drafting list listens for); null clears the
   *  hash; undefined leaves it. */
  const showPanel = useCallback((n: PanelN, record?: number | null) => {
    savePos(panelRef.current, window.scrollY)
    const l = window.location
    if (typeof record === 'number' && l.hash !== `#${record}`) l.hash = `#${record}`
    window.history.replaceState(window.history.state, '', withPanel(l.pathname, l.search, l.hash, n, record))
    setUrl(parseUrlState(l.pathname, l.search, l.hash))
    // Lex: its own top under the top bar; any other panel: where it was left. Applied once the new panel is DRAWN (the layout effect
    // below) — scrolling before React commits would clamp to the old panel's height.
    pendingScroll.current = n === 3 ? Math.max(0, rootRef.current?.offsetTop ?? 0) : (pos.current?.scroll[n] ?? 0)
    setBarHidden(false) // a new panel: the bar (and the address) comes back
    savePos(n)
  }, [savePos])
  const pendingScroll = useRef<number | null>(null)
  useLayoutEffect(() => {
    const y = pendingScroll.current
    if (y == null) return
    pendingScroll.current = null
    scrollQuietly(y)
  }, [panel, url.record])

  /** Go to a URL: on this page, without a load (panel and record only); anywhere else, a navigation. */
  const goUrl = useCallback((target: string) => {
    setMenu(null)
    if (samePageExceptPanel(currentUrl(), target)) {
      const [pq, frag = ''] = target.split('#')
      const p = Number(new URLSearchParams(pq.split('?')[1] ?? '').get('panel'))
      showPanel(isPanel(p) ? p : 6, /^\d+$/.test(frag) ? Number(frag) : null)
      return
    }
    savePos(panelRef.current, window.scrollY)
    window.location.assign(target)
  }, [savePos, showPanel])

  /** A choice the user made: it goes into the history (anything forward of here is dropped). */
  const choose = useCallback((target: string) => {
    hist.current = pushPlace(hist.current, target); saveHist()
    goUrl(target)
  }, [goUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  const choosePanel = useCallback((n: PanelN) => { const l = here(); choose(withPanel(l.pathname, l.search, l.hash, n)) }, [choose])

  const goBack = useCallback(() => {
    const r = histBack(hist.current)
    if (!r.url) { setNothingBack(true); setTimeout(() => setNothingBack(false), 1800); return }
    hist.current = r.h; saveHist(); goUrl(r.url)
  }, [goUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  const goForward = useCallback(() => {
    const r = histForward(hist.current)
    if (!r.url) { setMenu('bottom'); return }
    hist.current = r.h; saveHist(); goUrl(r.url)
  }, [goUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── §4 gestures: left = back; right = forward, else Where am I? ──
  const touch = useRef<{ x: number; y: number; t: number; excluded: boolean } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || menu) { touch.current = null; return }
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), excluded: swipeExcluded(e.target, rootRef.current) }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    if (!s || s.excluded) return
    const t = e.changedTouches[0]
    const sw = classifySwipe(t.clientX - s.x, t.clientY - s.y, Date.now() - s.t)
    if (!sw) return
    const act = swipeAction(sw, hist.current)
    if (act === 'back') goBack()
    else if (act === 'forward') goForward()
    else if (act === 'menu') setMenu('bottom')
    else { setNothingBack(true); setTimeout(() => setNothingBack(false), 1800) }
  }

  // ── §5 the keyboard: ← back, → forward, W opens Where am I? (never while typing) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || menu) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goBack() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goForward() }
      else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); setMenu('top') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, goBack, goForward])

  const addr = address(url, panel)
  const spelled = addressSpelled(url, panel)
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panels = useMemo(() => PANEL_NUMBERS.map((n) => ({ n, name: panelName(n, url), current: n === panel })), [url, panel])
  const lexH = vv ? Math.max(240, vv.h - TOP_BAR_PX - BOTTOM_BAR_PX) : null

  const whereButton = (edge: Edge) => (
    <button type="button" onClick={() => setMenu(menu ? null : edge)} aria-expanded={menu === edge} aria-haspopup="dialog" data-where-button={edge}
      className="min-h-[44px] px-4 rounded-full border-2 border-zinc-900 bg-white text-sm font-bold text-zinc-900">
      <span aria-hidden>◎ </span>{WHERE_UI.button}
    </button>
  )

  return (
    <div ref={rootRef} data-focus-shell data-panel={panel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ ['--wai-top' as string]: barHidden ? '0px' : `${TOP_BAR_PX}px` }} className="relative w-full">
      {/* the record's sticky jump band (256) and the Organising list's sticky strip sit UNDER the top bar, not behind it */}
      <style>{`[data-focus-shell] [data-jump-band],[data-focus-shell] [data-sticky-top]{top:var(--wai-top)}`}</style>

      {/* ── the top bar: Where am I? and the address ── */}
      <div data-top-bar data-hidden={barHidden ? 'true' : undefined}
        className="sticky top-0 z-40 bg-white border-b-2 border-zinc-900 transition-transform duration-200"
        style={{ height: TOP_BAR_PX, transform: barHidden ? 'translateY(-100%)' : undefined }}>
        <div className="mx-auto max-w-[760px] h-full flex items-center gap-2 px-4">
          {whereButton('top')}
          <span className="relative flex-1 min-w-0" >
            <span data-address title={spelled} aria-label={`${WHERE_UI.addressLabel}: ${spelled}`} tabIndex={0}
              onFocus={() => setShowSpelled(true)} onBlur={() => setShowSpelled(false)}
              onMouseEnter={() => setShowSpelled(true)} onMouseLeave={() => setShowSpelled(false)}
              onTouchStart={() => { longPress.current = setTimeout(() => setShowSpelled(true), 500) }}
              onTouchEnd={() => { if (longPress.current) clearTimeout(longPress.current); setTimeout(() => setShowSpelled(false), 1800) }}
              className="block truncate text-sm font-semibold tabular-nums text-zinc-800">
              {addr}
              {spelledFirst && <span className="ml-2 font-normal text-zinc-600" data-address-spelled>{spelled}</span>}
            </span>
            {showSpelled && !spelledFirst && (
              <span role="tooltip" data-address-tooltip className="absolute left-0 top-full mt-1 z-50 max-w-[90vw] rounded-md border-2 border-zinc-900 bg-white px-2 py-1 text-xs text-zinc-900 shadow">{spelled}</span>
            )}
          </span>
        </div>
      </div>

      {(restored || nothingBack) && (
        <p role="status" data-where-toast className="fixed left-1/2 -translate-x-1/2 z-50 rounded-full border-2 border-zinc-900 bg-white px-4 py-2 text-sm font-semibold shadow"
          style={{ top: TOP_BAR_PX + 8 }}>
          {restored ? WHERE_UI.backWhereYouWere : 'Nothing to go back to yet'}
        </p>
      )}

      {/* ── the panel: one at a time, centred, at most ~760 px ── */}
      <main className="mx-auto w-full max-w-[760px]" style={{ paddingBottom: BOTTOM_BAR_PX + 16 + (vv?.kb ?? 0) }} aria-label={`${WHERE_UI.panel} ${panel} · ${panelName(panel, url)}`}>
        <FocusNav.Provider value={choose}>
        {PANEL_NUMBERS.map((n) => (
          <section key={n} data-focus-panel={n} hidden={n !== panel} aria-label={`${WHERE_UI.panel} ${n} · ${panelName(n, url)}`}
            className={n === 3 ? 'flex flex-col overflow-hidden' : ''}
            style={n === 3 && lexH ? { height: lexH } : undefined}>
            <h2 className="sr-only">{PANEL_WORD[n]}</h2>
            {slots[n]}
          </section>
        ))}
        </FocusNav.Provider>
      </main>

      {/* ── the bottom bar: Where am I? only, above the home indicator and above the keyboard ── */}
      <div data-bottom-bar className="fixed inset-x-0 z-40 bg-white border-t-2 border-zinc-900"
        style={{ bottom: vv?.kb ?? 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-[760px] flex items-center justify-center px-4" style={{ height: BOTTOM_BAR_PX }}>
          {whereButton('bottom')}
        </div>
      </div>

      {menu && (
        <WhereAmIMenu edge={menu} stages={stages} chapters={chapters} panels={panels}
          explainerOpen={explainer}
          onExplainer={(o) => { setExplainer(o); if (!o) local.set(STORE_KEY.explainerSeen, '1') }}
          onGoPanel={(n) => { setMenu(null); choosePanel(n) }}
          onGoHref={(href) => choose(href)}
          onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

// ── Panel 5 — the chapters, and under Organising and Drafting the actions, each opening in panel 6 ─────────────────────────────────────

export function ChaptersPanel({ chapters, actions }: {
  chapters: MenuChapter[]
  /** The live actions, shown under the current chapter when it is Organising or Drafting. */
  actions: Array<{ number: number | null; title: string | null; statement: string; href: string }> | null
}) {
  const nav = useContext(FocusNav)
  const onGo = (href: string) => (nav ? nav(href) : window.location.assign(href))
  return (
    <div className="px-4 py-3" data-chapters-panel>
      <ol className="space-y-1.5">
        {chapters.map((c) => (
          <li key={c.n}>
            {c.href ? (
              <a href={c.href} onClick={(e) => { e.preventDefault(); onGo(c.href!) }} data-chapter-item={c.n} {...(c.current ? { 'aria-current': 'step' as const } : {})}
                className={`block min-h-[44px] rounded-lg px-3 py-2 ${c.current ? 'border-2 border-zinc-900 bg-white font-bold' : 'border border-zinc-200 bg-white'}`}>
                <span aria-hidden>{c.mark}</span> {c.n}. {c.label}
                {c.current && <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide">· {WHERE_UI.youAreHere}</span>}
                <span className="block text-xs font-normal text-zinc-600">{c.state}</span>
              </a>
            ) : (
              <span data-chapter-item={c.n} className="block min-h-[44px] rounded-lg px-3 py-2 border border-dashed border-zinc-200 text-zinc-500">
                <span aria-hidden>{c.mark}</span> {c.n}. {c.label}<span className="block text-xs">{c.state}</span>
              </span>
            )}
            {c.current && actions && actions.length > 0 && (
              <ul className="mt-1 ml-3 space-y-1" aria-label={WHERE_UI.chaptersOfActions} data-chapter-actions>
                {actions.map((a) => (
                  <li key={a.href}>
                    <a href={a.href} onClick={(e) => { e.preventDefault(); onGo(a.href) }} data-chapter-action={a.number ?? ''}
                      className="flex gap-2 min-h-[44px] items-center rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
                      <span className="tabular-nums text-zinc-500 w-9 shrink-0">#{a.number ?? '?'}</span>
                      <span className="min-w-0 truncate">{a.title?.trim() || a.statement}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
