// 26-P §3b/§4c — "ASKS FIRST" IS A BUTTON, AND A BUTTON IS A SIGNED TOKEN.
//
// ⚠⚠ WHY IT IS BUILT THIS WAY. The old consolidation offer was accepted by `isPlainAssent` — the user
// typing "yes" into the chat. Anything that can approve an action by being TEXT can be approved by text a
// document or a web page puts in front of the model. So the approval here cannot be text at all:
//
//   1. a "Change" or expensive "Run" tool does NOT execute. It returns `needs_confirmation` carrying a
//      token — an HMAC over (idea, user, tool, input, price, expiry);
//   2. the interface renders that token as a button;
//   3. ONLY `POST /api/ideas/[id]/lex-agent/confirm`, called by the button, verifies the token and runs
//      the tool. Nothing in the conversation reaches it. A sentence in a filed document has no route to it.
//
// The token binds the INPUT, so a button cannot be re-aimed at a different row, and it expires, so a
// confirmation card left open overnight does not fire on a changed idea. It is single-purpose: the
// verifier also checks the idea and the user, so a token for one idea is dead on another.
//
// ⚠ NO SECRET → NO TOKENS. If neither secret is set, signing THROWS. A confirmation that cannot be
// verified must never degrade into one that always passes.

import { createHmac, timingSafeEqual } from 'crypto'

export const CONFIRM_TTL_MS = 30 * 60 * 1000

export interface ConfirmPayload {
  ideaId: string
  userId: string
  tool: string
  input: unknown
  /** Pence stated on the card; bound into the token so the card cannot understate what is run. */
  pence: number | null
  /** Epoch ms. */
  exp: number
}

function secret(): string {
  const s = process.env.LEX_AGENT_SECRET || process.env.CLERK_SECRET_KEY
  if (!s) throw new Error('lex-agent: no LEX_AGENT_SECRET or CLERK_SECRET_KEY — confirmation tokens cannot be signed')
  return s
}

/** Stable JSON: keys sorted at every depth, so the same input always signs the same. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8')

function mac(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url')
}

export function signConfirm(p: Omit<ConfirmPayload, 'exp'> & { exp?: number }, now = Date.now()): string {
  const full: ConfirmPayload = { ...p, exp: p.exp ?? now + CONFIRM_TTL_MS }
  const body = b64(stableStringify(full))
  return `${body}.${mac(body, secret())}`
}

export type VerifyResult =
  | { ok: true; payload: ConfirmPayload }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'wrong-idea' | 'wrong-user' }

export function verifyConfirm(
  token: string, expect: { ideaId: string; userId: string }, now = Date.now(),
): VerifyResult {
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' }
  const [body, sig] = parts
  const want = mac(body, secret())
  const a = Buffer.from(sig), b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad-signature' }
  let payload: ConfirmPayload
  try { payload = JSON.parse(unb64(body)) as ConfirmPayload } catch { return { ok: false, reason: 'malformed' } }
  if (typeof payload?.exp !== 'number' || payload.exp < now) return { ok: false, reason: 'expired' }
  if (payload.ideaId !== expect.ideaId) return { ok: false, reason: 'wrong-idea' }
  if (payload.userId !== expect.userId) return { ok: false, reason: 'wrong-user' }
  return { ok: true, payload }
}
