# GRAPH 3C-2 — THE VALIDATION KEY, REBUILT ON BASES THAT CARRY A DIRECTION

**Supersedes:** `docs/GRAPH_3C_REPORT.md` §3 (corrected in place, not deleted).
**Date:** 2026-08-23. **Cost: $0** — no LLM call was made anywhere in this sprint.
**Reproduce:** from `scripts/graph` — `audit-3c2-bases.ts`, `probe-3c2-speech.ts`,
`probe-3c2-speech2.ts`, `probe-3c2-coverage.ts`, `rebuild-3c2-validation.ts --self-test`.

---

## THE SHORT VERSION

**Charlie caught it on Sir Edward Leigh** — listed as supporting the assisted dying Bill on the
strength of an amendment he sponsored, when he is one of its most prominent opponents.

**136 of the 157 rows rested on amendment sponsorship, and that basis cannot carry a direction.**
A wrecking amendment and a strengthening amendment are the same recorded fact.

The reasoning error is worth more than the incident. 3B chose that basis because it is
**non-circular**, and proved it with a query rather than an argument — the graph holds zero
`amendment_sponsorship` signals. That reasoning is genuinely valuable, and it is incomplete:

> **Non-circularity is necessary. It is not sufficient. The basis must ALSO determine a direction.**

⚠⚠ **An independent signal that does not settle the answer is worse than useless in an answer key,
because it will mark the graph WRONG every time the graph is RIGHT.** Such a key does not measure
the graph at all; it measures whatever assigned each row its direction, and it does so while
looking rigorous.

**What the rebuild produced:** **50 sound rows**, every one carrying a member's own words from
Hansard — verbatim, dated, with a working per-speech link. The 136 unsound rows are **kept, not
deleted**, in a section marked `UNSOUND BASIS — NOT SCORABLE` with the reasoning attached.

**The same member, corrected.** Sir Edward Leigh's row now carries, in his own voice:

> *"The reason why the right hon. Lady and I both oppose the Bill is that, as has been said several
> times, we are not talking about just a principle here; we are talking about an actual Bill."*
> — 20 June 2025, [Terminally Ill Adults (End of Life) Bill](https://www.theyworkforyou.com/debates/?id=2025-06-20a.747.0)

**Nothing has been scored.** Design §8's gate is still shut.

---

## §1 — THE BASIS AUDIT, RUN BEFORE ANYTHING WAS REBUILT

Every basis now has to pass **two** tests, not one. `audit-3c2-bases.ts` asks both, and the
independence half is a **query against the live signal table**, not an opinion. The table also
derives its own verdict column from the two tests rather than having it typed in beside them —
which caught three rows where I had recorded the weaker of two objections.

| basis | determines a direction? | independent of the graph? | verdict |
|---|---|---|---|
| **amendment sponsorship** | **NO** — unsigned; wrecking and strengthening are the same fact | yes | **REJECT** |
| **bill sponsorship** | **YES** — sponsoring a Bill *is* supporting it | yes | **USE** |
| **the member's own words in Hansard** | **YES** — arguing a case states a direction in the act of stating it | yes | **USE** |
| **a published statement on the web** | **YES** — same property, for members who did not speak | yes | **USE** |
| EDM signature | YES — an EDM has an ask, and signing endorses it | **NO** — 59,925 signals | EXCLUDE (circular) |
| division votes | YES — the clearest direction there is | **NO** — 2,080,585 signals | EXCLUDE (circular) |
| TheyWorkForYou "voted consistently for…" | YES | **NO** — a pure function of the same divisions | EXCLUDE (circular) |
| committee membership | **NO** — attendance, not conclusion | yes | REJECT |
| witness appearance | **NO** — engagement, and about a different actor | NO | REJECT (both) |
| declared interest | **NO** — an alignment prior that points either way | NO | REJECT (both) |
| political donation | **NO** — the path, never the stance (design §4) | NO | REJECT (both) |
| party membership / manifesto | **PARTLY** — the *party's* direction; would score every rebel as an error | yes | REJECT |
| ministerial office | **PARTLY** — bill sponsorship under another name | yes | REJECT |
| signed committee report | YES — but consensus documents hide dissent | yes | NOT AVAILABLE |

**3 of 14 pass both tests.**

⚠ **The dangerous entry is the TheyWorkForYou summary line.** It reads like an independent
third-party judgement and is a pure function of the division records the graph aggregates. It would
be circular *while appearing independent* — the failure mode hardest to catch by inspection.

---

## §2 — WHAT THE CORPUS COULD ACTUALLY SUPPLY

Measured before anything was written, because the route dies if any of it is absent.

**Is speech circular?** No. `position_signal` holds `vote`, `witness_appearance`, `edm_signature`,
`declared_interest` and `political_donation`. **No speech-derived signal type exists**, so Hansard
is independent — *today*, and that qualifier is load-bearing (see §5).

**Is there speech text, with attribution?**

| corpus | rows | with a speaker |
|---|---:|---:|
| `pwdata-debates` (Commons) | 6,391,345 | 5,693,886 |
| `pwdata-lords` | 754,546 | 707,013 |

One row is **one speech**, not a whole debate — median 55 words, p90 401.

**Can a speaker be resolved to an MNIS id without breaking the identity rule?** Over the 677
distinct speakers on three sampled matters: **595 (87.9%) match exactly one MNIS person, 0 are
ambiguous**, 82 match none — and the 82 are overwhelmingly procedural voices (*"A noble Lord"*,
*"A noble Baroness"*) and Lords whose title has changed. Zero ambiguity is what makes an
exact-normalised-name join safe here; a name that matched two people would stay unresolved.

**Speeches per matter**, both Houses: from 724 (the smoking ban) to 13,461 (EU withdrawal), across
115–582 distinct members. Coverage was never the constraint.

⚠ **On `pwdata` and the circularity prohibition.** These transcripts come from TheyWorkForYou's
bulk data, and the brief rightly forbids TWFY's *computed* position summaries. The prohibition is
about the summaries, which are a function of divisions. What is quoted is the **verbatim Hansard
transcript** TWFY republishes: words spoken in the chamber, with no computation over any vote
anywhere. Different thing, same publisher — and the distinction is stated on the face of the
document, not just here.

---

## §3 — THE REBUILD

**50 sound rows: 5 from each of 10 matters, 46 distinct members, 9 parties.** Every one carries a
speech. 21 of them are *also* named sponsors of their Bill — a second independent basis pointing
the same way — but **no row rests on bill sponsorship alone**, because every bill sponsor in the
pool also spoke.

⚠ **Route (b), a published statement on the web, was not needed and so was not used.** 144 of the
157 candidates turned out to have spoken on their own matter. Nothing was searched for on the web,
and no row rests on a source anyone has to take on trust.

### 3.1 · The row states the evidence, not the conclusion

There is no "proposed position" line anywhere in the sound section — asserted on every write by
reading the file back and counting (`0`, and the write fails if it is not). The previous draft put
a direction above every quote, and a row that announces its own answer invites a rubber stamp.

Verdict options are `SUPPORTS` · `OPPOSES` · **`NO POSITION ESTABLISHED`** · `UNSURE`. The third
matters: some evidence genuinely does not settle it, and a key that cannot say so forces a guess.

### 3.2 · The extract is chosen by a rule that cannot see which way it points

**The member's longest speech in a debate titled for the matter**, quoted in full at 350 words or
fewer, otherwise its **first 220 and last 130 words**. The rule is printed on every row. Nothing is
selected for containing a stance word — that would be the generator pre-judging the answer it is
asking for.

⚠ **Quoting generously is also the defence against a specific trap.** Sir Edward Leigh's November
speech reads out a constituent's email containing *"I oppose the right to die Bill"*. An excerpt
built around the word "oppose" would have put the constituent's sentence in his mouth. The context
is the fix, so the context is not cut away.

⚠ **Both ends, not just the opening — and a real row is why.** Lord Callanan's selected speech is a
2,773-word ministerial wind-up whose first 250 words are entirely congratulations on two maiden
speeches. Mechanically correct, and useless. Its **closing** words settle it outright: *"This Bill
will ensure that we can end retained EU law as a legal category… the Government are determined to
see the opportunities of Brexit and I know that the Bill delivers that result."* A peroration is
exactly as mechanical a place to look as an opening, and neither is chosen for what it says.

### 3.3 · Every row has a working, clickable link

Our stored id (`pwdata-debates:debates2024-11-29d:130`) carries a **sequence index, not TWFY's
gid** — a URL built from it 404s, measured. The real gid lives in the day's source XML, so the
generator fetches each debate day once, matches the speech on speaker plus text prefix, and
recovers it. **50 of 50 recovered**; a sample of six all return HTTP 200 with page titles that
match the quoted openings.

---

## §4 — THE 136 UNSOUND ROWS ARE KEPT

They sit at the foot of the document under `⛔ UNSOUND BASIS — NOT SCORABLE`, with their original
"Proposed position" lines **left in place so the defect can be seen rather than described**. Three
reasons they are not deleted:

1. **The count is the finding.** 136 of 157 — **86.6%** of the first draft.
2. **The relevance survives even though the direction does not.** Those members *did* engage with
   those matters, which is exactly what an unsigned fact can tell you. It is why they remained the
   pool the sound rows were drawn from — used for *relevance*, never for *direction*.
3. **The basis may be recoverable.** Classifying what each amendment actually did would give it a
   direction. ⚠ That is an inference and a separate piece of work; it was not attempted, and a key
   built on an unvalidated classifier would import the classifier's errors as ground truth.

⚠ **30 of the 46 sound members also appear in the unsound section**, and the document says so:
the same person with two citations — an amendment that establishes nothing, and a speech that does.

---

## §5 — WHAT IS NOT DONE, AND WHAT HAS A SHELF LIFE

- **Nothing is scored.** Design §8's gate is shut, as it was before.
- ⚠⚠ **Every sound row is marked `hansard-speech`, and that mark expires.** Speech is independent
  of the graph *because the graph holds no speech-derived signal*. **If extracted-position signals
  are ever folded in (design §4, P3), every `hansard-speech` row stops being independent and must
  be excluded from scoring from that point on.** Bill-sponsorship rows are unaffected. This is
  written on the face of the document, not only here.
- **Amendment classification** — not attempted, by instruction.
- **Route (b)** — not needed, so not built.
- ⚠ **A stratified subset is not a population.** The rows are deliberately weighted toward members
  whose record the graph finds *divided*, because that is where 3C's scoring change shows. An
  accuracy figure from these 50 must be reported **stratified**, with A 13 / B 31 / C 6 printed.

---

## §6 — WHAT WENT WRONG IN THIS SPRINT

Four, all mine, all caught by measurement or by reading the output rather than by review.

### 6.1 · ⚠⚠ The generator ate its own input

The first version read its 157-row pool out of the document it then overwrote. Run a second time it
reported **`pool 136: 0 bill-sponsor`** — the rewrite had replaced every `bill-sponsor` basis line
with `hansard-speech`, so all 21 sound bill-sponsor rows had silently vanished from the pool.

**It is the same shape as the bug the previous sprint hit in `select-3c-validation.ts`**, one
sprint later, in a different file, by the same author. The lesson is not "make it idempotent" — it
is that **a generator whose input is its own output must be run twice and diffed before it is
believed**, every time.

Fixed by giving the pool its own home: `scripts/graph/validation-pool.json`, extracted once from
the original draft under a guard that refuses to run if the document has already been rebuilt.
Re-running the rebuild is now byte-identical, proven by diff.

### 6.2 · ⚠⚠ The unsigned-amendment defect came back wearing a different costume

The first rebuild selected, for Lord Callanan, a **20,246-word "speech"** beginning *"Moved by Lord
Callanan 64: Before Schedule 1, insert the following new Schedule—"* and continuing through several
hundred statutory instruments. TheyWorkForYou attributes it to him correctly. **It is the text of
an amendment** — carrying no direction, dressed as a member's own words.

"Longest speech" is a proxy for "most substantive", and that is where the proxy breaks. The rule is
now *the longest speech that passes `isArgument()`*, with two direction-blind tests: a block
opening `Moved by` is amendment text by construction, and a passage with no first person anywhere
in the quoted window is procedural or read-out text. Seven speeches were rejected.

⚠ **Found by reading the output, not by designing for it.** I only looked because a 20,246-word
speech is implausible — the row would otherwise have shipped looking exactly like the other 49.

### 6.3 · ⚠ The self-test caught my own filter rejecting real speeches

`isArgument`'s first-person test rejected **zero** speeches in the real run, which could mean the
corpus has none or could mean the rule is inert. Watched against constructed cases instead, and it
**failed immediately**: *"My Lords, this issue has been raised with me many times by constituents"*
was rejected, because the regex was `/\b(I|we|my|our)\b/` — case-sensitive, so sentence-initial
"My" missed, and "me" was not in the set. **That would have silently dropped genuine Lords speeches
— the failure mode a filter has that nobody notices, because a dropped candidate leaves no trace.**

### 6.4 · ⚠ A table that disagreed with itself

`audit-3c2-bases.ts` derives its verdict column from the two test results rather than reading a
typed-in field, and prints a loud warning when the two disagree. It fired three times on first run:
witness appearance, declared interest and political donation fail **both** tests, and I had recorded
only the circularity. The fundamental objection is that they carry no direction — a basis that
cannot answer the question is out whether or not it is independent — so the verdict now names both.

---

## §7 — DECISIONS FOR CHARLIE

**D-1 · Is 50 enough, or should the remaining 94 be built too?** 144 of the 157 candidates have a
usable speech, so the sound set could be ~144 rather than 50 for no new technique — only review
time. *Recommendation:* **score the 50 first.** If accuracy on them is stable across the three
strata, the extra 94 add confidence rather than information; if it is not, the 50 will show that
faster and cheaper. *Consequence of doing nothing:* a stratified 50 is enough to open design §8's
gate, but not enough to publish a population accuracy figure.

**D-2 · Should the pool itself be widened beyond the 157?** The pool was chosen by amendment
sponsorship — sound for *relevance*, and it is still a filter with a shape: it selects members
active enough to table amendments. The corpus holds 115–582 speaking members per matter.
*Recommendation:* **not yet.** Widening changes what the key measures, and it should not change
under a graph that is being measured against it. *Consequence:* the key over-represents active
legislators, which is worth stating whenever a figure from it is quoted.

**D-3 · Amendment classification — worth a sprint, or drop it?** Classifying each amendment as
strengthening or wrecking would recover 136 rows and a whole signal type (`amendment_sponsorship`
is one of the two P0 types with no data at all). ⚠ It is an inference, and an answer key built on
an unvalidated classifier imports that classifier's errors as ground truth. *Recommendation:* build
it as a **signal** if it is built at all, never as a key — the graph may reason from an inference;
the thing that scores the graph may not. *Consequence of doing nothing:* `amendment_sponsorship`
stays at zero signals, as it has since 3A.

---

## ▶ WHAT CHARLIE SHOULD DO

1. Open **`docs/POSITION_VALIDATION_CANDIDATES.md`**. The **50 SOUND rows** are at the top.
2. For each: read the quote, then write the position. `SUPPORTS` · `OPPOSES` ·
   **`NO POSITION ESTABLISHED`** · `UNSURE`. The third is a real answer, not a failure.
3. **Spot-check the fix on the row that started this** — `S1.04`, Sir Edward Leigh. It now carries
   *"The reason why the right hon. Lady and I both oppose the Bill…"* in his own voice, with a link
   that opens the whole speech.
4. Ignore the **⛔ UNSOUND** section at the foot. It is there to be seen, not scored.
