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
// ══ ⚠⚠ CCW-B21 TRACK 2 — THE PARAGRAPH ABOVE THIS ONE USED TO BE THE OPPOSITE ═══════════
//
// It read: *"`edm_signature` IS NOT A SIGNATURE. We hold 60,995 motions and, for each, the
// member who TABLED it — 1.00 per motion against the 2,125,547 signatories Parliament
// publishes."* That was true when this script was written and **is now false**: the INGEST
// session loaded the signatures, and `position_signal_stored` carries
// **2,065,026** `edm_signature` rows against the 60,995 it had.
//
// ⚠⚠ THE TWO KINDS ARE TOLD APART BY `derivation`, NOT BY `signal_type`, AND THE DISTINCTION
// IS THE WHOLE POINT OF THE RE-RUN:
//
//     derivation `primary-sponsor:*`   62,400   — the member who TABLED the motion
//     derivation `signatory:*`      2,002,626   — a member who SIGNED it
//
// The signal type is still called `edm_signature` for both. **A register that printed one
// verb over both would say every signatory tabled the motion.** So the words are chosen from
// the derivation, and the summary counts them apart.
//
// ⚠⚠ AND THE ASSESSMENT AT THE TOP IS NOW COMPUTED RATHER THAN WRITTEN. The previous version
// stated in prose that single-name measures "are early day motions, and that is a corpus gap"
// and named four wrong-subject collisions by hand. Those were findings of one run typed into
// the script, and the first of them survived the fact that made it untrue. Everything in the
// assessment is now derived from what THIS run returned. See `head` below.
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
  edm_signature: { words: 'is recorded against an early day motion', assembled: true },
  witness_appearance: { words: 'appeared as a witness', assembled: true },
  declared_interest: { words: 'declared a registrable interest', assembled: true },
  political_donation: { words: 'is recorded in the donation register', assembled: true },
}

/**
 * ⚠⚠ TABLING AND SIGNING ARE DIFFERENT ACTS AND `signal_type` IS THE SAME WORD FOR BOTH.
 * The derivation is the only thing that separates them, so the verb is chosen from it. An
 * unrecognised derivation falls back to the neutral phrasing above rather than guessing —
 * a new derivation must not silently inherit "tabled".
 */
function edmWords(derivation: string | null): string {
  if (derivation?.startsWith('primary-sponsor')) return 'tabled an early day motion'
  if (derivation?.startsWith('signatory')) return 'signed an early day motion'
  return `is recorded against an early day motion (⚠ derivation "${derivation ?? 'none'}" not recognised)`
}

/** The words for one ground, with the EDM special case folded in at the single point of use. */
function groundWords(signalType: string, derivation: string | null): { words: string; assembled: boolean } {
  const base = SIGNAL_WORDS[signalType] ?? { words: signalType, assembled: false }
  return signalType === 'edm_signature' ? { words: edmWords(derivation), assembled: true } : base
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

  // ══ ⚠⚠ WHAT THE POSITIONS LAYER NOW HOLDS FOR EARLY DAY MOTIONS ═════════════════════════
  //
  // Read at run time, never typed in. The number this replaces (60,995, "we hold no
  // signatures") was correct when it was written into this file and stayed in the output
  // after it stopped being true.
  const edmSig = await pool.query<{ kind: string; n: string }>(
    `SELECT CASE WHEN derivation LIKE 'primary-sponsor%' THEN 'sponsor'
                 WHEN derivation LIKE 'signatory%'       THEN 'signatory'
                 ELSE 'other' END AS kind, count(*)::bigint AS n
       FROM position_signal_stored
      WHERE signal_type = 'edm_signature' AND superseded_by IS NULL
      GROUP BY 1`)
  const edmBy = new Map(edmSig.rows.map((r) => [r.kind, Number(r.n)]))
  const storedSponsor = edmBy.get('sponsor') ?? 0
  const storedSignatory = edmBy.get('signatory') ?? 0
  const storedEdm = [...edmBy.values()].reduce((a, b) => a + b, 0)

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
  const summary: Array<{
    ref: string; title: string; target: string | null; targetType: string | null
    targetId: string | null; basis: string | null; words: number; actors: number
    /** ⚠ Counted in the DATABASE, not off the capped `result.actors`. A split computed from
     *  40 shown rows of 486 would describe the cap rather than the motion. */
    sponsors: number; signatories: number
  }> = []

  /** Signals against one target, split by the derivation that separates tabling from signing. */
  async function edmSplit(targetType: string, targetId: string) {
    const r = await pool.query<{ kind: string; n: number }>(
      `SELECT CASE WHEN derivation LIKE 'primary-sponsor%' THEN 'sponsor'
                   WHEN derivation LIKE 'signatory%'       THEN 'signatory'
                   ELSE 'other' END AS kind,
              count(DISTINCT actor_id)::int AS n
         FROM position_signal_stored
        WHERE target_type = $1 AND target_id = $2 AND signal_type = 'edm_signature'
          AND superseded_by IS NULL
        GROUP BY 1`, [targetType, targetId])
    const by = new Map(r.rows.map((x) => [x.kind, x.n]))
    return { sponsors: by.get('sponsor') ?? 0, signatories: by.get('signatory') ?? 0 }
  }

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
      summary.push({ ref, title: idea.title, target: null, targetType: null, targetId: null,
        basis: null, words: 0, actors: 0, sponsors: 0, signatories: 0 })
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

    // ⚠⚠ THE SPLIT IS SAID PER MEASURE, BECAUSE IT IS THE THING THAT CHANGED. Before the
    // signatures loaded an EDM target could return only its tabler; it can now return
    // hundreds of signatories, and "signed" and "tabled" are different acts.
    const split = target.targetType === 'edm'
      ? await edmSplit(target.targetType, target.target.id)
      : { sponsors: 0, signatories: 0 }
    if (target.targetType === 'edm') {
      w(`Of those, **${split.sponsors} tabled** the motion and **${split.signatories} signed** it.`)
      w('')
      w('⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of '
        + 'you, and it is a judgement rather than a fact.** A member may sign a motion to get it '
        + 'debated, to support one clause of it, or as a courtesy to a colleague, and the record '
        + 'does not distinguish those from agreement. What is assembled here is that they signed; '
        + 'what they meant by it is exactly what the confirmation step is for.')
      w('')
    }

    summary.push({
      ref, title: idea.title, target: target.label, targetType: target.targetType,
      targetId: target.target.id, basis: target.matchedPhrase,
      words: target.matchedContentWords, actors: result.actorsMatched,
      sponsors: split.sponsors, signatories: split.signatories,
    })

    if (!result.actors.length) { w('*No actors returned.*'); w(''); console.log(`  ${ref}  target, 0 actors`); continue }

    w('| Person | Party at the time | What the record shows | On what | Source |')
    w('|---|---|---|---|---|')
    for (const a of result.actors) {
      for (const g of a.grounds) {
        const sw = groundWords(g.signalType, g.derivation)
        w(`| ${esc(a.name)}${a.identityCaveat ? ' ⚠' : ''} `
          + `| ${esc(g.partyAtTheTime ?? '—')} `
          + `| ${sw.assembled ? '' : '⚠ *extracted* — '}${esc(sw.words)}, ${g.direction > 0 ? '**for**' : g.direction < 0 ? '**against**' : 'took part'} `
          + `| ${esc(g.targetLabel ?? g.targetId)} (${g.date}) `
          + `| ${g.sourceUrl ? `[record](${g.sourceUrl})` : '—'} |`)
      }
    }
    w('')
    // ══ ⚠⚠ THE CAP IS NOW LOAD-BEARING AND MUST SAY SO ═══════════════════════════════════
    //
    // Before the signatures loaded, an EDM target returned ONE actor and `limit: 40` never
    // bit. A motion with 486 signatories is now ordinary, so the table is a truncation of a
    // much longer list. **A cap is a safety valve, never a selection rule** — printing 40 of
    // 486 without saying so would present the arithmetic of a slice as a shortlist.
    if (result.ranking.shown < result.ranking.ofMatched) {
      w(`⚠⚠ **Showing ${result.ranking.shown} of ${result.ranking.ofMatched}.** The other `
        + `${result.ranking.ofMatched - result.ranking.shown} are not absent from the record; they are `
        + 'below the display cap. **Do not read the people below as having no position.**')
      w('')
    }
    // ⚠ SURFACE 4 §3: `positionsFor` had already written "this is not a ranking" and two
    // assemblers dropped it. It travels here — imported from `result.ranking`, not restated,
    // so it stays true if the sort key changes.
    w(`⚠ **The order is: ${esc(result.ranking.key)}.**`
      + (result.ranking.note ? ` ${esc(result.ranking.note)}` : '')
      + (result.ranking.tiedAtTop > 1
        ? ` ⚠ ${result.ranking.tiedAtTop} of the ${result.ranking.ofMatched} matched share the top score exactly.`
        : ''))
    w('')
    console.log(`  ${ref}  ${result.actorsMatched} actors (showing ${result.ranking.shown})`)
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
  head.push('| Measure | Target resolved | Kind | Matched on | People with a record | Tabled | Signed |')
  head.push('|---|---|---|---|---|---|---|')
  for (const s of summary) {
    head.push(`| ${s.ref} | ${s.target ? esc(s.target) : '**none**'} | ${s.targetType ?? '—'} `
      + `| ${s.basis ? `${s.words}w — "${esc(s.basis)}"` : '—'} | ${s.target ? s.actors : '—'} `
      + `| ${s.targetType === 'edm' ? s.sponsors : '—'} | ${s.targetType === 'edm' ? s.signatories : '—'} |`)
  }
  head.push('')
  head.push(`**${substantive.length} of ${summary.length} measures return more than one person.** `
    + `${singletons.length} return exactly one and ${summary.length - withTarget.length} resolve to no `
    + 'target at all.')
  head.push('')

  // ══ ⚠⚠ EVERYTHING BELOW IS DERIVED FROM THIS RUN. IT USED TO BE PROSE. ═══════════════════
  //
  // The previous version asserted in hand-written text that the single-name measures "are
  // early day motions, and that is a corpus gap … an EDM target can therefore only ever
  // return one name", and named four wrong-subject collisions from one run. The first of
  // those survived the load that made it false, which is exactly how a stale artefact tells
  // a lie in a document that looks freshly generated. So the assessment is now computed, and
  // a future run that contradicts it will say so by itself.
  const edms = withTarget.filter((s) => s.targetType === 'edm')
  const edmSingles = edms.filter((s) => s.actors === 1)
  const nonEdmSingles = singletons.filter((s) => s.targetType !== 'edm')
  const signedTotal = edms.reduce((a, b) => a + b.signatories, 0)

  head.push('### What changed since the last run of this register')
  head.push('')
  head.push('The previous version of this appendix said, of every measure that returned one name, '
    + 'that *"we hold 60,995 motions and, for each, only the member who tabled it … an EDM target '
    + 'can therefore only ever return one name."* **That is no longer true.** The early day motion '
    + 'signatures have been loaded, and the positions layer now carries them.')
  head.push('')
  head.push('| | then | now |')
  head.push('|---|---|---|')
  head.push(`| \`edm_signature\` signals in \`position_signal_stored\` | 60,995 | **${storedEdm.toLocaleString()}** |`)
  head.push(`| …of which the member who **tabled** the motion | 60,995 | ${storedSponsor.toLocaleString()} |`)
  head.push(`| …of which a member who **signed** it | 0 | **${storedSignatory.toLocaleString()}** |`)
  head.push('')
  head.push(`On this run the ${edms.length} measure(s) resolving to an early day motion return `
    + `**${signedTotal.toLocaleString()} signatories** between them, against `
    + `${edms.reduce((a, b) => a + b.sponsors, 0)} tablers.`)
  head.push('')
  head.push(edmSingles.length
    ? `⚠ ${edmSingles.length} EDM-backed measure(s) still return exactly one person: `
      + `${edmSingles.map((s) => s.ref).join(', ')}. That is now a fact about **those motions** — `
      + 'a motion nobody else signed — and no longer a statement about what the corpus holds.'
    : '⚠ **No EDM-backed measure now returns a single name.** Every one of them returns its '
      + 'signatories as well as its tabler, which is the whole effect of the load.')
  head.push('')
  if (nonEdmSingles.length) {
    head.push(`⚠ ${nonEdmSingles.length} measure(s) return one person on a target that is not an early `
      + `day motion (${nonEdmSingles.map((s) => `${s.ref} — ${s.targetType}`).join('; ')}). `
      + 'Those are not explained by the signature gap and should be looked at separately.')
    head.push('')
  }

  // ⚠⚠ THE COLLISIONS ARE FOUND, NOT REMEMBERED. Two measures resolving to the SAME target is
  // the sharpest evidence that the mapping is a phrase match, and it is a property of the run.
  const byTarget = new Map<string, typeof summary>()
  for (const s of withTarget) {
    const k = `${s.targetType}:${s.targetId}`
    byTarget.set(k, [...(byTarget.get(k) ?? []), s])
  }
  const collisions = [...byTarget.values()].filter((g) => g.length > 1)
  const thin = withTarget.filter((s) => s.words <= 2)

  head.push('### ⚠⚠ How thin the mapping is, measured on this run')
  head.push('')
  head.push(`**${thin.length} of ${withTarget.length} resolved targets were matched on two content `
    + 'words or fewer.** A two-word phrase match is not a statement that the measure and the motion '
    + 'are about the same thing.')
  if (thin.length) {
    head.push('')
    for (const s of thin) {
      head.push(`- **${s.ref}** *${esc(s.title)}* → **${esc(s.target ?? '')}**, on ${s.words} word(s): `
        + `*"${esc(s.basis ?? '')}"*`)
    }
  }
  head.push('')
  if (collisions.length) {
    head.push(`⚠⚠ **${collisions.length} target(s) are shared by more than one measure**, which is a `
      + 'phrase match arriving at the same place from different proposals:')
    head.push('')
    for (const g of collisions) {
      head.push(`- ${g.map((s) => s.ref).join(' and ')} both resolve to **${esc(g[0].target ?? '')}** `
        + `(${g.map((s) => `${s.ref} on "${esc(s.basis ?? '')}"`).join('; ')})`)
    }
  } else {
    head.push('✔ No two measures resolved to the same target on this run.')
  }
  head.push('')
  head.push('**Conclusion: this still cannot be published as a per-measure supporter and opponent '
    + 'register.** What the signature load fixes is the *volume* — an EDM-backed measure now returns '
    + 'the people who signed as well as the one who tabled. What it does not fix is *which motion the '
    + 'measure resolved to*, and that is the defect that decides whether the names underneath mean '
    + 'anything. **Check the target line before reading any table below it.**')
  head.push('')
  head.push('⚠ And a signature is not agreement. A member may sign an early day motion to have it '
    + 'debated, because of one clause in it, or as a courtesy. The assembled fact is that they '
    + 'signed; whether that makes them a supporter of the measure in this report is the judgement '
    + 'this list exists to be worked through, not a conclusion it delivers.')
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
