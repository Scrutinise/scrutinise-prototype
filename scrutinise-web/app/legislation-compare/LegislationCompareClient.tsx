'use client'

import { useState, useCallback } from 'react'
import PublicNav from '@/components/PublicNav'

// ─────────────────────────────────────────────────────────────────────────────
// Test sections (20 sections across well-amended Acts)
// ─────────────────────────────────────────────────────────────────────────────

const TEST_SECTIONS = [
  { label: 'Equality Act 2010 s.4 — Protected characteristics', type: 'ukpga', year: '2010', chapter: '15', section: '4' },
  { label: 'Equality Act 2010 s.11 — Sex', type: 'ukpga', year: '2010', chapter: '15', section: '11' },
  { label: 'Equality Act 2010 s.13 — Direct discrimination', type: 'ukpga', year: '2010', chapter: '15', section: '13' },
  { label: 'Companies Act 2006 s.172 — Duty to promote success', type: 'ukpga', year: '2006', chapter: '46', section: '172' },
  { label: 'Companies Act 2006 s.174 — Duty of care, skill and diligence', type: 'ukpga', year: '2006', chapter: '46', section: '174' },
  { label: 'Companies Act 2006 s.177 — Duty to declare interests', type: 'ukpga', year: '2006', chapter: '46', section: '177' },
  { label: 'Health and Social Care Act 2012 s.1 — Secretary of State\'s duty', type: 'ukpga', year: '2012', chapter: '7', section: '1' },
  { label: 'Health and Social Care Act 2012 s.9 — Clinical commissioning groups', type: 'ukpga', year: '2012', chapter: '7', section: '9' },
  { label: 'Data Protection Act 2018 s.2 — Meaning of personal data', type: 'ukpga', year: '2018', chapter: '12', section: '2' },
  { label: 'Data Protection Act 2018 s.3 — Terms relating to processing', type: 'ukpga', year: '2018', chapter: '12', section: '3' },
  { label: 'Financial Services Act 2012 s.1 — The Financial Conduct Authority', type: 'ukpga', year: '2012', chapter: '21', section: '1' },
  { label: 'Financial Services Act 2012 s.6 — The FCA\'s strategic objective', type: 'ukpga', year: '2012', chapter: '21', section: '6' },
  { label: 'Consumer Rights Act 2015 s.9 — Goods to be of satisfactory quality', type: 'ukpga', year: '2015', chapter: '15', section: '9' },
  { label: 'Consumer Rights Act 2015 s.20 — Right to reject', type: 'ukpga', year: '2015', chapter: '15', section: '20' },
  { label: 'Modern Slavery Act 2015 s.1 — Slavery, servitude and forced labour', type: 'ukpga', year: '2015', chapter: '30', section: '1' },
  { label: 'Modern Slavery Act 2015 s.54 — Transparency in supply chains', type: 'ukpga', year: '2015', chapter: '30', section: '54' },
  { label: 'Housing Act 2004 s.1 — Residential premises: fitness for human habitation', type: 'ukpga', year: '2004', chapter: '34', section: '1' },
  { label: 'Charities Act 2011 s.1 — Meaning of charity', type: 'ukpga', year: '2011', chapter: '25', section: '1' },
  { label: 'Charities Act 2011 s.2 — Meaning of charitable purpose', type: 'ukpga', year: '2011', chapter: '25', section: '2' },
  { label: 'Climate Change Act 2008 s.1 — The 2050 target', type: 'ukpga', year: '2008', chapter: '27', section: '1' },
]

const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'grok-3-fast', label: 'Grok 3 Fast', provider: 'xai' },
  { id: 'sonar', label: 'Perplexity Sonar', provider: 'perplexity' },
  { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', label: 'Llama 4 Maverick', provider: 'together' },
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

function extractText(xml: string): string {
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function cleanTnaText(raw: string): string {
  const lines = raw.split('\n')

  let startIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (/^\d+[A-Z]?\s+[A-Z]/.test(line) ||
        /^Part\s+\d/i.test(line) ||
        /^Chapter\s+\d/i.test(line) ||
        /^\*\*\d/.test(line)) {
      startIdx = i
      break
    }
  }

  let endIdx = lines.length
  for (let i = lines.length - 1; i >= startIdx; i--) {
    const line = lines[i].trim()
    if (/^Words in s\./i.test(line) ||
        /^S\.\s+\d/i.test(line) ||
        /^Substituted/i.test(line) ||
        /^Inserted/i.test(line) ||
        /^Omitted/i.test(line) ||
        /^Repealed/i.test(line) ||
        /^Modified/i.test(line)) {
      endIdx = i
    } else if (endIdx < lines.length) {
      break
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// API callers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchLegislationXml(
  type: string, year: string, chapter: string, section: string, version: 'revised' | 'enacted'
): Promise<string> {
  const params = new URLSearchParams({ type, year, chapter, section, version })
  const res = await fetch(`/api/legislation/fetch?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

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
        model,
        max_tokens: 8192,
        system: systemPrompt,
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.2,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.choices?.[0]?.message?.content ?? ''
  },

  xai: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.2,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.choices?.[0]?.message?.content ?? ''
  },

  perplexity: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.2,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.choices?.[0]?.message?.content ?? ''
  },

  together: async (systemPrompt, userPrompt, apiKey, model) => {
    const res = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.2,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
    return data.choices?.[0]?.message?.content ?? ''
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

  const SYSTEM_PROMPT = `You are a UK legislative compilation specialist. Given a section reference, output the current revised text of that section exactly as it appears on legislation.gov.uk. Include all subsections and paragraphs. Output only the legislative text — no preamble, no explanation.`

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev =>
      prev.includes(modelId) ? prev.filter(m => m !== modelId) : [...prev, modelId]
    )
  }

  const runEvaluation = useCallback(async () => {
    if (selectedModels.length === 0) return
    setRunning(true)

    const sections = TEST_SECTIONS.slice(0, sectionCount)

    const initialResults: ModelResult[] = selectedModels.map(modelId => {
      const model = MODELS.find(m => m.id === modelId)!
      return { modelId, modelLabel: model.label, results: [], avgScore: 0, status: 'running' }
    })
    setResults(initialResults)

    // Fetch gold standard texts first
    const goldTexts: Record<string, string> = {}
    for (const s of sections) {
      try {
        const xml = await fetchLegislationXml(s.type, s.year, s.chapter, s.section, 'revised')
        goldTexts[s.label] = extractText(xml)
      } catch {
        goldTexts[s.label] = ''
      }
    }

    // Run each model
    for (const modelId of selectedModels) {
      const modelDef = MODELS.find(m => m.id === modelId)!
      const apiKey = apiKeys[modelDef.provider]
      if (!apiKey) {
        setResults(prev => prev.map(r =>
          r.modelId === modelId
            ? { ...r, status: 'error', error: `No API key for ${modelDef.provider}` }
            : r
        ))
        continue
      }

      const sectionResults: SectionResult[] = []

      for (const s of sections) {
        const userPrompt = `Output the full current revised text of ${s.label}. Section reference: section ${s.section} of the ${s.label.split(' s.')[0]}.`

        try {
          const caller = PROMPTS[modelDef.provider]
          const aiText = await caller(SYSTEM_PROMPT, userPrompt, apiKey, modelId)
          const rawGold = goldTexts[s.label] ?? ''
          const goldText = rawGold ? cleanTnaText(rawGold) : ''
          const score = goldText ? jaccardSimilarity(goldText, aiText) : 0
          sectionResults.push({ label: s.label, goldText, aiText, score })
        } catch (err) {
          const rawGoldErr = goldTexts[s.label] ?? ''
          sectionResults.push({
            label: s.label,
            goldText: rawGoldErr ? cleanTnaText(rawGoldErr) : '',
            aiText: '',
            score: 0,
            error: String(err),
          })
        }

        // Update after each section
        const avg = sectionResults.reduce((sum, r) => sum + r.score, 0) / sectionResults.length
        setResults(prev => prev.map(r =>
          r.modelId === modelId
            ? { ...r, results: [...sectionResults], avgScore: avg }
            : r
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
  }, [selectedModels, sectionCount, apiKeys])

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
          Compare AI-compiled UK legislation against the National Archives (TNA) gold standard using Jaccard similarity scoring.
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
                { provider: 'gemini', label: 'Google Gemini API key', placeholder: 'sk-...' },
                { provider: 'anthropic', label: 'Anthropic API key', placeholder: 'sk-...' },
                { provider: 'openai', label: 'OpenAI API key', placeholder: 'sk-...' },
                { provider: 'xai', label: 'xAI (Grok) API key', placeholder: 'xai-...' },
                { provider: 'perplexity', label: 'Perplexity API key', placeholder: 'pplx-...' },
                { provider: 'together', label: 'Together AI API key', placeholder: 'key_...' },
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

          {/* Section count */}
          <div className="flex items-center gap-4">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Sections to test (1–{TEST_SECTIONS.length})</label>
              <input
                type="number"
                min={1}
                max={TEST_SECTIONS.length}
                value={sectionCount}
                onChange={e => setSectionCount(Math.max(1, Math.min(TEST_SECTIONS.length, parseInt(e.target.value) || 1)))}
                className="w-24 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <button
              onClick={runEvaluation}
              disabled={running || selectedModels.length === 0}
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
                                TNA Gold Standard <span className="text-gray-600">(cleaned)</span>
                              </p>
                              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-800 p-2 text-xs text-gray-300">
                                {s.goldText || '(not fetched)'}
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
            Test Sections ({TEST_SECTIONS.length} total)
          </h2>
          <ol className="space-y-1">
            {TEST_SECTIONS.map((s, i) => (
              <li key={s.label} className={`text-xs ${i < sectionCount ? 'text-gray-300' : 'text-gray-600'}`}>
                {i + 1}. {s.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
