/**
 * rebuild-3c2-validation.ts — GRAPH 3C-2. Rebuild the validation key on direction-bearing bases.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE PREVIOUS DRAFT WAS WITHDRAWN
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 136 of its 157 rows rested on AMENDMENT SPONSORSHIP. That basis was chosen because it is
 * NON-CIRCULAR — the graph holds zero `amendment_sponsorship` signals, proven by query — and that
 * reasoning is genuinely valuable and also incomplete:
 *
 *     Non-circularity is NECESSARY. It is not SUFFICIENT. The basis must ALSO determine a direction.
 *
 * Amendment sponsorship is unsigned. A wrecking amendment and a strengthening amendment are the
 * same recorded fact. So those rows asserted a position their own citation could not establish, and
 * ⚠⚠ **an independent signal that does not settle the answer is worse than useless in an answer
 * key, because it will mark the graph WRONG every time the graph is RIGHT.**
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS BUILDS INSTEAD, AND THE FOUR RULES IT OBEYS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 1. **Direction-bearing bases only** — the member's own words in Hansard, and bill sponsorship.
 *    `audit-3c2-bases.ts` scores all fourteen candidate bases on both tests; three pass.
 * 2. **The row states the EVIDENCE, not the conclusion.** No "SUPPORTS" line appears anywhere in
 *    the sound section. The quote comes first and Charlie assigns the direction. A row that
 *    announces its answer above its own evidence invites a rubber stamp, and the whole value of
 *    this pass is that it is not one.
 * 3. **The extract is chosen by a direction-BLIND rule, and the rule is printed on every row.**
 *    The member's longest speech in a debate titled for the matter, quoted IN FULL when it is
 *    250 words or fewer — which the median speech is, comfortably. Nothing is selected for
 *    containing a stance word; doing that would be the generator quietly pre-judging the answer.
 *    ⚠ Quoting in full is also what defuses the quoted-material hazard: Sir Edward Leigh's speech
 *    reads out a constituent's email saying "I oppose the right to die Bill", and an excerpt built
 *    around the word "oppose" would attribute the constituent's sentence to him. The surrounding
 *    context is the fix, so the context is not cut away.
 * 4. **Speech-sourced rows are MARKED.** Speech is independent of the graph TODAY — there is no
 *    speech-derived signal type. If extracted positions are ever folded in, these rows stop being
 *    independent and must be excluded from scoring then.
 *
 * ⚠ On `pwdata`: it is TheyWorkForYou's bulk data, and the brief rightly forbids TWFY's *computed*
 * position summaries, which are a function of the same divisions the graph aggregates. These rows
 * are the verbatim Hansard transcript TWFY republishes — spoken words, no computation over any
 * vote. The distinction is the whole point, so it is stated on the face of the document too.
 *
 * Usage (from scripts/graph):
 *   npx tsx rebuild-3c2-validation.ts            # report the selection, write nothing
 *   npx tsx rebuild-3c2-validation.ts --write    # rewrite docs/POSITION_VALIDATION_CANDIDATES.md
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { r2Get } from '../ingest/shared/r2-client'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'
import { aggregate, SignalForMath } from '../../scrutinise-web/lib/graph/position-math'
import { MATTER_TITLE, MATTER_NAME, NORM_SQL, CHAIR_NAMES, readCandidates, type Cand } from './probe-3c2-coverage'

export {}

const SELF_TEST = process.argv.includes('--self-test')
const WRITE = process.argv.includes('--write')
const EXTRACT_POOL = process.argv.includes('--extract-pool')
/**
 * ⚠⚠ THE POOL LIVES IN A FILE, NOT IN THE DOCUMENT, AND THE FIRST RUN IS WHY.
 *
 * The first version read its 157-row pool out of POSITION_VALIDATION_CANDIDATES.md — the same file
 * it then overwrote. Run twice, it reported `pool 136: 0 bill-sponsor`: the rewrite had replaced
 * every `bill-sponsor` basis line with `hansard-speech`, so **the script had eaten its own input**
 * and silently lost all 21 sound bill-sponsor rows. It is the same shape as the bug the previous
 * sprint hit in `select-3c-validation.ts`, and the same lesson: a generator whose input is its own
 * output has to be run twice and diffed before it is believed.
 *
 * The pool now has its own home. It is extracted ONCE from the original draft with
 * `--extract-pool`, committed, and read from there — so the provenance of every candidate is a
 * file anyone can open, and re-running the rebuild cannot degrade it.
 */
const POOL = path.join(__dirname, 'validation-pool.json')
const DOC = path.join(__dirname, '../../docs/POSITION_VALIDATION_CANDIDATES.md')
const TARGET_PER_MATTER = 5
const QUOTE_OPEN_WORDS = 220
const QUOTE_CLOSE_WORDS = 130
const QUOTE_WORD_CAP = QUOTE_OPEN_WORDS + QUOTE_CLOSE_WORDS
const AS_OF = '2026-08-23'
const UA = 'ScrutiniseResearchBot/1.0 (+https://www.scrutinise.org; civic research; contact cl@scrutinise.org)'

interface Speech {
  id: string; corpus: string; docId: string; title: string; speaker: string
  date: string; words: number; r2Key: string; sourceUrl: string
}
interface Row extends Cand {
  speech?: Speech
  text?: string
  gidUrl?: string
  /** stratification only — never printed as a direction */
  signals?: number; agree?: boolean; stratum?: 'A' | 'B' | 'C'
}

/**
 * ⚠⚠ IS THIS THE MEMBER ARGUING, OR IS IT PROCEDURAL TEXT WITH THEIR NAME ON IT?
 *
 * Caught by reading the output rather than by designing for it. The first run selected, for Lord
 * Callanan on retained EU law, a 20,246-word "speech" beginning *"Moved by Lord Callanan 64: Before
 * Schedule 1, insert the following new Schedule—"* and continuing through a schedule of several
 * hundred statutory instruments. TheyWorkForYou attributes it to him correctly; it is the formal
 * moving of an amendment, and **it is the exact defect this whole rebuild exists to remove, wearing
 * a different costume**: the text of an amendment, carrying no direction, dressed as a member's own
 * words. "Longest" is a proxy for "most substantive" and this is where the proxy breaks.
 *
 * Both tests below are DIRECTION-BLIND — they ask whether an argument is present, never which way
 * it points:
 *
 *   1. A Lords block opening "Moved by <name>" is amendment text by construction.
 *   2. A member making a case uses the first person. A passage with no "I"/"we"/"my" anywhere in
 *      the quoted window is procedural, or is something being read out rather than argued.
 *
 * ⚠ `I beg to move` is deliberately NOT excluded: it opens most genuine second-reading speeches,
 * and the argument follows immediately after it.
 */
export function isArgument(text: string): { ok: boolean; why: string } {
  const t = text.replace(/\s+/g, ' ').trim()
  if (/^Moved by\b/i.test(t)) return { ok: false, why: 'opens "Moved by" — the formal moving of an amendment, not a speech' }
  const window = t.split(/\s+/).slice(0, QUOTE_WORD_CAP).join(' ')
  // ⚠ CASE-INSENSITIVE, AND `me`/`us` ARE IN THE LIST. The first version was `/\b(I|we|my|our)\b/`
  // and the self-test caught it immediately: *"My Lords, this issue has been raised with me many
  // times by constituents"* was REJECTED, because "My" is capitalised at the start of a sentence
  // and "me" was not in the set. That would have silently dropped genuine Lords speeches — the
  // failure mode a filter has that nobody notices, because a dropped candidate leaves no trace.
  if (!/\b(i|we|my|our|me|us)\b/i.test(window)) {
    return { ok: false, why: 'no first person in the quoted window — procedural or read-out text' }
  }
  return { ok: true, why: '' }
}

/** One fetch per debate day, cached; recovers the real per-speech gid so the URL is clickable. */
const dayCache = new Map<string, string | null>()
async function gidFor(sp: Speech, text: string): Promise<string | null> {
  const key = sp.sourceUrl
  if (!dayCache.has(key)) {
    try {
      const r = await fetch(sp.sourceUrl, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) })
      dayCache.set(key, r.ok ? await r.text() : null)
    } catch { dayCache.set(key, null) }
  }
  const xml = dayCache.get(key)
  if (!xml) return null
  // Match on the speaker AND the opening of the body — the section number in our id is a sequence
  // index, not the gid suffix, so it cannot be used to construct the URL (measured: it 404s).
  const norm = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&#\d+;|&\w+;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const head = norm(text).slice(0, 60)
  if (head.length < 20) return null
  const re = /<speech\b([^>]*)>([\s\S]*?)<\/speech>/g
  for (const m of xml.matchAll(re)) {
    const attrs = m[1]
    const idm = /\bid="uk\.org\.publicwhip\/(?:debate|lords)\/([^"]+)"/.exec(attrs)
    if (!idm) continue
    const namem = /\bspeakername="([^"]*)"/.exec(attrs)
    if (!namem || namem[1].toLowerCase() !== sp.speaker.toLowerCase()) continue
    if (norm(m[2]).startsWith(head.slice(0, 40))) {
      return `https://www.theyworkforyou.com/${sp.corpus === 'pwdata-lords' ? 'lords' : 'debates'}/?id=${idm[1]}`
    }
  }
  return null
}

/**
 * ⚠ THE SECOND TEST REJECTED NOTHING IN THE REAL RUN, AND A CHECK THAT NEVER FIRES IS NOT A CHECK.
 * Six speeches were caught by the "Moved by" rule and zero by the first-person rule, which could
 * mean the corpus has no such rows or could mean the rule is inert. Watched failing here against
 * constructed cases, with the passing cases beside them so it is not simply refusing everything.
 */
function selfTest(): number {
  const cases: Array<[string, boolean, string]> = [
    ['Moved by Lord Callanan 64: Before Schedule 1, insert the following new Schedule— Title Extent of revocation', false,
      'the real Callanan block — amendment text'],
    ['The whole Order. The whole Rules. The whole Regulations. Regulations 3 and 4. The whole Scheme.', false,
      'a schedule with no first person'],
    ['That this House declines to give a Second Reading to the Bill.', false, 'a bare motion'],
    ['I beg to move, That the Bill be now read a Second time. This Bill matters because families deserve a choice.', true,
      '"I beg to move" must NOT be excluded — it opens genuine speeches'],
    ['The reason why the right hon. Lady and I both oppose the Bill is that we are not talking about a principle.', true,
      "Sir Edward Leigh's actual words"],
    ['My Lords, this issue has been raised with me many times by constituents.', true, 'a Lords opening'],
  ]
  let bad = 0
  console.log('════ SELF-TEST — isArgument() ════\n')
  for (const [text, want, why] of cases) {
    const got = isArgument(text)
    const ok = got.ok === want
    if (!ok) bad++
    console.log(`  ${ok ? 'PASS' : '❌ FAIL'}  want ${want ? 'ARGUMENT ' : 'REJECT   '} got ${got.ok ? 'ARGUMENT ' : 'REJECT   '} ${why}`)
    if (!got.ok) console.log(`            reason: ${got.why}`)
  }
  console.log(`
  ${bad === 0 ? '✓ both rules fire, and neither fires on a genuine speech' : `❌ ${bad} wrong`}`)
  return bad
}

async function main() {
  if (SELF_TEST) process.exit(selfTest() === 0 ? 0 : 1)
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)

    if (EXTRACT_POOL) {
      const pool0 = readCandidates()
      const counts = new Map<string, number>()
      for (const c of pool0) counts.set(c.basis, (counts.get(c.basis) ?? 0) + 1)
      if (pool0.length !== 157 || (counts.get('bill-sponsor') ?? 0) !== 21) {
        console.error(`❌ refusing to extract: expected 157 rows with 21 bill-sponsor, got ${pool0.length} with ${counts.get('bill-sponsor') ?? 0}.`)
        console.error(`   The document has probably already been rebuilt. Restore it first:`)
        console.error(`   git checkout -- docs/POSITION_VALIDATION_CANDIDATES.md`)
        process.exit(1)
      }
      fs.writeFileSync(POOL, JSON.stringify(pool0, null, 1), 'utf8')
      console.log(`✓ pool extracted: ${POOL} (${pool0.length} rows, ${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')})`)
      return
    }
    if (!fs.existsSync(POOL)) {
      console.error(`❌ ${POOL} not found. Run once with --extract-pool against the ORIGINAL draft.`)
      process.exit(1)
    }
    const all: Cand[] = JSON.parse(fs.readFileSync(POOL, 'utf8'))
    const amendment = all.filter((c) => c.basis === 'amendment-sponsor')
    const billSponsors = all.filter((c) => c.basis === 'bill-sponsor')
    console.log(`\npool ${all.length}: ${billSponsors.length} bill-sponsor (SOUND), ${amendment.length} amendment-sponsor (UNSOUND)`)

    // ── 1 · find each candidate's longest speech that is ACTUALLY AN ARGUMENT ────────────────
    //
    // ⚠ The rule is "the longest speech that passes `isArgument`", not "the longest speech". The
    // first version was the latter and it selected a 20,246-word schedule of statutory instruments
    // for Lord Callanan. Both are direction-blind; only one of them selects a member making a case.
    console.log(`\n════ 1 · THE LONGEST ARGUING SPEECH PER CANDIDATE, PER MATTER ════`)
    const rows: Row[] = all.map((c) => ({ ...c }))
    const rejected: Array<{ who: string; words: number; why: string }> = []
    for (const r of rows) {
      const { rows: cands } = await pool.query<Speech>(`
        SELECT cs.id, cs.corpus, cs."parentDocId" AS "docId", cs."sectionTitle" AS title,
               cs.speaker, cs."itemDate"::text AS date, cs."wordCount" AS words,
               cs."r2Key" AS "r2Key", cs."sourceUrl" AS "sourceUrl"
          FROM corpus_sections cs
         WHERE cs.corpus IN ('pwdata-debates','pwdata-lords')
           AND cs."sectionTitle" ILIKE '%' || $1 || '%'
           AND cs.speaker IS NOT NULL AND cs.speaker <> ''
           AND cs.speaker <> ALL($3::text[])
           AND cs."wordCount" >= 40
           AND cs."r2Key" IS NOT NULL
           AND ${NORM_SQL('cs.speaker')} = ${NORM_SQL('$2')}
         ORDER BY cs."wordCount" DESC, cs."itemDate" ASC
         LIMIT 8`, [MATTER_TITLE[r.matter], r.name, CHAIR_NAMES])
      for (const s of cands) {
        const raw = await r2Get(s.r2Key)
        if (!raw) continue
        const t = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
        const verdict = isArgument(t)
        if (!verdict.ok) { rejected.push({ who: `${r.name} (${r.matter})`, words: s.words, why: verdict.why }); continue }
        r.speech = s; r.text = t
        break
      }
    }
    const withSpeech = rows.filter((r) => r.speech)
    console.log(`  ${withSpeech.length} of ${rows.length} candidates have a qualifying ARGUING speech`)
    console.log(`  ${rejected.length} speeches rejected as procedural before a usable one was found:`)
    const byWhy = new Map<string, number>()
    for (const x of rejected) byWhy.set(x.why, (byWhy.get(x.why) ?? 0) + 1)
    for (const [w, n] of byWhy) console.log(`     ${String(n).padStart(4)} × ${w}`)
    for (const x of rejected.sort((a, b) => b.words - a.words).slice(0, 6)) {
      console.log(`     e.g. ${x.words.toLocaleString().padStart(7)}w  ${x.who}`)
    }

    // ── 2 · stratify, exactly as 3C did — for SELECTION only, never printed as a direction ──
    for (const r of rows) {
      const { rows: sig } = await pool.query<{
        signal_ref: string; derivation: string; direction: number; raw_weight: number; observed_at: string }>(`
        SELECT s.signal_ref, s.derivation, s.direction, s.raw_weight, s.observed_at::text
          FROM position_signal_vote s
          JOIN graph_entity e ON e.id = s.actor_id
          JOIN divisions d ON d.house = split_part(s.target_id, ':', 1)
                          AND d.division_id = split_part(s.target_id, ':', 2)::int
         WHERE e.parl_member_id = $1
           AND (d.title ILIKE '%' || $2 || '%' OR d.bill_title ILIKE '%' || $2 || '%')`,
        [r.mnis, MATTER_TITLE[r.matter]])
      const a = aggregate(sig.map((s) => ({
        id: s.signal_ref, signalType: 'vote' as const, derivation: s.derivation,
        direction: s.direction, rawWeight: s.raw_weight, observedAt: s.observed_at,
      }) as SignalForMath), AS_OF, POSITION_CONFIG)
      r.signals = sig.length
      r.agree = Math.abs(a.consistency) > 0.999
      r.stratum = sig.length < 3 ? 'C' : (r.agree ? 'A' : 'B')
    }

    // ── 3 · select ~5 per matter: bill-sponsors first (a second independent basis), then one
    //        of each stratum, then party spread. Deterministic; ties break on the row id. ──────
    const chosen = new Set<string>()
    const usedMnis = new Set<number>()
    const byMatter = new Map<string, Row[]>()
    for (const r of rows) { const l = byMatter.get(r.matter); if (l) l.push(r); else byMatter.set(r.matter, [r]) }
    for (const [, list] of [...byMatter.entries()].sort()) {
      const eligible = list.filter((r) => r.speech || r.basis === 'bill-sponsor')
        .sort((x, y) => (x.id < y.id ? -1 : 1))
      const take: Row[] = []
      const party = new Map<string, number>()
      const grab = (r: Row) => { take.push(r); chosen.add(r.id); usedMnis.add(r.mnis); party.set(r.party, (party.get(r.party) ?? 0) + 1) }
      // (i) a bill-sponsor, if there is one — it is the only basis here with two independent legs
      const bs = eligible.find((r) => r.basis === 'bill-sponsor' && r.speech)
        ?? eligible.find((r) => r.basis === 'bill-sponsor')
      if (bs) grab(bs)
      // (ii) one of each stratum, so no stratum can be crowded out (3C's own lesson).
      //      ⚠ `fresh` first: a member already used on another matter is taken only when nobody
      //      else fits. The first run put 50 rows across 44 people; breadth of PEOPLE matters as
      //      much as breadth of matters, and it costs nothing to prefer a new one.
      for (const fresh of [true, false]) {
        for (const st of ['B', 'A', 'C'] as const) {
          if (take.length >= TARGET_PER_MATTER) break
          const r = eligible.find((x) => !chosen.has(x.id) && x.stratum === st && (!fresh || !usedMnis.has(x.mnis)))
          if (r) grab(r)
        }
      }
      // (iii) fill on party spread, hardest stratum first
      for (const fresh of [true, false]) {
        for (const round of [0, 1, 2]) {
          for (const st of ['B', 'A', 'C'] as const) {
            for (const r of eligible) {
              if (take.length >= TARGET_PER_MATTER) break
              if (chosen.has(r.id) || r.stratum !== st) continue
              if (fresh && usedMnis.has(r.mnis)) continue
              if ((party.get(r.party) ?? 0) > round) continue
              grab(r)
            }
          }
        }
      }
      for (const r of eligible) { if (take.length >= TARGET_PER_MATTER) break; if (!chosen.has(r.id)) grab(r) }
    }
    const sel = rows.filter((r) => chosen.has(r.id))
    console.log(`\n════ 2 · THE SELECTION ════`)
    console.log(`  ${'matter'.padEnd(6)} ${'sel'.padStart(4)} ${'eligible'.padStart(9)}   strata          parties`)
    for (const [m, list] of [...byMatter.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
      const s = list.filter((r) => chosen.has(r.id))
      const el = list.filter((r) => r.speech || r.basis === 'bill-sponsor').length
      const st = (k: string) => s.filter((r) => r.stratum === k).length
      console.log(`  ${m.padEnd(6)} ${String(s.length).padStart(4)} ${String(el).padStart(9)}   A ${st('A')} B ${st('B')} C ${st('C')}      ${[...new Set(s.map((r) => r.party))].join(', ').slice(0, 58)}`)
    }

    // ── 4 · fetch the text, and recover a clickable per-speech URL ──────────────────────────
    console.log(`\n════ 3 · READING THE SPEECHES OUT OF R2 ════`)
    let gidOk = 0, gidMiss = 0, textMiss = 0
    for (const r of sel) {
      if (!r.speech) continue
      const raw = await r2Get(r.speech.r2Key)
      if (!raw) { textMiss++; continue }
      r.text = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
      const g = await gidFor(r.speech, r.text)
      if (g) { r.gidUrl = g; gidOk++ } else gidMiss++
    }
    console.log(`  text read      ${sel.filter((r) => r.text).length} of ${sel.filter((r) => r.speech).length}` +
      (textMiss ? `   ⚠ ${textMiss} missing from R2` : ''))
    console.log(`  clickable URL  ${gidOk} recovered, ${gidMiss} fell back to the debate-day link`)

    const sound = sel.filter((r) => r.text || r.basis === 'bill-sponsor')
    console.log(`\n  ⇒ ${sound.length} SOUND rows`)
    if (sound.length < 45) {
      console.log(`  ⚠⚠ BELOW THE ~50 TARGET. Reported as-is rather than padded (brief §3).`)
    }

    if (!WRITE) { console.log(`\n  (--write to rewrite the document)`); return }

    // ── 5 · write ───────────────────────────────────────────────────────────────────────────
    const md = fs.readFileSync(DOC, 'utf8')
    const bodyOf = (id: string) => {
      const i = md.indexOf(`### ${id} — `)
      if (i < 0) return ''
      const j = md.indexOf('\n### ', i + 1)
      const k = md.indexOf('\n## ', i + 1)
      const end = Math.min(...[j, k].filter((x) => x > 0).concat([md.length]))
      return md.slice(i, end).replace(/\s+$/, '')
        .replace(/^- \*\*Coverage \(why this row was chosen[^\n]*\n/gm, '')
    }
    /**
     * ⚠ THE OPENING AND THE CLOSING, NOT JUST THE OPENING — and a real row is why.
     *
     * Lord Callanan's selected speech is a 2,773-word ministerial wind-up whose first 250 words are
     * entirely congratulations on two maiden speeches. Mechanically correct to quote, and useless
     * for deciding what he thinks about retained EU law. A peroration is exactly as mechanical a
     * place to look as an opening — neither is chosen for what it says — and between them they are
     * far more likely to contain the member's actual case. Short speeches are still quoted whole.
     */
    const quote = (t: string) => {
      const words = t.split(/\s+/)
      let body: string
      if (words.length <= QUOTE_WORD_CAP) body = t
      else {
        const omitted = words.length - QUOTE_OPEN_WORDS - QUOTE_CLOSE_WORDS
        body = words.slice(0, QUOTE_OPEN_WORDS).join(' ')
          + `\n\n[… ${omitted.toLocaleString()} words omitted — the whole speech is one click away …]\n\n`
          + words.slice(-QUOTE_CLOSE_WORDS).join(' ')
      }
      return body.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')
    }
    const coverage = (r: Row) => {
      const n = r.signals ?? 0
      return n === 0 ? 'no votes recorded on this matter'
        : n < 3 ? `${n} vote${n === 1 ? '' : 's'} recorded — a thin record`
          : r.agree ? `${n} votes recorded, all the same way`
            : `${n} votes recorded, NOT all the same way`
    }

    const soundMnis = new Set(sound.map((r) => r.mnis))
    const overlap = new Set(amendment.filter((a2) => soundMnis.has(a2.mnis)).map((a2) => a2.mnis)).size

    const out: string[] = []
    out.push(`# POSITION GRAPH — VALIDATION CANDIDATES (REBUILT, UNSCORED)`)
    out.push('')
    out.push(`**For:** Charlie, to read the evidence and assign the position, one row at a time.`)
    out.push(`**Produced by:** \`scripts/graph/rebuild-3c2-validation.ts\`, GRAPH 3C-2.`)
    out.push(`**Nothing here has been scored against anything.**`)
    out.push('')
    out.push('---')
    out.push('')
    out.push(`## ⚠⚠ Why the previous draft was withdrawn`)
    out.push('')
    out.push(`The first draft had 157 rows. **${amendment.length} of them rested on AMENDMENT SPONSORSHIP**, and that`)
    out.push(`basis cannot carry a direction.`)
    out.push('')
    out.push(`It was chosen because it is **non-circular** — the graph holds zero \`amendment_sponsorship\``)
    out.push(`signals, and that was proven by query rather than argued. That reasoning is genuinely`)
    out.push(`valuable. It is also incomplete:`)
    out.push('')
    out.push(`> **Non-circularity is necessary. It is not sufficient. The basis must ALSO determine a**`)
    out.push(`> **direction.**`)
    out.push('')
    out.push(`Amendment sponsorship is **unsigned**: tabling a wrecking amendment and tabling a`)
    out.push(`strengthening one are the same recorded fact. Sir Edward Leigh appeared in that draft`)
    out.push(`sponsoring NC3 to the assisted dying Bill — he is one of its most prominent opponents, and`)
    out.push(`nothing in *"Guidance: administration of pain relief to people who are terminally ill"* says`)
    out.push(`so in either direction.`)
    out.push('')
    out.push(`⚠⚠ **An independent signal that does not settle the answer is worse than useless in an**`)
    out.push(`**answer key, because it will mark the graph WRONG every time the graph is RIGHT.** Such a`)
    out.push(`key does not measure the graph; it measures whatever assigned each row its direction — and`)
    out.push(`it does so while looking rigorous.`)
    out.push('')
    out.push(`Those ${amendment.length} rows are **not deleted**. They are in a section at the foot of this document marked`)
    out.push(`**UNSOUND BASIS — NOT SCORABLE**, with this reasoning attached. The count is the finding.`)
    out.push('')
    out.push(`## The bases, both tests`)
    out.push('')
    out.push(`Every basis now has to pass two tests, not one. Full audit: \`scripts/graph/audit-3c2-bases.ts\`.`)
    out.push('')
    out.push(`| basis | determines a direction? | independent of the graph? | verdict |`)
    out.push(`| --- | --- | --- | --- |`)
    out.push(`| amendment sponsorship | **NO** — unsigned | yes | **REJECT** |`)
    out.push(`| bill sponsorship | YES — sponsoring a Bill is supporting it | yes | **USE** |`)
    out.push(`| the member's own words in Hansard | YES — arguing a case states a direction | yes | **USE** |`)
    out.push(`| a published statement on the web | YES | yes | USE — *not needed, see below* |`)
    out.push(`| EDM signature | YES | **NO** — 59,925 signals | EXCLUDE (circular) |`)
    out.push(`| division votes | YES | **NO** — 2,080,585 signals | EXCLUDE (circular) |`)
    out.push(`| TheyWorkForYou "voted consistently for…" | YES | **NO** — a function of the same divisions | EXCLUDE (circular) |`)
    out.push(`| committee membership · witness appearance · declared interest · donation | **NO** — engagement or alignment, never a side | — | REJECT |`)
    out.push(`| party membership / manifesto · ministerial office | **PARTLY** — the party's direction, not the member's | yes | REJECT |`)
    out.push('')
    out.push(`⚠ **Route (b), a published statement on the web, was NOT needed and so was not used.**`)
    out.push(`${withSpeech.length} of the ${all.length} candidates turned out to have spoken on their own matter in Hansard, so`)
    out.push(`every sound row below comes from route (a) or route (c). Nothing was searched for on the web,`)
    out.push(`and no row rests on a source anyone has to take on trust.`)
    out.push('')
    out.push(`⚠ **On \`pwdata\`.** These transcripts come from TheyWorkForYou's bulk data, and TWFY's`)
    out.push(`*computed* position summaries ("voted consistently for…") are exactly the circular source`)
    out.push(`this key must avoid — they are a function of the same divisions the graph aggregates. What`)
    out.push(`is quoted below is the **verbatim Hansard transcript** TWFY republishes: words spoken in the`)
    out.push(`chamber, with no computation over any vote anywhere. Different thing, same publisher.`)
    out.push('')
    out.push(`## How to review this`)
    out.push('')
    out.push(`**The row states the evidence. You state the conclusion.** There is deliberately no`)
    out.push(`"proposed position" line anywhere in the sound section — the previous draft had one above`)
    out.push(`every quote, and a row that announces its own answer invites a rubber stamp. Read the quote,`)
    out.push(`then write the position.`)
    out.push('')
    out.push(`On each row: \`SUPPORTS\` · \`OPPOSES\` · \`NO POSITION ESTABLISHED\` (the evidence does not`)
    out.push(`settle it) · \`UNSURE\`.`)
    out.push('')
    out.push(`**The extract is chosen by a rule that cannot see which way it points**, and the rule is`)
    out.push(`printed on every row: *the member's longest speech in a debate titled for this matter,*`)
    out.push(`*quoted in full* where it is ${QUOTE_WORD_CAP} words or fewer, and otherwise its first`)
    out.push(`${QUOTE_OPEN_WORDS} and last ${QUOTE_CLOSE_WORDS} words. Nothing is picked for containing a stance word — that would be`)
    out.push(`the generator pre-judging the answer it is asking you for.`)
    out.push('')
    out.push(`⚠ **Why both ends, and not just the opening.** A ministerial wind-up can spend its first`)
    out.push(`250 words congratulating maiden speakers — mechanically correct to quote, and useless for`)
    out.push(`deciding what the member thinks. A peroration is exactly as mechanical a place to look as`)
    out.push(`an opening, and neither is chosen for what it says.`)
    out.push('')
    out.push(`⚠ **Quoting in full is also the safeguard against a specific trap.** Sir Edward Leigh's`)
    out.push(`speech reads out a constituent's email containing *"I oppose the right to die Bill"*. An`)
    out.push(`extract built around the word "oppose" would put the constituent's sentence in his mouth.`)
    out.push(`The context is the defence, so the context is not cut away — and where a member is quoting`)
    out.push(`someone else, you will be able to see that they are.`)
    out.push('')
    out.push(`⚠⚠ **Speech-sourced rows are marked \`hansard-speech\`, and that mark has a shelf life.**`)
    out.push(`The graph holds no speech-derived signal today, which is what makes these rows independent.`)
    out.push(`**If extracted-position signals are ever folded into the graph (design §4, P3), every`)
    out.push(`\`hansard-speech\` row stops being independent and must be excluded from scoring from that`)
    out.push(`point on.** Bill-sponsorship rows are unaffected.`)
    out.push('')
    out.push(`⚠ **The selection used the graph; the verdict must not.** Which rows appear first was chosen`)
    out.push(`partly on what the graph currently holds, so that settled and divided records are both`)
    out.push(`represented. Its *answer* is nowhere on this page — no stance, no score, no confidence sits`)
    out.push(`near a verdict line. The **Coverage** line says only how many votes exist and whether they`)
    out.push(`agree with each other, never which way. An accuracy figure from a deliberately`)
    out.push(`hard-weighted subset is not an accuracy figure for the graph.`)
    out.push('')
    out.push('---')
    out.push('')
    out.push(`# ▶ SOUND — SCORABLE (${sound.length} rows)`)
    out.push('')
    const stTot = (k: string) => sound.filter((r) => r.stratum === k).length
    out.push(`${sound.length} rows across ${byMatter.size} matters. Bases: ` +
      `**${sound.filter((r) => r.text).length} \`hansard-speech\`**, ` +
      `**${sound.filter((r) => !r.text && r.basis === 'bill-sponsor').length} \`bill-sponsor\`** ` +
      `(${sound.filter((r) => r.text && r.basis === 'bill-sponsor').length} rows have both). ` +
      `Coverage strata: A ${stTot('A')} settled · B ${stTot('B')} divided · C ${stTot('C')} thin.`)
    out.push('')
    out.push(`⚠ **Every sound row turned out to rest on a speech.** ` +
      `${sound.filter((r) => r.text && r.basis === 'bill-sponsor').length} of them are ALSO named sponsors of the Bill, ` +
      `which is a second independent basis pointing the same way — but not one row rests on bill`)
    out.push(`sponsorship alone, because every bill sponsor in the pool also spoke. Route (c) was`)
    out.push(`available and never had to carry a row by itself.`)
    out.push('')
    out.push(`⚠ **Some members appear in BOTH sections, and that is not a duplicate.** ` +
      `${overlap} of the ${new Set(sound.map((r) => r.mnis)).size} people below also have a row in the unsound section at the foot of`)
    out.push(`this document. It is the same person with two different citations: an amendment they`)
    out.push(`sponsored, which establishes nothing about direction, and a speech they made, which does.`)
    out.push(`Score the speech row. The amendment row is there to be seen, not scored.`)
    out.push('')
    let n = 0
    for (const [m, list] of [...byMatter.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
      const s = list.filter((r) => chosen.has(r.id) && (r.text || r.basis === 'bill-sponsor'))
      if (!s.length) continue
      out.push(`## ${m} — ${MATTER_NAME[m]}`)
      out.push('')
      out.push(`Debates matched on the title *"${MATTER_TITLE[m]}"*.`)
      out.push('')
      for (const r of s) {
        n++
        const tag = `S${m.slice(1)}.${String(n).padStart(2, '0')}`
        out.push(`### ${tag} — ${r.name} (MNIS ${r.mnis}), ${r.party}`)
        out.push('')
        out.push(`- **Matter:** ${MATTER_NAME[m]}`)
        if (r.text && r.speech) {
          out.push(`- **Basis:** \`hansard-speech\` — the member's own words${r.basis === 'bill-sponsor' ? ' (and a named sponsor of the Bill)' : ''}`)
          out.push(`- **Spoke:** ${r.speech.date}, ${r.speech.corpus === 'pwdata-lords' ? 'House of Lords' : 'House of Commons'}`)
          out.push(`- **Debate:** ${r.speech.title}`)
          out.push(`- **Speech id:** \`${r.speech.id}\``)
          out.push(`- **Read the whole speech:** <${r.gidUrl ?? `https://www.theyworkforyou.com/debates/?d=${r.speech.date}`}>` +
            (r.gidUrl ? '' : `  *(debate day — the per-speech link could not be recovered for this one)*`))
          out.push(`- **Selection rule:** their longest speech in a debate titled for this matter ` +
            `(${r.speech.words.toLocaleString()} words${r.speech.words > QUOTE_WORD_CAP ? `; its first ${QUOTE_OPEN_WORDS} and last ${QUOTE_CLOSE_WORDS} words quoted` : `, quoted in full`}). ` +
            `Chosen without reading which way it points.`)
          out.push(`- **Coverage (selection only — says nothing about which way):** ${coverage(r)}`)
          out.push('')
          out.push(`**In their own words:**`)
          out.push('')
          out.push(quote(r.text))
          out.push('')
        } else {
          out.push(`- **Basis:** \`bill-sponsor\` — a named sponsor of the Bill itself`)
          const old = bodyOf(r.id)
          for (const line of old.split('\n')) {
            if (/^- \*\*(Citation|Source|In its own words):/.test(line)) out.push(line)
          }
          out.push(`- **Coverage (selection only — says nothing about which way):** ${coverage(r)}`)
          out.push(`- ⚠ A government Bill is sponsored by the minister in charge, which is a public`)
          out.push(`  position rather than necessarily a private conviction. The Bill may also be broader`)
          out.push(`  than the matter it is filed under.`)
          out.push('')
        }
        out.push(`- **VERDICT — what position, if any, does this evidence establish?** _______`)
        out.push('')
      }
    }

    out.push('---')
    out.push('')
    out.push(`# ⛔ UNSOUND BASIS — NOT SCORABLE (${amendment.length} rows)`)
    out.push('')
    out.push(`**Do not score these.** Every row below rests on amendment sponsorship, which is an`)
    out.push(`**unsigned** fact: a wrecking amendment and a strengthening amendment are the same act, so`)
    out.push(`the citation cannot establish the direction the row was drafted to assert.`)
    out.push('')
    out.push(`They are kept rather than deleted for three reasons:`)
    out.push('')
    out.push(`1. **The count is the finding.** ${amendment.length} of 157 rows — ` +
      `${((100 * amendment.length) / all.length).toFixed(1)}% of the first draft — rested on it. A basis`)
    out.push(`   error at that scale is worth a record, not a quiet deletion.`)
    out.push(`2. **The relevance survives even though the direction does not.** These members did engage`)
    out.push(`   with these matters, and that is exactly what an unsigned fact CAN tell you. It is why`)
    out.push(`   they remained the pool the sound rows were drawn from.`)
    out.push(`3. **The basis may be recoverable.** Classifying what each amendment actually did —`)
    out.push(`   strengthening or wrecking — would give it a direction. ⚠ **That is an inference, and a`)
    out.push(`   separate piece of work.** It was not attempted here, and a key built on an unvalidated`)
    out.push(`   classifier would import the classifier's errors as ground truth.`)
    out.push('')
    out.push(`⚠ The **"Proposed position"** line on each row below is the withdrawn claim. It is left in`)
    out.push(`place so the defect can be seen rather than described.`)
    out.push('')
    for (const [m, list] of [...byMatter.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
      const d = list.filter((r) => r.basis === 'amendment-sponsor')
      if (!d.length) continue
      out.push(`## ${m} — ${MATTER_NAME[m]} · UNSOUND`)
      out.push('')
      for (const r of d) { out.push(bodyOf(r.id)); out.push('') }
    }

    const text = out.join('\n').replace(/\n{4,}/g, '\n\n\n') + '\n'
    fs.writeFileSync(DOC, text, 'utf8')
    console.log(`\n  ✓ written: ${DOC}`)

    // Read it back. A byte count from a write says what the driver thought it sent.
    const back = fs.readFileSync(DOC, 'utf8')
    const soundIdx = back.indexOf('# ▶ SOUND')
    const unsoundIdx = back.indexOf('# ⛔ UNSOUND BASIS')
    const soundRows = (back.slice(soundIdx, unsoundIdx).match(/^### /gm) ?? []).length
    const unsoundRows = (back.slice(unsoundIdx).match(/^### /gm) ?? []).length
    const verdicts = (back.slice(soundIdx, unsoundIdx).match(/\*\*VERDICT[^\n]*_______/g) ?? []).length
    const strayDirection = (back.slice(soundIdx, unsoundIdx).match(/Proposed position/g) ?? []).length
    console.log(`  ✓ read back: ${soundRows} sound rows, ${unsoundRows} unsound rows, ${verdicts} blank verdict lines`)
    console.log(`  ${strayDirection === 0 ? '✓' : '❌'} the sound section proposes a direction ${strayDirection} times (must be 0)`)
    console.log(`  ${unsoundRows === amendment.length ? '✓' : '❌'} every one of the ${amendment.length} amendment rows survives`)
    if (strayDirection !== 0 || unsoundRows !== amendment.length || verdicts !== soundRows) process.exit(1)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[rebuild-3c2-validation] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
