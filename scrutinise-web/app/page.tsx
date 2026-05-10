"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import PublicNav from "@/components/PublicNav"

const stages: { number: number; name: string; description: React.ReactNode }[] = [
  {
    number: 1,
    name: "Create",
    description: <>Define your idea with<br />AI guidance from Lex</>,
  },
  {
    number: 2,
    name: "Draft",
    description: <>Build out your idea with<br />a small trusted team</>,
  },
  {
    number: 3,
    name: "Develop",
    description: "Develop arguments through public scrutiny",
  },
  {
    number: 4,
    name: "Campaign",
    description: <>Campaign for votes<br />and support</>,
  },
  {
    number: 5,
    name: "Legislate",
    description: <>The Parliamentary<br />Process</>,
  },
]

const navButtons = [
  { label: "What is it?",       href: "#what-is-it"       },
  { label: "Who is it for?",    href: "#who-is-it-for"    },
  { label: "How does it work?", href: "#how-does-it-work" },
  { label: "Is this you?",      href: "#is-this-you"      },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />

      <main>
        {/* Block 1 — Hero */}
        <section className="bg-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">

            {/* Text content — constrained width */}
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
                Shape the Nation
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty sm:mt-6 sm:text-lg">
                Scrutinise is a tool and collaboration platform for those committed to transforming how our countries are governed. A platform designed to support a Movement: individuals challenging the inertia of entrenched systems, working to create laws and policies that truly serve the people.
              </p>
              <p className="mt-4 text-base font-semibold text-foreground sm:mt-5 sm:text-lg">
                How will you use it?
              </p>

              {/* Four navigation buttons */}
              <div className="mt-5 flex flex-wrap gap-3">
                {navButtons.map(({ label, href }) => (
                  <Button key={href} variant="outline" asChild>
                    <a href={href}>{label}</a>
                  </Button>
                ))}
              </div>
            </div>

            {/* Five Steps graphic — full width within max-w-5xl */}
            <div className="mt-12 grid gap-6 sm:grid-cols-5 sm:gap-4 lg:gap-6">
              {stages.map((stage) => (
                <div
                  key={stage.number}
                  className="flex items-start gap-4 sm:flex-col sm:gap-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground sm:size-11">
                    {stage.number}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold">{stage.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Relocated subtitle and primary CTAs */}
            <div className="mt-8">
              <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                Turn any idea into Parliament-ready law in 5 stages.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link href="/ideas/create">
                    Get Started
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                  <Link href="/prototype/browse">Vote</Link>
                </Button>
              </div>
            </div>

          </div>
        </section>

        {/* Block 2 — Quality legislation — open sourced (moved up) */}
        <section className="bg-[#0a0a0f]">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-2xl font-semibold text-white sm:text-3xl">
              Quality legislation &#8212; open sourced
            </h2>
            <div className="relative aspect-video overflow-hidden rounded-lg">
              <video
                autoPlay
                muted
                loop
                playsInline
                className="size-full object-cover"
              >
                <source src="https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4" type="video/mp4" />
              </video>
            </div>
            <p className="mt-4 text-center text-sm text-gray-400">
              Citizens crafting legislation, one idea at a time
            </p>
          </div>
        </section>

        {/* Block 3 — What is it? */}
        <section id="what-is-it" className="border-t border-border bg-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">
              What is it?
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p>
                Legislation is how the country actually changes. But even for MPs, the process can be opaque and challenging.
              </p>
              <p>
                Scrutinise is an AI-guided workspace that takes you through the process step by step. Lex, our AI guide and researcher, helps you think clearly, find the right evidence, sharpen your argument, and identify the legislation that needs to change.
              </p>
              <p>
                What you get at the end is a proposal that&apos;s been properly thought through, scrutinised, and ready to put into the hands of those in Parliament who can help take it forward. What happens there is their job. Getting it there in a form they can trust is ours.
              </p>
            </div>
          </div>
        </section>

        {/* Block 4 — Who is it for? */}
        <section id="who-is-it-for" className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">
              Who is it for?
            </h2>
            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p>
                This is for the committed few &#8212; thought leaders, parliamentarians, and those passionate enough to act &#8212; who believe change is possible and are ready to engage deeply with the complexities of governance to make a lasting impact&#8230; who believe in duty and putting quality before &lsquo;clicks&rsquo;.
              </p>
              <div>
                <p>
                  <strong className="text-foreground">For MPs and their teams:</strong>{" "}
                  a structured workspace to develop policy, co-ordinate candidates, councillors, and outside experts, and build a pipeline of Parliament-ready proposals &#8212; with a central view of everything in flight.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    "Your own team of trained researchers at no cost",
                    "Build a policy portfolio that positions you for power",
                    "Mentor candidates into legislators-in-waiting",
                    "Battle-test and strengthen your policy positions",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p>
                <strong className="text-foreground">For policy entrepreneurs and experts:</strong>{" "}
                an AI guide through a process most people never see inside, that helps you structure a credible proposal and connect with others who can scrutinise and strengthen it.
              </p>
            </div>
          </div>
        </section>

        {/* Block 5 — How does it work? */}
        <section id="how-does-it-work" className="border-t border-border bg-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">
              How does it work?
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p>
                This is a human&#8211;AI partnership by design. Our goal is to make meaningful change faster, smarter, and more accessible &#8212; amplifying the collective power of those dedicated to high-quality governance.
              </p>
              <p>
                The AI does the structural work &#8212; research, drafting, finding the relevant legislation, organising the argument, checking for logical and evidential flaws. That&apos;s the part that used to take weeks and now takes hours.
              </p>
              <p>
                The scrutiny is human. Every serious proposal needs people with real experience to pressure-test it &#8212; to catch the dumb thing before it becomes law, to bring the perspective the AI can&apos;t.
              </p>
              <p>
                Scrutinise lets you build your own network of people you trust to scrutinise your work privately, and as the platform grows, those networks help each other. The goal is to fix, earlier, what most of our bad laws have in common: not enough people who knew what they were talking about looked at them hard enough, soon enough.
              </p>
              <p>
                This platform alone won&apos;t turn a weak idea into a strong one. But if you have something worth saying, it will help you say it properly &#8212; and put it somewhere it can be found, scrutinised, and backed.
              </p>
            </div>
          </div>
        </section>

        {/* Block 6 — Stay calm and move quickly through the chaos */}
        <section className="border-t border-border bg-gray-50">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
              Stay calm and move quickly through the chaos
            </h2>
            <video
              src="https://pub-74d3bbbcb050497b8a69f8c0045bb893.r2.dev/Grok_Parliament_Ready_video.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full object-cover"
            />
          </div>
        </section>

        {/* Block 7 — Is this you? */}
        <section id="is-this-you" className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Is this you?
            </h2>
            <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Be the engine of the change you want to see in the world
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-base">
              A &lsquo;policy entrepreneur&rsquo; is someone who identifies a challenge that can be overcome through changes in legislation or government operations and then builds the coalition, the evidence, and the argument to fix it. They don&apos;t wait for permission.
            </p>
          </div>
        </section>

        {/* Block 8 — If you're serious about wanting a better-run country */}
        <section className="border-t border-border bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-8 text-center text-xl font-semibold tracking-tight sm:text-2xl">
              If you&apos;re serious about wanting a better-run country
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Scrutinise is a civic technology platform for &lsquo;policy entrepreneurs&rsquo; &#8212; legislators, experts and engaged citizens.
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Develop, test and refine your good ideas to help build better legislation and stronger public systems.
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  We are building an online community around craft, expertise and a common interest in better quality laws and government.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer — unchanged */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">Scrutinise</p>
            <nav className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                About
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Terms
              </Link>
              <Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
