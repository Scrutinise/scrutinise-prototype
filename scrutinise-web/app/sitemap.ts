import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.co.uk'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${APP_URL}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${APP_URL}/training`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${APP_URL}/terms`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${APP_URL}/community-rules`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  // Stage 4+ publicly listed ideas
  const ideas = await prisma.idea.findMany({
    where: {
      stage: { in: ['STAGE_4', 'STAGE_5'] },
      visibility: 'PLATFORM_LISTED',
      status: { not: 'WITHDRAWN' },
    },
    select: { id: true, updatedAt: true },
  })

  const ideaEntries: MetadataRoute.Sitemap = ideas.map((idea) => ({
    url: `${APP_URL}/ideas/${idea.id}`,
    lastModified: idea.updatedAt,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  // Public user profiles with at least one Stage 3+ idea
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      username: { not: null },
      ideas: {
        some: {
          stage: { in: ['STAGE_3', 'STAGE_4', 'STAGE_5'] },
          visibility: { in: ['LINK_ONLY', 'PLATFORM_LISTED'] },
          status: { not: 'WITHDRAWN' },
        },
      },
    },
    select: { username: true, updatedAt: true },
  })

  const userEntries: MetadataRoute.Sitemap = users
    .filter((u) => u.username)
    .map((user) => ({
      url: `${APP_URL}/user/${user.username}`,
      lastModified: user.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  return [...staticPages, ...ideaEntries, ...userEntries]
}
