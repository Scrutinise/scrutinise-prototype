'use client'
// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-AC part (a) (BRIEF_26AC §2; decisions 319, 368, 374) — THE READER'S PAGE: a scrutiny edition, top to bottom.
//
// Reading comes first: generous type, one clear column, none of the workspace's controls. The page is a function of `view` alone (built
// on the server from the edition's frozen rows, lib/lex/scrutiny-edition-pure.ts), so the owner's "Preview as a reviewer" and a reviewer's
// page are the same component with the same props, and only the banner differs.
//
// ⚠ ON A PHONE (below 768 px), ONE SECTION AT A TIME with a bar at the bottom: "Sections" on the left, Previous and Next on the right, as
//   Z1's bar is laid out. Every section stays mounted (hidden when not shown), so a scroll or an open "set aside" list survives a switch.
//   The bar hugs the bottom edge with the safe-area inset (the route sets viewport-fit=cover, lib/lex/viewport.ts).
// ⚠ "Read the draft wording" OPENS THE DRAFT IN ITS OWN VIEW with a way back to the same place: the URL gains #draft-<action>, so the
//   phone's own Back returns too, and Back lands on the action it came from.
// ⚠ SHAPE AND WORD, NEVER COLOUR ALONE (§21): a draft's state is a glyph and a sentence; a banner is a bordered box with words.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Block, Run } from '@/lib/documents/model'
import { markdownToBlocks } from '@/lib/documents/markdown'
import type { ActionView, EditionView, HeadingView } from '@/lib/lex/scrutiny-edition-pure'
import { SCRUTINY_UI as U } from '@/lib/lex/screen-labels'

const SAFE_HREF = /^(https?:\/\/|\/(?!\/)|#)/i
const PHONE = '(max-width: 767px)'
const BAR_PX = 56

function Runs({ runs }: { runs: Run[] }) {
  return <>{runs.map((r, i) => {
    let n: ReactNode = r.text
    if (r.italic) n = <em>{n}</em>
    if (r.bold) n = <strong className="font-semibold">{n}</strong>
    if (r.href && SAFE_HREF.test(r.href)) n = <a href={r.href} target="_blank" rel="noopener noreferrer" className="underline">{n}</a>
    return <span key={i}>{n}</span>
  })}</>
}
function Blocks({ blocks }: { blocks: Block[] }) {
  return <div className="space-y-3">{blocks.map((b, i) => {
    switch (b.kind) {
      case 'heading': return <h3 key={i} className="mt-5 text-lg font-semibold text-zinc-950"><Runs runs={b.runs} /></h3>
      case 'paragraph': return <p key={i}><Runs runs={b.runs} /></p>
      case 'bullets': { const items = b.items.map((it, j) => <li key={j}><Runs runs={it} /></li>); return b.ordered ? <ol key={i} className="list-decimal space-y-1 pl-6">{items}</ol> : <ul key={i} className="list-disc space-y-1 pl-6">{items}</ul> }
      case 'note': return <p key={i} className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-[15px] italic text-zinc-700">{b.text}</p>
      case 'table': return (
        <div key={i} className="max-w-full overflow-x-auto"><table className="border-collapse text-sm">
          <thead><tr>{b.header.map((h, j) => <th key={j} className="border border-zinc-300 bg-zinc-100 px-2 py-1 text-left font-semibold"><Runs runs={h} /></th>)}</tr></thead>
          <tbody>{b.rows.map((row, j) => <tr key={j}>{row.map((c, k) => <td key={k} className="border border-zinc-300 px-2 py-1 align-top"><Runs runs={c} /></td>)}</tr>)}</tbody>
        </table></div>
      )
      case 'rule': return <hr key={i} className="border-zinc-300" />
      case 'section': return <h3 key={i} className="mt-5 text-lg font-semibold">{b.title}</h3>
      case 'sources': return <ul key={i} className="list-disc pl-6 text-[15px]">{b.refs.map((r, j) => <li key={j}>{r.ref != null ? `[${r.ref}] ` : ''}{r.title}{r.citation ? ` — ${r.citation}` : ''}</li>)}</ul>
      default: return null
    }
  })}</div>
}
const Markdown = ({ text }: { text: string }) => <Blocks blocks={markdownToBlocks(text)} />

/** The draft's state: a glyph AND the sentence (never colour alone). */
function DraftState({ a }: { a: { draftState: string; noDraftReason?: string | null; drafts?: unknown[]; hasDraft?: boolean } }) {
  const glyph = a.noDraftReason ? '—' : a.draftState === 'Draft accepted' ? '✓' : (a.drafts?.length ?? (a.hasDraft ? 1 : 0)) ? '◐' : '○'
  return <span data-draft-state className="inline-flex items-baseline gap-1 text-[15px] text-zinc-700"><span aria-hidden>{glyph}</span>{a.draftState}</span>
}

function ReadDraft({ a, onOpen }: { a: { id: string; number: number }; onOpen: (id: string) => void }) {
  return <a href={`#draft-${a.id}`} data-read-draft={a.id} onClick={(e) => { e.preventDefault(); onOpen(a.id) }} className="inline-flex min-h-[44px] items-center gap-1 font-semibold underline underline-offset-4">{U.readDraft} <span aria-hidden>›</span></a>
}

function Note({ text }: { text: string }) {
  return <aside data-author-note className="my-3 border-l-4 border-zinc-900 bg-zinc-50 px-4 py-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">✎ {U.notes}</p><Markdown text={text} /></aside>
}

function ActionBlock({ a, onOpen }: { a: ActionView; onOpen: (id: string) => void }) {
  return (
    <article id={`action-${a.id}`} data-action={a.id} className="scroll-mt-4 border-t border-zinc-200 pt-5">
      <h3 className="text-lg font-semibold text-zinc-950"><span className="mr-1 text-zinc-500">#{a.number}</span>{a.title?.trim() || null}</h3>
      <div className="mt-2"><Markdown text={a.statement} /></div>
      {a.notes.map((n, i) => <Note key={i} text={n} />)}
      {a.explanatory ? (
        <section className="mt-4"><h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">{U.explanatoryNote} <span className="font-normal normal-case tracking-normal">({a.explanatory.words})</span></h4><div className="mt-1"><Markdown text={a.explanatory.body} /></div></section>
      ) : null}
      <section className="mt-4"><h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">{U.costs}</h4>
        {a.costs.length ? <ul className="mt-1 list-disc space-y-1 pl-6">{a.costs.map((c, i) => <li key={i}>{c}</li>)}</ul> : <p className="mt-1 text-zinc-700">{U.notCosted}</p>}
      </section>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1"><DraftState a={a} />{a.drafts.length ? <ReadDraft a={a} onOpen={onOpen} /> : null}</div>
    </article>
  )
}

function DraftView({ a, onBack }: { a: ActionView; onBack: () => void }) {
  const back = <button type="button" onClick={onBack} data-draft-back className="inline-flex min-h-[44px] items-center gap-1 font-semibold underline underline-offset-4"><span aria-hidden>‹</span> {U.backTo(String(a.number))}</button>
  return (
    <div data-draft-view={a.id}>
      {back}
      <h2 className="mt-3 text-2xl font-semibold text-zinc-950">#{a.number}{a.title ? ` — ${a.title}` : ''}</h2>
      <p className="mt-1"><DraftState a={a} /></p>
      {a.drafts.map((d) => (
        <section key={d.d} className="mt-6" data-draft-doc={d.d}>
          <h3 className="text-lg font-semibold">{d.title} <span className="text-base font-normal text-zinc-600">({d.d}, {d.words})</span></h3>
          {d.newerNote ? <p className="mt-1 text-[15px] italic text-zinc-700">{d.newerNote}</p> : null}
          {d.accepted === false ? <p className="mt-2 rounded-md border-2 border-zinc-900 px-3 py-2 text-[15px]">◐ This is the latest version and has not been accepted by the owner.</p> : null}
          <div className="mt-3 font-serif text-[17px] leading-8"><Markdown text={d.body} /></div>
        </section>
      ))}
      <div className="mt-8">{back}</div>
    </div>
  )
}

interface Panel { key: string; label: string; body: ReactNode }

export default function EditionReader({ view, banner }: { view: EditionView; banner: 'preview' | 'draft' | null }) {
  const [phone, setPhone] = useState(false)
  const [at, setAt] = useState(0)
  const [menu, setMenu] = useState(false)
  const [draftOf, setDraftOf] = useState<string | null>(null)
  const actions = useMemo(() => new Map(view.headings.flatMap((h) => h.actions).map((a) => [a.id, a])), [view])

  useEffect(() => {
    const m = window.matchMedia(PHONE)
    const f = () => setPhone(m.matches)
    f(); m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])

  const panels: Panel[] = useMemo(() => {
    const out: Panel[] = []
    out.push({
      key: 'start', label: view.summary ? U.ideaInOnePage : U.edition(String(view.number)), body: (
        <>
          {view.topNotes.map((n, i) => <Note key={i} text={n} />)}
          {view.summary ? (
            <section data-section="summary">
              <h2 className="mt-6 text-2xl font-semibold text-zinc-950">{U.ideaInOnePage}</h2>
              <div className="mt-3"><Blocks blocks={view.summary.blocks} /></div>
              {view.summary.lines.length ? (<>
                <h3 className="mt-6 text-lg font-semibold">{U.actionsOneLine}</h3>
                <ul className="mt-2 space-y-3">{view.summary.lines.map((l) => (
                  <li key={l.id} data-summary-line={l.id}>
                    <p><span className="font-semibold">#{l.number}</span> {l.statement}</p>
                    <p className="flex flex-wrap items-center gap-x-4"><DraftState a={l} />{l.hasDraft ? <ReadDraft a={l} onOpen={(id) => open(id)} /> : null}</p>
                    {l.cost ? <p className="text-[15px] text-zinc-700">{l.cost}</p> : null}
                  </li>
                ))}</ul>
              </>) : null}
            </section>
          ) : null}
          {view.predates ? <p className="mt-6 rounded-md border border-zinc-300 px-3 py-2">{U.predates}</p> : null}
        </>
      ),
    })
    view.headings.forEach((h: HeadingView) => out.push({
      key: h.key, label: h.name, body: (
        <section data-section={h.key}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{U.proposals}</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-950">{h.name}</h2>
          {h.purpose ? <div className="mt-2 text-zinc-800"><Markdown text={h.purpose} /></div> : null}
          {h.notes.map((n, i) => <Note key={i} text={n} />)}
          <div className="mt-4 space-y-6">{h.actions.map((a) => <ActionBlock key={a.id} a={a} onOpen={(id) => open(id)} />)}</div>
        </section>
      ),
    }))
    if (view.setAside) {
      const sa = view.setAside
      out.push({
        key: 'setAside', label: U.optionsSetAside, body: (
          <section data-section="setAside">
            <details data-set-aside className="group">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-2xl font-semibold text-zinc-950"><span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>{U.optionsSetAside} <span className="text-base font-normal text-zinc-600">({sa.ruledOut.length + sa.setAside.length})</span></summary>
              {sa.ruledOut.length ? (<><h3 className="mt-4 text-lg font-semibold">{U.ruledOut}</h3><ul className="mt-2 space-y-3">{sa.ruledOut.map((r) => <li key={r.number}><p><span className="font-semibold">#{r.number}</span> {r.title?.trim() || r.statement}</p><p className="text-[15px] text-zinc-700">{r.reason ? `Reason: ${r.reason}` : 'No reason recorded.'} · {r.lastChanged.slice(0, 10)}</p></li>)}</ul></>) : null}
              {sa.setAside.length ? (<><h3 className="mt-4 text-lg font-semibold">{U.setAsideItems}</h3><ul className="mt-2 space-y-3">{sa.setAside.map((s, i) => <li key={i}><p>{s.text}</p><p className="text-[15px] text-zinc-700">{s.reason ? `Reason: ${s.reason}` : 'No reason recorded.'}{s.at ? ` · ${s.at.slice(0, 10)}` : ''}</p></li>)}</ul></>) : null}
              {!sa.ruledOut.length && !sa.setAside.length ? <p className="mt-3">Nothing was set aside in this edition.</p> : null}
            </details>
          </section>
        ),
      })
    }
    if (view.sources) {
      const ss = view.sources
      out.push({
        key: 'sources', label: U.sources, body: (
          <section data-section="sources">
            <h2 className="text-2xl font-semibold text-zinc-950">{U.sources}</h2>
            {ss.length ? <ol className="mt-3 space-y-3">{ss.map((s) => (
              <li key={s.number} data-source={s.number} className="break-words">
                <p><span className="font-semibold">[{s.number}]</span> {s.url && SAFE_HREF.test(s.url) ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.title}</a> : s.title}{s.citation ? ` — ${s.citation}` : ''}</p>
                <p className="text-[15px] text-zinc-700">{U.citedBy}: {s.citedBy.join(', ')}</p>
              </li>
            ))}</ol> : <p className="mt-3">{U.noSources}</p>}
          </section>
        ),
      })
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const panelOfAction = useCallback((id: string) => Math.max(0, panels.findIndex((p) => view.headings.find((h) => h.key === p.key)?.actions.some((a) => a.id === id))), [panels, view])

  // the draft view is in the URL (#draft-<id>), so the browser's own Back returns from it
  const open = (id: string) => { setDraftOf(id); try { history.pushState({ draft: id }, '', `#draft-${id}`) } catch { /* no history */ } ; window.scrollTo(0, 0) }
  const backTo = useCallback((id: string) => {
    setDraftOf(null)
    setAt(panelOfAction(id))
    requestAnimationFrame(() => document.getElementById(`action-${id}`)?.scrollIntoView({ block: 'start' }))
  }, [panelOfAction])
  const current = useRef<string | null>(null)
  current.current = draftOf
  useEffect(() => {
    const fromHash = () => { const m = /^#draft-(.+)$/.exec(location.hash); return m && actions.has(m[1]) ? m[1] : null }
    const initial = fromHash()
    if (initial) setDraftOf(initial)
    const onPop = () => { const d = fromHash(); if (d) setDraftOf(d); else if (current.current) backTo(current.current) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [actions, backTo])
  // Back from the draft: through the browser's history when the draft put itself there (popstate then returns to the action), else directly
  const closeDraft = () => {
    if (location.hash.startsWith('#draft-') && (history.state as { draft?: string } | null)?.draft) { history.back(); return }
    if (draftOf) { try { history.replaceState(null, '', location.pathname + location.search) } catch { /* */ } backTo(draftOf) }
  }

  const go = (i: number) => { setAt(Math.max(0, Math.min(panels.length - 1, i))); setMenu(false); window.scrollTo(0, 0) }
  const draft = draftOf ? actions.get(draftOf) : undefined

  return (
    <div data-edition-reader data-phone={phone ? '1' : '0'} className="mx-auto w-full max-w-[44rem] px-4 pb-24 pt-6 text-[17px] leading-7 text-zinc-900 sm:px-6" style={phone ? { paddingBottom: BAR_PX + 32 } : undefined}>
      {banner ? <p role="status" data-banner={banner} className="mb-4 rounded-md border-2 border-zinc-900 bg-white px-3 py-2 text-[15px] font-semibold">{banner === 'preview' ? `◉ ${U.previewBanner}` : `✎ ${U.draftBanner}`}</p> : null}
      <header className="mb-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-600">{U.edition(String(view.number))}{view.publishedAt ? ` · ${view.publishedAt.slice(0, 10)}` : ''}</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight text-zinc-950 break-words">{view.title}</h1>
      </header>
      {draft ? <DraftView a={draft} onBack={closeDraft} /> : (
        <div>
          {panels.map((p, i) => (
            <div key={p.key} data-panel={p.key} hidden={phone && i !== at} className={phone ? '' : 'mt-10 first:mt-4'}>{p.body}</div>
          ))}
        </div>
      )}
      {phone && !draft ? (
        <nav aria-label={U.sectionsMenu} data-reader-bar className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-300 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {menu ? (
            <ol data-reader-menu className="max-h-[60vh] overflow-y-auto border-b border-zinc-200 py-1">
              {panels.map((p, i) => <li key={p.key}><button type="button" onClick={() => go(i)} aria-current={i === at ? 'page' : undefined} className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left">{i === at ? <span aria-hidden>●</span> : <span aria-hidden>○</span>}<span className="truncate">{p.label}</span></button></li>)}
            </ol>
          ) : null}
          <div className="flex h-14 items-center gap-2 px-2">
            <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} data-reader-sections className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-zinc-300 px-3 font-semibold"><span aria-hidden>☰</span>{U.sectionsMenu}</button>
            <span className="min-w-0 flex-1 truncate text-center text-sm text-zinc-700" data-reader-here>{at + 1}/{panels.length} · {panels[at]?.label}</span>
            <button type="button" onClick={() => go(at - 1)} disabled={at === 0} aria-label={U.previous} data-reader-prev className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40"><span aria-hidden>‹</span></button>
            <button type="button" onClick={() => go(at + 1)} disabled={at === panels.length - 1} aria-label={U.next} data-reader-next className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40"><span aria-hidden>›</span></button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}
