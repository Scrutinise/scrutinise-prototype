// 26-S decision 154 — THE FEEDBACK ADMIN LIST. Every FeedbackItem, newest first, with its status and the admin's notes.
// GET lists; PATCH changes one item's status / notes. ADMIN or SUPER_ADMIN only (re-checked here, not only by the layout).
// A person is "User N" — the pseudonymous number — never a name. Rejections are worded (CLAUDE.md §30).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { describeIssues } from '@/lib/api-rejection'
import { userRefLabel, type FeedbackAttachment } from '@/lib/lex/feedback-types'
import { FEEDBACK_STATUSES, FEEDBACK_NOTES_MAX, type FeedbackItemRow, type FeedbackStatus } from '@/lib/lex/feedback-admin-types'

const Body = z.object({
  id: z.string().min(1),
  status: z.enum(FEEDBACK_STATUSES).optional(),
  adminNotes: z.string().max(FEEDBACK_NOTES_MAX).optional(),
})
const WORDS = { id: 'the feedback item', status: 'the status', adminNotes: 'the notes' }

async function admin() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return { res: error as NextResponse }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return { res: NextResponse.json({ error: 'Only an administrator can read or change feedback.' }, { status: 403 }) }
  return { user }
}

export async function GET(req: Request) {
  const a = await admin()
  if (a.res) return a.res
  const status = new URL(req.url).searchParams.get('status')
  const rows = await prisma.feedbackItem.findMany({
    where: status && (FEEDBACK_STATUSES as readonly string[]).includes(status) ? { status } : undefined,
    orderBy: { createdAt: 'desc' }, take: 500,
    include: { user: { select: { feedbackRef: true } }, idea: { select: { title: true } } },
  })
  const items: FeedbackItemRow[] = rows.map((r) => ({
    id: r.id, createdAt: r.createdAt.toISOString(), userRef: userRefLabel(r.user?.feedbackRef), ideaTitle: r.idea?.title ?? '(idea removed)',
    stage: r.stage, surface: r.surface, isBugReport: r.surface === 'BUG_REPORT', originalText: r.originalText, summarisedText: r.summarisedText,
    userEdited: r.userEdited, technicalDetail: r.technicalDetail ?? null,
    attachments: ((r.attachments ?? []) as unknown as FeedbackAttachment[]).map((x) => ({ name: x.name, contentType: x.contentType, bytes: x.bytes })),
    sentAt: r.sentAt?.toISOString() ?? null, sendError: r.sendError,
    status: ((FEEDBACK_STATUSES as readonly string[]).includes(r.status) ? r.status : 'NEW') as FeedbackStatus,
    adminNotes: r.adminNotes ?? '', statusChangedAt: r.statusChangedAt?.toISOString() ?? null,
  }))
  const counts = Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, 0])) as Record<FeedbackStatus, number>
  for (const i of items) counts[i.status]++
  return NextResponse.json({ items, counts })
}

export async function PATCH(req: Request) {
  const a = await admin()
  if (a.res) return a.res
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read at all (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const p = Body.safeParse(raw)
  if (!p.success) {
    const { message, rejected } = describeIssues(p.error.issues, { action: 'Saving the feedback status', labels: WORDS })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const { id, status, adminNotes } = p.data
  if (status === undefined && adminNotes === undefined) return NextResponse.json({ error: 'Saving the feedback status was not done: neither a status nor notes were given. Nothing was changed.' }, { status: 422 })
  const row = await prisma.feedbackItem.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!row) return NextResponse.json({ error: 'That feedback item does not exist. Nothing was changed.' }, { status: 404 })
  const updated = await prisma.feedbackItem.update({
    where: { id },
    data: { ...(status !== undefined ? { status, statusChangedAt: status !== row.status ? new Date() : undefined } : {}), ...(adminNotes !== undefined ? { adminNotes: adminNotes.trim() || null } : {}) },
    select: { status: true, adminNotes: true, statusChangedAt: true },
  })
  return NextResponse.json({ ok: true, status: updated.status, adminNotes: updated.adminNotes ?? '', statusChangedAt: updated.statusChangedAt?.toISOString() ?? null })
}
