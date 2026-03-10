'use client'

import { useState } from 'react'
import LexChat from '@/components/LexChat'
import SummaryPanel, { SummaryField } from '@/components/SummaryPanel'
import AIFuelGauge from '@/components/AIFuelGauge'
import { LEX_JOURNEY_1_SCRIPT } from '@/lib/lexScripts'
import { useUser } from '@/context/UserContext'

const STAGES = ['Create', 'Draft', 'Develop', 'Campaign', 'Parliament']

const initialFields: SummaryField[] = [
  { name: 'Problem Statement', value: '', status: 'empty' },
  { name: 'Evidence Base', value: '', status: 'empty' },
  { name: 'Proposed Solution', value: '', status: 'empty' },
  { name: 'Who Is Affected', value: '', status: 'empty' },
  { name: 'Coherent Actions', value: '', status: 'empty' },
]

export default function Stage2Page() {
  const { currentUser } = useUser()
  const [fields, setFields] = useState<SummaryField[]>(initialFields)
  const [saved, setSaved] = useState(false)

  const handleFieldUpdate = (field: string, value: string, status: 'draft' | 'complete') => {
    setFields(prev => prev.map(f =>
      f.name === field ? { ...f, value, status } : f
    ))
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-background flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-0">
            {STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  i === 1 ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  {stage}
                </div>
                {i < STAGES.length - 1 && <div className="w-5 h-px bg-border" />}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AIFuelGauge remaining={currentUser.aiFuelRemaining} total={currentUser.aiFuelTotal} />
          <button
            onClick={handleSave}
            className="px-4 py-1.5 border border-border bg-background text-foreground hover:bg-accent rounded-md text-xs font-medium transition-colors"
          >
            {saved ? 'Saved ✓' : 'Save Draft'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <LexChat script={LEX_JOURNEY_1_SCRIPT} onFieldUpdate={handleFieldUpdate} />
          </div>
        </div>

        {/* Summary panel (desktop) */}
        <div className="hidden lg:block w-80 xl:w-96 border-l border-border p-4 overflow-hidden">
          <SummaryPanel
            fields={fields}
            onDiscuss={(fieldName) => console.log('Discuss:', fieldName)}
            onEdit={(fieldName) => console.log('Edit:', fieldName)}
          />
        </div>
      </div>

      {/* Summary panel (mobile — below chat) */}
      <div className="lg:hidden border-t border-border p-4 max-h-48 overflow-y-auto">
        <SummaryPanel fields={fields} />
      </div>
    </div>
  )
}
