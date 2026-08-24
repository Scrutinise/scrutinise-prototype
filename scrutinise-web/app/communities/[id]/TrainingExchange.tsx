'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * CENTRAL Stage 2d — the training exchange.
 *
 * The privacy rule this screen exists to make visible: NOTHING here renders a
 * contact detail that the server did not put in `match.contact`, and the server
 * fills that field from exactly one function (lib/training.ts `contactFor`),
 * which requires both acceptances, no closure, and the viewer being one of the
 * two people. Before anyone accepts, they are shown a sentence — computed by
 * the server from the same ticks — saying precisely what of theirs will be
 * shared and with whom.
 */

const CLOSE_WARNING =
  'Closing stops the details being shown from now on. It cannot unsend what has already been seen.'

type ListingRow = {
  id: string
  kind: string
  topic: string
  description: string
  availability: string
  status: string
  createdAt: string
  author: { id: string; name: string | null; username: string }
  mine: boolean
  proposalCount: number
  myProposalStatus: string | null
}

type MatchRow = {
  id: string
  listingId: string
  listingTopic: string
  listingKind: string
  status: string
  message: string | null
  createdAt: string
  acceptedAt: string | null
  closedAt: string | null
  role: 'author' | 'responder'
  otherParty: { id: string; name: string | null; username: string }
  listingProposalCount: number
  authorMessage: string | null
  contact: { email: string | null; phone: string | null } | null
  sharingFromMe: { email: boolean; phone: boolean }
  sessionLogged: boolean
}

type SessionRow = {
  id: string
  topic: string
  occurredAt: string
  trainer: { id: string; name: string | null; username: string }
  trainee: { id: string; name: string | null; username: string }
}

type Payload = {
  offers: ListingRow[]
  requests: ListingRow[]
  mine: ListingRow[]
  matches: MatchRow[]
  sessions: SessionRow[]
  phoneSharingEnabled: boolean
  iHavePhone: boolean
}

type SharePreview = {
  yours: { email: boolean; phone: boolean }
  toName: string
  theirs: { email: boolean; phone: boolean }
}

type Proposal = {
  id: string
  status: string
  message: string | null
  createdAt: string
  responder: { id: string; name: string | null; username: string }
  willShare: { email: boolean; phone: boolean }
  authorMessage: string | null
  closedAt: string | null
}

/** “See 1 proposal” / “See 3 proposals” — a bare count read as a label, not a
 *  control, which is why nobody clicked it. */
const seeProposals = (n: number) => `See ${n} proposal${n === 1 ? '' : 's'}`

const who = (u: { name: string | null; username: string }) => u.name ?? u.username

function channelList(t: { email: boolean; phone: boolean }): string {
  const parts = [t.email && 'your email address', t.phone && 'your phone number'].filter(Boolean)
  return parts.length ? parts.join(' and ') : 'nothing'
}

function theirChannelList(t: { email: boolean; phone: boolean }, name: string): string {
  const parts = [t.email && 'email address', t.phone && 'phone number'].filter(Boolean)
  return parts.length ? `${name}’s ${parts.join(' and ')}` : `nothing of ${name}’s`
}

/** The sentence shown before either side accepts. No surprises means saying
 *  both halves — what goes out, and what comes back. */
function ShareStatement({ preview }: { preview: SharePreview }) {
  return (
    <div className="rounded-lg border border-[oklch(0.9_0.03_85)] bg-[oklch(0.985_0.02_85)] p-3 text-[12.5px] leading-relaxed">
      <p>
        <strong>{preview.toName}</strong> will see <strong>{channelList(preview.yours)}</strong>.
      </p>
      <p className="mt-1">
        You will see <strong>{theirChannelList(preview.theirs, preview.toName)}</strong>.
      </p>
      {!preview.yours.email && !preview.yours.phone && (
        <p className="mt-1 text-red-700">Tick at least one — otherwise they cannot reach you.</p>
      )}
    </div>
  )
}

function ShareTicks({
  shareEmail,
  sharePhone,
  setShareEmail,
  setSharePhone,
  phoneEnabled,
  iHavePhone,
}: {
  shareEmail: boolean
  sharePhone: boolean
  setShareEmail: (v: boolean) => void
  setSharePhone: (v: boolean) => void
  phoneEnabled: boolean
  iHavePhone: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={shareEmail} onChange={(e) => setShareEmail(e.target.checked)} />
        Share my email address
      </label>
      {phoneEnabled && (
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={sharePhone}
            disabled={!iHavePhone}
            onChange={(e) => setSharePhone(e.target.checked)}
          />
          Share my phone number
          {!iHavePhone && (
            <span className="text-muted-foreground">
              — <Link href="/settings" className="underline underline-offset-2">add one in settings</Link> first
            </span>
          )}
        </label>
      )}
      <p className="text-[11.5px] text-muted-foreground pretty">
        Shown only once you have both accepted, and only to that one person. Never in member lists,
        search, exports or admin panels.
      </p>
    </div>
  )
}

export default function TrainingExchange({
  communityId,
  communityName,
}: {
  communityId: string
  communityName: string
}) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState<'OFFER' | 'REQUEST' | null>(null)
  const [proposingOn, setProposingOn] = useState<ListingRow | null>(null)
  const [openListingId, setOpenListingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/communities/${communityId}/training`)
    if (res.ok) setData(await res.json())
    else setError('Could not load the training exchange.')
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) {
    return <div className="central-card p-8 text-center text-[13px] text-muted-foreground">Loading…</div>
  }
  if (!data) {
    return <div className="central-card p-8 text-center text-[13px] text-red-600">{error}</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[560px]">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Training exchange</h2>
          <p className="mt-1 text-[13px] text-muted-foreground pretty">
            Someone in {communityName} can already do the thing you are stuck on. Offer what you
            know, ask for what you don’t, and swap contact details only when you have both agreed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 rounded-lg" onClick={() => setComposing('REQUEST')}>
            Ask for training
          </Button>
          <Button className="h-10 rounded-lg" onClick={() => setComposing('OFFER')}>
            Offer training
          </Button>
        </div>
      </div>

      {composing && (
        <ListingComposer
          communityId={communityId}
          kind={composing}
          phoneEnabled={data.phoneSharingEnabled}
          iHavePhone={data.iHavePhone}
          onCancel={() => setComposing(null)}
          onDone={() => { setComposing(null); load() }}
        />
      )}

      {proposingOn && (
        <ProposeDialog
          communityId={communityId}
          listing={proposingOn}
          phoneEnabled={data.phoneSharingEnabled}
          iHavePhone={data.iHavePhone}
          onCancel={() => setProposingOn(null)}
          onDone={() => { setProposingOn(null); load() }}
        />
      )}

      {/* ── my matches — where contact details live, and nowhere else ─────── */}
      {data.matches.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Your matches</h3>
          <div className="flex flex-col gap-2.5">
            {data.matches.map((m) => (
              <MatchCard
                key={m.id}
                communityId={communityId}
                match={m}
                onChanged={load}
                proposalsOpen={openListingId === m.listingId}
                onToggleProposals={() =>
                  setOpenListingId(openListingId === m.listingId ? null : m.listingId)
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ── my listings ───────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Your listings</h3>
        {data.mine.length === 0 ? (
          <p className="central-card p-5 text-[13px] text-muted-foreground">
            You haven’t posted an offer or a request yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {data.mine.map((l) => (
              <div key={l.id} className="central-card p-3.5">
                <ListingHead listing={l} />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                  <button
                    type="button"
                    onClick={() => setOpenListingId(openListingId === l.id ? null : l.id)}
                    className="font-medium text-primary underline underline-offset-2 hover:text-foreground"
                  >
                    {openListingId === l.id ? 'Hide proposals' : seeProposals(l.proposalCount)}
                  </button>
                  {l.status !== 'CLOSED' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/communities/${communityId}/training/${l.id}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'close' }),
                        })
                        load()
                      }}
                      className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Close this listing
                    </button>
                  )}
                </div>
                {openListingId === l.id && (
                  <ProposalList communityId={communityId} listingId={l.id} onChanged={load} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── the open board ────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Board
          title="Open offers"
          empty="Nobody is offering training just now. Be the first."
          listings={data.offers}
          onPropose={setProposingOn}
        />
        <Board
          title="Open requests"
          empty="Nobody has asked for training just now."
          listings={data.requests}
          onPropose={setProposingOn}
        />
      </div>

      {/* ── the branch's completed sessions ───────────────────────────────── */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Sessions completed</h3>
        {data.sessions.length === 0 ? (
          <p className="central-card p-5 text-[13px] text-muted-foreground">
            No sessions logged yet. When a match meets, either of you presses <strong>Log this
            session</strong> and both of you get your activity claim raised in one go.
          </p>
        ) : (
          <div className="central-card divide-y divide-border">
            {data.sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-[13px]">
                <span className="font-medium">{s.topic}</span>
                <span className="text-muted-foreground">
                  {who(s.trainer)} taught {who(s.trainee)} ·{' '}
                  <span className="tabular">{new Date(s.occurredAt).toLocaleDateString('en-GB')}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ListingHead({ listing }: { listing: ListingRow }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            listing.kind === 'OFFER' ? 'bg-[var(--central-teal-fill-strong)] central-teal-text' : 'bg-zinc-100 text-zinc-600'
          }`}
        >
          {listing.kind === 'OFFER' ? 'Offer' : 'Request'}
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">{listing.topic}</span>
        {listing.status !== 'OPEN' && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
            {listing.status === 'MATCHED' ? 'Matched' : 'Closed'}
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] leading-[1.55] text-[oklch(0.42_0.01_250)] pretty">{listing.description}</p>
      {listing.availability && (
        <p className="mt-1 text-[12px] text-muted-foreground">Available: {listing.availability}</p>
      )}
    </>
  )
}

function Board({
  title,
  empty,
  listings,
  onPropose,
}: {
  title: string
  empty: string
  listings: ListingRow[]
  onPropose: (l: ListingRow) => void
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {listings.length === 0 ? (
        <p className="central-card p-5 text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {listings.map((l) => (
            <div key={l.id} className="central-card central-card-hover p-3.5 transition-all">
              <ListingHead listing={l} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-muted-foreground">{who(l.author)}</span>
                {l.mine ? (
                  <span className="text-[12px] text-muted-foreground">Yours</span>
                ) : l.myProposalStatus ? (
                  <span className="text-[12px] text-muted-foreground">
                    {l.myProposalStatus === 'PROPOSED'
                      ? 'You’ve asked — waiting on them'
                      : l.myProposalStatus === 'ACCEPTED'
                        ? 'Matched'
                        : 'They declined'}
                  </span>
                ) : (
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => onPropose(l)}>
                    {l.kind === 'OFFER' ? 'I’d like this' : 'I can help'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ListingComposer({
  communityId,
  kind,
  phoneEnabled,
  iHavePhone,
  onCancel,
  onDone,
}: {
  communityId: string
  kind: 'OFFER' | 'REQUEST'
  phoneEnabled: boolean
  iHavePhone: boolean
  onCancel: () => void
  onDone: () => void
}) {
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [availability, setAvailability] = useState('')
  const [shareEmail, setShareEmail] = useState(true)
  const [sharePhone, setSharePhone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/training`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, topic, description, availability, shareEmail, sharePhone }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Could not post that.')
      setBusy(false)
      return
    }
    onDone()
  }

  return (
    <div className="central-card space-y-3 p-4">
      <h3 className="text-[15px] font-semibold">
        {kind === 'OFFER' ? 'Offer training' : 'Ask for training'}
      </h3>
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder={kind === 'OFFER' ? 'What can you teach? e.g. Doorstep conversations' : 'What do you need? e.g. Using the canvassing app'}
        maxLength={120}
        className="h-[38px] rounded-lg"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={kind === 'OFFER' ? 'What you’d cover, and who it suits.' : 'What you’re stuck on, and what would help.'}
        rows={3}
        maxLength={4000}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
      />
      <Input
        value={availability}
        onChange={(e) => setAvailability(e.target.value)}
        placeholder="When you’re around — Tuesday evenings, weekends, whatever is true"
        maxLength={500}
        className="h-[38px] rounded-lg"
      />
      <ShareTicks
        shareEmail={shareEmail}
        sharePhone={sharePhone}
        setShareEmail={setShareEmail}
        setSharePhone={setSharePhone}
        phoneEnabled={phoneEnabled}
        iHavePhone={iHavePhone}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={submit}>
          {busy ? 'Posting…' : 'Post it'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

/**
 * The responder's side. Sending the request IS their acceptance, so the
 * statement of what they are about to share is shown BEFORE the button, and it
 * is the server's sentence rather than one this component composed.
 */
function ProposeDialog({
  communityId,
  listing,
  phoneEnabled,
  iHavePhone,
  onCancel,
  onDone,
}: {
  communityId: string
  listing: ListingRow
  phoneEnabled: boolean
  iHavePhone: boolean
  onCancel: () => void
  onDone: () => void
}) {
  const [message, setMessage] = useState('')
  const [shareEmail, setShareEmail] = useState(true)
  const [sharePhone, setSharePhone] = useState(false)
  const [preview, setPreview] = useState<SharePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/communities/${communityId}/training/${listing.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', shareEmail, sharePhone }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.preview) setPreview(d.preview) })
      .catch(() => {})
    return () => { live = false }
  }, [communityId, listing.id, shareEmail, sharePhone])

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/training/${listing.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'propose', message, shareEmail, sharePhone }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Could not send that.')
      setBusy(false)
      return
    }
    onDone()
  }

  return (
    <div className="central-card space-y-3 border-primary/40 p-4">
      <h3 className="text-[15px] font-semibold">
        {listing.kind === 'OFFER' ? 'Ask for this training' : 'Offer to help with this'}
      </h3>
      <p className="text-[13px] text-muted-foreground">
        {listing.topic} — {who(listing.author)}
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="A line about what you’re after (optional)"
        rows={2}
        maxLength={1000}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
      />
      <ShareTicks
        shareEmail={shareEmail}
        sharePhone={sharePhone}
        setShareEmail={setShareEmail}
        setSharePhone={setSharePhone}
        phoneEnabled={phoneEnabled}
        iHavePhone={iHavePhone}
      />
      <div>
        <p className="mb-1.5 text-[12px] font-semibold">If you send this, and they accept:</p>
        {preview ? <ShareStatement preview={preview} /> : <p className="text-[12px] text-muted-foreground">Checking…</p>}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || (!shareEmail && !sharePhone)} onClick={submit}>
          {busy ? 'Sending…' : 'Send request'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

/** The author's side: every proposal, with what accepting would disclose. */
function ProposalList({
  communityId,
  listingId,
  onChanged,
}: {
  communityId: string
  listingId: string
  onChanged: () => void
}) {
  const [proposals, setProposals] = useState<Proposal[] | null>(null)
  const [previews, setPreviews] = useState<Record<string, SharePreview>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // One box per proposal, shared by Accept and Decline. Optional on both.
  const [messages, setMessages] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const res = await fetch(`/api/communities/${communityId}/training/${listingId}`)
    if (!res.ok) { setProposals([]); return }
    const list: Proposal[] = (await res.json()).proposals
    setProposals(list)
    // The statement each Accept button is standing behind, fetched per
    // proposal from the server rather than assembled here.
    const entries = await Promise.all(
      list.map(async (p) => {
        const r = await fetch(`/api/communities/${communityId}/training/matches/${p.id}`)
        const d = r.ok ? await r.json() : null
        return [p.id, d?.preview] as const
      }),
    )
    setPreviews(Object.fromEntries(entries.filter(([, v]) => v)) as Record<string, SharePreview>)
  }, [communityId, listingId])

  useEffect(() => { load() }, [load])

  async function act(matchId: string, action: 'accept' | 'decline') {
    setBusyId(matchId)
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/training/matches/${matchId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, message: messages[matchId]?.trim() || undefined }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Could not do that.')
    }
    setBusyId(null)
    await load()
    onChanged()
  }

  if (proposals === null) return <p className="mt-2 text-[12px] text-muted-foreground">Loading…</p>
  if (proposals.length === 0) return <p className="mt-2 text-[12px] text-muted-foreground">No proposals yet.</p>

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {proposals.map((p) => (
        <div key={p.id} className="rounded-lg border border-border p-3">
          <p className="text-[13px]">
            <strong>{who(p.responder)}</strong>
            {p.status === 'ACCEPTED' && <span className="ml-2 text-[12px] text-muted-foreground">Accepted</span>}
            {p.status === 'DECLINED' && <span className="ml-2 text-[12px] text-muted-foreground">Declined</span>}
          </p>
          {p.message && <p className="mt-1 text-[13px] text-[oklch(0.42_0.01_250)] pretty">{p.message}</p>}
          {p.authorMessage && p.status !== 'PROPOSED' && (
            <p className="mt-1 text-[12.5px] text-muted-foreground pretty">You said: {p.authorMessage}</p>
          )}
          {p.status === 'PROPOSED' && (
            <>
              <p className="mb-1.5 mt-2 text-[12px] font-semibold">If you accept:</p>
              {previews[p.id] ? (
                <ShareStatement preview={previews[p.id]} />
              ) : (
                <p className="text-[12px] text-muted-foreground">Checking…</p>
              )}
              {/* Stage 2e — one optional line, on BOTH decisions. A decline with
                  a reason is much better for a branch of a dozen people who see
                  each other on Saturday than a silent refusal. */}
              <textarea
                value={messages[p.id] ?? ''}
                onChange={(e) => setMessages((m) => ({ ...m, [p.id]: e.target.value }))}
                placeholder={`A line to ${who(p.responder)} (optional) — sent either way`}
                rows={2}
                maxLength={1000}
                className="mt-2 w-full rounded-lg border bg-background px-2.5 py-1.5 text-[13px]"
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={busyId === p.id} onClick={() => act(p.id, 'accept')}>
                  Accept
                </Button>
                <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => act(p.id, 'decline')}>
                  Decline
                </Button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/** Midday on the chosen day, or now if midday has not happened yet. */
function sessionStamp(day: string): string {
  const midday = new Date(`${day}T12:00:00`)
  const now = new Date()
  return (midday.getTime() > now.getTime() ? now : midday).toISOString()
}

/**
 * A match the viewer is in. The ONLY place a contact detail is rendered
 * anywhere in Central, and it renders whatever `match.contact` holds — which is
 * null unless both sides accepted, nobody closed it, and the other side ticked
 * that channel.
 */
function MatchCard({
  communityId,
  match,
  onChanged,
  proposalsOpen,
  onToggleProposals,
}: {
  communityId: string
  match: MatchRow
  onChanged: () => void
  proposalsOpen: boolean
  onToggleProposals: () => void
}) {
  const [logging, setLogging] = useState(false)
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logged, setLogged] = useState<string | null>(null)

  const live = match.status === 'ACCEPTED' && !match.closedAt

  async function act(action: 'close') {
    setBusy(true)
    await fetch(`/api/communities/${communityId}/training/matches/${match.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusy(false)
    onChanged()
  }

  async function logSession() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/communities/${communityId}/training/matches/${match.id}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Midday on the chosen day, EXCEPT when that is still in the future —
      // logging a session at 9am on the day it happened would otherwise be
      // refused by the no-future-sessions guard.
      body: JSON.stringify({ occurredAt: sessionStamp(occurredAt) }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Could not log that.')
      setBusy(false)
      return
    }
    const { result } = await res.json()
    setLogged(
      `Logged. Two claims are with your branch admin: ${result.trainer.points} points for the trainer, ` +
        `${result.trainee.points} for the trainee. Points are awarded when the admin approves them.`,
    )
    setBusy(false)
    setLogging(false)
    onChanged()
  }

  return (
    <div className="central-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">{match.listingTopic}</span>
        <span className="text-[12px] text-muted-foreground">with {who(match.otherParty)}</span>
        {match.status === 'PROPOSED' && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            {match.role === 'responder' ? 'Waiting on them' : 'Waiting on you'}
          </span>
        )}
        {match.closedAt && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">Closed</span>
        )}
      </div>

      {/* What the viewer is showing the other side — never a mystery. */}
      <p className="mt-1.5 text-[12px] text-muted-foreground">
        You are sharing <strong>{channelList(match.sharingFromMe)}</strong> with {who(match.otherParty)}.
      </p>

      {/* Stage 2e — the proposal link lives on BOTH panels. A “waiting on you”
          chip with no control was a dead end: the only way to act on a proposal
          was to find the same listing again under Your listings. */}
      {match.role === 'author' && (
        <button
          type="button"
          onClick={onToggleProposals}
          className="mt-1 text-[12px] font-medium text-primary underline underline-offset-2 hover:text-foreground"
        >
          {proposalsOpen ? 'Hide proposals' : seeProposals(match.listingProposalCount)}
        </button>
      )}
      {proposalsOpen && match.role === 'author' && (
        <ProposalList communityId={communityId} listingId={match.listingId} onChanged={onChanged} />
      )}

      {match.authorMessage && (
        <p className="mt-2 rounded-lg border border-border bg-muted/40 p-2 text-[12.5px] pretty">
          <span className="text-muted-foreground">
            {match.role === 'author' ? 'You said:' : `${who(match.otherParty)} said:`}
          </span>{' '}
          {match.authorMessage}
        </p>
      )}

      {live && match.contact && (
        <div className="mt-2 rounded-lg border border-[var(--central-teal-fill-strong)] bg-[var(--central-teal-fill)] p-3 text-[13px]">
          <p className="font-semibold">{who(match.otherParty)}’s details</p>
          {match.contact.email && (
            <p className="mt-1">
              <a href={`mailto:${match.contact.email}`} className="underline underline-offset-2">
                {match.contact.email}
              </a>
            </p>
          )}
          {match.contact.phone && <p className="mt-0.5 tabular">{match.contact.phone}</p>}
          {!match.contact.email && !match.contact.phone && (
            <p className="mt-1 text-muted-foreground">
              They accepted but shared no channel. Ask them in the Community to add one.
            </p>
          )}
        </div>
      )}

      {live && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!match.sessionLogged && !logging && (
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setLogging(true)}>
              Log this session
            </Button>
          )}
          {match.sessionLogged && <span className="text-[12px] text-muted-foreground">Session logged</span>}
          <button
            type="button"
            disabled={busy}
            onClick={() => act('close')}
            className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            title={CLOSE_WARNING}
          >
            Close this match
          </button>
        </div>
      )}
      {live && <p className="mt-1 text-[11.5px] text-muted-foreground pretty">{CLOSE_WARNING}</p>}

      {logging && (
        <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
          <p className="text-[12.5px]">
            Logging this raises <strong>both</strong> activity claims in one go — 40 points for
            whoever gave the training, 20 for whoever received it — for your branch admin to
            approve. The claims come from the listing, not from who presses this.
          </p>
          <label className="block text-[12px] text-muted-foreground">
            When did it happen?
            <input
              type="date"
              value={occurredAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="ml-2 rounded-lg border bg-background px-2 py-1 text-sm"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={logSession}>
              {busy ? 'Logging…' : 'Log it'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLogging(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {logged && <p className="mt-2 text-[12.5px] central-teal-text">{logged}</p>}
    </div>
  )
}
