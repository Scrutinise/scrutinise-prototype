/**
 * prisma-search.ts — DEPRECATED dual-client shim (collapsed in V26 unification).
 *
 * Before V26, the app DB lived on Railway (lib/prisma → DATABASE_URL) while the
 * search/legislation tables lived on Neon, queried through this separate client
 * (NEON_DATABASE_URL). V26 Migration B moved the app DB to Neon, so DATABASE_URL
 * now points at Neon (pooled) and both clients resolve to the SAME instance.
 *
 * The dual-client split is therefore collapsed: `prismaSearch` is now an alias of
 * `prisma`. Retained as a re-export so existing imports keep compiling; new code
 * should import `prisma` directly.
 */
export { prisma as prismaSearch } from './prisma'
