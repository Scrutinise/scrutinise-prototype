// Keyword search over the corpus. This is the thing the corpus exists for:
// a passage, and a link that opens the recording at the second it was said.
//
//   tsx search.ts "human rights act"
//   tsx search.ts "common law" --limit 20 --source turboscribe
//
// Postgres full-text search over starkey.passage.tsv. Quoted words are matched
// as a phrase; otherwise all words must appear (plainto_tsquery semantics).
import { pool, banner } from './db'

async function main() {
  const args = process.argv.slice(2)
  const flag = (name: string, dflt?: string) => {
    const i = args.indexOf(`--${name}`)
    if (i < 0) return dflt
    const v = args[i + 1]; args.splice(i, 2); return v
  }
  const limit = Number(flag('limit', '10'))
  const source = flag('source')
  const q = args.join(' ').trim()
  if (!q) { console.error('usage: tsx search.ts "<query>" [--limit N] [--source asr|human|<engine>]'); process.exit(2) }

  banner(`search: ${JSON.stringify(q)}${source ? ` source=${source}` : ''}`)
  const p = pool()
  const { rows } = await p.query(`
    select p.video_id, p.source, p.start_s::float s, p.end_s::float e, v.title, v.published_on,
           ts_headline('english', p.text, plainto_tsquery('english',$1),
                       'MaxWords=45,MinWords=25,StartSel=<<,StopSel=>>,MaxFragments=2,FragmentDelimiter= … ') h,
           ts_rank(p.tsv, plainto_tsquery('english',$1)) r
    from starkey.passage p join starkey.video v using (video_id)
    where p.tsv @@ plainto_tsquery('english',$1) and ($2::text is null or p.source = $2)
    order by r desc, p.video_id, p.start_s
    limit $3`, [q, source ?? null, limit])

  const [{ n }] = (await p.query(
    `select count(*)::int n from starkey.passage p
     where p.tsv @@ plainto_tsquery('english',$1) and ($2::text is null or p.source = $2)`,
    [q, source ?? null])).rows

  console.log(`\n${n} passage(s) match; showing ${rows.length}\n`)
  for (const r of rows) {
    const t = Math.floor(r.s)
    const hms = new Date(t * 1000).toISOString().slice(11, 19).replace(/^00:/, '')
    console.log(`${r.title}`)
    console.log(`  ${r.published_on ? new Date(r.published_on).toISOString().slice(0, 10) : '?'}  [${hms}]  source=${r.source}`)
    console.log(`  https://www.youtube.com/watch?v=${r.video_id}&t=${t}s`)
    console.log(`  ${String(r.h).replace(/\s+/g, ' ')}\n`)
  }
  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
