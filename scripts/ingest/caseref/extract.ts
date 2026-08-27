/**
 * extract.ts — §1.1. Pull every case citation out of the collections we hold.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT PRODUCES
 * One row per DISTINCT CITATION — the identity, never a name (see `citations.ts` for why). Each
 * carries how many documents cite it, which collections they were in, the case names seen next to
 * it, and up to three verbatim sentences it appeared in.
 *
 * ⚠ THE SENTENCES ARE THE POINT OF §1.2. "Print twenty extracted citations in full alongside the
 * sentence they came from. If the parser is wrong, this is where it shows, not in a count."
 *
 * ── HOW BODIES ARE READ ────────────────────────────────────────────────────────────────────────
 * Ids are keyset-paginated out of Postgres; bodies come from `corpus_fts` in batches of 400 by
 * `id IN (…)`. That is the b3-backfill pattern and it is used because it is measured: reading ~1.6M
 * bodies from R2 individually is hours, and the index already holds them.
 *
 * ⚠ THE COLUMN NAME IN THE LANCE PREDICATE IS NOT QUOTED. `"id" IN (…)` parses, matches NOTHING and
 * raises nothing — the trap that nearly made a 168,569-row purge report success on 24 Aug. A batch
 * that returns zero bodies for a non-empty id list ABORTS rather than being counted as "no
 * citations here".
 *
 * ⚠⚠ WRITES THE AGGREGATE IN SHARDS, AND THE FIRST VERSION DID NOT — IT LOST A 36,000-DOCUMENT RUN.
 *
 * The first run of this file read 36,000 of 74,896 judgments, found 97,940 distinct citations, and
 * then died: `memory allocation of 1785264 bytes failed`. Every citation was in a Map in memory and
 * the JSONL was written once at the end, so **all of it was lost** — the exact defect this file's
 * own header warned about (`l2-measure.ts` lost a whole run to a single `writeFileSync`). Writing
 * the warning is not the same as obeying it.
 *
 * ⚠ It also exited with code **0**, because the Rust allocator aborts without setting a failure
 * status. A crash that reports success is worse than one that does not: `--resume` would have
 * carried on from the checkpoint and produced an aggregate covering only the tail, with nothing
 * saying the head was missing.
 *
 * So now: the aggregate is FLUSHED TO A SHARD every `FLUSH_EVERY` documents and the map is cleared,
 * which bounds memory and means a crash costs one shard. `merge-shards.ts` combines them.
 * The checkpoint is still written per batch.
 *
 * Usage:
 *   tsx caseref/extract.ts --pilot=400 --corpus=tna-caselaw     # measure the rate and the density
 *   tsx caseref/extract.ts --corpus=tna-caselaw                 # a whole collection
 *   tsx caseref/extract.ts --all                                # the dense collections, in order
 *   tsx caseref/extract.ts --all --resume
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from '../c2/db'
import { connectLance, FTS_TABLE } from '../search/lance'
import { extractCitations, nameBefore, sentenceAround } from './citations'

const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null
const PILOT = arg('pilot') ? parseInt(arg('pilot')!, 10) : null
const ONLY = arg('corpus')
const ALL = process.argv.includes('--all')
const RESUME = process.argv.includes('--resume')
/**
 * ⚠ 2,000, MEASURED, NOT CHOSEN. `corpus_fts` has no scalar index on `id`, so every `id IN (…)`
 * predicate is a full-table scan of 18.5M rows and the cost is PER PREDICATE, not per row:
 *
 *     batch   400 → 400 rows in 64.2s =  6 docs/s
 *     batch 2,000 → 2,000 rows in 62.0s = 32 docs/s
 *     batch 5,000 → OOM ("memory allocation of 2015184 bytes failed")
 *
 * ⚠ Lowered from 2,000 to 1,200 after the first full run died at 36,000 documents. The batch was
 * not the only cause — the unbounded aggregate was — but both were holding memory at once, and the
 * throughput difference between 1,200 and 2,000 is small next to a lost run.
 *
 * A median case-law body is ~37 KB, so 5,000 of them is ~185 MB of Arrow buffers in one go. 2,000
 * amortises the scan and stays inside memory; the ceiling is real and was hit, not guessed at.
 */
const BATCH = 1200
const n = (x: number) => x.toLocaleString('en-GB')
const esc = (s: string) => s.replace(/'/g, "''")

/**
 * The collections scanned in full, densest first.
 *
 * ⚠ `historic-hansard` (4.6M sections) and the `pwdata-*` family (~9M) are NOT here, and their
 * absence is a measured decision rather than an oversight — see `discussion.ts`. A full scan of
 * them at the rate this script measures is a multi-day job for a result the per-case targeted
 * lookup gets in seconds. They are searched per case, not scanned.
 */
const DENSE = [
  'tna-caselaw',        //  74,896 — judgments cite authorities constantly; the main source
  'lawcom',             //     263 — the Law Commission explains what a case held, at length
  'scotlawcom',         //     350
  'nao-reports',        //   3,983
  'explanatory-notes',  //  18,801
  'committees-reports', // 344,773 — the largest here; report the rate before committing to it
]

interface Agg {
  citation: string
  kind: string
  year: number
  series: string
  /** documents (not occurrences) that cite it */
  docs: number
  byCorpus: Record<string, number>
  /** case names seen immediately before it — VARIANTS, never an identity */
  names: Record<string, number>
  samples: Array<{ id: string; corpus: string; sentence: string; raw: string }>
}

const CKPT = path.join(__dirname, 'extract-checkpoint.json')
const JSONL = path.join(OUT, 'CASEREF_citations.jsonl')
const SHARD_DIR = path.join(OUT, 'caseref-shards')
/** documents between flushes — small enough that a crash is cheap, large enough that shards stay few */
const FLUSH_EVERY = 6000

async function main() {
  const corpora = ONLY ? [ONLY] : (ALL ? DENSE : ['tna-caselaw'])
  const p = pool()
  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  const ckpt: Record<string, string> = RESUME && fs.existsSync(CKPT) ? JSON.parse(fs.readFileSync(CKPT, 'utf8')) : {}
  const agg = new Map<string, Agg>()
  const malformed = new Map<string, { count: number; sample: string }>()

  const url = process.env.NEON_DATABASE_URL_NO_POOLED || process.env.NEON_DATABASE_URL || ''
  console.log(`host: ${url.replace(/^[^@]*@/, '').split('/')[0]}`)
  console.log(PILOT ? `PILOT — ${n(PILOT)} documents per collection\n` : `FULL RUN — ${corpora.join(', ')}\n`)

  const t0 = Date.now()
  let readTotal = 0, occurrences = 0
  let shard = 0
  fs.mkdirSync(SHARD_DIR, { recursive: true })

  /** Write what is held, then FORGET it. Both halves matter: the second is what bounds memory. */
  const flush = (why: string) => {
    if (agg.size === 0) return
    const f = path.join(SHARD_DIR, `part-${String(shard).padStart(3, '0')}.jsonl`)
    fs.writeFileSync(f, [...agg.values()].map((a) => JSON.stringify(a)).join('\n') + '\n')
    process.stdout.write(`\n   flushed ${n(agg.size)} citations → ${path.basename(f)}  (${why})\n`)
    agg.clear()
    shard++
  }

  for (const corpus of corpora) {
    let after = RESUME ? (ckpt[corpus] ?? '') : ''
    let readHere = 0
    // ⚠ An ESTIMATE, and labelled one: an exact count(*) over an 18.5M-row table costs ~30-60s per
    //   collection and buys a progress denominator, nothing else.
    const total = (await p.query(
      `SELECT reltuples::bigint AS n FROM pg_class WHERE relname = 'corpus_sections'`)).rows[0]?.n ?? 0
    const approx = (await p.query(
      `SELECT count(*)::int n FROM (SELECT 1 FROM corpus_sections WHERE corpus=$1 AND status='compiled' LIMIT 400000) t`, [corpus])).rows[0].n
    console.log(`── ${corpus}  (~${n(approx)} compiled${approx >= 400000 ? '+' : ''})${after ? `  resuming after ${after}` : ''}`)

    for (;;) {
      if (PILOT && readHere >= PILOT) break
      const want = PILOT ? Math.min(BATCH, PILOT - readHere) : BATCH
      const rows: Array<{ id: string }> = (await p.query(
        `SELECT id FROM corpus_sections WHERE corpus=$1 AND status='compiled' AND id > $2 ORDER BY id LIMIT $3`,
        [corpus, after, want])).rows
      if (!rows.length) break
      const ids = rows.map((r) => r.id)

      const bodies = await tbl.query()
        .where(`id IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`)
        .select(['id', 'corpus', 'body']).toArray() as Array<{ id: string; corpus: string; body: string }>

      // ⚠ A predicate that matches nothing must ABORT, not be read as "no citations here".
      if (bodies.length === 0) {
        console.log(`\n⛔ ABORT — ${n(ids.length)} ids requested from ${FTS_TABLE}, 0 rows returned.`)
        console.log(`   first id: ${ids[0]}`)
        console.log('   A zero match on a non-empty id list is the quoted-identifier trap, not an empty corpus.')
        process.exit(1)
      }

      for (const b of bodies) {
        const body = String(b.body ?? '')
        if (!body) continue
        readTotal++; readHere++
        const cites = extractCitations(body)
        const seenHere = new Set<string>()
        for (const c of cites) {
          occurrences++
          const key = c.normalised
          let a = agg.get(key)
          if (!a) {
            a = { citation: key, kind: c.kind, year: c.year, series: c.series, docs: 0, byCorpus: {}, names: {}, samples: [] }
            agg.set(key, a)
          }
          // ⚠ DOCUMENTS, not occurrences: a judgment that cites Donoghue nine times is one citing
          //   document. The user-facing number is "cited in N judgments", so count that.
          if (!seenHere.has(key)) {
            seenHere.add(key)
            a.docs++
            a.byCorpus[b.corpus] = (a.byCorpus[b.corpus] ?? 0) + 1
          }
          const nm = nameBefore(body, c.index)
          if (nm) a.names[nm] = (a.names[nm] ?? 0) + 1
          if (a.samples.length < 3) {
            a.samples.push({ id: b.id, corpus: b.corpus, raw: c.raw, sentence: sentenceAround(body, c.index, c.raw.length).slice(0, 400) })
          }
        }
      }

      after = ids[ids.length - 1]
      ckpt[corpus] = after
      fs.writeFileSync(CKPT, JSON.stringify(ckpt))        // written as decided, not at the end
      if (readTotal > 0 && readTotal % FLUSH_EVERY < BATCH) flush(`every ${n(FLUSH_EVERY)} documents`)
      const rate = readTotal / ((Date.now() - t0) / 1000)
      process.stdout.write(`\r   ${n(readHere)}/${n(PILOT ?? total)} docs · ${n(agg.size)} distinct citations · ${rate.toFixed(0)}/s   `)
    }
    process.stdout.write('\n')
  }

  const secs = (Date.now() - t0) / 1000
  console.log(`\n── ${n(readTotal)} documents read in ${secs.toFixed(0)}s (${(readTotal / secs).toFixed(0)}/s)`)
  console.log(`── ${n(occurrences)} citation occurrences · ${n(agg.size)} distinct citations`)

  if (PILOT) {
    const outPath = JSONL.replace('.jsonl', '.pilot.jsonl')
    fs.writeFileSync(outPath, [...agg.values()].map((a) => JSON.stringify(a)).join('\n') + '\n')
    console.log(`\nwritten: ${path.relative(process.cwd(), outPath)}`)
  } else {
    flush('end of run')
    console.log(`\n${n(shard)} shard(s) in docs/census/caseref-shards/`)
    console.log('── next: tsx caseref/merge-shards.ts   (a shard is a partial count; only the merge is the answer)')
  }
  await p.end()
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
