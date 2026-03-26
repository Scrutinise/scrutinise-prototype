import Link from 'next/link'
import PublicNav from '@/components/PublicNav'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Browse Ideas — Scrutinise',
}

export default function BrowseIdeasPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Browse Ideas</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Public ideas will appear here once the platform opens to submissions. Sign up to be notified.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" asChild>
            <Link href="/sign-up">Sign up</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
