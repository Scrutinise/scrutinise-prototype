/**
 * entity-decode-census.ts — BRIEF_INGEST_ENTITY_DECODE §1: measure the spread before deciding.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT WAS FOUND, AND WHAT THIS IS FOR
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 2D-3 found literal, undecoded HTML entities in compiled `committees-evidence` text in R2 —
 * `Barbara&#xa0;Rayment` where the document says `Barbara Rayment`. 200 documents from one
 * collection is a signal, not a census. This is the census.
 *
 * Two halves, and they are deliberately different in kind:
 *
 *   · **TITLES — exhaustive, no sampling.** `corpus_sections.sectionTitle` is in Neon, so every row
 *     can be checked rather than estimated. Titles are the half that REACHES THE USER: a title is
 *     rendered in a search result, so a raw `&#xa0;` there is visible damage, not just index damage.
 *   · **BODIES — sampled from R2**, because the text is not in the database. Per corpus, with the
 *     sample size and the resulting confidence stated rather than implied.
 *
 * ⚠ THE PATTERN IS DELIBERATELY NARROW. §3 warns against decoding blindly: legislative text can
 * legitimately contain an ampersand-hash sequence inside quoted material. So this counts a NAMED
 * set plus the numeric forms, reports every distinct entity it finds with its count, and never
 * treats "matches a pattern" as "is a defect".
 *
 * Usage (from scripts/ingest):
 *   npx tsx entity-decode-census.ts --self-test
 *   npx tsx entity-decode-census.ts --titles              # exhaustive, DB only, no R2
 *   npx tsx entity-decode-census.ts --bodies [--sample 150] [--corpus X]
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }
const str = (n: string, d: string | null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }

const SAMPLE = num('sample', 150)
const CONCURRENCY = num('concurrency', 24)
const OUT = path.join(__dirname, 'entity-decode-census.json')

/**
 * An HTML entity as it survives into text that should already be decoded.
 *
 * ⚠ `&\w+;` alone would match `&c;` and `&s;` in old statutory text, and `&#x2014;` inside a quoted
 * passage about markup. So the census reports WHAT it found, by name, and the fix list is chosen
 * from that report — not from this regex.
 */
export const ENTITY_RE = /&(#x[0-9a-fA-F]{2,6}|#\d{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});/g

/** The ones that glue two words together, which is the damaging class. */
export const WORD_JOINERS = new Set(['&#xa0;', '&#xA0;', '&nbsp;', '&#160;', '&#x2011;', '&#8209;', '&#xad;', '&#xAD;', '&#173;', '&#x2009;', '&#x202f;'])

export interface Tally { docs: number; hits: number; kinds: Record<string, number>; joinerHits: number }
export const newTally = (): Tally => ({ docs: 0, hits: 0, kinds: {}, joinerHits: 0 })

export function tallyText(text: string, t: Tally): boolean {
  const m = text.match(ENTITY_RE)
  if (!m) return false
  t.hits += m.length
  for (const x of m) {
    const k = x.toLowerCase()
    t.kinds[k] = (t.kinds[k] ?? 0) + 1
    if (WORD_JOINERS.has(x) || WORD_JOINERS.has(k)) t.joinerHits++
  }
  return true
}

const n = (v: unknown) => Number(v).toLocaleString('en-GB')
const pct = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(2)}%`

// ── §1.3 — the half that reaches the user, measured exhaustively ────────────────────────────────
async function titles(pool: ReturnType<typeof getNeonPool>) {
  console.log(`\n╔════════════════════════════════════════════════════════════════════════════════╗`)
  console.log(`║  §1.3 — DOES IT REACH THE USER?  Titles, EXHAUSTIVE over every row in Neon     ║`)
  console.log(`╚════════════════════════════════════════════════════════════════════════════════╝`)
  console.log(`  A section title is rendered in a search result. This is not a sample.\n`)

  const { rows: tot } = await pool.query<{ corpus: string; n: string; bad: string; ex: string }>(`
    SELECT corpus, COUNT(*)::text n,
           COUNT(*) FILTER (WHERE "sectionTitle" ~ '&(#x[0-9a-fA-F]{2,6}|#[0-9]{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});')::text bad,
           (ARRAY_AGG("sectionTitle") FILTER (WHERE "sectionTitle" ~ '&(#x[0-9a-fA-F]{2,6}|#[0-9]{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});'))[1] ex
    FROM corpus_sections GROUP BY 1 ORDER BY 3 DESC NULLS LAST`)
  const affected = tot.filter((r) => Number(r.bad) > 0)
  const allRows = tot.reduce((a, r) => a + Number(r.n), 0)
  const allBad = tot.reduce((a, r) => a + Number(r.bad), 0)
  console.log(`  ${n(allBad)} of ${n(allRows)} section titles carry a literal entity — ${pct(allBad, allRows)}`)
  console.log(`  affected corpora: ${affected.length} of ${tot.length}\n`)
  if (affected.length) {
    console.log(`  corpus                              rows        titles hit   share   example`)
    for (const r of affected.slice(0, 25)) {
      console.log(`  ${r.corpus.padEnd(32)} ${n(r.n).padStart(10)} ${n(r.bad).padStart(11)}  ${pct(Number(r.bad), Number(r.n)).padStart(7)}  ${(r.ex ?? '').slice(0, 60)}`)
    }
  }

  // Which entities, across all titles. Exhaustive.
  const { rows: kinds } = await pool.query<{ ent: string; n: string }>(`
    SELECT ent, COUNT(*)::text n FROM (
      SELECT unnest(regexp_matches("sectionTitle", '&(?:#x[0-9a-fA-F]{2,6}|#[0-9]{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});', 'g')) ent
      FROM corpus_sections
      WHERE "sectionTitle" ~ '&(#x[0-9a-fA-F]{2,6}|#[0-9]{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});') x
    GROUP BY 1 ORDER BY 2 DESC LIMIT 25`)
  console.log(`\n  which entities appear in titles:`)
  for (const k of kinds) console.log(`    ${k.ent.padEnd(12)} ${n(k.n).padStart(9)}${WORD_JOINERS.has(k.ent.toLowerCase()) ? '   ⚠ glues two words together' : ''}`)

  // The other user-visible columns.
  for (const col of ['speaker', 'sourceUrl', 'attribution']) {
    const { rows: [c] } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM corpus_sections WHERE "${col}" ~ '&(#x[0-9a-fA-F]{2,6}|#[0-9]{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});'`)
    console.log(`  rows whose ${col.padEnd(12)} carries one: ${n(c.n)}`)
  }
  return { allRows, allBad, affected: affected.map((r) => ({ corpus: r.corpus, rows: +r.n, bad: +r.bad })) }
}

// ── §1.1/§1.2 — the bodies, sampled from R2 ─────────────────────────────────────────────────────
async function bodies(pool: ReturnType<typeof getNeonPool>) {
  const only = str('corpus', null)
  const { rows: corpora } = await pool.query<{ corpus: string; n: string }>(`
    SELECT corpus, COUNT(*)::text n FROM corpus_sections
    WHERE "r2Key" IS NOT NULL AND status='compiled' ${only ? `AND corpus = '${only.replace(/'/g, "''")}'` : ''}
    GROUP BY 1 ORDER BY 2 DESC`)

  console.log(`\n╔════════════════════════════════════════════════════════════════════════════════╗`)
  console.log(`║  §1.1/§1.2 — THE BODIES.  ${String(SAMPLE).padStart(3)} documents per corpus, read from R2                ║`)
  console.log(`╚════════════════════════════════════════════════════════════════════════════════╝`)
  console.log(`  ${corpora.length} corpora with compiled R2 text.`)
  console.log(`  ⚠ A ${SAMPLE}-document sample gives a rate with roughly ±${(100 * 1.96 * Math.sqrt(0.25 / SAMPLE)).toFixed(1)}pp of 95% error at`)
  console.log(`    a 50% underlying rate — enough to separate "clean" from "contaminated", not enough`)
  console.log(`    to quote a precise percentage. Corpora that come back hit are re-sampled deeper.\n`)

  const results: Array<{ corpus: string; rows: number; sampled: number; docsHit: number; hits: number; joiners: number; kinds: Record<string, number> }> = []
  console.log(`  corpus                              rows       sampled  docs hit   share    occurrences  joiners`)
  for (const c of corpora) {
    const size = Math.min(SAMPLE, Number(c.n))
    const { rows: docs } = await pool.query<{ k: string }>(`
      SELECT "r2Key" k FROM corpus_sections
      WHERE corpus=$1 AND "r2Key" IS NOT NULL AND status='compiled'
      ORDER BY md5(id) LIMIT $2`, [c.corpus, size])
    const t = newTally()
    let read = 0
    let i = 0
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, docs.length) }, async () => {
      while (true) {
        const j = i++
        if (j >= docs.length) return
        const txt = await r2Get(docs[j].k).catch(() => null)
        if (!txt) continue
        read++
        if (tallyText(txt, t)) t.docs++
      }
    }))
    results.push({ corpus: c.corpus, rows: Number(c.n), sampled: read, docsHit: t.docs, hits: t.hits, joiners: t.joinerHits, kinds: t.kinds })
    const mark = t.docs ? (t.joinerHits ? '  ⚠' : '  ·') : ''
    console.log(`  ${c.corpus.padEnd(32)} ${n(c.n).padStart(10)} ${String(read).padStart(8)} ${String(t.docs).padStart(9)}  ${pct(t.docs, read).padStart(7)} ${n(t.hits).padStart(12)} ${n(t.joinerHits).padStart(8)}${mark}`)
  }

  const hitCorpora = results.filter((r) => r.docsHit > 0)
  const joinCorpora = results.filter((r) => r.joiners > 0)
  console.log(`\n  ── SUMMARY ──`)
  console.log(`  corpora with ANY literal entity in the sample     ${hitCorpora.length} of ${results.length}`)
  console.log(`  corpora with a WORD-JOINING entity               ${joinCorpora.length} of ${results.length}   ← the damaging class`)
  const allKinds: Record<string, number> = {}
  for (const r of results) for (const [k, v] of Object.entries(r.kinds)) allKinds[k] = (allKinds[k] ?? 0) + v
  console.log(`\n  every distinct entity found, with its count — the fix list is chosen FROM THIS, not from the regex:`)
  for (const [k, v] of Object.entries(allKinds).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`    ${k.padEnd(12)} ${n(v).padStart(9)}${WORD_JOINERS.has(k) ? '   ⚠ glues two words together' : ''}`)
  }

  // An extrapolation, labelled as one.
  console.log(`\n  ── EXTRAPOLATION, and it is an extrapolation ──`)
  let estDocs = 0
  let totRows = 0
  for (const r of results) { totRows += r.rows; estDocs += r.rows * (r.docsHit / Math.max(1, r.sampled)) }
  console.log(`  ${n(Math.round(estDocs))} of ${n(totRows)} compiled documents (${pct(estDocs, totRows)}) would carry at least one,`)
  console.log(`  if each corpus's sample is representative of it. ⚠ That is the assumption doing the work.`)

  fs.writeFileSync(OUT, JSON.stringify({ generatedFor: 'BRIEF_INGEST_ENTITY_DECODE §1', sample: SAMPLE, results }, null, 1))
  console.log(`\n  per-corpus detail written to ${OUT}`)
  return results
}

/**
 * ── §2's denominator, and my first version of it measured the wrong thing ───────────────────────
 *
 * I first classified each occurrence as INSIDE a word or BETWEEN two, by looking at the characters
 * either side. That is useless here: `Barbara&#xa0;Rayment` has a letter on both sides and loses
 * nothing, while `preven&#xad;tative` has a letter on both sides and loses everything. Character
 * adjacency cannot tell them apart, because the difference is what the entity DECODES TO.
 *
 * The exact question is: **does repairing the text create a token that the raw text does not
 * already have?** That needs no dictionary and no judgement.
 *
 *   Barbara&#xa0;Rayment   raw → barbara|xa0|rayment   repaired → barbara|rayment    nothing lost
 *   preven&#xad;tative     raw → preven|xad|tative     repaired → preventative       "preventative" LOST
 *
 * ⚠ And it exposes something the fix design has to know: **decoding alone does not recover
 * `preventative`.** `&#xad;` decodes to U+00AD, which the tokeniser also splits on, so decode-only
 * still yields `preven|tative`. The soft hyphen has to be REMOVED, not decoded — which is what a
 * soft hyphen means. So the repair is measured in two variants and reported separately.
 */
export function tokenise(text: string): string[] {
  // The `simple` tokeniser: split on every non-alphanumeric, lowercase, cap at maxTokenLength 40.
  return text.toLowerCase().split(/[^a-z0-9]+/i).filter((t) => t && t.length <= 40)
}

/** Decode the named + numeric forms. Nothing else — §3 forbids decoding blindly. */
export function decodeEntities(text: string): string {
  const safe = (n: number) => (Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ')
  return text
    .replace(/&#x([0-9a-fA-F]{2,6});/g, (_, h) => safe(parseInt(h, 16)))
    .replace(/&#(\d{2,7});/g, (_, d) => safe(parseInt(d, 10)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&mdash;/gi, '—')
}

/** Decode, then remove the characters that are invisible by definition. */
export function decodeAndStripInvisibles(text: string): string {
  return decodeEntities(text).replace(/[­​-‍﻿]/g, '')
}

/** Tokens the repair recovers that the raw text does not already contain. */
export function lostTokens(raw: string, repair: (s: string) => string): string[] {
  const have = new Set(tokenise(raw))
  const want = tokenise(repair(raw))
  const lost: string[] = []
  for (const t of want) if (!have.has(t)) lost.push(t)
  return lost
}

async function context(pool: ReturnType<typeof getNeonPool>) {
  const detail = JSON.parse(fs.readFileSync(OUT, 'utf8')) as { results: Array<{ corpus: string; rows: number; docsHit: number; sampled: number }> }
  const affected = detail.results.filter((r) => r.docsHit > 0)
  console.log(`
╔════════════════════════════════════════════════════════════════════════════════╗`)
  console.log(`║  §2's DENOMINATOR — how many SEARCHABLE TOKENS does the damage actually cost?  ║`)
  console.log(`╚════════════════════════════════════════════════════════════════════════════════╝`)
  console.log(`  A token the repaired text has and the raw text does not is a token no query can reach.`)
  console.log(`  Two repairs, because they do not recover the same things:`)
  console.log(`    decode       — turn &#xa0; into a space, &#8217; into an apostrophe`)
  console.log(`    decode+strip — and then remove the characters that are invisible by definition`)
  console.log(`                   (soft hyphen, zero-width joiner), which decoding alone leaves in
`)
  console.log(`  corpus                          docs   tokens    lost:decode   lost:decode+strip`)
  let tTok = 0
  let tDec = 0
  let tStr = 0
  const examples: string[] = []
  for (const c of affected) {
    const { rows } = await pool.query<{ k: string }>(`
      SELECT "r2Key" k FROM corpus_sections WHERE corpus=$1 AND "r2Key" IS NOT NULL AND status='compiled'
      ORDER BY md5(id) LIMIT 200`, [c.corpus])
    let toks = 0
    let dec = 0
    let strp = 0
    let read = 0
    let i = 0
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
      while (true) {
        const j = i++
        if (j >= rows.length) return
        const t = await r2Get(rows[j].k).catch(() => null)
        if (!t) continue
        read++
        toks += tokenise(t).length
        const a = lostTokens(t, decodeEntities)
        const b = lostTokens(t, decodeAndStripInvisibles)
        dec += a.length
        strp += b.length
        if (b.length && examples.length < 12) examples.push(`${c.corpus}: ${b.slice(0, 4).join(', ')}`)
      }
    }))
    tTok += toks; tDec += dec; tStr += strp
    console.log(`  ${c.corpus.padEnd(28)} ${String(read).padStart(6)} ${n(toks).padStart(9)} ${n(dec).padStart(12)} ${n(strp).padStart(19)}${strp ? '  ⚠' : ''}`)
  }
  console.log(`
  TOTAL                                ${n(tTok).padStart(9)} ${n(tDec).padStart(12)} ${n(tStr).padStart(19)}`)
  console.log(`
  ⚠ THE SEARCH-DAMAGE FIGURE: decoding recovers ${n(tDec)} tokens in ${n(tTok)} — ${pct(tDec, tTok)} of the`)
  console.log(`  indexed vocabulary of the affected corpora. Decode+strip recovers ${n(tStr)} — ${pct(tStr, tTok)}.`)
  if (examples.length) {
    console.log(`
  words that are currently unfindable, and would be recoverable:`)
    for (const e of examples) console.log(`    ${e}`)
  } else {
    console.log(`
  ⚠ NOT ONE recoverable token was found in the sample. On this evidence the entities`)
    console.log(`  cost display quality, not recall.`)
  }
}

function selftest() {
  const cases: Array<[string, boolean]> = [
    ['a hex entity is counted', (() => { const t = newTally(); tallyText('Barbara&#xa0;Rayment', t); return t.hits === 1 && t.joinerHits === 1 })()],
    ['a decimal entity is counted', (() => { const t = newTally(); tallyText('a&#160;b', t); return t.joinerHits === 1 })()],
    ['a named entity is counted', (() => { const t = newTally(); tallyText('a&nbsp;b', t); return t.joinerHits === 1 })()],
    ['&amp; is found but is NOT a word-joiner', (() => { const t = newTally(); tallyText('R&amp;D', t); return t.hits === 1 && t.joinerHits === 0 })()],
    ['a soft hyphen is a joiner', (() => { const t = newTally(); tallyText('preven&#xad;tative', t); return t.joinerHits === 1 })()],
    ['clean text scores nothing', (() => { const t = newTally(); return !tallyText('Barbara Rayment gave evidence.', t) && t.hits === 0 })()],
    // ⚠ negative controls: the pattern must not fire on ordinary prose containing an ampersand.
    ['a bare ampersand is not an entity', (() => { const t = newTally(); return !tallyText('Marks & Spencer', t) })()],
    ['an ampersand-hash with no semicolon is not an entity', (() => { const t = newTally(); return !tallyText('see &#160 for detail', t) })()],
    ['a long word after & is not an entity', (() => { const t = newTally(); return !tallyText('&extraordinarilylong;', t) })()],
    ['the kinds map records what was found, by name',
      (() => { const t = newTally(); tallyText('a&#xa0;b&#xa0;c&amp;d', t); return t.kinds['&#xa0;'] === 2 && t.kinds['&amp;'] === 1 })()],
    // ── the token-level damage measure, which replaced a character-adjacency one that
    //    could not tell 'Barbara&#xa0;Rayment' (loses nothing) from 'preven&#xad;tative' (loses all) ──
    ['a between-words entity loses NO token', lostTokens('Barbara&#xa0;Rayment', decodeEntities).length === 0],
    ['⚠ decoding ALONE does not recover a soft-hyphenated word',
      !lostTokens('preven&#xad;tative', decodeEntities).includes('preventative')],
    ['decode+strip DOES recover it',
      lostTokens('preven&#xad;tative', decodeAndStripInvisibles).includes('preventative')],
    ['a curly-quote entity loses no token', lostTokens('don&#8217;t stop', decodeEntities).length === 0],
    ['&amp; loses no token', lostTokens('Marks &amp; Spencer', decodeEntities).length === 0],
    ['clean text loses nothing under either repair',
      lostTokens('nothing here at all', decodeEntities).length === 0 && lostTokens('nothing here at all', decodeAndStripInvisibles).length === 0],
    ['the tokeniser splits on every non-alphanumeric',
      tokenise('Barbara&#xa0;Rayment').join('|') === 'barbara|xa0|rayment'],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

async function main() {
  if (flag('self-test')) { selftest(); return }
  const pool = getNeonPool()
  try {
    const any = flag('titles') || flag('bodies') || flag('context')
    if (flag('titles') || !any) await titles(pool)
    if (flag('bodies') || !any) await bodies(pool)
    if (flag('context')) await context(pool)
  } finally { await endNeonPool() }
}
if (require.main === module) main().catch((e) => { console.error('[entity-decode-census] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
