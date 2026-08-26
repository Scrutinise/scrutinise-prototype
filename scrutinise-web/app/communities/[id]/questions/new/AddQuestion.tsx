'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { TagSet } from '../QuestionLibrary'

interface Match {
  id: string
  text: string
  voteCount: number
  answerCount: number
  similarity: number
}

const STEPS = ['Write it', 'Near matches', 'Tags and scope'] as const

export default function AddQuestion({
  communityId,
  tags,
  branchName,
}: {
  communityId: string
  tags: TagSet
  branchName: string | null
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [text, setText] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [checking, setChecking] = useState(false)
  const [context, setContext] = useState<string[]>([])
  const [topic, setTopic] = useState('')
  const [scope, setScope] = useState<'COMMUNITY' | 'BRANCH'>('COMMUNITY')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The lookup runs live as they type, so step 2 is never a surprise when they
  // get there. Debounced, because it fires on every keystroke.
  useEffect(() => {
    if (text.trim().length < 8) { setMatches([]); return }
    const t = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await fetch(
          `/api/communities/${communityId}/questions/near-matches?q=${encodeURIComponent(text.trim())}`,
        )
        if (res.ok) setMatches((await res.json()).matches)
      } finally {
        setChecking(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [text, communityId])

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        scope,
        contextTags: context,
        topicTags: topic ? [topic] : [],
      }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(typeof d.error === 'string' ? d.error : 'Could not post that question.')
      return
    }
    router.push(`/communities/${communityId}/questions/${d.question.id}`)
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        <Link href={`/communities/${communityId}?tab=questions`} className="hover:underline">
          ← Question library
        </Link>
      </p>

      {/* Step pills. Completed steps go teal — live state, not a call to action. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1
          const state = n === step ? 'current' : n < step ? 'done' : 'todo'
          return (
            <span
              key={label}
              className={`central-chip inline-flex items-center px-3 text-xs font-medium ${
                state === 'current'
                  ? 'bg-primary text-primary-foreground'
                  : state === 'done'
                    ? 'central-live border'
                    : 'border border-border bg-white text-muted-foreground'
              }`}
            >
              {label}
            </span>
          )
        })}
      </div>

      {error && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}

      {step === 1 && (
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">What were you asked?</h1>
          <p className="mt-1 text-[13px] text-muted-foreground pretty">
            Write it the way it was put to you, not the tidied-up version.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            autoFocus
            placeholder="“How are you going to pay for all this?”"
            className="mt-4 text-lg leading-snug ring-2 ring-primary/10"
          />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`central-teal-dot inline-block size-[6px] rounded-full ${checking ? 'animate-pulse' : ''}`} />
            Checking the library as you type
            {matches.length > 0 && (
              <span className="central-teal-text tabular font-medium">
                · {matches.length} close {matches.length === 1 ? 'match' : 'matches'}
              </span>
            )}
          </p>
          <Button
            className="mt-4 h-10 rounded-lg"
            disabled={text.trim().length < 5}
            onClick={() => setStep(matches.length > 0 ? 2 : 3)}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div>
          {/* This copy carries the product's intent and is deliberately not
              softened: the user is being offered a bigger audience, never told
              they duplicated something. */}
          <h1 className="text-xl font-semibold tracking-[-0.02em] pretty">
            Good news — {matches.length === 1 ? 'someone has' : `${matches.length} people have`} already been asked this
          </h1>
          <p className="mt-1 max-w-[560px] text-[13px] text-muted-foreground pretty">
            Your answer is worth more on a question people are already reading. Add it to one of these,
            or carry on and post yours as new.
          </p>

          <div className="central-card mt-4 overflow-hidden">
            <p className="central-teal-text-deep border-b border-border bg-[var(--central-teal-fill)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.07em]">
              Close matches
            </p>
            <div className="divide-y divide-border">
              {matches.map((m) => (
                <div key={m.id} className="flex items-start gap-3 p-4">
                  <div className="w-[46px] shrink-0 text-center">
                    <span className="tabular block text-base font-semibold">{m.voteCount}</span>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">votes</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug pretty">{m.text}</p>
                    <p className="tabular mt-0.5 text-xs text-muted-foreground">
                      {m.answerCount} answer{m.answerCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0 rounded-lg">
                    <Link href={`/communities/${communityId}/questions/${m.id}`}>Answer this one</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* The escape is at equal visual weight. It is a shortcut, not a gate. */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" className="h-10 rounded-lg" onClick={() => setStep(3)}>
              Mine is different — carry on
            </Button>
            <p className="text-xs text-muted-foreground">
              Nothing is lost either way; you can move an answer later.
            </p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Where does it belong?</h1>

          <p className="mb-2 mt-4 text-[13px] font-medium">Where were you asked?</p>
          <div className="flex flex-wrap gap-2">
            {[...tags.contextExternal, ...tags.contextInternal].map((t) => {
              const on = context.includes(t.label)
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() =>
                    setContext((prev) => (on ? prev.filter((c) => c !== t.label) : [...prev, t.label]))
                  }
                  className={`central-chip border px-3 text-[13px] transition-colors ${
                    on
                      ? 'border-primary bg-primary font-semibold text-primary-foreground'
                      : 'border-border bg-white text-[oklch(0.3_0.01_250)]'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <p className="mb-2 mt-5 text-[13px] font-medium">
            What is it about? <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          {/* ⚠ OPTIONAL, AND THERE IS NO "OTHER" (26 Aug 2026). A catch-all
              absorbs exactly the questions that would have told an admin which
              topic is missing; leaving it blank puts the question in the admin
              Untagged view instead, which is the evidence for adding one. */}
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-[38px] rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">Not sure — leave it blank</option>
            <optgroup label="Subject">
              {tags.topics.filter((t) => t.promoted).map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </optgroup>
            <optgroup label="Doing the job">
              {tags.topics.filter((t) => !t.promoted).map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </optgroup>
          </select>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Topics are for browsing a slice you can’t name precisely. If you want one specific
            question, search finds it faster.
          </p>

          <p className="mb-2 mt-5 text-[13px] font-medium">Who should see it?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ['COMMUNITY', 'The whole Community', 'Everyone can find it, and any branch can answer.'],
              [
                'BRANCH',
                branchName ? `${branchName} only` : 'My branch only',
                'Only your branch sees it. You can share it wider later.',
              ],
            ] as const).map(([key, title, detail]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScope(key)}
                disabled={key === 'BRANCH' && !branchName}
                className={`rounded-[10px] border p-3 text-left transition-colors disabled:opacity-50 ${
                  scope === key ? 'border-primary bg-primary/[0.05]' : 'border-border bg-white'
                }`}
              >
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground pretty">{detail}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button className="h-10 rounded-lg" disabled={busy} onClick={submit}>
              {busy ? 'Posting…' : 'Post question'}
            </Button>
            <Button variant="ghost" onClick={() => { setStep(1); setContext([]); setTopic('') }}>
              Back to the start
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
