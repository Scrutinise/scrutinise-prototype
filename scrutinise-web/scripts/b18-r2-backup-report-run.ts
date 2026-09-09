export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B18 §11 (SECOND_DRAFT_PLAN D1) — BACK UP THE REPORT-RUN FILES GIT DOES NOT HOLD.
//
// `scripts/starkey/r2-backup.ts` covers `sources/youtube/{meta,raw,logs}` at
// `research/starkey/`. It does NOT cover the rest of `docs/report_run`, and the rest is
// where the irreplaceable material is: the sixteen Word documents, the conference PDF,
// the docx text extractions, `starkey_hits.json`, `register_candidates*.json`, and the
// twelve Lex build exports the second draft is being written from.
//
// ⚠⚠ IT LIVES HERE, NOT IN `scripts/starkey/`, AND THAT IS A FINDING RATHER THAN A
// PREFERENCE. `scripts/starkey/r2-backup.ts` imports `@aws-sdk/client-s3`, and there is no
// `node_modules` anywhere above `scripts/` that contains it — the repository root holds
// `dotenv` and nothing else. **That script cannot be run from this tree at all today**; it
// dies on MODULE_NOT_FOUND before its first line of work. So "the corpus is backed up" is
// an assumption about a run in August, not a fact anybody can currently re-check — which
// is why this script VERIFIES the `research/starkey/` keys as well as writing its own.
//
// ⚠ THE SET IS DERIVED FROM GIT, NOT LISTED BY HAND. The question a backup answers is
// "what is lost if this disk dies", and the answer is "everything git does not have" — so
// the list comes from `git ls-files --others --ignored --exclude-standard`, which reports
// files that are actually on disk and actually unprotected. A hand-written list goes stale
// the first time somebody adds a file, and a forgotten file is the whole failure mode.
//
// Verification reads every key's size back from R2; a PUT that returns without throwing is
// not evidence the bytes are there. A control key that must be absent proves the check can
// still fail.
//
//   npx tsx --env-file=.env scripts/b18-r2-backup-report-run.ts                (plan)
//   npx tsx --env-file=.env scripts/b18-r2-backup-report-run.ts --write
//   npx tsx --env-file=.env scripts/b18-r2-backup-report-run.ts --verify-only
// ─────────────────────────────────────────────────────────────────────────────
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const REPO = path.resolve(__dirname, '../..')
const ACCOUNT = process.env.CLOUDFLARE_R2_ACCOUNT_ID
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

/** Where the report-run gap goes. Beside `research/starkey/`, not inside it, so the two
 *  backups stay separately verifiable and neither can quietly mask the other's absence. */
const PREFIX = 'research/report_run/'

/** What `r2-backup.ts` already holds, and therefore what this one does not re-upload —
 *  but does check. Repo-relative path prefix → R2 key prefix. */
const ALREADY_BACKED_UP: ReadonlyArray<[string, string]> = [
  ['docs/report_run/sources/youtube/meta/', 'research/starkey/meta/'],
  ['docs/report_run/sources/youtube/raw/', 'research/starkey/raw/'],
  ['docs/report_run/sources/youtube/logs/', 'research/starkey/logs/'],
]

const WRITE = process.argv.includes('--write')
const VERIFY_ONLY = process.argv.includes('--verify-only')

const CONTENT_TYPE: Record<string, string> = {
  '.json': 'application/json', '.vtt': 'text/vtt', '.srt': 'application/x-subrip',
  '.txt': 'text/plain', '.log': 'text/plain', '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown', '.csv': 'text/csv',
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

interface Item { rel: string; abs: string; key: string; size: number }

function git(args: string[]): string[] {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').map((s) => s.trim()).filter(Boolean)
}

async function headSize(key: string): Promise<number | null> {
  try {
    const r = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return r.ContentLength ?? null
  } catch { return null }
}

async function pool<T>(items: T[], width: number, fn: (t: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: width }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k]) }
  }))
}

async function main() {
  if (!ACCOUNT || !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) throw new Error('R2 credentials not set')

  const ignored = git(['ls-files', '--others', '--ignored', '--exclude-standard', '--', 'docs/report_run'])
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', 'docs/report_run'])
  const covered = (rel: string) => ALREADY_BACKED_UP.some(([p]) => rel.startsWith(p))

  const gap: Item[] = []
  const deferred: string[] = []
  for (const rel of ignored) {
    const abs = path.join(REPO, rel)
    if (!fs.existsSync(abs)) continue
    if (covered(rel)) { deferred.push(rel); continue }
    gap.push({ rel, abs, key: PREFIX + rel.replace(/^docs\/report_run\//, ''), size: fs.statSync(abs).size })
  }

  const bytes = gap.reduce((n, i) => n + i.size, 0)
  console.log(`[b18] R2 backup of the report-run gap — bucket=${BUCKET} prefix=${PREFIX}`)
  console.log(`[b18] git holds none of these: ${gap.length} files, ${(bytes / 1e6).toFixed(2)} MB`)
  console.log(`[b18] excluded as already held at research/starkey/: ${deferred.length} files (checked below, not re-uploaded)`)

  // ⚠ Untracked-but-not-ignored is one commit away from the repository, and is unprotected
  // until that commit happens. Named rather than swept in: backing it up silently would
  // remove the pressure to commit it.
  const notIgnored = untracked.filter((r) => !ignored.includes(r))
  if (notIgnored.length) {
    console.log(`\n⚠ ${notIgnored.length} file(s) under docs/report_run are UNTRACKED and NOT ignored —`)
    console.log('  unprotected by git, and NOT part of this backup, because they are meant to be committed:')
    for (const r of notIgnored.slice(0, 25)) console.log(`    ${r}`)
    if (notIgnored.length > 25) console.log(`    … and ${notIgnored.length - 25} more`)
  }

  console.log('\n── the gap, by group ──')
  const groups = new Map<string, { n: number; bytes: number }>()
  for (const it of gap) {
    const g = path.dirname(it.rel).replace(/^docs\/report_run\/?/, '') || '(root)'
    const cur = groups.get(g) ?? { n: 0, bytes: 0 }
    groups.set(g, { n: cur.n + 1, bytes: cur.bytes + it.size })
  }
  for (const [g, v] of [...groups].sort()) {
    console.log(`  ${g.padEnd(42)} ${String(v.n).padStart(4)} files  ${(v.bytes / 1e6).toFixed(2)} MB`)
  }

  if (!WRITE && !VERIFY_ONLY) {
    console.log('\n  PLAN ONLY — nothing uploaded. Re-run with --write.')
    return
  }

  let uploaded = 0, skipped = 0
  const failed: string[] = []
  if (!VERIFY_ONLY) {
    await pool(gap, 8, async (it) => {
      const existing = await headSize(it.key)
      if (existing === it.size) { skipped++; return }
      try {
        await r2.send(new PutObjectCommand({
          Bucket: BUCKET, Key: it.key, Body: fs.readFileSync(it.abs),
          ContentType: CONTENT_TYPE[path.extname(it.abs).toLowerCase()] ?? 'application/octet-stream',
        }))
        uploaded++
      } catch (e) { failed.push(`${it.key}: ${(e as Error).message}`) }
    })
    console.log(`\nuploaded ${uploaded}, already present ${skipped}, failed ${failed.length}`)
    for (const f of failed.slice(0, 10)) console.log(`  ! ${f}`)
  }

  console.log('\nverifying every key by reading its size back from R2...')
  const missing: string[] = []
  const wrongSize: string[] = []
  await pool(gap, 8, async (it) => {
    const s = await headSize(it.key)
    if (s === null) missing.push(it.key)
    else if (s !== it.size) wrongSize.push(`${it.key} local=${it.size} r2=${s}`)
  })
  console.log(`  gap                : ${gap.length} keys — missing ${missing.length}, wrong size ${wrongSize.length}`)
  for (const m of missing.slice(0, 10)) console.log(`    MISSING ${m}`)
  for (const m of wrongSize.slice(0, 10)) console.log(`    SIZE    ${m}`)

  // ⚠⚠ THE OTHER BACKUP'S CLAIM IS CHECKED, NOT ASSUMED. These files are excluded above on
  // the grounds that r2-backup.ts holds them. If it does not, they are unprotected and this
  // run would have reported success while leaving them nowhere — and since that script
  // cannot currently run, nobody has re-checked it since August.
  const deferredItems = deferred.map((rel) => {
    const map = ALREADY_BACKED_UP.find(([p]) => rel.startsWith(p))!
    const abs = path.join(REPO, rel)
    return { rel, abs, key: rel.replace(map[0], map[1]), size: fs.statSync(abs).size }
  })
  const dMissing: string[] = []
  const dWrong: string[] = []
  await pool(deferredItems, 8, async (it) => {
    const s = await headSize(it.key)
    if (s === null) dMissing.push(it.key)
    else if (s !== it.size) dWrong.push(`${it.key} local=${it.size} r2=${s}`)
  })
  console.log(`  research/starkey/  : ${deferredItems.length} keys — missing ${dMissing.length}, wrong size ${dWrong.length}`)
  for (const m of dMissing.slice(0, 10)) console.log(`    MISSING ${m}`)
  for (const m of dWrong.slice(0, 10)) console.log(`    SIZE    ${m}`)

  const control = await headSize(`${PREFIX}__control_should_not_exist__`)
  console.log(`  control key (must be absent): ${control === null
    ? 'absent — the check is live' : '!! PRESENT, the check is not discriminating'}`)

  const bad = missing.length + wrongSize.length + failed.length + dMissing.length + dWrong.length
  if (bad || control !== null) { console.log(`\n⚠⚠ ${bad} problem(s). NOT a clean backup.`); process.exit(1) }
  console.log(`\nOK — ${gap.length} objects at r2://${BUCKET}/${PREFIX}`
    + `, and ${deferredItems.length} confirmed still present at research/starkey/.`)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
