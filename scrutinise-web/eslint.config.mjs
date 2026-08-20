// ─────────────────────────────────────────────────────────────────────────────
// 25-C — ONE RULE, AND THE REASON IT IS WORTH A TOOLCHAIN.
//
// A `RenderedBlock` interpolated into a template literal compiles cleanly and produces the string
// "[object Object]". That happened in `deepening-jobs.ts` during this sprint: after splitting the
// evidence blocks into `{ forUser, forModel }`, one call site kept `${precedentBlock(p)}` and
// `tsc` was perfectly happy to write "[object Object]" into every precedent body a user reads.
//
// A bespoke check caught that ONE instance. This catches the CLASS — which is the same principle
// the truncation guard taught (docs/CLAUDE.md §18): a check written per-caller was missing in seven
// of them, so the rule belongs in the shared helper. Here the shared helper is the compiler.
//
// ⚠ DELIBERATELY MINIMAL. This is not "adopt a lint config"; the codebase has never had one and
// adopting a preset would produce thousands of findings nobody asked for and teach everyone to
// ignore the output. Exactly one rule is on, it is type-aware, and it is the one that catches a
// class of silent data corruption. Add rules only with the same argument.
//
// ⚠⚠ WHAT THE FIRST FULL SWEEP FOUND, AND WHY THE GATE IS SCOPED TO `lib/`.
//
// Repo-wide (`npm run lint:templates:all`) the rule reports **124 findings**:
//
//   by type   any 86 · boolean 18 · RegExp 8 · unknown 5 · never 3 · array 1 · Decimal 1
//   by area   scripts 80 · app+components 39 · lib 3
//
// **The 86 `any` are overwhelmingly `catch (e) { … ${e} }` in error paths**, and 80 of the 124 are
// in `scripts/` — diagnostics that are never shipped. Turning that into a blocking gate today
// would be the "thousands of findings nobody asked for" failure this config's header warns about:
// the noise would train everyone to pass `--no-verify`, and the one finding that matters would go
// with it.
//
// So `lint:templates` gates `lib/` ONLY — where a stringified object reaches a database row, a
// prompt or a rendered field, which is exactly where the 25-C bug lived. `lint:templates:all` runs
// the wider sweep for anyone who wants it. As of 2026-08-20 `lib/` reports **3**, all in files
// owned by CC-Search and reported to them rather than edited
// (docs/FINDING_FOR_SEARCH_gateway-limit-fanout.md).
//
// Usage:
//   npm run lint:templates       # the gate: lib/ only
//   npm run lint:templates:all   # the full sweep, for triage
// ─────────────────────────────────────────────────────────────────────────────

import tseslint from 'typescript-eslint'
// ⚠ Registered ONLY so that the pre-existing `// eslint-disable-next-line
// react-hooks/exhaustive-deps` comments — written for `next lint` — resolve to a real rule.
// ESLint 9 errors on a disable directive naming a rule it does not know, which turned 3 files
// into 21 findings that had nothing to do with what this config is for. Every rule stays OFF.
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {
    ignores: [
      '.next/**', 'node_modules/**', 'generated/**', 'prisma/generated/**',
      // Not ours, and not shipped.
      'public/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    // ⚠ The PARSER and PLUGIN only — not a preset. `tseslint.configs.base` is the minimum that
    // makes a type-aware rule runnable; adopting `recommendedTypeChecked` would light up thousands
    // of findings in a codebase that has never had a linter, and the signal would be lost.
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Type-aware linting: the rule needs to know what a template expression IS.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /**
       * ⚠ THE ONE RULE. Anything whose runtime string form is "[object Object]" — or a bare
       * "true"/"null" that reads as a bug — must not be interpolated silently.
       *
       * `allowNumber` is on because `${count}` is idiomatic and unambiguous. Everything else is
       * off: an object, a boolean, a nullish or an `any` reaching a template literal is either a
       * mistake or something the author should say explicitly with String(x).
       */
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: false,
        allowAny: false,
        allowNullish: false,
        allowRegExp: false,
        allowNever: false,
      }],
    },
  },
)
