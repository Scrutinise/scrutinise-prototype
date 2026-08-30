// CCW-B9 — where are the quotable passages?
//
// Produces evidence, draws no conclusions: CCW decides which of the four
// unverified videos get TurboScribe credits and in what order.
//
// Step 1: hit counts per term, per video, over the eight thesis-series videos,
//         with the corpus-wide total beside each so a term that matches
//         everywhere reads as uninformative rather than significant.
// Step 2: every matching passage to docs/report_run/starkey_hits.json.
// Step 3: how much the second engine actually buys, per video; and the
//         2Khgz5sMMBU coverage flag re-tested from the other direction.
import * as fs from 'fs'
import * as path from 'path'
import { pool, banner } from './db'
import { norm, lcsRatio } from './text'

const OUT = path.resolve(__dirname, '../../docs/report_run/starkey_hits.json')
const CAP = 400

// The six numbered parts, the September lecture, and the Q&A interview.
const VIDEOS = [
  'soNnF0sjF5Y', 'jnsiLNNL8s8', '8veLovq5NWQ', 'okJNAMPBRqg',
  'q1Mto3BxMcA', 'Mwf_SwRa2F0', 'EMbRv6aaQrs', '2Khgz5sMMBU',
]

const GROUPS: Array<{ measure: string; terms: string[] }> = [
  { measure: 'CRAG 2010 Part 1', terms: ['treaty', 'ratification', 'royal prerogative', 'parliamentary scrutiny'] },
  { measure: 'Human Rights Act 1998', terms: ['human rights act', 'european convention', 'strasbourg', 'european court'] },
  { measure: 'Equality Act 2010', terms: ['equality act', 'equality', 'discrimination', 'protected characteristic'] },
  { measure: 'Constitutional Reform Act 2005', terms: ['supreme court', 'lord chancellor', 'constitutional reform', 'judicial review'] },
  { measure: 'Framing terms', terms: ['blairism', 'repeal', 'restoration', 'sovereignty', 'common law', 'constitution'] },
]

const SHORT = (id: string) => id.slice(0, 6)

async function main() {
  banner('B9 quote concentration')
  const p = pool()

  const titles = new Map<string, string>()
  const durations = new Map<string, number>()
  for (const r of (await p.query(`select video_id, title, duration_s from starkey.video where video_id = any($1::text[])`, [VIDEOS])).rows) {
    titles.set(r.video_id, r.title); durations.set(r.video_id, r.duration_s)
  }

  // How many transcripts each video has. This is not decoration: three of the
  // eight have two and the other five have one, so a raw passage count is not
  // comparable across them. See the comment on moments() below.
  const nTranscripts = new Map<string, number>(
    (await p.query(`select video_id, count(*)::int n from starkey.transcript where video_id = any($1::text[]) group by 1`, [VIDEOS]))
      .rows.map(r => [r.video_id as string, r.n as number]))

  /**
   * DISTINCT MOMENTS, not passage rows: the largest number of matching passages
   * any ONE transcript of this video contains.
   *
   * A video with an `asr` and a `turboscribe` transcript stores every minute of
   * speech twice, so one thing Starkey said once matches twice and the video
   * reads as twice as dense. Parts 1-3 have two transcripts; Parts 4-6, the
   * lecture and the interview have one. Comparing raw counts across the eight —
   * which is the entire purpose of this table — would systematically favour the
   * three that already have a second transcript, i.e. exactly the ones that do
   * NOT need the next TurboScribe credit.
   *
   * ⚠ The obvious fix, merging overlapping time ranges, is WRONG here and was
   * measured to be wrong before this was written. The two engines segment
   * differently, so their passage boundaries interleave and the merge CHAINS:
   * asr 229-305, turboscribe 234-314, asr 305-381 all become one interval.
   * `constitution` in 8veLovq5NWQ is 5 occurrences in each transcript and the
   * merge returns 2. That replaces a 2x overcount with a 2.5x undercount.
   *
   * Max-over-sources cannot chain, and is exactly the number a single-transcript
   * video would report, so the eight are comparable. It is a FLOOR: if the two
   * engines word two different occurrences such that only one matches in each,
   * the true count is higher. That direction is safe here — this table is used
   * to decide where to spend a transcription credit, and undercounting a video
   * that already has two transcripts cannot mislead that decision.
   */
  const moments = async (term: string, videoId: string): Promise<number> => {
    const rows = (await p.query(`
      select source, count(*)::int n from starkey.passage
      where tsv @@ phraseto_tsquery('english',$1) and video_id = $2 group by 1`, [term, videoId])).rows
    return rows.length ? Math.max(...rows.map(r => r.n as number)) : 0
  }

  // ---------- Step 1 ----------
  console.log('\n--- STEP 1: distinct moments by video ---')
  console.log('')
  console.log('Per-video cells are DISTINCT MOMENTS on a PHRASE match — the number to compare.')
  console.log('Two things are being corrected in that sentence, both of which inflate a naive count:')
  console.log('')
  console.log('  1. plainto_tsquery("constitutional reform") is constitut & reform: both lexemes')
  console.log('     ANYWHERE in the same 60-90s passage, not the phrase. [ph] columns require them')
  console.log('     adjacent. constitutional reform is 9 co-occurrences and 0 uses of the phrase.')
  console.log('  2. A video with two transcripts stores every minute twice, so one thing said once')
  console.log('     matches twice. Parts 1-3 have two, the other five have one — the three already')
  console.log('     transcribed would read as twice as dense as the candidates for the next credit.')
  console.log('     A cell is the count in whichever single transcript has the most (NOT a merge of')
  console.log('     overlapping ranges, which chains across the two engines\' boundaries).')
  console.log('')
  console.log('⚠ A phrase match is adjacent STEMS, not literal words: "the equalities act" matches')
  console.log('  the term "equality act". Usually a gain — it finds a measure named colloquially —')
  console.log('  but check literal_match in starkey_hits.json before quoting a term\'s own wording.')
  console.log('')
  console.log('"corpus" columns are the whole 285-video corpus, so a term matching everywhere is')
  console.log('visible as uninformative rather than significant. (n) marks a two-transcript video.\n')
  const header = 'term                      corpus  corpus[ph]  '
    + VIDEOS.map(v => `${SHORT(v)}${(nTranscripts.get(v) ?? 1) > 1 ? '*' : ' '}`.padStart(8)).join('') + '   moments'
  const rowsOut: string[] = []

  for (const g of GROUPS) {
    rowsOut.push(`\n${g.measure}`)
    for (const term of g.terms) {
      const { rows } = await p.query(`
        select video_id, count(*)::int n from starkey.passage
        where tsv @@ plainto_tsquery('english',$1) and video_id = any($2::text[])
        group by 1`, [term, VIDEOS])
      const byVid = new Map<string, number>(rows.map(r => [r.video_id as string, r.n as number]))
      const mom = new Map<string, number>()
      for (const v of VIDEOS) mom.set(v, await moments(term, v))
      const [{ n: corpus }] = (await p.query(
        `select count(*)::int n from starkey.passage where tsv @@ plainto_tsquery('english',$1)`, [term])).rows
      const [{ n: corpusPh }] = (await p.query(
        `select count(*)::int n from starkey.passage where tsv @@ phraseto_tsquery('english',$1)`, [term])).rows
      const cells = VIDEOS.map(v => String(mom.get(v) ?? 0).padStart(8)).join('')
      const rawTotal = VIDEOS.reduce((s, v) => s + (byVid.get(v) ?? 0), 0)
      const momTotal = VIDEOS.reduce((s, v) => s + (mom.get(v) ?? 0), 0)
      const gap = rawTotal !== momTotal ? `  <-- raw passage count was ${rawTotal}` : ''
      rowsOut.push(`  ${term.padEnd(24)}${String(corpus).padStart(6)}${String(corpusPh).padStart(12)}  ${cells}${String(momTotal).padStart(10)}${gap}`)
    }
  }
  console.log(header)
  console.log(rowsOut.join('\n'))
  console.log('\nkey: ' + VIDEOS.map(v => `${SHORT(v)}=${String(titles.get(v)).slice(0, 46)}`).join('\n     '))

  const allTerms = GROUPS.flatMap(g => g.terms)

  // ---------- Step 1b: every empty term re-asked a second way ----------
  // A term with zero corpus-wide hits is either genuinely absent or a retrieval
  // failure, and the two look identical in the table above. Filing the second
  // as the first would tell the report Starkey never discusses something he
  // discusses. So each zero is re-asked with ILIKE against the raw cue text,
  // bypassing the tsvector entirely.
  console.log('\n--- STEP 1b: zero-hit terms re-asked against raw text (ILIKE, no index) ---')
  const zeros: string[] = []
  for (const term of allTerms) {
    const [{ n }] = (await p.query(`select count(*)::int n from starkey.passage where tsv @@ plainto_tsquery('english',$1)`, [term])).rows
    if (n === 0) zeros.push(term)
  }
  if (!zeros.length) console.log('  (no term returned zero corpus-wide)')
  for (const term of zeros) {
    const [{ n, v }] = (await p.query(
      `select count(*)::int n, count(distinct video_id)::int v from starkey.cue where text ilike $1`, [`%${term}%`])).rows
    console.log(n === 0
      ? `  ${term.padEnd(24)} absent from the corpus by both routes`
      : `  ${term.padEnd(24)} !! ${n} cues in ${v} videos contain it — RETRIEVAL FAILURE, not a gap`)
    if (n === 0) {
      // Near-misses matter: "ratification" being absent while "ratify" appears
      // is a fact about vocabulary, not about the subject.
      const stem = term.split(' ')[0].replace(/(ation|ing|ed|s)$/, '')
      if (stem.length >= 5) {
        const [{ n: near, v: nv }] = (await p.query(
          `select count(*)::int n, count(distinct video_id)::int v from starkey.cue where text ilike $1`, [`%${stem}%`])).rows
        if (near > 0) console.log(`  ${''.padEnd(24)}    but "${stem}*" appears in ${near} cues across ${nv} videos`)
      }
    }
  }

  // ---------- Step 2 ----------
  const hits: Array<Record<string, unknown>> = []
  for (const g of GROUPS) {
    for (const term of g.terms) {
      const { rows } = await p.query(`
        select p.video_id, p.source, p.start_s::float start_s, p.end_s::float end_s, p.text,
               ts_rank(p.tsv, plainto_tsquery('english',$1)) rank,
               (p.tsv @@ phraseto_tsquery('english',$1)) phrase_match,
               (p.text ilike '%' || $1 || '%') literal_match
        from starkey.passage p
        where p.tsv @@ plainto_tsquery('english',$1) and p.video_id = any($2::text[])
        order by rank desc`, [term, VIDEOS])
      for (const r of rows) {
        hits.push({
          video_id: r.video_id, title: titles.get(r.video_id) ?? null, source: r.source,
          start_s: r.start_s, end_s: r.end_s, text: r.text, term, measure: g.measure,
          rank: Number(r.rank),
          // false = the term's words are all in this passage but not adjacent.
          // A multi-word term with phrase_match false is co-occurrence, and
          // quoting it as an instance of the phrase would be wrong.
          phrase_match: r.phrase_match === true,
          // phraseto_tsquery matches adjacent STEMS, not the literal words.
          // "the equalities act" matches the term "equality act" because both
          // stem to equal <-> act. That is usually a GAIN -- it finds the
          // measure named colloquially -- but it means phrase_match true does
          // not license quoting the term's own wording. literal_match does.
          literal_match: r.literal_match === true,
          watch_url: `https://www.youtube.com/watch?v=${r.video_id}&t=${Math.floor(r.start_s)}s`,
        })
      }
    }
  }
  const before = hits.length
  hits.sort((a, b) => (b.rank as number) - (a.rank as number))
  const capped = before > CAP
  const written = capped ? hits.slice(0, CAP) : hits
  fs.writeFileSync(OUT, JSON.stringify({
    generated_at: new Date().toISOString(),
    videos: VIDEOS, terms: allTerms,
    hits_found: before, hits_written: written.length,
    capped, cap: CAP,
    note: capped
      ? `TRUNCATED: ${before - CAP} of ${before} hits are not in this file. Sorted by ts_rank descending.`
      : 'Complete: every hit for these terms over these videos is present.',
    hits: written,
  }, null, 2), 'utf8')
  console.log(`\n--- STEP 2: ${OUT}`)
  console.log(`hits found ${before}, written ${written.length}${capped ? ` — CAPPED, ${before - CAP} omitted` : ' — complete, nothing omitted'}`)
  const bySource = new Map<string, number>()
  for (const h of written) bySource.set(h.source as string, (bySource.get(h.source as string) ?? 0) + 1)
  console.log('by source: ' + [...bySource].map(([k, v]) => `${k}=${v}`).join('  '))
  const nonPhrase = written.filter(h => h.phrase_match === false).length
  const nonLiteral = written.filter(h => h.phrase_match === true && h.literal_match === false).length
  console.log(`phrase matches ${written.length - nonPhrase}, co-occurrence only ${nonPhrase}`
    + ' — the second group must not be quoted as instances of the phrase')
  console.log(`of the phrase matches, ${nonLiteral} do not contain the term's literal wording`
    + ' — phraseto_tsquery matches adjacent STEMS (equalities act matches "equality act")')

  // ---------- Step 3.2 ----------
  console.log('\n--- STEP 3.2: what the second engine buys, per video ---')
  console.log('For each turboscribe passage, the ASR words in the same time window are')
  console.log('gathered and compared. Below 0.95 similarity means the two engines rendered')
  console.log('that stretch differently — that is a passage a human has to check.\n')
  for (const id of ['soNnF0sjF5Y', 'jnsiLNNL8s8', '8veLovq5NWQ']) {
    const ts = (await p.query(
      `select start_s::float s, end_s::float e, text from starkey.passage where video_id=$1 and source='turboscribe' order by start_s`, [id])).rows
    if (!ts.length) { console.log(`  ${id}: no turboscribe passages`); continue }
    const asrCues = (await p.query(
      `select start_s::float s, end_s::float e, text from starkey.cue where video_id=$1 and source='asr' order by start_s`, [id])).rows
    let diverged = 0
    const scores: number[] = []
    const worst: Array<{ s: number; score: number; a: string; b: string }> = []
    for (const pg of ts) {
      const window = asrCues.filter(c => c.e > pg.s && c.s < pg.e).map(c => c.text).join(' ')
      const score = lcsRatio(norm(pg.text), norm(window))
      scores.push(score)
      if (score < 0.95) diverged++
      worst.push({ s: pg.s, score, a: pg.text, b: window })
    }
    scores.sort((a, b) => a - b)
    worst.sort((a, b) => a.score - b.score)
    console.log(`  ${id}  ${titles.get(id)?.slice(0, 42)}`)
    console.log(`    ${ts.length} turboscribe passages; ${diverged} below 0.95 (${(100 * diverged / ts.length).toFixed(0)}%)`)
    console.log(`    similarity min/median/max: ${scores[0].toFixed(3)} / ${scores[Math.floor(scores.length / 2)].toFixed(3)} / ${scores[scores.length - 1].toFixed(3)}`)
    const w = worst[0]
    console.log(`    lowest at ${new Date(Math.floor(w.s) * 1000).toISOString().slice(11, 19)} (${w.score.toFixed(3)}) https://www.youtube.com/watch?v=${id}&t=${Math.floor(w.s)}s`)
    console.log(`      turboscribe: ${w.a.slice(0, 150)}`)
    console.log(`      asr        : ${w.b.slice(0, 150)}`)
  }

  // ---------- Step 3.3 ----------
  // The B7 coverage flag said 2Khgz5sMMBU's ASR stops at 20:20. If a hit from
  // that video appears after 1220s, either the flag is wrong or something else
  // is. Asked here from the opposite direction, against the exported file.
  console.log('\n--- STEP 3.3: 2Khgz5sMMBU hits after 20:20 (must be none) ---')
  const late = written.filter(h => h.video_id === '2Khgz5sMMBU' && (h.start_s as number) > 1220)
  const total2K = written.filter(h => h.video_id === '2Khgz5sMMBU').length
  console.log(`${total2K} hits from 2Khgz5sMMBU in the export; ${late.length} of them start after 20:20`)
  for (const h of late.slice(0, 5)) console.log(`  !! ${h.watch_url}  ${String(h.text).slice(0, 100)}`)
  // A filter that never has anything to reject is not evidence. Show the check
  // can see late passages at all, by asking a video that HAS them.
  const control = (await p.query(
    `select count(*)::int n from starkey.passage where video_id='EMbRv6aaQrs' and start_s > 1220`)).rows[0].n
  console.log(`control — passages after 20:20 in the 46-minute lecture: ${control} (must be > 0, or the time filter is broken)`)
  const lastCue = (await p.query(
    `select max(end_s)::float m from starkey.cue where video_id='2Khgz5sMMBU'`)).rows[0].m
  console.log(`2Khgz5sMMBU last cue ends ${lastCue.toFixed(1)}s of ${durations.get('2Khgz5sMMBU')}s — B7's flag ${lastCue < (durations.get('2Khgz5sMMBU') ?? 0) * 0.9 ? 'HOLDS' : 'does NOT hold'}`)

  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
