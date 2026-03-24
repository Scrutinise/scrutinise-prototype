"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import PublicNav from "@/components/PublicNav"

const stages = [
  {
    number: 1,
    name: "Create",
    description: "Define your idea with AI guidance from Lex",
  },
  {
    number: 2,
    name: "Draft",
    description: "Build out your idea with a small trusted team",
  },
  {
    number: 3,
    name: "Develop",
    description: "Add research, develop arguments, open to referral-link scrutiny",
  },
  {
    number: 4,
    name: "Campaign",
    description: "Public scrutiny, campaign for votes and support",
  },
  {
    number: 5,
    name: "Legislate",
    description: "Government agenda and parliamentary scrutiny",
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
                  <Link href="/prototype/create/stage1">
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

        {/* Section 2 — Five Steps */}
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

        {/* Section 3 — Parliament video (full-width, no padding, no text) */}
        <div className="w-full">
          <video
            src="https://pub-74d3bbbcb050497b8a69f8c0045bb893.r2.dev/Grok_Parliament_Ready_video.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full object-cover"
          />
        </div>

        {/* Section 4 — MPs and the road to legislative excellence */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              MPs and the road to legislative excellence
            </h2>
            <ul className="mt-4 space-y-2 sm:mt-6">
              {[
                "Build a policy portfolio that positions you for power",
                "Your own team of trained researchers at no cost",
                "Mentor candidates into legislators-in-waiting",
                "Battle-test and strengthen your policy positions",
                "Reclaim control from the bureaucracy",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 5 — Three card row */}
        <section className="border-t border-border bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-8 text-center text-xl font-semibold tracking-tight sm:text-2xl">
              If you&apos;re serious about wanting better legislation
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Scrutinise is a civic technology platform for &lsquo;policy entrepreneurs&rsquo; — legislators, experts and engaged citizens.
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Develop, test and refine your good ideas into better legislation and stronger public systems.
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

        {/* Section 6 — Engine of change */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Be the engine of the change you want to see in the world
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-base">
              A &lsquo;policy entrepreneur&rsquo; is someone who identifies a challenge that can be overcome through changes in legislation or government operations and then builds the coalition, the evidence, and the argument to fix it. They don&apos;t wait for permission.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:mt-5 sm:text-base">
              By taking responsibility for bringing about that change, you become the engine of that change. Own the achievement and the consequences — make sure you work out the costs and the risks, for that change has your name on it.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:mt-5 sm:text-base">
              This platform is here to support you with guidance, research, and specialist AI for policy development. Over time, we will build a community to carefully scrutinise and improve those ideas in a structured way, delivering Parliament-ready draft legislation.
            </p>
          </div>
        </section>

        {/* Section 7 — Dark band parliament video — "Quality legislation - open sourced" */}
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
