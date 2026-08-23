/**
 * probe-3c2-speech.ts — GRAPH 3C-2. Can the corpus supply a member's OWN WORDS on a matter?
 *
 * The validation pass is paused because 136 of its 157 rows rest on amendment sponsorship, which is
 * an UNSIGNED fact: a wrecking amendment and a strengthening amendment are the same act. Before any
 * rebuild, this establishes what a direction-bearing basis could be built from — measured, not
 * assumed.
 *
 * The questions, in order, and the first one can kill the whole route:
 *   0. Does the position graph hold ANY speech-derived signal? If it does, speech is circular.
 *   1. Which `corpus` values hold debate text, and how much?
 *   2. Is a speech attributed to a NAMED SPEAKER, and how often?
 *   3. Can that speaker be resolved to an MNIS id by an EXACT key, or only by name?
 *   4. Can a speech be tied to a matter at all?
 *   5. Where does the TEXT live, and what does one look like?
 *
 * Usage (from scripts/graph):  npx tsx probe-3c2-speech.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)

    // ── 0 · a yes here kills the route ───────────────────────────────────────────────────────
    console.log(`\n════ 0 · IS SPEECH CIRCULAR? ════`)
    const { rows: st } = await pool.query<{ signal_type: string; n: string }>(
      `SELECT signal_type, COUNT(*)::text AS n FROM position_signal GROUP BY 1 ORDER BY 2::bigint DESC`)
    for (const r of st) console.log(`  ${r.signal_type.padEnd(24)} ${Number(r.n).toLocaleString().padStart(11)}`)
    const speechy = st.filter((r) => /speech|debate|extract|utterance|statement/i.test(r.signal_type))
    console.log(`  ⇒ ${speechy.length === 0
      ? '**NO speech-derived signal type.** Speech is non-circular — TODAY. A row sourced from it'
        + '\n    must be MARKED, because folding extracted positions in later would retire it.'
      : '⛔ ' + speechy.map((r) => r.signal_type).join(', ') + ' — SPEECH IS CIRCULAR, route dead.'}`)

    // ── 1 · which corpora hold debate text ───────────────────────────────────────────────────
    console.log(`\n════ 1 · WHICH CORPORA CARRY A SPEAKER ════`)
    const { rows: cs } = await pool.query<{ corpus: string; n: string; withSpeaker: string; withDate: string }>(`
      SELECT corpus, COUNT(*)::text AS n,
             COUNT(*) FILTER (WHERE speaker IS NOT NULL AND speaker <> '')::text AS "withSpeaker",
             COUNT(*) FILTER (WHERE "itemDate" IS NOT NULL)::text AS "withDate"
        FROM corpus_sections
       GROUP BY 1 HAVING COUNT(*) FILTER (WHERE speaker IS NOT NULL AND speaker <> '') > 0
       ORDER BY 3::bigint DESC LIMIT 20`)
    console.log(`  ${'corpus'.padEnd(34)} ${'rows'.padStart(11)} ${'with speaker'.padStart(13)} ${'with date'.padStart(11)}`)
    for (const r of cs) {
      console.log(`  ${r.corpus.padEnd(34)} ${Number(r.n).toLocaleString().padStart(11)} ` +
        `${Number(r.withSpeaker).toLocaleString().padStart(13)} ${Number(r.withDate).toLocaleString().padStart(11)}`)
    }
    if (!cs.length) console.log('  ⛔ NO corpus carries a speaker at all.')

    // ── 2 · what a speaker string looks like ────────────────────────────────────────────────
    console.log(`\n════ 2 · WHAT A SPEAKER STRING LOOKS LIKE ════`)
    for (const c of cs.slice(0, 3)) {
      const { rows: sp } = await pool.query<{ speaker: string; n: string }>(`
        SELECT speaker, COUNT(*)::text AS n FROM corpus_sections
         WHERE corpus = $1 AND speaker IS NOT NULL AND speaker <> ''
         GROUP BY 1 ORDER BY 2::bigint DESC LIMIT 8`, [c.corpus])
      console.log(`  ── ${c.corpus} ──`)
      for (const s of sp) console.log(`     ${String(s.n).padStart(7)}  "${s.speaker.slice(0, 70)}"`)
    }

    // ── 3 · can a speaker be resolved to an MNIS id by an EXACT key? ─────────────────────────
    console.log(`\n════ 3 · CAN A SPEAKER RESOLVE TO AN MNIS ID? ════`)
    console.log(`  ⚠ The standing rule forbids merging identities on similarity. So the question is`)
    console.log(`    not "can we guess" but "is there an EXACT key, or a name that matches exactly one".`)
    for (const c of cs.slice(0, 3)) {
      const { rows: [r] } = await pool.query<{ distinct: string; exact1: string; ambiguous: string; none: string }>(`
        WITH s AS (SELECT DISTINCT speaker FROM corpus_sections
                    WHERE corpus = $1 AND speaker IS NOT NULL AND speaker <> ''),
        m AS (SELECT s.speaker,
                     (SELECT COUNT(*) FROM graph_entity g
                       WHERE g.kind='person' AND g.parl_member_id IS NOT NULL
                         AND lower(regexp_replace(g.canonical_name, '^(Rt Hon |Sir |Dame |Lord |Baroness |Mr |Mrs |Ms |Dr )+', '', 'gi'))
                           = lower(regexp_replace(s.speaker, '^(Rt Hon |Sir |Dame |Lord |Baroness |Mr |Mrs |Ms |Dr )+', '', 'gi'))
                     ) AS c
                FROM s)
        SELECT COUNT(*)::text AS distinct,
               COUNT(*) FILTER (WHERE c = 1)::text AS exact1,
               COUNT(*) FILTER (WHERE c > 1)::text AS ambiguous,
               COUNT(*) FILTER (WHERE c = 0)::text AS none
          FROM m`, [c.corpus])
      console.log(`  ${c.corpus.padEnd(30)} ${Number(r.distinct).toLocaleString()} distinct speakers → ` +
        `${Number(r.exact1).toLocaleString()} match exactly one MNIS person, ` +
        `${r.ambiguous} ambiguous, ${Number(r.none).toLocaleString()} no match`)
    }

    // ── 4 · can a speech be tied to a MATTER? ────────────────────────────────────────────────
    console.log(`\n════ 4 · CAN A SPEECH BE TIED TO A MATTER? ════`)
    const MATTERS: Array<[string, string]> = [
      ['M1 assisted dying', 'Terminally Ill Adults'],
      ['M2 Rwanda', 'Safety of Rwanda'],
      ['M3 illegal migration', 'Illegal Migration'],
      ['M4 nationality/borders', 'Nationality and Borders'],
      ['M5 EU withdrawal', 'European Union (Withdrawal)'],
      ['M6 smoking ban', 'Tobacco and Vapes'],
      ['M7 public order', 'Public Order'],
      ['M8 minimum service levels', 'Minimum Service Levels'],
      ['M9 environment', 'Environment Bill'],
      ['M10 retained EU law', 'Retained EU Law'],
    ]
    console.log(`  ${'matter'.padEnd(26)} ${'titled rows'.padStart(12)} ${'with speaker'.padStart(13)} ${'distinct speakers'.padStart(18)}`)
    for (const [label, needle] of MATTERS) {
      const { rows: [r] } = await pool.query<{ n: string; sp: string; d: string }>(`
        SELECT COUNT(*)::text AS n,
               COUNT(*) FILTER (WHERE speaker IS NOT NULL AND speaker <> '')::text AS sp,
               COUNT(DISTINCT speaker) FILTER (WHERE speaker IS NOT NULL AND speaker <> '')::text AS d
          FROM corpus_sections
         WHERE "sectionTitle" ILIKE '%' || $1 || '%'`, [needle])
      console.log(`  ${label.padEnd(26)} ${Number(r.n).toLocaleString().padStart(12)} ${Number(r.sp).toLocaleString().padStart(13)} ${Number(r.d).toLocaleString().padStart(18)}`)
    }

    // ── 5 · where the text lives, and one real row ──────────────────────────────────────────
    console.log(`\n════ 5 · WHERE THE TEXT LIVES ════`)
    const { rows: sample } = await pool.query<Record<string, string | null>>(`
      SELECT id, corpus, "sectionTitle", speaker, "itemDate"::text AS d, "sourceUrl", "r2Key", "wordCount"::text AS wc, licence
        FROM corpus_sections
       WHERE "sectionTitle" ILIKE '%Terminally Ill Adults%' AND speaker IS NOT NULL AND speaker <> ''
       ORDER BY "wordCount" DESC NULLS LAST LIMIT 3`)
    for (const s of sample) {
      console.log(`  id        ${s.id}`)
      console.log(`  corpus    ${s.corpus}`)
      console.log(`  title     ${(s.sectionTitle ?? '').slice(0, 90)}`)
      console.log(`  speaker   ${s.speaker}`)
      console.log(`  date      ${s.d}   words ${s.wc}   licence ${s.licence ?? '(null)'}`)
      console.log(`  sourceUrl ${(s.sourceUrl ?? '(null)').slice(0, 110)}`)
      console.log(`  r2Key     ${s.r2Key ?? '(null)'}`)
      console.log()
    }
    if (!sample.length) console.log('  ⛔ no speaker-attributed row for the assisted dying Bill')
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3c2-speech] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
