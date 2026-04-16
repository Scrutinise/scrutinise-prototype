import { prisma } from '../../scrutinise-web/lib/prisma'
import { CompilationStatus, CompilationConfidence } from '@prisma/client'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are a legislative compilation specialist. Your task is to apply amendment instructions to original UK legislation text to produce a clean, accurate compiled version.

ABSOLUTE RULES:
1. Apply amendments exactly as written. Never interpret legislative intent. Never improve or clarify the text.
2. Apply amendments in chronological order by effectDate.
3. If an amendment instruction is ambiguous or the target text cannot be located precisely, DO NOT apply it. Record it in unappliedAmendments with your reason.
4. Never paraphrase, summarise, or reword any provision.
5. Preserve all original formatting: numbered paragraphs, lettered sub-paragraphs, defined terms in quotation marks.
6. Output ONLY valid JSON. No preamble, no explanation, no markdown.`

async function compileSection(sectionId: string): Promise<void> {
  const section = await prisma.legislationSection.findUnique({
    where: { id: sectionId },
    include: {
      legislationItem: { select: { title: true, year: true } },
      amendments: { orderBy: { orderIndex: 'asc' } },
    },
  })

  if (!section || !section.originalText) return

  const amendmentList = section.amendments.map(a =>
    `- Source: ${a.sourceInstrument} (${a.effectDate?.toISOString().split('T')[0] ?? 'unknown'})
  Type: ${a.amendmentType}
  Instruction: ${a.instruction}
  ${a.targetedText ? `Original text targeted: ${a.targetedText}` : ''}
  ${a.substitutedText ? `Substitute with: ${a.substitutedText}` : ''}`
  ).join('\n\n')

  const userPrompt = `Compile the following section of UK legislation by applying the listed amendments in chronological order.

SECTION REFERENCE: Section ${section.sectionNumber}
ACT: ${section.legislationItem.title} ${section.legislationItem.year}

ORIGINAL TEXT:
${section.originalText}

AMENDMENTS TO APPLY:
${amendmentList || 'No amendments recorded — output the original text as compiled text.'}

OUTPUT FORMAT (JSON only):
{
  "sectionRef": "string",
  "compiledText": "string",
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

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
        }),
      }
    )

    const data = await res.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const result = JSON.parse(rawText)

    const confidence = result.confidence as CompilationConfidence
    const needsReview = confidence === 'LOW'

    // Compute amendmentCount and complexityScore from amendment records
    const amendmentCount = section.amendments.length
    const complexityScore = Math.min(5, Math.ceil(amendmentCount / 3))

    // Normalise tags: ensure array of strings, max 10
    const tags: string[] = Array.isArray(result.tags)
      ? result.tags.filter((t: unknown) => typeof t === 'string').slice(0, 10)
      : []

    await prisma.legislationSection.update({
      where: { id: sectionId },
      data: {
        compiledText: result.compiledText,
        confidence,
        confidenceReason: result.confidenceReason ?? null,
        unappliedAmendments: result.unappliedAmendments ?? [],
        commencementNote: result.commencementNote ?? null,
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

    console.log(`  ✓ s.${section.sectionNumber} — ${confidence}${needsReview ? ' (flagged for review)' : ''}`)

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
    await new Promise(r => setTimeout(r, 200)) // Rate limit
  }

  console.log('Batch complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
