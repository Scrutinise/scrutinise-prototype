// §20.5 — the shared vocabulary of feedback capture. Kept apart from
// `feedback.ts` because that module talks to the model API and belongs on the
// server only; these constants are needed by the dialog in the browser.

export type FeedbackSurfaceKey = 'BRIEFING' | 'CAUSES' | 'OPTIONS' | 'COSTS' | 'OTHER' | 'BUG_REPORT'

// BUG_REPORT is listed first: a fault in the screen is the thing a user is least likely to find a heading for, and the form
// used to offer only "what Lex got wrong" (Charlie, 8 Oct — the fault was the interface's).
export const FEEDBACK_SURFACES: FeedbackSurfaceKey[] = ['BUG_REPORT', 'BRIEFING', 'CAUSES', 'OPTIONS', 'COSTS', 'OTHER']

export const SURFACE_LABELS: Record<FeedbackSurfaceKey, string> = {
  BUG_REPORT: 'Bug / error report — something on the screen did not work',
  BRIEFING: 'The background briefing',
  CAUSES: 'The causes Lex seeded',
  OPTIONS: 'The policy options',
  COSTS: 'The cost figures',
  OTHER: 'Something else',
}

/** Files that may travel with a report. Images and plain documents only — nothing executable. */
export const FEEDBACK_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv', 'application/json'] as const
export const FEEDBACK_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const FEEDBACK_ATTACHMENT_MAX_FILES = 3

export interface FeedbackAttachment {
  /** R2 key — `_feedback/<ideaId>/<userId>/<uuid>-<name>`. The bytes are there; the row holds only the key. */
  key: string
  name: string
  contentType: string
  bytes: number
}

/** DECISION 137 — how a person is named in feedback. A number the database assigned; never a name or an initial. */
export const userRefLabel = (n: number | null | undefined): string => (n ? `User ${n}` : 'A user')
