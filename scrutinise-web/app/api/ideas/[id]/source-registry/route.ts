// 26-R / 26-E §3 — THE SOURCE REGISTRY ROUTE. GET lists the numbered sources (syncing first, so every source the idea rests on has a
// number); POST adds a source, archives one ("delete" archives — the number stays taken), edits a snippet, or has Lex write one.
// Rejections are worded (CLAUDE.md §30). A source that could not be read is saved as NOT_READ with the reason — never as read.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { describeIssues } from '@/lib/api-rejection'
import { RegistryBody, REGISTRY_OP_WORDS, REGISTRY_INPUT_WORDS, type RegistryOp } from '@/lib/lex/research-notebook-schema'
import { syncRegistry, listRegistry, addSource, archiveSource, updateSnippet } from '@/lib/lex/source-registry'
import { writeSnippet } from '@/lib/lex/source-snippet'
import { extractUrl, MaterialRejected } from '@/lib/lex/user-material'
import { prisma } from '@/lib/prisma'

export const maxDuration = 120
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  await syncRegistry(id)
  return NextResponse.json({ sources: await listRegistry(id, { includeArchived: false }) })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read at all (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = RegistryBody.safeParse(raw)
  if (!parsed.success) {
    const op = (raw as { op?: unknown } | null)?.op
    const action = typeof op === 'string' && op in REGISTRY_OP_WORDS ? REGISTRY_OP_WORDS[op as RegistryOp] : 'That action'
    const { message, rejected } = describeIssues(parsed.error.issues, { action, labels: REGISTRY_INPUT_WORDS })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const b = parsed.data
  const userId = authz.user.id
  const refuse = (error: string, status = 422) => NextResponse.json({ ok: false, result: null, error }, { status })

  switch (b.op) {
    case 'addSource': {
      const s = b.source
      if (s.kind === 'OWN_OBSERVATION') return refuse('“My own observation” already exists as a source on this idea; choose it when you add a note instead of adding it again.')
      const made = await addSource(id, userId, {
        kind: s.kind, title: s.title, url: s.url ?? null, author: s.author ?? null, publishedAt: s.publishedAt ?? null, citation: s.citation ?? null,
        snippet: s.snippet ?? null, sourceType: s.sourceType ?? null, readStatus: s.readStatus ?? 'NOT_READ',
        readNote: s.readNote ?? (s.snippet ? 'the snippet was written by the person adding it; the page itself was not read' : 'the address was saved; the page itself was not read'),
      })
      return NextResponse.json({ ok: true, result: made, error: null })
    }
    case 'archiveSource': {
      const used = await prisma.researchNote.count({ where: { ideaId: id, sourceId: b.sourceId, status: { not: 'SET_ASIDE' } } })
      const done = await archiveSource(id, b.sourceId)
      if (!done) return refuse('That source is not on this idea’s list, so nothing was removed.')
      // Archived, never deleted: its number stays taken and notes that cite it keep working.
      return NextResponse.json({ ok: true, result: { archived: true, notesStillCiting: used }, error: null })
    }
    case 'setSnippet': {
      const done = await updateSnippet(id, b.sourceId, b.snippet, b.snippet ? { status: 'NOT_READ', note: 'the snippet was written by hand; the page itself was not read' } : undefined)
      return done ? NextResponse.json({ ok: true, result: { saved: true }, error: null }) : refuse('That source is not on this idea’s list, so the snippet was not saved.')
    }
    case 'createSnippet': {
      let title = b.title ?? 'This source', text = b.text ?? '', url: string | null = b.url ?? null
      if (b.sourceId) {
        const row = await prisma.ideaSource.findFirst({ where: { id: b.sourceId, ideaId: id } })
        if (!row) return refuse('That source is not on this idea’s list, so no snippet was written.')
        title = row.title; url = row.url
        if (!text && row.materialId) text = (await prisma.ideaUserMaterial.findUnique({ where: { id: row.materialId }, select: { text: true } }))?.text ?? ''
      }
      let readFrom: 'given' | 'fetched' | 'none' = text.trim() ? 'given' : 'none'
      if (!text.trim() && url) {
        try { const got = await extractUrl(url); text = got.text; title = title === 'This source' ? (got.title ?? title) : title; readFrom = 'fetched' }
        catch (err) {
          if (err instanceof MaterialRejected) return refuse(`${err.message} The page was not read, so no snippet was written — write the snippet yourself, or paste the page’s text and try again.`)
          throw err
        }
      }
      if (readFrom === 'none') return refuse('There is nothing to read: give a web address that can be fetched, or paste the text. No snippet was written.')
      const w = await writeSnippet({ title, text, url })
      if (!(w as { ok: boolean }).ok) return refuse((w as { error: string }).error)
      const ok = w as { snippet: string; words: number }
      // If it was written for a registered source, save it — and record that the text WAS read.
      if (b.sourceId) await updateSnippet(id, b.sourceId, ok.snippet, { status: 'READ', note: null })
      return NextResponse.json({ ok: true, result: { snippet: ok.snippet, words: ok.words, readFrom }, error: null })
    }
  }
}
