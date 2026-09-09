/**
 * CCW-B21 TRACK 3 — WHAT DAVID SAID, ACROSS ALL 285 VIDEOS, PER MEASURE.
 *
 * The pass that exists covers **8 videos and 22 general terms, 87 hits**. This runs the whole
 * corpus against a term list built from the twelve measures.
 *
 * ══ ⚠⚠ "TWO TRANSCRIPTS PER VIDEO" IS TRUE OF THREE VIDEOS OUT OF 285 ═════════════════════
 *
 * The corpus handoff says the corpus holds "two independent transcripts of the same audio where
 * possible", and the brief asks that divergences be marked rather than resolved. Both are right.
 * **But measured here: 281 videos have ONE transcript, 3 have two.** By passage it is 6,126 `asr`
 * against 29 `turboscribe` and 2 `human`.
 *
 * ⚠⚠ SO THE MARK CANNOT MEAN WHAT A READER WOULD TAKE IT TO MEAN. If only diverging passages are
 * marked, an unmarked passage reads as "two engines agreed" — and in 2,728 of 2,764 occurrences
 * there was no second engine. **Absence of a disagreement is not agreement**, and the difference
 * decides whether a quote has been checked at all. Every occurrence therefore states its own
 * cross-check status positively: CONFIRMED by two, DISAGREEING, or NOT CROSS-CHECKED.
 *
 * Where two do exist the same sentence matches twice, so returning both is right for a LIST and
 * wrong for a COUNT.
 *
 * So: an OCCURRENCE is `(video_id, overlapping time window)`, counted once however many
 * transcripts saw it. Sources are collapsed onto the occurrence and named on it. Where both
 * saw it and their texts differ materially, the occurrence is MARKED rather than resolved —
 * picking one would be the thing the two transcripts exist to prevent.
 *
 * ⚠ AND THE WINDOWS ARE NOT CHAINED. Merging "any two overlapping windows" transitively walks
 * a whole video into one occurrence when passages abut. Two passages group only if they
 * overlap by more than half the shorter one.
 *
 * ⚠ EVERY TERM IS REPORTED, INCLUDING THE ONES THAT FOUND NOTHING. A term list whose misses are
 * invisible cannot be criticised, and "he never discusses X" and "we never asked about X in
 * words he uses" are opposite facts that look identical in an appendix.
 *
 * ⚠ THE MATCHED SURFACE FORM IS PRINTED, never the query that found it. `plainto_tsquery` stems,
 * so "sentencing guidelines" matches "sentencing guideline" and a reader must see which.
 *
 *   tsx b21-measure-sweep.ts             (plan: term list and corpus size, no search)
 *   tsx b21-measure-sweep.ts --go
 */
import { pool, banner } from './db'
import fs from 'fs'
import path from 'path'

export {}

const GO = process.argv.includes('--go')
const OUT_JSON = path.join(__dirname, '../../docs/report_run/starkey_measure_hits.json')
const OUT_MD = path.join(__dirname, '../../docs/report_run/appendices/WHAT_DAVID_SAID.md')

/**
 * ⚠ THE TERM LIST IS SEEDED FROM THE MEASURES, NOT FROM WHAT I EXPECT HIM TO SAY.
 *
 * Each measure contributes the statute, the institution, and the ordinary-language name for the
 * thing. His own idiom is included where the corpus handoff records it ("the YooKay", "Blairism",
 * "quango") — and the zero-hit report below is what stops a guessed idiom from passing as a
 * finding. Terms are `plainto_tsquery`: every word must appear, stemmed, in one passage.
 */
const MEASURES: Array<{ ref: string; title: string; terms: string[] }> = [
  { ref: 'M-01', title: 'Human Rights Act 1998 and the European Convention on Human Rights', terms: [
    'human rights act', 'european convention', 'european court of human rights', 'strasbourg',
    'convention rights', 'declaration of incompatibility', 'human rights', 'echr',
    'withdraw from the convention', 'rights culture' ] },
  { ref: 'M-02', title: 'Equality Act 2010', terms: [
    'equality act', 'equalities act', 'protected characteristic', 'public sector equality duty',
    'discrimination law', 'positive discrimination', 'equal opportunities', 'equality commission',
    'indirect discrimination' ] },
  { ref: 'M-03', title: 'The United Kingdom Supreme Court', terms: [
    'supreme court', 'law lords', 'appellate committee', 'constitutional reform act',
    'lord chancellor', 'judicial appointments', 'prorogation', 'miller' ] },
  { ref: 'M-04', title: "The arm's-length body estate", terms: [
    'quango', 'quangos', "arm's length body", 'non departmental public body', 'public bodies',
    'bonfire of the quangos', 'unelected bodies', 'regulator', 'agencies and public bodies' ] },
  { ref: 'M-05', title: 'Judicial review of executive decisions', terms: [
    'judicial review', 'judges reviewing', 'politicised judiciary', 'political judiciary',
    'wednesbury', 'administrative court', 'judicial activism', 'rule of law' ] },
  { ref: 'M-06', title: 'The permanent, appointed civil service', terms: [
    'civil service', 'civil servants', 'permanent secretary', 'northcote trevelyan',
    'mandarins', 'whitehall', 'spoils system', 'political appointments', 'the blob' ] },
  { ref: 'M-07', title: 'Operational independence of the Bank of England', terms: [
    'bank of england', 'central bank', 'monetary policy', 'independence of the bank',
    'interest rates', 'quantitative easing', 'gordon brown independence' ] },
  { ref: 'M-08', title: 'Diversity, equity and inclusion practice in the civil service', terms: [
    'diversity and inclusion', 'diversity equity', 'unconscious bias', 'diversity training',
    'equality diversity', 'woke', 'critical race theory', 'decolonise' ] },
  { ref: 'M-09', title: 'Gender self-identification', terms: [
    'self identification', 'gender recognition', 'transgender', 'gender identity',
    'sex and gender', "women's spaces", 'gender critical' ] },
  { ref: 'M-10', title: 'Publicly funded charities campaigning on government policy', terms: [
    'charities', 'charity commission', 'public money campaigning', 'lobbying',
    'sock puppet', 'third sector', 'ngo', 'charitable status' ] },
  { ref: 'M-11', title: 'The Sentencing Council and sentencing guidelines', terms: [
    'sentencing council', 'sentencing guidelines', 'two tier justice', 'sentencing policy',
    'criminal justice', 'judges sentencing', 'prison sentences' ] },
  { ref: 'M-12', title: 'The Great Repeal: the programme as a single instrument', terms: [
    'great repeal', 'repeal', 'restoration', 'restore the constitution', 'ancient constitution',
    'constitutional restoration', 'blairism', 'blair constitution', 'the yookay',
    'constitutional revolution', 'sovereignty of parliament', 'common law' ] },
]

interface Hit {
  measure: string; term: string
  video_id: string; title: string; published_on: string | null
  source: string; start_s: number; end_s: number; text: string
  /** ⚠ What actually matched, taken from the headline, not the query. Stemming makes them differ. */
  matched: string[]
}

interface Occurrence {
  measure: string; video_id: string; title: string; published_on: string | null
  start_s: number; end_s: number
  terms: string[]
  /** One entry per transcript that saw it. Never collapsed to one. */
  bySource: Record<string, string>
  matched: string[]
  /** True when two transcripts saw it and their texts differ materially. */
  diverges: boolean
  match_url: string
}

/** Word-level similarity, for flagging the passages a human ear has to settle. */
function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
  const A = norm(a), B = norm(b)
  if (!A.length || !B.length) return 0
  const counts = new Map<string, number>()
  for (const word of A) counts.set(word, (counts.get(word) ?? 0) + 1)
  let shared = 0
  for (const word of B) { const n = counts.get(word) ?? 0; if (n > 0) { shared++; counts.set(word, n - 1) } }
  return (2 * shared) / (A.length + B.length)
}

function hms(t: number) { return new Date(Math.floor(t) * 1000).toISOString().slice(11, 19).replace(/^00:/, '') }

async function main() {
  const p = pool()
  const [{ videos, passages }] = (await p.query(
    `select count(distinct v.video_id)::int videos, count(p.*)::int passages
       from starkey.video v left join starkey.passage p using (video_id)`)).rows
  banner(`corpus: ${videos} videos · ${passages} passages`)
  const termCount = MEASURES.reduce((a, m) => a + m.terms.length, 0)
  console.log(`term list: ${termCount} terms across ${MEASURES.length} measures (the existing pass used 22 over 8 videos)\n`)
  if (!GO) { console.log('PLAN ONLY — nothing searched. Re-run with --go.'); await p.end(); return }

  const hits: Hit[] = []
  const perTerm: Array<{ measure: string; term: string; passages: number; videos: number }> = []

  for (const m of MEASURES) {
    for (const term of m.terms) {
      const { rows } = await p.query(`
        select p.video_id, p.source, p.start_s::float s, p.end_s::float e, p.text,
               v.title, v.published_on,
               ts_headline('english', p.text, plainto_tsquery('english',$1),
                 'MaxWords=40,MinWords=20,StartSel=«,StopSel=»,MaxFragments=3,FragmentDelimiter= … ') h
          from starkey.passage p join starkey.video v using (video_id)
         where p.tsv @@ plainto_tsquery('english',$1)
         order by v.published_on nulls last, p.video_id, p.start_s`, [term])
      const vids = new Set(rows.map((r) => r.video_id))
      perTerm.push({ measure: m.ref, term, passages: rows.length, videos: vids.size })
      for (const r of rows) {
        // ⚠ THE SURFACE FORM, off the headline. `«…»` marks what Postgres actually matched.
        const matched = [...String(r.h).matchAll(/«([^»]+)»/g)].map((x) => x[1])
        hits.push({
          measure: m.ref, term, video_id: r.video_id, title: r.title,
          published_on: r.published_on ? new Date(r.published_on).toISOString().slice(0, 10) : null,
          source: r.source, start_s: r.s, end_s: r.e, text: r.text, matched,
        })
      }
      process.stdout.write(`  ${m.ref} ${term.padEnd(34)} ${String(rows.length).padStart(5)} passages / ${String(vids.size).padStart(3)} videos\n`)
    }
  }

  // ══ COLLAPSE TO OCCURRENCES ═══════════════════════════════════════════════════════════
  //
  // ⚠ Grouped per MEASURE, so the same passage bearing on two measures appears under both —
  // which is right, because the appendix is read one measure at a time.
  const occurrences: Occurrence[] = []
  const byMeasureVideo = new Map<string, Hit[]>()
  for (const h of hits) {
    const k = `${h.measure} ${h.video_id}`
    byMeasureVideo.set(k, [...(byMeasureVideo.get(k) ?? []), h])
  }

  for (const [k, group] of byMeasureVideo) {
    const measure = k.split(' ')[0]
    const sorted = [...group].sort((a, b) => a.start_s - b.start_s)
    const buckets: Hit[][] = []
    for (const h of sorted) {
      // ⚠ NOT TRANSITIVE MERGING. A new hit joins a bucket only if it overlaps that bucket's
      // FIRST member by more than half the shorter span; otherwise abutting passages chain
      // and a whole video becomes one occurrence.
      const b = buckets.find((bk) => {
        const f = bk[0]
        const ov = Math.min(f.end_s, h.end_s) - Math.max(f.start_s, h.start_s)
        return ov > 0.5 * Math.min(f.end_s - f.start_s, h.end_s - h.start_s)
      })
      if (b) b.push(h); else buckets.push([h])
    }
    for (const b of buckets) {
      const bySource: Record<string, string> = {}
      for (const h of b) bySource[h.source] = h.text
      const texts = Object.values(bySource)
      const diverges = texts.length > 1 && similarity(texts[0], texts[1]) < 0.84
      const start = Math.min(...b.map((h) => h.start_s))
      occurrences.push({
        measure, video_id: b[0].video_id, title: b[0].title, published_on: b[0].published_on,
        start_s: start, end_s: Math.max(...b.map((h) => h.end_s)),
        terms: [...new Set(b.map((h) => h.term))].sort(),
        bySource, matched: [...new Set(b.flatMap((h) => h.matched))],
        diverges,
        match_url: `https://www.youtube.com/watch?v=${b[0].video_id}&t=${Math.floor(start)}s`,
      })
    }
  }
  occurrences.sort((a, b) => a.measure.localeCompare(b.measure)
    || String(a.published_on).localeCompare(String(b.published_on))
    || a.start_s - b.start_s)

  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generated_at: new Date().toISOString(),
    corpus: { videos, passages },
    measures: MEASURES.map((m) => ({ ref: m.ref, title: m.title, terms: m.terms })),
    per_term: perTerm,
    raw_hits: hits.length,
    occurrences: occurrences.length,
    hits: occurrences,
  }, null, 1), 'utf8')

  // ══ THE APPENDIX ══════════════════════════════════════════════════════════════════════
  const L: string[] = []
  const byMeasure = new Map<string, Occurrence[]>()
  for (const o of occurrences) byMeasure.set(o.measure, [...(byMeasure.get(o.measure) ?? []), o])
  const vidsWithAnything = new Set(occurrences.map((o) => o.video_id))

  L.push('# Appendix — what David said, by measure')
  L.push('')
  L.push(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from the transcript corpus.*`)
  L.push('')
  L.push(`**${videos} videos · ${passages.toLocaleString()} searchable passages · `
    + `${termCount} search terms built from the twelve measures.**`)
  L.push('')
  L.push('The pass this replaces covered **8 videos and 22 general terms and found 87 hits**. This one '
    + `covers every video in the corpus and returns **${occurrences.length.toLocaleString()} occurrences** `
    + `across **${vidsWithAnything.size} videos**.`)
  L.push('')
  L.push('## How to read it')
  L.push('')
  L.push('- Each entry is a passage that bears on the measure, **in date order**, with a link that starts')
  L.push('  playing at the second it was said.')
  L.push('- ⚠ **An occurrence is a moment, not a transcript row.** Most videos carry two independent')
  L.push('  transcripts — YouTube\'s captions and a separate re-transcription — so the same sentence')
  L.push('  matches twice. Counting those separately would inflate this appendix by roughly two. They are')
  L.push('  collapsed onto the moment and both texts kept.')
  L.push('- ⚠⚠ **Where the two transcripts disagree the entry is marked 🔀 and BOTH are printed.** Nothing')
  L.push('  picks a winner. In Part 1 at 5:01 YouTube\'s captions say *"Israeli"* and the re-transcription')
  L.push('  says *"Disraeli"* — a quote taken from one alone would have printed the wrong man.')
  L.push('  **A marked passage must be settled by ear before it is quoted.**')
  L.push('- ⚠⚠ **But almost nothing here has a second transcript to disagree with, and that is the most')
  L.push('  important line in this appendix.** Every entry therefore says which it is, in words, rather')
  L.push('  than leaving you to read the absence of a mark as agreement.')
  L.push('- **These are passages that mention the subject, not statements of his position on the measure.**')
  L.push('  A term matching is not agreement, disagreement, or a proposal. Read the passage.')
  L.push('')

  // ══ ⚠⚠ HOW FAR THE CROSS-CHECK ACTUALLY REACHES. MEASURED, AND NEAR THE TOP. ═══════════
  //
  // The corpus was described as holding two independent transcripts "where possible". It holds
  // two for THREE videos. If this appendix marked only the disagreements, every other passage
  // would read as verified by two engines, and none of them is verified at all.
  const single = occurrences.filter((o) => Object.keys(o.bySource).length === 1)
  const dual = occurrences.filter((o) => Object.keys(o.bySource).length > 1)
  const agreeing = dual.filter((o) => !o.diverges).length
  const disagreeing = dual.filter((o) => o.diverges).length
  const pct = (n: number) => `${(100 * n / Math.max(1, occurrences.length)).toFixed(1)}%`
  const bySrcVideos = new Map<string, Set<string>>()
  for (const o of occurrences) {
    for (const src of Object.keys(o.bySource)) {
      bySrcVideos.set(src, (bySrcVideos.get(src) ?? new Set<string>()).add(o.video_id))
    }
  }
  L.push('## ⚠⚠ How much of this has been cross-checked: almost none of it')
  L.push('')
  L.push('The corpus was built to hold two independent transcripts of each video — YouTube\'s captions')
  L.push('and a separate re-transcription — so that quotations could be checked against each other.')
  L.push('**In practice it holds two for three videos out of 285.**')
  L.push('')
  L.push('| | occurrences | share |')
  L.push('|---|---|---|')
  L.push(`| Seen by **two** transcripts, which **agree** | ${agreeing} | ${pct(agreeing)} |`)
  L.push(`| Seen by **two** transcripts, which **disagree** 🔀 | ${disagreeing} | ${pct(disagreeing)} |`)
  L.push(`| **NOT CROSS-CHECKED** — one transcript only | **${single.length.toLocaleString()}** | **${pct(single.length)}** |`)
  L.push('')
  L.push('Transcripts held, by engine: '
    + [...bySrcVideos.entries()].map(([k, v]) => `\`${k}\` on ${v.size} video(s)`).join(', ') + '.')
  L.push('')
  L.push('⚠⚠ **So an unmarked passage in this appendix has not been confirmed by anything.** It is')
  L.push('YouTube\'s machine transcription, once. That is sufficient for FINDING what he said and where,')
  L.push('which is what this appendix is for. It is **not** sufficient for PRINTING a quotation —')
  L.push('"Israeli" for "Disraeli" is what a single machine transcript does. **Anything quoted in the')
  L.push('report needs the recording listened to, and the timestamped link on every entry is there to')
  L.push('make that a click rather than a search.**')
  L.push('')
  // ⚠ THE MISSES, IN THE OPEN AND NEAR THE TOP.
  const zero = perTerm.filter((t) => t.passages === 0)
  L.push('## ⚠ Terms that found nothing')
  L.push('')
  if (zero.length) {
    L.push(`**${zero.length} of ${perTerm.length} search terms returned no passage at all.** That is a fact`)
    L.push('about *our search terms*, not about what he has discussed: "he never mentions this" and "we')
    L.push('never asked in words he uses" are opposite conclusions that look identical in an appendix.')
    L.push('')
    L.push('| Measure | Term |')
    L.push('|---|---|')
    for (const t of zero) L.push(`| ${t.measure} | \`${t.term}\` |`)
  } else {
    L.push('Every search term returned at least one passage.')
  }
  L.push('')
  L.push('## Coverage, per measure')
  L.push('')
  L.push('| Measure | Subject | Occurrences | Videos | Marked 🔀 |')
  L.push('|---|---|---|---|---|')
  for (const m of MEASURES) {
    const os = byMeasure.get(m.ref) ?? []
    L.push(`| ${m.ref} | ${m.title.replace(/\|/g, '\\|')} | ${os.length} `
      + `| ${new Set(os.map((o) => o.video_id)).size} | ${os.filter((o) => o.diverges).length} |`)
  }
  L.push('')
  L.push('---')
  L.push('')

  for (const m of MEASURES) {
    const os = byMeasure.get(m.ref) ?? []
    L.push(`## ${m.ref} — ${m.title}`)
    L.push('')
    const used = [...new Set(os.flatMap((o) => o.terms))]
    L.push(`*${os.length} occurrence(s) across ${new Set(os.map((o) => o.video_id)).size} video(s). `
      + `Search terms: ${m.terms.map((t) => `\`${t}\`${used.includes(t) ? '' : ' (0)'}`).join(', ')}.*`)
    L.push('')
    if (!os.length) {
      L.push('**Nothing found for this measure.** ⚠ On these terms, over this corpus — not a finding that')
      L.push('he has never discussed it.')
      L.push('')
      continue
    }
    for (const o of os) {
      const sources = Object.keys(o.bySource).sort()
      L.push(`### ${o.published_on ?? 'undated'} — ${o.title.replace(/\|/g, '\\|')} [${hms(o.start_s)}]${o.diverges ? '  🔀' : ''}`)
      L.push('')
      L.push(`[▶ play from ${hms(o.start_s)}](${o.match_url}) · matched \`${o.terms.join('`, `')}\``
        + (o.matched.length ? ` · on the words *${[...new Set(o.matched)].slice(0, 6).join(', ')}*` : ''))
      L.push('')
      if (o.diverges) {
        L.push('⚠⚠ **The two transcripts disagree here. Both are printed; settle it by ear before quoting.**')
        L.push('')
        for (const s of sources) { L.push(`**${s}:** ${o.bySource[s].replace(/\s+/g, ' ').trim()}`); L.push('') }
      } else {
        // Prefer the independent re-transcription where it exists; say which is shown.
        const pick = sources.includes('turboscribe') ? 'turboscribe' : sources[0]
        L.push(`> ${o.bySource[pick].replace(/\s+/g, ' ').trim()}`)
        L.push('')
        // ⚠ STATED POSITIVELY. "only transcript held" in italics is the same fact and reads as a
        // footnote; a reader skimming for quotable passages must see that this one is unchecked.
        L.push(sources.length > 1
          ? `*✔ Cross-checked: the \`${sources.join('` and `')}\` transcripts agree. Shown: \`${pick}\`.*`
          : `*⚠ **NOT CROSS-CHECKED** — \`${pick}\` only; no second transcript exists for this video. `
            + 'Listen before quoting.*')
        L.push('')
      }
    }
    L.push('---')
    L.push('')
  }

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.writeFileSync(OUT_MD, L.join('\n'), 'utf8')
  console.log(`\nraw transcript hits : ${hits.length}`)
  console.log(`occurrences         : ${occurrences.length}  (the difference is the second transcript)`)
  console.log(`videos with a hit   : ${vidsWithAnything.size} of ${videos}`)
  console.log(`terms finding zero  : ${zero.length} of ${perTerm.length}`)
  console.log(`marked as diverging : ${occurrences.filter((o) => o.diverges).length}`)
  console.log(`\nwritten: ${OUT_MD}\n         ${OUT_JSON}`)
  await p.end()
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
