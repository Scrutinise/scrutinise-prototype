# HANDOVER — Statutory Citation Graph → Search & Graph stream

**Built by:** CC-Graph, sprint 25-H (complete, pushed)
**Owner from now:** Search & Graph stream
**Docs already written:** `docs/CITATION_AUDIT.md` · `docs/crag_part1_inbound.json` · `SEARCH_STRATEGY.md` §9 Tier 1a

---

## 1. What this is, and why it exists

A graph of cross-references between pieces of legislation. Given an Act or a provision, it answers:
**which other provisions across the statute book refer to it?**

Plain terms: if you repeal or amend a law, every other law that mentions it now points at something
that has changed or vanished. Until this graph existed we could not list those. That list is the
core of any serious amendment or repeal analysis, and it is the reason the graph was built.

It is general-purpose. It was commissioned for a specific research programme but it is target-agnostic
— it holds every reference it found, not only those relevant to that programme. Treat it as a
platform capability, not a research artefact.

---

## 2. What is built and verified

**Table `citation_edge`** — 1,034,548 rows, 1,144 MB in Neon.

Every row carries `citation_text` (the literal words in the source) and `raw_fragment` (surrounding
XML), both `NOT NULL`. That is deliberate: an edge with no quotable source is a claim, not a fact.
Do not relax this constraint. Two detectors run and are kept apart in a `detection` column — never
sum them into an unlabelled total.

**Confirm the exact live schema before building on it.** The column list above is drawn from the
sprint brief and CC's report, not from reading the table. Read it first.

**Query surface:** `inbound(target_act_id, target_provision_ref, include_unresolved)` and
`inbound_summary(target_act_id)`.

**Verification that was actually run:**
- Hand check against legislation.gov.uk: 20 of 20 correct.
- Scale control: Equality Act 2010 → 1,868 inbound; Human Rights Act 1998 → 938; CRAG 2010 → 182;
  Down Syndrome Act 2022 → 13. The ordering is the control — a narrow recent Act must not outrank a
  broad old one.
- Pilot: CRAG 2010 Part 1 → 29 inbound references.

---

## 3. The finding that shapes everything downstream

**legislation.gov.uk's own machine-readable citation markup is roughly 2% complete.**

Measured across 6,045 documents: 5.4% of body mentions of the Human Rights Act carry a `<Citation>`
element, 1.8% for the Equality Act, and **0%** for CRAG 2010. On markup alone, "what refers to CRAG
Part 1?" returns two. The true answer is 29.

It fails silently — a short, confident, wrong list with no error and no gap flag.

**Standing principle, now in `CLAUDE.md`: an authoritative source's own metadata is a sample, not a
census.** Completeness is measured against the underlying text; it is never inferred from the schema.
Apply this to every new layer below before assuming any source's markup is usable.

Second, smaller finding: the markup, where present, never carries the provision. "section 53 of" sits
outside the element as plain text. Provision-level resolution is a text problem in every case.

---

## 4. Open items carried over

**OI-15 — 37% of Acts were never opened.** The July extractor's zip-entry filter requires a calendar
year in the entry name, so it skipped 1,650 pre-1963 Acts. Cause: UK Acts were cited by regnal year
("1 & 2 Eliz. 2") until the Acts of Parliament Numbering and Citation Act 1962 moved them to calendar
years from 1963. Proved by consequence — 0 of 121,279 `cites` edges have a regnal source, against
29,800 edges of other types.

Two things follow, and the second is the larger one:

1. It contaminates current inbound counts. The instinct that a Victorian Act cannot cite a 2010 Act
   is wrong: legislation.gov.uk serves *revised* text, so an old Act amended in 2012 can carry a
   modern reference inserted by that amendment. Magnitude unknown.
2. **Blast radius.** That extractor shipped in July. Anything else downstream of it has the same
   hole and nobody has checked.

**OI-18 — 93,772 act-name spans resolve to nothing.** Biggest single lever is short-form resolution
("the 1998 Act", "the principal Act"), which needs document-scoped context.

**OI-17 — withdrawn, not deleted.** A Neon storage alarm raised on a stale 17.5 GB figure that this
project had already retired twice. Storage is a bill, not a wall: `neon.max_cluster_size` is 16 TiB,
$0.35/GB-month against a $15/month budget. `citation_edge` costs about $0.40/month. **Do not
re-raise it.** Revisit table placement only if it passes ~10 GB or `inbound()` latency becomes
noticeable — on measurement, never on a remembered ceiling.

**Open question for this stream:** what is the relationship between `citation_edge` and the older
July `edges` table (the one holding 121,279 `cites` edges and 29,800 of other types)? Duplicate
storage, complementary, or one superseding the other? Answer before adding layers, or the layers get
added twice.

---

## 5. Immediate tasks (approved)

Run these before any layer work. State a numeric prediction in `CHANGE_LOG.md` before each one.

**T1 — OI-15 blast-radius audit.** List every consumer downstream of the July extractor and state,
per consumer, whether the 1,650-Act hole affects it. One page. This is the "what else did we get
wrong the same way" question.

**T2 — OI-15 quantification.** Re-run the extractor with the filter fixed, over the 1,650 missing
Acts only. Report the delta on the four control Acts. Prediction on file: **under 3% and non-zero.**
Under 3% → proceed and record the residual as a declared limitation. Over → fix before anything
consumes the graph.

**T3 — OI-18 clustering check (cheap).** What proportion of the 93,772 unresolved spans sit in
documents that also cite one of the twelve research targets? This decides whether short-form
resolution is urgent or merely wanted.

**T4 — Export hygiene.** CLML commentary handles are `key-` + 32 hex, byte-identical in shape to a
Mailgun API key, and trip GitHub secret scanning. The redaction is in place. Standing rule: **never
bypass secret scanning — change the data, not the guard.** A bypass, if ever genuinely needed, is
Charlie's decision and gets recorded with its reason.

---

## 6. Layer roadmap

Layer 1 (primary legislation → primary legislation) is built. The rest, in priority order.

### Layer 2 — Statutory instruments → legislation. **Highest priority.**
Most references to any Act sit in the instruments made under it. Until this exists, every consequence
list is systematically incomplete in a way the user cannot see — the same failure as the markup
problem, one level up. Expect several times the volume of Layer 1; size the table before building.

Capture the *enabling* relationship as a distinct edge type, not just textual reference: "this SI was
made under section X of this Act" is a different and stronger fact than "this SI mentions that Act",
and repeal analysis needs it separated. An SI whose enabling power is repealed may fall with it.

### Layer 3 — Statutory codes and quasi-legislation.
Codes of practice and guidance with statutory force: PACE codes, the Highway Code, the Civil Service
Code, FCA Handbook, HMRC manuals, College of Policing guidance. Two edge directions matter — the code
citing legislation, and the provision that gives the code its status.

### Layer 4 — Bodies (arm's-length bodies, regulators, quangos).
Not a citation edge. The useful facts are: which provision **establishes** this body, which provisions
**confer its powers and duties**, and which provisions **reference it**. Model as its own edge type
with `establishes` / `empowers` / `references` semantics. Without this, "what happens if we abolish
body X" is unanswerable.

### Layer 5 — International treaties and conventions.
Also not a plain citation edge. Legislation refers to treaties in at least five distinct ways, each
with a different consequence. Type them separately; do not flatten into "mentions".

| Relationship | Example | Why it differs |
|---|---|---|
| `incorporates` | HRA 1998 → ECHR | Treaty rights become directly enforceable domestically |
| `gives_effect_to` | Double Taxation Relief Orders → DTAs | Treaty operates through the instrument, not independently |
| `references` | Any Act mentioning a convention | Weakest link; often no operative effect |
| `conditions_on_adherence` | UK–EU TCA Part Three → continued ECHR adherence | Leaving the treaty triggers loss of the domestic arrangement |
| `permits_suspension` | TCA and Withdrawal Agreement dispute and rebalancing clauses | The counterparty's legal route to retaliate |

**`permits_suspension` is the one most likely to be skipped and the one worth most.** It is what turns
"the other side might react badly" — a guess — into "this article permits suspension of these
obligations on this notice" — a finding with a citation. Extract the dispute-settlement, rebalancing,
termination and safeguard clauses of the major treaties as first-class rows. Same evidence rule as
everywhere else: a predicted reaction with no clause and no documented precedent behind it is
speculation and must be labelled as such.

**Double taxation agreements — a useful special case.** The UK has roughly 130. They are given
domestic effect by Order in Council under TIOPA 2010 s.2, and **the treaty text is scheduled to the
Order**, so it already sits in the legislation corpus. Layer 2 delivers most of this for free if SI
schedules are ingested — confirm they are, because schedules are commonly dropped by extractors.

Two tax-specific traps to build for:

1. **Direction reverses.** TIOPA 2010 s.6 gives DTAs effect despite anything in any enactment. So for
   a tax proposal the useful query is not only "what does my change break" but "does a treaty already
   prevent this". The graph must be queryable in that direction.
2. **The scheduled text may not be the operative text.** The OECD Multilateral Instrument modifies
   many DTAs at once without amending each Order. A DTA read off legislation.gov.uk can therefore be
   out of date without saying so — the same silent-incompleteness failure as the citation markup.
   Where an MLI modification exists and is not held, the coverage block must say so.

Non-legislation treaty sources, where the corpus lacks the text: FCDO UK Treaty Series / UK Treaties
Online for the authentic texts; OECD for the MLI positions.

### Layer 6 — Case law → legislation. **Approved, with a mandatory user warning.**
Which cases cite which provisions. This is what makes questions about judicial interpretation
answerable at all.

**Coverage boundary, and it must be surfaced, not buried:** pre-2001 judgments are not held. BAILII
access was refused in writing; House of Lords judgments from parliament.uk and an ICLR licence for the
1873–1996 gap are the routes being pursued. Any case-law edge result shown to a user carries a plain
statement that coverage begins in 2001 and what that excludes. See §7 — the warning is generated from
live coverage state, never hardcoded.

### Not doing — Hansard and committee reports.
Low value for structural consequence analysis. High value for the separate opposition-mapping and
Central features. Different job, different sprint.

---

## 7. Non-negotiable: every result carries its own coverage statement

`inbound()` currently returns rows. It must also return **what it could not see**. A consequence list
is a claim about completeness, and this graph is knowingly incomplete in named, quantified ways.

Every call returns a coverage block alongside the rows: which layers were searched, which were not
yet built, the OI-15 residual, the unresolved-span count, and the case-law date boundary where
relevant. Generated from live coverage state — **never a hardcoded string**, because a hardcoded
caveat goes stale exactly the way the 17.5 GB figure did.

This is the platform's existing rule applied to a new surface: a gap that announces itself is better
than a gap that looks like an absence of evidence. A user reading a list of 29 must be able to see
what is not in it.
