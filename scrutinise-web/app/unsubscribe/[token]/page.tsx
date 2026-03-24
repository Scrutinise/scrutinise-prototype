import { prisma } from '@/lib/prisma'
import Link from 'next/link'

type Props = { params: Promise<{ token: string }> }

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-sm p-8">
        {children}
      </div>
    </div>
  )
}

export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params

  let email: string

  // First: try UUID token lookup (new-style unsubscribeToken)
  const userByToken = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { email: true },
  }).catch(() => null)

  if (userByToken) {
    email = userByToken.email
  } else {
    // Fallback: base64-encoded email (legacy invite emails)
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      if (!decoded.includes('@')) throw new Error('Invalid')
      email = decoded
    } catch {
      return (
        <Layout>
          <h1 className="text-lg font-semibold text-zinc-900 mb-2">Invalid link</h1>
          <p className="text-sm text-zinc-600 mb-4">
            This unsubscribe link is invalid.
          </p>
          <Link href="/" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
            Back to Scrutinise
          </Link>
        </Layout>
      )
    }
  }

  // Upsert into EmailSuppression (idempotent)
  await prisma.emailSuppression.upsert({
    where: { email },
    update: {},
    create: { email, reason: 'USER_UNSUBSCRIBED' },
  })

  return (
    <Layout>
      <h1 className="text-lg font-semibold text-zinc-900 mb-2">Unsubscribed</h1>
      <p className="text-sm text-zinc-600 mb-4">
        <strong>{email}</strong> has been removed from Scrutinise email notifications.
      </p>
      <p className="text-sm text-zinc-500 mb-6">
        You will no longer receive collaboration invitations or platform notifications at this address.
      </p>
      <Link href="/" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
        Back to Scrutinise
      </Link>
    </Layout>
  )
}
