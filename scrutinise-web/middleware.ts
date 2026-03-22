import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/prototype(.*)',
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
  '/general(.*)',
  '/demo(.*)',
  '/api/health(.*)',
  '/prototype/referral(.*)', // referral pages are public
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  if (isProtectedRoute(req)) {
    await auth.protect()
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
