'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2i item 3 — one file picker, so two screens cannot drift apart.
//
// ⚠ THIS EXISTS BECAUSE THEY ALREADY HAD. Stage 2e specified a primary button
// with the filename on its own line, and the bulk-upload screen got it. The
// resource form, written two sprints later, used a bare `<input type="file">` —
// so Charlie saw "Choose File Reform UK temporary brand guidelines.pdf" run
// together on one line in the native control. A specification applied to one
// screen is a specification the next screen does not inherit; a component is.
//
// ⚠ THE NATIVE CONTROL IS HIDDEN, NOT RESTYLED. `input[type=file]` cannot be
// styled across browsers — the button half is drawn by the OS. `sr-only` keeps
// it in the accessibility tree and reachable by keyboard while a real Button
// drives it, which is the only approach that looks the same everywhere.
// ─────────────────────────────────────────────────────────────────────────────

export default function FilePicker({
  id,
  accept,
  file,
  onSelect,
  label = 'Choose file',
  disabled,
  hint,
  children,
}: {
  /** Must be unique on the page — two pickers sharing an id break both labels. */
  id: string
  accept?: string
  file: File | null
  onSelect: (file: File | null) => void
  label?: string
  disabled?: boolean
  /** A line under the control, e.g. what formats are accepted. */
  hint?: string
  /** Actions that sit on the same row as the button. */
  children?: React.ReactNode
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div>
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={disabled} onClick={() => ref.current?.click()}>
          {label}
        </Button>
        {children}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground pretty">{hint}</p>}
      {/* ⚠ THE FILENAME GOES ON ITS OWN LINE, under a label. A long filename
          beside the button wraps into it and the two read as one string. */}
      {file && (
        <p className="mt-2 text-[12.5px]">
          <span className="text-muted-foreground">File selected</span>
          <br />
          <span className="font-medium break-all">{file.name}</span>
          <span className="tabular ml-2 whitespace-nowrap text-muted-foreground">
            {file.size < 1024 * 1024
              ? `${(file.size / 1024).toFixed(0)} KB`
              : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
          </span>
        </p>
      )}
    </div>
  )
}
