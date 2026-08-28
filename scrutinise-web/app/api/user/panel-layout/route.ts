// SPRINT 25-L §4 — the Lex panel layout, per user.
//
// GET   → the stored layout, repaired.
// PUT   → store one.
//
// ⚠ REPAIRED ON BOTH SIDES, and that is not belt-and-braces. `normaliseLayout` runs on the
// WRITE so an impossible layout never reaches the column, and on the READ so a row stored
// before a panel existed still produces a usable screen. A validator on one side only is a
// validator that stops applying the day the other side changes.
//
// ⚠ NO ZOD SCHEMA FOR THE SHAPE, DELIBERATELY, AND THIS IS THE ONE PLACE IT IS RIGHT. Zod
// would REJECT a layout from an older shape; this endpoint must ACCEPT it and repair it,
// because the alternative is a user whose saved preference has become a 422 they cannot see
// or clear. The size bound below is still enforced — an unbounded body is a different
// question from an unexpected one.

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normaliseLayout } from '@/lib/lex/panel-layout'

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  const row = await prisma.user.findUnique({
    where: { id: user.id }, select: { lexPanelLayout: true },
  })
  // ⚠ `stored` IS THE FACT THE CLIENT CANNOT DERIVE. A returned layout that happens to
  // equal the default is indistinguishable from one nobody has ever set — and 25-H §5's
  // content-following rule turns on exactly that difference. Saying it here is cheaper and
  // truer than the client guessing from a deep-equality check against the default.
  return NextResponse.json({
    layout: normaliseLayout(row?.lexPanelLayout),
    stored: row?.lexPanelLayout != null,
  })
}

export async function PUT(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // A layout is six small values. Anything materially larger is not a layout, and storing
  // it would put arbitrary user-supplied JSON in a column every page load reads.
  if (JSON.stringify(body ?? {}).length > 2000) {
    return NextResponse.json({ error: 'That is not a layout.' }, { status: 422 })
  }

  const layout = normaliseLayout((body as { layout?: unknown })?.layout ?? body)
  await prisma.user.update({ where: { id: user.id }, data: { lexPanelLayout: layout as never } })
  return NextResponse.json({ layout })
}
