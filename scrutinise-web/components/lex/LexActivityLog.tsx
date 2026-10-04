'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-P ADDENDUM §8c — "WHAT LEX HAS DONE ON THIS IDEA", shown to its OWNER beside the Privacy Log.
//
// Every tool call Lex makes on the idea: WHEN, the INSTRUCTION it followed (the owner's own words), WHAT it did and
// WHAT CAME BACK — with a NAMED ACTOR on every row. Colour is never the only cue (docs/CLAUDE.md §21): each outcome is a
// word as well as a glyph. Read-only; it never offers to change anything.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import type { ToolCallRow } from '@/lib/lex/agent/tool-log'

/** "add_candidate" → "add candidate". Plain, from the tool name — no second list of labels to drift. */
const nice = (tool: string) => tool.replace(/_/g, ' ')

function outcome(c: ToolCallRow): { glyph: string; word: string; cls: string } {
  const r = (c.result ?? {}) as { status?: string }
  if (r.status) return { glyph: '◔', word: 'Waiting for you to confirm', cls: 'text-zinc-700' }
  if (c.ok) return { glyph: '✓', word: c.confirmedVia === 'button' ? 'Done — you pressed Confirm' : 'Done', cls: 'text-zinc-800' }
  return { glyph: '✗', word: 'Did not work', cls: 'text-amber-800' }
}

const tierWord: Record<string, string> = {
  free: 'ran without asking (it changes nothing you have not chosen)',
  'asks-first': 'needed your confirmation',
  run: 'a process, priced before it ran',
}

function when(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export default function LexActivityLog({ ideaId }: { ideaId: string }) {
  const [calls, setCalls] = useState<ToolCallRow[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/ideas/${ideaId}/lex-activity`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ calls: ToolCallRow[] }>
      })
      .then((d) => setCalls(d.calls))
      // A failure says so — it must not read as "Lex has done nothing" (docs/CLAUDE.md §18).
      .catch((e) => setFailed(e instanceof Error ? e.message : 'unknown error'))
  }, [ideaId])

  return (
    <section aria-label="What Lex has done on this idea" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">What Lex has done on this idea</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every action Lex takes on your idea is recorded here with the time, the instruction it followed and the
          result. Lex acts only for you, and only on your own idea.
        </p>
      </div>

      {failed && <p className="text-xs font-semibold text-amber-800">⚠ This record could not be loaded ({failed}). It has not been cleared.</p>}
      {!failed && calls === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {calls && calls.length === 0 && (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          Lex has not taken any action on this idea.
        </p>
      )}
      {calls?.map((c) => {
        const o = outcome(c)
        return (
          <div key={c.id} className="rounded-lg border border-zinc-200 px-4 py-3 space-y-1">
            <p className="text-sm text-zinc-900">
              <span className="font-semibold">{c.actor}</span> — {nice(c.tool)}
              <span className="text-zinc-500"> · {when(c.at)}</span>
            </p>
            <p className="text-xs text-zinc-600"><span className="font-medium">Instruction:</span> {c.instruction}</p>
            <p className={`text-xs ${o.cls}`}>
              <span className="font-semibold">{o.glyph} {o.word}.</span>{' '}
              {(c.result as { summary?: string } | null)?.summary ?? ''}
              {c.failureReason ? ` Reason: ${c.failureReason}` : ''}
            </p>
            <p className="text-[11px] text-zinc-500">
              {c.tier ? `This ${tierWord[c.tier] ?? c.tier}.` : ''}
              {c.tainted ? ' It was made in a turn where Lex had read a document or web page.' : ''}
            </p>
          </div>
        )
      })}
    </section>
  )
}
