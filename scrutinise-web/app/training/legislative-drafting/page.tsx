import Link from 'next/link'
import PublicNav from '@/components/PublicNav'

export const metadata = {
  title: 'Writing Effective Legislative Drafts — Scrutinise',
}

export default function LegislativeDraftingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/training" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Training
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
          Writing Effective Legislative Drafts
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          For detailed, in-depth guidelines, see the official{' '}
          <a
            href="https://www.gov.uk/government/publications/drafting-bills-for-parliament/2024-03-19-drafting-guidance"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Drafting Guidance from the Office of the Parliamentary Counsel
          </a>
          .
        </p>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Core Principles for Effective Drafting</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li><strong>Use Plain Language:</strong> Simple, modern English rather than archaic language or complex jargon.</li>
            <li><strong>Conciseness:</strong> No more words than necessary to avoid ambiguity.</li>
            <li><strong>Consistency:</strong> The same term for the same concept throughout.</li>
            <li><strong>Precision:</strong> Specific, concrete language stating exactly what is meant, focusing on practical impact.</li>
            <li><strong>Structure:</strong> Organise logically, beginning with the general rule before moving to exceptions.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Key Recommendations by the Institute for Government</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li><strong>Draft Bills:</strong> The government should publish all bills in draft to allow for pre-legislative scrutiny.</li>
            <li><strong>Pre-Legislative Scrutiny:</strong> Giving select committees more power to examine proposals early strengthens quality.</li>
            <li><strong>Menu of Options:</strong> Offering a variety of scrutiny methods to avoid adding significant time to the legislative timetable.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Best Practices in the Drafting Process</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li><strong>User-Focus:</strong> Consider the characteristics of the individuals who will be using the legislation.</li>
            <li><strong>Consultation:</strong> Conduct early, informal consultation to reduce the risk of unintended consequences.</li>
            <li><strong>Clear Policy Instructions:</strong> Drafting should only begin once a detailed, clear policy is finalised.</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
