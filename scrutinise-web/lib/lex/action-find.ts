// 28 Oct (284) — the actions find box: "63" or "#63" finds ACTION 63 first, wherever it now is (the list, Later phase,
// ruled out, merged away), and says where it went; text matches come below it. Pure — the screen and the check both import it.
//
// Before this, "63" matched any title or statement CONTAINING 63 ("section 63", "#630") and never looked at the set-aside
// rows at all, so an action that had been merged away could not be found by its own number.
import type { CanonicalAction } from './page1-config'

/** "63", "#63", " # 63 " → 63. Anything else (a word, "63 fees", "6.3") → null. */
export function numberQuery(q: string): number | null {
  const m = /^\s*#?\s*(\d{1,6})\s*$/.exec(q)
  return m ? Number(m[1]) : null
}

/** "12 Oct 2026" in the reader's own time zone. null when there is no date. */
export function dayLabel(iso: string | null | undefined, timeZone?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(timeZone ? { timeZone } : {}) })
}

export interface NumberHit {
  action: CanonicalAction
  /** Where it is now, in words: "in the list", "in Later phase", "ruled out on 12 Oct 2026: …", "merged into #207 on 12 Oct 2026". */
  where: string
  /** The LIVE action it now lives in (merged or folded into), when there is one — the screen offers to go there. */
  goTo: CanonicalAction | null
  place: 'list' | 'parked' | 'setAside'
}

/**
 * Action `n` on this idea, from the live list and the set-aside rows together. The date on a set-aside row is the row's last
 * change (`setAsideAt`), which for a row nobody has edited since is the day it was merged or ruled out.
 */
export function findByNumber(n: number, live: CanonicalAction[], setAside: CanonicalAction[], timeZone?: string): NumberHit | null {
  const all = [...live, ...setAside]
  const byId = new Map(all.map((a) => [a.id, a]))
  const a = all.find((x) => x.number === n)
  if (!a) return null
  if (a.status === 'LIVE') {
    return a.parked
      ? { action: a, where: `in Later phase${a.parkedReason ? ` (${a.parkedReason})` : ''}`, goTo: null, place: 'parked' }
      : { action: a, where: 'in the list', goTo: null, place: 'list' }
  }
  const on = dayLabel(a.setAsideAt, timeZone)
  const when = on ? ` on ${on}` : ''
  const into = a.foldedIntoId ?? a.mergedIntoId
  if (a.status === 'ARCHIVED' && into) {
    // follow the chain: #63 merged into #207, which was itself merged into #300 later
    const chain: CanonicalAction[] = []
    let cur = byId.get(into)
    while (cur && chain.length < 20 && !chain.includes(cur)) {
      chain.push(cur)
      const next = cur.status === 'ARCHIVED' ? cur.foldedIntoId ?? cur.mergedIntoId : null
      cur = next ? byId.get(next) : undefined
    }
    const first = chain[0]
    const last = chain[chain.length - 1]
    const verb = a.foldedIntoId ? 'made part of' : 'merged into'
    let where = `${verb} #${first?.number ?? '?'}${when}`
    if (chain.length > 1) where += `; #${first.number ?? '?'} was later merged into #${chain.slice(1).map((c) => c.number ?? '?').join(', then #')}`
    if (last && last.status === 'RULED_OUT') where += ` (#${last.number ?? '?'} is now ruled out)`
    return { action: a, where, goTo: last && last.status === 'LIVE' ? last : null, place: 'setAside' }
  }
  if (a.status === 'ARCHIVED') return { action: a, where: `merged away${when}${a.ruleOutReason ? `: ${a.ruleOutReason}` : ''}`, goTo: null, place: 'setAside' }
  return { action: a, where: `ruled out${when}${a.ruleOutReason ? `: ${a.ruleOutReason}` : ''}`, goTo: null, place: 'setAside' }
}

/** The find box's words: lower-cased, split on spaces. */
export function findWords(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Text match: every word appears in the number, title, statement or Explanation. A word written "#63" matches the number 63
 * only — never #630 or #163.
 */
export function textMatches(a: CanonicalAction, words: string[]): boolean {
  if (!words.length) return true
  const hay = `${a.title ?? ''} ${a.practicalStep} ${a.commentary ?? ''}`.toLowerCase()
  return words.every((w) => {
    const hash = /^#(\d+)$/.exec(w)
    if (hash) return a.number === Number(hash[1]) || new RegExp(`#${hash[1]}(?!\\d)`).test(hay)
    return hay.includes(w) || `#${a.number ?? ''}` === w
  })
}
