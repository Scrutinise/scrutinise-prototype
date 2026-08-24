'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * CENTRAL Stage 2d — bulk question upload.
 *
 * Two steps, and the preview is the point of the first one: it lists exactly
 * what will be created, and names every row that will not be, with the reason.
 * Confirming re-sends the same file — the server re-parses it rather than
 * trusting a plan posted back from here.
 */

type RowPlan = {
  rowNumber: number
  question: string
  context: string
  topics: string[]
  hasAnswer: boolean
  action: 'create' | 'add-answer' | 'skip' | 'error'
  errors: string[]
  note: string | null
}

type ImportPlan = {
  communityName: string
  columns: string[]
  missingColumns: string[]
  rows: RowPlan[]
  counts: { total: number; questionsToCreate: number; answersToCreate: number; skipped: number; errors: number }
  topicsToCreate: string[]
  knownContexts: string[]
}

type Written = { questions: number; answers: number; topicTags: number }

const ACTION_LABEL: Record<RowPlan['action'], string> = {
  create: 'New question',
  'add-answer': 'New answer',
  skip: 'Nothing to write',
  error: 'Will not import',
}

const ACTION_CLASS: Record<RowPlan['action'], string> = {
  create: 'bg-[var(--central-teal-fill-strong)] central-teal-text',
  'add-answer': 'bg-[var(--central-teal-fill)] central-teal-text',
  skip: 'bg-zinc-100 text-zinc-600',
  error: 'bg-red-100 text-red-700',
}

export default function BulkUpload({
  communityId,
  uploaderName,
  onDone,
  onClose,
}: {
  communityId: string
  uploaderName: string
  onDone: () => void
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [written, setWritten] = useState<Written | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(mode: 'preview' | 'apply') {
    if (!file) return
    setBusy(true)
    setError(null)
    const body = new FormData()
    body.append('file', file)
    const res = await fetch(`/api/communities/${communityId}/questions/bulk?mode=${mode}`, {
      method: 'POST',
      body,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'That upload did not work.')
      setBusy(false)
      return
    }
    setPlan(data.plan)
    if (mode === 'apply') {
      setWritten(data.written)
      onDone()
    }
    setBusy(false)
  }

  const writable = plan ? plan.counts.questionsToCreate + plan.counts.answersToCreate : 0

  return (
    <div className="central-card mb-5 space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Bulk upload</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground pretty">
            An .xlsx or .csv with the columns <strong>Question, Context, Topics, Answer, Sources,
            Local example, Notes</strong>. Download the template if you haven’t got it.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {/* The line that goes wrong quietly, said out loud and before the file
          picker rather than after it. */}
      <p className="rounded-lg border border-[oklch(0.9_0.03_85)] bg-[oklch(0.985_0.02_85)] p-3 text-[12.5px] leading-relaxed">
        Everything in this file will be posted as <strong>written by you — {uploaderName}</strong>.
        There is no author column. If some of these answers are somebody else’s words, they will
        still show your name against them.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setPlan(null)
            setWritten(null)
            setError(null)
          }}
          className="text-[13px]"
        />
        <Button size="sm" disabled={!file || busy} onClick={() => send('preview')}>
          {busy && !plan ? 'Checking…' : 'Check this file'}
        </Button>
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      {plan && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-[13px]">
            <p className={written ? 'text-muted-foreground' : undefined}>
              {written ? 'This is what the check found before importing: ' : ''}
              <strong className="tabular">{plan.counts.questionsToCreate}</strong> new question
              {plan.counts.questionsToCreate === 1 ? '' : 's'} and{' '}
              <strong className="tabular">{plan.counts.answersToCreate}</strong> new answer
              {plan.counts.answersToCreate === 1 ? '' : 's'} will be created in {plan.communityName}.
            </p>
            {plan.counts.skipped > 0 && (
              <p className="mt-1 text-muted-foreground">
                <span className="tabular">{plan.counts.skipped}</span> row
                {plan.counts.skipped === 1 ? ' is' : 's are'} already in the library — nothing will
                be written for {plan.counts.skipped === 1 ? 'it' : 'them'}.
              </p>
            )}
            {plan.counts.errors > 0 && (
              <p className="mt-1 text-red-700">
                <span className="tabular">{plan.counts.errors}</span> row
                {plan.counts.errors === 1 ? '' : 's'} will not import. The rest still will.
              </p>
            )}
            {plan.topicsToCreate.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                New topics, added to the dropdown: {plan.topicsToCreate.join(', ')}.
              </p>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-muted/60">
                <tr>
                  <th className="px-2.5 py-1.5 font-medium">Row</th>
                  <th className="px-2.5 py-1.5 font-medium">Question</th>
                  <th className="px-2.5 py-1.5 font-medium">Context</th>
                  <th className="px-2.5 py-1.5 font-medium">What happens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plan.rows.map((r) => (
                  <tr key={r.rowNumber} className={r.action === 'error' ? 'bg-red-50/60' : undefined}>
                    <td className="px-2.5 py-1.5 tabular align-top text-muted-foreground">{r.rowNumber}</td>
                    <td className="max-w-[340px] px-2.5 py-1.5 align-top">
                      <span className="pretty">{r.question || <em className="text-muted-foreground">(blank)</em>}</span>
                      {r.topics.length > 0 && (
                        <span className="ml-1 text-muted-foreground">· {r.topics.join(', ')}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 align-top">{r.context || '—'}</td>
                    <td className="px-2.5 py-1.5 align-top">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACTION_CLASS[r.action]}`}>
                        {ACTION_LABEL[r.action]}
                        {r.action !== 'error' && r.hasAnswer && r.action === 'create' ? ' + answer' : ''}
                      </span>
                      {r.errors.map((e, i) => (
                        <p key={i} className="mt-1 text-red-700 pretty">{e}</p>
                      ))}
                      {r.note && <p className="mt-1 text-muted-foreground pretty">{r.note}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!written && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy || writable === 0} onClick={() => send('apply')}>
              {busy
                ? 'Importing…'
                : writable === 0
                  ? 'Nothing to import'
                  : `Import ${writable} ${writable === 1 ? 'row' : 'rows'} under my name`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setPlan(null); setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
              Choose a different file
            </Button>
          </div>
          )}
        </div>
      )}

      {written && (
        <div className="rounded-lg border border-[var(--central-teal-fill-strong)] bg-[var(--central-teal-fill)] p-3 text-[13px]">
          <p>
            Imported: <strong className="tabular">{written.questions}</strong> question
            {written.questions === 1 ? '' : 's'} and{' '}
            <strong className="tabular">{written.answers}</strong> answer
            {written.answers === 1 ? '' : 's'}, under your name.
          </p>
          {plan && plan.counts.errors > 0 && (
            <p className="mt-1 text-red-700">
              <span className="tabular">{plan.counts.errors}</span> row
              {plan.counts.errors === 1 ? ' was' : 's were'} not imported — the reasons are in the
              table above. Fix them in the file and upload it again; the rows that landed will not
              be duplicated.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
