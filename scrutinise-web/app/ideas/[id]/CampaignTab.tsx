'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DocumentType = 'MP_BRIEFING' | 'ONE_PAGER' | 'PRESS_RELEASE' | 'SOCIAL_KIT'
type OutputStatus = 'PENDING' | 'COMPLETE' | 'FAILED' | null

interface OutputRecord {
  id: string
  documentType: DocumentType
  status: OutputStatus
  content: string | null
  preview: string | null
  hasMore: boolean
  generatedAt: string | null
  version: number
  wordCount: number | null
}

interface DocumentConfig {
  type: DocumentType
  name: string
  description: string
  useCase: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Document type metadata
// ─────────────────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES: DocumentConfig[] = [
  {
    type: 'MP_BRIEFING',
    name: 'MP Briefing',
    description: 'A one-page briefing for an MP or their parliamentary researcher.',
    useCase: 'Use this when contacting your MP directly or requesting a meeting.',
  },
  {
    type: 'ONE_PAGER',
    name: 'One Pager',
    description: 'A public-facing summary for sharing with press, supporters, or online.',
    useCase: 'Use this for your campaign website, newsletters, or social shares.',
  },
  {
    type: 'PRESS_RELEASE',
    name: 'Press Release',
    description: 'A draft press release for campaign organisers to adapt and distribute.',
    useCase: 'Use this to pitch your story to journalists and local media.',
  },
  {
    type: 'SOCIAL_KIT',
    name: 'Social Media Kit',
    description: 'Ready-to-post content for Twitter/X, LinkedIn, Instagram, and WhatsApp.',
    useCase: 'Use this to build momentum and bring supporters to your idea.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Individual output card
// ─────────────────────────────────────────────────────────────────────────────

function OutputCard({
  ideaId,
  config,
  output,
  onStatusChange,
}: {
  ideaId: string
  config: DocumentConfig
  output: OutputRecord | null
  onStatusChange: (updated: OutputRecord) => void
}) {
  const [generating, setGenerating] = useState(output?.status === 'PENDING')
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // Poll for status while PENDING
  useEffect(() => {
    if (output?.status === 'PENDING' || generating) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/ideas/${ideaId}/campaign-outputs`)
          if (!res.ok) return
          const data = await res.json()
          const found = data.outputs?.find((o: OutputRecord) => o.documentType === config.type)
          if (found && found.status !== 'PENDING') {
            stopPolling()
            setGenerating(false)
            onStatusChange(found)
          }
        } catch {
          // network error — keep polling
        }
      }, 3000)
    }
    return stopPolling
  }, [output?.status, generating, ideaId, config.type, onStatusChange, stopPolling])

  async function generate(force = false) {
    setGenerating(true)
    setError(null)
    setConfirmRegenerate(false)

    try {
      const res = await fetch(`/api/ideas/${ideaId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType: config.type, force }),
      })

      const data = await res.json()

      if (!res.ok) {
        setGenerating(false)
        setError(data.error ?? 'Generation failed. Please try again.')
        return
      }

      // If returned immediately as COMPLETE (cached or fast)
      if (data.status === 'COMPLETE') {
        setGenerating(false)
        onStatusChange(data as OutputRecord)
      }
      // Otherwise polling will pick it up
    } catch {
      setGenerating(false)
      setError('Network error. Please try again.')
    }
  }

  function copyToClipboard() {
    if (!output?.content) return
    navigator.clipboard.writeText(output.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function downloadAsTxt() {
    if (!output?.content) return
    const blob = new Blob([output.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${config.type.toLowerCase().replace('_', '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const status = generating ? 'PENDING' : (output?.status ?? null)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{config.name}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{config.description}</p>
            <p className="mt-1 text-xs text-muted-foreground italic">{config.useCase}</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Error */}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        {/* Generating state */}
        {status === 'PENDING' && (
          <p className="text-sm text-muted-foreground">Generating — this usually takes 10–20 seconds…</p>
        )}

        {/* COMPLETE: preview + actions */}
        {status === 'COMPLETE' && output?.content && (
          <>
            <div className="rounded-md bg-muted/40 p-3 text-sm leading-relaxed">
              <p className="whitespace-pre-wrap">
                {expanded ? output.content : (output.preview ?? output.content.slice(0, 200))}
                {!expanded && (output.hasMore ?? output.content.length > 200) && '…'}
              </p>
              {(output.hasMore ?? output.content.length > 200) && (
                <button
                  className="mt-2 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                  onClick={() => setExpanded(e => !e)}
                >
                  {expanded ? 'Show less' : 'Show full document'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </Button>
              <Button size="sm" variant="outline" onClick={downloadAsTxt}>
                Download .txt
              </Button>
              {!confirmRegenerate ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => setConfirmRegenerate(true)}
                >
                  Regenerate
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    This will replace the current version.
                  </span>
                  <Button size="sm" variant="destructive" onClick={() => generate(true)}>
                    Yes, regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRegenerate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {output.generatedAt && (
              <p className="text-xs text-muted-foreground">
                Generated{' '}
                {new Date(output.generatedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {output.wordCount ? ` · ${output.wordCount} words` : ''}
                {output.version > 1 ? ` · version ${output.version}` : ''}
              </p>
            )}
          </>
        )}

        {/* FAILED */}
        {status === 'FAILED' && (
          <p className="text-sm text-red-600">
            Generation failed. Please try again.
          </p>
        )}

        {/* Not yet generated */}
        {(status === null || status === 'FAILED') && (
          <Button
            size="sm"
            onClick={() => generate(false)}
            disabled={generating}
          >
            Generate
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OutputStatus }) {
  if (!status) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Not generated
      </span>
    )
  }
  if (status === 'PENDING') {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Generating…
      </span>
    )
  }
  if (status === 'COMPLETE') {
    return (
      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Ready
      </span>
    )
  }
  if (status === 'FAILED') {
    return (
      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Failed
      </span>
    )
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CampaignTab component
// ─────────────────────────────────────────────────────────────────────────────

interface CampaignTabProps {
  ideaId: string
  isOwner: boolean
}

export default function CampaignTab({ ideaId, isOwner }: CampaignTabProps) {
  const [outputs, setOutputs] = useState<Record<DocumentType, OutputRecord | null>>({
    MP_BRIEFING: null,
    ONE_PAGER: null,
    PRESS_RELEASE: null,
    SOCIAL_KIT: null,
  })
  const [loading, setLoading] = useState(true)

  // Load existing outputs on mount
  useEffect(() => {
    async function loadOutputs() {
      try {
        const res = await fetch(`/api/ideas/${ideaId}/campaign-outputs`)
        if (!res.ok) return
        const data = await res.json()
        const map: Record<DocumentType, OutputRecord | null> = {
          MP_BRIEFING: null,
          ONE_PAGER: null,
          PRESS_RELEASE: null,
          SOCIAL_KIT: null,
        }
        for (const o of data.outputs ?? []) {
          map[o.documentType as DocumentType] = o
        }
        setOutputs(map)
      } finally {
        setLoading(false)
      }
    }
    if (isOwner) loadOutputs()
    else setLoading(false)
  }, [ideaId, isOwner])

  function handleStatusChange(updated: OutputRecord) {
    setOutputs(prev => ({ ...prev, [updated.documentType]: updated }))
  }

  if (!isOwner) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        The campaign tools are available to the idea owner.
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Campaign in a Box</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate ready-to-use campaign documents from your idea. Each document is drafted by Lex
          using your idea&apos;s content. Review and personalise before distributing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DOCUMENT_TYPES.map(config => (
          <OutputCard
            key={config.type}
            ideaId={ideaId}
            config={config}
            output={outputs[config.type]}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </div>
  )
}
