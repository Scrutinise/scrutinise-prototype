/**
 * gold-caselaw-extract.ts — BRIEF_INGEST_NAMES §1.3, the deliver-first pre-task.
 *
 * The ten CASE LAW questions in `docs/GOLD_CANDIDATES_S8.md` are keyed to judgments whose
 * subject nobody can verify: S8 could read the id back (which proves the row exists) and nothing
 * more. This writes the case NAME and the first ~200 words of the judgment underneath each
 * question, so Charlie can confirm at a glance that the keyed case is about the question's
 * subject without leaving the document.
 *
 * ⚠ THE EXTRACT IS EVIDENCE, NOT AN ANSWER. It is marked as an extract, the name carries its
 * route (`source` = fetched from the National Archives' own metadata), and no judgment is made
 * here about whether the case fits the question. That judgment is Charlie's, which is the whole
 * point of the pre-task.
 *
 *   --dry     print what would be written, change nothing (default)
 *   --apply   rewrite docs/GOLD_CANDIDATES_S8.md in place
 *   --self-test   corrupt each input in turn and show the check failing (§3)
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'
import { nameFromAkn, citationFromAkn, courtFromAkn, judgmentDateFromAkn, firstWords } from '../shared/caselaw-name'

const GOLD = path.join(__dirname, '../../../docs/GOLD_CANDIDATES_S8.md')
const MARKER = '<!-- INGEST-NAMES §1.3 extract -->'

interface Extract {
  qid: string
  key: string
  found: boolean
  title: string | null
  route: string | null
  citation: string | null
  court: string | null
  date: string | null
  words: string | null
  note: string | null
}

/**
 * The ten questions and their keys, read OUT OF the gold document rather than retyped.
 *
 * ⚠ THE HEADING FORMAT IS NOT OURS AND CHANGED UNDER US MID-SPRINT. This file belongs to the
 * search thread, and between the first write of these extracts and the second that thread
 * renumbered every heading (`### K1 —` → `### Q11 · K1 —`) and renamed the decision line
 * (`- **Accept / Reject / Amend:**` → `- **VERDICT →**`). The strict regex matched nothing and
 * the script REFUSED to run and said why — which is the behaviour worth keeping: a silent
 * zero-match would have written nothing and reported success. Both shapes are accepted now, and
 * the refusal on zero matches stays.
 */
const HEADING = /^#{2,3} (?:Q\d+\s*[·.\-]\s*)?(K\d+)\b/
const DECISION_LINE = /^- \*\*(?:VERDICT|Accept \/ Reject \/ Amend)/

function readKeys(md: string): Array<{ qid: string; key: string; headingLine: number }> {
  const lines = md.split('\n')
  const out: Array<{ qid: string; key: string; headingLine: number }> = []
  let current: { qid: string; line: number } | null = null
  for (let i = 0; i < lines.length; i++) {
    const h = HEADING.exec(lines[i])
    if (h) { current = { qid: h[1], line: i }; continue }
    if (!current) continue
    const k = /^- \*\*Key:\*\* `(tna-caselaw:[^`]+)`/.exec(lines[i])
    if (k) { out.push({ qid: current.qid, key: k[1], headingLine: current.line }); current = null }
  }
  return out
}

async function extractOne(pool: ReturnType<typeof getNeonPool>, qid: string, key: string): Promise<Extract> {
  const row = (await pool.query(
    `SELECT id, "r2Key", "r2RawKey", "sourceUrl" FROM corpus_sections WHERE id = $1 AND corpus = 'tna-caselaw'`,
    [key])).rows[0]
  if (!row) {
    return { qid, key, found: false, title: null, route: null, citation: null, court: null, date: null, words: null,
             note: 'NOT IN THE CORPUS — the id does not resolve to a tna-caselaw row.' }
  }
  const raw = row.r2RawKey ? await r2Get(row.r2RawKey) : null
  const compiled = row.r2Key ? await r2Get(row.r2Key) : null
  const name = raw ? nameFromAkn(raw) : null
  return {
    qid, key, found: true,
    title: name?.title ?? null,
    route: name?.route ?? null,
    citation: raw ? citationFromAkn(raw) : null,
    court: raw ? courtFromAkn(raw) : null,
    date: raw ? judgmentDateFromAkn(raw) : null,
    words: compiled ? firstWords(compiled, 200) : null,
    note: raw ? (compiled ? null : 'compiled text missing from R2') : 'raw AKN XML missing from R2',
  }
}

function renderBlock(e: Extract): string {
  const L: string[] = []
  L.push(MARKER)
  L.push('')
  L.push('> **Extract for verification (INGEST, 19 Aug 2026) — not part of the question.**')
  if (!e.found) {
    L.push('>')
    L.push(`> ⚠⚠ **${e.note}**`)
    L.push('')
    return L.join('\n')
  }
  L.push('>')
  L.push(`> **Case name:** ${e.title ? `**${e.title}**` : '⚠ NOT ESTABLISHED — the field stays null.'}`)
  L.push(`> **Route:** \`${e.route ?? 'none'}\` — ${e.route === 'source'
    ? 'fetched from the judgment\'s own Akoma Ntoso metadata (`FRBRname`), not parsed from text.'
    : 'no structured name was available.'}`)
  L.push(`> **Source states:** citation \`${e.citation ?? '—'}\` · court \`${e.court ?? '—'}\` · judgment date \`${e.date ?? '—'}\``)
  if (e.note) L.push(`> ⚠ ${e.note}`)
  L.push('>')
  L.push('> **First ~200 words of the judgment:**')
  L.push('>')
  const words = e.words ?? '⚠ no compiled text held.'
  for (const chunk of wrap(words, 92)) L.push(`> ${chunk}`)
  L.push('')
  return L.join('\n')
}

function wrap(s: string, width: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of s.split(' ')) {
    if (line.length + w.length + 1 > width) { out.push(line); line = w } else { line = line ? `${line} ${w}` : w }
  }
  if (line) out.push(line)
  return out
}

/**
 * Insert each block immediately after its question's `- **Accept / Reject / Amend:**` line.
 * Idempotent: an existing block for that question is REPLACED, not appended to, so re-running
 * cannot stack duplicates.
 */
function apply(md: string, extracts: Extract[]): string {
  let lines = md.split('\n')
  for (const e of extracts) {
    // Locate this question's section.
    const start = lines.findIndex(l => HEADING.exec(l)?.[1] === e.qid)
    if (start < 0) throw new Error(`heading for ${e.qid} not found`)
    let end = lines.findIndex((l, i) => i > start && (l.startsWith('### ') || l.startsWith('## ')))
    if (end < 0) end = lines.length
    // Drop any previous block inside this section.
    const section = lines.slice(start, end)
    const prev = section.findIndex(l => l.trim() === MARKER)
    if (prev >= 0) {
      let stop = prev + 1
      while (stop < section.length && (section[stop].startsWith('>') || section[stop].trim() === '')) stop++
      section.splice(prev, stop - prev)
    }
    // Insert after the Accept/Reject/Amend line, or at the end of the section if absent.
    let at = section.findIndex(l => DECISION_LINE.test(l))
    at = at < 0 ? section.length : at + 1
    section.splice(at, 0, '', ...renderBlock(e).split('\n'))
    lines = [...lines.slice(0, start), ...section, ...lines.slice(end)]
  }
  return lines.join('\n')
}

// ── §3: every check watched failing first ────────────────────────────────────────────────────
// Each case feeds a DELIBERATELY BROKEN input to the same code the real run uses and asserts the
// failure. A check that has only ever been seen passing is not a check.
async function selfTest(): Promise<void> {
  const cases: Array<{ name: string; run: () => boolean }> = [
    {
      name: 'a judgment with no FRBRname yields NO title (not a citation-shaped placeholder)',
      run: () => nameFromAkn('<akomaNtoso><uk:cite>[2021] EWHC 123</uk:cite></akomaNtoso>') === null,
    },
    {
      name: 'readKeys finds nothing when the Key line format changes',
      run: () => readKeys('### K1 - x\n- **Key:** tna-caselaw:[2015] UKSC 21:1 no backticks\n').length === 0,
    },
    {
      name: 'apply() throws when a question heading is missing',
      run: () => {
        try {
          apply('## CASE LAW SECTION\n', [{ qid: 'K1', key: 'x', found: false, title: null, route: null,
                                    citation: null, court: null, date: null, words: null, note: 'x' }])
          return false
        } catch { return true }
      },
    },
    {
      name: 'the CSS strip removes the stylesheet and keeps the judgment',
      run: () => firstWords('#judgment .Normal { font-size: 12pt; } Neutral Citation Number', 5)
        === 'Neutral Citation Number',
    },
    {
      name: 'an EMPTY css rule does not stop the strip (the 8-of-30 defect)',
      run: () => firstWords('#judgment .PageNumber { } #judgment .A { font-size: 1pt; } Neutral Citation Number', 5)
        === 'Neutral Citation Number',
    },
    {
      name: 'a brace INSIDE the judgment does not move the cut (the over-trim failure)',
      run: () => firstWords(
        '#judgment .Normal { font-size: 12pt; } Neutral Citation Number: [2004] EWHC 1 (Ch) '
        + 'and the clause read "{sic}" as drafted, which the judge considered', 3)
        === 'Neutral Citation Number: …',
    },
  ]
  let pass = 0
  for (const c of cases) {
    const ok = c.run()
    console.log(`  ${ok ? '✓ FIRED' : '✗ DID NOT FIRE'}  ${c.name}`)
    if (ok) pass++
  }
  console.log(`\nself-test: ${pass}/${cases.length} breaks fired`)
  if (pass !== cases.length) process.exit(1)
}

;(async () => {
  if (process.argv.includes('--self-test')) { await selfTest(); return }

  const md = fs.readFileSync(GOLD, 'utf8')
  const keys = readKeys(md)
  console.log(`found ${keys.length} keyed case-law questions in GOLD_CANDIDATES_S8.md`)
  if (keys.length === 0) { console.error('FAIL: no keys parsed — the document format changed.'); process.exit(1) }

  const pool = getNeonPool()
  const extracts: Extract[] = []
  for (const k of keys) {
    const e = await extractOne(pool, k.qid, k.key)
    extracts.push(e)
    console.log(`  ${e.qid.padEnd(4)} ${e.key.padEnd(34)} ${e.title ? `→ ${e.title}` : `→ ⚠ ${e.note ?? 'no title'}`}`)
  }
  await endNeonPool()

  const recovered = extracts.filter(e => e.title).length
  console.log(`\nnames established: ${recovered}/${extracts.length} (route: ${[...new Set(extracts.map(e => e.route).filter(Boolean))].join(', ') || 'none'})`)

  if (process.argv.includes('--apply')) {
    const out = apply(md, extracts)
    fs.writeFileSync(GOLD, out, 'utf8')
    console.log(`WROTE ${GOLD} (+${out.split('\n').length - md.split('\n').length} lines)`)
  } else {
    console.log('\n--- DRY RUN, first block ---')
    console.log(renderBlock(extracts[0]))
    console.log('(pass --apply to write)')
  }
})().catch(e => { console.error(e); process.exit(1) })
