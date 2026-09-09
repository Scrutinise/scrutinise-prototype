# ANSWERS TO CCW'S BLOCKERS — 28 Aug 2026, 22:20

Your read of the job is correct in every particular except one, and the correction is Charlie's, not
mine. Take it before anything else.

---

## 0. THE PURPOSE HAS CHANGED — costing is out

⚠ **The report puts no time or money figure on the work.** We have no hours model and no rate
structure, so any such figure would be invented, and an invented number in a document whose first
rule is that every assertion resolves to a source would discredit everything around it.

**What replaces it.** Part 5 becomes *composition*, not cost: distinct drafting patterns, discrete
decisions required, separate instruments needed, gates engaged, second-order proposals spawned, and
what kinds of expertise the work calls for. All countable from the analysis itself.

**Consequences for you:**
- Your blocker 7 is dissolved. No spend figure, no hours log needed for the document. Log your own
  time if useful to you; it doesn't go in.
- Do **not** record per-pattern timings as report data. It was my instruction and it's withdrawn.
- The front-matter "cost of this analysis" item is deleted.

**What the document now says about scale.** That this is a first pass, that it opens the door on the
complexity and depth of the whole job, and that carrying it through would need planning, strategy and
resourcing beyond anything here. It states that plainly rather than implying it through length.

**One addition.** A short closing section on what Scrutinise is: free, non-partisan, available on
identical terms to anyone, and available both for the remaining nine measures and for organising the
people who would do the work — the same offer any user gets. Factual register. If it reads as a sales
page it has failed.

Updated `REPORT_SPEC_restoration_programme.md` is attached and supersedes the one you read.

---

## 1. The missing spec — attached

`CCW_SPEC_starkey_workstreams.md` is attached. It holds the per-measure schema, the four gates, the
cardinal rule, the twelve workstream identities, `counterparty_response`, and the adversarial-round
protocol. Read §2 (the cardinal rule) and §5 (the gates) before anything else.

Two notes on it:
- It was written for a twelve-workstream programme. You are running three, conditionally four. The
  schema is unchanged; the fan-out is smaller.
- WS-12's remit (§6) is not in this run's scope. It stays in the spec because the register should
  show what the programme contains, not only what we are doing this week.

## 2. Corpus access — your split is right, adopt it

CC on the Windows box runs `inbound()` and owns everything needing credentials. You own everything
downstream. Charlie connects `C:/Code/scrutinise-prototype` so you can read specs and write drafts
into the repo directly.

CC's brief is written and attached (`CC_BRIEF_report_corpus.md`). See §9 below on how you and CC
coordinate.

## 3. The transcripts — they exist, with a warning attached

Two files, both to be placed in `docs/report_run/sources/`:

1. `Restoration_and_Repeal_-_Mark_Littlewood_and_David_Starkey_Reform_Conference_2025.pdf` — a
   cleaned, sectioned transcript of the Reform UK conference session. The popular statement of the
   thesis.
2. `David_Starkey.docx` — an **auto-generated** transcript compilation of several *David Starkey
   Talks* episodes and conference sessions, including ones with Stephen Barrett (barrister), Danny
   Kruger, and a Freedom Association session with Littlewood. **This is the operational document** —
   it contains the "Great Statute of Westminster", the specific repeal list, the annulment argument
   and the "flooding the zone" sequencing claim. The conference PDF is the popular version.

⚠⚠ **The .docx is machine-transcribed and will contain errors in exactly the places that matter** —
names, statute titles, legal terms. A misquotation in a document handed to the person quoted destroys
the document and everything in it.

**The rule, and it is not negotiable:** every sentence quoted and attributed to a named person is
verified against the source recording at its timestamp before print. Where verification is not
possible, the passage is **paraphrased and labelled as a paraphrase**, never quoted. Flag every quote
needing verification as you draft, in a single list, so the check is one pass and not a hunt.

This is not caution for its own sake. Getting a statute title wrong in a quotation, in a report about
statutes, to a reader who knows the subject, is the fastest way to lose the room.

## 4. The proposer — confirmed

**David Starkey.** The document's primary organisational audience is the group around him — Popular
Conservatism, Mark Littlewood — with Starkey as the intellectual reader. Littlewood is the
interlocutor in both transcripts.

Write for a reader who is a historian arguing from precedent, and for whichever lawyer they hand it
to. §4.3 of the report — testing his own Henry VIII annulment analogy — is written for him
specifically.

## 5. The argument graph — built, but unvalidated. Use it, labelled.

It exists and is queryable: `scripts/argument-questions.ts`, with paragraph-level retrieval from
Hansard and committee reports, keys read back from R2 with speaker, date and debate attached. A
sample run produced ten questions, seven of which had their strongest answer in a debate about an
entirely different subject.

⚠ **Nothing has been scored against it and Charlie has not validated the keys.** So:

- **Use it.** The retrieval is real and the material is genuinely unavailable elsewhere.
- **Hand-verify every paragraph you quote** against the stored source, exactly as for the transcripts.
- **Label §9's provenance** on the page: these are objections retrieved from the parliamentary record,
  each with speaker, date and debate — visibly distinct from anything generated. The distinction must
  be visible to a reader who is skimming.
- If a measure returns nothing usable, §9 becomes a declared gap for that chapter. That is an
  acceptable outcome and better than a thin section.

## 6. Red team — your proposal, adopted

You write the adversarial prompt and **record the numeric prediction before the round**. Charlie
pastes it into Gemini or ChatGPT Wednesday and pastes the return back. You process the repairs.

Two additions:
- Write the prompt **Monday**, not Wednesday. If Charlie has it in hand early he can run it whenever
  he has ten minutes, and the round stops being a Wednesday single point of failure.
- Appendix D records what the round found and what you repaired. Publishing that is the strongest
  available signal the document was tested rather than composed. Draft it as you repair, not after.

## 7. Cost of the analysis — dissolved

See §0.

## 8. Production — two answers and one thing Charlie must book

**Appendix A hosting:** R2 public URL. Charlie already runs R2, it is independent of the app deploy,
and it cannot be broken by a Vercel build on Thursday morning. A route on scrutinise.org introduces a
deploy dependency on print day for no benefit. ⚠ **Confirm the URL resolves from a phone, on mobile
data, before the QR code is printed.**

**Printing:** Charlie's to arrange and it needs booking Monday, not Thursday. 60–100 pages bound,
multiple copies, is a print shop job. Open questions to him: how many copies, bound how.

---

## 9. Can you manage CC? — Not directly. Here is the pattern that works.

**No.** You and CC are separate sessions with separate contexts. You cannot invoke CC and CC cannot
see your context. Charlie is the relay.

**But you should author CC's briefs**, because you know what you need downstream and he does not.
The pattern:

1. You write a CC brief to a stated output contract — file path, format, columns, what "done" means.
2. Charlie pastes it to CC.
3. CC executes and writes to `docs/report_run/`.
4. You read the output from the connected folder.

⚠ **Charlie is the bottleneck and the schedule is six days.** Mitigate it: **write every CC brief you
expect to need on Saturday morning, in one batch.** A relay that runs once a day is workable. A relay
that runs eight times a day, waiting on a human who is also doing everything else, is not.

If a CC output is wrong or incomplete, write the correction as a new brief with the defect named —
don't ask Charlie to explain it. He should be relaying, not translating.

---

## 10. Timing — you are right, and start tonight

Saturday is Day 1. Your two-track proposal is adopted:

- **CC track:** reference maps, then gates evidence.
- **Your track:** Part 2 — absorption, the annulment device, the Henry VIII analogy, the devolution
  wall, the three Northern Ireland positions. None of it needs the corpus.

**Start the Part 2 research tonight.** Your caveat is correct — you'll be researching the law of the
question rather than the proposer's version of it — and that is the right 80% to do first. The
transcripts land tomorrow morning and you fit his version to the law, rather than the other way
round, which is the sounder order anyway.

One instruction for §4.2 while you work without the transcripts: **research the absorption question
in both directions.** Whether the common law has absorbed the principle independently of the statute
is a real question with a real answer, and the answer may well support the proposer more strongly
than he has argued it. Do not go looking for the objection.
