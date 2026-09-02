/**
 * CENTRAL 25-A §6d — the sign-in state vocabulary, in one place and with no
 * server import, so the admin table and the server derivation share it rather
 * than each spelling it out.
 *
 * ⚠ EVERY STATE HAS WORDS. There is no state that renders as an empty cell:
 * "Never signed in", "No Clerk account" and "Clerk did not answer" are three
 * different facts, and a blank would make all three look like the fourth thing
 * — a user who simply has not come back.
 */
export const SIGN_IN_STATES = [
  'RETURNED',
  'SIGNUP_ONLY',
  'NEVER',
  'NO_CLERK_ACCOUNT',
  'SEEDED',
  'UNKNOWN',
] as const
export type SignInState = (typeof SIGN_IN_STATES)[number]

export const SIGN_IN_STATE_LABEL: Record<SignInState, string> = {
  RETURNED: 'Signed in',
  SIGNUP_ONLY: 'Not since signing up',
  NEVER: 'Never signed in',
  NO_CLERK_ACCOUNT: 'No Clerk account',
  SEEDED: 'Seeded account — no login',
  UNKNOWN: 'Clerk did not answer',
}
