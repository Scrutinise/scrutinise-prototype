// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Z (decisions 344–348) — WHERE AM I? The panels, the address, the menu's order, the swipe rule, the history and the device keys.
//
// ⚠ PURE (CLAUDE.md §28): imports only the label table (itself import-free), so the client shell, the menu and the checks read ONE copy.
// ⚠ THE ADDRESS IS DERIVED FROM THE URL (§2d) — stage, `section`/`view`, `panel`, `#N` — so it is shareable and survives a reload. Nothing
//   here stores where the user is as the source of truth; the device copy (§6.1) only puts a bare URL back where it was.
// ─────────────────────────────────────────────────────────────────────────────

import { CHECKLIST_WORD, LIFECYCLE_STAGE_WORD, PANEL_WORD, WHERE_UI } from './screen-labels'

export type PanelN = 1 | 2 | 3 | 4 | 5 | 6 | 7
export const PANEL_NUMBERS: readonly PanelN[] = [1, 2, 3, 4, 5, 6, 7]
export type PanelPlace = 'top' | 'left' | 'centre' | 'right'

/** §2c — where each panel sits on the desktop. The visual blocks draw this; their text labels say it. */
export const PANEL_PLACE: Record<PanelN, PanelPlace> = { 1: 'top', 2: 'left', 3: 'left', 4: 'left', 5: 'centre', 6: 'centre', 7: 'right' }

export const isPanel = (n: unknown): n is PanelN => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 7

/** 352 — the letter of Development's parts in the address ("E5"). On screen they are elements; in the code, chapters. */
export const ELEMENT_LETTER = 'E'

/** The chapters of Development, in the checklist's order (lib/lex/development.ts `ChecklistKey`). */
export const CHAPTER_KEYS = ['problem', 'causes', 'policy', 'organising', 'drafting', 'deepening', 'promotion'] as const
export type ChapterKey = (typeof CHAPTER_KEYS)[number]
export const chapterNumber = (k: ChapterKey): number => CHAPTER_KEYS.indexOf(k) + 1

/** What the URL says, and nothing else. */
export interface UrlState {
  ideaId: string | null
  /** The screen: `idea` (Creation), `strategy` (Development), `deepening` (Development · The Deepening). */
  screen: 'idea' | 'strategy' | 'deepening'
  section: 'problem' | 'causes' | 'policy' | null
  view: 'organising' | 'drafting' | null
  /** `panel=N`, when the URL names one. */
  panel: PanelN | null
  /** `#N` — a record. */
  record: number | null
}

export function parseUrlState(pathname: string, search: string, hash: string): UrlState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const screen: UrlState['screen'] = pathname.startsWith('/ideas/build') ? 'idea' : q.get('stage') === 'deepening' ? 'deepening' : 'strategy'
  const s = q.get('section')
  const v = q.get('view')
  const p = Number(q.get('panel'))
  const m = /^#(\d+)$/.exec(hash)
  return {
    ideaId: q.get('ideaId'),
    screen,
    section: screen === 'strategy' && (s === 'problem' || s === 'causes' || s === 'policy') ? s : null,
    view: screen === 'strategy' && (v === 'organising' || v === 'drafting') ? v : null,
    panel: isPanel(p) ? p : null,
    record: m ? Number(m[1]) : null,
  }
}

/** The chapter the URL is in, or null (the Development screen with nothing named, or Creation). */
export function chapterOf(u: UrlState): ChapterKey | null {
  if (u.screen === 'deepening') return 'deepening'
  if (u.screen !== 'strategy') return null
  return u.view ?? u.section ?? null
}

/** The lifecycle stage number: Creation is 1; both Development screens are 2. Stages 3–7 have no screen yet. */
export const stageNumberOf = (u: UrlState): 1 | 2 => (u.screen === 'idea' ? 1 : 2)

/** The panel shown when the URL names none: 6 when a chapter or a record is named, otherwise 2 (To-do). */
export function panelOf(u: UrlState): PanelN {
  if (u.panel) return u.panel
  return chapterOf(u) || u.record != null ? 6 : 2
}

/** Panel 6's name: "#38", "Organising the actions", or "The open chapter". (Z1b: "Working on" dropped.) */
export function panelName(n: PanelN, u: UrlState): string {
  if (n !== 6) return PANEL_WORD[n]
  if (u.record != null) return `#${u.record}`
  const c = chapterOf(u)
  return c ? CHECKLIST_WORD[c] : PANEL_WORD[6]
}

/** §2d — "S2 · E5 · P6" (352: the element's letter is E; it was C). The element is left out when none is open ("S2 · P2"). */
export function address(u: UrlState, panel: PanelN = panelOf(u)): string {
  const c = chapterOf(u)
  return [`S${stageNumberOf(u)}`, c ? `${ELEMENT_LETTER}${chapterNumber(c)}` : null, `P${panel}`].filter(Boolean).join(' · ')
}

/** Z1b item 3 — the address one line per level, as the address panel lists it:
 *    S2: Stage 2 Development · E4: Element 4 Organising the actions · P6: Organising the actions
 *  The chapter line is left out when no chapter is open, as in the address itself. */
export function addressLines(u: UrlState, panel: PanelN = panelOf(u)): Array<{ code: string; text: string }> {
  const s = stageNumberOf(u)
  const c = chapterOf(u)
  const out = [{ code: `S${s}`, text: `${WHERE_UI.stage} ${s} ${s === 1 ? LIFECYCLE_STAGE_WORD.creation : LIFECYCLE_STAGE_WORD.development}` }]
  if (c) out.push({ code: `${ELEMENT_LETTER}${chapterNumber(c)}`, text: `${WHERE_UI.chapter} ${chapterNumber(c)} ${CHECKLIST_WORD[c]}` })
  out.push({ code: `P${panel}`, text: panelName(panel, u) })
  return out
}

/** 344 — the address spelled out on one line, for its spoken name and hover title: "Stage 2 Development · Element 5 Drafting · Panel 6 #38". */
export function addressSpelled(u: UrlState, panel: PanelN = panelOf(u)): string {
  const s = stageNumberOf(u)
  const c = chapterOf(u)
  return [
    `${WHERE_UI.stage} ${s} ${s === 1 ? LIFECYCLE_STAGE_WORD.creation : LIFECYCLE_STAGE_WORD.development}`,
    c ? `${WHERE_UI.chapter} ${chapterNumber(c)} ${CHECKLIST_WORD[c]}` : null,
    `${WHERE_UI.panel} ${panel} ${panelName(panel, u)}`,
  ].filter(Boolean).join(' · ')
}

// ── Z1b item 2 — the bottom bar hugs the bottom edge; only the on-screen keyboard lifts it ────────────────────────────────────────────

/** A gap between the layout viewport's foot and the visual viewport's foot smaller than this is browser chrome (Edge's and Chrome's own
 *  bottom toolbar sliding in and out), never a keyboard. Phone keyboards are 250 px and more. */
export const KEYBOARD_MIN_PX = 150

/**
 * How far the bottom bar is lifted off `bottom: 0`. ⚠ ZERO unless the user is TYPING and the gap is keyboard-sized.
 * Found by Charlie on 18 Nov in Edge on Android: the bar was placed from the visual viewport, so when Edge's toolbar slid away the bar
 * stayed where the toolbar's edge had been and page content showed below it. The layout viewport (`position: fixed; bottom: 0`) is what
 * follows the screen's edge; the visual viewport is consulted only for the keyboard.
 */
export function keyboardLift(innerHeight: number, vvHeight: number, vvOffsetTop: number, typing: boolean): number {
  if (!typing) return 0
  const gap = Math.round(innerHeight - vvHeight - vvOffsetTop)
  return gap >= KEYBOARD_MIN_PX ? gap : 0
}

/** A URL with `panel=N` set (or replaced), everything else kept, the hash kept unless `record` says otherwise. */
export function withPanel(pathname: string, search: string, hash: string, panel: PanelN, record?: number | null): string {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  q.set('panel', String(panel))
  const h = record === undefined ? hash : record == null ? '' : `#${record}`
  return `${pathname}?${q.toString()}${h}`
}

/** The URL of a chapter, opened in panel 6 — the checklist's own href plus the panel. */
export function chapterHref(href: string, panel: PanelN = 6): string {
  const [pathAndQuery, frag = ''] = href.split('#')
  const [path, query = ''] = pathAndQuery.split('?')
  return withPanel(path, query, frag ? `#${frag}` : '', panel)
}

/** The URL that opens record #N on the Drafting page, in panel 6. */
export function recordHref(ideaId: string, n: number): string {
  return `/ideas/create?ideaId=${encodeURIComponent(ideaId)}&view=drafting&panel=6#${n}`
}

/** Only the hash differs between two URLs (so the page does not reload; the record opens by `hashchange`). */
export function onlyHashDiffers(a: string, b: string): boolean {
  return a.split('#')[0] === b.split('#')[0] && a !== b
}

/** Two URLs name the same page once `panel` and the hash are set aside — so moving between them needs no page load. Query order ignored. */
export function samePageExceptPanel(a: string, b: string): boolean {
  const norm = (u: string) => {
    const [pq] = u.split('#')
    const [path, query = ''] = pq.split('?')
    const q = new URLSearchParams(query)
    q.delete('panel')
    return `${path}?${[...q.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => `${k}=${v}`).join('&')}`
  }
  return norm(a) === norm(b)
}

// ── §3 — the menu's levels, by the edge it opens from ────────────────────────────────────────────────────────────────────────────────────

export type Level = 'stage' | 'chapter' | 'panel'
export type Edge = 'top' | 'bottom'
/** 346 — from the top, Stage → Chapter → Panel downwards; from the bottom, Panel → Chapter → Stage, so the nearest level is under the thumb. */
export function levelOrder(edge: Edge): Level[] {
  return edge === 'top' ? ['stage', 'chapter', 'panel'] : ['panel', 'chapter', 'stage']
}
/** The level opened first: the one nearest the edge the menu came from. */
export const nearestLevel = (edge: Edge): Level => (edge === 'top' ? 'stage' : 'panel')

// ── §4 — the swipe rule ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A swipe is at least this far sideways… */
export const SWIPE_MIN_PX = 60
/** …at least this many times more sideways than up or down… */
export const SWIPE_RATIO = 1.5
/** …and no slower than this. A slow drag is somebody reading, or selecting text. */
export const SWIPE_MAX_MS = 800

export type Swipe = 'left' | 'right'
export function classifySwipe(dx: number, dy: number, ms: number): Swipe | null {
  if (Math.abs(dx) < SWIPE_MIN_PX) return null
  if (Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return null
  if (ms > SWIPE_MAX_MS) return null
  return dx < 0 ? 'left' : 'right'
}

/** What a swipe does (decision 345, Charlie's amendment): left → back to the last panel chosen; right → forward if any, else Where am I?. */
export function swipeAction(s: Swipe, h: History): 'back' | 'forward' | 'menu' | 'none' {
  if (s === 'left') return canBack(h) ? 'back' : 'none'
  return canForward(h) ? 'forward' : 'menu'
}

// ── §4 — the per-session history of places chosen ────────────────────────────────────────────────────────────────────────────────────

/** A place is a URL that carries its panel (`panel=N`). */
export interface History { entries: string[]; i: number }
export const HISTORY_CAP = 50
export const emptyHistory = (): History => ({ entries: [], i: -1 })
export const canBack = (h: History): boolean => h.i > 0
export const canForward = (h: History): boolean => h.i >= 0 && h.i < h.entries.length - 1
/** A new choice: drops anything forward of here, then adds it — unless it is where we already are. Capped, oldest dropped. */
export function pushPlace(h: History, url: string): History {
  if (h.i >= 0 && h.entries[h.i] === url) return h
  const entries = [...h.entries.slice(0, h.i + 1), url].slice(-HISTORY_CAP)
  return { entries, i: entries.length - 1 }
}
export function back(h: History): { h: History; url: string | null } {
  return canBack(h) ? { h: { ...h, i: h.i - 1 }, url: h.entries[h.i - 1] } : { h, url: null }
}
export function forward(h: History): { h: History; url: string | null } {
  return canForward(h) ? { h: { ...h, i: h.i + 1 }, url: h.entries[h.i + 1] } : { h, url: null }
}
export function parseHistory(raw: string | null): History {
  try {
    const v = raw ? JSON.parse(raw) : null
    if (v && Array.isArray(v.entries) && v.entries.every((e: unknown) => typeof e === 'string') && Number.isInteger(v.i) && v.i < v.entries.length) return { entries: v.entries, i: v.i }
  } catch { /* unreadable: start again */ }
  return emptyHistory()
}

// ── §6 — what is kept on the device, and under which keys ────────────────────────────────────────────────────────────────────────────

export const STORE_KEY = {
  /** 347 — "focus" or "full", per browser. */
  view: 'lex26z.view',
  /** 344 — the address has been spelled out once. */
  addressSeen: 'lex26z.addressSeen',
  /** §3 — the three sentences have been dismissed with "Got it". */
  explainerSeen: 'lex26z.explainerSeen',
  /** §4 — the history of places, per idea, per session (sessionStorage). */
  history: (ideaId: string) => `lex26z.hist.${ideaId}`,
  /** §6.1 — where the user was, per idea. */
  position: (ideaId: string) => `lex26z.pos.${ideaId}`,
  /** §6.1 — the Organising list's own choices (list/board, the find box, the Drafting filter), per idea. */
  organising: (ideaId: string) => `lex26z.org.${ideaId}`,
  /** §6.2 — an unsent draft, per USER, idea and field (CCh 2145Z point 4: another account on the device never sees it). */
  draft: (userId: string, ideaId: string, field: string) => `lex26z.draft.u.${userId}.${ideaId}.${field}`,
  /** The key before 22 Nov (no user): read once, moved to the user's key. */
  legacyDraft: (ideaId: string, field: string) => `lex26z.draft.${ideaId}.${field}`,
  /** One-shot: the page was put back where it was, so say so once it has drawn (sessionStorage). */
  restored: 'lex26z.restored',
} as const

/** §6.1 — the position kept for an idea. */
export interface Position {
  url: string
  panel: PanelN
  /** Window scroll per panel, in Focus view. */
  scroll: Partial<Record<PanelN, number>>
  at: string
}
export function parsePosition(raw: string | null): Position | null {
  try {
    const v = raw ? JSON.parse(raw) : null
    if (v && typeof v.url === 'string' && isPanel(v.panel) && v.scroll && typeof v.scroll === 'object') return { url: v.url, panel: v.panel, scroll: v.scroll, at: String(v.at ?? '') }
  } catch { /* unreadable: nothing to restore */ }
  return null
}

/** §6.1 — a URL is "bare" when it names only the idea: nothing chosen, so a remembered place may be put back. Anything more is the user's
 *  (or a link's) choice and wins. */
export function isBareUrl(pathname: string, search: string, hash: string): boolean {
  if (pathname !== '/ideas/create' || hash) return false
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return [...q.keys()].every((k) => k === 'ideaId') && !!q.get('ideaId')
}

/** Storage that may be missing or may throw (a private window, blocked site data): every read and write is wrapped. */
export interface SafeStore { get(k: string): string | null; set(k: string, v: string | null): void }
export function safeStore(pick: () => Storage | null | undefined): SafeStore {
  return {
    get(k) { try { return pick()?.getItem(k) ?? null } catch { return null } },
    set(k, v) { try { const s = pick(); if (!s) return; if (v == null) s.removeItem(k); else s.setItem(k, v) } catch { /* best effort: it simply will not restore */ } },
  }
}

/** §6.2 — the decision to offer a draft back: there is saved text, it is not blank, and it is not what the box already holds. */
export function shouldOfferDraft(saved: string | null, current: string): saved is string {
  return !!saved && saved.trim().length > 0 && saved !== current
}
