import PublicNav from '@/components/PublicNav'

export default function About() {
  const paragraphs = [
    `Scrutinise is a not-for-profit, non-partisan platform designed to help turn good ideas into better legislation and stronger public systems. It brings together legislators, experts and engaged citizens to develop, test and refine proposals before they reach the formal parliamentary process.`,

    `The platform makes it easier to research, debate and improve ideas in a structured way. Contributors can build teams, gather evidence, and strengthen proposals through open scrutiny, supported by practical tools and AI guidance. The aim is not to replace Parliament, but to support it with better-prepared, well-considered work.`,

    `By creating a visible track record of serious contribution and constructive debate, Scrutinise encourages higher standards and deeper engagement.`,

    `The focus is simple: improve the quality of ideas, improve the quality of legislation, and in doing so, strengthen democratic practice.`
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
    <PublicNav />
    <main className="py-16 px-4">
      <article className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold tracking-tight text-center mb-12 text-foreground">About Scrutinise</h1>
        <div className="space-y-6 text-lg text-foreground leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i} className="first-letter:text-2xl first-letter:font-bold first-letter:text-primary">
              {p}
            </p>
          ))}
        </div>
      </article>
    </main>
    </div>
  );
}
