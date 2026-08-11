'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export interface PackEntryView {
  questionId: string
  text: string
  contextTags: string[]
  topicTags: string[]
  voteCount: number
  answer: {
    body: string
    sources: string[]
    localExample: string | null
    flag: { level: string; reason: string } | null
    isFavourite: boolean
  } | null
  favouriteAnswer: {
    body: string
    sources: string[]
    localExample: string | null
    flag: { level: string; reason: string } | null
  } | null
  pinned: boolean
}

type Format = 'GLANCE' | 'FLASHCARD' | 'LIST' | 'PRINT'

const FORMATS: { key: Format; label: string; rationale: string }[] = [
  { key: 'GLANCE', label: 'Glance cards', rationale: 'One question a screen, for a doorstep conversation.' },
  { key: 'FLASHCARD', label: 'Answer-first flashcards', rationale: 'For rehearsal, when you need words not context.' },
  { key: 'LIST', label: 'Continuous list', rationale: 'The whole pack on one thumb. Best for training.' },
  { key: 'PRINT', label: 'A4 print sheet', rationale: 'For the table at a training session.' },
]

/** The line every output carries, without exception. */
function Disclaimer({ text, className = '' }: { text: string; className?: string }) {
  return <p className={`text-[10px] text-muted-foreground ${className}`}>{text}</p>
}

/** A USE_WITH_CARE flag stays packable, and its reason travels with it. */
function FlagNote({ flag }: { flag: { level: string; reason: string } | null }) {
  if (!flag) return null
  return (
    <p className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 pretty">
      <strong>{flag.level === 'USE_WITH_CARE' ? 'Use with care:' : 'Flagged:'}</strong> {flag.reason}
    </p>
  )
}

export default function PackOutput({
  entries,
  disclaimer,
  communityName,
  branchName,
  contextLabel,
  withSources,
  withLocalExamples,
  onBack,
}: {
  entries: PackEntryView[]
  disclaimer: string
  communityName: string
  branchName: string | null
  contextLabel: string
  withSources: boolean
  withLocalExamples: boolean
  onBack: () => void
}) {
  const [format, setFormat] = useState<Format>('GLANCE')
  const [index, setIndex] = useState(0)
  const current = entries[index]

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>← Back to the builder</Button>
        <div className="flex flex-wrap gap-1">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setFormat(f.key); setIndex(0) }}
              className={`rounded-[7px] px-3 py-1.5 text-[13px] transition-colors ${
                format === f.key
                  ? 'bg-[oklch(0.955_0.004_250)] font-semibold ring-1 ring-inset ring-border'
                  : 'font-medium text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="no-print mb-4 text-xs text-muted-foreground">
        {FORMATS.find((f) => f.key === format)?.rationale}
      </p>

      {/* A — Glance cards. Question first, answer opening visible without a tap. */}
      {format === 'GLANCE' && current && (
        <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[32px] border-[10px] border-[oklch(0.2_0.01_250)] bg-white">
          <div className="p-5">
            <div className="tabular mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{index + 1} / {entries.length}</span>
              <span>{communityName}</span>
            </div>
            <div className="mb-4 h-0.5 w-full rounded bg-border">
              <div
                className="h-0.5 rounded bg-[var(--central-teal)]"
                style={{ width: `${((index + 1) / entries.length) * 100}%` }}
              />
            </div>
            <h2 className="text-[22px] font-semibold leading-[1.3] tracking-[-0.02em] pretty">{current.text}</h2>
            {current.answer ? (
              <>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Best answer
                </p>
                <p className="mt-1 text-sm leading-relaxed pretty">{current.answer.body}</p>
                <FlagNote flag={current.answer.flag} />
                {withSources && current.answer.sources.length > 0 && (
                  <p className="tabular mt-2 text-[11px] text-muted-foreground">
                    {current.answer.sources.length} source{current.answer.sources.length === 1 ? '' : 's'}
                  </p>
                )}
                {current.favouriteAnswer && (
                  <div className="mt-3 rounded-lg border border-primary/40 bg-primary/[0.04] p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-primary">
                      ★ Your favourite
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed pretty">{current.favouriteAnswer.body}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No answer yet — this one is still open.</p>
            )}
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="size-11 rounded-full border border-border text-lg disabled:opacity-30"
                disabled={index === 0}
                aria-label="Previous"
              >
                ←
              </button>
              {withLocalExamples && current.answer?.localExample && (
                <span className="central-teal-text text-[11px] font-medium">Local example ready</span>
              )}
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(entries.length - 1, i + 1))}
                className="size-11 rounded-full border border-border text-lg disabled:opacity-30"
                disabled={index === entries.length - 1}
                aria-label="Next"
              >
                →
              </button>
            </div>
            <Disclaimer text={disclaimer} className="mt-4 text-center" />
          </div>
        </div>
      )}

      {/* B — Answer-first flashcards. The question is demoted; the line you'd
          actually say is the card. */}
      {format === 'FLASHCARD' && current && (
        <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[32px] border-[10px] border-[oklch(0.2_0.01_250)] bg-[oklch(0.15_0.01_250)]">
          <div className="p-5">
            <p className="tabular mb-3 text-[11px] text-white/50">{index + 1} / {entries.length}</p>
            <p className="mb-3 text-xs text-white/50 pretty">{current.text}</p>
            <div className="rounded-xl bg-white p-4">
              <p className="text-[19px] font-medium leading-[1.5] pretty">
                {current.answer?.body ?? 'No answer yet.'}
              </p>
              <FlagNote flag={current.answer?.flag ?? null} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="tabular rounded-lg border border-white/30 px-3 py-1.5 text-xs text-white/80">
                {withSources ? `${current.answer?.sources.length ?? 0} sources` : 'Sources off'}
              </span>
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % entries.length)}
                className="rounded-lg bg-[var(--central-teal)] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Next question
              </button>
            </div>
            <Disclaimer text={disclaimer} className="mt-4 text-center !text-white/40" />
          </div>
        </div>
      )}

      {/* C — Continuous list. The whole pack on one thumb. */}
      {format === 'LIST' && (
        <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[32px] border-[10px] border-[oklch(0.2_0.01_250)] bg-white">
          <div className="sticky top-0 border-b border-border bg-white px-4 py-2.5">
            <p className="text-[13px] font-semibold">{contextLabel} pack</p>
            <p className="tabular text-[11px] text-muted-foreground">{entries.length} questions</p>
          </div>
          <ol className="max-h-[520px] divide-y divide-border overflow-y-auto">
            {entries.map((e, i) => (
              <li key={e.questionId} className="px-4 py-3">
                <p className="text-sm font-semibold leading-snug pretty">
                  <span className="tabular mr-2 text-muted-foreground">{i + 1}</span>
                  {e.text}
                </p>
                {e.answer && <p className="mt-1 text-xs leading-relaxed text-muted-foreground pretty">{e.answer.body}</p>}
                <FlagNote flag={e.answer?.flag ?? null} />
                {e.favouriteAnswer && (
                  <p className="mt-1 text-xs text-primary pretty">★ Your favourite: {e.favouriteAnswer.body}</p>
                )}
              </li>
            ))}
          </ol>
          <div className="border-t border-border px-4 py-3">
            <Disclaimer text={disclaimer} />
          </div>
        </div>
      )}

      {/* Print sheet (A4). */}
      {format === 'PRINT' && (
        <>
          <Button className="no-print mb-3 rounded-lg" onClick={() => window.print()}>Print this sheet</Button>
          <div
            className="print-sheet mx-auto bg-white"
            style={{ width: 794, padding: '56px 64px', boxShadow: '0 4px 20px oklch(0.15 0.01 250 / 0.08)' }}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Scrutinise Central · {branchName ?? communityName}
            </p>
            <div className="mt-1 flex items-end justify-between gap-4 border-b-2 border-foreground pb-3">
              <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
                {contextLabel} pack — top {entries.length}
              </h1>
              <p className="tabular shrink-0 text-right text-[11px] text-muted-foreground">
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                <br />
                Ranked by community vote
              </p>
            </div>

            <ol className="mt-5 space-y-5">
              {entries.map((e, i) => (
                <li key={e.questionId} className="flex gap-3">
                  <span className="tabular w-[34px] shrink-0 text-[22px] font-semibold text-[oklch(0.78_0.01_250)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug pretty">{e.text}</p>
                    {e.answer ? (
                      <p className="mt-1 text-sm leading-[1.6] pretty">{e.answer.body}</p>
                    ) : (
                      <p className="mt-1 text-sm italic text-muted-foreground">No answer yet.</p>
                    )}
                    <FlagNote flag={e.answer?.flag ?? null} />
                    {e.favouriteAnswer && (
                      <p className="mt-1 text-sm leading-[1.6] pretty">
                        <strong>Your favourite:</strong> {e.favouriteAnswer.body}
                      </p>
                    )}
                    {withLocalExamples && e.answer?.localExample && (
                      <p className="mt-1 text-sm leading-[1.6] pretty">
                        <strong>Local example:</strong> {e.answer.localExample}
                      </p>
                    )}
                    <p className="tabular mt-1 text-[11px] text-muted-foreground">
                      {withSources && e.answer?.sources.length ? `${e.answer.sources.length} source(s) · ` : ''}
                      {e.answer?.localExample ? 'local example available · ' : ''}
                      {e.voteCount} votes
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-8 border-t border-border pt-3 text-[10px] text-muted-foreground">
              Private to this Community. {disclaimer}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
