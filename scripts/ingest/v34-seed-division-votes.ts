/**
 * v34-seed-division-votes.ts — §A of BRIEF_INGEST_POLITICAL_SOURCES.
 *
 * Replaces v28-seed-division-votes.ts, which was written, never run, and
 * carried the 25-cap enumeration bug documented in sources/division-votes.ts.
 *
 *   --pilot     end-to-end on a handful of real divisions per house, spread
 *               across the whole date range rather than the newest N. Prints
 *               the compiled text and the structured rows it WOULD write.
 *               Writes nothing.
 *   --measure   the universe: per-house totals, enumeration reconciled against
 *               searchTotalResults, date range, predicted member-row count.
 *               Writes nothing. Run this before --seed and record the
 *               prediction, so the actual can be scored against it.
 *   --seed      enumerate both houses, bulk-insert one queue row per division,
 *               upsert corpus_targets.
 *   --verify    attempted-vs-stored reconciliation AFTER a run.
 *
 * sourceType 'division-votes' + corpora commons-divisions-votes /
 * lords-divisions-votes. Per INGEST_PLAYBOOK §8, a NEW sourceType is seeded
 * POST-PUSH — the processor must be deployed before rows exist for it, or the
 * workers fail every row and the zero-output breaker trips.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import {
  divisionTotal, enumerateDivisions, listDivisionsPage, fetchDivisionDetail,
  compileDivisionText, LIST_PAGE_CAP, type House,
} from './sources/division-votes'

const SOURCE = 'division-votes'
const CORPUS: Record<House, string> = { commons: 'commons-divisions-votes', lords: 'lords-divisions-votes' }
const HOUSES: House[] = ['commons', 'lords']

// ── PILOT ────────────────────────────────────────────────────────────────────
async function pilot() {
  for (const house of HOUSES) {
    console.log(`\n════════ PILOT ${house.toUpperCase()} ════════`)
    const total = await divisionTotal(house)
    console.log(`searchTotalResults: ${total}`)
    if (!total) continue

    // Spread across the range. A pilot on the newest N has not exercised the
    // format — the V.3-B encoding bug surfaced at item 33,942 for exactly this
    // reason (docs/CLAUDE.md §14).
    const picks = [0, Math.floor(total * 0.5), total - 1]
    for (const skip of picks) {
      const page = await listDivisionsPage(house, skip, 1)
      const entry = page?.[0]
      if (!entry) { console.log(`  skip=${skip}: nothing listed`); continue }
      const d = await fetchDivisionDetail(house, entry.divisionId)
      if (!d) { console.log(`  division ${entry.divisionId}: DETAIL FETCH FAILED`); continue }

      const text = compileDivisionText(d)
      const byVote = { aye: 0, no: 0, absent: 0 }
      for (const m of d.members) byVote[m.vote]++
      console.log(`\n  ── division ${d.divisionId} (${d.date}) — ${d.members.length} member rows, ${text.length} chars`)
      console.log(`     votes: aye=${byVote.aye} no=${byVote.no} absent=${byVote.absent}  absenceKnown=${d.absenceKnown}`)
      console.log(`     counts as stated by API: aye=${d.ayeCount} no=${d.noCount} absent=${d.absentCount}`)
      console.log(`     context: bill=${JSON.stringify(d.context.billTitle)} stage=${JSON.stringify(d.context.stage)} amendment=${JSON.stringify(d.context.amendment)} via ${d.context.provenance}`)
      const withParty = d.members.filter(m => m.party).length
      const withCons = d.members.filter(m => m.constituency).length
      console.log(`     party present on ${withParty}/${d.members.length}; constituency on ${withCons}/${d.members.length}`)
      console.log(`     ── compiled text head ──`)
      console.log(text.split('\n').slice(0, 10).map(l => '       ' + l).join('\n'))
      await new Promise(r => setTimeout(r, 400))
    }
  }
}

// ── MEASURE ──────────────────────────────────────────────────────────────────
async function measure() {
  let grandDivisions = 0, grandMemberRows = 0
  console.log('Predicting before seeding, so the actual can be scored against it.\n')
  for (const house of HOUSES) {
    const t0 = Date.now()
    const res = await enumerateDivisions(house, 250, (c, p) => process.stdout.write(`  ${house}: ${c} divisions over ${p} pages\r`))
    const dated = res.entries.filter(e => e.date).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    console.log(`\n${house.toUpperCase()}`)
    console.log(`  page cap used            : ${LIST_PAGE_CAP[house]} (server-enforced on commons)`)
    console.log(`  searchTotalResults       : ${res.expected}`)
    console.log(`  enumerated (unique ids)  : ${res.entries.length} over ${res.pages} pages in ${Math.round((Date.now() - t0) / 1000)}s`)
    console.log(`  RECONCILED               : ${res.complete ? 'YES' : `NO — ${(res.expected ?? 0) - res.entries.length} short`}`)
    if (!res.complete) console.log(`  ⚠ an unreconciled walk must not be seeded — this is the V28 failure mode`)
    if (dated.length) console.log(`  date range               : ${dated[0].date} … ${dated[dated.length - 1].date}`)

    // Predict member rows from a real sample, not from a guess.
    let sampled = 0, members = 0
    for (const e of [0, 0.33, 0.66, 0.99].map(f => res.entries[Math.floor(res.entries.length * f)]).filter(Boolean)) {
      const d = await fetchDivisionDetail(house, e.divisionId)
      if (d) { sampled++; members += d.members.length }
      await new Promise(r => setTimeout(r, 350))
    }
    const mean = sampled ? Math.round(members / sampled) : 0
    const predicted = mean * res.entries.length
    console.log(`  mean member rows/division: ${mean} (from ${sampled} sampled)`)
    console.log(`  PREDICTED division_votes : ${predicted.toLocaleString()}`)
    grandDivisions += res.entries.length
    grandMemberRows += predicted
  }
  console.log(`\nTOTAL PREDICTED`)
  console.log(`  divisions      : ${grandDivisions.toLocaleString()}  (corpus_sections rows, and \`divisions\` rows)`)
  console.log(`  division_votes : ${grandMemberRows.toLocaleString()}`)
}

// ── SEED ─────────────────────────────────────────────────────────────────────
async function seed() {
  const pool = getNeonPool()
  let grand = 0
  for (const house of HOUSES) {
    const res = await enumerateDivisions(house, 250, (c, p) => process.stdout.write(`  ${house}: ${c} over ${p} pages\r`))
    console.log(`\n${house}: enumerated ${res.entries.length}/${res.expected} (${res.pages} pages)`)
    if (!res.complete) {
      // Refuse rather than seed a short list. A partial seed looks like a
      // complete corpus for as long as nobody counts it.
      throw new Error(`${house}: enumeration NOT reconciled (${res.entries.length} of ${res.expected}) — refusing to seed a partial universe`)
    }
    const corpus = CORPUS[house]
    const rows = res.entries.map(d => ({
      id: `${corpus}:${d.divisionId}`,
      corpus,
      docId: `${house}:${d.divisionId}`,
      sourceType: SOURCE,
      priority: 3,
    }))
    const { affected } = await bulkInsertQueueRows(rows)
    console.log(`  ${rows.length} divisions → ${affected} new queue rows`)

    const label = house === 'commons' ? 'Commons division votes (per-member)' : 'Lords division votes (per-member)'
    const note = house === 'commons'
      ? 'V34 §A: per-member division votes incl. NoVoteRecorded (absence). Open Parliament Licence v3.0.'
      : 'V34 §A: per-member division votes. ⚠ Lords publishes no absentee list — absence is a known unknown, see divisions.absence_known. OPL v3.0.'
    await pool.query(`
      INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, notes, updated_at)
      VALUES ($1, $3, $2, true, $4, NOW())
      ON CONFLICT (corpus_key) DO UPDATE SET
        display_label = $3, est_sections = $2, est_is_confirmed = true, blocked = false, blocked_reason = NULL,
        notes = $4, updated_at = NOW()
    `, [corpus, res.entries.length, label, note])
    grand += res.entries.length
  }
  console.log(`\nTOTAL division rows seeded: ${grand}`)
}

// ── VERIFY ───────────────────────────────────────────────────────────────────
// The "built inert hides write-path bugs" rule: build the attempted-vs-stored
// reconciliation first, and read it after the run rather than trusting SUCCESS.
async function verify() {
  const pool = getNeonPool()
  for (const house of HOUSES) {
    const corpus = CORPUS[house]
    const expected = await divisionTotal(house)
    const q = await pool.query(`SELECT status, COUNT(*)::int n FROM ingest_queue WHERE corpus=$1 GROUP BY status`, [corpus])
    const s = await pool.query(`SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus=$1`, [corpus])
    const d = await pool.query(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE absence_known) AS known,
                                       COUNT(*) FILTER (WHERE bill_title IS NOT NULL) AS with_bill
                                FROM divisions WHERE house=$1`, [house])
    const v = await pool.query(`SELECT vote, COUNT(*)::int n FROM division_votes WHERE house=$1 GROUP BY vote ORDER BY 1`, [house])
    console.log(`\n${house.toUpperCase()}  (API says ${expected} divisions)`)
    console.log(`  queue           : ${q.rows.map(r => `${r.status}=${r.n}`).join(' ') || '(none)'}`)
    console.log(`  corpus_sections : ${s.rows[0].n}`)
    console.log(`  divisions       : ${d.rows[0].n}   absence_known=${d.rows[0].known}   with a parsed bill title=${d.rows[0].with_bill}`)
    console.log(`  division_votes  : ${v.rows.map(r => `${r.vote}=${r.n.toLocaleString()}`).join(' ') || '(none)'}`)
    const stored = d.rows[0].n
    console.log(`  RECONCILIATION  : ${stored}/${expected} divisions stored${stored === expected ? ' ✓' : ` — ${(expected ?? 0) - stored} MISSING`}`)
  }
}

async function main() {
  const mode = process.argv.find(a => ['--pilot', '--measure', '--seed', '--verify'].includes(a)) ?? '--pilot'
  if (mode === '--pilot') await pilot()
  else if (mode === '--measure') await measure()
  else if (mode === '--verify') await verify()
  else await seed()
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
