import PublicNav from '@/components/PublicNav'

export const metadata = {
  title: 'Community Rules — Scrutinise',
}

const rules = [
  {
    heading: '1. Purpose of the community',
    body: `Scrutinise exists to help citizens, policy professionals, and elected representatives develop better legislation. Every rule below follows from that purpose. When in doubt, ask yourself whether what you are about to do makes the Platform more or less useful for that goal.`,
  },
  {
    heading: '2. Be substantive',
    body: `Contributions should add real value. Challenge the evidence, the logic, or the wording — not the person. Scrutiny means finding genuine weaknesses and helping to fix them, not scoring points or winning arguments. Shallow or bad-faith contributions waste everyone's time and damage the credibility of ideas you touch.`,
  },
  {
    heading: '3. Be honest about who you are',
    body: `Do not misrepresent your professional background, credentials, or institutional affiliation. Your Credibility Score depends on accurate self-representation. Verified credentials carry greater weight on the Platform — do not claim credentials you do not hold.`,
  },
  {
    heading: '4. Respect confidentiality in early stages',
    body: `Ideas at Stage 1 and Stage 2 are private by design. Do not share, republish, or discuss the content of another person's early-stage idea outside the Platform without their explicit permission.`,
  },
  {
    heading: '5. No abuse, harassment, or hate',
    body: `Treat every participant with the same respect you would expect in a professional policy environment. Personal attacks, harassment, discriminatory language, and content that incites hatred or violence are not permitted and will result in immediate account suspension.`,
  },
  {
    heading: '6. No spam or self-promotion',
    body: `Do not use the Platform to advertise, solicit, or promote commercial services. Do not submit duplicate or near-identical ideas to game rankings. Do not use automated tools or bots to interact with the Platform.`,
  },
  {
    heading: '7. Disclose conflicts of interest',
    body: `If you have a financial, professional, or personal interest in the outcome of an idea you are contributing to, disclose it. The Platform's credibility depends on transparent scrutiny. Undisclosed conflicts of interest, when discovered, may result in contributions being removed and Credibility Score penalties.`,
  },
  {
    heading: '8. Source your evidence',
    body: `When adding Research contributions, link to or cite the original source. Do not fabricate citations or pass off secondary summaries as primary evidence. AI-generated research must be verified against authoritative sources before it is submitted.`,
  },
  {
    heading: '9. Accept the outcome of scrutiny',
    body: `The platform's structured process may surface weaknesses in your idea that are uncomfortable. That is the point. Respond constructively or acknowledge the criticism. Do not delete or misrepresent contributions from others to protect your own idea's standing.`,
  },
  {
    heading: '10. Follow the law',
    body: `Do not use the Platform to publish content that is unlawful, defamatory, or infringes another party's intellectual property. Do not propose illegal activity. Policy ideas that involve reform of existing law must be clearly framed as such.`,
  },
  {
    heading: '11. Enforcement',
    body: `Violations of these rules may result in a warning, contribution removal, temporary suspension, or permanent account closure depending on severity. Decisions are made by Platform administrators and are final. You may contact us at hello@scrutinise.org to appeal a moderation decision.`,
  },
]

export default function CommunityRulesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Draft — pending legal review.</strong> These rules are a working draft and have not yet been reviewed by a solicitor. They will be finalised before the Platform opens to the general public.
        </div>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Community Rules</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2026 (draft)</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          These rules apply to everyone who uses Scrutinise — citizens, policy professionals, elected representatives, and administrators alike. They exist to protect the integrity of the Platform and the people who use it in good faith.
        </p>

        <div className="mt-10 space-y-8">
          {rules.map((rule) => (
            <section key={rule.heading}>
              <h2 className="text-base font-semibold">{rule.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {rule.body}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
