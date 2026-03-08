import Link from 'next/link'

const journeys = [
  {
    num: 1,
    title: 'Create an idea with Lex',
    desc: 'Walk through the Lex-guided ideation flow — from a rough idea to a structured proposal.',
    href: '/prototype/create/stage1',
    accent: 'border-blue-500 hover:bg-blue-950/30',
  },
  {
    num: 2,
    title: 'Browse and vote on ideas',
    desc: 'Explore the idea browser, filter by topic, and cast a weighted vote.',
    href: '/prototype/browse',
    accent: 'border-purple-500 hover:bg-purple-950/30',
  },
  {
    num: 3,
    title: 'Review an incoming amendment',
    desc: 'See how an idea owner reviews and responds to a proposed change to their Coherent Action.',
    href: '/prototype/dashboard',
    accent: 'border-amber-500 hover:bg-amber-950/30',
  },
  {
    num: 4,
    title: 'Navigate the summary panel',
    desc: 'Experience how your proposal builds in real-time as you talk with Lex.',
    href: '/prototype/create/stage2',
    accent: 'border-green-500 hover:bg-green-950/30',
  },
  {
    num: 5,
    title: 'Moderate flagged content',
    desc: 'Review the admin moderation queue and take action on a reported comment.',
    href: '/prototype/admin',
    accent: 'border-red-500 hover:bg-red-950/30',
  },
]

export default function PrototypePage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <div className="mb-12 text-center">
        <div className="inline-block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 px-3 py-1 border border-gray-700 rounded-full">
          Interactive Prototype
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Scrutinise</h1>
        <p className="text-gray-400 text-lg">Explore the five core user journeys. No account needed.</p>
        <p className="mt-2 text-sm text-gray-600">All data is fictional. Actions do not persist.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {journeys.map(j => (
          <Link
            key={j.num}
            href={j.href}
            className={`block p-6 bg-gray-900 border-2 ${j.accent} rounded-xl transition-colors group`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl font-bold text-gray-700 group-hover:text-gray-500 transition-colors leading-none mt-0.5">
                {j.num}
              </span>
              <div>
                <h2 className="text-white font-semibold mb-1.5">{j.title}</h2>
                <p className="text-gray-400 text-sm leading-relaxed">{j.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
          &#8592; Back to scrutinise.org
        </Link>
      </div>
    </main>
  )
}
