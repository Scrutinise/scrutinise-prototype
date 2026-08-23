# CASE LAW BEFORE 2001 — a scoping study, for Charlie to decide from

**Measured 2026-08-22 23:49 – 2026-08-23 00:20 UTC.** Executes `BRIEF_CASELAW_PRE2001_SCOPE.md`.
Nothing was built, no downloader was written, no schema was changed and nothing was fetched in
bulk. One probe script was added (`scrutinise-web/scripts/probe-pre2001-caselaw.ts`) because §3
requires a demonstration rather than an assertion.

---

## §0 — THE FOUR THINGS TO READ IF YOU READ NOTHING ELSE

1. **BAILII is not available and the terms say so in terms.** BAILII's own Terms of Service
   prohibit *"storing search results or HTML versions of judgments"* and *"abusive use of the
   BAILII website's resources and services via automated mechanisms or otherwise, in particular
   for bulk downloading of documents"*, and its `robots.txt` disallows **every** jurisdiction path
   to every crawler. This is the `ssrn` precedent and the answer is **blocked, with reasons**.
   ⚠ The prohibition is not commercial-vs-non-commercial: it binds us as a charity exactly as it
   would bind a publisher, so this is **not** a `commercialUseExcluded` case — it is a closed door.

2. **The ten questions were run and the corpus scored 0 of 10 — and worse, 3 of 10 returned a
   different case with the same name.** Not one query returned an empty result set; every one
   returned a full, confident page. *Caparo Industries v Dickman* returns a 2017 employment claim
   against **Caparo Atlas Fastenings**; *ex p Coughlan* returns **Mrs M Coughlan v Brookes Jordan
   Ltd** (2020); the GCHQ case returns the **Strasbourg** sequel. §3.

3. **The largest closable gap is not pre-2001 at all — it is the House of Lords, and it runs to
   2009.** We hold **0 UKHL judgments**, in any collection, measured. The Lords was the final
   court of appeal until 30 July 2009; Find Case Law does not publish it and never has. The whole
   set — 14 Nov 1996 to 30 Jul 2009, roughly 760 judgments — sits on `publications.parliament.uk`
   under the **Open Parliament Licence v3.0**, which expressly permits commercial exploitation and
   contains **no** computational-analysis exclusion. §1.3, §2, Option B.

4. **Money is not the constraint and it is not close.** On measured unit costs, a thousand
   judgments cost **$0.44 to embed and $0.02 a month to store**. The constraints are (a) licence,
   (b) engineering days, (c) the fact that for **pre-1996 English judgments there is no free lawful
   bulk source in existence** — which is why the ten canonical authorities in §3 cannot be bought
   at any of these prices. §2.

---

## §1 — WHAT IS AVAILABLE, AND ON WHAT TERMS

### 1.1 BAILII — BLOCKED. The terms were read, not recalled.

Source: <https://www.bailii.org/bailii/copyright.html> (read in a browser 2026-08-22 23:49 UTC),
and <https://www.bailii.org/robots.txt>.

Permission granted, in full:

> *"Subject to the rights of third parties … and to the prohibited uses set out in paragraph 6
> below, users may copy, print and distribute legal materials published on BAILII's website free of
> charge and without any other authorization from BAILII, provided that BAILII is identified as the
> source of the document."*

The prohibited uses, verbatim and complete:

> **"Prohibited Uses**
> *(a) incorporating search results or HTML versions of judgments into another website or into the
> output of a computer program not provided by BAILII itself (including apps or other programs used
> on a hand-held device or tablet computer);*
> *(b) storing search results or HTML versions of judgments*
> *(c) external indexing of documents by web robots or spiders when such use is not authorized by
> the instructions in the robots exclusion file at https://www.bailii.org/robots.txt or in a META
> tag in the HTML code of a published document, in compliance with the Robots Exclusion Protocol;*
> *(d) abusive use of the BAILII website's resources and services via automated mechanisms or
> otherwise, in particular for bulk downloading of documents."*

And the enforcement posture:

> *"BAILII monitors the use of automated mechanisms to access its website, and its policy is to
> block entire domains which use such mechanisms without authorisation, until a proper explanation
> is provided."*

**What (a)–(d) mean for us, precisely.** An ingest is (b) plus (d); serving it through Lex is (a);
building an FTS/vector index over it is (c). Paragraph (c) is conditioned on the robots file, and
the robots file closes it:

```
User-agent: *
Disallow: /eu   /ew   /ie   /je   /nie   /scot   /sh   /uk   /wales   /worldlii
User-agent: GPTBot
Disallow: /
```

Every jurisdiction path is disallowed to every crawler, and `GPTBot` is disallowed from the whole
site. ⚠ Since this sprint's first fetch, BAILII also runs an **Anubis proof-of-work challenge**
(v1.25.0) whose own interstitial says it exists *"to protect the server against … AI companies
aggressively scraping websites"*. `curl` with a custom User-Agent got the challenge; a real browser
passed it. A stated licence position, a robots file and a proof-of-work wall are three independent
statements of the same intention.

**⚠ THE COMMERCIAL QUESTION, ANSWERED SEPARATELY AS ASKED.** BAILII's terms draw **no**
commercial/non-commercial distinction in the prohibitions. Its funding note *requests* donations
from "commercial users … and educational institutions", but that is a funding appeal, not a
licence tier. So `commercialUseExcluded` is the wrong flag: there is no permitted non-commercial
version of what we would need to do. A commercial arm changes nothing here in either direction.

**⚠ AND A CORRECTION TO OUR OWN REGISTER.** `CORPUS_CLOSURE_REGISTER.md` §1 Tier 7 records
`bailii` as *"declined by BAILII"*. **That decline is not evidenced anywhere in this repository.**
`docs/data-access-requests/bailii-request.md` is still headed *"Status: Draft — for Charlie to
send if initial contact doesn't progress"*, `OUTREACH_EMAILS.md` has no BAILII entry, and no reply
is recorded in the change log. The register's **outcome** is right; its **reason** may be an
inference that hardened into a fact. If nobody ever asked, the door is closed by the published
terms rather than by a refusal — a distinction that matters only if Charlie ever wants to ask.

**⚠ AND A CORRECTION TO OUR OWN SIZING.** `docs/corpus-census.md` carries "BAILII | 2,000,000".
BAILII's own About page says: *"In August 2019, BAILII included 102 databases covering 10
jurisdictions. The system contains around 169 gigabytes of legal materials and around 1,001,463
searchable documents."* That is **documents of all kinds including legislation, in 2019** — not
judgments, and not today. Our census figure is roughly double the source's own, and unsourced.

### 1.2 Find Case Law (The National Archives) — LAWFUL, WITH A FREE LICENCE, AND IT HAS NOTHING PRE-2001 FOR US

- **Open Justice Licence v2.0** permits copying, publishing, distributing and *"exploit\[ing\] the
  Information commercially"* with the attribution *"Contains information licensed under the Open
  Justice – Licence v2.0."* It excludes *"computational analysis of the Information (including
  indexing by search engines)"* — which is exactly what our FTS and vector indexes are.
- The **computational analysis licence** closes that: **free to apply**, assessed against the Five
  Safes framework and nine principles, *"It may take a few weeks until you receive a decision"*.
  Per the Law Gazette's interview with TNA's digital director John Sheridan, **"25 such licences
  have been granted"** and none refused (several were revised before approval).
  ⚠ One of the nine principles — *Discoverability* — requires that a licensee *"must not index the
  contents of judgments and decisions on search engines"*. That is a **serving** constraint on
  `tna-caselaw` (auth-only, noindex) and the register already carries it.
- **Coverage.** From FCL's own courts-and-tribunals page, read 2026-08-22: Court of Appeal (Civil)
  **2001**, everything else in the senior courts **2003**, Supreme Court and Privy Council **2009**.
  There is **no House of Lords court at all**. The only genuinely old FCL material is tribunal:
  Care Standards from **1985**, VAT & Duties from **1989**, the Information Tribunal from **1990**,
  Special Commissioners from **1999**.
- **Is TNA going to backfill?** No sign of it. Sheridan's expansion plans are *forward and
  downward* — county court judgments where the judiciary flags them significant, more tribunals,
  *"Maybe one day"* for magistrates. Nothing about pre-2003.
- ⚠ **But TNA is the one body that has already done what we cannot.** FCL's own service pages state
  that judgments given before 19 April 2022 *"have been sourced by The National Archives from a
  variety of different sources, including BAILII."* TNA has a route into BAILII's back catalogue
  that we do not have and will not get. **Asking TNA to extend coverage backwards is the only
  realistic path to pre-2001 English case law at scale, and it costs one email.**

### 1.3 The House of Lords judicial archive — LAWFUL, BOUNDED, AND WE HOLD NONE OF IT

<https://publications.parliament.uk/pa/ld/ldjudgmt.htm>, read in a browser 2026-08-23 00:04 UTC:

> *"This page lists HTML versions of all House of Lords judgments delivered from 14 November 1996
> to 30 July 2009."*

**Licence — Open Parliament Licence v3.0** (<https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/>):

> *"You are free to: copy, publish, distribute and transmit the information; adapt the information;
> exploit the information commercially and non-commercially …"* subject to the attribution
> *"Contains Parliamentary information licensed under the Open Parliament Licence v3.0."*

⚠ **There is no computational-analysis exclusion in the OPL** — unlike the Open Justice Licence.
The licence states it *"includes Parliamentary information in which Crown copyright subsists"*, and
BAILII's own reading of Crown copyright (§1.1) points the same way: judgment text may be reproduced
free of charge with attribution. **Residual question, and it should be closed before a byte is
fetched:** whether Parliament regards judgments delivered in its judicial capacity as OPL material
or as Crown copyright administered elsewhere. Both answers permit what we need; only the attribution
line differs. Cost to close: one email to Parliament's copyright team. Do not skip it — this is the
`ssrn`/FCL lesson applied before rather than after.

### 1.4 Everything else considered, and why each is closed

| Source | Terms as published | Verdict |
|---|---|---|
| **ICLR** (Incorporated Council of Law Reporting) | Website Terms cl. 4.3: no part of the site *"may be copied, reproduced, republished, uploaded, re-posted, modified, transmitted or distributed or otherwise used in any way for any non-personal, public or commercial purpose without our prior written consent"*. A separate **Computational Licence** for bulk analysis and ML training is publicly described. | **Open, at a price nobody has quoted.** The only route to pre-1996 English case law that is both lawful and complete. Needs an email to enquiries@iclr.co.uk and a number. Commercial-arm implications unknown until then. |
| **Cambridge Law Corpus** | 250,000+ UK cases back to the 16th century. Access restricted to applicants *"employed full-time by a recognised university"* holding *"a permanent position at the level of Assistant Professor (or higher)"*, research purposes only. | **Ineligible.** Not a licence problem we can solve; an institutional one. |
| **English Reports 1220–1873** (CommonLII, from Justis data) | Free PDFs, public-domain era. | **Real, and nearly useless to us.** Wrong century for a reformer, PDF-only, OCR described by law librarians as poor. |
| **Scottish Courts** | We already hold `scottish-courts` back to **1999-02-06** (1,203 pre-2001 sections). The publisher's own archive starts around September 1998. | **Effectively closed already** — months, not decades. ⚠ 2 rows carry a bogus `0001-01-01` date; a small data-quality item, not a coverage one. |
| **Judiciary NI** | We already hold `ni-judgments` back to **1984-09** (235 pre-2001 sections). | **Closed.** NI is our *best*-covered pre-2001 jurisdiction. |
| **ECtHR (HUDOC)** | Already held: `echr-hudoc`, 2,053 pre-2001 decisions back to 1956. | Held. ⚠ And it is the source of one of §3's three decoys. |
| **Westlaw / LexisNexis / vLex Justis** | Commercial subscription; bulk/computational re-use by separate negotiation. | Not priced. If ICLR's quote is unaffordable these will not be cheaper. |

---

## §2 — SIZE AND COST

### 2.1 What we hold, what the sources publish, and the difference (§5's three different things)

**HELD — measured against live Neon, 2026-08-23, no sampling:**

| collection | sections | of which pre-2001 | words | earliest |
|---|---:|---:|---:|---|
| `tna-caselaw` | 74,896 | **210** | 656,751,154 | 1965-08-08 |
| `et-decisions` | 293,403 | 0 | 291,435,626 | 2017-02-08 |
| `scottish-courts` | 13,070 | **1,203** | 80,067,110 | 1999-02-06 |
| `ni-judgments` | 7,927 | **235** | 40,857,928 | 1984-09-06 |
| `tax-tribunals` | 13,099 | 2 (1,010 undated) | 71,631,645 | 1989-11-09 |
| `echr-hudoc` | 4,460 | **2,053** | 17,991,627 | 1956-06-01 |
| **total pre-2001 case-law sections held** | | **3,703** | | |

⚠ **The brief's premise needs two corrections, both in our favour and one against.**
*In our favour:* we do **not** hold "no English judgment before 2001". `tna-caselaw` holds 210
pre-2001 items — Employment Appeal Tribunal and registered-homes tribunal decisions that FCL
inherited — and among them are *P Burchell v British Home Stores Ltd* (recorded 1977-12-23) and
*D Polkey v Edmunds Walker (Holdings) Ltd* (1983), the tribunal stages of two of the best-known
authorities in employment law. Add Scotland, NI and Strasbourg and the pre-2001 holding is 3,703.
*Against:* the cliff is not 2001, it is **2003** — `tna-caselaw` holds **29** items dated 2001–2002
against 74,657 from 2003 on.

**PUBLISHED — from Find Case Law's own coverage page, 2026-08-22: 94,547 documents** (66,941 court,
27,606 tribunal). Paired against what we hold, where the courts align one-to-one:

| court | FCL publishes | we hold | shortfall |
|---|---:|---:|---:|
| Supreme Court | 963 | 948 | 15 |
| Privy Council | 709 | 704 | 5 |
| Court of Appeal (civ + crim) | 22,658 | 22,487 | 171 |
| High Court (11 divisions) | 39,605 | 39,132 | 473 |
| Employment Appeal Tribunal | 825 | 788 | 37 |
| **House of Lords** | **0 — FCL does not publish it** | **0** | — |

⚠ **The senior-court mirror is 98–99% complete.** The headline 94,547 − 74,896 = 19,651 gap is
**not** a work list: it sits almost entirely in the First-tier and Upper Tribunal chambers, where
FCL's FtT (Tax) 9,780 and our separate `tax-tribunals` collection (13,099) overlap by an amount
**nobody has measured**. Quoting 19,651 as a backlog would be the publishes/could-fetch/hold
conflation the brief names, so it is not quoted as one here.

### 2.2 Unit costs, measured on the collection we already have

| unit | value | how it was obtained |
|---|---:|---|
| words per judgment | **8,769** | 656,751,154 ÷ 74,896, live |
| Neon heap per judgment | **7,496 bytes** | 535 MB ÷ 74,896, `pg_column_size`, live (the `tsvector` is 8,205 B of it) |
| chunks per judgment | **7.20** | 539,454 ÷ 74,896 (S12 §2, measured) |
| embed cost per chunk | **$0.0000612** | $33 for the 539,454-chunk case-law embed (S12) |
| **embed cost per judgment** | **$0.00044** | the two above |
| R2 bytes per judgment | **≈55 KB** | ⚠ **ESTIMATE**, 8,769 words × 6.3 B/word. Not measured — `corpus_sections` stores no byte count. |
| storage price | **$0.35 / GB-month** | as instructed |

⚠ **The whole-corpus embed rate would understate this by 3×.** The corpus embed was $430–520 for
22.7M chunks ($0.000019–0.000023/chunk); the case-law-specific measurement is $0.0000612. The
higher, collection-specific figure is used throughout. ⚠ **And these are still likely low** —
project estimates have run low twice this month, most recently the S12 chunk-count prediction
(539,454 actual against a 480–520k prediction). Treat every dollar figure below as a floor.

**Sanity check on the whole existing collection:** 74,896 judgments ≈ 4.1 GB in R2 = **$1.44 a
month**, 535 MB in Neon, and its complete re-embed cost $33. **Case law is a cheap collection.**
⚠ Neon is at **17.71 GiB** today — past the 17.5 GiB *ops alert line*, though the enforced ceiling
is 16 TiB (V38). None of the options below moves that materially, but each adds to a number the
observer is already red on.

### 2.3 The four options, costed

| | Option A — catch up with FCL | Option B — the House of Lords archive | Option C — leading cases, pre-1996 | Option D — declare the boundary |
|---|---|---|---|---|
| **What** | Ingest whatever FCL publishes that we do not hold, under the computational licence | ~760 HoL judgments, 14 Nov 1996 – 30 Jul 2009, of which **~250 are pre-2001** | A hand-listed 500–1,500 authorities a reformer actually meets | No ingest. Make the corpus say where its case-law coverage stops |
| **Lawful?** | **Yes** — OJL v2.0 + the free computational licence (25 granted, 0 refused) | **Yes** — OPL v3.0, commercial use expressly permitted, no computational exclusion. §1.3's one residual question first | **Only via a paid ICLR computational licence.** No free lawful bulk source exists for pre-1996 English judgments | Yes — nothing leaves the building |
| **Judgments** | senior courts ~700; tribunal chambers unmeasured (§2.1) | ~760 (300 measured across 2005–09 on the index page, extrapolated over 12.7 years — **an extrapolation, not a count**) | 500–1,500 | 0 |
| **Fetch time** | ≥1.6 h at FCL's cap of 1,000 requests / 5 min / IP; ~5.5 h at a polite 1 req/s | ~13 min at 1 req/s. ⚠ **But Node's `fetch` is blocked outright on parliament.uk hosts by Cloudflare TLS fingerprinting — documented in our own code** (`scripts/ingest/committees-freshness.ts`). Pilot 20 documents before committing | per-case, manual or licensed bulk | — |
| **One-off $** | embed **$9–15** | embed **< $2** | embed **< $1** + **an unknown ICLR fee** | $0 |
| **$/month** | +$0.38 R2 (+147 MB Neon) | +$0.02 R2 (+6 MB Neon) | +$0.03 | $0 |
| **Engineering** | 2–3 days (adapter exists; this is reconciliation + a drain) | 3–5 days (new adapter, the Cloudflare workaround, the §2.4 quality gate) | 5–15 days **after** a licence lands | ~2 days |
| **What §3 says it buys** | **0 of 10.** FCL has nothing pre-2001 but tribunals | **0 of 10** — every one of the ten is pre-1996 — but it closes the **only top-court gap we have**, including a *post*-2001 one (2001–2009) nobody had counted | **up to 10 of 10.** The only option that answers the actual question | **10 of 10 stop being confidently wrong.** None of them start being right |

### 2.4 The text-quality check, named and costed — §2's last requirement

The 2001+ collection was stored **with its rendering stylesheet inside every judgment** for months
and nobody noticed. The equivalent failure for Option B is obvious in advance: `publications.parliament.uk`
serves judgments as **HTML pages wrapped in Parliament's site navigation**, so the naive extraction
stores "Accessibility Email alerts RSS feeds Contact us Home Parliamentary business…" as the opening
of *Pepper v Hart*. The check that catches it **on day one**:

1. **A positive assertion, not an absence test.** For each of the first 50 fetched: the compiled
   text's first 300 characters must contain the case name **and** the `[YYYY] UKHL n` citation, and
   must not contain `Accessibility`, `RSS feeds`, `Parliamentary business` or `<style`.
2. **A stopword-density band.** English judicial prose runs ~4–7% "the". Navigation chrome and
   markup residue do not. Assert the band per document; a document outside it is quarantined, not
   stored.
3. **A length distribution.** HoL judgments run thousands of words. Anything under 500 is a
   retrieval failure wearing a success.
4. **Five hand-reads, by a person, before the other 755 are fetched.**
5. ⚠ **Fire the check red before green.** Feed it the raw page bytes and require it to fail; a gate
   that has never failed is not known to be a gate (`feedback-checks-that-cannot-fail`).

**Cost: half a day, inside Option B's 3–5.** It is not optional and it is not deferrable to the end
of the run — that is precisely how the stylesheet survived for months.

---

## §3 — WHAT IT WOULD BUY, MEASURED

**Harness:** `scrutinise-web/scripts/probe-pre2001-caselaw.ts`, calling the real `runSearch()`
behind `harness-preflight`. Raw output: `docs/pre2001_probe.json`.
**Configuration, printed with the result as required:**
`fts=fts-serve-production · vector=vector-serve-production · streams=legislation,caselaw · router=ON · fully-configured`, service engagement proved either side (`fts +78 · vector +26` — a run that reached
no service returns zeros indistinguishable from absence).

**Two arms per question.** *Lay* — the question as a reformer would type it. *Named* — the case name
typed in directly, scoped to `tier=caselaw`, which is the corpus's **best chance**.

| # | Authority | Lay arm — what a reformer gets | Named arm (the corpus's best chance) | Verdict |
|---|---|---|---|---|
| 1 | *Anisminic v Foreign Compensation Commission* (1969) | 150 rows, 0 pre-2001 case law. Top: Explanatory Notes to the Judicial Review and Courts Act 2022; Tribunals, Courts and Enforcement Act 2007 | 30 rows. Top: *Privacy International* (2017), a tax-chamber decision, *R v Investigatory Powers Tribunal* (2019) | **ABSENT** |
| 2 | *Pepper v Hart* (1992) | 150 rows. Top: Interpretation Act 1978; an Interpretation and Legislative Reform (Scotland) SI | Top: **Mr M J Pepper v Ascus Pumps Ltd** (2022), then two *Hart* employment claims | **ABSENT** |
| 3 | *Wednesbury* (1947) | 150 rows. Top: Tribunals, Courts and Enforcement Act 2007; the Judicial Review and Courts Act 2022 Bill papers | 30 rows of judicial-review judgments, 2004–2014, none the case | **ABSENT** |
| 4 | *CCSU v Minister for the Civil Service* (GCHQ, 1984) | 150 rows. Top: Investigatory Powers Act 2016; a 2006 debate on prerogative powers | **rank 0: *COUNCIL OF CIVIL SERVICE UNIONS et al v. THE UNITED KINGDOM* — the ECtHR, 1987** | **DECOY** |
| 5 | *Caparo Industries v Dickman* (1990) | 150 rows, 0 pre-2001 case law. Top: Corporate Manslaughter Act 2007; Consumer Rights Act 2015 | **rank 3: *Unite The Union v Caparo Atlas Fastenings Ltd*, employment tribunal, 2017** | **DECOY** |
| 6 | *Donoghue v Stevenson* (1932) | 150 rows. Top: Consumer Protection Act 1987, twice | Top: ***Donoghue v Folkestone Properties* (2003)**, then *Mrs V Donoghue v MJ Gleeson Developments* (ET, 2019) | **ABSENT** |
| 7 | *Factortame (No 2)* (1990) | 150 rows. Top: EU Act 2011 notes; European Union (Withdrawal) Act 2018 | 30 rows, none the case | **ABSENT** |
| 8 | *M v Home Office* (1993) | 150 rows. Top: Contempt of Court Act 1981 **twice**, then an **1888** Commons question | 30 rows, none the case | **ABSENT** |
| 9 | *ex p Coughlan* (1999) | 150 rows. Top: Care Act 2014; a Scottish Parliament debate on **"The Promise"** | **rank 18: *Mrs M Coughlan v Brookes Jordan Ltd*, employment tribunal, 2020** | **DECOY** |
| 10 | *Ridge v Baldwin* (1963) | 150 rows. Top: the Cleveland Tertiary College (Government) Regulations 1994 | Top: *Mrs S Ridge … v Avery of Loxley Park* (2021); *Mr J Chumber v **Ridge** Concrete* (2021); ***Baldwin**, R. v* (2021) | **ABSENT** |

⚠ **THE TABLE IS ONE RUN, AND THE ROWS MOVE.** Stream selection and per-stream query rewriting are
LLM decisions, so the same question returns a different page each time: on the first run
*Pepper v Hart* returned an explanatory memorandum on **meat (official controls) charges** at rank
0 and *Wednesbury* returned two HMRC penalty-manual pages in its top five. **The verdicts reproduced
exactly across both runs — 10 absent, the same 3 decoys — and only the wrong answers changed.**

**Result: 10 of 10 not held. 3 of 10 returned a same-name different case. 0 of 10 returned nothing.**

⚠ **THE SECOND ROW IS THE ONE TO LEAD WITH, AS THE BRIEF SAYS.** Every single question produced a
full page of plausible material — statutes on the right subject, debates using the right words,
tribunal decisions with the right party name. A reformer asking *"can a court review a decision the
Act says is final?"* gets *R (Cart) v Upper Tribunal* and *Privacy International*: both real, both
on-topic, both **downstream of an authority the platform cannot see or name**. The absence does not
present as an absence. It presents as an answer.

⚠ **AND THE HARNESS ITSELF PRODUCED A CONFIDENT WRONG ANSWER FIRST.** Run 1 matched on case name
alone and reported **3 of 10 HELD**. All three were the decoys above. The classifier now requires a
name match to be in the right era *and* not in a tribunal or Strasbourg collection before it may say
HELD, and it prints the matched row either way so the call can be adjudicated rather than trusted.
Recorded because it is the same failure the sprint is measuring, committed by the instrument
measuring it.

⚠ **NOT A SCORE.** n = 10, hand-picked to illustrate one gap. These are **not** gold questions,
carry no recall figure, and must never be reported beside the 65-question baseline. A different ten
would give a different ten.

---

## §4 — THE DECISION

### D-1. Declare the boundary. **Recommended: do this regardless of every other answer.**
Case-law results carry no statement of where coverage begins, so a doctrinal question returns
post-2003 material with no signal that the governing authority is out of view. Make the case-law
collections declare their floor (2003 for English courts, 1999 Scotland, 1984 NI) and have Lex say
so when a question is doctrinal.
**Consequence if taken:** ~2 engineering days; ten confidently-wrong answers become ten honest ones;
**the gap itself does not close** and users will be told about a hole we have chosen not to fill.
**Consequence if not taken:** the §3 behaviour continues, and it is the exact failure mode §0 of the
brief says the platform exists to avoid.

### D-2. Take the House of Lords archive (Option B). **Recommended second.**
~760 judgments, ~250 of them pre-2001, under a licence that permits commercial use and says nothing
about computational analysis. It also closes a gap nobody had counted: **we hold zero judgments of
the court that was the UK's final appellate court until 2009.**
**Consequence if taken:** 3–5 engineering days, under $2, ~60 MB. Confirm the OPL/judicial-copyright
question by email first, and pilot 20 documents against the Cloudflare block before committing.
**Consequence if not taken:** *Pinochet*, *Belmarsh*, *Ghaidan*, *Jackson v Attorney General* and
the rest of the 1996–2009 constitutional canon stay invisible, and the platform keeps answering
constitutional questions from High Court judgments that were applying them.

### D-3. Fold the FCL catch-up into the licence application already on your list (Option A).
The computational-analysis licence is free, 25 have been granted and none refused, and it
**retrospectively legitimises the 74,896 judgments we already index**. The catch-up itself is
2–3 days and buys 0 of 10.
**Consequence if taken:** the existing collection's legal footing stops being an open item.
**Consequence if not taken:** we continue to run FTS and vector indexes over FCL material in the
teeth of the OJL's own exclusion. ⚠ This is the item with **legal exposure attached to the status
quo** rather than to the change.

### D-4. Ask two questions by email, this week, before spending anything.
(a) **The National Archives** — will FCL extend coverage backwards, and would they take a
non-profit's help doing it? They already sourced their pre-2022 back catalogue from BAILII; they
have the relationship we do not. (b) **ICLR** — what does a Computational Licence cost a
not-for-profit, and what would it cost a commercial arm?
**Consequence if taken:** two emails; the answers decide whether Option C exists at all.
**Consequence if not taken:** Option C stays unpriced, and "pre-2001 case law" stays an
unanswerable question rather than an expensive one.

### D-5. BAILII stays blocked. No further action.
**Consequence:** we forgo the single largest collection of British case law in existence, and we do
it deliberately, on published terms, for the same reason `ssrn` is blocked. ⚠ Worth one line in the
register to correct *"declined by BAILII"* to *"prohibited by BAILII's published terms of service
(paragraph 6(a)–(d)) and robots.txt; no request is recorded as having been sent"*.

---

## §5 — WHAT COULD GO WRONG

1. **The stylesheet failure, in a new costume.** Parliament's HTML is site chrome wrapped around a
   judgment. §2.4's gate, fired red before green, on day one, on the first 50.
2. **Cloudflare.** Node's `fetch` cannot reach parliament.uk hosts at all — documented in our own
   code, and rediscovered the hard way in August. Option B's fetch route must be piloted on 20
   documents before it is planned around, and Railway IPs are separately blocked on some hosts.
3. **The OPL/judicial-copyright question turns out to be the other answer.** Unlikely, and the
   downside is an attribution line, not a block. But asking costs one email and the FCL exclusion
   is precisely what we did not check the first time.
4. **A pre-2001 ingest makes retrieval *worse* before better.** Adding 760 or 1,500 documents to a
   BM25 index moves document frequencies for the whole table — S11 measured 0 of 5 rankings
   surviving the last case-law rewrite. Any baseline taken across such an ingest is void, and the
   65-question baseline must be re-taken after, not compared across.
5. **A "leading cases" list is an editorial act.** Choosing 1,000 authorities is choosing what the
   platform thinks the law is. It needs a published, sourced selection rule — a practitioner text's
   table of cases, say — not a model's recall of what matters.
6. **Decoys survive an ingest.** *Coughlan* and *Caparo* rank where they do because of name
   collisions with employment tribunal parties. Adding the real judgments does not remove the
   decoys; citation-aware resolution does, and that is a separate piece of work.
7. **The 19,651 number escapes into a plan.** It is a subtraction between two differently-shaped
   sets, not a backlog. It is flagged here because this is the fourth time this month the
   publishes/could-fetch/hold distinction has cost hours.

---

*Artefacts: `scrutinise-web/scripts/probe-pre2001-caselaw.ts` (the §3 harness) ·
`docs/pre2001_probe.json` (its raw output, 10 questions × 2 arms, every returned row).
No downloader, no seeder, no schema change, no bulk fetch.*
