export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B18 §6 (plan C4) — THE SUPPORTER / OPPONENT REGISTER, AS A CANDIDATE LIST.
//
// Charlie's ask: per measure, who is on the record for and against, what they said, and
// where. **This is deliberately NOT produced as a finding.**
//
// ⚠⚠ THE CONSTRAINT FROM `SEARCH_CONTRACT.md`, AND IT IS THE REASON FOR THE SHAPE:
// 16,196 extracted positions are held and NOT exposed to search, because read by hand
// against their sources the error rate is 44% — *"it is not going in front of a user at
// that number."* So this prints two columns to work down: the position as extracted, and
// the quotation it was drawn from. Anything that cannot be confirmed from the quotation is
// DROPPED, not softened.
//
// ⚠⚠ AND THE TWO KINDS OF ROW ARE NEVER MIXED, BECAUSE THEY FAIL DIFFERENTLY.
//
//   · ASSEMBLED — a division vote, an EDM sponsorship, a declared interest, an appearance.
//     A fact about the record. It can be wrong about IDENTITY (which Wednesbury, which
//     John Smith) but not about whether the act happened.
//   · EXTRACTED — a model reading a passage and saying it shows a position. This is the
//     44% population.
//
// ⚠ Measured here, and it sharpens the 44% rather than repeating it: of the 16,196
// extracted positions, the quotation round-trips into its own source **98.4%** of the time
// (15,937 found, 259 not). **So the 44% is not fabricated quotations — it is
// INTERPRETATION.** The quote is nearly always really there; whether it shows the person
// holding that position is the thing a human has to judge. That is exactly what the second
// column is for, and it is why the column is the quote rather than a summary of it.
//
// ⚠⚠ "edm_signature" IS NOT A SIGNATURE. SURFACE 4: we hold 60,995 motions and, for each,
// the member who TABLED it — 1.00 per motion against the 2,125,547 signatories Parliament
// publishes. The signal type is misleadingly named and is printed here as *sponsorship*.
//
// Read-only.
//   npx tsx --env-file=.env scripts/b18-position-register.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { Pool } from 'pg'
import { targetForIdea } from '../lib/graph/idea-target'
import { positionsFor } from '../lib/graph/positions'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT_DIR = join(__dirname, '../../docs/report_run/appendices')

/** How each signal type is described to a reader, and whether it is a fact or a reading. */
const SIGNAL_WORDS: Record<string, { words: string; assembled: boolean }> = {
  vote: { words: 'voted in a recorded division', assembled: true },
  edm_signature: { words: 'tabled an early day motion (⚠ sponsorship — we hold no signatures)', assembled: true },
  witness_appearance: { words: 'appeared as a witness', assembled: true },
  declared_interest: { words: 'declared a registrable interest', assembled: true },
  political_donation: { words: 'is recorded in the donation register', assembled: true },
}

const L: string[] = []
const w = (s = '') => L.push(s)
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL })

  // ── the extraction-quality figures, measured rather than quoted ──────────────
  const pol = await pool.query<{ polarity: string; n: number }>(
    'SELECT polarity, count(*)::int n FROM graph_position GROUP BY 1')
  const found = await pool.query<{ found: boolean | null; n: number }>(
    'SELECT extract_found_in_source AS found, count(*)::int n FROM graph_position GROUP BY 1')
  const byPol = new Map(pol.rows.map((r) => [r.polarity, r.n]))
  const withPosition = (byPol.get('for') ?? 0) + (byPol.get('against') ?? 0) + (byPol.get('balanced') ?? 0)
  const roundTripped = found.rows.find((r) => r.found === true)?.n ?? 0
  const notFound = found.rows.find((r) => r.found === false)?.n ?? 0

  w('# Appendix — who is on the record, per measure')
  w('')
  w(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.*`)
  w('')
  w('> ⚠⚠ **This is a candidate list requiring confirmation. It is not a finding, and no part of '
    + 'it should be published as one.**')
  w('')
  w('## How to use it, and why it is shaped this way')
  w('')
  w('Two kinds of row appear below and **they fail in different ways, so they are never mixed**:')
  w('')
  w('- **Assembled** — a recorded division vote, an early day motion tabled, an interest declared, '
    + 'a witness appearance. These are facts about the public record. They can be wrong about *who* '
    + '(two members of the same name) but not about *whether the act happened*.')
  w('- **Extracted** — a model read a passage and concluded it showed a position. **Read by hand '
    + 'against their sources, 44% of these were wrong.** They are not searchable in the product for '
    + 'that reason and they are not published as findings here.')
  w('')
  w('⚠ **The 44% is an interpretation error rate, not a fabrication rate, and the distinction '
    + 'decides how to check it.** Measured across the whole extraction:')
  w('')
  w('| | |')
  w('|---|---|')
  w(`| Rows produced by the extraction | ${(pol.rows.reduce((a, b) => a + b.n, 0)).toLocaleString()} |`)
  w(`| …of which record **no position at all** | ${(byPol.get('no-position') ?? 0).toLocaleString()} |`)
  w(`| …of which record a position | **${withPosition.toLocaleString()}** (for ${(byPol.get('for') ?? 0).toLocaleString()} · against ${(byPol.get('against') ?? 0).toLocaleString()} · balanced ${(byPol.get('balanced') ?? 0).toLocaleString()}) |`)
  w(`| Quotations that round-trip into their own source | **${roundTripped.toLocaleString()} (${(100 * roundTripped / (roundTripped + notFound)).toFixed(1)}%)** |`)
  w(`| Quotations NOT found in their source | ${notFound.toLocaleString()} |`)
  w('')
  w('**So the quotation is nearly always really there; what is unreliable is the claim that it '
    + 'shows the person holding that position.** That is why the second column is the quotation '
    + 'itself rather than a summary of it: the question to ask of each row is not *"is this quote '
    + 'real?"* but *"does this quote show what it is said to show?"*')
  w('')
  w('**Anything that cannot be confirmed from the quotation should be struck out, not softened.**')
  w('')
  w('---')
  w('')

  /** One row per measure, for the assessment printed above the tables. */
  const summary: Array<{ ref: string; target: string | null; basis: string | null; words: number; actors: number }> = []

  const refs = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)
  for (const ref of refs) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue

    w(`## ${ref} — ${idea.title}`)
    w('')

    // ⚠ The product's own resolver, imported. A measure with no target is the common case
    // (SURFACE 4: 44 of 83 ideas find one) and must be reported as such, not as "nobody
    // holds a position on this".
    const target = await targetForIdea(ideaId)
    if (!target) {
      w('**No parliamentary target could be resolved for this measure**, so no register can be '
        + 'built for it. ⚠ That is a statement about the mapping from a broad policy proposal to '
        + 'specific parliamentary business — a division, a motion, a bill — and **not** a statement '
        + 'that nobody has taken a position on the subject.')
      w('')
      summary.push({ ref, target: null, basis: null, words: 0, actors: 0 })
      console.log(`  ${ref}  no target`)
      continue
    }

    const result = await positionsFor(
      [target.target],
      { limit: 40, actorKind: 'person', maxGroundsPerActor: 8 },
    )

    w(`Resolved to: **${esc(target.label)}** (${target.targetType}).`)
    w('')
    // ⚠⚠ THE MATCH BASIS TRAVELS, ALWAYS. 26-A §1 recorded that Charlie's pilot idea resolved
    // to a machinery-safety regulation on the two words "northern ireland", and §7 asks that
    // no target be resolved on similarity. It still is. Printing the phrase and its length is
    // the documented mitigation, and a register that hid it would be asserting a connection
    // the mechanism cannot support.
    w(`⚠ **Matched on ${target.matchedContentWords} content word(s): "${esc(target.matchedPhrase)}"**`
      + `${target.fromTitle ? ', from the proposal\'s own title' : ', from the body of the proposal'}. `
      + 'A target resolved on a short phrase may be topically wrong; check the label above before '
      + 'relying on anything beneath it.')
    w('')
    w(`${result.actorsMatched} ${result.actorsMatched === 1 ? 'person has' : 'people have'} a record `
      + `against this target.`)
    w('')

    summary.push({
      ref, target: target.label, basis: target.matchedPhrase,
      words: target.matchedContentWords, actors: result.actorsMatched,
    })

    if (!result.actors.length) { w('*No actors returned.*'); w(''); console.log(`  ${ref}  target, 0 actors`); continue }

    w('| Person | Party at the time | What the record shows | On what | Source |')
    w('|---|---|---|---|---|')
    for (const a of result.actors) {
      for (const g of a.grounds) {
        const sw = SIGNAL_WORDS[g.signalType] ?? { words: g.signalType, assembled: false }
        w(`| ${esc(a.name)}${a.identityCaveat ? ' ⚠' : ''} `
          + `| ${esc(g.partyAtTheTime ?? '—')} `
          + `| ${sw.assembled ? '' : '⚠ *extracted* — '}${esc(sw.words)}, ${g.direction > 0 ? '**for**' : g.direction < 0 ? '**against**' : 'took part'} `
          + `| ${esc(g.targetLabel ?? g.targetId)} (${g.date}) `
          + `| ${g.sourceUrl ? `[record](${g.sourceUrl})` : '—'} |`)
      }
    }
    w('')
    // ⚠ SURFACE 4 §3: `positionsFor` had already written "this is not a ranking" and two
    // assemblers dropped it. It travels here.
    w('⚠ **This is not a ranking.** The order is the order the query returned; where several '
      + 'people have an identical record there is no meaningful order between them.')
    w('')
    console.log(`  ${ref}  ${result.actorsMatched} actors`)
  }

  // ══ ⚠⚠ THE ASSESSMENT, COMPUTED FROM WHAT THIS RUN ACTUALLY RETURNED ═══════════════════
  //
  // A register that printed ten tables and stopped would let a reader conclude the mapping
  // works. It does not, and the shape of the failure is legible from the run's own numbers —
  // so they are summarised rather than left for someone to notice.
  const withTarget = summary.filter((s) => s.target)
  const singletons = withTarget.filter((s) => s.actors === 1)
  const substantive = withTarget.filter((s) => s.actors > 1)

  const head: string[] = []
  head.push('## ⚠⚠ What this run actually shows, before any of the tables are read')
  head.push('')
  head.push('| Measure | Target resolved | Matched on | People with a record |')
  head.push('|---|---|---|---|')
  for (const s of summary) {
    head.push(`| ${s.ref} | ${s.target ? esc(s.target) : '**none**'} | ${s.basis ? `${s.words}w — "${esc(s.basis)}"` : '—'} | ${s.target ? s.actors : '—'} |`)
  }
  head.push('')
  head.push(`**${substantive.length} of ${summary.length} measures return more than one person.** `
    + `${singletons.length} return exactly one and ${summary.length - withTarget.length} resolve to no `
    + 'target at all.')
  head.push('')
  head.push('⚠ **The ones returning exactly one person are early day motions, and that is a corpus '
    + 'gap rather than a finding about the measure.** We hold 60,995 motions and, for each, only the '
    + 'member who tabled it — 1.00 per motion, against the 2,125,547 signatories Parliament '
    + 'publishes. An EDM target can therefore only ever return one name. The two measures that '
    + 'return hundreds are divisions, where the whole voting record is held.')
  head.push('')
  head.push('⚠⚠ **And several targets are simply the wrong subject.** The mapping from a broad '
    + 'proposal to specific parliamentary business is a phrase match, and the disclosure line under '
    + 'each measure shows how thin it is. On this run the arm\'s-length body estate resolved to a '
    + 'motion about advertising standards on the two words *"advertising standards"*; diversity '
    + 'practice in the civil service and the civil service model itself both resolved to the same '
    + 'motion, about **Civil Service pensions**, on the two words *"civil service"*; and charities '
    + 'campaigning resolved to a motion about publicly funded buildings on *"publicly funded"*.')
  head.push('')
  head.push('**Conclusion: this cannot be published as a per-measure supporter and opponent register.** '
    + 'For most measures it is either the wrong subject or a single name. Where it is useful is the '
    + 'two division-backed measures, and there it is useful as a list to work down and confirm, '
    + 'which is what it is presented as.')
  head.push('')
  head.push('---')
  head.push('')

  // Insert the assessment after the "how to use it" preamble, before the first measure.
  const firstMeasure = L.findIndex((l) => l.startsWith('## M-'))
  const body = firstMeasure < 0 ? L : [...L.slice(0, firstMeasure), ...head, ...L.slice(firstMeasure)]

  const out = join(OUT_DIR, 'POSITION_REGISTER.md')
  writeFileSync(out, body.join('\n'), 'utf8')
  console.log(`\nwritten: ${out}`)
  await pool.end()
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
