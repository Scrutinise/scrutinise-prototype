# Append to LEX_REBUILD_DESIGN.md — §22 and §23

*(Design, for Charlie's review. §22 is a new stage; §23 is a new Lex capability that §22's legal review
depends on. Both build on §20 — publication — and neither touches the kernel's state machine.)*

---

## 22. Review & Deepening (Stage 5)

### 22.0 What this stage is for

Pages 1–4 produce a **skeleton**: a defensible structure with thin flesh. It is coherent, but it is one
person's reasoning with whatever evidence they had to hand. §22 is the stage that turns it into something
that survives contact with a select committee, a hostile press office, and a department's own analysts.

**The principle throughout: Lex does the heavy lifting; the user does the judging.** Lex finds, tests,
compares and challenges. The user queries, disagrees, goes elsewhere for their own research, and brings what
they find back. A pass is not "Lex wrote a section" — it is a worked argument between the two.

**And it is entirely voluntary.** A user with a small idea and an afternoon should not face nine mandatory
gates. Every pass is independent and can be taken to any depth. What the platform provides is not compulsion
but **visibility**: an honest picture of how deep the work has gone, so the user chooses where to spend
effort and a reader can see how seriously to take it.

### 22.1 The nine passes

Each has the identical shape (§22.2), so they are one mechanism, nine configurations.

| # | Pass | What Lex's first pass produces |
|---|---|---|
| 1 | **Logical review** | Does the argument hold? Diagnosis → obstacle → approach → actions tested for gaps, non-sequiturs, circularity, and claims that don't follow from what precedes them. |
| 2 | **Evidence deep dive** | Finds evidence *and* tests it: studies, data, **case studies**, **international comparisons** — what worked elsewhere, what failed, and how comparable it actually is. Flags where the evidence base is thin or contested. |
| 3 | **Legal deep dive** | Every relevant Act, SI, regulator rule and case; how the provisions interlock; how courts have read them; which provisions are the **leverage points** (§23); what the change should actually amend, insert or repeal; ranked by relevance and confidence. |
| 4 | **Financial deep dive** | The costing engine taken seriously: benchmark selection, assumptions challenged, sensitivity, the EANDCB position, comparison against what similar interventions actually cost (Impact Assessments and Post-Implementation Reviews as precedent). |
| 5 | **Implementation deep dive** | How this is actually executed: by whom, when, in what sequence; the structures, processes, teams and coordination required; what capability has to exist that doesn't; where delivery typically breaks. |
| 6 | **Political risk** | The human obstruction map: who loses, who blocks, who must be persuaded; the attack lines this proposal invites and the strongest form of each; which arguments have killed similar proposals; what the defensible answer is. |
| 7 | **Sector risk** | Why change is hard *in this sector specifically*: structural features, entrenched interests, past reform attempts and **why they failed**. Corpus-rich — committee post-mortems and PIRs are exactly this. |
| 8 | **Sources & admin** | Every source checked: does it exist, say what's claimed, remain current, and is it the best available? Broken links, superseded law, stale statistics, missing citations. |
| 9 | **Claims check** | Every factual assertion listed against what backs it — corpus item, statistic, benchmark, or **nothing**. Unsupported claims surfaced to evidence, soften, or cut. *(Absorbs §20.2's claims check; it belongs here.)* |

### 22.2 The shape of a pass (one mechanism, nine configurations)

1. **Training panel** — before starting: *what this review looks for, why it matters, what good looks like.*
   Short, concrete, teaching. The same pattern that made Guiding Policy comprehensible. Dismissible; always
   retrievable.
2. **Lex's first pass** — runs on request over the accepted state plus corpus, statistics and (flag-gated)
   web. Produces **findings** (research, case studies, comparisons, precedent) and **issues**.
3. **The issues list** — the heart of it. A to-do of specific, addressable items: *"No evidence offered for
   the claim that renovation rates respond to VAT"*, *"The Treasury will argue this is a precedent for other
   sectors — no answer given"*. Each item can be **addressed** (opens a working thread with Lex, resolves to
   content), **assigned** to a team member, **deferred**, or **dismissed with a reason**. Dismissed items stay
   visible in the evidence pack — a reader can see what was considered and set aside, which is a strength.
4. **The dialogue** — the user challenges Lex's findings; Lex challenges the user's answers. The user brings
   outside research in ("I found this study — does it hold up?") and Lex tests it against the corpus rather
   than accepting it. **Lex must be as willing to say "that doesn't support your point" as to agree.**
5. **Resolution** — findings the user accepts become part of the proposal, attributed to their source.

### 22.3 Depth: the thermometer and the star rating

**Depth must measure work and evidence, never Lex's opinion of quality.** An LLM-judged "quality score" is
gameable, unfalsifiable, and would make the public rating dishonest. Every component below is *countable*.

**Per-pass thermometer** — five levels, each with an objective test:

| Level | Name | Test |
|---|---|---|
| 0 | Untouched | Pass never run |
| 1 | AI pass | Lex's first pass complete; findings and issues generated |
| 2 | Reviewed | Every issue triaged — addressed, assigned, deferred or dismissed with a reason |
| 3 | Evidenced | Issues addressed with sources attached; claims in this section supported |
| 4 | Challenged | The user has contested Lex's findings, or brought external research that Lex has tested |
| 5 | Corroborated | An independent party — team member, contributor, or invited expert — has reviewed and signed off |

**Public star rating** = an aggregate of the nine thermometers, displayed with its composition visible
(hovering shows which passes are deep and which are untouched). A reader sees *"legal and financial deep;
implementation untouched"* rather than an opaque 3.5. **The honest signal is the composition, not the
number** — and a proposal that names its shallow areas is stronger than one that hides them.

Rule: a proposal can be published at any depth. The rating is information, never a gate.

### 22.4 The idea team (Charlie's model, made concrete)

Four roles. The team is **private and idea-scoped** — appointed through the idea module, with no relationship
to Scrutinise Central communities.

| Role | Can |
|---|---|
| **Owner** | Everything: edit, publish, delete, manage the team, accept/decline contributions |
| **Editor** | Edit all content and run reviews. Cannot publish, delete, or manage the team |
| **Reviewer** | Assigned to specific passes: edit those sections, comment anywhere, run their passes |
| **Contributor** | Anyone logged in who has the shared URL. **Suggests only** — cannot edit |

**Contributions are a distinct object**, not edits: `Contribution { ideaId, userId, section, text, status:
PROPOSED | ACCEPTED | DECLINED, response }`. The owner triages; an accepted contribution becomes content
**with attribution to its author**. Declining is normal and requires no justification — the owner is never
obliged to take anything on board.

The shared URL can be posted in a Central community, which is how community and idea meet **without**
community membership conferring any edit right. §20.7's boundary holds: community activity never grants
access to someone's working proposal.

*Open for Charlie: should Editors be able to run reviews that change the depth rating, or should rating-
affecting actions be Owner-confirmed? My recommendation: Editors run freely; only sign-off (level 5) requires
a distinct identity, since that's the level that claims independence.*

### 22.5 Where §22 sits

Kernel (Pages 1–4) → **Review & Deepening (§22, optional, any order, any depth)** → Curation & Publication
(§20). Deepening can be re-entered after publication; a new version records what changed and the rating
moves with it.

---

## 23. Reading legislation with Lex ("the KC beside you")

### 23.0 The problem this exists to solve

Law is opaque, and the opacity is load-bearing: it keeps interpretation in the hands of a professional class
and exhausts everyone else — including most MPs. Scrutinise's answer is **not** to summarise the law away.
A summary substitutes Lex's understanding for the user's, which reproduces the priesthood with a new priest.

**The design rule: Lex never stands between the user and the text. It stands beside them.** The user reads
the actual words of the actual Act. Lex supplies what an experienced lawyer supplies — where to look, *how*
to look, what the words are doing, and where the pressure points are. The measure of success is that the user
finishes able to read the next Act better, not merely informed about this one.

### 23.1 The reading view

Two panes. **Left: the original text, unaltered, from the corpus.** Right: Lex's apparatus, keyed to what the
user has selected. Nothing in the right pane replaces anything in the left.

Apparatus, on demand rather than all at once:

- **Structural map** — what this Act does, in Parts; which sections are operative and which are machinery
  (commencement, extent, consequential amendments); where the real content sits.
- **Controlling definitions** — the defined terms that govern the provision on screen, pulled from wherever
  they live, with the distinction that changes everything: **"means" is exhaustive, "includes" is not.**
- **Duty or power** — "must" creates an obligation; "may" confers a discretion. In a proposal this is often
  the entire argument: a regulator that *may* act and doesn't is a different problem from one that *must*.
- **Currency** — is this in force, amended, or repealed; what changed and when; what the version on screen is.
- **Interpretation** — how courts have read this provision (corpus case law), and where it is contested.
- **Cross-references resolved** — the referred-to section shown inline rather than sending the user hunting.

### 23.2 Leverage points in the text (Rumelt applied to statute)

The distinctive feature, and the direct answer to *"where are the leverage points?"* Lex marks the places in
a provision where **a small textual change produces a large effect** — the drafting equivalent of a pivot
point:

- **A definition** — change what a word covers and every provision using it moves.
- **A threshold or number** — a rate, a limit, a period, a floor. Often the smallest possible amendment.
- **A duty/power switch** — "may" → "must" converts a discretion into an obligation.
- **A delegated power** — where a Minister can already act by regulation, no primary legislation is needed.
- **An exemption or exclusion** — often easier to narrow or widen than to change the main rule.
- **An enforcement provision** — a right without a remedy changes little; where enforcement sits is where
  behaviour changes.
- **A commencement or sunset provision** — timing as a lever.

For each, Lex states what changing it would do **and what else it would touch** — the consequentials. This
feeds §22's legal deep dive and §20.4's legislative annex directly.

### 23.3 Teaching the moves ("how to look")

Alongside the apparatus, Lex surfaces the *technique* being used, briefly, in context: check the defining
provisions before the operative ones; read the section in its Part, not alone; schedules are part of the Act;
explanatory notes help but are not the law; punctuation and structure carry meaning. The user should notice
themselves acquiring the moves.

**This content is drafted for expert review** — see `FAQ_READING_LEGISLATION.md`, written to be handed to
practising KCs to correct and improve. Once reviewed, it becomes both the FAQ section and the source for
Lex's in-context prompts, so the guidance the user gets is guidance a KC has signed off.

### 23.4 Grounding

Everything in the right pane is corpus-sourced or a stated general principle. Lex does not characterise a
provision's meaning beyond what the text, the definitions, and the retrieved case law support — and where the
law is genuinely contested, it says so rather than picking a side. §19-C's never-claim invariant applies
without exception.
