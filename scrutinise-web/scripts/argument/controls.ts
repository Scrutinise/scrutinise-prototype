/**
 * controls.ts — ARGUMENT 1A §1. THE RANDOM CONTROL SAMPLE, LABELLED BY HAND.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE IS THE MOST IMPORTANT ONE IN THE SPRINT
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The brief: *"'This paragraph makes no argument' must be an easy, unpunished answer, and a large
 * share of any honest sample will be exactly that. Assert it: if fewer than a third of a random
 * control sample come back untagged, the labelling is over-eager and must be re-run."*
 *
 * That is a check on the LABELLER, not on the code, and it is the only thing standing between this
 * sprint and the position graph's failure mode — a system that produced an answer because being
 * asked a question feels like being asked to answer.
 *
 * ⚠ THESE PASSAGES WERE DRAWN `ORDER BY md5(id)` WITH NO PROBE ANYWHERE NEAR THEM. They are not
 * candidates that failed; they are what the parliamentary corpus looks like when you reach into it
 * at random. Sixty were read, one by one, from `docs/census/argument-1a-candidates.json`.
 *
 * ⚠ `tags: []` IS THE COMMON ANSWER AND IS NOT A FAILURE. Most of what Parliament says is a
 * question, an undertaking to write to a colleague, a point of order, a ministerial progress
 * report, or the text of an amendment. None of those makes one of the ten moves.
 *
 * ⚠ WHERE I HESITATED, I RECORDED IT AND THEN CHOSE THE STRICTER READING. Entry 15 (Stanley Orme
 * on NHS funding) was tagged COST in a first pass and is UNTAGGED here: `COST` is *"this will cost
 * more than claimed, or the costing is wrong"*, an argument about a proposal's costing, and Orme is
 * attacking a government's record on funding. Adjacent is not the same, and a tag that drifts to
 * "adjacent" is how a taxonomy stops meaning anything.
 */
import type { Tag } from './taxonomy'

export interface ControlLabel {
  chunkId: string
  /** Empty = makes no argument of any of the ten kinds. The expected answer, most of the time. */
  tags: Tag[]
  /** Always present. A label with no reason cannot be audited. */
  note: string
}

export const CONTROL_LABELS: ControlLabel[] = [
  { chunkId: 'pwdata-debates:debates1940-06-26a:166#0', tags: [], note: 'A question proposing a trust-fund mechanism. Asks, does not argue.' },
  { chunkId: 'pwdata-westminster:westminster2021-12-14c:84#0', tags: [], note: 'Chair announcement and a list of relevant documents.' },
  { chunkId: 'committees-evidence:writtenevidence:2832:10036#0', tags: ['SCOPE'], note: 'Self-employed support scheme will count her maternity leave against her — the scheme misses someone it should reach.' },
  { chunkId: 'pwdata-lords:daylord2024-12-10b:54#0', tags: ['SCOPE'], note: 'Asks that legislation cover 3D-printed COMPONENTS and blank-firing conversions, not only printed firearms — it misses what it should catch.' },
  { chunkId: 'pwdata-debates:debates1962-04-11a:321#0', tags: [], note: 'Point of order about the courtesy of staying to hear the debate.' },
  { chunkId: 'pwdata-debates:debates2004-12-21a:40#0', tags: ['UNINTENDED'], note: 'A ports go-ahead would put 3 million more heavy units on the M25 — a consequence argument against the decision.' },
  { chunkId: 'pwdata-debates:debates1994-02-02a:86#0', tags: [], note: "Factual answer about Peru's constitution and an assurance." },
  { chunkId: 'historic-hansard:S5LV0241P0:2720#0', tags: [], note: 'Argues the public will not BELIEVE consultation happens. A perception point; none of the ten moves.' },
  { chunkId: 'pwdata-debates:debates2008-05-07b:16#0', tags: [], note: 'Undertaking to look into a point and write.' },
  { chunkId: 'pwdata-debates:debates1949-02-21a:29#0', tags: [], note: 'A concession that a scheme freezes distribution, immediately qualified. Not an objection.' },
  { chunkId: 'historic-hansard:S5LV0274P0:929#0', tags: ['EVIDENCE_GAP'], note: 'Robbins could not make reliable estimates; the Chancellor admitted none of the productivity statistics was reliable.' },
  { chunkId: 'pwdata-debates:debates1952-06-20a:43#0', tags: [], note: 'Complaint that committees have given no advice after an accident. Administrative inaction, not a measure being unenforceable.' },
  { chunkId: 'historic-hansard:S3V0330P0:1123#0', tags: [], note: 'The text of a proposed amendment.' },
  { chunkId: 'historic-hansard:S5LV0488P0:1855#0', tags: ['COST'], note: 'Costs far exceeding the likely award described as a scandalous feature of the administration of justice.' },
  { chunkId: 'pwdata-debates:debates1988-01-19a:231#0', tags: [], note: '⚠ Tagged COST in a first pass and reversed. Attacks a government record on funding; COST is about a proposal being mis-costed. Adjacent is not the same.' },
  { chunkId: 'pwdata-lords:daylord2006-12-13d:14#0', tags: [], note: 'Constitutional propriety of disclosure to a foreign legislature. Not a right, a convention or the rule of law as the tag means it.' },
  { chunkId: 'pwdata-lords:daylord2012-03-06a:61#0', tags: ['EVIDENCE_GAP'], note: 'Asks what evidence the Government has that a duty to co-operate will do better than what it replaced.' },
  { chunkId: 'pwdata-debates:debates2021-06-23b:311#0', tags: ['SCOPE'], note: 'Immigration exemption removed on discharge — the rule stops covering people it should cover.' },
  { chunkId: 'pwdata-debates:debates2023-12-05b:26#0', tags: ['SUPPORT_EVIDENCE'], note: 'Affirmative case with figures: delayed discharges down 13%, ~2,000 beds freed daily.' },
  { chunkId: 'historic-hansard:S3V0283P0:5388#0', tags: [], note: "Deference to the draftsman's wording." },
  { chunkId: 'pwdata-debates:debates1952-06-20a:37#0', tags: [], note: 'A party point, then agreement on prioritising road improvement.' },
  { chunkId: 'pwdata-debates:debates1925-07-27a:148#0', tags: [], note: 'A question about museum attendance and the condition of exhibits.' },
  { chunkId: 'scottish-parliament-or:12761:115#0', tags: [], note: 'Division procedure and a technical break.' },
  { chunkId: 'pwdata-debates:debates1997-03-11a:22#0', tags: [], note: 'Announcement of reservist recruitment.' },
  { chunkId: 'pwdata-debates:debates1976-11-01a:307#0', tags: [], note: 'How amendments are to be moved. Procedure.' },
  { chunkId: 'historic-hansard:S5LV0289P0:2197#0', tags: [], note: 'An undertaking to study an amendment before Report.' },
  { chunkId: 'pwdata-debates:debates1987-12-04a:18#0', tags: [], note: 'Hope for a Cyprus conference. Diplomacy, not a move.' },
  { chunkId: 'historic-hansard:S3V0329P0:738#0', tags: ['IMPLEMENTATION'], note: 'The civil remedy for libel is often worse than worthless in practice — the libeller is impecunious and the injured man only takes on costs.' },
  { chunkId: 'pwdata-debates:debates1990-05-09a:235#0', tags: [], note: 'Introduces government amendments and defers to a later speech.' },
  { chunkId: 'scottish-parliament-or:15685:134#0', tags: ['PRECEDENT'], note: 'Similar reports were written in Scotland almost ten years ago; asks whether their actions will be revisited.' },
  { chunkId: 'historic-hansard:S5LV0364P0:4203#0', tags: ['SCOPE'], note: 'Cannot see why horticultural holdings should not get the same treatment as agricultural ones — it misses what it should cover.' },
  { chunkId: 'historic-hansard:S3V0225P0:3135#0', tags: ['PRECEDENT', 'COST'], note: 'The Act of 1873 failed to achieve its object, and the cost of enforcing it precluded poor labourers from using it.' },
  { chunkId: 'scottish-parliament-or:16426:29#0', tags: [], note: 'A procedural proposal about sitting as two committees. A suggestion, not an objection.' },
  { chunkId: 'pwdata-westminster:westminster2013-09-10a:20#0', tags: ['EVIDENCE_GAP'], note: 'Argues the renaming of global warming concedes the previous hypothesis was wrong.' },
  { chunkId: 'pwdata-debates:debates1996-07-24a:176#0', tags: [], note: 'Agreement with an inspector and a statement of intent.' },
  { chunkId: 'historic-hansard:S3V0192P0:4302#0', tags: ['UNINTENDED'], note: 'Members should not feel their re-election depends on colleagues\' goodwill or a Secretary of State\'s caprice — a perverse incentive in the design.' },
  { chunkId: 'pwdata-debates:debates1999-05-26a:403#0', tags: [], note: 'The text of a committee-powers motion.' },
  { chunkId: 'pwdata-debates:debates2002-07-18:305#0', tags: [], note: "Attacks the Prime Minister's utterances, then states a general opposition role." },
  { chunkId: 'historic-hansard:S5LV0437P0:4207#0', tags: [], note: 'Explains what an enabling clause requires. Description.' },
  { chunkId: 'pwdata-debates:debates1951-03-15a:57#0', tags: [], note: 'A written question about charging visitors for the NHS.' },
  { chunkId: 'pwdata-debates:debates1970-10-29a:325#0', tags: [], note: 'A request for a debate.' },
  { chunkId: 'pwdata-debates:debates2011-03-17c:175#0', tags: [], note: 'Undertaking to make inquiries about correspondence.' },
  { chunkId: 'pwdata-debates:debates2026-06-16e:61#0', tags: [], note: 'Describes work with partners on disinformation networks.' },
  { chunkId: 'historic-hansard:S5CV0053P0:5549#0', tags: ['COST'], note: '£3,700 for a legation house called an extraordinarily large sum for the smallest capital in Europe.' },
  { chunkId: 'pwdata-debates:debates2007-02-20b:212#0', tags: [], note: 'Third Reading speech describing a paving Bill as narrow. Procedural framing.' },
  { chunkId: 'pwdata-debates:debates2020-01-07b:279#0', tags: [], note: 'A prediction that services negotiations will be harder than goods. Not one of the ten moves.' },
  { chunkId: 'pwdata-debates:debates1961-02-02a:438#0', tags: [], note: 'Clarification about a forthcoming visit.' },
  { chunkId: 'scottish-parliament-or:16130:219#0', tags: ['COST'], note: 'Presses whether a commitment is cost neutral and what the range of costs is — a direct challenge to the costing.' },
  { chunkId: 'pwdata-debates:debates2007-07-09b:266#0', tags: ['UNINTENDED'], note: "The CAP's effect on the British people and the rest of the world called a disgrace — a consequences argument. ⚠ Borderline: partly a critique of a record." },
  { chunkId: 'historic-hansard:S5LV0432P0:3853#0', tags: [], note: 'Argues an amendment is unnecessary because people turn up when it matters. Closest to none of the ten.' },
  { chunkId: 'pwdata-debates:debates2020-11-02c:72#0', tags: [], note: 'Describes falling charitable giving and rising demand, and offers a meeting.' },
  { chunkId: 'pwdata-debates:debates1979-03-20a:435#0', tags: ['RIGHTS'], note: 'Even peaceful picketing outside a court seeks to persuade witnesses to fail a legal duty — an administration-of-justice objection.' },
  { chunkId: 'historic-hansard:S5LV0330P0:224#0', tags: [], note: 'Ties a question to monetary reform and expresses confidence in agreement.' },
  { chunkId: 'pwdata-debates:debates1994-12-13a:184#0', tags: [], note: 'Rebuts an insinuation and asks the member to say plainly what he means.' },
  { chunkId: 'pwdata-debates:debates1999-05-06a:243#0', tags: [], note: 'A question about concern in London at the time of the general election.' },
  { chunkId: 'scottish-parliament-or:arch-513:50#0', tags: ['UNINTENDED'], note: 'Organisations may become so concerned with protecting their own interests that they forget to protect children — a perverse incentive.' },
  { chunkId: 'pwdata-debates:debates2001-03-06a:295#0', tags: [], note: 'Objects to a programme motion being moved formally. A House-procedure objection, not one of the ten.' },
  { chunkId: 'historic-hansard:S3V0356P0:3987#0', tags: [], note: 'Explains why a clause is needed for a future contingency.' },
  { chunkId: 'scottish-parliament-or:11633:27#0', tags: [], note: 'Asks which legislative framework covers Scottish direct payments. A question about vehicles, not the WRONG_VEHICLE move.' },
  { chunkId: 'scottish-parliament-or:16342:15#0', tags: [], note: 'Time pressure as a barrier to committee effectiveness; invites witnesses to expand.' },
]
