'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import UpdatePassPanel from '@/components/lex/UpdatePassPanel'

// 26-J §2 — the sources AND documents gathered on this idea. "Sources" is `Research`
// (manually-cited evidence, existing); "documents" is `IdeaUserMaterial` — the table
// §2c confirms is where user uploads and links actually live (25-Y's own fix reads it),
// distinct from `Document` (the system's own generated outputs, shown on the separate
// Documents tab — see 26-J §3, which found this table boundary already IS the
// Inbound/Outbound split and needed no new field).
interface MaterialItem {
  id: string
  kind: 'FILE' | 'LINK'
  status: 'PENDING' | 'READY' | 'FAILED'
  label: string
  filename: string | null
  url: string | null
  findingCount: number
  failureReason: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ResearchItem {
  id: string
  title: string
  snippet: string
  relevanceExplanation: string
  sourceUrl: string
  researchType: string | null
  sourceType: string
  forPolicy: boolean | null
  forAction: boolean | null
  createdAt: string
  contributor?: { id: string; name: string; username: string }
}

interface Props {
  ideaId: string
  stage: string
  isOwner: boolean
  isCollaborator: boolean
  currentUserId: string | null
  initialResearch: ResearchItem[]
  onResearchAdded: (item: ResearchItem) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Label maps
// ─────────────────────────────────────────────────────────────────────────────

const RESEARCH_TYPES = [
  { value: 'EVIDENCE', label: 'Evidence' },
  { value: 'CASE_STUDY', label: 'Case study' },
  { value: 'CAUSES', label: 'Causes' },
  { value: 'PERSPECTIVES', label: 'Perspectives' },
  { value: 'OTHER', label: 'Other' },
]

const SOURCE_TYPES = [
  { value: 'ACADEMIC', label: 'Academic' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'NEWS', label: 'News' },
  { value: 'CASE_STUDY', label: 'Case study' },
  { value: 'LEGISLATION', label: 'Legislation' },
  { value: 'OTHER', label: 'Other' },
]

const TYPE_BADGE: Record<string, string> = {
  EVIDENCE: 'bg-blue-100 text-blue-700',
  CASE_STUDY: 'bg-amber-100 text-amber-700',
  CAUSES: 'bg-purple-100 text-purple-700',
  PERSPECTIVES: 'bg-teal-100 text-teal-700',
  OTHER: 'bg-muted text-muted-foreground',
}

// ─────────────────────────────────────────────────────────────────────────────
// Research card
// ─────────────────────────────────────────────────────────────────────────────

function ResearchCard({ item, canDelete, onDelete }: { item: ResearchItem; canDelete: boolean; onDelete: () => void }) {
  const [showRelevance, setShowRelevance] = useState(false)

  const typeLabel = RESEARCH_TYPES.find(t => t.value === item.researchType)?.label ?? item.researchType ?? 'Other'
  const sourceLabel = SOURCE_TYPES.find(s => s.value === item.sourceType)?.label ?? item.sourceType
  const typeBadgeClass = TYPE_BADGE[item.researchType ?? 'OTHER'] ?? 'bg-muted text-muted-foreground'

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.snippet}</p>
          </div>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Open source"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>

        {item.relevanceExplanation && (
          <div className="mt-2">
            {showRelevance ? (
              <div>
                <p className="text-xs text-muted-foreground">{item.relevanceExplanation}</p>
                <button
                  onClick={() => setShowRelevance(false)}
                  className="mt-0.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Hide
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRelevance(true)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Why is this relevant?
              </button>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass}`}>
            {typeLabel}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {sourceLabel}
          </span>
          {item.forPolicy === true && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">For policy</span>
          )}
          {item.forPolicy === false && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Against policy</span>
          )}
          {item.forAction === true && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">For action</span>
          )}
          {item.forAction === false && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Against action</span>
          )}
        </div>

        {item.contributor && (
          <p className="mt-2 text-xs text-muted-foreground">
            Added by{' '}
            <span className="font-medium text-foreground">{item.contributor.name}</span>
          </p>
        )}

        {/* 26-J §2b — "delete archives; it does not destroy." */}
        {canDelete && (
          <button
            onClick={onDelete}
            className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive"
          >
            Not relevant — remove
          </button>
        )}
      </CardContent>
    </Card>
  )
}

/** 26-J §2 — one gathered document or link (`IdeaUserMaterial`). */
function MaterialCard({ item, canDelete, onDelete }: { item: MaterialItem; canDelete: boolean; onDelete: () => void }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{item.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.kind === 'FILE' ? `File — ${item.filename ?? 'uploaded'}` : 'Link'}
              {item.status === 'READY' && item.findingCount > 0 && ` · ${item.findingCount} finding${item.findingCount === 1 ? '' : 's'}`}
              {item.status === 'READY' && item.findingCount === 0 && ' · read, nothing bore on the proposal'}
              {item.status === 'PENDING' && ' · not yet read'}
              {item.status === 'FAILED' && ` · could not be read${item.failureReason ? ` — ${item.failureReason}` : ''}`}
            </p>
          </div>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground" aria-label="Open source">
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive"
          >
            Not relevant — remove
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Research form
// ─────────────────────────────────────────────────────────────────────────────

function ResearchForm({
  ideaId,
  onSubmitted,
  onCancel,
}: {
  ideaId: string
  onSubmitted: (item: ResearchItem) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [snippet, setSnippet] = useState('')
  const [relevanceExplanation, setRelevanceExplanation] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [researchType, setResearchType] = useState('EVIDENCE')
  const [sourceType, setSourceType] = useState('ACADEMIC')
  const [forOrAgainstPolicy, setForOrAgainstPolicy] = useState<boolean | undefined>()
  const [forOrAgainstAction, setForOrAgainstAction] = useState<boolean | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function isValidUrl(s: string): boolean {
    try { new URL(s); return true } catch { return false }
  }

  async function handleSubmit() {
    if (!title.trim() || !snippet.trim() || !relevanceExplanation.trim() || !sourceUrl.trim()) {
      setError('Please fill in all required fields')
      return
    }
    if (!isValidUrl(sourceUrl)) {
      setError('Source URL must be a valid web address (include https://)')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          snippet,
          relevanceExplanation,
          sourceUrl,
          researchType,
          sourceType,
          ...(forOrAgainstPolicy !== undefined ? { forOrAgainstPolicy } : {}),
          ...(forOrAgainstAction !== undefined ? { forOrAgainstAction } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data.error === 'string'
          ? data.error
          : data.error?.fieldErrors
            ? Object.values(data.error.fieldErrors).flat().join('; ')
            : 'Something went wrong'
        setError(msg)
        return
      }
      onSubmitted(data)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="text-sm font-semibold">Add Research</h3>

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Title <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Name of the study, report, or article"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Snippet */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Key finding <span className="text-destructive">*</span>
        </label>
        <textarea
          value={snippet}
          onChange={e => setSnippet(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="One or two sentences summarising the key finding"
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-0.5 text-right text-xs text-muted-foreground">{snippet.length}/500</p>
      </div>

      {/* Relevance */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Why is this relevant? <span className="text-destructive">*</span>
        </label>
        <textarea
          value={relevanceExplanation}
          onChange={e => setRelevanceExplanation(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Explain how this research supports or challenges the idea"
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-0.5 text-right text-xs text-muted-foreground">{relevanceExplanation.length}/500</p>
      </div>

      {/* Source URL */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Source URL <span className="text-destructive">*</span>
        </label>
        <input
          type="url"
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Type + Source type */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Research type</label>
          <select
            value={researchType}
            onChange={e => setResearchType(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {RESEARCH_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Source type</label>
          <select
            value={sourceType}
            onChange={e => setSourceType(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SOURCE_TYPES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Optional booleans */}
      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Supports the policy? (optional)</legend>
          <div className="flex gap-3 text-sm">
            {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }, { val: undefined, label: 'N/A' }].map(opt => (
              <label key={String(opt.val)} className="flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  name="forPolicy"
                  checked={forOrAgainstPolicy === opt.val}
                  onChange={() => setForOrAgainstPolicy(opt.val)}
                  className="accent-foreground"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Supports the action? (optional)</legend>
          <div className="flex gap-3 text-sm">
            {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }, { val: undefined, label: 'N/A' }].map(opt => (
              <label key={String(opt.val)} className="flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  name="forAction"
                  checked={forOrAgainstAction === opt.val}
                  onChange={() => setForOrAgainstAction(opt.val)}
                  className="accent-foreground"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Adding…' : 'Add Research'}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────

export default function ResearchTab({
  ideaId,
  stage,
  isOwner,
  isCollaborator,
  currentUserId,
  initialResearch,
  onResearchAdded,
}: Props) {
  const [research, setResearch] = useState<ResearchItem[]>(initialResearch)
  const [material, setMaterial] = useState<MaterialItem[]>([])
  const [showForm, setShowForm] = useState(false)

  // 26-J §2a — "REMOVE THE GATE. Research exists from the first build." This tab used to
  // return a placeholder for any stage outside STAGE_2/STAGE_3+, which hid a Stage 1 idea's
  // own research and documents from the one page that should show them. Adding research is
  // still stage-gated below (§2a only asked to remove the VIEWING gate); reading it is not.
  const publicStages = ['STAGE_3', 'STAGE_4', 'STAGE_5']
  const ownerEditorStages = ['STAGE_1', 'STAGE_2']
  const canAdd =
    (ownerEditorStages.includes(stage) && (isOwner || isCollaborator)) ||
    (publicStages.includes(stage) && !!currentUserId)
  const canDelete = isOwner || isCollaborator

  const loadMaterial = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/material`)
      if (res.ok) {
        const data = await res.json()
        setMaterial(data.material ?? [])
      }
    } catch { /* the tab still shows Research even if this fetch fails */ }
  }, [ideaId])
  useEffect(() => { void loadMaterial() }, [loadMaterial])

  const deleteResearch = useCallback(async (researchId: string) => {
    setResearch((prev) => prev.filter((r) => r.id !== researchId)) // optimistic — it's an archive, not a destructive act
    try {
      await fetch(`/api/ideas/${ideaId}/research?researchId=${researchId}`, { method: 'DELETE' })
    } catch { void loadMaterial() /* on failure, a reload is the honest recovery */ }
  }, [ideaId, loadMaterial])

  const deleteMaterial = useCallback(async (materialId: string) => {
    setMaterial((prev) => prev.filter((m) => m.id !== materialId))
    try {
      const res = await fetch(`/api/ideas/${ideaId}/material?materialId=${materialId}`, { method: 'DELETE' })
      if (res.ok) { const data = await res.json(); setMaterial(data.material ?? []) }
    } catch { /* optimistic removal stands; next load reconciles */ }
  }, [ideaId])

  return (
    <div className="space-y-6">
      {/* 26-K §4c — visible where the material is added, so a user who uploads a document
          sees something happen rather than nothing. */}
      <UpdatePassPanel ideaId={ideaId} canEdit={canDelete} />

      <div>
        <h3 className="mb-3 text-sm font-semibold">Research</h3>
        <div className="space-y-4">
          {canAdd && !showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              Add Research
            </Button>
          )}

          {!currentUserId && publicStages.includes(stage) && (
            <p className="text-sm text-muted-foreground">
              <a href="/sign-in" className="font-medium text-foreground underline underline-offset-2">
                Sign in
              </a>{' '}
              to add research.
            </p>
          )}

          {showForm && (
            <ResearchForm
              ideaId={ideaId}
              onSubmitted={item => {
                setResearch(prev => [...prev, item])
                onResearchAdded(item)
                setShowForm(false)
              }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {research.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground">No research items added yet.</p>
          )}

          {research.map(r => (
            <ResearchCard key={r.id} item={r} canDelete={canDelete} onDelete={() => void deleteResearch(r.id)} />
          ))}
        </div>
      </div>

      {/* 26-J §2b — every source and document gathered, from the table that actually holds
          them (`IdeaUserMaterial`, confirmed by §2c) — links and files the user (or Lex,
          filed from chat per decision 92) added. */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Documents and sources gathered</h3>
        {material.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing gathered yet.</p>
        ) : (
          <div className="space-y-4">
            {material.map((m) => (
              <MaterialCard key={m.id} item={m} canDelete={canDelete} onDelete={() => void deleteMaterial(m.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
