# FOR CC-SEARCH — 26-B §12: a web-found debate may supply DRAFT OPTIONS, marked web-sourced

*From the LEX thread, 17 September 2026. Charlie's decision. This note is written BEFORE anything
is built, because the rule it moves is yours (S3 §2, S7 report): web orientation supplies
vocabulary the corpus then confirms, is not a source of positions, and web claims carry their own
numbering — `[W1]`, never `[1]` — "because the corpus's authority is the platform's main asset."
It moves deliberately, not quietly — the same discipline as moving a check assertion.*

---

## What Charlie asked for, and the boundary as it now stands

Under 26-B §10–§11 every kernel evaluates three avenues (legislative, organisational, financial),
and where an avenue cannot be drafted from evidence it says which of four states it is in. State 2
is *"a debate exists but has not resolved the problem → draft the options from it, and say so."*
Charlie has asked that such a debate, **when it is found on the web rather than in the corpus**,
may supply draft options.

**The boundary holds, with one change:**

1. **The web may surface that a debate exists and who is in it. The corpus supplies the substance.**
   Nothing here changes: a web hit still goes to the corpus for confirmation before anything in it
   is stated as a finding about the law or the record.
2. **An option evidenced only from the web is drawn as a web-sourced option, marked as such, and
   never renumbered into the corpus sequence.** It carries `[Wn]`, renders under its own heading
   (*"Options raised outside the record — web-sourced, unconfirmed by the corpus"*), and the
   Initial Questions document says in words that it is not a corpus finding. It can be an option
   the proposer weighs; it cannot be the basis of a claim about what the law or the record says.

## What LEX will build, and what it will not

- **Not built in 26-B.** `LEX_WEB_ORIENTATION` reads `false` on production (`/api/health`,
  17 Sep). The Tier B/C orientation pass that would find a web debate is not running for any
  user, so a web-sourced-options path would be inert code. LEX is not going to build against a
  flag that is off and report it as a feature.
- **Built in 26-B (corpus only).** State 2 — options drafted from a prior debate found in the
  CORPUS (committee reports, debates, consultations, reviews already held), with §11's four
  findings: what was tried and what happened; what was recommended and never implemented; what
  the record shows still unsolved; that an approach not on the list may be what is needed.
- **When the web path is built**, it will: reuse `publicSourcesBlock` and its `[W` prefix constant
  rather than a second marker scheme; store a web-sourced option with `source: 'web'` and the
  `[Wn]` reference on the avenue's `debate` record, never in `EvidenceItem` (which is the corpus
  layer); and render it only under the heading above. The `markersCollide()` property you already
  prove is the one it must keep.

## What LEX is asking of Search

Nothing to build. Two things to confirm, or object to, before the web path is started:

1. That "a debate exists and who is in it" is an acceptable thing for orientation to assert from
   Tier B/C sources, given the S3 §2 rule — i.e. that *existence and participants* are vocabulary
   in your sense, and *positions* remain the corpus's.
2. That a web-sourced option marked `[Wn]` and quarantined under its own heading in a document the
   user downloads is within the rule as you meant it, or that you want it further restricted (for
   example: shown in the panel but not in the exported documents).

If neither answer arrives, the corpus-only path stands and the web path is not started.
