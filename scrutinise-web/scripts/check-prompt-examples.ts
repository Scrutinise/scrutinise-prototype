// ─────────────────────────────────────────────────────────────────────────────
// 25-V §4a — SWEEP EVERY PROMPT FOR AN ILLUSTRATIVE EXAMPLE A MODEL COULD RETURN AS CONTENT.
//
// 25-U found one and it reached a printed report: `deepening-client.ts` illustrated its rule 5
// with *"no source quantifies how many bags enter waterways each year"*, and a model copied it
// verbatim onto a civil service accountability proposal, where it rendered under "Questions the
// research could not answer".
//
// ⚠⚠ THE CLASS, NOT THE INSTANCE. A prompt example is a template the model may fill — or lift.
// This finds the quoted illustrations in every prompt the build uses, and then asks the database
// whether each has ever come back as stored output. The second half is what separates a risk from
// a defect.
//
// ⚠ IT IS A REPORT, NOT A GATE. Some examples are the clearest way to teach a rule, and a quoted
// phrase that has never appeared in output is a shape worth knowing about rather than a fault.
// What must not happen is one appearing in output and nobody noticing, which is what happened.
//
// Usage: npx tsx --env-file=.env scripts/check-prompt-examples.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'

const ROOTS = ['lib/lex', 'lib/documents']

/**
 * ⚠⚠ `interrogation-library.ts` IS NOT A SOURCE OF EXAMPLES AND MUST NOT BE SWEPT.
 *
 * Its strings are the QUESTIONS the system asks — "Which enactment, if any, already confers power
 * to make this change?" — and when one of them turns up in stored output that is the library
 * working exactly as designed: the question was asked, and it is recorded as asked. A first
 * version of this sweep counted 30 "leaks" and 24 of them were that. A check that cries wolf on
 * correct behaviour gets switched off, and then it is not there for the real one.
 */
const NOT_EXAMPLES = ['interrogation-library.ts']

/**
 * A quoted phrase is an ILLUSTRATION only where the line around it says so. This is the
 * difference between "here is a question to ask" (content, by design) and "a good answer looks
 * like this" (a template the model may lift).
 */
const ILLUSTRATIVE = /\be\.g\.|for example|for instance|such as|is useless|is an issue|would be|looks like|rather than "|instead of "/i

/** A quoted phrase long enough to be prose rather than a field name or an enum value. */
const QUOTED = /"([^"\n]{28,140})"|'([^'\n]{28,140})'|“([^”\n]{28,140})”/g

/** Lines that are plainly instructions to a model rather than code. */
function promptLines(src: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = []
  src.split('\n').forEach((l, i) => {
    const t = l.trim()
    if (t.startsWith('//') || t.startsWith('*')) return          // comments are not prompts
    if (!/^['"`]/.test(t) && !/:\s*['"`]/.test(t)) return
    if (!/[a-z]{4}\s+[a-z]{3}/i.test(t)) return                   // must read as a sentence
    out.push({ line: i + 1, text: t })
  })
  return out
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

async function main() {
  const files = ROOTS.flatMap((r) => walk(r))
  const candidates: Array<{ file: string; line: number; phrase: string }> = []

  for (const f of files) {
    if (NOT_EXAMPLES.some((n) => f.endsWith(n))) continue
    const src = readFileSync(f, 'utf8')
    for (const { line, text } of promptLines(src)) {
      // ⚠ Only lines that PRESENT the quote as an illustration. See ILLUSTRATIVE.
      if (!ILLUSTRATIVE.test(text)) continue
      // An example is a quoted phrase INSIDE an instruction line.
      QUOTED.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = QUOTED.exec(text))) {
        const phrase = (m[1] ?? m[2] ?? m[3] ?? '').trim()
        if (!phrase) continue
        // Skip things that are obviously not illustrations of content.
        if (/^[A-Z_]+$/.test(phrase)) continue
        if (/^\w+\.\w+/.test(phrase)) continue
        if (!/\s/.test(phrase)) continue
        candidates.push({ file: f.replace(/\\/g, '/'), line, phrase })
      }
    }
  }

  console.log(`\n── ${candidates.length} quoted illustration(s) inside prompt strings ──\n`)

  // ⚠ NOW THE HALF THAT MATTERS: has any of them ever been stored as output?
  const [issues, passes, evidence] = await Promise.all([
    prisma.deepeningIssue.findMany({ select: { ideaId: true, text: true, title: true } }),
    prisma.deepeningPass.findMany({ select: { ideaId: true, knownUnknowns: true } }),
    prisma.evidenceItem.findMany({ select: { ideaId: true, title: true, body: true } }),
  ])
  const haystack = [
    ...issues.map((r) => `${r.title ?? ''} ${r.text}`),
    ...passes.map((r) => JSON.stringify(r.knownUnknowns ?? [])),
    ...evidence.map((r) => `${r.title} ${r.body}`),
  ]

  let leaked = 0
  const seen = new Set<string>()
  for (const c of candidates) {
    const key = c.phrase.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    // A distinctive fragment: the phrase itself is the strongest test available.
    const hits = haystack.filter((h) => h.toLowerCase().includes(key)).length
    if (hits) {
      leaked++
      console.log(`⚠ LEAKED into ${hits} stored row(s)`)
      console.log(`    ${c.file}:${c.line}`)
      console.log(`    "${c.phrase}"`)
    }
  }

  console.log(`\n── ${seen.size} distinct illustrations; ${leaked} found in stored output ──`)
  if (!leaked) console.log('   None of them has ever come back as content.')
  console.log(`   (scanned ${issues.length} challenges, ${passes.length} pass rows, ${evidence.length} findings)`)
  await prisma.$disconnect()
  process.exit(leaked ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
