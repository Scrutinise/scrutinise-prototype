import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/prototype(.*)',
  '/onboarding(.*)',
  '/dashboard(.*)',
  '/settings(.*)',
  '/api/ideas(.*)',
  '/api/ai(.*)',
  '/api/user(.*)',
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

export default clerkMiddleware(async (auth, req) => {
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
