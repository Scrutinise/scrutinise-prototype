// 26-S decision 154 — the feedback admin list: the lifecycle and the words for it. NO IMPORTS (a client component reads this).
// Same shape as `Feedback` (NEW | TRIAGED | RESOLVED | WONTFIX), shown in the words Charlie asked for. A glyph beside each word so no
// state is colour alone (docs/CLAUDE.md §21).

export const FEEDBACK_STATUSES = ['NEW', 'TRIAGED', 'RESOLVED', 'WONTFIX'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const FEEDBACK_STATUS_UI: Record<FeedbackStatus, { word: string; glyph: string }> = {
  NEW: { word: 'New', glyph: '●' },
  TRIAGED: { word: 'Looked at', glyph: '◐' },
  RESOLVED: { word: 'Fixed', glyph: '✓' },
  WONTFIX: { word: 'Not doing', glyph: '✗' },
}

export const FEEDBACK_NOTES_MAX = 4000

export interface FeedbackItemRow {
  id: string
  createdAt: string
  /** "User 435" — the stable pseudonymous number (decision 137); never a name. */
  userRef: string
  ideaTitle: string
  stage: string
  surface: string
  isBugReport: boolean
  originalText: string
  summarisedText: string
  userEdited: boolean
  /** Verbatim for a bug report: the error shown, the control pressed, the request. Null otherwise. */
  technicalDetail: unknown
  attachments: Array<{ name: string; contentType: string; bytes: number }>
  sentAt: string | null
  sendError: string | null
  status: FeedbackStatus
  adminNotes: string
  statusChangedAt: string | null
}
