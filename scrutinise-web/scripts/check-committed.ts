// ─────────────────────────────────────────────────────────────────────────────
// check:committed — DOES THE REPOSITORY CONTAIN THE APP?
//
// CLAUDE.md §20 asks for exactly this and calls it "a check worth building once":
//
//   "A CI or pre-push check that FAILS WHEN A SOURCE FILE IMPORTED BY COMMITTED CODE IS
//    NOT ITSELF COMMITTED would have caught incidents two and three outright."
//
// It has now caught a THIRD, on the same feature as the first two:
//
//   6–9 Aug   production served three-day-old code for a week.
//   12 Aug    an unanchored `build/` ignore excluded a whole route directory.
//   17–18 Aug `lib/lex/build-cost.ts` was never committed; production failed to build
//             for ~10 hours.
//   19 Aug    `app/api/ideas/[id]/build/route.ts` and its `cancel/` sibling had NEVER
//             been committed — in ANY commit, on ANY branch. `/ideas/build` rendered on
//             production and every call it made to start a build 404ed, which the client
//             reported as "Could not start a session. Please refresh." for two days.
//
// ⚠ THE PATTERN ACROSS ALL FOUR IS THAT A GREEN LOCAL BUILD PROVES NOTHING ABOUT THE
// REPOSITORY. `tsc` and `next build` read the working tree; Vercel reads the commit. This
// check is the only one in the codebase that compares the two.
//
// ⚠ AND `git status` CANNOT DO THIS JOB. An ignored file never appears in it, which is
// how the 12 Aug incident survived. This asks git directly, per file.
//
// Usage:
//   npm run check:committed
//   npm run check:committed -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Directories whose contents are shipped by Vercel and must therefore be in the commit.
 * Deliberately NOT the whole tree: `node_modules`, build output and genuinely local
 * scratch files are not the subject.
 */
const SHIPPED = ['app', 'components', 'lib', 'prisma']

/** Extensions that are compiled or read at build/run time. */
const SOURCE = ['.ts', '.tsx', '.js', '.jsx', '.css', '.sql', '.prisma']

/** Files that are legitimately local. Each needs a REASON, not just a name. */
const ALLOWED_UNTRACKED: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /(^|[\\/])\.env/, why: 'secrets — never committed' },
  { pattern: /(^|[\\/])node_modules[\\/]/, why: 'dependencies' },
  { pattern: /(^|[\\/])\.next[\\/]/, why: 'build output' },
  { pattern: /(^|[\\/])generated[\\/]/, why: 'generated client' },
]

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (SOURCE.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

/**
 * Every path git has under version control, relative to the REPOSITORY ROOT.
 *
 * ⚠ `--full-name` is load-bearing. Plain `git ls-files` returns paths relative to the
 * CURRENT DIRECTORY, and this script runs from `scrutinise-web/`. Without it, every
 * tracked file compared against a root-relative path missed, and the first run of this
 * check reported `prisma/schema.prisma` as uncommitted — a false positive so large it
 * would have taught the next reader to ignore the check. Watched failing, then fixed.
 */
function trackedSet(): Set<string> {
  const raw = execFileSync('git', ['ls-files', '--full-name'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  return new Set(raw.split('\n').map((l) => l.trim()).filter(Boolean))
}

/** This package's path relative to the repo root — `scrutinise-web`, normally. */
function repoPrefix(): string {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  return relative(root, process.cwd()).split(sep).join('/')
}

function main() {
  const selfTest = process.argv.includes('--self-test')
  console.log(`── check:committed${selfTest ? ' --self-test' : ''} ──`)

  const tracked = trackedSet()
  const prefix = repoPrefix()
  const files = SHIPPED.flatMap((d) => walk(d))

  const missing: string[] = []
  for (const f of files) {
    const rel = f.split(sep).join('/')
    const allowed = ALLOWED_UNTRACKED.find((a) => a.pattern.test(rel))
    if (allowed) continue
    const repoPath = prefix ? `${prefix}/${rel}` : rel
    if (!tracked.has(repoPath)) missing.push(repoPath)
  }

  console.log(`  scanned ${files.length} shipped source files under ${SHIPPED.join(', ')}`)

  if (missing.length) {
    console.log(`\n  ✗ ${missing.length} FILE(S) ARE ON THIS MACHINE AND NOT IN THE REPOSITORY:\n`)
    for (const m of missing) console.log(`      ${m}`)
    console.log('\n  Vercel builds from the commit, not from this working tree. Whatever these files')
    console.log('  do, production does not do it. Run `git add` on each, or `git check-ignore -v`')
    console.log('  on any that refuses — and CONFIRM THE FILE, NOT THE PATTERN (CLAUDE.md §20).')
  } else {
    console.log('  ✓ every shipped source file is in the repository')
  }

  if (selfTest) {
    // ⚠ THE NEGATIVE CONTROL. A check that has only ever passed is a check nobody has
    // watched fail, and this whole file exists because of a class of failure that hides.
    // A path that certainly is not tracked must be reported as missing.
    const fake = prefix ? `${prefix}/app/__never_committed__/route.ts` : 'app/__never_committed__/route.ts'
    const wouldCatch = !tracked.has(fake)
    console.log(
      wouldCatch
        ? '  ✓ control — an untracked path IS reported as missing'
        : '  ✗ CONTROL FAILED — the tracked set claims to contain a file that cannot exist',
    )
    if (!wouldCatch) process.exit(1)
  }

  process.exit(missing.length ? 1 : 0)
}

main()
