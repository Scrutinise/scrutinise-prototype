'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FilePicker from '@/components/central/FilePicker'
import { AiLabel, isAiAnswer } from '@/components/central/AnswerByline'
import ApprovalFrame, {
  ApprovalCheckbox,
  ApprovalLabel,
  ContextField,
  ContextNote,
  type ApprovalStampView,
  type FlagView,
} from '@/components/central/ApprovalFrame'
import { canApproveWith, type ApprovalMode, type ApproverCaps } from '@/lib/approval-rule'
import { linkHost, linkThumbnail } from '@/lib/video'
import { SELECTED_WEIGHT, UNSELECTED_WEIGHT, downGlyph, upGlyph } from '@/lib/state-cues'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2g — the Resources tab.
//
// ⚠ A CARD GRID WITH THUMBNAILS, NOT A TEXT LIST. The brief is explicit and the
// reason is the content: a member is looking for the leaflet they half-remember
// seeing, and a row of titles makes them open nine things to find it.
// ─────────────────────────────────────────────────────────────────────────────

export const RESOURCE_TYPES = [
  { key: 'MEME', label: 'Meme & graphic', icon: '🖼️' },
  { key: 'FLYER', label: 'Flyer & print', icon: '📄' },
  { key: 'SOCIAL', label: 'Social post', icon: '💬' },
  { key: 'VIDEO', label: 'Video', icon: '▶️' },
  { key: 'TRAINING', label: 'Training material', icon: '🎓' },
  { key: 'EVENT_PACK', label: 'Event pack', icon: '📦' },
  { key: 'WEBSITE', label: 'Website & tech', icon: '🔗' },
  { key: 'MERCH', label: 'Merchandise', icon: '👕' },
  { key: 'TEMPLATE', label: 'Document template', icon: '📝' },
] as const

/** Types that can only ever be a link. Hosting was ruled out for both. */
const LINK_ONLY = new Set(['VIDEO', 'WEBSITE'])

const typeLabel = (key: string) => RESOURCE_TYPES.find((t) => t.key === key)?.label ?? key
const typeIcon = (key: string) => RESOURCE_TYPES.find((t) => t.key === key)?.icon ?? '📎'

export type ResourceRowView = {
  id: string
  type: string
  title: string
  whyUseful: string
  context: string | null
  topicTags: string[]
  fileKey: string | null
  fileName: string | null
  fileType: string | null
  fileUrl: string | null
  externalUrl: string | null
  thumbnailUrl: string | null
  author: { id: string; name: string | null; username: string }
  authorType: string
  aiModel: string | null
  score: number
  myVote: 'UP' | 'DOWN' | null
  approval: ApprovalStampView
  flag: FlagView
  createdAt: string
  branchName: string | null
}

type Payload = {
  branding: { approvalMode: ApprovalMode; approvalFeatureEnabled: boolean; organisationName: string | null }
  caps: ApproverCaps
  canManage: boolean
  viewerId: string
  resources: ResourceRowView[]
}

/**
 * The picture on a card.
 *
 * ⚠ FALLS BACK TO A TYPE TILE, NEVER TO A BROKEN IMAGE. An R2 object is private,
 * so an <img> pointed at its key would 403; a link with no derivable still gives
 * null. Both land here.
 */
function Thumbnail({ resource, signedUrl }: { resource: ResourceRowView; signedUrl?: string }) {
  // ⚠ `fileUrl` comes from the LIST now. It used to rely on `signedUrl`, which
  // only the detail view ever fetched, so every uploaded image and PDF in the
  // grid fell through to the type tile — the acceptance item that had never been
  // verified from either side, found in a browser walk on 27 Aug.
  const url = signedUrl ?? resource.fileUrl ?? undefined
  const isImage = resource.fileType?.startsWith('image/')
  const isPdf = resource.fileType === 'application/pdf'

  if (isPdf && url) {
    // The first page, which is what a PDF's thumbnail is. `<object>` embeds the
    // browser's own viewer; the toolbar flags and `pointer-events-none` keep it
    // reading as a picture rather than a document you can scroll inside a card.
    return (
      <div className="relative h-full w-full bg-[oklch(0.97_0.004_250)]">
        <object
          data={url + '#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0'}
          type="application/pdf"
          className="pointer-events-none h-full w-full"
          aria-label={'First page of ' + (resource.fileName ?? resource.title)}
        >
          <span className="flex h-full w-full flex-col items-center justify-center gap-1">
            <span className="text-3xl">{typeIcon(resource.type)}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">PDF</span>
          </span>
        </object>
        <span className="absolute bottom-1 right-1 rounded bg-white/85 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          PDF
        </span>
      </div>
    )
  }

  const src = isImage && url ? url : resource.thumbnailUrl ?? (resource.externalUrl ? linkThumbnail(resource.externalUrl) : null)

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => {
          // A dead remote still must not leave a torn image in the grid.
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[oklch(0.97_0.004_250)]">
      <span className="text-3xl">{typeIcon(resource.type)}</span>
      <span className="px-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {resource.fileType === 'application/pdf' ? 'PDF' : typeLabel(resource.type)}
      </span>
    </div>
  )
}

export default function ResourcesLibrary({
  communityId,
  communityName,
}: {
  communityId: string
  communityName: string
}) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('')
  const [topic, setTopic] = useState('')
  const [sort, setSort] = useState<'top' | 'newest'>('top')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<ResourceRowView | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ sort })
    if (type) params.set('type', type)
    if (topic) params.set('topic', topic)
    const res = await fetch(`/api/communities/${communityId}/resources?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [communityId, type, topic, sort])

  useEffect(() => {
    load()
  }, [load])

  const resources = data?.resources ?? []

  // Every topic actually in use, so the dropdown never offers an empty filter.
  const topicsInUse = Array.from(new Set(resources.flatMap((r) => r.topicTags))).sort()

  function mayApprove(r: ResourceRowView): boolean {
    if (!data) return false
    return canApproveWith({
      mode: data.branding.approvalMode,
      featureEnabled: data.branding.approvalFeatureEnabled,
      caps: data.caps,
      authorId: r.author.id,
    })
  }

  async function vote(r: ResourceRowView, direction: 'UP' | 'DOWN') {
    const res = await fetch(`/api/communities/${communityId}/resources/${r.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(typeof d.error === 'string' ? d.error : 'Could not record that vote.')
      return
    }
    const d = await res.json()
    const patch = (x: ResourceRowView) => ({ ...x, score: d.score, myVote: d.myVote })
    setData((prev) =>
      prev ? { ...prev, resources: prev.resources.map((x) => (x.id === r.id ? patch(x) : x)) } : prev,
    )
    setOpen((prev) => (prev && prev.id === r.id ? patch(prev) : prev))
  }

  async function approve(r: ResourceRowView, approved: boolean) {
    const res = await fetch(`/api/communities/${communityId}/resources/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', approved }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(typeof d.error === 'string' ? d.error : 'Could not change that.')
      return
    }
    const d = await res.json()
    const patch = (x: ResourceRowView) => ({
      ...x,
      approval: { ...x.approval, approved: Boolean(d.approvedAt), markedByName: d.markedByName, approvedAt: d.approvedAt },
    })
    setData((prev) =>
      prev ? { ...prev, resources: prev.resources.map((x) => (x.id === r.id ? patch(x) : x)) } : prev,
    )
    setOpen((prev) => (prev && prev.id === r.id ? patch(prev) : prev))
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[640px]">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Resources</h2>
          {/* Item 15 — the standing description for this tab, verbatim. */}
          <p className="mt-1 text-[13px] text-muted-foreground pretty">
            This section is for sharing best practice content, assets and resources that may be
            valuable to others in the group. Vote up content that has been helpful or delivered
            positive results for you and your team.
          </p>
        </div>
        <Button className="h-10 rounded-lg" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add a resource'}
        </Button>
      </div>

      {adding && (
        <AddResource
          communityId={communityId}
          onDone={() => {
            setAdding(false)
            load()
          }}
        />
      )}

      {/* Filters — type chips primary, topic dropdown secondary. */}
      <div className="mb-4 border-b border-border pb-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label="Topic"
            className="h-[38px] rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">All topics</option>
            {topicsInUse.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'top' | 'newest')}
            aria-label="Sort"
            className="h-[38px] rounded-lg border bg-background px-2 text-sm"
          >
            <option value="top">Top</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setType('')}
            aria-pressed={type === ''}
            className={`rounded-full px-2.5 py-1 text-[12px] transition-colors ${
              type === ''
                ? `border-primary bg-primary/[0.07] text-primary ${SELECTED_WEIGHT}`
                : `border-border text-muted-foreground hover:text-foreground ${UNSELECTED_WEIGHT}`
            }`}
          >
            {type === '' ? '✓ ' : ''}All
          </button>
          {RESOURCE_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType((prev) => (prev === t.key ? '' : t.key))}
              aria-pressed={type === t.key}
              className={`rounded-full px-2.5 py-1 text-[12px] transition-colors ${
                type === t.key
                  ? `border-primary bg-primary/[0.07] text-primary ${SELECTED_WEIGHT}`
                  : `border-border text-muted-foreground hover:text-foreground ${UNSELECTED_WEIGHT}`
              }`}
            >
              {/* ⚠ 2h item 6: a 7% tint and font-medium was not a visible second
                  cue. Border weight is. */}
              {type === t.key ? '✓ ' : ''}{t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : resources.length === 0 ? (
        <div className="central-card border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground pretty">
            {type || topic
              ? 'Nothing here matches that filter yet.'
              : `No resources in ${communityName} yet. Add the first one — a graphic, a leaflet, a link that worked.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <ApprovalFrame key={r.id} stamp={r.approval} flag={r.flag} className="overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setOpen(r)}
                className="block w-full text-left"
              >
                <div className="h-36 w-full overflow-hidden border-b border-border">
                  <Thumbnail resource={r} />
                </div>
                <div className="p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    {typeLabel(r.type)}
                    {r.branchName ? ` · ${r.branchName}` : ''}
                  </p>
                  <h3 className="mt-1 text-[15px] font-semibold leading-snug pretty">{r.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground pretty">{r.whyUseful}</p>
                  {isAiAnswer(r) && <AiLabel aiModel={r.aiModel} className="mt-1.5" />}
                </div>
              </button>
              <div className="flex items-center gap-2 px-3 pb-2">
                <VoteButtons resource={r} onVote={vote} viewerId={data?.viewerId ?? ''} />
                <span className="text-[11px] text-muted-foreground">
                  {r.author.name ?? r.author.username}
                </span>
              </div>
            </ApprovalFrame>
          ))}
        </div>
      )}

      {open && (
        <ResourceDetail
          communityId={communityId}
          resource={open}
          canApprove={mayApprove(open)}
          canManage={data?.canManage ?? false}
          viewerId={data?.viewerId ?? ''}
          onClose={() => setOpen(null)}
          onVote={vote}
          onApprove={approve}
          onChanged={load}
        />
      )}
    </div>
  )
}

function VoteButtons({
  resource,
  onVote,
  viewerId,
}: {
  resource: ResourceRowView
  onVote: (r: ResourceRowView, d: 'UP' | 'DOWN') => void
  viewerId: string
}) {
  // ⚠ The control is hidden on your own resource rather than shown and refused:
  // the rule is no self-voting, and a button that always errors teaches nothing.
  const own = resource.author.id === viewerId
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={own}
        onClick={() => onVote(resource, 'UP')}
        aria-pressed={resource.myVote === 'UP'}
        aria-label="This was useful"
        title={own ? 'You cannot vote on your own resource' : 'This was useful'}
        className={`rounded-md px-1.5 py-0.5 text-[11px] disabled:opacity-30 ${
          resource.myVote === 'UP'
            ? `border-primary text-primary ${SELECTED_WEIGHT}`
            : `border-border text-muted-foreground ${UNSELECTED_WEIGHT}`
        }`}
      >
        {/* ⚠ 2h item 6 — shape and border weight, not hue alone. */}
        {upGlyph(resource.myVote === 'UP')}
      </button>
      <span className="tabular text-[13px] font-semibold">{resource.score}</span>
      <button
        type="button"
        disabled={own}
        onClick={() => onVote(resource, 'DOWN')}
        aria-pressed={resource.myVote === 'DOWN'}
        aria-label="This did not work"
        title={own ? 'You cannot vote on your own resource' : 'This did not work'}
        className={`rounded-md px-1.5 py-0.5 text-[11px] disabled:opacity-30 ${
          resource.myVote === 'DOWN'
            ? `border-red-500 text-red-600 ${SELECTED_WEIGHT}`
            : `border-border text-muted-foreground ${UNSELECTED_WEIGHT}`
        }`}
      >
        {downGlyph(resource.myVote === 'DOWN')}
      </button>
    </div>
  )
}

function ResourceDetail({
  communityId,
  resource,
  canApprove,
  canManage,
  viewerId,
  onClose,
  onVote,
  onApprove,
  onChanged,
}: {
  communityId: string
  resource: ResourceRowView
  canApprove: boolean
  canManage: boolean
  viewerId: string
  onClose: () => void
  onVote: (r: ResourceRowView, d: 'UP' | 'DOWN') => void
  onApprove: (r: ResourceRowView, approved: boolean) => void
  onChanged: () => void
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reported, setReported] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!resource.fileKey) return
    let live = true
    fetch(`/api/communities/${communityId}/resources/${resource.id}/download`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.url) setSignedUrl(d.url)
      })
    return () => {
      live = false
    }
  }, [communityId, resource.id, resource.fileKey])

  async function report() {
    setBusy(true)
    const res = await fetch(`/api/communities/${communityId}/resources/${resource.id}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reportReason.trim() }),
    })
    setBusy(false)
    if (res.ok) {
      setReported(true)
      setReporting(false)
    }
  }

  async function remove() {
    const reason = resource.author.id === viewerId ? '' : window.prompt('Why are you removing it? The author is told.') ?? ''
    if (resource.author.id !== viewerId && !reason.trim()) return
    setBusy(true)
    const res = await fetch(
      `/api/communities/${communityId}/resources/${resource.id}?reason=${encodeURIComponent(reason)}`,
      { method: 'DELETE' },
    )
    setBusy(false)
    if (res.ok) {
      onClose()
      onChanged()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(typeof d.error === 'string' ? d.error : 'Could not remove that.')
    }
  }

  const host = resource.externalUrl ? linkHost(resource.externalUrl) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
              {typeLabel(resource.type)}
            </p>
            <h2 className="text-lg font-semibold tracking-[-0.01em] pretty">{resource.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl leading-none text-muted-foreground">
            ×
          </button>
        </div>

        <ApprovalFrame stamp={resource.approval} flag={resource.flag} className="overflow-hidden bg-white">
          <div className="max-h-[340px] w-full overflow-hidden border-b border-border">
            {resource.fileType === 'application/pdf' && signedUrl ? (
              // The first page, which is what a PDF's thumbnail is.
              <object data={`${signedUrl}#page=1&view=FitH`} type="application/pdf" className="h-[340px] w-full">
                <div className="flex h-[340px] items-center justify-center">
                  <Thumbnail resource={resource} signedUrl={signedUrl ?? undefined} />
                </div>
              </object>
            ) : (
              <div className="flex h-[240px] items-center justify-center">
                <Thumbnail resource={resource} signedUrl={signedUrl ?? undefined} />
              </div>
            )}
          </div>
          <div className="space-y-2 p-3">
            <p className="text-sm leading-relaxed pretty">{resource.whyUseful}</p>
            {/* ⚠ Permanent. Not affected by the approval setting. */}
            <ContextNote context={resource.context} />
            <p className="text-[11px] text-muted-foreground">
              {resource.author.name ?? resource.author.username}
              {resource.branchName ? ` · ${resource.branchName}` : ''} ·{' '}
              {new Date(resource.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {isAiAnswer(resource) && <AiLabel aiModel={resource.aiModel} />}
            {resource.topicTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {resource.topicTags.map((t) => (
                  <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </ApprovalFrame>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <VoteButtons resource={resource} onVote={onVote} viewerId={viewerId} />
          {resource.fileKey && signedUrl && (
            <Button asChild size="sm" variant="outline" className="rounded-lg">
              <a href={signedUrl} download={resource.fileName ?? undefined}>
                Download {resource.fileName ? `“${resource.fileName}”` : ''}
              </a>
            </Button>
          )}
          {resource.externalUrl && (
            <Button asChild size="sm" variant="outline" className="rounded-lg">
              <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer">
                Open{host ? ` on ${host}` : ''}
              </a>
            </Button>
          )}
          <ApprovalCheckbox
            stamp={resource.approval}
            canApprove={canApprove}
            busy={busy}
            onChange={(v) => onApprove(resource, v)}
          />
          <div className="ml-auto flex items-center gap-2">
            {/* ⚠ Visible on EVERY resource, to every member — it is the copyright
                escalation route, and the person who recognises their own work has
                no rights over the Community that posted it. */}
            <button
              type="button"
              onClick={() => setReporting((v) => !v)}
              className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Report
            </button>
            {(canManage || resource.author.id === viewerId) && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="text-[12px] text-red-600 underline underline-offset-2"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {reported && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Reported. The Community admins have been notified.
          </p>
        )}
        {reporting && (
          <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
            <label htmlFor="reportReason" className="block text-[13px] font-medium">
              What is wrong with it?
            </label>
            <textarea
              id="reportReason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
              placeholder="e.g. this is my photograph and I did not give permission"
            />
            <Button size="sm" disabled={busy || reportReason.trim().length < 3} onClick={report}>
              Send report
            </Button>
          </div>
        )}

        <ApprovalLabel stamp={resource.approval} flag={resource.flag} className="mt-3" />
      </div>
    </div>
  )
}

/**
 * The upload form.
 *
 * ⚠ THE FILE GOES UP FIRST AND SEPARATELY. The upload route sniffs the bytes and
 * refuses anything that is not an image or a PDF, and only then does the resource
 * row get created with the key it returned — so a row never points at an object
 * that failed to store, and a refused file never becomes a half-made resource.
 */
function AddResource({ communityId, onDone }: { communityId: string; onDone: () => void }) {
  const [type, setType] = useState<string>('MEME')
  const [title, setTitle] = useState('')
  const [whyUseful, setWhyUseful] = useState('')
  const [context, setContext] = useState('')
  const [topics, setTopics] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rights, setRights] = useState(false)
  const [rightsError, setRightsError] = useState(false)
  const rightsRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const linkOnly = LINK_ONLY.has(type)

  async function submit() {
    // ⚠ THE GATE RUNS BEFORE THE UPLOAD. It used to run on the server, after
    // the file had already been written to R2 — so a refused submission left an
    // orphaned object in the bucket, and the only thing the user saw was an
    // error beside a button. Refusing here costs nothing and stores nothing.
    if (!rights) {
      setRightsError(true)
      rightsRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setBusy(true)
    setError(null)

    let uploaded: { key: string; name: string; type: string; size: number } | undefined
    if (file && !linkOnly) {
      const form = new FormData()
      form.append('file', file)
      const up = await fetch(`/api/communities/${communityId}/resources/upload`, {
        method: 'POST',
        body: form,
      })
      if (!up.ok) {
        const d = await up.json().catch(() => ({}))
        setError(typeof d.error === 'string' ? d.error : 'That file could not be uploaded.')
        setBusy(false)
        return
      }
      uploaded = (await up.json()).file
    }

    const res = await fetch(`/api/communities/${communityId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        title,
        whyUseful,
        context: context.trim() || undefined,
        // Semicolons and newlines only — a comma is part of plenty of topic
        // names, and splitting on it silently cut five of them in Stage 2e.
        topicTags: topics
          .split(/[;\n]/)
          .map((t) => t.trim())
          .filter(Boolean),
        externalUrl: externalUrl.trim() || undefined,
        file: uploaded,
        rightsConfirmed: rights,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Could not add that resource.')
      return
    }
    onDone()
  }

  return (
    <div className="central-card mb-5 space-y-3 p-4">
      <h3 className="text-sm font-semibold">Add a resource</h3>

      <div className="flex flex-wrap gap-1.5">
        {RESOURCE_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            aria-pressed={type === t.key}
            className={`rounded-full px-2.5 py-1 text-[12px] ${
              type === t.key
                ? `border-primary bg-primary/[0.07] text-primary ${SELECTED_WEIGHT}`
                : `border-border text-muted-foreground ${UNSELECTED_WEIGHT}`
            }`}
          >
            {type === t.key ? '✓ ' : ''}{t.label}
          </button>
        ))}
      </div>

      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} className="h-[38px] rounded-lg" />

      <div>
        <label htmlFor="whyUseful" className="mb-1 block text-[13px] font-medium">
          Why this is worth using
        </label>
        <textarea
          id="whyUseful"
          value={whyUseful}
          onChange={(e) => setWhyUseful(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
          placeholder="What it did for you, and when you'd reach for it"
        />
      </div>

      <ContextField value={context} onChange={setContext} />

      <Input
        value={topics}
        onChange={(e) => setTopics(e.target.value)}
        placeholder="Topics, separated by semicolons (optional)"
        className="h-[38px] rounded-lg"
      />

      {linkOnly ? (
        <div>
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://…"
            className="h-[38px] rounded-lg"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {typeLabel(type)} is a link — nothing is hosted here.
          </p>
        </div>
      ) : (
        <div>
          {/* Stage 2i item 3 — the SHARED picker. This was a bare
              `input type=file`, so the browser drew "Choose File" and the
              filename as one run-on line. */}
          <FilePicker
            id="resource-file"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            file={file}
            onSelect={setFile}
            hint="Images and PDFs only, up to 10 MB. Programs and archives are never accepted."
          />
          <p className="mt-2 text-xs text-muted-foreground">Or paste a link instead:</p>
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://… (optional)"
            className="mt-1 h-[38px] rounded-lg"
          />
        </div>
      )}

      {/* ⚠ A HARD GATE, recorded against the row — not a nudge. Without it the
          platform is hosting other people's material on nobody's word.
          ⚠ STAGE 2i ITEM 2: the refusal used to be grey text BESIDE THE BUTTON
          ("Confirm the rights box to continue"), thirty pixels from the control
          it was talking about. Charlie read the whole thing as a dead button.
          The message now appears AT the checkbox, in the error colour, worded as
          an instruction — and the row is outlined so the eye lands on it. */}
      <div
        ref={rightsRef}
        className={`rounded-lg p-2 transition-colors ${
          rightsError ? 'border-2 border-destructive bg-destructive/[0.05]' : 'border-2 border-transparent'
        }`}
      >
        <label className="flex cursor-pointer items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={rights}
            onChange={(e) => {
              setRights(e.target.checked)
              if (e.target.checked) setRightsError(false)
            }}
            aria-invalid={rightsError}
            aria-describedby={rightsError ? 'rights-error' : undefined}
            className={`mt-0.5 size-4 rounded ${rightsError ? 'border-destructive' : 'border-border'}`}
          />
          <span className="pretty">
            I have the right to share this material — I made it, it is licensed for this use, or the
            rights holder has agreed.
          </span>
        </label>
        {rightsError && (
          <p id="rights-error" className="mt-1.5 pl-6 text-[13px] font-medium text-destructive pretty">
            {/* An instruction, not an aside: it says what to do, not what is wrong. */}
            Tick this box to confirm you have the right to share this file.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600 pretty">{error}</p>}

      <div className="flex items-center gap-2">
        {/* ⚠ NOT `disabled={!rights}`. A disabled button cannot be clicked, so it
            cannot explain itself — which is the state Charlie hit. It stays live,
            and the click is what surfaces the reason. */}
        <Button size="sm" disabled={busy} onClick={submit}>
          {busy ? 'Adding…' : 'Add resource'}
        </Button>
      </div>
    </div>
  )
}
