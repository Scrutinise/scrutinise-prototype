'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ContentReport {
  id: string
  reportedContentType: string
  reason: string
  description: string | null
  status: string
  createdAt: string
  reporter: { id: string; name: string; username: string }
  reportedIdea: { id: string; title: string; creator: { id: string; name: string } } | null
  reportedComment: { id: string; content: string; author: { id: string; name: string } } | null
  reportedUser: { id: string; name: string; username: string } | null
  moderatorNotes: string | null
  reviewedAt: string | null
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  joinDate: string
  credibilityScore: string | null
  ideaCount: number
}

interface PlatformConfig {
  credibilityWeightingActive?: boolean
  peerReviewRequired?: boolean
  minReviewersForStage4?: number
  minRatingForStage4?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports section (3a)
// ─────────────────────────────────────────────────────────────────────────────

function ContentReportsSection() {
  const [reports, setReports] = useState<ContentReport[]>([])
  const [loaded, setLoaded] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/reports')
      .then(r => r.json())
      .then(data => { setReports(Array.isArray(data) ? data : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  async function handleAction(reportId: string, action: 'DISMISS' | 'HIDE' | 'REMOVE' | 'WARN') {
    setActing(reportId + action)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json()
        setActionError(data.error ?? 'Something went wrong')
        return
      }
      setReports(prev =>
        prev.map(r =>
          r.id === reportId
            ? { ...r, status: action === 'DISMISS' ? 'DISMISSED' : 'ACTION_TAKEN' }
            : r,
        ),
      )
    } catch {
      setActionError('Network error')
    } finally {
      setActing(null)
    }
  }

  function getContentSnippet(report: ContentReport): string {
    if (report.reportedIdea) return `Idea: "${report.reportedIdea.title.slice(0, 60)}…"`
    if (report.reportedComment) return `Contribution: "${report.reportedComment.content.slice(0, 60)}…"`
    if (report.reportedUser) return `User: ${report.reportedUser.name}`
    return report.reportedContentType
  }

  function getContentOwner(report: ContentReport): string {
    if (report.reportedIdea) return report.reportedIdea.creator.name
    if (report.reportedComment) return report.reportedComment.author.name
    if (report.reportedUser) return report.reportedUser.name
    return '—'
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading reports…</p>

  return (
    <div className="space-y-4">
      {actionError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>
      )}
      {reports.length === 0 && (
        <p className="text-sm text-muted-foreground">No reports found.</p>
      )}
      {reports.map(report => (
        <div
          key={report.id}
          className={[
            'rounded-lg border p-4',
            report.status === 'PENDING' ? 'border-amber-200 bg-amber-50/50' : 'bg-muted/20',
          ].join(' ')}
        >
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className={[
                'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                report.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground',
              ].join(' ')}>
                {report.status}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-xs">{report.reason.replace('_', ' ')}</span>
          </div>
          <p className="mb-1 text-sm font-medium">{getContentSnippet(report)}</p>
          <p className="mb-1 text-xs text-muted-foreground">
            Reported by: <span className="font-medium">{report.reporter.name}</span>
            {' · '}
            Owner: <span className="font-medium">{getContentOwner(report)}</span>
          </p>
          {report.description && (
            <p className="mb-2 text-xs text-muted-foreground italic">&ldquo;{report.description}&rdquo;</p>
          )}
          {report.status === 'PENDING' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(['DISMISS', 'HIDE', 'REMOVE', 'WARN'] as const).map(action => (
                <Button
                  key={action}
                  size="sm"
                  variant={action === 'DISMISS' ? 'outline' : action === 'REMOVE' ? 'destructive' : 'outline'}
                  disabled={acting !== null}
                  onClick={() => handleAction(report.id, action)}
                  className={action === 'WARN' ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : ''}
                >
                  {acting === report.id + action ? '…' : action.charAt(0) + action.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Users section (3b)
// ─────────────────────────────────────────────────────────────────────────────

function UsersSection({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [roleChanging, setRoleChanging] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)

  function loadUsers(p: number) {
    setLoaded(false)
    fetch(`/api/admin/users?page=${p}&limit=25`)
      .then(r => r.json())
      .then(data => {
        setUsers(data.users ?? [])
        setTotal(data.total ?? 0)
        setTotalPages(data.totalPages ?? 1)
        setPage(p)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }

  useEffect(() => { loadUsers(1) }, [])

  async function handleRoleChange(userId: string, role: string) {
    setRoleChanging(userId)
    setRoleError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const data = await res.json()
        setRoleError(data.error ?? 'Something went wrong')
        return
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    } catch {
      setRoleError('Network error')
    } finally {
      setRoleChanging(null)
    }
  }

  const roleOptions = isSuperAdmin
    ? ['CITIZEN', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']
    : ['CITIZEN', 'MODERATOR']

  if (!loaded && users.length === 0) return <p className="text-sm text-muted-foreground">Loading users…</p>

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{total} users total</p>
      {roleError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{roleError}</p>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Role</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Credibility</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ideas</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{user.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{user.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={user.role}
                    disabled={roleChanging === user.id}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                    className="rounded border bg-background px-1.5 py-0.5 text-xs"
                  >
                    {roleOptions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{user.credibilityScore ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{user.ideaCount}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(user.joinDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => loadUsers(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => loadUsers(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform Config section (3c — SUPER_ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────

function PlatformConfigSection() {
  const [config, setConfig] = useState<PlatformConfig>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [localConfig, setLocalConfig] = useState<PlatformConfig>({})

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(data => {
        setConfig(data)
        setLocalConfig(data)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig),
      })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error ?? 'Something went wrong')
        return
      }
      setConfig(localConfig)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading config…</p>

  const isDirty = JSON.stringify(localConfig) !== JSON.stringify(config)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Credibility weighting active</span>
          <input
            type="checkbox"
            checked={Boolean(localConfig.credibilityWeightingActive)}
            onChange={e => setLocalConfig(c => ({ ...c, credibilityWeightingActive: e.target.checked }))}
            className="h-4 w-4 accent-foreground"
          />
        </label>
        <label className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Peer review required</span>
          <input
            type="checkbox"
            checked={Boolean(localConfig.peerReviewRequired)}
            onChange={e => setLocalConfig(c => ({ ...c, peerReviewRequired: e.target.checked }))}
            className="h-4 w-4 accent-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-sm font-medium">Min reviewers for Stage 4</span>
          <input
            type="number"
            min={1}
            value={localConfig.minReviewersForStage4 ?? 12}
            onChange={e => setLocalConfig(c => ({ ...c, minReviewersForStage4: parseInt(e.target.value) || 1 }))}
            className="w-24 rounded border bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-sm font-medium">Min rating for Stage 4</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={localConfig.minRatingForStage4 ?? 2.5}
            onChange={e => setLocalConfig(c => ({ ...c, minRatingForStage4: parseFloat(e.target.value) || 0 }))}
            className="w-24 rounded border bg-background px-2 py-1 text-sm"
          />
        </label>
      </div>
      {saveError && (
        <p className="text-sm text-destructive">{saveError}</p>
      )}
      {saveSuccess && (
        <p className="text-sm text-green-700">Config saved.</p>
      )}
      <Button onClick={handleSave} disabled={saving || !isDirty}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main admin page
// ─────────────────────────────────────────────────────────────────────────────

type AdminSection = 'reports' | 'users' | 'config'

export default function AdminPage() {
  const [section, setSection] = useState<AdminSection>('reports')
  // Detect SUPER_ADMIN status by checking the config endpoint
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => { if (r.ok) setIsSuperAdmin(true) })
      .catch(() => {})
  }, [])

  const sections: { key: AdminSection; label: string }[] = [
    { key: 'reports', label: 'Content Reports' },
    { key: 'users', label: 'Users' },
    ...(isSuperAdmin ? [{ key: 'config' as AdminSection, label: 'Platform Config' }] : []),
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-semibold">Admin Panel</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Section nav */}
        <div className="mb-8 flex gap-1 border-b">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={[
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                section === s.key
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>

        {section === 'reports' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <ContentReportsSection />
            </CardContent>
          </Card>
        )}

        {section === 'users' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Users</CardTitle>
            </CardHeader>
            <CardContent>
              <UsersSection isSuperAdmin={isSuperAdmin} />
            </CardContent>
          </Card>
        )}

        {section === 'config' && isSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Configuration</CardTitle>
              <p className="text-xs text-muted-foreground">Changes take effect immediately.</p>
            </CardHeader>
            <CardContent>
              <PlatformConfigSection />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
