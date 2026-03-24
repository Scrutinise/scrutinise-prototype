'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import PublicNav from '@/components/PublicNav'

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{ scheduledFor: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  if (!isLoaded) return null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">Settings</h1>

        {/* Account details */}
        <section className="mb-10">
          <h2 className="mb-4 text-base font-semibold">Account details</h2>
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
