'use client'
// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Z §4–§6.1 (decisions 345, 347, 348) — ONE PANEL AT A TIME: the mobile layout, and Focus view on the desktop.
//
// ⚠ ONE COMPONENT TREE FOR BOTH (§5): below 768 px the workspace forces it; on a desktop the "Focus view" toggle chooses it. Same bars, same
//   menu, same gestures (by keyboard on a desktop: ← back, → forward, W opens Where am I?, Esc closes).
// ⚠ THE PAGE SCROLLS NATURALLY: the panel is in the document flow, so the window scrolls, never a fixed-height box inside it. The one exception
//   is Lex (panel 3): a conversation keeps its typing box in view, so that panel is one screen tall (100dvh less the bar and the site header),
//   and, while the keyboard is up, the part the keyboard leaves.
// ⚠ ONE BAR, AT THE BOTTOM (Z1b, decision 353): "Where am I?" on the left, the address on the right. The top bar is gone — Charlie found it was
//   only visible after scrolling all the way back up. Tapping the address opens a panel listing it one line per level, until dismissed.
// ⚠ THE BAR HUGS THE SCREEN'S BOTTOM EDGE (Z1b): `position: fixed; bottom: 0` on the LAYOUT viewport, plus the safe-area inset. The visual
//   viewport is read ONLY for the on-screen keyboard (`keyboardLift`), never for browser chrome — in Edge on Android the toolbar sliding away
//   left the bar floating with page content showing beneath it.
// ⚠ Z1c — ON AN iPHONE THE SAFE-AREA PADDING WAS INERT: no viewport-fit=cover, so env(safe-area-inset-bottom) was always 0 and iOS kept the
//   page out of the bottom inset. Lex's route now sets it (lib/lex/viewport.ts). `?where-debug=1` prints the bar's numbers for a screenshot.
// ⚠ EVERY PANEL STAYS MOUNTED (hidden when not shown), so a half-typed message, an open record or a scroll inside a table survives a switch.
// ⚠ STORAGE MAY BE MISSING OR MAY THROW: every read and write goes through `safeStore`; with storage blocked the page works and simply does not
//   restore.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import WhereAmIMenu, { type MenuChapter, type MenuStage } from './WhereAmIMenu'
import { WHERE_DEBUG_PARAM } from '@/lib/lex/viewport'
import { PANEL_WORD, WHERE_UI } from '@/lib/lex/screen-labels'
import {
  PANEL_NUMBERS, STORE_KEY, address, addressLines, addressSpelled, back as histBack, classifySwipe, forward as histForward, isBareUrl, isPanel,
  keyboardLift, panelName, panelOf, parseHistory, parsePosition, parseUrlState, pushPlace, safeStore, samePageExceptPanel, swipeAction, withPanel,
  type Edge, type History, type PanelN, type Position, type UrlState,
} from '@/lib/lex/where-am-i'

const local = safeStore(() => (typeof window === 'undefined' ? null : window.localStorage))
const session = safeStore(() => (typeof window === 'undefined' ? null : window.sessionStorage))

/** A choice made inside a panel (panel 5's chapters and actions) goes through the shell, so it enters the history and back returns to it. */
const FocusNav = createContext<((href: string) => void) | null>(null)

const BOTTOM_BAR_PX = 56

const isTyping = (el: Element | null) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)

export interface FocusShellProps {
  ideaId: string
  stages: MenuStage[]
  chapters: MenuChapter[] | { outside: string }
  /** The seven panels' contents. */
  slots: Record<PanelN, ReactNode>
  /** Told whenever the panel changes (the workspace keeps its own copy for the panels that care, e.g. Lex's focus). */
  onPanel?: (n: PanelN) => void
  /** The height of a sticky header above the shell (the site's own nav), so Lex's top is not drawn under it. Default 0. */
  topInset?: () => number
  /** Where a panel with no remembered scroll opens. Default 0 (the top of the page). On a desktop the workspace passes the workspace's own
   *  top, so the stage bar above it stays out of view until the user scrolls up (Z1b item 4). */
  homeY?: () => number
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

/**
 * Z1b item 4 — the height of the site's sticky header (the `<header>` inside `page`), kept in `--site-header-h` on `page` so the workspace
 * can be exactly one screen tall beneath it. Returns a getter (read at the moment of use, after any resize).
 */
export function useSiteHeader(page: RefObject<HTMLElement | null>): () => number {
  const h = useRef(0)
  useLayoutEffect(() => {
    const root = page.current
    const el = root?.querySelector('header')
    if (!root || !el) return
    const set = () => { h.current = el.offsetHeight; root.style.setProperty('--site-header-h', `${h.current}px`) }
    set()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(set)
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [page])
  return useCallback(() => h.current, [])
}

/** The window scroll that puts `ws`'s top just under a sticky header `inset` tall. */
export function workspaceY(ws: HTMLElement | null, inset: number): number {
  return ws ? Math.max(0, Math.round(ws.getBoundingClientRect().top + window.scrollY - inset)) : 0
}

/**
 * Z1b item 4 — ON A DESKTOP THE PAGE OPENS SCROLLED TO THE WORKSPACE, so the stage bar and the checklist above it are out of view until the
 * user scrolls up. Once, when `ready` first holds. ⚠ A page the browser or the place-restore (§6.1) has already scrolled is left alone; the
 * restore's own scroll runs after this one and wins.
 */
export function useArriveAtWorkspace(ws: RefObject<HTMLElement | null>, ready: boolean, inset: () => number): void {
  const done = useRef(false)
  useLayoutEffect(() => {
    if (done.current || !ready || !ws.current) return
    done.current = true
    if (window.scrollY > 2) return
    window.scrollTo(0, workspaceY(ws.current, inset()))
  }, [ready, ws, inset])
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

export default function FocusShell({ ideaId, stages, chapters, slots, onPanel, topInset, homeY }: FocusShellProps) {
  const [url, setUrl] = useState<UrlState>(() => { const l = here(); return parseUrlState(l.pathname, l.search, l.hash) })
  const panel = panelOf(url)
  const [menu, setMenu] = useState<Edge | null>(null)
  const [explainer, setExplainer] = useState(false)
  /** Z1b item 3 — the address panel: open until dismissed (Close, a second tap on the address, or Esc). */
  const [addrOpen, setAddrOpen] = useState(false)
  const [restored, setRestored] = useState(false)
  const [nothingBack, setNothingBack] = useState(false)
  /** The visual viewport's height and the keyboard's lift (0 unless typing with a keyboard up — `keyboardLift`). */
  const [vv, setVv] = useState<{ h: number; lift: number } | null>(null)
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

  const scrollQuietly = (y: number) => { window.scrollTo(0, y) }

  // ── on arrival: this place enters the history; the address panel opens once, the first time; a remembered scroll comes back ──
  useEffect(() => {
    const start = withPanel(here().pathname, here().search, here().hash, panel)
    window.history.replaceState(window.history.state, '', start)
    hist.current = pushPlace(hist.current, start); saveHist()
    // §2d "spelled out the first time": with the top bar gone (Z1b) the spelling has no line of its own, so the address panel opens once
    if (!local.get(STORE_KEY.addressSeen)) { setAddrOpen(true); local.set(STORE_KEY.addressSeen, '1') }
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

  // ── the scroll is kept per panel (throttled) ──
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => { if (!t) t = setTimeout(() => { t = null; savePos(panelRef.current, window.scrollY) }, 500) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (t) clearTimeout(t) }
  }, [savePos])
  const panelRef = useRef(panel)
  panelRef.current = panel

  // ── the keyboard: while typing, the part of the screen it leaves sizes Lex and lifts the bar. Browser chrome never moves the bar. ──
  useEffect(() => {
    const read = () => {
      const v = window.visualViewport
      const h = v ? v.height : window.innerHeight
      const lift = v ? keyboardLift(window.innerHeight, v.height, v.offsetTop, isTyping(document.activeElement)) : 0
      setVv((p) => (p && p.h === Math.round(h) && p.lift === lift ? p : { h: Math.round(h), lift }))
    }
    read()
    const v = window.visualViewport
    v?.addEventListener('resize', read); v?.addEventListener('scroll', read); window.addEventListener('resize', read)
    document.addEventListener('focusin', read); document.addEventListener('focusout', read)
    return () => {
      v?.removeEventListener('resize', read); v?.removeEventListener('scroll', read); window.removeEventListener('resize', read)
      document.removeEventListener('focusin', read); document.removeEventListener('focusout', read)
    }
  }, [])

  // ── Z1c: `?where-debug=1` prints the bar's numbers on the screen, for a screenshot from an iPhone (no check here runs WebKit on iOS) ──
  const [diag, setDiag] = useState<string | null>(null)
  useEffect(() => {
    let on = false
    try { on = new URLSearchParams(window.location.search).get(WHERE_DEBUG_PARAM) === '1' } catch { on = false }
    if (!on) return
    const read = () => {
      const v = window.visualViewport, bar = document.querySelector('[data-bottom-bar]') as HTMLElement | null
      const r = bar?.getBoundingClientRect()
      const n = (x: number | undefined) => (x == null ? '—' : String(Math.round(x * 10) / 10))
      setDiag([
        `inner ${n(window.innerHeight)} · client ${n(document.documentElement.clientHeight)} · screen ${n(window.screen.height)}`,
        `vv h ${n(v?.height)} · top ${n(v?.offsetTop)} · scale ${n(v?.scale)}`,
        `bar ${n(r?.top)}–${n(r?.bottom)} · pad ${bar ? getComputedStyle(bar).paddingBottom : '—'} · bottom ${bar?.style.bottom || '0'}`,
        `scrollY ${n(window.scrollY)} · ${new Date().toISOString().slice(11, 19)}Z`,
      ].join('\n'))
    }
    read()
    const v = window.visualViewport
    v?.addEventListener('resize', read); v?.addEventListener('scroll', read); window.addEventListener('resize', read); window.addEventListener('scroll', read, { passive: true })
    return () => { v?.removeEventListener('resize', read); v?.removeEventListener('scroll', read); window.removeEventListener('resize', read); window.removeEventListener('scroll', read) }
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
    // Lex: its own top, under the site header; any other panel: where it was left, or (never visited) the workspace's home. Applied once the
    // new panel is DRAWN (the layout effect below) — scrolling before React commits would clamp to the old panel's height.
    pendingScroll.current = n === 3
      ? Math.max(0, (rootRef.current?.offsetTop ?? 0) - (topInset?.() ?? 0))
      : (pos.current?.scroll[n] ?? homeY?.() ?? 0)
    savePos(n)
  }, [savePos, topInset, homeY])
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
      else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); setMenu('bottom') }
      else if (e.key === 'Escape' && addrOpen) { e.preventDefault(); setAddrOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, goBack, goForward, addrOpen])

  const addr = address(url, panel)
  const spelled = addressSpelled(url, panel)
  const lines = addressLines(url, panel)
  const panels = useMemo(() => PANEL_NUMBERS.map((n) => ({ n, name: panelName(n, url), current: n === panel })), [url, panel])
  const lift = vv?.lift ?? 0
  const inset = topInset?.() ?? 0
  // Lex is one screen tall: the dynamic viewport (it follows the browser's toolbar) less the bar and the site header; while the keyboard is
  // up, the visual viewport (what the keyboard leaves) less the bar.
  const lexH = lift > 0 && vv ? `${Math.max(240, vv.h - BOTTOM_BAR_PX - inset)}px` : `max(240px, calc(100dvh - ${BOTTOM_BAR_PX + inset}px - env(safe-area-inset-bottom)))`

  return (
    <div ref={rootRef} data-focus-shell data-panel={panel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="relative w-full">
      {/* the record's sticky jump band (256) and the Organising list's sticky strip stick UNDER the site header, not behind it */}
      <style>{`[data-focus-shell] [data-jump-band],[data-focus-shell] [data-sticky-top]{top:${inset}px}`}</style>
      {(restored || nothingBack) && (
        <p role="status" data-where-toast className="fixed left-1/2 -translate-x-1/2 z-50 rounded-full border-2 border-zinc-900 bg-white px-4 py-2 text-sm font-semibold shadow"
          style={{ top: inset + 8 }}>
          {restored ? WHERE_UI.backWhereYouWere : 'Nothing to go back to yet'}
        </p>
      )}

      {/* ── the panel: one at a time, centred, at most ~760 px; its foot clears the bar ── */}
      <main className="mx-auto w-full max-w-[760px]" style={{ paddingBottom: `calc(${BOTTOM_BAR_PX + 16 + lift}px + env(safe-area-inset-bottom))` }} aria-label={`${WHERE_UI.panel} ${panel} · ${panelName(panel, url)}`}>
        <FocusNav.Provider value={choose}>
        {PANEL_NUMBERS.map((n) => (
          <section key={n} data-focus-panel={n} hidden={n !== panel} aria-label={`${WHERE_UI.panel} ${n} · ${panelName(n, url)}`}
            className={n === 3 ? 'flex flex-col overflow-hidden' : ''}
            style={n === 3 ? { height: lexH } : undefined}>
            <h2 className="sr-only">{PANEL_WORD[n]}</h2>
            {slots[n]}
          </section>
        ))}
        </FocusNav.Provider>
      </main>

      {/* ── Z1b item 3 — the address, one line per level, until dismissed ── */}
      {addrOpen && (
        <section data-address-panel aria-label={WHERE_UI.addressPanelTitle}
          className="fixed inset-x-0 z-40 px-3 pb-2 pointer-events-none"
          style={{ bottom: `calc(${BOTTOM_BAR_PX + lift}px + env(safe-area-inset-bottom))` }}>
          <div className="pointer-events-auto mx-auto max-w-[760px] flex justify-end">
            <div className="w-full max-w-sm rounded-xl border-2 border-zinc-900 bg-white shadow-lg px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-bold text-zinc-900 pt-2.5">{WHERE_UI.addressPanelTitle}</h2>
                <button type="button" onClick={() => setAddrOpen(false)} data-address-close
                  className="min-h-[44px] min-w-[44px] px-3 rounded-full border-2 border-zinc-900 bg-white text-sm font-semibold text-zinc-900">
                  <span aria-hidden>✕ </span>{WHERE_UI.close}
                </button>
              </div>
              <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-zinc-900" data-address-lines>
                {lines.map((l) => (
                  <li key={l.code} data-address-line={l.code}><span className="font-bold tabular-nums">{l.code}:</span> {l.text}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {diag && <pre data-where-debug aria-hidden className="fixed left-1 top-1 z-50 pointer-events-none rounded border border-zinc-900 bg-white/90 p-1 text-[10px] leading-tight text-zinc-900">{diag}</pre>}
      {/* ── the bottom bar: Where am I? on the left, the address on the right. Fixed to the LAYOUT viewport's foot; only a keyboard lifts it. ── */}
      <div data-bottom-bar className="fixed inset-x-0 z-40 bg-white border-t-2 border-zinc-900"
        style={{ bottom: lift, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-[760px] flex items-center justify-between gap-2 px-4" style={{ height: BOTTOM_BAR_PX }}>
          <button type="button" onClick={() => setMenu(menu ? null : 'bottom')} aria-expanded={menu === 'bottom'} aria-haspopup="dialog" data-where-button="bottom"
            className="shrink-0 min-h-[44px] px-4 rounded-full border-2 border-zinc-900 bg-white text-sm font-bold text-zinc-900">
            <span aria-hidden>◎ </span>{WHERE_UI.button}
          </button>
          <button type="button" data-address title={spelled} aria-label={`${WHERE_UI.addressLabel}: ${spelled}`} aria-expanded={addrOpen}
            onClick={() => setAddrOpen((o) => !o)}
            className="min-w-0 min-h-[44px] px-3 rounded-lg text-right text-sm font-semibold tabular-nums text-zinc-800 underline decoration-dotted underline-offset-4 truncate">
            {addr}
          </button>
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
