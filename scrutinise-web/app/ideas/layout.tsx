import type { Metadata } from 'next'

/**
 * ⚠⚠ PRINCIPLE 7 — the whole `/ideas` tree is `noindex, nofollow`.
 *
 * The National Archives' computational analysis licence forbids indexing the contents of judgments
 * and decisions on search engines. There is no judgment page on this site: judgment text reaches a
 * reader only as a short Lex-written extract inside an idea. So the idea tree is the surface that
 * rule is about — the list, the detail page, and every route under them.
 *
 * ⚠ THIS LAYOUT EXISTS ONLY FOR THIS. It renders `children` untouched, adds no markup and no
 * styling, and must not acquire any: a layout with a job is a layout somebody edits, and the
 * metadata below is a compliance control rather than a presentation choice.
 *
 * ⚠ A page's own `generateMetadata` OVERRIDES this if it sets `robots`. `app/ideas/[id]/page.tsx`
 * sets it too, deliberately and identically — belt and braces, because that page is the one that
 * can actually carry an extract, and metadata inheritance is exactly the kind of thing that gets
 * changed by accident during an unrelated edit.
 *
 * Paired with `X-Robots-Tag` in `next.config.js` and `Disallow` in `public/robots.txt`, because a
 * crawler may honour any one of the three and ignore the others.
 * Evidence, read off production: `docs/PRINCIPLE_7_EVIDENCE.md`.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function IdeasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
