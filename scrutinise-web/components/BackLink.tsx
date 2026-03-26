'use client'

import { useRouter } from 'next/navigation'

export default function BackLink() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      ← Back
    </button>
  )
}
