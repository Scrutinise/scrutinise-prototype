import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../scrutinise-web/lib/prisma'
import { CompilationStatus, CompilationConfidence } from '@prisma/client'
import { r2Get, r2Put, compiledKey, summaryKey } from './r2-client'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const MODEL = 'gemini-2.5-flash'
const CLAUDE_FALLBACK_MODEL = 'claude-haiku-4-5-20251001'
const BATCH = 5

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _anthropic
}

// Pause sentinel — same location as ingest
const PAUSE_FILE = path.join(__dirname, 'PAUSE')

// ─────────────────────────────────────────────────────────────────────────────
// System prompts
// ─────────────────────────────────────────────────────────────────────────────

const VERBATIM_SYSTEM_PROMPT = `You are a legal editor applying amendments to UK statutory text.
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

const SUMMARY_SYSTEM_PROMPT = `You are a legal analyst. Produce a clear, plain English summary of what this section of UK legislation says and does. Write 2-4 sentences suitable for a non-lawyer. Do not reproduce the statutory language verbatim.`

// ─────────────────────────────────────────────────────────────────────────────
// Gemini callers
// ─────────────────────────────────────────────────────────────────────────────

async function callGeminiText(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`Gemini API error ${data.error.code}: ${data.error.message?.substring(0, 200)}`)
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callGeminiJson(systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`Gemini API error ${data.error.code}: ${data.error.message?.substring(0, 200)}`)
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return JSON.parse(rawText)
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude fallback caller
// ─────────────────────────────────────────────────────────────────────────────

async function callClaudeJson(systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
  const msg = await getAnthropic().messages.create({
    model: CLAUDE_FALLBACK_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  // Strip markdown code fences if present
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean)
}

// ─────────────────────────────────────────────────────────────────────────────
// Pause helper
// ─────────────────────────────────────────────────────────────────────────────

async function waitIfPaused(): Promise<void> {
  while (fs.existsSync(PAUSE_FILE)) {
    console.log('  ⏸ PAUSE file detected — waiting 30s...')
    await new Promise(r => setTimeout(r, 30000))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compile single section
// ─────────────────────────────────────────────────────────────────────────────

async function compileSection(sectionId: string): Promise<void> {
  const section = await prisma.legislationSection.findUnique({
    where: { id: sectionId },
    include: {
      legislationItem: { select: { title: true, year: true, legislationGovUkId: true } },
      amendments: { orderBy: { orderIndex: 'asc' } },
    },
  })

  if (!section) return

  const { legislationGovUkId } = section.legislationItem
  const cKey = compiledKey(legislationGovUkId, section.sectionNumber)
  const sKey = summaryKey(legislationGovUkId, section.sectionNumber)

  // Fetch source text: prefer enacted XML from R2, fall back to originalText
  let sourceText = section.originalText ?? ''
  if (section.originalXmlKey) {
    const rawXml = await r2Get(section.originalXmlKey)
    if (rawXml) {
      // Strip tags for AI consumption (richer source than pre-stripped originalText)
      sourceText = rawXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }

  if (!sourceText) return

  const amendmentList = section.amendments.map(a =>
    `- Source: ${a.sourceInstrument} (${a.effectDate?.toISOString().split('T')[0] ?? 'unknown'})
  Type: ${a.amendmentType}
  Instruction: ${a.instruction}
  ${a.targetedText ? `Original text targeted: ${a.targetedText}` : ''}
  ${a.substitutedText ? `Substitute with: ${a.substitutedText}` : ''}`
  ).join('\n\n')

  const truncatedText = sourceText.slice(0, 3000)
  const isTruncated   = sourceText.length > 3000

  const jsonSystemPrompt = `You are a legal editor applying amendments to UK statutory text.
Your task is to produce the exact amended text of a legislative section. You must reproduce the statutory language word-for-word, applying only the listed amendments as instructed.
Rules:
- Do NOT paraphrase, summarise, or simplify
- Do NOT add explanatory language
- Do NOT remove subsection numbering
- ONLY change words where an amendment explicitly instructs you to
- Preserve all punctuation, capitalisation, and formatting exactly
- Output ONLY valid JSON. No preamble, no explanation, no markdown.`

  const jsonUserPrompt = `Apply the following amendments to this section of UK legislation and output the result as JSON.

SECTION: Section ${section.sectionNumber}
ACT: ${section.legislationItem.title} ${section.legislationItem.year}

ORIGINAL TEXT:${isTruncated ? '\nNote: this section may be truncated for length.' : ''}
${truncatedText}

AMENDMENTS TO APPLY:
${amendmentList || 'No amendments recorded — output the original text unchanged.'}

OUTPUT FORMAT (JSON only):
{
  "compiledText": "string — the exact amended statutory text",
  "confidence": "HIGH | MEDIUM | LOW",
  "confidenceReason": "string (required if not HIGH)",
  "unappliedAmendments": [{"sourceInstrument": "string", "reason": "string"}],
  "commencementNote": "string | null",
  "tags": ["string"]
}`

  await prisma.legislationSection.update({
    where: { id: sectionId },
    data: { compilationStatus: CompilationStatus.COMPILING },
  })

  const callWithRetry = async (): Promise<{ result: Record<string, unknown>; compiledBy: string }> => {
    try {
      const result = await callGeminiJson(jsonSystemPrompt, jsonUserPrompt)
      return { result, compiledBy: MODEL }
    } catch (err) {
      if (String(err).includes('503')) {
        console.warn(`  ⚠ s.${section.sectionNumber} — 503, retrying in 10s...`)
        await new Promise(r => setTimeout(r, 10000))
        const result = await callGeminiJson(jsonSystemPrompt, jsonUserPrompt)
        return { result, compiledBy: MODEL }
      }
      if (String(err).includes('429')) {
        console.warn(`  ⟳ s.${section.sectionNumber} — Gemini 429 — trying Claude fallback`)
        const result = await callClaudeJson(jsonSystemPrompt, jsonUserPrompt)
        return { result, compiledBy: 'claude-fallback' }
      }
      throw err
    }
  }

  try {
    const { result, compiledBy: usedModel } = await callWithRetry()

    const confidence   = result.confidence as CompilationConfidence
    const needsReview  = confidence === 'LOW'
    const compiledText = String(result.compiledText ?? '')
    const tags: string[] = Array.isArray(result.tags)
      ? (result.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 10)
      : []

    // Write compiled text to R2
    await r2Put(cKey, compiledText)

    // Generate and write lexSummary to R2
    let lexSummaryStored = false
    try {
      const lexSummary = await callGeminiText(
        SUMMARY_SYSTEM_PROMPT,
        `Summarise this section: ${compiledText.slice(0, 3000)}`
      )
      await r2Put(sKey, lexSummary)
      lexSummaryStored = true
    } catch (err) {
      console.warn(`  ⚠ s.${section.sectionNumber} — lexSummary failed: ${err}`)
    }

    const amendmentCount  = section.amendments.length
    const complexityScore = Math.min(5, Math.ceil(amendmentCount / 3))

    await prisma.legislationSection.update({
      where: { id: sectionId },
      data: {
        compiledTextKey: cKey,
        lexSummaryKey: lexSummaryStored ? sKey : null,
        confidence,
        confidenceReason: result.confidenceReason ? String(result.confidenceReason) : null,
        unappliedAmendments: Array.isArray(result.unappliedAmendments) ? result.unappliedAmendments : [],
        commencementNote: result.commencementNote ? String(result.commencementNote) : null,
        compilationStatus: needsReview ? CompilationStatus.NEEDS_REVIEW : CompilationStatus.COMPILED,
        compiledAt: new Date(),
        compiledBy: usedModel,
        needsReview,
        compilationVersion: { increment: 1 },
        tags,
        amendmentCount,
        complexityScore,
      },
    })

    console.log(`  ✓ s.${section.sectionNumber} — ${usedModel} (verbatim) ${confidence}${needsReview ? ' (flagged)' : ''}`)

  } catch (err) {
    await prisma.legislationSection.update({
      where: { id: sectionId },
      data: { compilationStatus: CompilationStatus.FAILED },
    })
    console.error(`  ✗ s.${section.sectionNumber} — ${err}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // --reset-failed: reset FAILED sections back to PENDING
  if (process.argv[2] === '--reset-failed') {
    const { count } = await prisma.legislationSection.updateMany({
      where: { compilationStatus: CompilationStatus.FAILED },
      data: { compilationStatus: CompilationStatus.PENDING },
    })
    console.log(`Reset ${count} FAILED sections to PENDING`)
    return
  }

  // Reclaim sections stuck in COMPILING from a previous crashed/restarted worker run
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000)
  const { count: reclaimedCount } = await prisma.legislationSection.updateMany({
    where: {
      compilationStatus: CompilationStatus.COMPILING,
      updatedAt: { lt: staleThreshold },
    },
    data: { compilationStatus: CompilationStatus.PENDING },
  })
  if (reclaimedCount > 0) {
    console.log(`♻ Reclaimed ${reclaimedCount} stale COMPILING sections → PENDING`)
  }

  const pendingSections = await prisma.legislationSection.findMany({
    where: { compilationStatus: CompilationStatus.PENDING },
    select: { id: true },
    take: 50,
  })

  const totalInDb = await prisma.legislationSection.count()
  const compiledInDb = await prisma.legislationSection.count({
    where: { compilationStatus: CompilationStatus.COMPILED },
  })
  const pendingTotal = await prisma.legislationSection.count({
    where: { compilationStatus: CompilationStatus.PENDING },
  })

  console.log(`Compiling ${pendingSections.length} sections (batch of 50)...`)
  console.log(`DB: ${compiledInDb}/${totalInDb} compiled, ${pendingTotal} pending`)

  let done = 0

  for (let i = 0; i < pendingSections.length; i += BATCH) {
    await waitIfPaused()

    const batch = pendingSections.slice(i, i + BATCH)
    await Promise.all(batch.map(({ id }) => compileSection(id)))
    done += batch.length

    console.log(`  Compiled ${done}/${pendingSections.length} sections this run.`)

    if (i + BATCH < pendingSections.length) {
      await new Promise(r => setTimeout(r, 6000)) // 6s gap between batches
    }
  }

  const compiledAfter = await prisma.legislationSection.count({
    where: { compilationStatus: CompilationStatus.COMPILED },
  })
  const pendingAfter = await prisma.legislationSection.count({
    where: { compilationStatus: CompilationStatus.PENDING },
  })

  console.log(`\nBatch complete. ${compiledAfter} COMPILED total in DB. ${pendingAfter} PENDING remaining.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
