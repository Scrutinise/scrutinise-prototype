export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B18 §8 (plan C2) — THE RESEARCH PANEL, AS AN APPENDIX, PER MEASURE.
//
// Charlie: *"CC built the right-hand panel so should know what's in it without needing to
// look."* Agreed, and nobody is sent to screenshot the UI.
//
// ⚠⚠ IT CALLS `buildQuestionPanel`, WHICH IS THE FUNCTION THE BROWSER CALLS.
// `app/api/ideas/[id]/panel/route.ts` GET does `buildQuestionPanel(id, { focusFieldRef })`
// and returns it; this does the same thing and renders the result. It does not re-derive
// the heading set, re-query the evidence, or re-implement the gap wording — a re-derivation
// asserts that two pieces of code agree, which they do until one of them is fixed
// (CLAUDE.md §25.3). If the panel changes, this appendix changes with it.
//
// ⚠ THE PLAN'S HEADING LIST CAME FROM ONE SCREENSHOT AND IS INCOMPLETE, which the plan
// itself said. The panel's own vocabulary is fourteen keys in `question-headings.ts`, of
// which one is retired; the screenshot showed eight, and three of those eight
// (Decisions, Where the research changed my mind, Outputs) are not question headings at all
// — they belong to other panels. The appendix reports what the panel actually carries.
//
// ⚠ AN EMPTY HEADING IS PRINTED WITH ITS STATED GAP, NOT OMITTED. "We looked for X and
// found nothing" and "we never asked about X" are different facts, and `PanelHeading.gap`
// already distinguishes them by typed reason. Dropping empty headings would turn both into
// silence — and silence reads as the first one.
//
//   npx tsx --env-file=.env scripts/b18-export-research-panel.ts             (all twelve)
//   npx tsx --env-file=.env scripts/b18-export-research-panel.ts M-02
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { buildQuestionPanel } from '../lib/lex/question-panel'
import { QUESTION_HEADINGS, HEADING_ORDER } from '../lib/lex/question-headings'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT_DIR = join(__dirname, '../../docs/report_run/appendices')
const ONLY = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null

const L: string[] = []
const w = (s = '') => L.push(s)

function esc(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const refs = ONLY ? [ONLY] : Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)

  w('# Appendix — the Research panel, in full, for each measure')
  w('')
  w(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by `
    + '`scripts/b18-export-research-panel.ts`, which calls `buildQuestionPanel` — the same '
    + 'function that serves the panel to the browser.*')
  w('')
  w('## The panel\'s vocabulary')
  w('')
  w('Every heading the panel can draw, in the order it draws them. A heading with nothing under '
    + 'it is shown with the reason it is empty, because *"we looked and found nothing"* and '
    + '*"we never asked"* are different facts.')
  w('')
  w('| # | Heading | What it is looking for |')
  w('|---|---|---|')
  HEADING_ORDER.forEach((key, i) => {
    const h = QUESTION_HEADINGS.find((q) => q.key === key)
    if (h) w(`| ${i + 1} | **${esc(h.heading)}** | ${esc(h.lookingFor)} |`)
  })
  w('')
  const retired = QUESTION_HEADINGS.filter((h) => !HEADING_ORDER.includes(h.key))
  if (retired.length) {
    w(`⚠ ${retired.length} heading key(s) exist in the vocabulary but are retired and never `
      + `drawn: ${retired.map((h) => `\`${h.key}\` (${h.heading})`).join(', ')}. `
      + 'Rows stored under a retired key are redirected on read, not lost.')
    w('')
  }
  w('---')
  w('')

  for (const ref of refs) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue

    const panel = await buildQuestionPanel(ideaId, { focusFieldRef: null })
    const filled = panel.headings.filter((h) => h.entries.length).length

    w(`## ${ref} — ${idea.title}`)
    w('')
    w(`**${panel.totalEntries} entries** across **${filled} of ${panel.headings.length} headings**.`
      + (panel.unfiled.length
        ? ` ⚠ **${panel.unfiled.length} entries resolve to no heading** and are listed at the end — `
          + 'a gap in the library, not sources to drop.'
        : ''))
    w('')

    for (const h of panel.headings) {
      w(`### ${h.heading}`)
      w('')
      if (!h.entries.length) {
        w(`*Nothing under this heading.* ${h.gap ? `**${esc(h.gap.text)}**` : ''}`)
        if (h.questionsRun.length) w(`Questions that ran: ${h.questionsRun.map(esc).join('; ')}`)
        if (h.questionsNotRun.length) w(`Questions that did **not** run on this draft: ${h.questionsNotRun.map(esc).join('; ')}`)
        w('')
        continue
      }
      if (h.questionsNotRun.length) {
        w(`⚠ Questions filed here that did **not** run on this draft: ${h.questionsNotRun.map(esc).join('; ')}`)
        w('')
      }
      w('| Source | Citation | Standing | Why it matters |')
      w('|---|---|---|---|')
      for (const e of h.entries) {
        const title = e.url ? `[${esc(e.title)}](${e.url})` : esc(e.title)
        const marks = [
          e.yourSource ? '*your document*' : '',
          e.excluded ? `**excluded** (${esc(e.exclusionReason ?? 'no reason recorded')})` : '',
          e.priority ? '**priority**' : '',
        ].filter(Boolean).join(' · ')
        w(`| ${title}${marks ? `<br>${marks}` : ''} | ${esc(e.citation ?? '—')} | ${esc(e.standingLabel)} | ${esc(e.why ?? '_no reason recorded_')} |`)
      }
      w('')
    }

    if (panel.unfiled.length) {
      w('### ⚠ Not filed under any heading')
      w('')
      for (const e of panel.unfiled) w(`- ${esc(e.title)}${e.citation ? ` — ${esc(e.citation)}` : ''}`)
      w('')
    }
    w('---')
    w('')
    console.log(`  ${ref}  ${panel.totalEntries} entries · ${filled}/${panel.headings.length} headings filled`
      + `${panel.unfiled.length ? ` · ⚠ ${panel.unfiled.length} unfiled` : ''}`)
  }

  const out = join(OUT_DIR, ONLY ? `RESEARCH_PANEL_${ONLY}.md` : 'RESEARCH_PANEL_all.md')
  writeFileSync(out, L.join('\n'), 'utf8')
  console.log(`\nwritten: ${out}  (${L.length} lines)`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
