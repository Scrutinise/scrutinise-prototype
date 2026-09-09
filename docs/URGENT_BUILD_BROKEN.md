# URGENT — production has been failing for two days, and it is a cross-package import

**For:** whichever session picks this up first — **the breakage is in the web build, the file is
Search's.** Coordinate; do not both fix it.
**Written:** 24 August 2026.

---

## What is happening

Production deployments have been **failing since roughly 22 August**. The live site is serving
**25-D** (commit `e6e37d1`); **25-E is built, committed, and not deployed.** Every commit since —
Lex, Search and Graph alike — has errored, because the failure is in the shared web build and has
nothing to do with what any individual commit changed.

The error, from the Vercel log:

```
../scripts/ingest/search/lance.ts:14:26
Type error: Cannot find module '@lancedb/lancedb' or its corresponding type declarations.
```

## What it means

**The `scrutinise-web` build is type-checking a file that lives outside `scrutinise-web`.**
`scripts/ingest/search/lance.ts` belongs to the ingest/search package and imports `@lancedb/lancedb`,
which is installed in *that* package's `node_modules` — not in the web app's.

Vercel installs **only** `scrutinise-web`'s dependencies. So the compiler reaches a file it should
never have been shown, cannot resolve its import, and fails the whole build.

⚠ **This compiles perfectly on any developer machine**, because there both packages' `node_modules`
exist. It is the same shape as the `build-cost.ts` outage on 18 August — *the local build passes on
something the deployed build cannot do* — but a different mechanism, and **`check:committed` cannot
catch it: the file is committed. What is missing is the dependency, in the place the build runs.**

## What to do

**1. Find what pulls it in — diagnose, do not guess.** One of three things:

- a file in `scrutinise-web/` importing from `../scripts/...`;
- `scrutinise-web/tsconfig.json`'s `include`/`paths` reaching outside the package;
- a path alias resolving across the boundary.

`npx tsc --noEmit --listFiles` in `scrutinise-web` and look for anything under `../scripts/` — that
tells you the entry point rather than the leaf.

**2. Fix the boundary, not the symptom.** Do **not** add `@lancedb/lancedb` to the web app's
dependencies — that ships a heavy native module to a serverless bundle to satisfy a file the web app
should never compile. **The web build must not reach outside its own package.** Either remove the
crossing import, or exclude `../scripts` from the web tsconfig — whichever the diagnosis shows.

**3. Verify the way Vercel verifies.** ⚠ **This is the generalisable part and the reason this class
keeps recurring.** `tsc` and `next build` on a developer machine prove nothing about a clean
deployment, because the machine has files and packages the deployment does not.

Add a check that builds **the way the platform builds**: a clean checkout, install `scrutinise-web`'s
dependencies **only**, then compile. It catches this, it would have caught the 18 August outage, and
it is the only local check that means anything about delivery. Add it to CLAUDE.md §20 as check 0 —
*before* the four delivery checks, because it is the one that runs before you push.

**4. Then deploy and prove it.** Green Production deployment, and read a 25-E string back off the
running site. **25-E's own delivery record must be redone** — its check 4 could not have passed
against a site still serving 25-D.

## Why this one matters more than the outage itself

Three separate sessions have pushed into a broken build for two days and none could have known: their
own checks were green, and the failure names a file none of them touched. **A shared build with no
shared pre-push guard means any stream can break every stream, silently.** Step 3 is what closes that,
and it is worth doing properly rather than fixing this instance and moving on.
