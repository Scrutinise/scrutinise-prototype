export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §4 — GO LOOKING FOR THE EIGHTH SEAM INSTEAD OF WAITING FOR IT.
//
// Seven times correct data has been discarded, or contradicted, at a boundary. The three that
// were caught by re-running something all had the SAME shape:
//
//   · the position register's header said "we hold no signatures" over a table holding 2.06M
//   · `kernelText` read columns a build never writes
//   · the schedule printed 212 rows under the word "instruments" where the count is 120
//
// **In each case a NUMBER OR A CLAIM WAS WRITTEN INTO SOURCE and the thing it described moved.**
// That is checkable without judgement: find every numeric claim about the database in a comment
// or a string, and put the live value beside it.
//
// ⚠ THIS SWEEP DOES NOT DECIDE. It produces a register with the claim, its location, and the
// measured value, for triage. A tool that auto-classified "stale" would be making exactly the
// kind of judgement that has been wrong seven times.
//
// ⚠ AND THE CHECKS ARE NAMED POSITIVELY, ONE PER CLAIM. A generic "does any number in this file
// still hold" is unanswerable; a named query against a named claim either matches or does not.
// A claim with no check is reported AS unchecked rather than as passing — the register counts
// checked, matched, and moved separately.
//
//   npx tsx --env-file=.env scripts/b22-seam-sweep.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs'
import { join, relative } from 'path'
import { prisma } from '../lib/prisma'
import { Pool } from 'pg'

const ROOT = join(__dirname, '../..')
const OUT = join(ROOT, 'docs/report_run/SEAM_REGISTER.md')
const SCAN = ['scrutinise-web/lib', 'scrutinise-web/scripts', 'scripts']

/**
 * A quantity written into source that describes stored data, and the query that settles it.
 *
 * ⚠ EVERY ONE OF THESE WAS FOUND BY THE TEXT SWEEP BELOW, then given a check by hand. The
 * sweep finds candidates; a human decides what each claim is actually asserting, because
 * "60,995" in a sentence about motions and "60,995" in a sentence about sponsorships are
 * different claims about the same number.
 */
interface Claim {
  id: string
  /** What the source says, in its own words. */
  says: string
  /** The number as written. */
  wrote: number
  /** The query that measures the same thing today. Returns one number. */
  sql: string
  /** Why this query is the same question the sentence asks. */
  because: string
}

const CLAIMS: Claim[] = [
  {
    id: 'edm-sponsorships',
    says: '"we hold 60,995 motions and, for each, the member who TABLED it"',
    wrote: 60995,
    sql: `SELECT count(*)::int FROM position_signal_stored
           WHERE signal_type='edm_signature' AND derivation LIKE 'primary-sponsor%' AND superseded_by IS NULL`,
    because: 'The sentence counts tabling signals. This counts them.',
  },
  {
    id: 'edm-signatures-published',
    says: '"against the 2,125,547 signatories Parliament publishes"',
    wrote: 2125547,
    sql: 'SELECT count(*)::int FROM edm_signatory',
    because: 'The sentence contrasts what Parliament publishes with what we held. We now hold them.',
  },
  {
    id: 'extracted-positions',
    says: '"16,196 extracted positions are held and NOT exposed to search"',
    wrote: 16196,
    // ⚠⚠ THE FIRST VERSION OF THIS QUERY COUNTED ALL `graph_position` ROWS AND REPORTED
    // "16,196 → 37,657, MOVED". That was my error and not a seam: 21,461 of those rows record
    // `no-position`, and the sentence is about positions that record A POSITION. Reporting it
    // would have been a false alarm in a register whose whole value is that it is not one —
    // which is the header's own warning about deciding what a claim asserts, arriving one
    // paragraph after I wrote it.
    sql: `SELECT count(*)::int FROM graph_position WHERE polarity IN ('for','against','balanced')`,
    because: 'The 44% error rate and the round-trip figure are both quoted against the rows that '
      + 'record a position, not against rows that record its absence.',
  },
  {
    id: 'positions-round-trip',
    says: '"the quotation round-trips into its own source 98.4% of the time (15,937 found)"',
    wrote: 15937,
    sql: 'SELECT count(*)::int FROM graph_position WHERE extract_found_in_source IS TRUE',
    because: 'The percentage in the appendix is computed from this count and its complement.',
  },
  {
    id: 'positions-never-round-tripped',
    says: 'the appendix computes 98.4% as found/(found+notFound) — silently excluding rows where '
      + 'the check never ran',
    wrote: 0,
    sql: `SELECT count(*)::int FROM graph_position
           WHERE polarity IN ('for','against','balanced') AND extract_found_in_source IS NULL`,
    because: 'A percentage over a population that excludes the untested is a percentage over a '
      + 'sample. If this is not 0, the appendix denominator is smaller than its subject.',
  },
  {
    id: 'starkey-videos',
    says: '"285 videos, 128.4 hours, 1,172,546 words"',
    wrote: 285,
    sql: 'SELECT count(*)::int FROM starkey.video',
    because: 'Quoted in the corpus handoff and in the appendix header.',
  },
  {
    id: 'starkey-passages',
    says: '"6,138 searchable passages"',
    wrote: 6138,
    sql: 'SELECT count(*)::int FROM starkey.passage',
    because: 'Quoted in the handoff. The appendix computes it live; the handoff does not.',
  },
  {
    id: 'ideas-with-done-build',
    says: '"16 ideas with a DONE build, 0 with a complete kernel in those columns"',
    wrote: 16,
    sql: `SELECT count(DISTINCT "ideaId")::int FROM "IdeaBuild" WHERE status='DONE'`,
    because: 'The B18 kernel finding is stated over this population; a bigger one changes the fraction.',
  },
  {
    id: 'crossref-misattribution',
    says: '"nisr/2010/381 is a confirmed misattribution" — one instrument, several rows',
    wrote: 1,
    sql: `SELECT count(DISTINCT source_gid)::int FROM citation_edge
           WHERE source_gid='nisr/2010/381' AND target_act_id LIKE '%ukpga/2005/4%'`,
    because: 'Counted as instruments, which is what the sentence says. Rows would read 4.',
  },
]

/** Numeric claims found in comments and string literals, for triage. */
interface Found { file: string; line: number; text: string; numbers: string[] }

const COUNT_WORDS = /\b(rows?|instruments?|signals?|signator|videos?|passages?|ideas?|measures?|provisions?|judgments?|motions?|positions?|records?|entries|documents?|of \d+|per cent|%)\b/i

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const full = join(dir, e)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (e.endsWith('.ts') && !e.startsWith('_')) out.push(full)
  }
  return out
}

function scan(): Found[] {
  const found: Found[] = []
  for (const rel of SCAN) {
    for (const file of walk(join(ROOT, rel))) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/)
      lines.forEach((line, i) => {
        // Comments and string literals only. A numeric literal in CODE is a threshold or an
        // index; a number in PROSE is a claim about the world, and only the second goes stale
        // silently.
        const isComment = /^\s*(\/\/|\*|\/\*)/.test(line)
        const inString = /['"`][^'"`]*\d[\d,]{3,}[^'"`]*['"`]/.test(line)
        if (!isComment && !inString) return
        // Four significant digits or a thousands separator — smaller numbers are usually
        // section references, years, or limits rather than counts of stored things.
        const numbers = [...line.matchAll(/\b\d{1,3}(?:,\d{3})+\b|\b\d{4,}\b/g)].map((m) => m[0])
        if (!numbers.length) return
        if (!COUNT_WORDS.test(line)) return
        // Years on their own are not counts.
        const meaningful = numbers.filter((n) => !/^(19|20)\d\d$/.test(n))
        if (!meaningful.length) return
        found.push({ file: relative(ROOT, file).replace(/\\/g, '/'), line: i + 1, text: line.trim(), numbers: meaningful })
      })
    }
  }
  return found
}

async function main() {
  mkdirSync(join(ROOT, 'docs/report_run'), { recursive: true })
  const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL })

  console.log('── checking the named claims ──')
  const results: Array<Claim & { now: number | null; err: string | null }> = []
  for (const c of CLAIMS) {
    try {
      const r = await pool.query(c.sql)
      const now = Number(Object.values(r.rows[0])[0])
      results.push({ ...c, now, err: null })
      const moved = now !== c.wrote
      console.log(`  ${moved ? '⚠ MOVED ' : '  holds '} ${c.id.padEnd(26)} wrote ${c.wrote.toLocaleString().padStart(11)}  now ${now.toLocaleString().padStart(11)}`)
    } catch (e) {
      results.push({ ...c, now: null, err: (e as Error).message })
      console.log(`  ? UNCHECKED ${c.id.padEnd(26)} ${(e as Error).message.slice(0, 60)}`)
    }
  }

  const found = scan()
  console.log(`\n── the text sweep found ${found.length} numeric claim(s) in comments and strings ──`)

  const moved = results.filter((r) => r.now !== null && r.now !== r.wrote)
  const held = results.filter((r) => r.now !== null && r.now === r.wrote)
  const unchecked = results.filter((r) => r.now === null)

  const L: string[] = []
  L.push('# The seam register — numeric claims written into source, beside their live values')
  L.push('')
  L.push(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`b22-seam-sweep.ts\`.*`)
  L.push('')
  L.push('CCW-B22 §4 asks us to go looking for the eighth seam rather than wait for it. Three of the')
  L.push('seven had one shape: **a number or a claim written into source, describing something that')
  L.push('then moved.** That shape is checkable without judgement.')
  L.push('')
  L.push('⚠ **This register does not decide anything.** It puts the claim and the measurement side by')
  L.push('side. A tool that auto-classified "stale" would be making the judgement that has been wrong')
  L.push('seven times — a number can move for a good reason, and a number that holds can still be')
  L.push('attached to a sentence that has stopped being true.')
  L.push('')
  L.push('## The named claims')
  L.push('')
  L.push(`**${moved.length} moved · ${held.length} hold · ${unchecked.length} could not be checked.**`)
  L.push('')
  L.push('| | Claim, in the source\'s own words | Written | Now | |')
  L.push('|---|---|---|---|---|')
  for (const r of results) {
    const state = r.now === null ? '?' : r.now === r.wrote ? '✔' : '⚠⚠'
    L.push(`| ${state} | ${r.says.replace(/\|/g, '\\|')} | ${r.wrote.toLocaleString()} `
      + `| ${r.now === null ? `*unchecked — ${r.err?.slice(0, 60)}*` : r.now.toLocaleString()} `
      + `| ${r.now !== null && r.now !== r.wrote ? '**MOVED**' : ''} |`)
  }
  L.push('')
  for (const r of results) {
    if (r.now === null || r.now === r.wrote) continue
    L.push(`### ⚠⚠ \`${r.id}\` — written ${r.wrote.toLocaleString()}, now ${r.now.toLocaleString()}`)
    L.push('')
    L.push(`Source says: ${r.says}`)
    L.push('')
    L.push(`Why this query answers the same question: ${r.because}`)
    L.push('')
    L.push('```sql')
    L.push(r.sql.trim())
    L.push('```')
    L.push('')
  }
  L.push('---')
  L.push('')
  L.push('## Everything the text sweep found, for triage')
  L.push('')
  L.push(`**${found.length} lines** in \`lib/\` and \`scripts/\` state a quantity in a comment or a string`)
  L.push('AND use a counting word. That is a candidate list, not a fault list: most will be accurate,')
  L.push('and several are deliberately historical (*"this was 60,995 when written"* is a fact about a')
  L.push('moment, not a claim about now).')
  L.push('')
  L.push('⚠ **The question to ask of each: would the producer and this sentence still agree if the**')
  L.push('**producer changed today?** Where the answer is no, the sentence needs a query behind it or')
  L.push('a date in front of it.')
  L.push('')
  const byFile = new Map<string, Found[]>()
  for (const f of found) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f])
  const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)
  L.push('| File | Claims | Densest lines |')
  L.push('|---|---|---|')
  for (const [file, fs] of ranked.slice(0, 40)) {
    L.push(`| \`${file}\` | ${fs.length} | ${fs.slice(0, 3).map((f) => f.line).join(', ')} |`)
  }
  L.push('')
  L.push('<details><summary>Every line found</summary>')
  L.push('')
  for (const [file, fs] of ranked) {
    L.push(`**\`${file}\`**`)
    L.push('')
    for (const f of fs) L.push(`- L${f.line} — \`${f.numbers.join('`, `')}\` — ${f.text.replace(/\|/g, '\\|').slice(0, 170)}`)
    L.push('')
  }
  L.push('</details>')
  L.push('')

  writeFileSync(OUT, L.join('\n'), 'utf8')
  console.log(`\nwritten: ${OUT}`)
  console.log(`  ${moved.length} moved · ${held.length} hold · ${unchecked.length} unchecked · ${found.length} candidates for triage`)
  await pool.end()
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
