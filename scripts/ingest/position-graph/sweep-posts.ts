/**
 * sweep-posts.ts — BRIEF_GRAPH_2D4 §2.1: a tenure source that actually states tenure.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS SOURCE AND NOT THE ONE 2D-3 TRIED
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 2D-3 attempted office-by-date against `graph_member_name`, and it failed for a reason worth
 * keeping in front of the reader: those windows record **when a NAME FORM was carried, not when an
 * OFFICE was held.** One surface of 6,512 qualified as an office and it scored 63.8% against ground
 * truth — 17 wrong people. The mechanism was sound; the source was the wrong table.
 *
 * `members-api.parliament.uk/api/Members/{id}/Biography` carries `governmentPosts`,
 * `oppositionPosts` and `otherPosts`, each with a **name, a startDate and an endDate**. VERIFIED
 * LIVE before this was written (17 Aug 2026), per the brief's instruction not to design on an
 * assumed feed:
 *
 *     MNIS 1423  governmentPosts  "Prime Minister, First Lord of the Treasury, Minister for the
 *                                  Civil Service"   2019-07-24 -> 2022-09-06
 *                                 "Secretary of State for Foreign and Commonwealth Affairs"
 *                                                   2016-07-13 -> 2018-07-09
 *
 * ⚠ There is NO bulk endpoint — `Reference/Posts` and friends all 404 — so this is one request per
 * member over the 5,234 in `graph_member_register`. Paced, cached to the database, and resumable.
 *
 * ⚠ AND IT IS STILL NOT A STABLE KEY. A post plus a date identifies a person because the register
 * asserts the succession, which is stronger than a name match and weaker than an id. It gets its
 * own `key_source` of `office-by-date` at its own confidence, per the brief.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/sweep-posts.ts --self-test
 *   npx tsx position-graph/sweep-posts.ts --setup           # DDL only
 *   npx tsx position-graph/sweep-posts.ts --fetch [--limit N]
 *   npx tsx position-graph/sweep-posts.ts --build           # offices from the fetched posts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }
const RUN_ID = process.env.GRAPH_2D4_RUN_ID ?? 'posts-2d4'
const API = 'https://members-api.parliament.uk/api'
const CONCURRENCY = num('concurrency', 6)

const DDL = `
CREATE TABLE IF NOT EXISTS graph_member_post (
  mnis_id     INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('government', 'opposition', 'other')),
  post_name   TEXT NOT NULL,
  post_norm   TEXT NOT NULL,
  start_date  DATE,
  end_date    DATE,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mnis_id, kind, post_name, start_date)
);
CREATE INDEX IF NOT EXISTS graph_member_post_norm_idx ON graph_member_post (post_norm);
CREATE TABLE IF NOT EXISTS graph_member_post_fetch (
  mnis_id    INTEGER PRIMARY KEY,
  posts      INTEGER NOT NULL,
  status     TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`

/**
 * The office key. Deliberately light: case and punctuation only.
 *
 * ⚠ NO TITLE STRIPPING, EVER. The brief's rule, and 2D-2 recovered 97 peers by keeping titles:
 * "Lord Sharma" and "Mr Virendra Sharma" both reduce to `sharma` under an honorific-stripping
 * normaliser and they are two people who agree on 5.4% of 868 divisions. A post name is the same:
 * "Minister of State" and "Minister of State (Minister for Care)" are different posts and must not
 * be folded together.
 */
export function normPost(s: string): string {
  return s.normalize('NFKC').toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim()
}

export const iso = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null
  const d = v.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

interface Post { kind: 'government' | 'opposition' | 'other'; name: string; start: string | null; end: string | null }

export function parseBiography(value: any): Post[] {
  const out: Post[] = []
  const map: Array<['government' | 'opposition' | 'other', string]> = [
    ['government', 'governmentPosts'], ['opposition', 'oppositionPosts'], ['other', 'otherPosts'],
  ]
  for (const [kind, field] of map) {
    for (const p of (value?.[field] ?? []) as any[]) {
      const name = typeof p?.name === 'string' ? p.name.trim() : ''
      if (!name) continue
      out.push({ kind, name, start: iso(p?.startDate), end: iso(p?.endDate) })
    }
  }
  return out
}

async function fetchOne(mnis: number): Promise<{ posts: Post[]; status: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}/Members/${mnis}/Biography`, {
        headers: { accept: 'application/json', 'user-agent': 'scrutinise-ingest/1.0 (+https://scrutinise.org)' },
      })
      if (res.status === 404) return { posts: [], status: 'not-found' }
      if (!res.ok) {
        if (attempt < 3) { await sleep(1500 * 2 ** attempt); continue }
        return { posts: [], status: `http-${res.status}` }
      }
      const j = await res.json() as { value?: any }
      return { posts: parseBiography(j?.value), status: 'ok' }
    } catch (e) {
      if (attempt < 3) { await sleep(1500 * 2 ** attempt); continue }
      return { posts: [], status: `error:${(e as Error).message.slice(0, 40)}` }
    }
  }
  return { posts: [], status: 'exhausted' }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function setup(pool: ReturnType<typeof getNeonPool>) {
  for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st)
  console.log('  DDL applied (graph_member_post, graph_member_post_fetch)')
}

async function fetchAll(pool: ReturnType<typeof getNeonPool>) {
  await setup(pool)
  const limit = num('limit', 0)
  const { rows } = await pool.query<{ mnis_id: number }>(`
    SELECT r.mnis_id FROM graph_member_register r
    WHERE NOT EXISTS (SELECT 1 FROM graph_member_post_fetch f WHERE f.mnis_id = r.mnis_id)
    ORDER BY r.mnis_id ${limit ? `LIMIT ${limit}` : ''}`)
  console.log(`\n════ FETCH — ${rows.length} members still to fetch ════`)
  if (!rows.length) return

  const t0 = Date.now()
  let done = 0
  let posts = 0
  const statuses: Record<string, number> = {}
  let i = 0
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
    while (true) {
      const j = i++
      if (j >= rows.length) return
      const mnis = rows[j].mnis_id
      const { posts: ps, status } = await fetchOne(mnis)
      statuses[status] = (statuses[status] ?? 0) + 1
      if (ps.length) {
        const vals: string[] = []
        const params: unknown[] = []
        for (const p of ps) {
          const b = params.length
          vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`)
          params.push(mnis, p.kind, p.name, normPost(p.name), p.start, p.end)
        }
        await pool.query(
          `INSERT INTO graph_member_post (mnis_id, kind, post_name, post_norm, start_date, end_date)
           VALUES ${vals.join(',')} ON CONFLICT DO NOTHING`, params)
      }
      await pool.query(
        `INSERT INTO graph_member_post_fetch (mnis_id, posts, status) VALUES ($1,$2,$3)
         ON CONFLICT (mnis_id) DO UPDATE SET posts=EXCLUDED.posts, status=EXCLUDED.status, fetched_at=now()`,
        [mnis, ps.length, status])
      posts += ps.length
      done++
      if (done % 250 === 0) {
        const rate = done / ((Date.now() - t0) / 1000)
        console.log(`  … ${done}/${rows.length} · ${posts} posts · ${rate.toFixed(1)}/s · eta ${Math.round((rows.length - done) / rate / 60)} min`)
      }
    }
  }))
  console.log(`\n  ${done} members fetched, ${posts} posts stored`)
  console.log(`  statuses: ${Object.entries(statuses).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
}

function selftest() {
  const bio = {
    governmentPosts: [
      { name: 'Secretary of State for Foreign and Commonwealth Affairs', startDate: '2016-07-13T00:00:00', endDate: '2018-07-09T00:00:00' },
      { name: '  ', startDate: '2000-01-01' },
    ],
    oppositionPosts: [{ name: 'Shadow Minister (Business)', startDate: '2005-12-09T00:00:00', endDate: null }],
    otherPosts: [{ name: 'Leader of the Conservative Party', startDate: '2019-07-23', endDate: '2022-09-05' }],
  }
  const posts = parseBiography(bio)
  const cases: Array<[string, boolean]> = [
    ['all three post kinds are read', new Set(posts.map((p) => p.kind)).size === 3],
    ['a blank post name is skipped', posts.length === 3],
    ['a timestamp is reduced to a date', posts[0].start === '2016-07-13'],
    ['a null endDate stays null (still in post)', posts.find((p) => p.kind === 'opposition')!.end === null],
    ['a malformed date becomes null', iso('not-a-date') === null],
    ['⚠ a title is NOT stripped from a post name',
      normPost('Minister of State (Minister for Care)') !== normPost('Minister of State')],
    ['case and trailing punctuation are normalised',
      normPost('Prime Minister.') === normPost('prime minister')],
    ['⚠ two different Secretaries of State do not collapse',
      normPost('Secretary of State for Health') !== normPost('Secretary of State for Defence')],
    ['an empty biography yields nothing', parseBiography({}).length === 0],
    ['a null biography yields nothing', parseBiography(null).length === 0],
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
    if (flag('setup')) await setup(pool)
    if (flag('fetch')) await fetchAll(pool)
    if (!flag('setup') && !flag('fetch')) console.log('  nothing asked for: use --setup, --fetch or --self-test')
  } finally { await endNeonPool() }
}
if (require.main === module) main().catch((e) => { console.error('[sweep-posts] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
