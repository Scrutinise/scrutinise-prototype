// CCW-B10 — harvest candidate proposals from the Starkey transcript corpus.
//
//   scrutinise-web> NODE_PATH=./node_modules ./node_modules/.bin/tsx ../scripts/starkey/b10-candidates.ts
//   scrutinise-web> NODE_PATH=./node_modules ./node_modules/.bin/tsx ../scripts/starkey/b10-candidates.ts --compare
//
// Produces docs/report_run/register_candidates.json: raw candidates, not a
// register. It maps nothing to legislation, deduplicates nothing across videos
// and drops nothing for being vague — all three are CCW's job, per B10 step 3.
//
// ---------------------------------------------------------------------------
// Why this does not use search.ts
// ---------------------------------------------------------------------------
// search.ts is `plainto_tsquery('english', …)`, which is right for B9's named
// measures and wrong for B10's imperative group, for two independent reasons
// that push the count in OPPOSITE directions:
//
//   1. STOPWORDS -> catastrophic UNDER-return. `we`, `should`, `i`, `what`,
//      `do`, `the`, `has`, `to`, `of` are Postgres English stopwords, so
//      `we should` lexes to the EMPTY tsquery and matches no rows at all. That
//      is a confident 0 meaning "the query dissolved", not "he never said it".
//   2. NOT A PHRASE SEARCH -> catastrophic OVER-return. plainto_tsquery ANDs
//      the SURVIVING lexemes over a whole 60-90s passage. `has to go` keeps
//      only `go`; `what I would do` keeps only `would`, so it returns exactly
//      the same number as `I would` — a four-word phrase and a two-word phrase
//      cannot be told apart.
//
// The direction matters when reading the two side by side (the point is the
// other CC session's, from B9): a term the LOOSE method scores zero on is a
// real absence, because tightening cannot resurrect it. A term only the loose
// method finds is the one needing scrutiny — that is how B9's
// `constitutional reform` turned out to be 9 co-occurrences and 0 phrases.
//
// So this matches the CUE STREAM directly: all cues for a (video, source)
// joined into one string with an offset->cue map, regex-scanned, each match
// mapped back to a time. That also catches a term split across a cue boundary,
// which passage-level matching loses.
import * as fs from 'fs'
import * as path from 'path'
import { pool, banner } from './db'

// --- the eight thesis videos: B10 pass A -----------------------------------
const PASS_A = new Set([
  'soNnF0sjF5Y', 'jnsiLNNL8s8', '8veLovq5NWQ', 'okJNAMPBRqg',
  'q1Mto3BxMcA', 'Mwf_SwRa2F0', 'EMbRv6aaQrs', '2Khgz5sMMBU',
])

// B7 established YouTube's captions for this video stop here. B10 step 3
// forbids quoting past it; if anything appears, the coverage flag is wrong.
const TRUNCATED_VIDEO = '2Khgz5sMMBU'
const TRUNCATED_AFTER_S = 20 * 60 + 20
const CONTROL_VIDEO = 'EMbRv6aaQrs'   // 46m, not truncated — proves the filter can see late material

const CONTEXT_S = 30       // B10: "roughly ±30 seconds around the hit"
const PASS_B_CAP = 300
const SEP = ''       // stream key separator; never occurs in transcript text

type Group = 'imperative' | 'action' | 'target'

const TERMS: Record<Group, string[]> = {
  imperative: ['we should', 'we must', 'we need to', 'we have to', 'I would',
    'what I would do', 'the first thing', 'has to go', 'must go'],
  action: ['abolish', 'repeal', 'annul', 'scrap', 'get rid of', 'restore',
    'bring back', 'take back', 'dismantle', 'reverse'],
  target: ['human rights act', 'equality act', 'supreme court', 'lord chancellor',
    'civil service', 'judicial review', 'quango', 'climate change act',
    'european convention', 'hate speech', 'sentencing council', 'house of lords',
    'civil service commission'],
}

// Function words, discourse fillers and Starkey's own high-frequency vocabulary.
// Only used to stop the "object of the action verb" tally filling with "the",
// "of" and "it" — it is a readability filter on a diagnostic, nothing more.
const OBJECT_STOP = new Set(('a an and the of to in on at by for with from as is are was were be been being ' +
  'it its this that these those there here they them their we us our you your i me my he she his her ' +
  'do does did done have has had will would shall should can could may might must not no nor so than then ' +
  'what which who whom whose when where why how all any both each few more most other some such only own same ' +
  'very just now well really actually thing things sort kind lot bit very much many quite rather ' +
  'yes right ok okay know think say said says going go get got one two three first second ' +
  'about into through during before after above below up down out off over under again further once ' +
  'because if but or while until against between mean means whole entire absolutely course indeed ' +
  'you\'re it\'s that\'s don\'t doesn\'t didn\'t we\'re i\'m they\'re there\'s').split(/\s+/))

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Two regexes per term.
 *
 * STRICT is the term exactly as the brief writes it. INFLECTED also allows an
 * ASR-plausible ending on a single-word term, so `repeal` reaches "repealed",
 * `quango` reaches "quangos" and `restore` reaches "restoration". Both counts
 * are reported: matching only the strict form under-returns badly on speech,
 * but silently folding `restoration` into `restore` would be worse.
 *
 * Words are separated by `[\s,]+` because TurboScribe punctuates and YouTube's
 * ASR does not — "we need, to" and "we need to" are the same utterance.
 */
/**
 * Controlled plural/variant forms of one word. Used for the words INSIDE a
 * multi-word term, where an open-ended `[a-z]{0,6}` tail would be reckless —
 * it would turn `of` into `office`. These forms are closed, so a word that has
 * no real plural simply contributes an alternative that never occurs.
 *
 * This exists because Starkey names measures the way a speaker does, not the
 * way the statute book does: he says "the Equalities Act", which no literal
 * search for "equality act" can reach. (Found by the other CC session, 30 Aug;
 * my own three checks were all blind to it because all three were literal.)
 */
function wordForms(w: string): string[] {
  const out = new Set([w])
  // Words under three letters are pronouns and prepositions here — `I`, `of`,
  // `to`, `we`, `go`. Pluralising them invents words that collide with real
  // ones: `I` + `s` matched "**is** would" three times before this guard.
  if (w.length < 3) return [...out]
  if (/y$/i.test(w)) out.add(w.slice(0, -1) + 'ies')
  out.add(/(?:s|x|z|ch|sh)$/i.test(w) ? w + 'es' : w + 's')
  return [...out]
}

function regexes(term: string): { strict: RegExp; inflected: RegExp } {
  const words = term.split(/\s+/)
  const body = words.map(esc).join('[\\s,]+')
  const strict = new RegExp(`\\b${body}\\b`, 'gi')
  const inflected = words.length === 1
    // A single word gets an open inflectional tail: repeal -> repealed,
    // quango -> quangos, restore -> restoration. Wider, and reported
    // separately from the strict count because it is wider.
    ? new RegExp(`\\b${esc(term.replace(/e$/i, ''))}[a-z]{0,6}\\b`, 'gi')
    : new RegExp(`\\b${words.map(w => `(?:${wordForms(w).map(esc).join('|')})`).join('[\\s,]+')}\\b`, 'gi')
  return { strict, inflected }
}

/** Did the text actually say the term, or a variant of it? */
const norm = (s: string) => s.toLowerCase().replace(/[\s,]+/g, ' ').trim()

interface CueRow { video_id: string; source: string; start_s: number; end_s: number; text: string }
interface Vid { video_id: string; title: string | null; published_on: Date | null; duration_s: number | null }
interface Match { term: string; group: Group; start_s: number; end_s: number; surface: string }

interface Candidate {
  video_id: string; title: string; published: string | null
  source: string; start_s: number; end_s: number; watch_url: string
  text: string; matched_terms: string[]; term_group: Group
  hit_start_s: number
  // The words actually said, and whether they are the term verbatim. A match
  // is NOT a licence to quote the term's own wording: he says "the Equalities
  // Act", and printing "the Equality Act" over that audio would be a
  // misquotation in a document where every quote is checked before print.
  matched_surface: string[]
  all_literal: boolean
  // Terms present in this window ONLY as a variant — the term itself is never
  // said here. Different in kind from a mixed candidate: `quango` at 112
  // "quangos" to 39 "quango" is fine, but a candidate resting entirely on a
  // variant must not be ranked as though the measure was named. (The other CC
  // session's suggestion, 30 Aug.)
  terms_variant_only: string[]
}

interface Totals {
  strict_corpus: number; inflected_corpus: number
  pass_a: number; pass_b: number
  // pass_a counts OCCURRENCES, and Parts 1-3 have two transcripts each, so one
  // moment there is counted twice. pass_a_distinct is the moment count: per
  // video, the MAX over its sources, summed. Max rather than a merge of
  // overlapping time ranges — the two engines segment differently, so their
  // boundaries interleave and a merge CHAINS adjacent hits into one, which
  // undercounts (the other CC session measured a 2.5x undercount doing that).
  // Max cannot chain and equals what a single-transcript video reports. It is
  // a floor: two genuinely distinct moments, one per engine, would read as one.
  pass_a_distinct: number
  pass_b_distinct: number
  direct_passages: number; fts_passages: number
}

async function main() {
  const compareOnly = process.argv.includes('--compare')
  banner('B10 register candidates')
  const p = pool()

  const vids: Vid[] = (await p.query(
    `select video_id, title, published_on, duration_s from starkey.video`)).rows
  const vidBy = new Map(vids.map(v => [v.video_id, v]))

  const cues: CueRow[] = (await p.query(
    `select video_id, source, start_s::float start_s, end_s::float end_s, text
       from starkey.cue order by video_id, source, start_s`)).rows
  console.log(`[starkey] ${cues.length.toLocaleString()} cues over ${vids.length} videos`)

  const allTerms = (Object.keys(TERMS) as Group[]).flatMap(g => TERMS[g].map(t => ({ g, t })))

  // --- like-for-like comparison against plainto_tsquery --------------------
  // plainto_tsquery counts PASSAGES; the cue-stream scan counts OCCURRENCES.
  // Comparing those directly would make every ratio partly an artefact of the
  // unit, so count passages matched by direct regex as well.
  const passages: { text: string }[] = (await p.query(`select text from starkey.passage`)).rows
  const directPassages = new Map<string, number>()
  for (const { t } of allTerms) {
    const { strict } = regexes(t)
    let n = 0
    for (const pg of passages) { strict.lastIndex = 0; if (strict.test(pg.text)) n++ }
    directPassages.set(t, n)
  }

  const fts = new Map<string, number>()
  for (const { t } of allTerms) {
    const empty = (await p.query(`select (plainto_tsquery('english',$1)::text = '') b`, [t])).rows[0].b
    if (empty) { fts.set(t, -1); continue }   // -1 = the query lexed to nothing
    const { rows } = await p.query(
      `select count(*)::int n from starkey.passage where tsv @@ plainto_tsquery('english',$1)`, [t])
    fts.set(t, rows[0].n)
  }

  // --- one text stream per (video, source), with an offset -> cue map ------
  type Stream = { video_id: string; source: string; text: string; cues: CueRow[]; off: number[] }
  const streams = new Map<string, Stream>()
  for (const c of cues) {
    const k = c.video_id + SEP + c.source
    let s = streams.get(k)
    if (!s) { s = { video_id: c.video_id, source: c.source, text: '', cues: [], off: [] }; streams.set(k, s) }
    s.off.push(s.text.length)
    s.text += (s.text ? ' ' : '') + c.text
    s.cues.push(c)
  }
  // off[i] was recorded before the joining space was added; every cue but the
  // first therefore starts one character later than recorded.
  for (const s of streams.values()) for (let i = 1; i < s.off.length; i++) s.off[i] += 1

  /** Binary search: the cue containing this character offset. */
  const cueAt = (s: Stream, pos: number) => {
    let lo = 0, hi = s.off.length - 1
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s.off[m] <= pos) lo = m; else hi = m - 1 }
    return s.cues[lo]
  }

  // --- scan ----------------------------------------------------------------
  const hits = new Map<string, Match[]>()
  const strictAction = new Map<string, number>()
  const objectWords = new Map<string, number>()
  const totals: Record<string, Totals> = {}
  for (const { t } of allTerms) totals[t] = {
    strict_corpus: 0, inflected_corpus: 0, pass_a: 0, pass_b: 0,
    pass_a_distinct: 0, pass_b_distinct: 0,
    direct_passages: directPassages.get(t) ?? 0, fts_passages: fts.get(t) ?? 0,
  }
  // term -> video -> source -> occurrences, for the distinct-moment reduction.
  const perTVS = new Map<string, Map<string, Map<string, number>>>()
  // term -> the actual words matched, and how often. This is the check that
  // would have caught "Equalities Act", and the one that shows `scrap` also
  // matching "scrape". Never infer what a pattern matched — print it.
  const surfaces: Record<string, Record<string, number>> = {}
  for (const { t } of allTerms) surfaces[t] = {}

  for (const s of streams.values()) {
    const inA = PASS_A.has(s.video_id)
    const acc: Match[] = []
    for (const { g, t } of allTerms) {
      const { strict, inflected } = regexes(t)
      strict.lastIndex = 0
      for (let m; (m = strict.exec(s.text));) {
        totals[t].strict_corpus++
        if (g !== 'action') continue
        strictAction.set(s.video_id, (strictAction.get(s.video_id) ?? 0) + 1)
        // What does the verb take as its object? B10's `target` list contains
        // only measures already in the twelve workstreams, so by construction
        // it cannot surface a new one. The object of an action verb can.
        if (!inA) {
          const after = s.text.slice(m.index + m[0].length, m.index + m[0].length + 90)
          for (const w of after.toLowerCase().match(/[a-z][a-z']+/g)?.slice(0, 8) ?? [])
            if (!OBJECT_STOP.has(w)) objectWords.set(w, (objectWords.get(w) ?? 0) + 1)
        }
      }
      inflected.lastIndex = 0
      for (let m; (m = inflected.exec(s.text));) {
        totals[t].inflected_corpus++
        if (inA) totals[t].pass_a++; else totals[t].pass_b++
        let byVid = perTVS.get(t); if (!byVid) { byVid = new Map(); perTVS.set(t, byVid) }
        let bySrc = byVid.get(s.video_id); if (!bySrc) { bySrc = new Map(); byVid.set(s.video_id, bySrc) }
        bySrc.set(s.source, (bySrc.get(s.source) ?? 0) + 1)
        const surface = norm(m[0])
        surfaces[t][surface] = (surfaces[t][surface] ?? 0) + 1
        const a = cueAt(s, m.index), b = cueAt(s, m.index + m[0].length - 1)
        acc.push({ term: t, group: g, start_s: a.start_s, end_s: b.end_s, surface })
      }
    }
    if (acc.length) hits.set(s.video_id + SEP + s.source, acc)
  }

  // --- collapse the two transcripts of Parts 1-3 to distinct moments --------
  for (const [t, byVid] of perTVS) {
    for (const [vid, bySrc] of byVid) {
      const distinct = Math.max(...bySrc.values())
      if (PASS_A.has(vid)) totals[t].pass_a_distinct += distinct
      else totals[t].pass_b_distinct += distinct
    }
  }
  // Which videos actually carry more than one transcript? Asserted nowhere —
  // if this ever grows beyond Parts 1-3, the Pass B columns start inflating too.
  const multiSource = [...streams.values()].reduce((m, s) => {
    (m[s.video_id] ??= []).push(s.source); return m
  }, {} as Record<string, string[]>)
  const twoTranscript = Object.entries(multiSource).filter(([, v]) => v.length > 1)
    .map(([vid, srcs]) => ({ video_id: vid, sources: srcs.sort(), in_pass: PASS_A.has(vid) ? 'A' : 'B' }))

  if (compareOnly) {
    console.log('\n                            OCCURRENCES         PASSAGES (like-for-like)')
    console.log('term                       strict    infl        direct    plainto     ratio')
    for (const { t } of allTerms) {
      const x = totals[t]
      const f = x.fts_passages < 0 ? 'EMPTY' : String(x.fts_passages)
      const r = x.fts_passages < 0 ? (x.direct_passages > 0 ? 'MISSES ALL' : '—')
        : x.direct_passages === 0 ? (x.fts_passages > 0 ? 'ALL SPURIOUS' : '—')
          : (x.fts_passages / x.direct_passages).toFixed(1) + 'x'
      console.log(`${t.padEnd(26)} ${String(x.strict_corpus).padStart(6)} ${String(x.inflected_corpus).padStart(7)} ${String(x.direct_passages).padStart(13)} ${f.padStart(10)} ${r.padStart(9)}`)
    }
    await p.end(); return
  }

  // --- merge overlapping ±30s windows, per (video, source, group) ----------
  const candidates: Candidate[] = []
  for (const [k, ms] of hits) {
    const s = streams.get(k)!
    const v = vidBy.get(s.video_id)
    for (const g of Object.keys(TERMS) as Group[]) {
      const gm = ms.filter(m => m.group === g).sort((a, b) => a.start_s - b.start_s)
      // surf is per TERM, not a flat set: "did this term ever appear literally
      // in this window" cannot be answered from a union of everything matched.
      let cur: { from: number; to: number; hit: number; surf: Map<string, Set<string>> } | null = null
      const flush = () => {
        if (!cur) return
        const from = Math.max(0, cur.from), to = cur.to
        const text = s.cues.filter(c => c.end_s >= from && c.start_s <= to)
          .map(c => c.text).join(' ').replace(/\s+/g, ' ').trim()
        candidates.push({
          video_id: s.video_id,
          title: v?.title ?? '',
          published: v?.published_on ? new Date(v.published_on).toISOString().slice(0, 10) : null,
          source: s.source,
          start_s: Math.round(from * 10) / 10,
          end_s: Math.round(to * 10) / 10,
          watch_url: `https://www.youtube.com/watch?v=${s.video_id}&t=${Math.max(0, Math.floor(cur.hit - 10))}s`,
          text,
          matched_terms: [...cur.surf.keys()].sort(),
          term_group: g,
          hit_start_s: Math.round(cur.hit * 10) / 10,
          matched_surface: [...new Set([...cur.surf.values()].flatMap(v => [...v]))].sort(),
          all_literal: [...cur.surf].every(([t2, ss]) => [...ss].every(x => x === norm(t2))),
          terms_variant_only: [...cur.surf].filter(([t2, ss]) => ![...ss].some(x => x === norm(t2)))
            .map(([t2]) => t2).sort(),
        })
        cur = null
      }
      for (const m of gm) {
        const from = m.start_s - CONTEXT_S, to = m.end_s + CONTEXT_S
        const add = (c: NonNullable<typeof cur>) => {
          let ss = c.surf.get(m.term); if (!ss) { ss = new Set(); c.surf.set(m.term, ss) }
          ss.add(m.surface)
        }
        if (cur && from <= cur.to) { cur.to = Math.max(cur.to, to); add(cur) }
        else { flush(); cur = { from, to, hit: m.start_s, surf: new Map() }; add(cur) }
      }
      flush()
    }
  }

  // --- B10 step 3: nothing from 2Khgz5sMMBU after 20:20 --------------------
  const late = candidates.filter(c => c.video_id === TRUNCATED_VIDEO && c.hit_start_s > TRUNCATED_AFTER_S)
  // A check that can only pass is not a check: confirm the same filter DOES see
  // late material in an untruncated video of comparable length.
  const controlLate = candidates.filter(c => c.video_id === CONTROL_VIDEO && c.hit_start_s > TRUNCATED_AFTER_S)

  const passA = candidates.filter(c => PASS_A.has(c.video_id))
  let passB = candidates.filter(c => !PASS_A.has(c.video_id))
  const passBTotal = passB.length

  // Cap by QUOTA PER GROUP, not by a global ranking.
  //
  // Ranking the whole pass by group and taking the top 300 filled every slot
  // with `target` and dropped all 1,713 action and imperative candidates — the
  // group that answers "has he proposed something outside the twelve" would
  // have vanished entirely, silently, behind a `capped_at` that looked honest.
  // Targets still get the largest share because Pass B exists to surface a
  // named measure, but every group is represented. Within a group: more
  // distinct terms first, then the more recent video.
  const QUOTA: Record<Group, number> = { target: 150, action: 100, imperative: 50 }
  const byGroup = (g: Group) => passB.filter(c => c.term_group === g)
    .sort((a, b) => b.matched_terms.length - a.matched_terms.length
      || String(b.published).localeCompare(String(a.published)))
  const droppedByGroup: Record<string, number> = { target: 0, action: 0, imperative: 0 }
  const passBFull = passB
  if (passB.length > PASS_B_CAP) {
    const groups = Object.keys(QUOTA) as Group[]
    const pools = new Map(groups.map(g => [g, byGroup(g)]))
    // Redistribute any quota a small group cannot fill, so the cap is spent.
    const take = new Map(groups.map(g => [g, Math.min(QUOTA[g], pools.get(g)!.length)]))
    let spare = PASS_B_CAP - [...take.values()].reduce((a, b) => a + b, 0)
    for (const g of groups) {
      if (spare <= 0) break
      const extra = Math.min(spare, pools.get(g)!.length - take.get(g)!)
      take.set(g, take.get(g)! + extra); spare -= extra
    }
    const kept: Candidate[] = []
    for (const g of groups) {
      const pool = pools.get(g)!, n = take.get(g)!
      kept.push(...pool.slice(0, n))
      droppedByGroup[g] = pool.length - n
    }
    passB = kept
  }

  // --- step 4.3: non-thesis videos ranked by action-verb hits (uncapped) ---
  const actionByVideo = new Map<string, number>()
  for (const [k, ms] of hits) {
    const vid = k.split(SEP)[0]
    if (PASS_A.has(vid)) continue
    const n = ms.filter(m => m.group === 'action').length
    if (n) actionByVideo.set(vid, (actionByVideo.get(vid) ?? 0) + n)
  }
  const topAction = [...actionByVideo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([vid, n]) => ({
      video_id: vid, action_hits: n, action_hits_strict: strictAction.get(vid) ?? 0,
      title: vidBy.get(vid)?.title ?? '',
      published: vidBy.get(vid)?.published_on ? new Date(vidBy.get(vid)!.published_on!).toISOString().slice(0, 10) : null,
      watch_url: `https://www.youtube.com/watch?v=${vid}`,
    }))

  // The same ranking on STRICT matches only. It disagrees with the inflected
  // one, and the disagreement is itself the finding: `restore`+tail also counts
  // "restoration" and `reverse`+tail counts "reversal", which promotes videos
  // ABOUT the Restoration over videos PROPOSING to abolish something.
  const topActionStrict = [...strictAction.entries()].filter(([v]) => !PASS_A.has(v))
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([vid, n]) => ({
      video_id: vid, action_hits_strict: n,
      action_hits_inflected: actionByVideo.get(vid) ?? 0,
      title: vidBy.get(vid)?.title ?? '',
      published: vidBy.get(vid)?.published_on ? new Date(vidBy.get(vid)!.published_on!).toISOString().slice(0, 10) : null,
      watch_url: `https://www.youtube.com/watch?v=${vid}`,
    }))

  const out = {
    generated_at: new Date().toISOString(),
    field_notes: {
      text: `The cues covering [hit_start - ${CONTEXT_S}s, hit_end + ${CONTEXT_S}s], verbatim, joined with single spaces. Overlapping windows within one (video, source, term_group) are merged into one candidate.`,
      start_s_end_s: 'The bounds of that context window, NOT of the match.',
      hit_start_s: 'Start of the first matching term in the window — where the claim actually is.',
      watch_url: 'Deep link to hit_start_s minus 10s, so the sentence begins after the link lands.',
      matching: 'Direct regex over the joined cue stream, not plainto_tsquery — see the header of scripts/starkey/b10-candidates.ts. Every imperative term is stopword-heavy and several lex to an empty tsquery.',
      inflection: 'Single-word terms match an inflectional tail (repeal->repealed, quango->quangos, restore->restoration). term_totals reports strict and inflected separately.',
      not_deduplicated: 'Per B10 step 3 there is no cross-video deduplication. Repetition is evidence.',
    },
    passes: {
      A: { videos: [...PASS_A], candidates: passA.length, capped_at: null as number | null },
      B: {
        videos: vids.length - PASS_A.size, candidates: passB.length,
        capped_at: passBTotal > PASS_B_CAP ? passBTotal - PASS_B_CAP : null,
        candidates_before_cap: passBTotal,
        dropped_by_group: passBTotal > PASS_B_CAP ? droppedByGroup : null,
      },
    },
    coverage_check: {
      video: TRUNCATED_VIDEO,
      rule: `no candidate may start after ${TRUNCATED_AFTER_S}s (20:20)`,
      violations: late.length,
      control_video: CONTROL_VIDEO,
      control_candidates_after_same_time: controlLate.length,
      control_note: 'If the control is 0 too, the filter cannot see late material and the check proved nothing.',
    },
    top_action_videos_outside_thesis: topAction,
    top_action_videos_outside_thesis_strict: topActionStrict,
    // The 60 most frequent content words in the 8 words FOLLOWING a strict
    // action verb, Pass B only. This is a pointer for CCW, not a finding: it
    // says which nouns keep turning up as the object of "abolish"/"restore"/
    // "repeal", including ones absent from the twelve workstreams.
    action_object_words_pass_b: [...objectWords.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 60).map(([word, n]) => ({ word, n })),
    // Videos carrying two transcripts. Every count above is OCCURRENCES, so a
    // moment in one of these is counted once per engine; *_distinct collapses
    // them. If this list ever contains a Pass B video, the Pass B columns and
    // the action-verb video ranking inflate too — today it does not.
    two_transcript_videos: twoTranscript,
    // Every distinct string each pattern actually matched, with counts. Read
    // this before quoting: a term can match words that are not the term.
    surface_forms: surfaces,
    literalness: (() => {
      // Two denominators, both named. `emitted` is what is in THIS file (Pass A
      // plus the capped Pass B); `all_before_cap` includes the 1,725 dropped.
      // Quoting one figure under an unqualified label is how a count becomes
      // an argument about the wrong population.
      const emitted = [...passA, ...passB]
      const tally = (cs: Candidate[]) => ({
        candidates: cs.length,
        with_any_non_literal: cs.filter(c => !c.all_literal).length,
        wholly_variant_only: cs.filter(c => c.terms_variant_only.length === c.matched_terms.length).length,
      })
      return {
        note: 'A candidate is variant_only for a term when that term is never said literally in its window. Ranking such a candidate as though the measure was named would be wrong; a MIXED candidate (quango: 112 "quangos" to 39 "quango") is fine.',
        emitted_in_this_file: tally(emitted),
        all_before_cap: tally(candidates),
        variant_only_by_term_emitted: emitted.flatMap(c => c.terms_variant_only)
          .reduce((m, t) => (m[t] = (m[t] ?? 0) + 1, m), {} as Record<string, number>),
      }
    })(),
    term_totals: totals,
    candidates_pass_a: passA,
    candidates_pass_b: passB,
  }

  const dest = path.resolve(__dirname, '../../docs/report_run/register_candidates.json')
  fs.writeFileSync(dest, JSON.stringify(out, null, 2))

  // The cap is the brief's, and register_candidates.json honours it. But B10
  // also says a missed candidate is a hole in a printed document, and 1,713
  // dropped is a lot of holes — so the uncapped Pass B goes beside it rather
  // than nowhere. CCW reads the capped file; this one is here if the cap looks
  // like it cost something.
  const full = path.resolve(__dirname, '../../docs/report_run/register_candidates_full.json')
  fs.writeFileSync(full, JSON.stringify({
    generated_at: out.generated_at, note: 'Uncapped Pass B, companion to register_candidates.json.',
    field_notes: out.field_notes, candidates_pass_b_uncapped: passBFull,
  }, null, 2))

  console.log(`\nwrote ${dest}`)
  console.log(`wrote ${full} (uncapped pass B: ${passBFull.length})`)
  console.log(`pass A: ${passA.length} candidates`)
  console.log(`pass B: ${passB.length} candidates (of ${passBTotal}; capped_at=${out.passes.B.capped_at})`)
  console.log(`coverage: ${TRUNCATED_VIDEO} late=${late.length} (control ${CONTROL_VIDEO} late=${controlLate.length})`)
  console.log('\ntop non-thesis videos by action-verb hits (inflected / strict):')
  for (const t of topAction) console.log(`  ${String(t.action_hits).padStart(3)} /${String(t.action_hits_strict).padStart(3)}  ${t.video_id}  ${t.published}  ${t.title}`)
  console.log('\nsame, ranked on STRICT matches only (strict / inflected):')
  for (const t of topActionStrict) console.log(`  ${String(t.action_hits_strict).padStart(3)} /${String(t.action_hits_inflected).padStart(3)}  ${t.video_id}  ${t.published}  ${t.title}`)
  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
