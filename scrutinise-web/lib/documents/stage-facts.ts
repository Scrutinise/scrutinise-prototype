// ─────────────────────────────────────────────────────────────────────────────
// DECISION 135 — the three facts a document's stage is derived from, read from the database.
// (The derivation itself is pure and lives in `stage-banner.ts`.)
//
// ⚠ PLAIN READS ONLY (CLAUDE.md §26). `computeCanonicalState` would be the obvious call and is the wrong one:
// it runs `initializeFieldStates` and `projectElicitationOntoPageOne`, which WRITE. A document being generated,
// or a cold-read check, must not change the thing it measures. So: three `findMany`/`count` calls.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { PAGE_SEQUENCE } from '@/lib/lex/page1-config'
import { DEEPENING_PASS_KEYS } from '@/lib/lex/pass-keys'
import { kernelProgressOf, type KernelProgress } from './stage-banner'

export async function readKernelProgress(ideaId: string): Promise<KernelProgress> {
  const [rows, builds, passes] = await Promise.all([
    prisma.ideaFieldState.findMany({ where: { ideaId }, select: { fieldKey: true, status: true } }),
    prisma.ideaBuild.count({ where: { ideaId, status: 'DONE' } }),
    prisma.deepeningPass.findMany({ where: { ideaId }, select: { passKey: true, status: true } }),
  ])
  const byKey = new Map(rows.map((r) => [r.fieldKey, r.status as string]))
  const fieldStatuses = PAGE_SEQUENCE.flatMap((p) => p.fields).map((f) => byKey.get(f.key) ?? 'EMPTY')
  return kernelProgressOf({ built: builds > 0, fieldStatuses, deepeningPassKeys: DEEPENING_PASS_KEYS, passes })
}
