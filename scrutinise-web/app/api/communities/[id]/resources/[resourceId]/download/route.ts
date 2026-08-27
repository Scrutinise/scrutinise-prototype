import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireLibraryAccess } from '@/lib/question-library'
import { r2SignedUrl } from '@/lib/r2'

type Params = { params: Promise<{ id: string; resourceId: string }> }

// GET /api/communities/[id]/resources/[resourceId]/download
//
// ⚠ THE BUCKET STAYS PRIVATE AND THE URL IS MINTED PER REQUEST (security rule
// 10). Storing a signed URL on the row would be storing an expiry, and the card
// would start handing out dead links the moment it aged past the window.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id, resourceId } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { fileKey: true, fileName: true, deletedAt: true },
  })
  if (!resource || resource.deletedAt || !resource.fileKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    url: await r2SignedUrl(resource.fileKey, {
      downloadAs: resource.fileName ?? undefined,
      expiresIn: 60 * 10,
    }),
  })
}
