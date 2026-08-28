// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §1/§2 — THE TWO SIGNALS THIS SPRINT STARTS COLLECTING, READABLE.
//
// ⚠ §1: the re-run critique "should be visible to us the way feedback is (§20.5),
// separately from whatever it does to the build." Storing it on the build row makes it
// answerable; nothing makes it READABLE without a surface, and a signal nobody can read is
// a signal nobody will act on. This is that surface — one admin-gated GET, no writes.
//
// ⚠ §2: the rejection log exists to answer ONE question — is transcript-fetching worth
// building? So the counts are grouped by kind and by host, because "eleven YouTube links
// from four people" is the finding and "47 rejections" is not.
//
// ⚠ IT DOES NOT EMAIL. `FeedbackItem` mails on capture because a critique of Lex's output
// is rare and urgent. A re-run critique happens on every re-run, and mailing each one would
// train us to filter the address that also carries the rare ones.
//
// ⚠ ADMIN-GATED INDEPENDENTLY of any layout gate. One gate covering two paths is a gate
// that silently stops covering one of them (the same reasoning as `/api/admin/positions`).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { REJECTION_KINDS } from '@/lib/lex/material-rejection'

export async function GET(req: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50')))

  const [critiques, rejections, byKind] = await Promise.all([
    prisma.ideaBuild.findMany({
      where: { userCritique: { not: null } },
      orderBy: { userCritiqueAt: 'desc' },
      take: limit,
      select: {
        id: true, ideaId: true, version: true, status: true,
        userCritique: true, userCritiqueAt: true,
        idea: { select: { title: true, creatorId: true } },
      },
    }),
    prisma.ideaMaterialRejection.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, ideaId: true, kind: true, target: true, createdAt: true },
    }),
    prisma.ideaMaterialRejection.groupBy({ by: ['kind'], _count: { _all: true } }),
  ])

  // ⚠ EVERY KIND IS PRESENT, INCLUDING THE ZEROES. A `groupBy` returns only the kinds that
  // have happened, so a dashboard built on it silently omits "video: 0" — and "we have had
  // no video links at all" is precisely the answer §2 is waiting for. An absent row and a
  // zero must not look the same.
  const counts = Object.fromEntries(REJECTION_KINDS.map((k) => [k, 0])) as Record<string, number>
  for (const r of byKind) counts[r.kind] = r._count._all

  // The host breakdown, for the one decision this log exists to inform.
  const hosts = new Map<string, number>()
  for (const r of rejections) {
    let host = '(file)'
    try { host = new URL(r.target).hostname.replace(/^www\./, '') } catch { /* a filename */ }
    hosts.set(host, (hosts.get(host) ?? 0) + 1)
  }

  return NextResponse.json({
    critiques: critiques.map((c) => ({
      buildId: c.id,
      ideaId: c.ideaId,
      ideaTitle: c.idea?.title ?? null,
      version: c.version,
      status: c.status,
      // ⚠ VERBATIM. A summarised critique is a second opinion about a first opinion, and
      // §20.5's own summarisation exists only because that text is EMAILED to a person.
      critique: c.userCritique,
      at: c.userCritiqueAt?.toISOString() ?? null,
    })),
    rejections: {
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      byHost: [...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([host, n]) => ({ host, n })),
      recent: rejections.map((r) => ({
        id: r.id, ideaId: r.ideaId, kind: r.kind, target: r.target,
        at: r.createdAt.toISOString(),
      })),
    },
    // ⚠ SAID OUT LOUD: these are counts since the log started, not since the platform did.
    // A reader comparing "11 video links" to a year of usage would be comparing a
    // numerator to the wrong denominator — the failure the census register was built for.
    note: 'Rejections have only been recorded since 25-L (28 Aug 2026). Anything refused '
      + 'before that date left no trace and is not in these counts.',
  })
}
