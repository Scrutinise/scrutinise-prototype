"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Menu, X } from "lucide-react"

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
    description: "Add research, develop arguments, first 25 votes",
  },
  {
    number: 4,
    name: "Campaign",
    description: "Public scrutiny, campaign for votes and support",
  },
  {
    number: 5,
    name: "Parliament",
    description: "Government agenda and parliamentary scrutiny",
  },
]

const stats = [
  { value: "12,847", label: "Ideas Created" },
  { value: "2,341", label: "Active Citizens" },
  { value: "47", label: "Bills in Progress" },
]

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight sm:text-xl">
            Scrutinise
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/about"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              About
            </Link>
            <Button size="sm" asChild>
              <Link href="/prototype/create/stage1">
                Get Started
              </Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center p-2 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <Link
                href="/about"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Button size="sm" className="w-full" asChild>
                <Link href="/prototype/create/stage1" onClick={() => setMobileMenuOpen(false)}>
                  Get Started
                </Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="bg-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
                Master legislation. Shape the nation
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty sm:mt-6 sm:text-lg">
                Turn any idea into Parliament-ready law in 5 stages — guided by AI, shaped by citizens, delivered to Parliament.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link href="/prototype/create/stage1">
                    Get Started
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="w-full sm:w-auto"
                >
                  <Link href="/prototype/browse">
                    Vote
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Parliament Video Band */}
        <section className="bg-[#0a0a0f]">
          <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
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

        {/* Research Band */}
        <section className="bg-[#0a0a0f]">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-2xl font-semibold text-white sm:text-3xl">
              We'll handle the research for you
            </h2>
            <div className="relative aspect-video overflow-hidden rounded-lg">
              {/* Charlie to supply video URL — placeholder for now */}
              <div className="flex size-full items-center justify-center bg-zinc-800">
                <p className="text-sm text-gray-400">Video coming soon</p>
              </div>
            </div>
          </div>
        </section>

        {/* Five Stages Section */}
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

        {/* Stats Section */}
        <section className="border-t border-border bg-secondary/50">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="grid grid-cols-3 gap-4 sm:gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-lg">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Democracy should be simple
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
                Complex legislation often excludes ordinary citizens from participating in their
                democracy. Scrutinise breaks down barriers by providing AI guidance, plain language
                explanations, and a clear path from idea to law.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
                Every voice matters. Every idea deserves consideration.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Scrutinise
            </p>
            <nav className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <Link
                href="/about"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                About
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                href="/contact"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
