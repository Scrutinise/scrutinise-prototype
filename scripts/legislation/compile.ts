import 'dotenv/config'
import { prisma } from '../../scrutinise-web/lib/prisma'
import { CompilationStatus, CompilationConfidence } from '@prisma/client'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const MODEL = 'gemini-2.5-flash'

// Verbatim-accuracy system prompt for AI compilation (V2K-A3)
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

// Plain English summary system prompt (for lexSummary field)
const SUMMARY_SYSTEM_PROMPT = `You are a legal analyst. Produce a clear, plain English summary of what this section of UK legislation says and does. Write 2-4 sentences suitable for a non-lawyer. Do not reproduce the statutory language verbatim.`

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

async function compileSection(sectionId: string): Promise<void> {
  const section = await prisma.legislationSection.findUnique({
    where: { id: sectionId },
    include: {
      legislationItem: { select: { title: true, year: true } },
      amendments: { orderBy: { orderIndex: 'asc' } },
    },
  })

  if (!section || !section.originalText) return

  // ── V2K-A3: Verbatim-first logic ─────────────────────────────────────────
  if (section.tnaCompiledText) {
    // TNA verified text available — use directly, skip Gemini compilation call
    await prisma.legislationSection.update({
      where: { id: sectionId },
      data: {
        compiledText: section.tnaCompiledText,
        confidence: CompilationConfidence.HIGH,
        compilationStatus: CompilationStatus.COMPILED,
        needsReview: false,
        compiledAt: new Date(),
        compiledBy: 'tna-direct',
        compilationVersion: { increment: 1 },
      },
    })
    console.log(`  ✓ s.${section.sectionNumber} — TNA (verbatim)`)

    // Still generate lexSummary from the TNA text
    try {
      const lexSummary = await callGeminiText(
        SUMMARY_SYSTEM_PROMPT,
        `Summarise this section: ${section.tnaCompiledText.slice(0, 3000)}`
      )
      await prisma.legislationSection.update({
        where: { id: sectionId },
        data: { lexSummary },
      })
    } catch (err) {
      console.warn(`  ⚠ s.${section.sectionNumber} — lexSummary failed: ${err}`)
    }
    return
  }

  // ── No TNA text — use AI with verbatim prompt ─────────────────────────────
  const amendmentList = section.amendments.map(a =>
    `- Source: ${a.sourceInstrument} (${a.effectDate?.toISOString().split('T')[0] ?? 'unknown'})
  Type: ${a.amendmentType}
  Instruction: ${a.instruction}
  ${a.targetedText ? `Original text targeted: ${a.targetedText}` : ''}
  ${a.substitutedText ? `Substitute with: ${a.substitutedText}` : ''}`
  ).join('\n\n')

  const truncatedText = section.originalText.slice(0, 3000)
  const isTruncated = section.originalText.length > 3000

  const userPrompt = `Apply the following amendments to this section of UK legislation and output the complete amended text.

SECTION: Section ${section.sectionNumber}
ACT: ${section.legislationItem.title} ${section.legislationItem.year}

ORIGINAL TEXT:${isTruncated ? '\nNote: this section may be truncated for length.' : ''}
${truncatedText}

AMENDMENTS TO APPLY:
${amendmentList || 'No amendments recorded — output the original text unchanged.'}

Output the exact amended statutory text with no other content.`

  // JSON compilation call for metadata
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

  const callGeminiJsonWithRetry = async () => {
    let result
    try {
      result = await callGeminiJson(jsonSystemPrompt, jsonUserPrompt)
    } catch (err) {
      if (String(err).includes('503')) {
        console.warn(`  ⚠ s.${section.sectionNumber} — 503, retrying in 10s...`)
        await new Promise(r => setTimeout(r, 10000))
        result = await callGeminiJson(jsonSystemPrompt, jsonUserPrompt)
      } else {
        throw err
      }
    }
    return result
  }

  try {
    const result = await callGeminiJsonWithRetry()

    const confidence = result.confidence as CompilationConfidence
    const needsReview = confidence === 'LOW'

    const amendmentCount = section.amendments.length
    const complexityScore = Math.min(5, Math.ceil(amendmentCount / 3))

    const tags: string[] = Array.isArray(result.tags)
      ? (result.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 10)
      : []

    const compiledText = String(result.compiledText ?? '')

    await prisma.legislationSection.update({
      where: { id: sectionId },
      data: {
        compiledText,
        confidence,
        confidenceReason: result.confidenceReason ? String(result.confidenceReason) : null,
        unappliedAmendments: Array.isArray(result.unappliedAmendments) ? result.unappliedAmendments : [],
        commencementNote: result.commencementNote ? String(result.commencementNote) : null,
        compilationStatus: needsReview ? CompilationStatus.NEEDS_REVIEW : CompilationStatus.COMPILED,
        compiledAt: new Date(),
        compiledBy: MODEL,
        needsReview,
        compilationVersion: { increment: 1 },
        tags,
        amendmentCount,
        complexityScore,
      },
    })

    console.log(`  ✓ s.${section.sectionNumber} — AI (verbatim attempt) ${confidence}${needsReview ? ' (flagged for review)' : ''}`)

    // Generate lexSummary as a separate call
    try {
      const lexSummary = await callGeminiText(
        SUMMARY_SYSTEM_PROMPT,
        `Summarise this section: ${compiledText.slice(0, 3000)}`
      )
      await prisma.legislationSection.update({
        where: { id: sectionId },
        data: { lexSummary },
      })
    } catch (err) {
      console.warn(`  ⚠ s.${section.sectionNumber} — lexSummary failed: ${err}`)
    }

  } catch (err) {
    await prisma.legislationSection.update({
      where: { id: sectionId },
      data: { compilationStatus: CompilationStatus.FAILED },
    })
    console.error(`  ✗ s.${section.sectionNumber} — ${err}`)
  }
}

async function main() {
  const pendingSections = await prisma.legislationSection.findMany({
    where: { compilationStatus: CompilationStatus.PENDING },
    select: { id: true },
    take: 50, // batch of 50 at a time
  })

  console.log(`Compiling ${pendingSections.length} sections...`)

  for (const { id } of pendingSections) {
    await compileSection(id)
    await new Promise(r => setTimeout(r, 5000)) // 5s gap = 12 RPM
  }

  console.log('Batch complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
