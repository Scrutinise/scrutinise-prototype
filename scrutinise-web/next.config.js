/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

/**
 * ⚠⚠ PRINCIPLE 7 — the paths that can carry judgment text are served `noindex, nofollow` as an
 * HTTP HEADER as well as an HTML meta tag.
 *
 * Both, because a crawler may read either and ignore the other — and because the JSON routes below
 * have no HTML to put a meta tag in. `/api/ideas/:id/research` is a PUBLIC read for LINK_ONLY and
 * PLATFORM_LISTED ideas (middleware.ts lists it, and the route re-checks), so it is the endpoint
 * that would serve a judgment extract to an anonymous client, meta tag or no meta tag.
 *
 * ⚠ THIS IS THE CONTROL THAT SURVIVES A ROBOTS.TXT DISALLOW. A disallowed path is not fetched, so
 * a crawler never sees the noindex; a crawler that ignores robots.txt and fetches anyway DOES see
 * this header. The two directives cover opposite failure modes and neither replaces the other.
 *
 * ⚠ IT DOES NOT TOUCH LEX'S OWN RETRIEVAL. Search over the corpus — the licensed activity — runs
 * server-side against fts-serve / vector-serve and reads no HTTP header of ours.
 *
 * Verified by reading the headers back off production; see `docs/PRINCIPLE_7_EVIDENCE.md`.
 */
const NOINDEX_PATHS = [
  '/ideas/:path*',                     // every idea page — the surface that can carry an extract
  '/api/ideas/:path*',                 // incl. the public /research and /contributions reads
  '/api/legislation/:path*',           // public corpus reads (test-sections serves full section text)
  '/api/search/:path*',
  '/legislation/:path*',               // public legislation browse — corpus text, same reasoning
  '/legislation-compare/:path*',
  '/demo/:path*',
  '/general/:path*',                   // the unauthenticated Lex surfaces
]

const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      ...NOINDEX_PATHS.map((source) => ({
        source,
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      })),
    ]
  },
  async redirects() {
    return [
      {
        source: '/training',
        destination: '/support',
        permanent: true,
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'scrutinise',
  project: 'scrutinise-web',
})
