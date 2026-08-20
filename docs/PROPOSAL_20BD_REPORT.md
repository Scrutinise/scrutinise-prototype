# SPRINT 20-B/D REPORT — the proposal document, and versioning

**Executes** `docs/BRIEF_20BD.md` §0–§5 against `docs/LEX_REBUILD_DESIGN.md` §20.
**Thread:** LEX-DOC. **Completed:** 2026-08-20 06:44 UTC.
**Cost: $0 — there is no model call anywhere in this sprint, by design (§20.0).**

---

## The one-line result

**Everything the platform has built so far was an input to a document that did not exist. It exists.**
A completed proposal renders to a readable Proposal and a two-page Summary in docx and PDF, every
claim carries its source or is visibly marked as having none, the gaps are a section of the document
rather than an omission from it, and a shared link is pinned to the version that was shared — proved
by minting a second version and watching the recipient's link still hand over the first.

**Checks:** `check:20bd` **47/47 with all 13 self-test breaks firing**; `verify:20bd` **45/45 live
against Neon and R2**; `tsc` clean; `next build` compiled with all nine new routes present;
`check:documents` (Sprint 2.5's render path) still passes.

---

## ⚠⚠ THE DEFECT THE LIVE RUN FOUND, AND IT WOULD HAVE SHIPPED

`check:20bd` passed 46/46 on fixtures. The first live run then reported:

```
v2's change note: "2 fields edited (Who's affected, impact & cost, Chosen approach)"
```

**One field had been edited.** The change note invented the other one.

The cause is not in the diff logic. It is that `describeChange` compares the previous snapshot —
which comes out of a `jsonb` column — against a freshly assembled one, using `JSON.stringify`.
**Postgres `jsonb` does not preserve key order: it stores keys sorted by length, then bytewise.**
Verified against Neon rather than inferred from the documentation:

```
stored order  : affectedGroups, impact, cost
jsonb returns : cost, impact, affectedGroups
```

So every structured field (`whoAffectedImpactCost`, `legalLandscape`, `anticipatedResponses`) read
back a permanently "edited". Fixed by routing the comparison through the same `stableStringify` the
content hash already used — and the reason the *hash* was never affected is instructive: both sides
of that comparison are freshly built objects, so the round trip never enters it. One comparison had
the guard and its neighbour did not.

**A change note that invents an edit is the same failure class as a figure with no basis: a
true-looking sentence nobody can check.** §24 is specified to compute "12 of 14 findings resolved
since" off exactly this field.

⚠ **And the original assertion would have passed over it.** It read
`changeNote.includes('Chosen approach')` — true in both the broken and the fixed output. It is now
tightened to assert the *count* and the *absence* of the untouched field, and the fixture check
carries a reordered-keys case with a self-test break that reproduces the defect.

---

## ⚠ A SECOND THING I GOT WRONG, IN MY OWN TEST

The key-order assertion in `check:20bd` was written as
`JSON.parse(JSON.stringify(a, Object.keys(a).sort()))` and reported a hash defect on the first run.
There is no hash defect. The replacer-**array** form of `JSON.stringify` does not reorder keys — it
**filters** them, at every level of the tree. The test built a snapshot with most of its nested keys
deleted and then blamed the hash for the difference. Rebuilt to actually reverse key order
recursively, with a preceding assertion that the fixture really did move keys — *"or the assertion
below proves nothing"*.

---

## §0 — the parallel-work contract

**No file owned by 25-C has been touched.** `DeepeningPanel.tsx`, `lib/lex/deepening*.ts`,
`attribution.ts`, `corpus-type-map.ts`, the review-agenda panel, `BuildFork` handling and the model
callers are all unmodified by this sprint.

⚠ **One decision worth recording: `lib/lex/known-unknowns.ts` is NOT imported, deliberately.** It is
25-C's, it holds the collapse helper this sprint's gaps section would obviously want, and **it is
uncommitted in this shared tree** — `git log` returns nothing for it. Importing it would have put a
file on `Main` whose import does not resolve, which is precisely the `build-cost.ts` incident in
CLAUDE.md §20. The assembler reads `DeepeningPass.knownUnknowns` as JSON instead. That is also the
correct architecture: **the seam depends on the TABLES, which are stable, not on the CODE, which is
mid-flight.**

**Two changes are reported rather than made, both outside this sprint's ownership:**

- ▶ **25-C:** when the collapse lands and is committed, the assembler should call it instead of its
  own JSON read (`lib/documents/proposal-snapshot.ts`, the `knownUnknowns` loop). Until then the
  proposal lists gaps uncollapsed — honest, and repetitive.
- ▶ **Nobody yet owns this:** §20.2.1 requires an excluded source to stay in the record
  ("excluded, not deleted") so the evidence pack can show what was considered. **There is no
  `excluded` state on a source anywhere in the schema today.** The snapshot cannot carry what does
  not exist, so the Evidence Pack (scaffolded) cannot be built until it does. Named here rather than
  invented.

---

## §1 — the snapshot: the seam held

`buildProposalSnapshot(ideaId, version?)` in `lib/documents/proposal-snapshot.ts` is the only thing
in the document stack that reads idea state. It reads Prisma directly — Idea, IdeaFieldState,
DiagnosisCause, PolicyOption, LexCoherentAction, CostLine, EvidenceItem, DeepeningIssue,
DeepeningPass, BuildFork, IdeaElicitation — and returns one plain, serialisable object.

**The ban is asserted, not intended.** `check:20bd` scans every file under `lib/documents/**` and
`components/documents/**` for an import of `lib/lex/deepening*` or `lib/lex/lex-client`, and asserts
separately that no renderer imports Prisma. Both were **watched failing against a real edit to real
code**, not only against a synthetic break: adding
`import { supersedeOlderProposals } from '@/lib/lex/deepening-sift'` to `build-proposal.ts` produced

```
✗ no file in the document stack imports lib/lex/deepening* or lex-client — lib\documents\build-proposal.ts → @/lib/lex/deepening-sift
```

and adding `import { prisma } from '@/lib/prisma'` produced the matching failure on the second
assertion. Both were then restored and the file diffed byte-identical.

⚠ **`version` does not rebuild.** `buildProposalSnapshot(id, 3)` returns the STORED snapshot of
version 3 exactly as written. Recomputing it from today's rows would be the very thing versioning
exists to prevent.

**Supportedness is structural, not judged.** There is no model call and no claims *inventory* here —
that is 20-C. What the snapshot carries is the structural fact: a kernel field, a cause or an action
either has ACCEPTED evidence attached to it in the record (`EvidenceItem.fieldRef`), or it has none.
⚠ **Only ACCEPTED evidence enters the snapshot.** A PROPOSED finding is one Lex offered and the user
has not agreed to; putting it in the artefact that leaves the building would publish a judgement
nobody made. Asserted live with a planted PROPOSED row and a marker string that must not appear.

---

## §2 — versioning and publication (built first, as instructed)

**Schema** — `prisma/lex_proposal_20bd.sql`, additive and idempotent, applied to Neon
(`ep-old-dust-aboxi69a`, `whichdb` run and pasted first), and **run twice to prove idempotency**.

⚠ **A SECOND VISIBILITY ENUM, NOT AN EXTENSION OF `IdeaVisibility`.** The existing column is the
five-stage lifecycle's visibility — the stage gates and every listing query read it, and an idea can
be STAGE_3 link-only while its proposal is unpublished. Overloading it would make every "which ideas
are listed" query silently include published proposals. New: `ProposalVisibility` (PRIVATE · LINK ·
COMMUNITY · PUBLIC) on `Idea.proposalVisibility`, plus `publishedProposalVersionId`,
`proposalPublishedAt`, `proposalShareToken`, and `Document.proposalVersionId`.

### The four properties, each proved against the live database

| Property | How it was proved |
|---|---|
| **Append-only** | Not by noting the module has no update path — by **watching Postgres refuse a second write of version 1** (`P2002` on the unique `(ideaId, versionNumber)`). |
| **An unchanged proposal mints nothing** | Two consecutive `mintVersion` calls, second returns `created: false` and one version row exists. |
| **A shared link resolves to the version that was shared** | Publish v1 → edit the proposal → mint v2 → the resolver still returns **v1**, and the recipient's *content* is still the old content. |
| **COMMUNITY grants a read on a published version and nothing more** | A community peer reads the published version; a non-member gets `not_in_community`; a signed-out reader gets `sign_in_required`. |

⚠ **The `contentHash` is compared against the LATEST version only**, deliberately. Reverting an edit
legitimately reproduces an older hash, and that must still be recordable — so the index on
`contentHash` is not unique.

⚠ **The share token is minted once and kept across re-publishes.** Rotating it would silently break
a link already sitting in an MP's inbox — the exact failure this feature exists to avoid. Asserted:
withdraw → re-publish → same token, and the pin has moved to v2.

⚠ **The version key is in the R2 object path** (`_exports/{ideaId}/v{n}/proposal.pdf`). Without it, a
re-render for v3 would overwrite the object a recipient's v1 link points at, and **their document
would change under them without the URL changing** — the same failure the pin prevents, arriving
through the storage layer instead. Asserted: v2 renders to a different key.

**The community read is in exactly one function.** `sharesCommunityWithOwner` is the only place in
the document stack that reads `CommunityMember` for an idea. The working proposal is reached only
through `authorizeIdea`, whose predicate is owner-or-collaborator. ⚠ **That half is a STRUCTURAL
assertion, and says so** — the check confirms the peer holds no collaborator row and that
`authz.ts` contains no reference to communities at all. It does not exercise an HTTP request, which
would need a Clerk session this script cannot mint.

---

## §3 — the two documents

**Two renderers over one block model, as the brief asked.** Sprint 2.5's `model.ts` says in its own
header that the Initial Background is the first thing built through it and §20-B is meant to be the
second. So this is a new *builder* — snapshot in, `DocumentModel` out — and `renderDocx` /
`renderPdf` learn nothing about proposals.

**3a. The Proposal.** Diagnosis (problem → who's affected → causal tree with the root cause marked →
legal landscape → pivotal obstacle) → the approach (chosen, leverage, what it rules out, anticipated
responses, conditions) → what would be done (each action with its costs, and the legislative annex
inline where the instrument is legislative) → cost against the cost of the problem → the user's own
words → **what this proposal does not establish** → sources.

**3b. The Summary.** The six things §20.1 names — problem, pivotal obstacle, approach, what it rules
out, headline cost against problem cost, the ask — **1 page**, with the gaps line surviving at one
sentence and a link to the online view for depth.

### The content rules, and what each one caught

- ⚠ **The unsupported marker is deliberately NOT on every field, and both halves are asserted.** It
  marks *claims about the world* (problem, who's affected, root cause, legal landscape, pivotal
  obstacle). A guiding-policy field is a **decision**, not a claim — stamping "unsupported" on "we
  rule out a licensing regime" is a category error that trains the reader to ignore the marker where
  it means something. The check asserts both that an unsourced claim IS marked and that **a fully
  sourced proposal carries no marker at all** — otherwise the marker is decoration.
- **A cost figure with no basis renders as "no basis stated", never as a bare number.** A bare number
  in a document sent to a committee clerk reads as a costing.
- ⚠ **The headline cost REFUSES to sum a partial set.** If any action carries no implementation
  figure, the total is `null` and the Summary says "not costed in the record". A total that silently
  omits three of five actions is the single most dangerous number this document could carry.
- **A ruled-out option with no reason says "no reason recorded"**, and a dismissed issue with no
  reason names that absence — a decision with its reasoning stripped off is not self-explanatory.
- ⚠ **The gaps section is never empty.** A proposal with nothing to declare gets *"Nothing was
  recorded as unestablished on this proposal. That is the state of the record, not a claim that no
  gaps exist."* A missing section reads as an omission; an explicit statement reads as a fact, and
  only one of those is true.
- **The user's own knowledge is attributed, not blended.** `ownKnowledgeProvenance` exists exactly so
  testimony can be told apart from retrieved material; it renders as its own section, marked as
  unchecked testimony.
- **A fingerprint of exactly what was rendered.** `snapshotHash` over the snapshot, with
  `generatedAt` excluded — otherwise every read looks like a change and every read mints a version.
  Asserted, with a self-test break.
- ⚠ **A file rendered from a stored VERSION can never be stale** and is reported as such; only a
  working-draft render can drift. That is a consequence of the key carrying `v{n}` and the snapshot
  never being rewritten, not a promise.

**Readable, not merely well-formed.** Both files are parsed back and their prose, citations, source
URLs, provenance line and unsupported markers read out of them — in the docx via mammoth and in the
PDF via the app's own parser.

**3c. Scaffolded, not half-built** — declared in the snapshot itself (`snapshot.scaffolded`), with
what each would read from, so building one is reading a field rather than rediscovering a design:
the **Evidence Pack** (blocked on the missing `excluded` source state, above), the **Online View**,
and the **Legislative Annex as a standalone** (§20-E; it renders inline today).

⚠ **`/proposals/[token]` is the link resolver made visible, and says so — it is NOT the Online
View.** It shows which version the link is pinned to, the headline, the gaps figures, and the two
documents. Half an Online View would be worse than none: a recipient who reads a partial web
rendering and never opens the PDF has read a partial proposal without being told so.

---

## §4 — THE RECOMMENDATION CHARLIE ASKED FOR

**Question:** should 20-C's claims check and source curation become a section of the review agenda
(25.3), or is publishing a genuinely separate moment deserving its own gate?

**Recommendation: MERGE them into the agenda, and give publishing a thin confirmation rather than a
second gate.** Three reasons, in order of weight.

1. **The design document has already decided it, and I do not think it was noticed.**
   `LEX_REBUILD_DESIGN.md` §25.3, item 9 of the agenda, reads: *"**Claims check** — Every factual
   assertion listed against what backs it … **(Absorbs §20.2's claims check; it belongs here.)**"*
   That line is in the spec 25-C is building from **right now**. Building 20-C as a separate screen
   would ship the same surface twice from one document.

2. **Two "check your work" screens compete for the same attention and lose.** Both are "here is what
   needs your attention before this goes out". A user who has worked an agenda to zero and is then
   shown a second list of the same shape will read the second one less carefully than they read the
   first — which is exactly backwards, because the second one is the one immediately before the
   document leaves the building.

3. **Building it, the structural half of the claims check turned out to be free and already
   present.** `snapshot.coverage` computes "N of M settled kernel fields and K of L actions carry no
   source" deterministically, with no model call, from `EvidenceItem.fieldRef`. That is the claims
   check's skeleton and it exists today. What 20-C would add on top is the *prose-level* inventory —
   Lex reading the draft and listing its assertions — and that is an agenda item, not a page.

**But one thing in 20-C is genuinely not in the agenda and must not be lost.** The agenda is
**per-idea and continuous**; curation is **per-artefact and frozen**. "Include or exclude this
source" is a property of *what goes out*, and 20-D has just made "what goes out" a version. So:

> **Publishing gets a confirmation step, not a gate:** a read-only summary of whatever the agenda
> still has outstanding at the moment of publish, **pinned into the version**. It asserts nothing new
> and asks nothing new; it records what was unresolved when this version was sent.

That is also what makes §24.4's *"12 of 14 findings resolved since"* computable rather than asserted
— and `describeChange` already computes exactly that sentence, from two stored snapshots, with no
model call. It is running today.

**Prerequisite either way:** the `excluded` state on a source (§20.2.1) does not exist in the schema.
Wherever curation lands, that column lands with it.

---

## What is NOT done, named

- **The Evidence Pack, the Online View and the standalone Legislative Annex** — scaffolded in the
  snapshot with their inputs defined, deliberately unbuilt (§3c).
- **20-C itself** — out of scope by the brief; the recommendation above is reported, not implemented.
- **The known-unknowns collapse** — reads uncollapsed until 25-C's helper is committed.
- **The `excluded` source state** — required by §20.2.1, absent from the schema, reported not added.
- **Per-claim source attribution at the sentence level.** Support is asserted per *field, cause and
  action*, not per sentence. A field with one source and four assertions shows as supported. That is
  the honest limit of a structural check and it is what 20-C's prose-level claims inventory is for.
- ⚠ **No browser walk was possible from here** — the extension has no host permission for localhost
  and there is no Clerk session on production — **and none is claimed.** What to click is below.

---

## ▶ CHARLIE — the browser walk

1. Open any idea with a kernel → **Documents/Exports** tab → **"Open publishing"**.
2. Press **Generate** on The Proposal and on The Summary; download both PDFs. The Summary should be
   one to two pages; the Proposal should carry *"Not evidenced — no source in the record backs
   this"* wherever a claim has none, and a *"What this proposal does not establish"* section that is
   never empty.
3. **Save a version**, then press it again without changing anything — it must say *"Nothing has
   changed … so no new version was made."*
4. Press **Anyone with the link**, open the share link in a private window. Note the version number.
5. Go back, edit one kernel field, and reload the share link in the private window. **It must still
   show the old version and the old content.** Then publish again and reload — now it moves.
6. Press **Withdraw** and reload the link — it must refuse.

**Nothing needs a Vercel environment variable.** There is no flag on this sprint.
