import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/prototype(.*)',
  '/onboarding(.*)',
  '/dashboard(.*)',
  '/settings(.*)',
  '/communities(.*)',
  '/api/ideas(.*)',
  '/api/ai(.*)',
  '/api/user(.*)',
  '/api/communities(.*)',
  '/admin(.*)',
  '/api/admin(.*)',
])

// Public routes that never require auth
const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/training(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sign-out(.*)',
  '/invite(.*)',
  '/community-invite(.*)',
  '/unsubscribe(.*)',
  '/ideas(.*)',         // idea detail pages public — visibility enforced in API/page
  '/user(.*)',          // public profile pages
  '/general(.*)',
  '/demo(.*)',
  '/terms(.*)',
  '/community-rules(.*)',
  '/privacy(.*)',
  '/api/health(.*)',
  '/api/ai/public',        // unauthenticated Lex API
  '/api/webhooks/clerk',   // server-to-server — verified via Svix signature, no Clerk session
  '/api/ideas/(.*)/contributions(.*)', // public read for LINK_ONLY/PLATFORM_LISTED ideas
  '/api/ideas/(.*)/research(.*)',      // public read for LINK_ONLY/PLATFORM_LISTED ideas
  '/api/ideas/(.*)/vote(.*)',          // public aggregate vote counts (Stage 4+)
  '/api/ideas/(.*)/amendments',       // public amendment list (Stage 3+)
  '/api/ideas/(.*)/endorsements',     // public endorsement list (Stage 4+)
  '/api/users/(.*)',                   // public profile API
  '/prototype/referral(.*)',
  '/legislation-compare(.*)',          // public legislation evaluator tool
  '/api/legislation/fetch(.*)',        // server-side CORS proxy for legislation.gov.uk
  '/legislation(.*)',                  // public legislation browse
  '/api/legislation/search(.*)',       // public legislation search
  '/api/legislation/(.*)',             // public legislation retrieve (itemId route)
])

/**
 * ⚠ PRINCIPLE 7, part 4 — a SPEED BUMP on the public corpus-bearing paths, described as exactly
 * that and not as a control.
 *
 * Measured on production 2026-08-27, BEFORE this existed: 20 sequential and 10 concurrent anonymous
 * requests to a public idea page and to `/api/legislation/search` all returned 200. No 429, no
 * challenge, no WAF — `server: Vercel` and nothing in front of it. GPTBot, ClaudeBot, CCBot and
 * Bytespider each received the full 42 KB page.
 *
 * ⚠⚠ WHAT THIS IS NOT. The counter lives in the memory of ONE edge isolate. Vercel runs many, and a
 * collector that spreads its requests across them gets a fresh budget from each. It raises the cost
 * of the naive case — a single client walking the site — and nothing more. **It must never be
 * described in the licence application as preventing bulk collection.** The honest sentence is in
 * `docs/PRINCIPLE_7_EVIDENCE.md`, and the real controls are the noindex header, the meta tag and
 * the robots directives.
 *
 * ⚠ THE LIMIT IS DELIBERATELY GENEROUS and it FAILS OPEN. A rate limiter in middleware sits in front
 * of every request on the site; one that is tight or that throws takes the whole site down, which is
 * a far larger harm than the scraping it would prevent. 120 requests per minute is roughly ten times
 * what reading the site produces.
 *
 * ⚠ The IP is SHA-256 hashed before it is used as a key and the raw value is never stored — security
 * rule 6. The map holds a hash and two integers.
 */
const RATE_LIMITED_PREFIXES = ['/ideas/', '/api/ideas/', '/legislation/', '/api/legislation/', '/legislation-compare']
const RATE_MAX = 120
const RATE_WINDOW_MS = 60_000
const buckets = new Map<string, { count: number; reset: number }>()

async function hashKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** true = serve it. Any failure returns true: this must never be the reason a page does not load. */
async function withinRate(req: Request): Promise<boolean> {
  try {
    const path = new URL(req.url).pathname
    if (!RATE_LIMITED_PREFIXES.some((p) => path.startsWith(p))) return true
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    if (ip === 'unknown') return true
    const key = await hashKey(ip)
    const now = Date.now()
    const b = buckets.get(key)
    if (!b || now > b.reset) {
      if (buckets.size > 10_000) buckets.clear()   // bounded: an edge isolate is not a datastore
      buckets.set(key, { count: 1, reset: now + RATE_WINDOW_MS })
      return true
    }
    if (b.count >= RATE_MAX) return false
    b.count++
    return true
  } catch {
    return true
  }
}

export default clerkMiddleware(async (auth, req) => {
  if (!(await withinRate(req))) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'Retry-After': '60', 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }

  if (isPublicRoute(req)) return

  if (isProtectedRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
