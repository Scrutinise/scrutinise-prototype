'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §3 (decisions 261, 263) — THE DOCUMENT VIEW. One page, opened from the record's Documents section and from the tree:
//
//   a HEADER STRIP — "D.38.1 · Drafting instruction and clause · version 1, Lex's draft (proposal 1), used by you · 7 law rows written: …
//                    · not yet accepted — Accept when you are content" — with Accept · Edit · Ask Lex to redraft · Versions (263: it answers
//                    "what did my save do" without a question);
//   FIVE TABS — Text · Instruction · What it touches · Versions · Issues;
//   and, where Lex's proposal is waiting, the THREE-COLUMN COMPARISON (3g): as it stands · Lex proposes · your working copy, with Take this
//   per subsection, Take all, Set aside and Save as version N. Nothing in the proposal column is editable; the working copy is.
//
// ⚠ Nothing deletes: "Set aside" answers the proposal and keeps it (listed in Versions). ⚠ Shape + word on every state (§21).
// ⚠ Plain words (§0): document, version, accepted, as it stands. ⚠ Imports only pure modules and client components (§28).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GENERATED_KINDS, partNumber, partsOf } from '@/lib/lex/action-documents-pure'
import { notePrice } from '@/lib/lex/explanatory-note-pure'
import { INSTRUMENT_WORD, RELATION_WORD as INSTRUCTION_RELATION_WORD, draftPrice, type DraftInstruction } from '@/lib/lex/action-draft-pure'
import { STATE_WORDS, NONE_HELD, type Touch, type TouchesResult } from '@/lib/lex/action-touches-pure'
import { headerStrip, wantsAccept, versionWords, cutClause, joinClause, takePart, partNumbers, versionChange, type ClauseCut } from '@/lib/lex/document-view-pure'
import { provisionWords } from '@/lib/lex/law-panel-words'
import type { DocumentViewData } from '@/lib/lex/document-view'
import { explainFailure } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import { Editor } from './ActionDraftSection'
import BoundedInput from './BoundedInput'
import AmendmentViews, { proposedLine } from './AmendmentViews'
import { parseAmendments } from '@/lib/lex/textual-amendment-pure'
import { PASSES } from '@/lib/lex/deepening-config'
import { passOfReviewKey, producerWords, ISSUES_CHANGED_EVENT } from '@/lib/lex/document-review-pure'
import type { ReviewPlan } from '@/lib/lex/document-review'

type Tab = 'text' | 'instruction' | 'touches' | 'versions' | 'issues'
const TAB_WORD: Record<Tab, string> = { text: 'Text', instruction: 'Instruction', touches: 'What it touches', versions: 'Versions', issues: 'Issues' }
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function DocumentView({ ideaId, documentId, readOnly = false, onChanged }: { ideaId: string; documentId: string; readOnly?: boolean; onChanged?: () => void }) {
  const [data, setData] = useState<DocumentViewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('text')
  const [editing, setEditing] = useState(false)
  const [askRedraft, setAskRedraft] = useState(false)
  const [askReview, setAskReview] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'view', documentId }) })
    const body = await res.json().catch(() => null)
    if (!res.ok) { setError(explainFailure(body, res.status, 'Opening the document')); return }
    setData((body as { data: DocumentViewData }).data); setError(null)
  }, [ideaId, documentId])
  useEffect(() => { void load() }, [load])

  /** One write: the route, its worded answer, then a fresh read of this view and of the page around it. */
  const write = useCallback(async (url: 'action-documents' | 'action-structure', payload: Record<string, unknown>, label: string, ok: (r: Record<string, unknown> | null) => string) => {
    setBusy(true); setSaid(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => null) as { ok?: boolean; result?: Record<string, unknown> | null; data?: Record<string, unknown> | null; error?: unknown } | null
      if (!res.ok || body?.ok === false) { setSaid(`Not done: ${explainFailure(body, res.status, label)}`); return false }
      setSaid(ok((body?.result ?? body?.data ?? null) as Record<string, unknown> | null))
      await load(); onChanged?.()
      return true
    } catch (e) { setSaid(`Not done: ${label} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`); return false }
    finally { setBusy(false) }
  }, [ideaId, load, onChanged])

  if (error) return <p className="text-xs" role="alert" data-document-view-error>Not opened: {error}</p>
  if (!data) return <p className="text-xs text-zinc-500">Opening the document…</p>

  const { doc } = data
  const generated = GENERATED_KINDS.has(doc.kind)
  const strip = headerStrip({
    d: doc.d, title: doc.title, status: doc.status, acceptedV: doc.acceptedV,
    current: data.current ? { v: data.current.v, author: data.current.author, fromProposal: data.current.fromProposal, previousAuthor: data.current.previousAuthor } : null,
    law: data.isInstruction ? { live: data.law.live.length + data.law.precedents, targets: data.law.live.map((l) => l.target), precedents: data.law.precedents } : null,
    proposalWaiting: data.proposal?.v ?? data.textProposal?.v ?? null,
  })
  const isNote = doc.kind === 'EXPLANATORY_NOTE'
  const nPrice = notePrice()
  const draftNote = () => { setAskRedraft(false); void write('action-documents', { op: 'draftNote', actionId: data.actionId }, `Drafting ${doc.d}`, (r) => `Saved: Lex’s proposal is waiting below${r?.pence != null ? ` — it cost ${Number(r.pence).toFixed(1)}p` : ''}. Nothing of yours was changed.`) }
  const tabs: Tab[] = data.isInstruction ? ['text', 'instruction', 'touches', 'versions', 'issues'] : ['text', 'versions', 'issues']
  const price = draftPrice()
  const accept = () => void write('action-documents', { op: 'accept', documentId }, `Accepting ${doc.d}`, () => `Saved: ${doc.d} accepted at version ${data.current?.v}. A later edit takes it back to “accepted, then changed”.`)

  return (
    <div className="rounded border-2 border-zinc-900 bg-white p-2 space-y-2 text-xs" data-document-view={doc.d}>
      {/* 3a — THE HEADER STRIP */}
      <div className="space-y-1" data-document-strip>
        <p className="text-sm">
          {strip.pieces.map((p, i) => <span key={i}>{i ? ' · ' : ''}{i === 0 ? <span className="font-semibold">{p}</span> : p}</span>)}
          {' · '}<span className="font-bold" data-document-status>{strip.status}</span>
          {strip.prompt && <span className="text-zinc-700"> — {strip.prompt}</span>}
        </p>
        {doc.stale && <p><span className="font-semibold">⚠ Out of date:</span> {doc.stale}</p>}
        {!readOnly && (
          <div className="flex flex-wrap gap-2 items-center">
            {wantsAccept(doc.status, data.current?.v ?? null) && !generated && <button type="button" disabled={busy} onClick={accept} data-document-accept className="px-2 py-0.5 rounded border-2 border-zinc-900 font-semibold disabled:opacity-40">Accept version {data.current!.v}</button>}
            {generated && doc.kind === 'COLLISION_REPORT' && (
              <button type="button" disabled={busy} onClick={() => void write('action-documents', { op: 'generate', what: 'collision', actionId: data.actionId }, 'Generating the collision report', (r) => r?.unchanged ? `Unchanged: ${doc.d} already matches the clause and the effects data.` : `Saved: ${doc.d} generated again.`)}
                className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Generate again (free)</button>
            )}
            {!generated && !editing && <button type="button" disabled={busy} onClick={() => { setEditing(true); setTab(data.isInstruction ? 'instruction' : 'text') }} className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Edit</button>}
            {data.isInstruction && !askRedraft && <button type="button" disabled={busy} onClick={() => setAskRedraft(true)} className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Ask Lex to redraft</button>}
            {data.isInstruction && askRedraft && (
              <span data-redraft-ask>This costs about {price.pence}p ({price.measured ? `measured, n=${price.n}` : 'an estimate'}); Lex’s draft arrives as a proposal beside the current version, never over it.{' '}
                <button type="button" disabled={busy} onClick={() => { setAskRedraft(false); void write('action-structure', { op: 'draftAction', actionId: data.actionId }, `Drafting ${doc.d}`, (r) => `Saved: Lex’s proposal is waiting below${r?.pence != null ? ` — it cost ${Number(r.pence).toFixed(1)}p` : ''}. Nothing of yours was changed.`) }}
                  className="px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Draft it</button>{' '}
                <button type="button" onClick={() => setAskRedraft(false)} className="underline">Not now</button></span>
            )}
            {/* 26-V1b §5 — the explanatory note: asks first, at the price measured on a scratch copy */}
            {isNote && !askRedraft && <button type="button" disabled={busy} onClick={() => setAskRedraft(true)} data-note-redraft className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Ask Lex to redraft</button>}
            {isNote && askRedraft && (
              <span data-note-ask>{noteAskWords(nPrice)}{' '}
                <button type="button" disabled={busy} onClick={draftNote} className="px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Draft it</button>{' '}
                <button type="button" onClick={() => setAskRedraft(false)} className="underline">Not now</button></span>
            )}
            <button type="button" onClick={() => setTab('versions')} className="underline">Versions ({data.versions.length})</button>
            {!askReview && <button type="button" disabled={busy} onClick={() => setAskReview(true)} data-review-open className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Review this document</button>}
          </div>
        )}
        {!readOnly && askReview && <ReviewAsk ideaId={ideaId} documentId={documentId} busy={busy} onClose={() => setAskReview(false)}
          onDone={(s) => { setSaid(s); setAskReview(false); setTab('issues'); void load().then(() => { onChanged?.(); window.dispatchEvent(new Event(ISSUES_CHANGED_EVENT)) }) }} />}
        {said && <p className="border border-zinc-300 rounded px-2 py-1" role="status" data-document-said>{said} <button type="button" className="underline ml-1" onClick={() => setSaid(null)}>OK</button></p>}
      </div>

      {/* 3g — LEX'S PROPOSAL BESIDE THE CURRENT VERSION */}
      {data.proposal && !readOnly && <Comparison key={`${data.current?.v ?? 0}-${data.proposal.v}`} data={data} busy={busy} write={write} />}
      {data.textProposal && !readOnly && <TextProposal data={data} busy={busy} write={write} />}

      {/* THE TABS — shape and weight mark the open one, not colour */}
      <div role="tablist" aria-label={`${doc.d} — its tabs`} className="flex flex-wrap gap-1 border-b border-zinc-200 pb-1">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-document-tab={t}
            className={`px-2 py-0.5 rounded-t ${tab === t ? 'font-bold border-2 border-b-0 border-zinc-900' : 'border border-transparent text-zinc-700'}`}>
            {tab === t ? '● ' : '○ '}{TAB_WORD[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" data-document-panel={tab}>
        {tab === 'text' && <TextTab data={data} editing={editing && !data.isInstruction} busy={busy} onCancel={() => setEditing(false)}
          onSave={async (body) => { if (await write('action-documents', { op: 'saveText', documentId, body }, `Saving ${doc.d}`, (r) => `Saved: ${doc.d}, version ${String(r?.v ?? '?')}. The earlier versions are kept.`)) setEditing(false) }} />}
        {tab === 'instruction' && data.isInstruction && (editing
          ? <Editor start={data.current?.instruction ?? data.proposal?.instruction ?? EMPTY} legislative={data.legislative} disabled={busy} onCancel={() => setEditing(false)}
              onSave={async (v) => { if (await write('action-structure', { op: 'saveDraft', actionId: data.actionId, instruction: v }, `Saving ${doc.d}`, (r) => `Saved as version ${String(r?.version ?? '?')} of ${doc.d}. The earlier versions are kept${wantsAccept(doc.status, data.current?.v ?? null) || doc.status === 'ACCEPTED' ? '; it now needs accepting again' : ''}.`)) setEditing(false) }} />
          : <InstructionTab data={data} />)}
        {tab === 'touches' && data.isInstruction && <TouchesTab data={data} ideaId={ideaId} />}
        {tab === 'versions' && <VersionsTab data={data} />}
        {tab === 'issues' && <IssuesTab data={data} />}
      </div>
    </div>
  )
}

const EMPTY: DraftInstruction = { instrument: null, provisions: [], dutyOnWhom: '', enforcedHow: '', commencement: '', extent: [], precedents: [], clause: '', plainWording: '', purpose: '', citations: [] }

// ── Text ─────────────────────────────────────────────────────────────────────────────────────────────────────
function TextTab({ data, editing, busy, onSave, onCancel }: { data: DocumentViewData; editing: boolean; busy: boolean; onSave: (body: string) => void; onCancel: () => void }) {
  const { doc } = data
  const [text, setText] = useState(doc.current?.body ?? '')
  if (editing) return (
    <div className="space-y-1">
      <BoundedInput multiline rows={12} value={text} onChange={setText} max={LIMITS.documentText} aria-label={`The text of ${doc.d}`} className="w-full border border-zinc-300 rounded p-1.5" wrapperClassName="w-full" />
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => onSave(text)} className="px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save as a new version</button><button type="button" onClick={onCancel} className="underline">Cancel</button></div>
    </div>
  )
  if (data.isInstruction) {
    const ins = data.current?.instruction
    if (!ins) return <p>No version yet{data.proposal ? ' — Lex’s proposal is above, to use or set aside' : ''}.</p>
    if (!data.legislative) return <div className="space-y-1"><p className="text-zinc-600">The wording, in plain English:</p><p className="whitespace-pre-wrap" data-document-text>{ins.plainWording || 'not yet written'}</p></div>
    const cut = cutClause(ins.clause)
    // §4 — the three views where the clause amends textually; "as proposed" with its line where it does not
    const parsed = parseAmendments(ins.clause)
    const line = proposedLine(parsed.amendments.length > 0, parsed.nonTextual.length > 0)
    return (
      <div className="space-y-1.5" data-document-text>
        {/* the caveat is the first line, always */}
        <pre className="whitespace-pre-wrap font-serif">{cut.head}</pre>
        {cut.parts.map((p) => (
          <div key={p.n} data-document-part={partNumber(doc.actionNumber, doc.number, p.n)}>
            <p className="font-semibold"><span aria-hidden>▸</span> {partNumber(doc.actionNumber, doc.number, p.n)}</p>
            <pre className="whitespace-pre-wrap font-serif">{p.text}</pre>
          </div>
        ))}
        {line && <p className="text-zinc-600" data-text-view-line>{line}</p>}
        <AmendmentViews clause={ins.clause} provisions={ins.provisions} titles={data.titles} held={data.held} />
        <p className="text-zinc-600">Comments on a single part are not built yet; comment on the action, below the record.</p>
      </div>
    )
  }
  if (!doc.current) return <p>No version yet.</p>
  const above = headOf(doc.current.body)
  return (
    <div className="space-y-1" data-document-text>
      {/* the text above the first part — the explanatory note's caveat is there, and is always the first line */}
      {above && <p className="whitespace-pre-wrap font-semibold" data-document-head>{above}</p>}
      {doc.current.parts.map((p) => (
        <div key={p.n} data-document-part={partNumber(doc.actionNumber, doc.number, p.n)}>
          <p className="font-semibold"><span aria-hidden>▸</span> {partNumber(doc.actionNumber, doc.number, p.n)} {p.title}</p>
          <pre className="whitespace-pre-wrap font-sans">{p.text}</pre>
        </div>
      ))}
    </div>
  )
}

// ── Instruction: a form and a table, never prose (3c) ────────────────────────────────────────────────────────
function InstructionTab({ data }: { data: DocumentViewData }) {
  const ins = data.current?.instruction
  if (!ins) return <p>No version yet{data.proposal ? ' — Lex’s proposal is above, to use or set aside' : ''}.</p>
  const title = (uri: string) => data.titles[uri] ?? uri
  const field = (label: string, v: string) => <tr><th scope="row" className="text-left align-top pr-2 py-0.5 font-semibold">{label}</th><td className="py-0.5">{v.trim() ? v : <span className="font-semibold">not yet answered</span>}</td></tr>
  return (
    <div className="space-y-2" data-instruction-tab>
      {data.legislative && (
        <table className="w-full border border-zinc-200" data-instruction-table>
          <thead className="bg-zinc-50"><tr>{['Act', 'Provision', 'What we do', 'Why'].map((h) => <th key={h} className="text-left px-1.5 py-0.5 border-b border-zinc-200">{h}</th>)}</tr></thead>
          <tbody>
            {ins.provisions.length ? ins.provisions.map((p, i) => (
              <tr key={i} className="border-t border-zinc-100 align-top" data-instruction-row>
                <td className="px-1.5 py-0.5">{title(p.docUri)}</td>
                <td className="px-1.5 py-0.5">{p.provisionPath ? provisionWords(p.provisionPath) : 'the whole Act'}</td>
                <td className="px-1.5 py-0.5">{INSTRUCTION_RELATION_WORD[p.relation]}</td>
                <td className="px-1.5 py-0.5">{p.note || <span className="text-zinc-500">no reason given</span>}</td>
              </tr>
            )) : <tr><td colSpan={4} className="px-1.5 py-0.5 font-semibold">No provision named yet.</td></tr>}
          </tbody>
        </table>
      )}
      <table><tbody>
        {field('Instrument', ins.instrument ? INSTRUMENT_WORD[ins.instrument] : '')}
        {field('Duty on whom', ins.dutyOnWhom)}
        {field('Enforced how', ins.enforcedHow)}
        {data.legislative && field('Commencement', ins.commencement)}
        {data.legislative && field('Extent', ins.extent.join(', '))}
        {field('Purpose', ins.purpose)}
      </tbody></table>
      {data.legislative && (
        <table className="w-full border border-zinc-200" data-precedent-table>
          <caption className="text-left font-semibold pb-0.5">Precedents</caption>
          <thead className="bg-zinc-50"><tr>{['Act', 'Provision', 'What we take from it'].map((h) => <th key={h} className="text-left px-1.5 py-0.5 border-b border-zinc-200">{h}</th>)}</tr></thead>
          <tbody>{ins.precedents.length ? ins.precedents.map((p, i) => (
            <tr key={i} className="border-t border-zinc-100 align-top"><td className="px-1.5 py-0.5">{title(p.docUri)}</td><td className="px-1.5 py-0.5">{p.provisionPath ? provisionWords(p.provisionPath) : 'the whole Act'}</td><td className="px-1.5 py-0.5">{p.how}</td></tr>
          )) : <tr><td colSpan={3} className="px-1.5 py-0.5">None drawn on.</td></tr>}</tbody>
        </table>
      )}
      {data.currentReason && (
        <details data-why-lex><summary className="cursor-pointer font-semibold">Why Lex drafted it this way</summary><p className="mt-1 whitespace-pre-wrap">{data.currentReason}</p></details>
      )}
      {ins.citations.length > 0 && <p className="text-zinc-500">Drafted from: {ins.citations.join(' · ')}</p>}
    </div>
  )
}

// ── What it touches (3d) ─────────────────────────────────────────────────────────────────────────────────────
function TouchesTab({ data, ideaId }: { data: DocumentViewData; ideaId: string }) {
  const [res, setRes] = useState<TouchesResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const read = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`/api/ideas/${ideaId}/action-structure`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'touches', actionId: data.actionId }) })
      const b = await r.json().catch(() => null) as { ok?: boolean; result?: TouchesResult; error?: unknown } | null
      if (!r.ok || !b?.ok || !b.result) setErr(explainFailure(b, r.status, 'Reading what this touches'))
      else setRes(b.result)
    } finally { setBusy(false) }
  }
  useEffect(() => { if (data.current) void read() /* free: a read of the statute book */ }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!data.current) return <p>Computed from the instruction’s named provisions — there is no version yet.</p>
  return (
    <div className="space-y-1.5" data-touches-tab>
      {busy && <p className="text-zinc-500">Reading the statute book…</p>}
      {err && <p role="alert">Not read: {err} <button type="button" className="underline" onClick={() => void read()}>Read it again</button></p>}
      {res && (res.touches.length
        ? <ul className="space-y-1.5">{res.touches.map((t, i) => <TouchBlocks key={i} t={t} title={data.titles[t.line.docUri] ?? t.actTitle} />)}</ul>
        : <p className="font-semibold">The instruction names no provision it amends, repeals, modifies, relies on or is constrained by.</p>)}
      <p className="text-zinc-600" data-collision-line>This action’s collision report has two parts under each provision the clause changes: what depends on it (made under it, and the official record of what operates on it), and provisions that refer to it, for review.</p>
    </div>
  )
}

function TouchBlocks({ t, title }: { t: Touch; title: string | null }) {
  const head = `${title ?? t.line.docUri}${t.line.provisionPath ? `, ${provisionWords(t.line.provisionPath)}` : ''}`
  return (
    <li className="border border-zinc-200 rounded p-1.5 space-y-1" data-touch-state={t.state}>
      <p><span className="font-semibold">{head}</span> — {INSTRUCTION_RELATION_WORD[t.line.relation]} · <span className="font-semibold">{STATE_WORDS[t.state]}</span>{t.stateReason ? `: ${t.stateReason}` : ''}</p>
      {t.state === 'held' && <>
        <Block n={1} title="The text as held">{t.heldText ? <details><summary className="cursor-pointer">{t.heldChars?.toLocaleString('en-GB')} characters</summary><pre className="whitespace-pre-wrap font-serif mt-1">{t.heldText}</pre></details> : <span>{NONE_HELD} for this provision on its own</span>}</Block>
        <Block n={2} title="Changes already made to it, from the official record">{t.effects
          ? <><p>{t.effects.headline}</p><ul className="ml-4 list-disc">{t.effects.perType.map((c) => <li key={c.type}>{c.type}: {c.total} — {c.changeTheWords} change the words, {c.doNotChangeTheWords} do not, {c.unclassified} unclassified</li>)}</ul><p className="text-zinc-500">{t.effects.freshness}</p></>
          : <span>{NONE_HELD}</span>}</Block>
        <Block n={3} title="Statutory instruments made under it" data="made-under">{!t.madeUnder ? <span>not read</span> : t.madeUnder.failed ? <span>⚠ could not be read: {t.madeUnder.failed}</span> : t.madeUnder.total
          ? <><p>{t.madeUnder.total} instrument{t.madeUnder.total === 1 ? '' : 's'} whose own enacting words name {t.line.provisionPath ? 'this provision' : 'this Act'}:</p>
              <ul className="ml-4 list-disc">{t.madeUnder.rows.slice(0, 12).map((r) => <li key={r.gid}><a className="underline" href={r.link} target="_blank" rel="noreferrer">{r.title ?? r.gid}</a></li>)}</ul>
              {t.madeUnder.total > 12 && <p>and {t.madeUnder.total - 12} more.</p>}</>
          : <span>{NONE_HELD}{t.madeUnder.actLevel ? ` for this provision; ${t.madeUnder.actLevel} instrument${t.madeUnder.actLevel === 1 ? '' : 's'} name the Act without a section` : ''}</span>}</Block>
        <Block n={4} title="Judgments interpreting it" data="judgments">{!t.judgments ? <span>not read</span> : t.judgments.failed ? <span>⚠ could not be read: {t.judgments.failed}</span> : t.judgments.cases
          ? <><p>{t.judgments.cases} judgment{t.judgments.cases === 1 ? '' : 's'} cite {t.line.provisionPath ? 'this provision' : 'this Act'} ({t.judgments.total} citations); the {Math.min(t.judgments.rows.length, t.judgments.cases)} most recent:</p>
              <ul className="ml-4 list-disc space-y-0.5">{t.judgments.rows.map((j) => (
                <li key={j.citation}><a className="underline" href={j.link} target="_blank" rel="noreferrer">{j.name ?? j.citation}</a> {j.citation} · {j.court}{j.date ? ` · ${j.date.slice(0, 4)}` : ''} · {j.paragraph}
                  <span className="block text-zinc-600">“…{j.passage.slice(0, 220)}…”</span></li>
              ))}</ul></>
          : <span>{NONE_HELD}</span>}</Block>
        <Block n={5} title="Near provisions, with their question">{t.near.length
          ? <ul className="ml-4 list-disc">{t.near.map((n) => <li key={n.ref}>s.{n.number} {n.title} ({n.why}) — <span className="font-semibold">{n.question}</span></li>)}</ul>
          : <span>{t.nearNote ?? NONE_HELD}</span>}</Block>
      </>}
    </li>
  )
}
function Block({ n, title, data, children }: { n: number; title: string; data?: string; children: React.ReactNode }) {
  return <div data-touch-block={data ?? n}><p className="font-semibold">{n}. {title}</p><div className="ml-3">{children}</div></div>
}

// ── Issues (26-V2c, 26-V2d §7): what the five review passes have read and raised, then the open issues by part ──────────────────────
function IssuesTab({ data }: { data: DocumentViewData }) {
  const { doc, issues, reviews } = data
  const where = (n: number | null) => (n == null ? `${doc.d} as a whole` : `part ${partNumber(doc.actionNumber, doc.number, n)}`)
  const openBy = (passKey: string) => issues.filter((i) => passOfReviewKey(i.passKey)?.key === passKey).length
  return (
    <div className="space-y-2">
      {/* counts by pass (BRIEF_26V1b 3f): every pass named, read or not — a pass never run and a pass that raised nothing must not look the same */}
      <ul className="space-y-0.5" data-document-reviews={reviews.length}>
        {PASSES.map((p) => {
          const r = reviews.find((x) => x.passKey === p.key)
          return (
            <li key={p.key} data-document-review={p.key} data-review-state={r ? r.status : 'none'}>
              <span aria-hidden>{r?.status === 'RUN' ? '●' : r ? '⚠' : '○'}</span>{' '}
              <span className="font-semibold">{p.label}</span>{' — '}
              {!r ? 'not yet reviewed'
                : r.status === 'FAILED' ? `review of version ${r.v} failed on ${day(r.at)}: ${r.failureReason}`
                : <>read version {r.v} on {day(r.at)}{data.current && r.v !== data.current.v ? ` (the document is now at version ${data.current.v})` : ''}: {r.issues} issue{r.issues === 1 ? '' : 's'} raised, {openBy(p.key)} still open{r.heldUp ? <span className="text-zinc-600"> · held up: {r.heldUp}</span> : null}</>}
            </li>
          )
        })}
      </ul>
      {!issues.length
        ? <p data-document-issues="0">No open issue is attached to {doc.d}. Issues raised on the proposal as a whole, or on the action, are in the Risks view and the action’s record.</p>
        : (
          <ul className="space-y-1.5" data-document-issues={issues.length}>
            {issues.map((i) => (
              <li key={i.id} className="border border-zinc-200 rounded p-1.5" data-document-issue={i.partN ?? 'whole'}>
                <p><span className="font-semibold">{i.title ?? 'An issue'}</span> · on {where(i.partN)}</p>
                <p className="whitespace-pre-wrap">{i.text}</p>
                <p className="text-zinc-600">{i.reviewId ? (i.attachReason ?? `Raised by ${producerWords(i.passKey)}`) : i.attachedBy === 'LEX' ? `Placed here by Lex${i.attachReason ? `: ${i.attachReason}` : ''}` : 'Placed here by you'}{i.sourceModel ? ` · raised by ${i.sourceModel}` : ''}</p>
              </li>
            ))}
            <li className="text-zinc-600">Answer an issue in the Risks view, or by redrafting this document.</li>
          </ul>
        )}
    </div>
  )
}

// ── 26-V2d §7: "Review this document" — the five passes read the current version; asks first, at the measured price ───────────────────
function ReviewAsk({ ideaId, documentId, busy, onDone, onClose }: { ideaId: string; documentId: string; busy: boolean; onDone: (said: string) => void; onClose: () => void }) {
  const [plan, setPlan] = useState<ReviewPlan | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'reviewPlan', documentId }) })
      const b = await r.json().catch(() => null)
      if (!r.ok) setErr(explainFailure(b, r.status, 'Pricing the review')); else setPlan((b as { data: ReviewPlan }).data)
    })()
  }, [ideaId, documentId])
  const run = async (again: boolean) => {
    setRunning(true)
    try {
      const r = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'review', documentId, again }) })
      const b = await r.json().catch(() => null) as { data?: { d: string; v: number; outcomes: Array<{ words: string }>; pence: number | null } } | null
      if (!r.ok || !b?.data) { onDone(`Not done: ${explainFailure(b, r.status, '“Review this document”')}`); return }
      onDone(`Reviewed ${b.data.d}, version ${b.data.v}${b.data.pence != null ? ` — it cost ${b.data.pence.toFixed(1)}p` : ''}. ${b.data.outcomes.map((o) => o.words).join(' ')} The issues are in the Issues tab, by part.`)
    } catch (e) { onDone(`Not done: “Review this document” could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`) }
    finally { setRunning(false) }
  }
  if (err) return <p role="alert">Not priced: {err} <button type="button" className="underline" onClick={onClose}>OK</button></p>
  if (!plan) return <p className="text-zinc-500">Reading what the five review passes have already read…</p>
  if (plan.notReviewable) return <p data-review-ask="not-reviewable">{plan.notReviewable} <button type="button" className="underline" onClick={onClose}>OK</button></p>
  const todo = plan.price.forPasses.length
  const priceWords = (pence: number | null) => (pence != null ? `about ${pence}p (measured on a copy of a real idea, n=${plan.price.n}, scaled to this document’s length)` : 'not yet measured')
  return (
    <div className="border-2 border-zinc-900 rounded p-1.5 space-y-1" data-review-ask={todo ? 'todo' : 'all-read'}>
      <p className="font-semibold">Review {plan.d}, version {plan.v}, with the five passes</p>
      <ul>{plan.passes.map((p) => <li key={p.passKey}><span aria-hidden>{p.readThisVersion ? '●' : '○'}</span> {p.label} — {p.readThisVersion ? `already read version ${plan.v}` : 'will read it'}: <span className="text-zinc-600">{p.strapline}</span></li>)}</ul>
      <p>Each pass reads the document part by part and raises issues on the part they concern; it searches nothing. Each is saved as it finishes. Nothing in the document changes.</p>
      {todo
        ? <p>{todo === 5 ? 'All five' : `The ${todo} that have not read this version`}: {priceWords(plan.price.pence)}.{' '}
            <button type="button" disabled={busy || running} onClick={() => void run(false)} data-review-run className="px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">{running ? 'Reviewing… (about 15 seconds)' : 'Review it'}</button>{' '}
            <button type="button" onClick={onClose} className="underline">Not now</button></p>
        : <p>All five have read version {plan.v}. Reviewing again adds a second set of issues: {priceWords(plan.price.again.pence)}.{' '}
            <button type="button" disabled={busy || running} onClick={() => void run(true)} data-review-again className="px-2 py-0.5 rounded border-2 border-zinc-900 disabled:opacity-40">{running ? 'Reviewing…' : 'Review again'}</button>{' '}
            <button type="button" onClick={onClose} className="underline">Not now</button></p>}
    </div>
  )
}

// ── Versions (3e) ────────────────────────────────────────────────────────────────────────────────────────────
function VersionsTab({ data }: { data: DocumentViewData }) {
  return (
    <ol className="space-y-1.5" data-versions-tab>
      {(data.proposal ?? data.textProposal) && (() => { const p = (data.proposal ?? data.textProposal)!; return <li data-version-row="proposal"><span aria-hidden>◇</span> Lex’s proposal {p.v} — waiting, {when(p.at)}{p.pence != null ? ` · ${p.pence.toFixed(1)}p` : ''}</li> })()}
      {[...data.versions].reverse().map((v) => (
        <li key={v.v} data-version-row={v.v}>
          <p><span aria-hidden>●</span> <span className="font-semibold">{versionWords(v)}</span> · {when(v.at)}{data.doc.acceptedV === v.v ? <span className="font-semibold"> · accepted</span> : ''}</p>
          {v.changeWords && <p className="ml-3 text-zinc-700">{v.changeWords}</p>}
          {v.lawWritten.length > 0 && <p className="ml-3">Wrote {v.lawWritten.length} law row{v.lawWritten.length === 1 ? '' : 's'}: {v.lawWritten.map((l) => `${l.target} (${INSTRUCTION_RELATION_WORD[l.relation as keyof typeof INSTRUCTION_RELATION_WORD] ?? l.relation})`).join('; ')}</p>}
          {v.lawWithdrawn.length > 0 && <p className="ml-3">Withdrew {v.lawWithdrawn.length}: {v.lawWithdrawn.map((l) => l.target).join('; ')}</p>}
        </li>
      ))}
      {data.setAside.map((p) => (
        <li key={`p${p.v}`} data-version-row={`set-aside-${p.v}`}><span aria-hidden>○</span> Lex’s proposal {p.v} — set aside{p.answeredAt ? ` on ${day(p.answeredAt)}` : ''}{p.replacedBy ? ` when proposal ${p.replacedBy} arrived` : ''}. Kept.</li>
      ))}
      {!data.versions.length && !data.proposal && !data.setAside.length && <li>No versions yet.</li>}
    </ol>
  )
}

/** The text above a document's first "## " part (a heading-less body is all parts, so nothing). */
const headOf = (body: string): string => { const i = body.search(/^## /m); return i > 0 ? body.slice(0, i).trim() : '' }

/** The ask before Lex drafts a note: the measured price, or — until it is measured — that it is not, in words. */
export function noteAskWords(p: { pence: number | null; n: number }): string {
  return p.pence != null
    ? `This costs about ${p.pence}p (measured on a copy of a real idea, n=${p.n}); Lex’s note arrives as a proposal beside the current version, never over it.`
    : 'The price of this is not yet measured; it is a single call, a few pence. Lex’s note arrives as a proposal beside the current version, never over it.'
}

// ── 26-V1b §5: Lex's proposal on a text document (the explanatory note), beside the current version ──────────────────
function TextProposal({ data, busy, write }: { data: DocumentViewData; busy: boolean; write: (url: 'action-documents' | 'action-structure', p: Record<string, unknown>, label: string, ok: (r: Record<string, unknown> | null) => string) => Promise<boolean> }) {
  const p = data.textProposal!
  const nextV = (data.current?.v ?? 0) + 1
  return (
    <section className="rounded border-2 border-zinc-900 p-2 space-y-1.5" aria-label={`Lex’s proposal ${p.v} beside the current version`} data-text-proposal>
      <p className="font-semibold"><span aria-hidden>◇</span> Lex’s proposal {p.v} — beside {data.current ? `version ${data.current.v}` : 'no version yet'}, not over it{p.pence != null ? ` (it cost ${p.pence.toFixed(1)}p)` : ''}</p>
      {p.reason && <details><summary className="cursor-pointer">What Lex says about it</summary><p className="mt-1 whitespace-pre-wrap">{p.reason}</p></details>}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" disabled={busy} data-use-proposal onClick={() => void write('action-documents', { op: 'useProposal', documentId: data.doc.id }, `Using Lex’s proposal for ${data.doc.d}`, () => `Saved: Lex’s proposal is now version ${nextV}. Not yet accepted — Accept when you are content.`)}
          className="px-2 py-0.5 rounded bg-zinc-900 text-white font-semibold disabled:opacity-40">Use it as version {nextV}</button>
        <button type="button" disabled={busy} data-set-aside onClick={() => void write('action-documents', { op: 'setAsideProposal', documentId: data.doc.id }, `Setting aside Lex’s proposal ${p.v}`, () => `Set aside: Lex’s proposal ${p.v} is kept, listed in Versions. Nothing else changed.`)}
          className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Set aside</button>
        <span className="text-zinc-600">To change it, use it first and then Edit — the proposal itself cannot be edited.</span>
      </div>
      <div className="border border-zinc-200 rounded p-1.5 space-y-1" data-text-proposal-body>
        {headOf(p.body) && <p className="whitespace-pre-wrap font-semibold">{headOf(p.body)}</p>}
        {partsOf(data.doc.kind, p.body).map((x) => <div key={x.n}><p className="font-semibold">{x.title}</p><pre className="whitespace-pre-wrap font-sans">{x.text.replace(/^## .*\n?/, '')}</pre></div>)}
      </div>
    </section>
  )
}

// ── 3g: the three-column comparison ──────────────────────────────────────────────────────────────────────────
function Comparison({ data, busy, write }: { data: DocumentViewData; busy: boolean; write: (url: 'action-documents' | 'action-structure', p: Record<string, unknown>, label: string, ok: (r: Record<string, unknown> | null) => string) => Promise<boolean> }) {
  const p = data.proposal!
  const field: 'clause' | 'plainWording' = data.legislative ? 'clause' : 'plainWording'
  const cur = data.current?.instruction ?? null
  const asIs = useMemo(() => cutClause(cur?.[field] ?? ''), [cur, field])
  const lex = useMemo(() => cutClause(p.instruction[field]), [p, field])
  const [work, setWork] = useState<ClauseCut>(asIs.parts.length || asIs.head ? asIs : { head: '', parts: [] })
  const [tookAll, setTookAll] = useState(false)
  const nums = partNumbers(asIs, lex, work)
  const other = versionChange(cur, p.instruction)
  const nextV = (data.current?.v ?? 0) + 1
  const workText = joinClause(work)
  const same = workText.trim() === joinClause(lex).trim()
  const save = () => {
    // Take all, unchanged: Lex's whole instruction becomes the version (its provision lines write their law rows). Otherwise your working
    // copy is saved over your own instruction's other fields (or Lex's, where you have no version yet) — said beside the button.
    if (tookAll && same) return void write('action-structure', { op: 'acceptDraft', actionId: data.actionId }, `Using Lex’s proposal for ${data.doc.d}`, (r) => `Saved: Lex’s proposal is now version ${String(r?.version ?? nextV)}; it wrote its law rows. Not yet accepted — Accept when you are content.`)
    const base = cur ?? p.instruction
    return void write('action-structure', { op: 'saveDraft', actionId: data.actionId, instruction: { ...base, [field]: workText } }, `Saving your working copy of ${data.doc.d}`, (r) => `Saved as version ${String(r?.version ?? nextV)}, yours. Lex’s proposal is still waiting — set it aside when you are done with it.`)
  }
  const col = 'border border-zinc-200 rounded p-1.5 align-top'
  return (
    <section className="rounded border-2 border-zinc-900 p-2 space-y-1.5" aria-label={`Lex’s proposal ${p.v} beside the current version`} data-comparison>
      <p className="font-semibold"><span aria-hidden>◇</span> Lex’s proposal {p.v} — beside {data.current ? `version ${data.current.v}` : 'no version yet'}, not over it{p.pence != null ? ` (it cost ${p.pence.toFixed(1)}p)` : ''}</p>
      {p.reason && <details data-comparison-reason><summary className="cursor-pointer">Why Lex drafted it this way</summary><p className="mt-1 whitespace-pre-wrap">{p.reason}</p></details>}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" disabled={busy} onClick={() => { setWork(lex); setTookAll(true) }} data-take-all className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Take all</button>
        <button type="button" disabled={busy} onClick={() => void write('action-structure', { op: 'dismissDraft', actionId: data.actionId }, `Setting aside Lex’s proposal ${p.v}`, () => `Set aside: Lex’s proposal ${p.v} is kept, listed in Versions. Nothing else changed.`)} data-set-aside className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Set aside</button>
        <button type="button" disabled={busy || !workText.trim()} onClick={save} data-save-version className="px-2 py-0.5 rounded bg-zinc-900 text-white font-semibold disabled:opacity-40">Save as version {nextV}</button>
        <span className="text-zinc-600">{tookAll && same ? 'Saving uses Lex’s whole instruction: the clause, its provision lines and every field.' : `Saving keeps ${cur ? 'your' : 'Lex’s'} instruction’s other fields and takes the working copy as the ${data.legislative ? 'clause' : 'wording'}.`}</span>
      </div>
      {(other.added.length > 0 || other.dropped.length > 0 || other.fields.length > 0) && (
        <p data-comparison-fields>Lex’s instruction also differs{other.added.length ? ` · adds: ${other.added.join('; ')}` : ''}{other.dropped.length ? ` · drops: ${other.dropped.join('; ')}` : ''}{other.fields.length ? ` · changes: ${other.fields.join(', ')}` : ''}. Only “Take all” brings those over.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 min-w-[42rem]">
          <thead><tr><th className="text-left w-1/3">As it stands</th><th className="text-left w-1/3">Lex proposes</th><th className="text-left w-1/3">Your working copy</th></tr></thead>
          <tbody>
            <tr data-comparison-row="head">
              <td className={col}><pre className="whitespace-pre-wrap font-serif">{asIs.head || <span className="font-sans text-zinc-500">{data.current ? 'nothing above (1)' : 'no version yet'}</span>}</pre></td>
              <td className={col}><pre className="whitespace-pre-wrap font-serif">{lex.head}</pre>
                {lex.head && <button type="button" onClick={() => { setWork({ ...work, head: lex.head }); setTookAll(false) }} className="mt-1 underline">Take this</button>}</td>
              <td className={col}><textarea value={work.head} onChange={(e) => { setWork({ ...work, head: e.target.value }); setTookAll(false) }} rows={3} aria-label="Your working copy — the lines above subsection (1)" className="w-full border border-zinc-300 rounded p-1 font-serif" /></td>
            </tr>
            {nums.map((n) => {
              const a = asIs.parts.find((x) => x.n === n), l = lex.parts.find((x) => x.n === n), w = work.parts.find((x) => x.n === n)
              return (
                <tr key={n} data-comparison-row={n}>
                  <td className={col}><pre className="whitespace-pre-wrap font-serif">{a?.text ?? <span className="font-sans text-zinc-500">no subsection ({n})</span>}</pre></td>
                  <td className={col}><pre className="whitespace-pre-wrap font-serif">{l?.text ?? <span className="font-sans text-zinc-500">no subsection ({n})</span>}</pre>
                    {l && <button type="button" data-take-part={n} onClick={() => { setWork(takePart(work, lex, n)); setTookAll(false) }} className="mt-1 underline">Take this</button>}</td>
                  <td className={col}>{w
                    ? <textarea value={w.text} onChange={(e) => { setWork({ ...work, parts: work.parts.map((x) => (x.n === n ? { ...x, text: e.target.value } : x)) }); setTookAll(false) }} rows={4} aria-label={`Your working copy — subsection (${n})`} className="w-full border border-zinc-300 rounded p-1 font-serif" />
                    : <span className="text-zinc-500">not in your copy</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-zinc-600">The proposal column cannot be edited; your working copy can.</p>
    </section>
  )
}
