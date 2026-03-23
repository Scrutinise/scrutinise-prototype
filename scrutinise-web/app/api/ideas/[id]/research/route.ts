import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const ResearchSchema = z.object({
  title: z.string().min(1).max(200),
  snippet: z.string().min(1).max(500),
  relevanceExplanation: z.string().min(1).max(500),
  sourceUrl: z.string().url(),
  researchType: z.enum(['EVIDENCE', 'CASE_STUDY', 'CAUSES', 'PERSPECTIVES', 'OTHER']),
  sourceType: z.enum(['ACADEMIC', 'GOVERNMENT', 'NEWS', 'CASE_STUDY', 'LEGISLATION', 'OTHER']),
  forOrAgainstPolicy: z.boolean().optional(),
  forOrAgainstAction: z.boolean().optional(),
})

// GET /api/ideas/[id]/research
// Public for LINK_ONLY/PLATFORM_LISTED; owner+editors see all at Stage 2+
export async function GET(_req: Request, { params }: Params) {
  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, creatorId: true, stage: true, visibility: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Determine current user
  const { userId: clerkUserId } = await auth()
  let currentUserId: string | null = null
  if (clerkUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    })
    currentUserId = dbUser?.id ?? null
  }

  const isOwner = currentUserId === idea.creatorId

  // Public stages: Stage 3+ or LINK_ONLY/PLATFORM_LISTED
  const publicStage = ['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage)
  const publicVisibility = ['LINK_ONLY', 'PLATFORM_LISTED'].includes(idea.visibility)

  // Owner/editors can see research at Stage 2+
  if (!publicStage && !publicVisibility) {
    if (!isOwner) {
      // Check if user is a collaborator
      if (!currentUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const collaborator = await prisma.ideaCollaborator.findUnique({
        where: { ideaId_userId: { ideaId, userId: currentUserId } },
      })
      if (!collaborator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const research = await prisma.research.findMany({
    where: { ideaId },
    orderBy: { createdAt: 'asc' },
    include: {
      contributor: { select: { id: true, name: true, username: true } },
    },
  })

  return NextResponse.json({ research })
}

// POST /api/ideas/[id]/research — owner+editors at Stage 2+; all at Stage 3+
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: { collaborators: { select: { userId: true, role: true } } },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOwner = idea.creatorId === user.id
  const isEditor = idea.collaborators.some(c => c.userId === user.id && c.role === 'EDITOR')

  // Stage 2: owner+editors only. Stage 3+: any authenticated user.
  const ownerEditorStages = ['STAGE_2']
  const anyAuthStages = ['STAGE_3', 'STAGE_4', 'STAGE_5']

  if (ownerEditorStages.includes(idea.stage) && !isOwner && !isEditor) {
    return NextResponse.json({ error: 'Forbidden — only owner and editors can add research at this stage' }, { status: 403 })
  }

  if (!ownerEditorStages.includes(idea.stage) && !anyAuthStages.includes(idea.stage)) {
    return NextResponse.json({ error: 'Research cannot be added at this stage' }, { status: 422 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ResearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { title, snippet, relevanceExplanation, sourceUrl, researchType, sourceType, forOrAgainstPolicy, forOrAgainstAction } = parsed.data

  // Google Safe Browsing check on sourceUrl
  const safeBrowsingKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY
  if (safeBrowsingKey) {
    try {
      const sbRes = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${safeBrowsingKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'scrutinise', clientVersion: '1.0' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url: sourceUrl }],
            },
          }),
        },
      )
      const sbData = await sbRes.json()
      if (sbData.matches && sbData.matches.length > 0) {
        return NextResponse.json(
          { error: 'The source URL has been flagged as unsafe by Google Safe Browsing' },
          { status: 422 },
        )
      }
    } catch (err) {
      // Log but don't block — Safe Browsing is a best-effort check
      console.error('[research] Safe Browsing check failed:', err)
    }
  }

  const research = await prisma.research.create({
    data: {
      ideaId,
      addedByUserId: user.id,
      title,
      snippet,
      relevanceExplanation,
      sourceUrl,
      researchType,
      sourceType,
      forPolicy: forOrAgainstPolicy,
      forAction: forOrAgainstAction,
    },
    include: {
      contributor: { select: { id: true, name: true, username: true } },
    },
  })

  return NextResponse.json(research, { status: 201 })
}
