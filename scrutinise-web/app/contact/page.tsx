import Link from 'next/link'
import PublicNav from '@/components/PublicNav'

export const metadata = {
  title: 'Contact Us — Scrutinise',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contact Us</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Get in touch at{' '}
          <a
            href="mailto:hello@scrutinise.org"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            hello@scrutinise.org
          </a>
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">Scrutinise</p>
            <nav className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">About</Link>
              <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Terms</Link>
              <Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Contact</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
