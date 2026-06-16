/** v26-fk-graph.ts — READ-ONLY. FK edges among the copy-set tables on Railway,
 * to derive a topological insert order for Migration B.2 (Neon forbids
 * session_replication_role). Flags self-references. */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const COPY = ['AIUsageLog','ActivityLog','CoherentAction','Comment','CredibilityScore','Diagnosis','Feedback',
  'Group','GuidingPolicy','Idea','IdeaLegislation','IdeaReview','Invite','Notification','OperationalDocument',
  'OperationalSection','PlatformConfig','PointsLedger','Reputation','Research','RootCause','StageTransition','User']

async function main() {
  const rail = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false }, max: 3,
    statement_timeout: 60_000, query_timeout: 60_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })
  const fks = await rail.query(`
    SELECT tc.table_name AS child, ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema='public'
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
    GROUP BY tc.table_name, ccu.table_name ORDER BY 1`)
  const set = new Set(COPY)
  console.log('=== FK edges (child → parent) within copy set ===')
  const edges: [string, string][] = []
  for (const r of fks.rows as any[]) {
    if (!set.has(r.child)) continue
    const tag = r.child === r.parent ? ' [SELF]' : (set.has(r.parent) ? '' : ' [parent OUTSIDE copy set]')
    console.log(`  ${r.child} → ${r.parent}${tag}`)
    if (set.has(r.parent)) edges.push([r.child, r.parent])
  }

  // topological sort (parents before children)
  const indeg = new Map<string, number>(COPY.map(t => [t, 0]))
  const parents = new Map<string, string[]>(COPY.map(t => [t, []]))
  for (const [child, parent] of edges) {
    if (child === parent) continue // self-ref handled separately
    parents.get(child)!.push(parent)
    indeg.set(child, (indeg.get(child) ?? 0) + 1)
  }
  const order: string[] = []
  const q = COPY.filter(t => (indeg.get(t) ?? 0) === 0)
  while (q.length) {
    const t = q.shift()!
    order.push(t)
    for (const [child, ps] of parents) {
      if (ps.includes(t)) {
        indeg.set(child, indeg.get(child)! - 1)
        if (indeg.get(child) === 0 && !order.includes(child) && !q.includes(child)) q.push(child)
      }
    }
  }
  console.log('\n=== topological insert order ===')
  console.log(order.join(' → '))
  console.log(order.length === COPY.length ? `✓ all ${COPY.length} ordered (no cycle)` : `⚠ CYCLE: only ${order.length}/${COPY.length} ordered; missing ${COPY.filter(t=>!order.includes(t)).join(',')}`)
  await rail.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
