# DESIGN — Relevant people ("friends and foes") for an idea

**Written:** 2026-11-19 13:49 UTC by cc-search, on CCh-Search's D3 GO (Charlie's decision of 19 Nov 09:37 UTC). **A design note: nothing is built.**
Nothing in it writes to production. The pilot it proposes writes only to R2 and `docs/census/`, and it waits for a GO.
**Inventory it builds on:** `docs/SCOPE_RELEVANT_PEOPLE.md` (19 Nov 00:18 UTC). New measurements in this note were taken 19 Nov
13:46–13:48 UTC with read-only scripts (deleted). **Marks:** [M] measured, [I] inferred from code or docs, [U] unverified.

## In plain English

Charlie wants, for each idea, the richest honest list of the people and organisations who matter to it: who is for it, who is
against it, and why we think so. Every entry says what we know about the person and what we don't.

We start well placed, because Parliament's own records already name most of the people who have engaged formally:
- MPs and peers, with how they voted.
- 85,542 witnesses who gave evidence to committees.
- Who signed which motions.

What we lack is three things. First, what each witness said they were: their role and organisation, which we hold only buried in
the transcript text. Second, any record of the people arguing about an idea outside Parliament, on the web and on X. Third, a stance
on the idea itself rather than on the 83 fixed propositions the graph tracks today.

The plan fills those three gaps in five phases. Each phase can be checked on its own. Each one stores only public-role
information, with the quote and the link it came from.

The main design choice is restraint about identity. We never decide that two records are the same person on a guess. Where we
can't tell, we show both records, with what each says, so a reader can judge for themselves.

---

## What we hold today (for the people a witness record names)

- **Appearances.** 162,733 `gave-evidence-to` edges from 85,542 subjects, 2012-12-07 → 2026-07-21 [M, SCOPE].
  - Each edge carries only the name as written (`subject_surface`, e.g. "Prof Tim Lang", "UKactive") and the inquiry
    (`object_ref`, `object_label`).
  - **No role, no organisation, no sector** [M: `graph_edge` columns].
- **Source documents.** Every appearance links to its document through `graph_evidence`: `section_id` plus `source_url`, e.g.
  `committees.parliament.uk/writtenevidence/145422/`. **`extract` is NULL**: no text was ever taken out [M: sample].
- **Evidence documents in the corpus** (`corpus_sections`, `committees-evidence`) [M]:
  - 126,509 written submissions. 38,267 (30%) carry the submitter's name in `speaker`.
  - 15,806 oral sessions. No `speaker`, and no raw HTML kept (`r2RawKey` is NULL on all 15,806), so any link the page had,
    such as "Watch the meeting", is lost from what we hold.
  - Licence: `opl-3.0` on every row sampled.
- **Identity** (`graph_entity_identity`) [M, SCOPE]:
  - People: 2,603 identified by Parliament member id, 788 probable by name match, 45,072 mention-only.
  - Organisations: 26,111 identified by Parliament's CIS id, 14,407 mention-only.
  - Most private witnesses are mention-only, and that is correct: nothing reliable says two "J Smith" records are one person.

**How readable the witness text is**, measured on random samples [M]:
- **Oral evidence.** 35 of 40 transcripts open with a list like "Witnesses I: Sarah Hards, Sales Director, AM Logistics;
  Conall Donnelly, Executive Director, Northern Ireland Meat Exporters Association."
  - Across those 35: 101 witnesses, **98 with a role or organisation after the name**.
  - The 5 misses are older formats: 2014–2017 headers, and a 2020 hybrid-bill committee's "MINUTES OF ORAL EVIDENCE".
- **Written evidence.** Only 7 of 40 open with "Written evidence submitted by …". The rest begin with the submission itself (e.g.
  "Submission to the International Development Committee by Rotary International …").
  - So for written evidence the name must come from `speaker` or the edge. Role and organisation must come from the text, and
    the text is usually about the issue, not about the author.
  - ⚠ One of the 40 was a private individual writing about her own family, work and finances. That is exactly the content this
    design must NEVER extract (see part e).

---

## Principles (apply to every phase)

1. **Public role only, sourced.** Every stored fact about a person carries the quote it came from and the link to the source.
   No quote, no fact.
2. **Never merge on a guess.** Attach a new fact to the entity the existing edge already names. If a fact conflicts with
   what the entity holds (a different organisation, a different title), record it as its own observation, flagged. Don't
   overwrite, and don't merge. Identity tiers (identified / probable / mention-only) are kept exactly as they are.
3. **Say what we don't know.** Every entry in the per-idea list carries a "known / not known" line. It is written from the
   fields we actually hold, never from the model's sense of the person.
4. **Accounts are accounts.** An X account is listed by its handle, with what it says about itself. We never try to work out
   who is behind an anonymous one.
5. **No personal circumstances.** Health, family, finances, home town, immigration status, anything a private person writes
   about themselves: never extracted, never stored, even when it is in the source.
6. **Shown, not judged.** Where two records might be one person, the user sees both, side by side, with their sources (and a
   video moment, where one exists: part b). The system does not decide.

---

## Phase (a) — Witnesses: role, organisation, sector, background, each with its quote

**Oral evidence (15,806 sessions held; the API lists 16,400).**
- Step 0, the source of record: **the Committees API already structures this.**
  - `GET committees-api.parliament.uk/api/OralEvidence/{id}` returns `witnesses[]`, each with `name`, `personId`,
    `submitterType`, `additionalContext`, `photoUrl` and `organisations[]` of `{name, role, cisId}`.
  - Verified from the API's swagger and one live record (id 18315, "Lord Mulholland", Scottish Government, "Former Lord Advocate
    and former Solicitor General for Scotland").
  - Our edges carry the name and an organisation CIS id, but not `role`, so the role was very likely dropped at ingest [I].
  - Re-reading the API costs no model calls. The role becomes the stored fact, and the API record plus the session URL is its
    source.
- Step 1, for sessions the API leaves without roles: a deterministic parser for the transcript's "Witnesses …:" list (no model
  call).
  - Split on ";". Within each entry: name, then role, then organisation, split on the commas.
  - Store the exact substring as the quote and the session URL as the link.
  - Expected coverage: about 88% of sessions (35/40), with role or organisation on about 97% of their witnesses (98/101).
- Step 2, the misses (about 12%, roughly 1,900 sessions).
  - Gemini Flash on the first 4,000 characters, asked only for the witness list in the same shape.
  - Its output is accepted only if each name appears verbatim in the text (the quote check).
- Matching to the graph.
  - Each parsed witness is matched to the session's existing `gave-evidence-to` edges by the name as written. Same session,
    same name, so this is not identity guessing: the edge already names the person in that session.
  - A witness with no matching edge is stored as unattached, and counted.

**Written evidence (126,509 submissions).**
- First, check whether the Committees API's written-evidence records carry the same `witnesses[] / organisations[{role}]` shape
  as oral evidence. **Not checked** [U]. If they do, most of the model step below disappears.
- The author is already named (`speaker` or the edge).
- Role and organisation: a deterministic header parser first ("Written evidence submitted by X, <role>, <organisation>").
- Then, for the pilot only, Gemini Flash on the first 1,500 characters, asked one narrow question: "what role or organisation
  does the author state for THEMSELVES? Quote it." Anything else the author says about themselves is out of scope (principle 5).
- At full scale this is about 126,000 calls. Estimate about £15–25 at Flash prices [I: about 600 input tokens each]. **Not
  proposed without a measured pilot.**

**Sector and stated background.**
- Sector is derived from the organisation where the organisation is identified (Companies House SIC code, Charity Commission
  classification; neither is wired yet [I, SCOPE]). Otherwise it is "not known".
- "Stated background" is only what the witness says of their professional background in the evidence itself, with the quote.
  An oral witness's introduction often has it ("I have worked in … for 20 years").

**Storage.**
- Production needs a table: `graph_witness_statement` (edge_id, section_id, source_url, quote, role, organisation, sector,
  background, method = parser | model, model, extracted_at). That is a schema change, so it is Charlie's decision.
- The pilot writes JSON to R2 (`_people/pilot/<ideaId>/witnesses.json`) and a copy to `docs/census/`. No production table.

---

## Phase (b) — Video: can a user SEE whether two records are the same person?

*Researched 19 Nov by a sub-agent. www.parliament.uk, members.parliament.uk and committees.parliament.uk answered HTTP 403
to it, so everything resting on those sites is from search snippets and marked [U]. parliamentlive.tv and both APIs were read
directly.*

**What can be linked.**
- **A session: yes.** `https://parliamentlive.tv/Event/Index/<guid>` is a stable page per committee session [M]. Example: a Lords
  Constitution Committee session of 2 Dec 2015, whose agenda names its witness.
- **A moment inside it: no URL form found.** There is no start-time parameter in the share box or the documentation. The only
  clip tool is a download panel (start and end time, sent by email).
- **When a witness starts:** event pages carry a wall-clock index. On a committee page the witness entry is stamped at the start
  of the session ("10:28:09 Witnesses: …"), not when each witness speaks. Commons chamber pages are stamped per speaker; whether
  committee pages ever are is not confirmed [U].
- **Finding the session for a transcript:** the Committees API's oral-evidence record has no video field in the parts read. The
  join is committee plus meeting start time against parliamentlive's events [I]. The RSS feed `data.parliamentlive.tv/api/event/feed`
  exists but returned HTTP 429, so its contents are unread [U].

**What we may do with it** [U]: the downloading and sharing terms, read from snippets.
- Use is limited to a fair and accurate report of proceedings.
- Satire, denigration, entertainment, advertising, and editing beyond selecting excerpts are all barred, as is reproduction out of
  context.
- Embedding is permitted subject to conditions. In practice both event pages say "Embed player is currently unavailable".
- Linking is reportedly free.
- Nothing found on still images.
- The terms can be withdrawn at any time.

**Portraits.**
- The Members API serves `/api/Members/{id}/Portrait` and `/Thumbnail` [M].
- The portrait pages state CC BY 3.0, for peers as well as MPs [U]. Not every member's page shows the statement, and the
  required credit wording was not readable.
- Witness records have a `photoUrl` field. It was null in the one record read.

**Design that follows.**
1. **Store a link, not media.** Per oral session, the parliamentlive event URL, found by matching committee and start time and
   stored with the match evidence. Unmatched sessions are counted, never guessed. The user sees "Watch the session (the
   witnesses appear from about 10:28)", using the index time where one exists.
2. **No moment links** until a working URL form is verified on a real session. None was found.
3. **No images of witnesses.** No stills, no frame grabs, and no API `photoUrl` until its licence is known. Nothing found
   permits it, and the terms' "fair and accurate report" condition argues against a face beside a profile.
4. **MP and peer portraits only after Charlie reads the licence page**, which this machine cannot fetch, and then only with the
   credit it requires, and only for members whose page shows CC BY 3.0.
5. **How "is this the same person?" is shown:** both records side by side, each with its role, organisation, date and committee,
   and each session's video link. The reader watches; the system doesn't decide.

---

## Phase (c) — Web and X: the actors stage 1 and stage 3 already find

**What already comes back** [I, from code]:
- Stage 1 (`orientation/v2.ts`) returns the arguments with their source: for X, the author handle and the post URL, and a
  `lowCredibility` flag. It also returns `vocabulary.people` and `vocabulary.organisations` (names only).
- Stage 3 (`stage3.ts`) returns points with `people` (names) and a parliamentary cross-check through `lookupName` for MPs and
  peers.
- **None of it is stored per actor.** Stage 1 runs only behind `LEX_ORIENTATION_V2` (off); stage 3 behind
  `LEX_ORIENTATION_STAGE3` (off, not wired).

**What to store, per idea, per actor.**
- Name or handle, and type: person, organisation, X account, publication.
- Self-description: only as the source shows it (an X bio when the provider returns one; an organisation's "about" line when
  the web source is its own site). Never fetched separately.
- Topic frequency: the number of posts or articles on this topic **in what we read**, stated with its denominator ("4 of the
  30 posts we read"). Never presented as how much they post in general.
- Up to three sample items, each with its link and date.

**Identity status, exactly one of three:**
- "self-described": what the account or page says it is.
- "matched to a known person": only through `lookupName` returning ONE identified candidate, with the evidence shown.
- "unknown".

An anonymous account stays "unknown", by rule. No inference from writing style, network or timing, ever.

**Storage.** Production: a `idea_actor` / `idea_actor_item` pair (schema; Charlie). Pilot: R2 JSON, as above.

**Repeatability caveat (measured 19 Nov 00:06 UTC, SEARCH-30, `docs/census/s30-noise.json`).** Stage 1's web and X results vary
run to run (33 distinct X posts across three runs of one idea, 1 common to all three). A per-idea actor list built from one run is a sample, and must say so.
Two runs, merged, is the cheapest improvement.

---

## Phase (d) — The per-idea list

One row per actor:
- **Actor** (name or handle, linked to its record), and **type**.
- **Stance on this idea**: supports, opposes, mixed or unclear, with the quote and the link that made us say so.
- **Influence signals we actually hold**, each sourced:
  - office held (`graph_office_holder`);
  - committee membership;
  - number of committee appearances, and on which inquiries;
  - frequency on this topic in what we read;
  - recency (the last dated item).
  - Nothing else. We hold no reach or follower numbers and will not invent a score.
- **Known / not known** line, written from the fields: e.g. "Known: Executive Director, NI Meat Exporters Association (oral
  evidence, 9 Mar 2022). Not known: views on this proposal beyond that session; whether the same person as 'C. Donnelly' in
  2019."

**Where stance comes from.**
- Parliamentarians: `positionsFor` on the idea's concrete targets (votes, EDMs), as SCOPE option 1 describes.
- Witnesses and web/X actors: a model reading the actor's own words (the evidence session, or the post) against the idea's
  problem statement. Output: one of the four labels plus a quote that must appear verbatim in the source. It is "unclear"
  unless the quote supports the label.
- This is the expensive step, so the pilot measures it: about 1p per actor at Flash prices [I].

**Ordering.** By stance group, then by the number of independent sourced signals. Not by a single blended "influence" score:
there is no honest scale for one.

---

## Phase (e) — Data protection (half a page, for Charlie)

**This profiles people.** Most are public figures acting in public roles: MPs, peers, officials, organisations' spokespeople.
Some are private individuals who gave evidence once, in their own name, often about their own lives.

**What we would hold:**
- Name, public role and organisation, and what they said in a public forum (Parliament's published evidence, a public post).
- Each with a link to the published original.
- Only facts the person published about their professional role. Nothing about health, family, finances, ethnicity,
  religion, politics as a private belief, or immigration status, even where the source contains it.
- **No contact details of any kind.**

**The UK GDPR questions this raises** (I am not a lawyer; these are for Charlie and, if he wishes, an adviser):
- *Lawful basis:* legitimate interests (Art. 6(1)(f)) is the likely one. It needs a written balancing test that weighs public
  debate against the person's expectations. A private individual who wrote once to a committee has weaker expectations of
  being profiled than an MP has, and the design should treat them differently.
- *Special category data* (Art. 9): even inferred political opinion from a stance label may count. That is another reason
  "stance on this idea" must rest on the person's own published words, quoted, and never on inference.
- *Transparency* (Art. 14): people whose data we take from public sources are owed a notice. A public page explaining the
  feature, what we hold and how to object is the usual answer.
- *Objection and erasure* (Art. 21, 17): a simple route. One email address or form; on a valid objection the person is removed
  from every idea list and their extracted rows deleted; the published original stays where Parliament published it.
- *Accuracy* (Art. 5(1)(d)): the "known / not known" line and the never-merge rule are also the accuracy controls.

**A proposed default that halves the risk:** show private individuals (mention-only, not an organisation's representative)
by their submission, not by name. For example: "a self-employed respondent (written evidence, 2020, link)". Name them only
where they appeared in an oral session, which is broadcast and transcribed by Parliament. Charlie's call.

---

## Spend, by phase (estimates [I]; the pilot measures them)

| phase | method | at full scale | in the pilot (452c5ade) |
|---|---|---|---|
| (a) oral, Committees API, then the parser | no model | £0 (API and R2 reads only) | £0 |
| (a) oral, misses | Flash, about 1,900 calls | about £1 | under 5p |
| (a) written, role/org | Flash, about 126k calls | £15–25, not proposed yet | about 20p (the idea's ~200 submissions) |
| (b) video links | page/API reads | £0 | £0 |
| (c) web/X actors | already paid by stage 1 / stage 3 | +0 per build; two runs to merge: about 10–30p per idea | one stage-1 run (about 12p) and one stage-3 run (about 21p) |
| (d) stance per actor | Flash, about 1p per actor | about £0.50–1 per idea | about 60–100 actors: £0.60–1.00 |
| **pilot total** | | | **about £1.10–1.40, inside £3** |

The pilot's own stop: £3, checked against the ledger after each phase, as tonight's runs were.

## The pilot on 452c5ade (needs a GO; writes nothing to production)

1. Take the idea's inquiries: the committee inquiries its last build's evidence came from, plus a search of `graph_inquiry` on
   the idea's key terms. Read each inquiry's oral sessions and written submissions.
2. Run phase (a), parser first, then the model for the misses. Report coverage: witnesses with role, with organisation, and
   unattached.
3. Run stage 1 and stage 3 once each with outputs saved (this also supplies item 5's missing data). Build phase (c)'s actor list.
4. Phase (d): a stance on the idea for each actor, quote-checked.
5. Report:
   - the list itself, as a census file;
   - its counts by stance and type;
   - the share of entries whose "known" line holds more than the name;
   - every place the never-merge rule held two records apart;
   - spend by phase.

Predictions are recorded before it runs.

## Decisions this needs

- **Charlie:** the two production tables (`graph_witness_statement`; `idea_actor` / `idea_actor_item`), when the pilot has been
  read. The private-individual default in part (e). Whether to take a data-protection view before anything is shown to users.
- **CCh-Search:** GO for the pilot (about £1.10–1.40, cap £3).
