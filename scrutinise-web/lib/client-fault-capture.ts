// ─────────────────────────────────────────────────────────────────────────────
// CLIENT FAULT CAPTURE — so a bug report carries the facts without the user having to remember or type them
// (Charlie, 8 Oct 2026, item 4c: "the error shown, the control pressed, the numbers involved, the failing request (sanitised),
// captured automatically where the UI has it").
//
// It keeps, in memory only and for this tab only, four short rings:
//   · failed API calls   — method, path, the body that was SENT (long strings clipped), the status, the start of the reply
//   · recent clicks      — the control's own words (visible text / aria-label / title), never what was typed into a field
//   · uncaught errors    — message and the first line of the stack
//   · and, at report time, the error text currently ON SCREEN (any role="alert")
//
// ⚠ NOTHING IS SENT FROM HERE. `getTechnicalDetail()` returns an object the feedback dialog shows the user in full before
// anything leaves; the server sanitises it again (lib/lex/feedback-technical.ts) and only then stores or emails it.
// ⚠ NO IMPORTS (and so safe in a client bundle — CLAUDE.md §28). Install is idempotent and a no-op on the server.
// ⚠ It never reads cookies, headers, or form field values, and it ignores everything that is not our own /api/ path.
// ─────────────────────────────────────────────────────────────────────────────

interface FailedCall { at: string; method: string; path: string; status: number | 'network error'; sent: unknown; reply: string }
interface Click { at: string; control: string; tag: string }
interface Uncaught { at: string; message: string; where: string }

const MAX = { calls: 4, clicks: 8, errors: 3 }
const calls: FailedCall[] = []
const clicks: Click[] = []
const errors: Uncaught[] = []
let installed = false

function push<T>(ring: T[], item: T, max: number) {
  ring.push(item)
  while (ring.length > max) ring.shift()
}

/** Clip long strings so a request body that contained a pasted document cannot become the report. */
function clip(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return v.length > 200 ? `${v.slice(0, 200)}…[+${v.length - 200} characters]` : v
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return v
  if (depth >= 5) return '[nested]'
  if (Array.isArray(v)) {
    const head = v.slice(0, 8).map((x) => clip(x, depth + 1))
    return v.length > 8 ? [...head, `…[+${v.length - 8} more]`] : head
  }
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 30)) o[k] = clip(x, depth + 1)
    return o
  }
  return String(v)
}

function controlWords(el: Element | null): { control: string; tag: string } | null {
  const c = el?.closest('button, a, select, input[type="checkbox"], input[type="radio"], [role="button"], [role="tab"], summary')
  if (!c) return null
  const aria = c.getAttribute('aria-label')
  const title = c.getAttribute('title')
  // Visible words only. For a <select> the words are the label, never the chosen option's content typed by a user.
  const text = (c as HTMLElement).innerText?.replace(/\s+/g, ' ').trim().slice(0, 80)
  const control = aria || text || title || c.tagName.toLowerCase()
  return { control, tag: c.tagName.toLowerCase() }
}

export function installFaultCapture(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    let path = ''
    try { path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin).pathname } catch { /* leave empty */ }
    const ours = path.startsWith('/api/')
    let sent: unknown = undefined
    if (ours && typeof init?.body === 'string') { try { sent = clip(JSON.parse(init.body)) } catch { sent = '[a body that was not JSON]' } }
    try {
      const res = await realFetch(input, init)
      if (ours && !res.ok) {
        let reply = ''
        try { reply = (await res.clone().text()).slice(0, 600) } catch { /* unreadable reply */ }
        push(calls, { at: new Date().toISOString(), method, path, status: res.status, sent, reply }, MAX.calls)
      }
      return res
    } catch (e) {
      if (ours) push(calls, { at: new Date().toISOString(), method, path, status: 'network error', sent, reply: e instanceof Error ? e.message : String(e) }, MAX.calls)
      throw e
    }
  }

  document.addEventListener('click', (ev) => {
    const w = controlWords(ev.target instanceof Element ? ev.target : null)
    if (w) push(clicks, { at: new Date().toISOString(), ...w }, MAX.clicks)
  }, true)
  // A <select> changes without a click on an option; record the control, not the choice's content.
  document.addEventListener('change', (ev) => {
    const w = controlWords(ev.target instanceof Element ? ev.target : null)
    if (w) push(clicks, { at: new Date().toISOString(), control: `${w.control} (changed)`, tag: w.tag }, MAX.clicks)
  }, true)

  window.addEventListener('error', (e) => push(errors, { at: new Date().toISOString(), message: String(e.message).slice(0, 300), where: `${e.filename ?? ''}:${e.lineno ?? ''}`.slice(0, 160) }, MAX.errors))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    push(errors, { at: new Date().toISOString(), message: (r instanceof Error ? r.message : String(r)).slice(0, 300), where: 'unhandled promise rejection' }, MAX.errors)
  })
}

/** The error text on screen right now — what the user actually read. */
function errorsOnScreen(): string[] {
  if (typeof document === 'undefined') return []
  return [...document.querySelectorAll('[role="alert"]')]
    .map((n) => (n as HTMLElement).innerText?.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4) as string[]
}

/** Called when the dialog opens. Returns plain data; the dialog shows all of it before anything is sent. */
export function getTechnicalDetail(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  return {
    capturedAt: new Date().toISOString(),
    page: window.location.pathname + (window.location.search ? `?${[...new URLSearchParams(window.location.search).keys()].join('&')}=…` : ''),
    errorShownOnScreen: errorsOnScreen(),
    controlsPressedMostRecentLast: clicks.slice(),
    failedRequestsMostRecentLast: calls.slice(),
    uncaughtErrors: errors.slice(),
    browser: { userAgent: navigator.userAgent, viewport: `${window.innerWidth}x${window.innerHeight}` },
  }
}
