// ─────────────────────────────────────────────────────────────────────────────
// docs/CLAUDE.md §23.1 — IS THIS FILE REACHED BY ANYTHING A USER LOADS?
//
// ⚠⚠ WRITTEN AFTER A CHECK PASSED FOR A FULL SPRINT OVER A COMPONENT NOTHING RENDERS.
// 25-J §1 renamed the nav item to "My ideas" in `components/ui/Navbar.tsx`; that file has no
// importer anywhere in the application, so the live nav went on saying "Create" while
// `check:lex-25j` reported the rename shipped — with a negative control that fired on every
// run, because the control corrupts the same dead file the assertion reads.
//
// ⚠ A NEGATIVE CONTROL CANNOT CATCH THIS. Breaking a file and watching the check reject it
// proves the assertion READS the file. It says nothing about whether anything else does.
// "It is written down" and "it is reached" are different claims, and only the second is a
// claim about the product.
//
// ⚠ THIS IS A STATIC IMPORT WALK, AND ITS LIMIT IS STATED RATHER THAN HIDDEN: a file reached
// only through a string-built dynamic import, or through a barrel file it does not name,
// will look unreachable. That is the safe direction — it fails loudly and a human looks —
// but a check using this must say `reachableFrom` in its failure message so the next reader
// knows which kind of "no" they have.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'

const ROOT = process.cwd()

/** Every .ts/.tsx under the directories a request can actually reach. */
function sourceFiles(dirs: string[] = ['app', 'components', 'lib']): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let names: string[]
    try { names = readdirSync(join(ROOT, dir)) } catch { return }
    for (const name of names) {
      const rel = `${dir}/${name}`
      if (statSync(join(ROOT, rel)).isDirectory()) { walk(rel); continue }
      if (rel.endsWith('.ts') || rel.endsWith('.tsx')) out.push(rel)
    }
  }
  for (const d of dirs) walk(d)
  return out
}

/**
 * Which files import `path`, by module specifier.
 *
 * ⚠ MATCHED ON THE SPECIFIER, NOT ON THE BARE NAME. Grepping for `Navbar` finds the file's
 * own `export default function Navbar`, every comment mentioning it, and every check
 * asserting on it — which is precisely how a dead component looked alive for a sprint.
 * An import specifier ends in the file's basename and is preceded by `from '…'` or
 * `import('…')`, so that is what is matched.
 */
export function importersOf(path: string): string[] {
  const name = basename(path, extname(path))
  // `@/components/lex/Foo`, `./Foo`, `../lex/Foo` — always the last segment, never a
  // substring of a longer name (`Foo` must not match `FooBar`).
  const spec = new RegExp(
    String.raw`(?:from|import\()\s*['"\`][^'"\`]*?[/'"\`]` + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + String.raw`['"\`]`,
  )
  const out: string[] = []
  for (const f of sourceFiles()) {
    if (f === path) continue
    if (spec.test(readFileSync(join(ROOT, f), 'utf8'))) out.push(f)
  }
  return out
}

/**
 * ⚠ ONE HOP IS NOT ENOUGH, AND THIS IS WHY THE FUNCTION WALKS. A component imported only by
 * another dead component is still dead. The walk stops at anything under `app/` — a page,
 * a layout or a route handler IS an entry point by definition in the App Router.
 *
 * Returns the entry point that reaches it, or null. The entry point is returned rather than
 * a boolean so a check's failure message can say which route proves it, and so a reader can
 * tell "reached by /ideas/create" from "reached by a test fixture".
 */
export function reachableFrom(path: string, seen = new Set<string>()): string | null {
  if (seen.has(path)) return null
  seen.add(path)
  if (path.startsWith('app/')) return path
  for (const importer of importersOf(path)) {
    if (importer.startsWith('app/')) return importer
    const via = reachableFrom(importer, seen)
    if (via) return via
  }
  return null
}

/**
 * The assertion itself, so every check spells it the same way.
 *
 * Returns null when the file is reached, or the failure sentence when it is not.
 */
export function assertReachable(path: string): string | null {
  const via = reachableFrom(path)
  return via
    ? null
    : `${path} is not reachable from anything under app/ — this assertion is over dead code `
      + '(docs/CLAUDE.md §23.1). If it is reached through a dynamic import, say so here.'
}
