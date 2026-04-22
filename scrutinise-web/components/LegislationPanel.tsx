'use client'

import { useState } from 'react'

interface LegislationResult {
  id: string
  sectionNumber: string
  sectionTitle: string | null
  compiledText: string | null
  actTitle: string
  year: number
  legislationGovUkId: string
  amendmentCount: number
  confidence: string | null
  tags: string[] | null
}

interface LegislationPanelProps {
  results: LegislationResult[]
  isOpen: boolean
  onClose: () => void
  currentCoherentActionId: string | null
  ideaId: string
  onLinkSaved: () => void
}

type ChangeType = 'AMEND' | 'REPEAL' | 'ADD'

interface CardState {
  changeType: ChangeType
  proposedWording: string
  saving: boolean
  saved: boolean
}

export default function LegislationPanel({
  results,
  isOpen,
  onClose,
  currentCoherentActionId,
  ideaId,
  onLinkSaved,
}: LegislationPanelProps) {
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({})

  function getCardState(id: string): CardState {
    return cardStates[id] ?? { changeType: 'AMEND', proposedWording: '', saving: false, saved: false }
  }

  function updateCardState(id: string, patch: Partial<CardState>) {
    setCardStates(prev => ({ ...prev, [id]: { ...getCardState(id), ...patch } }))
  }

  async function handleAttach(result: LegislationResult) {
    if (!currentCoherentActionId) return
    const state = getCardState(result.id)
    updateCardState(result.id, { saving: true })
    try {
      await fetch(`/api/ideas/${ideaId}/legislation-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coherentActionId: currentCoherentActionId,
          legislationSectionId: result.id,
          proposedWording: state.proposedWording || undefined,
          changeType: state.changeType,
        }),
      })
      updateCardState(result.id, { saving: false, saved: true })
      onLinkSaved()
    } catch {
      updateCardState(result.id, { saving: false })
    }
  }

  function buildLegislationUrl(govUkId: string, sectionNumber: string): string {
    return `https://www.legislation.gov.uk/${govUkId}/section/${sectionNumber}`
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Relevant Legislation</h2>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>

        {/* Disclaimer */}
        <div className="mx-4 mt-3 mb-2 px-3 py-2 rounded bg-amber-50 border border-amber-200 shrink-0">
          <p className="text-xs text-amber-800 leading-snug">
            AI compilation for reference only. Always verify at{' '}
            <a
              href="https://www.legislation.gov.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              legislation.gov.uk
            </a>
            . Seek professional legal advice for formal work.
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No relevant legislation found in the database.
            </p>
          ) : (
            results.map(result => {
              const state = getCardState(result.id)
              const url = buildLegislationUrl(result.legislationGovUkId, result.sectionNumber)
              return (
                <div key={result.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  {/* Act + section heading */}
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      {result.actTitle} {result.year} — s.{result.sectionNumber}
                    </p>
                    {result.sectionTitle && (
                      <p className="text-sm font-semibold text-teal-700 mt-0.5 leading-snug">
                        {result.sectionTitle}
                      </p>
                    )}
                  </div>

                  {/* Compiled text */}
                  {result.compiledText && (
                    <div className="max-h-[200px] overflow-y-auto rounded bg-muted/50 p-2">
                      <pre className="text-[11px] text-foreground font-mono whitespace-pre-wrap leading-relaxed">
                        {result.compiledText}
                      </pre>
                    </div>
                  )}

                  {/* View on legislation.gov.uk */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:underline block"
                  >
                    View on legislation.gov.uk →
                  </a>

                  {/* Change type + proposed wording + attach */}
                  {currentCoherentActionId && (
                    <div className="space-y-2 pt-1 border-t border-border">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground shrink-0">Change type</label>
                        <select
                          value={state.changeType}
                          onChange={e => updateCardState(result.id, { changeType: e.target.value as ChangeType })}
                          className="text-xs rounded border border-border bg-background px-2 py-1 flex-1"
                        >
                          <option value="AMEND">Amend</option>
                          <option value="REPEAL">Repeal</option>
                          <option value="ADD">Add</option>
                        </select>
                      </div>

                      <textarea
                        value={state.proposedWording}
                        onChange={e => updateCardState(result.id, { proposedWording: e.target.value })}
                        placeholder="Draft your proposed amendment here..."
                        rows={3}
                        className="w-full text-xs rounded border border-border bg-background p-2 resize-none placeholder:text-muted-foreground/60"
                      />

                      <button
                        onClick={() => handleAttach(result)}
                        disabled={state.saving || state.saved}
                        className="w-full text-xs py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
                      >
                        {state.saved ? 'Attached ✓' : state.saving ? 'Saving…' : 'Attach to this action'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
