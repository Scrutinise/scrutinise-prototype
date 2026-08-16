# AMENDMENT 2 to POSITION_GRAPH_DESIGN.md — IDENTITY, MENTIONS, AND WHERE THE DATA COMES FROM

> ✅ **FOLDED INTO `POSITION_GRAPH_DESIGN.md` ON 16 AUGUST 2026**, and §1, §2, §3 and §6 are BUILT —
> see `POSITION_GRAPH_AMD2_REPORT.md`. This file is kept unchanged as the record of what was decided
> when; **the design document is now the place to read it.**
>
> ⚠ **One figure in §6 below is stale and the report corrects it:** "99.6% of person entities rest
> on a name match" was 2D-1's. After 2D-2's member sweep it is 94.6% (2,603 of 48,409 keyed). §6's
> argument is unaffected — the gap between the halves is still twelve-fold — but the number should
> be read from `report-amd2.ts`, not from here.

**Written:** 16 August 2026
**File with:** `docs/POSITION_GRAPH_DESIGN.md` and Amendment 1. Fold into §3 and §5 when the design
is next edited.
**Source:** Charlie's reframe of 16 August, after 2D-2 reported person resolution at 788 of 46,298.

**Why this exists.** The design assumed identity had to be *resolved* before a position could be
*reported*, and gated everything MP-facing behind that. 2D-2 showed how expensive resolution
actually is — and Charlie's reframe shows the gate was in the wrong place. The purpose is mapping
who is for and against. A named contribution with a source attached is useful whether or not we can
say precisely which person made it.

---

## 1. The unit of display is the MENTION, not the entity

Add to §5, as a new first principle, ahead of the existing rules.

> *"Andrew Roberts spoke against this in committee XYZ"* — click the name — *"no further information
> on Andrew Roberts."*

That is a good output. It states what the record shows, links the evidence, and is honest about the
limit. **The design should have said so and did not.**

So the rule changes:

- **A mention can always be displayed.** Name as it appeared, position taken, source, date.
- **An entity is a claim that several mentions are the same actor**, and needs evidence.
- **Never withhold a mention because the entity behind it is unresolved.** Unresolved is a state to
  report, not a reason to hide the finding.

⚠ **What this does NOT relax is the merge rule, and the reason is worth stating because it is the
one place the reframe could be taken too far.** Three unresolved Andrew Robertses are three thin
records — visibly thin, and harmless. Three *merged* into one produce **a composite actor who does
not exist**, holds contradictory positions, and appears more influential than any of the real ones.
*"Andrew Roberts has appeared before fourteen inquiries and voted both ways"* would be a fabricated
person, stated with a straight face.

**Unresolved is visible. Wrongly merged is not.** That asymmetry is why the caution stays on merging
and comes off display.

---

## 2. Behaviour is identity evidence

New, and Charlie's: **if two clusters sharing a name take consistently different positions, that is
evidence they are different people.** If they take the same positions across the same questions,
the distinction may not matter for anything we report.

This is worth building because it is free — the positions are already the graph's content, so the
disambiguation signal is a query rather than a new source.

Two uses, and only the first is safe to act on automatically:

- **Splitting.** A name-matched cluster whose positions are internally contradictory should be
  flagged for review. It is a hypothesis, not a verdict — one person genuinely changing their mind
  is a finding the design already protects (§5.2), and must not be silently split into two.
- **Merging.** Behavioural similarity is **not** grounds for merging. Two different people who agree
  about everything are still two people, and this is exactly how a composite actor gets built.

⚠ **Record it as a signal with its evidence, never as a resolution.** *"These two clusters disagree
on 6 of 8 shared propositions"* is a fact. *"Therefore they are different people"* is an inference,
and it belongs to whoever reads it.

---

## 3. Confidence is shown to the user, not just stored

The schema already carries `key_source` and `confidence`, and 2D-2 was disciplined about them —
refusing to record a register name match as a keyed identity. **That discipline should reach the
screen.**

Three tiers, and the wording matters more than the number:

| basis | what the user is told |
|---|---|
| **Stable external key** — Companies House, Charity Commission, Parliament member id | the actor, identified |
| **Name match, corroborated** — matched against a register and consistent with what else we know | "probably this person or body" |
| **Mention only** — a name in a document, unresolved | the name as it appeared, and nothing more |

⚠ **Never present the third as the first.** A user acting on a political-risk assessment needs to
know whether the actor is identified or inferred, and the whole product claim is that we show our
working.

---

## 4. Where the data comes from — the corpus is not enough

Recorded plainly because the design implied it and never said it: **the graph currently reads only
the corpus.** No external register, no web. That was right for a first pass and is not sufficient
for what this is for.

Sources to add, in order of value per unit of work:

1. **Companies House and the Charity Commission.** Stable keys for organisations, plus the funding
   and directorship picture that says what a body calling itself a think tank actually is. **The
   single largest improvement available to the organisation half**, and organisations are the half
   that matters most.
2. **The registers already named in §6** — APPG secretariats and funders, the consultant lobbyist
   register, ministerial and senior-official meeting returns, Electoral Commission donations.
3. **The open web**, for organisations that appear nowhere in the corpus. ⚠ Adding web data before
   resolution is solid multiplies ambiguity rather than reducing it — **so registers first, web
   after.** The registers *improve* resolution; the web *tests* it.

---

## 5. Users are a source

The design has a correction route (§5.5). This extends it: **a user may add what we do not hold.**
An unresolved mention is exactly the kind of thing someone who works in the field can identify in
five seconds.

- Contributions are their own object, attributed, reviewable — the same shape as §22.4's
  contribution model rather than a direct edit.
- **A user-supplied identity carries its own confidence tier**, distinct from a register match and
  distinct from a name match, and is labelled as such.
- ⚠ **Anyone may claim their own record**, and a self-identification is evidence — but it is also
  the obvious vector for someone to curate how they appear. Attribute it, date it, and never let a
  claim delete the record it disputes: the correction sits *alongside* the evidence, never over it.

---

## 6. What this changes about the organisation half, which is the stronger half

Worth stating because a single headline number has been obscuring it.

2D-1 resolved **30.6% of entities on a stable key**. That reads as poor, and for people it is —
**99.6% of person entities rest on a name match.** For organisations it substantially understates
the position, for a reason that is about language rather than data: **organisation names are
distinctive and personal names are not.** "Shelter" is Shelter. "Andrew Smith" is nobody in
particular. A name match on an organisation is far stronger evidence than the same match on a
person, and the hand-check bears that out — six bodies read by hand, fifteen of fifteen inquiry
identifiers correct.

**So the two halves should be reported and treated separately, not averaged.** Organisations are
usable now. People are not, and §1's mention-level display is what makes them useful in the
meantime.
