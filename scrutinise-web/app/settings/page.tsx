'use client'

import { useRef, useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import PublicNav from '@/components/PublicNav'
import { ACCENT_PALETTE, DEFAULT_ACCENT_KEY } from '@/lib/accent'
import { applyAccentNow } from '@/components/central/AccentProvider'

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const [exporting, setExporting] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{ scheduledFor: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [experienceLevel, setExperienceLevel] = useState('')
  const [savingExperience, setSavingExperience] = useState(false)
  const [experienceSaved, setExperienceSaved] = useState(false)
  const [phone, setPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT_KEY)
  const [accentSaved, setAccentSaved] = useState(false)

  // Fetch current profile fields on mount
  useEffect(() => {
    fetch('/api/user/onboarding')
      .then(r => r.json())
      .then(data => {
        if (data.experienceLevel) setExperienceLevel(data.experienceLevel)
        if (typeof data.phone === 'string') setPhone(data.phone)
      })
      .catch(() => {})
    fetch('/api/user/accent')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.key) setAccent(d.key) })
      .catch(() => {})
  }, [])

  async function handleAccentChange(key: string) {
    // ⚠ Applied to the document BEFORE the request settles. The whole point of
    // choosing a colour is seeing it; a swatch that only takes effect after a
    // round trip reads as a control that did not work.
    setAccent(key)
    applyAccentNow(key)
    setAccentSaved(false)
    const res = await fetch('/api/user/accent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    if (res.ok) {
      setAccentSaved(true)
      setTimeout(() => setAccentSaved(false), 2000)
    }
  }

  async function handleSavePhone() {
    setSavingPhone(true)
    setPhoneError(null)
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      if (!res.ok) {
        setPhoneError('That does not look like a phone number. Digits, spaces, + and () only.')
        return
      }
      setPhoneSaved(true)
      setTimeout(() => setPhoneSaved(false), 2000)
    } catch {
      setPhoneError('Could not save that just now.')
    } finally {
      setSavingPhone(false)
    }
  }

  async function handleExperienceLevelChange(value: string) {
    setExperienceLevel(value)
    setExperienceSaved(false)
    if (!value) return
    setSavingExperience(true)
    try {
      await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceLevel: value }),
      })
      setExperienceSaved(true)
      setTimeout(() => setExperienceSaved(false), 2000)
    } catch {
      // silent
    } finally {
      setSavingExperience(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const res = await fetch('/api/user/export', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setExportError(data.error ?? 'Export failed.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scrutinise-data-export.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Something went wrong. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error ?? 'Failed to schedule account deletion.')
        return
      }
      setDeleteResult({ scheduledFor: data.scheduledFor })
      setShowDeleteConfirm(false)
    } catch {
      setDeleteError('Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      await user.setProfileImage({ file })
      await user.reload()
    } catch {
      setPhotoError('Photo upload failed. Please try again.')
    } finally {
      setPhotoUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  if (!isLoaded) return null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">Settings</h1>

        {/* Account details */}
        <section className="mb-10">
          <h2 className="mb-4 text-base font-semibold">Account details</h2>

          {/* Profile photo */}
          <div className="mb-4 flex items-center gap-4">
            {user?.hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt={user.fullName ?? 'Profile photo'}
                width={80}
                height={80}
                className="size-20 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex size-20 items-center justify-center rounded-full text-xl font-semibold text-white"
                style={{ backgroundColor: '#1a7a6e' }}
              >
                {((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() || '?'}
              </span>
            )}
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
              >
                {photoUploading ? 'Uploading…' : 'Change photo'}
              </Button>
              {photoError && (
                <p className="mt-1 text-xs text-red-600">{photoError}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span>{user?.fullName ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{user?.primaryEmailAddress?.emailAddress ?? '—'}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            To change your email or password, visit{' '}
            <a
              href="https://accounts.scrutinise.co.uk/user"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              account settings
            </a>
            .
          </p>

          {/* Experience level */}
          <div className="mt-6">
            <label htmlFor="experienceLevel" className="block text-sm font-medium mb-1.5">
              Policy experience level
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Helps Lex tailor the conversation to your background.
            </p>
            <div className="flex items-center gap-3">
              <select
                id="experienceLevel"
                value={experienceLevel}
                onChange={e => handleExperienceLevelChange(e.target.value)}
                disabled={savingExperience}
                className="flex-1 px-3 py-2 text-sm bg-white border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:opacity-60"
              >
                <option value="">Select an option</option>
                <option value="NO_BACKGROUND">No background or experience</option>
                <option value="SECTOR_LIVED">Sector or lived experience</option>
                <option value="THINK_TANK_JUNIOR">Think Tank, NGO or advocacy (junior)</option>
                <option value="THINK_TANK_SENIOR">Think Tank, NGO or advocacy (senior)</option>
                <option value="POLITICAL_JUNIOR">Political professional (junior)</option>
                <option value="POLITICAL_SENIOR">Political professional (senior)</option>
                <option value="PARLIAMENTARIAN">Parliamentarian or former parliamentarian</option>
              </select>
              {experienceSaved && (
                <span className="text-xs text-green-600">Saved</span>
              )}
            </div>
          </div>

          {/* Platform accent — CENTRAL Stage 2h item 7.
              A fixed palette, not a colour picker: free hex entry produces
              unreadable and non-compliant combinations, and every entry here has
              its text colours hand-set rather than derived. */}
          <div className="mt-6">
            <span className="block text-sm font-medium mb-1.5">Platform accent</span>
            <p className="text-xs text-muted-foreground mb-2">
              The highlight colour used across Central. Yours alone — it changes nothing
              for anyone else.
            </p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PALETTE.map(a => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => handleAccentChange(a.key)}
                  aria-pressed={accent === a.key}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    accent === a.key
                      ? 'border-2 border-foreground font-semibold'
                      : 'border border-border font-normal text-muted-foreground hover:border-foreground/40'
                  }`}
                >
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full border border-black/10"
                    style={{ background: a.base }}
                  />
                  {/* ⚠ The NAME, not just the swatch — item 6. A row of coloured
                      circles is a control a colour-blind member cannot read at
                      all, and this is the one screen where that would be absurd.
                      The tick and the heavier border say which is selected. */}
                  {accent === a.key ? '✓ ' : ''}{a.label}
                </button>
              ))}
            </div>
            {accentSaved && <p className="mt-2 text-xs text-green-600">Saved</p>}
          </div>

          {/* Phone number — CENTRAL Stage 2d.
              Optional, and used for exactly one thing. The copy says so, and
              says it before the box rather than after it. */}
          <div className="mt-6">
            <label htmlFor="phone" className="block text-sm font-medium mb-1.5">
              Phone number <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Used for one thing only: swapping contact details on a training match in your
              Community, and only with the person you have both agreed to. It is never shown in
              member lists, search, exports or admin panels. Leave it blank, or clear it at any
              time, and nothing else changes.
            </p>
            <div className="flex items-center gap-3">
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setPhoneSaved(false); setPhoneError(null) }}
                placeholder="07700 900123"
                maxLength={32}
                className="flex-1 px-3 py-2 text-sm bg-white border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:opacity-60"
              />
              <Button size="sm" variant="outline" disabled={savingPhone} onClick={handleSavePhone}>
                {savingPhone ? 'Saving…' : 'Save'}
              </Button>
              {phoneSaved && <span className="text-xs text-green-600">Saved</span>}
            </div>
            {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
          </div>
        </section>

        {/* Data and privacy */}
        <section className="mb-10">
          <h2 className="mb-4 text-base font-semibold">Data and privacy</h2>
          <div className="rounded-lg border border-border p-4 space-y-4">
            <div>
              <p className="text-sm font-medium">Download your data</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Export all your ideas, contributions, votes, and research as a JSON file.
                You can request one export every 24 hours.
              </p>
              {exportError && (
                <p className="mt-2 text-xs text-red-600">{exportError}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? 'Preparing…' : 'Download your data'}
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium">Delete account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Requests permanent deletion of your account and all associated data.
                You have 30 days to change your mind — simply log back in to cancel.
              </p>
              {deleteResult ? (
                <p className="mt-2 text-xs text-green-700 dark:text-green-400">
                  Account deletion scheduled for{' '}
                  {new Date(deleteResult.scheduledFor).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  . Log back in before then to cancel.
                </p>
              ) : showDeleteConfirm ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Are you sure? Your account and data will be scheduled for deletion in 30 days.
                  </p>
                  {deleteError && (
                    <p className="mt-2 text-xs text-red-600">{deleteError}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Scheduling…' : 'Yes, delete my account'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete account
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Notification preferences */}
        <section>
          <h2 className="mb-4 text-base font-semibold">Notification preferences</h2>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">
              Notification settings will be available in a future update.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
