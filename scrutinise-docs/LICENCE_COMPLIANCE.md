# LICENCE COMPLIANCE — hard build requirements for the serving layer

*Created V25 (16 Jun 2026). This file records licence commitments that constrain how
corpora may be SERVED — they are not enforced this sprint (ingest only) but MUST be
honoured when the search/serving layer is built. Flag every item here to the search
thread as a serving-layer constraint.*

---

## 1. Find Case Law (tna-caselaw) — the binding commitments

The Find Case Law corpus (`tna-caselaw`, Open Justice Licence v2.0) is reproduced under
TNA's terms. Charlie's licence application to The National Archives (the separate
**computational-analysis licence**, caselaw@nationalarchives.gov.uk) made the commitments
below. These are **HARD BUILD REQUIREMENTS** for when judgment text or anything derived
from it is served. They cannot be forgotten when serving is built.

### (a) Judgment text is AUTHENTICATED-ACCESS ONLY — no public URL
- Full judgment text (the `tna-caselaw` compiled sections / R2 bodies) must be reachable
  **only behind authentication**. No anonymous/public route may return judgment body text.
- No public permalink, no signed-URL handed to an unauthenticated client, no embedding of
  judgment body text in a publicly cacheable page.

### (b) `noindex` / robots / no crawlable route
- Any page that renders judgment text must send `X-Robots-Tag: noindex, nofollow` (and an
  in-page `<meta name="robots" content="noindex,nofollow">`).
- `robots.txt` must disallow any path under which judgment text could be served.
- No sitemap entry, no internal link, that exposes a judgment-text route to a crawler.

### (c) No open or third-party API exposing judgment text or extracted data
- No public/open API endpoint may return judgment body text, nor data extracted FROM
  judgments (citations, parties, holdings, catchwords, statistics, embeddings).
- No third-party (partner, analytics, LLM provider used as a *serving* surface) may be
  given a feed of judgment text or judgment-derived data for open re-exposure. (Using an
  LLM internally to answer an authenticated user's query is fine; publishing the extracts
  is not.)

### (d) No open-web publication of citation/entity/statistical extracts drawn from judgments
- Aggregates, citation graphs, entity lists, frequency tables, or any statistical/derived
  product computed over judgment text must NOT be published on the open web.
- Such derivatives may be shown only to authenticated users, and must not become a
  crawlable/open dataset or API.

### Enforcement hooks to build (serving layer)
1. A per-corpus `serving_visibility` flag: `tna-caselaw = auth-only`. The search/serving
   code must refuse to include `auth-only` corpora in any unauthenticated response path.
2. `X-Robots-Tag: noindex` + robots.txt disallow on all judgment-text routes.
3. A guard in any "open API" / export path that excludes `auth-only` corpora AND any
   table/feed of extracts derived from them.
4. A licence-aware compile/enrichment boundary: derivations OF judgment text inherit the
   `auth-only` constraint (extracts are as restricted as the source).

---

## 2. Non-commercial corpora — COMMERCIAL-SURFACE EXCLUSION

These corpora are fine for the not-for-profit charity surface but **default-excluded from
any commercial deployment** (link-only / omit on a commercial surface). Same posture across
all of them; record now so the serving layer can filter by licence class.

| Corpus | Licence | Constraint |
|---|---|---|
| `college-of-policing` | `college-nc` (Non-Commercial College Licence) | Commercial-surface excluded; commercial use needs College permission. Photographs excluded at ingest already. (V25 §3) |
| `oecd` | `cc-by-nc-4.0` | Non-commercial; per-document attribution required. |
| `nao-reports` | `nao-nc` | Non-commercial re-use with attribution; commercial use needs NAO permission. |
| `echr-hudoc` | `echr-nc` | Reproduced for information/education; commercial use needs ECtHR permission. |

Build hook: a `commercial_use` flag per licence class. On any future commercial surface, the
serving code must exclude (or link-only) every corpus whose licence is in the NC set above.

---

## 3. Restricted corpora — not servable without a licence agreement

| Corpus | Licence | Constraint |
|---|---|---|
| `fca-handbook` | `fca-restricted` | Reproduction/storage requires an FCA licence agreement. Do NOT serve Handbook text until that agreement is in place. (3,661 sections flagged.) |

---

## 4. Attribution that must travel with the text

Open corpora still carry attribution obligations (OGL/OPL "Contains … information licensed
under …"). The boilerplate per corpus is in `scripts/ingest/shared/licence-map.ts`; the
serving layer must surface the correct attribution string with any displayed section. Two
that are non-standard:
- `retained-eu` — dual OGL + Commission Decision 2011/833/EU.
- `sentencing-council` — acknowledgement must name Crown copyright AND the source document title.

---

*Owner: Charlie / search thread. Status: recorded V25, NOT yet enforced (no serving layer
built). Revisit at serving-layer design.*
