// ─────────────────────────────────────────────────────────────────────────────
// BUG REPORTS — THE TECHNICAL DETAIL PASSES THROUGH VERBATIM (Charlie, 8 Oct 2026, item 4c).
//
// The model summary turned a report about bulk "Assign to heading" into "the grouping of 'CAs under pressure'", which is not
// what was reported: the error shown, the control pressed, the numbers involved and the failing request are exactly the facts a
// summary loses. For a BUG_REPORT nothing in this block is summarised, paraphrased or reordered by a model.
//
// What IS done to it, and it is only this: personal content is scrubbed (the same `scrubPersonal` the rest of feedback uses, plus
// a cap on how long any one string may be), with ONE exemption that matters here — a UUID is an identifier the team needs
// intact to find the row, and its digit runs would otherwise trip the "long number" rules. Each UUID is lifted out, the text is
// scrubbed, and the UUIDs are put back. Numbers (action #4, #20, a status code) are untouched: they are not personal.
//
// ⚠ The CLIENT captures (lib/client-fault-capture.ts); this file is what the SERVER does before storing or sending. Idempotent:
// sanitising an already-sanitised detail changes nothing, which is how the route knows the user was shown what is sent.
// ─────────────────────────────────────────────────────────────────────────────

import { scrubPersonal, type Redaction } from './feedback'

export const MAX_STRING = 1500
export const MAX_DEPTH = 6
export const MAX_KEYS = 40
export const MAX_ITEMS = 12

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

export interface SanitisedDetail {
  detail: Record<string, unknown>
  redactions: Redaction[]
}

function scrubString(s: string, identities: (string | null | undefined)[], redactions: Redaction[]): string {
  const clipped = s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…[+${s.length - MAX_STRING} characters not kept]` : s
  const ids: string[] = []
  const lifted = clipped.replace(UUID, (m) => { ids.push(m); return `\u0001${ids.length - 1}\u0001` })
  const r = scrubPersonal(lifted, identities)
  for (const x of r.redactions) {
    const e = redactions.find((y) => y.kind === x.kind)
    if (e) e.count += x.count
    else redactions.push({ ...x })
  }
  return r.text.replace(/\u0001(\d+)\u0001/g, (_m, i: string) => ids[Number(i)] ?? '')
}

function walk(v: unknown, depth: number, identities: (string | null | undefined)[], redactions: Redaction[]): unknown {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return v
  if (typeof v === 'string') return scrubString(v, identities, redactions)
  if (depth >= MAX_DEPTH) return '[nested too deep to keep]'
  if (Array.isArray(v)) return v.slice(0, MAX_ITEMS).map((x) => walk(x, depth + 1, identities, redactions))
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, MAX_KEYS)) {
      out[k.slice(0, 80)] = walk(val, depth + 1, identities, redactions)
    }
    return out
  }
  return String(v)
}

export function sanitiseTechnicalDetail(input: unknown, identities: (string | null | undefined)[] = []): SanitisedDetail {
  const redactions: Redaction[] = []
  const root = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return { detail: walk(root, 0, identities, redactions) as Record<string, unknown>, redactions }
}

/** The block as the user is shown it, and as it is emailed: stable key order, indented, nothing summarised. */
export function renderTechnicalDetail(detail: Record<string, unknown>): string {
  return JSON.stringify(detail, null, 2)
}
