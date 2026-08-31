// SPRINT 25-O §5 — the opening commentary on the causes.
//
// GET → the latest build's commentary, or null.
//
// ⚠ FROM THE LATEST BUILD THAT HAS ONE, not from the latest build. A re-run that failed before
// the commentary pass would otherwise blank a commentary the user was reading five minutes ago —
// and "the newest build has none" is not the same fact as "there is none". The version is
// returned with it so the screen can say which run it came from.
//
// ⚠ AND IT IS A PURE READ WITH NO MODEL CALL, which is what makes it cheap enough to sit on the
// causes section's own load. The pass writes it; this only hands it over.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { commentaryIsSubstantive, type CausesCommentary } from '@/lib/lex/build-commentary'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const row = await prisma.ideaBuild.findFirst({
    where: { ideaId: id, causesCommentary: { not: Prisma.DbNull } },
    orderBy: { version: 'desc' },
    select: { version: true, causesCommentary: true },
  })

  // ⚠⚠ THE VALUE IS CHECKED, NOT THE PRESENCE OF THE COLUMN. `commentaryIsSubstantive` is
  // IMPORTED from the module that writes it rather than restated here — 25-N §4's lesson, where
  // a re-implemented predicate published a number that was wrong. A commentary of empty strings
  // is a column that is not null and has nothing in it, and rendering it would put a heading
  // over a blank.
  const commentary = (row?.causesCommentary ?? null) as unknown as CausesCommentary | null
  const ok = commentaryIsSubstantive(commentary)

  return NextResponse.json({
    commentary: ok ? commentary : null,
    buildVersion: ok ? row?.version ?? null : null,
  })
}
