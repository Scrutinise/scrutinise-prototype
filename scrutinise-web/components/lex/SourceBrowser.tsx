'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 299 (CCh-Lex 2 Nov (1) E) — THE SOURCES LIST'S CONTROLS, ONE COMPONENT FOR TWO PLACES.
//
//   · the Sources list on the research panel (`SourcesRegistry`, mode "list": it draws its own cards from what this hands it);
//   · 298's "This is a further note on a source I've already added" picker inside Add research (mode "pick": compact rows + "Choose").
// Controls: quick-filter pills (Documents · Web pages · Found by Lex); "All filters" with every kind and its count, "Bears on #N" and
// "Possible duplicates"; sort (date added / A–Z / Ref number); search over titles AND held text (the server reads it).
// The rules are lib/lex/source-list.ts — one definition, so the list and the picker cannot disagree.
// ⚠ COLOUR IS NEVER THE ONLY CUE (CLAUDE.md §21): a pill that is on is ● filled, bold, 2px-bordered and aria-pressed; off is ○.
// ⚠ Possible duplicates are SHOWN, never merged: the brief's rule — numbers are never reused.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import {
  FACET_LABEL, QUICK_FACETS, SOURCE_FACETS, SORT_LABEL, applySourceFilter, duplicateGroups, facetCounts,
  type ListedSource, type SourceFacet, type SourceSort,
} from '@/lib/lex/source-list'

export interface BrowserContext {
  all: ListedSource[]
  /** "[Ref: 12] may duplicate [Ref: 13] (same document)" — keyed by number. */
  dupOf: Map<number, { others: number[]; reasons: string[] }>
  /** Where the search matched each source, when a search is on. */
  matchedWhere: Map<string, string[]>
  reload: () => void
}

export default function SourceBrowser({
  ideaId, reloadKey, mode = 'list', onPick, autoFocus = false, exclude, children, onLoaded,
}: {
  ideaId: string
  /** Called with every source each time the list is (re)read — the host's own count and its "not numbered yet" documents read it. */
  onLoaded?: (all: ListedSource[]) => void
  reloadKey?: number
  mode?: 'list' | 'pick'
  onPick?: (s: ListedSource) => void
  autoFocus?: boolean
  /** Kinds the host never offers (the picker leaves out "My own observation": a thought is written in the form itself). */
  exclude?: (s: ListedSource) => boolean
  /** List mode: the host draws the rows. */
  children?: (shown: ListedSource[], ctx: BrowserContext) => ReactNode
}) {
  const [all, setAll] = useState<ListedSource[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facets, setFacets] = useState<SourceFacet[]>([])
  const [bearsOn, setBearsOn] = useState<number | null>(null)
  const [dupsOnly, setDupsOnly] = useState(false)
  const [sort, setSort] = useState<SourceSort>(mode === 'pick' ? 'added' : 'ref')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState<{ q: string; ids: Set<string>; where: Map<string, string[]>; searchedText: number; notHeld: number } | null>(null)
  const [searching, setSearching] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/ideas/${ideaId}/source-registry?detail=1`)
        const j = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) { setError(explainFailure(j, res.status, 'Loading the sources')); return }
        setAll(j.sources as ListedSource[]); setError(null); onLoadedRef.current?.(j.sources as ListedSource[])
      } catch (e) { if (!cancelled) setError(`Loading the sources could not reach the server (${e instanceof Error ? e.message : 'network error'}).`) }
    })()
    return () => { cancelled = true }
  }, [ideaId, reloadKey, tick])

  // Search titles and held text — on the server, which holds the text. Debounced; the latest query wins.
  const seq = useRef(0)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setSearch(null); setSearching(false); return }
    const mine = ++seq.current
    setSearching(true)
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/ideas/${ideaId}/source-registry?q=${encodeURIComponent(term)}`)
          const j = await res.json().catch(() => ({}))
          if (mine !== seq.current) return
          if (!res.ok) { setError(explainFailure(j, res.status, 'Searching the sources')); setSearching(false); return }
          const matches = (j.matches ?? []) as Array<{ id: string; where: string[] }>
          setSearch({ q: term, ids: new Set(matches.map((m) => m.id)), where: new Map(matches.map((m) => [m.id, m.where])), searchedText: j.searchedText ?? 0, notHeld: j.notHeld ?? 0 })
          setSearching(false)
        } catch (e) { if (mine === seq.current) { setError(`Searching the sources could not reach the server (${e instanceof Error ? e.message : 'network error'}).`); setSearching(false) } }
      })()
    }, 300)
    return () => clearTimeout(t)
  }, [q, ideaId])

  const pool = useMemo(() => (all ?? []).filter((s) => !exclude?.(s)), [all, exclude])
  const groups = useMemo(() => duplicateGroups(pool), [pool])
  const dupNumbers = useMemo(() => new Set(groups.flatMap((g) => g.numbers)), [groups])
  const dupOf = useMemo(() => {
    const m = new Map<number, { others: number[]; reasons: string[] }>()
    for (const g of groups) for (const n of g.numbers) m.set(n, { others: g.numbers.filter((x) => x !== n), reasons: g.reasons })
    return m
  }, [groups])
  const counts = useMemo(() => facetCounts(pool), [pool])
  const actionNumbers = useMemo(() => {
    const c = new Map<number, number>()
    for (const s of pool) for (const n of s.bearsOn) c.set(n, (c.get(n) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => a[0] - b[0])
  }, [pool])
  const shown = useMemo(() => applySourceFilter(pool, { facets, bearsOn, duplicatesOnly: dupsOnly, searchIds: search?.ids ?? null }, sort, dupNumbers),
    [pool, facets, bearsOn, dupsOnly, search, sort, dupNumbers])

  const toggleFacet = (f: SourceFacet) => setFacets((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]))
  const anyFilter = facets.length > 0 || bearsOn != null || dupsOnly || !!search
  const clearAll = () => { setFacets([]); setBearsOn(null); setDupsOnly(false); setQ(''); setSearch(null) }

  if (!all) return <p className="text-xs text-zinc-500">{error ?? 'Loading the sources…'}</p>

  const pill = (f: SourceFacet) => {
    const on = facets.includes(f)
    return (
      <button key={f} type="button" onClick={() => toggleFacet(f)} aria-pressed={on} data-quick-facet={f}
        className={`text-[11px] px-2 py-0.5 rounded-full ${on ? 'border-2 border-zinc-900 bg-zinc-900 text-white font-semibold' : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'}`}>
        <span aria-hidden>{on ? '●' : '○'}</span> {FACET_LABEL[f]} <span className={on ? 'text-zinc-200' : 'text-zinc-500'}>{counts[f]}</span>
      </button>
    )
  }

  const ctx: BrowserContext = { all: pool, dupOf, matchedWhere: search?.where ?? new Map(), reload }

  return (
    <div className="space-y-2" data-source-browser={mode}>
      <div className="flex flex-wrap items-center gap-1.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} maxLength={200} type="search"
          placeholder={mode === 'pick' ? 'Type to find a source — its title or its text' : 'Search titles and held text'} aria-label="Search the sources"
          className="flex-1 min-w-[10rem] border border-zinc-300 rounded px-2 py-1 text-xs" data-source-search />
        <label className="text-[11px] text-zinc-600 inline-flex items-center gap-1">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as SourceSort)} aria-label="Sort the sources" className="border border-zinc-300 rounded px-1 py-0.5 text-[11px]" data-source-sort>
            {(Object.keys(SORT_LABEL) as SourceSort[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick filters">
        {QUICK_FACETS.map(pill)}
        <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} data-all-filters
          className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-zinc-400 text-zinc-700 hover:bg-zinc-50">
          {moreOpen ? '− Fewer filters' : '+ All filters'}{(bearsOn != null || dupsOnly || facets.some((f) => !QUICK_FACETS.includes(f))) && !moreOpen ? ' (on)' : ''}
        </button>
      </div>

      {moreOpen && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 space-y-2" data-filter-panel>
          <fieldset>
            <legend className="text-[11px] font-semibold text-zinc-600">Kind</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {SOURCE_FACETS.map((f) => (
                <label key={f} className="text-[11px] text-zinc-800 inline-flex items-center gap-1">
                  <input type="checkbox" checked={facets.includes(f)} onChange={() => toggleFacet(f)} className="accent-zinc-900" data-facet={f} />
                  {FACET_LABEL[f]} <span className="text-zinc-500">({counts[f]})</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[11px] text-zinc-800 inline-flex items-center gap-1">Bears on
              <select value={bearsOn ?? ''} onChange={(e) => setBearsOn(e.target.value ? Number(e.target.value) : null)} aria-label="Bears on action" className="border border-zinc-300 rounded px-1 py-0.5 text-[11px]" data-bears-on>
                <option value="">any action</option>
                {actionNumbers.map(([n, c]) => <option key={n} value={n}>#{n} ({c})</option>)}
              </select>
            </label>
            {!actionNumbers.length && <span className="text-[11px] text-zinc-500">No source is tied to an action yet (by a note, or by an action citing its [Ref: n]).</span>}
            <label className="text-[11px] text-zinc-800 inline-flex items-center gap-1">
              <input type="checkbox" checked={dupsOnly} onChange={(e) => setDupsOnly(e.target.checked)} className="accent-zinc-900" data-dups-only />
              Possible duplicates <span className="text-zinc-500">({dupNumbers.size} in {groups.length} group{groups.length === 1 ? '' : 's'})</span>
            </label>
          </div>
          {dupsOnly && (
            <ul className="text-[11px] text-zinc-700 space-y-0.5" data-dup-groups>
              {groups.map((g) => <li key={g.numbers.join('-')}>{g.numbers.map((n) => `[Ref: ${n}]`).join(', ')} — {g.reasons.join(', ')}</li>)}
              <li className="text-zinc-500">Shown together only. Nothing is merged, and a number is never reused.</li>
            </ul>
          )}
        </div>
      )}

      <p className="text-[11px] text-zinc-500" role="status" data-source-count>
        {searching ? 'Searching titles and held text… ' : ''}
        Showing {shown.length} of {pool.length}
        {search && !searching ? ` · “${search.q}” found in ${search.ids.size} (held text of ${search.searchedText} searched${search.notHeld ? `; ${search.notHeld} have no held text, so only their titles were searched` : ''})` : ''}
        {anyFilter && <> · <button type="button" onClick={clearAll} className="underline text-zinc-700">Clear</button></>}
      </p>
      {error && <p role="alert" className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠ {error}</p>}

      {mode === 'list' && children ? children(shown, ctx) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto" data-source-picker-list>
          {shown.slice(0, 60).map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded border border-zinc-200 bg-white px-2 py-1 text-xs">
              <span className="font-semibold shrink-0">[Ref: {s.number}]</span>
              <span className="flex-1 min-w-0 break-words">{s.title}<span className="block text-[10px] text-zinc-500">{FACET_LABEL[s.facet]}{ctx.matchedWhere.get(s.id) ? ` · matched in ${ctx.matchedWhere.get(s.id)!.join(', ')}` : ''}</span></span>
              <button type="button" onClick={() => onPick?.(s)} className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded border-2 border-zinc-800 bg-white hover:bg-zinc-50" data-pick-source={s.number}>Choose</button>
            </li>
          ))}
          {shown.length > 60 && <li className="text-[11px] text-zinc-500">…and {shown.length - 60} more — type to narrow it down.</li>}
          {!shown.length && <li className="text-[11px] text-zinc-500">No source matches.</li>}
        </ul>
      )}
    </div>
  )
}
