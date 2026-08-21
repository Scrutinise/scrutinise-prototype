/**
 * select-3c-validation.ts — GRAPH 3C §3. Cut the 157-row validation draft down to a subset Charlie
 * can review in one sitting, and mark the rest DEFERRED.
 *
 * Brief §3, in full: *"Propose a subset of ~50 that gives the widest coverage — spread across
 * matters, parties, and across both strongly-held and genuinely ambivalent positions, since the
 * ambivalent ones are where the scoring change above will show. Mark the rest DEFERRED, not
 * deleted. Make it one-pass reviewable in the shape that worked for the search gold set: numbered,
 * one VERDICT line, the citation visible without leaving the file. Score nothing."*
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ THE SELECTION USES THE GRAPH. THE ANSWER MUST NOT. SAID HERE AND IN THE DOCUMENT.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * "Strongly-held" and "genuinely ambivalent" are not properties of the citation — they are
 * properties of what the GRAPH currently holds about that member on that matter. So stratifying by
 * them means the graph chooses which rows get reviewed first. Two consequences, both stated on the
 * face of the document rather than in a footnote:
 *
 *   1. **The answer stays independent.** Every verdict is read off a bills-api sponsorship
 *      citation, printed in full beside the row. Nothing about the graph's own estimate — its
 *      direction, its score, its confidence — is printed anywhere near a VERDICT line, because a
 *      reviewer told what the machine thinks is a reviewer who has been anchored.
 *   2. **⚠ An accuracy figure from this subset is NOT an accuracy figure for the population.** It
 *      is deliberately over-weighted toward the hard cases. Whoever scores it must report it as a
 *      STRATIFIED accuracy with the strata printed, and if a headline number is wanted for the
 *      whole graph the deferred rows have to be scored too.
 *
 * The only thing the document reveals about the graph is a neutral coverage tag — how many signals
 * exist and whether they agree with each other. Never which way.
 *
 * Usage (from scripts/graph):
 *   npx tsx select-3c-validation.ts            # report the selection, write nothing
 *   npx tsx select-3c-validation.ts --write    # rewrite docs/POSITION_VALIDATION_CANDIDATES.md
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'
import { aggregate, SignalForMath } from '../../scrutinise-web/lib/graph/position-math'

export {}

const WRITE = process.argv.includes('--write')
const DOC = path.join(__dirname, '../../docs/POSITION_VALIDATION_CANDIDATES.md')
const TARGET_PER_MATTER = 5
const AS_OF = new Date().toISOString().slice(0, 10)

/** `divisionMatch` per matter — the same strings `draft-3b-validation.ts` used to count divisions. */
const DIVISION_MATCH: Record<string, string> = {
  M1: 'Terminally Ill Adults', M2: 'Safety of Rwanda', M3: 'Illegal Migration',
  M4: 'Nationality and Borders', M5: 'European Union (Withdrawal) Bill', M6: 'Tobacco and Vapes',
  M7: 'Public Order', M8: 'Strikes (Minimum Service Levels)', M9: 'Environment Bill',
  M10: 'Retained EU Law',
}

interface Row {
  id: string; matter: string; name: string; mnis: number | null; party: string
  body: string          // the whole markdown block, verbatim
  /** filled from the graph, for STRATIFICATION ONLY */
  signals?: number; agree?: boolean; stratum?: 'A' | 'B' | 'C'
}

/**
 * Parse the document into its head, its per-matter preambles, and its rows.
 *
 * ⚠ IT MUST BE ABLE TO PARSE ITS OWN OUTPUT, AND THE FIRST VERSION COULD NOT. Run twice, it would
 * have read the PRIORITY/DEFERRED scaffolding as content, re-tagged already-tagged rows and
 * doubled the preamble — a script that corrupts the file it just wrote, on a second run nobody
 * would think twice about. So the scaffolding this script adds is stripped on the way in, and the
 * `· PRIORITY` / `· DEFERRED` suffixes are removed from matter headings, which makes the whole
 * thing idempotent: running it twice produces the same document as running it once.
 */
function parseDoc(md: string) {
  // Strip this script's own scaffolding, if present.
  const pri = md.indexOf('# ▶ PRIORITY —')
  const def = md.indexOf('# DEFERRED —')
  if (pri >= 0 && def > pri) {
    const before = md.slice(0, pri)
    const headOnly = before.split('\n---\n').slice(0, -1).join('\n---\n') || before
    md = headOnly + '\n\n' + md.slice(pri).replace(/^# ▶ PRIORITY —[\s\S]*?(?=^## M\d+ — )/m, '')
      .replace(/^# DEFERRED —[\s\S]*?(?=^## M\d+ — )/m, '')
  }
  md = md
    .replace(/^(## M\d+ — .*?) · (PRIORITY|DEFERRED)$/gm, '$1')
    .replace(/^- \*\*Coverage \(why this row was chosen[^\n]*\n/gm, '')

  const lines = md.split(/\r?\n/)
  const headEnd = lines.findIndex((l) => /^## M1 —/.test(l))
  if (headEnd < 0) throw new Error('could not find "## M1 —" — the document shape has changed')
  const head = lines.slice(0, headEnd).join('\n')

  const rows: Row[] = []
  const preambles: Record<string, string> = {}
  let currentMatter = ''
  let buf: string[] = []
  let cur: Row | null = null
  // ⚠⚠ THE PREAMBLE IS KEPT ONLY IF IT IS RICHER THAN WHAT IS ALREADY HELD, AND THAT IS NOT
  // fussiness. On a re-parse of this script's own output, a matter appears TWICE — once under
  // PRIORITY carrying its Bill link and its "what the graph holds" note, and once under DEFERRED
  // carrying nothing. Assigning on every heading meant the empty second one won, and M1's Bill
  // link vanished from the rewritten document on the second run. Found by diffing two runs rather
  // than by reading the code, which is the only way this shape of bug shows up.
  const keepRicher = (m: string, text: string) => {
    if ((preambles[m] ?? '').length < text.length) preambles[m] = text
  }
  const flush = () => {
    // ⚠ The trailing `---` belongs to the DOCUMENT, not to the row — it is the horizontal rule
    // separating one matter from the next, and it lands in the last row of each matter because
    // that row's buffer runs up to the following heading. Left in, it was re-emitted inside the
    // row on every run and then stripped again on the next parse, so two consecutive runs
    // produced documents that differed by ten separators. Removed here, where it is diagnosable.
    if (cur) { cur.body = buf.join('\n').replace(/(\s*\n---\s*)+$/, '').replace(/\s+$/, ''); rows.push(cur); cur = null }
    else if (currentMatter && buf.length) keepRicher(currentMatter, (preambles[currentMatter] ?? '') + buf.join('\n'))
    buf = []
  }
  for (const l of lines.slice(headEnd)) {
    const mm = /^## (M\d+) — (.+)$/.exec(l)
    if (mm) { flush(); currentMatter = mm[1]; keepRicher(currentMatter, `## ${mm[1]} — ${mm[2]}\n`); continue }
    const rm = /^### ((M\d+)\.\d+) — (.+?) \(MNIS (\d+|—)\), (.+)$/.exec(l)
    if (rm) {
      flush()
      cur = { id: rm[1], matter: rm[2], name: rm[3], mnis: rm[4] === '—' ? null : Number(rm[4]), party: rm[5], body: '' }
      buf = [l]
      continue
    }
    buf.push(l)
  }
  flush()
  return { head, preambles, rows }
}

async function main() {
  const md = fs.readFileSync(DOC, 'utf8')
  const { head, preambles, rows } = parseDoc(md)
  console.log(`parsed ${rows.length} candidate rows across ${new Set(rows.map((r) => r.matter)).size} matters`)
  if (rows.length !== 157) console.log(`⚠ expected 157 (3B's count); the document may have been edited`)

  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }

    // ── stratify ────────────────────────────────────────────────────────────────────────────
    //
    // A · a settled record: 3+ signals on this matter, all pointing one way.
    // B · a genuinely divided one: 3+ signals that do NOT all agree. §3 asks for these because
    //     they are where the 3C scoring change shows — under 3A/3B they scored HIGHER than the
    //     settled ones, and under 3C they score lower.
    // C · thin: 0, 1 or 2 signals. Included because "the graph says almost nothing here" is an
    //     answer a validation set has to be able to catch, and a subset made only of A and B
    //     would silently exclude every case where the graph should abstain.
    for (const r of rows) {
      if (r.mnis == null) { r.signals = 0; r.agree = true; r.stratum = 'C'; continue }
      const { rows: sig } = await pool.query<{
        signal_ref: string; derivation: string; direction: number; raw_weight: number; observed_at: string }>(`
        SELECT s.signal_ref, s.derivation, s.direction, s.raw_weight, s.observed_at::text
          FROM position_signal_vote s
          JOIN graph_entity e ON e.id = s.actor_id
          JOIN divisions d ON d.house = split_part(s.target_id, ':', 1)
                          AND d.division_id = split_part(s.target_id, ':', 2)::int
         WHERE e.parl_member_id = $1
           AND (d.title ILIKE '%' || $2 || '%' OR d.bill_title ILIKE '%' || $2 || '%')`,
        [r.mnis, DIVISION_MATCH[r.matter] ?? r.matter])
      const forMath: SignalForMath[] = sig.map((s) => ({
        id: s.signal_ref, signalType: 'vote', derivation: s.derivation,
        direction: s.direction, rawWeight: s.raw_weight, observedAt: s.observed_at,
      }))
      const a = aggregate(forMath, AS_OF, POSITION_CONFIG)
      r.signals = sig.length
      r.agree = Math.abs(a.consistency) > 0.999
      r.stratum = sig.length < 3 ? 'C' : (r.agree ? 'A' : 'B')
    }

    // ── select ──────────────────────────────────────────────────────────────────────────────
    //
    // Per matter: take up to TARGET_PER_MATTER, cycling B → A → C so the hard cases are never the
    // ones that fall off, and refusing to take a second row from a party until every party
    // represented in that matter has one. Deterministic: ties break on the row id.
    const chosen = new Set<string>()
    const byMatter = new Map<string, Row[]>()
    for (const r of rows) {
      const l = byMatter.get(r.matter); if (l) l.push(r); else byMatter.set(r.matter, [r])
    }
    for (const [, list] of [...byMatter.entries()].sort()) {
      const take: Row[] = []
      const partyCount = new Map<string, number>()
      const byId = [...list].sort((x, y) => (x.id < y.id ? -1 : 1))
      const grab = (r: Row) => {
        take.push(r); chosen.add(r.id)
        partyCount.set(r.party, (partyCount.get(r.party) ?? 0) + 1)
      }

      // ⚠⚠ ONE SLOT IS RESERVED FOR EACH STRATUM BEFORE ANY IS FILLED TWICE, AND THE FIRST VERSION
      // OF THIS DID NOT DO THAT. Cycling B → A → C with a party constraint filled all five slots
      // from B and A in every matter and produced **stratum C: 0 of 50** — no row anywhere in the
      // subset where the graph holds fewer than three votes. That is precisely the case a key needs
      // in order to catch a graph that answers when it should be quiet, and the selection had
      // silently excluded all of it while reporting "widest coverage".
      for (const strat of ['B', 'A', 'C'] as const) {
        const r = byId.find((x) => !chosen.has(x.id) && x.stratum === strat)
        if (r) grab(r)
      }
      // Then fill the remainder, hardest stratum first, refusing a second row from a party until
      // every party in the matter has one.
      for (const round of [0, 1, 2]) {
        for (const strat of ['B', 'A', 'C'] as const) {
          for (const r of byId) {
            if (take.length >= TARGET_PER_MATTER) break
            if (chosen.has(r.id) || r.stratum !== strat) continue
            if ((partyCount.get(r.party) ?? 0) > round) continue
            grab(r)
          }
        }
      }
      // A matter with fewer than TARGET rows left takes whatever remains, in id order.
      for (const r of byId) {
        if (take.length >= TARGET_PER_MATTER) break
        if (!chosen.has(r.id)) grab(r)
      }
    }

    // ── report ──────────────────────────────────────────────────────────────────────────────
    const sel = rows.filter((r) => chosen.has(r.id))
    const def = rows.filter((r) => !chosen.has(r.id))
    console.log(`\n════ THE SELECTION — ${sel.length} of ${rows.length}, ${def.length} deferred ════`)
    console.log(`  ${'matter'.padEnd(6)} ${'sel'.padStart(4)} ${'of'.padStart(4)}   strata (A settled · B divided · C thin)   parties`)
    for (const [m, list] of [...byMatter.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
      const s = list.filter((r) => chosen.has(r.id))
      const strat = (k: string) => s.filter((r) => r.stratum === k).length
      console.log(`  ${m.padEnd(6)} ${String(s.length).padStart(4)} ${String(list.length).padStart(4)}   ` +
        `A ${strat('A')} · B ${strat('B')} · C ${strat('C')}${' '.repeat(20)}`.slice(0, 42) +
        `${[...new Set(s.map((r) => r.party))].join(', ').slice(0, 60)}`)
    }
    const tot = (k: string) => sel.filter((r) => r.stratum === k).length
    console.log(`\n  strata overall:  A settled ${tot('A')} · B divided ${tot('B')} · C thin ${tot('C')}`)
    console.log(`  parties covered: ${[...new Set(sel.map((r) => r.party))].sort().join(' · ')}`)
    console.log(`  bases:           ${['bill-sponsor', 'amendment-sponsor'].map((b) =>
      `${b} ${sel.filter((r) => r.body.includes(`\`${b}\``)).length}`).join(' · ')}`)

    // Live free-vote-like counts per matter, for the preamble refresh below.
    const freeNow: Record<string, number> = {}
    for (const [m, match] of Object.entries(DIVISION_MATCH)) {
      const { rows: [r] } = await pool.query<{ n: string; free: string }>(`
        SELECT COUNT(*)::text AS n, COUNT(*) FILTER (WHERE c.free_vote_like)::text AS free
          FROM divisions d JOIN position_division_class c
            ON c.house = d.house AND c.division_id = d.division_id
         WHERE d.title ILIKE '%' || $1 || '%' OR d.bill_title ILIKE '%' || $1 || '%'`, [match])
      freeNow[m] = Number(r.free)
    }
    console.log(`  free-vote-like now: ${Object.entries(freeNow).map(([m, n]) => `${m} ${n}`).join(' · ')}`)

    if (!WRITE) { console.log(`\n  (--write to rewrite the document)`); return }

    // ── rewrite ─────────────────────────────────────────────────────────────────────────────
    const tag = (r: Row) => {
      const n = r.signals ?? 0
      const what = n === 0 ? 'no votes recorded on this matter'
        : n < 3 ? `${n} vote${n === 1 ? '' : 's'} recorded — a thin record`
          : r.agree ? `${n} votes recorded, all the same way`
            : `${n} votes recorded, NOT all the same way`
      return `- **Coverage (why this row was chosen — says nothing about which way):** ${what}`
    }
    const withTag = (r: Row) =>
      r.body.replace(/\n- \*\*VERDICT:\*\*/, `\n${tag(r)}\n- **VERDICT:**`)

    const out: string[] = []
    out.push(head.trimEnd())
    out.push('')
    out.push('---')
    out.push('')
    out.push('# ▶ PRIORITY — REVIEW THESE ' + sel.length + ' FIRST (GRAPH 3C §3)')
    out.push('')
    out.push('157 rows is too many for one sitting, so this is the subset chosen for the widest')
    out.push('coverage: **' + TARGET_PER_MATTER + ' rows from each of the ' + byMatter.size + ' matters**, spread across parties, and')
    out.push('deliberately including the members whose record the graph finds *divided* as well as the')
    out.push('ones it finds settled. Everything else is **DEFERRED** below — deferred, not deleted, and')
    out.push('still worth scoring later.')
    out.push('')
    out.push('**Nothing here has been scored. Add one line per row: `ACCEPT` · `REJECT` ·**')
    out.push('**`AMEND: <the correct position>` · `UNSURE`.**')
    out.push('')
    out.push('## ⚠ Two things about how these were chosen')
    out.push('')
    out.push('**1 · The selection used the graph. The verdict must not.** "Settled" and "divided" are')
    out.push('facts about what the graph currently holds, so the graph chose which rows you see first.')
    out.push('Its *answer* is nowhere on this page: no stance, no score, no confidence appears beside')
    out.push('any VERDICT line, because a reviewer who has been told what the machine thinks is a')
    out.push('reviewer who has been anchored. The only thing shown is a **Coverage** line saying how')
    out.push('many votes exist and whether they agree with each other — never which way they point.')
    out.push('')
    out.push('**2 · ⚠ An accuracy figure from this subset is not an accuracy figure for the graph.**')
    out.push('It is over-weighted toward hard cases on purpose — divided records are where GRAPH 3C\'s')
    out.push('scoring change shows, because under the old arithmetic they scored *higher* than settled')
    out.push('ones. Whoever scores this must report it as a **stratified** accuracy with the strata')
    out.push('printed. A headline number for the whole graph needs the deferred rows scored too.')
    out.push('')
    out.push('| stratum | meaning | in this subset |')
    out.push('| --- | --- | ---: |')
    out.push(`| A | 3+ votes on the matter, all the same way | ${tot('A')} |`)
    out.push(`| B | 3+ votes, **not** all the same way | ${tot('B')} |`)
    out.push(`| C | fewer than 3 votes, or none — the graph should be quiet here | ${tot('C')} |`)
    out.push('')
    out.push('| # | matter | rows | parties |')
    out.push('| --- | --- | ---: | --- |')
    for (const [m, list] of [...byMatter.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
      const s = list.filter((r) => chosen.has(r.id))
      const title = (preambles[m] ?? '').split('\n')[0].replace(/^## M\d+ — /, '')
      out.push(`| ${m} | ${title} | ${s.length} | ${[...new Set(s.map((r) => r.party))].join(', ')} |`)
    }
    out.push('')
    for (const [m, list] of [...byMatter.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
      const s = list.filter((r) => chosen.has(r.id))
      if (!s.length) continue
      out.push(`## ${m} — ${(preambles[m] ?? '').split('\n')[0].replace(/^## M\d+ — /, '')} · PRIORITY`)
      // The matter's own preamble carries the Bill link and what the graph holds. Brief §3 asks
      // for the citation to be visible without leaving the file; dropping the preamble would have
      // sent a reviewer back to the deferred half to find out which Bill a matter is about.
      //
      // ⚠ AND ITS "N classified free-vote-like" IS REFRESHED FROM THE LIVE TABLE. 3B wrote those
      // counts in; GRAPH 3C §2 changed the classification, so M1's would have read "9" beside a
      // graph that now says 11. A stale number in a document a reviewer is being asked to trust
      // is worse than no number, and this one would have been wrong in the very matter the sprint
      // is about.
      out.push((preambles[m] ?? '').split('\n').slice(1).join('\n').trim()
        .replace(/, \d+ classified free-vote-like/, `, ${freeNow[m] ?? 0} classified free-vote-like`))
      out.push('')
      for (const r of s) { out.push(withTag(r)); out.push('') }
    }
    out.push('---')
    out.push('')
    out.push('# DEFERRED — ' + def.length + ' rows, kept for a later pass')
    out.push('')
    out.push('Not rejected and not deleted: these are the remaining rows of the same 157-row draft.')
    out.push('Score them when the priority set is done and a population-level accuracy figure is')
    out.push('wanted. Their VERDICT lines are left blank exactly as they were.')
    out.push('')
    for (const [m, list] of [...byMatter.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
      const d = list.filter((r) => !chosen.has(r.id))
      if (!d.length) continue
      out.push(`## ${m} — ${(preambles[m] ?? '').split('\n')[0].replace(/^## M\d+ — /, '')} · DEFERRED`)
      out.push('')
      for (const r of d) { out.push(r.body); out.push('') }
    }

    const text = out.join('\n').replace(/\n{4,}/g, '\n\n\n') + '\n'
    fs.writeFileSync(DOC, text, 'utf8')
    console.log(`\n  ✓ written: ${DOC}`)

    // Read it back and count what a reviewer will actually see. A write says what was sent.
    const back = fs.readFileSync(DOC, 'utf8')
    const verdicts = (back.match(/- \*\*VERDICT:\*\* _______/g) ?? []).length
    const headings = (back.match(/^### M\d+\.\d+ — /gm) ?? []).length
    const priorityIdx = back.indexOf('# ▶ PRIORITY')
    const deferredIdx = back.indexOf('# DEFERRED —')
    const inPriority = (back.slice(priorityIdx, deferredIdx).match(/^### M\d+\.\d+ — /gm) ?? []).length
    console.log(`  ✓ read back: ${headings} rows total, ${inPriority} in PRIORITY, ${headings - inPriority} in DEFERRED, ${verdicts} blank VERDICT lines`)
    const okAll = headings === rows.length && inPriority === sel.length && verdicts === rows.length
    console.log(`  ${okAll ? '✓' : '❌'} every one of the original ${rows.length} rows survives, none scored`)
    if (!okAll) process.exit(1)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[select-3c-validation] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
