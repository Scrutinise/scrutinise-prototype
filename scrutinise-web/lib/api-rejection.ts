// ─────────────────────────────────────────────────────────────────────────────
// A REJECTED REQUEST TELLS THE USER WHICH INPUT WAS REJECTED AND WHY, IN WORDS (docs/CLAUDE.md §30, 8 Oct 2026).
//
// Charlie, bulk "Assign to heading": the screen said "That request was not valid." and nothing else. The route's
// 422 body was `parsed.error.flatten()` — an object — and the client turned any object into that fixed sentence.
// The cause was one wrong key (`ids` for `actionIds`), which the sentence could not have told anyone.
//
// ⚠ NO IMPORTS. Pure functions over the SHAPE of a zod issue, so the same words are used by the route that
// rejects (server) and by a client that receives a rejection it did not word (a body from an older route).
// ─────────────────────────────────────────────────────────────────────────────

export interface IssueLike {
  path?: ReadonlyArray<PropertyKey>
  message?: string
  code?: string
}

export interface RejectedInput {
  /** The request's own key, as sent — what a developer needs. */
  field: string
  /** The word the user knows it by, where one was supplied. */
  label: string | null
  /** In words. */
  reason: string
}

/** Zod's message → a sentence fragment a user can read. Never returns an empty string. */
export function reasonInWords(issue: IssueLike): string {
  const m = (issue.message ?? '').trim()
  if (!m && !issue.code) return 'was not acceptable'
  if (/received undefined|^required$/i.test(m)) return 'was missing'
  const big = m.match(/<=\s*(\d+)\s*(characters|items)/i) ?? m.match(/at most (\d+)\s*(characters|items)/i)
  if (/too big/i.test(m) && big) return big[2].toLowerCase() === 'items' ? `has too many entries (at most ${big[1]} are allowed)` : `is too long (at most ${big[1]} characters are allowed)`
  const small = m.match(/>=\s*(\d+)\s*(characters|items)/i) ?? m.match(/at least (\d+)\s*(characters|items)/i)
  if (/too small/i.test(m) && small) return small[2].toLowerCase() === 'items' ? `was empty (at least ${small[1]} is needed)` : `was empty or too short (at least ${small[1]} character${small[1] === '1' ? '' : 's'} needed)`
  const exp = m.match(/expected (\w+), received (\w+)/i)
  if (exp) return `is the wrong kind of value (expected ${exp[1]}, got ${exp[2]})`
  if (issue.code === 'invalid_union' || /no matching discriminator|invalid input$/i.test(m)) return 'is not one this request understands'
  return m.charAt(0).toLowerCase() + m.slice(1)
}

export function describeIssues(
  issues: ReadonlyArray<IssueLike>,
  opts: { action: string; labels?: Record<string, string> },
): { message: string; rejected: RejectedInput[] } {
  const rejected: RejectedInput[] = issues.slice(0, 6).map((i) => {
    const field = (i.path ?? []).map(String).join('.') || '(the request itself)'
    const root = (i.path ?? []).map(String)[0] ?? ''
    return { field, label: opts.labels?.[root] ?? null, reason: reasonInWords(i) }
  })
  if (rejected.length === 0) rejected.push({ field: '(the request itself)', label: null, reason: 'was not in a form this control can send' })
  const parts = rejected.map((r) => (r.label ? `${r.label} (“${r.field}”) ${r.reason}` : `“${r.field}” ${r.reason}`))
  const more = issues.length > rejected.length ? ` — and ${issues.length - rejected.length} more` : ''
  return { message: `${opts.action} was not done. Rejected: ${parts.join('; ')}${more}. Nothing was changed.`, rejected }
}

/**
 * For the CLIENT: the sentence to show for any failed response, whatever shape the body has. A bare "not valid" is a
 * defect, so the last resort still names the control, the status, and what to do.
 */
export function explainFailure(body: unknown, status: number, action: string): string {
  const b = (body && typeof body === 'object' ? body : {}) as { error?: unknown; message?: unknown; rejected?: unknown }
  if (typeof b.error === 'string' && b.error.trim()) return b.error
  if (typeof b.message === 'string' && b.message.trim()) return b.message
  // An old-shape zod `flatten()` object: { formErrors: string[], fieldErrors: { key: string[] } }
  const e = b.error as { formErrors?: unknown; fieldErrors?: unknown } | null | undefined
  if (e && typeof e === 'object') {
    const fe = e.fieldErrors && typeof e.fieldErrors === 'object' ? Object.entries(e.fieldErrors as Record<string, unknown>) : []
    const parts = fe.map(([k, v]) => `“${k}” ${Array.isArray(v) && v.length ? String(v[0]).charAt(0).toLowerCase() + String(v[0]).slice(1) : 'was not acceptable'}`)
    const forms = Array.isArray(e.formErrors) ? e.formErrors.map(String).filter(Boolean) : []
    if (parts.length || forms.length) return `${action} was not done. Rejected: ${[...parts, ...forms].join('; ')}. Nothing was changed.`
  }
  return `${action} was not done — the server answered ${status} without saying why. Nothing was changed. Please use “Report a bug” and say which control you pressed.`
}
