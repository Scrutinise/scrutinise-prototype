// CCW-B8 step 4, and the standing report for every later drop.
//
// When Charlie adds a raw/<video_id>.turboscribe.vtt, load.ts picks it up by
// filename and loads it with source = 'turboscribe'. This says what arrived:
// cue count, and the last cue's end against duration_s, so a transcript that
// stops early cannot pass silently. That coverage comparison is the check that
// caught 2Khgz5sMMBU in B7, where a word count would not have.
import { pool, banner } from './db'

async function main() {
  banner('turboscribe transcripts — cue counts and coverage')
  const p = pool()
  const { rows } = await p.query(`
    select c.video_id, v.title, v.duration_s,
           count(*)::int cues,
           min(c.start_s)::float first_start,
           max(c.end_s)::float last_end,
           (max(c.end_s)/nullif(v.duration_s,0))::float frac,
           (select count(*)::int from starkey.cue a where a.video_id=c.video_id and a.source='asr') asr_cues
    from starkey.cue c join starkey.video v using (video_id)
    where c.source='turboscribe'
    group by 1,2,3,v.published_on order by v.published_on`)

  if (!rows.length) { console.log('no turboscribe transcripts loaded'); await p.end(); return }

  console.log('\nvideo_id     cues   asr cues  first   last end   duration   coverage  title')
  for (const r of rows) {
    const flag = r.frac === null ? '  ?     ' : r.frac < 0.9 ? ' ⚠ SHORT' : '        '
    console.log(`${r.video_id}  ${String(r.cues).padStart(4)}   ${String(r.asr_cues).padStart(6)}  `
      + `${r.first_start.toFixed(1).padStart(6)}  ${r.last_end.toFixed(1).padStart(8)}  `
      + `${String(r.duration_s).padStart(7)}s  ${((r.frac ?? 0) * 100).toFixed(1).padStart(6)}%${flag} ${String(r.title).slice(0, 46)}`)
  }
  const short = rows.filter(r => (r.frac ?? 0) < 0.9)
  console.log(`\n${short.length} of ${rows.length} cover less than 90% of the video's stated duration`
    + (short.length ? ` — ${short.map(r => r.video_id).join(', ')}` : ''))

  // Which thesis videos still have only one transcript, so the second-engine
  // check is not available for them.
  const single = await p.query(`
    select v.video_id, v.title, v.duration_s from starkey.video v
    where v.video_id = any($1::text[])
      and not exists (select 1 from starkey.transcript t where t.video_id=v.video_id and t.source='turboscribe')
    order by v.published_on`,
    [['soNnF0sjF5Y', 'jnsiLNNL8s8', '8veLovq5NWQ', 'okJNAMPBRqg', 'q1Mto3BxMcA', 'Mwf_SwRa2F0', 'EMbRv6aaQrs', '2Khgz5sMMBU']])
  console.log(`\nthesis-series videos with NO second transcript (${single.rows.length}):`)
  for (const r of single.rows) console.log(`  ${r.video_id}  ${r.duration_s}s  ${r.title}`)
  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
