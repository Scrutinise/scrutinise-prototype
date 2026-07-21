/**
 * v31-seed-parliament-treaties.ts — TREATY_INGEST_BRIEF.md STEP 2: Parliament
 * Treaty Tracker (CRaG 2010 scrutiny layer).
 *
 * Model decision (brief left this as CC's call): NEW corpus `parliament-treaties`,
 * not an enrichment on uk-treaties-fcdo. Reasoning — (a) different id space
 * (Parliament's own opaque ids vs FCDO's numeric lb_document_id, no shared key
 * to join on), (b) different content kind: this is CRaG scrutiny PROCEDURE
 * (laid dates, committee sessions, debate status), not treaty legal text, and
 * (c) matches the codebase's existing convention of parliamentary-procedure
 * APIs (bills-api, division-votes, committees-api, erskine-may) always living
 * as their own corpus even when they relate to legal-text corpora elsewhere.
 *
 * Small universe (328, verified live 8 Jul 2026 — Take=1000 returns all in one
 * page) — seed is a straight full enumeration, no dedup needed (nothing else
 * in the corpus holds this scrutiny-procedure data).
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listAllTreaties } from './sources/parliament-treaties'

const CORPUS = 'parliament-treaties'
const PRIORITY = 2   // small, fast, on-mission — ahead of the bulk FCDO P3 backlog

async function main() {
  const pool = getNeonPool()

  console.log('[v31-parliament-treaties] fetching full Treaty list...')
  const treaties = await listAllTreaties()
  console.log(`[v31-parliament-treaties] ${treaties.length} treaties`)

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, blocked_reason)
    VALUES ($1, $2, $3, true, $4, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE
      SET display_label = EXCLUDED.display_label, est_sections = EXCLUDED.est_sections,
          priority = EXCLUDED.priority, blocked = false, blocked_reason = NULL
  `, [CORPUS, 'Parliament Treaty Tracker (CRaG 2010 scrutiny register)', treaties.length, PRIORITY])

  const rows = treaties.map(t => ({
    id: `${CORPUS}:${t.id}`, corpus: CORPUS, docId: t.id, sourceType: 'parliament-treaties', priority: PRIORITY,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[v31-parliament-treaties] ${CORPUS}: ${affected} queue rows seeded (P${PRIORITY})`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
