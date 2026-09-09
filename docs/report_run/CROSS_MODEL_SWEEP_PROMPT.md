# Cross-model sweep — paste this into Grok, ChatGPT and Gemini

**One prompt, three models, three pastes back.** Run them separately rather than in one thread, so
the answers are independent. Paste each reply back unedited; I will reconcile them and flag where
they disagree, which is usually where the interesting material is.

⚠ **Do not tell the models what we already have.** A model shown our list will confirm our list. The
point is to find what we have missed.

---

## The prompt

> I am scrutinising a proposed UK constitutional reform programme and I need to make sure I have not
> missed significant published commentary. Please answer as a research librarian would: name
> sources, not opinions.
>
> The programme proposes, among other things:
> 1. Repealing the Human Rights Act 1998 and withdrawing from the European Convention on Human Rights
> 2. Repealing the Equality Act 2010, including the public sector equality duty in section 149
> 3. Repealing Part 1 of the Constitutional Reform and Governance Act 2010, which put the civil
>    service on a statutory footing
> 4. Abolishing the UK Supreme Court and restoring the office of Lord Chancellor
>
> For each of those four, list the most significant published contributions of the last fifteen
> years — books, official or independent reviews, select committee reports, think tank papers,
> lectures, long-form interviews, podcasts and academic articles — **on both sides of the argument.**
>
> For each item give: author and their standing, title, year, publisher or platform, and one sentence
> on what it argues. Prioritise:
>
> - **Official and parliamentary sources** — government reviews, independent reviews commissioned by
>   government, select committee reports
> - **Legislation that was actually attempted and what happened to it**
> - **Serving or former judges, law officers and parliamentary counsel** writing or speaking on these
>   questions
> - **The strongest opposing arguments**, stated at their strongest rather than as straw men
> - **Anything published in the last eighteen months**, which I am most likely to have missed
>
> Then tell me, separately: what would you expect a well-informed critic of this programme to cite
> that a proponent would probably not have read?
>
> Where you are unsure whether something exists or you cannot confirm a detail, say so explicitly
> rather than filling the gap. I would rather have a short accurate list than a long plausible one.
>
> **For each source you name, state on its own line whether you are certain of the exact citation.**
> If you are not certain of the number, the name and the date, say so and give instead the nearest
> source you ARE certain of. A source you cannot vouch for must be labelled `UNVERIFIED` — not
> omitted, and not guessed at. Use this form on every item, with no exceptions:
>
> > `CERTAIN` — author, title, year, publisher — one sentence on what it argues
> > `UNVERIFIED (number)` — author, title, approximate year — *I am confident this paper exists but
> > not of its number; the nearest I am certain of is …*
>
> An item with no certainty label will be treated as unverified.

---

## ⚠ Why the certainty label is per-item and mandatory

**The first run of this sweep produced roughly 160 sources and five fabricated citations, and all
five came from Gemini** — HL Paper 150, HL Paper 88, a Sedwill IfG lecture, a Policy Exchange *Cost
of Compliance*, and a Lady Hale 2023 lecture. Every one had a real neighbour: a genuine paper with a
different number, a genuine lecture by a different person. Grok and ChatGPT, which flagged their own
uncertainty as they went, produced almost none.

⚠⚠ **The general request for uncertainty to be flagged was already in this prompt when that
happened.** A closing sentence asking a model to mention anything it is unsure about is satisfied by
a model that is not, in the moment, aware of being unsure. Requiring a label on *every* item makes
the judgement happen once per source instead of once per answer, and makes an omission visible: an
unlabelled item is a defect in the reply rather than an implicit claim of confidence.

**Anything the three models agree on is probably real; anything only one names goes on a verify list
before it enters the report.** Five in one sweep is a rate, not an accident.

⚠ **This applies to the manual sweep and not to the build.** No model-authored citation can reach a
proposal through the product: an evidence row's `citation`, `url` and date are copied from the corpus
row the finding was drawn from, never written by the model, and the one path by which an outside
model can name a source we do not hold — the terms of art it volunteers — is quarantined as a stated
gap carrying the words *"nothing in the proposal may cite it"*. The exposure is in this channel,
which is the hand-run one.

## What to do with the answers

Paste all three back. I will:

1. Reconcile them into one list, marking each item by how many models named it
2. Verify every item that is going to be cited, against the actual source
3. Report what they found that our own searches did not — because that number is itself a finding
   about our method
