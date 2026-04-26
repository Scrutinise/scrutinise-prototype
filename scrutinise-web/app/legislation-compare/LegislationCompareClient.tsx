'use client'

import { useState, useCallback, useEffect } from 'react'
import PublicNav from '@/components/PublicNav'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Amendment {
  sourceInstrument: string
  amendmentType: string
  instruction: string
  targetedText: string | null
  substitutedText: string | null
  effectDate: string | null
}

interface TestSection {
  id: string
  sectionNumber: string
  sectionTitle: string | null
  originalText: string | null
  compiledText: string | null
  lexSummary: string | null
  isTnaVerified: boolean
  actTitle: string
  year: number
  legislationGovUkId: string
  amendments: Amendment[]
}

interface SectionResult {
  label: string
  goldText: string
  aiText: string
  score: number
  error?: string
}

interface ModelResult {
  modelId: string
  modelLabel: string
  results: SectionResult[]
  avgScore: number
  status: 'idle' | 'running' | 'done' | 'error'
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Models
// ─────────────────────────────────────────────────────────────────────────────

const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
  { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   provider: 'gemini' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'gpt-4o',           label: 'GPT-4o',            provider: 'openai' },
  { id: 'grok-3-fast',      label: 'Grok 3 Fast',       provider: 'xai' },
  { id: 'sonar',            label: 'Perplexity Sonar',  provider: 'perplexity' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B', provider: 'together' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Scoring — Jaccard similarity on word tokens
// ─────────────────────────────────────────────────────────────────────────────

function tokenise(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  )
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenise(a)
  const setB = tokenise(b)
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  if (union.size === 0) return 0
  return intersection.size / union.size
}

// ─────────────────────────────────────────────────────────────────────────────
// API callers
// ─────────────────────────────────────────────────────────────────────────────

const PROMPTS: Record<string, (systemPrompt: string, userPrompt: string, apiKey: string, model: string) => Promise<string>> = {
  gemini: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  },

  anthropic: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model, max_tokens: 8192, system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.content?.[0]?.text ?? ''
  },

  openai: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: 8192, temperature: 0.2,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.choices?.[0]?.message?.content ?? ''
  },

  xai: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: 8192, temperature: 0.2,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.choices?.[0]?.message?.content ?? ''
  },

  perplexity: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: 8192, temperature: 0.2,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.choices?.[0]?.message?.content ?? ''
  },

  together: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch('/api/legislation/together-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, apiKey, messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.choices?.[0]?.message?.content ?? ''
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt (verbatim-accuracy — same as compile.ts VERBATIM_SYSTEM_PROMPT)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a legal editor applying amendments to UK statutory text.
Your task is to produce the exact amended text of a legislative section. You must reproduce the statutory language word-for-word, applying only the listed amendments as instructed.
Rules:
- Do NOT paraphrase, summarise, or simplify
- Do NOT add explanatory language
- Do NOT remove subsection numbering
- ONLY change words where an amendment explicitly instructs you to
- Preserve all punctuation, capitalisation, and formatting exactly
- If an amendment inserts text, insert it at the exact position described
- If an amendment substitutes text, replace only those words
- If an amendment omits text, remove only those words
- Output the complete amended section text and nothing else`

// ─────────────────────────────────────────────────────────────────────────────
// Build user prompt for a section
// ─────────────────────────────────────────────────────────────────────────────

function buildUserPrompt(s: TestSection): string {
  const amendmentList = s.amendments.length > 0
    ? s.amendments.map(a =>
        `- Source: ${a.sourceInstrument} (${a.effectDate ?? 'unknown'})
  Type: ${a.amendmentType}
  Instruction: ${a.instruction}
  ${a.targetedText ? `Original text targeted: ${a.targetedText}` : ''}
  ${a.substitutedText ? `Substitute with: ${a.substitutedText}` : ''}`
      ).join('\n\n')
    : 'No amendments recorded'

  return `Compile Section ${s.sectionNumber} of ${s.actTitle} ${s.year} by applying these amendments to the original text. Output only the exact amended statutory text.

ORIGINAL TEXT:
${s.originalText ?? '(not available)'}

AMENDMENTS:
${amendmentList}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LegislationCompareClient() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    gemini: '', anthropic: '', openai: '', xai: '', perplexity: '', together: '',
  })
  const [selectedModels, setSelectedModels] = useState<string[]>(['gemini-2.5-flash'])
  const [sectionCount, setSectionCount] = useState(5)
  const [results, setResults] = useState<ModelResult[]>([])
  const [running, setRunning] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  // Dynamic sections from DB+R2
  const [sections, setSections] = useState<TestSection[]>([])
  const [loadingSections, setLoadingSections] = useState(true)

  useEffect(() => {
    fetch('/api/legislation/test-sections')
      .then(r => r.json())
      .then((data: { sections: TestSection[] }) => setSections(data.sections ?? []))
      .catch(() => setSections([]))
      .finally(() => setLoadingSections(false))
  }, [])

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev =>
      prev.includes(modelId) ? prev.filter(m => m !== modelId) : [...prev, modelId]
    )
  }

  const runEvaluation = useCallback(async () => {
    if (selectedModels.length === 0 || sections.length === 0) return
    setRunning(true)

    const testSections = sections.slice(0, sectionCount)

    const initialResults: ModelResult[] = selectedModels.map(modelId => {
      const model = MODELS.find(m => m.id === modelId)!
      return { modelId, modelLabel: model.label, results: [], avgScore: 0, status: 'running' }
    })
    setResults(initialResults)

    for (const modelId of selectedModels) {
      const modelDef = MODELS.find(m => m.id === modelId)!
      const apiKey   = apiKeys[modelDef.provider]
      if (!apiKey) {
        setResults(prev => prev.map(r =>
          r.modelId === modelId
            ? { ...r, status: 'error', error: `No API key for ${modelDef.provider}` }
            : r
        ))
        continue
      }

      const sectionResults: SectionResult[] = []

      for (const s of testSections) {
        const label    = `${s.actTitle} ${s.year} s.${s.sectionNumber}${s.sectionTitle ? ' — ' + s.sectionTitle : ''}`
        const goldText = s.compiledText ?? ''
        const userPrompt = buildUserPrompt(s)

        try {
          const caller = PROMPTS[modelDef.provider]
          const aiText = await caller(SYSTEM_PROMPT, userPrompt, apiKey, modelId)
          const score  = goldText ? jaccardSimilarity(goldText, aiText) : 0
          sectionResults.push({ label, goldText, aiText, score })
        } catch (err) {
          sectionResults.push({ label, goldText, aiText: '', score: 0, error: String(err) })
        }

        const avg = sectionResults.reduce((sum, r) => sum + r.score, 0) / sectionResults.length
        setResults(prev => prev.map(r =>
          r.modelId === modelId ? { ...r, results: [...sectionResults], avgScore: avg } : r
        ))

        await new Promise(res => setTimeout(res, 300))
      }

      const finalAvg = sectionResults.reduce((sum, r) => sum + r.score, 0) / sectionResults.length
      setResults(prev => prev.map(r =>
        r.modelId === modelId
          ? { ...r, results: sectionResults, avgScore: finalAvg, status: 'done' }
          : r
      ))
    }

    setRunning(false)
  }, [selectedModels, sectionCount, apiKeys, sections])

  const scoreColour = (score: number) => {
    if (score >= 0.7) return 'text-emerald-400'
    if (score >= 0.4) return 'text-amber-400'
    return 'text-red-400'
  }

  const scoreBg = (score: number) => {
    if (score >= 0.7) return 'bg-emerald-900/30 border-emerald-700/40'
    if (score >= 0.4) return 'bg-amber-900/30 border-amber-700/40'
    return 'bg-red-900/30 border-red-700/40'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PublicNav />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Legislation Compiler — AI Evaluation
        </h1>
        <p className="mb-6 text-sm text-gray-400">
          Tests AI models on the verbatim amendment-compilation task. Gold standard: compiled text from TNA or AI (stored in R2).
        </p>

        {/* Research tool warning */}
        <div className="mb-6 rounded-lg border border-amber-800/40 bg-amber-950/30 p-4 text-sm text-amber-300">
          <strong>Research tool.</strong> AI-compiled legislation is not a legal authority.
          Always verify against the official text on legislation.gov.uk.
          API keys you enter are used only in your browser and never stored by Scrutinise.
        </div>

        {/* Config */}
        <div className="mb-8 space-y-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
          {/* Model selection */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Select Models
            </h2>
            <div className="flex flex-wrap gap-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedModels.includes(m.id)
                      ? 'border-teal-600 bg-teal-900/40 text-teal-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* API keys */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              API Keys (session only — never stored)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { provider: 'gemini',     label: 'Google Gemini API key',  placeholder: 'AIza...' },
                { provider: 'anthropic',  label: 'Anthropic API key',       placeholder: 'sk-ant-...' },
                { provider: 'openai',     label: 'OpenAI API key',          placeholder: 'sk-...' },
                { provider: 'xai',        label: 'xAI (Grok) API key',     placeholder: 'xai-...' },
                { provider: 'perplexity', label: 'Perplexity API key',      placeholder: 'pplx-...' },
                { provider: 'together',   label: 'Together AI API key',     placeholder: 'key_...' },
              ].map(({ provider, label, placeholder }) => (
                <div key={provider}>
                  <label className="mb-1 block text-xs text-gray-500">{label}</label>
                  <input
                    type="password"
                    placeholder={placeholder}
                    value={apiKeys[provider]}
                    onChange={e => setApiKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                    className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section count + run */}
          <div className="flex items-center gap-4">
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Sections to test (1–{sections.length || '…'})
              </label>
              <input
                type="number"
                min={1}
                max={sections.length || 1}
                value={sectionCount}
                onChange={e => setSectionCount(Math.max(1, Math.min(sections.length || 1, parseInt(e.target.value) || 1)))}
                className="w-24 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <button
              onClick={runEvaluation}
              disabled={running || selectedModels.length === 0 || sections.length === 0}
              className="mt-5 rounded-lg bg-teal-700 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? 'Running…' : 'Run evaluation'}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Results</h2>

            {/* Leaderboard */}
            {results.some(r => r.status === 'done') && (
              <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                <h3 className="mb-3 text-sm font-medium text-gray-400">Leaderboard</h3>
                <div className="space-y-2">
                  {[...results]
                    .filter(r => r.status === 'done')
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((r, i) => (
                      <div key={r.modelId} className="flex items-center gap-3">
                        <span className="w-5 text-center text-xs text-gray-500">#{i + 1}</span>
                        <span className="w-40 text-sm">{r.modelLabel}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className="h-2 rounded-full bg-teal-600 transition-all"
                            style={{ width: `${r.avgScore * 100}%` }}
                          />
                        </div>
                        <span className={`w-14 text-right text-sm font-mono font-semibold ${scoreColour(r.avgScore)}`}>
                          {(r.avgScore * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Per-model results */}
            {results.map(r => (
              <div key={r.modelId} className={`rounded-lg border p-5 ${scoreBg(r.avgScore)}`}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{r.modelLabel}</h3>
                    <p className="text-xs text-gray-400">
                      {r.status === 'running' ? `Testing ${r.results.length}/${sectionCount} sections…` : `${r.results.length} sections`}
                    </p>
                  </div>
                  {r.status === 'running' && (
                    <span className="text-xs text-gray-400 animate-pulse">Running…</span>
                  )}
                  {r.status === 'error' && (
                    <span className="text-xs text-red-400">{r.error}</span>
                  )}
                  {r.status === 'done' && (
                    <span className={`text-xl font-bold font-mono ${scoreColour(r.avgScore)}`}>
                      {(r.avgScore * 100).toFixed(1)}%
                    </span>
                  )}
                </div>

                {r.results.length > 0 && (
                  <div className="space-y-2">
                    {r.results.map(s => (
                      <div key={s.label} className="rounded border border-gray-700/50 bg-gray-900/60 p-3">
                        <div
                          className="flex cursor-pointer items-center justify-between"
                          onClick={() => setExpandedSection(expandedSection === `${r.modelId}-${s.label}` ? null : `${r.modelId}-${s.label}`)}
                        >
                          <span className="text-xs text-gray-300">{s.label}</span>
                          <div className="flex items-center gap-2">
                            {s.error && <span className="text-xs text-red-400">Error</span>}
                            <span className={`text-xs font-mono font-semibold ${scoreColour(s.score)}`}>
                              {(s.score * 100).toFixed(1)}%
                            </span>
                            <span className="text-xs text-gray-600">
                              {expandedSection === `${r.modelId}-${s.label}` ? '▲' : '▼'}
                            </span>
                          </div>
                        </div>

                        {expandedSection === `${r.modelId}-${s.label}` && (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-medium text-gray-500">
                                Gold standard (TNA / AI compiled)
                              </p>
                              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-800 p-2 text-xs text-gray-300">
                                {s.goldText || '(not available)'}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-gray-500">AI Output</p>
                              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-800 p-2 text-xs text-gray-300">
                                {s.aiText || s.error || '(no output)'}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Test sections list */}
        <div className="mt-10 rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Test Sections ({loadingSections ? '…' : sections.length} total)
          </h2>
          {loadingSections ? (
            <p className="text-xs text-gray-500">Loading sections from database…</p>
          ) : sections.length === 0 ? (
            <p className="text-xs text-gray-500">
              No compiled sections found. Run the ingest script to populate TNA compiled text.
            </p>
          ) : (
            <ol className="space-y-1">
              {sections.map((s, i) => (
                <li key={s.id} className={`text-xs ${i < sectionCount ? 'text-gray-300' : 'text-gray-600'}`}>
                  {i + 1}. {s.actTitle} {s.year} s.{s.sectionNumber}
                  {s.sectionTitle ? ` — ${s.sectionTitle}` : ''}
                  {' '}{s.isTnaVerified
                    ? <span className="text-teal-500">(TNA verified)</span>
                    : <span className="text-gray-500">(AI compiled)</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
