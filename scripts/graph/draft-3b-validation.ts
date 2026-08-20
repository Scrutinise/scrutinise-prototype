/**
 * draft-3b-validation.ts — GRAPH 3B §3. Draft the hand-labelled validation set. SCORE NOTHING.
 *
 * Design §8 makes a hand-labelled answer key the gate on any of this reaching a user. This script
 * DRAFTS candidates; Charlie validates them, exactly like the search gold questions.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE CIRCULARITY PROBLEM, AND HOW THIS AVOIDS IT BY CONSTRUCTION RATHER THAN BY CARE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Brief §3: *"The citation is the point: an answer key sourced from the same votes the graph uses
 * would be circular and would measure nothing."*
 *
 * Being careful not to use votes is not enough — the graph also uses EDM signatures, witness
 * appearances, declared interests and (as of 3B §2.2) Electoral Commission donations. A key drawn
 * from any of those measures the graph against itself.
 *
 * So the citations come from **bill and amendment sponsorship**, fetched live from
 * `bills-api.parliament.uk`. That source is non-circular BY CONSTRUCTION, and the proof is a
 * number rather than an argument: 3A's audit found amendment sponsorship has NO SOURCE DATA in this
 * database, `position_signal` holds **zero** `amendment_sponsorship` rows, and `check-3b.ts` prints
 * that zero on every run. The graph cannot be scoring itself against a signal it does not hold.
 *
 * It is also the better evidence on its own terms: **tabling an amendment is a stronger position
 * statement than most votes** (brief §4.3). A member who puts their name to a wrecking amendment
 * has done something a whip did not make them do.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS SCRIPT WILL NOT DO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * · It will not score anything. Brief §3: *"A number scored against an unvalidated key is precisely
 *   the mistake the search stream spent two sprints undoing."*
 * · It will not invent a citation. Every line it writes was fetched in this run, and the URL that
 *   produced it is printed beside it.
 * · It will not assert a direction it derived from a heading. Where the direction is mechanical
 *   (the Bill's own sponsor supports the Bill) it says so; where it is read off the amendment's
 *   text it is marked PROPOSED and the text is quoted so the reading can be checked in one glance.
 *   S8's lesson, at 40% wrong keys, is that a confident key from outside knowledge is the failure
 *   mode here.
 *
 * Usage (from scripts/graph):
 *   npx tsx draft-3b-validation.ts            # writes docs/POSITION_VALIDATION_CANDIDATES.md
 *   npx tsx draft-3b-validation.ts --dry-run  # print, write nothing
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const DRY = process.argv.includes('--dry-run')
const OUT = path.join(__dirname, '../../docs/POSITION_VALIDATION_CANDIDATES.md')
const API = 'https://bills-api.parliament.uk/api/v1'
const UA = { 'User-Agent': 'Scrutinise/1.0 (research; cl@scrutinise.org)', Accept: 'application/json' }

/**
 * The ten matters. Chosen from what the corpus ACTUALLY holds (probe-3b-matters.ts), not from
 * memory — the Commons record starts 2016-03-09, so the classic conscience votes on abortion
 * (1966, 1990, 2008) are outside coverage and are deliberately absent.
 *
 * `billId` pins the Bill in bills-api; `divisionMatch` finds our own divisions for it.
 */
/**
 * ⚠⚠ `billId` IS PINNED, AND THE FIRST RUN IS WHY. `Bills?SearchTerm=` is not relevance-ranked, so
 * two of the ten matters resolved to the wrong Bill and would have written wrong citations into the
 * answer key:
 *
 *   · "Environment Bill"                  → **Anxiety (Environmental Concerns) Bill** (billId 2645)
 *   · "European Union (Withdrawal) Bill"  → European Union (Notification of Withdrawal) Act 2017
 *
 * The first is the kind of near-miss that reads as plausible and is not — an answer key sourced
 * from the wrong Bill measures nothing, and would have looked exactly like an answer key.
 *
 * Both are now pinned to ids read out of the API and eyeballed against the title. `titleMustMatch`
 * is the guard that makes a wrong pin FAIL rather than pass quietly, including on a future
 * regeneration when a pinned id has been reused or retired.
 */
const MATTERS: Array<{
  id: string; matter: string; billId: number; titleMustMatch: RegExp; divisionMatch: string; note: string
}> = [
  { id: 'M1', matter: 'Assisted dying', billId: 3774, titleMustMatch: /Terminally Ill Adults/i, divisionMatch: 'Terminally Ill Adults',
    note: 'A free vote throughout, and the clearest conscience matter in the corpus. 11 divisions, Nov 2024 – Jun 2025.' },
  { id: 'M2', matter: 'Removals to Rwanda', billId: 3540, titleMustMatch: /Safety of Rwanda/i, divisionMatch: 'Safety of Rwanda',
    note: 'Whipped. 54 divisions, Dec 2023 – Apr 2024, plus 63 mentioning Rwanda across other bills.' },
  { id: 'M3', matter: 'Illegal migration and small boats', billId: 3429, titleMustMatch: /Illegal Migration/i, divisionMatch: 'Illegal Migration',
    note: 'Whipped. 80 divisions, Mar – Jul 2023.' },
  { id: 'M4', matter: 'Asylum and the Nationality and Borders Act', billId: 3023, titleMustMatch: /Nationality and Borders/i, divisionMatch: 'Nationality and Borders',
    note: 'Whipped, and the largest single block of divisions in the corpus (84).' },
  { id: 'M5', matter: 'Leaving the European Union', billId: 2045, titleMustMatch: /^European Union \(Withdrawal\) (Bill|Act)/i, divisionMatch: 'European Union (Withdrawal) Bill',
    note: 'Whipped on paper and split in practice; 78 divisions, Nov 2017 – Jun 2018.' },
  { id: 'M6', matter: 'The generational smoking ban', billId: 3879, titleMustMatch: /Tobacco and Vapes/i, divisionMatch: 'Tobacco and Vapes',
    note: 'A free vote on the Conservative side at Second Reading, Apr 2024 — the corpus holds 8 divisions.' },
  { id: 'M7', matter: 'Protest and public order', billId: 3153, titleMustMatch: /^Public Order (Bill|Act)/i, divisionMatch: 'Public Order',
    note: 'Whipped. 25 divisions, May 2022 – Jun 2023.' },
  { id: 'M8', matter: 'Employment rights and industrial action', billId: 3396, titleMustMatch: /Minimum Service Levels/i, divisionMatch: 'Strikes (Minimum Service Levels)',
    note: 'Whipped. 24 divisions, Jan – Jul 2023.' },
  { id: 'M9', matter: 'Sewage, water quality and the Environment Act', billId: 2593, titleMustMatch: /^Environment (Bill|Act)/i, divisionMatch: 'Environment Bill',
    note: '39 divisions, Jan – Nov 2021. The sewage amendments are the well-reported part.' },
  { id: 'M10', matter: 'Retained EU law and the "sunset" clause', billId: 3340, titleMustMatch: /Retained EU Law/i, divisionMatch: 'Retained EU Law',
    note: 'Whipped. 25 divisions, Oct 2022 – Jun 2023.' },
]

/**
 * `summaryText` comes back as an ARRAY of strings, sometimes with inline HTML, and the API serves
 * MOJIBAKE: `â€”` is the UTF-8 bytes of an em-dash (E2 80 94) read as Windows-1252.
 * docs/CLAUDE.md §13 lists that exact signature. It is in the Commission's own JSON, not in our
 * decoding — a `curl | python -m json.tool` of the raw response shows the same bytes.
 *
 * Repaired rather than passed through, because this text is QUOTED IN THE ANSWER KEY and a key
 * Charlie cannot read is a key Charlie cannot validate. The repair is the inverse round-trip:
 * re-encode the string's code points as Latin-1 bytes and decode them as UTF-8. If that throws or
 * produces replacement characters the original is kept — a mangled quote is better than a lost one.
 */
function fixText(v: unknown): string {
  const raw = Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : ''
  let s = raw
  if (/[Ã¢â€™œ]/.test(raw)) {
    try {
      const repaired = Buffer.from(raw, 'latin1').toString('utf8')
      if (!repaired.includes('�')) s = repaired
    } catch { /* keep the original */ }
  }
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

async function j(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(45_000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

interface Candidate {
  actor: string
  memberId: number | null
  party: string | null
  proposed: string
  basis: string
  citation: string
  citationUrl: string
  quote: string
}

async function main() {
  const pool = getNeonPool()
  const out: string[] = []
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')

  out.push(`# POSITION GRAPH — VALIDATION CANDIDATES (DRAFT, UNSCORED)`)
  out.push(``)
  out.push(`**For:** Charlie, to accept / reject / amend one line at a time.`)
  out.push(`**Produced by:** \`scripts/graph/draft-3b-validation.ts\`, GRAPH 3B §3. Regenerate with`)
  out.push(`\`npx tsx draft-3b-validation.ts\` from \`scripts/graph\`.`)
  out.push(`**Generated:** ${stamp} UTC. **Nothing here has been scored against anything.**`)
  out.push(``)
  out.push(`---`)
  out.push(``)
  out.push(`## What this is, and the one property that makes it worth having`)
  out.push(``)
  out.push(`Design §8 makes a hand-labelled answer key the gate on any position estimate reaching a`)
  out.push(`user. This is the draft of that key.`)
  out.push(``)
  out.push(`**Every citation below is a BILL OR AMENDMENT SPONSORSHIP, fetched live from`)
  out.push(`\`bills-api.parliament.uk\` during this run.** That source is non-circular *by construction*,`)
  out.push(`and the proof is a number rather than an argument: this database holds **zero**`)
  out.push(`\`amendment_sponsorship\` signals — 3A's audit found the source data does not exist here, and`)
  out.push(`\`check-3b.ts\` prints that zero on every run. **The graph cannot be scored against itself`)
  out.push(`using a signal it does not hold.**`)
  out.push(``)
  out.push(`It is also better evidence than a vote. Tabling or signing an amendment is a deliberate act`)
  out.push(`a whip did not require; a whipped vote mostly measures the whip.`)
  out.push(``)
  out.push(`### How to read the \`proposed\` column`)
  out.push(``)
  out.push(`| basis | what it means | how much to trust it |`)
  out.push(`| --- | --- | --- |`)
  out.push(`| \`bill-sponsor\` | This member is a named sponsor of the Bill itself. | **Mechanical.** A sponsor supports their own Bill. |`)
  out.push(`| \`amendment-sponsor\` | This member put their name to an amendment. The amendment's own text is quoted. | **Direction is PROPOSED**, read off the quoted text. Check the quote, not me. |`)
  out.push(``)
  out.push(`⚠ **The direction on an \`amendment-sponsor\` row is the thing most likely to be wrong, and`)
  out.push(`it is wrong in a specific way:** an amendment can strengthen a Bill or wreck it, and the`)
  out.push(`text alone does not always say which. SEARCH S8 found **4 of 10** case-law gold keys wrong`)
  out.push(`when they were asserted from outside knowledge. That is the error rate this format exists to`)
  out.push(`expose — which is why the amendment's own words are printed beside every proposal.`)
  out.push(``)
  out.push(`### Verdict line`)
  out.push(``)
  out.push(`Add one line per row: \`ACCEPT\` · \`REJECT\` · \`AMEND: <the correct position>\` · \`UNSURE\`.`)
  out.push(``)
  out.push(`---`)
  out.push(``)

  let qn = 0
  const summary: string[] = []
  const wrongBill: string[] = []

  for (const m of MATTERS) {
    console.log(`\n── ${m.id} ${m.matter}`)

    // What WE hold — so the key is only ever written against divisions the graph can be asked about.
    const { rows: [held] } = await pool.query<Record<string, string>>(`
      SELECT COUNT(*)::text AS n, MIN(d.division_date)::text AS f, MAX(d.division_date)::text AS l,
             COUNT(*) FILTER (WHERE c.free_vote_like)::text AS fv,
             COALESCE(string_agg(DISTINCT d.house || ':' || d.division_id, ' ' ORDER BY d.house || ':' || d.division_id), '') AS ids
        FROM divisions d
        LEFT JOIN position_division_class c ON c.house=d.house AND c.division_id=d.division_id
       WHERE (d.title ILIKE '%'||$1||'%' OR d.bill_title ILIKE '%'||$1||'%')
         AND d.division_date >= '2016-03-09'`, [m.divisionMatch])

    // ⚠ Pinned id, then CHECKED against the title. A pin that has silently drifted must produce a
    // named refusal, not a plausible-looking set of citations from the wrong Bill.
    const best = await j(`${API}/Bills/${m.billId}`)
    if (!best) { console.log(`   ⛔ billId ${m.billId} did not resolve`); wrongBill.push(`${m.id}: billId ${m.billId} did not resolve`); continue }
    if (!m.titleMustMatch.test(best.shortTitle ?? '')) {
      console.log(`   ⛔ billId ${m.billId} is "${best.shortTitle}", which does not match ${m.titleMustMatch}`)
      wrongBill.push(`${m.id}: billId ${m.billId} is "${best.shortTitle}", expected ${m.titleMustMatch}`)
      continue
    }
    const st0 = await j(`${API}/Bills/${m.billId}/Stages?take=60`)
    const bestStages = (st0?.items ?? []) as any[]
    console.log(`   ✓ billId ${m.billId} "${best.shortTitle}" — ${bestStages.length} stages`)

    const cands: Candidate[] = []
    for (const s of (best?.sponsors ?? []) as any[]) {
      const nm = s.member?.name ?? s.organisation?.name
      if (!nm) continue
      cands.push({
        actor: nm,
        memberId: s.member?.memberId ?? null,

        party: s.member?.party ?? null,
        proposed: 'SUPPORTS',
        basis: 'bill-sponsor',
        citation: `Named sponsor of "${best.shortTitle}" (bills-api billId ${m.billId})`,
        citationUrl: `https://bills.parliament.uk/bills/${m.billId}`,
        quote: fixText(best.longTitle).slice(0, 220),
      })
    }

    // Amendments, from the stages where amendments are tabled.
    let amendmentsSeen = 0
    for (const st of bestStages) {
      if (cands.length >= 16) break
      const desc = st.description ?? st.stage?.description ?? ''
      if (!/Committee|Report|Consideration|Lords Amendments/i.test(desc)) continue
      const a = await j(`${API}/Bills/${m.billId}/Stages/${st.id}/Amendments?take=40`)
      const items = (a?.items ?? []) as any[]
      if (!items.length) continue
      amendmentsSeen += a.totalResults ?? items.length
      for (const am of items) {
        if (cands.length >= 16) break
        const sponsors = (am.sponsors ?? []) as any[]
        if (!sponsors.length) continue
        const text = fixText(am.summaryText)
        if (text.length < 25) continue
        // ⚠ The sponsor object is FLAT — `memberId` and `name` sit directly on it, not under
        // `member`. An earlier probe read `x.member?.memberId`, got undefined on every row, and
        // would have written "no MNIS id published" across the whole key. The ids are all there.
        const lead = sponsors.find((x) => x.isLead) ?? sponsors[0]
        const nm = lead.name ?? lead.member?.name
        if (!nm) continue
        if (cands.some((c) => c.actor === nm)) continue
        const coSponsors = sponsors.filter((x) => x !== lead).map((x) => x.name).filter(Boolean)
        cands.push({
          actor: nm,
          memberId: lead.memberId ?? lead.member?.memberId ?? null,
          party: lead.party ?? null,
          proposed: 'PROPOSED — read the quote',
          basis: 'amendment-sponsor',
          citation: `Lead sponsor of ${am.marshalledListText || am.amendmentPosition || `amendment ${am.amendmentId}`} at ${desc}` +
            (coSponsors.length ? `, with ${coSponsors.length} co-sponsor${coSponsors.length === 1 ? '' : 's'} (${coSponsors.slice(0, 4).join(', ')}${coSponsors.length > 4 ? ', …' : ''})` : '') +
            (am.decision && am.decision !== 'NoDecision' ? ` — decision: ${am.decision}` : ''),
          citationUrl: `https://bills.parliament.uk/bills/${m.billId}/stages/${st.id}/amendments`,
          quote: text.slice(0, 260),
        })
      }
    }
    console.log(`   ${cands.length} candidates (${amendmentsSeen} amendments seen)`)

    // ── write the matter ──────────────────────────────────────────────────────────────────────
    out.push(`## ${m.id} — ${m.matter}`)
    out.push(``)
    out.push(`${m.note}`)
    out.push(``)
    out.push(`**What the graph holds:** ${Number(held.n).toLocaleString()} divisions`)
    out.push(`${Number(held.n) ? `(${held.f} → ${held.l}), ${held.fv} classified free-vote-like` : ''}.`)
    out.push(`**Bill:** \`${best.shortTitle}\` — <https://bills.parliament.uk/bills/${m.billId}>`)
    out.push(``)
    if (Number(held.n) === 0) {
      out.push(`⛔ **We hold no divisions for this matter.** It cannot be used to score the graph and`)
      out.push(`should be struck unless a different division set is named.`)
      out.push(``)
    }
    if (!cands.length) {
      out.push(`⛔ **bills-api returned no sponsored amendments for this Bill.** No candidates could be`)
      out.push(`drafted from a non-circular source, and none have been invented. Named, not skipped.`)
      out.push(``)
      summary.push(`| ${m.id} | ${m.matter} | ${held.n} | 0 | ⛔ no non-circular citation available |`)
      out.push(`---`)
      out.push(``)
      continue
    }
    summary.push(`| ${m.id} | ${m.matter} | ${held.n} | ${cands.length} | |`)

    for (const c of cands) {
      qn++
      out.push(`### ${m.id}.${String(qn).padStart(3, '0')} — ${c.actor}${c.memberId ? ` (MNIS ${c.memberId})` : ''}${c.party ? `, ${c.party}` : ''}`)
      out.push(``)
      out.push(`- **Proposed position on ${m.matter}:** ${c.proposed}`)
      out.push(`- **Basis:** \`${c.basis}\``)
      out.push(`- **Citation:** ${c.citation}`)
      out.push(`- **Source:** <${c.citationUrl}>`)
      if (c.quote) out.push(`- **In its own words:** “${c.quote}${c.quote.length >= 220 ? '…' : ''}”`)
      if (!c.memberId) {
        out.push(`- ⚠ **No MNIS id published on this record.** The name would have to be resolved by`)
        out.push(`  matching, which is the move the standing rule forbids. Resolve by hand or strike.`)
      }
      out.push(`- **VERDICT:** _______`)
      out.push(``)
    }
    out.push(`---`)
    out.push(``)
  }

  // ── the summary table goes at the top, after the preamble ────────────────────────────────
  const head = out.splice(0, out.indexOf(`---`, 20) + 1)
  head.push(``)
  head.push(`## The matters at a glance`)
  head.push(``)
  head.push(`| # | matter | divisions we hold | candidates drafted | note |`)
  head.push(`| --- | --- | ---: | ---: | --- |`)
  head.push(...summary)
  head.push(``)
  if (wrongBill.length) {
    head.push(`⛔ **${wrongBill.length} matter(s) produced NO candidates because the pinned bill id did not`)
    head.push(`match its expected title.** Named rather than skipped, because a wrong Bill would have`)
    head.push(`produced citations that look exactly like right ones:`)
    head.push(``)
    for (const w of wrongBill) head.push(`- ${w}`)
    head.push(``)
  }
  head.push(`**${qn} candidate rows across ${MATTERS.length} matters.** Design §8 asks for ~10 matters ×`)
  head.push(`~10 actors; where a Bill produced fewer, the shortfall is stated rather than padded.`)
  head.push(``)
  head.push(`---`)
  head.push(``)

  const doc = [...head, ...out].join('\n')
  if (DRY) { console.log('\n' + doc.slice(0, 3000)); console.log('\n… (--dry-run, nothing written)') }
  else { fs.writeFileSync(OUT, doc, 'utf8'); console.log(`\n✓ ${OUT}  (${qn} candidates, ${(doc.length / 1024).toFixed(0)} kB)`) }

  await endNeonPool()
}

main().catch((e) => { console.error(e); process.exit(1) })
