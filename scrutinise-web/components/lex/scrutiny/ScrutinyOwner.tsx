'use client'
// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-AC part (a) (BRIEF_26AC §3) — THE OWNER'S PRIVATE SCRUTINY PAGE, the client half. Every control calls /api/ideas/[id]/scrutiny
// and then refreshes the page from the server, so what is shown is what is stored.
//
// ⚠ EVERY STEP THAT CANNOT BE UNDONE ASKS FIRST, IN PLACE (never a browser dialog): creating an edition, freezing a draft again, publishing.
//   The checklist shows before publishing; with anything on it, the button says "Publish anyway", and the list is recorded with the edition.
// ⚠ THE SOURCE-LINKING EXERCISE IS PRICED BEFORE IT RUNS (Price it → the price and its basis → Run it at that price). Lex's links are
//   proposals beside the section, never over it: nothing is cited on the page until the owner accepts it.
// ⚠ A refusal is shown in the server's own words, where the control is.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import InfoLabel from '@/components/lex/InfoLabel'
import { SCRUTINY_UI as U } from '@/lib/lex/screen-labels'
import { SCRUTINY_INFO, SCRUTINY_HEADING } from '@/lib/lex/brief-info'
import { LIMITS } from '@/lib/lex/input-limits'
import { checklistCount, type Checklist, type LinkRow, type NoteRow, type PublishedChecklist } from '@/lib/lex/scrutiny-edition-types'
import type { EditionSummary } from '@/lib/lex/scrutiny-edition'

export interface OwnerDraft {
  id: string; number: number; versionNumber: number; blind: boolean; hidden: string[]
  sections: Array<{ key: string; label: string }>
  targets: Array<{ kind: 'HEADING' | 'ACTION'; id: string; label: string }>
  notes: NoteRow[]; links: LinkRow[]; checklist: Checklist
  sources: Array<{ number: number; title: string }>
  sectionCount: number
}

const btn = 'inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 font-semibold disabled:opacity-50'
const primary = `${btn} border-zinc-900 bg-zinc-900 text-white`
const quiet = `${btn} border-zinc-300 bg-white text-zinc-900`

function ChecklistList({ c }: { c: Checklist }) {
  const group = (title: string, items: Checklist['unlinked']) => items.length ? (
    <div className="mt-2"><p className="font-semibold">⚠ {title} ({items.length})</p><ul className="mt-1 list-disc space-y-0.5 pl-6 text-[15px]">{items.map((i) => <li key={i.key}>{i.words}</li>)}</ul></div>
  ) : null
  return <>{group(U.unlinked, c.unlinked)}{group(U.unaccepted, c.unaccepted)}{group(U.uncited, c.uncited)}</>
}

export default function ScrutinyOwner({ ideaId, title, owner, editions, draft }: { ideaId: string; title: string; owner: boolean; editions: EditionSummary[]; draft: OwnerDraft | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ where: string; words: string } | null>(null)
  const [ask, setAsk] = useState<'create' | 'refresh' | 'publish' | null>(null)
  const [noteAt, setNoteAt] = useState('TOP')
  const [noteBody, setNoteBody] = useState('')
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [estimate, setEstimate] = useState<{ pence: number | null; priceWords: string | null; basis: string; sections: number; sources: number } | null>(null)
  const [linkResult, setLinkResult] = useState<{ proposed: number; dropped: string[]; unlinked: string[]; pence: number | null } | null>(null)
  const [manual, setManual] = useState<{ target: string; ref: string }>({ target: 'S', ref: '' })

  async function call(where: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(where); setError(null)
    try {
      const r = await fetch(`/api/ideas/${ideaId}/scrutiny`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; data?: Record<string, unknown>; error?: string }
      if (!r.ok || !j.ok) { setError({ where, words: j.error ?? `That did not work (${r.status}). Nothing was changed.` }); return null }
      return j.data ?? {}
    } catch { setError({ where, words: 'The server could not be reached. Nothing was changed.' }); return null }
    finally { setBusy(null) }
  }
  const done = () => { setAsk(null); router.refresh() }
  const Err = ({ where }: { where: string }) => (error?.where === where ? <p role="alert" data-error={where} className="mt-2 rounded-md border-2 border-zinc-900 px-3 py-2 text-[15px]">✕ {error.words}</p> : null)
  const nextNumber = (editions[0]?.number ?? 0) + 1
  const published = editions.filter((e) => e.status === 'PUBLISHED')

  return (
    <div data-scrutiny-owner className="mx-auto w-full max-w-[44rem] px-4 pb-24 pt-6 text-[16px] leading-7 text-zinc-900 sm:px-6">
      <p className="text-sm"><a href={`/ideas/create?ideaId=${ideaId}`} className="underline">‹ {title}</a></p>
      <h1 className="mt-2 text-3xl font-semibold text-zinc-950">{U.page}</h1>
      <p className="mt-2 text-zinc-700">{U.intro}</p>

      {/* ── create ── */}
      {owner && !draft ? (
        <section className="mt-6" data-create>
          {ask === 'create' ? (
            <div role="group" className="rounded-md border-2 border-zinc-900 p-3">
              <p>{U.createAsk(String(nextNumber))}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={primary} disabled={!!busy} data-create-confirm onClick={async () => { if (await call('create', { op: 'create' })) done() }}>{U.create}</button>
                <button type="button" className={quiet} onClick={() => setAsk(null)}>{U.notNow}</button>
              </div>
            </div>
          ) : <button type="button" className={primary} data-create-ask onClick={() => setAsk('create')}>＋ {U.create}</button>}
          <Err where="create" />
        </section>
      ) : null}

      {/* ── the draft being prepared ── */}
      {draft ? (
        <section className="mt-8 rounded-lg border-2 border-zinc-900 p-4" data-draft-edition={draft.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">{U.edition(String(draft.number))} · <span className="font-normal">✎ {U.draft}</span></h2>
            <a href={`/scrutiny/${draft.id}`} className="font-semibold underline" data-preview>◉ {U.preview}</a>
          </div>
          <p className="mt-1 text-[15px] text-zinc-700">Frozen from version {draft.versionNumber} of the proposal.</p>

          {owner ? (<>
            {/* re-freeze */}
            <div className="mt-3">
              {ask === 'refresh' ? (
                <div role="group" className="rounded-md border border-zinc-400 p-3"><p>{U.refreshAsk}</p>
                  <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={primary} disabled={!!busy} data-refresh-confirm onClick={async () => { if (await call('refresh', { op: 'refresh', editionId: draft.id })) done() }}>{U.refresh}</button><button type="button" className={quiet} onClick={() => setAsk(null)}>{U.notNow}</button></div>
                </div>
              ) : <button type="button" className={quiet} data-refresh-ask onClick={() => setAsk('refresh')}>↻ {U.refresh}</button>}
              <Err where="refresh" />
            </div>

            {/* sections */}
            <fieldset className="mt-6">
              <legend className="flex flex-wrap items-center text-lg font-semibold">{U.sections}<InfoLabel about={U.sections} info={SCRUTINY_INFO.sections} /></legend>
              <ul className="mt-2 space-y-1">{draft.sections.map((s) => {
                const on = !draft.hidden.includes(s.key)
                return <li key={s.key}><label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={on} disabled={!!busy} data-include={s.key}
                  onChange={async () => { const hidden = on ? [...draft.hidden, s.key] : draft.hidden.filter((k) => k !== s.key); if (await call('include', { op: 'include', editionId: draft.id, hidden })) done() }} /><span>{s.label}</span><span className="text-sm text-zinc-600">{on ? '✓ included' : '— left out'}</span></label></li>
              })}</ul>
              <Err where="include" />
            </fieldset>

            {/* blind */}
            <div className="mt-4">
              <label className="flex min-h-[44px] flex-wrap items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={draft.blind} disabled={!!busy} data-blind onChange={async () => { if (await call('blind', { op: 'blind', editionId: draft.id, blind: !draft.blind })) done() }} /><span className="font-semibold">{U.blind}</span><span className="text-sm text-zinc-600">{draft.blind ? '◉ on: each reviewer sees only their own until the round closes' : '○ off: every reviewer sees every contribution'}</span><InfoLabel about={U.blind} info={SCRUTINY_INFO.blind} /></label>
              <Err where="blind" />
            </div>

            {/* author's notes */}
            <section className="mt-6" data-notes>
              <h3 className="flex flex-wrap items-center text-lg font-semibold">{U.notes}<InfoLabel about={U.notes} info={SCRUTINY_INFO.authorNote} /></h3>
              <ul className="mt-2 space-y-3">{draft.notes.map((n) => {
                const where = n.targetKind === 'TOP' ? U.noteTop : draft.targets.find((t) => t.id === n.targetId)?.label ?? 'a section no longer in this edition'
                return (
                  <li key={n.id} data-note={n.id} className={`rounded-md border p-3 ${n.archivedAt ? 'border-dashed border-zinc-300 text-zinc-500' : 'border-zinc-300'}`}>
                    <p className="text-sm text-zinc-600">{n.archivedAt ? `— ${U.setAside} · ` : ''}{where}</p>
                    {editing?.id === n.id ? (<>
                      <textarea className="mt-1 w-full rounded-md border border-zinc-400 p-2" rows={4} value={editing.body} maxLength={LIMITS.authorNote} onChange={(e) => setEditing({ id: n.id, body: e.target.value })} />
                      <p className="text-xs text-zinc-600">{editing.body.length.toLocaleString('en-GB')} / {LIMITS.authorNote.toLocaleString('en-GB')}</p>
                      <div className="mt-1 flex flex-wrap gap-2"><button type="button" className={primary} disabled={!!busy} onClick={async () => { if (await call(`note:${n.id}`, { op: 'editNote', editionId: draft.id, noteId: n.id, body: editing.body })) { setEditing(null); done() } }}>{U.save}</button><button type="button" className={quiet} onClick={() => setEditing(null)}>{U.cancel}</button></div>
                    </>) : <p className="mt-1 whitespace-pre-wrap">{n.body}</p>}
                    {editing?.id !== n.id ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!n.archivedAt ? <button type="button" className={quiet} onClick={() => setEditing({ id: n.id, body: n.body })}>✎ {U.edit}</button> : null}
                        <button type="button" className={quiet} disabled={!!busy} data-note-archive={n.id} onClick={async () => { if (await call(`note:${n.id}`, { op: 'archiveNote', editionId: draft.id, noteId: n.id, archived: !n.archivedAt })) done() }}>{n.archivedAt ? `↺ ${U.restore}` : `— ${U.setAside}`}</button>
                      </div>
                    ) : null}
                    <Err where={`note:${n.id}`} />
                  </li>
                )
              })}</ul>
              <div className="mt-3 rounded-md border border-zinc-300 p-3">
                <label className="block text-sm font-semibold" htmlFor="note-at">{U.noteAt}</label>
                <select id="note-at" className="mt-1 w-full max-w-full rounded-md border border-zinc-400 p-2" value={noteAt} onChange={(e) => setNoteAt(e.target.value)} data-note-at>
                  <option value="TOP">{U.noteTop}</option>
                  {draft.targets.map((t) => <option key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>{t.label}</option>)}
                </select>
                <textarea className="mt-2 w-full rounded-md border border-zinc-400 p-2" rows={4} value={noteBody} maxLength={LIMITS.authorNote} onChange={(e) => setNoteBody(e.target.value)} data-note-body aria-label={U.addNote} />
                <p className="text-xs text-zinc-600">{noteBody.length.toLocaleString('en-GB')} / {LIMITS.authorNote.toLocaleString('en-GB')}</p>
                <button type="button" className={`${primary} mt-2`} disabled={!!busy || !noteBody.trim()} data-note-add onClick={async () => {
                  const [kind, tid] = noteAt === 'TOP' ? ['TOP', null] : [noteAt.split(':')[0], noteAt.slice(noteAt.indexOf(':') + 1)]
                  if (await call('addNote', { op: 'addNote', editionId: draft.id, targetKind: kind, targetId: tid, body: noteBody })) { setNoteBody(''); done() }
                }}>＋ {U.addNote}</button>
                <Err where="addNote" />
              </div>
            </section>

            {/* the source-linking exercise */}
            <section className="mt-6" data-linking>
              <h3 className="flex flex-wrap items-center text-lg font-semibold">{U.linking}<InfoLabel about={U.linking} info={SCRUTINY_HEADING.linking} /></h3>
              <p className="mt-1 text-[15px] text-zinc-700">{U.linkingIntro}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" className={quiet} disabled={!!busy} data-link-price onClick={async () => { const d = await call('linkEstimate', { op: 'linkEstimate', editionId: draft.id }); if (d) setEstimate(d as never) }}>£ {U.linkPrice}</button>
                {estimate ? (estimate.pence == null
                  ? <span data-link-estimate className="text-[15px]">Not offered yet: {estimate.basis}.</span>
                  : <>
                    <span data-link-estimate className="text-[15px]">About {estimate.priceWords} for {estimate.sections} sections and {estimate.sources} filed sources ({estimate.basis}).</span>
                    <button type="button" className={primary} disabled={!!busy} data-link-run onClick={async () => { const d = await call('linkRun', { op: 'linkRun', editionId: draft.id, agreedPence: estimate.pence }); if (d) { setLinkResult(d as never); setEstimate(null); router.refresh() } }}>{U.linkRun} — {estimate.priceWords}</button>
                  </>) : null}
              </div>
              <Err where="linkEstimate" /><Err where="linkRun" />
              {linkResult ? (
                <div className="mt-2 rounded-md border border-zinc-300 p-3 text-[15px]" data-link-result>
                  <p>Lex proposed {linkResult.proposed} {linkResult.proposed === 1 ? 'link' : 'links'}{linkResult.pence != null ? `, for ${linkResult.pence.toFixed(1)}p` : ''}.</p>
                  {linkResult.dropped.length ? <p className="mt-1">Left out, because they could not be checked: {linkResult.dropped.join('; ')}.</p> : null}
                  {linkResult.unlinked.length ? <p className="mt-1">{U.unlinkedAfter}: {linkResult.unlinked.join('; ')}.</p> : null}
                </div>
              ) : null}
              {draft.links.length ? (
                <ul className="mt-3 space-y-2">{draft.links.map((l) => {
                  const where = l.targetKind === 'SUMMARY' ? U.ideaInOnePage : `${draft.targets.find((t) => t.id === l.targetId)?.label ?? 'a section'}${l.targetKind === 'DRAFT' ? ' (its draft)' : ''}`
                  const mark = l.status === 'ACCEPTED' ? '✓ accepted' : l.status === 'REJECTED' ? '✕ rejected' : `? ${U.linkProposed}`
                  return (
                    <li key={l.id} data-link={l.id} className="rounded-md border border-zinc-300 p-3 text-[15px]">
                      <p><span className="font-semibold">{mark}</span> · {where} → [Ref: {l.sourceNumber}] {l.sourceTitle}</p>
                      {l.claim ? <p className="mt-1 italic">“{l.claim}”</p> : null}
                      {l.reason ? <p className="mt-1 text-zinc-700">{l.reason}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {l.status !== 'ACCEPTED' ? <button type="button" className={quiet} disabled={!!busy} data-link-accept={l.id} onClick={async () => { if (await call(`link:${l.id}`, { op: 'answerLink', editionId: draft.id, linkId: l.id, answer: 'ACCEPTED' })) done() }}>✓ {U.accept}</button> : null}
                        {l.status !== 'REJECTED' ? <button type="button" className={quiet} disabled={!!busy} data-link-reject={l.id} onClick={async () => { if (await call(`link:${l.id}`, { op: 'answerLink', editionId: draft.id, linkId: l.id, answer: 'REJECTED' })) done() }}>✕ {U.reject}</button> : null}
                        {l.status !== 'PROPOSED' && l.proposedBy === 'LEX' ? <button type="button" className={quiet} disabled={!!busy} onClick={async () => { if (await call(`link:${l.id}`, { op: 'answerLink', editionId: draft.id, linkId: l.id, answer: 'PROPOSED' })) done() }}>↺ {U.undo}</button> : null}
                      </div>
                      <Err where={`link:${l.id}`} />
                    </li>
                  )
                })}</ul>
              ) : null}
              {draft.sources.length ? (
                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-zinc-300 p-3" data-link-manual>
                  <label className="text-sm font-semibold">{U.linkSection}
                    <select className="mt-1 block w-full max-w-[16rem] rounded-md border border-zinc-400 p-2 font-normal" value={manual.target} onChange={(e) => setManual({ ...manual, target: e.target.value })}>
                      <option value="S">{U.ideaInOnePage}</option>
                      {draft.targets.map((t) => <option key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">{U.linkSource}
                    <select className="mt-1 block w-full max-w-[16rem] rounded-md border border-zinc-400 p-2 font-normal" value={manual.ref} onChange={(e) => setManual({ ...manual, ref: e.target.value })}>
                      <option value="">{U.choose}</option>
                      {draft.sources.map((s) => <option key={s.number} value={s.number}>[{s.number}] {s.title.slice(0, 60)}</option>)}
                    </select>
                  </label>
                  <button type="button" className={quiet} disabled={!!busy || !manual.ref} onClick={async () => {
                    const [kind, tid] = manual.target === 'S' ? ['SUMMARY', null] : [manual.target.split(':')[0], manual.target.slice(manual.target.indexOf(':') + 1)]
                    if (await call('addLink', { op: 'addLink', editionId: draft.id, targetKind: kind, targetId: tid, sourceNumber: Number(manual.ref) })) { setManual({ target: 'S', ref: '' }); done() }
                  }}>＋ {U.linkIt}</button>
                  <Err where="addLink" />
                </div>
              ) : null}
            </section>

            {/* checklist + publish */}
            <section className="mt-6" data-checklist>
              <h3 className="flex flex-wrap items-center text-lg font-semibold">{U.checklist}<InfoLabel about={U.checklist} info={SCRUTINY_HEADING.checklist} /></h3>
              {checklistCount(draft.checklist) ? <ChecklistList c={draft.checklist} /> : <p className="mt-1">✓ {U.checklistClear}</p>}
              <div className="mt-3">
                {ask === 'publish' ? (
                  <div role="group" className="rounded-md border-2 border-zinc-900 p-3"><p>{U.publishAsk(String(draft.number))}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className={primary} disabled={!!busy} data-publish-confirm onClick={async () => { const d = await call('publish', { op: 'publish', editionId: draft.id, anyway: checklistCount(draft.checklist) > 0 }); if (d) done() }}>{checklistCount(draft.checklist) ? U.publishAnyway : U.publish}</button>
                      <button type="button" className={quiet} onClick={() => setAsk(null)}>{U.notNow}</button>
                    </div>
                  </div>
                ) : <button type="button" className={primary} data-publish-ask onClick={() => setAsk('publish')}>{checklistCount(draft.checklist) ? `⚠ ${U.publishAnyway}…` : `${U.publish}…`}</button>}
                <Err where="publish" />
              </div>
            </section>
          </>) : <p className="mt-3 text-[15px] text-zinc-700">{U.ownerOnly.replace(' Nothing was changed.', '')}</p>}
        </section>
      ) : null}

      {/* ── published editions ── */}
      <section className="mt-8" data-published>
        {!editions.length ? <p>{U.noEditions}</p> : null}
        <ul className="space-y-3">{published.map((e) => {
          const c = e.checklist as PublishedChecklist | null
          return (
            <li key={e.id} data-edition={e.id} className="rounded-md border border-zinc-300 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{U.edition(String(e.number))} · ✓ {U.published} {e.publishedAt?.slice(0, 10)}</p>
                <a href={`/scrutiny/${e.id}`} className="underline">◉ {U.preview}</a>
              </div>
              <p className="text-[15px] text-zinc-700">Frozen from version {e.versionNumber}{e.blind ? ' · blind round' : ''}.</p>
              {c?.publishedAnyway ? <details className="mt-1"><summary className="cursor-pointer text-[15px]">⚠ {U.publishedAnyway} {checklistCount(c)}</summary><ChecklistList c={c} /></details> : null}
            </li>
          )
        })}</ul>
      </section>
    </div>
  )
}
