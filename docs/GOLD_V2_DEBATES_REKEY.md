# GOLD V2 — DEBATES RE-KEYED TO PARAGRAPHS

**For:** Charlie · **From:** CC-Search · **Written:** 2026-08-24
**Executes:** `BRIEF_SEARCH_S13.md` §4. **Nothing here has been scored.**

---

## WHAT YOU ARE BEING ASKED TO DO

You validated the eleven debates questions on 21–22 August, keyed to a **speech**. This changes each
key to **the specific paragraph inside that speech that makes the argument**. A changed key is a
changed question, so each row needs a verdict from you.

**One line per row: `ACCEPT`, `AMEND <what>`, or `REJECT <why>`.** Rows 1–11 below.

⚠ **Tighter, not looser.** The brief reversed an earlier plan to widen the key to "any speech in the
same debate". That is not what this is. The document id is unchanged in every row; what is added is
a **verbatim paragraph** that must be present in the returned document. Nothing that failed before
passes now because the key got easier.

⚠ **Interim scoring rule, until S13 §3 is deployed and measured:** a hit is scored when the returned
speech **contains** the keyed paragraph. That is fair to retrieval — it does not require the
platform to display the paragraph before it can display the paragraph — without crediting a
different speech that merely sits in the same debate.

⚠ **Every paragraph below was read out of the stored body in R2 before it was written down** — none
is quoted from memory, from a title, or from what retrieval returned. `scripts/s13-rekey-candidates.ts`
prints the candidates; `scripts/s13-read-speech.ts` prints any stored body in full. The confirming
sentence is printed under each row, as the brief requires.

⚠ **Retrieval was never called.** Keying a question on what search returns for it makes recall 100%
by construction and measures nothing.

---

## A STRUCTURAL FINDING THAT CHANGES WHAT "PARAGRAPH" CAN MEAN

**Twelve of the fourteen keyed speeches are stored as ONE paragraph.** Read back out of R2:

| corpus | keyed speeches | paragraphs in the stored body |
|---|---|---|
| `pwdata-debates` / `pwdata-lords` / `pwdata-westminster` | 10 | **1 each** |
| `historic-hansard` | 2 | **1 each** |
| `niassembly-hansard` | 1 | 53 |
| `scottish-parliament-or` | 1 | 34 |

The TheyWorkForYou and historic-Hansard compile paths flatten a speech's paragraph breaks; the
Northern Ireland and Scottish paths do not. So there is **no stored paragraph index to key on** for
ten of the eleven questions, and a key of the form "paragraph 4" would be unresolvable.

**The key is therefore a VERBATIM QUOTATION**, which is stricter than an index anyway: an index
survives a re-compile that changes the text, a quotation does not. ⚠ It also means a re-compile that
alters punctuation or entity-decoding will invalidate these keys, and that is the right behaviour —
it should be loud, not silent.

▶ **This is an ingest observation, reported not acted on** (§6: nothing owned by ingest is edited).
`docs/CHANGE_LOG.md` carries it. It is not a defect in retrieval and it does not need fixing for
this sprint; it is recorded because "the corpus preserves paragraphs" is a thing two other sprints
have assumed.

---

## THE SENEDD COORDINATION POINT IS RESOLVED, AND NOT BY ASKING

The brief says CC-Ingest holds a Senedd backlog re-parse that renumbers identifiers, and to confirm
which order happened before re-keying. **It does not touch this set: none of the eleven questions
has a `senedd-cofnod` key.** The two Senedd candidates were WITHDRAWN during GOLD V2 (their titles
said 20mph and their bodies were about oesophageal and stomach cancers), and Q3 moved to Northern
Ireland as a result. So the re-key and the re-parse cannot collide, whichever ran first.

⚠ **It will matter for the next Welsh question.** 61.1% of `senedd-cofnod` speeches sit in their
session's single biggest heading block, and 95% of a 40-row sample has Welsh bodies — so a Welsh
devolved question is not askable in English today, and any future one must be keyed **after** the
re-parse, never before.

---

## THE ROWS

### 1 · Q1 — *"Did MPs argue for or against letting terminally ill people choose to die?"*
**Two keys, one each side of the argument. Both documents unchanged.**

**1a** `pwdata-debates:debates2024-11-29d:3` — Kim Leadbeater, 29 Nov 2024, 1,086 words
**Keyed paragraph** (83% of the way into the speech):
> "When four former directors of public prosecutions, including the Prime Minister, two former
> presidents of the Supreme Court and many lawyers all agree that the law needs to change, surely we
> have a duty to do something about it. … The law is not clear, and it does not protect individuals,
> families or medical professionals."

**Confirming sentence:** *"The law is not clear, and it does not protect individuals, families or
medical professionals."* — this is the argument FOR change, stated as a reason, not a summary of the
Bill.

**1b** `pwdata-debates:debates2024-11-29d:78` — Danny Kruger, same debate, 920 words
**Keyed paragraph** (44% in):
> "There is a broader point to make about choice, which is that no man or woman is an island. … The
> Bill will not just create a new option for a few and leave everyone else unaffected; it will impose
> this new reality on every person towards the end of their life … It will change life and death for
> everyone."

**Confirming sentence:** *"It will change life and death for everyone."* — the argument AGAINST,
made as an argument rather than as an objection to a clause.

**VERDICT 1:** ______

---

### 2 · Q2 — *"Did peers back the assisted dying bill when it reached the Lords?"*
`pwdata-lords:daylord2025-09-12c:4` — Lord Falconer of Thoroton, 12 Sep 2025, 2,634 words
**Keyed paragraph** (the opening — see the note below):
> "My Lords, this issue has been debated for years, particularly in this House. … For the first
> time, we have before us a Bill on assisted dying, which has come from the other place. … The
> current law is confused, causes terrible suffering, and lacks compassion and safeguards."

**Confirming sentence:** *"The current law is confused, causes terrible suffering, and lacks
compassion and safeguards."* — the case for backing the Bill, in the mover's own words.

⚠ **This one IS the head of the document, and that is recorded rather than avoided.** §3's finding
is that showing the head is wrong *by default*, not that the head is never the right passage. A
re-key that quietly moved every paragraph away from the opening would be fitting the key to the fix.

**VERDICT 2:** ______

---

### 3 · Q3 — *"What did ministers at Stormont say about the botched green energy scheme?"*
`niassembly-hansard:286438:151` — Ministerial Statement on the Renewable Heat Incentive, 19 Dec 2016,
4,780 words
**Keyed paragraph** (11% in):
> "Once again, for the avoidance of doubt, I believe that it is right and proper that I answer to the
> Assembly for my role in the RHI scheme, and not for one moment do I seek to shirk or avoid that
> responsibility. But, if we are to learn lessons from the entire experience, it is essential that we
> know exactly where things went wrong."

**Confirming sentence:** *"I answer to the Assembly for my role in the RHI scheme."* — this is what a
minister at Stormont said about the scheme, which is what the question asks for. The chronology of
the failure is later in the same speech (50% in) and is a **candidate amendment** if you would rather
key the facts than the accountability.

⚠ `speaker` is NULL on this row — the NI corpus does not carry the column structurally, so the
platform cannot say who said it. Not a fault in this key; it is a §3 limitation for this collection.

**VERDICT 3:** ______

---

### 4 · Q4 — *"Has Parliament debated scrapping the benefit limit for families with more than two children?"*
**Two keys, two different debates four years apart. Both documents unchanged.**

**4a** `pwdata-westminster:westminster2022-04-21a:27` — Karen Buck, 21 Apr 2022, 1,360 words
**Keyed paragraph** (the closing):
> "The Government should respond to that by ditching the two-child policy now. … It would remove the
> perverse incentive for couples with separate families to maintain two separate households and it
> would help to address the rise in child poverty, restoring the principle that our welfare state
> treats all children equally."

**Confirming sentence:** *"The Government should respond to that by ditching the two-child policy
now."* — the proposition the question asks whether Parliament has debated, put in terms.

**4b** `pwdata-westminster:westminster2018-11-27c:55` — Alison Thewliss, 27 Nov 2018, 1,444 words
**Keyed paragraph** (the opening):
> "The cut in this benefit is £2,780 per child, per year, which is a sum that families will struggle
> to make up through taking on extra work. The Church of England calculates that a single parent with
> three children who is working 16 hours at the minimum wage … would need to work 45 hours to
> compensate for the loss of income."

**Confirming sentence:** *"…would need to work 45 hours to compensate for the loss of income."* — the
argument for scrapping the limit, with the number it rests on.

**VERDICT 4:** ______

---

### 5 · Q5 — *"What did peers say about overturning the subpostmasters' convictions?"*
`pwdata-lords:daylord2024-05-13a:113` — Lord Falconer of Thoroton, 13 May 2024, 2,080 words
**Keyed paragraph** (24% in):
> "The Bill addresses only one aspect of the scandal: how to extinguish the wrongful convictions. In
> many of the cases … much of the underlying written and other material has been lost, partly because
> the Post Office has destroyed it and partly because the defendants want nothing more to do with what
> was a terrible period in their lives."

**Confirming sentence:** *"The Bill addresses only one aspect of the scandal: how to extinguish the
wrongful convictions."* — a peer speaking directly to overturning the convictions, and to why the
ordinary appeal route could not do it.

**VERDICT 5:** ______

---

### 6 · Q6 — *"When did Parliament last seriously debate bringing back the death penalty?"*
**Two keys, 1956 and 1969.**

**6a** `historic-hansard:S5LV0198P0:1798` — Lord Chancellor (Viscount Kilmuir), 9 Jul 1956, 5,102 words
**Keyed paragraph** (the opening):
> "After this debate your Lordships will decide whether this Bill should be given a Second Reading,
> and that decision will be taken, as a similar decision was taken in another place, on a free vote.
> It will be for every noble Lord to search his conscience and express by his vote his personal
> conviction of what is right."

**6b** `historic-hansard:S5LV0306P0:1905` — Lord Chancellor (Lord Gardiner), 17 Dec 1969, 5,714 words
**Keyed paragraph** (the opening):
> "…the Government have come to the conclusion that the time has arrived when Parliament, on a free
> vote, should be asked to decide whether or not capital punishment should be abolished. In order to
> do so, I must deal briefly with the Parliamentary history."

**Confirming sentence:** *"…whether or not capital punishment should be abolished."* — the 1965 Act
was due to EXPIRE, so the question before the House in 1969 was literally whether the death penalty
should return. That is the "bringing back" the question asks about, from the other direction.

⚠ **DECISION FOR YOU.** Both keys are ABOLITION debates. The question says *"bringing back"*. In 1969
those are the same vote; in 1956 they are not — Kilmuir was resisting abolition, not proposing
restoration. **Recommendation: keep 6b, and either AMEND the question to "…last seriously debate the
death penalty?" or REJECT 6a.** Consequence of leaving both: a question whose two keys answer two
different questions, which is how an answer key stops determining a direction.

**VERDICT 6:** ______

---

### 7 · Q7 — *"What happened to the plan to make the House of Lords elected?"*
`pwdata-lords:daylord2012-04-30a:76` — Lord Richard, 30 Apr 2012, 2,978 words
**Keyed paragraph** (37% in):
> "…that the House of Lords would be elected on a different electoral system; that 20 per cent of the
> membership would be appointed not elected; and that the Parliament Acts would continue to apply. …
> In the end, the committee, by a majority of 12 to 10, 'while acknowledging that the balance of power
> would shift, consider that the remaining pillars on which Commons primacy rests would suffice to
> ensure its continuation'. The vote was 12 in favour and 10 against."

**Confirming sentence:** *"The vote was 12 in favour and 10 against."* — the Joint Committee's actual
finding on the plan, which is *what happened to it* rather than what was proposed.

**VERDICT 7:** ______

---

### 8 · Q8 — *"What did MSPs say about making it easier to change your legal gender?"*
`scottish-parliament-or:14066:193` — Russell Findlay MSP, Stage 3, 20 Dec 2022, 2,084 words
**Keyed paragraph** (the opening):
> "It is not just a piece of paper. It fundamentally changes many aspects of society… The proposed
> new system is radical—some might even say that it is experimental—when anyone can simply declare
> that they have changed sex, and that will be taken at face value and facilitated by the state."

**Confirming sentence:** *"…when anyone can simply declare that they have changed sex."* — an MSP
addressing the change the question describes, in the terms the question uses.

⚠ This key carries only ONE side. The question asks what MSPs said, and a single opposing speech is a
partial answer to it. **Candidate amendment: add a second key from a supporting speech in the same
Stage 3**, which would make it the same shape as Q1. Not done here — §4 says re-key, not extend.

**VERDICT 8:** ______

---

### 9 · Q9 — *"Why were energy companies forcing people onto prepayment meters?"*
`pwdata-debates:debates2022-12-15b:298` — Alan Brown, 15 Dec 2022, 1,551 words
**Keyed paragraph** (48% in):
> "Research by Utilita indicates that as many as 14% of the 4.5 million prepayment meter
> households—that is 630,000 households—did not actively choose to be on these tariffs but were
> forced on to them. … A recent investigation for i revealed that energy firms have secured almost
> 500,000 court warrants to install prepayment meters in the homes of customers in debt since the end
> of lockdown. … the roll-out of smart meters means that customers can be forced on to prepayment
> mode without the need for a warrant or for the meter to be physically changed."

**Confirming sentence:** *"…energy firms have secured almost 500,000 court warrants to install
prepayment meters in the homes of customers in debt."* — the reason (debt) and the mechanism (court
warrants, and smart meters needing no warrant at all), which is what *why* is asking for.

⚠ **A CORRECTION TO MY OWN FIRST CHOICE, AND IT IS THE REASON §4 REQUIRES READING THE SOURCE.** The
term-coverage ranking put the two highest-scoring windows at 21% and 14% in, and both are about the
**consequences** for the people it was done to — rationing, disconnection, damp housing. I had
written this row up as *"the question and the document do not match"* and recommended amending the
question. Then I read the whole 1,551-word body, and the answer to *why* is plainly in it, at 48%
in, in a window the keyword ranking placed nowhere near the top.

▶ **No amendment to the question is needed.** ⚠ And the near-miss is itself a finding worth carrying
into §3: **term density and "answers the question" are different things**, so the passage selector
that S13 ships will sometimes pick the wrong passage from the right document. It picks a far better
one than the head of the document, which is what it is for; it is not a relevance model, and this row
is the worked example of the difference.

**VERDICT 9:** ______

---

### 10 · Q10 — *"What has the government promised to do about the Grenfell inquiry's findings?"*
`pwdata-debates:debates2024-12-02c:452` — Alex Norris (minister), 2 Dec 2024, 2,910 words
**Keyed paragraph** (the opening):
> "As the inquiry's phase 2 report and today's debate have made clear, fundamental change is needed
> to make our homes secure and safe, both now and in the future. … It now behoves the Government of
> the day to move at much greater pace, building on the inquiry's recommendation to move at speed."

**Confirming sentence:** *"It now behoves the Government of the day to move at much greater pace."* —
the government's own undertaking, from the despatch box, on the inquiry's findings.

⚠ Also the head of the document. See the note on row 2.

**VERDICT 10:** ______

---

### 11 · Q11 — *"What did the Chancellor announce in the Spring Statement?"*
`pwdata-debates:debates2025-03-26b:130` — Rachel Reeves, 26 Mar 2025, 4,422 words
**Keyed paragraph** (74% in):
> "…I can announce to the House that the OBR has considered and has scored one of the central planks
> of our plan for growth. In my first week as Chancellor, I announced that we were pursuing the most
> ambitious set of planning reforms in decades to get Britain building again, and in December we
> published changes to the national planning policy framework…"

**Confirming sentence:** *"I can announce to the House that the OBR has considered and has scored one
of the central planks of our plan for growth."* — an actual announcement, three quarters of the way
into the statement.

⚠⚠ **THIS ROW IS THE WHOLE SPRINT IN ONE DOCUMENT.** The speech is 26,259 characters. Until S13 §3
the platform displayed characters 0–300 of it — the words *"This Labour Government were elected to
bring change to our country…"*, which is a preamble containing no announcement at all. The keyed
paragraph starts at character 19,420. ⚠ **And the chunker's `MAX_CHUNKS` cap of 8 windows covers only
the first ~22,240 characters, so the last 15% of this statement carries no vector at all and cannot
be reached by meaning-based search at any setting.** Reported, not fixed — it is a chunking decision
with a cost attached, and changing it is a re-embed.

**VERDICT 11:** ______

---

## WHAT HAPPENS AFTER YOUR PASS

1. The verdicts are transcribed into `scripts/gold/gold-v2-set.ts` as a `keyParagraph` beside each
   `keys` entry, with a check asserting this file and that file agree in both directions — the same
   arrangement as `check:goldv2`, which caught a wrong key on its first run.
2. **Only then** is anything scored. S13 scored nothing against these keys, deliberately.
3. The debates recall figure re-taken against them **supersedes nothing**, because there is no sound
   earlier debates figure to supersede: the 0 of 11 was measured against speech-level keys and the
   S13 §1 audit re-measured it at 0 of 11 with 9 of the 11 NOT-RETRIEVED at all.
