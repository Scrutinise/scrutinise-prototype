'use client'

import type { CSSProperties, ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL item 13 — how an approval reads on screen.
//
// ⚠ THE FRAME IS DISTINGUISHED BY BORDER WEIGHT AND ITS LABEL, NOT BY COLOUR.
// Reform UK's #17B9D1 against the platform's live-state teal #14b8a6 measures
// ΔE2000 15.14, hue gap 15°: plainly different side by side, and indistinguishable
// at the size a 1px border and a 10px superscript actually render. A party stamp
// that reads as a platform state would have the platform vouching for material
// it has never seen, so the organisation colour is reinforcement on a 2px frame
// that the platform's own accents never use, and the words carry the meaning.
//
// ⚠ A DO-NOT-USE FLAG TAKES VISUAL PRECEDENCE, ALWAYS. The two coexist in the
// data on purpose — one person's approval does not clear another's flag — but
// the reader must never see "Reform UK approved" as the loudest thing on an
// item an admin has told them not to use.
//
// ⚠ UNAPPROVED IS NEUTRAL, NOT A WARNING. Most material is simply unmarked.
// Grey text, no frame, no icon.
// ─────────────────────────────────────────────────────────────────────────────

export type ApprovalStampView = {
  visible: boolean
  approved: boolean
  organisationName: string | null
  organisationColour: string | null
  markedByName: string | null
  approvedAt: string | Date | null
}

export type FlagView = { level: string; reason: string } | null

function formatDate(value: string | Date | null): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The label on its own, for places with no room for a frame — a list row, a
 * card footer.
 */
export function ApprovalLabel({
  stamp,
  flag,
  className = '',
}: {
  stamp: ApprovalStampView
  flag?: FlagView
  className?: string
}) {
  if (!stamp.visible) return null

  const blocked = flag?.level === 'DO_NOT_USE'

  if (blocked) {
    // The flag speaks first. The approval, if any, is demoted to a trailing
    // clause rather than hidden — hiding it would misrepresent the data.
    return (
      <p className={`text-[11px] font-semibold text-red-700 ${className}`}>
        Do not use — {flag!.reason}
        {stamp.approved && (
          <span className="ml-1 font-normal text-muted-foreground">
            (marked approved by {stamp.markedByName})
          </span>
        )}
      </p>
    )
  }

  if (!stamp.approved) {
    return <p className={`text-[11px] text-muted-foreground ${className}`}>Not approved material</p>
  }

  return (
    <p className={`text-[11px] font-medium ${className}`} style={{ color: stamp.organisationColour ?? undefined }}>
      {stamp.organisationName} approved
      {/* ⚠ THE NAME IS ALWAYS SHOWN, IN EVERY MODE. Under the default mode the
          stamp is the poster's own claim about their own material; rendering an
          unverified self-tick as a bare organisational endorsement would put the
          organisation's name on something it has never seen. */}
      <span className="font-normal text-muted-foreground">
        {' '}— marked by {stamp.markedByName}
        {stamp.approvedAt ? `, ${formatDate(stamp.approvedAt)}` : ''}
      </span>
    </p>
  )
}

/**
 * The framed container: wraps a card or a detail block, adds the superscript at
 * top right, and puts the marked-by line underneath.
 */
export default function ApprovalFrame({
  stamp,
  flag,
  children,
  className = '',
}: {
  stamp: ApprovalStampView
  flag?: FlagView
  children: ReactNode
  className?: string
}) {
  const blocked = flag?.level === 'DO_NOT_USE'
  const framed = stamp.visible && stamp.approved && !blocked

  // 2px is the whole signal. Nothing else in Central draws a 2px border, so the
  // frame is recognisable before the colour is.
  const style: CSSProperties = blocked
    ? { borderWidth: 2, borderColor: 'oklch(0.6 0.2 25)' }
    : framed
      ? { borderWidth: 2, borderColor: stamp.organisationColour ?? 'var(--border)' }
      : {}

  return (
    <div className={`relative rounded-xl border border-border ${className}`} style={style}>
      {blocked ? (
        <span className="absolute -top-2 right-3 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Do not use
        </span>
      ) : framed ? (
        <span
          className="absolute -top-2 right-3 rounded bg-background px-1.5 text-[10px] font-semibold"
          style={{ color: stamp.organisationColour ?? undefined }}
        >
          {stamp.organisationName} approved
        </span>
      ) : null}
      {children}
      <div className="px-3 pb-2">
        <ApprovalLabel stamp={stamp} flag={flag} />
      </div>
    </div>
  )
}

/**
 * The tick itself. Rendered only where the viewer may actually approve — the
 * mode decides that on the server, and `canApprove` is what it decided.
 */
export function ApprovalCheckbox({
  stamp,
  canApprove,
  busy,
  onChange,
}: {
  stamp: ApprovalStampView
  canApprove: boolean
  busy?: boolean
  onChange: (approved: boolean) => void
}) {
  if (!stamp.visible || !canApprove) return null
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={stamp.approved}
        disabled={busy}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-border"
      />
      <span>Approved by {stamp.organisationName}</span>
    </label>
  )
}

/**
 * Item 13's Context box. PERMANENT — it is never hidden by the approval
 * setting, because it says how to use the material, not who vouches for it.
 *
 * ⚠ A PLACEHOLDER, NOT PRE-FILLED CONTENT. Pre-filled text is submitted
 * verbatim by everyone who ignores it, and the library fills with rows that
 * literally read "When / Where / How to be used".
 */
export function ContextField({
  value,
  onChange,
  id = 'context',
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  rows?: number
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium">
        Context
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={4000}
        placeholder="When / Where / How to be used"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
      />
    </div>
  )
}

/** The read-only rendering of a saved Context note. */
export function ContextNote({ context, className = '' }: { context: string | null; className?: string }) {
  if (!context?.trim()) return null
  return (
    <p className={`text-[13px] text-muted-foreground pretty ${className}`}>
      <span className="font-medium text-foreground">Context: </span>
      {context}
    </p>
  )
}
