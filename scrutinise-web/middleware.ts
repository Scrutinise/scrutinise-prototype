// middleware.ts (at project root)
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

// Tell Clerk which routes *require* authentication
export const config = {
  matcher: [
    // Protect everything under /demo
    '/demo(.*)',

    // Add any others you want locked down:
    // '/training(.*)',
    // '/general(.*)',
    // '/about(.*)',

    // Example: protect a single page:
    // '/research',
  ],
};
