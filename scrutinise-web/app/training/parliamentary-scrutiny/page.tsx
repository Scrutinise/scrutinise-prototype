import Link from 'next/link'
import PublicNav from '@/components/PublicNav'

export const metadata = {
  title: 'Understanding Parliamentary Scrutiny — Scrutinise',
}

export default function ParliamentaryScrutinyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/training" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Training
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
          Understanding Parliamentary Scrutiny
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Parliamentary scrutiny is the vital process where the UK House of Commons and House of Lords examine,
          challenge, and hold the government accountable for its policies, actions, and spending.
        </p>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Key Aspects of UK Parliamentary Scrutiny</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li><strong>Scrutiny of Legislation:</strong> Parliament reviews draft laws in detail, though many bills face criticism for being rushed, with significant reliance on delegated legislation that often receives limited oversight.</li>
            <li><strong>Select Committees:</strong> Often called the jewels in Westminster's crown, these cross-party committees conduct in-depth inquiries into department policies.</li>
            <li><strong>Questions and Statements:</strong> Parliamentarians use Written and Oral Questions to get answers on the public record, including Prime Minister's Questions.</li>
            <li><strong>Opposition and Backbench Debates:</strong> Non-government time allows for debates on important topics.</li>
            <li><strong>Financial Scrutiny:</strong> Parliament controls taxation and spending through the Budget and Estimates process.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Current Concerns and Future Trends</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            In recent years, observers have raised concerns about the decline of effective scrutiny, pointing to the
            increased use of delegated legislation, the speed of legislation passage, and governments failing to give
            notice of policy changes in Parliament.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold">Key Links</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="https://www.parliament.uk/about/how/role/scrutiny/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Parliament: What is Scrutiny?
              </a>
            </li>
            <li>
              <a href="https://www.ucl.ac.uk/social-historical-sciences/sites/social_historical_sciences/files/parliamentary_scrutiny_briefing_final_clean_1_1.pdf" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">
                UCL Parliamentary Scrutiny Briefing
              </a>
            </li>
            <li>
              <a href="https://commonslibrary.parliament.uk/research-briefings/cbp-10104/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">
                House of Commons Library Research Briefing
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/watch?v=2xnCPecH0rQ" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">
                YouTube: How Parliament Scrutinises
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/watch?v=voHUL9AWcYc" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">
                YouTube: Select Committees Explained
              </a>
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}
