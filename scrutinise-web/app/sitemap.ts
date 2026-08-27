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

  /**
   * ⚠⚠ IDEA PAGES ARE NOT LISTED HERE, AND THE REMOVAL IS THE POINT (PRINCIPLE 7, 27 Aug 2026).
   *
   * This block used to add every Stage 4/5 PLATFORM_LISTED idea. Nothing appeared in the served
   * sitemap only because no idea has reached Stage 4 yet — measured 26 Aug: 25 <loc> entries, all
   * static pages and user profiles, 0 ideas. So the sitemap was clean BY ACCIDENT, and would have
   * started advertising idea pages to Google the day the first one was promoted, contradicting the
   * `noindex` served on those same pages.
   *
   * An idea can carry a judgment extract (a Lex-written passage from `tna-caselaw`), and The
   * National Archives' computational analysis licence forbids indexing judgment content. So the
   * whole `/ideas` tree is `noindex, nofollow` — `app/ideas/layout.tsx`, `next.config.js` and
   * `public/robots.txt` — and a sitemap entry would be this codebase asking a crawler to index a
   * page it simultaneously tells the crawler not to index.
   *
   * ⚠ The cost was accepted deliberately by Charlie on 27 Aug: idea pages are no longer discoverable
   * through search. Sharing is by link. Do not restore this block without revisiting the licence
   * position in `docs/PRINCIPLE_7_EVIDENCE.md`.
   */

  // Public user profiles with at least one Stage 3+ idea
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
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

  // ⚠ no idea entries — see the block above. Static pages and public user profiles only.
  return [...staticPages, ...userEntries]
}
