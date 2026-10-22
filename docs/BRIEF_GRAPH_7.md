# BRIEF_GRAPH_7 — THE IDEA↔LAW JOIN AND ITS PANELS

Stream: Graph · Written 22 Oct 2026 by CCh-Search
Depends on: GRAPH_6 (effects reader) — built, **not yet pushed**
Blocks: Lex 26-U's write path · the marquee-idea demonstration page

**This brief is self-contained.** The table definition below supersedes
`IDEA_LAW_JOIN_SPEC.md` §1.1 (amended 22 Oct with Lex). Nothing else in that
document changes; §2 (the law list), §3 (the quotation shape) and §5 (stated
positions) are unaffected and are not in this sprint.

---

## PURPOSE

Our graphs are indexed by Act and by vote. Ideas are attached to no Act. The
panels are therefore empty for every idea in the database and have been since
they were built. This is a missing join, not a bug. Build the join.

## WHY THIS MATTERS (include in the commit message)

A user who opens an idea sees an empty graph panel and concludes we have no
graph. We hold 1.29m legislation edges, 566k case-to-case links and 2.3m
recorded acts. The only thing missing is a row saying which laws the idea
concerns. Everything downstream — consequential effects, voting records,
quotations, precedents — hangs off that one row.

---

## 1. THE TABLE

```sql
create table idea_law_link (
  id              text        primary key,
      -- uuid, generated the way the repo's other Lex-written tables generate
      -- theirs. Lex writes here through Prisma, so one convention across the
      -- table, not a bigserial id with uuid foreign keys.

  -- what it belongs to
  idea_id         text        not null references "Idea"(id),
  action_id       text        null     references "LexCoherentAction"(id),
      -- null  = attached to the idea as a whole (Charlie's hand rows)
      -- set   = attached to one coherent action (Lex's 26-U rows)
      -- The idea's set is the union of its own rows and its actions' rows.
      -- action_id MUST survive the union: the panel has to be able to say
      -- WHICH action amends section 149, not merely that something does.
      --
      -- ⚠ VERIFY BOTH TABLE NAMES IN THE PRISMA SCHEMA BEFORE WRITING THE
      -- MIGRATION. "Idea" and "LexCoherentAction" are the model names as
      -- relayed to me. If either is mapped (@@map) to a snake_case table,
      -- the quoted name above is wrong and the migration will fail — or
      -- worse, succeed against something else. Do not trust this brief for
      -- those two names; read the schema.

  -- the target, in legislation.gov.uk form
  target_kind     text        not null,
      -- 'act' | 'provision' | 'instrument' | 'bill' | 'document'
  doc_uri         text        not null,
      -- 'ukpga/2010/25'   — type/year/number. No host. No leading slash.
      -- 'uksi/2015/1862'  — instruments take the same form.
      -- target_kind='bill'     → the Bills API id, prefixed: 'bill/3812'
      -- target_kind='document' → a stable slug: 'doc/civil-service-code'
  provision_path  text        null,
      -- 'section/5' · 'part/1' · 'schedule/2/paragraph/3'
      -- null when target_kind='act' (the whole Act is the target)
      -- legislation.gov.uk's own path segments, lower case, singular.

  -- how the idea stands to the law
  relation        text        not null,
      -- 'amends' | 'repeals' | 'modifies' | 'relies_on'
      --          | 'constrains' | 'precedent' | 'context'

  -- provenance
  source          text        not null,
      -- 'hand' | 'drafting_instruction' | 'extraction'
  source_detail   text        null,
      -- 'charlie 2026-10-22' | the drafting instruction id | the extractor
  note            text        null,
      -- One line, human words: why this link exists.
      -- Required for source='hand'. A hand row with no reason is a row
      -- nobody can audit in six months.

  -- time
  as_at           date        not null,
      -- The version of the law this was asserted against. NOT the ingest
      -- date. Lets the panel say "attached against the law as at 22 Oct
      -- 2026; two of these provisions have been amended since" without
      -- re-checking every row on every read.
  created_at      timestamptz not null default now(),
  superseded_by   text        null     references idea_law_link(id)
      -- Attachments are never deleted. A wrong attachment is a fact about
      -- our process and we keep it. Same pattern as position_signal.
);

create index on idea_law_link (idea_id)                    where superseded_by is null;
create index on idea_law_link (doc_uri, provision_path)     where superseded_by is null;
create index on idea_law_link (action_id)                   where superseded_by is null;
```

### 1.1 Changes from IDEA_LAW_JOIN_SPEC.md §1.1, and why

| | Was | Now | Why |
|---|---|---|---|
| `id` | `bigserial` | `text` uuid | Lex writes through Prisma; one id convention across the table |
| `idea_id` | `bigint references ideas(id)` | `text references "Idea"(id)` | Lex's actual schema |
| `action_id` | `bigint references idea_actions(id)` | `text references "LexCoherentAction"(id)` | Lex's actual schema |
| `relation` | six values | seven — adds `modifies` | Mirrors the effects vocabulary; see §1.3 |

### 1.2 Which it is: Prisma model or raw SQL migration

**Determine this from the repo, don't choose freshly.** Lex writes to this
table through Prisma, so the Prisma schema must know about it or Prisma's
schema drifts from the database and the next `migrate` fights us.

Follow whatever the repo already does for tables Lex writes to, and **name
the choice in the report** along with the migration file path. If the repo's
pattern is a Prisma model, generate the migration rather than hand-writing
the SQL above; the SQL is the specification of intent, not the artefact.

### 1.3 `relation` drives the panel — seven groups, rendered separately

This is the column that makes the panel useful rather than overwhelming. Do
**not** concatenate these into one "related legislation" list: that produces a
list of hundreds and tells the reader nothing.

| relation | what it means | what the panel shows |
|---|---|---|
| `amends` | the action changes this text | **onward effects** from GRAPH_6 — what else changing this knocks on to |
| `repeals` | the action removes it | onward effects, plus everything that relies on it |
| `modifies` | the action applies the provision *as if* altered, without changing its words ("applies as if") | the provision and the stated modification, **visually separate from `amends`** |
| `relies_on` | the action uses a power or framework here without changing it | the enabling power and what has been made under it |
| `constrains` | this law limits what the action may do | the constraint, and cases interpreting it |
| `precedent` | this law already does this, elsewhere | the comparison — how the same mechanism was drafted before |
| `context` | relevant, no legal operation | a link, nothing computed |

⚠ **`modifies` is now the same word in two places and they carry very
different confidence. Do not let the panel blur them.**

- An idea's `modifies` row is a deliberate, author-stated drafting choice. We
  know exactly what it means because a human wrote it down.
- The corpus's `modifies` edges are often unread: GRAPH_6 found **46.1% of
  180,781 `modifies` rows unclassified** — 23,278 with no recorded type at
  all, the rest bare abbreviations the classifier rightly refused to guess at.

Never sum the two. Never show them in one list. An idea's modification is a
decision; a corpus modification is frequently an abbreviation nobody has read.
Presenting them together would be exactly the error the standing rule names:
*a count of rows filed under a type is not a count of that thing.*

---

## 2. THE READER

One function, read-only, beside `inboundFor()` in `statutory-graph.ts`.
Reuse `gidCandidates()` for document resolution and GRAPH_6's `effectsFor()`
for the onward effects on `amends` and `repeals` rows.

```
ideaLawSet(ideaId) -> {
  rows: IdeaLawLink[],          // all live rows, idea's own + its actions'
  grouped: {
    amends: Row[], repeals: Row[], modifies: Row[], relies_on: Row[],
    constrains: Row[], precedent: Row[], context: Row[]
  },
  freshness: {
    asserted_as_at: date,       // oldest as_at in the set
    changed_since:  Row[]       // rows whose provision has edges dated later
  },
  unresolved: Row[]
}
```

`unresolved` is load-bearing. A reference to an Act we do not hold must come
back as **"named, not held"**, distinguishable from **"no such Act"** and from
**"lookup failed"**. Three different facts. Silently returning an empty list
for any of them is the failure we have already made twice.

---

## 3. THE HAND-ATTACH PATH

Charlie attaches the first rows. A script taking a simple file — one row per
line: `relation, doc_uri, provision_path, note` — is sufficient and preferable
to a UI for a dozen rows.

`source='hand'`, `source_detail='charlie <date>'`, `as_at` = the run date,
`action_id` null, `note` required.

---

## 4. PANEL WIRING

The idea page reads `ideaLawSet()` and renders the seven relation groups as
separate sections, with GRAPH_6's per-type effect counts on the `amends` and
`repeals` groups — including the change-the-words split, never the bare count.

---

## CONSTRAINTS

**a. Verify every `doc_uri` against the corpus before insert, and fail the
insert on a miss rather than storing it.** The ids in the law list are
proposed from knowledge, not read from the corpus. A wrong id joins to the
wrong Act and **nothing visible goes wrong** — the worst kind of error
available here. Report, per row: held / named-but-not-held / no-such-id.

GRAPH_6 proved this necessary: the Offences against the Person Act 1861 is
recorded under its regnal form for effects and its calendar form for
citations, and has no title in `corpus_acts` at all. Expect the same shape of
surprise.

**b. Verify the two Prisma table names in the schema** before the migration.
See the note in §1.

**c. `action_id` must survive the union.** Which action, not merely that
something does.

**d. `relation` must drive the panel.** Seven groups, rendered separately.

**e. An idea's `modifies` and the corpus's `modifies` are never summed and
never shown in one list.** See §1.3.

**f. A Bill is not an Act.** `target_kind='bill'` rows must never be passed to
the effects reader and must render labelled *"before Parliament — not yet
law"*.

**g. `unresolved` is a result, not an error**, and must be distinguishable
from both "no such Act" and "lookup failed".

**h. State what you counted.** Every guard reports rows examined and rows
asserted on. A check that cannot distinguish "zero counter-examples" from
"zero rows read" is not a check.

**i. The check must be able to fail.** Break the reader deliberately in two
ways and report how many cases go red, then revert. GRAPH_6 did this and it is
now the standard.

---

## REPORT

1. Which schema route you took (Prisma model or raw migration) and the
   migration file path.
2. The two verified Prisma table names, as read from the schema.
3. `ideaLawSet()` output for the marquee idea once Charlie's rows are in,
   with the held / named-not-held / no-such-id split.
4. GRAPH_6 per-type effect counts for every Act in the `amends` group.
5. The mutation run: which deliberate breaks, how many cases red, reverted.
6. Anything the data said that this brief got wrong. GRAPH_6 found five such
   things and each one changed a decision; that section was the most useful
   part of the report.
