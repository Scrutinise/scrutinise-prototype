// CCW-B11 — locate the five sessions of `David Starkey.docx` in the corpus.
//
//   scrutinise-web> NODE_PATH=./node_modules ./node_modules/.bin/tsx ../scripts/starkey/b11-locate-sessions.ts
//
// Input : the split produced by b11-split.py (sessions + text), passed as argv[2]
// Output: docs/report_run/b11_sessions_located.json, and a table for _README.md
//
// ── THE METRIC IS IMPORTED, NOT RESTATED ────────────────────────────────────
// B11 says to reuse B8's method "because its threshold is already calibrated".
// That calibration — a different recording scores low, the same audio through a
// different engine 0.84-0.90, a scraped copy of the same caption track 0.975+ —
// belongs to `lcsRatio` over `norm()` tokens capped at 2,000 words, and to
// nothing else. So both come from ./text, and WINDOW matches docx-disposition.ts.
// A re-implemented similarity would produce numbers those bands do not describe.
//
// ── WHY THERE IS A PREFILTER, AND WHY IT CANNOT HIDE THE ANSWER ─────────────
// lcsRatio is O(n*m). Five sessions against 285 transcripts at 2,000 tokens each
// is ~5.7e9 cell operations, which is minutes, not seconds. So a cheap 5-gram
// containment over the FULL texts shortlists candidates, and lcsRatio scores
// only the shortlist. The shortlist is deliberately generous (SHORTLIST=30 of
// 285) and the script REPORTS the best containment among the excluded, so a
// near-miss at the cutoff is visible rather than silently dropped.
//
// ── AND WHY CONTAINMENT IS REPORTED ALONGSIDE, NOT JUST USED ────────────────
// lcsRatio compares the FIRST 2,000 words of each. That assumes the session and
// the video start in the same place. If a session is an excerpt beginning part
// way into a recording, that assumption fails and lcsRatio collapses while
// containment stays high. The pair is printed for every candidate so that case
// announces itself instead of being reported as "not found".
import * as fs from 'fs'
import * as path from 'path'
import { pool, banner } from './db'
import { norm, lcsRatio } from './text'

const WINDOW = 2000        // identical to docx-disposition.ts — the calibration is on this
const SHORTLIST = 30
const NGRAM = 5

/** |A ∩ B| / min(|A|,|B|) over 5-gram sets. Order-insensitive, so it is a
 *  prefilter and a diagnostic, never the reported score. */
function containment(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  let hit = 0
  for (const g of small) if (big.has(g)) hit++
  return hit / small.size
}

function grams(tokens: string[]): Set<string> {
  const s = new Set<string>()
  for (let i = 0; i + NGRAM <= tokens.length; i++) s.add(tokens.slice(i, i + NGRAM).join(' '))
  return s
}

/** B8's calibration bands, applied to the lcsRatio score. */
function band(score: number): string {
  if (score >= 0.975) return 'scraped copy of the same caption track (>=0.975)'
  if (score >= 0.84) return 'same audio, different engine (0.84-0.90 band)'
  if (score >= 0.60) return 'related but below B8\'s independent-engine band — inspect before trusting'
  return 'no match — below every calibrated band'
}

async function main() {
  const sessionsPath = process.argv[2]
  if (!sessionsPath) { console.error('usage: tsx b11-locate-sessions.ts <b11-sessions.json>'); process.exit(2) }
  const sessions: Array<{ n: number; label: string; start_para: number; end_para: number; words: number; last_timestamp_s: number; text: string }> =
    JSON.parse(fs.readFileSync(sessionsPath, 'utf8'))

  banner('B11 locate the five sessions')
  const p = pool()
  const vids = (await p.query(
    `select video_id, title, published_on, duration_s from starkey.video`)).rows
  const meta = new Map(vids.map((v: any) => [v.video_id, v]))

  // one ASR text per video, in cue order
  const { rows: texts } = await p.query(
    `select video_id, string_agg(text, ' ' order by start_s) t
       from starkey.cue where source = 'asr' group by video_id`)
  console.log(`[starkey] ${texts.length} ASR transcripts to search`)

  const full = new Map<string, string[]>()
  const gram = new Map<string, Set<string>>()
  for (const r of texts) {
    const tok = norm(r.t ?? '')
    full.set(r.video_id, tok)
    gram.set(r.video_id, grams(tok))
  }

  const out: any[] = []
  for (const s of sessions) {
    const tok = norm(s.text)
    const g = grams(tok)
    const head = tok.slice(0, WINDOW)

    const byContain = [...gram.entries()]
      .map(([id, gg]) => ({ id, c: containment(g, gg) }))
      .sort((a, b) => b.c - a.c)
    const shortlist = byContain.slice(0, SHORTLIST)
    const excluded = byContain[SHORTLIST]   // best one the prefilter dropped

    const scored = shortlist.map(({ id, c }) => ({
      id, containment: c,
      lcs: lcsRatio(head, (full.get(id) ?? []).slice(0, WINDOW)),
    })).sort((a, b) => b.lcs - a.lcs)

    const top3 = scored.slice(0, 3).map(x => {
      const m: any = meta.get(x.id) ?? {}
      return {
        video_id: x.id, title: m.title ?? null,
        published: m.published_on ? new Date(m.published_on).toISOString().slice(0, 10) : null,
        duration_s: m.duration_s ?? null,
        lcs: Math.round(x.lcs * 1000) / 1000,
        containment: Math.round(x.containment * 1000) / 1000,
        watch_url: `https://www.youtube.com/watch?v=${x.id}`,
      }
    })
    const best = top3[0]
    const found = best && best.lcs >= 0.84

    // ⚠ More than one candidate can clear the band because THE CHANNEL HOLDS
    // THE SAME TALK TWICE. Reporting only the winner would hand CCW one id and
    // silently drop a second, equally valid one — and a quote checked against
    // the other upload would look unverifiable. So when a runner-up also
    // clears 0.84, the two are scored against EACH OTHER and the pair is
    // reported as duplicate uploads rather than as a contest one of them lost.
    const alsoClear = top3.slice(1).filter(c => c.lcs >= 0.84)
    const duplicates = alsoClear.map(c => ({
      video_id: c.video_id, title: c.title, published: c.published,
      lcs_against_winner: Math.round(lcsRatio(
        (full.get(best.video_id) ?? []).slice(0, WINDOW),
        (full.get(c.video_id) ?? []).slice(0, WINDOW)) * 1000) / 1000,
      watch_url: c.watch_url,
    }))
    // ⚠ the case the head-window cannot see, made explicit
    const offsetSuspect = best && best.lcs < 0.84 && best.containment >= 0.5

    out.push({
      session: s.n, label: s.label,
      docx_paragraphs: [s.start_para, s.end_para], words: s.words,
      runs_to: `${Math.floor(s.last_timestamp_s / 60)}:${String(s.last_timestamp_s % 60).padStart(2, '0')}`,
      verdict: found ? 'found' : offsetSuspect ? 'same recording, different start point — NOT scored by the head window' : 'not found in corpus',
      band: best ? band(best.lcs) : 'no candidates',
      best_lcs: best?.lcs ?? null,
      // Arithmetic cross-check between the two metrics: containment is over
      // 5-grams, so if the engines agree on a fraction w of words, containment
      // should be about w^5. A candidate where that does NOT hold is a pair the
      // two metrics disagree about, and worth a look.
      metric_consistency: best ? {
        containment: best.containment,
        implied_per_word_agreement: Math.round(Math.pow(best.containment, 1 / NGRAM) * 1000) / 1000,
        lcs: best.lcs,
        consistent: Math.abs(Math.pow(best.containment, 1 / NGRAM) - best.lcs) < 0.06,
        note: 'containment ≈ per-word agreement ^ 5. Where implied_per_word_agreement ≈ lcs, the two independent metrics corroborate each other.',
      } : null,
      duplicate_uploads: duplicates,
      candidates: top3,
      prefilter: {
        shortlisted: SHORTLIST, of: byContain.length,
        best_excluded_containment: excluded ? Math.round(excluded.c * 1000) / 1000 : null,
        note: 'The shortlist is by 5-gram containment; the SCORE is lcsRatio, B8\'s calibrated metric. best_excluded_containment is the highest-scoring candidate the prefilter dropped — if it approaches the shortlisted ones, the cutoff is too tight.',
      },
    })

    console.log(`\n  ${s.n}. ${s.label}  (${s.words} words, runs to ${out[out.length - 1].runs_to})`)
    for (const c of top3) console.log(`       lcs ${c.lcs.toFixed(3)}  contain ${c.containment.toFixed(3)}  ${c.video_id}  ${String(c.title).slice(0, 58)}`)
    console.log(`       -> ${out[out.length - 1].verdict}   [${out[out.length - 1].band}]`)
    console.log(`       prefilter: best excluded containment ${out[out.length - 1].prefilter.best_excluded_containment}`)
    const mc = out[out.length - 1].metric_consistency
    if (mc) console.log(`       metrics: containment ${mc.containment} implies per-word ${mc.implied_per_word_agreement} vs lcs ${mc.lcs}  ${mc.consistent ? '(consistent)' : '⚠ INCONSISTENT'}`)
    for (const dup of out[out.length - 1].duplicate_uploads)
      console.log(`       ⚠ DUPLICATE UPLOAD: ${dup.video_id} scores ${dup.lcs_against_winner} against the winner — the same talk is on the channel twice`)
  }

  const dest = path.resolve(__dirname, '../../docs/report_run/b11_sessions_located.json')
  fs.writeFileSync(dest, JSON.stringify({
    generated_at: new Date().toISOString(),
    source_document: 'docs/report_run/sources/David Starkey.docx',
    method: `Sessions split at clock resets AND label paragraphs (both signals agreed on all four joins). Each session's first ${WINDOW} normalised tokens scored against each ASR transcript's first ${WINDOW} by lcsRatio from scripts/starkey/text.ts — the same function and window as B8, so B8's calibration bands apply. A 5-gram containment prefilter shortlists ${SHORTLIST} of ${texts.length}; it never sets the reported score.`,
    calibration: 'B8: a different recording scores low; the same audio through a different engine lands 0.84-0.90; a scraped copy of the same caption track lands 0.975+.',
    caveats: [
      '⚠ lcsRatio compares the FIRST 2,000 words of each. A session that is an excerpt starting part way into a recording will score low even though it IS that recording — the containment column is reported to make that case visible, and the verdict says so explicitly rather than claiming "not found".',
      '⚠ The 285 videos are one channel. A conference recording hosted elsewhere cannot match anything here, and a low best score means "ask Charlie for that one link", not "the session does not exist".',
      '⚠ A confident wrong id is worse than no id: it sends a human to check a quote against the wrong recording. Nothing below B8\'s 0.84 band is reported as found.',
    ],
    sessions: out,
  }, null, 2))
  console.log(`\nwrote ${dest}`)
  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
