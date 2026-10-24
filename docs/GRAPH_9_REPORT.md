# GRAPH 9 — power or mention · the `mentions` kind · explanatory notes (24 Oct 2026)

Brief: `docs/BRIEF_GRAPH_9.md`. Charlie approved all four items. Built on decision 271 (`4f6fd57`), which landed the same day and already classifies an enabling row by its **words**; GRAPH 9 adds the **provision** as a second, independent instrument.

**State, 2026-10-24 ~18:55 UTC:** built; `citation_edge.source_zone` added and backfilled on Neon (18:36–18:40 UTC); new table `provision_power` (17,530 rows, 18:37 UTC). `check:graph-9` **8/8**, 87 assertions over 1,076,234 rows, controls **9/9**; `check:onward` **23/23**, 2,816 assertions, 9/9. Mutation run: every break red, every file restored byte-identical (§7). **Not committed, not deployed.**

---

## 1. §0 — the 36.1% is confined to OUR extracted rows. GRAPH 6 stands.

`scripts/ingest/graph/audit-g9-provision-ids.ts` → `audit-g9-provision-ids.json`. Every section-level official row was looked up among the provision identifiers the **publisher** wrote on the effects joining the same two documents, re-read from the bulk zips with a parse written in the audit (not the extractor's).

| rows | checked | not a publisher identifier |
|---|---|---|
| official `tna-bulk-amendments`, affected end — **against the 5 July files the table was built from** | 1,786,206 | **0** |
| official `tna-bulk-amendments`, affecting end — same | 1,744,253 | **0** |
| official `tna-inforce-dataset` (only 51 rows carry a provision) | 51 | **0** |
| **extracted** `clml-si-preamble` made-under, against the corrected parser | 130,302 | **46,820 (35.9%)** |

- **Which consequence: the first.** Official rows carry `ukm:Section Ref` verbatim: identifiers the publisher supplied, not numbers parsed from a sentence. Act-level and provision-level effect figures stand. The publisher's own two identifiers for a provision (`Ref` and `URI`) disagree in 33 of 6,548,847 elements, all EU annex forms.
- **The test can fail.** It was given real rows with the provision made wrong in the old parser's two ways:
  - a subsection read as a section (`section-52-2` → `section-2`): **4,526 of 4,816** caught;
  - a ref attached to another row's document: **1,525 of 1,980** caught.
  The misses are real coincidences, where the same effect pair genuinely names both.
- **Extracted: 35.9%** reproduces 4B's 36.1%. This figure is an *upper bound* on wrongness, because the corrected parser drops lists like "52(2) **and (4)**" (271 §6.1). `legislation_edges`' made-under rows are read by nothing in the reader (asserted, G0).

⚠ **I replaced the source files this measurement depends on, by importing a constant.** `download-graph-sources.ts` ran `main()` on import. The audit imported `DATA_DIR` from it, and that downloaded today's uksi/ssi/nisr/wsi zips over the 5 July copies at 18:21:07–10 UTC, in the middle of the audit.
- **Run 2:** read the July files before the rename and gives the 0 / 0 above.
- **Run 3:** read today's files and finds **274 / 201** stored rows (0.015% / 0.012%) whose identifiers the publisher has since re-keyed. 271 of the 274 are in the four refreshed types; **3 (`nisi`) I have not explained**.
- **What was lost:** no database row changed, but the July copies of those four files no longer exist.
- **Fix:** the file is now guarded (`require.main === module`, asserted in G0). This is the third time this guard has been needed.

## 2. §2 — power or mention: what the data allowed

### 2.1 Is there a publisher enabling-power record? (§2.2, asked first)

- **No record of powers EXERCISED.** I checked:
  - the CLML `ukm:Metadata` of sampled SIs (36 element kinds; none is an enabling power);
  - the RDF of `uksi/2020/38` (`/made/data.rdf`: FRBR/metalex/dc only).
- **Obtainable?** I found no legislation.gov.uk dataset or endpoint that carries it, so I could not size one. TNA's "Statutory Powers & Duties" dataset (`duties.zip`, 112 MB, daily; inventory §5D) is **AI-extracted**, flagged by TNA as possibly erroneous, and is about the provision, not about which SI used it. Not fetched.
- **What we do hold, found this sprint:** the publisher marks provisions **`ConfersPower="true"`** on `<P1group>`/`<P1>` in the CLML we already have. CRaG carries six: ss.45, 46, 51 and 52, and Sch 6 paras 21 and 44. **s.20 carries none.**
  - It is the publisher's own record, but of the **provision**, not of the instrument made under it.
  - Coverage is partial: **1,710 of 4,407** Acts, 338/409 asp, 120/250 nia, 108/558 nisi, and almost no SIs (`audit-g9-confers-power.json`).

### 2.2 The text rule — derived from data, scored, and it failed the floor (§2.1, §6d)

`provision-power.ts` + `audit-g9-confers-power.ts`. Sixteen candidate phrase families. Train/test split by FNV hash of the gid. Two independent labels:

| label | what it is | used for |
|---|---|---|
| **flag** | `ConfersPower`, in documents the publisher marked | precision |
| **SI** | provisions SIs' own enacting words name as the power exercised (271 `power`, 15,106) | recall |

- **Floor: precision ≥ 0.8 against the flag on the train half. No family reached it.**
  - Best: `by_regulations` 0.76, `by_statutory_instrument` 0.72, `by_order_minister` 0.72, `regulations_may` 0.71.
  - `TEXT_RULE_FAMILIES` is therefore **empty**. The text rule is a determination nowhere, and every provision state is labelled **low confidence**.
- All candidates together, test half: **precision 0.561** against the flag, **recall 0.722** against SI-confirmed powers.
- **The two non-text instruments disagree too.** Of 12,398 SI-confirmed powers in documents the publisher marked, **8,830 (71.2%)** carry the flag.
- **Why, read rather than assumed (samples in the JSON):**
  - **The flag marks a power of any kind:** to inspect, to appoint, to impose a penalty. It also misses plain regulation-making powers: TMA 1970 s.59E "The Treasury may by regulations make provision …" is unflagged in a document the publisher marked.
  - **The text sometimes confers the power elsewhere.** An amending provision's *inserted* text confers the power in another Act (now stripped: `<BlockAmendment>`). "An order under this section" is often a *court's* order.
  - **The bulk file holds the current text.** Most SI-confirmed powers with silent text are **repealed** ("23 . . . . . ."). Reading today's provision cannot answer a question about the power when the SI was made.

### 2.3 What the provision test is allowed to do

Because neither provision-side instrument is calibrated, the provision test **only withholds** (`enablingKindOf`, onward-pure.ts). It never makes a row a power.

| the instrument's words (271) | the provision (`provision_power`) | kind |
|---|---|---|
| power | `power` (flag or text), `unknown`, or no provision named (Act-wide) | **made-under** |
| power | **`none`**: the publisher marked the document and did not flag it, no candidate family fires, the text is not repealed | **enacting-unresolved**: new kind, new strength, *"Unresolved — read the words before relying on this"* |
| mention / unstated | anything | **enacting-mention** |

- **Per instrument, not per row.** The extractor writes an Act-level row beside every provision row from the same anchor. Classified row by row, the withholding never took effect: G3 found **zero** unresolved instruments in the whole table. Fixed in `enablingRows`.
- **Measured error of `none` on SI-confirmed powers:** 902 of 13,559 (**6.7%**). I hand-read 25 of them:
  - 13 the provision really confers none (interpretation, short title, offence, establishing a body);
  - **8 real powers the phrase families miss** ("may … make schemes", "may by resolution", Acts of Adjournal, court rules);
  - 4 unclear.
  So roughly **2% of real powers would be shown as unresolved.** They are shown, never hidden. I did not add the missed families: adding them after seeing this half would be tuning on the test.
- **Whole table:** 1,100 of 75,081 (instrument, Act) pairs that 271 calls made-under become unresolved (1.5%).
  - In a 12-row sample of `none` rows the words call powers, **4 are the extractor attaching a section to the wrong Act** in a multi-Act preamble. Examples: "section 23 of the Local Government Finance Act 1982" filed under the Local Government Act 1988; "96(9) of the Value Added Tax Act 1994" under the Finance Act 1999.
  - So the disagreement surfaces the known target-resolution defect (271 §6.3), which is what the brief said disagreement would be for.

`provision_power`: one row per provision an enabling row names.

| state | basis | rows |
|---|---|---|
| power | flag-and-text | 6,242 |
| power | text-only | 2,041 |
| power | flag-only | 1,610 |
| **none** | no-flag-no-text | **1,159** |
| unknown | not-held | 3,271 |
| unknown | repealed-text | 2,313 |
| unknown | weak-text-only | 638 |
| unknown | unmarked-and-silent | 256 |

### 2.4 CRaG s.20 — the acceptance test

- **s.20 itself:** `none` (`no-flag-no-text`: CRaG is marked, s.20 is not, and no family fires). **s.52** is `power`, so the test tells them apart.

| kind | naming s.20 | instruments |
|---|---|---|
| made-under | **0** | — |
| enacting-unresolved | **0** | — |
| enacting-mention | **3** | `ssi/2024/101` "the requirements of section 20 of the Constitutional Reform and Governance Act 2010 have been met"; `uksi/2024/512` "… the requirements of section 20 …"; `uksi/2020/38` "The Secretary of State **has laid before Parliament** a copy of the Agreement … under section 20(1)(a)" |

- All three read as procedural, with the words read from the table, not trusted (G2).
- The reader and the tool now say: *"3 instruments reference this provision in their enacting words. None is made under a power in it — and the provision itself appears to confer no power (low confidence: …)."*
- ⚠ **Not "eleven instruments, zero dependencies."** The other **7** rows in a s.20 walk are made-under **Act-wide**. Their words name **ss.45, 46 and 52**, and the list parser drops the section ("52(2) **and (4)**", 271 §6.1). They are shown as "only the Act as a whole", never as naming s.20. Fixing them is the pending refs-list decision.

## 3. §3 — `mentions`, a separate weaker kind

- **Opt-in:** `include_mentions` on the tool, `MENTIONS_KIND` in the reader.
- **Not in the default walk, never merged into `cites`**, from `citation_edge.detection = 'text'`.
- Strength `reference`, labelled *"named in running text (found by us, not marked up — weaker than a citation)"*.
- G4 asserts the counts equal SQL, and that asking for mentions leaves `cites` unchanged.

Marked-up vs text-detected references (`audit-g9-mentions-notes.json`):

| Act | marked-up | text-detected | reads as |
|---|---|---|---|
| CRaG 2010 | 11 | 171 | 1 in 17 |
| GRAA 2000 | 5 | 603 | **1 in 122** |
| Equality Act 2010 | 79 | 1,789 | 1 in 24 |
| CS(MF)A 1992 | 0 | 7 | no marked-up reference |

GRAPH 8's "1 in 19" for the Equality Act is now 1 in 24, counted as `citation_edge` rows.

## 4. §4 — explanatory notes: tagged, and the real proportion is 31%, not 5.7%

- **Tagging:**
  - `citation_edge.source_zone` = `body` · `explanatory-note` · `earlier-orders-note`, with a CHECK; NULL means not determined.
  - Set by the extractor from now on.
  - Backfilled by `backfill-g9-source-zone.ts`, which re-runs the extractor's own detectors over the bulk file and matches each stored row by its own key.
- **Backfill coverage:**
  - zone determined on **1,016,062** rows;
  - **18,486 not determined**, never assumed body: 11,415 in 338 documents absent from the 14 May file, 6,575 not re-produced, 496 ambiguous.

**The real proportion** (denominator: stored rows whose zone was determined):

| | from a note | of | share |
|---|---|---|---|
| all marked-up + text-detected rows | 319,835 | 1,016,062 | **31.48%** |
| marked-up only | 236,642 | 377,195 | **62.74%** |
| text-detected only | 83,193 | 638,867 | 13.02% |
| **`cites` rows the reader walks**, by the words shown | **66,325** | 116,741 with words | **56.81%** |

- **GRAPH 8's "at least 5.7%" was a floor and it was far off.** Most marked-up citations in SIs sit in the *note as to earlier commencement orders* (165,258 rows).
- **Equality Act:** 39 of 79 marked-up references are from notes. **GRAA:** all 5. Its entire `cites` set is explanatory notes.
- ⚠ **A note row is filed under the wrong provision.** The extractors assign each reference to the last provision id before it, and an SI's note comes after its last article. So `uksi/2014/3245`'s note *"This Order brings into force … section 45(1)"* is stored as a citation from **`article-2`**. The reader now hands a note row back as **the instrument**, not that provision (`noteNode`). The tool marks each such row `not_part_of_the_law` and says the count in the summary; the words open with *"[explanatory note — not part of the law]"*.

## 5. §5 — the two small items

- **a. `detectionOf()`** now recognises `caselaw-markup`, deliberately not as a statute `Detection`. `inboundFor` returns judgments in their own `caselaw` list. `unrecognised` is empty on CRaG and the Equality Act (G6), where it held 118 and 19,017.
- **b. `verify:statutory-parity`: was 7 divergences, now 0.** Three causes:
  1. Judgments were "unknown". Now recognised (a).
  2. Its "provision rows" count included a judgment's paragraph refs. Now statute rows only.
  3. The web reader never declared `case-to-case-citations`. Now declared, `held-elsewhere`.
- **Also found and fixed:** the web reader's `enabling-power` layer counted `detection NOT IN ('markup','text')`, i.e. every judgment, and reported **1.49M** enabling rows against the real **201,776**.

## 6. Checks run

| check | result |
|---|---|
| `check:graph-9` (new) | **8/8**, 87 assertions over 1,076,234 rows; controls **9/9** fired |
| `check:onward` | **23/23**, 2,816; 9/9. B2, B10 and B16 brought to the three-kind rule |
| `verify:statutory-parity` | **13/13, "parity holds"**. Red since GRAPH 5 |
| `check:effects` · `check:statutory` · `check:idea-law` · `check:surface-5` · `check:lex-26v` | 30/30 (controls 8/8) · 17/0 · 26/26 (11/11) · 16/0 (7/7) · 61/0 |
| web `tsc` · `check-clean-build.sh --fast` | 0 · PASS |
| ingest `tsc`, `graph/` | 0 (24 pre-existing errors elsewhere in the package, none in files this sprint touched) |

## 7. Mutation run (§6g) — every file restored and its hash compared, all byte-identical

Each break was written into the real source, the checks were run, and the file was put back. Run from a scratch script, since deleted.

| | the break | red |
|---|---|---|
| **M1** | **a procedural mention classified as a power**: `enablingKindOf` treats `mention` as `power` | `check:graph-9` **G2, G3**; `check:onward` **B2, B4, B10, B16** |
| **M2** | the same, **and the provision test removed**: the three s.20 SIs come back as made under s.20, the brief's eleven-row failure | **G2, G3**; **B2, B10, B16** |
| M3 | `mentions` put in the default walk | G2, G4, G7 |
| M4 | an explanatory note shown without its label | G5 |
| M5 | a note row handed back as the provision it was filed under | G5 (control L6 also dead: it uses `noteNode` as its reference) |
| M6 | `detectionOf` forgets case law, the pre-GRAPH-9 state | G6 (control L9 also dead, likewise) |

**M1 is the instructive one.** With the words layer broken, the s.20 rows did **not** become made-under. The provision test caught them as *unresolved*, because s.20 is `none`. Only when both were broken (M2) did they come back as dependencies. That is the two instruments working independently, as §2 asked.

⚠ M3 also turned G2 red, for an imprecise reason: G2 asserted "no row but `enacting-mention`" for the three SIs, and a legitimate text-detected `mentions` row broke it. G2 now asserts the property itself (no made-under or unresolved row naming s.20).

## 8. What the data said that this brief got wrong

1. **"The words lie … `uksi/2020/38` says *under section 20(1)(a)*".** The full stored words are *"The Secretary of State **has laid before Parliament** a copy of the Agreement … under section 20(1)(a)"*. "Under" qualifies the laying, and decision 271 already reads it as a mention ("laid before"). The words did not lie; the 240-character window hid the verb.
2. **"Eleven made under CRaG s.20."** Three instruments named s.20; eight named no section. Of those eight, seven are powers under **ss.45, 46 and 52** whose section the list parser drops, and one is a mention. Today a s.20 walk shows 0 made-under naming s.20 and 7 Act-wide.
3. **"Read the provision instead": the provision cannot settle it either.** The bulk file holds the **current** text, and most SI-confirmed powers whose text is silent have been **repealed** since. The publisher's flag marks powers of every kind and misses plain regulation-making powers. No text rule reached the precision floor. The provision is a second witness, used only to withhold. It is not a judge.
4. **"No official enabling-power source appears in that list": true, and there is a different official record.** The publisher marks `ConfersPower="true"` on provisions in the CLML we already hold. It is the provision-side record (what confers a power), not the instrument-side one (which power was used).
5. **"At least 5.7%" explanatory notes: the real figure is 31.5% of all citation rows and 56.8% of the `cites` rows the reader walks.** GRAA's entire `cites` set is notes. And each note row was filed under the instrument's last article, a second error the 5.7% floor could not show.
6. **"The 1-in-19 figure"** is 1 in 24 for the Equality Act on today's rows; GRAA is **1 in 122**.
7. **§0 had a hazard the brief could not have known.** Measuring it replaced its own source files: an import of a constant ran a downloader. The answer stands, measured against the files the table was built from. The July files are gone.
8. **"Three states, never two" needed a fourth place to put them.** `unknown` at the provision level is the common case (6,478 of 17,530: repealed, not held, unmarked). Making every words-power row on an `unknown` provision "unresolved" would have moved thousands of real dependencies out of "made under this". So `unknown` keeps the words' verdict. Only `none` withholds, and the row is labelled with the provision's state either way.
9. **`detectionOf` was not the only casualty of the case-law layer.** The web reader's `enabling-power` coverage count had been counting every judgment as an enabling power (1.49M against 201,776) since GRAPH 5.

## 9. For Lex (CCh-Lex)

- **New kind `enacting-unresolved`** (strength `unresolved`, heading *"Unresolved — read the words before relying on this"*):
  - It is in the default walk.
  - The collision walk asks for kinds by name, so it sees none of these rows until it asks for `'enacting-unresolved'`. Suggested placement: "What depends on this", with its own label and words, never counted as made-under.
- **New opt-in kind `mentions`**, from `include_mentions` on the tool. Not in the default walk; never merge it with `cites`.
- **Row fields, all additive:**
  - `OneStep.provisionPower` (`{state, basis, words}`, low confidence, for made-under, unresolved and mention rows that name a provision);
  - `OneStep.sourceZone` (`body` / `explanatory-note` / `earlier-orders-note` / `not-determined` / null);
  - `citingTextForDisplay(text, zone)`, which opens a note's words with *"[explanatory note — not part of the law]"*;
  - `OnwardResult.targetProvisionPower` and `OnwardResult.mentionOnly`.
- ⚠ **A `cites` row from a note is now handed back as the instrument, not the provision it was filed under.** That provision was wrong (§4).
- ⚠ **`action-touches.ts` `madeUnderFor()` reads every enabling row as "made under", with no `enabling_role` filter**, so decision 271 never reached that surface. Lex's file.
- `inboundFor` now returns `caselaw` as its own list. `unrecognised` is empty where it held every judgment.
- Lex's collision-walk fixture builds `OneStep` objects: it needs `provisionPower: null, sourceZone: null` to type-check (scripts are outside the web `tsc`).

## 10. Open, for Charlie

1. **The refs-list parser** (271 §6.1) is now the whole remaining gap on CRaG s.20. The 7 Act-wide made-under rows are powers under ss.45, 46 and 52. Fix it and run an additive backfill?
2. **Target resolution in multi-Act preambles** (271 §6.3) is now visible as unresolved rows: at least 4 of a 12-row sample. A fix belongs in the extractor.
3. **Missed power families** ("make schemes", "by resolution", Acts of Adjournal, "rules of court"). Adding them needs a fresh untuned draw to score against, not this test half.
4. **The 3 `nisi` mismatches** against today's publisher files (§1), unexplained.
5. **Should note rows be re-extracted with no provision** (`source_provision_ref` NULL)? The reader now corrects the node it hands back, but the table still files 320k note rows under a provision they are not in.
