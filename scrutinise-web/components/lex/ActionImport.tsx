'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-S §3 — "Import actions from a document": THE CONTROL, THE REVIEW TABLE AND THE ONE CONFIRM.
//
// A thing we do must be visible as a thing we do (BRIEF_26S §3a), so this is a button on the Coherent Actions toolbar beside "Check for
// gaps" — and the Lex tool and the offer-on-filing open this same panel. Nothing here writes to the actions list except Confirm.
//
//   1. pick a numbered document  2. it is read, part by part (the panel keeps the pass moving; a closed tab loses nothing)
//   3. REVIEW: the mapping table, the existing actions → heading, the proposed new headings, the passages not covered
//   4. one confirm: "Import N actions · add to M · send K to the policy", with what the pass cost
//
// ⚠ NOTHING IS SIGNALLED BY COLOUR ALONE (docs/CLAUDE.md §21): every disposition and every policy-test verdict is a WORD and a SHAPE.
// ⚠ The Item column is THE DOCUMENT'S words; the title and summary are Lex's, and are labelled so on screen.
// ⚠ Value imports are kept to constants (docs/CLAUDE.md §28): the server module is never imported here.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionImportRequest } from '@/lib/lex/action-import-schema'
import { explainFailure } from '@/lib/api-rejection'
import FocusDialog from './FocusDialog'
import { POLICY_VERDICT_UI } from '@/lib/lex/action-facets'
import { colourFor } from '@/lib/lex/action-headings'
import {
  PROPOSAL_KINDS, PROPOSAL_WORDS, PROPOSAL_GLYPH, PURPOSE_MAX_WORDS, IMPORT_OP_WORDS, countItems, confirmSentence, wordCount, chunkNeedsYou, partName,
  type ImportPassView, type ImportItem, type ImportableSource, type ProposalKind,
} from '@/lib/lex/action-import-types'

interface Reply { ok?: boolean; result?: unknown; error?: unknown }
type EditBody = Omit<Extract<ActionImportRequest, { op: 'edit' }>, 'op' | 'passId'>
type ItemPatch = NonNullable<EditBody['items']>[number]['patch']

export default function ActionImport({ ideaId, onChanged, initialSourceNumber }: { ideaId: string; onChanged?: () => void; initialSourceNumber?: number }) {
  const [open, setOpen] = useState(false)
  const [pass, setPass] = useState<ImportPassView | null>(null)
  const [importable, setImportable] = useState<{ sources: ImportableSource[]; notRead: Array<{ number: number; title: string; why: string }> } | null>(null)
  const [pick, setPick] = useState<number | null>(initialSourceNumber ?? null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const advancing = useRef(false)
  // Consecutive failed attempts to move the pass on. Three in a row STOPS the automatic reading and says so — a loop that retried a
  // broken route for ever would re-spend on the model every time.
  const failures = useRef(0)
  const [stalled, setStalled] = useState(false)

  const call = useCallback(async (body: ActionImportRequest, label?: string): Promise<{ ok: boolean; result: unknown }> => {
    setBusy(label ?? IMPORT_OP_WORDS[body.op]); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json().catch(() => ({}))) as Reply
      if (j.error || !res.ok) { const m = explainFailure(j, res.status, IMPORT_OP_WORDS[body.op]); setError(m); return { ok: false, result: null } }
      return { ok: true, result: j.result }
    } catch (e) {
      setError(`${IMPORT_OP_WORDS[body.op]} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`)
      return { ok: false, result: null }
    } finally { setBusy(null) }
  }, [ideaId])

  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/action-import?importable=1`).catch(() => null)
    if (!res?.ok) return
    const j = (await res.json()) as { pass: ImportPassView | null; importable: typeof importable }
    setPass(j.pass); setImportable(j.importable)
  }, [ideaId])

  // The panel opens on a pass already under way (a closed tab loses nothing), or when Lex offered the import.
  useEffect(() => { void load() }, [load])
  // Lex started an import from the chat (the asks-first tool): pick it up and show it.
  useEffect(() => {
    const h = () => { void load().then(() => setOpen(true)) }
    window.addEventListener('scrutinise:action-import-started', h)
    return () => window.removeEventListener('scrutinise:action-import-started', h)
  }, [load])
  // 26-S2 sec 9d: the review is a DIALOG now, so a pass already under way does not throw one over the page on load - it is announced beside the button (below) and opened by the user.
  useEffect(() => { if (initialSourceNumber) { setPick(initialSourceNumber); setOpen(true) } }, [initialSourceNumber])

  // Keep the pass moving while it is being read: one unit of work per request.
  useEffect(() => {
    // A part waiting for "Retry part N" stops the automatic reading (26-S2 §10.3): nothing further is spent until the user chooses.
    if (!pass || pass.status !== 'MAPPING' || advancing.current || stalled || pass.mapping.chunks.some(chunkNeedsYou)) return
    advancing.current = true
    void (async () => {
      const r = await call({ op: 'advance', passId: pass.id }, 'Reading the document')
      advancing.current = false
      if (r.ok) { failures.current = 0; setPass(r.result as ImportPassView) }
      else {
        failures.current += 1
        if (failures.current >= 3) setStalled(true)
        else await load()
      }
    })()
  }, [pass, call, load, stalled])

  const start = async () => {
    if (pick == null) return
    const r = await call({ op: 'start', sourceNumber: pick })
    if (r.ok) setPass(r.result as ImportPassView)
  }

  const edit = async (body: EditBody) => {
    if (!pass) return
    const r = await call({ op: 'edit', passId: pass.id, ...body }, 'Saving your changes')
    if (r.ok) setPass(r.result as ImportPassView)
  }
  const editItem = (itemId: string, patch: ItemPatch) => edit({ items: [{ itemId, patch }] })

  const confirm = async () => {
    if (!pass) return
    const r = await call({ op: 'confirm', passId: pass.id }, 'Importing')
    // Keep THIS pass on screen as confirmed (the server only offers a pass still open, so a reload would make the result vanish).
    if (r.ok) { setPass({ ...pass, status: 'CONFIRMED', result: r.result as ImportPassView['result'] }); onChanged?.() }
  }
  const discard = async () => {
    if (!pass) return
    const r = await call({ op: 'discard', passId: pass.id })
    if (r.ok) { setPass(null); setPick(null); await load(); setOpen(false) }
  }

  const counts = pass ? countItems(pass.mapping.items) : null
  const reading = pass?.status === 'MAPPING'
  const ready = pass?.status === 'READY'
  const done = pass?.status === 'CONFIRMED'

  return (
    <div className="mb-3" id="action-import">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => { setOpen(!open); if (!open) void load() }} aria-expanded={open}
          className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50">
          Import actions from a document
        </button>
        {pass && !open && ['MAPPING', 'READY', 'CONFIRMING', 'FAILED'].includes(pass.status) && (
          <span className="text-[11px] text-zinc-600" data-import-announce>An import of [Ref: {pass.sourceNumber}] is {pass.status === 'READY' ? 'waiting for your review' : pass.status === 'FAILED' ? 'stopped' : 'being read'}.{' '}
            <button type="button" onClick={() => { setOpen(true); void load() }} className="underline font-medium text-zinc-800">Open it</button></span>
        )}
      </div>

      {open && (
        <FocusDialog title="Import actions from a document" onClose={() => setOpen(false)} wide>
        <div className="space-y-3" role="region" aria-label="Import actions from a document">
          {error && <p className="text-xs font-semibold text-amber-800" role="alert">⚠ {error}</p>}
          {busy && <p className="text-[11px] text-zinc-600" role="status">Working: {busy}…</p>}

          {/* 1 · PICK */}
          {!pass && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-700">A document full of ideas can be turned into rows in this list — <strong>after you have seen and approved every one</strong>, and with each row saying where in the document it came from. Nothing is added until you confirm.</p>
              {importable && importable.sources.length === 0 && (
                <p className="text-xs text-zinc-700">There is no document to read yet. File it first with <strong>“+ Add research”</strong> (paste the text, or add the file), then come back here.</p>
              )}
              {importable && importable.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-zinc-700">Document
                    <select value={pick ?? ''} onChange={(e) => setPick(e.target.value ? Number(e.target.value) : null)} className="ml-1 text-xs border border-zinc-300 rounded px-1.5 py-1 max-w-[22rem]">
                      <option value="">Choose a filed document…</option>
                      {importable.sources.map((s) => <option key={s.number} value={s.number}>[Ref: {s.number}] {s.title} — {s.words.toLocaleString()} words</option>)}
                    </select>
                  </label>
                  {pick != null && (() => { const s = importable.sources.find((x) => x.number === pick); return s ? <span className="text-[11px] text-zinc-600">Reading it costs about <strong>{s.estimatePence}p</strong> ({s.basis}).</span> : null })()}
                  <button type="button" disabled={pick == null || !!busy} onClick={() => void start()} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white disabled:opacity-40">Read it and build the table</button>
                </div>
              )}
              {importable && importable.notRead.length > 0 && (
                <p className="text-[11px] text-zinc-500">Not offered, because they were saved but never read: {importable.notRead.map((n) => `[Ref: ${n.number}] ${n.title} (${n.why})`).join('; ')}.</p>
              )}
            </div>
          )}

          {/* 2 · READING */}
          {pass && reading && (
            <div className="space-y-1" role="status">
              <p className="text-sm font-medium text-zinc-900">Reading [Ref: {pass.sourceNumber}] “{pass.mapping.sourceTitle}”…</p>
              <p className="text-xs text-zinc-700">
                {pass.mapping.stage === 'ITEMS' && `${pass.chunksDone} of ${pass.chunkCount} parts read — ${pass.mapping.items.length} item${pass.mapping.items.length === 1 ? '' : 's'} so far.`}
                {pass.mapping.stage === 'STRUCTURE' && 'Proposing headings and the purpose of each.'}
                {pass.mapping.stage === 'POLICY_TEST' && 'Testing each row against your accepted Guiding Policy.'}
                {' '}You can leave this page; it will be here, at this point, when you come back. Spent so far: {(pass.spentPence ?? 0).toFixed(1)}p.
              </p>
              {/* 26-S2 §10.2 — what the pass did on its own, in one line ("Part 4 was too dense to read in one go — splitting it and trying again."). */}
              {pass.mapping.notice && <p className="text-xs text-zinc-800 bg-zinc-50 border border-zinc-300 rounded px-2 py-1" role="status">{pass.mapping.notice}</p>}
              {/* 26-S2 §10.3 — a part that would not read waits HERE; every part already read is kept, and nothing is written. */}
              {pass.mapping.chunks.some(chunkNeedsYou) && (
                <div className="rounded border-2 border-zinc-900 bg-white px-2 py-1.5 space-y-1" role="alert" data-import-stuck>
                  <p className="text-xs font-semibold text-zinc-900">⚠ {pass.failure ?? 'A part could not be read.'}</p>
                  <div className="flex flex-wrap gap-2">
                    {pass.mapping.chunks.filter(chunkNeedsYou).map((c) => (
                      <button key={c.index} type="button" disabled={!!busy} onClick={async () => { const r = await call({ op: 'retryPart', passId: pass.id, chunkIndex: c.index }, `Retrying part ${partName(c)}`); if (r.ok) setPass(r.result as ImportPassView) }}
                        className="text-xs font-medium px-2 py-0.5 rounded border-2 border-zinc-900 bg-white disabled:opacity-40">Retry part {partName(c)}</button>
                    ))}
                  </div>
                </div>
              )}
              {stalled && (
                <p className="text-xs font-semibold text-amber-800" role="alert">⚠ Reading stopped after three failed tries (the reason is above). Nothing has been written to your actions.{' '}
                  <button type="button" onClick={() => { failures.current = 0; setStalled(false); void load() }} className="underline">Try again</button></p>
              )}
              <button type="button" onClick={() => void discard()} className="text-[11px] underline text-zinc-600">Stop and discard this import</button>
            </div>
          )}

          {pass?.status === 'FAILED' && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-800" role="alert">⚠ {pass.failure ?? 'The import failed.'}</p>
              <button type="button" onClick={() => void discard()} className="text-xs underline">Discard it so you can start again</button>
            </div>
          )}

          {/* 3 · REVIEW */}
          {pass && ready && counts && (
            <ImportReview pass={pass} counts={counts} busy={!!busy} editItem={editItem} edit={edit} confirm={confirm} discard={discard} />
          )}

          {/* 4 · AFTER */}
          {pass && done && pass.result && <After pass={pass} ideaId={ideaId} onChanged={onChanged} onAnother={() => { setPass(null); setPick(null); void load() }} />}
        </div>
        </FocusDialog>
      )}
    </div>
  )
}

// ── the review ────────────────────────────────────────────────────────────────────────────────────────────

/** Exported for the render check (check:lex-26s reads the rendered table, not the source). */
export function ImportReview({ pass, counts, busy, editItem, edit, confirm, discard }: {
  pass: ImportPassView; counts: ReturnType<typeof countItems>; busy: boolean
  editItem: (id: string, p: ItemPatch) => Promise<void>
  edit: (b: EditBody) => Promise<void>
  confirm: () => Promise<void>; discard: () => Promise<void>
}) {
  const m = pass.mapping
  const [showUncovered, setShowUncovered] = useState(false)
  const [showExisting, setShowExisting] = useState(false)
  const headingNames = m.headings.filter((h) => !h.struck).map((h) => h.name)
  const changes = m.existing.filter((e) => e.proposedHeading).length

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-zinc-900">Review what will be written from [Ref: {pass.sourceNumber}] “{m.sourceTitle}”</p>
        <p className="text-xs text-zinc-700 mt-0.5">{m.items.length} item{m.items.length === 1 ? '' : 's'} found. The first column is <strong>the document’s own words</strong>; the title and summary are <strong>Lex’s wording</strong>. Change anything, leave a row out, or move it to another disposition — nothing is written until you confirm below.</p>
        {m.policyTestNote && <p className="text-xs text-amber-800 mt-1" role="note">⚠ {m.policyTestNote}</p>}
      </div>

      <div className="overflow-x-auto border border-zinc-200 rounded-lg">
        <table className="w-full text-[11px] align-top">
          <thead className="bg-zinc-50 text-left text-zinc-700">
            <tr><th className="p-1.5 font-semibold w-[28%]">Item (the document’s words)</th><th className="p-1.5 font-semibold w-[17%]">Proposal</th><th className="p-1.5 font-semibold w-[17%]">Policy test</th><th className="p-1.5 font-semibold">Lex’s title and summary · implementer</th></tr>
          </thead>
          <tbody>
            {m.items.map((it) => <Row key={it.id} it={it} headingNames={headingNames} existing={m.existing} editItem={editItem} />)}
          </tbody>
        </table>
      </div>

      {/* Existing actions → heading */}
      <div>
        <button type="button" onClick={() => setShowExisting(!showExisting)} aria-expanded={showExisting} className="text-xs font-semibold underline">
          Your existing actions → heading ({changes} proposed change{changes === 1 ? '' : 's'}; {m.existing.length - changes} no change)
        </button>
        {showExisting && (
          <ul className="mt-1 space-y-1">
            {m.existing.map((e) => (
              <li key={e.actionId} className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-zinc-400 tabular-nums w-7">#{e.number ?? '?'}</span>
                <span className="flex-1 min-w-[10rem] text-zinc-800">{e.label}</span>
                <span className="text-zinc-500">now: {e.currentHeading ?? 'no heading'}</span>
                <select value={e.proposedHeading ?? ''} onChange={(ev) => void edit({ existing: [{ actionId: e.actionId, proposedHeading: ev.target.value || null }] })} disabled={busy}
                  aria-label={`Heading for existing action ${e.number ?? ''}`} className="border border-zinc-300 rounded px-1 py-0.5 max-w-[12rem]">
                  <option value="">no change</option>
                  {[...new Set([...headingNames, ...(e.currentHeading ? [e.currentHeading] : [])])].map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Proposed headings */}
      {m.headings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-900">Headings (an instrument is a heading; an action is one provision in it)</p>
          <ul className="mt-1 space-y-2">
            {m.headings.map((h) => {
              const c = colourFor(h.colourKey)
              return (
                <li key={h.name} className={`rounded border p-2 ${h.struck ? 'opacity-60 border-dashed border-zinc-300' : 'border-zinc-200'}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span aria-hidden style={{ color: c.hex }}>{c.glyph}</span>
                    <span className="font-semibold">{h.name}</span>
                    <span className="text-zinc-500">{h.isNew ? `new heading · ${c.name}` : 'already on your list'}</span>
                    {h.isNew && <button type="button" disabled={busy} onClick={() => void edit({ headings: [{ name: h.name, struck: !h.struck }] })} className="underline text-[11px]">{h.struck ? 'Put it back' : 'Leave this heading out'}</button>}
                  </div>
                  <PurposeBox value={h.purpose} disabled={busy || h.struck} onCommit={(v) => void edit({ headings: [{ name: h.name, purpose: v }] })} />
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* What no row covers */}
      {m.uncovered.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowUncovered(!showUncovered)} aria-expanded={showUncovered} className="text-xs font-semibold underline">
            Passages not covered by any row ({m.uncovered.length}) — check nothing was missed
          </button>
          {showUncovered && (
            <ul className="mt-1 space-y-1 text-[11px] text-zinc-700">
              {m.uncovered.map((u, i) => <li key={i}><span className="text-zinc-500">{u.section}:</span> “{u.text}”</li>)}
            </ul>
          )}
        </div>
      )}

      {/* THE ONE CONFIRM */}
      <div className="rounded-lg border-2 border-zinc-900 p-3 bg-zinc-50">
        <p className="text-sm font-semibold text-zinc-900">{confirmSentence(counts)}</p>
        <p className="text-[11px] text-zinc-700 mt-0.5">
          {counts.notAction + counts.unplaced + counts.struck > 0 && `${counts.notAction} not an action · ${counts.unplaced} could not be placed · ${counts.struck} left out — none of these is written. `}
          New actions land at the end of your list, <strong>not confirmed</strong> (“These are my actions” is untouched), each saying where it came from. Text added to an existing action goes <strong>beside</strong> yours, labelled — yours is never overwritten. Items for the policy go to the policy review as proposals; <strong>nothing on the policy changes until you accept it</strong>.
          {' '}Reading the document cost {(pass.spentPence ?? 0).toFixed(1)}p across {pass.chunkCount} parts — measured on this document (n=1 run); confirming costs nothing more.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void confirm()} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 text-white disabled:opacity-40">Confirm: {confirmSentence(counts)}</button>
          <button type="button" disabled={busy} onClick={() => void discard()} className="text-xs underline">Discard this import</button>
        </div>
      </div>
    </div>
  )
}

function Row({ it, headingNames, existing, editItem }: {
  it: ImportItem; headingNames: string[]; existing: ImportPassView['mapping']['existing']
  editItem: (id: string, p: ItemPatch) => Promise<void>
}) {
  const pt = it.policyTest
  const v = pt ? POLICY_VERDICT_UI[pt.verdict] : null
  const isAction = it.proposal === 'NEW' || it.proposal === 'ADDS_TO' || it.proposal === 'PART_OF'
  return (
    <tr className={`border-t border-zinc-200 ${it.struck ? 'opacity-50' : ''}`} data-item-id={it.id}>
      <td className="p-1.5">
        <p className="text-zinc-500">{it.section}{it.edited ? ' · edited' : ''}</p>
        <p className={`${it.struck ? 'line-through' : ''}`}>“{it.quote}”</p>
        {!it.quoteVerified && <p className="text-amber-800 font-semibold">Lex’s wording, not found word for word in the document.</p>}
      </td>
      <td className="p-1.5">
        <label className="sr-only" htmlFor={`prop-${it.id}`}>Proposal for {it.section}</label>
        <select id={`prop-${it.id}`} value={it.proposal} onChange={(e) => void editItem(it.id, { proposal: e.target.value as ProposalKind })} className="border border-zinc-300 rounded px-1 py-0.5 w-full">
          {PROPOSAL_KINDS.map((k) => <option key={k} value={k}>{PROPOSAL_GLYPH[k]} {PROPOSAL_WORDS[k]}</option>)}
        </select>
        {it.proposal === 'NEW' && (
          <input list={`heads-${it.id}`} defaultValue={it.headingName ?? ''} onBlur={(e) => { if ((e.target.value || null) !== it.headingName) void editItem(it.id, { headingName: e.target.value || null }) }}
            placeholder="under heading…" aria-label={`Heading for ${it.section}`} className="mt-1 w-full border border-zinc-300 rounded px-1 py-0.5" />
        )}
        {(it.proposal === 'ADDS_TO' || it.proposal === 'PART_OF') && (
          <select value={it.actionNumber ?? ''} onChange={(e) => void editItem(it.id, { actionNumber: e.target.value ? Number(e.target.value) : null })} aria-label={`Which action ${it.section} adds to`} className="mt-1 w-full border border-zinc-300 rounded px-1 py-0.5">
            <option value="">which action?</option>
            {existing.map((x) => <option key={x.actionId} value={x.number ?? ''}>#{x.number} {x.label.slice(0, 50)}</option>)}
          </select>
        )}
        <datalist id={`heads-${it.id}`}>{headingNames.map((h) => <option key={h} value={h} />)}</datalist>
        <p className="mt-1 text-zinc-600">{it.reason}</p>
        <button type="button" onClick={() => void editItem(it.id, { struck: !it.struck })} className="mt-1 underline">{it.struck ? 'Put it back' : 'Leave this out'}</button>
      </td>
      <td className="p-1.5">
        {isAction && v ? <p className={`font-semibold text-zinc-900 ${pt!.verdict === 'CONFLICTS' ? 'border-2 border-zinc-900 rounded px-1 inline-block' : ''}`}><span aria-hidden>{v.glyph}</span> {v.word}</p>
          : <p className="text-zinc-500">{isAction ? 'Not tested' : '—'}</p>}
        {isAction && pt?.reason && <p className="text-zinc-600 mt-0.5">{pt.reason}</p>}
      </td>
      <td className="p-1.5">
        {isAction || it.proposal === 'POLICY' ? (
          <div className="space-y-1">
            <input defaultValue={it.title} onBlur={(e) => { if (e.target.value !== it.title) void editItem(it.id, { title: e.target.value }) }} aria-label={`Title for ${it.section}`} className="w-full border border-zinc-300 rounded px-1 py-0.5 font-medium" />
            <textarea defaultValue={it.summary} onBlur={(e) => { if (e.target.value !== it.summary) void editItem(it.id, { summary: e.target.value }) }} rows={2} aria-label={`Summary for ${it.section}`} className="w-full border border-zinc-300 rounded px-1 py-0.5" />
            <input defaultValue={it.implementer ?? ''} onBlur={(e) => { if ((e.target.value || null) !== it.implementer) void editItem(it.id, { implementer: e.target.value || null }) }} placeholder="implementer (only if the document names one)" aria-label={`Implementer for ${it.section}`} className="w-full border border-zinc-300 rounded px-1 py-0.5" />
            {it.proposal === 'POLICY' && <p className="text-zinc-600">Goes to the policy review{it.policyCategory ? ` as: ${it.policyCategory.replace(/_/g, ' ').toLowerCase()}` : ''}{it.policyTarget ? ` (${it.policyTarget})` : ''}.</p>}
          </div>
        ) : <p className="text-zinc-500">Not written.</p>}
      </td>
    </tr>
  )
}

function PurposeBox({ value, disabled, onCommit }: { value: string; disabled: boolean; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const n = wordCount(v)
  return (
    <div className="mt-1">
      <label className="text-[11px] text-zinc-600">Purpose — what this instrument does and why it is needed (Lex’s draft; edit it)</label>
      <textarea value={v} disabled={disabled} rows={3} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value && n <= PURPOSE_MAX_WORDS) onCommit(v) }}
        aria-label="Purpose paragraph" className="w-full text-[11px] border border-zinc-300 rounded px-1 py-0.5" />
      <p className={`text-[11px] ${n > PURPOSE_MAX_WORDS ? 'font-semibold text-amber-800' : 'text-zinc-500'}`}>{n} of {PURPOSE_MAX_WORDS} words{n > PURPOSE_MAX_WORDS ? ' — too long to save; shorten it' : ''}</p>
    </div>
  )
}

// ── after the confirm ────────────────────────────────────────────────────────────────────────────────────

function After({ pass, ideaId, onChanged, onAnother }: { pass: ImportPassView; ideaId: string; onChanged?: () => void; onAnother: () => void }) {
  const r = pass.result!
  const [note, setNote] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const run = async (op: 'proposeTitles' | 'proposeFacets', label: string) => {
    setWorking(label)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-structure`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op }) })
      const j = (await res.json().catch(() => ({}))) as Reply
      setNote(j.error || !res.ok ? explainFailure(j, res.status, label) : `${label}: done. Nothing is saved until you accept.`)
      onChanged?.()
    } finally { setWorking(null) }
  }
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm font-semibold text-zinc-900">Imported from [Ref: {pass.sourceNumber}]: {r.created.length} new action{r.created.length === 1 ? '' : 's'}{r.created.length ? ` (#${r.created.map((c) => c.number ?? '?').join(', #')})` : ''}, added to {r.addedTo.length}, {r.findings} sent to the policy review{r.headingsCreated.length ? `, ${r.headingsCreated.length} new heading${r.headingsCreated.length === 1 ? '' : 's'}` : ''}{r.reheaded ? `, ${r.reheaded} existing re-headed` : ''}.</p>
      <p className="text-xs text-zinc-700">The new actions are in your list, not confirmed, and each one says where it came from. <strong>The gap check has not been re-run</strong> — press “Check for gaps” when you want it to look again.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!working} onClick={() => void run('proposeTitles', 'Title these for me')} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300">Title these for me</button>
        <button type="button" disabled={!!working} onClick={() => void run('proposeFacets', 'Classify with Lex')} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300">Classify with Lex</button>
      </div>
      <button type="button" onClick={onAnother} className="text-[11px] underline text-zinc-600">Import another document</button>
      {working && <p className="text-[11px] text-zinc-600">Working: {working}…</p>}
      {note && <p className="text-[11px] text-zinc-700">{note}</p>}
    </div>
  )
}
