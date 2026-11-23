'use client'
// ─────────────────────────────────────────────────────────────────────────────
// CCh 2145Z point 4 — on a Lex page WITHOUT OfflineStrip (which does this itself), tell Lex who is signed in once Clerk has answered, so
// per-user device data (DeviceDraft's kept typing) is keyed by the confirmed user, and another account's is never offered here.
// It is keepForUser, the same call OfflineStrip makes: a different user clears the cached reads; the owner's unsent work is kept (361).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { keepForUser } from './offline'

export function useConfirmLexUser(): void {
  const { isLoaded, userId } = useAuth()
  useEffect(() => { if (isLoaded) void keepForUser(userId ?? null) }, [isLoaded, userId])
}
