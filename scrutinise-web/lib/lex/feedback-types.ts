// §20.5 — the shared vocabulary of feedback capture. Kept apart from
// `feedback.ts` because that module talks to the model API and belongs on the
// server only; these constants are needed by the dialog in the browser.

export type FeedbackSurfaceKey = 'BRIEFING' | 'CAUSES' | 'OPTIONS' | 'COSTS' | 'OTHER'

export const FEEDBACK_SURFACES: FeedbackSurfaceKey[] = ['BRIEFING', 'CAUSES', 'OPTIONS', 'COSTS', 'OTHER']

export const SURFACE_LABELS: Record<FeedbackSurfaceKey, string> = {
  BRIEFING: 'The background briefing',
  CAUSES: 'The causes Lex seeded',
  OPTIONS: 'The policy options',
  COSTS: 'The cost figures',
  OTHER: 'Something else',
}
