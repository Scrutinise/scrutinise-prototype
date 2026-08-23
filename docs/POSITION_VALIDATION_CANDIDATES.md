# POSITION GRAPH — VALIDATION CANDIDATES (REBUILT, UNSCORED)

**For:** Charlie, to read the evidence and assign the position, one row at a time.
**Produced by:** `scripts/graph/rebuild-3c2-validation.ts`, GRAPH 3C-2.
**Nothing here has been scored against anything.**

---

## ⚠⚠ Why the previous draft was withdrawn

The first draft had 157 rows. **136 of them rested on AMENDMENT SPONSORSHIP**, and that
basis cannot carry a direction.

It was chosen because it is **non-circular** — the graph holds zero `amendment_sponsorship`
signals, and that was proven by query rather than argued. That reasoning is genuinely
valuable. It is also incomplete:

> **Non-circularity is necessary. It is not sufficient. The basis must ALSO determine a**
> **direction.**

Amendment sponsorship is **unsigned**: tabling a wrecking amendment and tabling a
strengthening one are the same recorded fact. Sir Edward Leigh appeared in that draft
sponsoring NC3 to the assisted dying Bill — he is one of its most prominent opponents, and
nothing in *"Guidance: administration of pain relief to people who are terminally ill"* says
so in either direction.

⚠⚠ **An independent signal that does not settle the answer is worse than useless in an**
**answer key, because it will mark the graph WRONG every time the graph is RIGHT.** Such a
key does not measure the graph; it measures whatever assigned each row its direction — and
it does so while looking rigorous.

Those 136 rows are **not deleted**. They are in a section at the foot of this document marked
**UNSOUND BASIS — NOT SCORABLE**, with this reasoning attached. The count is the finding.

## The bases, both tests

Every basis now has to pass two tests, not one. Full audit: `scripts/graph/audit-3c2-bases.ts`.

| basis | determines a direction? | independent of the graph? | verdict |
| --- | --- | --- | --- |
| amendment sponsorship | **NO** — unsigned | yes | **REJECT** |
| bill sponsorship | YES — sponsoring a Bill is supporting it | yes | **USE** |
| the member's own words in Hansard | YES — arguing a case states a direction | yes | **USE** |
| a published statement on the web | YES | yes | USE — *not needed, see below* |
| EDM signature | YES | **NO** — 59,925 signals | EXCLUDE (circular) |
| division votes | YES | **NO** — 2,080,585 signals | EXCLUDE (circular) |
| TheyWorkForYou "voted consistently for…" | YES | **NO** — a function of the same divisions | EXCLUDE (circular) |
| committee membership · witness appearance · declared interest · donation | **NO** — engagement or alignment, never a side | — | REJECT |
| party membership / manifesto · ministerial office | **PARTLY** — the party's direction, not the member's | yes | REJECT |

⚠ **Route (b), a published statement on the web, was NOT needed and so was not used.**
144 of the 157 candidates turned out to have spoken on their own matter in Hansard, so
every sound row below comes from route (a) or route (c). Nothing was searched for on the web,
and no row rests on a source anyone has to take on trust.

⚠ **On `pwdata`.** These transcripts come from TheyWorkForYou's bulk data, and TWFY's
*computed* position summaries ("voted consistently for…") are exactly the circular source
this key must avoid — they are a function of the same divisions the graph aggregates. What
is quoted below is the **verbatim Hansard transcript** TWFY republishes: words spoken in the
chamber, with no computation over any vote anywhere. Different thing, same publisher.

## How to review this

**The row states the evidence. You state the conclusion.** There is deliberately no
"proposed position" line anywhere in the sound section — the previous draft had one above
every quote, and a row that announces its own answer invites a rubber stamp. Read the quote,
then write the position.

On each row: `SUPPORTS` · `OPPOSES` · `NO POSITION ESTABLISHED` (the evidence does not
settle it) · `UNSURE`.

**The extract is chosen by a rule that cannot see which way it points**, and the rule is
printed on every row: *the member's longest speech in a debate titled for this matter,*
*quoted in full* where it is 350 words or fewer, and otherwise its first
220 and last 130 words. Nothing is picked for containing a stance word — that would be
the generator pre-judging the answer it is asking you for.

⚠ **Why both ends, and not just the opening.** A ministerial wind-up can spend its first
250 words congratulating maiden speakers — mechanically correct to quote, and useless for
deciding what the member thinks. A peroration is exactly as mechanical a place to look as
an opening, and neither is chosen for what it says.

⚠ **Quoting in full is also the safeguard against a specific trap.** Sir Edward Leigh's
speech reads out a constituent's email containing *"I oppose the right to die Bill"*. An
extract built around the word "oppose" would put the constituent's sentence in his mouth.
The context is the defence, so the context is not cut away — and where a member is quoting
someone else, you will be able to see that they are.

⚠⚠ **Speech-sourced rows are marked `hansard-speech`, and that mark has a shelf life.**
The graph holds no speech-derived signal today, which is what makes these rows independent.
**If extracted-position signals are ever folded into the graph (design §4, P3), every
`hansard-speech` row stops being independent and must be excluded from scoring from that
point on.** Bill-sponsorship rows are unaffected.

⚠ **The selection used the graph; the verdict must not.** Which rows appear first was chosen
partly on what the graph currently holds, so that settled and divided records are both
represented. Its *answer* is nowhere on this page — no stance, no score, no confidence sits
near a verdict line. The **Coverage** line says only how many votes exist and whether they
agree with each other, never which way. An accuracy figure from a deliberately
hard-weighted subset is not an accuracy figure for the graph.

---

# ▶ SOUND — SCORABLE (50 rows)

50 rows across 10 matters. Bases: **50 `hansard-speech`**, **0 `bill-sponsor`** (21 rows have both). Coverage strata: A 13 settled · B 31 divided · C 6 thin.

⚠ **Every sound row turned out to rest on a speech.** 21 of them are ALSO named sponsors of the Bill, which is a second independent basis pointing the same way — but not one row rests on bill
sponsorship alone, because every bill sponsor in the pool also spoke. Route (c) was
available and never had to carry a row by itself.

⚠ **Some members appear in BOTH sections, and that is not a duplicate.** 30 of the 46 people below also have a row in the unsound section at the foot of
this document. It is the same person with two different citations: an amendment they
sponsored, which establishes nothing about direction, and a speech they made, which does.
Score the speech row. The amendment row is there to be seen, not scored.

## M1 — Assisted dying

Debates matched on the title *"Terminally Ill Adults"*.

### S1.01 — Kim Leadbeater (MNIS 4923), Labour

- **Matter:** Assisted dying
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2024-11-29, House of Commons
- **Debate:** Terminally Ill Adults (End of Life) Bill
- **Speech id:** `pwdata-debates:debates2024-11-29d:40`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2024-11-29d.1019.4>
- **Selection rule:** their longest speech in a debate titled for this matter (1,188 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 11 votes recorded, NOT all the same way

**In their own words:**

> I am sorry but I am not going to take any interventions, as I need to make progress. The court must speak to one of the doctors and can hear from anybody else they deem necessary. If there is any evidence of coercion, the court will not approve the request, and if evidence emerges subsequently, the court order could be revoked. It is also important to note that the person can change their mind at any time, with periods of reflection built in. Having consulted at the highest levels in the judiciary and the medical profession, I know that they can and will fulfil those safeguarding responsibilities and that they have the expertise to do so.[Official Report, 29 November 2024 ; Vol. 757, c. 1079.] (Correction) Let us be clear: as my hon. Friend the Member for Sittingbourne and Sheppey (Kevin McKenna) said earlier, this is not brand new territory for doctors. Doctors, working in partnership with other clinicians, are already required to manage complexity in end-of-life decision making. I followed the request of the British Medical Association that doctors should be under no obligation whatsoever to participate, but if they do participate, they will receive appropriate training and support. Doctors should be able to use their professional judgment when and if a conversation takes place, taking their cue from
>
> [… 838 words omitted — the whole speech is one click away …]
>
> debate. It is a vote to subject the Bill to line-by-line scrutiny in Committee, on Report and on Third Reading. Then, of course, the Bill will go to the Lords for what I have no doubt will be further robust debate and scrutiny. This will be a thorough process, focused on one of the most significant issues of our time—an issue that people across the country clearly want us to address, none more so than the many families who are facing the brutal and cruel reality of the status quo. Today is the beginning, not the end, of that process, but the debate can continue only if colleagues join me in the Aye lobby today. I wholeheartedly encourage them to do so, and I commend the Bill to the House.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S1.02 — Lord Falconer of Thoroton (MNIS 2758), Labour

- **Matter:** Assisted dying
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2025-09-12, House of Lords
- **Debate:** Terminally Ill Adults (End of Life) Bill - Second Reading
- **Speech id:** `pwdata-lords:daylord2025-09-12c:4`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2025-09-12c.1774.2>
- **Selection rule:** their longest speech in a debate titled for this matter (2,634 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** no votes recorded on this matter

**In their own words:**

> My Lords, this issue has been debated for years, particularly in this House. The House is full this morning; that reflects the seriousness with which your Lordships take this issue. For the first time, we have before us a Bill on assisted dying, which has come from the other place. I know that we will do what we do so well, which is scrutinise. This is a historic occasion. The current law is confused, causes terrible suffering, and lacks compassion and safeguards. People must be at the heart of this debate. The Government’s own estimate is that, if the law was changed to introduce assisted dying, less than 1% of deaths would be assisted after 10 years. However, it is right that we allow assisted dying as an option for those who, despite the best palliative care, still want an assisted death. Palliative care cannot alleviate the pain of everyone. Lucy Davenport’s husband, Tom, had an agonising death from bile duct cancer, despite receiving excellent care in a hospice. He died by choking on faecal vomit: “The look on Tom’s face of terror and horror, that’s going to be with us forever. He would be horrified to think that was our last memory of him”. For many others, it is not about pain; it is about alleviating fear or bringing
>
> [… 2,284 words omitted — the whole speech is one click away …]
>
> elected House has expressed its will. I am confident that your Lordships will now do what you have done so well in the past. Whatever view we might take on the decision that the Commons arrived at, the way the debate was conducted there enhanced the reputation of Parliament. I hope and believe that we can embark on our scrutiny in a manner that will reflect just as well on our House. The Bill before us has already given hope to those with personal experience of the injustice of the current law. They will be looking to us to play our proper role. If we can improve it further, we should and we will have done our duty. I commend this Bill to the House and I beg to move.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S1.03 — Tom Gordon (MNIS 5032), Liberal Democrat

- **Matter:** Assisted dying
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2025-06-13, House of Commons
- **Debate:** Terminally Ill Adults (End of Life) Bill — New Clause 13 - Regulation of approved substances and devices for self-administration
- **Speech id:** `pwdata-debates:debates2025-06-13d:124`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2025-06-13d.1269.0>
- **Selection rule:** their longest speech in a debate titled for this matter (309 words, quoted in full). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 11 votes recorded, NOT all the same way

**In their own words:**

> I rise to speak to amendment 3 in my name, which would do the exact opposite of the amendments of the hon. Member for Newcastle-under-Lyme (Adam Jogee) —in fact, it would see the commencement period reduced from four years to three years. As a member of the Bill Committee, when we had the initial conversation about increasing the commencement period from two years to four years, I was the only person to speak against it, and I pushed it to a vote. What frustrates me about the situation we are in is that, in effect, we are acknowledging that the reason we are here and debating this Bill is that the status quo is not acceptable. People are pushed to taking decisions that they should not be and having to go to foreign countries to have opportunities overseas. Those of us who support the Bill are broadly in agreement on those principles. A number of things frustrate me about the four-year period, principally that the people in office—the Government of the day—will not necessarily be here to implement it. I am really hesitant about supporting a Bill when we do not know who would see through those details. Amendment 3 would reduce the threshold back down to three years, which would still be more than most jurisdictions around the world. Countries have implemented assisted dying legislation after as short a time as six months, 12 months or 18 months, so three years would still be a substantial increase compared with other countries. We are not innovators or leaders in this field: there is no reason why we cannot take best practice and learn from and speak to colleagues around the world. I believe that this Bill has the strongest safeguards of any, which is why I think an implementation period of three years would more than meet the requirements.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S1.04 — Sir Edward Leigh (MNIS 345), Conservative

- **Matter:** Assisted dying
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2025-06-20, House of Commons
- **Debate:** Terminally Ill Adults (End of Life) Bill — Schedule 2 - Assisted Dying Review Panels
- **Speech id:** `pwdata-debates:debates2025-06-20a:105`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2025-06-20a.747.0>
- **Selection rule:** their longest speech in a debate titled for this matter (676 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 11 votes recorded, NOT all the same way

**In their own words:**

> I have served for many years with the right hon. Member for Hackney North and Stoke Newington (Ms Abbott) and, dare I say it, we have not agreed on everything over the years, but we have published a few articles on this topic. Those articles have always started with the fundamental principle of the NHS. Some of us—maybe myself included—have been rather critical of the NHS over the years, but at least when we go into the NHS, we know that everybody is really trying their best to preserve life. That is the fundamental principle. The reason why the right hon. Lady and I both oppose the Bill is that, as has been said several times, we are not talking about just a principle here; we are talking about an actual Bill. I know some people will criticise me and say, “Oh, you would oppose this, because of your religious views and all the rest of it.” Actually, I take quite a sensible and, I hope, pragmatic approach to this. I have listened to all these debates, and we have heard so many harrowing stories of people’s last hours. I think we should treat people on both sides of this argument with respect, understand their points of view, and respect the dignity of dying people. I have always taken the
>
> [… 326 words omitted — the whole speech is one click away …]
>
> we vote for this Bill, do we not think that we should ask the Health Department to have a profound and knowledgeable study, working with the royal colleges, on whether it is possible to have decent palliative care, not just in our wonderful hospices, but in all our hospitals? There is no doubt that in recent years, particularly since Shipman, there has been a fear among many NHS health professionals about providing that degree of palliative care—that degree of morphine, fentanyl or these hugely effective modern drugs. So, just pause and think. We are not voting on a principle; we can come back to this, and, at a later date, we can get consensus and we can have a really good Bill that will allow everybody to die in dignity.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S1.05 — Dame Meg Hillier (MNIS 1524), Labour

- **Matter:** Assisted dying
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2024-11-29, House of Commons
- **Debate:** Terminally Ill Adults (End of Life) Bill
- **Speech id:** `pwdata-debates:debates2024-11-29d:124`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2024-11-29d.1044.2>
- **Selection rule:** their longest speech in a debate titled for this matter (492 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 11 votes recorded, NOT all the same way

**In their own words:**

> In my brief remarks today, I want to touch on principle, policy and practice. We have to be very clear that we are having a debate not just on the principle, but on the Bill. The principle at stake is that we would cross a Rubicon whereby someone who is terminally ill, according to the definition in the Bill, is assisted by the state to die. That is a fundamental change in the relationship between the state and the citizen, and the patient and their doctor. If we have a scintilla of doubt about allowing the state that power, we should vote against the Bill today. Like most of us, I came into politics partly to stand up for the vulnerable, and we have heard heartbreaking stories today about those vulnerable at the point of death. We have also heard—and I concur completely with my right hon. Friend the Member for Hackney North and Stoke Newington (Ms Abbott) —about those who are vulnerable for other reasons and who could be coerced or persuaded down this route. I have had the privilege of being around the hospice movement for nearly 50 years, as my father established one of the first national health service hospices in this country. I saw what he did as a doctor in a world where death was
>
> [… 142 words omitted — the whole speech is one click away …]
>
> teenager with acute pancreatitis. The Bill would not have covered her, but I did not know for five days—in fact, many months—whether she would live or die. For those first five days she did not sleep and she did not eat, and she was crying out in pain. I saw what good medicine can do. It palliated that pain and got her to a place where, although she was unable to eat for two and a half months, she was saved and her pain was managed. Our best friends were the pain nurses and the anaesthetists. I have other examples of another family member, but I do not have time to go into them today. I hope my daughter forgives me for raising her personal situation in the House today—

- **VERDICT — what position, if any, does this evidence establish?** _______

## M2 — Removals to Rwanda

Debates matched on the title *"Safety of Rwanda"*.

### S2.06 — James Cleverly (MNIS 4366), Conservative

- **Matter:** Removals to Rwanda
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2024-01-17, House of Commons
- **Debate:** Safety of Rwanda (Asylum and Immigration) Bill
- **Speech id:** `pwdata-debates:debates2024-01-17c:361`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2024-01-17c.965.1>
- **Selection rule:** their longest speech in a debate titled for this matter (412 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 32 votes recorded, NOT all the same way

**In their own words:**

> The hon. Gentleman certainly speaks for a number of Members in the House, although maybe not too many on his own Benches, because it sounds as if he wants this to work, whereas plenty of Opposition Members have tried to frustrate our attempts to deal with illegal migration. But we will of course want to assess the success because we want to be proud of the fact that this Government, unlike the Opposition parties, actually care about strengthening our borders and defending ourselves against those evil people smugglers and their evil trade. To be clear, we will disapply the avenues used by individuals that blocked the first flight to Rwanda, including asylum and human rights claims. Without that very narrow route to individual challenge, we would undermine the treaty that we have just signed with Rwanda and run the very serious risk of collapsing the scheme, and that must not be allowed to happen. But if people attempt to use this route simply as a delaying tactic, they will have their claim dismissed by the Home Office and they will be removed. The Bill also ensures that it is for Ministers and Ministers alone to decide whether to comply with the ECHR interim measures, because it is for the British people and the British people alone to decide who comes
>
> [… 62 words omitted — the whole speech is one click away …]
>
> the civil service code are there to deliver the decisions of Ministers of the Crown. The Bill is key to stopping the boats once and for all. To reassure some of the people who have approached me with concerns, I remind them that Albanians previously made up around a third of small boat arrivals, but through working intensively and closely with Albania and its Government, more than 5,000 people with no right to be here have been returned. The deterrent was powerful enough to drive down arrivals from Albania by more than 90%. Strasbourg has not intervened, flights from Rwanda have not been stopped and the House should understand that this legislation once passed will go even further and be even stronger than the legislation that underpins the Albania agreement.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S2.07 — Lord Sharpe of Epsom (MNIS 4888), Conservative

- **Matter:** Removals to Rwanda
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2024-03-20, House of Lords
- **Debate:** Safety of Rwanda (Asylum and Immigration) Bill - Commons Reasons — Motion E
- **Speech id:** `pwdata-lords:daylord2024-03-20b:121`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2024-03-20b.247.2>
- **Selection rule:** their longest speech in a debate titled for this matter (2,388 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 25 votes recorded, all the same way

**In their own words:**

> My Lords, I will also speak to Motions E1, F, G, G1, H and H1. We have now debated at length the individual provisions in the Bill. Far too many lives have been lost at sea as migrants have chosen to leave the safety of safe third countries, such as France, to make perilous journeys across the channel. It remains the Government’s priority to deter people from making dangerous and unnecessary journeys, but this deterrent will work only if we apply the same rules to everyone. Although I have no doubt these amendments are well intended, they will encourage more and more people to make spurious claims to avoid their relocation to Rwanda, as well as undermine legislation passed by Parliament in recent years. Amendment 7B relates to Section 57 of the Illegal Migration Act 2023, “Decisions relating to a person’s age”, to amend the definition of a relevant authority for that section if a person is to be removed to the Republic of Rwanda. Section 57 applies to decisions on age made by a relevant authority on persons who meet the four conditions under Section 2 of the IMA. Section 57 disapplies the right of appeal for age-assessment decisions made under Section 50 or 51 of the Nationality and Borders Act 2022, prevents a judicial review challenge to a
>
> [… 2,038 words omitted — the whole speech is one click away …]
>
> of the Illegal Migration Act, passed by Parliament last year, enable the Secretary of State by regulations to specify categories of persons to whom the duty to remove is not to apply, whether on a temporary or permanent basis. We want to reassure Parliament that once the UKSF ARAP review, announced on 19 February , has concluded, the Government will consider and revisit how the IMA, and removal under existing immigration legislation, will apply to those who are determined ARAP eligible as a result of the review, ensuring that these people receive the attention they deserve. This Government recognise the commitment and responsibility that comes with combat veterans, whether our own or those who showed courage by serving alongside us. We will not let them down. I beg to move.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S2.08 — Mr Alistair Carmichael (MNIS 1442), Liberal Democrat

- **Matter:** Removals to Rwanda
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2024-03-18, House of Commons
- **Debate:** Safety of Rwanda (Asylum and Immigration) Bill — Clause 1 - Introduction
- **Speech id:** `pwdata-debates:debates2024-03-18c:337`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2024-03-18c.710.1>
- **Selection rule:** their longest speech in a debate titled for this matter (804 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 31 votes recorded, NOT all the same way

**In their own words:**

> It is a pleasure to follow the right hon. Lady, particularly given the context she gave to this debate, which is important and worth reflecting on for a second or two. She reminds us that this is in fact the third Bill in this area in this Parliament. Indeed, as the shadow Minister, the hon. Member for Aberavon (Stephen Kinnock) , pointed out towards the end of his remarks, we now have another innovation: people are to be offered a cash payment to take the opportunity of going to Rwanda. What do three Bills and a still evolving political situation and portfolio of arrangements tell us? They tell us that this Government have no strategic purpose in how they are tackling this problem, and that has become apparent from a number of the interventions today. We have spoken an awful lot about the rule of law. To be honest, this Bill and this debate are not about the rule of law; they are an entirely political exercise. I am pretty certain that the Government will win the votes tonight, that they will face down their lordships, and that they will get their way. I would be astonished if any of the legislation makes any significant difference at the end of the day, because this is not about the law or
>
> [… 454 words omitted — the whole speech is one click away …]
>
> the people who will then make the decisions should not allowed to take any account of it. That makes no sense. If we were serious about finding a solution to the problem and breaking the business model of the people traffickers, the Government would be taking in the Opposition, the Scottish nationalists, ourselves and all parties to try to find a common way forward. In fact, they are doing the opposite. They are seeking to manage the issue politically in such a way as to increase division and not to build consensus. In the time remaining to them in government, they will be able to win votes like this, but they will not do anything to stop the traffic. Ultimately, they will have to be replaced by those who will.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S2.09 — Robert Jenrick (MNIS 4320), Conservative

- **Matter:** Removals to Rwanda
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2024-01-17, House of Commons
- **Debate:** Safety of Rwanda (Asylum and Immigration) Bill — Clause 3 - Disapplication of the Human Rights Act 1998
- **Speech id:** `pwdata-debates:debates2024-01-17c:164`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2024-01-17c.844.4>
- **Selection rule:** their longest speech in a debate titled for this matter (785 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 11 votes recorded, NOT all the same way

**In their own words:**

> No. There may be a good-faith disagreement between the hon. and learned Lady and me, but I do not believe that international bodies and courts should be able to grow organically as a result of the decisions of activist judges. This is a matter of the rule of law and of parliamentary sovereignty. We in the United Kingdom chose to be a signatory to the European convention on human rights, and I do not think it is correct that the Court gave itself this power in 2005. I return to how this matter relates to the policy. First, let us cast our minds back to the summer of 2022. A rule 39 interim measure was imposed by the Court to ground a flight and to prevent us from proceeding with the policy. Do we think that anything has changed in the months and years that have passed? My conjecture is no. We will be in exactly the same position in a few months’ time unless we take action. We included a provision in the Illegal Migration Act that merely restated the orthodox constitutional and legal position that, in theory, it is at a Minister’s discretion whether to comply with a rule 39 interim measure. Underlying that was the Government’s legal advice—which I believe to be erroneous, for the reasons I
>
> [… 435 words omitted — the whole speech is one click away …]
>
> to resolve this situation. If we do not, we will be here in two months’ time, the Strasbourg Court will impose a rule 39 measure and the Government will be scrambling around trying to resolve the situation, and they will have no one else to blame. I am here to help the Government, to ensure that this policy works, because I, like everyone, at least on this side of the Committee, believe passionately that we have to make this policy work and to stop the boats. So I strongly encourage my hon. and learned Friend the Minister, and indeed the Prime Minister, to support the amendment, and I encourage everyone else on both sides of the Committee who shares my determination to fix this problem to do exactly the same.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S2.10 — Lord German (MNIS 4163), Liberal Democrat

- **Matter:** Removals to Rwanda
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2024-01-29, House of Lords
- **Debate:** Safety of Rwanda (Asylum and Immigration) Bill - Second Reading — Amendment to the Motion
- **Speech id:** `pwdata-lords:daylord2024-01-29b:70`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2024-01-29b.1010.2>
- **Selection rule:** their longest speech in a debate titled for this matter (1,396 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 25 votes recorded, all the same way

**In their own words:**

> My Lords, I direct the House’s attention to my interests as laid out in the register. The treatment of asylum seekers and refugees, which this Bill is seeking to affect, is completely contrary to how we should act as a country with a reputation for protecting individuals’ rights and freedoms, where the rule of law is upheld. I do not need to repeat the key points of last week’s debate on the Rwanda treaty, but the decision of this House is significant in respect of the Bill. This House resolved that it could not ratify the treaty that the Government are using to declare that Rwanda is safe. The House determined that the safeguards and protections outlined in the treaty must be fully implemented. Moreover, the House agreed that future assurances of changes in the processing of asylum seekers in Rwanda were not sufficient: the changes needed to be fully operational and effective. Significantly, the treaty is the instrument by which the Government declare that they can state in this Bill that Rwanda is safe. Clause 1(2)(b) is clear: “this Act gives effect to the judgement of Parliament that the Republic of Rwanda is a safe country”. However, this House of Parliament has not determined that this is the case. The treaty is the platform on which the Bill sits.
>
> [… 1,046 words omitted — the whole speech is one click away …]
>
> movement is critical, and a strong international aid and development budget is key to that. Instead, we are presented with a political totem of the Tory right—a device to satisfy its internal party politics and a Bill from which there is no going back. If Rwanda is found to be unsafe then this Bill will act as a block to putting matters right. This legislation was not in the Government’s manifesto; the Addison/Salisbury convention does not apply. I maintain that this is one of the rare occasions—which have been used by both Conservative and Labour parties in this House, and which was foreseen by a report of the Constitution Committee—when this House should vote against a Bill at Second Reading. It is within our powers as described in the Companion.

- **VERDICT — what position, if any, does this evidence establish?** _______

## M3 — Illegal migration and small boats

Debates matched on the title *"Illegal Migration"*.

### S3.11 — Suella Braverman (MNIS 4475), Conservative

- **Matter:** Illegal migration and small boats
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2023-03-07, House of Commons
- **Debate:** Illegal Migration Bill
- **Speech id:** `pwdata-debates:debates2023-03-07b:177`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2023-03-07b.151.1>
- **Selection rule:** their longest speech in a debate titled for this matter (1,192 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 46 votes recorded, NOT all the same way

**In their own words:**

> With permission, Mr Speaker, I would like to make a statement about the Government’s Illegal Migration Bill. Two months ago, the Prime Minister made a promise to the British people that anyone entering this country illegally will be detained and swiftly removed—no half measures. The Illegal Migration Bill will fulfil that promise. It will allow us to stop the boats that are bringing tens of thousands to our shores in flagrant breach of both our laws and the will of the British people. The United Kingdom must always support the world’s most vulnerable. Since 2015 we have given sanctuary to nearly half a million people, including 150,000 people from Hong Kong, 160,000 people from Ukraine and 25,000 Afghans fleeing the Taliban. Indeed, decades ago, my parents found security and opportunity in this country, for which my family are eternally grateful. Crucially, these decisions are supported by the British people precisely because they are decisions made by the British people and their elected representatives, not by the people smugglers and other criminals who break into Britain on a daily basis. For a Government not to respond to the waves of illegal migrants breaching our borders would be to betray the will of the people we were elected to serve. The small boats problem is part of a larger global migration crisis.
>
> [… 842 words omitted — the whole speech is one click away …]
>
> an annual cap, to be determined by Parliament, on the number of refugees the UK will resettle via safe and legal routes. This will ensure an orderly system, considering local authority capacity for housing, public services and support. The British people are famously a fair and patient people. But their sense of fair play has been tested beyond its limits as they have seen the country taken for a ride. Their patience has run out. The law-abiding patriotic majority have said, “Enough is enough.” This cannot and will not continue. Their Government—this Government—must act decisively, must act with determination, must act with compassion, and must act with proportion. Make no mistake: this Conservative Government—this Conservative Prime Minister—will act now to stop the boats. I commend the statement to the House.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S3.12 — Lord Murray of Blidworth (MNIS 4950), Conservative

- **Matter:** Illegal migration and small boats
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2023-05-10, House of Lords
- **Debate:** Illegal Migration Bill - Second Reading (Continued)
- **Speech id:** `pwdata-lords:daylord2023-05-10a:188`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2023-05-10a.1920.0>
- **Selection rule:** their longest speech in a debate titled for this matter (2,981 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 35 votes recorded, all the same way

**In their own words:**

> I am grateful to all noble Lords who have spoken. It is a measure of the importance of the issue before us that there have been some 80 speakers in this debate. As we have heard from noble Lords across the House, as well as from my right honourable friends the Prime Minister and the Home Secretary, it is clear that we must stop the boats. That much, at least, is common ground. Our approach is driven by a desire to do right by the people of this country and guided by that most British of principles—fairness. The present situation is anything but fair. The case for decisive action could not be clearer. I say again: ours is a generous and compassionate country. We will continue offering sanctuary and refuge to those fleeing persecution, conflict and tyranny, but we will not accept mass illegal migration to our shores. That is why we need this Bill: to stop the boats and address this challenge once and for all. I turn to the matters raised in the debate, including the points addressed in the amendment moved by the noble Lord, Lord Paddick. First, the most reverend Primate the Archbishop of Canterbury and other noble Lords were right to place the Bill in its moral context. Proceeding with this Bill is the moral
>
> [… 2,631 words omitted — the whole speech is one click away …]
>
> Lawlor put it well: this Bill is stringent but necessary and proportionate, but it is not the only step we are taking. It comes alongside our partnership with Rwanda, bolstered enforcement action to bear down on the criminal gangs and the co-operation with France, as my noble friend Lord Howard of Lympne rightly pointed out. This Government will always act in the interests of the law-abiding majority. That means securing our borders, delivering a fair and effective immigration and asylum system, and stopping the boats. Enough is enough. The British people want this problem dealt with. The Bill will enable us to do exactly that, and I commend it to the House and invite noble Lords to reject the amendment standing in the name of the noble Lord, Lord Paddick.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S3.13 — Apsana Begum (MNIS 4790), Labour

- **Matter:** Illegal migration and small boats
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2023-04-26, House of Commons
- **Debate:** Illegal Migration Bill — New Clause 17 - Serious Harm Suspensive Claims: Interpretation
- **Speech id:** `pwdata-debates:debates2023-04-26d:342`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2023-04-26d.818.3>
- **Selection rule:** their longest speech in a debate titled for this matter (801 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 45 votes recorded, NOT all the same way

**In their own words:**

> I rise to speak to a range of amendments and new clauses seeking to protect people from the attacks on basic human dignity that are before the House today. I am supporting new clauses in the name of my hon. Friend the Member for Streatham (Bell Ribeiro-Addy) about the ongoing human rights breaches that migrants endure, which have been happening for some time, but today I shall focus on how the legislation treats those who are pregnant, because not only will the Bill persecute and imprison people fleeing torture, war and oppression, but it will put the health of some of the most vulnerable of them—pregnant women—and the life of their unborn children at risk. That is why I have tabled new clause 2 seeking to exempt pregnant women and girls from provisions about removals. My new clause 3 seeks to require an independent review of the effect of the provision on pregnant migrants, and my new clause 7 is about a review of the effect of the measures on the health of migrants. I am also supporting related amendments to prevent an immigration officer’s and the Secretary of State’s detention powers from being used to detain unaccompanied children, families with dependent children, or pregnant women, as tabled by my right hon. Friend the Member for Kingston upon Hull North
>
> [… 451 words omitted — the whole speech is one click away …]
>
> refugees are to be placed in circumstances worse than the already inhumane situation of pregnant women in UK prisons such as Manston, where there are outbreaks of illness and disease, reports of assaults and drug use by guards, and which last year was estimated to be detaining thousands of people arriving in Britain via small boats, some for as long as 40 days or more. No one should be detained in such places, never mind those who are pregnant. The British Medical Association, the Royal College of Midwives, and Maternity Action have all raised that healthcare in immigration detention is often very poor. In 2014, some 99 women were locked up in Serco-run Yarl’s Wood detention centre while pregnant, and research by Medical Justice found they often missed antenatal appointments—

- **VERDICT — what position, if any, does this evidence establish?** _______

### S3.14 — The Lord Bishop of Durham (MNIS 4312), Bishops

- **Matter:** Illegal migration and small boats
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2023-06-14, House of Lords
- **Debate:** Illegal Migration Bill - Committee (5th Day) (Continued) — Amendment 139A
- **Speech id:** `pwdata-lords:daylord2023-06-14a:234`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2023-06-14a.2055.0>
- **Selection rule:** their longest speech in a debate titled for this matter (1,487 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** no votes recorded on this matter

**In their own words:**

> My Lords, I will speak first to Amendment 139A, to which my right reverend friend the Bishop of London has added her name, and then I will turn to Amendment 139B in my name. I remind the Committee of my interests as laid out regarding RAMP and Reset. As we have heard, Amendment 139A would prevent data about a victim of or a witness to a crime being automatically shared for the purpose of immigration enforcement. My right reverend friend the Bishop of London sponsored a similar amendment during the passage of the Domestic Abuse Act, and this issue remains hugely important. Imkaan reports that more than 90% of abused women with insecure immigration status had their abusers use the threat of their removal from the UK to dissuade them from reporting their abuse. It is deeply disturbing that any person would be deterred from reporting a crime that they have been subjected to or have witnessed because they believe that their data will be passed on to immigration officials for the purposes of immigration control. This is especially pertinent for a domestic abuse victim, a modern slavery victim, someone who has been trafficked or someone who has been subject to violence. In the context of this Bill, a lack of safe reporting pathways would be a major hindrance to
>
> [… 1,137 words omitted — the whole speech is one click away …]
>
> reintroduced after being discontinued by the Home Secretary in January? These inspections regularly found a gap between Home Office policy intentions and what happens on the ground. We simply cannot afford for this to be the case going forward as the consequences could be catastrophic, including—unjustifiably and regrettably—for children. I quite appreciate that the Minister may not be able to provide a full response to this proposal now but I ask that he kindly write to me in advance of Report if this amendment is believed to be unworkable. It is of the utmost importance that we understand the inspection framework for detention sites and its legal underpinning. The expansive duties and powers provided to the Home Office by the Bill demand they be matched by statutory and mandatory accountability.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S3.15 — Bell Ribeiro-Addy (MNIS 4764), Labour

- **Matter:** Illegal migration and small boats
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2023-03-13, House of Commons
- **Debate:** Illegal Migration Bill
- **Speech id:** `pwdata-debates:debates2023-03-13b:380`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2023-03-13b.622.1>
- **Selection rule:** their longest speech in a debate titled for this matter (527 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 45 votes recorded, NOT all the same way

**In their own words:**

> The Government and their immediate predecessor have not tried to formulate workable policy on this issue, which was evident from the Home Secretary’s bizarre and unconvincing opening speech. They are trying to keep the European Research Group and other agitators onside—grubby politicking by using the most vulnerable people, often fleeing the effects of our wars, or persecution or reprisals, as collateral damage. The reality is that most asylum applications are fully justified. In the end, after long and unnecessary delays, three quarters of applications are granted, yet these are the people the Government want to deny entry, not because of their circumstances but because of how they arrived. We now have the abject sight of Ministers putting out propaganda that boasts that anyone arriving by small boat will not be offered the protections of the Modern Slavery Act 2015. Ministers are actually saying that they will refuse protections to people being trafficked and used as modern slaves, making the policy a charter for people trafficking. They cannot say that they are combating people smuggling if all they are doing is putting policies in place that encourage it. One of the arguments that is often used, especially in relation to France, is that it is a safe space. I was in Calais earlier this year, and I can tell Members that
>
> [… 177 words omitted — the whole speech is one click away …]
>
> G4S and Clearsprings—the big winners in the immigration detention estate—would lose some money, and the tabloids would have to find someone else to attack. Government Ministers would have to find a new enemy to distract people from their spectacular economic failures. We would not be breaking international law, demonising vulnerable people or falling out again with our closest neighbours. This legislation should not have seen the light of day. There is nothing worth retaining, which is why I was pleased to table a cross-party amendment. I am pleased to support the reasoned amendment in the name of the Leader of the Opposition. If Government Members are as disturbed as they say they are, they should do the right thing, walk through the Lobby with us and vote against the Bill.

- **VERDICT — what position, if any, does this evidence establish?** _______

## M4 — Asylum and the Nationality and Borders Act

Debates matched on the title *"Nationality and Borders"*.

### S4.16 — Priti Patel (MNIS 4066), Conservative

- **Matter:** Asylum and the Nationality and Borders Act
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2021-07-19, House of Commons
- **Debate:** Nationality and Borders Bill — [1st Allocated Day]
- **Speech id:** `pwdata-debates:debates2021-07-19d:322`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2021-07-19d.712.0>
- **Selection rule:** their longest speech in a debate titled for this matter (2,336 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 40 votes recorded, NOT all the same way

**In their own words:**

> I will not; I have given way several times now. Our intention is to address the wider system to fix this problem so that we can help those who are in genuine need to resettle here. We are strengthening through the Bill the safe and legal ways in which people can enter the UK, adopting a fair and firm approach. From today, I will be granting indefinite leave to remain to refugees resettled under our world-leading resettlement schemes, giving them the vital freedom to succeed from the moment that they arrive in our country and, importantly, offering certainty and stability to help them rebuild their lives from day one.[Official Report, 22 July 2021, Vol. 699, c. 9MC.] That is absolutely the right thing to do. From that, we can also learn and build better schemes going forward. We also want to continue to strengthen our proud record to support those in need, such as, over the past few months, the brave Afghan nationals who have worked alongside our brave military and who are now benefiting from a bespoke resettlement scheme. That is in addition to the type of scheme we have set up for British nationals overseas from Hong Kong whose liberties were restricted and who are now able to live freely in the UK, with a full pathway to
>
> [… 1,986 words omitted — the whole speech is one click away …]
>
> continue, as we have done, to protect victims of modern slavery by creating a statutory grant of leave for confirmed victims. They of course need the time and the support to recover from their horrendous and appalling ordeals, and the authorities also need time to bring perpetrators to justice. I would also like to pay tribute to many colleagues in the House and to policing partners as well, who have worked diligently. My right hon. Friend the Member for Chingford and Woodford Green has already mentioned the Centre for Social Justice, but we have worked with policing partners as well to look at many of the cases around law enforcement and bringing perpetrators to justice—how difficult some of those cases are. But the law on modern slavery is being exploited.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S4.17 — Baroness Williams of Trafford (MNIS 4311), Conservative

- **Matter:** Asylum and the Nationality and Borders Act
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2022-04-04, House of Lords
- **Debate:** Nationality and Borders Bill - Commons Amendments — Motion C
- **Speech id:** `pwdata-lords:daylord2022-04-04d:146`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2022-04-04d.1875.2>
- **Selection rule:** their longest speech in a debate titled for this matter (3,021 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 42 votes recorded, all the same way

**In their own words:**

> My Lords, I bring noble Lords’ attention to Lords Amendment 5, on compliance of Part 2 of the Bill with the refugee convention. The other place disagrees with this amendment for its Reason 5A. The Government have made it explicitly clear that everything we do is compliant with our obligations under international law, including our obligations under the refugee convention. Consequently, we do not think it is necessary to set that out in the Bill. I therefore respectfully ask noble Lords not to insist on the amendment. The noble Baroness, Lady Chakrabarti, has proposed a new amendment which seeks to do much the same as the previous amendment: to clarify that the provisions in Part 2 are compliant with our obligations under the refugee convention and international law. For the reasons I have given, I invite the noble Baroness to withdraw her amendment. Amendment 6 would remove from the Bill the substantive clause relating to differentiation. The other place has disagreed with this for its Reason 6A. The differentiation of those classed as refugees is a fundamental part of the Bill, and as such the Government cannot accept the amendment agreed by your Lordships’ House. It is right that we take all steps to discourage people from risking their lives at sea, and this clause and the criteria it sets
>
> [… 2,671 words omitted — the whole speech is one click away …]
>
> need it. Protection is normally granted where a claimant has a well-founded fear of persecution under the refugee convention or where their circumstances engage our obligations under Article 3 of the ECHR. Although we do not specifically reference the genocide convention as part of our asylum consideration, if an individual were to be at risk as a result of genocide, they would likely qualify for protection as a result of either the refugee convention or the ECHR. Each claimant is an individual with unique circumstances, and this requires individual consideration. I do not think that it is necessary for the Government to publish reports to demonstrate our compliance with international obligations —we comply, and we will continue to comply. I therefore ask the noble Lord not to move his Motion.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S4.18 — Baroness Hamwee (MNIS 2652), Liberal Democrat

- **Matter:** Asylum and the Nationality and Borders Act
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2022-01-05, House of Lords
- **Debate:** Nationality and Borders Bill - Second Reading
- **Speech id:** `pwdata-lords:daylord2022-01-05c:164`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2022-01-05c.657.0>
- **Selection rule:** their longest speech in a debate titled for this matter (1,505 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 44 votes recorded, all the same way

**In their own words:**

> My Lords, the Board of Deputies of British Jews quoted from the Torah in its briefing. I am afraid it is not at the front of my mind, but it is the same thought. There have been so many powerful and informed speeches that I decided at about 5.30 pm that I must stop adding namechecks to my notes. I have often heard from the Dispatch Box the term “professional curiosity”—an encouragement to probe, analyse and avoid the unthoughtful and the knee-jerk. It seems to me that professional curiosity has been lacking both from the underlying policy and this Bill. The noble Lord, Lord Blunkett, mentioned virtue signalling. There certainly seems to have been no attempt to understand the push factors. I should apply that to myself. How is it that a Bill against which I would readily have voted today has any appeal? Is it that people have had bad encounters with refugees? I think that is unlikely. The reaction of most people who have talked to individuals is often admiring. Is it fear of the other? We are a mongrel nation, as noble Lords have said; I certainly am. Is it an underlying insecurity about housing, the health service, jobs, the cost of living and the economy? Likely, I suspect, and so we should address those. How is
>
> [… 1,155 words omitted — the whole speech is one click away …]
>
> What is being done to create safe and legal routes, and why is there no provision for humanitarian visas? Perhaps we can also hear why the Government, who have relied on the UNHCR to identify those whom they have resettled in the UK, refuse to take on board its analysis. The UNHCR’s critique of the Bill is devastating. I have had much more time than most speakers, but none of us has had anywhere near enough to make all the points that are to be made on this Bill, which clearly fills so many of us with gloom and anxiety, nor enough time to thank all those who have briefed us and who work on the front line—and, certainly, nowhere near enough to cover what will so affect people’s lives.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S4.19 — Lord Anderson of Ipswich (MNIS 4705), Crossbench

- **Matter:** Asylum and the Nationality and Borders Act
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2022-02-28, House of Lords
- **Debate:** Nationality and Borders Bill - Report (1st Day) — Amendment 14
- **Speech id:** `pwdata-lords:daylord2022-02-28c:176`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2022-02-28c.580.0>
- **Selection rule:** their longest speech in a debate titled for this matter (1,722 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 7 votes recorded, NOT all the same way

**In their own words:**

> My Lords, the circumstances in which British citizenship may be removed were keenly debated in Committee. This group concerns a narrower issue: whether it should be possible to remove someone’s citizenship without giving them notice of it at the time and, if so, in what circumstances. Clause 9 struck me as so problematic that, in Committee, I tabled a stand part notice; that is echoed today by Amendment 20 in the name of the noble Baroness, Lady D’Souza. In Committee, I asked the Minister to take Clause 9 away and challenged her, if she could make the case for such an extraordinary power, to come back with a version of it that is far more limited in scope and subject to proper safeguards and accountability. The Minister responded to that challenge as positively and wholeheartedly as I could have hoped. I pay tribute to her, to her fellow Minister, Tom Pursglove, to the Bill team and to those at the Home Office and in agencies with whom I have discussed these issues—and I pay no less tribute to the NGOs and individuals who have impressed on me the dangers of Clause 9. The result, after what I think I can fairly describe as very considerable movement on the part of the Government, is the first six amendments in this group,
>
> [… 1,372 words omitted — the whole speech is one click away …]
>
> out of time for appeal as a consequence of the interval between the decision to remove their citizenship and the giving of notice? If my amendments are accepted, and those assurances given, I believe that we will have played our part as a revising Chamber and achieved a broadly acceptable balance. Opinions on citizenship removal will, of course, continue to differ, but the aggravating factor of removal without notice will be strictly confined and properly safeguarded for the future, as it was not in the Immigration Rules as they stood prior to the D4 judgment of last year, and as it was not under Clause 9 as it was passed by the Commons. I beg to move my amendment and, if necessary, I will test the opinion of the House.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S4.20 — Baroness McIntosh of Pickering (MNIS 384), Conservative

- **Matter:** Asylum and the Nationality and Borders Act
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2022-01-27, House of Lords
- **Debate:** Nationality and Borders Bill - Committee (1st Day) (Continued) — Amendment 25
- **Speech id:** `pwdata-lords:daylord2022-01-27b:209`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2022-01-27b.506.2>
- **Selection rule:** their longest speech in a debate titled for this matter (1,171 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 9 votes recorded, NOT all the same way

**In their own words:**

> My Lords, I will speak also to Amendment 26 in this group and I look forward very much to hearing other noble Lords speak to their amendments in this group, which are very much on the same theme. My amendment is perhaps a little more radical than some in this group, so, for the purposes of clarity, I am seeking to delete from the amendment to Clause 9 that was carried in Committee in the other place the proposed subsection (5A), which states that the notice to be given to a person to be deprived of citizenship, thereby notifying that their citizenship is to be withdrawn, “does not apply if ... the Secretary of State does not have the information needed to be able to give notice under that subsection” or if it is not “in the interests of the relationship between the United Kingdom and another country”. I will set out my reasons for doing this. I will allude to my earlier remarks: I obviously have an interest to declare, in that my mother was a naturalised British citizen by marriage to my father in 1948. Obviously it is a source of some concern to me that, were my mother still alive, she could be deprived of her nationality. I have to say that I am envious of the
>
> [… 821 words omitted — the whole speech is one click away …]
>
> support from the European Network on Statelessness for the removal of Clause 9 from the Bill, which the noble Lord, Lord Anderson of Ipswich, will address in short order. I am minded to support him if my amendments do not carry favour. I understand and support many aspects of the Bill that have regard to the rule of law and where the rights of the citizen are to be respected. What I find unacceptable about those parts of Clause 9 that I am seeking to remove is that, through no fault of their own, a citizen could be deprived of their citizenship without having been given prior notice and without their right to consult a legal representative to act on their behalf. With those few remarks, I beg to move.

- **VERDICT — what position, if any, does this evidence establish?** _______

## M5 — Leaving the European Union

Debates matched on the title *"European Union (Withdrawal)"*.

### S5.21 — Mr David Davis (MNIS 373), Conservative

- **Matter:** Leaving the European Union
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2018-06-12, House of Commons
- **Debate:** EUROPEAN UNION (WITHDRAWAL) BILL — Repeal of the European Communities Act 1972
- **Speech id:** `pwdata-debates:debates2018-06-12b:209`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2018-06-12b.733.6>
- **Selection rule:** their longest speech in a debate titled for this matter (1,486 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 75 votes recorded, NOT all the same way

**In their own words:**

> Let me start with the obiter dictum that there is a difference between eating into time and exhausting patience. Over nine months, across both Houses, we have debated more than 1,000 non-Government amendments and hundreds of Government amendments to the Bill. Before us today are 196 Lords amendments—the outcome of hundreds of hours of debate in the other place. I beg your indulgence, Mr Speaker, in paying tribute to my ministerial team who have brought the Bill this far: my hon. Friends the Members for Wycombe (Mr Baker) and for Worcester (Mr Walker), my hon. and learned Friend the Member for South Swindon (Robert Buckland) , my hon. Friend the Member for Esher and Walton (Dominic Raab) and my right hon. Friend the Member for Aylesbury (Mr Lidington); and, in the other place, Baroness Evans, the Leader of the House of Lords, and her team—Lord Callanan, Lord Keen, Baroness Goldie, Lord Duncan and Lord Bourne. I extend the same thanks to Opposition Front Benchers. It is worth at this early point remembering that the Bill has a simple, clear purpose: to ensure that the whole United Kingdom has a functioning statute book on the day we leave the European Union. That involves the considerable task of converting 40 years of EU law into United Kingdom law. This is an unprecedented
>
> [… 1,136 words omitted — the whole speech is one click away …]
>
> and 45, which replace “appropriate” as a reason for using the powers to “necessary”. This House has accepted the premise of the Government’s approach to delivering a functioning statute book—specifically, that we will preserve and incorporate EU law, and then make the appropriate corrections via secondary legislation. Given the scale of the task and the speed necessary, that could never have been done through primary legislation, but at every turn we have sought to ensure proper parliamentary scrutiny. Given that that fundamental premise has been supported, there needs to be sufficient flexibility for Ministers to propose changes that might not be strictly considered necessary, but that everyone here would think appropriate. “Necessary” is not a synonym for sensible, logical or proper; it means something that it is essential to do.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S5.22 — Baroness Evans of Bowes Park (MNIS 4329), Conservative

- **Matter:** Leaving the European Union
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2018-05-08, House of Lords
- **Debate:** European Union (Withdrawal) Bill - Report (6th Day)
- **Speech id:** `pwdata-lords:daylord2018-05-08b:220`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2018-05-08b.97.0>
- **Selection rule:** their longest speech in a debate titled for this matter (2,234 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 18 votes recorded, all the same way

**In their own words:**

> My Lords, I thank all noble Lords for their contributions to this debate. The Government take parliamentary scrutiny of the powers afforded them very seriously, which is why, from the outset, I have made clear our view that both Houses should be treated equally when it comes to the sifting process proposed by the Commons Procedure Committee. The Government have already accepted amendments, although they only included a committee in the other place, and the government amendments that we have just discussed would extend that process to your Lordships’ House. We have listened carefully to the views of the House and numerous committees on ways in which to improve this Bill. Among other amendments, we have removed the Clause 8 power altogether and sunset the consequential power and the power to make new fees or charges. The correcting power has been prohibited from creating public authorities or amending the devolution statutes, and we have provided that regulations should be amendable only in the same way as primary legislation. Having heard the views of the House in Committee, I am pleased to confirm that the Government have tabled amendments that we will debate shortly to extend the sifting committee’s remit to instruments made under the power contained in Clause 17(1). I hope that noble Lords will see this as further evidence
>
> [… 1,884 words omitted — the whole speech is one click away …]
>
> have already published in draft to help demonstrate how we intend to use the powers in the Bill. I realise that this is not the total commitment that those who tabled the amendment were seeking, but I hope that it is sufficient that they will feel able not to press it. I hope that the Government’s clear commitment to replicating the sifting mechanism in your Lordships’ House by building on the important work of the SLSC and providing additional staff and members demonstrates that we continue to take the established and valuable scrutiny role of this House seriously and that we will continue to do so when the sifting process is under way. With that, I hope that the noble Lord, Lord Lisvane, will feel able to withdraw his amendment.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S5.23 — Lord Wigley (MNIS 547), Plaid Cymru

- **Matter:** Leaving the European Union
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2018-02-21, House of Lords
- **Debate:** European Union (Withdrawal) Bill - Committee (1st Day)
- **Speech id:** `pwdata-lords:daylord2018-02-21b:62`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2018-02-21b.129.0>
- **Selection rule:** their longest speech in a debate titled for this matter (2,332 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 20 votes recorded, NOT all the same way

**In their own words:**

> My Lords, as well as moving Amendment 1 standing in my name on the Order Paper, I shall refer to the other amendments that have been coupled with it for this debate. I declare some relevant interests, in that I own six acres of land that are rented out for agricultural purposes, and I receive a pension from two international manufacturing companies for which I worked, Mars and Hoover, both of which have major trading activities both in the UK and in continental Europe. I should also make it clear that, while at later stages I shall certainly address those issues of particular relevance to Wales and the devolved regimes, I shall for the most part address issues that are of common concern across the United Kingdom. That is where I am coming from on the amendments before us now. In tabling these amendments, it is categorically not my intention either to delay or to derail this Bill. I accept—yes reluctantly—that the UK will be leaving the European Union and that it would be totally inappropriate for this unelected House to overturn the decision taken by the referendum. Neither is it the role of this House to overrule decisions taken by elected MPs in the House of Commons. We have no mandate to do so. It is, however, both our
>
> [… 1,982 words omitted — the whole speech is one click away …]
>
> union. As a negotiating objective, it would require the UK Government to secure the same rights, freedoms and access available to the UK as exist through our membership of the EU. This is the position adopted by the Welsh Government’s White Paper. As always, these amendments tabled in Committee are probing amendments which seek to clarify the Government’s thinking on these key matters. In the event that the Government do not provide us with satisfactory answers, I shall certainly return to these matters on Report with amendments along these or similar lines which can be voted into the Bill to enable MPs to give further consideration to these vital issues—which are matters of life and death for so many companies, businesses and families in these islands. I beg to move.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S5.24 — Lord Adonis (MNIS 3743), Labour

- **Matter:** Leaving the European Union
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2018-02-21, House of Lords
- **Debate:** European Union (Withdrawal) Bill - Committee (1st Day)
- **Speech id:** `pwdata-lords:daylord2018-02-21b:149`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2018-02-21b.169.2>
- **Selection rule:** their longest speech in a debate titled for this matter (1,486 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 21 votes recorded, NOT all the same way

**In their own words:**

> My Lords, I could not agree more with my noble friend, nor with all those other noble Lords who have responsibility for Northern Ireland, or have held it in the past, including the noble Lord, Lord Patten, my noble friends Lord Hain and Lady Kennedy, and the noble Lord, Lord Carlile, not least in his role as reviewer of terrorism legislation. Everyone who has been engaged in this sees the continuing value of the Northern Ireland agreement. It is a solemn undertaking on the part of the United Kingdom. It is an international treaty. Playing fast and loose with peace in Northern Ireland in the cause of Brexit is utterly reprehensible. We are looking forward to the Minister’s reply. I know that he has a mountain of amendments to reply to, but I am afraid that is the fault of the people whose responsibility it is to group them, who seem to want to group almost everything in the Bill into one group. I hope that when he replies he will begin by saying from the Dispatch Box that the Government remain committed to the Good Friday agreement, that they wish to see the restoration of devolved government in Northern Ireland, and that the Government will use every endeavour to do that and to ensure, as the Prime Minister also
>
> [… 1,136 words omitted — the whole speech is one click away …]
>
> able to trade freely”. In my view it is impossible to see how we can have a Europe which maintains peace unless we start with peace within our own borders, which must mean peace guaranteed in Northern Ireland, hence the centrality of the Good Friday agreement to our consideration of the Bill. When it comes to, “less able to trade freely”, I take that to mean not entering into any trade arrangements which are less advantageous for this country and involve any more border controls than currently apply. I look forward to the Minister explaining to the Committee how leaving the customs union and the single market can make it easier for us to trade than the extremely advantageous arrangement we currently have as a member of the European Union.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S5.25 — Lord Callanan (MNIS 4336), Conservative

- **Matter:** Leaving the European Union
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2018-04-23, House of Lords
- **Debate:** European Union (Withdrawal) Bill - Report (2nd Day)
- **Speech id:** `pwdata-lords:daylord2018-04-23a:142`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2018-04-23a.1411.0>
- **Selection rule:** their longest speech in a debate titled for this matter (1,837 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 19 votes recorded, NOT all the same way

**In their own words:**

> My Lords, the way in which retained EU law will be treated in our domestic statute book—what has been termed the “status” of EU law—is undeniably an important issue. It has been one of the key themes of our debates on the Bill, and the Government’s attempts to deal with it are woven throughout the Bill. The Government have always recognised the importance of getting this right—above all, in the context of the question of amendability. These amendments, which deal with the amendability of retained EU law by secondary legislation, are to a large extent about ensuring its enhanced protection. As noble Lords will know, the House debated one way of giving enhanced protection to some parts of retained EU law last Wednesday, when it agreed to add a new clause to the Bill. Before setting out the government amendments, I will take a moment to explain to the House why the Government consider that the approach adopted last Wednesday is not the answer. Amendment 11 in the name of the noble Baroness, Lady Hayter, carried last Wednesday, prevents crucial corrections being made in time for exit day. By failing to define key terms, and by introducing into the Bill arguably undefinable concepts such as “technical changes”, it introduces a high level of risk to attempting to take forward even
>
> [… 1,487 words omitted — the whole speech is one click away …]
>
> give clarity to the status of retained EU law and are the right way to protect it as we transfer it on to our statute book. I recognise that the status this legislation should hold is a particularly complex issue, on which legal and academic minds have differed. I pay tribute to all noble Lords who have applied themselves to the task. We have listened and I appreciate all the contributions that have been made. Our amendments reflect a sensible approach, one that recognises and reflects the existing hierarchy within EU laws, balances the need for effective parliamentary scrutiny while giving Parliament the flexibility it needs to amend an extremely large body of legislation, and allows this place to truly take back control of our laws. I beg to move.

- **VERDICT — what position, if any, does this evidence establish?** _______

## M6 — The generational smoking ban

Debates matched on the title *"Tobacco and Vapes"*.

### S6.26 — Wes Streeting (MNIS 4504), Labour

- **Matter:** The generational smoking ban
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2024-04-16, House of Commons
- **Debate:** Tobacco and Vapes Bill
- **Speech id:** `pwdata-debates:debates2024-04-16e:263`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2024-04-16e.195.1>
- **Selection rule:** their longest speech in a debate titled for this matter (865 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 7 votes recorded, NOT all the same way

**In their own words:**

> Until the early 2000s, every pub you walked into was filled with smoke. One in every four people in this country was a smoker. The last Labour Government banned smoking in public places, which had an enormous impact on the health of our nation. The following year, there were 1,200 fewer hospital admissions for heart attacks, according to the British Medical Journal. Since 2007, the number of people who smoke has been cut by almost a third. Our understanding of second-hand smoke grew, and there was a cultural change around where it was acceptable to smoke. Even at home, people went outside to smoke, instead of smoking in front of their children. A study in Scotland found that whereas hospital admissions for children with asthma were increasing by 5% a year before the smoking ban, admissions were down by 18% in the three years following Labour’s legislation. In short, Labour helped to build a healthier society: smoking was down, the number of patients needing treatment was down, NHS beds were freed up and lives were saved. But there is more to do. During the 13 years when Labour was last in office, life expectancy was extended by three and a half years, but in the 14 years that the Conservatives have been in office, it has grown by just four
>
> [… 515 words omitted — the whole speech is one click away …]
>
> believe that the Health Secretary and the Prime Minister have surrendered to the lobbying of big health and those tyrants in Action on Smoking and Health, the British Heart Foundation, Cancer Research UK, Diabetes UK, Alzheimer’s Research UK, Mind, Asthma and Lung UK, the Royal College of Physicians, the Royal College of General Practitioners, the Royal College of Paediatrics and Child Health, the Royal College of Midwives and the British Medical Association. Well, we happily align ourselves with big health in defence of the nation and we are only too happy to defend the Health Secretary against the siren voices of big tobacco that we see gathered around our former Prime Minister, the right hon. Member for South West Norfolk (Elizabeth Truss) , in the corner of the Chamber today.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S6.27 — Baroness Merron (MNIS 347), Labour

- **Matter:** The generational smoking ban
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2025-04-23, House of Lords
- **Debate:** Tobacco and Vapes Bill - Second Reading
- **Speech id:** `pwdata-lords:daylord2025-04-23a:133`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2025-04-23a.739.0>
- **Selection rule:** their longest speech in a debate titled for this matter (2,558 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 1 vote recorded — a thin record

**In their own words:**

> My Lords, I am grateful to all Members of your Lordships’ House who have contributed to what has been a thoughtful and wide-ranging debate on a very important issue. Today’s debate has been very well supported. I hope that noble Lords will understand that I will not be able to cover in my summary every issue that has been raised, but I will endeavour to respond to as many of the themes and questions as possible. Of course, I will be happy to have further discussions with noble Lords, and we will have the opportunity for these ahead of and during future stages of the Bill. I too look forward to Committee. It seems many hours ago since my noble friend Lady Thornton spoke of the measures in this Bill being a further step along the way. I share that view, which has been expressed by a number of other noble Lords, particularly those in what I shall politely call the cohort of former Health Ministers. I do not know what the collective term is, but I am sure we will work on that. I am in that cohort, and I too worked towards the initial smoking ban in 2007. As a Public Health Minister, I introduced the display regulations we are now so used to. When we introduced the
>
> [… 2,208 words omitted — the whole speech is one click away …]
>
> 2040. On the points about the Windsor Framework, I have heard the concerns about the application of smoke-free generation policy in Northern Ireland from the noble Lords, Lord Dodds and Lord Weir, the noble Baroness, Lady Hoey, and my noble friend Lady Ritchie. I have met the Northern Ireland Health Minister, and we continue to work well with his office. I assure noble Lords that we are content that the measures intended to apply to Northern Ireland are consistent with the obligations in the Windsor Framework. In closing, I am most grateful to all noble Lords who have contributed to this debate. This is a landmark Bill, and it will be the most significant public health intervention in a generation, so I beg to move. Bill read a second time.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S6.28 — Dr Caroline Johnson (MNIS 4592), Conservative

- **Matter:** The generational smoking ban
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2024-04-16, House of Commons
- **Debate:** Tobacco and Vapes Bill
- **Speech id:** `pwdata-debates:debates2024-04-16e:344`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2024-04-16e.240.2>
- **Selection rule:** their longest speech in a debate titled for this matter (1,033 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 6 votes recorded, all the same way

**In their own words:**

> I rise in support of the Government’s Bill. One of the first speakers this afternoon was my hon. Friend the Member for Bosworth (Dr Evans) , who talked about his first job in respiratory medicine. My first job as a doctor was in adult respiratory medicine, too, and I spent a lot of time looking after patients with chronic obstructive pulmonary disease, intermittent claudication and lung cancer, and that taught me that smoking causes not just premature death, but substantial, debilitating, miserable disability that can go on for many years. I therefore support the Government in doing all they can to reduce the number of smokers. Some people have talked today about the freedom for an adult to choose to do what they want, but we already make changes to what adults can do. We already restrict their freedoms. For example, we tell adults that they must put a seatbelt on when they get in the car. They must wear a helmet when they ride a motorcycle. They cannot drink alcohol before they get in a car, and they cannot drive down the motorway at 150 mph. So we already make restrictions for people’s safety on that basis. I do think that gradually increasing the age is inelegant, as my hon. Friend the Member for Winchester (Steve Brine) , the
>
> [… 683 words omitted — the whole speech is one click away …]
>
> flavours called “Ice Cool”, Bergamot Wildberry”, “Mocha” and “Elderflower”. Does the House see a pattern here? That will be the next thing, and that is why I welcome the clause, which will allow the Government to reflect, if they want, on new forms of nicotine use. I have some questions for the Minister. The Health Act 2006 prevents smoking in enclosed public spaces, on public transport and in certain other areas. Why has that not been extended to vaping? Also, as I was walking through Westminster the other day, I saw a big red Transport for London bus advertising vaping—something I have written to Sadiq Khan about. I wonder whether the Government plan to extend vaping regulations not just to what the package looks like but to the advertising itself.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S6.29 — Jim Dickson (MNIS 5223), Labour

- **Matter:** The generational smoking ban
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2024-11-26, House of Commons
- **Debate:** Tobacco and Vapes Bill
- **Speech id:** `pwdata-debates:debates2024-11-26d:427`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2024-11-26d.725.4>
- **Selection rule:** their longest speech in a debate titled for this matter (856 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 6 votes recorded, NOT all the same way

**In their own words:**

> It is a privilege to speak in this debate on a Bill that delivers on our manifesto commitment to finish the job started by the right hon. Member for Richmond and Northallerton (Rishi Sunak) at the back end of the last Parliament. We should be proud that, once the Bill receives Royal Assent, it will be the most advanced legislation of its kind in the world. I should declare at the outset that I was a smoker, and that experience gives me particular clarity on the need for change. I am also honoured to be vice-chair of the all-party parliamentary group on smoking and health. I will use my six minutes to say a little about why this Bill is so necessary and—I hope the Minister does not mind —to gently set out where I think it could go further. We often hear that smoking is about choice. The only choices I made were to have my first cigarette at the age of 15 and then, almost 15 years and thousands of cigarettes later, the much more difficult choice to finally give up. According to the wonderful Action on Smoking and Health, which has been quoted widely in this debate, the majority of smokers wish they had never started, and it takes, on average, 30 attempts to quit. This legislation
>
> [… 506 words omitted — the whole speech is one click away …]
>
> health of their communities. Councils across the country have used the pavement licensing system to create smokefree outdoor spaces. That has proved popular with businesses and customers, particularly families with children. I gently urge the Minister to consider whether the Bill might be amended to allow local authorities to decide which additional spaces, beyond those regulated nationally, they might like to make smokefree in the best interests of communities. My final point, which reflects those made by other hon. Members, is about the “polluter pays” principle. We all know that public finances are under significant strain. If the funding we desperately need to create a smokefree country cannot be found in our existing budgets, I would urge Ministers to consider the imposition of a “polluter pays” levy on tobacco manufacturers.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S6.30 — Mary Glindon (MNIS 4126), Labour

- **Matter:** The generational smoking ban
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2025-03-26, House of Commons
- **Debate:** Tobacco and Vapes Bill — New Clause 11 - Age verification in relation to tobacco and vaping products etc
- **Speech id:** `pwdata-debates:debates2025-03-26b:308`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2025-03-26b.1022.2>
- **Selection rule:** their longest speech in a debate titled for this matter (1,017 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 6 votes recorded, NOT all the same way

**In their own words:**

> As chair of the all-party parliamentary group for responsible vaping, I have followed the progress of the Bill closely. I will speak to new clauses 4, 6, 7 and 15, as well to amendments 36, 37 and 88, all of which stand in my name. I congratulate the Minister on her appointment and on stepping up so wonderfully to help move the Bill forward today. Youth vaping is an enormous public health challenge that forms one of the Government’s central messages in the Bill. All of us in this place will have heard concerns from teachers and parents about the prevalence of youth vaping, and the challenges that schools face in tackling it. The Bill sets out to reduce the appeal of vaping to children, but a delicate and calculated approach must be taken when addressing youth vaping. In addressing one problem, it is incumbent on us all as legislators to not give rise to another—in this case, deterring tobacco smokers from making the switch. We still have more than 6 million smokers to reach, and vaping is 95% safer than smoking, according to King’s College hospital and the former body Public Health England, and it is the most successful tool to help smokers to quit. According to data from Action on Smoking and Health, 3 million adult vapers are
>
> [… 667 words omitted — the whole speech is one click away …]
>
> Secretary of State to consult “any persons or bodies as appear to him or her representative of the interests concerned”, instead of what is stipulated in the more limited current wording. The Bill provides Ministers with broad powers to make further regulations. It is vital that these powers are exercised in consultation with all relevant stakeholders, including public health experts, enforcement bodies, cessation specialists, retailers and industry. As chair of the APPG for responsible vaping, I hope that Ministers will be willing to engage in the coming months as regulations are brought forward. People who do not smoke should not vape. But for those who do use tobacco, I believe that we have a duty to ensure that legislation effectively harnesses the power of vapes as a smoking cessation tool.

- **VERDICT — what position, if any, does this evidence establish?** _______

## M7 — Protest and public order

Debates matched on the title *"Public Order Bill"*.

### S7.31 — Priti Patel (MNIS 4066), Conservative

- **Matter:** Protest and public order
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2022-05-23, House of Commons
- **Debate:** Public Order Bill
- **Speech id:** `pwdata-debates:debates2022-05-23b:251`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2022-05-23b.48.5>
- **Selection rule:** their longest speech in a debate titled for this matter (345 words, quoted in full). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 2 votes recorded — a thin record

**In their own words:**

> I think I will make some progress, if that is okay. This Conservative Government understand that if we are to cut crime, level up the country and make sure that people feel safe in their homes, on public transport and on the street, we need to back our police officers by giving them the powers and the tools they need to fight crime and protect the public. That was one of the main purposes of the Police, Crime, Sentencing and Courts Act 2022, which Opposition Members voted against. It also requires proper investment, which is why we are funding the police to the tune of almost £17 billion this year. We are helping the police to tackle violence against women and girls through major investment in safer streets measures—closed circuit television and more street lighting—and initiatives across the country. Earlier this month, I announced that I am strengthening stop-and-search powers, because stop and search is vital to get knives and weapons off our streets and save lives. Each weapon removed from our streets is a potential life saved. More than 50,000 weapons have been seized since 2019 already. I have also authorised special constables to carry and use Tasers. The police service is not just an institution, but a collection of professional and dedicated people. They are extremely brave, as are their families. The introduction of the police covenant ensures that we will do right by officers and their loved ones, who do so much to support them. Recently, we have seen a rise in criminal, disruptive and self-defeating tactics from a supremely selfish minority. Their actions divert police resources away from the communities where they are needed most to prevent serious violence and neighbourhood crime. We are seeing parts of the country grind to a halt. Transport networks have been stopped, printing presses blocked and fuel supplies disrupted. People have been unable to get to work and go about their lives free from harassment. Shamefully, they have even been prevented from getting to hospital. This is reprehensible behaviour and I will not tolerate it.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S7.32 — Dr Rupa Huq (MNIS 4511), Labour

- **Matter:** Protest and public order
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2022-05-23, House of Commons
- **Debate:** Public Order Bill
- **Speech id:** `pwdata-debates:debates2022-05-23b:412`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2022-05-23b.108.2>
- **Selection rule:** their longest speech in a debate titled for this matter (1,130 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 13 votes recorded, NOT all the same way

**In their own words:**

> Here we go again: illiberal legislation on public order and regulating protest boomeranging back in here after the other place flung it out last time. I do not deny that there can be value in appropriate sentences and tighter enforcement in the face of serious disorder—for example, pitch invasions are increasingly common and unwelcome nowadays—but we have to be proportionate about these things. In 2019, it did seem a bit bizarre when we saw Extinction Rebellion on top of tube trains, when that is one of the most green forms of transport. It probably did not make any new fans there, and ditto when the A40 in Acton was blocked. We all prize living in a liberal democracy, but if curbs are disproportionate and the exercise is about curtailing everyday freedoms primarily to win favour with the red tops and to play to their party base and the gallery, then we do have a problem. These things are always a balance, but we have to tread carefully when it comes to limiting protest. Not that long ago, the Government were going softly, softly on stop and search. We even saw the police dancing with protesters, but the Bill goes for the eye-catching and draconian, such as creating the offence of locking on, where someone is potentially subject to 51 weeks
>
> [… 780 words omitted — the whole speech is one click away …]
>
> the same time, the Bill criminalises a huge range of peaceful non-disruptive behaviour and goes far and beyond what most people would ever deem necessary by supplementing powers that are already there. I give the Minister advance warning that I will be seeking to amend the Bill to protect women from this most distressing and unpleasant form of protest. Canada, Australia and several states of the US already have such legislation; it is not a crazy idea. We need a national approach. People will still be able to protest if they do not like abortion laws in this country, but the appropriate place to do that would be here, rather than around defenceless women in their hour of need. Every woman should have the same protection as people in Ealing.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S7.33 — Anne McLaughlin (MNIS 4437), Scottish National Party

- **Matter:** Protest and public order
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2022-10-18, House of Commons
- **Debate:** Public Order Bill — New Clause 7 - Power of Secretary of State to bring proceedings
- **Speech id:** `pwdata-debates:debates2022-10-18c:289`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2022-10-18c.598.0>
- **Selection rule:** their longest speech in a debate titled for this matter (1,953 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 8 votes recorded, NOT all the same way

**In their own words:**

> I am so disappointed that we are debating a piece of legislation that should have been resigned to the scrap heap, along with the previous Cabinet’s regressive legislative programme. We are firefighting an economic crisis on an unprecedented scale and valuable Government time in this place is being wasted on draconian legislation that nobody, with the exception of selected Government Members, actually wants. I include in that the people who will be sent out on the streets to try to enforce this nonsense. Representatives from police forces have said time and again, throughout the consultation and Committee stages of the Bill, that this is not required. The powers already exist to police protests in an effective and proportionate manner, and that is what I will focus on—proportionality. After all, this is a balancing act between the fundamental rights that allow us to protest, for whatever cause and whatever reason, and the rights of those who might be inconvenienced or affected by a protest. At what stage does the scale tip? Government Members will undoubtedly cite cases where protestors glued themselves to the M25 or threw tomato soup at a priceless artwork, albeit one that was behind protective glass, but at what point does their right to stand up and say, “Wake up! The world is on fire,” become less important
>
> [… 1,603 words omitted — the whole speech is one click away …]
>
> doing on it for some time. In closing, we do not need this Bill—nobody needs this Bill. Our right to protest is fundamental. It is the only tool available to many people—most people—to effect real change. The Bill comes on the back of photographic voter ID, restrictions on judicial review, and the Police, Crime, Sentencing and Courts Act 2022 that we are yet to feel the full force of. When will the Government stop? When will they put their hands up and say, “We’ve got this wrong”? They need to realise that, instead of slamming their hand down on people who are protesting because they are desperately worried, they should extend a hand of solidarity to them and fix the problems that people are protesting about in the first place.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S7.34 — Wendy Chamberlain (MNIS 4765), Liberal Democrat

- **Matter:** Protest and public order
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2023-03-07, House of Commons
- **Debate:** Public Order Bill — Clause 9 - Offence of interference with access to or provision of abortion services
- **Speech id:** `pwdata-debates:debates2023-03-07b:502`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2023-03-07b.227.3>
- **Selection rule:** their longest speech in a debate titled for this matter (999 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 13 votes recorded, NOT all the same way

**In their own words:**

> Policing by consent is central to how our criminal justice system works in the UK and the authority by which officers wield the power given to them. That is why this issue is challenging and why we are having this debate. It is seen as being about balancing the rights of protest in this situation with other rights to go about everyday legitimate business. It is important to take a balanced and sensitive approach. Several legal minds here are much greater than mine. I am not a qualified lawyer, but I am standing here as the only former police officer participating in this debate. I know who the other two former police officers are and they are not here. I have approached this debate, these clauses and the Lords amendments by thinking about what would happen if I, as a police officer, went to attend a “spontaneous protest”, meaning that as a constable, the first person there, it would be on me to make the decisions about what was legitimate or not and about how I carried out my duties. I also thought about what would happen if I was part of a team of police officers policing a bigger protest, and about the instructions that I would be given by the silver and bronze commanders in relation to that
>
> [… 649 words omitted — the whole speech is one click away …]
>
> you are white where the police require reasonable suspicion, and 14 times more likely where the police do not require reasonable suspicion, presents a prima facie case that the police are misusing these powers.”—[Official Report, House of Lords, 7 February 2023; Vol. 827, c. 1098.] I understand that the House will not divide on Lords amendment 17, but it follows the arrest of journalists in Hertfordshire at a Just Stop Oil protest. If there is no need for the amendment, I would like to hear the Government outline what they will do to prevent the arrest of legitimate journalists and observers at protests in future. If we all care about democracy and freedom to protest and ensuring that those rights are applied, we need to have journalists and observers involved.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S7.35 — Lord Sharpe of Epsom (MNIS 4888), Conservative

- **Matter:** Protest and public order
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2022-11-01, House of Lords
- **Debate:** Public Order Bill - Second Reading
- **Speech id:** `pwdata-lords:daylord2022-11-01a:168`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2022-11-01a.201.0>
- **Selection rule:** their longest speech in a debate titled for this matter (1,550 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 11 votes recorded, NOT all the same way

**In their own words:**

> My Lords, I thank all noble Lords for their contributions throughout this debate. I will endeavour to respond to the points that have been made. For the record, I refute the assertion that this is some sort of battle in the culture war, not least because I am fond of tofu. The noble Lord, Lord Ponsonby, has just asked for a list of the various Bills. I commit to write on that, and will obviously study Hansard carefully. If I miss the specific questions of any other noble Lord, I will also write on those, but I will endeavour to get to all of them. A number of noble Lords, including the noble Lords, Lord Coaker, Lord Paddick and Lord Beith, and the noble Baronesses, Lady Chakrabarti, Lady Jones and Lady Blower, have argued that the Bill will have a chilling effect and cause peaceful protesters and bystanders at protests to be criminalised. I respectfully disagree and say that that is not the case. The right to protest peacefully, as my noble friend Lord Sandhurst just noted, is a fundamental part of democracy and that will never change. Protesters can continue to have their voices heard but, as my noble friend Lord Hailsham noted, they will not be allowed to wreak havoc on the lives of others while doing so.
>
> [… 1,200 words omitted — the whole speech is one click away …]
>
> Clause 9 in its current form. However, I am happy to say yes on all three of the specific concerns of the noble Baroness, Lady Sugg, about this. I invite interested noble Lords to engage and work with us on this to deliver a workable solution. As I expected, this has been a lively and thought-provoking debate. This is clearly an issue of significant interest and importance. But the fact is that we have a responsibility to act and update our laws to reflect changing tactics. The Government will not stand by while decent hard-working people have their lives and livelihoods disrupted; we will put the law-abiding majority first. I commend the Bill to the House. Bill read a second time and committed to a Committee of the Whole House.

- **VERDICT — what position, if any, does this evidence establish?** _______

## M8 — Employment rights and industrial action

Debates matched on the title *"Minimum Service Levels"*.

### S8.36 — Grant Shapps (MNIS 1582), Conservative

- **Matter:** Employment rights and industrial action
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2023-01-30, House of Commons
- **Debate:** Strikes (Minimum Service Levels) Bill — Schedule - Minimum Service Levels for Certain Strikes
- **Speech id:** `pwdata-debates:debates2023-01-30c:483`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2023-01-30c.165.0>
- **Selection rule:** their longest speech in a debate titled for this matter (409 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 12 votes recorded, NOT all the same way

**In their own words:**

> I beg to move, That the Bill be now read the Third time. While I am sure that the House would like me to enter back into some of the key arguments at this hour, I think I will for the purposes of brevity stick to the main principle at stake here, which is quite simply this: in many democratic countries throughout the world, and particularly among our European neighbours, we find that strikes are often banned entirely in what we would refer to as the blue light services. Yet in this country, the only blue light service to have strikes banned was the police in 1919 by a Liberal Prime Minister. I know of not a single member of the police who has ever lost their job as a result of that sensible restricted right to strike. We are not proposing a Bill that would prevent people from being able to strike in other blue light services or in other areas. We are not doing what we have done with the police or with the Army in this country. We are not doing what they have done in other European nations or in countries across the world, including Canada, Australia and large parts of America. We are not doing any of those things because we respect the right to
>
> [… 59 words omitted — the whole speech is one click away …]
>
> the right to an ambulance if they have a heart attack, a stroke or a serious illness? Why should that be left to a matter of chance, depending on their postcode as to whether those vital services turn up? Furthermore, after years of disruption through covid, why should our children have to miss school? Why should it be that people who work for themselves and rely on their own ingenuity to get their jobs and to take home money be denied over months and months the opportunity to get to work? We move this Third Reading this evening because we care about people in our workforce and their livelihoods and about our constituents and their ability to access vital services. That is why I commend this Bill to the House.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S8.37 — Lord Callanan (MNIS 4336), Conservative

- **Matter:** Employment rights and industrial action
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2023-02-21, House of Lords
- **Debate:** Strikes (Minimum Service Levels) Bill - Second Reading (Continued)
- **Speech id:** `pwdata-lords:daylord2023-02-21a:200`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2023-02-21a.1639.0>
- **Selection rule:** their longest speech in a debate titled for this matter (3,396 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 11 votes recorded, all the same way

**In their own words:**

> My Lords, I thank all noble Lords for their contributions on what is, in the Government’s view, a very important Bill. There is clearly a wealth of expertise on this topic across the House, not least among the large number of ex-trade union general secretaries we seem to have on the Opposition Benches, who have all contributed well. Of course, I sense the strong feeling on this issue. As is usual in this House, we have had a thorough and engaging debate; most of the speeches have been thoughtful and I certainly listened with interest to what Members had to say. I start, as many others did, by congratulating my noble friend Lady O’Neill on her excellent maiden speech. Unlike some others, she kept it relatively uncontroversial. It is a pleasure to see her in place today, and I am glad she has chosen this debate to make the first of what I am sure will be many well-informed contributions. I first met my noble friend during a visit to Cory’s Riverside Heat Network a few years ago and I am delighted, as an energy Minister, that we are welcoming someone with such a passion for energy. She has done some tremendous work as Bexley Council leader; she pioneered its decarbonisation vision and made Bexley a flagship Conservative borough. My
>
> [… 3,046 words omitted — the whole speech is one click away …]
>
> Lord Patten was right when he said that striking the balance between the ability to strike and the right of the public to be safe and protected is difficult, but we believe that our approach is a proportionate way to provide this important balance. I am happy to confirm to him that the Government have no intention of banning the ability to strike. As my noble friend Lord Dobbs so eloquently put it, the Bill is intended to keep the country working. To encourage further engagement with the Bill, links to the consultations will be circulated to participating Peers after this debate. In the meantime, I of course look forward to discussing the Bill further with Members in Committee. With that, I beg to move. Bill read a second time.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S8.38 — Lord Collins of Highbury (MNIS 4222), Labour

- **Matter:** Employment rights and industrial action
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2023-02-21, House of Lords
- **Debate:** Strikes (Minimum Service Levels) Bill - Second Reading (Continued)
- **Speech id:** `pwdata-lords:daylord2023-02-21a:199`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2023-02-21a.1635.0>
- **Selection rule:** their longest speech in a debate titled for this matter (2,027 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 12 votes recorded, all the same way

**In their own words:**

> My Lords, I start by thanking the noble Baroness, Lady O’Neill of Bexley, for her excellent maiden speech. I truly welcome her commitment to public service and her aspiration to make a difference; she will make a strong difference in this House. I also agree with her wholeheartedly that we need more women in Parliament and certainly more women in power. That would also make a difference. I wish to mention the fact that the news tonight is that, at long last, the Government have agreed to sit down with the RCN and negotiate a settlement that will truly reflect the value this country places on nurses. The pity, of course, is that it has taken so long to reach this point. Some 140,000 appointments need not have been cancelled had the Government talked to the RCN, rather than ignoring its position. That is an important thing which we should have in the backs of our minds when we talk about the Bill. A major focus of today’s debate, and a point which the noble and learned Lord, Lord Judge, made clear in his contribution, is whether it is right that we make laws this way through skeleton Bills. Whatever your Lordships’ views about the state of industrial relations in this country, we should all agree—across this House— that a
>
> [… 1,677 words omitted — the whole speech is one click away …]
>
> different; the organisation is totally different. It is not a fair comparison. As the ILO has stated, we now have much greater restrictions on the power of trade unions to organise. I know that I have gone on for quite a long time, but I conclude with this point. [Interruption.] Well, it needed to be said, and I am sorry if people are bored with the repetition, but as we move to Committee, let me assure noble Lords that we will probe this Government to produce the evidence for why they have introduced this Bill. As my noble friend Lady O’Grady said in her opening speech, this Bill is unfair, undemocratic and unworkable, which is why we are committed to repealing it in its entirety at the soonest possible date.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S8.39 — Lord Patel (MNIS 2443), Crossbench

- **Matter:** Employment rights and industrial action
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2023-03-09, House of Lords
- **Debate:** Strikes (Minimum Service Levels) Bill - Committee (1st Day) (Continued) — Amendment 13
- **Speech id:** `pwdata-lords:daylord2023-03-09b:267`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2023-03-09b.984.0>
- **Selection rule:** their longest speech in a debate titled for this matter (858 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** no votes recorded on this matter

**In their own words:**

> My Lords, I will speak to my Amendment 18. Much of what I have to say will resonate with what the right reverend Prelate the Bishop of London and the noble Baroness, Lady O’Grady of Upper Holloway, had to say. I am also grateful to my noble friend Lord Kakkar for adding his name to it. My amendment seeks to explore the logic of defining minimum staff service levels in healthcare, without first having a benchmark of what is an appropriate level of staffing that fulfils the needs of patient care and patient safety. While this Bill is not about rights and wrongs of strike action, I will express my personal view that, as a doctor, I would never have withheld my service, no matter the circumstances. This Bill grants the Secretary of State powers to make minimum service regulations during a strike across several sectors, including health services. I will speak only regarding health services, as “health services” are not defined in the Bill, which makes the legislation very broad in scope. “Minimum service levels” are also not defined in the Bill but will be defined by the Business Secretary after consultation. The focus of my amendment is patient safety. Legislation that imposes minimum service levels inevitably means a reduced number of staff expected to provide the same level
>
> [… 508 words omitted — the whole speech is one click away …]
>
> what assessment the Government have made of possible legal consequences if services are staffed below the minimum prescribed level. I fear that, in a rush to get the legislation through, there has been no thought given to how minimum service levels can be defined in clinical risk areas in the absence of first legislating on what is an appropriate staffing level and the risks to patient safety. As I mentioned, the Minister on the previous group, the noble Lord, Lord Callanan, already referred to the minimum service levels as “life and limb”. I hope the Government give further thought to appropriate safe staffing levels on non-strike days before bringing in any minimum service levels in clinical areas. I look forward to the Minister’s comments on the issues I have raised.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S8.40 — Lord Balfe (MNIS 4302), Conservative

- **Matter:** Employment rights and industrial action
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2023-03-09, House of Lords
- **Debate:** Strikes (Minimum Service Levels) Bill - Committee (1st Day) — Amendment 1
- **Speech id:** `pwdata-lords:daylord2023-03-09b:98`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2023-03-09b.903.0>
- **Selection rule:** their longest speech in a debate titled for this matter (1,062 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 7 votes recorded, NOT all the same way

**In their own words:**

> My Lords, the noble Baroness, Lady Fox, hit the nail on the head: this is a completely unnecessary Bill. It tells us nothing and no one is demanding it, apart from the Government, who seem somehow a bit obsessed with problems which I am not sure exist. I begin by declaring my entries in the register. I can actually top the noble Lord, Lord Cashman, as I have been a trade union member for 63 years consistently, and I still am today—and very proud of it. I am not also completely dominated by our need to respect international law. Having been in Brussels and Strasbourg, I have seen how sclerotic it often is. On the migrants Bill, for instance, there may well be a need to stand up to some of the international law provisions. But that is not the case here—there is no demand for this Bill at all. I am not, as the noble Lord, Lord Fox, implied, trying to be Mr Micawber. The Bill is so defective that the Government will need a couple of years to sort out what it means. All the different industries and professions mentioned in the Bill have a quite different profile. Nuclear decommissioning, driving an ambulance and flying a plane are somewhat different occupations; they have different standards and necessities. What
>
> [… 712 words omitted — the whole speech is one click away …]
>
> will say to the general secretary, “Are you sure we have got all the bases covered?” The general secretary will say, “I am pretty sure, but I will go back to our KC and absolutely finally check before we take this action.” I therefore do not really think that this is necessary. It will not add to relations; in fact, it will sour them because it is an unnecessary piece of legislation. It will not be respected. Most employers do not want it. I have not got any letter from an employer saying, “Dear Lord Balfe, you are a Conservative, please go in and support this legislation”—not one letter. The Minister should think about pressing the pause button on this, because the Government have far more important things to do.

- **VERDICT — what position, if any, does this evidence establish?** _______

## M9 — Sewage, water quality and the Environment Act

Debates matched on the title *"Environment Bill"*.

### S9.41 — George Eustice (MNIS 3934), Conservative

- **Matter:** Sewage, water quality and the Environment Act
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2021-05-26, House of Commons
- **Debate:** Environment Bill — New Clause 24 - Prohibition on burning of peat in upland areas
- **Speech id:** `pwdata-debates:debates2021-05-26b:254`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2021-05-26b.473.0>
- **Selection rule:** their longest speech in a debate titled for this matter (961 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 19 votes recorded, NOT all the same way

**In their own words:**

> I beg to move, That the Bill be now read the Third time. Of course, for this Bill, it is the third time in more ways than one. Hon. Members will recall that a similar Bill was introduced in the last Parliament, and this Bill itself started in the last Session. I thank right hon. and hon. Members across the House, particularly the members of the Public Bill Committee for their scrutiny and all those involved in the previous iteration of the Bill during the last Parliament. I pay special tribute to the Under-Secretary of State for Environment, Food and Rural Affairs, my hon. Friend the Member for Taunton Deane (Rebecca Pow) , for her tireless work on the Bill, and to all the DEFRA officials for all the work they put in to get such a significant piece of legislation to this point. It is a large and complex piece of legislation, and a huge amount of work has gone into getting its provisions right. Members in all parts of the House agree that the decline of our natural environment has persisted for too long. As we emerge from the covid-19 pandemic, we must turn our attention to recovery. We must build back greener. The pandemic has reminded us all of the difference that nature makes to our lives.
>
> [… 611 words omitted — the whole speech is one click away …]
>
> course, will be underpinned by our new system of environmental governance. The Bill creates the new, independent Office for Environmental Protection to hold all public authorities to account on reaching these important goals. Work to establish the OEP is already well under way under the chairmanship of Dame Glenys Stacey and I commend the work that she has done to date. In conclusion, I am pleased to see this Bill reach its Third Reading after a couple of attempts in previous Sessions and during the last Parliament. I am grateful for the many contributions from Members of all parties today. I believe that these provisions will ensure that this generation leaves our environment in a better state than we found it, and I therefore commend the Bill to the House.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S9.42 — Lord Goldsmith of Richmond Park (MNIS 4062), Conservative

- **Matter:** Sewage, water quality and the Environment Act
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2021-06-07, House of Lords
- **Debate:** Environment Bill - Second Reading
- **Speech id:** `pwdata-lords:daylord2021-06-07a:195`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2021-06-07a.1301.0>
- **Selection rule:** their longest speech in a debate titled for this matter (3,422 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 19 votes recorded, all the same way

**In their own words:**

> I thank noble Lords for their contributions to this wide-ranging debate. I pay tribute to the right reverend Prelate the Bishop of Salisbury for his wise words, for his service, and for having engaged with me as a Minister in the run-up to this debate. Like my noble friend Lord Taylor of Holbeach, I am sure that we will continue to have lively, robust and insightful conversations as we take this Bill through its remaining stages. I will take this opportunity to address the points raised so far. I will try to get through as many as possible, but I am afraid that time will not allow me to answer them all, so I will write on any specific points that I am not able to address today. The noble Lords, Lord Oates, Lord Teverson and Lord Bilimoria, all mentioned the seminal Dasgupta review. It is a powerful piece of work—a call to arms that makes plain our total dependence on the natural world and the massive damage that we are doing to it. It makes it equally clear that the fundamental challenge we face is finding ways to reconcile our economy and lifestyles with the natural world. He makes the point that the market is one of the most powerful forces for change of all, other than, perhaps, nature
>
> [… 3,072 words omitted — the whole speech is one click away …]
>
> I am happy to have that conversation, but I would take some persuading, because I think we are probably in the right place on this. I am sorry for not having addressed all the issues raised. There have been some fantastic contributions, and I thank everyone who has spoken today. I hope that people feel that I have covered at least the bulk of the points raised. I have met a large number of Members and I am keen to meet more; I shall continue to engage. I also thank the various NGOs, landowning groups and businesses that have helped to develop the Bill. I commend the Bill to the House. Bill read a second time and committed to a Committee of the Whole House. House adjourned at 9.35 pm.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S9.43 — Lord Teverson (MNIS 3789), Liberal Democrat

- **Matter:** Sewage, water quality and the Environment Act
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2021-07-07, House of Lords
- **Debate:** Environment Bill - Committee (6th Day) — Amendment 205B
- **Speech id:** `pwdata-lords:daylord2021-07-07a:209`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2021-07-07a.1408.0>
- **Selection rule:** their longest speech in a debate titled for this matter (1,069 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 19 votes recorded, all the same way

**In their own words:**

> My Lords, once again, I declare my interest as chair of the Cornwall and Isles of Scilly Local Nature Partnership, which is rather relevant to a couple of my amendments. I want to go back to the basic argument of what the Bill is about. There is a real issue—an emergency, as I and many others would describe it, in biodiversity and the quantum of nature in England. Because of that we have this Bill. It is about doing something—and we have to do something. However, while we all welcome nature recovery networks as a great initiative in the Bill for which I congratulate the Government, when we have that emergency and we have seen how the Aichi targets over the past 10 years mean that we have gone backwards in this area, we need those nature recovery networks actually to work. Exactly as the noble Lord, Lord Lucas, said, if we do not do that, what is the point? This group is about the rubber hitting the road, if you like. This is “make your mind up” time. Are Nature Recovery Networks and biodiversity targets going to be something we can all feel good about because they are in legislation, or will they make sure there is change over the next decade? That is the choice that the Government
>
> [… 719 words omitted — the whole speech is one click away …]
>
> they do not have that resource. So I am very interested to understand from the Minister how the Government see the future of these organisations. Again, I provocatively say, if we are not going to make them work, why do we not just get rid of them? That would be a great shame, because they are a tremendous forum for bringing various parties together to make these agendas work. My last point would be that they should also be an integral part of how nature recovery networks are designed and delivered. To sum up, we really come to a choice here. Are nature recovery networks and biodiversity targets purely there as comfort or are they there to change our natural environment? That is the question I pose to the Minister.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S9.44 — The Earl of Lindsay (MNIS 2059), Conservative

- **Matter:** Sewage, water quality and the Environment Act
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2021-06-07, House of Lords
- **Debate:** Environment Bill - Second Reading
- **Speech id:** `pwdata-lords:daylord2021-06-07a:129`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2021-06-07a.1207.0>
- **Selection rule:** their longest speech in a debate titled for this matter (733 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 18 votes recorded, all the same way

**In their own words:**

> My Lords, I am grateful to my noble friend for setting out this important Bill. I am grateful too for his long-term advocacy of many of the proposals it contains. The Bill offers a unique opportunity to create a coherent, long-term framework for the environment that is capable of motivating all sectors and all parts of society to plan, to commit to and to collaborate on improving the environment on which we and future generations depend. I therefore especially welcome the Bill’s seeking to address the core governance elements that will be needed for the decades ahead. This is the critical component. Business will clearly have a key role to play in delivering the changes needed to meet our long-term environmental ambitions and hit our net-zero target. Unlocking private sector finance and investment will be essential, particularly given the pressures on the public purse. For businesses to feel able to invest for the long term, it goes without saying that their trust and confidence will be prerequisites. Such trust and confidence will to a large extent depend on the governance mechanisms and processes by which long-term environmental targets and a national environmental improvement plan are set. This begs the question: do the governance mechanisms and associated processes proposed in the Bill need optimising? The Institute of Environmental Management & Assessment—IEMA—and
>
> [… 383 words omitted — the whole speech is one click away …]
>
> and the Woodland Carbon Code, to name but a few. We work closely with our UK quality infrastructure partner, the British Standards Institute—the BSI—in the development of consensus-based standards that meet the needs of all stakeholders. In short, the UK already has in place a proven means to create both the standards framework that will be needed and the underpinning accreditation to demonstrate whether and where those standards are, or are not, being achieved. As the saying goes, if you cannot measure it, you cannot manage it. This is especially true if this Bill is going to achieve its effect. In conclusion, I strongly support this very important Bill. It is a good Bill and, with a few tweaks to its governance proposals, it could become an even better one.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S9.45 — Lord Randall of Uxbridge (MNIS 209), Conservative

- **Matter:** Sewage, water quality and the Environment Act
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2021-09-15, House of Lords
- **Debate:** Environment Bill - Report (4th Day) — Amendment 106
- **Speech id:** `pwdata-lords:daylord2021-09-15a:120`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2021-09-15a.1416.2>
- **Selection rule:** their longest speech in a debate titled for this matter (1,985 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 13 votes recorded, NOT all the same way

**In their own words:**

> My Lords, I once again reiterate my conservation and wildlife interests as in the register, particularly, in relation to these amendments, as a vice-president of Fauna and Flora International. I shall speak to a number of amendments in this group in my name. I will try to be brief, but they cover three distinct and important issues. In Committee, at the behest of my Whips—as always, I listen to the Whips—I rather gabbled through the arguments and although it read all right in Hansard, I am not sure anybody really listened to it. I will try to be a bit slower this time and ask for noble Lords’ indulgence. Amendment 106 relates to the due diligence framework, which was a relatively late addition to the Bill, and is in broad terms very welcome. I congratulate the Government heartily on bringing it forward; indeed, I believe the Government fully understand this and rightly put a global halt to deforestation at the centre of their agenda for the COP summit in Glasgow. These measures are the first of their kind and we should be justly proud of our Government. They are the Government’s response to the Global Resource Initiative task force’s recommendation from March 2020 for a mandatory due diligence obligation on companies that place commodities and derived products that contribute to
>
> [… 1,635 words omitted — the whole speech is one click away …]
>
> footprint ahead of the conclusion of COP 15, as recommended by the Environmental Audit Committee in its June 2021 report on biodiversity in the UK? Secondly, will he agree to establish an independent expert panel to advise on the global footprint target? Thirdly, will he be able to appraise us of the legislative vehicle by which the Government would set a 2030 global footprint target, if they accept the evidence that this timescale is necessary? Finally, will he, when preparing the Government’s response to the independent report on the national food strategy, consider the potential for any legislative response? I thank noble Lords for their indulgence for this speech, which is considerably longer than my customary contributions, but this is something I feel very strongly about. I beg to move.

- **VERDICT — what position, if any, does this evidence establish?** _______

## M10 — Retained EU law and the "sunset" clause

Debates matched on the title *"Retained EU Law"*.

### S10.46 — Mr Jacob Rees-Mogg (MNIS 4099), Conservative

- **Matter:** Retained EU law and the "sunset" clause
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2023-05-24, House of Commons
- **Debate:** Retained EU Law (Revocation and Reform) Bill
- **Speech id:** `pwdata-debates:debates2023-05-24c:355`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2023-05-24c.349.2>
- **Selection rule:** their longest speech in a debate titled for this matter (786 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 16 votes recorded, NOT all the same way

**In their own words:**

> The point my hon. Friend misses is that there is still some time between now and the end of the year. This work could be pushed through if there were the desire to do it. This Bill is a tremendous missed opportunity. It is a missed opportunity not because of Brexit per se. It is not a missed opportunity because those of us who voted for Brexit expected the will of the British people—expressed in 2016 and 2019—to be pushed forward, although that is important. It is not a missed opportunity because the unelected House has decided to try and block a Brexit-related reform, as it has consistently done. Interestingly, the amendments passed in the unelected House are all designed to frustrate the progress of the Bill and its operation, and are, by and large, although not exclusively, supported—lo and behold—by people who never wanted Brexit in the first place. It is noticeable that the overwhelming majority of people in this House who do not want the full revocation of EU laws always opposed Brexit. However, it is not about that. The missed opportunity is in not achieving supply-side reforms that would get growth for the UK economy. We had the Prime Minister at the Dispatch Box this morning—the Leader of the Opposition missed a trick here—saying how marvellous it
>
> [… 436 words omitted — the whole speech is one click away …]
>
> hours when people are asleep count as work. That is an enormous burden on the NHS; it has been calculated that the working time directive costs the NHS £3 billion. We could have dealt with that in the revocations under this Bill, had the Government not lost their nerve. What about new opportunities in food and the regulations that stop us having novel foods? You may not wish to eat novel foods, Mr Deputy Speaker. I do not wish to eat novel foods. However, if there is a market for them, surely the UK should be regulating in a way that opens it up. We had a Bill in front of us that, unamended, would have allowed us to deal with novel foods swiftly by getting rid of EU regulations.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S10.47 — Lord Callanan (MNIS 4336), Conservative

- **Matter:** Retained EU law and the "sunset" clause
- **Basis:** `hansard-speech` — the member's own words (and a named sponsor of the Bill)
- **Spoke:** 2023-02-06, House of Lords
- **Debate:** Retained EU Law (Revocation and Reform) Bill - Second Reading (Continued)
- **Speech id:** `pwdata-lords:daylord2023-02-06b:260`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2023-02-06b.1077.0>
- **Selection rule:** their longest speech in a debate titled for this matter (2,773 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 9 votes recorded, all the same way

**In their own words:**

> My Lords, this has been a characteristically excellent debate which I think reflects the importance of the Bill. Before I get on to the substance of the issues raised, I will congratulate our two maidens, the noble Baroness, Lady O’Grady, and my noble friend Lady Bray, on their fine maiden speeches. I hope that the House is a similarly engaged audience to the one that my noble friend Lady Bray had when she was presenting for the British Forces Broadcasting Service in Gibraltar. I noted with interest that she studied medieval history at St Andrews. I am also told that she was fired as a PPS in the other place in 2012 for voting against the coalition Government’s plans to reform this House. With those two bits of excellent experience, she will clearly make an excellent Member of this House. Then we come on to excellent contribution from the noble Baroness, Lady O’Grady. I profoundly disagreed with all of it, of course, but she put it extremely well. I think it was the noble Baroness, Lady Andrews, who referred to her choice of “A Change Is Gonna Come” on “Desert Island Discs”. I was slightly more concerned by two of her other music choices on that programme—“Pieces of a Man” and “Burn It Down”. I hope neither of them is
>
> [… 2,423 words omitted — the whole speech is one click away …]
>
> as he would expect, including in civil aviation and all manner of transport. Similarly, I can reassure the noble Baroness, Lady Ludford—although again I suspect she will not accept the reassurance—that, while I do not agree with her assessment of the level of scrutiny that laws received within the EU institutions, I can confirm that the Government will not, of course, weaken building safety standards. This Bill will ensure that we can end retained EU law as a legal category, simplifying and bringing certainty to our statute book. It will also ensure that we can bring forward genuine reform, now ensuring that the UK’s regulatory system is suited to our needs. The Government are determined to see the opportunities of Brexit and I know that the Bill delivers that result.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S10.48 — Brendan O'Hara (MNIS 4371), Scottish National Party

- **Matter:** Retained EU law and the "sunset" clause
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2022-10-25, House of Commons
- **Debate:** Retained EU Law (Revocation and Reform) Bill
- **Speech id:** `pwdata-debates:debates2022-10-25a:376`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2022-10-25a.203.5>
- **Selection rule:** their longest speech in a debate titled for this matter (1,163 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 14 votes recorded, NOT all the same way

**In their own words:**

> Again, I thank my hon. Friend for that intervention, and I could not agree more with what he says. He is right to say that the way Scotland has been treated by this Government is disgraceful and it cannot continue, and this power grab will be called out for what it is. Let me ask the Minister this: what would happen if the Scottish Parliament decides that we will remain aligned to the European Union and we ban the sale of chlorinated chicken, but this place decides that cheap, imported, chlorine-washed chicken is acceptable? Exactly what power will the Scottish Parliament have to stop lorryloads of chlorine-washed poultry crossing the border and appearing on our supermarket shelves? Similarly, what happens if the UK agrees a trade deal that sees the UK flooded with cheap, factory-farmed, hormone-injected meat but our Scottish Parliament decides to protect Scottish consumers and Scottish farmers by adhering to existing standards and protections? Can he guarantee that the Scottish Government will be able to prevent that inferior quality, hormone-injected meat from reaching Scotland’s supermarkets? What happens if the Scottish Parliament decides that it will stick by long-established best practice in the welfare and treatment of animals but Westminster chooses to deregulate? Can he give a cast-iron guarantee that the Scottish Parliament will be able to prevent animals
>
> [… 813 words omitted — the whole speech is one click away …]
>
> through change after change after change, as required. In the history of DL Committees, in the past 65 years, only 17 statutory instruments have been voted down—and that has not happened since 1979. While there is a role for such Committees, it is not to make wholesale and fundamental changes to vast swathes of the law, covering everything from the environment and nature to consumer protection. As we have heard, parliamentary scrutiny is being avoided because, in their desperation or fervour to rid themselves of any European influence, the zealots at the heart of this collapsing Government have arbitrarily included a sunset clause, meaning that 2,500 laws will be removed and not be replaced. Unless the Government grant themselves an extension, those laws will simply disappear from the statute book.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S10.49 — Justin Madders (MNIS 4418), Labour

- **Matter:** Retained EU law and the "sunset" clause
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2022-10-25, House of Commons
- **Debate:** Retained EU Law (Revocation and Reform) Bill
- **Speech id:** `pwdata-debates:debates2022-10-25a:436`
- **Read the whole speech:** <https://www.theyworkforyou.com/debates/?id=2022-10-25a.248.2>
- **Selection rule:** their longest speech in a debate titled for this matter (1,932 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** 13 votes recorded, NOT all the same way

**In their own words:**

> There have been more than 20 speakers today, and there have been some really important speeches, particularly by Labour Members. My hon. Friends the Members for Luton South (Rachel Hopkins), for Sheffield Central (Paul Blomfield), and for Liverpool, Riverside (Kim Johnson) have spoken extremely well. My hon. Friend the Member for Stockton North (Alex Cunningham) spoke, as he always does, as a powerful advocate for the chemical industry, and it was alarming to hear about the increased costs that it faces. I hope that the Government are listening and act accordingly. My right hon. Friend the Member for Hayes and Harlington (John McDonnell) made an important point. He was right to link the Government’s actions and anti-trade union legislation that we have seen, and will see again, with what might happen with the Bill. There is a very good reason why working people have a lack of trust that the Government will protect employment rights. My right hon. Friend the Member for Leeds Central (Hilary Benn) gave a superb speech about why the Bill was bad for democracy. He was right to quote the Hansard Society, which said that the Bill sidelined Parliament. He also said—and I agree entirely—that one person’s burdensome law is another person’s right to safe working conditions. My hon. Friend the Member for Walthamstow (Stella Creasy)
>
> [… 1,582 words omitted — the whole speech is one click away …]
>
> that that was not what they wanted to happen, because that is what their votes today could lead to. Today we are being asked to sign a blank cheque. We are being asked to agree a Bill that puts some of our most important environmental, employment and social protections on a cliff edge and place our trust in a Government that change their Ministers and Prime Ministers as often as most people change their socks. No self-respecting defender of democracy can sign up to that. To conclude, with all the talk of sunset clauses in the Bill, perhaps the one thing that it shows is that we do need a sunset, and we need it as soon as possible. We need a sunset on this Government once and for all.

- **VERDICT — what position, if any, does this evidence establish?** _______

### S10.50 — Baroness Lawlor (MNIS 4965), Conservative

- **Matter:** Retained EU law and the "sunset" clause
- **Basis:** `hansard-speech` — the member's own words
- **Spoke:** 2023-03-02, House of Lords
- **Debate:** Retained EU Law (Revocation and Reform) Bill - Committee (3rd Day) (Continued) — Amendment 51
- **Speech id:** `pwdata-lords:daylord2023-03-02b:209`
- **Read the whole speech:** <https://www.theyworkforyou.com/lords/?id=2023-03-02b.464.0>
- **Selection rule:** their longest speech in a debate titled for this matter (924 words; its first 220 and last 130 words quoted). Chosen without reading which way it points.
- **Coverage (selection only — says nothing about which way):** no votes recorded on this matter

**In their own words:**

> My Lords, I am pleased to follow my noble friend Lady McIntosh of Pickering and the noble Baroness, Lady Humphreys, to whom I have listened with great interest. My Amendment 56ZA is to bring forward the extension date in Clause 2(4) to the end of 2024. There are political and practical reasons for doing so. Politically, a general election must be held by 12 December 2024. It is important that the Government elected in 2019 not only honour their commitments to deal with inherited EU law but bring forward the extension date to coincide with, or be within striking distance of, the end of this Parliament. This is not a matter of ideology, as has been suggested by some noble Lords in respect of the sunsetting of legislation, but of working within the normal political timetable: a Government are elected, they set about implementing their programme and, when the time comes, they go to the country for the people to judge. That is how this democracy functions. When people vote, they take a punt on the party they vote for and they vote for it to govern, for general or specific reasons. Political theorists may, and do, disagree about the extent to which voters’ knowledge of detailed programmes or their expectations are at play, but there is little argument among
>
> [… 574 words omitted — the whole speech is one click away …]
>
> referendum. My view is that, on the matter of retained EU law covered by this Bill, the Executive have direct authority to act. They were given it in December 2019 by the electorate, who made clear that they preferred to deal with the Executive, the Government, who appealed to them directly over the legislature, which had appeared to ignore the decision of the referendum more than three years earlier or to obstruct its execution. On all three grounds therefore—political, practical and constitutional—not only do I support the Bill’s approach but, for the reasons given, I ask my noble friend the Minister to accept that there are also grounds for moving more rapidly to advance the extension date in Clause 2 to within striking distance of the lifetime of this Parliament.

- **VERDICT — what position, if any, does this evidence establish?** _______

---

# ⛔ UNSOUND BASIS — NOT SCORABLE (136 rows)

**Do not score these.** Every row below rests on amendment sponsorship, which is an
**unsigned** fact: a wrecking amendment and a strengthening amendment are the same act, so
the citation cannot establish the direction the row was drafted to assert.

They are kept rather than deleted for three reasons:

1. **The count is the finding.** 136 of 157 rows — 86.6% of the first draft — rested on it. A basis
   error at that scale is worth a record, not a quiet deletion.
2. **The relevance survives even though the direction does not.** These members did engage
   with these matters, and that is exactly what an unsigned fact CAN tell you. It is why
   they remained the pool the sound rows were drawn from.
3. **The basis may be recoverable.** Classifying what each amendment actually did —
   strengthening or wrecking — would give it a direction. ⚠ **That is an inference, and a
   separate piece of work.** It was not attempted here, and a key built on an unvalidated
   classifier would import the classifier's errors as ground truth.

⚠ The **"Proposed position"** line on each row below is the withdrawn claim. It is left in
place so the defect can be seen rather than described.

## M1 — Assisted dying · UNSOUND

### M1.004 — Tom Gordon (MNIS 5032), Liberal Democrat

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 2, page 2, line 2, leave out “within 6 months” and insert— “(i) in the case of a neurodegenerative illness, disease, or medical condition, within 12 months; or”
- **VERDICT:** _______

### M1.005 — Sir Edward Leigh (MNIS 345), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC3 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Guidance: administration of pain relief to people who are terminally ill”
- **VERDICT:** _______

### M1.008 — Saqib Bhatti (MNIS 4818), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC7 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Doctor independence”
- **VERDICT:** _______

### M1.003 — Dame Meg Hillier (MNIS 1524), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Report stage, with 36 co-sponsors (Naz Shah, Antonia Bance, Jess Asato, Kirsteen Sullivan, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “No health professional shall raise assisted dying first”
- **VERDICT:** _______

### M1.006 — Andrew Pakes (MNIS 5243), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC4 at Report stage, with 7 co-sponsors (Dame Meg Hillier, Antonia Bance, Jess Asato, Melanie Ward, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Monitoring by Chief Medical Officer”
- **VERDICT:** _______

### M1.007 — Valerie Vaz (MNIS 4076), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC5 at Report stage, with 1 co-sponsor (Rachael Maskell)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Implications for civil procedure rules and probate proceedings”
- **VERDICT:** _______

### M1.009 — Gregory Stafford (MNIS 5351), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC8 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Novel treatments not authorised by the Medicines and Healthcare products Regulatory Agency”
- **VERDICT:** _______

### M1.010 — Sarah Bool (MNIS 5355), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC9 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “To move the following Clause— “Standard of proof”
- **VERDICT:** _______

### M1.011 — Rachael Maskell (MNIS 4471), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 25 at Report stage, with 7 co-sponsors (Sir Desmond Swayne, Graham Stringer, Margaret Mullane, Marsha De Cordova, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 9, page 6, line 3, leave out from “person” to the second “the” in line 5 and insert “convene a panel to carry out the first assessment. (1A) The clinical panel should consist of—”
- **VERDICT:** _______

### M1.012 — Dr Ben Spencer (MNIS 4785), Conservative

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 18 at Report stage
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 2, page 2, line 6, leave out from “expected” to end”
- **VERDICT:** _______

### M1.013 — Jess Asato (MNIS 5156), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 9 at Report stage, with 5 co-sponsors (Dame Meg Hillier, Rachael Maskell, Melanie Ward, Neil Coyle, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 11, page 9, line 25, leave out paragraph (g) and insert— “(g) ask the person whether they have discussed the request with their next of kin and other persons they are close to and, where they have not done so, discuss their reasons for not doing so.”…”
- **VERDICT:** _______

### M1.014 — Naz Shah (MNIS 4409), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 14 at Report stage, with 15 co-sponsors (Dame Meg Hillier, Rachael Maskell, Melanie Ward, Neil Coyle, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 2, page 2, line 6, at end insert— “(1A) A person who would not otherwise meet the requirements of subsection (1) shall not be considered to meet those requirements solely as a result of voluntarily stopping eating or drinking.”…”
- **VERDICT:** _______

### M1.015 — Daniel Francis (MNIS 5184), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 24 at Report stage, with 17 co-sponsors (Melanie Ward, Neil Coyle, Dame Meg Hillier, Antonia Bance, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 3, page 2, line 18, at end insert “except that section 1(2) of that Act shall not apply””
- **VERDICT:** _______

### M1.016 — Patricia Ferguson (MNIS 5190), Labour

- **Proposed position on Assisted dying:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 13 at Report stage, with 9 co-sponsors (Dame Meg Hillier, Rachael Maskell, Melanie Ward, Neil Coyle, …)
- **Source:** <https://bills.parliament.uk/bills/3774/stages/19799/amendments>
- **In its own words:** “Clause 4, page 2, line 22, at end insert— “(2A) A person may not be appointed under subsection (2) unless the appointment has the consent of the Health and Social Care Select Committee of the House of Commons.”
- **VERDICT:** _______

## M2 — Removals to Rwanda · UNSOUND

### M2.020 — Mr Alistair Carmichael (MNIS 1442), Liberal Democrat

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 6 at Committee of the whole House, with 1 co-sponsor (Sir Robert Buckland) — decision: NotSelected
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Page 3, line 21, leave out Clause 3”
- **VERDICT:** _______

### M2.021 — Alison Thewliss (MNIS 4430), Scottish National Party

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 51 at Committee of the whole House, with 3 co-sponsors (Chris Stephens, Stephen Flynn, Owen Thompson) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 5, page 5, line 15, leave out “not””
- **VERDICT:** _______

### M2.022 — Yvette Cooper (MNIS 420), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 38 at Committee of the whole House, with 1 co-sponsor (Stephen Kinnock) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 5, page 5, line 23, after “person” insert “in consultation with the Attorney General.””
- **VERDICT:** _______

### M2.019 — Robert Jenrick (MNIS 4320), Conservative

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 11 at Committee of the whole House, with 60 co-sponsors (Suella Braverman, Sir John Hayes, Sir Iain Duncan Smith, Mr David Jones, …) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 3, page 3, line 21, after “Act” insert “, and of the Illegal Migration Act 2023 insofar as they relate to the removal of persons to Rwanda””
- **VERDICT:** _______

### M2.023 — Stella Creasy (MNIS 4088), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 9 at Committee of the whole House, with 1 co-sponsor (Claire Hanna) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 5, page 5, line 23, at end insert— “(5) The Government must, within three months of this Act receiving Royal Assent, lay before Parliament a copy of a report setting out how this clause is compatible with Section 7A of the European Withdrawal Act and th…”
- **VERDICT:** _______

### M2.024 — Sir Robert Buckland (MNIS 4106), Conservative

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 26 at Committee of the whole House — decision: NotSelected
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Page 5, line 8, leave out Clause 5”
- **VERDICT:** _______

### M2.025 — Patrick Grady (MNIS 4432), Scottish National Party

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 4 at Committee of the whole House, with 1 co-sponsor (Joanna Cherry) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 8, page 6, line 23, leave out “Scotland””
- **VERDICT:** _______

### M2.026 — Joanna Cherry (MNIS 4419), Scottish National Party

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 32 at Committee of the whole House — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “Clause 8, page 6, line 25, leave out “the United Kingdom” and insert “England and Wales and Northern Ireland.””
- **VERDICT:** _______

### M2.027 — Sir Jeffrey M Donaldson (MNIS 650), Democratic Unionist Party

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC3 at Committee of the whole House, with 7 co-sponsors (Sammy Wilson, Gavin Robinson, Mr Gregory Campbell, Carla Lockhart, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18251/amendments>
- **In its own words:** “To move the following Clause— “Effect in Northern Ireland”
- **VERDICT:** _______

### M2.028 — Lord German (MNIS 4163), Liberal Democrat

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 35 at Committee stage, with 1 co-sponsor (Lord Scriven) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “After Clause 2, insert the following new Clause— “Applicability of decisions”
- **VERDICT:** _______

### M2.029 — Baroness Chakrabarti (MNIS 4579), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 36 at Committee stage, with 2 co-sponsors (Baroness Hale of Richmond, The Lord Archbishop of Canterbury) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “Leave out Clause 3 and insert the following new Clause— “Limited disapplication of section 6 of the Human Rights Act 1998”
- **VERDICT:** _______

### M2.030 — Lord Etherton (MNIS 4902), Crossbench

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 38 at Committee stage, with 2 co-sponsors (Lord Cashman, Lord Purvis of Tweed) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “Clause 4, page 4, line 12, after “question” insert “or, where the person in question is a member of a particular social group within Article 1A(2) of the Refugee Convention 1951, for that group””
- **VERDICT:** _______

### M2.031 — Lord Dubs (MNIS 805), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 41 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “Clause 4, page 4, line 13, after “circumstances” insert “such as a claim based on the grounds outlined in Article 1A(2) of the Refugee Convention 1951 including on religion or belief grounds””
- **VERDICT:** _______

### M2.032 — Lord Coaker (MNIS 360), Labour

- **Proposed position on Removals to Rwanda:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 48 at Committee stage, with 2 co-sponsors (Lord Hope of Craighead, Lord Purvis of Tweed) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3540/stages/18451/amendments>
- **In its own words:** “Clause 4, page 4, line 23, leave out subsection (2)”
- **VERDICT:** _______

## M3 — Illegal migration and small boats · UNSOUND

### M3.035 — Liz Saville Roberts (MNIS 4521), Plaid Cymru

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Report stage, with 6 co-sponsors (Hywel Williams, Ben Lake, Apsana Begum, Nadia Whittome, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Detainees: permission to work after six months”
- **VERDICT:** _______

### M3.036 — Apsana Begum (MNIS 4790), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC2 at Report stage, with 21 co-sponsors (Bell Ribeiro-Addy, Richard Burgon, Rebecca Long Bailey, Ms Diane Abbott, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Arrangements for removal: pregnancy”
- **VERDICT:** _______

### M3.044 — The Lord Bishop of Durham (MNIS 4312), Bishops

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 128B at Committee stage, with 3 co-sponsors (Baroness Stroud, Lord Purvis of Tweed, Baroness Lister of Burtersett) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “Clause 58, page 61, line 3, at end insert— “(6A) The Secretary of State may not make regulations under subsection (1) specifying any limit on the number of persons who arrive under the following schemes—”
- **VERDICT:** _______

### M3.037 — Dame Diana Johnson (MNIS 1533), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC4 at Report stage, with 5 co-sponsors (Caroline Lucas, Hywel Williams, Ben Lake, Jonathan Edwards, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Independent child trafficking guardian”
- **VERDICT:** _______

### M3.038 — Bell Ribeiro-Addy (MNIS 4764), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC5 at Report stage, with 14 co-sponsors (Apsana Begum, Caroline Lucas, Beth Winter, Ian Byrne, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Immigration rules since December 2020: human rights of migrants”
- **VERDICT:** _______

### M3.039 — Yvette Cooper (MNIS 420), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC9 at Report stage, with 1 co-sponsor (Stephen Kinnock) — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Accommodation: duty to consult”
- **VERDICT:** _______

### M3.040 — Alison Thewliss (MNIS 4430), Scottish National Party

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC18 at Report stage, with 7 co-sponsors (Stuart C McDonald, Patrick Grady, Brendan O'Hara, Hywel Williams, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “To move the following Clause— “Suspensive claims and related appeals: legal aid and legal advice”
- **VERDICT:** _______

### M3.041 — Stella Creasy (MNIS 4088), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 17 at Report stage, with 5 co-sponsors (Caroline Lucas, Hywel Williams, Ben Lake, Jonathan Edwards, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “Clause 2, page 3, line 9, at end insert ”, and— (a) was aged 18 years or older on the date on which they entered or arrived in the United Kingdom, and”
- **VERDICT:** _______

### M3.042 — Stephen Farry (MNIS 4856), Alliance

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Report stage, with 1 co-sponsor (Claire Hanna) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “Clause 2, page 4, line 4, at end insert— “(d) the person enters the United Kingdom from Ireland across the land border with Northern Ireland.””
- **VERDICT:** _______

### M3.043 — Tim Loughton (MNIS 114), Conservative

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 181 at Report stage, with 15 co-sponsors (Tracey Crouch, Sir Robert Buckland, Mrs Flick Drummond, Richard Fuller, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17595/amendments>
- **In its own words:** “Clause 3, page 4, line 9, leave out subsections (2) to (4)”
- **VERDICT:** _______

### M3.045 — Lord Purvis of Tweed (MNIS 4293), Liberal Democrat

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of amendment 10007073 at Committee stage, with 1 co-sponsor (Baroness Chakrabarti) — decision: StoodPart
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “The above-named Lords give notice of their intention to oppose the Question that Clause 58 stand part of the Bill.”
- **VERDICT:** _______

### M3.046 — Baroness Stroud (MNIS 4546), Conservative

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 128C at Committee stage, with 3 co-sponsors (Baroness Helic, Lord Kirkhope of Harrogate, Baroness Mobarik) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “After Clause 58, insert the following new Clause— “Duty to establish safe and legal routes”
- **VERDICT:** _______

### M3.047 — Baroness Ludford (MNIS 1867), Liberal Democrat

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 129 at Committee stage, with 3 co-sponsors (Lord Paddick, Lord Kerr of Kinlochard, Baroness Bennett of Manor Castle) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “After Clause 59, insert the following new Clause— “Refugee family reunion”
- **VERDICT:** _______

### M3.048 — Baroness Lister of Burtersett (MNIS 4234), Labour

- **Proposed position on Illegal migration and small boats:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 130 at Committee stage, with 3 co-sponsors (Lord Carlile of Berriew, Lord Dubs, Lord Kerr of Kinlochard) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3429/stages/17659/amendments>
- **In its own words:** “After Clause 59, insert the following new Clause— “Safe passage visa scheme”
- **VERDICT:** _______

## M4 — Asylum and the Nationality and Borders Act · UNSOUND

### M4.051 — Baroness Hamwee (MNIS 2652), Liberal Democrat

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “leave out “equally” and insert “in the same terms””
- **VERDICT:** _______

### M4.056 — Lord Anderson of Ipswich (MNIS 4705), Crossbench

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of Unnumbered at Committee stage, with 3 co-sponsors (Lord Rosser, Lord Paddick, Baroness Warsi) — decision: Disagreed
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “The above-named Lords give notice of their intention to oppose the Question that Clause 9 stand part of the Bill.”
- **VERDICT:** _______

### M4.063 — The Lord Bishop of Durham (MNIS 4312), Bishops

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 29 at Report stage, with 1 co-sponsor (Baroness Lister of Burtersett) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16165/amendments>
- **In its own words:** “at end insert— In section 16 of the Nationality, Immigration and Asylum Act 2002 (establishment of centres), at end insert—”
- **VERDICT:** _______

### M4.052 — Baroness McIntosh of Pickering (MNIS 384), Conservative

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 3 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “at end insert— The Secretary of State must not charge a fee for the processing of applications under this section.””
- **VERDICT:** _______

### M4.053 — Baroness Lister of Burtersett (MNIS 4234), Labour

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 11 at Committee stage, with 3 co-sponsors (Baroness Ludford, Lord Woolley of Woodford, Baroness Bennett of Manor Castle) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Insert the following new Clause— “Provision for Chagos Islanders to acquire British nationality”
- **VERDICT:** _______

### M4.054 — Lord Russell of Liverpool (MNIS 2134), Crossbench

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 14 at Committee stage, with 1 co-sponsor (Baroness Hamwee) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “at end insert— In section 1 (acquisition by birth or adoption), in subsection (5)—”
- **VERDICT:** _______

### M4.055 — Lord Moylan (MNIS 4883), Conservative

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 27 at Committee stage, with 3 co-sponsors (Baroness Fox of Buckley, Baroness Mobarik, Baroness Warsi) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Leave out Clause 9 and insert the following new Clause— “Deprivation of citizenship”
- **VERDICT:** _______

### M4.057 — Lord Paddick (MNIS 4288), Liberal Democrat

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 29 at Committee stage, with 1 co-sponsor (Baroness Hamwee) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Insert the following new Clause— “Deprivation of citizenship: procedure”
- **VERDICT:** _______

### M4.058 — Lord Dubs (MNIS 805), Labour

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 30 at Committee stage, with 2 co-sponsors (Baroness Ludford, Baroness Bennett of Manor Castle) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “after “birth” insert “without any legal or administrative barriers””
- **VERDICT:** _______

### M4.059 — Baroness Bennett of Manor Castle (MNIS 4719), Green Party

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 32 at Committee stage, with 1 co-sponsor (Baroness Chakrabarti) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Insert the following new Clause— “Repeal of power to deprive citizenship except for cases of fraud etc.”
- **VERDICT:** _______

### M4.060 — Baroness Ludford (MNIS 1867), Liberal Democrat

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 34 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16003/amendments>
- **In its own words:** “Insert the following new Clause— “Acquisition of British citizenship by birth or adoption: comprehensive sickness insurance”
- **VERDICT:** _______

### M4.061 — Baroness D'Souza (MNIS 3709), Crossbench

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 19A at Report stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16165/amendments>
- **In its own words:** “leave out subsections (5) to (7)”
- **VERDICT:** _______

### M4.062 — Baroness Chakrabarti (MNIS 4579), Labour

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 24 at Report stage, with 3 co-sponsors (Lord Judge, Lord Pannick, Baroness Hamwee) — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16165/amendments>
- **In its own words:** “Insert the following new Clause— “Compliance with the Refugee Convention”
- **VERDICT:** _______

### M4.064 — Baroness Stroud (MNIS 4546), Conservative

- **Proposed position on Asylum and the Nationality and Borders Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 30 at Report stage, with 3 co-sponsors (Baroness Lister of Burtersett, Baroness Ludford, Baroness Meacher) — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3023/stages/16165/amendments>
- **In its own words:** “Insert the following new Clause— “Changes to the Immigration Act 1971”
- **VERDICT:** _______

## M5 — Leaving the European Union · UNSOUND

### M5.068 — Lord Wigley (MNIS 547), Plaid Cymru

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage, with 1 co-sponsor (Lord Dykes) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at beginning insert “Subject to subsections (2) and (3),””
- **VERDICT:** _______

### M5.069 — Lord Adonis (MNIS 3743), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 2 at Committee stage, with 3 co-sponsors (Lord Hain, Lord Triesman, Baroness Meacher) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “leave out “on exit day” and insert “on a date to be determined by a further Act of Parliament””
- **VERDICT:** _______

### M5.077 — Lord Pannick (MNIS 3870), Crossbench

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 15 at Committee stage, with 3 co-sponsors (Baroness Taylor of Bolton, Lord Norton of Louth, Lord Beith) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “leave out paragraphs (b) to (d)”
- **VERDICT:** _______

### M5.070 — Lord Foulkes of Cumnock (MNIS 579), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 5 at Committee stage, with 2 co-sponsors (Lord Dykes, Lord Judd) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations under section 19(2) bringing into force subsection (1) may not be made until the Prime Minister is satisfied that resolutions have been passed by the Scottish Parliament, the National Assembly for Wales and the Northern Ireland Assem…”
- **VERDICT:** _______

### M5.071 — Lord Hunt of Kings Heath (MNIS 2024), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 8 at Committee stage, with 3 co-sponsors (Lord Warner, Baroness Finlay of Llandaff, Lord Teverson) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has set out a strategy for seeking to remain a member of (or maintain equivalent participatory relations with) Euratom, in order to provide continuity wi…”
- **VERDICT:** _______

### M5.072 — Baroness Thornton (MNIS 1782), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 9 at Committee stage, with 3 co-sponsors (Baroness Jolly, Lord Warner, The Earl of Clancarty) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has set out a strategy for seeking to ensure that any citizen of the United Kingdom or of an EU country, who requires health care in a different country …”
- **VERDICT:** _______

### M5.073 — Lord Wallace of Saltaire (MNIS 1816), Liberal Democrat

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 12 at Committee stage, with 3 co-sponsors (Baroness Smith of Newnham, Lord Judd, Viscount Hailsham) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has laid before both Houses of Parliament procedures agreed with the EU for continued coordination of foreign and security policy, including association …”
- **VERDICT:** _______

### M5.074 — Baroness Ludford (MNIS 1867), Liberal Democrat

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 13 at Committee stage, with 3 co-sponsors (Baroness Smith of Newnham, Lord Judd, Lord Cormack) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has laid before both Houses of Parliament procedures agreed with the EU for continued UK participation in measures to promote internal security, police c…”
- **VERDICT:** _______

### M5.075 — Lord Goldsmith (MNIS 2490), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 13A at Committee stage, with 3 co-sponsors (Baroness Hayter of Kentish Town, Lord Lennie, Lord Tunnicliffe) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “at end insert— Regulations bringing into force subsection (1) may not be made until the Secretary of State has laid before both Houses of Parliament proposals for arrangements for the continued application of the Charter of Fundamental Rights to retained EU la…”
- **VERDICT:** _______

### M5.076 — Viscount Hailsham (MNIS 349), Conservative

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 14A at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “At end insert “and forms part of domestic primary legislation””
- **VERDICT:** _______

### M5.078 — Baroness McIntosh of Pickering (MNIS 384), Conservative

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 18 at Committee stage, with 1 co-sponsor (Lord Wigley) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “Insert the following new Clause— “Status of EU directives adopted, but not implemented, before exit day”
- **VERDICT:** _______

### M5.079 — Baroness Hayter of Kentish Town (MNIS 4159), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 21 at Committee stage, with 3 co-sponsors (Lord Warner, Baroness Smith of Newnham, Lord Kirkhope of Harrogate) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “Insert the following new Clause— “Future treatment of retained EU law”
- **VERDICT:** _______

### M5.080 — Baroness Kennedy of The Shaws (MNIS 1987), Labour

- **Proposed position on Leaving the European Union:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 22 at Committee stage, with 1 co-sponsor (Lord Cashman) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2045/stages/10158/amendments>
- **In its own words:** “At end insert— human rights protection.””
- **VERDICT:** _______

## M6 — The generational smoking ban · UNSOUND

### M6.086 — Dr Caroline Johnson (MNIS 4592), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC6 at Committee stage — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “To move the following Clause— “Consultation on licensing regulations”
- **VERDICT:** _______

### M6.088 — Helen Maguire (MNIS 5336), Liberal Democrat

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 49 at Committee stage — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “Title, line 2, leave out “born on or after 1 January 2009” and insert “under the age of 25””
- **VERDICT:** _______

### M6.093 — Jim Allister (MNIS 5356), Traditional Unionist Voice

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC3 at Report stage, with 7 co-sponsors (Gavin Robinson, Sammy Wilson, Jim Shannon, Alex Easton, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Amendment of the European Union (Withdrawal) Act 2018”
- **VERDICT:** _______

### M6.083 — Mary Kelly Foy (MNIS 4753), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Committee stage, with 1 co-sponsor (Bob Blackman) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “To move the following Clause— “Mandatory health warnings on cigarettes and cigarette rolling papers: consultation”
- **VERDICT:** _______

### M6.084 — Jim Dickson (MNIS 5223), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC4 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “To move the following Clause— “Ban on supply of cigarette filters”
- **VERDICT:** _______

### M6.085 — Mary Glindon (MNIS 4126), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC5 at Committee stage — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “To move the following Clause— “Ban on manufacture and sales of high-strength nicotine pouches”
- **VERDICT:** _______

### M6.087 — Andrew Gwynne (MNIS 1506), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 15 at Committee stage — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “Clause 168, page 121, line 1, after “force” insert “(so far as not in force by virtue of subsection (2))””
- **VERDICT:** _______

### M6.089 — Sarah Bool (MNIS 5355), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 96 at Committee stage — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “Clause 12, page 6, line 8, at end insert— “(1A) The offence set out in subsection (1) does not apply to vending machines that are located within specialised mental health units that provide care for mental health patients.”…”
- **VERDICT:** _______

### M6.090 — Helen Morgan (MNIS 4934), Liberal Democrat

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 2 at Committee stage, with 2 co-sponsors (Liz Jarvis, Dr Danny Chambers) — decision: Disagreed
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19324/amendments>
- **In its own words:** “Clause 38, page 20, line 18, leave out from“must” to the end of line 19 and insert “be allocated by the relevant Local Health and Wellbeing Board to public health projects.””
- **VERDICT:** _______

### M6.091 — Wera Hobhouse (MNIS 4602), Liberal Democrat

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Report stage, with 6 co-sponsors (Steve Darling, Ian Sollom, Caroline Voaden, Daisy Cooper, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Review of contaminated e-liquid”
- **VERDICT:** _______

### M6.092 — Dame Caroline Dinenage (MNIS 4008), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC2 at Report stage, with 19 co-sponsors (Vikki Slade, Tim Farron, Mike Martin, Ellie Chowns, …) — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Ban on the supply of plastic cigarette filters”
- **VERDICT:** _______

### M6.094 — Catherine Atkinson (MNIS 5143), Labour

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC5 at Report stage — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Report on sale of vaping products to facilitate child sexual exploitation”
- **VERDICT:** _______

### M6.095 — Jack Rankin (MNIS 5340), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC8 at Report stage, with 10 co-sponsors (Sarah Bool, Ben Obese-Jecty, Jim Shannon, Sir Desmond Swayne, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Prohibition of advertising of vaping, nicotine and heated tobacco products”
- **VERDICT:** _______

### M6.096 — Sir John Hayes (MNIS 350), Conservative

- **Proposed position on The generational smoking ban:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC12 at Report stage, with 5 co-sponsors (Jack Rankin, Sir Edward Leigh, Mr Peter Bedford, Sammy Wilson, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3879/stages/19506/amendments>
- **In its own words:** “To move the following Clause— “Review of provisions”
- **VERDICT:** _______

## M7 — Protest and public order · UNSOUND

### M7.099 — Dr Rupa Huq (MNIS 4511), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC1 at Committee stage, with 38 co-sponsors (Sir Bernard Jenkin, Dame Diana Johnson, Wera Hobhouse, Simon Fell, …) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Offence of interference with access to or provision of abortion services”
- **VERDICT:** _______

### M7.105 — Anne McLaughlin (MNIS 4437), Scottish National Party

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “Page 1, line 4, leave out Clause 1”
- **VERDICT:** _______

### M7.106 — Wendy Chamberlain (MNIS 4765), Liberal Democrat

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 29 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “Clause 1, page 1, line 10, leave out “or is capable of causing””
- **VERDICT:** _______

### M7.108 — Liz Saville Roberts (MNIS 4521), Plaid Cymru

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC12 at Report stage, with 2 co-sponsors (Hywel Williams, Ben Lake) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “To move the following Clause— “Justice impact assessments for Wales”
- **VERDICT:** _______

### M7.100 — Stella Creasy (MNIS 4088), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC2 at Committee stage, with 1 co-sponsor (Alex Cunningham) — decision: NegativedOnDivision
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Hostility towards sex or gender”
- **VERDICT:** _______

### M7.101 — Paul Maynard (MNIS 3926), Conservative

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC3 at Committee stage, with 1 co-sponsor (Jackie Doyle-Price) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Offences impeding emergency workers”
- **VERDICT:** _______

### M7.102 — Marsha De Cordova (MNIS 4676), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC8 at Committee stage, with 1 co-sponsor (Dr Rupa Huq) — decision: Disagreed
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Publication of data about use of stop and search powers”
- **VERDICT:** _______

### M7.103 — Sarah Jones (MNIS 4631), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC10 at Committee stage, with 1 co-sponsor (Yvette Cooper) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “To move the following Clause— “Guidance on locking on”
- **VERDICT:** _______

### M7.104 — Kit Malthouse (MNIS 4495), Conservative

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 24 at Committee stage — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16490/amendments>
- **In its own words:** “Title, line 2, leave out “delegation” and insert “exercise””
- **VERDICT:** _______

### M7.107 — Suella Braverman (MNIS 4475), Conservative

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC7 at Report stage — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “To move the following Clause— “Power of Secretary of State to bring proceedings”
- **VERDICT:** _______

### M7.109 — Bell Ribeiro-Addy (MNIS 4764), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of NC15 at Report stage, with 28 co-sponsors (Apsana Begum, Liz Saville Roberts, Hywel Williams, Ben Lake, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “To move the following Clause— “Public inquiry into the impact of policing of public order on Black, Asian and minority ethnic people”
- **VERDICT:** _______

### M7.110 — Joanna Cherry (MNIS 4419), Scottish National Party

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 28 at Report stage, with 3 co-sponsors (Florence Eshalomi, Apsana Begum, Bell Ribeiro-Addy) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “Clause 1, page 1, line 6, after “they” insert “, without reasonable excuse, and using a device or substance that impedes detachment””
- **VERDICT:** _______

### M7.111 — Alicia Kearns (MNIS 4805), Conservative

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 51 at Report stage, with 16 co-sponsors (Sir Geoffrey Clifton-Brown, Sally-Ann Hart, Greg Smith, Dr Ben Spencer, …) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3153/stages/16631/amendments>
- **In its own words:** “Clause 7, page 7, line 31, at end insert— “(j) farms and food production infrastructure.””
- **VERDICT:** _______

### M7.112 — Baroness Chakrabarti (MNIS 4579), Labour

- **Proposed position on Protest and public order:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 117 at Committee stage, with 3 co-sponsors (Lord Paddick, Baroness Boycott, Baroness Jones of Moulsecoomb) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3153/stages/17066/amendments>
- **In its own words:** “After Clause 18, insert the following new Clause— “Protection for journalists and others monitoring protests”
- **VERDICT:** _______

## M8 — Employment rights and industrial action · UNSOUND

### M8.115 — Lord Collins of Highbury (MNIS 4222), Labour

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 42 at Committee stage, with 2 co-sponsors (Baroness O'Grady of Upper Holloway, Lord Hendy) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “leave out subsections (2) and (3)”
- **VERDICT:** _______

### M8.116 — Lord Fox (MNIS 4322), Liberal Democrat

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 43 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “leave out subsections (2) to (5) and insert— A statutory instrument containing regulations under this section may not be made unless a draft of the instrument has been laid before, and approved by a resolution of, each House of Parliament.”…”
- **VERDICT:** _______

### M8.122 — Lord Patel (MNIS 2443), Crossbench

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 18 at Committee stage, with 1 co-sponsor (Lord Kakkar) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “at end insert— Regulations made under subsection (4)(a) specifying minimum service levels for health services may not be made unless the Government has first established, via primary legislation, appropriate and legally enforceable staffing levels across healt…”
- **VERDICT:** _______

### M8.117 — Baroness Randerson (MNIS 4230), Liberal Democrat

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 48 at Committee stage, with 1 co-sponsor (Lord Thomas of Cwmgiedd) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “leave out from “Act” to end of line 11 and insert “of Parliament. This section does not apply to—”
- **VERDICT:** _______

### M8.118 — Lord Greenhalgh (MNIS 4877), Conservative

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 48A at Committee stage, with 1 co-sponsor (Lord Hogan-Howe) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “Insert the following new Clause— “Review: extending restrictions to other services”
- **VERDICT:** _______

### M8.119 — Lord Balfe (MNIS 4302), Conservative

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 50 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “after first “on” insert “the day two years after””
- **VERDICT:** _______

### M8.120 — Lord Allan of Hallam (MNIS 397), Liberal Democrat

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 15 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “at end insert— Before making regulations under this section the Secretary of State must lay before each House of Parliament a statement outlining how the regulations are both necessary and proportionate.””
- **VERDICT:** _______

### M8.121 — Baroness Noakes (MNIS 2554), Conservative

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 17 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “After paragraph (b) insert— users of the services or others who are affected by the availability of the services,””
- **VERDICT:** _______

### M8.123 — Lord Hendy (MNIS 4723), Labour

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 18A at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17393/amendments>
- **In its own words:** “at end insert— Regulations may not prohibit or enable the prohibition of participation in, or any activity in connection with, a strike or other industrial action; or create an offence.””
- **VERDICT:** _______

### M8.124 — Lord Thomas of Cwmgiedd (MNIS 4309), Crossbench

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 6 at Report stage, with 3 co-sponsors (Baroness Randerson, Baroness Finlay of Llandaff, Lord Collins of Highbury) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17586/amendments>
- **In its own words:** “leave out from “Act” to end of line 11 and insert “of Parliament. This section does not apply to—”
- **VERDICT:** _______

### M8.125 — Baroness O'Grady of Upper Holloway (MNIS 4977), Labour

- **Proposed position on Employment rights and industrial action:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 4 at Report stage, with 2 co-sponsors (The Lord Bishop of London, Lord Fox) — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3396/stages/17586/amendments>
- **In its own words:** “at end insert— “234CA Protection of employees”
- **VERDICT:** _______

## M9 — Sewage, water quality and the Environment Act · UNSOUND

### M9.129 — Lord Teverson (MNIS 3789), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 2 at Committee stage, with 3 co-sponsors (Baroness Jones of Whitchurch, Baroness Jones of Moulsecoomb, Baroness Bennett of Manor Castle) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “Insert the following new Clause— “Purpose and declaration of biodiversity and climate emergency”
- **VERDICT:** _______

### M9.130 — The Duke of Wellington (MNIS 4541), Crossbench

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 4 at Committee stage, with 1 co-sponsor (Baroness Altmann) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert “, in particular water quality;””
- **VERDICT:** _______

### M9.132 — Baroness Bennett of Manor Castle (MNIS 4719), Green Party

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 7 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “leave out “resource efficiency” and insert “reduction in resource use””
- **VERDICT:** _______

### M9.128 — The Earl of Lindsay (MNIS 2059), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “Insert the following new Clause— “Environmental objectives”
- **VERDICT:** _______

### M9.131 — Lord Blencathra (MNIS 497), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 5 at Committee stage, with 1 co-sponsor (Lord Randall of Uxbridge) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “leave out paragraph (c) and insert— nature;””
- **VERDICT:** _______

### M9.133 — Baroness Scott of Needham Market (MNIS 2542), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 8 at Committee stage, with 3 co-sponsors (Baroness Quin, Baroness Bennett of Manor Castle, Lord Teverson) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— public access to and enjoyment of the natural environment.””
- **VERDICT:** _______

### M9.134 — Lord Lucas (MNIS 1879), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 9 at Committee stage, with 2 co-sponsors (Baroness Boycott, Lord Blencathra) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— connecting people with nature.””
- **VERDICT:** _______

### M9.135 — Lord Randall of Uxbridge (MNIS 209), Conservative

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 10 at Committee stage, with 3 co-sponsors (Lord Carrington, Baroness Bakewell of Hardington Mandeville, Lord Taylor of Holbeach) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— light pollution.””
- **VERDICT:** _______

### M9.136 — Lord Harries of Pentregarth (MNIS 3813), Crossbench

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 12 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— the planting of new trees.”
- **VERDICT:** _______

### M9.137 — Baroness Bakewell of Hardington Mandeville (MNIS 4285), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 13 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— a reduction in the use of conventional plastic packaging.”
- **VERDICT:** _______

### M9.138 — Lord Addington (MNIS 3453), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 19 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— Before making regulations under subsection (1)(b), the Secretary of State must consult—”
- **VERDICT:** _______

### M9.139 — Baroness Jones of Whitchurch (MNIS 3792), Labour

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 20 at Committee stage, with 3 co-sponsors (Baroness Walmsley, Baroness Finlay of Llandaff, Lord Randall of Uxbridge) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “leave out subsection (2) and insert— The PM2.5 air quality target must—”
- **VERDICT:** _______

### M9.140 — Lord Whitty (MNIS 2444), Labour

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 21 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “at end insert— The Secretary of State must by regulations stipulate the numbers of fixed or mobile devices to monitor the level of PM2.5 in ambient air to be operated by highways authorities or local authorities.””
- **VERDICT:** _______

### M9.141 — Lord Chidgey (MNIS 50), Liberal Democrat

- **Proposed position on Sewage, water quality and the Environment Act:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 23 at Committee stage — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/2593/stages/15298/amendments>
- **In its own words:** “After subsection (1) insert— In the range of species which contribute to the target, at least one must be a species that is significant to chalk streams and its abundance an indicator of the health of its ecosystem.””
- **VERDICT:** _______

## M10 — Retained EU law and the "sunset" clause · UNSOUND

### M10.144 — Brendan O'Hara (MNIS 4371), Scottish National Party

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 70 at Committee stage, with 1 co-sponsor (Peter Grant) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17082/amendments>
- **In its own words:** “Clause 16, page 18, line 25, at end insert— “(1A) Before the power in subsection (1) may be exercised, the relevant national authority must publish a written statement on any societal and economic changes relevant to the intended modifications.”…”
- **VERDICT:** _______

### M10.145 — Justin Madders (MNIS 4418), Labour

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 87 at Committee stage, with 4 co-sponsors (Alex Sobel, Stella Creasy, Paul Blomfield, Mary Glindon) — decision: NotCalled
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17082/amendments>
- **In its own words:** “Clause 16, page 18, line 27, at end insert— “(3) No regulations may be made under this section unless the conditions set out in section [Conditions on the exercise of powers under section 15 and 16] have been complied with.”…”
- **VERDICT:** _______

### M10.155 — Baroness Lawlor (MNIS 4965), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 122A at Committee stage — decision: WithdrawnBeforeDebate
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “[Withdrawn] Clause 15, page 19, line 27, leave out “23 June 2026” and insert “the end of 2024””
- **VERDICT:** _______

---

# DEFERRED — 107 rows, kept for a later pass

Not rejected and not deleted: these are the remaining rows of the same 157-row draft.
Score them when the priority set is done and a population-level accuracy figure is
wanted. Their VERDICT lines are left blank exactly as they were.

### M10.146 — Ms Nusrat Ghani (MNIS 4460), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 1 at Committee stage — decision: Agreed
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17082/amendments>
- **In its own words:** “Schedule 3, page 30, line 5, leave out paragraph 2 and insert— ““2 (1)Sub-paragraph (2) applies to a statutory instrument containing regulations under this Act which is subject to a procedure before Parliament for the approval of the instrument in draft before…”
- **VERDICT:** _______

### M10.147 — Baroness Randerson (MNIS 4230), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 117 at Committee stage, with 1 co-sponsor (Lord Bruce of Bennachie) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 18, line 38, at end insert— “(3A) Regulations under subsections (2) or (3) may not be made if they apply to an instrument, or a provision of an instrument, which is subject to an agreed Common Framework unless it has been subject to the full pr…”
- **VERDICT:** _______

### M10.148 — Baroness Humphreys (MNIS 4300), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 118 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 18, line 38, at end insert— “(3A) A Minister of the Crown may not make regulations under subsections (1) to (3) if any provision of those regulations is within the legislative competence of the Scottish Parliament, Senedd Cymru or the Northern …”
- **VERDICT:** _______

### M10.149 — Baroness Thornton (MNIS 1782), Labour

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 118A at Committee stage, with 1 co-sponsor (Baroness Crawley) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 18, line 38, at end insert— “(3A) A Minister of the Crown, whether acting alone or with another relevant national authority, may not exercise the power in subsection (2) or (3) unless—”
- **VERDICT:** _______

### M10.150 — Baroness Ritchie of Downpatrick (MNIS 4130), Labour

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 119 at Committee stage, with 2 co-sponsors (Baroness Suttie, Baroness Chapman of Darlington) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 16, at end insert— “(iii) effect substantial policy change so far as it relates to human rights, equality or environmental protection legislation with effect in Northern Ireland.””
- **VERDICT:** _______

### M10.151 — Lord Fox (MNIS 4322), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 120 at Committee stage, with 2 co-sponsors (Baroness Ludford, Baroness Chapman of Darlington) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 17, leave out subsection (5)”
- **VERDICT:** _______

### M10.152 — The Earl of Lindsay (MNIS 2059), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 121 at Committee stage, with 1 co-sponsor (Baroness Crawley) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 17, leave out subsections (5) and (6)”
- **VERDICT:** _______

### M10.153 — Lord Whitty (MNIS 2444), Labour

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 121A at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 17, leave out subsections (5) to (11)”
- **VERDICT:** _______

### M10.154 — Baroness McIntosh of Pickering (MNIS 384), Conservative

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 122 at Committee stage — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “Clause 15, page 19, line 27, leave out “23 June 2026” and insert “11:59 pm on 31 December 2028””
- **VERDICT:** _______

### M10.156 — Baroness Parminter (MNIS 4178), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 126 at Committee stage, with 3 co-sponsors (Lord Krebs, Lord Randall of Uxbridge, Baroness Bennett of Manor Castle) — decision: Withdrawn
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “After Clause 15, insert the following new Clause— “Powers to revoke or replace: application to environmental law”
- **VERDICT:** _______

### M10.157 — Baroness Ludford (MNIS 1867), Liberal Democrat

- **Proposed position on Retained EU law and the "sunset" clause:** PROPOSED — read the quote
- **Basis:** `amendment-sponsor`
- **Citation:** Lead sponsor of 128 at Committee stage, with 1 co-sponsor (Lord Fox) — decision: NotMoved
- **Source:** <https://bills.parliament.uk/bills/3340/stages/17339/amendments>
- **In its own words:** “After Clause 16, insert the following new Clause— “Conditions on the exercise of powers under sections 15 and 16”
- **VERDICT:** _______

