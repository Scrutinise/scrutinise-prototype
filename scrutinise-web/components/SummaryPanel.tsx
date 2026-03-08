'use client'

import { useState } from 'react'

export interface SummaryField {
  name: string
  value: string
  status: 'empty' | 'draft' | 'complete' | 'edited'
}

interface SummaryPanelProps {
  fields: SummaryField[]
  onDiscuss?: (fieldName: string) => void
  onEdit?: (fieldName: string) => void
}

const dotColors: Record<string, string> = {
  empty: 'bg-gray-600',
  draft: 'bg-amber-500',
  complete: 'bg-green-500',
  edited: 'bg-blue-500',
}

const statusLabels: Record<string, string> = {
  empty: 'Not started',
  draft: 'In progress',
  complete: 'Complete',
  edited: 'Edited',
}

export default function SummaryPanel({ fields, onDiscuss, onEdit }: SummaryPanelProps) {
  const [viewingField, setViewingField] = useState<string | null>(null)

  return (
    <div className="h-full flex flex-col bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Idea Summary</h3>
        {viewingField && (
          <button
            onClick={() => setViewingField(null)}
            className="text-xs text-revolutBlue hover:underline flex items-center gap-1"
          >
            &#8617; Return to conversation
          </button>
        )}
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto">
        {fields.map(field => (
          <div key={field.name} className="relative group">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColors[field.status]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-300 truncate">{field.name}</span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">{statusLabels[field.status]}</span>
                </div>
                {field.value ? (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-3 leading-relaxed">{field.value}</p>
                ) : (
                  <p className="text-xs text-gray-600 mt-1 italic">Not yet completed</p>
                )}
              </div>
            </div>

            {(field.status === 'complete' || field.status === 'draft') && field.value && (
              <div className="absolute inset-0 bg-gray-900/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                <button
                  onClick={() => { setViewingField(field.name); onDiscuss?.(field.name) }}
                  className="px-3 py-1.5 text-xs bg-revolutBlue text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  &#128172; Discuss with Lex
                </button>
                <button
                  onClick={() => { setViewingField(field.name); onEdit?.(field.name) }}
                  className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium"
                >
                  &#9999; Edit text
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
