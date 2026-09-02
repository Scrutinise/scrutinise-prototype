/**
 * THE CLIENT/SERVER BOUNDARY — does any client component reach the database?
 *
 * Run: npm run check:client-boundary
 *
 * ⚠⚠ WHY THIS EXISTS. `GroupLevel.tsx` was a `'use client'` component that
 * imported a sort function from `lib/group-view.ts`, which imports
 * `lib/prisma.ts`, which imports the Postgres driver. The query was already on
 * the server and the props were already plain — none of that mattered. **A
 * value import pulls the whole module graph into the browser bundle**, so the
 * driver went with it and the Vercel build died on `dns`, `fs`, `net` and
 * `tls`: six errors, one cause. **It built clean locally**, and it blocked
 * every deploy — including another session's — until it was found.
 *
 * ⚠ THE ONLY CORRECT FIX IS TO CUT THE EDGE. Aliasing the Node built-ins away
 * or marking the modules external makes the build pass and ships a bundle that
 * fails in the browser at runtime instead — a worse failure, later, in front of
 * a user. So this check looks for the EDGE, not for the symptom.
 *
 * What it does: finds every file marked `'use client'`, walks its VALUE imports
 * transitively (type-only imports are erased by the compiler and are not
 * edges), and reports any that reach a server-only module, printing the whole
 * chain — because "GroupLevel imports prisma" was three files deep and
 * invisible in the file itself.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'

const WEB = resolve(__dirname, '..')

/** Reaching any of these from the browser is the defect. */
const SERVER_ONLY = [
  'lib/prisma.ts',
  'lib/pg-pool.ts',
]
/** Packages that are server-only wherever they are imported from. */
const SERVER_PACKAGES = [
  '@prisma/client',
  'pg',
  'node:fs',
  'node:net',
  'node:tls',
  'node:dns',
  'fs',
  'net',
  'tls',
  'dns',
  '@clerk/nextjs/server',
  'resend',
]

const SEARCH_DIRS = ['app', 'components', 'lib', 'context']
const EXTS = ['.ts', '.tsx', '.js', '.jsx']

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'generated') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (EXTS.some((e) => name.endsWith(e))) out.push(p)
  }
  return out
}

const FILES = SEARCH_DIRS.flatMap((d) => walk(join(WEB, d)))

/** Strip comments and strings so an import inside a comment is not an edge. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * The VALUE imports of a file.
 *
 * ⚠ `import type { X } from 'y'` is NOT an edge — TypeScript erases it and the
 * bundler never follows it. Counting it would report `GroupLevel.tsx` as
 * reaching prisma even after the fix, which is a check that cries wolf, and a
 * check that cries wolf gets switched off before the real one arrives.
 */
function valueImports(src: string): string[] {
  const code = stripComments(src)
  const specs: string[] = []
  const re = /(?:^|\n)\s*(import|export)\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const clause = m[2].trim()
    const spec = m[3]
    if (/^type\s/.test(clause)) continue // `import type { … } from`
    // `import { type A, type B } from` — every specifier type-only, so no edge.
    const braced = clause.match(/\{([\s\S]*)\}/)
    if (braced && !clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim()) {
      const parts = braced[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (parts.length > 0 && parts.every((p) => /^type\s/.test(p))) continue
    }
    specs.push(spec)
  }
  // Bare side-effect imports: `import 'x'`
  const bare = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
  while ((m = bare.exec(code)) !== null) specs.push(m[1])
  return specs
}

/** Resolve an import specifier to a file inside this app, or null. */
function resolveSpec(fromFile: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(WEB, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null // a package — handled separately
  for (const e of EXTS) if (existsSync(base + e)) return base + e
  for (const e of EXTS) if (existsSync(join(base, 'index' + e))) return join(base, 'index' + e)
  if (existsSync(base) && statSync(base).isFile()) return base
  return null
}

const rel = (p: string) => relative(WEB, p).replace(/\\/g, '/')

const srcCache = new Map<string, string>()
function read(p: string): string {
  let s = srcCache.get(p)
  if (s === undefined) {
    s = readFileSync(p, 'utf8')
    srcCache.set(p, s)
  }
  return s
}

function isClientComponent(p: string): boolean {
  const head = read(p).slice(0, 400)
  return /^\s*(['"])use client\1/m.test(head)
}

/**
 * Breadth-first from a client component to the first server-only module.
 * Returns the chain, so the report names every hop — the whole point, since
 * the offending file mentions none of them.
 */
function findServerReach(entry: string): { chain: string[]; target: string } | null {
  const seen = new Set<string>([entry])
  const queue: { file: string; chain: string[] }[] = [{ file: entry, chain: [rel(entry)] }]
  while (queue.length) {
    const { file, chain } = queue.shift()!
    for (const spec of valueImports(read(file))) {
      if (SERVER_PACKAGES.includes(spec)) {
        return { chain: [...chain, `(package) ${spec}`], target: spec }
      }
      const next = resolveSpec(file, spec)
      if (!next) continue
      const r = rel(next)
      if (SERVER_ONLY.includes(r)) return { chain: [...chain, r], target: r }
      // ⚠ A nested `'use server'` file or a route handler is its own boundary;
      // we do not walk into one from a client file because a client file cannot
      // import one as a value in the first place — if it does, that IS the bug
      // and the chain above will have already reported it.
      if (seen.has(next)) continue
      seen.add(next)
      queue.push({ file: next, chain: [...chain, r] })
    }
  }
  return null
}

function main() {
  const clientFiles = FILES.filter(isClientComponent)
  console.log(`${FILES.length} source files, ${clientFiles.length} marked 'use client'\n`)

  const offenders: { file: string; chain: string[]; target: string }[] = []
  for (const f of clientFiles) {
    const hit = findServerReach(f)
    if (hit) offenders.push({ file: rel(f), chain: hit.chain, target: hit.target })
  }

  if (offenders.length === 0) {
    console.log('✓ no client component reaches a server-only module')
  } else {
    console.log(`✗ ${offenders.length} client component(s) reach a server-only module:\n`)
    for (const o of offenders) {
      console.log(`  ${o.file}  →  ${o.target}`)
      for (let i = 0; i < o.chain.length; i++) {
        console.log(`      ${i === 0 ? '' : '↳ '}${o.chain[i]}`)
      }
      console.log('')
    }
  }

  // ⚠ THE CONTROL. This check must be able to FAIL, and the only way to know is
  // to make it prove it can see an edge it is meant to see. `lib/group-view.ts`
  // is a SERVER module that genuinely imports prisma; if the walker cannot find
  // that edge, the walker is broken and every green run above is meaningless.
  const controlEntry = join(WEB, 'lib/group-view.ts')
  const controlSeesIt = existsSync(controlEntry) && findServerReach(controlEntry) !== null
  console.log(
    controlSeesIt
      ? '· control fired — the walker does find prisma from lib/group-view.ts (a server module, correctly)'
      : '✗ CONTROL DID NOT FIRE — the walker cannot see a known prisma edge; this check proves nothing',
  )

  if (offenders.length > 0 || !controlSeesIt) process.exitCode = 1
}

main()

export {}
