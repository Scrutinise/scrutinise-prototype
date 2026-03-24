import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  buildMpBriefingPrompt,
  buildOnePagerPrompt,
  buildPressReleasePrompt,
  buildSocialKitPrompt,
} from '@/lib/campaign-prompts'

type Params = { params: Promise<{ id: string }> }

const ALLOWED_STAGES = ['STAGE_4', 'STAGE_5']

const BodySchema = z.object({
  documentType: z.enum(['MP_BRIEFING', 'ONE_PAGER', 'PRESS_RELEASE', 'SOCIAL_KIT']),
  force: z.boolean().optional().default(false),
})

const MODEL_ID = 'gemini-2.5-flash-preview-04-17'
const MAX_OUTPUT_TOKENS = 4000

function selectPrompt(
  documentType: string,
  idea: {
    title: string
    summaryDescription: string
    diagnosis: string | null
    rootCause: string | null
    guidingPolicy: string | null
    coherentActions: Array<{ title: string; summarySnippet: string | null }>
    research: Array<{ title: string; snippet: string; sourceType: string }>
    proposedWording: string | null
    govtArea: string
  },
  referralLink: string,
): string {
  switch (documentType) {
    case 'MP_BRIEFING':
      return buildMpBriefingPrompt(idea, referralLink)
    case 'ONE_PAGER':
      return buildOnePagerPrompt(idea, referralLink)
    case 'PRESS_RELEASE':
      return buildPressReleasePrompt(idea, referralLink)
    case 'SOCIAL_KIT':
      return buildSocialKitPrompt(idea, referralLink)
    default:
      throw new Error(`Unknown document type: ${documentType}`)
  }
}

// POST /api/ideas/[id]/generate
// Auth required. Owner only. Stage 4+ only.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { documentType, force } = parsed.data

  // Fetch idea with all required content fields
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      creatorId: true,
      stage: true,
      title: true,
      summaryDescription: true,
      diagnosis: true,
      rootCause: true,
      guidingPolicy: true,
      proposedWording: true,
      govtArea: true,
      creator: {
        select: { referralCode: true },
      },
      coherentActions: {
        select: { title: true, summarySnippet: true },
        orderBy: { orderIndex: 'asc' },
      },
      research: {
        select: { title: true, snippet: true, sourceType: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Owner only
  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Forbidden — owner only' }, { status: 403 })
  }

  // Stage 4+ only
  if (!ALLOWED_STAGES.includes(idea.stage)) {
    return NextResponse.json(
      { error: 'Campaign tools are only available at Stage 4 and above' },
      { status: 403 },
    )
  }

  // Check for existing GeneratedOutput
  const existing = await prisma.generatedOutput.findUnique({
    where: { ideaId_documentType: { ideaId, documentType } },
  })

  if (existing && existing.status === 'COMPLETE' && !force) {
    return NextResponse.json({
      id: existing.id,
      documentType: existing.documentType,
      status: existing.status,
      content: existing.content,
      generatedAt: existing.generatedAt,
      version: existing.version,
      alreadyExists: true,
    })
  }

  // Determine next version
  const nextVersion = existing ? existing.version + 1 : 1

  // Upsert a PENDING record
  const record = await prisma.generatedOutput.upsert({
    where: { ideaId_documentType: { ideaId, documentType } },
    create: {
      ideaId,
      documentType,
      status: 'PENDING',
      version: 1,
    },
    update: {
      status: 'PENDING',
      version: nextVersion,
      content: null,
      contentHtml: null,
      generatedAt: null,
    },
  })

  // Build referral link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.co.uk'
  const referralLink = `${appUrl}/ideas/${ideaId}?ref=${idea.creator.referralCode}`

  // Build prompt
  const prompt = selectPrompt(documentType, idea, referralLink)

  // Call Gemini 2.5 Flash
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    await prisma.generatedOutput.update({
      where: { id: record.id },
      data: { status: 'FAILED' },
    })
    return NextResponse.json({ error: 'AI unavailable — GEMINI_API_KEY not set' }, { status: 503 })
  }

  let generatedContent: string
  try {
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    })

    const result = await model.generateContent(prompt)
    generatedContent = result.response.text()
  } catch (aiError) {
    console.error('[/api/ideas/[id]/generate] Gemini error:', aiError)
    await prisma.generatedOutput.update({
      where: { id: record.id },
      data: { status: 'FAILED' },
    })
    return NextResponse.json({ error: 'Generation failed' }, { status: 503 })
  }

  // Word count
  const wordCount = generatedContent.trim().split(/\s+/).filter(Boolean).length

  // Update record to COMPLETE
  const completed = await prisma.generatedOutput.update({
    where: { id: record.id },
    data: {
      status: 'COMPLETE',
      content: generatedContent,
      generatedAt: new Date(),
      generatedBy: MODEL_ID,
      wordCount,
    },
  })

  return NextResponse.json({
    id: completed.id,
    documentType: completed.documentType,
    status: completed.status,
    content: completed.content,
    generatedAt: completed.generatedAt,
    version: completed.version,
    wordCount: completed.wordCount,
  })
}
