'use client'

// 26-C ADDENDUM 3 §23 — "YOUR IDEAS", ALONE. The page furniture around the library that
// used to live in the right-hand column of the "mixed page" (`/ideas/build`).

import PublicNav from '@/components/PublicNav'
import MyIdeasList, { type MyIdea } from '@/components/lex/MyIdeasList'

export default function YourIdeasClient({ recent, deleted }: { recent: MyIdea[]; deleted: MyIdea[] }) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PublicNav />

      {/* §15a — Exit and "How this works" have no obvious job on a page that IS a primary
          nav destination (not a flow you "exit"), so neither is carried over here. */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          {/* ⚠ 25-J §1 — first person on a collections heading, never "Your ideas" (this
              file's own name and the brief's "Your ideas" are the page's internal name,
              not what renders). */}
          <h1 className="text-lg font-semibold text-zinc-900">My ideas</h1>
          {/* §23b — the prominent button to the other page. Never greyed out here: a
              new idea is always startable, whether or not any exist yet. */}
          <a
            href="/ideas/build"
            className="text-sm font-semibold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            New idea
          </a>
        </div>
        <MyIdeasList ideas={recent} deletedIdeas={deleted} hiddenEmpty={0} />
      </div>
    </div>
  )
}
