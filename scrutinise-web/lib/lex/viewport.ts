// ─────────────────────────────────────────────────────────────────────────────
// LEX Z1c — THE VIEWPORT FOR LEX'S PAGE (/ideas/create), set as the route's own `viewport` export so the site-wide root layout (Central's)
// is untouched.
//
// ⚠ viewport-fit=cover. Without it, iOS (every iPhone browser is WebKit, Edge included) keeps the page out of the screen's bottom inset and
//   `env(safe-area-inset-bottom)` is ALWAYS 0, so the bottom bar's safe-area padding (Z1b) never did anything on an iPhone. With it, the page
//   runs to the screen's edge and the bar pads itself clear of the home indicator. Charlie's iPhone is the test: Chromium applies an emulated
//   inset whether or not this is set, so no browser check here can tell the two apart.
// ─────────────────────────────────────────────────────────────────────────────

import type { Viewport } from 'next'

export const LEX_VIEWPORT = { width: 'device-width', initialScale: 1, viewportFit: 'cover' } as const satisfies Viewport

/** The same, as the <meta name="viewport"> content Next writes for it (the harness serves this). */
export const LEX_VIEWPORT_META = `width=${LEX_VIEWPORT.width}, initial-scale=${LEX_VIEWPORT.initialScale}, viewport-fit=${LEX_VIEWPORT.viewportFit}`

/** `?where-debug=1` — the bottom bar's numbers, printed on the screen, for a screenshot from a phone the checks cannot run on. */
export const WHERE_DEBUG_PARAM = 'where-debug'
