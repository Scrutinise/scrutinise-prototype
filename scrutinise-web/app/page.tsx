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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />

      <main>
        {/* Section 1 — Hero */}
        <section className="bg-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
                Master legislation. Shape the nation
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty sm:mt-6 sm:text-lg">
                Turn any idea into Parliament-ready law in 5 stages.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
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

        {/* Section 2 — Vision and Tool (V2K-C1) */}
        <section className="border-t border-border bg-[#0a0a0f]">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-2xl font-bold text-white sm:text-3xl text-balance">
              Scrutinise is a vision and a tool<br />What will you do with it?
            </h2>
            <div className="mb-8 space-y-3 text-sm leading-relaxed sm:text-base">
              <p className="text-gray-200">
                <span className="font-semibold text-white">The Vision:</span>{" "}
                To empower you to change your world through debate and action instead of the fury of impotence
              </p>
              <p className="text-gray-200">
                <span className="font-semibold text-white">The Tool:</span>{" "}
                Scrutinise helps professionals and amateurs achieve that vision as your personal guide and researcher. We&apos;ll help you:
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-6">
                <p className="text-sm leading-relaxed text-gray-300 sm:text-base">
                  Develop a strong, credible, structured proposal
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-6">
                <p className="text-sm leading-relaxed text-gray-300 sm:text-base">
                  Improve it with private and public scrutiny — aligned with policy to be more effective
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-6">
                <p className="text-sm leading-relaxed text-gray-300 sm:text-base">
                  Identify the right influencers to build the right support to get it accepted into the parliamentary system
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Five Steps */}
        <section className="border-t border-border bg-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="mb-8 sm:mb-10">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground sm:text-sm">
                How it works
              </span>
              <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                The Five Steps
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-5 sm:gap-4 lg:gap-6">
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
          </div>
        </section>

        {/* Section 5 — Parliament video */}
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

        {/* Section 6 — MPs and the road to legislative excellence */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              MPs and the road to legislative excellence
            </h2>
            <ul className="mt-4 space-y-2 sm:mt-6">
              {[
                "Your own team of trained researchers at no cost",
                "Build a policy portfolio that positions you for power",
                "Mentor candidates into legislators-in-waiting",
                "Battle-test and strengthen your policy positions",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 7 — Dark band video — "Quality legislation - open sourced" */}
        <section className="bg-[#0a0a0f]">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-2xl font-semibold text-white sm:text-3xl">
              Quality legislation - open sourced
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

        {/* Section 8 — "If you're serious" (moved to bottom, V2K-C1) */}
        <section className="border-t border-border bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-8 text-center text-xl font-semibold tracking-tight sm:text-2xl">
              If you&apos;re serious about wanting a better-run country
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Scrutinise is a civic technology platform for &lsquo;policy entrepreneurs&rsquo; — legislators, experts and engaged citizens.
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

        {/* Section 4 — Engine of change (moved to bottom, V2K-C3) */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Be the engine of the change you want to see in the world
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-base">
              A &lsquo;policy entrepreneur&rsquo; is someone who identifies a challenge that can be overcome through changes in legislation or government operations and then builds the coalition, the evidence, and the argument to fix it. They don&apos;t wait for permission.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
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
