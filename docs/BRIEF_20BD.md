# BRIEF — Sprint 20-B/D: the proposal document, and versioning

**Spec:** `docs/LEX_REBUILD_DESIGN.md` §20. **Thread:** LEX-DOC (a second Lex session).
**Written:** 20 August 2026.

⚠ **This runs IN PARALLEL with 25-C, in the same package.** §0 is the contract that makes that safe
and it is not optional. Read it first.

**Why this sprint matters.** Everything built so far produces *inputs to a document that does not
exist*. A user can complete a kernel, have it researched, revised and adversarially reviewed — and
there is still nothing to send anyone. **20-B is the artefact.** 20-D is what makes it shareable, and
it is the precondition for §24's whole review system.

---

## §0 — Running in parallel with 25-C: the contract

Three streams already share this tree, but they live in different packages. **This is the first time
two sessions will both be working inside `scrutinise-web`**, so the collision surface is real.

**File ownership — absolute, no exceptions:**

| Owned by 25-C, DO NOT TOUCH | Owned by this sprint |
|---|---|
| `components/lex/DeepeningPanel.tsx` | `lib/documents/**` (new) |
| `lib/lex/deepening*.ts` | `components/documents/**` |
| `lib/lex/attribution.ts`, `corpus-type-map.ts` | `app/api/ideas/[id]/document/**` (new) |
| the review-agenda panel and `BuildFork` handling | `app/ideas/[id]/publish/**` (new) |
| the model callers (`lex-client`, provider wiring) | the snapshot assembler (§1) |

**If a fix here appears to need a change in a 25-C file: report the change needed and leave it.** Same
rule the other streams already follow.

**Git:** no git during the sprint; **`commit-lex-doc.sh`** at the end (per stream, per sprint — two
sessions raced on a shared `commit-all.sh` on 19 August and one deleted the other's mid-use); scoped
commits by explicit path; `git pull --rebase` before pushing and keep both entries on any shared-doc
conflict. **Append to CHANGE_LOG and handoff; never reflow another session's entry.**

**Delivery** per CLAUDE.md §20 — and note that three outages in a fortnight were files that existed
locally and were never committed. Run `check:committed` before reporting anything done.

## §1 — The snapshot: one seam, so the two sprints cannot collide

**The single design decision that makes parallel work safe.** The document must not read the kernel,
the findings and the agenda directly — 25-C is actively changing how findings are labelled, how
unknowns are collapsed, and what the agenda contains. Reading those shapes directly means rendering
yesterday's data.

Instead: **one assembler function, `buildProposalSnapshot(ideaId, version?)`**, returning a single
plain object containing everything a document needs — the kernel fields, the accepted evidence with
provenance, the resolved and open forks, the issues, the known unknowns, the costings, the sources.

- **Everything downstream reads the snapshot and nothing else.** The renderers never query Prisma.
- When 25-C changes the underlying shape, **only the assembler changes.** Same reasoning as the
  search gateway, and it has paid for itself there repeatedly.
- The snapshot is **serialisable and self-contained**, which is also what makes §2's versioning
  possible: a version is a stored snapshot.

`// If the document renderer imports anything from lib/lex/deepening*, the seam has failed.`

## §2 — 20-D: versioning and publication

Do this **before** the document, not after — a document that cannot be pinned to a version cannot be
reviewed (§24.4), and retrofitting versioning is the expensive order.

**Schema** (additive, idempotent, `whichdb` first):

```
ProposalVersion { id, ideaId, versionNumber, contentHash, snapshot Json,
                  createdAt, createdBy, changeNote }
```

- `contentHash` is a hash of the snapshot, so an unchanged proposal does not mint a new version.
- **Append-only.** A version is never edited; a change makes the next one.
- `changeNote` — what changed since the last version, so §24's "12 of 14 findings resolved since"
  can be computed rather than asserted.

**Visibility** (§20.3), on the idea: `PRIVATE` (default) · `LINK` · `COMMUNITY` · `PUBLIC`.
Publishing is **explicit, reversible, and pinned**: a shared link resolves to *the version that was
shared*, so a recipient's link does not shift under them while the owner keeps editing.

⚠ **`COMMUNITY` grants a read on a published version only** (§20.7). Community membership must never
confer access to the working proposal, and the check should assert it.

## §3 — 20-B: the proposal document

Five renderings from one snapshot (§20.1). **Build the first two in this sprint; the rest are
scaffolded, not written.**

**3a. The Proposal (docx + PDF).** The primary artefact. Diagnosis → guiding policy → costed actions,
as an argument, with sources. Reuse Sprint 2.5's block-model renderer — *two renderers over one block
model* — rather than writing a second export path. The legislative annex (§20.4) renders where the
instrument is legislative.

**3b. The Summary (1–2 pages).** The first thirty seconds of someone's attention: problem, pivotal
obstacle, the approach, what it rules out, headline cost against problem cost, and **the ask**.
⚠ **The PDF is deliberately short and points at the online view for depth** — a committee clerk reads
two pages and follows a link; they do not read forty.

**3c. Scaffolded only:** the Evidence Pack, the Online View, and the Legislative Annex as a standalone.
Define their place in the snapshot and leave them unbuilt rather than half-built.

**Content rules, all of which already exist elsewhere and must hold here:**

- **Rendering of stored state only.** Nothing is generated fresh at export time. If the snapshot does
  not contain it, it does not appear.
- **Every claim carries its source**, and a claim with no source is visibly marked as unsupported
  rather than quietly presented — the never-claim rule, in the artefact that leaves the building.
- **A gap is stated, not omitted.** "No post-implementation review exists" is a finding.
- **The user's own knowledge is attributed to them**, not blended into Lex's prose.
- **A fingerprint** of exactly what was rendered, so a stale file is marked stale rather than served
  (Sprint 2.5's pattern — reuse it).

## §4 — What is deliberately NOT in this sprint

**§20-C, the curation pass.** And a design question to raise rather than build around: **20-C and
25.3's review agenda look like the same surface.** Both are "here is what needs your attention before
this goes out" — sources, costs, claims, gaps against decisions, challenges, reading, gaps. Two
"check your work" screens would be a mistake.

**Report a recommendation, do not implement one:** should the claims check and source curation become
a *section of the agenda*, or is publishing a genuinely separate moment deserving its own gate? My
instinct is the former, but 25-C is building the agenda right now and whoever has seen both should
say. **Flag it for Charlie with a reason.**

## §5 — Acceptance criteria

- `buildProposalSnapshot` is the only thing that reads idea state; **no renderer imports from
  `lib/lex/deepening*` or `lib/lex/lex-client`** — asserted by a check, not by intention.
- A version is created on publish, is append-only, and an unchanged proposal does not mint a new one.
- A shared link resolves to the version that was shared, not to the latest.
- Community visibility grants a read on a published version and nothing more — checked.
- The Proposal and the Summary render to readable docx and PDF, with sources intact and unsupported
  claims visibly marked.
- Re-rendering after a change produces a new file and marks the old one stale.
- No file owned by 25-C has been modified; needed changes are reported instead.
- `check:committed` clean; green Production deployment; a 20-B string read back off the live site.
- The §4 recommendation is in the report.
