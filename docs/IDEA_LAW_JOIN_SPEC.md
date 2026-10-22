# IDEA ↔ LAW JOIN — STORED SHAPE, LAW LIST, AND TWO BRIEFS

Author: CCh-Search · 19 Oct 2026
Status: specification of record for the idea↔law join. Supersedes nothing.
Audience: Lex (§1, §2), Graph (§1, §4), Search/Ingest (§3, §5), Charlie (§2).

---

## 0. WHY THIS DOCUMENT EXISTS

Lex asked the citator to name the shape it wants before Charlie hand-attaches
the first dozen Acts, so that his hand-attached rows are the first rows of the
join Lex's 26-U then fills automatically — not throwaway.

That is the right sequence. This document answers it.

One principle governs everything below, and it is the same principle as the
source split on `legislation_edges`:

> **A row must always say where it came from and what kind of thing it
> asserts.** A hand attachment by Charlie, a link derived from a drafting
> instruction, and a link guessed by a model are three different kinds of
> claim. Store them in one table, never in one indistinguishable column.

---

## 1. THE STORED SHAPE

### 1.1 Table

> **Amended 22 Oct 2026 with Lex.** Three changes: `id`, `idea_id` and
> `action_id` are text uuids against Lex's real models, and `relation` gains a
> seventh value, `modifies`. `BRIEF_GRAPH_7.md` carries the same definition and
> is the self-contained work order.

```sql
create table idea_law_link (
  id              text        primary key,   -- uuid, repo's own convention

  -- what it belongs to
  idea_id         text        not null references "Idea"(id),
  action_id       text        null     references "LexCoherentAction"(id),
      -- ⚠ Verify both model names in the Prisma schema before the migration.
      -- null  = attached to the idea as a whole (Charlie's hand rows)
      -- set   = attached to one coherent action (Lex's 26-U rows)
      -- The idea's set is the union of its own rows and its actions' rows.
      -- action_id must survive the union: the panel has to be able to say
      -- WHICH action amends section 149, not merely that something does.

  -- the target, in legislation.gov.uk form
  target_kind     text        not null,
      -- 'act' | 'provision' | 'instrument' | 'bill' | 'document'
  doc_uri         text        not null,
      -- 'ukpga/2010/25'   — type/year/number. No host. No leading slash.
      -- 'uksi/2015/1862'  — instruments take the same form.
      -- For target_kind='bill', the Bills API id, prefixed: 'bill/3812'.
      -- For target_kind='document', a stable slug: 'doc/civil-service-code'.
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
      -- 'charlie 2026-10-19' | the drafting instruction id | the extractor
  note            text        null,
      -- One line, human words: why this link exists.
      -- Required for source='hand'. A hand row with no reason is a row
      -- nobody can audit in six months.

  -- time
  as_at           date        not null,
      -- The version of the law this was asserted against. NOT the ingest
      -- date. Lets the panel say "attached against the law as at 19 Oct
      -- 2026; two of these provisions have been amended since" without
      -- us re-checking every row on every read.
  created_at      timestamptz not null default now(),
  superseded_by   text        null     references idea_law_link(id)
      -- Attachments are never deleted. A wrong attachment is a fact about
      -- our process and we keep it. Same pattern as position_signal.
);

create index on idea_law_link (idea_id) where superseded_by is null;
create index on idea_law_link (doc_uri, provision_path) where superseded_by is null;
```

### 1.2 Why each decision

**`doc_uri` and `provision_path` are two columns, not one URI string.**
The citator joins on document identity first, then filters by provision.
`gidCandidates()` already resolves document identity. One concatenated string
forces string-parsing at every read and breaks the moment legislation.gov.uk
changes a path segment.

**No host, no `http://www.legislation.gov.uk/id/` prefix.** That prefix is
presentation. Store `ukpga/2010/25`. If it is in the stored value, every
comparison has to normalise it first, and one day one row will not have been
normalised.

**The id, never the title.** We already found 419 calendar ids naming two
different Acts, each silently letting the last one win. Titles are ambiguous
and they change. The id is the only safe key. The title is a display label
fetched from the document, not a stored key.

**`relation` is not optional, because it drives what the panel does.**
These seven values behave differently, and collapsing them produces a panel
that says "your idea touches four hundred things", which helps nobody:

| relation | what it means | what the citator shows |
|---|---|---|
| `amends` | the action changes this text | **onward effects** — what else changing this knocks on to |
| `repeals` | the action removes it | onward effects, plus everything that relies on it |
| `modifies` | the action applies the provision *as if* altered, without changing its words | the provision and the stated modification, **kept visually apart from `amends`** |
| `relies_on` | the action uses a power or framework here without changing it | the enabling power and what has been made under it |
| `constrains` | this law limits what the action may do | the constraint, and cases interpreting it |
| `precedent` | this law already does this, elsewhere | **the comparison** — how the same mechanism was drafted before |
| `context` | relevant, no legal operation | a link, nothing computed |

`precedent` is the one Lex will want most for the Background Report. See §2.4.

⚠ **`modifies` is now the same word in two places, carrying very different
confidence.** An idea's `modifies` row is a deliberate, author-stated drafting
choice. The corpus's `modifies` edges are often unread — GRAPH_6 found 46.1%
of 180,781 of them unclassified, 23,278 with no recorded type at all. Never
sum the two and never show them in one list.

**`target_kind='bill'` exists so a Bill is never mistaken for law.** The
Public Office (Accountability) Bill has no `ukpga` id and no edges. Without
an explicit kind it gets forced into a wrong field or dropped. With it, the
citator knows not to look for effects and the panel labels it
*"before Parliament — not yet law"*.

**`target_kind='document'` exists for the Civil Service Management Code and
the Osmotherly Rules.** Lex is right that these are not law and will be cited
as documents in the notebook. The kind is offered, not insisted on: if Lex
holds them, do not duplicate them here. If you want them to appear in the
"what this touches" panel alongside the statutes, this is where they go, and
the panel can then say *"seven headings, of which two are not statutory"*
rather than relying on anyone's memory.

### 1.3 What the citator reads

One function, read-only, beside `inboundFor()`:

```
ideaLawSet(ideaId) -> {
  rows: IdeaLawLink[],          // all live rows, idea's own + actions'
  grouped: {
    amends:     Row[],
    repeals:    Row[],
    modifies:   Row[],
    relies_on:  Row[],
    constrains: Row[],
    precedent:  Row[],
    context:    Row[]
  },
  freshness: {
    asserted_as_at: date,       // oldest as_at in the set
    changed_since:  Row[]       // rows whose provision has edges dated later
  },
  unresolved: Row[]             // doc_uri we hold no document for — counted,
                                // never silently dropped
}
```

`unresolved` is load-bearing. A reference to an Act we do not hold must come
back as *"named, not held"*, distinguishable from *"no such Act"* and from
*"lookup failed"*. Three different facts. Silently returning an empty list for
any of them is the failure we have already made twice.

---

## 2. THE LAW LIST FOR THE MARQUEE IDEA

### 2.1 What the policy actually requires, legally

Charlie's Guiding Policy is materially wider than "civil service
accountability". Read it again for what it binds:

> *No work of any kind, at any scale, in any publicly funded body may begin
> or continue unless one named individual is personally accountable for it.*

Three features decide the law list:

1. **Scope is every publicly funded body**, not the civil service — so
   departments, agencies, arm's-length bodies, the NHS, local government,
   schools, police, and anything else drawing public money.
2. **The duty bites at the point work is assigned**, at every level, with no
   threshold — so it is a general duty in primary legislation, not an
   amendment to an existing scheme.
3. **An unmatched pair is void and the duty travels upward** — so it needs a
   voiding provision and an escalation route, which is unusual drafting.

### 2.2 The single biggest drafting decision

**There is no clean existing statutory definition of "publicly funded body".**
Whichever we pick becomes the boundary officials and lawyers litigate over,
and the policy explicitly rules out thresholds — so the definition carries all
the weight. The candidates:

| Candidate | Where | Character |
|---|---|---|
| "Public authority", FOI Act 2000 Sch. 1 | ukpga/2000/36 | Most used, most litigated, amendable by order — so maintainable |
| Bodies subject to the PSED, Equality Act 2010 Sch. 19 | ukpga/2010/15 | Narrower, already tied to a duty mechanism |
| "Contracting authority", Procurement Act 2023 | ukpga/2023/54 | Catches outsourced work, which the others miss |
| ONS public sector classification | not statutory | Economically correct, legally useless |

**Recommendation: FOI Schedule 1 as the spine, extended by the Procurement
Act's contracting-authority test for work done under contract.** Reason: FOI
Schedule 1 is amendable by order, so the boundary can be maintained without
primary legislation every time a new body is created — and the policy says
*"no work of any kind"*, which means outsourced work cannot be outside it.

This needs Charlie's decision. It is question 1 in the covering reply.

### 2.3 Acts to attach — the operative set

Verify every id against legislation.gov.uk before insert. The ids below are
proposed from knowledge, not read from the corpus; a wrong id is worse than a
missing one, because a wrong id joins to the wrong Act silently.

| # | Act | Proposed id | relation | Why |
|---|---|---|---|---|
| 1 | Constitutional Reform and Governance Act 2010, Part 1 | ukpga/2010/25 | amends | Civil service statutory footing; the code is made under s.5 |
| 2 | Civil Service (Management Functions) Act 1992 | ukpga/1992/61 | amends | Delegation of management authority — the "power and resources" half of the pair |
| 3 | Government Resources and Accounts Act 2000 | ukpga/2000/20 | amends | The accounting officer regime — the existing single-named-person mechanism |
| 4 | National Audit Act 1983 | ukpga/1983/44 | relies_on | NAO remit; how failure is examined |
| 5 | Budget Responsibility and National Audit Act 2011 | ukpga/2011/4 | relies_on | The modern NAO/PAC machinery |
| 6 | Freedom of Information Act 2000 | ukpga/2000/36 | relies_on | Both the scope definition (§2.2) and the visibility requirement |
| 7 | Public Interest Disclosure Act 1998 | ukpga/1998/23 | relies_on | A named owner denied resources needs a protected route to say so |
| 8 | Employment Rights Act 1996 | ukpga/1996/18 | constrains | The hire-and-fire action (#28) turns on it; conduct vs capability |
| 9 | Equality Act 2010, s.149 | ukpga/2010/15 · section/149 | constrains | ⚠ PSED is a **collective** duty on a body. See §2.5 |
| 10 | Inquiries Act 2005 | ukpga/2005/12 | relies_on | The blame-free-investigation carve-out |
| 11 | Procurement Act 2023 | ukpga/2023/54 | relies_on | Outsourced work; the contracting-authority test |
| 12 | Public Office (Accountability) Bill | bill/<id> | context | **Before Parliament, not law.** Flagged by Lex. Watch |

Dropped per Lex: Public Service Pensions Act 2013 — terms of employment out of
scope. Agreed.

### 2.4 ⚠ THE PRECEDENT SET — the most valuable addition

This is the part neither of us had and it changes the proposal.

**The UK already has at least five working statutory implementations of this
exact mechanism, in five different sectors.** The policy is not novel in
mechanism — only in universality. That is a strong place to argue from, and
it kills the *"this has never been tried"* objection outright. A committee
clerk's first question is *"what does this amend"*; the second is *"has
anyone done this before and did it work"*. We can answer both.

| Act | Proposed id | The mechanism it already contains |
|---|---|---|
| **Building Safety Act 2022** | ukpga/2022/30 | The *accountable person* and *principal accountable person* for higher-risk buildings: a named duty-holder, a mandatory written safety case before occupation, personal liability. **The closest existing model to the policy as written.** |
| **Financial Services and Markets Act 2000**, as amended by the **Financial Services (Banking Reform) Act 2013** | ukpga/2000/8 · ukpga/2013/33 | The Senior Managers and Certification Regime: senior management functions, **statements of responsibilities**, and a duty of responsibility. A statement of responsibilities *is* "a ruthlessly brief written statement of the task". Running since 2016 and evaluated. |
| **Corporate Manslaughter and Corporate Homicide Act 2007** | ukpga/2007/19 | The previous attempt to defeat the "the team was responsible" defence. Widely held to have failed to bite on large organisations. **The strongest objection we will face, and better raised by us than by a witness.** |
| **Local Government Act 1972, s.151** and **Local Government and Housing Act 1989, ss.4–5** | ukpga/1972/70 · ukpga/1989/42 | The chief finance officer, head of paid service and monitoring officer: named statutory post-holders with personal duties, in every local authority, since the 1970s. |
| **Health and Care Act 2022** (HSSIB and the safe-space regime) | ukpga/2022/31 | Statutory protection for blame-free investigation of system failure before individual fault — **precisely Charlie's carve-out, already drafted.** |

Attach all of these with `relation='precedent'`. The panel then answers
*"where does this already exist in law?"* without anyone writing an essay, and
Lex's Background Report cites the drafting instead of describing it.

### 2.5 Two tensions to put in the Background Report, not hide

**The PSED problem.** Equality Act 2010 s.149 imposes a duty on a *body*,
discharged collectively. The policy says responsibility is *"never shared
sideways"*. These are not reconcilable by drafting alone — either the policy
carves out duties that are collective by design, or it changes them. Lex
should put the question, not resolve it.

**Visibility is narrower than Charlie wrote, or wider.** The policy says a
named duty "can be seen by every person above them in their line". That is
*internal* visibility. FOI would make it *public*. Those are different
policies with different objections and Charlie has to pick one deliberately.
Question 2 in the covering reply.

---

## 3. STATED POSITIONS AND COMMITTEE QUOTATIONS — THE SHAPE

Lex asked that each quotation be filable into an idea's research as a numbered
source, and that per-speech attribution expose witness, date, committee and the
paragraph as the quotable unit. Both are satisfied by one table.

```sql
create table stated_position (
  id              bigserial primary key,

  -- who said it
  actor_id        bigint      null,   -- resolved identity, or null
  actor_name      text        not null,
      -- ALWAYS stored as published, even once resolved. Never overwritten
      -- with a resolved name — that is how you lose the ability to audit.
  actor_role      text        null,
      -- As given AT THE TIME. "Permanent Secretary to the Treasury" in 2019
      -- is a different person from 2026. Storing today's role is a lie
      -- about the past.
  org_id          bigint      null,
  org_name        text        null,

  -- where and when
  venue_kind      text        not null,
      -- 'committee_oral'|'committee_written'|'publication'|'debate'
  venue_name      text        null,   -- 'Public Administration and
                                      --  Constitutional Affairs Committee'
  inquiry_title   text        null,
  occurred_on     date        not null,

  -- what was said
  quote           text        not null,   -- VERBATIM. Never summarised.
  quote_unit      text        not null,   -- 'paragraph' | 'question'
  locator         text        not null,   -- 'Q142' | 'para 37'
  source_url      text        not null,
  licence         text        not null,   -- what we may do with it

  extracted_by    text        not null,   -- 'markup'|'pattern'|'model'
  created_at      timestamptz not null default now()
);
```

**There is no stance column, no direction, no score, and there will not be
one.** Agreed with Lex and with Charlie. A vote is a *revealed* position and
can be scored. A published sentence is a *stated* position and can only be
quoted. The one time we tried to infer stance from text we recorded Edward
Leigh as supporting assisted dying because he tabled an amendment against it,
and that single confusion invalidated 138 of 157 validation rows.

**`locator` is what makes a quote citable.** Without `Q142` a reader cannot
find the words in the source, and `[Ref: n]` in a Background Report becomes
unverifiable — the one thing Lex is built never to do. The research note must
carry locator **and** url, not just the quote.

**`licence` on every row, enforced before scoring, not flagged for a caller
to respect.** Structural, as with everything else.

---

## 4. BRIEF_GRAPH_7 — THE IDEA↔LAW JOIN AND ITS PANELS

> **Superseded 22 Oct 2026 by `BRIEF_GRAPH_7.md`**, which is self-contained
> and carries the amended table definition. The draft below is kept as the
> record of what was originally specified. Hand CC the standalone file.

```
BRIEF_GRAPH_7_IDEA_LAW_JOIN
Stream: Graph. Depends on: BRIEF_GRAPH_6 (effects reader).
Blocks: the marquee-idea demonstration page.

PURPOSE
Our graphs are indexed by Act and by vote. Ideas are attached to no Act. The
panels are therefore empty for every idea in the database, and have been
since they were built. This is a missing join, not a bug. Build the join.

WHY THIS MATTERS (include in the commit message)
A user who opens an idea currently sees an empty graph panel and concludes we
have no graph. We have 1.29m legislation edges and 2.3m recorded acts. The
only thing missing is a row saying which laws the idea concerns. Everything
downstream — effects, voting records, quotations, precedents — hangs off that
one row.

SCOPE

1. Migration creating idea_law_link exactly as specified in
   IDEA_LAW_JOIN_SPEC.md §1.1. Do not vary the column names: Lex's 26-U
   writes to this table and Charlie hand-attaches the first rows.

2. ideaLawSet(ideaId), read-only, beside inboundFor() in
   statutory-graph.ts, returning the structure in §1.3. Reuse
   gidCandidates() for document resolution and the GRAPH_6 effects reader
   for the onward effects on amends/repeals rows.

3. An insert path for Charlie's hand attachments. A script taking a simple
   file (one row per line: relation, doc_uri, provision_path, note) is
   sufficient and preferable to a UI for twelve rows. source='hand',
   source_detail='charlie <date>', as_at = the run date.

4. Panel wiring: the idea page reads ideaLawSet() and renders the six
   relation groups as separate sections, with the per-type effect counts
   from GRAPH_6 on the amends and repeals groups.

CONSTRAINTS

a. VERIFY EVERY doc_uri AGAINST THE CORPUS BEFORE INSERT, and fail the
   insert on a miss rather than storing it. The ids in §2.3 and §2.4 are
   proposed from knowledge, not read from the corpus. A wrong id joins to
   the wrong Act and nothing visible goes wrong — which is the worst kind
   of error we can make here. Report, per row, held / named-but-not-held /
   no-such-id.

b. action_id must survive the union. The panel has to be able to say which
   coherent action amends section 149, not merely that something does.

c. relation must drive the panel. Six groups rendered separately. Do not
   concatenate them into one "related legislation" list — that produces a
   list of four hundred items and tells the reader nothing.

d. A Bill is not an Act. target_kind='bill' rows must never be passed to
   the effects reader and must render labelled "before Parliament — not
   yet law".

e. unresolved is a result, not an error, and must be distinguishable from
   both "no such Act" and "lookup failed". Three different facts.

f. State what you counted. Every guard reports rows examined and rows
   asserted on.

REPORT
ideaLawSet() output for the marquee idea once Charlie's rows are in, with
the held / named-not-held / no-such-id split, and the per-type effect counts
for the three Acts in the amends group.
```

---

## 5. BRIEF_STATED_1 — STATED POSITIONS, NAMED LIST, ONE TOPIC

```
BRIEF_STATED_1_NAMED_SOURCES
Stream: Ingest. Scope: deliberately small.

PURPOSE
The people graph knows only people who vote. Think tanks, academics and
commentators have published extensively on personal accountability in public
bodies and we hold none of it. Add a stated-positions layer, as a test on one
topic, with a hand-picked source list.

WHY THIS MATTERS (include in the commit message)
"Everyone who has an opinion" is unbounded and would swallow a month. Eight
organisations on one topic is a test: if it produces quotable, citable
material the approach widens; if it does not, we have spent a day.

SCOPE

1. Table stated_position per IDEA_LAW_JOIN_SPEC.md §3.

2. Ingest the publication lists of these organisations ONLY, filtered to
   publications on public-sector accountability, named individual
   responsibility, civil service reform, and arm's-length body governance:
     - Institute for Government
     - Policy Exchange
     - Reform
     - IPPR
     - Onward
     - Centre for Policy Studies
     - Civil Service World
     - Institute for Fiscal Studies (for the resourcing half of the pair)
   Public pages at stable URLs. Record the licence for each organisation
   before ingesting a single document; where a licence forbids storing the
   text, store the locator and link only.

3. Extraction: a recommendation or finding sentence, verbatim, with its
   locator and url. extracted_by='pattern' where a pattern found it,
   'model' where a model did. Never 'markup' unless the markup said so.

CONSTRAINTS

a. NO STANCE, NO DIRECTION, NO SCORE. A quote is a quote. This is not
   negotiable and is the reason the layer is safe at all.

b. VERBATIM ONLY. If we cannot quote it we do not have it. A summarised
   "position" is our words in someone else's mouth.

c. actor_role as given at the time of publication, never the current role.

d. Licence before text, always. A row whose licence forbids storage must
   still exist — as a locator and a link, counted — so that coverage
   statements remain true.

e. Count and report what you did NOT take, and why: out of topic, licence
   refused, no quotable sentence found. A coverage figure with no
   denominator is not a figure.

REPORT
Rows per organisation; the licence determination for each; the count
excluded by reason; and ten sample rows with quote, locator and url for
Charlie to read.
```

### 5.1 Per-speech attribution — run the existing brief, with two additions

The committee attribution brief is written and unrun. Run it as written, with
two requirements added for Lex:

1. **The quotable unit is the paragraph**, and for oral evidence the question
   number (`Q142`) is the locator. Not the session, not the speech.
2. **Expose witness, role-as-given, date, committee and inquiry on every
   row**, so Lex's step 2 can read a PACAC witness statement straight into
   the "against" slot of the relevant action.

Highest-yield work available. It turns 15,806 transcripts from a wall of text
into named, dated, citable positions from permanent secretaries, former
ministers and academics — on exactly this topic, from a committee that has
inquired into it repeatedly.

---

## 6. ORDER OF WORK

1. GRAPH_6 — effects reader. **Running.**
2. GRAPH_7 — the join and its panels. Can start now; the migration does not
   wait for Charlie's rows.
3. Charlie hand-attaches §2.3 and §2.4 once he has answered the two
   questions in the covering reply.
4. Per-speech attribution — existing brief plus §5.1.
5. STATED_1 — named sources.
6. The demonstration page, assembled from what the above produces.

Nothing on this list is held up by engineering capacity. Item 3 is Charlie,
and the two questions in the covering reply are the only things gating it.
