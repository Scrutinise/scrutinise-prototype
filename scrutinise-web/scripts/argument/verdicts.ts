/**
 * verdicts.ts — ARGUMENT 1A §4. SIXTY TAGGED PASSAGES, READ ONE AT A TIME.
 *
 * ⚠ DRAWN FROM WHAT PROPAGATION PRODUCED (`argument_tag`), `ORDER BY md5(chunk_id)` within each
 * (tag, method) — not the top-scoring rows, and not the pool the seeds came from. The brief asks
 * for 50; sixty were read.
 *
 * ⚠⚠ TWO ANSWERS PER PASSAGE, NEVER ONE:
 *   `tagRight`       — does the passage make the move THIS tag names?
 *   `shouldBeTagged` — does it make any of the ten moves at all?
 * The position work established that the second is where a system fails, so an average of the two
 * would hide the failure mode. They are reported apart and the conditional is reported as a third.
 *
 * ⚠ `polarity: 'opposite'` — right subject, opposite claim. *"A large majority of local authorities
 * are carrying out the law as it should be carried out"* is an ENFORCEMENT sentence asserting the
 * reverse of the ENFORCEMENT move. The brief says to count the rate and not chase it.
 *
 * ⚠⚠ ENTRIES 9 AND 10 ARE THE SAME PASSAGE, AND THAT IS A DEFECT THIS FILE FOUND. `argument_tag`'s
 * unique key is (chunk_id, tag, method, evidence), so the same passage re-retrieved by a DIFFERENT
 * seed on a later run is stored twice. The natural key is (chunk_id, tag, method) with evidence as
 * an attribute. Reported, not silently deduplicated — the duplicate is a real row that a consumer
 * would have counted twice.
 */
import type { Tag } from './taxonomy'

export interface Verdict {
  chunkId: string
  tag: Tag
  method: string
  tagRight: boolean
  shouldBeTagged: boolean
  polarity?: 'same' | 'opposite' | 'neutral'
  /** Required. A verdict without a reason cannot be audited. */
  note: string
}

export const VERDICTS: Verdict[] = [
  { chunkId: 'pwdata-debates:debates1975-03-13a:305#0', tag: 'COST', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Cumulative burden of regulation and taxation on small businesses, itemised.' },
  { chunkId: 'pwdata-debates:debates2016-10-20a:437#0', tag: 'COST', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Regime uncertainty causing businesses to make less profit — a burden claim.' },
  { chunkId: 'pwdata-debates:debates1961-02-15a:851#0', tag: 'COST', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"We have no idea what the expense is" — attacks the absence of a costing.' },
  { chunkId: 'pwdata-lords:daylord2021-07-20b:37#0', tag: 'COST', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Minister invoking undue burdens on small businesses as the thing to avoid.' },
  { chunkId: 'scottish-parliament-or:16630:153#0', tag: 'COST', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '£200m against £5m for comparable inquiries — a costing challenge with figures.' },
  { chunkId: 'pwdata-debates:debates1978-04-26a:422#0', tag: 'COST', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Whether partnership cities receive hard cash, loans or grants — a funding-source objection.' },
  { chunkId: 'historic-hansard:S5LV0515P0:2276#0', tag: 'ENFORCEMENT', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, polarity: 'neutral', note: 'Solicitor on the record in litigation. A drafting-practicality point, not enforcement.' },
  { chunkId: 'historic-hansard:S5LV0408P0:3493#0', tag: 'ENFORCEMENT', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"Enforcement is very hard. Local authorities can do more" — dog fouling, 1980.' },
  { chunkId: 'pwdata-debates:debates1971-11-18a:320#0', tag: 'ENFORCEMENT', method: 'prototype:v1', tagRight: false, shouldBeTagged: true, polarity: 'opposite', note: '"A large majority of local authorities are carrying out the law as it should be" — the ENFORCEMENT subject, the opposite claim.' },
  { chunkId: 'pwdata-debates:debates1971-11-18a:320#0*dup', tag: 'ENFORCEMENT', method: 'prototype:v1', tagRight: false, shouldBeTagged: true, polarity: 'opposite', note: '⚠ THE SAME PASSAGE AGAIN, stored twice because `evidence` is in the unique key and a later run retrieved it from a different seed. The duplicate is the finding; the verdict is unchanged.' },
  { chunkId: 'pwdata-debates:debates1982-03-31a:103#0', tag: 'ENFORCEMENT', method: 'pattern:v1', tagRight: false, shouldBeTagged: false, note: '"Is the zero option still on the table or is it a dead letter?" — arms-control negotiation. A WORD-SENSE failure of "dead letter".' },
  { chunkId: 'historic-hansard:S5LV0213P0:506#0', tag: 'ENFORCEMENT', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"If this Bill is not going to be a dead letter… we must have some form of special constable or deer bailiff." Textbook.' },
  { chunkId: 'pwdata-debates:debates1941-06-17a:290#0', tag: 'UNINTENDED', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Failing to deal with the practice will encourage it into a larger problem.' },
  { chunkId: 'pwdata-debates:debates1988-11-01a:432#0', tag: 'UNINTENDED', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'A 21-word fragment beginning mid-sentence. No move of any kind.' },
  { chunkId: 'pwdata-debates:debates1946-07-17a:221#0', tag: 'UNINTENDED', method: 'prototype:v1', tagRight: false, shouldBeTagged: true, polarity: 'opposite', note: '"I should not think that hardship will arise" — a consequence claim, denied.' },
  { chunkId: 'pwdata-debates:debates1978-01-10a:88#0', tag: 'UNINTENDED', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'Asks the Minister to resist a change to consultants\' incentive payments. A request, not a consequence argument.' },
  { chunkId: 'pwdata-debates:debates2025-10-13b:362#0', tag: 'UNINTENDED', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"The Government have now set a perverse incentive for British officials." Exact.' },
  { chunkId: 'scottish-parliament-or:15948:101#0', tag: 'UNINTENDED', method: 'pattern:v1', tagRight: false, shouldBeTagged: false, note: '"The unintended consequences can be ironed out in the bill" — uses the phrase, names no consequence. A phrase-mention, not a move.' },
  { chunkId: 'scottish-parliament-or:12357:119#0', tag: 'EVIDENCE_GAP', method: 'prototype:v1', tagRight: false, shouldBeTagged: true, polarity: 'opposite', note: '"There is evidence. The Improvement Service has published a report." The reverse move — SUPPORT_EVIDENCE, not EVIDENCE_GAP.' },
  { chunkId: 'pwdata-debates:debates1922-12-11a:404#0', tag: 'EVIDENCE_GAP', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Disputes the evidential premise of an amendment on tuberculosis in cattle, on technical advice.' },
  { chunkId: 'pwdata-debates:debates1934-06-25a:300#0', tag: 'EVIDENCE_GAP', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'Tells a member not to base his argument on clean or unclean milk. Debating housekeeping.' },
  { chunkId: 'pwdata-debates:debates2001-04-05a:378#0', tag: 'EVIDENCE_GAP', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'About whether earlier regulations may be cited as examples. Procedure, not evidence base.' },
  { chunkId: 'scottish-parliament-or:16663:32#0', tag: 'EVIDENCE_GAP', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"There is no evidence that a higher offence would be a deterrent." Exactly the move.' },
  { chunkId: 'historic-hansard:S5LV0525P0:2723#0', tag: 'EVIDENCE_GAP', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"What is the evidence for that statement? There is no evidence for it." With a counter-explanation.' },
  { chunkId: 'historic-hansard:S5LV0515P0:5373#2', tag: 'WRONG_VEHICLE', method: 'prototype:v1', tagRight: false, shouldBeTagged: true, polarity: 'opposite', note: 'The Lord Advocate characterising the delegated-legislation complaint in order to answer it.' },
  { chunkId: 'pwdata-debates:debates1934-03-26a:387#0', tag: 'WRONG_VEHICLE', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'A Deputy-Chairman ruling on what may be argued. Procedure.' },
  { chunkId: 'pwdata-lords:daylord2000-11-20a:205#0', tag: 'WRONG_VEHICLE', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"Is he not advocating something of a Henry VIII power here?" Names the vehicle objection.' },
  { chunkId: 'historic-hansard:S5LV0498P0:5514#0', tag: 'WRONG_VEHICLE', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"Skeletal legislation with even more than usual provision for everything to be done by regulation… this Bill is positively amoeboid."' },
  { chunkId: 'historic-hansard:S5LV0588P0:1527#0', tag: 'WRONG_VEHICLE', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Contrasts 54 clauses of detail in an earlier Act with four clauses and a consultation document.' },
  { chunkId: 'historic-hansard:S5LV0590P0:4642#0', tag: 'WRONG_VEHICLE', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'What is and is not provided on the face of the Bill about consulting pupils.' },
  { chunkId: 'pwdata-debates:debates2008-02-07c:60#0', tag: 'RIGHTS', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, polarity: 'neutral', note: 'A Solicitor-General describing the bail and presumption rules. Description, not objection.' },
  { chunkId: 'pwdata-lords:daylord2022-11-22a:211#0', tag: 'RIGHTS', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Opposes stop-and-search clauses on the intrusion to a totally innocent member of the public.' },
  { chunkId: 'pwdata-debates:debates1960-01-28a:63#0', tag: 'RIGHTS', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"Does not this system cut across the right of the subject to be presumed innocent?"' },
  { chunkId: 'pwdata-debates:debates1969-03-21a:25#0', tag: 'RIGHTS', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"We cannot have a situation in this country in which the basic principle of English law… is breached."' },
  { chunkId: 'pwdata-lords:daylord2000-01-27a:128#0', tag: 'RIGHTS', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Balancing effective remedies against the integrity of criminal proceedings and the presumption.' },
  { chunkId: 'pwdata-lords:daylord2007-11-21b:17#0', tag: 'RIGHTS', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'A reservation described as incompatible with the object and purpose of the convention.' },
  { chunkId: 'scottish-parliament-or:10891:98#0', tag: 'PRECEDENT', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: '"Look at what happens elsewhere and pick and mix options." A question about feasibility; no lesson stated.' },
  { chunkId: 'pwdata-debates:debates1943-07-15a:88#0', tag: 'PRECEDENT', method: 'prototype:v1', tagRight: false, shouldBeTagged: true, polarity: 'opposite', note: '"I would not draw analogies from Indian conditions." Refuses the comparative move.' },
  { chunkId: 'historic-hansard:S3V0337P0:3056#0', tag: 'PRECEDENT', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'Objects to rushing a Bill through on a Friday evening. Procedure.' },
  { chunkId: 'committees-reports:publication:11025:arc-0039#0', tag: 'PRECEDENT', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'DFID recommendations on health systems. Recommendations, not a prior instance.' },
  { chunkId: 'pwdata-debates:debates1990-12-10a:226#0', tag: 'PRECEDENT', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: "Australia's experience of random breath testing, with the casualty comparison." },
  { chunkId: 'pwdata-debates:debates1937-02-19a:112#0', tag: 'PRECEDENT', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"There has been no change from the experience of the past. Some people are never taught by their experience."' },
  { chunkId: 'pwdata-debates:debates1985-02-13a:329#0', tag: 'SCOPE', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"Established civil servant" is defined and "established doctor" is not — a definitional gap with a consequence.' },
  { chunkId: 'historic-hansard:S5LV0392P0:1168#0', tag: 'SCOPE', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"A very big hammer that we are using for the nut" AND things left out that logically fit — both halves of SCOPE at once.' },
  { chunkId: 'historic-hansard:S5LV0584P0:2629#0', tag: 'SCOPE', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'Organisations will test the new law in the courts. A litigation prediction, not a scope claim.' },
  { chunkId: 'historic-hansard:S5LV0577P0:4532#0', tag: 'SCOPE', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Deliberate under-definition producing uncertainty about who may rely on the Bill.' },
  { chunkId: 'historic-hansard:S5LV0586P0:2318#0', tag: 'SCOPE', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"Of course the Minister is right: it is too widely drawn" — conceded, and still the move.' },
  { chunkId: 'pwdata-lords:daylord2025-06-26a:164#0', tag: 'SCOPE', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'An "extraordinarily widely drawn and unqualified" reasonable-excuse defence.' },
  { chunkId: 'pwdata-lords:daylord2018-05-08b:107#0', tag: 'IMPLEMENTATION', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: '"A Bill capable of improvement." Says nothing about whether it can be operated.' },
  { chunkId: 'historic-hansard:gapday:commons:1844/jun/07:30#0', tag: 'IMPLEMENTATION', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Thirteen words in 1844: the clause "would be utterly inoperative".' },
  { chunkId: 'pwdata-lords:daylord2001-02-01a:280#0', tag: 'IMPLEMENTATION', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'A Minister offering to take a point away and consider it.' },
  { chunkId: 'historic-hansard:gapday:commons:1881/jun/23:395#0', tag: 'IMPLEMENTATION', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'Seven words: "said, he could not accept the Amendment". A pure fragment.' },
  { chunkId: 'pwdata-debates:debates2008-05-19d:225#0', tag: 'IMPLEMENTATION', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'Scientists could not fathom the definitions and challenged them as completely unworkable.' },
  { chunkId: 'pwdata-debates:debates2026-06-01c:269#0', tag: 'IMPLEMENTATION', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: 'A vague and subjective test called "unreasonable, unfair and unworkable", with the consequence named.' },
  { chunkId: 'historic-hansard:gapday:commons:1889/jul/23:170#2', tag: 'SUPPORT_EVIDENCE', method: 'prototype:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"All experience shows that the County Councils should be allowed to act upon their own responsibility."' },
  { chunkId: 'pwdata-debates:debates1941-05-15a:230#0', tag: 'SUPPORT_EVIDENCE', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: '"The information is correct in respect of Scotland." Eight words about Rudolf Hess. Nothing at all.' },
  { chunkId: 'pwdata-debates:debates1928-03-28a:185#0', tag: 'SUPPORT_EVIDENCE', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: 'Asks whether a matter is already in a Royal Commission\'s terms of reference.' },
  { chunkId: 'pwdata-debates:debates1962-11-22a:209#0', tag: 'SUPPORT_EVIDENCE', method: 'prototype:v1', tagRight: false, shouldBeTagged: false, note: '"This seems the best way to start the experiment." An intention, with no evidence attached.' },
  { chunkId: 'pwdata-debates:debates1976-06-08a:466#0', tag: 'SUPPORT_EVIDENCE', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"This idea already works well in voluntary aided schools", with the speaker\'s own experience as the evidence.' },
  { chunkId: 'scottish-parliament-or:11613:42#0', tag: 'SUPPORT_EVIDENCE', method: 'pattern:v1', tagRight: true, shouldBeTagged: true, polarity: 'same', note: '"The NHS 24 system has worked well in other areas and has been well received by patients."' },
]
