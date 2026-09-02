/**
 * CENTRAL 25-A §2a — the invitation status vocabulary, in one place.
 *
 * ⚠ ITS OWN MODULE, WITH NO DATABASE IMPORT, on purpose: the panel is a client
 * component and the derivation in `lib/community-invitations.ts` is a server
 * one. Two copies of a vocabulary is one copy that will be updated — so the
 * server derives the status and the client renders the label, both from here.
 *
 * ⚠ COLOUR IS NEVER THE ONLY CUE (docs/CLAUDE.md §21): every status carries its
 * own words, so the badge is readable without seeing its tint at all.
 */
export const INVITE_STATUSES = [
  'REVOKED',
  'JOINED',
  'SIGNED_UP_NOT_JOINED',
  'EXPIRED',
  'OPENED',
  'INVITED',
] as const
export type InviteStatus = (typeof INVITE_STATUSES)[number]

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  REVOKED: 'Revoked',
  JOINED: 'Joined',
  SIGNED_UP_NOT_JOINED: 'Signed up — not yet joined',
  EXPIRED: 'Expired',
  OPENED: 'Link opened — no account yet',
  INVITED: 'Invited — no account yet',
}

/** What the owner should do about a row, in one sentence. */
export const INVITE_STATUS_HINT: Record<InviteStatus, string> = {
  REVOKED: 'This invitation can no longer be used.',
  JOINED: 'Nothing to do.',
  SIGNED_UP_NOT_JOINED:
    'They have a Scrutinise account but have not come through the invitation — send them the link again.',
  EXPIRED: 'Send a fresh invitation.',
  OPENED: 'They opened the link but have not created an account.',
  INVITED: 'They have not opened the link yet.',
}
