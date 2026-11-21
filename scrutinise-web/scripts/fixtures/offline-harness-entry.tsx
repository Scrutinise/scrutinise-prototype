// check:lex-z2's page: the REAL OfflineStrip, the REAL postOrQueue / overlayActions / enqueueLex, and the same glue CreateIdeaClient
// uses around them (its `post`, `applyState` and the offline branch of `sendMessage`), served at /ideas/create by the check's own HTTP
// server so the REAL worker (public/lex-sw.js) registers, controls the page and serves it offline.
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import OfflineStrip from '../../components/lex/OfflineStrip'
import { readQueue, overlayActions, postOrQueue, enqueueLex } from '../../lib/lex/offline-queue'
import { OFFLINE_UI } from '../../lib/lex/screen-labels'

type A = { id: string; number: number; practicalStep: string; commentary: string | null }
type S = { actions: A[]; v: string }
const ideaId = 'fx'

function App() {
  const qs = new URLSearchParams(window.location.search)
  // as Clerk: the user is NOT KNOWN (undefined) until it has loaded — `userDelay` ms here — which is when a flush could race the user check
  const [user, setUser] = useState<string | undefined>(qs.get('userDelay') ? undefined : qs.get('user') ?? 'u1')
  useEffect(() => { if (qs.get('userDelay')) { const t = setTimeout(() => setUser(qs.get('user') ?? 'u1'), Number(qs.get('userDelay'))); return () => clearTimeout(t) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState<S | null>(null)
  const [msg, setMsg] = useState('')
  // as CreateIdeaClient's applyState: queued edits are laid over every state applied
  const apply = (s: S) => { const q = readQueue(ideaId); setState(q.length ? { ...s, actions: overlayActions(s.actions, q) } : s) }
  const refresh = async () => { try { const r = await fetch(`/api/ideas/${ideaId}/state`, { cache: 'no-store' }); if (r.ok) apply(await r.json()) } catch { /* offline, nothing kept */ } }
  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // as CreateIdeaClient's post
  const post = async (path: string, body: Record<string, unknown>) => {
    const out = await postOrQueue(ideaId, path, body, state?.actions ?? [])
    if (out.queued) { if (state) apply(state); setMsg(OFFLINE_UI.queued); return }
    if (out.refused) { setMsg(out.refused); return }
    const j = await out.res!.json().catch(() => ({}))
    if (!out.res!.ok) { setMsg(`refused: ${j.error ?? out.res!.status}`); return }
    if (j.state) apply(j.state)
  }
  // as the offline branch of CreateIdeaClient's sendMessage
  const sayToLex = (text: string) => {
    if (navigator.onLine === false) { enqueueLex(ideaId, text, `c-${Date.now()}`); setMsg(OFFLINE_UI.lexWaiting); return }
    void fetch(`/api/ideas/${ideaId}/lex`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) })
  }
  const w = window as unknown as { __edit: (id: string, t: string) => Promise<void>; __other: () => Promise<void>; __lex: (t: string) => void }
  w.__edit = (id, t) => post('/actions', { action: 'update', actionId: id, practicalStep: t })
  w.__other = () => post('/causes', { action: 'add', cause: 'x' })
  w.__lex = sayToLex
  return (
    <div data-workspace data-v={state?.v ?? ''}>
      <OfflineStrip ideaId={ideaId} userId={user} onRefresh={() => { void refresh() }} lexEstimate={OFFLINE_UI.estimate(4)}
        sendLex={async (text) => { await fetch(`/api/ideas/${ideaId}/lex`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) }) }} />
      {state?.actions.map((a) => <p key={a.id} data-action={a.id}>{a.practicalStep}</p>)}
      <p data-msg>{msg}</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
