import Link from 'next/link'
import FeedbackItemsAdmin from '@/components/admin/FeedbackItemsAdmin'

// /admin/feedback — every report sent from "Give feedback on Lex" (26-S decision 154). Under /admin so app/admin/layout.tsx's
// Clerk + role gate applies; the API routes re-check the role themselves.
export const metadata = { title: 'Feedback — Admin' }

export default function FeedbackAdminPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Admin Panel</Link>
          <h1 className="mt-1 text-lg font-semibold">Feedback</h1>
          <p className="text-xs text-muted-foreground">Everything users have sent about Lex and the screens, newest first. People appear as “User N”, never by name.</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-4"><FeedbackItemsAdmin /></main>
    </div>
  )
}
