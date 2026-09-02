'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * CENTRAL 25-A §7e — the titles a Community defines for itself.
 *
 * ⚠⚠ A TITLE IS NOT A PLATFORM ROLE, and this screen says so out loud, because
 * the two must not share a namespace. "Branch Chair" is a word this Community
 * uses about one of its own people; it means nothing on the rest of Scrutinise,
 * and nothing here changes what anybody is on the platform.
 *
 * ⚠ Colour is never the only cue (docs/CLAUDE.md §21): a title that carries the
 * invitation right says so in words on its own row.
 */
type Title = {
  id: string
  name: string
  description: string | null
  grantsInvite: boolean
}

export default function TitlesSection({
  communityId,
  communityName,
}: {
  communityId: string
  communityName: string
}) {
  const [titles, setTitles] = useState<Title[]>([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [grantsInvite, setGrantsInvite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/communities/${communityId}/titles`)
    if (res.ok) setTitles((await res.json()).titles)
    setLoaded(true)
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  async function send(init: RequestInit, describe: () => string) {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/titles`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'That did not work.')
        return
      }
      setDone(describe())
      await load()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  const create = () =>
    send(
      { method: 'POST', body: JSON.stringify({ name, description, grantsInvite }) },
      () => {
        const created = name
        setName('')
        setDescription('')
        setGrantsInvite(false)
        return `“${created}” is now a title in ${communityName}.`
      },
    )

  const toggleInvite = (t: Title) =>
    send(
      { method: 'PATCH', body: JSON.stringify({ titleId: t.id, grantsInvite: !t.grantsInvite }) },
      () =>
        t.grantsInvite
          ? `“${t.name}” no longer carries the right to invite.`
          : `“${t.name}” now carries the right to invite.`,
    )

  const remove = (t: Title) =>
    send({ method: 'DELETE', body: JSON.stringify({ titleId: t.id }) }, () => `“${t.name}” was deleted.`)

  return (
    <section className="central-card space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">Titles in {communityName}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground pretty">
          Your own words for the people in this Community — &ldquo;Branch Chair&rdquo;,
          &ldquo;Regional Organiser&rdquo;, whatever you use. A title applies inside{' '}
          {communityName} and nowhere else on Scrutinise, and giving somebody one does not change
          what they are on the platform. Titles are given to people on the Members panel of the team
          they belong to.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {done && <p className="text-xs text-muted-foreground">{done}</p>}

      <div className="space-y-2">
        {!loaded ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : titles.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No titles yet. Everybody is simply a member until you make one.
          </p>
        ) : (
          titles.map((t) => (
            <div key={t.id} className="central-inset p-2">
              <p className="text-sm font-medium">{t.name}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground">{t.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t.grantsInvite
                  ? 'Can invite people to their own team and the teams under it.'
                  : 'Carries no extra rights — it is a name, not a permission.'}
              </p>
              <div className="mt-1.5 flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={busy}
                  onClick={() => toggleInvite(t)}
                >
                  {t.grantsInvite ? 'Take away the right to invite' : 'Let them invite'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={busy}
                  onClick={() => remove(t)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <label htmlFor="titleName" className="block text-[13px] font-medium">
          Add a title
        </label>
        <input
          id="titleName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Branch Chair"
          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={240}
          placeholder="What this title means here (optional)"
          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
        />
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={grantsInvite}
            onChange={(e) => setGrantsInvite(e.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>
            People with this title can invite others to their own team and the teams under it.
          </span>
        </label>
        <Button size="sm" disabled={busy || !name.trim()} onClick={create}>
          Add title
        </Button>
      </div>
    </section>
  )
}
