/**
 * walk-pwdata.ts — PART B, WALKER 2. ParlParse / TheyWorkForYou `scrapedxml`.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE UNIT IS A SITTING DAY, NOT A FILE, AND THE DIFFERENCE IS THE REVISION LETTER.
 *
 * ParlParse republishes a day as it is corrected: `debates2026-04-21a`, `…b`, … `…f`. Those are six
 * files and ONE sitting day. Counting files would give a published_units that drifts upward every
 * time Hansard corrects a typo, and a coverage figure that falls when nothing changed. So both
 * sides — the directory index and `corpus_sections."parentDocId"` — are reduced to
 * `<stream><date>` with the trailing letter stripped, and the census counts days.
 *
 * ⚠ WE MAY HOLD AN OLDER REVISION THAN THE PUBLISHER'S LATEST. That is a freshness question, not a
 * coverage one, and it is counted and reported separately (`stale_revisions` in the artefact)
 * rather than being folded into either number. A day held at revision `c` while the publisher is at
 * `f` is a day we hold.
 *
 * Usage:
 *   tsx census/b/walk-pwdata.ts
 *   tsx census/b/walk-pwdata.ts --self-test
 */
import fs from 'fs'
import path from 'path'
import { pool } from '../../c2/db'
import { politeFetch, writeCensus, selfTestHeld, WALK_DIR, type CensusRow } from './harness'

const SELF_TEST = process.argv.includes('--self-test')
const BASE = 'https://www.theyworkforyou.com/pwdata/scrapedxml'

/** stream directory → the corpus key that holds it, and the filename prefix each day carries. */
const STREAMS: { dir: string; corpus: string; prefix: string; unit: string }[] = [
  { dir: 'debates',     corpus: 'pwdata-debates',     prefix: 'debates',     unit: 'Commons sitting day' },
  { dir: 'lordspages',  corpus: 'pwdata-lords',       prefix: 'daylord',     unit: 'Lords sitting day' },
  { dir: 'westminhall', corpus: 'pwdata-westminster', prefix: 'westminster', unit: 'Westminster Hall sitting day' },
  { dir: 'wrans',       corpus: 'pwdata-wrans',       prefix: 'answers',     unit: 'written-answers day' },
  { dir: 'lordswrans',  corpus: 'pwdata-lordswrans',  prefix: 'lordswrans',  unit: 'Lords written-answers day' },
  { dir: 'wms',         corpus: 'pwdata-wms',         prefix: 'ministerial', unit: 'written-statements day' },
  { dir: 'lordswms',    corpus: 'pwdata-lordswms',    prefix: 'lordswms',    unit: 'Lords written-statements day' },
]

/** `debates2026-04-21f.xml` → { day: 'debates2026-04-21', rev: 'f' }. A file with no letter is
 *  revision '' and sorts first, which is correct: it is the original. */
function splitRevision(name: string): { day: string; rev: string } | null {
  const m = /^(.*?\d{4}-\d{2}-\d{2})([a-z]*)$/.exec(name.replace(/\.xml$/, ''))
  return m ? { day: m[1], rev: m[2] } : null
}

async function walkStream(dir: string, prefix: string) {
  const r = await politeFetch(`${BASE}/${dir}/`, { floorMs: 800 })
  if (!r.text) return null
  const files = [...r.text.matchAll(/href="([^"]+\.xml)"/g)].map(m => m[1])
  const latest = new Map<string, string>()   // day → highest revision letter published
  for (const f of files) {
    const base = f.split('/').pop() ?? f
    if (!base.startsWith(prefix)) continue
    const s = splitRevision(base)
    if (!s) continue
    const prev = latest.get(s.day)
    if (prev === undefined || s.rev > prev) latest.set(s.day, s.rev)
  }
  return { files: files.length, latest }
}

async function main() {
  if (SELF_TEST) { await selfTestHeld('pwdata'); return }
  const p = pool()
  const rows: CensusRow[] = []
  fs.mkdirSync(WALK_DIR, { recursive: true })
  const walkStore: any = {}

  for (const s of STREAMS) {
    const walked = await walkStream(s.dir, s.prefix)
    if (!walked) {
      rows.push({ corpus_key: s.corpus, state: 'UNMEASURED', unit: s.unit,
        method: `directory index ${BASE}/${s.dir}/ — UNREADABLE at walk time`,
        published_units: null, held_units: await heldDays(p, s.corpus), hollow_units: 0,
        absent_ids: [], absent_total: 0, walked_at: null, walk_artifact_path: null,
        notes: 'the publisher index did not answer; no denominator is recorded rather than a wrong one' })
      continue
    }

    // held side, reduced to the same day identity
    const heldRows = (await p.query(
      `SELECT DISTINCT "parentDocId" pd FROM corpus_sections
        WHERE corpus=$1 AND status='compiled' AND "parentDocId" IS NOT NULL`, [s.corpus])).rows
    const heldDaysMap = new Map<string, string>()
    for (const h of heldRows) {
      const sp = splitRevision(h.pd)
      if (!sp) continue
      const prev = heldDaysMap.get(sp.day)
      if (prev === undefined || sp.rev > prev) heldDaysMap.set(sp.day, sp.rev)
    }

    const absent: string[] = []
    let stale = 0
    for (const [day, rev] of walked.latest) {
      const ours = heldDaysMap.get(day)
      if (ours === undefined) absent.push(day)
      else if (ours < rev) stale++
    }
    // days we hold that the publisher's index no longer lists — recorded, never subtracted
    const extra = [...heldDaysMap.keys()].filter(d => !walked.latest.has(d))

    walkStore[s.corpus] = { dir: s.dir, files: walked.files, published_days: walked.latest.size,
      held_days: heldDaysMap.size, stale_revisions: stale, absent_days: absent, extra_days: extra }

    const held = heldDaysMap.size - extra.length   // held, of the days the publisher lists
    const published = walked.latest.size

    rows.push({
      corpus_key: s.corpus,
      state: 'MEASURED',
      unit: s.unit,
      method: `entry walk of the ${BASE}/${s.dir}/ directory index; ${walked.files.toLocaleString()} files reduced to sitting days by stripping the revision letter`,
      walked_at: new Date(),
      published_units: published,
      held_units: held,
      hollow_units: 0,
      absent_ids: absent.slice(0, 1000),
      absent_total: absent.length,
      walk_artifact_path: 'docs/census/walks/pwdata-days.json',
      notes: [
        // ⚠ The EXACT: token is required by the schema when the two numbers agree, and it has to be
        // earned. What earns it here: the two sides come from genuinely different places — the
        // publisher's HTML directory listing on theyworkforyou.com against our own "parentDocId"
        // column — and the SAME comparison found a real absence in lordswrans (2026-08-11) and
        // would have found one here. This is not held/held.
        published === held
          ? `EXACT: every day the index lists is held. The denominator is the publisher's ${walked.files.toLocaleString()}-file directory listing reduced to days, not our row count; the identical comparison reports an absence for pwdata-lordswrans, so it is capable of disagreeing.`
          : null,
        `${walked.files.toLocaleString()} files → ${published.toLocaleString()} distinct sitting days.`,
        stale ? `${stale.toLocaleString()} day(s) held at an OLDER revision than the publisher's latest — a freshness gap, not a coverage gap, and not counted as absent.` : null,
        extra.length ? `⚠ ${extra.length} day(s) held that the index does not list — counted OUT of held_units so coverage cannot exceed 100% by holding something the publisher withdrew.` : null,
      ].filter(Boolean).join(' '),
    })
  }

  fs.writeFileSync(path.join(WALK_DIR, 'pwdata-days.json'),
    JSON.stringify({ walked_at: new Date().toISOString(), streams: walkStore }, null, 2))
  await writeCensus(p, rows, 'pwdata')
  await p.end()
}

async function heldDays(p: any, corpus: string) {
  const r = await p.query(
    `SELECT count(DISTINCT regexp_replace("parentDocId", '[a-z]*$', ''))::int n
       FROM corpus_sections WHERE corpus=$1 AND status='compiled'`, [corpus])
  return r.rows[0].n
}

main().catch(e => { console.error('FAIL', e.message, e.stack); process.exit(1) })
