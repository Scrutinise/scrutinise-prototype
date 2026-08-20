'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-B/D — the publish surface.
//
// Three things on one page, because they are one decision: WHAT the recipient
// gets (the two documents), WHICH VERSION they get (the pin), and WHO can open
// it (the visibility).
//
// What it must never do is let a user believe a recipient is holding something
// they are not. Two facts are therefore always on screen when they are true:
//   · the working draft has changed since the published version, so recipients
//     are still reading the older one — with the number of that version;
//   · a rendered file is out of date with the working state.
// Both are reported by the server, never inferred here.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

type Visibility = 'PRIVATE' | 'LINK' | 'COMMUNITY' | 'PUBLIC'

interface ExportStatus {
  kind: string
  label: string
  available: boolean
  unavailableReason: string | null
  generated: boolean
  generatedAt: string | null
  sourceLabel: string | null
  stale: boolean
  fromVersionNumber: number | null
  docxUrl: string | null
  pdfUrl: string | null
  lastError: string | null
}

interface VersionRecord {
  id: string
  versionNumber: number
  contentHash: string
  createdAt: string
  changeNote: string | null
  published: boolean
}

interface Publication {
  visibility: Visibility
  publishedVersion: VersionRecord | null
  publishedAt: string | null
  sharePath: string | null
  versionCount: number
  liveDiffersFromPublished: boolean
}

const VISIBILITY_COPY: Record<Visibility, { label: string; detail: string }> = {
  PRIVATE: { label: 'Private', detail: 'Only you and your collaborators. Nothing is shared.' },
  LINK: { label: 'Anyone with the link', detail: 'For sending to a specific MP or adviser. Not listed, not indexed.' },
  COMMUNITY: { label: 'My communities', detail: 'Members of communities you belong to can read the published version — and nothing else.' },
  PUBLIC: { label: 'Public', detail: 'Listed and open to anyone.' },
}

function stamp(iso: string | null): string | null {
  if (!iso) return null
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export default function PublishPanel({ ideaId }: { ideaId: string }) {
  const [documents, setDocuments] = useState<ExportStatus[]>([])
  const [publication, setPublication] = useState<Publication | null>(null)
  const [versions, setVersions] = useState<VersionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.message ?? 'Couldn’t read the proposal state just now.')
        return
      }
      setDocuments(data.documents ?? [])
      setPublication(data.publication ?? null)
      setVersions(data.versions ?? [])
      setError(null)
    } catch {
      setError('Couldn’t read the proposal state just now.')
    } finally {
      setLoading(false)
    }
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  const generate = useCallback(async (kind: string) => {
    setBusy(kind); setError(null); setNotice(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', kind, force: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.message ?? 'The document couldn’t be generated. Nothing has been changed.')
        return
      }
      await load()
    } catch {
      setError('The document couldn’t be generated. Nothing has been changed.')
    } finally {
      setBusy(null)
    }
  }, [ideaId, load])

  const saveVersion = useCallback(async () => {
    setBusy('version'); setError(null); setNotice(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document/publish`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'version', changeNote: note.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message ?? 'The version couldn’t be saved.'); return }
      // ⚠ The honest sentence when nothing moved. Showing "saved" on an unchanged
      // proposal would teach the user that the version list means less than it does.
      setNotice(data.created
        ? `Saved as version ${data.version.versionNumber}.`
        : `Nothing has changed since version ${data.version.versionNumber}, so no new version was made.`)
      setNote('')
      await load()
    } catch {
      setError('The version couldn’t be saved.')
    } finally {
      setBusy(null)
    }
  }, [ideaId, note, load])

  const publish = useCallback(async (visibility: Exclude<Visibility, 'PRIVATE'>) => {
    setBusy('publish'); setError(null); setNotice(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility, changeNote: note.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message ?? 'The proposal couldn’t be published.'); return }
      setPublication(data.publication)
      setNote('')
      setNotice(`Published to version ${data.publication?.publishedVersion?.versionNumber ?? '?'}.`)
      await load()
    } catch {
      setError('The proposal couldn’t be published.')
    } finally {
      setBusy(null)
    }
  }, [ideaId, note, load])

  const unpublish = useCallback(async () => {
    setBusy('publish'); setError(null); setNotice(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document/publish`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message ?? 'The proposal couldn’t be withdrawn.'); return }
      setPublication(data.publication)
      setNotice('Withdrawn. The link no longer opens; the versions are kept.')
      await load()
    } catch {
      setError('The proposal couldn’t be withdrawn.')
    } finally {
      setBusy(null)
    }
  }, [ideaId, load])

  if (loading) return <p className="text-sm text-zinc-500">Reading the proposal…</p>

  const unavailable = documents.find((d) => !d.available)
  const shareUrl = publication?.sharePath
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${publication.sharePath}`
    : null

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      {notice && (
        <p className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-3 py-2">{notice}</p>
      )}
      {unavailable?.unavailableReason && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {unavailable.unavailableReason}
        </p>
      )}

      {/* ── The documents ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">The documents</h2>
        <p className="text-xs text-zinc-500 mb-3">
          Both are a rendering of what is stored. Nothing is written fresh when you export, and a
          claim with no source behind it is marked in the document rather than presented quietly.
        </p>
        <div className="space-y-3">
          {documents.map((d) => (
            <div key={d.kind} className="border border-zinc-200 rounded p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-zinc-900">{d.label}</span>
                {d.generated && (
                  <span className="text-[11px] text-zinc-500">
                    {d.fromVersionNumber ? `from version ${d.fromVersionNumber}` : 'from your working draft'}
                    {d.generatedAt ? ` · ${stamp(d.generatedAt)}` : ''}
                  </span>
                )}
              </div>
              {d.sourceLabel && <p className="text-[11px] text-zinc-500 mt-1">Generated from {d.sourceLabel}.</p>}
              {d.stale && (
                <p className="text-[11px] text-amber-800 mt-1">
                  The proposal has changed since this file was made, so it is out of date.
                </p>
              )}
              {d.lastError && (
                <p className="text-[11px] text-red-700 mt-1">Last render failed: {d.lastError}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => void generate(d.kind)}
                  disabled={busy !== null || !d.available}
                  className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50 disabled:opacity-40"
                >
                  {busy === d.kind ? 'Generating…' : d.generated ? 'Regenerate' : 'Generate'}
                </button>
                {d.generated && d.docxUrl && (
                  <a
                    className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50"
                    href={d.stale ? `${d.docxUrl}&allowStale=1` : d.docxUrl}
                  >
                    {d.stale ? 'Download the old .docx anyway' : 'Download .docx'}
                  </a>
                )}
                {d.generated && d.pdfUrl && (
                  <a
                    className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50"
                    href={d.stale ? `${d.pdfUrl}&allowStale=1` : d.pdfUrl}
                  >
                    {d.stale ? 'Download the old PDF anyway' : 'Download PDF'}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Versions ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Versions</h2>
        <p className="text-xs text-zinc-500 mb-3">
          A version is a fixed copy of the whole proposal. Versions are never edited — a change makes
          the next one — and a shared link always resolves to the version that was shared.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What changed? (optional)"
            maxLength={500}
            className="flex-1 text-sm border border-zinc-300 rounded px-2 py-1"
          />
          <button
            type="button"
            onClick={() => void saveVersion()}
            disabled={busy !== null}
            className="text-xs px-3 py-1 rounded border border-zinc-300 hover:bg-zinc-50 disabled:opacity-40"
          >
            {busy === 'version' ? 'Saving…' : 'Save a version'}
          </button>
        </div>
        {versions.length === 0 ? (
          <p className="text-xs text-zinc-500">No versions yet.</p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li key={v.id} className="text-xs text-zinc-600 border-l-2 border-zinc-200 pl-3">
                <span className="font-medium text-zinc-900">Version {v.versionNumber}</span>
                {v.published && <span className="ml-2 text-emerald-700">· this is what recipients see</span>}
                <span className="ml-2 text-zinc-400">{stamp(v.createdAt)}</span>
                {v.changeNote && <p className="text-zinc-500 mt-0.5">{v.changeNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Visibility ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Who can read it</h2>
        <p className="text-xs text-zinc-500 mb-3">
          Publishing is explicit and reversible. Community members get a read on the published
          version only — never on your working proposal.
        </p>
        <div className="space-y-2">
          {(['LINK', 'COMMUNITY', 'PUBLIC'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => void publish(v)}
              disabled={busy !== null}
              className={`w-full text-left border rounded p-3 hover:bg-zinc-50 disabled:opacity-40 ${
                publication?.visibility === v ? 'border-emerald-400 bg-emerald-50/40' : 'border-zinc-200'
              }`}
            >
              <span className="text-sm font-medium text-zinc-900">{VISIBILITY_COPY[v].label}</span>
              {publication?.visibility === v && <span className="ml-2 text-[11px] text-emerald-700">current</span>}
              <p className="text-xs text-zinc-500 mt-0.5">{VISIBILITY_COPY[v].detail}</p>
            </button>
          ))}
        </div>

        {publication && publication.visibility !== 'PRIVATE' && (
          <div className="mt-3 border border-zinc-200 rounded p-3">
            {shareUrl && (
              <p className="text-xs text-zinc-700 break-all">
                Share link: <a className="text-blue-600 underline" href={publication.sharePath!}>{shareUrl}</a>
              </p>
            )}
            {publication.publishedVersion && (
              <p className="text-[11px] text-zinc-500 mt-1">
                Recipients are reading version {publication.publishedVersion.versionNumber}
                {publication.publishedAt ? `, published ${stamp(publication.publishedAt)}` : ''}.
              </p>
            )}
            {publication.liveDiffersFromPublished && (
              // ⚠ The single most important sentence on this page. Without it a user
              // edits for an hour and believes the recipient is reading the edits.
              <p className="text-[11px] text-amber-800 mt-1">
                Your working proposal has changed since then. Recipients still see version{' '}
                {publication.publishedVersion?.versionNumber}. Publish again to move them on.
              </p>
            )}
            <button
              type="button"
              onClick={() => void unpublish()}
              disabled={busy !== null}
              className="mt-2 text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50 disabled:opacity-40"
            >
              Withdraw (back to private)
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
