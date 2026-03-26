'use client'

import { useState, useEffect, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'

function OnboardingForm() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect_url')

  const [preferredName, setPreferredName] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [tcAgreed, setTcAgreed] = useState(false)
  const [rulesAgreed, setRulesAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default preferredName to Clerk firstName once loaded
  useEffect(() => {
    if (isLoaded && user?.firstName && !preferredName) {
      setPreferredName(user.firstName)
    }
  }, [isLoaded, user?.firstName])

  const canSubmit = preferredName.trim().length > 0 && ageConfirmed && tcAgreed && rulesAgreed

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredName: preferredName.trim(), ageConfirmed, tcAgreed, rulesAgreed }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      router.push(redirectUrl ?? '/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--background]">
        <div className="w-5 h-5 rounded-full border-2 border-[--primary] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <span className="text-xl font-semibold tracking-tight text-[--foreground]">Scrutinise</span>
        </div>

        <div className="bg-[--card] border border-[--border] rounded-lg p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[--foreground] mb-2">Welcome aboard</h1>
          <p className="text-sm text-[--muted-foreground] mb-6 leading-relaxed">
            Before you start, a few quick things so Lex knows how to address you and we can confirm you agree to our terms.
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Preferred name */}
            <div>
              <label htmlFor="preferredName" className="block text-sm font-medium text-[--foreground] mb-1.5">
                What should Lex call you?
              </label>
              <input
                id="preferredName"
                type="text"
                value={preferredName}
                onChange={e => setPreferredName(e.target.value)}
                maxLength={50}
                autoComplete="given-name"
                autoFocus
                className="w-full px-3 py-2 text-sm bg-white border border-[--border] rounded-md text-[--foreground] placeholder:text-[--muted-foreground] focus:outline-none focus:ring-2 focus:ring-[--ring] focus:border-[--ring]"
                placeholder="Your first name or preferred name"
              />
            </div>

            {/* Checkboxes */}
            <fieldset className="space-y-3">
              <legend className="sr-only">Agreements</legend>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={e => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[--border] text-[--primary] focus:ring-[--ring] cursor-pointer"
                />
                <span className="text-sm text-[--foreground] leading-relaxed">
                  I confirm I am aged 18 or over
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={tcAgreed}
                  onChange={e => setTcAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[--border] text-[--primary] focus:ring-[--ring] cursor-pointer"
                />
                <span className="text-sm text-[--foreground] leading-relaxed">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[--primary]">
                    Terms and Conditions
                  </a>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rulesAgreed}
                  onChange={e => setRulesAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[--border] text-[--primary] focus:ring-[--ring] cursor-pointer"
                />
                <span className="text-sm text-[--foreground] leading-relaxed">
                  I agree to the{' '}
                  <a href="/community-rules" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[--primary]">
                    Community Rules
                  </a>
                </span>
              </label>
            </fieldset>

            {error && (
              <p className="text-sm text-[--destructive]">{error}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-md bg-[--primary] text-[--primary-foreground] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Continue to Scrutinise'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  )
}
