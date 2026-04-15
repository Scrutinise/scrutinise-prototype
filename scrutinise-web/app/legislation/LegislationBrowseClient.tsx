'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import PublicNav from '@/components/PublicNav'

interface LegislationItem {
  id: string
  title: string
  year: number
  number: number
  legislationType: string
  jurisdiction: string
  compiledSectionCount: number
  sectionCount: number
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    UKPGA: 'Act', UKSI: 'SI', UKLA: 'Local Act',
    ASP: 'Scottish Act', SSI: 'Scottish SI',
    ANAW: 'Welsh Act', WSI: 'Welsh SI',
    NIER: 'NI', EUR: 'Retained EU', OTHER: 'Other',
  }
  return (
    <span className="rounded bg-teal-900/40 px-1.5 py-0.5 text-xs font-medium text-teal-300">
      {labels[type] ?? type}
    </span>
  )
}

export default function LegislationBrowseClient() {
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<LegislationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const debouncedQ = useDebounce(q, 300)

  const fetchItems = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (debouncedQ) params.set('q', debouncedQ)
      if (type) params.set('type', type)
      if (jurisdiction) params.set('jurisdiction', jurisdiction)

      const res = await fetch(`/api/legislation/search?${params}`)
      const data = await res.json()
      if (p === 1) {
        setItems(data.items ?? [])
      } else {
        setItems(prev => [...prev, ...(data.items ?? [])])
      }
      setHasMore((data.items ?? []).length === 20)
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, type, jurisdiction])

  useEffect(() => {
    setPage(1)
    fetchItems(1)
  }, [fetchItems])

  function loadMore() {
    const next = page + 1
    setPage(next)
    fetchItems(next)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PublicNav />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">Legislation</h1>
        <p className="mb-6 text-sm text-gray-400">
          AI-compiled UK legislation. Browse and search compiled Acts and Statutory Instruments.
        </p>

        <div className="mb-4 rounded-lg border border-amber-800/40 bg-amber-950/30 p-3 text-xs text-amber-300">
          <strong>Research only.</strong> AI-compiled text is not a legal authority. Verify against{' '}
          <a href="https://www.legislation.gov.uk" target="_blank" rel="noopener noreferrer" className="underline">
            legislation.gov.uk
          </a>.
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Search by title…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="flex-1 min-w-48 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-teal-600 focus:outline-none"
          />
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:border-teal-600 focus:outline-none"
          >
            <option value="">All types</option>
            <option value="UKPGA">Acts (UKPGA)</option>
            <option value="UKSI">Statutory Instruments</option>
            <option value="ASP">Scottish Acts</option>
            <option value="ANAW">Welsh Acts</option>
          </select>
          <select
            value={jurisdiction}
            onChange={e => setJurisdiction(e.target.value)}
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:border-teal-600 focus:outline-none"
          >
            <option value="">All jurisdictions</option>
            <option value="UK">UK</option>
            <option value="Scotland">Scotland</option>
            <option value="Wales">Wales</option>
            <option value="NI">Northern Ireland</option>
          </select>
        </div>

        {/* Results */}
        {loading && items.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-500">Loading…</p>
        )}

        {!loading && items.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-gray-400">No compiled legislation found.</p>
            <p className="mt-2 text-xs text-gray-600">
              The legislation database is populated by running the ingestion and compilation scripts.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map(item => (
              <Link
                key={item.id}
                href={`/legislation/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 transition-colors hover:border-gray-700 hover:bg-gray-800/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={item.legislationType} />
                    <span className="text-sm font-medium text-gray-200 truncate">{item.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {item.year} · {item.jurisdiction} · {item.compiledSectionCount}/{item.sectionCount} sections compiled
                  </p>
                </div>
                <span className="ml-3 text-xs text-gray-600">→</span>
              </Link>
            ))}
          </div>
        )}

        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="mt-6 w-full rounded-lg border border-gray-700 py-2 text-sm text-gray-400 hover:border-gray-600 hover:text-gray-300 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}
