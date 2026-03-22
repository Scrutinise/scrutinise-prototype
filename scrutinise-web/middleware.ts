import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/prototype(.*)',
  '/ideas(.*)',
  '/api/ideas(.*)',
  '/api/ai(.*)',
  '/api/webhooks/clerk',
])

// Public routes that never require auth
const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/training(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)',
  '/unsubscribe(.*)',
  '/ideas/create',      // unauthenticated Lex experience — auth triggered by save prompt
  '/general(.*)',
  '/demo(.*)',
  '/api/health(.*)',
  '/api/ai/public',     // unauthenticated Lex API
  '/prototype/referral(.*)',
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
