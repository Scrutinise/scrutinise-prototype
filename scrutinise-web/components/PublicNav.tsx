'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PublicNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight sm:text-xl">
          Scrutinise
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {/* Create at far left of links */}
          <Link href="/prototype/create/stage1" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Create
          </Link>
          <Link href="/prototype/browse" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Browse
          </Link>
          <Link href="/training" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Training
          </Link>
          <Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            About
          </Link>
          {/* Auth buttons — inverse of each other */}
          <Button variant="outline" size="sm" asChild>
            <Link href="/sign-in">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Sign up</Link>
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
              href="/prototype/create/stage1"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Create
            </Link>
            <Link
              href="/prototype/browse"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse
            </Link>
            <Link
              href="/training"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Training
            </Link>
            <Link
              href="/about"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>Sign up</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
