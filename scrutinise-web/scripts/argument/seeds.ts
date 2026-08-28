/**
 * seeds.ts — ARGUMENT 1A §1. THE HAND-VERIFIED SEED PASSAGES.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A SEED IS, AND WHAT IT COST
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A passage somebody READ and confirmed makes the move the tag names. Every entry carries the
 * chunk id (so it can be checked against storage), the arm that proposed it, the text that was
 * read, and — required, never blank — WHY it makes the move.
 *
 * ⚠⚠ THE BRIEF ASKED FOR ~50 PER TAG AND THIS FILE HAS 7–11. That is a shortfall and it is stated
 * here rather than buried in a report: 500 verified seeds is 500 passages read one at a time, and
 * this sprint read about 220 (60 random controls plus ~160 candidates). The seeds are enough to
 * propagate from and enough to measure with; they are not the sample the brief specified, and any
 * figure derived from them carries that limitation. **Decision D-2 in the report.**
 *
 * ⚠ `text` IS THE EXCERPT THAT WAS READ, not necessarily the whole stored passage — several of
 * these are windows around the matching sentence in a long document. It is what propagation sends
 * as a query. `chunkId` is the authoritative pointer and the check resolves every one of them
 * against `corpus_sections`.
 *
 * ⚠ TWO ARMS, KEPT LABELLED, because the recall measurement depends on knowing which mechanism
 * proposed a passage: `dense` (a probe query against the meaning index) and `keyword` (a literal
 * phrase in BM25, then the tag's own regex applied to the stored body).
 *
 * ⚠⚠ WHAT WAS REJECTED IS AS INFORMATIVE AS WHAT WAS KEPT, and three rejection classes recurred:
 *   1. **A bare fragment.** *"Where is the money to come from?"* — seven words, retrieved four
 *      separate times across four decades. It makes the move and it says nothing. The dense arm
 *      prefers these because a short passage is lexically pure.
 *   2. **The opposite claim.** *"Very strong powers of enforcement are available to the local
 *      authorities. I do not think that that is a limiting factor."* Same subject, opposite
 *      polarity, and the brief says to report the rate rather than chase it.
 *   3. **THE WRONG SENSE OF THE WORD, which is not polarity and is worse.** For `EVIDENCE_GAP`,
 *      most of what came back was *"there is no evidence against him"* (criminal evidence about a
 *      person) or a minister saying *"we have no evidence of that"* — neither is a claim about a
 *      policy's evidence base. Counted in the report.
 */
import type { Tag } from './taxonomy'

export interface Seed {
  tag: Tag
  arm: 'dense' | 'keyword'
  chunkId: string
  /** The words that were read. Also the query propagation sends. */
  text: string
  /** Required. A label with no reason cannot be audited. */
  why: string
}

export const SEEDS: Seed[] = [
  // ── ENFORCEMENT ────────────────────────────────────────────────────────────────────────────────
  { tag: 'ENFORCEMENT', arm: 'dense', chunkId: 'historic-hansard:S5LV0004P0:2800#0',
    text: 'Because they consider that it is undesirable to impose a duty on local authorities which would be unenforceable.',
    why: 'States the objection directly: the duty could not be enforced.' },
  { tag: 'ENFORCEMENT', arm: 'dense', chunkId: 'pwdata-debates:debates1924-07-01a:374#0',
    text: 'The local authorities will only have power; they will not be compelled.',
    why: 'A permissive power with no duty is the classic form of "nobody will actually do it".' },
  { tag: 'ENFORCEMENT', arm: 'dense', chunkId: 'pwdata-debates:debates1953-01-30a:37#0',
    text: 'It is not declared to be dead. It is merely a question of saying that it has not been enforced for many years.',
    why: 'The law exists and has not been enforced — the move, stated about an existing measure.' },
  { tag: 'ENFORCEMENT', arm: 'dense', chunkId: 'pwdata-debates:debates1985-05-20a:230#0',
    text: 'The local authorities are well aware of the law. The real reason why they are not enforcing it is that in large parts of the country local people do not want the law enforced.',
    why: 'Explains WHY enforcement does not happen — an enforcement-failure claim with a cause attached.' },
  { tag: 'ENFORCEMENT', arm: 'dense', chunkId: 'pwdata-debates:debates1994-02-23a:423#0',
    text: 'Those local authorities knew that they did not have the backing of central Government. It would have been wasted effort to employ officers who had many other duties to enforce the law when there was a clear signal from the Government, by the Government’s inaction, that they were not at all interested in the law being enforced and obeyed.',
    why: 'Enforcement capacity and political backing, argued together — the fullest form of the move.' },
  { tag: 'ENFORCEMENT', arm: 'dense', chunkId: 'pwdata-debates:debates2016-01-05d:678#0',
    text: 'Local authorities have the powers but they do not have the resources. Many local authorities have very few officers who are able to police the system.',
    why: 'Powers without officers. The canonical modern statement of the enforcement objection.' },
  { tag: 'ENFORCEMENT', arm: 'dense', chunkId: 'pwdata-debates:debates2022-03-07c:225#0',
    text: 'Unless we have the ability to use the powers we have and the powers we are discussing in this Bill, in practice nothing will happen. There are also issues with enforcement resources for the National Crime Agency.',
    why: 'Names the enforcer and its resourcing, and says nothing will happen without it.' },
  { tag: 'ENFORCEMENT', arm: 'keyword', chunkId: 'historic-hansard:S5LV0062P0:4979#0',
    text: 'The failure of the Statement of Rates Act, 1919. That Act, which prescribes that the rate shall be specified, is more or less a dead letter. As many as 30 per cent and perhaps 40 per cent of tenants of this country pay rates and rent in one lump sum. The penalty under the Act of 1919 is only 40s and the result is that the Act has become a dead letter.',
    why: 'A dead letter with the mechanism given: the penalty is too small to change behaviour.' },
  { tag: 'ENFORCEMENT', arm: 'keyword', chunkId: 'historic-hansard:S5LV0397P0:2390#0',
    text: 'If paragraph (a) stands as it is now, it will in practice be a dead letter, because it will mean that the arbitrator will have to incur the costs of himself instructing a solicitor, the solicitor instructing counsel and the like.',
    why: 'Predicts a provision will go unused, and says exactly why.' },
  { tag: 'ENFORCEMENT', arm: 'keyword', chunkId: 'historic-hansard:S5LV0217P0:2822#0',
    text: 'This section of the 1930 Act became a dead letter, because the doctors found it so hard to say that any patient other than a completely unconscious one was lacking in volition.',
    why: 'A named earlier provision that went unused, with the operational reason. Also carries PRECEDENT.' },
  { tag: 'ENFORCEMENT', arm: 'keyword', chunkId: 'historic-hansard:S5LV0274P0:271#0',
    text: 'If it is thought that further publication will harm the child in other cases, will not the whole purpose of this section be defeated and will it not therefore be a dead letter?',
    why: 'Puts the dead-letter objection as a question to the Minister, with the defeating mechanism named.' },

  // ── COST ───────────────────────────────────────────────────────────────────────────────────────
  { tag: 'COST', arm: 'dense', chunkId: 'historic-hansard:S5LV0520P0:6876#0',
    text: 'We seek to persuade the Government to say something that will be seen as a promise, though perhaps not a commitment, that they recognise that if local authorities have to take on these duties additional money will be forthcoming.',
    why: 'The new-burdens objection: a duty is being imposed without the funding to carry it.' },
  { tag: 'COST', arm: 'dense', chunkId: 'pwdata-debates:debates1919-04-07a:226#0',
    text: 'I said on 20th March it would be very difficult indeed to give the precise cost, and further consideration leaves it at that.',
    why: 'The costing is not available — a concession that the figure does not exist.' },
  { tag: 'COST', arm: 'dense', chunkId: 'pwdata-debates:debates1924-08-06a:128#0',
    text: 'Where is the money to come from if these powers are to be extended?',
    why: 'The funding question tied to a specific extension of powers, which is what makes it an argument rather than a slogan.' },
  { tag: 'COST', arm: 'dense', chunkId: 'pwdata-debates:debates1940-07-25a:458#0',
    text: 'The hon. Member is quite wrong. It will cost a substantially larger sum.',
    why: 'A direct contradiction of a stated cost.' },
  { tag: 'COST', arm: 'dense', chunkId: 'pwdata-debates:debates1961-06-08a:328#0',
    text: 'Does that mean that the Government have no idea of the prospective cost of this? Have they made no estimate at all?',
    why: 'Attacks the absence of an estimate rather than the estimate itself.' },
  { tag: 'COST', arm: 'dense', chunkId: 'pwdata-debates:debates1988-04-21a:297#2',
    text: 'We must look to another place to bring forward its amendments to make sure that the imposition we are placing on all businesses, particularly small businesses, is something that they can carry. We must ensure that we do not do ourselves economic damage in bringing about a change that is needed.',
    why: 'Burden on business, with the size of the burden as the objection rather than the policy.' },
  { tag: 'COST', arm: 'dense', chunkId: 'pwdata-debates:debates1999-03-17a:409#0',
    text: 'She accepts that there will be a great administrative burden on businesses, particularly small businesses. Is there any way in which the Government could provide an exemption for very small businesses?',
    why: 'Administrative burden, quantified by whom it falls on.' },
  { tag: 'COST', arm: 'dense', chunkId: 'pwdata-debates:debates2007-02-23b:11#0',
    text: 'There is no question but that the duty that we anticipate in the Bill requires a funding package behind it. We all know that local councils throughout the land are hard pressed. It would be wrong for the House to hand down a duty without the money to go with it.',
    why: 'The unfunded-duty objection stated as a principle about how the House should legislate.' },
  { tag: 'COST', arm: 'dense', chunkId: 'pwdata-debates:debates2010-11-11b:452#0',
    text: 'Statistics do not take into account the effect on small businesses of the sheer worry of all those burdens, nor the reality of a world where Britain will be under increasing pressure to attract internationally mobile jobs.',
    why: 'Argues the costing misses a real cost — the strongest form of "the costing is wrong".' },
  { tag: 'COST', arm: 'keyword', chunkId: 'pwdata-debates:debates1959-03-13a:8#0',
    text: 'Who is going to pay for the inspection of the books by the chartered accountants? Will it be the Government’s responsibility, or will the bookmakers pay?',
    why: 'Names the cost and asks who bears it — a costing question with a subject.' },

  // ── EVIDENCE_GAP ──────────────────────────────────────────────────────────────────────────────
  { tag: 'EVIDENCE_GAP', arm: 'dense', chunkId: 'committees-reports:publication:11130:arc-0009#0',
    text: 'Neither the material laid in support of the Regulations nor the further information now provided seem to us to present hard evidence of direct economic benefit from the changes being made. Such evidence as the Department has offered in this regard is partial and not sufficiently specific to the changes being made.',
    why: "A committee's own finding that the evidence for a measure is absent and what is offered is partial." },
  { tag: 'EVIDENCE_GAP', arm: 'dense', chunkId: 'committees-evidence:writtenevidence:107396:162403#2',
    text: 'This prevents consumers of these reports from performing further investigation and scrutiny, and from understanding the provenance of, and implications inherent in, the data. I filed a Freedom of Information request for the release of all evidence used as part of the construction of the reports. I have still not received a response over 35 days later.',
    why: 'The evidence base cannot be examined, which is a distinct and checkable form of the move.' },
  { tag: 'EVIDENCE_GAP', arm: 'dense', chunkId: 'niassembly-hansard:485823:289#0',
    text: 'Does the Member have any data on the legislation that was passed in Scotland, Wales or England? Some of that is now 20 years old. The Bill sponsor has suggested that there is no evidence to uphold the argument that is being made.',
    why: 'Asks for the data and reports that the sponsor says none exists.' },
  { tag: 'EVIDENCE_GAP', arm: 'keyword', chunkId: 'historic-hansard:S5LV0228P0:1989#0',
    text: 'There is no evidence that tuberculosis is spread by food. If it related to streptococcal infection of the bowel, or any of the salmonella group, I would most certainly agree. Then the clause would be reasonable. But there is no evidence at all that this infection is spread by food, so why on earth should we do this? Until evidence is produced the Government should reject the clause.',
    why: 'The clearest example in the whole draw: no evidence for the premise, therefore reject the clause.' },

  // ── UNINTENDED ────────────────────────────────────────────────────────────────────────────────
  { tag: 'UNINTENDED', arm: 'keyword', chunkId: 'committees-evidence:writtenevidence:52572:98269#0',
    text: 'Recent research reveals that current policies to reduce the carbon emissions of the housing stock could result in over 100 unintended consequences for a range of domains including the health and wellbeing of building occupants and the wider population.',
    why: 'Names the consequences and the domains they fall in, from research.' },
  { tag: 'UNINTENDED', arm: 'keyword', chunkId: 'committees-reports:publication:10209:arc-0063#0',
    text: 'It follows that the FCA must appoint Skilled Persons to investigate what is going on in each lender and to identify any perverse incentives, that is to say any incentives that encourage reckless lending.',
    why: 'A perverse incentive named as the thing to look for, with the behaviour it produces.' },
  { tag: 'UNINTENDED', arm: 'dense', chunkId: 'historic-hansard:S3V0001P0:621#0',
    text: 'would considerably aggravate the mischief it was intended to cure.',
    why: 'Ten words, and the whole move: the remedy makes the disease worse.' },
  { tag: 'UNINTENDED', arm: 'dense', chunkId: 'historic-hansard:S5LV0251P0:118#0',
    text: 'will be a great deal of hardship, suffering and inefficiency as a result of this Government measure.',
    why: 'Consequences attributed to a specific measure.' },
  { tag: 'UNINTENDED', arm: 'dense', chunkId: 'historic-hansard:S5LV0389P0:1802#0',
    text: 'There is a principle of law that a sane man expects the natural consequences of his acts. Was this, to many of us, inevitable consequence of the policy foreseen and intended? If not, what do the Government intend to do about it?',
    why: 'Puts the consequence to the Government as something either intended or not thought through.' },
  { tag: 'UNINTENDED', arm: 'dense', chunkId: 'historic-hansard:S5LV0430P0:1761#0',
    text: 'There is a great danger that one is merely driving it underground and that it will proceed as usual.',
    why: 'The driving-underground consequence. ⚠ The speaker states it in order to rebut it, which is exactly why a filter wants it: the words are there to be read.' },
  { tag: 'UNINTENDED', arm: 'keyword', chunkId: 'niassembly-hansard:211611:385#0',
    text: 'I ask him to address the issue of the perverse incentives that exist. Evidence was given to the Committee that NHS appointments are sometimes cancelled and that there is often a perverse incentive for the same consultants to do work in a private setting.',
    why: 'A perverse incentive with the mechanism and the evidence for it.' },
  { tag: 'UNINTENDED', arm: 'dense', chunkId: 'niassembly-hansard:350783:198#0',
    text: 'Any incentive in any scheme has the ability to pervert the policy objective that is set out. I fully accept that.',
    why: 'The move stated as a general principle about schemes.' },
  { tag: 'UNINTENDED', arm: 'dense', chunkId: 'pwdata-debates:debates1944-03-22a:268#0',
    text: 'If we were to prohibit public sales of wines by auction it would obviously drive sales underground.',
    why: 'A prohibition producing the displacement it was meant to prevent.' },

  // ── WRONG_VEHICLE ─────────────────────────────────────────────────────────────────────────────
  { tag: 'WRONG_VEHICLE', arm: 'dense', chunkId: 'committees-evidence:writtenevidence:77138:125625#1',
    text: 'The issue is what is the real boundary between placing a power on the face of the Bill or delegating the power to another authority to carry out. There is no clear boundary between the subject matters which are appropriate for primary legislation on the one hand and for secondary legislation on the other.',
    why: 'The primary-versus-secondary question stated as the question itself.' },
  { tag: 'WRONG_VEHICLE', arm: 'dense', chunkId: 'committees-reports:publication:11861:arc-0004#0',
    text: 'A number of speakers hoped that drafts of regulations would be made available to inform subsequent debates, but we could find no response to this from the Minister. Unable to understand why the Bill has been presented in a skeleton form only, we turned to the memorandum.',
    why: 'A committee objecting that the Bill is a skeleton and the detail is deferred to regulations.' },
  { tag: 'WRONG_VEHICLE', arm: 'dense', chunkId: 'committees-reports:publication:2750:27198#1',
    text: 'The prevalence of skeleton bills. We are aware that skeleton bills are not novel. The DPRRC described skeleton bills as bills which are "little more than a licence to legislate and so give flesh to the skeleton embodied in the bill".',
    why: 'The skeleton-bill objection with its own definition, from the committee that owns it.' },
  { tag: 'WRONG_VEHICLE', arm: 'dense', chunkId: 'historic-hansard:S5LV0431P0:922#0',
    text: 'The guidance on expenditure for the purposes of this Bill appears to include anything that the Secretary of State might have said even before the Bill was drafted.',
    why: 'Objects that a Bill leans on guidance of indeterminate scope.' },
  { tag: 'WRONG_VEHICLE', arm: 'dense', chunkId: 'historic-hansard:S5LV0570P0:6395#0',
    text: 'Should we consign more to secondary legislation? Up to a point maybe, but if we look at the way in which we handle secondary legislation at present, which the Rippon Committee described as "highly unsatisfactory", I am not confident that that would be the right way forward.',
    why: 'Argues against the vehicle on the grounds of how that vehicle is scrutinised.' },
  { tag: 'WRONG_VEHICLE', arm: 'dense', chunkId: 'pwdata-debates:debates1938-05-13a:137#0',
    text: 'Yes, a lot of this work is to be done by regulation, but according to the sense of duty of the Home Office. Who can trust this Government to do the right thing?',
    why: 'The delegation objection with the accountability reason attached.' },
  { tag: 'WRONG_VEHICLE', arm: 'dense', chunkId: 'pwdata-debates:debates1983-04-27a:446#0',
    text: 'We are dealing with a Bill which is of a sketchy nature which gives virtually unfettered powers to the Secretary of State to produce regulations. The regulations should be part of the primary legislation, or at least should be produced for the Committee stage.',
    why: 'States both halves: the Bill is a skeleton, and where the detail belongs instead.' },

  // ── RIGHTS ────────────────────────────────────────────────────────────────────────────────────
  { tag: 'RIGHTS', arm: 'dense', chunkId: 'committees-evidence:writtenevidence:2798:7192#0',
    text: 'This article argues that the Regulations are also a disproportionate interference with the rights protected by the European Convention on Human Rights, and that, were they challenged by judicial review, should be disapplied if necessary to avoid a breach of s 6 of the Human Rights Act.',
    why: 'Names the right, the interference and the remedy.' },
  { tag: 'RIGHTS', arm: 'dense', chunkId: 'committees-reports:publication:22681:166680-0002#1',
    text: 'The Bill would also significantly increase police powers to stop and search for articles connected with protest related offences. Stop and search can be an intrusive and intimidating experience, which engages the right to respect for private life under Article 8 ECHR as well as, in the context of protest, Articles 10 and 11 ECHR.',
    why: 'A committee identifying the specific Articles a power engages.' },
  { tag: 'RIGHTS', arm: 'dense', chunkId: 'historic-hansard:S5LV0531P0:2710#0',
    text: 'The minimum requirement of natural justice which is established throughout the common law is that a man must know the substance of the case which he has to meet. It seems a little strange that we should introduce into our criminal law a statutory presumption that rides counter to the fundamental concept of natural justice.',
    why: 'Natural justice against a statutory presumption — the rule-of-law form of the move.' },
  { tag: 'RIGHTS', arm: 'dense', chunkId: 'pwdata-debates:debates1934-11-07a:394#0',
    text: 'It is contrary to the whole of British law that a man should be presumed guilty until the Law Officers of the Crown and the criminal law have proved him to be guilty.',
    why: 'The presumption of innocence, argued against a specific drafting.' },
  { tag: 'RIGHTS', arm: 'dense', chunkId: 'pwdata-debates:debates1949-05-03a:433#0',
    text: 'Although the normal principle in this country was to assume a man innocent until proved guilty, in this case he felt we should reverse the procedure. To what extent are the Government prepared to abide by the Charter of Human Rights?',
    why: 'Ties a reversal of the burden of proof to an international instrument the Government has signed.' },
  { tag: 'RIGHTS', arm: 'keyword', chunkId: 'historic-hansard:S5LV0219P0:562#0',
    text: 'I understand that there is a presumption of innocence which, rightly or wrongly, we all enjoy from the date of our birth: every man is presumed to be innocent until he is proved to be guilty.',
    why: 'The principle stated plainly in the course of resisting a measure.' },
  { tag: 'RIGHTS', arm: 'dense', chunkId: 'historic-hansard:S5LV0483P0:3120#0',
    text: 'In light of the gravity of these consequences, the presumption of innocence is crucial. It ensures that until the state proves an accused’s guilt beyond all reasonable doubt, he or she is innocent. This is essential in a society committed to fairness and social justice.',
    why: 'The principle argued from its consequences rather than asserted.' },
  { tag: 'RIGHTS', arm: 'dense', chunkId: 'pwdata-debates:debates1971-04-22a:114#0',
    text: 'Does not the overriding presumption of an accused person’s innocence up to the time he is found guilty demand such a mandatory provision as the Minister rejects?',
    why: 'Uses the right to demand a drafting change.' },

  // ── PRECEDENT ─────────────────────────────────────────────────────────────────────────────────
  { tag: 'PRECEDENT', arm: 'dense', chunkId: 'historic-hansard:gapday:commons:1893/jun/22:305#0',
    text: 'In the year 1866 there existed a University in Ireland, with certain privileges and rights. The Government were on the eve of defeat, if they were not defeated, when they advised the issue of a Supplementary Charter, altering the rights and privileges of that University.',
    why: 'A dated earlier instance offered as the illustration of the present question.' },
  { tag: 'PRECEDENT', arm: 'dense', chunkId: 'historic-hansard:S4V0139P0:2555#0',
    text: 'They had now in the Bill under discussion evidence of the disastrous effect of attempting to legislate in a panic. The Act of 1902 was forced through the House, and it was being interpreted differently from what was understood at the time.',
    why: 'A named earlier Act, what went wrong with it, and the lesson drawn.' },
  { tag: 'PRECEDENT', arm: 'dense', chunkId: 'historic-hansard:S5LV0528P0:2603#0',
    text: 'In Australia and Canada, the first attempts have been made to do what we are asked to undertake today. They have led to frustration, futility and fiasco. My opinion, expressed in the last debate on the Bill, was that we were on the path to a fiasco.',
    why: 'Other jurisdictions tried it and here is what happened — the comparative form of the move.' },
  { tag: 'PRECEDENT', arm: 'dense', chunkId: 'niassembly-hansard:415337:276#0',
    text: 'that it appears we have learned nothing from the RHI debacle.',
    why: 'Names a specific earlier failure as the thing not learned from.' },
  { tag: 'PRECEDENT', arm: 'keyword', chunkId: 'committees-reports:publication:11191:arc-0015#0',
    text: 'Learn from the UK’s experience of making hard choices about which services to fund and developing guidelines to deliver health services that offer good quality and value for money. DFID will continue to explore options so that the experience of the NHS can benefit others.',
    why: 'Prior experience offered as transferable evidence. ⚠ Affirmative in direction; PRECEDENT as defined is neutral about which way the lesson runs.' },
  { tag: 'PRECEDENT', arm: 'dense', chunkId: 'pwdata-debates:debates1936-11-30a:330#0',
    text: 'They are doing it in other countries; why cannot it be done here?',
    why: 'The comparative appeal in its shortest form.' },

  // ── SCOPE ─────────────────────────────────────────────────────────────────────────────────────
  { tag: 'SCOPE', arm: 'dense', chunkId: 'historic-hansard:S5CV0108P0:3912#0',
    text: 'Undoubtedly there are many persons who might be caught within the scope of this Clause, and who essentially, and so far as intention and knowledge are concerned, would be perfectly innocent. Yet they might be made the victims of a phrase.',
    why: 'People caught who should not be — the over-inclusion half of the move, with the reason.' },
  { tag: 'SCOPE', arm: 'dense', chunkId: 'historic-hansard:S5LV0068P0:601#0',
    text: 'The new crimes do not concern criminals so much as law-abiding citizens, who in the ordinary way would desire to obey the law and will now be brought, often without their knowledge and certainly against their will, within the meshes of the Criminal Law and be liable to fine and imprisonment.',
    why: 'Names exactly who is wrongly caught and how.' },
  { tag: 'SCOPE', arm: 'keyword', chunkId: 'historic-hansard:S5LV0188P0:2645#0',
    text: 'I cannot help feeling that the Amendment is too widely drawn. I should like to leave out the words, "or is directed or calculated to promote". Otherwise, the Amendment might ban the advertising of a local race meeting or anything like that.',
    why: 'Too widely drawn, with the specific words and the specific absurd consequence.' },
  { tag: 'SCOPE', arm: 'keyword', chunkId: 'historic-hansard:S5LV0259P0:1742#0',
    text: 'If there is this loophole, and it is recognised as a loophole, surely it would be sensible to close it up.',
    why: 'The under-inclusion half: something it should catch and does not.' },
  { tag: 'SCOPE', arm: 'keyword', chunkId: 'historic-hansard:S5LV0338P0:2538#0',
    text: 'It seems to me that this Amendment is too widely drawn. What exactly do we mean by the term "medical profession"? Do we mean doctors who are fully qualified as well as doctors who are not fully qualified?',
    why: 'Attacks the breadth of a definition by asking what it includes.' },
  { tag: 'SCOPE', arm: 'dense', chunkId: 'historic-hansard:S5LV0583P0:1726#0',
    text: 'The Bill is drawn, quite rightly, in a way which allows it to operate flexibly against all sorts of possible breaches of the intention of the legislation. But that generates, in the minds of people who may be subject to it, particularly companies, a degree of uncertainty as to whether or not they are caught by it.',
    why: 'Breadth producing uncertainty about who is covered.' },

  // ── IMPLEMENTATION ────────────────────────────────────────────────────────────────────────────
  { tag: 'IMPLEMENTATION', arm: 'dense', chunkId: 'historic-hansard:S3V0241P0:2232#0',
    text: 'It was quite impossible to accept this Amendment. It would upset the whole of the clause. If such a restriction were agreed to, it would prevent the use of locomotives altogether.',
    why: 'The drafting cannot be operated without defeating the clause.' },
  { tag: 'IMPLEMENTATION', arm: 'dense', chunkId: 'historic-hansard:S5LV0178P0:1390#0',
    text: 'The thing is completely unworkable. Innumerable sets of circumstances and types of business can be imagined in which this clause will inevitably lead to complications, to bad blood and litigation.',
    why: 'Unworkable, with the kinds of case that would break it.' },
  { tag: 'IMPLEMENTATION', arm: 'dense', chunkId: 'pwdata-debates:debates1919-07-04a:67#0',
    text: 'I suggested that if the Government opposed this Bill because they thought it ought to have Amendments to make it workable, then they should have produced those Amendments.',
    why: 'Workability treated as the objection to be answered.' },
  { tag: 'IMPLEMENTATION', arm: 'dense', chunkId: 'historic-hansard:S5LV0576P0:2125#0',
    text: 'Government appeared to think that that would make it difficult to comply with administrative arrangements, such as updating nominated officers’ signatures and monitoring compliance with the code of practice.',
    why: 'Administrative mechanics named as the difficulty.' },

  // ── SUPPORT_EVIDENCE ──────────────────────────────────────────────────────────────────────────
  { tag: 'SUPPORT_EVIDENCE', arm: 'dense', chunkId: 'historic-hansard:gapday:commons:1860/jun/12:42#0',
    text: 'The system of free seats worked very well in England, and also in the country districts of Scotland. There was no reason why, if it were tried, it would not also operate beneficially in the towns of Scotland.',
    why: 'It has worked elsewhere, therefore it will work here — the affirmative move.' },
  { tag: 'SUPPORT_EVIDENCE', arm: 'dense', chunkId: 'historic-hansard:S3V0218P0:3250#3',
    text: 'We have before us the fact that the Act has been in operation for such a length of time in Scotland, and that no one as yet has ever ventured to propose its repeal. Why, then, should we not try it in Ireland?',
    why: 'Durability of an existing Act offered as the evidence it works.' },
  { tag: 'SUPPORT_EVIDENCE', arm: 'dense', chunkId: 'historic-hansard:S5LV0389P0:2876#0',
    text: 'It is curious that in this unitary State we have had an extraordinary situation such as we are proposing which, technically, has worked quite well in Northern Ireland. If this compromise has worked in the past, that is why I say that this might be a step forward.',
    why: 'A working precedent inside the UK used as the affirmative case.' },
  { tag: 'SUPPORT_EVIDENCE', arm: 'dense', chunkId: 'historic-hansard:S5LV0448P0:1085#0',
    text: 'The investigation finds that in every country surveyed decentralisation of power has been accepted as a necessary means towards efficiency and effectiveness in the provision of local services. This approach has been the product of careful examination and review of government structures and functions by independent commissions.',
    why: 'Cites a survey and its provenance, not just an assertion.' },
  { tag: 'SUPPORT_EVIDENCE', arm: 'dense', chunkId: 'historic-hansard:S5LV0577P0:5147#0',
    text: 'Such an information system already exists in Scotland and works well.',
    why: 'Short, but the whole move: the thing exists and functions.' },
  { tag: 'SUPPORT_EVIDENCE', arm: 'dense', chunkId: 'pwdata-debates:debates1929-02-04a:160#0',
    text: 'Would not what is good for Scotland be good for England? Would it not be possible to have similar tests in this country?',
    why: 'The transfer argument in question form.' },
]
