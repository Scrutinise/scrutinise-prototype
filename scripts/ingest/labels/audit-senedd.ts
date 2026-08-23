/**
 * audit-senedd.ts — INGEST-LABELS §4.2 and §4.3, measured against what we ACTUALLY STORED.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §4.3 — THE WELSH FINDING IS A PARSER BUG, NOT A PROPERTY OF THE MATERIAL. The brief predicted
 * this and it is right. The Cofnod publishes every contribution twice:
 *
 *     <div class="contributionText">
 *       <div class="verbatim">     ← AS SPOKEN. Either language.
 *       <div class="translation">  ← THE OTHER LANGUAGE.
 *
 * `senedd-cofnod.ts::contributionEnglish` prefers `translation`, on a stated premise —
 * *"English-spoken turns have no translation"* — that is FALSE: an English-spoken turn carries a
 * WELSH translation, and taking it is how an English speech gets stored in Welsh.
 *
 * ⚠ AND THE OBVIOUS FIX IS ALSO WRONG. "Take verbatim instead" stores Welsh for every turn actually
 * spoken in Welsh. NEITHER div is "the English one" — the language has to be decided per div. This
 * script measures all three rules side by side so the choice is made on numbers.
 *
 * §4.2 — THE HEADING THE PARSER NEVER LOOKED AT. Item blocks come in typed flavours; the parser
 * treats only `subHeading` (and a `heading` type that does not occur) as a heading. `agendaItem` —
 * *"3. Statement by the Minister for Health and Social Services: Coronavirus Update"* — is
 * discarded AND mis-filed as a contribution. So every speech under an agenda item that has no
 * sub-heading inherits the last sub-heading from the PREVIOUS agenda item, which is how two
 * speeches about oesophageal cancer came to be titled *"The 20 mph Speed Limit"*.
 *
 * ⚠ MEASURED AGAINST THE DATABASE, NOT AGAINST A SIMULATION. For each sampled plenary this
 * re-fetches the page, recomputes what the heading and the language SHOULD be, and compares to the
 * `corpus_sections` row actually serving today — joined on the stored `seq`. A rule re-implemented
 * and then compared to itself would agree with itself.
 *
 * Usage: tsx labels/audit-senedd.ts --n 12 [--out docs/senedd_audit.json]
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { r2Get } from '../shared/r2-client'

const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const N = arg('n') ? parseInt(arg('n')!, 10) : 12
const OUT = arg('out') ?? path.join(__dirname, '../../../docs/senedd_audit.json')
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org; OGL Senedd Cofnod)'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── language discrimination ──────────────────────────────────────────────────
// Function words, not content words: they are the highest-frequency tokens in both languages and
// do not overlap. Deliberately abstains ('?') rather than guessing on a short or ambiguous passage,
// because a wrong confident label here would silently become the error rate.
const CY = new Set(['yr','yn','y','ac','mae','bod','wedi','hynny','ddim','sydd','ni','fod','gan','gyda','iawn','rwy','yng','ei','eu','fel','hyn','oedd','byddai','am','yna','hefyd','ond','felly','nhw','ydy','ydw','sy'])
const EN = new Set(['the','of','and','that','is','to','in','we','it','for','have','are','this','be','on','with','as','was','not','which','you','they','there','would','has','but','from'])
function lang(t: string): 'cy' | 'en' | '?' {
  const w = t.toLowerCase().match(/[a-zâêîôûŵŷáéíóúàèìòùäëïöü']+/g) ?? []
  if (w.length < 20) return '?'
  let c = 0, e = 0
  for (const x of w) { if (CY.has(x)) c++; if (EN.has(x)) e++ }
  if (c === e) return '?'
  return c > e ? 'cy' : 'en'
}

const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/\s+/g, ' ').trim()

interface Block { type: string; raw: string }
function blocks(html: string): Block[] {
  const rx = /<div class="itemContent ([a-zA-Z]+)" id="C\d+">/g
  const at: Array<{ i: number; t: string }> = []
  let m: RegExpExecArray | null
  while ((m = rx.exec(html))) at.push({ i: m.index, t: m[1] })
  return at.map((s, k) => ({ type: s.t, raw: html.slice(s.i, k + 1 < at.length ? at[k + 1].i : html.length) }))
}
function div(blk: string, cls: string): string | null {
  const m = new RegExp(`<div class="${cls}\\s*"\\s*>`).exec(blk)
  if (!m) return null
  const rest = blk.slice(m.index + m[0].length)
  const cut = rest.split(/<div class="(?:verbatim|translation|contributionText)/)[0]
  const t = strip(cut)
  return t || null
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 2,
    statement_timeout: 900_000, query_timeout: 900_000,
  })

  const { rows: pop } = await pool.query(`
    SELECT count(*)::int rows, count(DISTINCT "parentDocId")::int plenaries
      FROM corpus_sections WHERE corpus='senedd-cofnod'`)
  const { rows: plenaries } = await pool.query<{ parentDocId: string }>(`
    SELECT "parentDocId" FROM corpus_sections WHERE corpus='senedd-cofnod'
     GROUP BY 1 ORDER BY random() LIMIT $1`, [N])

  console.log(`[senedd] population ${pop[0].rows.toLocaleString()} sections across ${pop[0].plenaries.toLocaleString()} plenaries; sampling ${plenaries.length}`)

  const tallies = {
    contributions: 0, bothDivs: 0, confident: 0,
    verbatim_en_translation_cy: 0, verbatim_cy_translation_en: 0, other: 0,
    stored_welsh: 0, stored_english: 0, stored_unknown: 0,
    heading_types: {} as Record<string, number>,
    heading_correct: 0, heading_WRONG: 0, heading_unjudgeable: 0,
    agendaItems_misfiled_as_speech: 0,
  }
  const examples: unknown[] = []

  for (const p of plenaries) {
    const id = p.parentDocId
    let html: string
    try {
      const res = await fetch(`https://record.senedd.wales/Plenary/${id}`, { headers: { 'User-Agent': UA } })
      if (!res.ok) { console.log(`  plenary ${id}: HTTP ${res.status} — skipped, not scored`); continue }
      html = await res.text()
    } catch (e) { console.log(`  plenary ${id}: fetch threw ${(e as Error).message} — skipped`); continue }
    await sleep(700)

    const bs = blocks(html)
    for (const b of bs) tallies.heading_types[b.type] = (tallies.heading_types[b.type] ?? 0) + 1

    // Recompute the CORRECT heading for each contribution: the most recent heading of EITHER kind,
    // with agendaItem resetting the sub-heading — which is what the document structure means.
    let agenda = '', sub = ''
    let seq = 0
    const truth = new Map<number, { heading: string; en: string | null; cy: string | null; verbatimLang: string; translationLang: string }>()
    for (const b of bs) {
      if (b.type === 'agendaItem') {
        // The parser does not recognise this type, so it falls through and is stored as a SPEECH.
        tallies.agendaItems_misfiled_as_speech++
        agenda = div(b.raw, 'translation') ?? strip(b.raw); sub = ''
        seq++   // it consumed a seq number in the stored numbering
        continue
      }
      if (b.type === 'subHeading' || b.type === 'heading') { sub = div(b.raw, 'translation') ?? strip(b.raw); continue }
      const v = div(b.raw, 'verbatim'), t = div(b.raw, 'translation')
      const ct = div(b.raw, 'contributionText')
      if (!v && !t && !ct) continue
      seq++
      tallies.contributions++
      const lv = v ? lang(v) : '?', lt = t ? lang(t) : '?'
      if (v && t) {
        tallies.bothDivs++
        if (lv !== '?' && lt !== '?') {
          tallies.confident++
          if (lv === 'en' && lt === 'cy') tallies.verbatim_en_translation_cy++
          else if (lv === 'cy' && lt === 'en') tallies.verbatim_cy_translation_en++
          else tallies.other++
        }
      }
      const en = lv === 'en' ? v : lt === 'en' ? t : null
      const cy = lv === 'cy' ? v : lt === 'cy' ? t : null
      truth.set(seq, { heading: sub || agenda, en, cy, verbatimLang: lv, translationLang: lt })
    }

    // ── compare against what is STORED and served today ──────────────────────
    const { rows: stored } = await pool.query<{ id: string; sectionTitle: string | null; r2Key: string | null }>(`
      SELECT id, "sectionTitle", "r2Key" FROM corpus_sections
       WHERE corpus='senedd-cofnod' AND "parentDocId"=$1`, [id])

    for (const s of stored.slice(0, 400)) {
      const n = parseInt(s.id.split(':')[2], 10)
      const t = truth.get(n)
      if (!t) continue
      const storedHead = (s.sectionTitle ?? '').replace(/^Senedd Plenary:\s*/, '')
      if (!t.heading) tallies.heading_unjudgeable++
      else if (storedHead && t.heading.toLowerCase().includes(storedHead.toLowerCase().slice(0, 24))) tallies.heading_correct++
      else {
        tallies.heading_WRONG++
        if (examples.length < 8) examples.push({ id: s.id, storedHeading: storedHead, trueHeading: t.heading })
      }
    }

    // Language of what is actually in R2, for a bounded sample per plenary.
    for (const s of stored.slice(0, 12)) {
      if (!s.r2Key) continue
      const body = await r2Get(s.r2Key)
      if (!body) continue
      const l = lang(body)
      if (l === 'cy') tallies.stored_welsh++
      else if (l === 'en') tallies.stored_english++
      else tallies.stored_unknown++
    }
    console.log(`  plenary ${id}: ${bs.length} blocks, ${stored.length} stored rows`)
  }
  await pool.end()

  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), n_plenaries: N, population: pop[0], tallies, examples }, null, 1))

  const c = tallies.confident
  console.log('\n=== §4.3 — WHICH DIV HOLDS WHICH LANGUAGE ===')
  console.log(`  contributions with both divs and a confident reading: ${c}`)
  console.log(`    verbatim=EN, translation=CY : ${tallies.verbatim_en_translation_cy}  (${(100 * tallies.verbatim_en_translation_cy / c).toFixed(1)}%)  — spoken in English`)
  console.log(`    verbatim=CY, translation=EN : ${tallies.verbatim_cy_translation_en}  (${(100 * tallies.verbatim_cy_translation_en / c).toFixed(1)}%)  — spoken in Welsh`)
  console.log(`    neither/ambiguous           : ${tallies.other}`)
  console.log(`\n  WELSH RATE UNDER EACH RULE (lower is better; we want English):`)
  console.log(`    current  (prefer translation) : ${(100 * tallies.verbatim_en_translation_cy / c).toFixed(1)}%  Welsh`)
  console.log(`    naive fix (prefer verbatim)   : ${(100 * tallies.verbatim_cy_translation_en / c).toFixed(1)}%  Welsh`)
  console.log(`    correct   (pick the English)  : 0.0%  Welsh`)
  const sl = tallies.stored_welsh + tallies.stored_english + tallies.stored_unknown
  console.log(`\n  READ BACK OUT OF R2 (what is served today), n=${sl}: Welsh ${tallies.stored_welsh} (${(100 * tallies.stored_welsh / sl).toFixed(1)}%), English ${tallies.stored_english}, unreadable ${tallies.stored_unknown}`)

  console.log('\n=== §4.2 — HEADINGS ===')
  console.log(`  block types seen: ${JSON.stringify(tallies.heading_types)}`)
  const hj = tallies.heading_correct + tallies.heading_WRONG
  console.log(`  stored heading vs the heading the document structure gives, n=${hj} judged (${tallies.heading_unjudgeable} unjudgeable)`)
  console.log(`    correct ${tallies.heading_correct}  WRONG ${tallies.heading_WRONG}  = ${hj ? (100 * tallies.heading_WRONG / hj).toFixed(1) : '—'}% wrong`)
  console.log(`  agendaItem blocks the parser does not recognise (discarded as a heading AND stored as a speech): ${tallies.agendaItems_misfiled_as_speech}`)
  for (const e of examples) console.log(`    ${JSON.stringify(e)}`)
  console.log(`\n[senedd] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
