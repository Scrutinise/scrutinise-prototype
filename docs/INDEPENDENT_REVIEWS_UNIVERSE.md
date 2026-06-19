# INDEPENDENT REVIEWS — UNIVERSE & SCOPING (V28 §6)

*Created 19 Jun 2026. Scoping only this sprint (brief §6): build the register,
probe one review end-to-end, seed only that one if clean. The family becomes a
ranked V29 build list.*

## What this family is (and is not)

Commissioned **independent reviews / audits** are NOT statutory public inquiries
(Inquiries Act 2005) — they are expert-led reviews commissioned by a department,
arm's-length body, or the NHS, and are a distinct, currently-uncaptured family.
They sit alongside (not inside) `inquiry-reports`. Many are gov.uk-published
under OGL v3.0 as publication-attachment PDFs — identical machinery to
`inquiry-reports` — but some live on a commissioning body's own domain.

## End-to-end probe (Casey, 2025) — CLEAN ✓

`government/publications/national-audit-on-group-based-child-sexual-exploitation-and-abuse`
→ 2 report PDFs; lead PDF fetched + extracted via the `inquiry-reports`
machinery (`fetchPdfBuffer` → `pdfToText`): **72,663 words, clean text**
("National Audit on Group-Based Child Sexual Exploitation and Abuse, Baroness
Casey of Blackstock, June 2025"). Confirms the family is buildable today via the
gov.uk content API with no new fetch infrastructure. OGL v3.0 (gov.uk-published).

## Register (PDF-verified on gov.uk unless noted)

| Review | Commissioning body | Year | Route | Licence | Est. (report PDFs) |
|---|---|---|---|---|---|
| Casey — National Audit on Group-Based CSE | Home Office | 2025 | gov.uk `national-audit-on-group-based-child-sexual-exploitation-and-abuse` | OGL v3.0 | 2 ✓ |
| Augar — Post-18 education & funding | DfE | 2019 | gov.uk `post-18-review-of-education-and-funding-independent-panel-report` | OGL v3.0 | 7 ✓ |
| Williams — Windrush Lessons Learned | Home Office | 2020 | gov.uk `windrush-lessons-learned-review` | OGL v3.0 | 4 ✓ |
| Lammy Review (criminal justice & BAME) | MoJ | 2017 | gov.uk `lammy-review-final-report` | OGL v3.0 | 3 ✓ |
| Taylor — Modern Working Practices | BEIS | 2017 | gov.uk `good-work-the-taylor-review-of-modern-working-practices` | OGL v3.0 | 1 ✓ |
| Francis — Freedom to Speak Up | DH | 2015 | gov.uk `sir-robert-francis-freedom-to-speak-up-review` | OGL v3.0 | 1 ✓ |
| Cass — Gender Identity Services for CYP | NHS England | 2024 | own domain `cass.independent-review.uk` (NOT on gov.uk — needs own-domain/Web Archive adapter) | verify | ~3 |
| Timpson — School exclusions | DfE | 2019 | gov.uk (path differs from guess — re-resolve) | OGL v3.0 | tbc |
| Laming — Protection of children (progress) | DfE | 2009 | gov.uk (overlaps Climbié inquiry corpus) | OGL v3.0 | tbc |

Many more exist (Wood, Munro, Jay/Rotherham, Casey 2015 Rotherham inspection,
Bichard, Macur, Carlile, Kerslake-Manchester, Marmot health-inequalities,
Stevenson/Farmer mental-health-at-work, Hodge, Dilnot, Leveson-2…). The gov.uk
Search API `independent_report` document-type bucket is the discovery surface;
the same PDF-verification pass used for the §4 inquiry register
(`v28-discover-inquiries.ts`, retargeted) enumerates them.

## V29 build recommendation

Build `independent-reviews` as a sourceType cloning the `inquiry-reports`
pattern (per-PDF rows, gov.uk publication attachments, OGL). A curated registry
(as above) plus a gov.uk Search-API discovery pass gives the universe; own-domain
reviews (Cass) get a Web Archive adapter (the same documented follow-up as the
dark-site inquiries). Estimated ~40–80 major reviews / ~150–300 report PDFs.
Probe confirms zero new fetch risk for the gov.uk-published majority.
