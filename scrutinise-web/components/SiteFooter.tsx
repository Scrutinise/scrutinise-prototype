import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="shrink-0 border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">Scrutinise</p>
          <nav className="flex flex-wrap justify-center gap-4">
            <Link href="/" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Home
            </Link>
            <Link href="/ideas" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Browse
            </Link>
            <Link href="/dashboard" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/about" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              About
            </Link>
            <Link href="/privacy" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/contact" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
