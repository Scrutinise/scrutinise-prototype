import PublicNav from '@/components/PublicNav'

export const metadata = {
  title: 'Terms of Service — Scrutinise',
}

const sections = [
  {
    heading: '1. About this document',
    body: `These Terms of Service govern your use of the Scrutinise platform ("the Platform"), operated by Scrutinise CIC ("we", "us", "our"). By creating an account or using the Platform you agree to these terms. This document is currently in draft form and is pending review by our legal advisers. The finalised terms will be published before the Platform opens to the general public.`,
  },
  {
    heading: '2. Eligibility',
    body: `You must be at least 18 years old to register for an account on the Platform. By confirming your age during registration you warrant that this is true. We reserve the right to close accounts where this condition is found not to have been met.`,
  },
  {
    heading: '3. Your account',
    body: `You are responsible for keeping your login credentials confidential and for all activity that occurs under your account. You must notify us immediately at hello@scrutinise.org if you suspect unauthorised access. We may suspend or terminate accounts that breach these terms or our Community Rules.`,
  },
  {
    heading: '4. Content you contribute',
    body: `You retain ownership of any ideas, text, research, or other content you submit to the Platform. By submitting content you grant us a non-exclusive, royalty-free licence to store, display, and facilitate the collaborative development of that content as part of the Platform's core function. You warrant that your content does not infringe the intellectual property rights of any third party.`,
  },
  {
    heading: '5. Acceptable use',
    body: `You agree not to use the Platform to publish content that is unlawful, defamatory, harassing, or incites hatred or violence; to attempt to gain unauthorised access to other users' accounts or the Platform's systems; to scrape, copy, or redistribute Platform content for commercial purposes without our written consent; or to misrepresent your identity or credentials.`,
  },
  {
    heading: '6. AI-assisted features',
    body: `The Platform provides an AI research and drafting assistant called Lex, powered by third-party AI services. Lex is a tool to support your thinking — it does not provide legal advice, and nothing it produces should be relied upon as a substitute for professional legal or policy counsel. You are responsible for reviewing and verifying any content Lex produces before acting on it.`,
  },
  {
    heading: '7. Limitation of liability',
    body: `To the maximum extent permitted by applicable law, Scrutinise CIC is not liable for any indirect, incidental, or consequential losses arising from your use of the Platform, including losses arising from errors in AI-generated content, platform downtime, or the actions of other users. Nothing in these terms limits our liability for death or personal injury caused by our negligence, or for fraud or fraudulent misrepresentation.`,
  },
  {
    heading: '8. Changes to these terms',
    body: `We may update these terms from time to time. We will notify registered users by email before any material changes take effect. Continued use of the Platform after changes are published constitutes acceptance of the revised terms.`,
  },
  {
    heading: '9. Governing law',
    body: `These terms are governed by the law of England and Wales. Any disputes arising from your use of the Platform are subject to the exclusive jurisdiction of the courts of England and Wales.`,
  },
  {
    heading: '10. Contact',
    body: `For any questions about these terms please contact us at hello@scrutinise.org.`,
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Draft — pending legal review.</strong> These terms are a working draft and have not yet been reviewed by a solicitor. They will be finalised before the Platform opens to the general public.
        </div>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2026 (draft)</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold">{section.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
