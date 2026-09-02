'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ApprovalFrame, { ContextField } from '@/components/central/ApprovalFrame'
import TitlesSection from './TitlesSection'
import {
  INVITE_RIGHT_DESCRIPTION,
  INVITE_RIGHT_LABEL,
  INVITE_RIGHT_ROLES,
  type InviteRightRole,
} from '@/lib/invite-rights'

type Mode = 'SELF' | 'BRANCH_ADMIN' | 'COMMUNITY_ADMIN' | 'NAMED'

const MODES: { key: Mode; label: string; note: string }[] = [
  { key: 'SELF', label: 'Each individual user, on their own content', note: 'The default. The stamp is the poster’s own claim, and it is shown as theirs.' },
  { key: 'BRANCH_ADMIN', label: 'Branch admins', note: 'Anyone with manage rights over the branch the content sits on.' },
  { key: 'COMMUNITY_ADMIN', label: 'Community admins', note: 'Manage rights over the Community itself.' },
  { key: 'NAMED', label: 'Named people only', note: 'Nobody else can approve, whatever their role.' },
]

type Settings = {
  organisationName: string | null
  organisationColour: string | null
  approvalFeatureEnabled: boolean
  approvalMode: Mode
  namedApproverIds: string[]
  /** CENTRAL 25-A §3a — which roles besides the owner may invite. */
  inviteRights: InviteRightRole[]
}

type Member = { id: string; name: string | null; username: string }

export default function CommunitySettingsClient({
  communityId,
  communityName,
  initial,
  members,
}: {
  communityId: string
  communityName: string
  initial: Settings
  members: Member[]
}) {
  const router = useRouter()
  const [name, setName] = useState(initial.organisationName ?? '')
  const [colour, setColour] = useState(initial.organisationColour ?? '#17B9D1')
  const [enabled, setEnabled] = useState(initial.approvalFeatureEnabled)
  const [mode, setMode] = useState<Mode>(initial.approvalMode)
  const [named, setNamed] = useState<string[]>(initial.namedApproverIds)
  const [inviteRights, setInviteRights] = useState<InviteRightRole[]>(initial.inviteRights)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [contextPreview, setContextPreview] = useState('')

  const validHex = /^#[0-9a-fA-F]{6}$/.test(colour)

  async function save() {
    setState('saving')
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organisationName: name.trim() || null,
        organisationColour: validHex ? colour : null,
        approvalFeatureEnabled: enabled,
        approvalMode: mode,
        namedApproverIds: named,
        inviteRights,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(typeof data.error === 'string' ? data.error : 'Could not save those settings.')
      setState('idle')
      return
    }
    setState('saved')
    // Everything downstream of these values is server-rendered, so a refresh is
    // what makes "takes effect immediately" true rather than true-after-reload.
    router.refresh()
  }

  function toggleRight(role: InviteRightRole) {
    setInviteRights((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  return (
    <div className="mt-6 space-y-6">
      {/* ── CENTRAL 25-A §3a — who may invite ────────────────────── */}
      <section className="central-card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Who may invite people</h2>
          <p className="mt-0.5 text-xs text-muted-foreground pretty">
            You always can, as the owner of {communityName}. Tick the roles you want to give the
            same right to. They can also let in anyone who arrives through a shared link.
          </p>
        </div>

        <div className="space-y-2">
          {INVITE_RIGHT_ROLES.map((role) => {
            const on = inviteRights.includes(role)
            return (
              <label
                key={role}
                /* ⚠ Colour is never the only cue (docs/CLAUDE.md §21): the granted
                   state is a filled ground and a 2px border, not a tint alone,
                   and the checkbox itself is the primary cue. */
                className={
                  on
                    ? 'flex cursor-pointer gap-2.5 rounded-lg border-2 border-foreground bg-muted/60 p-2.5'
                    : 'flex cursor-pointer gap-2.5 rounded-lg border border-border p-2.5'
                }
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleRight(role)}
                  className="mt-0.5 size-4"
                />
                <span>
                  <span className="block text-[13px] font-medium">{INVITE_RIGHT_LABEL[role]}</span>
                  <span className="block text-xs text-muted-foreground pretty">
                    {INVITE_RIGHT_DESCRIPTION[role]}
                  </span>
                </span>
              </label>
            )
          })}
        </div>

        {inviteRights.length === 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
            With neither ticked, you are the only person who can invite anybody to {communityName}
            or let in anyone who arrives through a link.
          </p>
        )}
      </section>

      {/* ── CENTRAL 25-A §7e — the Community's own titles ─────────────────── */}
      <TitlesSection communityId={communityId} communityName={communityName} />

      <section className="central-card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Organisation</h2>
          <p className="mt-0.5 text-xs text-muted-foreground pretty">
            Shown wherever the approval label appears. Leave the name blank and no
            approval label is shown anywhere, whatever the setting below.
          </p>
        </div>

        <div>
          <label htmlFor="orgName" className="mb-1 block text-[13px] font-medium">
            Organisation name
          </label>
          <input
            id="orgName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Reform UK"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="orgColour" className="mb-1 block text-[13px] font-medium">
            Organisation colour
          </label>
          <div className="flex items-center gap-2">
            <input
              id="orgColour"
              type="color"
              value={validHex ? colour : '#17B9D1'}
              onChange={(e) => setColour(e.target.value.toUpperCase())}
              className="size-9 cursor-pointer rounded border border-border bg-background"
            />
            <input
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              maxLength={7}
              className="tabular w-28 rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
            />
            {!validHex && <span className="text-xs text-red-600">Six-digit hex, like #17B9D1</span>}
          </div>
          {/* ⚠ Stated on the screen, not just in the code. An admin picking a
              colour close to the platform's own teal should know why it will not
              look as distinct as they expect. */}
          <p className="mt-1.5 text-xs text-muted-foreground pretty">
            The approval frame is drawn at double weight and always carries the words
            “{name.trim() || 'Organisation'} approved”. Colour reinforces it rather than
            carrying it — a party stamp must not read as a platform state, and at
            border size most colours near the platform’s teal do.
          </p>
        </div>
      </section>

      <section className="central-card space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Approval</h2>
            <p className="mt-0.5 text-xs text-muted-foreground pretty">
              Hidden removes the name, the colour frame and the superscript everywhere
              in {communityName}. Existing approvals are kept — switching it back on
              restores exactly what was there.
            </p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Show
          </label>
        </div>

        <fieldset disabled={!enabled} className={enabled ? '' : 'opacity-50'}>
          <legend className="mb-2 text-[13px] font-medium">Who may approve</legend>
          <div className="space-y-2">
            {MODES.map((m) => (
              <label key={m.key} className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="approvalMode"
                  checked={mode === m.key}
                  onChange={() => setMode(m.key)}
                  className="mt-0.5 size-4"
                />
                <span>
                  <span className="block text-[13px]">{m.label}</span>
                  <span className="block text-xs text-muted-foreground pretty">{m.note}</span>
                </span>
              </label>
            ))}
          </div>

          {mode === 'NAMED' && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
              {members.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No members to choose from yet.</p>
              ) : (
                members.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[13px]">
                    <input
                      type="checkbox"
                      checked={named.includes(m.id)}
                      onChange={(e) =>
                        setNamed((prev) =>
                          e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                        )
                      }
                      className="size-4 rounded border-border"
                    />
                    {m.name ?? m.username}
                  </label>
                ))
              )}
              {named.length === 0 && (
                <p className="px-1 pt-1 text-xs text-amber-700">
                  Nobody is named, so nothing can be approved.
                </p>
              )}
            </div>
          )}
        </fieldset>
      </section>

      {/* A live preview, because the point of the border-weight decision is only
          checkable by looking at it. */}
      <section className="central-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Preview</h2>
        <ApprovalFrame
          stamp={{
            visible: enabled && Boolean(name.trim()),
            approved: true,
            organisationName: name.trim() || null,
            organisationColour: validHex ? colour : null,
            markedByName: 'Sam Whitworth',
            approvedAt: new Date(),
          }}
        >
          <div className="p-3">
            <p className="text-sm pretty">
              “We’d fix the potholes by reallocating the highways maintenance underspend
              rather than raising the precept.”
            </p>
          </div>
        </ApprovalFrame>
        <ApprovalFrame
          stamp={{
            visible: enabled && Boolean(name.trim()),
            approved: false,
            organisationName: name.trim() || null,
            organisationColour: validHex ? colour : null,
            markedByName: null,
            approvedAt: null,
          }}
        >
          <div className="p-3">
            <p className="text-sm pretty">An answer nobody has marked. The neutral default.</p>
          </div>
        </ApprovalFrame>
        <div>
          {/* Permanent, and shown here so the toggle above visibly does NOT
              affect it. */}
          <ContextField value={contextPreview} onChange={setContextPreview} />
          <p className="mt-1 text-xs text-muted-foreground">
            The Context box is permanent and is not affected by the approval setting.
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save settings'}
        </Button>
        {state === 'saved' && <span className="text-xs text-muted-foreground">Saved.</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}
