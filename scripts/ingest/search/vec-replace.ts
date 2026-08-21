/**
 * vec-replace.ts — RE-CUT AND RE-EMBED ONE COLLECTION, SAFELY. SEARCH S12 §1.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS. S11 refused the case-law re-embed because there was no REPLACE path: the only
 * two options were `build-vector-index.ts --reset` (re-embeds all 22.7M chunks — "a four-figure
 * mistake, not a slow one", in that file's own words) and `v33-vec-catchup.ts`, which is APPEND-only
 * and exists for sections that have no vector at all. Neither can say "this collection's text
 * changed; replace it".
 *
 * ── ⚠⚠ THE PREMISE THE BRIEF INHERITED IS WRONG, AND THE CORRECTION IS THE WHOLE DESIGN ─────────
 *
 * BRIEF_SEARCH_S12 §1 describes the problem as: *"Chunks are numbered in one continuous sequence
 * across the whole corpus … Re-cutting one collection changes how many chunks it has, which shifts
 * every number after it … Vectors simply start describing different text than the one they are
 * attached to."*
 *
 * **There is no global chunk numbering.** `vector-common.ts` line 53:
 *
 *     export function chunkId(sectionId: string, k: number): string { return `${sectionId}#${k}` }
 *
 * A chunk id is CONTENT-ADDRESSED — the section's own id plus its ordinal *within that section* —
 * and every read and write in the pipeline keys off it:
 *
 *     build-vector-index.ts:158   .where(`chunkId >= '…lo' AND chunkId <= '…hi'`)   ← fetch
 *     build-vector-index.ts:176   vecTbl.delete(`chunkId >= '…lo' AND chunkId <= '…hi'`) ← write
 *
 * So a vector cannot become attached to another passage by re-cutting a different collection. What
 * IS global is the SHARD PLAN: `build-vector-index.ts:140` slices the sorted id list by ORDINAL
 * position (`plannedIds.slice(i, i + SHARD_SIZE)`) and the checkpoint records only the shard
 * INDEX (`doneShards: number[]`). Change any count and index 417 denotes a different range than it
 * did — so a RESUME against a stale checkpoint skips ranges and re-does others. That is a coverage
 * fault, not a mislabelling one, and it is confined to resumes.
 *
 * ── AND THE BLAST RADIUS IS 0.31%, MEASURED ─────────────────────────────────────────────────────
 * `tna-caselaw` sorts 69th of 74 collections. Chunks whose ordinal position would move at all:
 * `uk-treaties` 12,543 + `uk-treaties-fcdo` 56,215 + `written-answers` 1,138 +
 * `written-statements` 994 = **70,890 of 22,689,587 — 0.31%, two shards of 568.**
 *
 * ── SO WHAT ACTUALLY GOES WRONG, AND WHAT THIS TOOL GUARDS ──────────────────────────────────────
 *
 *   R1 ⚠⚠ ORPHAN VECTORS — the real "wrong passage" risk. Re-cutting usually yields FEWER chunks
 *      (removing a stylesheet shortens a document), so `…#6` and `…#7` survive in `corpus_vec` with
 *      no chunk behind them. `vector-query-service.ts:229` returns hits keyed by **sectionId** and
 *      hydrates the snippet from the section's FIRST chunk, so an orphan does not display someone
 *      else's text — it makes a section retrievable because of a passage it no longer contains.
 *      A stale relevance signal that no count would reveal. **Guard G1, over the whole population.**
 *   R2 STALE-CHECKPOINT RESUME (above). Avoided by construction: this tool has its own checkpoint,
 *      keyed per corpus, and never reads or writes the global one.
 *   R3 RE-CHUNK WITHOUT RE-EMBED — same chunkId, new text, old vector. This is the brief's "both
 *      halves or neither", and it is the one failure that really does make a vector describe text
 *      it is not attached to. **Guard G2 catches it, and §1 requires watching it fail: run
 *      `--chunk` alone and G1/G2 MUST go red before `--embed` turns them green.**
 *
 * ── THE THREE DESIGNS CONSIDERED (§1 asks for the alternatives and why they lost) ───────────────
 *   A. *Stable per-collection chunk identifiers.* **Already true** — see above. £0, and nothing to
 *      build; the option only looked necessary because of the global-numbering premise.
 *   B. *Recompute shard boundaries from the table.* Store `lo`/`hi` in the checkpoint instead of the
 *      ordinal index, so a resume is correct whatever the counts. Correct and cheap, but it edits
 *      the full-rebuild path — the most expensive script in the repo to get wrong — to fix a resume
 *      hazard this tool does not create. Recommended as a follow-up, NOT ridden along here.
 *   C. *A collection-scoped replace that never consults the global plan.* ← **CHOSEN.** Same shape
 *      as S11's `fts-refresh.ts` on the keyword side: bounded blast radius, its own checkpoint, no
 *      change to the fragile path, and it prices itself before spending.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────────────────────────
 *   npx tsx search/vec-replace.ts --corpus=inquiry-evidence --plan      # price it; no writes
 *   npx tsx search/vec-replace.ts --corpus=inquiry-evidence --chunk     # re-cut only (NO spend)
 *   npx tsx search/vec-replace.ts --corpus=inquiry-evidence --embed --max-cost 1
 *   npx tsx search/vec-replace.ts --corpus=X --verify                   # guards only, no writes
 * ⚠ Nothing spends until `--embed`. `--max-cost` stops cleanly BEFORE the shard that would cross it.
 * ⚠ After `--embed`, the new vectors are un-indexed and brute-force scanned until the `vector-index`
 *   heavy job runs on the rented box. Never on the serving host (docs/CLAUDE.md §17).
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance } from './lance'
import {
  CHUNKS_TABLE, VEC_TABLE, VECTOR_DIMS, VECTOR_MODEL, SHARD_SIZE, EMBED_MODE,
  chunkId as mkChunkId, estTokens,
} from './vector-common'
import { chunkBody } from './chunk'
import { tierFor } from './corpus-map'
import { gidFromId, buildCitation, applyCitationToBody } from './citation'
import { embedShardViaBatch, ChunkForEmbed } from './gemini-batch'
import { embedShardViaSync } from './gemini-sync'
import { r2Get, r2Put } from '../shared/r2-client'

const ARGS = process.argv.slice(2)
const arg = (k: string) => ARGS.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const argN = (k: string, d: number) => { const v = arg(k); return v === undefined ? d : parseFloat(v) }
const CORPUS = arg('corpus') ?? ''
const PLAN = ARGS.includes('--plan')
const DO_CHUNK = ARGS.includes('--chunk')
const DO_EMBED = ARGS.includes('--embed')
const VERIFY_ONLY = ARGS.includes('--verify')
const MAX_COST = argN('max-cost', Infinity)
const RATE = parseFloat(process.env.EMBED_RATE_PER_M ?? '0.075')
const R2_CONCURRENCY = parseInt(process.env.FTS_R2_CONCURRENCY ?? '24', 10)
const RETRIES = parseInt(process.env.VECTOR_SHARD_RETRIES ?? '3', 10)
const CHUNK_BATCH = parseInt(process.env.VEC_REPLACE_CHUNK_BATCH ?? '1000', 10)

const n = (v: number) => Number(v).toLocaleString('en-GB')
const esc = (s: string) => s.replace(/'/g, "''")
const CKPT_KEY = () => `_search/vec-replace.${CORPUS}.checkpoint.json`

type Ckpt = {
  corpus: string
  phase: 'chunking' | 'embedding' | 'done'
  chunkCursor: string
  chunksWritten: number
  bodyMisses: number
  doneShards: number[]
  attemptedShards: number[]
  vectors: number
  misses: number
  spentUsd: number
  updatedAt: string
}
const FRESH = (): Ckpt => ({
  corpus: CORPUS, phase: 'chunking', chunkCursor: '', chunksWritten: 0, bodyMisses: 0,
  doneShards: [], attemptedShards: [], vectors: 0, misses: 0, spentUsd: 0, updatedAt: '',
})

async function loadCkpt(): Promise<Ckpt> {
  try {
    const raw = await r2Get(CKPT_KEY())
    if (!raw) return FRESH()
    const c = JSON.parse(raw) as Ckpt
    // A checkpoint from another collection would drive deletes against the wrong rows.
    if (c.corpus !== CORPUS) throw new Error(`checkpoint is for '${c.corpus}', not '${CORPUS}'`)
    return c
  } catch (e) {
    if (String(e).includes('checkpoint is for')) throw e
    return FRESH()
  }
}
async function saveCkpt(c: Ckpt) {
  c.updatedAt = new Date().toISOString()
  await r2Put(CKPT_KEY(), JSON.stringify(c, null, 2), 'application/json')
}

async function mapPool<T, R>(items: T[], k: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length); let i = 0
  await Promise.all(Array.from({ length: Math.min(k, items.length) }, async () => {
    for (;;) { const j = i++; if (j >= items.length) return; out[j] = await fn(items[j], j) }
  }))
  return out
}

/**
 * ⚠⚠ THE GUARDS, AND THEY RUN OVER THE WHOLE POPULATION — S12 §6.
 *
 * Three sprints running produced a check that could not fail because a ranking harness looked only
 * at the top N while the counter-examples sat below the cut. So: every assertion below scans EVERY
 * row of the collection in both tables, and the printed line states the population it covered.
 * There is no `limit` anywhere in this function; if one is ever added it must be printed.
 */
async function guards(corpus: string): Promise<{ ok: boolean; lines: string[] }> {
  const db = await connectLance()
  const chunksTbl = await db.openTable(CHUNKS_TABLE)
  const vecTbl = await db.openTable(VEC_TABLE)

  const chunkIds = new Set<string>()
  for await (const b of chunksTbl.query().where(`corpus = '${esc(corpus)}'`).select(['chunkId']) as any) {
    const c = b.getChild('chunkId')
    for (let i = 0; i < b.numRows; i++) chunkIds.add(String(c.get(i)))
  }
  const vecIds = new Set<string>()
  for await (const b of vecTbl.query().where(`corpus = '${esc(corpus)}'`).select(['chunkId']) as any) {
    const c = b.getChild('chunkId')
    for (let i = 0; i < b.numRows; i++) vecIds.add(String(c.get(i)))
  }

  // G1 — a vector with no chunk behind it. The stale-relevance failure (R1).
  const orphans: string[] = []
  for (const id of vecIds) if (!chunkIds.has(id)) orphans.push(id)
  // G2 — a chunk with no vector. The un-embedded half (R3).
  const unembedded: string[] = []
  for (const id of chunkIds) if (!vecIds.has(id)) unembedded.push(id)

  const lines = [
    `  population scanned: ${n(chunkIds.size)} chunks · ${n(vecIds.size)} vectors (ALL rows of '${corpus}', no limit applied)`,
    `  G1 orphan vectors (vector with no chunk):   ${orphans.length === 0 ? '0  ✅' : `${n(orphans.length)}  ❌  e.g. ${orphans.slice(0, 3).join(', ')}`}`,
    `  G2 un-embedded chunks (chunk with no vec):  ${unembedded.length === 0 ? '0  ✅' : `${n(unembedded.length)}  ❌  e.g. ${unembedded.slice(0, 3).join(', ')}`}`,
    `  G3 counts equal:                            ${chunkIds.size === vecIds.size ? `${n(chunkIds.size)} = ${n(vecIds.size)}  ✅` : `${n(chunkIds.size)} vs ${n(vecIds.size)}  ❌`}`,
  ]
  return { ok: orphans.length === 0 && unembedded.length === 0 && chunkIds.size === vecIds.size, lines }
}

async function main() {
  if (!CORPUS) { console.error('--corpus=<name> is required'); process.exit(2) }

  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false },
    max: 4, statement_timeout: 900_000, keepAlive: true,
  })
  const db = await connectLance()
  const chunksTbl = await db.openTable(CHUNKS_TABLE)
  const vecTbl = await db.openTable(VEC_TABLE)

  console.log('═'.repeat(104))
  console.log(`VEC-REPLACE — re-cut and re-embed '${CORPUS}'`)
  console.log('═'.repeat(104))

  if (VERIFY_ONLY) {
    const g = await guards(CORPUS)
    g.lines.forEach((l) => console.log(l))
    await pool.end()
    process.exit(g.ok ? 0 : 1)
  }

  // ⚠ `--reset` discards the checkpoint. Needed because a completed run leaves `doneShards`
  // populated, and a second run would then skip both the vector delete and every shard — which
  // would look like a fast success and leave the old vectors in place. Reset is explicit rather
  // than automatic: silently discarding a checkpoint is how a resumable job becomes a re-payer.
  const cp = ARGS.includes('--reset') ? FRESH() : await loadCkpt()
  if (ARGS.includes('--reset')) console.log('  ⚠ --reset: checkpoint discarded, this run starts from scratch')

  // ── the work list: every compiled section of this collection ───────────────────────────────
  const { rows: sections } = await pool.query<{ id: string; sectionTitle: string | null; r2Key: string | null }>(
    `SELECT id, "sectionTitle", "r2Key" FROM corpus_sections
      WHERE corpus = $1 AND status = 'compiled' ORDER BY id`, [CORPUS])
  const before = {
    chunks: (await chunksTbl.query().where(`corpus = '${esc(CORPUS)}'`).select(['chunkId']).toArray()).length,
    vecs: (await vecTbl.query().where(`corpus = '${esc(CORPUS)}'`).select(['chunkId']).toArray()).length,
  }
  console.log(`  sections (compiled): ${n(sections.length)}`)
  console.log(`  currently indexed:   ${n(before.chunks)} chunks · ${n(before.vecs)} vectors`)
  console.log(`  checkpoint:          phase=${cp.phase} chunks=${n(cp.chunksWritten)} shards=${cp.doneShards.length} spent=$${cp.spentUsd.toFixed(4)}`)

  const titles = new Map<string, string>()
  if (tierFor(CORPUS) === 'legislation') {
    const { rows } = await pool.query<{ gid: string; title: string }>(
      `SELECT gid, title FROM corpus_acts WHERE gid IS NOT NULL AND title IS NOT NULL`)
    for (const r of rows) titles.set(r.gid, r.title)
    console.log(`  act titles loaded:   ${n(titles.size)} (legislation tier — the citation rewrite must match build-corpus-chunks)`)
  }

  // ⚠⚠ REFUSE THE ONE COMBINATION THAT RE-CREATES R2. A checkpoint with completed shards describes
  // shard boundaries derived from the CURRENT chunk list. Re-cutting underneath it can change the
  // chunk count, after which shard index 7 no longer denotes the range it denoted when it was
  // marked done — so the resume would skip ranges that were never embedded and re-pay for others.
  // That is precisely the stale-checkpoint hazard §1 identified in `build-vector-index.ts`, and it
  // would be perverse for the tool written to avoid it to expose the same trap through a flag
  // combination. Documenting "don't pass --chunk on a resume" is not a guard; refusing is.
  if (DO_CHUNK && !PLAN && cp.doneShards.length > 0 && !ARGS.includes('--reset')) {
    console.error(
      `\n❌ REFUSING: the checkpoint has ${cp.doneShards.length} completed shard(s), and --chunk would ` +
      `re-cut the collection underneath them.\n` +
      `   Shard boundaries are derived from the chunk list; changing it invalidates every ` +
      `completed shard index.\n` +
      `   → to RESUME the embed:      --embed            (no --chunk, no --reset)\n` +
      `   → to START AGAIN from zero: --chunk --embed --reset   (⚠ re-embeds everything, at full price)`)
    await pool.end()
    process.exit(3)
  }

  // ── PHASE 1 — re-cut ───────────────────────────────────────────────────────────────────────
  if (DO_CHUNK || PLAN) {
    console.log(`\n── PHASE 1: re-cut ${PLAN ? '(PLAN — no writes)' : ''} ──`)
    let written = 0, misses = 0, estChars = 0

    if (!PLAN) {
      // ⚠ ONE delete for the whole collection, BEFORE any append, and only after the section list
      // is in hand. Deleting per batch would leave the collection half-old/half-new if the run
      // died in the middle — a state neither guard could describe.
      const t0 = Date.now()
      await chunksTbl.delete(`corpus = '${esc(CORPUS)}'`)
      console.log(`  deleted ${n(before.chunks)} existing chunks in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }

    for (let i = 0; i < sections.length; i += CHUNK_BATCH) {
      const slice = sections.slice(i, i + CHUNK_BATCH)
      const records: Array<{ chunkId: string; sectionId: string; corpus: string; tier: string; sectionTitle: string; body: string }> = []
      await mapPool(slice, R2_CONCURRENCY, async (s) => {
        if (!s.r2Key) { misses++; return }
        const raw = await r2Get(s.r2Key)
        if (!raw) { misses++; return }
        // Byte-identical enrichment to build-corpus-chunks.ts / v33-vec-catchup.ts, so a chunk's
        // text matches what BM25 indexes. Diverging here would make the hybrid unfair silently.
        let body = raw
        let title = s.sectionTitle ?? ''
        const gid = gidFromId(s.id)
        const cit = gid ? buildCitation(s.id, titles.get(gid) ?? null, s.sectionTitle) : null
        if (cit) { body = applyCitationToBody(cit.bodyHeader, raw); title = cit.sectionTitle }
        const parts = chunkBody(body)
        parts.forEach((text, k) => {
          estChars += text.length
          records.push({
            chunkId: mkChunkId(s.id, k), sectionId: s.id, corpus: CORPUS,
            tier: tierFor(CORPUS), sectionTitle: title, body: text,
          })
        })
      })
      if (!PLAN && records.length) {
        let lastErr: unknown
        for (let a = 0; a < RETRIES; a++) {
          try { await chunksTbl.add(records); lastErr = null; break } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 2000 * (a + 1))) }
        }
        if (lastErr) throw lastErr
      }
      written += records.length
      process.stdout.write(`\r  ${n(Math.min(i + CHUNK_BATCH, sections.length))}/${n(sections.length)} sections → ${n(written)} chunks   `)
    }
    console.log('')
    const tokens = Math.ceil(estChars / 4)
    const cost = tokens / 1_000_000 * RATE
    console.log(`  ${PLAN ? 'would write' : 'wrote'} ${n(written)} chunks (was ${n(before.chunks)}, ${written < before.chunks ? '−' : '+'}${n(Math.abs(written - before.chunks))})`)
    console.log(`  body misses: ${n(misses)}`)
    console.log(`  embed estimate: ~${n(tokens)} tokens ≈ $${cost.toFixed(2)} at $${RATE}/M`)

    if (PLAN) {
      console.log('\n  PLAN ONLY — nothing written, nothing spent.')
      await pool.end(); process.exit(0)
    }
    cp.phase = 'embedding'; cp.chunksWritten = written; cp.bodyMisses = misses
    await saveCkpt(cp)

    // ⚠ THE GUARDS ARE RUN HERE ON PURPOSE AND ARE EXPECTED TO FAIL. After a re-cut and before an
    // embed, the collection is in exactly the state the brief calls "worse than doing nothing".
    // Printing it red is how we know the guard works on the REAL broken state rather than a
    // planted one (§6).
    console.log('\n  ── guards immediately after the re-cut (EXPECTED RED — this is R3, mid-flight) ──')
    const g = await guards(CORPUS)
    g.lines.forEach((l) => console.log(l))
    if (g.ok) console.log('  ⚠⚠ THE GUARDS PASSED HERE AND THEY SHOULD NOT HAVE. Either the re-cut produced ' +
      'byte-identical chunk counts, or the guard is not measuring what it claims. Investigate before embedding.')
  }

  // ── PHASE 2 — embed ────────────────────────────────────────────────────────────────────────
  if (DO_EMBED) {
    console.log('\n── PHASE 2: embed ──')
    const rows = await chunksTbl.query().where(`corpus = '${esc(CORPUS)}'`)
      .select(['chunkId', 'sectionId', 'corpus', 'tier', 'body']).toArray() as any[]
    rows.sort((a, b) => (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0))
    console.log(`  ${n(rows.length)} chunks to embed, shard=${SHARD_SIZE}, mode=${EMBED_MODE}, model=${VECTOR_MODEL}`)

    const shards: Array<{ i: number; rows: any[]; lo: string; hi: string }> = []
    for (let i = 0, s = 0; i < rows.length; i += SHARD_SIZE, s++) {
      const slice = rows.slice(i, i + SHARD_SIZE)
      shards.push({ i: s, rows: slice, lo: slice[0].chunkId, hi: slice[slice.length - 1].chunkId })
    }

    // ⚠⚠ THE COLLECTION'S VECTORS ARE **NOT** DELETED UP FRONT, AND THE FIRST VERSION OF THIS FILE
    // DID EXACTLY THAT. One `delete corpus='tna-caselaw'` before the first shard would leave case
    // law with NO vectors at all for however long the embed takes — hours, for 539,454 chunks —
    // and "the serving process holds its table from boot so nobody would notice" is an accident of
    // the reader, not a property of the writer. S11 made that argument about `fts-serve` and then
    // watched `fts-serve` restart itself mid-sprint.
    //
    // Instead each shard deletes its OWN contiguous chunkId range immediately before adding it, so
    // at most one shard's worth is absent at any instant — the same trade `refresh-fts-caselaw.ts`
    // made on the keyword side, for the same reason.
    //
    // ⚠ Range deletes alone are NOT sufficient, and this is the subtle part. The ranges are derived
    // from the NEW chunk list, so an old id ABOVE the largest new id survives every range — and
    // that is precisely the common case, because re-cutting a shortened document leaves a trailing
    // `…#6`/`…#7`. Those are swept explicitly after the shards, by id, from the guard's own orphan
    // set. A blanket `delete corpus=…` at the end would delete everything just written.

    for (const s of shards) {
      if (cp.doneShards.includes(s.i)) { console.log(`  shard ${s.i} already done — skipped`); continue }
      const tokens = s.rows.reduce((t, r) => t + estTokens(r.body ?? ''), 0)
      const cost = tokens / 1_000_000 * RATE
      if (cp.spentUsd + cost > MAX_COST) {
        console.log(`  ⛔ stopping before shard ${s.i}: $${(cp.spentUsd + cost).toFixed(4)} would exceed --max-cost ${MAX_COST}`)
        break
      }
      const tag = `${CORPUS}-shard-${s.i}`
      cp.attemptedShards.push(s.i); await saveCkpt(cp)
      const chunks: ChunkForEmbed[] = s.rows.map((r) => ({ chunkId: r.chunkId, body: r.body }))
      let vecs: Array<number[] | null> = []
      let lastErr: unknown
      for (let a = 0; a < RETRIES; a++) {
        try { vecs = EMBED_MODE === 'sync' ? await embedShardViaSync(chunks, tag) : await embedShardViaBatch(chunks, tag); lastErr = null; break }
        catch (e) { lastErr = e; console.warn(`  shard ${s.i} attempt ${a + 1} failed: ${(e as Error).message}`); await new Promise((r) => setTimeout(r, 5000 * (a + 1))) }
      }
      if (lastErr) throw lastErr

      const records: any[] = []
      let miss = 0
      s.rows.forEach((r, k) => {
        const v = vecs[k]
        if (v && v.length === VECTOR_DIMS) records.push({ chunkId: r.chunkId, sectionId: r.sectionId, corpus: r.corpus, tier: r.tier, vector: v })
        else miss++
      })
      // delete-then-add, scoped to this shard's own range (see the note above)
      await vecTbl.delete(`chunkId >= '${esc(s.lo)}' AND chunkId <= '${esc(s.hi)}'`)
      if (records.length) await vecTbl.add(records)
      cp.doneShards.push(s.i); cp.vectors += records.length; cp.misses += miss; cp.spentUsd += cost
      await saveCkpt(cp)
      console.log(`  shard ${s.i}/${shards.length - 1}: ${n(records.length)} vectors, ${miss} miss, $${cost.toFixed(4)} (total $${cp.spentUsd.toFixed(4)})`)
    }

    // ── the orphan sweep: old ids that no range covered ────────────────────────────────────
    if (cp.doneShards.length === shards.length) {
      const chunkIds = new Set(rows.map((r) => r.chunkId as string))
      const orphans: string[] = []
      for await (const b of vecTbl.query().where(`corpus = '${esc(CORPUS)}'`).select(['chunkId']) as any) {
        const c = b.getChild('chunkId')
        for (let i = 0; i < b.numRows; i++) { const id = String(c.get(i)); if (!chunkIds.has(id)) orphans.push(id) }
      }
      if (orphans.length) {
        console.log(`  sweeping ${n(orphans.length)} orphan vectors (old chunk ids the new cut no longer produces)`)
        for (let i = 0; i < orphans.length; i += 2000) {
          const list = orphans.slice(i, i + 2000).map((o) => `'${esc(o)}'`).join(',')
          await vecTbl.delete(`chunkId IN (${list})`)
        }
      } else console.log('  no orphan vectors to sweep')
      cp.phase = 'done'
    }
    await saveCkpt(cp)
  }

  // ── the guards, for real this time ─────────────────────────────────────────────────────────
  console.log('\n── guards ──')
  const g = await guards(CORPUS)
  g.lines.forEach((l) => console.log(l))
  console.log(`\n  spend this run: $${cp.spentUsd.toFixed(4)}`)
  if (DO_EMBED) {
    console.log('\n  ▶ STILL OUTSTANDING, AND NEITHER IS OPTIONAL:')
    console.log('      1. `vector-index` heavy job on the rented box — the new vectors are un-indexed')
    console.log('         and brute-force scanned until it runs. NEVER on the serving host.')
    console.log('      2. Confirm `vector-serve` picks up the new table (it opens both tables once at boot).')
  }

  await pool.end()
  process.exit(g.ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
