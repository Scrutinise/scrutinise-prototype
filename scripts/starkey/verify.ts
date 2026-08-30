// CCW-B7 Phase 4 checks 1, 3 and 4. Timestamp alignment (check 2) is
// align-check.ts, which needs the network.
import { pool, banner } from './db'
import { readIds, readAllMeta } from './manifest'

async function main() {
  banner('verify (CCW-B7 Phase 4)')
  const p = pool()
  const ids = readIds()
  const { missing } = readAllMeta()

  const q = async (sql: string, args: unknown[] = []) => (await p.query(sql, args)).rows

  console.log('\n--- 1. ROW COUNTS ---')
  const [v] = await q(`select count(*)::int n from starkey.video`)
  const [c] = await q(`select count(*)::int n from starkey.cue`)
  const [pa] = await q(`select count(*)::int n from starkey.passage`)
  const [tr] = await q(`select count(*)::int n from starkey.transcript`)
  console.log(`ids in video_ids.txt : ${ids.length}`)
  console.log(`metadata failures    : ${missing.length}${missing.length ? ' -> ' + missing.join(', ') : ''}`)
  console.log(`starkey.video        : ${v.n}   (expected ${ids.length - missing.length})`)
  console.log(`starkey.transcript   : ${tr.n}`)
  console.log(`starkey.cue          : ${c.n.toLocaleString()}`)
  console.log(`starkey.passage      : ${pa.n.toLocaleString()}`)
  const bySource = await q(`select source, count(*)::int n from starkey.transcript group by 1 order by 2 desc`)
  console.log('transcripts by source:', bySource.map(r => `${r.source}=${r.n}`).join('  '))
  const noTr = await q(`select v.video_id, v.title from starkey.video v
                        where not exists (select 1 from starkey.transcript t where t.video_id=v.video_id)`)
  console.log(`videos with NO transcript: ${noTr.length}`)
  for (const r of noTr) console.log(`  ${r.video_id}  ${r.title}`)

  // A corpus that says the right total can still be wrong per video. Cues must
  // run inside the video's duration, and passages must reconcile to cues.
  console.log('\n--- 1b. INTERNAL CONSISTENCY ---')
  const overruns = await q(`
    select c.video_id, v.duration_s, max(c.end_s)::float last_cue
    from starkey.cue c join starkey.video v using (video_id)
    where v.duration_s is not null
    group by 1,2 having max(c.end_s) > v.duration_s + 5 order by 3 desc limit 10`)
  console.log(`videos where a cue ends more than 5s past the stated duration: ${overruns.length}`)
  for (const r of overruns) console.log(`  ${r.video_id}  duration=${r.duration_s}s  last cue ends ${r.last_cue.toFixed(1)}s`)
  const [wordCheck] = await q(`
    select sum(array_length(regexp_split_to_array(trim(text), '\\s+'),1))::bigint w from starkey.passage`)
  console.log(`words in passage table: ${Number(wordCheck.w).toLocaleString()}`)
  const [badPass] = await q(`select count(*)::int n from starkey.passage where end_s < start_s`)
  const [badCue] = await q(`select count(*)::int n from starkey.cue where end_s < start_s`)
  console.log(`rows with end_s < start_s — cue ${badCue.n}, passage ${badPass.n} (both must be 0)`)

  // The overrun check above catches a transcript running PAST its video. The
  // opposite failure is quieter and worse: a caption file that stops early
  // leaves the tail of a video silently unsearchable while every count still
  // looks right. A word-count threshold does not catch it — a 20-minute
  // transcript of a 33-minute video is not "thin".
  const cov = await q(`
    select c.video_id, c.source, v.duration_s, v.title, max(c.end_s)::float last_end,
           (max(c.end_s)/nullif(v.duration_s,0))::float frac
    from starkey.cue c join starkey.video v using (video_id)
    where v.duration_s is not null and v.duration_s > 0
    group by 1,2,3,4 having (max(c.end_s)/nullif(v.duration_s,0)) < 0.9 order by frac`)
  console.log(`transcripts covering <90% of the video's duration: ${cov.length}`)
  for (const r of cov) console.log(`  ${r.video_id} [${r.source}] ${(r.frac * 100).toFixed(1)}%  last cue ${r.last_end.toFixed(0)}s of ${r.duration_s}s  ${r.title}`)

  console.log('\n--- 3. KEYWORD SEARCH ---')
  for (const term of ['human rights act', 'common law', 'sovereignty']) {
    const rows = await q(`
      select p.video_id, p.start_s::float s, v.title,
             ts_headline('english', p.text, plainto_tsquery('english',$1),
                         'MaxWords=26,MinWords=12,StartSel=<<,StopSel=>>') h,
             ts_rank(p.tsv, plainto_tsquery('english',$1)) r
      from starkey.passage p join starkey.video v using (video_id)
      where p.tsv @@ plainto_tsquery('english',$1)
      order by r desc limit 3`, [term])
    const [n] = await q(`select count(*)::int n from starkey.passage where tsv @@ plainto_tsquery('english',$1)`, [term])
    console.log(`\n"${term}" — ${n.n} passages`)
    for (const r of rows) {
      const t = Math.floor(r.s)
      console.log(`  https://www.youtube.com/watch?v=${r.video_id}&t=${t}s  [${new Date(t * 1000).toISOString().slice(11, 19)}]`)
      console.log(`    ${r.title}`)
      console.log(`    ${String(r.h).replace(/\s+/g, ' ')}`)
    }
  }
  // A search that returns nothing everywhere would look identical to a search
  // that works. This term must return zero, or the index is matching anything.
  const [nonsense] = await q(`select count(*)::int n from starkey.passage where tsv @@ plainto_tsquery('english',$1)`, ['zzqxwv unlikelyterm'])
  console.log(`\ncontrol term "zzqxwv unlikelyterm": ${nonsense.n} passages (must be 0)`)

  console.log('\n--- 4. THIN TRANSCRIPTS (<200 words) — FLAGGED, NOT EXCLUDED ---')
  const thin = await q(`
    select t.video_id, t.source, v.title, v.duration_s, v.is_short,
           sum(array_length(regexp_split_to_array(trim(c.text), '\\s+'),1))::int w
    from starkey.transcript t
    join starkey.video v on v.video_id = t.video_id
    left join starkey.cue c on c.video_id = t.video_id and c.source = t.source
    group by 1,2,3,4,5 having coalesce(sum(array_length(regexp_split_to_array(trim(c.text), '\\s+'),1)),0) < 200
    order by w nulls first`)
  console.log(`${thin.length} transcript(s) under 200 words:`)
  for (const r of thin) console.log(`  ${r.video_id} [${r.source}] ${r.w ?? 0} words  duration=${r.duration_s}s short=${r.is_short}  ${r.title}`)

  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
