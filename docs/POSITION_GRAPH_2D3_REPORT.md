# STAGE 2D SPRINT 3 — WHAT DID THEY ACTUALLY SAY?

**Executes:** `docs/BRIEF_GRAPH_2D3.md` §1 and §2, and `docs/BRIEF_GRAPH_2D3_CONTINUED.md` §1–§4.
**Written:** 17 August 2026, 02:49 UTC
**Owner:** CC-Graph
**Scope note:** §3 (the mention layer) and §4 (behavioural split detection) were assigned to the
concurrent Amendment 2 session on Charlie's instruction. This sprint took **§1 and §2 only** and did
not touch `schema-amd2.sql`, `setup-amd2.ts` or `signal-behaviour.ts`.

---

## THE HEADLINE, WHICH IS NOT THE COUNT

**16,196 `holds-position` edges were extracted, and 54% of a hand-read sample of fifty is wrong or
partly wrong.**

Both halves of that sentence matter, and the brief said in advance which one is the finding:
*"Do not report an extraction rate as an accuracy rate."* So the count is reported second.

| | |
|---|---:|
| positions extracted | **16,196** |
| recorded silences (§5.4) | 21,461 |
| submissions read | 2,979 of 2,982 |
| actors holding a position | 3,405 |
| positions carrying a passage | **100%** (the schema cannot hold one without) |
| passage found verbatim in its document | **98.4%** |
| **hand-read accuracy over fifty** | **46% correct · 26% partly · 28% wrong** |
| predicted cost | $8.51 |
| **actual cost** | **$8.63 (+1.4%)** |

**Nothing here goes in front of a user, exactly as the brief instructed.** At a 54% error rate that
was going to be the conclusion whatever the count said, and it is the right one.

---

## §1 — THE AREA, CHOSEN BY THE DATA

2D-1 §4's ranking was **recomputed from `graph_edge`** rather than quoted from the report
(`probe-2d3-area.ts`), because a number copied forward is a number nobody has checked.

| rank | committee | orgs in >1 inquiry | inquiries | submissions held |
|---:|---|---:|---:|---:|
| **1** | **Health and Social Care Committee** | **794** | 111 | 6,265 |
| 2 | Environmental Audit Committee | 754 | 139 | 5,318 |
| 3 | Education Committee | 729 | 116 | 5,557 |

**Chosen: Health and Social Care.** Runner-up Environmental Audit is 5.0% behind on the brief's own
primary signal. Full scope of the area: 130 inquiries, 3,480 organisations, 2,619 people, **7,560
held submissions, 21,099,728 words, 2013-10-17 → 2026-06-09**, every one with an R2 key.

**Bounded to the top 12 inquiries by submissions — 2,982 submissions, 6,303,794 words** — on
Charlie's call. Not to save the $12 difference: a vocabulary derived across all 130 inquiries at
once spans dentistry, assisted dying, Brexit and obesity, and would be either ~250 propositions
(not inspectable, and the brief requires inspectability before use) or so thin that most
submissions are asked about claims they never address.

---

## §1a — THE VOCABULARY, REPORTED BEFORE IT WAS USED

91 candidate claims derived one call per inquiry from 14 sampled submissions each, then clustered:
**83 canonical propositions**, 7 candidates dropped. Full list: `derive-propositions.ts --report`.

⚠ **THE CLUSTERING MERGED ALMOST NOTHING — 91 → 83, AND EXACTLY ONE PROPOSITION IS
CROSS-CUTTING.** The prompt asked for 25–45 and refused to merge claims that are merely on the same
topic. It obeyed. The inquiries in this area overlap far less than the cost prediction assumed, and
that is why a priced-in 40-proposition vocabulary became 83 and the run price moved $6.84 → $8.51.

⚠ **AND SEVERAL PROPOSITIONS ARE OF THE WEAKLY-CONTESTABLE SHAPE THE PROMPT WAS WRITTEN TO
EXCLUDE** — "Rehabilitation services should be significantly enhanced", "Investment in community
palliative care should be increased". **They were deliberately NOT filtered by hand.** Whether a
claim is contested is *measurable* once the positions exist, and measuring beats asserting:

| | |
|---|---:|
| propositions with positions on **both** sides | **60 of 83 (72.3%)** |
| unanimous FOR | 21 |
| unanimous AGAINST | 2 |

⚠ Read that 72.3% next to the accuracy finding below before believing it. Over-attribution inflates
it: a proposition acquires an "against" the moment one submission is misread.

### Amendment 1's claim about EDMs, measured rather than adopted

Amendment 1 §1: *"an EDM's text is usually a single compound proposition … it may make EDMs the
cheapest place to bootstrap the proposition set."* Two samples of 60, $0.03:

| | contestable | of which **general policy** | not contestable |
|---|---:|---:|---:|
| A — health-titled EDMs | 91.7% | **65.0%** | 5 |
| B — 60 drawn at random from all 60,737 | 76.7% | **40.0%** | 14 |

**The first half of the amendment's claim holds and the second does not.** An EDM's text really is
a proposition most of the time — but 35–60% of them are one named hospital, one named closure, one
named SI: *"the closure of Calderstones Hospital should be reviewed"*, *"Leicester Royal Infirmary
should seek NHS Trust status"*. Nobody else is ever for or against that same claim, so as a
*bootstrap vocabulary* for a policy area the grain is wrong. As a **position source** — a dated,
deliberate, individually-signed statement — they remain exactly as valuable as Amendment 1 says.

---

## §1b — THE EXTRACTION

`gemini-2.5-flash`, `thinkingBudget: 0`, one call per submission, 2,982 calls in 35 minutes.

**Polarity is heavily skewed and the skew is itself evidence:**

| polarity | n | share |
|---|---:|---:|
| for | 13,240 | **81.7%** |
| against | 2,212 | 13.7% |
| balanced | 744 | 4.6% |

**Capacity** (design §5.3): own-view 90.0%, representative 9.2%, government-line 0.6%,
commissioned 6 rows, unclear 6 rows. ⚠ `unclear` at 0.04% is implausibly low for a corpus in which
attribution is often genuinely ambiguous — the model almost never used the escape hatch it was
given, which is the same over-confidence the hand-check found.

### The three checks that discarded rows, and what they caught

| check | discarded | what it means |
|---|---:|---|
| prefix ≠ code | 155 | the model's proposition code did not match the proposition text it echoed |
| unknown code | 100 | a code that is not in the vocabulary |
| extract too short / not prose | 16 | a run of tab characters from a table, copied as a "quotation" |

**2.2% of returned rows were refused by a mechanical check.** Every one of those would otherwise
have been a position filed against the wrong claim or evidenced by a table row.

---

## ⚠⚠ THE ACCEPTANCE TEST — FIFTY POSITIONS READ BY HAND AGAINST THEIR SOURCE

Stratified by polarity, deterministic (md5 order), each shown with ±400 characters of surrounding
document. Verdicts and per-failure notes are in `graph_position_review`; the sample and the
verdicts are checked in as `handcheck-2d3-sample.json` and `handcheck-2d3-verdicts.json`.

| verdict | n | % |
|---|---:|---:|
| correct | 23 | 46.0% |
| partly right | 13 | 26.0% |
| wrong | 14 | 28.0% |
| **ERROR RATE** | **27** | **54.0%** |

### The failure shapes, which is what decides whether this generalises

| failure | n | what it is |
|---|---:|---|
| **position-invented** | **12** | the submission does not address the claim at all; a position was attached to a topically-adjacent passage |
| **nuance-flattened** | **11** | the submission supports the general area but not the specific claim — "training should be offered" recorded as support for "training should be **mandatory** and in **Initial Teacher Training**" |
| proposition-mismatch | 2 | the passage is about a neighbouring claim |
| **polarity-flipped** | **2** | the direction is reversed |

**The single most important number here is that polarity-flipped is only 2 of 50 (4%).** When the
model says a submission addresses a claim, the *direction* is usually right. The failure is that it
says so far too often. That is a precision problem, not a comprehension problem, and precision
problems have known fixes — which is a considerably better position to be in than the headline
suggests.

**Corroboration from a completely different direction:** 81.7% of all positions are `for`. A method
that invents support would produce exactly that skew, and it did.

### Three failures worth naming individually

- **#17758 — the extract was a line from the BIBLIOGRAPHY.** *"Community-based physical and social
  activity for older adults with mild frailty: a rapid qualitative study"* is a cited paper's
  title. ⚠ **The verbatim-extract check cannot catch this**, because the words genuinely are in the
  document. A quotation being real and a quotation being evidence are different properties, and
  only the first is currently checked.
- **#381 — the extract was the submitter introducing itself.** *"Our thoughts on this topic are
  vital as both roles are integral to multidisciplinary teams"* was recorded as a position on
  expanding rehabilitation services.
- **The "10-minute consultation model" proposition failed three times out of four in the sample**,
  always the same way: a passage about GP workload, filed as a position on consultation length. A
  specific claim sitting inside a heavily-discussed theme is the dangerous shape.

### What would fix it, in the order the evidence supports

1. **A second call that only ever says no.** An adversarial pass over each extracted position —
   *"does this passage actually address this claim?"* — targets `position-invented` and
   `nuance-flattened`, which are 23 of the 27 failures. This is the same shape as the hostile-clerk
   pass LEX 3-E already uses.
2. **Require the claim's own terms in the passage.** Twelve of the twelve invented positions quote
   a passage that does not contain the proposition's distinguishing words.
3. **Drop the weakly-contestable propositions**, now that contestedness is measured rather than
   assumed.

⚠ **None of these was applied.** Re-running the extraction against a fix that has not been
hand-scored would replace a measured 54% with an unmeasured number.

---

## §2 — COMPANIES HOUSE AND THE CHARITY COMMISSION

**No API key, and that turned out not to be a compromise.** Both bodies publish the whole register
as an open, keyless bulk download under OGL v3.0 — Companies House
`BasicCompanyDataAsOneFile-2026-08-01.zip` (493 MB, 5,695,465 companies) and the Charity Commission
`publicextract.charity.zip` (44 MB, 397,939 charities). For a 40,518-name hash join the bulk file is
*better* than the API: a join wants the whole table, not 40,518 round trips.

**Match rule: exact match on `normaliseName()` — the same function that built
`graph_entity.name_norm`.** No fuzzy matching, no edit distance, no acronym expansion, no
legal-suffix stripping. A second normaliser would silently fail to match and read as poor register
coverage.

| | Charity Commission | Companies House |
|---|---:|---:|
| register rows scanned | 397,939 | 5,695,465 |
| candidate matches | 3,221 | 4,846 |
| entities matched | 2,794 (6.9%) | 4,829 (11.9%) |
| **unambiguous both ways → PROMOTED** | **2,405 (5.9%)** | **4,812 (11.9%)** |
| ⚠ **SPLITS** — our entity → >1 register row | **389** | **17** |
| ⚠ **MERGES** — >1 of our entities → one row | **0** | **0** |

**5,496 organisations (13.6%) now carry an external stable key** where before they carried a name.

**Merges and splits are reported separately, as the brief requires**, and the asymmetry is the
finding: 389 splits against 17 says our *charity* names are far more ambiguous than our *company*
names, which is what you would expect when hundreds of local branches share a national name. **0
merges in both registers is measured, not assumed** — no register row was claimed by two of our
entities.

⚠ **3,443 match keys were REFUSED as too generic** before matching began — a single word, or a
phrase that is also a registered body ("Community Care", "Shelter", "Mind"). An exact match is not
the same as a correct one, and these refusals are counted so they do not read as register gaps.

⚠ **0 matches came via an alias rather than the canonical name.** 2D-1's alias table added nothing
here. Worth knowing before building anything else on it.

---

## CONTINUED BRIEF §2 — OFFICE BY DATE: THE INSIGHT IS RIGHT AND THE DATA WILL NOT CARRY IT

Charlie's insight — *"there's only ever one Archbishop of Canterbury at a time, so an office plus a
date is a deterministic lookup"* — is correct as reasoning. **It is not implementable on what we
hold, and the mechanism was scored before being trusted rather than after.**

**Classifying all 6,512 register surfaces by whether their holders' tenures overlap:**

| classification | n | |
|---|---:|---|
| **office** — succession, never simultaneous | **1** | `bishop of wakefield` |
| ⚠ simultaneous — two people at once | 323 | REFUSED: not an office |
| single-holder | 6,012 | nothing to resolve |
| ⚠ undatable — a holder has no start date | 176 | REFUSED: cannot be shown either way |

**And then the one office that qualified was scored against ground truth.** `division_votes`
already carries the true member id, so resolving (surface, division date) and comparing is a
measurement rather than an argument:

> **47 resolvable (surface, date) pairs. 30 matched the true member id. 17 did not. 63.8% accurate.**
>
> `bishop of wakefield on 2011-09-14: register says MNIS 3891, the vote was cast by MNIS 1812`

**The cause: `graph_member_name`'s date windows are not office tenure.** They record when the
register carried that *name form* for that member, which is a different fact — a bishop's surface
persists in the register beyond the see. Parliament's Members API was checked directly for a real
tenure source and publishes only Lords entry dates (MNIS 1812 entered 2002, MNIS 3891 in 2009);
there is no see-tenure record.

**So nothing was resolved. `graph_office_resolution` holds zero rows and `verify-2d3.ts` asserts
that it does.** A 63.8% resolver applied to name-only mentions is the brief's own warning realised:
a fabricated voting record for a named person.

⚠ **The brief's counter-example checks out and is worse than described.** There are **five** MNIS
records for `archbishop of canterbury`, not two, and MNIS 3296 has **no start date at all** — which
is why the surface was refused as `undatable` before the accuracy question arose. Carey (2205, 219
votes), Williams (3620, 8), 4252 (84), 4696 (88), 3296 (0).

**What would make it work:** a source that states office tenure — the Lords Spiritual appointment
record for bishops, Parliament's ministerial appointments feed for ministers, and Companies House
officer appointment/resignation dates for company officers, the last of which now arrives free with
§2's bulk data. **All three are next-sprint work, and none is a name match.**

---

## CONTINUED BRIEF §4 — THE TWO CARRIED ITEMS

### The submitter's own name IS in the document — measured

`schema-amd2.sql` records that a per-appearance surface cannot be supplied because
`corpus_sections.speaker` is NULL on committees-evidence. **True of the database; false of the
document.**

⚠ **And my own first claim about it was too strong, from three hand-picked files.** Measured over
600 random written-evidence documents the first parser found **15.7%**. The 84% that failed were
then *read* rather than assumed away, and the header was present in most of them in forms the
anchored pattern could not reach — a reference code and a title first, "Written Evidence **from**
X", the name *before* the phrase, "Submission to the X Committee **by** Y". After the fix:

| | |
|---|---:|
| a submitter name in the opening lines | **64.5%** |
| an internal reference (PHS0616) as well | **91.7%** |
| — of the comparable ones: identical to the API submitter | 48.7% |
| one name contains the other | 39.4% |
| a spelling variant | 8.2% |
| ⚠ **a different body entirely** | **3.7%** |

The disagreements are the useful part: the document says *Dame Diana Johnson, Minister of State for
Crime, Policing and Fire* where the graph says *Home Office*; *the Champs Public Health
Collaborative* where the graph says *Cheshire and Merseyside Integrated Care System*. Those are a
named person and a named partnership that the entity spine does not hold at all.

**Nothing was built. `parseDocumentHeader` in `text-2d3.ts` is written and self-tested (27/27), and
this is handed to the Amendment 2 session** rather than turned into a competing mention layer.

### 2D-2's register-ambiguous name matches

Reported, not fixed, as the brief directs: three of 2D-2's 788 name matches stand on a surface the
register itself says is shared (`Mr George`, `Robinson`), recorded at confidence 0.9. A rule
refusing a match on a register-ambiguous surface is small and belongs with whoever next touches
`sweep-members.ts`.

---

## THE COST PREDICTION, SCORED

Recorded in `CHANGE_LOG.md` at 2026-08-16 11:47 UTC **before a penny was spent**, per the brief.

| | predicted | actual | |
|---|---:|---:|---|
| position extraction | $8.51 | **$8.63** | **+1.4%** |
| proposition derivation + clustering | <$0.50 | $0.09 | |
| Amendment 1 EDM test | <$0.05 | $0.03 | |
| pilots (60 + 60) | — | $0.45 | |
| **total** | **$9.06** | **$9.20** | **+1.5%** |

The extraction prediction was accurate because the vocabulary was priced *after* it existed
(`extract-positions.ts --predict`) rather than from the original 40-proposition assumption, which
would have missed by 26%. **The lesson is that the second prediction was cheap and the first was
guesswork; making the predictor a flag on the runner is what made re-pricing free.**

Measured input 15,667,668 tokens against 12,857,046 predicted; output 1,571,773 against 1,192,800.
Both over, and they very nearly cancelled.

---

## THE DEFECTS THIS SPRINT FOUND IN ITS OWN OUTPUT

None came from review. Each came from running a check that could fail.

**1. ⚠⚠ THE CORPUS TEXT IS NOT ENTITY-DECODED, AND IT COST A 25.9% FALSE FABRICATION RATE.**
The first pilot reported that 25.9% of extracted passages could not be found in the documents they
were quoted from. Diagnosed rather than assumed (§13 — dump the bytes before forming a hypothesis):
**83.9% of the misses were the matcher's fault, 12.9% genuinely absent.** The cause, read off the
bytes: `committees-evidence` compiled text in R2 carries **literal HTML entities** — measured over
200 random documents, **24 (12.0%) contain one, 5,322 occurrences**, `&#xa0;` (5,212), `&#x2011;`
(107), `&#xad;` (3) — plus words broken by stray spaces from PDF extraction (`mental health ser
vices`). A model reading `Barbara&#xa0;Rayment` quotes "Barbara Rayment", which is the *correct*
reading, and looked like an invention.

**After repairing the matcher — and re-scoring the stored rows, which cost nothing: 25.9% → 2.9%,
and 0 rows went the other way.** On fresh calls the rate is **1.6%**. ⚠ **The entities are still in
R2 and still in whatever the search stack indexed. That belongs to the ingest thread and is
reported, not patched over.**

**2. ⚠ THE MODEL'S OWN ARRAY INDEXES ARE UNRELIABLE, INTERMITTENTLY.** The Amendment 1 EDM test
filed the dietary-salt motion's proposition under a Scottish SI's index and the homelessness
proposition under the midwifery motion's. It **did not reproduce** on the next run (0 disagreements
in 120), which makes it *intermittent* and therefore worse than systematic: it corrupts a fraction
of rows and looks like model error. **Every schema in this sprint now correlates by verbatim echo**
— candidate text, or a proposition code plus its first eight words — and counts the mismatches. In
the full run that check fired 255 times.

**3. A module that did work on import ended the shared pool underneath its caller.**
`verify-2d3.ts` imports two pure functions from `resolve-offices.ts`; the import ran the script.
Guarded with `require.main === module` in all four scripts that have a `main()`.

**4. A silent exit that looked like a clean finish.** Streaming the register CSVs straight out of
their zips read the header and the first rows and then **the process exited with status 0 part-way
through** — no error, no partial report. That is an empty event loop: a stalled zip-entry stream has
no pending libuv handle, so Node concludes there is nothing left to do and leaves. Unpacking to
disk first and reading with `fs.createReadStream` cannot fail that way. Same family as §18: a
degradation must announce itself.

---

## VERIFICATION

`npx tsx position-graph/verify-2d3.ts` — **21 checks, 21 pass, and seven of them are negative
controls that must fire:**

- the schema **refuses** a position with no passage (`position_extract_ck`)
- the schema **refuses** a polarity outside the four permitted
- the matcher **rejects** a fabricated quotation, and still accepts a real one
- the office test **refuses** two open-ended holders
- an overlapping date resolves to **nobody**, never to the first holder
- no surface called an office has two simultaneous holders
- **nothing was resolved by office-by-date**

Plus: every position dated and carrying a passage; the date is the document's, never today's; every
subject provably submitted the document its position was read from; every recorded silence sits on
a claim actually put to that inquiry; and no silence leaks into `graph_edge_all` as an edge.

**The positions reach the concurrent Amendment 2 session's `graph_mention` view for free** — 16,196
mentions — because the fourth arm added to `graph_edge_all` keeps the column list unchanged.

Offline self-tests: `llm-2d3` 10/10, `text-2d3` 27/27, `derive-propositions` 10/10,
`extract-positions` 15/15, `diagnose-extracts` 9/9, `resolve-offices` 11/11, `match-registers` 8/8.
`tsc --noEmit` clean for `position-graph/` (the pre-existing errors elsewhere in `scripts/ingest`,
including `s3-drop-readiness.ts`, are untouched and not this sprint's).

**Storage: 27 MB total.** Not a constraint and not designed around one (V38).

---

## WHAT IS NOT DONE

- **§3 and §4** — the mention layer and behavioural split detection. Assigned to the Amendment 2
  session; position-based split detection needs the positions, which now exist, and is a later
  sprint.
- **The accuracy fix.** Three candidate remedies are named above with the evidence for each; none
  was applied, because replacing a measured 54% with an unmeasured number is not an improvement.
- **Office-by-date resolution.** Blocked on a real office-tenure source, not on code.
- **The other 118 inquiries in the area**, and the other 19 committees. At the measured rate
  ($8.63 for 6.30M words = **$1.37 per million words**) the rest of this area is a further $20 and
  all twenty committees are of the order of $150 — affordable, and not worth spending until the
  error rate comes down.

---

## FOR CHARLIE

1. **The 54% is the sprint's product, and it says the extraction is not ready to be shown.** The
   shape of the failures says it is fixable: the model reads direction correctly (4% polarity
   errors) and over-attributes (46% of failures are positions on claims the submission never
   addressed). An adversarial second pass is the obvious next move and it is cheap.
2. **§2 landed cleanly and is usable now.** 5,496 organisations carry a Companies House or Charity
   Commission number, all of them unambiguous in both directions, with 406 ambiguous cases reported
   rather than guessed.
3. **⚠ For the ingest thread: 12% of committee documents in R2 carry undecoded HTML entities.**
   Everything downstream of that text — FTS, embeddings, anything a user reads — has been seeing
   `&#xa0;` where a space belongs.
4. **Your office-by-date insight is right and needs a source we do not have.** Three candidate
   sources are named; the Companies House officer data is already downloaded.
