// ─────────────────────────────────────────────────────────────────────────────
// LEX Z2 §6.4 (decisions 363, 364 and 366) — THE WEB APP MANIFEST: "Add to Home Screen" opens Scrutinise at My ideas, full screen.
// Next serves this at /manifest.webmanifest and links it from every page (Central's included: CCh tells Central, 0140Z).
// The icons are the Scrutinise mark Charlie chose (366, option C, 22 Nov): scales whose post is a Roman capital S (Cinzel, SIL OFL,
// as outlines), #F3ECDD on #12302E. The maskable one keeps the mark inside the central safe zone. ⚠ The files as sent carried a C2PA
// stamp (an SVG <metadata> block, a PNG caBX chunk) that misdescribes CCh's own drawing; it is stripped (pixels identical). A more
// ornate S, if Charlie asks, is a swap of the same file names.
// ⚠ scope is "/" (the whole site), not the worker's /ideas/: sign-in and the site's other pages stay inside the installed app rather than
//   throwing the reader out to a browser tab. The offline worker is still scoped to /ideas/ only (361).
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from 'next'

export const LEX_APP_COLOURS = { background: '#12302E', mark: '#F3ECDD' } as const

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Scrutinise',
    short_name: 'Scrutinise',
    description: 'Develop a policy idea with Lex, and see it scrutinised.',
    start_url: '/ideas/mine',
    scope: '/',
    display: 'standalone',
    background_color: LEX_APP_COLOURS.background,
    theme_color: LEX_APP_COLOURS.background,
    icons: [
      { src: '/icons/scrutinise-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/scrutinise-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/scrutinise-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/scrutinise-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
