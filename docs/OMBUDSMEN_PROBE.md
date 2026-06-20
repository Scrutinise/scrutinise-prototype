# OMBUDSMEN PROBE — V29 §7

**Date:** 20 Jun 2026 · **By:** CC (V29). A whole uncaptured family of
quasi-judicial bodies that interpret and apply law to real cases. Mirroring
`EXEMPT_ORGS_PROBE.md`: this **sizes + licence-checks at the source**, builds
only the cleanest open-licence body this sprint, and ranks the rest for V30.

**Licence is the gating criterion** (cf. INGEST_PLAYBOOK §18, LICENCE_COMPLIANCE).
Many ombudsmen assert their own copyright with no open licence. Each licence
below was read at the body's actual terms/copyright page, not a footer grep.

## Summary table

| Body | Route | Size | Licence (verified at source) | Verdict |
|------|-------|------|------------------------------|---------|
| **LGSCO** (Local Government & Social Care Ombudsman) | `lgo.org.uk/decisions/{category}` paged HTML (10/page; 10 categories) → per-decision HTML | Large (decisions since 2013 — 9 of 10 categories populated; ~10⁴–10⁵) | **OGL-EQUIVALENT, CLEAN ✓** — lgo.org.uk/copyright: "re-use the information on this website free of charge in any format … copying, issuing copies to the public, publishing, broadcasting and translating … acknowledge the source and our copyright; reproduce accurately; not misleading; not for advertising" | ✅ **BUILT + PILOTED** (`lgsco`, `lgsco-open`) |
| **Housing Ombudsman** | `housing-ombudsman.org.uk/decisions/` (paged) | **165,524 decisions** (largest prize) | **UNVERIFIED** — no terms/copyright page found in the footer (only an accessibility link); `sitemap_index.xml` present | ⏸ V30 — licence unverified; chase a re-use statement (huge if cleared) |
| **Financial Ombudsman Service** | `financial-ombudsman.org.uk/decisions-case-studies/ombudsman-decisions/search` (paged DB; sitemap 1,094 locs) | 100k+ final decisions since 1 Apr 2013 | **RESTRICTIVE** — /legal-policy: "we own the copyright … You must not reproduce our copyright material, or store any part of this site in any … retrieval system, without our prior permission" | ⏸ V30 — permission email required |
| **Pensions Ombudsman** | determinations DB (`pensions-ombudsman.org.uk`; small sitemap) | ~thousands of Determinations | **CONDITIONAL** — /terms-and-conditions: "no objection to organisations downloading its copyright-protected materials … and reproducing them in their own publications … subject to" attribution + no-misleading + contact-if-contravening. A limited grant, **not a standard open licence** | ⏸ V30 — borderline; email to confirm open re-use |
| **PHSO** (Parliamentary & Health Service Ombudsman) | sitemap 1,802 locs; case-summaries / reports | ~thousands of case summaries + reports | **UNVERIFIED** — no copyright/terms page surfaced in the footer (accessibility + privacy only); the case-summaries path guessed in the probe 404'd (needs re-resolving) | ⏸ V30 — licence unverified; re-resolve route + read terms |

## The clean win — LGSCO (built)

LGSCO is the ombudsmen analogue of ICO in the V27 exempt-org probe: the one body
with a clear open re-use statement. Its copyright page carries the **verbatim OGL
permission wording** on a bespoke statement (it does not cite "OGL" by name, so
the code is `lgsco-open`, OGL-equivalent — free re-use in any format, with
attribution, accuracy, non-misleading, non-advertising conditions we meet).

- **Route:** `lgo.org.uk/decisions/{category}?page=N` lists 10 decision-detail
  links per page (`/decisions/{cat}/{subcat}/{ref}`); each detail page is
  server-rendered HTML with the decision in `<main>`. Walked queue-driven with
  self-propagating `list:{category}:{page}` rows (the DB is large).
- **Pilot:** decision `25-009-294` → 1,024 words clean (Shropshire Council,
  "Not upheld", date extracted). 9 of 10 categories populated (health = 0; health
  complaints go to PHSO).
- **Files:** `sources/lgsco.ts`, `processLgsco` (sourceType `lgsco`, corpus
  `lgsco`), `v29-seed-lgsco.ts`, licence-map `lgsco`→`lgsco-open`, rate-limit
  1000ms/2. **Seed POST-PUSH** (`v29-seed-lgsco.ts --seed`); Railway egress
  canary first. Re-baseline at drain (universe currently NULL/unconfirmed).

## Ranked V30 build list (Charlie to prioritise)

1. **Housing Ombudsman** — by far the biggest prize (**165,524 decisions**), clean
   paged route. Gated ONLY on a licence statement — chase a re-use confirmation
   (the site shows no copyright page; an email or a found statement unblocks a
   huge corpus).
2. **PHSO** — Crown-ish body (Parliamentary Commissioner); its reports may well be
   OGL/Crown copyright once the right terms page is found. Re-resolve the
   case-summaries/reports route + read the terms.
3. **Pensions Ombudsman** — small but binding (County-Court-enforceable
   Determinations); the conditional permission is close to open — a one-line email
   to confirm would clear it.
4. **Financial Ombudsman Service** — highest volume + relevance (financial-services
   law), but the licence is explicitly restrictive (prior permission required) —
   a formal re-use request, lowest near-term odds.

## Decision waiting on Charlie

- Re-use confirmation emails for **Housing Ombudsman** (highest value) and
  **Pensions Ombudsman** (closest to open); a formal re-use request to **FOS**;
  PHSO needs a route re-resolve before a licence read. Only **LGSCO** had a clear
  open licence and was built this sprint.
