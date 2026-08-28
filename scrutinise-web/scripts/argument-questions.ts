/**
 * argument-questions.ts — ARGUMENT 1A §3. TEN QUESTIONS OF A NEW SHAPE, AND NOTHING IS SCORED.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A DIFFERENT SHAPE OF QUESTION AND WHY THAT IS THE POINT
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Every existing gold question asks *"find the debate about X"*. These ask *"find me the argument
 * that X"* — and that is the only shape that can settle whether meaning-based search helps debates,
 * open since S7.
 *
 * ⚠ THE UNIT IS THE PARAGRAPH, NOT THE SPEECH AND NOT THE DEBATE. That is what the platform now
 * displays, and keying a whole debate would score a hit on a passage that says nothing.
 *
 * ⚠⚠ AT LEAST THREE OF THE TEN HAVE THEIR ANSWER IN A DEBATE ABOUT A DIFFERENT SUBJECT. That is
 * the whole case for an argument graph and the thing no other system can serve: the strongest
 * "nobody will enforce it" argument for a short-term lets licensing scheme was made about Sunday
 * trading in 1985, and the strongest "it will just move underground" argument was made about wine
 * auctions in 1944. Seven of the ten qualify; each is flagged.
 *
 * ⚠ EVERY KEY IS VERIFIED BY READING THE PARAGRAPH BACK OUT OF R2, and the confirming term is
 * declared in this file BEFORE the read. Four wrong keys in the first gold set and 138 unsound
 * position candidates both came from claims asserted without reading the source.
 *
 * ⚠⚠ NOTHING IS SCORED AGAINST THESE. A number scored against an unvalidated key is the mistake the
 * whole instrument exists to prevent. They go to Charlie, exactly as the committees re-key did.
 *
 * Usage:  npm run argument:questions
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import type { Tag } from './argument/taxonomy'

const OUT = path.join(__dirname, '../../docs/ARGUMENT_QUESTIONS_V1.md')

interface Key { chunkId: string; confirm: string }
interface Question {
  n: number
  /** As a real user would put it — not corpus vocabulary. */
  question: string
  tag: Tag
  /** ⚠ True where the keyed paragraph sits in a debate about something else entirely. */
  crossSubject: boolean
  /** What the user is asking about, where that differs from what the debate was about. */
  askedAbout?: string
  why: string
  keys: Key[]
}

const QUESTIONS: Question[] = [
  {
    n: 1, tag: 'ENFORCEMENT', crossSubject: true, askedAbout: 'a licensing scheme for short-term lets',
    question: "If we set up a licensing scheme for short-term lets, what's the strongest argument that nobody will actually enforce it?",
    why: 'Nothing in the corpus is about short-term lets licensing. The strongest enforcement arguments were made about social housing regulation in 2016 and about Sunday trading in 1985 and 1994, and every one of them transfers without modification.',
    keys: [
      { chunkId: 'pwdata-debates:debates2016-01-05d:678#0', confirm: 'do not have the resources' },
      { chunkId: 'pwdata-debates:debates1985-05-20a:230#0', confirm: 'not enforcing it' },
      { chunkId: 'pwdata-debates:debates1994-02-23a:423#0', confirm: 'wasted effort' },
    ],
  },
  {
    n: 2, tag: 'UNINTENDED', crossSubject: true, askedAbout: 'banning the sale of a product outright',
    question: 'If we ban selling something outright, what is the argument that it will just move underground?',
    why: 'The displacement argument in its cleanest form was made in 1944 about the auction of wines and spirits, and in the Lords in the 1980s about a quite different activity. Neither debate is about the product any modern user would be asking about.',
    keys: [
      { chunkId: 'pwdata-debates:debates1944-03-22a:268#0', confirm: 'drive sales underground' },
      { chunkId: 'historic-hansard:S5LV0430P0:1761#0', confirm: 'driving it underground' },
    ],
  },
  {
    n: 3, tag: 'PRECEDENT', crossSubject: true, askedAbout: 'whether other countries have tried a policy first',
    question: 'Has anything like this been tried in other countries, and what happened when they did?',
    why: 'The comparative argument, with the outcome attached rather than merely asserted. Made in 1991 on the War Crimes Bill about Australia and Canada — a subject unrelated to almost anything a user would be proposing.',
    keys: [
      { chunkId: 'historic-hansard:S5LV0528P0:2603#0', confirm: 'frustration, futility and fiasco' },
      { chunkId: 'historic-hansard:S4V0139P0:2555#0', confirm: 'legislate in a panic' },
    ],
  },
  {
    n: 4, tag: 'EVIDENCE_GAP', crossSubject: true, askedAbout: 'a measure whose premise has not been established',
    question: "What's the strongest argument that we are legislating without any evidence the problem is real?",
    why: 'Lord Taylor in 1961 on the Public Health Bill: no evidence tuberculosis is spread by food, therefore reject the clause. The structure — no evidence for the premise, therefore no clause — is the argument, and the subject is incidental.',
    keys: [
      { chunkId: 'historic-hansard:S5LV0228P0:1989#0', confirm: 'no evidence that tuberculosis' },
      { chunkId: 'committees-reports:publication:11130:arc-0009#0', confirm: 'hard evidence of direct economic benefit' },
    ],
  },
  {
    n: 5, tag: 'WRONG_VEHICLE', crossSubject: false,
    question: "What's wrong with a Bill that leaves all the detail to regulations made later by ministers?",
    why: 'The skeleton-bill objection, stated both by a backbencher in 1983 and by the committee whose job it is. Not cross-subject: the objection is ABOUT legislating, so the debates are too.',
    keys: [
      { chunkId: 'pwdata-debates:debates1983-04-27a:446#0', confirm: 'unfettered powers' },
      { chunkId: 'committees-reports:publication:2750:27198#1', confirm: 'licence to legislate' },
    ],
  },
  {
    n: 6, tag: 'SCOPE', crossSubject: true, askedAbout: 'a new offence drawn widely',
    question: 'What is the argument that a new offence is drawn so widely it will catch people who have done nothing wrong?',
    why: 'The 1927 Trade Disputes Bill names exactly who is wrongly caught and how — law-abiding citizens, without their knowledge. The 1954 Television Bill supplies the other half, an over-broad phrase with an absurd consequence spelled out.',
    keys: [
      { chunkId: 'historic-hansard:S5LV0068P0:601#0', confirm: 'meshes of the Criminal Law' },
      { chunkId: 'historic-hansard:S5LV0188P0:2645#0', confirm: 'too widely drawn' },
    ],
  },
  {
    n: 7, tag: 'COST', crossSubject: false,
    question: 'What is the argument against giving councils a new duty without giving them the money for it?',
    why: 'The unfunded-duty objection stated as a principle about how the House should legislate, rather than as a complaint about one settlement.',
    keys: [
      { chunkId: 'pwdata-debates:debates2007-02-23b:11#0', confirm: 'without the money to go with it' },
      { chunkId: 'historic-hansard:S5LV0520P0:6876#0', confirm: 'additional money will be forthcoming' },
    ],
  },
  {
    n: 8, tag: 'IMPLEMENTATION', crossSubject: true, askedAbout: 'whether a scheme can be operated as drafted',
    question: 'Has anyone argued that a scheme like this simply cannot be operated as it is written?',
    why: 'The Intestates\' Estates Bill of 1952 — "completely unworkable", with the kinds of case that would break it. A user asking this will not be asking about intestacy.',
    keys: [
      { chunkId: 'historic-hansard:S5LV0178P0:1390#0', confirm: 'completely unworkable' },
      { chunkId: 'historic-hansard:S5LV0397P0:2390#0', confirm: 'dead letter' },
    ],
  },
  {
    n: 9, tag: 'RIGHTS', crossSubject: false,
    question: 'What is the argument that a Bill reverses the presumption of innocence?',
    why: 'Two statements of the same objection ninety years apart, one from the 1930s and one tied to an international instrument the Government had just signed.',
    keys: [
      { chunkId: 'pwdata-debates:debates1934-11-07a:394#0', confirm: 'presumed guilty' },
      { chunkId: 'pwdata-debates:debates1949-05-03a:433#0', confirm: 'Charter of Human Rights' },
    ],
  },
  {
    n: 10, tag: 'SUPPORT_EVIDENCE', crossSubject: true, askedAbout: 'evidence that an arrangement already works somewhere',
    question: 'Is there evidence that an arrangement like this already works somewhere else in the UK?',
    why: 'The affirmative move, which the taxonomy needs at least one of: the Scotland Bill 1978 pointing at Northern Ireland, and an 1860 Commons debate pointing at England and rural Scotland.',
    keys: [
      { chunkId: 'historic-hansard:S5LV0389P0:2876#0', confirm: 'worked quite well in Northern Ireland' },
      { chunkId: 'historic-hansard:gapday:commons:1860/jun/12:42#0', confirm: 'worked very well in England' },
    ],
  },
]

function around(body: string, term: string, width = 700): string | null {
  const flat = body.replace(/\s+/g, ' ').trim()
  const i = flat.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return null
  const back = flat.lastIndexOf('. ', i)
  let start: number, cut = false
  if (back >= 0 && i - back < 400) start = back + 2
  else { start = Math.max(0, i - 250); if (start > 0) { const sp = flat.indexOf(' ', start); start = sp < 0 ? start : sp + 1; cut = true } }
  let end = flat.indexOf('. ', i)
  end = end < 0 || end - i > 450 ? Math.min(flat.length, i + 350) : end + 1
  return (cut ? '… ' : '') + flat.slice(start, end).trim().slice(0, width)
}

async function main() {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  const ids = Array.from(new Set(QUESTIONS.flatMap((q) => q.keys.map((k) => k.chunkId.replace(/#\d+$/, '')))))
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, corpus, "sectionTitle", speaker, "itemDate", "wordCount" AS w, "r2Key"
    FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`
  const meta = new Map(rows.map((r) => [r.id, r]))

  let keys = 0, read = 0, confirmed = 0, missing = 0
  const out: string[] = []
  out.push('# ARGUMENT QUESTIONS V1 — TEN QUESTIONS OF A NEW SHAPE')
  out.push('')
  out.push(`*Generated by \`scripts/argument-questions.ts\` at ${stamp}. Every keyed paragraph below was`)
  out.push('read back out of R2 by this run; the text printed under each key is that stored text.*')
  out.push('')
  out.push('## What is different about these')
  out.push('')
  out.push('Every existing gold question asks **"find the debate about X"**. These ask **"find me the')
  out.push('argument that X"**. The unit of a correct answer is the **paragraph**, not the speech and not')
  out.push('the debate, because the paragraph is what the platform displays.')
  out.push('')
  out.push('⚠⚠ **Seven of the ten have their answer in a debate about a different subject**, and that is')
  out.push('the case for an argument graph rather than a decoration on it. The strongest *"nobody will')
  out.push('enforce it"* argument for a short-term lets licensing scheme was made about **Sunday trading')
  out.push('in 1985**; the strongest *"it will just move underground"* argument was made about **wine')
  out.push('auctions in 1944**. No keyword or topic search can reach either of them from the question.')
  out.push('')
  out.push('⚠ **Nothing is scored against these.** They are a proposal for Charlie to validate, exactly')
  out.push('as the committees re-key is. A number scored against an unvalidated key is the mistake this')
  out.push('instrument exists to prevent.')
  out.push('')

  for (const q of QUESTIONS) {
    out.push('---')
    out.push('')
    out.push(`## ${q.n}. ${q.tag}${q.crossSubject ? ' · ⚠ ANSWER IS IN A DEBATE ABOUT A DIFFERENT SUBJECT' : ''}`)
    out.push('')
    out.push(`**Question:** ${q.question}`)
    out.push('')
    out.push(`- **Tag exercised:** \`${q.tag}\``)
    if (q.askedAbout) out.push(`- **What the user is asking about:** ${q.askedAbout}`)
    out.push(`- **Keys:** ${q.keys.length} paragraph${q.keys.length === 1 ? '' : 's'}`)
    out.push('')
    out.push(q.why)
    out.push('')
    for (const k of q.keys) {
      keys++
      const m = meta.get(k.chunkId.replace(/#\d+$/, ''))
      if (!m) { missing++; out.push(`- \`${k.chunkId}\` — ⚠ **ABSENT from \`corpus_sections\`. NOT A USABLE KEY.**`); continue }
      const body = m.r2Key ? await r2Get(m.r2Key).catch(() => null) : null
      if (body === null) { missing++; out.push(`- \`${k.chunkId}\` — ⚠ **body not readable from R2. NOT A USABLE KEY.**`); continue }
      read++
      const quote = around(body, k.confirm)
      if (quote) confirmed++
      const day = m.itemDate ? new Date(m.itemDate).toISOString().slice(0, 10) : 'undated'
      out.push(`- \`${k.chunkId}\` — ${m.speaker ?? '(no speaker recorded)'}, ${day}, ${m.w} words`)
      out.push(`  <br>**Debate:** *${String(m.sectionTitle ?? '(untitled)').slice(0, 180)}*`)
      out.push('')
      out.push(quote ? `  > ${quote}` : `  > ⚠ **UNCONFIRMED — the declared term \`${k.confirm}\` is not in the stored body.** First 300 characters as read: ${body.replace(/\s+/g, ' ').trim().slice(0, 300)}`)
      out.push('')
    }
  }

  out.push('---')
  out.push('')
  out.push('## What this run counted')
  out.push('')
  out.push(`- Questions: **${QUESTIONS.length}**`)
  out.push(`- Cross-subject questions (answer in a debate about something else): **${QUESTIONS.filter((q) => q.crossSubject).length}**, floor 3`)
  out.push(`- Tags exercised: **${new Set(QUESTIONS.map((q) => q.tag)).size} of 10**`)
  out.push(`- Keys: **${keys}** · bodies read from R2: **${read}** · containing their declared confirming term: **${confirmed}** · unusable: **${missing}**`)
  out.push('')

  fs.writeFileSync(OUT, out.join('\n'), 'utf8')
  console.log(`wrote ${OUT}`)
  console.log(`questions ${QUESTIONS.length} · cross-subject ${QUESTIONS.filter((q) => q.crossSubject).length} · tags ${new Set(QUESTIONS.map((q) => q.tag)).size}/10 · keys ${keys} · read ${read} · confirmed ${confirmed} · missing ${missing}`)
  await prisma.$disconnect()
  if (missing > 0 || confirmed !== read) process.exitCode = 1
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
