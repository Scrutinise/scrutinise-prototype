'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUser, useClerk } from '@clerk/nextjs'

/**
 * CENTRAL Stage 2i item 1 — the avatar menu.
 *
 * ⚠ THERE WAS NO AVATAR MENU. The avatar was a bare `<Link href="/dashboard">`,
 * so `/settings` — which holds the phone number, the experience level and, as of
 * 2h, the platform accent — was reachable from exactly ONE place in the whole
 * app: an inline sentence inside the Training exchange, shown only when you have
 * no phone number saved. The page had existed for sprints; nothing pointed at it.
 * That is why Charlie could not find the accent picker, and it was never going to
 * be found by looking harder.
 */
function AccountMenu({
  user,
  onSignOut,
}: {
  user: NonNullable<ReturnType<typeof useUser>['user']>
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on an outside click and on Escape — a menu that only closes by
  // re-clicking the trigger traps the pointer on touch.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        className="flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
      >
        <Avatar user={user} />
        <span aria-hidden className="text-[10px] text-muted-foreground">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        >
          <p className="truncate border-b border-border px-3 py-2 text-xs text-muted-foreground">
            {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? 'Signed in'}
          </p>
          <Link
            href="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-muted"
          >
            Your dashboard
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-muted"
          >
            Account settings
            {/* Named so somebody looking for the accent picker has a reason to
                click, rather than having to guess that "settings" includes it. */}
            <span className="block text-[11px] text-muted-foreground">
              Platform accent, phone, your data
            </span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
            className="block w-full border-t border-border px-3 py-2 text-left text-sm hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function Avatar({ user }: { user: NonNullable<ReturnType<typeof useUser>['user']> }) {
  const initials =
    (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '') || '?'

  if (user.hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.imageUrl}
        alt={user.fullName ?? 'Profile'}
        width={32}
        height={32}
        className="size-8 rounded-full object-cover"
      />
    )
  }

  return (
    <span
      className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: '#1a7a6e' }}
    >
      {initials.toUpperCase()}
    </span>
  )
}

export default function PublicNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dbRole, setDbRole] = useState<string | null>(null)
  const { isSignedIn, isLoaded, user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetch('/api/user/role')
        .then(r => r.json())
        .then(d => setDbRole(d.role ?? null))
        .catch(() => {})
    } else if (isLoaded) {
      setDbRole(null)
    }
  }, [isLoaded, isSignedIn])

  const isAdmin = dbRole === 'ADMIN' || dbRole === 'SUPER_ADMIN'

  function handleSignOut() {
    signOut({ redirectUrl: '/' })
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight sm:text-xl">
          Scrutinise
        </Link>

        {/* ══ DESKTOP NAV — 25-K §5 ═════════════════════════════════
            Order, left to right: My ideas · Browse · Central · About · Support · [Admin].
            It is the brief's order and it is the order of use: make something, look at
            what others made, work with your community, find out what this is, ask for
            help. "Central" sat last, after the admin links, because it was added last.

            ⚠ LEGISLATION IS GONE — not being tested, and clutter on the way to the pilot
            (§5). The page itself (`/legislation-compare`) is untouched and still reachable
            by URL and from the admin panel; what went is the nav item.

            ⚠⚠ THE ITEM IS "MY IDEAS", AND THE FILE MATTERS AS MUCH AS THE WORD. 25-J §1
            renamed it — in `components/ui/Navbar.tsx`, which NOTHING RENDERS — so the
            rename never reached a user and `check:lex-25j` passed for a sprint anyway.
            This is the nav every page actually draws. The page behind it is no longer a
            form to fill once; it is where a user lives, and an item named for an ACTION
            sends someone looking for yesterday's work to the wrong place.
            ⚠ 25-K §5 listed the ORDER using the label that was live at the time; the order
            is unchanged and only the first label moves. The STAGE is still called Create
            (docs/CLAUDE.md §4, use exactly, never substitute) — this is a nav label. */}
        <div className="hidden items-center gap-6 md:flex">
          {/* 25-F §9 — creation entry. A CLIENT component, which is why the switch is a
              redirect route rather than a prop: it cannot read the database. */}
          <Link href="/ideas/new" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            My ideas
          </Link>
          <Link href="/ideas" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Browse
          </Link>
          {/* "Central" is the module; "Community" stays the name of the things
              you create inside it (renamed 6 Aug 2026 after the Stage 1 test). */}
          {isLoaded && isSignedIn && (
            <Link href="/communities" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Central
            </Link>
          )}
          <Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            About
          </Link>
          <Link href="/support" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Support
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Admin
            </Link>
          )}

          {isLoaded && !isSignedIn && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/sign-in">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">Sign up</Link>
              </Button>
            </>
          )}

          {isLoaded && isSignedIn && user && (
            <AccountMenu user={user} onSignOut={handleSignOut} />
          )}
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
              href="/ideas/new"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              My ideas
            </Link>
            <Link
              href="/ideas"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse
            </Link>
            {/* ⚠ 25-K §5 — THE SAME ORDER AS THE DESKTOP NAV, and Legislation is gone from
                both. A drawer that lists the items in a different order is a second thing
                to learn, and the phone is where a pilot tester is most likely to be. */}
            {isLoaded && isSignedIn && (
              <Link
                href="/communities"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Central
              </Link>
            )}
            <Link
              href="/about"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              href="/support"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Support
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin
              </Link>
            )}

            {isLoaded && !isSignedIn && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
                </Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>Sign up</Link>
                </Button>
              </div>
            )}

            {isLoaded && isSignedIn && user && (
              <div className="flex flex-col gap-3 pt-1">
                {/* No dropdown inside a drawer — the items are already a list, so
                    Account settings is a peer link rather than a nested menu. */}
                <Link
                  href="/settings"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Account settings
                </Link>
                <div className="flex items-center gap-3">
                <Link href="/dashboard" title="Your dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Avatar user={user} />
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleSignOut()
                  }}
                >
                  Sign out
                </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
