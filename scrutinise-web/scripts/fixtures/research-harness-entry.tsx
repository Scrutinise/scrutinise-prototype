// 26-S2 sec 9 (18 Oct 2026) - THE PAGE THE RESEARCH-PANEL BROWSER CHECK LOADS (scripts/check-lex-26s2-browser.ts bundles this with esbuild).
//
// The REAL QuestionPanel, SourcesRegistry, AddResearch, FocusDialog and YourMaterial's viewer run in a real browser against a stand-in server that keeps a
// store, so a write changes what the next read returns. What it stands in for is only the database half. Test hooks on `window.__r`:
// `store` (what the server holds), `log` (every request the page made).

import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import QuestionPanel from '@/components/lex/QuestionPanel'
import ActionImport from '@/components/lex/ActionImport'
import AddResearch from '@/components/lex/AddResearch'
import { QUESTION_HEADINGS, HEADING_ORDER } from '@/lib/lex/question-headings'
import { ownDocumentCaveat } from '@/lib/lex/evidence-date'
import { facetOf } from '@/lib/lex/source-list'

type A = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const store: A = {
  sources: [
    { id: 's1', number: 1, kind: 'DOCUMENT', title: 'My own report on civil service accountability', url: null, citation: null, sourceType: 'document', author: null, publishedAt: null, snippet: null, readStatus: 'READ', readNote: null, corpusKey: null, materialId: 'd1', archived: false, createdAt: '2026-10-01T00:00:00Z' },
    { id: 's2', number: 2, kind: 'URL', title: 'A web page the user added', url: 'https://example.org/page', citation: null, sourceType: null, author: null, publishedAt: null, snippet: 'What the page says.', readStatus: 'NOT_READ', readNote: 'the address was saved; the page itself was not read', corpusKey: null, materialId: null, archived: false, createdAt: '2026-10-02T00:00:00Z' },
  ] as A[],
  doc: { priority: false, excluded: false, reason: null as string | null },
}
const hooks: A = { store, log: [] as string[] }

const caveat = ownDocumentCaveat({ staleness: 'UNDATED', standing: 'ASSERTION' })
const docEntry = () => ({
  id: 'd1', title: 'My own report on civil service accountability', citation: 'Your document', url: null, label: 'Your own source — a document',
  why: 'Read — 2 findings, filed under the questions they answer.', body: null, yourSource: true, assembled: false, sourceType: null, fieldRef: null, bearsOnFocus: false,
  excluded: store.doc.excluded, exclusionReason: store.doc.reason, priority: store.doc.priority, sourceDate: null, standing: 'ASSERTION', staleness: 'UNDATED', standingLabel: caveat,
})
const panelBody = () => ({
  ideaId: 'x', focusFieldRef: null, focusCount: 0, totalEntries: 1, unfiled: [],
  headings: HEADING_ORDER.map((key) => {
    const def = QUESTION_HEADINGS.find((h) => h.key === key)!
    const entries = key === 'YOUR_MATERIAL' ? [docEntry()] : []
    return { key, heading: def.heading, entries, gap: entries.length ? null : { reason: 'not-asked', text: 'Not asked of this draft.' }, questionsRun: [], questionsNotRun: [] }
  }),
})

const realFetch = window.fetch.bind(window)
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const method = init?.method ?? 'GET'
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  hooks.log.push(`${method} ${url.replace(/^.*\/api\/ideas\/x/, '')}`)
  if (url.includes('/panel') && method === 'GET') return json(200, panelBody())
  if (url.includes('/research-notebook?lex=0')) return json(200, { notes: [] })
  if (url.includes('/research-notebook?options=1')) return json(200, { bearsOnOptions: [] })
  // 299: ?detail=1 carries each source's kind (by the REAL facetOf — imported, never restated), the actions it bears on, its text hash and note count;
  // ?q= searches titles and held text (the stand-in holds no text, so it searches titles and snippets — said in its own reply).
  if (url.includes('/source-registry?q=') && method === 'GET') {
    const words = decodeURIComponent(url.split('?q=')[1]).toLowerCase().split(/\s+/).filter((w) => w.length >= 2)
    const live = store.sources.filter((s: A) => !s.archived)
    const matches = live.filter((s: A) => words.every((w) => `${s.title} ${s.snippet ?? ''} ${s.heldText ?? ''}`.toLowerCase().includes(w))).map((s: A) => ({ id: s.id, where: ['title'] }))
    return json(200, { matches, searchedText: live.filter((s: A) => s.heldText).length, notHeld: live.filter((s: A) => !s.heldText).length })
  }
  if (url.includes('/source-registry') && method === 'GET') {
    return json(200, { sources: store.sources.filter((s: A) => !s.archived).map((s: A) => ({ bearsOn: [], textHash: null, noteCount: 0, addedBy: 'u1', ...s, facet: facetOf({ kind: s.kind, sourceType: s.sourceType, addedBy: s.addedBy === undefined ? 'u1' : s.addedBy, materialId: s.materialId }) })) })
  }
  // 298: a check that sets `__r.extractReply` gets it back for a file (check:lex-298-299-browser); otherwise it goes to the network as before.
  if (url.includes('/research-notebook/extract') && hooks.extractReply) return json(200, hooks.extractReply)
  // `/research-notebook/extract` is a file upload, not a note: it goes to the network (check:add-research-md-browser serves it with the real route).
  if (url.includes('/research-notebook') && !url.includes('/extract') && method === 'POST') {
    const body = JSON.parse(String(init!.body))
    let ref: number
    if (body.newSource) {
      ref = Math.max(...store.sources.map((s: A) => s.number)) + 1
      store.sources.push({ id: `s${ref}`, number: ref, kind: body.newSource.kind, title: body.newSource.title, url: body.newSource.url ?? null, citation: null, sourceType: body.newSource.sourceType ?? null, author: null, publishedAt: null, snippet: null, readStatus: body.newSource.fullText ? 'READ' : 'NOT_READ', readNote: null, corpusKey: null, materialId: null, archived: false, createdAt: new Date().toISOString() })
    } else ref = store.sources.find((s: A) => s.id === body.sourceId)?.number ?? 1
    hooks.lastSave = body
    return json(200, { ok: true, result: { ref, noteId: 'n1', status: 'IN_RECORD' }, error: null })
  }
  if (url.includes('/material?materialId=d1')) return json(200, { id: 'd1', label: 'My own report on civil service accountability', kind: 'FILE', filename: 'report.docx', url: null, text: 'The kept text of the report: departments should publish a named owner.', charCount: 68, findingCount: 2, findingsAt: '2026-10-01T00:00:00Z', truncated: false })
  if (url.includes('/sources') && method === 'PATCH') {
    const b = JSON.parse(String(init!.body))
    hooks.lastDecision = b
    if (b.sourceKey === 'd1') { store.doc.excluded = b.status === 'EXCLUDED'; store.doc.priority = b.status === 'PRIORITY'; store.doc.reason = b.status === 'EXCLUDED' ? b.reason : null }
    return json(200, { ok: true })
  }
  if (url.includes('/action-import')) return json(200, { pass: null, importable: { sources: [], notRead: [] } })
  return realFetch(input, init)
}) as typeof window.fetch

let root: Root | null = null
;(window as A).__mountResearch = (what: 'panel' | 'import' | 'add') => {
  const el = document.getElementById('root')!
  root?.unmount(); root = createRoot(el)
  root.render(what === 'panel' ? <QuestionPanel ideaId="x" /> : what === 'add' ? <AddResearch ideaId="x" /> : <ActionImport ideaId="x" />)
}
;(window as A).__r = hooks
