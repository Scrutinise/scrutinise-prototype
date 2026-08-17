# SEARCH CONTRACT — what can be asked of the corpus, and what comes back

**Status:** STANDING REFERENCE. ⚠ **A contract that has drifted is worse than none, because the next
reader trusts it.** Whoever changes what search can do updates this file **in the same commit**.
**Last verified:** 17 August 2026, against the running system and the code, not from memory.
**Owner:** CC-Search. **Audience:** every other stream — Lex, Graph, Central, Ingest.

This document exists because other streams have been building against guesses. It is written in
plain terms, not internal names: **`pwdata-debates` is not a thing anyone outside search should have
to know.**

---

## 1. What the corpus holds

**18,272,362 compiled documents across 74 collections — 6.37 billion words.** Every one is stored in
full and retrievable; nothing here is a summary or an abstract.

| What it is, in plain terms | documents | words |
|---|---:|---:|
| **What Parliament said and how it voted** — Commons and Lords debates back to the nineteenth century, written and oral questions, ministerial statements, division roll-calls, early day motions, public petitions, plus the Scottish Parliament, Senedd and Northern Ireland Assembly | 15,128,838 | 2.58bn |
| **The law itself** — every UK Act and statutory instrument, the devolved and regional equivalents, retained EU law, and the explanatory notes and memoranda that came with them | 1,633,583 | 245m |
| **What committees were told and concluded** — select committee reports and the written and oral evidence submitted to their inquiries | 464,718 | 721m |
| **What courts and tribunals decided** — UK case law, Northern Ireland judgments, Scottish courts, employment and tax tribunals, and Strasbourg | 405,622 | 1.18bn |
| **What regulators and government advise** — HMRC manuals, the FCA Handbook, Ofcom, Ofgem, the ICO, the CMA, CPS guidance, the College of Policing, the Sentencing Council, planning policy, building regulations, arm's-length-body publications | 329,711 | 1.24bn |
| **EU law as retained and mirrored** | 241,571 | 159m |
| **Bills in progress, and treaties** | 33,809 | 157m |
| **Impact assessments and consultations** | 26,204 | 19m |
| **Law Commission, NAO, OTS, independent reviews, OECD** | 4,858 | 67m |
| **MPs' declared interests** | 3,448 | — |

⚠ **Coverage is not completeness, and the gap is measured rather than guessed.** The corpus holds
**44.1% of what its sources publish** (`docs/CORPUS_COMPLETENESS.md`): 99.5% of post-2000 primary
Acts, but **21.4% of pre-2000 primary Acts** and 24.5% of retained EU law. If an answer depends on an
old Act, the absence of a result is as likely to be an ingest gap as an absence of law.

⚠ **Retrievable is not the same as held.** Some collections are in the corpus and reachable by no
search stream at all — see `docs/CORPUS_REACHABILITY.md`. Today that includes `members-interests`,
`erskine-may` where not bridged, `uk-treaties`, `tax-treaties-dta`, and `bills-api` outside the
legislation stream.

---

## 2. What can be asked for today

**One call, one `intent`.** The intent says *why* you are searching; the router decides which parts
of the corpus to interrogate and how to phrase the query for each. **A caller does not choose
streams.**

| intent | what it is for | what comes back |
|---|---|---|
| `BACKGROUND_BRIEFING` | the broad landscape for a new idea (Page 1) | everything relevant across all five streams; gets query expansion first |
| `LEGAL_LANDSCAPE` | what law governs this, and where it falls short | law-weighted, but not law-only |
| `CAUSE_SEEDING` | where has this problem been examined before | debates and committee reports |
| `POLICY_ALTERNATIVES` | how have others approached this | across streams |
| `AD_HOC_RESEARCH` | the user asked, in chat, for a corpus search | across streams |
| `PRECEDENT` | has this been tried — what it was for, what was predicted, what happened | explanatory notes, impact assessments, post-implementation reviews |
| `CAUSAL_EVIDENCE` | is the problem real and measured, and does the evidence support or contradict the diagnosis | across streams |
| `DEVOLUTION_SCOPE` | is the subject reserved or devolved | across streams |
| `GENERAL_CORPUS_CHAT` | an admin asking the whole corpus a question | untiered, fully routed |
| `IDEA_CHAT_GROUNDING` | legislation context for a Lex chat turn | ⚠ **legislation only — see §5** |
| `LEGISLATION_PANEL` | the Create-Idea side panel | ⚠ legislation only, and correctly so |
| `LEGISLATION_SEARCH` | the general `POST /api/search` endpoint | ⚠ legislation only, and correctly so |

**The five streams the router picks between:** the law · what Parliament said · what committees were
told · what courts decided · what regulators advise.

⚠ **`PRECEDENT`, `CAUSAL_EVIDENCE`, `DEVOLUTION_SCOPE` and `GENERAL_CORPUS_CHAT` are DESCRIPTIVE.**
They are logged and callers key off them, but they select no streams — **adding one changes no
retrieval for anyone.** If you need retrieval to actually change, that is a conversation with
CC-Search, not a new string.

---

## 3. What cannot be asked for yet

Named individually, with what each would take. **This list is the honest half of the contract.**

| not available | what it would take |
|---|---|
| **Committee evidence from the Lex chat route** | ⚠ **LIVE DEFECT, not a missing feature.** SEARCH S5, in progress. Three gates in series: `tier: 'legislation'`, then a `LEGISLATION_TYPES` filter that drops 24 of 36 results, then a response contract (`actTitle`/`sectionNumber`) that would hand a committee transcript to Lex **as a section of an Act**. Widening the tier alone measures as a no-op. |
| **Positions — who supports or opposes a specific claim** | Extracted and stored (GRAPH 2D-3/2D-4: 16,196 positions over one policy area) and **NOT exposed to search**. The hand-read error rate is 44%; it is not going in front of a user at that number. |
| **Contradiction retrieval** — "find evidence that disagrees with this" | A retrieval mode that scores opposition rather than similarity. Not designed. |
| **Cross-domain mechanism analogues** — "where else has a levy-and-rebate been used" | Reserved as `MECHANISM_ANALOGUE`. ⚠ **Naming it in the code is not scheduling it.** |
| **Anything on the open web** | A Gemini-grounded orientation pass exists behind `LEX_WEB_ORIENTATION` (measured: 10/12 signals against a corpus-only control of 1/12, ~30.8s and $0.076 per briefing). It is **not general web search** and it is flag-gated. |
| **Comparative law from other jurisdictions** | Reserved as `COMPARATIVE_LAW`. Nothing ingested for it. |
| **Amendable-section lookup** — "which section would this change amend" | Reserved as `AMENDABLE_SECTION`. |
| **Phrase / exact-quotation search** | The keyword index is built **without token positions** (`withPosition: false`), so there are no phrase queries. A quoted string is matched as a bag of words. |
| **Anything in the 55.9% of source material not ingested** | Ingest work, collection by collection. |

### ⚠ The never-claim rule for an unmet request

If Lex wants something search cannot give, **it says what it looked for and could not reach.**

> ✅ *"I looked for what committees have said about this and I can't reach committee evidence yet."*
> ❌ *"I don't have information on that."*

The second is a bad answer to the same situation, because **a user cannot tell it from the corpus
being empty.** The gateway already distinguishes the two: `GatewayResult.failed` is TRUE when the
search could not be completed, which is a different state from a completed search returning nothing.
**Callers must keep those apart in what they store and in what Lex is allowed to say.**

---

## 4. How to ask

```ts
import { runSearch } from '@/lib/lex/search-gateway'

const res = await runSearch({
  keywords: ['sewage', 'discharge', 'water company'],
  intent: 'CAUSE_SEEDING',
  ideaContext: 'optional — steers query expansion ONLY, never enters cited text',
  limit: 40,          // canonical results before grouping; grouping caps ~20
  // tier: 'legislation'  ⚠ see below — almost certainly not what you want
})
// res.results  — ranked, canonical
// res.grouped  — ≤3 per display type, ~20 total, panel-ready
// res.failed   — TRUE = the search could not run. NOT the same as "found nothing".
```

**`runSearch()` is the single point of contact.** It owns query building, expansion, routing,
retrieval, fusion and grouping. When search grows, this file changes and callers do not.

⚠ **Do not set `tier` because you *prefer* one kind of document.** It restricts retrieval to a single
tier and switches off streams the gold set says help. It exists only for callers whose response shape
has nowhere to put anything else. **A caller that merely prefers legislation must not set it.**

**Capability flags** (`LEX_QUERY_EXPANSION`, `LEX_QUERY_ROUTER`, `LEX_SEARCH_VECTOR`,
`LEX_WEB_ORIENTATION`, `LEX_SEARCH_RERANKER`, `LEX_SEARCH_GRAPH`) each gate one capability, default
OFF, read through `flagEnabled()` — never a bare `=== 'true'`, because a capitalised `TRUE` in Vercel
silently disabled the router and expansion for an unknown period.

⚠ **The live flag state is NOT readable from a development machine** (`VERCEL_TOKEN` is SAML-blocked).
Local `.env` sets `VECTOR_SEARCH_URL` and none of the `LEX_*` flags, so **a local harness runs
keyword-only and will look like a regression.** Confirm production state from the Vercel dashboard or
by reading a `served` counter off the running service — never by inference.

---

## 5. What each surface actually gets

**They differ, and the differences have caused two sprints of confusion.**

| surface | scope today | is that right? |
|---|---|---|
| **Page 1 background briefing** | all five streams, expansion on | ✅ yes |
| **Page 2 cause seeding** | all five streams | ✅ yes |
| **Build passes (25-A)** | two intents, `BACKGROUND_BRIEFING` + `LEGAL_LANDSCAPE`, one search each | ✅ yes |
| **The Deepening passes** | all five streams | ✅ yes |
| **`/admin/lex-general`** | untiered, fully routed | ✅ yes |
| **Create-Idea legislation panel** | legislation only | ✅ **right** — measured: it returns *Sewerage (Scotland) Act 1968 s.39* for the sewage question, which is what that panel is for |
| **`POST /api/search`** | legislation only | ✅ right for its contract |
| **The Lex chat route — the platform's main conversation** | **two channels, routed** | ✅ **FIXED by SEARCH S5 (17 Aug 2026).** It was legislation only: 36–146 non-legislation documents per question unreachable, not one committee document, debate or judgment reaching a user on any question, ever. It now calls `retrieveForChat()` with no tier, and returns **legislation and evidence separately**. Measured on the same ten questions: **90 documents the conversation could not previously reach**, 7 of 7 non-legislation questions now served (was 0 of 7), and **no legislation lost** on the three legislation-shaped questions. Latency p50 3.3s → 4.6s. |

---

## 6. ⚠⚠ WHEN LEX WANTS SOMETHING SEARCH CANNOT GIVE

**This is the rule that matters most in this document, and it is a never-claim rule.**

> **If Lex wants something and search cannot supply it, Lex says so plainly and specifically.**
>
> Not silence. Not a vague deflection. And above all **not an answer composed from general
> knowledge presented as though it came from the corpus.**

*"I looked for what select committees have said about this and I can't reach committee evidence
from here yet"* is a **good** answer. It tells the user what exists, what is missing, and that
somebody knows.

*"I don't have information on that"* is a **bad** answer to the same situation, because it is
indistinguishable from the corpus being empty.

⚠ **A gap that announces itself is a feature. A gap that looks like an absence of evidence is the
single most damaging thing this platform can produce**, because the user cannot tell the difference
and neither can we.

### How this is enforced rather than hoped for

| | |
|---|---|
| **The prompt says it** | `GAP_INSTRUCTION` in `lib/lex/chat-retrieval.ts`, injected whenever a gap is detected. It forbids the vague deflection **by name**. |
| **The gap is detected, not guessed at** | `kindsPlainlyAskedFor()` reads the question for the kind of material it asks about. If the user names committees and no committee material comes back, `gapNote()` tells Lex exactly that. |
| **A failed search is distinguished from an empty one** | When retrieval fails outright, the note says *the corpus was not consulted at all* — a different sentence, because they are different facts. |
| **The legacy fallback declares its own limits** | That path reaches legislation only and can never carry a second channel. It says so in the prompt instead of letting silence imply the corpus holds nothing else. |
| **A worked example** | Asked *"what did MPs argue in the debate on assisted dying"*, the OLD path matched `"assist investi"` inside an investigatory-powers SI and had to admit it found nothing. That is precisely the situation this rule governs. |

### ⚠ And every unmet request is logged

`LexUnmetRequest` records the **kind** that was wanted, the **keywords searched**, **which streams
the router chose**, and how many results came back. V37's gap-filler expects exactly this signal:
*what Lex looked for and could not get is the most direct evidence available about what the corpus
should hold next.* Every other gap signal we have is inferred from sweeps; this one is a real user
asking a real question and getting nothing.

⚠ **The question text is NOT stored.** A Stage-1 idea is private by design and a gap log is not a
reason to keep a copy of it.

⚠ **`streams` is the most diagnostic column**, because it separates two failures that look identical
from outside: *the router never selected committees* (our bug, fixable today) versus *it searched
committees and found nothing* (a corpus gap, the ingest stream's work). Read
`LexUnmetDemand`, which splits them.

### What Lex still cannot ask for

See §3. Today that is: cross-domain mechanism analogues, contradiction retrieval, positions, and
anything on the open web. **When Lex wants one of those, §6 applies — name it, do not improvise it.**

---

## Where the numbers in this document come from

- corpus sizes — `corpus_sections` on Neon, `status='compiled'`, 17 Aug 2026
- coverage — `docs/CORPUS_COMPLETENESS.md`, `docs/CORPUS_REACHABILITY.md`
- the Lex chat route — `docs/SEARCH_S4_REPORT.md`, measured through the running retrieval path
- intents, flags and the gateway shape — `scrutinise-web/lib/lex/search-gateway.ts`
- streams and their scopes — `scrutinise-web/lib/lex/stream-scopes.ts`
- index configuration — `scripts/ingest/search/build-fts-index.ts`
- positions — `docs/POSITION_GRAPH_2D3_REPORT.md`, `docs/POSITION_GRAPH_2D4_REPORT.md`
