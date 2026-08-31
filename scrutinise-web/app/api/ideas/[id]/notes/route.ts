// SPRINT 25-N §3c — THE NOTES TAB. The user's own working notes on an idea.
//
// GET    → this user's notes on this idea, in their order, seeding "My original idea" once.
// POST   → add one.
// PATCH  → edit, retitle, re-group, reorder or hide one.
// DELETE → remove one.
//
// ⚠⚠ EVERY QUERY IS KEYED ON `(ideaId, userId)` AND THERE IS NO OTHER WAY IN. §3c: notes are
// *"private to the user, saved with the idea, never shared"*. There is no visibility column
// and there must not be one — a boolean that defaults to private is a boolean somebody will
// set the other way, and every read is then one missing clause away from publishing a user's
// working notes to their idea-team. Privacy here is a property of the key, not of a flag.
//
// ⚠ AUTHORISATION IS STILL `authorizeIdea`, AND IT IS NOT THE PRIVACY CONTROL. It answers
// "may you be on this idea at all"; a collaborator passes it. The `userId` scope is what makes
// their notes theirs and nobody else's, and the two are deliberately separate — conflating
// them is how a collaborator ends up reading the owner's notes because they were "on the idea".
//
// ⚠ AND THE AUTHOR IS `authz.user`, NEVER `idea.creatorId`. `authorizeIdea` hands back both;
// writing notes against the creator would file a collaborator's private notes under the
// owner's name, and would then serve them back to the owner as their own.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'

type Params = { params: Promise<{ id: string }> }

/**
 * §3c — *"The user's original idea moves here, under 'My original idea' — it should not be
 * the first thing on the working page."*
 *
 * ⚠ IT IS A COPY, NOT A MOVE, AND THE DISTINCTION IS DELIBERATE. `Idea.summaryDescription` is
 * the field the whole state machine, the stage gates and both documents read; moving it would
 * be a schema change with a dozen readers to chase. What §3c is actually about is WHERE THE
 * USER MEETS IT — it was the first thing on the working page, and it belongs among their own
 * material. So the note is a copy, seeded once, and it is marked as seeded rather than typed.
 *
 * ⚠ AND IT IS SEEDED ON READ, NOT ON IDEA CREATION. An idea created before this sprint has no
 * note; seeding on read is what gives every existing idea one without a backfill, and the
 * partial unique index is what makes it safe under two page loads racing each other.
 */
const ORIGINAL_IDEA_TITLE = 'My original idea'

async function seedOriginalIdea(ideaId: string, userId: string, creatorId: string) {
  // ⚠ ONLY FOR THE PERSON WHOSE IDEA IT IS. A collaborator's Notes tab must not open on
  // somebody else's original idea presented as "My original idea".
  if (userId !== creatorId) return
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { summaryDescription: true },
  })
  const body = idea?.summaryDescription?.trim()
  // ⚠ NOTHING IS SEEDED FROM AN EMPTY FIELD. A note titled "My original idea" with nothing in
  // it tells the user their idea was lost.
  if (!body) return
  try {
    await prisma.ideaNote.create({
      data: {
        ideaId, userId, source: 'ORIGINAL_IDEA',
        title: ORIGINAL_IDEA_TITLE, body,
        heading: '', position: 0,
      },
    })
  } catch {
    // ⚠ THE UNIQUE INDEX IS THE GUARD, AND LOSING THE RACE IS THE NORMAL CASE. Two tabs open
    // on the same idea both reach here; one wins, and the loser's job is to carry on rather
    // than to report an error about a row that now exists.
  }
}

async function listNotes(ideaId: string, userId: string) {
  const notes = await prisma.ideaNote.findMany({
    where: { ideaId, userId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })
  return {
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      heading: n.heading,
      position: n.position,
      hidden: n.hidden,
      seeded: n.source !== 'USER',
      updatedAt: n.updatedAt.toISOString(),
    })),
  }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  await seedOriginalIdea(id, authz.user.id, authz.idea.creatorId)
  return NextResponse.json(await listNotes(id, authz.user.id))
}

const CreateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  // ⚠ A NOTE MAY BE EMPTY WHEN IT IS CREATED. The panel adds a blank note and puts the cursor
  // in it; requiring text first would mean the "Add a note" button could not create one.
  body: z.string().max(20000).optional(),
  heading: z.string().trim().max(120).optional(),
})

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  let body: unknown = {}
  try { body = await req.json() } catch { /* an empty body is a valid blank note */ }
  const parsed = CreateSchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  // ⚠ NEW NOTES GO TO THE TOP. A note is written about the thing in front of you now, and
  // appending it to the bottom of a long list is how it goes unread. The user can reorder.
  const lowest = await prisma.ideaNote.aggregate({
    where: { ideaId: id, userId: authz.user.id },
    _min: { position: true },
  })
  await prisma.ideaNote.create({
    data: {
      ideaId: id,
      userId: authz.user.id,
      title: parsed.data.title ?? '',
      body: parsed.data.body ?? '',
      heading: parsed.data.heading ?? '',
      position: (lowest._min.position ?? 0) - 1,
    },
  })
  return NextResponse.json(await listNotes(id, authz.user.id))
}

const PatchSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string().trim().max(200).optional(),
  body: z.string().max(20000).optional(),
  heading: z.string().trim().max(120).optional(),
  hidden: z.boolean().optional(),
  /**
   * A whole new order, as ids top to bottom. Sent by a drag.
   *
   * ⚠ THE WHOLE ORDER, NOT ONE POSITION. Writing a single row's position after a drag means
   * the client and the server have to agree on what the other positions were — and they will
   * not, the first time two tabs are open. The list the user is looking at IS the order.
   */
  order: z.array(z.string().uuid()).max(500).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  let body: unknown = {}
  try { body = await req.json() } catch { /* falls to the 422 */ }
  const parsed = PatchSchema.safeParse(body ?? {})
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const { noteId, order, ...fields } = parsed.data

  // ⚠ SCOPED TO (ideaId, userId) ON THE WRITE ITSELF, never checked first and written after.
  // A read-then-write would be one authorisation with a gap in the middle of it.
  const updated = await prisma.ideaNote.updateMany({
    where: { id: noteId, ideaId: id, userId: authz.user.id },
    data: fields,
  })
  if (updated.count === 0) {
    return NextResponse.json({ error: 'That note is not yours, or is not on this idea.' }, { status: 404 })
  }

  if (order?.length) {
    // ⚠ ONE TRANSACTION, AND EVERY WRITE CARRIES THE SAME SCOPE. A reorder that half-applied
    // would leave the list in an order the user never chose and cannot undo.
    await prisma.$transaction(
      order.map((noteIdInOrder, i) => prisma.ideaNote.updateMany({
        where: { id: noteIdInOrder, ideaId: id, userId: authz.user.id },
        data: { position: i },
      })),
    )
  }

  return NextResponse.json(await listNotes(id, authz.user.id))
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const noteId = new URL(req.url).searchParams.get('noteId')
  if (!noteId) return NextResponse.json({ error: 'Which note?' }, { status: 422 })

  await prisma.ideaNote.deleteMany({ where: { id: noteId, ideaId: id, userId: authz.user.id } })
  return NextResponse.json(await listNotes(id, authz.user.id))
}
