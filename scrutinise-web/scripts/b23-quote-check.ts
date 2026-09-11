export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B23 §3 — VERIFY FOUR QUOTATIONS AGAINST THE CASE-LAW CORPUS.
//
// The report quotes Osborn, Kennedy (twice) and Jackson from secondary sources. The corpus
// holds the judgments (`corpus_sections`, corpus `tna-caselaw`, id beginning with the
// neutral citation; text in R2 at `r2Key`). For each phrase: is it in the judgment, and at
// which paragraph. Printed as found / not found, with the surrounding words either way —
// never as "correct" on the strength of a search that returned nothing.
//
// ⚠ Matched on CITATION, never on case name (22,184 case names map to more than one
// citation — GRAPH 5). ⚠ A phrase not found is NOT "the quotation is wrong": the corpus
// text is the publisher's, and a judgment the corpus does not hold cannot be checked here.
// Every such row says so.
//
//   npx tsx --env-file=.env scripts/b23-quote-check.ts
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'

const OUT = join(__dirname, '../../docs/report_run/QUOTE_CHECK_B23.md')

interface Check { case: string; citation: string; who: string; asQuoted: string; phrases: string[]
  /**
   * ⚠ Where the corpus does not hold the judgment (it holds NO UKHL at all — see the run log),
   * the fallback is the House of Lords' own publication on publications.parliament.uk, read
   * through the Internet Archive because the live site is a Cloudflare bot challenge to a plain
   * fetch and BAILII is the same. The capture is named in the output; the text is the official
   * one, the route to it is not.
   */
  fallback?: { label: string; urls: string[] }
  /** Anything verified by hand that the automatic speaker read cannot see. */
  note?: string }

/** The four rows of the brief, one phrase per quoted fragment so each can fail on its own. */
const CHECKS: Check[] = [
  {
    case: 'R (Osborn) v Parole Board', citation: '[2013] UKSC 61', who: 'Lord Reed',
    asQuoted: 'that analysis should not "begin and end with the Strasbourg case law"; and that Convention rights are at a "very high level of generality" needing "a substantial body of much more specific domestic law"',
    phrases: ['begin and end with the Strasbourg case law', 'very high level of generality', 'a substantial body of much more specific domestic law'],
  },
  {
    case: 'Kennedy v Charity Commission', citation: '[2014] UKSC 20', who: 'Lord Mance',
    asQuoted: '"the natural starting point in any dispute is to start with domestic law"',
    phrases: ['the natural starting point in any dispute is to start with domestic law', 'natural starting point', 'start with domestic law'],
    note: 'No judge heading precedes paragraph 1 in the corpus text, so the speaker column reads "none before the match". '
      + 'The XML TNA publishes for the judgment (caselaw.nationalarchives.gov.uk/uksc/2014/20/data.xml, fetched 11 Sep 2026) carries '
      + '"LORD MANCE (with whom Lord Neuberger and Lord Clarke agree)" immediately before the Index; the compiled corpus text has '
      + 'dropped it. Paragraphs 1–101 are those of Lord Mance; Lord Toulson begins at [102].',
  },
  {
    case: 'Kennedy v Charity Commission', citation: '[2014] UKSC 20', who: 'Lord Toulson',
    asQuoted: '"a baleful and unnecessary tendency to overlook the common law"; and that it was not the Act\'s purpose that "the common law should become an ossuary"',
    phrases: ['a baleful and unnecessary tendency to overlook the common law', 'baleful', 'the common law should become an ossuary', 'ossuary'],
  },
  {
    case: 'R (Jackson) v Attorney General', citation: '[2005] UKHL 56', who: 'Lord Hope · Lord Steyn · Baroness Hale',
    asQuoted: 'Lord Hope: "Parliamentary sovereignty is no longer, if it ever was, absolute"; Lord Steyn on an attempt "to abolish judicial review"; Baroness Hale on treating "with particular suspicion" an attempt to remove governmental action from judicial scrutiny',
    phrases: ['is no longer, if it ever was, absolute', 'no longer, if it ever was, absolute', 'to abolish judicial review', 'abolish judicial review', 'with particular suspicion', 'particular suspicion'],
    fallback: {
      label: 'House of Lords, publications.parliament.uk (Session 2005–06, judgment of 13 October 2005), Internet Archive capture of 9 November 2021',
      urls: Array.from({ length: 8 }, (_, i) => `https://web.archive.org/web/20211109113039id_/https://publications.parliament.uk/pa/ld200506/ldjudgmt/jd051013/jack-${i + 1}.htm`),
    },
  },
]

/** Whitespace-insensitive, case-insensitive, straight/curly-quote-insensitive search. */
function normalise(s: string): string {
  return s.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"')
    .replace(/ /g, ' ').replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Paragraph number: the nearest preceding "NN. " followed by a capital, which is how both the
 * corpus text and the Lords' HTML carry them (inline, not at a line start). ⚠ A law-report page
 * number ("1 AC 603. If…") matches the same shape, so a number that jumps by more than one over
 * the run before it is dropped as a citation; the excerpt column is the check either way.
 */
function paragraphBefore(text: string, at: number): string | null {
  const before = text.slice(Math.max(0, at - 20000), at)
  const re = /(?:^|\s)(\d{1,3})\.\s+(?=[A-Z“"(])/g
  const found: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(before))) found.push(Number(m[1]))
  // Paragraph numbers run +1. A number that breaks the run and is not itself followed by its
  // own +1 is a citation page or an article number ("article 10. But…"), not a paragraph.
  let cur: number | null = null
  for (let i = 0; i < found.length; i++) {
    const n = found[i]
    if (cur === null || n === cur + 1 || found[i + 1] === n + 1) cur = n
  }
  return cur === null ? null : String(cur)
}

const stripHtml = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ')

/** The nearest preceding judge heading — "LORD REED", "LORD HOPE OF CRAIGHEAD", "BARONESS HALE OF RICHMOND". */
function speakerBefore(text: string, at: number): string {
  const before = text.slice(0, at)
  const re = /(?:^|[\s.])((?:LORD|LADY|BARONESS) [A-Z]{3,}(?: OF [A-Z]{3,})?)(?=[\s:(])/g
  let last: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(before))) last = m[1]
  return last ?? 'none before the match'
}

function around(text: string, at: number, len: number, pad = 220): string {
  const s = Math.max(0, at - pad), e = Math.min(text.length, at + len + pad)
  return text.slice(s, e).replace(/\s+/g, ' ').trim()
}

async function main() {
  const L: string[] = []
  L.push('# QUOTE CHECK — four quotations in Part 4.1 (CCW-B23 §3)')
  L.push('')
  L.push(`*${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · \`scripts/b23-quote-check.ts\` · corpus \`tna-caselaw\`, text read from R2.*`)
  L.push('')
  L.push('⚠ **What a result means.** *Found* = the exact words are in the corpus text of that judgment, at the')
  L.push('paragraph given (the nearest numbered paragraph before the match). *Not found* = the words are not in')
  L.push('the text we hold — which is a reason to check the source, not proof the quotation is wrong. *Not held* =')
  L.push('the corpus has no text for that citation, and nothing about the quotation can be said from here.')
  L.push('')

  const seen = new Map<string, { rows: number; text: string | null; ids: string[] }>()
  const summary: string[] = []
  const summaryAt = L.length

  for (const c of CHECKS) {
    if (!seen.has(c.citation)) {
      const rows = await prisma.corpusSection.findMany({
        where: { corpus: 'tna-caselaw', id: { startsWith: `tna-caselaw:${c.citation}:` } },
        select: { id: true, r2Key: true, status: true, wordCount: true, sourceUrl: true },
        orderBy: { id: 'asc' },
      })
      // ⚠ One judgment can be several sections; sort by the numeric tail so the text reads in order.
      const num = (id: string) => Number(id.split(':').pop())
      rows.sort((a, b) => num(a.id) - num(b.id))
      const parts: string[] = []
      for (const r of rows) {
        const body = r.r2Key ? await r2Get(r.r2Key) : null
        if (body) parts.push(body)
      }
      seen.set(c.citation, { rows: rows.length, text: parts.length ? parts.join('\n\n') : null, ids: rows.map((r) => `${r.id} (${r.status}, ${r.wordCount ?? '?'} words)`) })
      console.log(`${c.citation}: ${rows.length} section(s), ${parts.length} body(ies) read, ${parts.join('').length} chars`)
    }
    const held = seen.get(c.citation)!
    L.push(`## ${c.case} ${c.citation} — ${c.who}`)
    L.push('')
    L.push(`**As quoted in the report:** ${c.asQuoted}`)
    L.push('')
    if (!held.rows) {
      L.push(`⚠ **NOT HELD IN THE CORPUS.** No \`corpus_sections\` row begins \`tna-caselaw:${c.citation}:\` — the corpus holds no UKHL judgments at all, so this cannot be checked against the corpus.`)
      L.push('')
      if (!c.fallback) continue
      const parts: string[] = []
      for (const u of c.fallback.urls) {
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 scrutinise-prototype quote check' } }).catch(() => null)
        if (res?.ok) parts.push(stripHtml(await res.text()))
        else L.push(`⚠ fetch failed: ${u} (${res?.status ?? 'no response'})`)
      }
      held.text = parts.length ? parts.join(' ') : null
      console.log(`${c.citation}: fallback ${parts.length}/${c.fallback.urls.length} pages, ${(held.text ?? '').length} chars`)
      L.push(`**Checked instead against:** ${c.fallback.label} — ${parts.length} of ${c.fallback.urls.length} pages read.`)
      L.push('')
    } else {
      L.push(`*Corpus rows:* ${held.ids.join(' · ')}`)
      L.push('')
    }
    if (!held.text) {
      L.push('⚠ **NOT READABLE.** The rows exist but no body came back from R2. Cannot be checked here.')
      L.push('')
      continue
    }
    const norm = normalise(held.text)
    if (c.note) { L.push(`⚠ ${c.note}`); L.push('') }
    L.push('| Phrase | Result | Paragraph | Speaker (nearest heading before) | In the judgment\'s own words |')
    L.push('|---|---|---|---|---|')
    for (const p of c.phrases) {
      const np = normalise(p)
      const at = norm.indexOf(np)
      if (at < 0) {
        L.push(`| "${p}" | ⚠ **not found** | — | — | — |`)
        continue
      }
      // Map the normalised offset back approximately: normalisation only collapses whitespace,
      // so use the normalised text for the excerpt and the raw text for the paragraph scan.
      const rawAt = held.text.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').indexOf(np)
      const para = rawAt >= 0 ? paragraphBefore(held.text, rawAt) : null
      const who = rawAt >= 0 ? speakerBefore(held.text, rawAt) : '?'
      const count = norm.split(np).length - 1
      L.push(`| "${p}" | ✔ found${count > 1 ? ` (×${count})` : ''} | ${para ? `[${para}]` : '?'} | ${who} | …${around(norm, at, np.length).replace(/\|/g, '\\|')}… |`)
    }
    L.push('')
    const foundAll = c.phrases.every((p) => norm.includes(normalise(p)))
    const paras = Array.from(new Set(c.phrases.map((p) => {
      const rawAt = held.text!.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').indexOf(normalise(p))
      return rawAt >= 0 ? paragraphBefore(held.text!, rawAt) : null
    }).filter(Boolean))).map((x) => `[${x}]`).join(', ')
    summary.push(`| ${c.case} ${c.citation} — ${c.who} | ${held.rows ? 'corpus' : (c.fallback ? 'Lords publication (Internet Archive)' : '—')} | ${foundAll ? '✔ **every phrase found, verbatim**' : '⚠ **at least one phrase not found**'} | ${paras || '?'} |`)
  }

  L.splice(summaryAt, 0,
    '## Summary',
    '',
    '| Quotation | Checked against | Result | Paragraph(s) |',
    '|---|---|---|---|',
    ...summary,
    '',
    '⚠ **The corpus holds no House of Lords judgments at all.** `tna-caselaw` is 74,896 rows across EWHC, EWCA,',
    'UKFTT, UKUT, EWFC, UKSC, EAT, EWCOP, UKPC, UKAIT, EWCC, EWCR and UKIPTrib — **0 UKHL** (counted 11 Sep 2026).',
    'So *Jackson* [2005] UKHL 56, and any other Lords authority before October 2009, cannot be checked or cited',
    'from the corpus; it was checked against the publication by the House of Lords itself instead, and the route to that',
    'text is named. This is a corpus-coverage fact the report should carry wherever it relies on a Lords case.',
    '',
  )

  L.push('---')
  L.push('')
  L.push('⚠ The paragraph number is read off the text by finding the nearest preceding numbered paragraph. Where')
  L.push('the judgment\'s paragraphs are not numbered in the text we hold it prints `?`, and the excerpt is the')
  L.push('check. Excerpts are the corpus text lower-cased and whitespace-collapsed.')
  L.push('')
  writeFileSync(OUT, L.join('\n'), 'utf8')
  console.log(`written: ${OUT}`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
