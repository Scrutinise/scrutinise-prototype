/**
 * numbered-paras.ts — BRIEF_INGEST_CBA_1 §1. Split HM Treasury guidance whose PARAGRAPHS are numbered
 * at two levels ("6.58 Discounting should not be applied retrospectively…") into one section per
 * paragraph, so the paragraph number is the section key ("Green Book 6.58").
 *
 * Why not shared/heading-split.ts (brief 307): that splitter keys on Managing Public Money's THREE
 * levels (section "3.3", paragraph "3.3.1") and accepts an "N.N" heading only when an "N.N.1" line
 * follows. The Green Book 2026, its supplementary guidance (optimism bias, discounting), the Magenta
 * Book and the Better Regulation Framework number at TWO levels: "N.N" IS the paragraph. Measured on
 * 4 Nov 2026 the 307 splitter returns 0 sections for all five.
 *
 * Rules (PDF text lines, after pdfToText):
 *   - A paragraph starts at "C.P <text>" ONLY when it continues the sequence: same chapter and
 *     P = previous + 1..3 (a skip of 2–3 is accepted and REPORTED as a gap), or a later chapter at
 *     P = 1. Anything else ("1.5 million people…" wrapped onto a new line) is body text.
 *   - "1.1" seen a second time restarts the parse: everything before it was the contents list.
 *   - Page furniture is dropped: bare page numbers, the running title, and "Chapter N: Title"
 *     running headers (their first occurrence names chapter N).
 *   - A short line without closing punctuation directly before a paragraph start is a sub-heading
 *     and becomes part of the path ("Chapter 6: Shortlist appraisal › Discounting › 6.56").
 * Tables are NOT recovered from PDF text (pdfToText glues the cells: "Year012345"); where an HTML
 * edition exists its <table>s are emitted as their own sections by htmlTables().
 */
export interface ParaSection {
  num: string             // "6.58"
  path: string[]          // ['Chapter 6: Shortlist appraisal', 'Discounting']
  text: string
}
export interface ParaSplit { sections: ParaSection[]; gaps: string[]; restarts: number; chapters: Record<string, string> }

const PARA = /^(\d{1,2})\.(\d{1,3})\s+(\S.*)$/
const RUNNING_CHAPTER = /^Chapter\s+(\d{1,2})\s*[:.–-]\s*(\S.{1,90})$/i
const PAGE_NO = /^\d{1,3}$/

export function splitNumberedParagraphs(rawText: string, runningTitle: string | null = null): ParaSplit {
  const lines = rawText.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const chapters: Record<string, string> = {}
  let out: ParaSection[] = []
  let gaps: string[] = []
  let restarts = 0
  let cur: ParaSection | null = null
  let c = 0, p = 0
  let heading: string | null = null
  let pendingHeading: string | null = null
  let annex: string | null = null
  let ap_p = 0

  const front: string[] = []
  // "1.1" a second time restarts the parse ONLY when everything before it reads as a contents
  // list (short entries). After substantive paragraphs, a "1.1" is a numbered cell in a table
  // (Green Book options framework) or an annex example (optimism bias) — body text, not a restart.
  const looksLikeContents = () => {
    if (out.length === 0) return false
    const w = out.map(s => s.text.split(/\s+/).length).sort((a, b) => a - b)
    return w[Math.floor(w.length / 2)] <= 12
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (PAGE_NO.test(l)) continue
    if (runningTitle && l === runningTitle) continue
    const rc = RUNNING_CHAPTER.exec(l)
    if (rc) { if (!chapters[rc[1]]) chapters[rc[1]] = `Chapter ${rc[1]}: ${rc[2].trim()}`; continue }
    // "Chapter 2" alone, its title on the following lines ("Derivation of the" / "discount rate").
    const bare = /^Chapter\s+(\d{1,2})$/i.exec(l)
    if (bare) {
      const t: string[] = []
      let j = i + 1
      while (j < lines.length && t.length < 3 && !PARA.test(lines[j]) && !PARA.test(lines[j + 1] ?? '') && lines[j].length < 60) t.push(lines[j++])
      if (t.length && !chapters[bare[1]]) chapters[bare[1]] = `Chapter ${bare[1]}: ${t.join(' ')}`
      i = j - 1
      continue
    }

    // Annex running header "Annex A: Private finance models" names annex A.
    const ah = /^Annex\s+([A-Z])\s*[:.]\s*(\S.{1,90})$/.exec(l)
    if (ah && !/\s\d{1,3}$/.test(l)) { if (!chapters[ah[1]]) chapters[ah[1]] = `Annex ${ah[1]}: ${ah[2].trim()}`; continue }
    // Annex paragraphs "A.1 …" continue their own sequence once the chapters are done.
    const ap = /^([A-Z])\.(\d{1,3})\s+(\S.*)$/.exec(l)
    if (ap && c > 0) {
      const ap_n = Number(ap[2])
      const same = annex === ap[1] && ap_n > ap_p && ap_n <= ap_p + 3
      const fresh = annex !== ap[1] && ap_n === 1
      if (same || fresh) {
        if (same && ap_n > ap_p + 1) gaps.push(`${ap[1]}.${ap_p + 1} (before ${ap[1]}.${ap_n})`)
        if (fresh) heading = null
        if (pendingHeading) { heading = pendingHeading; pendingHeading = null }
        annex = ap[1]; ap_p = ap_n
        cur = { num: `${ap[1]}.${ap_n}`, path: [], text: ap[3] }
        ;(cur as any)._heading = heading
        out.push(cur)
        continue
      }
    }
    // An unnumbered annex block on its own short line ("Example 1 (Part 1) – Capital Expenditure",
    // "APPENDIX") after the numbered paragraphs: its own section, keyed by its own words.
    if (c > 0 && l.length <= 70 && /^(Example\s+\d+\s*\(Part\s+\d+\)|APPENDIX\b|Appendix\s+[A-Z0-9]+\b|Glossary$|References$|Bibliography$)/.test(l)) {
      cur = { num: l.replace(/\s+/g, ' ').trim(), path: ['Annex'], text: '' }
      ;(cur as any)._heading = null
      ;(cur as any)._unnumbered = true
      out.push(cur)
      continue
    }

    const m = PARA.exec(l)
    if (m && !annex) {
      const mc = Number(m[1]), mp = Number(m[2])
      const isRestart = mc === 1 && mp === 1 && looksLikeContents()
      const cont = (mc === c && mp > p && mp <= p + 3) || (mc > c && mp === 1)
      if (isRestart || cont) {
        if (isRestart) { out = []; gaps = []; restarts++; heading = null }
        else if (mc === c && mp > p + 1) gaps.push(`${c}.${p + 1}${mp > p + 2 ? `–${c}.${mp - 1}` : ''} (before ${mc}.${mp})`)
        if (mc !== c) heading = null
        if (pendingHeading) { heading = pendingHeading; pendingHeading = null }
        c = mc; p = mp
        cur = { num: `${mc}.${mp}`, path: [], text: m[3] }
        out.push(cur)
        ;(cur as any)._heading = heading
        continue
      }
    }
    // A sub-heading: short, no closing punctuation, and the NEXT content line starts a paragraph.
    const next = lines.slice(i + 1).find(x => !PAGE_NO.test(x)) ?? ''
    // Not a table row: no £ or %, and few digits ("Present values£1,000£971…" is a row, not a heading).
    const digits = (l.match(/\d/g) ?? []).length
    if (l.length <= 80 && !/[.;:,)]$/.test(l) && /^[A-Z]/.test(l) && PARA.test(next) && !/^Table\s+\d/i.test(l) && !/[£%]/.test(l) && digits <= 2) {
      pendingHeading = l
      continue
    }
    if (cur) cur.text += '\n' + l
    else front.push(l)
  }
  // Text before the first paragraph (title page, foreword) is kept as one "front" section,
  // unless the parse restarted — then it was the contents list.
  if (restarts === 0 && front.join(' ').split(/\s+/).length >= 20) out.unshift({ num: '0', path: ['Front matter'], text: front.join('\n') })
  for (const s of out) {
    if (s.num === '0') continue
    if ((s as any)._unnumbered) { delete (s as any)._unnumbered; delete (s as any)._heading; s.text = dekern(s.text); continue }
    const ch = s.num.split('.')[0]
    s.path = [chapters[ch] ?? (/^[A-Z]$/.test(ch) ? `Annex ${ch}` : `Chapter ${ch}`), ...((s as any)._heading ? [(s as any)._heading] : [])]
    delete (s as any)._heading
    s.text = dekern(s.text)
  }
  return { sections: out, gaps, restarts, chapters }
}

/** pdfToText splits the "fr"/"fl"/"fi" ligature in the Green Book's font: "f rom", "f ramework".
 *  A lone "f" before a lower-case run is never a word in this prose, so join it. Counted by the
 *  pilot before and after so the repair is visible, not silent. */
export function dekern(t: string): string {
  return t.replace(/\bf ([rlif][a-z]+)/g, 'f$1')
}

/** HTML <table>s as text: caption (the nearest preceding heading), then one " | "-joined line per row. */
export function htmlTables(html: string): { title: string; text: string; rows: number }[] {
  const out: { title: string; text: string; rows: number }[] = []
  const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim()
  const re = /<table[\s\S]*?<\/table>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const before = html.slice(0, m.index)
    const hs = [...before.matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi)]
    const title = hs.length ? strip(hs[hs.length - 1][1]) : 'Table'
    const rows = [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(r => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => strip(c[1])).join(' | '))
    out.push({ title, text: `${title}\n${rows.join('\n')}`, rows: rows.length })
  }
  return out
}
