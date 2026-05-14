'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUser, useClerk } from '@clerk/nextjs'

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

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/ideas/create" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Create
          </Link>
          <Link href="/ideas" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Browse
          </Link>
          <Link href="/support" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Support
          </Link>
          <Link href="/legislation-compare" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Legislation
          </Link>
          <Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            About
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
            <div className="flex items-center gap-3">
              <Link href="/dashboard" title="Your dashboard">
                <Avatar user={user} />
              </Link>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
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
              href="/ideas/create"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Create
            </Link>
            <Link
              href="/ideas"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse
            </Link>
            <Link
              href="/support"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Support
            </Link>
            <Link
              href="/legislation-compare"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Legislation
            </Link>
            <Link
              href="/about"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
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
              <div className="flex items-center gap-3 pt-1">
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
            )}
          </div>
        </div>
      )}
    </header>
  )
}
