// 26-S browser pass (17 Oct 2026) — THE PAGE THE BROWSER CHECK LOADS (scripts/check-lex-26s-browser.ts bundles this with esbuild).
//
// The REAL components (ActionsWorkspace, FeedbackDialog, BoundedInput) run in a real browser against a stand-in server that uses the REAL request
// schema (`ActionStructureBody`) and the REAL rejection words (`describeIssues`), and keeps a store, so a write changes what the next read returns.
// What it stands in for is only the database half of `lib/lex/action-structure.ts`; that half is checked against the database (same check, part C).
//
// Test hooks on `window.__h`: `store` (what the server holds), `rejectNext` (answer the next write with this body), `failReread` (make the list's
// re-read fail), `post(raw)` (send a raw request body to the stand-in route and return the status and body).

import React, { useCallback, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ActionsWorkspace from '@/components/lex/ActionsWorkspace'
import FeedbackDialog from '@/components/lex/FeedbackDialog'
import { ActionStructureBody, OP_WORDS, INPUT_WORDS, type ActionStructureOp } from '@/lib/lex/action-structure-schema'
import { describeIssues } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import { HEADING_PALETTE } from '@/lib/lex/action-headings'

type A = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const mk = (n: number, extra: A = {}): A => ({
  id: `a${n}`, number: n, title: `Action number ${n} does a thing`, practicalStep: `Step ${n}`, whoImplements: null, wording: null, headingId: null, targetCauseIds: [], avenue: null, link: null,
  sequence: null, beforeIds: [], parked: false, parkedReason: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null, facetProposal: null, titleProposal: null,
  source: 'LEX', mechanismType: null, targetOrganisation: null, benefits: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null, policyTest: null, ...extra,
})

const store = {
  actions: [
    mk(1), // never tested — must read "? Not tested"
    mk(2, { policyTest: { verdict: 'FITS', reason: 'It matches the policy.', from: ['your comment on the grok-4.7 draft'] } }), // an OLD stored provenance string
    mk(3, { policyTest: { verdict: 'CONFLICTS', reason: 'Rules out thresholds.', from: [] } }),
    mk(4), mk(5), mk(6),
    // thirty-four more, all tested: a hundred-row list is the case that matters (a message above the fold is a message that is not seen)
    ...Array.from({ length: 34 }, (_, i) => mk(7 + i, { policyTest: { verdict: 'FITS', reason: 'Fits.', from: [] } })),
  ] as A[],
  headings: [{ id: 'h1', name: 'Legislation', colourKey: HEADING_PALETTE[0].key, hidden: false, orderIndex: 0 }] as A[],
}
const hooks: A = { store, rejectNext: null as A | null, failReread: false, log: [] as string[] }

const clip = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n)
const stateBody = () => ({
  actions: store.actions.filter((a) => a.status === 'LIVE'), setAsideActions: store.actions.filter((a) => a.status !== 'LIVE'),
  actionHeadings: store.headings,
})

function handle(raw: A): { status: number; body: A } {
  if (hooks.rejectNext) { const r = hooks.rejectNext; hooks.rejectNext = null; return r as { status: number; body: A } }
  const parsed = ActionStructureBody.safeParse(raw)
  if (!parsed.success) {
    const op = raw?.op
    const action = typeof op === 'string' && op in OP_WORDS ? OP_WORDS[op as ActionStructureOp] : 'That action'
    const { message, rejected } = describeIssues(parsed.error.issues, { action, labels: INPUT_WORDS })
    return { status: 422, body: { error: message, rejected } }
  }
  const b = parsed.data as A
  const ok = (result: unknown) => ({ status: 200, body: { ok: true, result, error: null, state: stateBody() } })
  const no = (error: string) => ({ status: 422, body: { ok: false, result: null, error, state: stateBody() } })
  const move = (ids: string[], headingId: string | null) => {
    let n = 0
    for (const a of store.actions) if (ids.includes(a.id) && a.status === 'LIVE') { a.headingId = headingId; n++ }
    return n
  }
  const makeHeading = (name: string) => {
    const nm = clip(name, LIMITS.headingName)
    const same = store.headings.find((h) => h.name.toLowerCase() === nm.toLowerCase())
    if (same) return { id: same.id, name: same.name, created: false }
    const h = { id: `h${store.headings.length + 1}`, name: nm, colourKey: HEADING_PALETTE[store.headings.length % HEADING_PALETTE.length].key, hidden: false, orderIndex: store.headings.length }
    store.headings.push(h)
    return { id: h.id, name: h.name, created: true }
  }
  switch (b.op) {
    case 'createHeading': return ok(makeHeading(b.name))
    case 'assignHeading': { const n = move(b.actionIds, b.headingId); return n === 0 ? no('None of those actions could be moved — they are no longer in the live list. Nothing was changed.') : ok({ assigned: n }) }
    case 'assignToNewHeading': { const h = makeHeading(b.name); const n = move(b.actionIds, h.id); return n === 0 ? no('None of those actions could be moved.') : ok({ headingId: h.id, name: h.name, created: h.created, assigned: n }) }
    case 'ruleOut': {
      let n = 0
      for (const a of store.actions) if (b.ids.includes(a.id) && a.status === 'LIVE') { a.status = 'RULED_OUT'; a.ruleOutReason = clip(b.reason, LIMITS.ruleOutReason); n++ }
      return ok({ ruledOut: n })
    }
    case 'park': { let n = 0; for (const a of store.actions) if (b.ids.includes(a.id)) { a.parked = true; a.parkedReason = clip(b.reason ?? '', LIMITS.ruleOutReason); n++ } return ok({ parked: n }) }
    case 'setTitle': { const a = store.actions.find((x) => x.id === b.actionId); if (a) a.title = b.title ? clip(b.title, LIMITS.actionTitle) : null; return ok(null) }
    default: return ok(null)
  }
}

// ── the stand-in network ──
const realFetch = window.fetch.bind(window)
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  if (url.endsWith('/action-structure') && init?.method === 'POST') {
    const r = handle(JSON.parse(String(init.body)))
    hooks.log.push(`POST ${JSON.parse(String(init.body)).op} -> ${r.status}`)
    return json(r.status, r.body)
  }
  if (url.includes('/state')) {
    hooks.log.push(`GET state${hooks.failReread ? ' -> 500' : ''}`)
    return hooks.failReread ? json(500, { error: 'boom' }) : json(200, stateBody())
  }
  if (url.includes('/action-ideas')) return json(200, { held: 0, settledPolicyId: null })
  return realFetch(input, init)
}) as typeof window.fetch
hooks.post = async (raw: A) => { const r = handle(raw); return r }

function Workspace() {
  const [s, setS] = useState(stateBody())
  const reread = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/ideas/x/state')
    if (!res.ok) return false
    setS(await res.json())
    return true
  }, [])
  return (
    <div>
      <p id="count-live">{s.actions.length}</p>
      <ActionsWorkspace ideaId="x" actions={s.actions as never} setAside={s.setAsideActions as never} headings={s.actionHeadings as never} causes={[]} busy={false}
        onChanged={reread} renderFull={(_a, _s, between) => <div data-full-card>{between}</div>} />
    </div>
  )
}

let root: Root | null = null
;(window as A).__mount = (what: 'workspace' | 'feedback') => {
  const el = document.getElementById('root')!
  root?.unmount(); root = createRoot(el)
  root.render(what === 'workspace' ? <Workspace /> : <FeedbackDialog ideaId="x" stage="COHERENT_ACTIONS" onClose={() => {}} />)
}
;(window as A).__h = hooks
