// 26-Z (18 Nov 2026) — THE PAGE THE WHERE-AM-I BROWSER CHECK LOADS (scripts/check-lex-26z.ts bundles this with esbuild and serves it at
// /ideas/create on a stand-in origin, so the URL, a reload, `location.replace` and `hashchange` all behave as on the site).
//
// The REAL FocusShell, WhereAmIMenu, ChaptersPanel, StageBar and ChatPanel (with its device draft) run in a real browser. What stands in is the
// panels' CONTENT: long text so the page scrolls, a horizontally scrollable table (the swipe exclusion), a sticky band (it must sit under
// the top bar), and a stand-in Drafting list that opens "#N" on `hashchange`, as ActionsWorkspace does. `restoreOnArrival` — the same
// function the workspace calls — runs first. Test hooks on `window.__w`: `sent` (every message ChatPanel sent).

import React from 'react'
import { createRoot } from 'react-dom/client'
import FocusShell, { ChaptersPanel, restoreOnArrival, useArriveAtWorkspace, useSiteHeader, workspaceY } from '@/components/lex/FocusShell'
import StageBar from '@/components/lex/StageBar'
import ChatPanel from '@/components/lex/ChatPanel'
import { chapterHref, chapterOf, parseUrlState, recordHref } from '@/lib/lex/where-am-i'
import type { StageContext } from '@/lib/lex/stage-context'

type A = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const hooks: A = { sent: [] as string[] }
;(window as A).__w = hooks
// nothing in the harness has a server: every fetch is answered empty
window.fetch = (async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch

const IDEA = 'fx'
const u = parseUrlState(location.pathname, location.search, location.hash)
const here = chapterOf(u)
const base = `/ideas/create?ideaId=${IDEA}`
const ctx: StageContext = {
  ideaId: IDEA, here: u.screen === 'deepening' ? 'deepening' : 'strategy', current: 'development', stages: [],
  lifecycle: [
    { key: 'creation', n: 1, name: 'Creation', state: 'Lex’s first pass · 2 runs', href: `/ideas/build?ideaId=${IDEA}` },
    { key: 'development', n: 2, name: 'Development', state: 'Organising 58 actions · 4 drafted · 1 accepted', href: base },
    { key: 'privateScrutiny', n: 3, name: 'Private Scrutiny', state: 'not yet open', href: null },
    { key: 'publicScrutiny', n: 4, name: 'Public Scrutiny', state: 'not yet open', href: null },
    { key: 'promotion', n: 5, name: 'Promotion', state: 'not yet open', href: null },
    { key: 'submission', n: 6, name: 'Submission', state: 'not submitted', href: null },
    { key: 'inForce', n: 7, name: 'In Force', state: 'not yet available', href: null },
  ],
  checklist: [
    { key: 'problem', n: 1, label: 'The problem', state: 'written', mark: '●', href: `${base}&section=problem` },
    { key: 'causes', n: 2, label: 'The causes', state: '6 causes · 4 with actions', mark: '◐', href: `${base}&section=causes` },
    { key: 'policy', n: 3, label: 'The guiding policy', state: 'chosen · #2', mark: '●', href: `${base}&section=policy` },
    { key: 'organising', n: 4, label: 'Organising the actions', state: '58 live', mark: '◐', href: `${base}&view=organising` },
    { key: 'drafting', n: 5, label: 'Drafting', state: '1 accepted · 57 to go', mark: '◐', href: `${base}&view=drafting` },
    { key: 'deepening', n: 6, label: 'The Deepening', state: 'locked until Drafting reads “0 to go” — 57 to go', mark: '🔒', href: `${base}&stage=deepening` },
    { key: 'promotion', n: 7, label: 'Promotional plan', state: 'not yet available', mark: '○', href: null },
  ],
  checklistHere: here,
}
const stages = ctx.lifecycle.map((s) => ({ n: s.n, name: s.name, state: s.state, href: s.href ? chapterHref(s.href, 2) : null, current: s.key === 'development' }))
const chapters = ctx.checklist!.map((l) => ({ n: l.n, label: l.label, state: l.state, mark: l.mark, href: l.href ? chapterHref(l.href, 6) : null, current: l.key === here }))
const actions = [38, 12, 207].map((n) => ({ number: n, title: `Action ${n}`, statement: `What action ${n} does.`, href: recordHref(IDEA, n) }))

const lines = (label: string, n: number) => Array.from({ length: n }, (_, i) => <p key={i} className="px-4 py-2 border-b border-zinc-100" data-line={`${label}-${i}`}>{label} line {i + 1}: some text to read, long enough that the page scrolls on a phone.</p>)

function Drafting() {
  const [open, setOpen] = React.useState<string>(location.hash)
  React.useEffect(() => { const f = () => setOpen(location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-y border-zinc-200 py-1 px-2" data-jump-band>Jump band (the record’s sticky band)</div>
      <p className="px-4 py-2" data-open-record>{open ? `open: ${open}` : 'no record open'}</p>
      <div className="overflow-x-auto" data-wide-table-wrap>
        <table className="min-w-[1200px] border" data-wide-table><tbody><tr>{Array.from({ length: 12 }, (_, i) => <td key={i} className="border px-6 py-6">cell {i + 1}</td>)}</tr></tbody></table>
      </div>
      {lines('record', 40)}
    </div>
  )
}

/** The shell, as the workspace places it: under the site's sticky header, below the stage bar on a desktop (Z1b item 4). */
function App({ topInset, homeY }: { topInset?: () => number; homeY?: () => number }) {
  return (
    <FocusShell ideaId={IDEA} stages={stages} chapters={chapters} topInset={topInset} homeY={homeY} slots={{
      1: <div className="px-4 py-3"><StageBar context={ctx} /></div>,
      2: <div>{lines('todo', 30)}</div>,
      3: (
        <div className="flex-1 min-h-0 flex flex-col" data-panel-lex>
          <ChatPanel messages={[]} awaitingField={null} busy={false} ideaId={IDEA}
            onSend={(t) => hooks.sent.push(t)} onAccept={() => {}} onDecline={() => {}} onContinue={() => {}} />
        </div>
      ),
      4: <div>{lines('notes', 8)}</div>,
      5: <ChaptersPanel chapters={chapters} actions={here === 'organising' || here === 'drafting' ? actions : null} />,
      6: <Drafting />,
      7: <div>{lines('research', 60)}</div>,
    }} />
  )
}

// Z1b — the page around the shell, built as CreateIdeaClient builds it, with the SAME hooks (`useSiteHeader`, `useArriveAtWorkspace`,
// `workspaceY`): a sticky site header (PublicNav's is sticky, 56 px here); on a desktop the stage bar above the workspace; the workspace one
// screen tall in Full view (`?hview=full`, three scrolling columns standing in for the real ones) or at least one screen in Focus view.
const narrow = window.innerWidth < 768
const full = !narrow && new URLSearchParams(location.search).get('hview') === 'full'
const SCREEN = 'calc(100dvh - var(--site-header-h, 0px))'
function Page() {
  const pageRef = React.useRef<HTMLDivElement>(null)
  const wsRef = React.useRef<HTMLDivElement>(null)
  const inset = useSiteHeader(pageRef)
  const homeY = React.useCallback(() => workspaceY(wsRef.current, inset()), [inset])
  useArriveAtWorkspace(wsRef, !narrow, inset)
  return (
    <div ref={pageRef} className={`flex flex-col bg-white ${full ? '' : 'min-h-screen'}`}>
      <header className="sticky top-0 z-50 h-14 border-b bg-white px-4 py-3" data-site-header>Site header</header>
      {!narrow && (
        <div className="border-b border-zinc-100 px-4 pt-2 pb-1.5" data-stagebar-above>
          <div className="max-w-5xl mx-auto"><StageBar context={ctx} /></div>
        </div>
      )}
      <div ref={wsRef} data-workspace className="flex flex-col" style={narrow ? undefined : full ? { height: SCREEN } : { minHeight: SCREEN }}>
        <div className="h-12 shrink-0 border-b px-4 py-2" data-toolbar>Exit · How this works · Focus view / Full view</div>
        {full ? (
          <div className="flex-1 min-h-0 grid grid-cols-3" data-full-columns>
            {['lex', 'open', 'research'].map((c) => <div key={c} className="h-full min-h-0 overflow-y-auto border-r" data-full-col={c}>{lines(c, 80)}</div>)}
          </div>
        ) : (
          <App topInset={inset} homeY={narrow ? undefined : homeY} />
        )}
      </div>
    </div>
  )
}

if (!restoreOnArrival(IDEA)) createRoot(document.getElementById('root')!).render(<Page />)
