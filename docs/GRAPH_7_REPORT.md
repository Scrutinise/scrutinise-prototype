# GRAPH 7 — THE IDEA↔LAW JOIN AND ITS PANELS — REPORT

Stream: Graph · 22 Oct 2026, 02:06 UTC · Brief: `docs/BRIEF_GRAPH_7.md` (authoritative; `IDEA_LAW_JOIN_SPEC.md` §4 superseded)

**State: built; table live on Neon (0 rows); schema + migration committed locally as `8fb2e80`; the rest uncommitted; NOTHING pushed; NOT verified live.** Charlie's rows are **not** written: the draft list is verified by a dry run, and `--write` is his.

---

## 0. What was built, as built (the evidence the confirmation asked for)

### `\d idea_law_link`, as read back from `information_schema` / `pg_constraint` / `pg_indexes` on `ep-old-dust-aboxi69a` after applying

```
id              text                      not null
idea_id         text                      not null
action_id       text                      null
target_kind     text                      not null
doc_uri         text                      not null
provision_path  text                      null
relation        text                      not null
source          text                      not null
source_detail   text                      null
note            text                      null
as_at           date                      not null
created_at      timestamp with time zone  not null  default now()
superseded_by   text                      null

idea_law_link_pkey                PRIMARY KEY (id)
idea_law_link_idea_id_fkey        FOREIGN KEY (idea_id)       REFERENCES "Idea"(id) ON DELETE RESTRICT
idea_law_link_action_id_fkey      FOREIGN KEY (action_id)     REFERENCES "LexCoherentAction"(id) ON DELETE RESTRICT
idea_law_link_superseded_by_fkey  FOREIGN KEY (superseded_by) REFERENCES idea_law_link(id) ON DELETE RESTRICT
idea_law_link_relation_check      CHECK (relation = ANY (ARRAY['amends','repeals','modifies','relies_on','constrains','precedent','context']))
idea_law_link_source_check        CHECK (source = ANY (ARRAY['hand','drafting_instruction','extraction']))
idea_law_link_target_kind_check   CHECK (target_kind = ANY (ARRAY['act','provision','instrument','bill','document']))
idea_law_link_hand_note_check     CHECK (source <> 'hand' OR (note IS NOT NULL AND btrim(note) <> ''))
idea_law_link_provision_check     CHECK ((target_kind = 'provision') = (provision_path IS NOT NULL))
idea_law_link_doc_uri_check       CHECK (no host / leading slash; bill → ^bill/[0-9]+$; document → ^doc/<corpus>/<id>; else type/year/number)
idea_law_link_not_self_superseded CHECK (superseded_by IS NULL OR superseded_by <> id)

idea_law_link_idea_live_idx    btree (idea_id)                  WHERE (superseded_by IS NULL)
idea_law_link_target_live_idx  btree (doc_uri, provision_path)  WHERE (superseded_by IS NULL)
idea_law_link_action_live_idx  btree (action_id)                WHERE (superseded_by IS NULL)
rows: 0
```

The table did not exist before this sprint (`to_regclass('public.idea_law_link')` was null), so **no numeric version was ever created** and there was nothing to drop.

### The two table names, as read from the schema

| Brief's name | Read from | `@@map`? | Table |
|---|---|---|---|
| `"Idea"` | `scrutinise-web/prisma/schema.prisma:700` — `model Idea {` | none | `"Idea"` |
| `"LexCoherentAction"` | `scrutinise-web/prisma/schema.prisma:3046` — `model LexCoherentAction {` | none | `"LexCoherentAction"` |

(Line numbers as read before this sprint's edits; the model block was searched for `@@map(` and none exists — `check:idea-law` A3 asserts both every run.) ⚠ Two near-misses exist and were not used: the legacy `model CoherentAction` (line 1075, the old Stage-2 table) and `model ActionIdea` (line 3020, held suggestions). `LexCoherentAction` is the Page-4 action record Lex 26-U writes.

### The seven relation values, as enforced

**A database CHECK constraint** (`idea_law_link_relation_check`, above) is the enforcement: `amends | repeals | modifies | relies_on | constrains | precedent | context`. The application's copy is `LAW_RELATIONS` in `lib/lex/idea-law-pure.ts`; `check:idea-law` A2 reads the constraint back from `pg_constraint` and fails if the two lists differ. `check:idea-law` C8 proves the database refuses `relation = 'affects'`.

---

## 1. Schema route and migration path

**Prisma model + a hand-written additive SQL file applied with `scripts/apply-sql.ts`** — the repo's existing pattern for every Lex-written table (`ActionDigest`, `LexCoherentAction`'s 26-Q columns, …: "DDL of record: prisma/<file>.sql"). `prisma migrate` is not used for these (§16, §21), so there was no migration to generate.

- Model: `IdeaLawLink` `@@map("idea_law_link")`, snake_case columns via `@map`, `@default(uuid())` ids, relations onto `Idea` and `LexCoherentAction` with `onDelete: Restrict`, and the self-relation for `superseded_by`. Back-relations `lawLinks` added to both models.
- DDL of record: **`scrutinise-web/prisma/graph_7_idea_law_link.sql`**. `whichdb` first (Neon production, `ep-old-dust-aboxi69a`), applied, read back.
- ⚠ **The three indexes are PARTIAL**, which Prisma cannot declare — so they are in the `docs/CLAUDE.md` §21 register (now 13 entries) and asserted by `check:idea-law` A4. ⚠ `check:central`'s own enumeration (`check-central-stage1.ts`, Central's file) does not list them; I did not edit another stream's check.
- Committed together, first, as `8fb2e80` (local; see §7).

## 2. (See §0 — the names table.)

## 3. `ideaLawSet()` for the marquee idea

**Not yet run on 452c5ade itself, because Charlie's rows are not in** — the real idea returns `rows: 0` (cold read, `check:idea-law` E1). The output below is `ideaLawSet()` on a **scratch copy** of 452c5ade carrying exactly the 20 draft rows (`docs/FOR_CHARLIE/graph7_idea_law_rows_452c5ade.txt`, the spec's §2.3 + §2.4), deleted afterwards. Resolution and figures are identical to what the real idea will return once written.

**held 20 · named-not-held 0 · no-such-id 0 · lookup-failed 0** (link rows examined 20, superseded 0; effects rows counted 105)

| group | rows |
|---|---|
| amends (3) | CRaG 2010 (ukpga/2010/25) · Civil Service (Management Functions) Act 1992 (ukpga/1992/61) · Government Resources and Accounts Act 2000 (ukpga/2000/20) |
| repeals (0) | — |
| modifies (0) | — |
| relies_on (6) | National Audit Act 1983 · Budget Responsibility and National Audit Act 2011 · FOI Act 2000 · Public Interest Disclosure Act 1998 · Inquiries Act 2005 · Procurement Act 2023 |
| constrains (2) | Employment Rights Act 1996 · Equality Act 2010 **s.149** (provision held: `section-149`) |
| precedent (8) | Building Safety Act 2022 · FSMA 2000 · Financial Services (Banking Reform) Act 2013 · Corporate Manslaughter and Corporate Homicide Act 2007 · Local Government Act 1972 **s.151** · Local Government and Housing Act 1989 **s.4** and **s.5** |
| context (1) | `bill/4019` — Public Office (Accountability) Bill, held as text (10 of 10 publications, bills-api), rendered *"before Parliament — not yet law"*, never passed to the effects reader |

Every one of the 18 Act ids proposed "from knowledge" names the Act the spec meant: the check compares each title read from `corpus_acts` against the spec's own name for it (B1, 45 assertions). The Bill id was looked up on the Bills API (one result, `billId 4019`, currently in the Lords). Freshness: `asserted_as_at 2026-10-22`, `changed_since: []` — see §6.4 for why that empty list cannot mean what it seems to.

## 4. GRAPH_6 per-type counts for every Act in the amends group

Inbound — changes **made to** each Act — from the official record, each with the change-the-words split:

| Act | amends | repeals | modifies |
|---|---|---|---|
| CRaG 2010 (ukpga/2010/25) | 10 — 10 change the words · 0 do not · 0 unclassified | 12 — 12 · 0 · 0 | 10 — 0 · **7 do not** · **3 unclassified** |
| Civil Service (Management Functions) Act 1992 (ukpga/1992/61) | 4 — 4 · 0 · 0 | 1 — 1 · 0 · 0 | 3 — 0 · 3 · 0 |
| Government Resources and Accounts Act 2000 (ukpga/2000/20) | 25 — **20** · **5 do not** · 0 | 31 — 31 · 0 · 0 | 9 — 0 · 5 · **4 unclassified** |

Every figure is a true SQL total for that Act and equals a separate plain-SQL count in `check:idea-law` C4. Caveat on all three, generated: *stored copy of legislation.gov.uk's changes record, last refreshed 2026-07-05 (108 days ago)*. ⚠ The corpus's `modifies` here (7 of 22 rows across the three Acts unclassified) is shown **only** inside an amends row's figures and never in, or summed with, the idea's own `modifies` group (constraint e).

## 5. The mutation run

Two deliberate breaks to the real reader (`ideaLawSet` in `statutory-graph.ts`), run one at a time, each reverted exactly (`grep MUTATION` empty; clean run 22/0 after):

| Break | Cases red |
|---|---|
| **M1** — the Bill guard removed (`isLegislation = true`), so a Bill filed under amends reaches `effectsFor` | **2 of 22**: C3, D1. ⚠ On the first run only **C3** went red: the rendered panel drew a Bill carrying "changes already made to it" and D1's predicate did not look. Tightened (a Bill row must carry no effects block), re-run: 2 red. |
| **M2** — `modifies` filed under `amends` (the exact blur constraint e names) | **4 of 22**: C1 (partition), C4 (a modifies row acquired effects), C5 (modifies group empty), D1 (modifies block absent) |

Plus **6 controls, all fired**: each shared predicate fed a deliberately broken input (a row in the wrong group, a dropped row, a split that does not add up, a Bill given effects, corpus figures in the modifies group, a Bill rendered as an Act) and returned false.

**`check:idea-law`: 22 cases, 22 passed, 0 failed, 0 NOT RUN · 378 rows examined, 29 synthetic inputs, 212 assertions · controls 6/6 fired.** Teardown re-reads: 27 fixture link rows deleted, 0 left, scratch idea hard-deleted. B6 asks the real publishers (`--offline` reports it NOT RUN).

Regression after the change: `check:effects` 30/30, 27,403 assertions over 9,889,959 rows, 8/8 controls · `check:statutory` 17/0 · `check:client-boundary` ✓ (control fired) · `tsc --noEmit` 0 · `check-clean-build.sh --fast` PASS. **Not run:** the full clean build (check B), `verify:statutory-parity` (red before this sprint from GRAPH 5, untouched), any real-browser look at the panel.

## 6. What the data said that the brief got wrong

1. **legislation.gov.uk answers 400, not 404, for an id that names nothing.** `ukpga/2099/999/data.xml` → 400; `ukpga/2010/25/data.xml` → 200 (measured 22 Oct). A resolver testing for 404 would have read every nonexistent Act as a *failed lookup* — exactly the conflation constraint g forbids. Both are read as no-such-id; anything else non-200 (503, a timeout) is lookup-failed. B2 asserts all six outcomes are distinct.
2. **`in_corpus = false` in `corpus_acts` is a fact about one id FORM, not about the Act.** The first named-not-held test subjects (`ukpga/1801/52`, `/63`, `/79`) are calendar forms of Acts we hold under their regnal form (`ukpga/Geo3/41/52`, 5 sections). The resolver bridged them and said **held** — correctly — and the check's subject choice was wrong. Of **17,261** register rows with `in_corpus = false`, an unknown share are this. Anything that reads that flag as "we do not hold this Act" under-reports; the resolver goes through `legislation_identity` first, and B3 now asserts the bridged case.
3. **"lower case" provision paths cannot be stored as the corpus holds them.** The corpus and the effects table record `schedule-1-paragraph-14A` and `part-III`. Paths are stored as legislation.gov.uk writes them and every comparison is case-insensitive (`schedule/1/paragraph/14a` resolves). Segment words stay lower case; identifiers keep their case. Conversion `section/149` → `section-149` is one function (`provisionRefOf`).
4. **`freshness.changed_since` cannot see what the brief wants it to see.** "Edges dated later" than `as_at`: the only dates in `legislation_edges` are `extracted_at` (one load, **5 Jul 2026**) and an official row's in-force date. Every `as_at` is 22 Oct, after the load, so no edge can be *recorded* later. The reader counts changes **coming into force** after `as_at`, and says in the same breath (`freshness.basis`) that a change made after 5 Jul is invisible. `changed_since: []` today means *"none commencing after 22 Oct in a July copy"*, not *"unchanged"*. The panel prints the basis.
5. **Parts and Chapters are not rows in our corpus.** `section/149` and `schedule/1` are checkable; `part/11` is not (the corpus has no part rows, only the sections inside them). Such a row is reported `provision: unaddressable` — the Act checked, the provision said to be uncheckable here — and the hand path accepts it. GRAPH_6's effects reader can count a Part (`part-III` appears in `legislation_edges`), the corpus cannot hold one.
6. **`doc/civil-service-code` cannot be verified, so it cannot be the form.** A free slug joins to nothing (constraint a). A document's `doc_uri` is the corpus's own key: **`doc/<corpus>/<document id>`**, e.g. `doc/govuk-core-docs/government/publications/civil-service-code` (held). A document has no public register, so "named, not held" can never be established for one; a miss is reported no-such-id *with that sentence*. Bills use the Bills API id as specified (`bill/4019`), verified against `bills-api` rows and, on a miss, the Bills API (404 → no-such-id).
7. **"Onward effects" is not what GRAPH_6 counts.** GRAPH_6's per-type figures (the brief's §4 and REPORT 4) are changes made **to** the Act. "What else changing this knocks on to" is the citation reach (`inboundFor`) and the Act's own outbound effects. The panel shows GRAPH_6's figures under the heading *"Changes already made to it, from the official record"* — what they are — rather than as onward effects.

## 7. Choices made, and what is open

- **Hand path is all-or-nothing.** One row not held → nothing written, exit 1, every row's state printed. Re-running an already-written file writes nothing (C8). `named-not-held` is refused like the others: "fail the insert on a miss". Rows that reach the table another way (Lex 26-U) are still resolved on every read and land in `unresolved` with their state.
- **Both FKs RESTRICT**, per "attachments are never deleted". ⚠ **For Lex 26-U:** `scripts/lib/scratch-copy.ts`'s `deleteScratch` hard-deletes an idea; once a scratch copy carries links, that delete is refused and it falls back to a soft delete. Delete the links first, as `check:idea-law` does.
- **The panel** (`components/lex/IdeaLawPanel.tsx`) sits under the Overview on `/ideas/[id]`, read server-side in `page.tsx`. An empty set says *"No law has been attached to this idea yet."*; a failed read says it could not read and *"this is not a statement that it concerns none"*. Bill title is not held in our corpus, so a Bill shows its id, note and label.
- **Commit:** `8fb2e80` (schema + SQL) is local. **Local `Main` also carries two other streams' unpushed commits** (`763c620` SEARCH-29, `2e72435` LEX), so a push ships them too — not done without Charlie's say. The rest of GRAPH 7 is uncommitted.

**Charlie's next action:** read `docs/FOR_CHARLIE/graph7_idea_law_rows_452c5ade.txt`, answer the spec's two open questions if they change a note, then from `scrutinise-web`:
`npm run attach:idea-law -- 452c5ade ../docs/FOR_CHARLIE/graph7_idea_law_rows_452c5ade.txt --write`
