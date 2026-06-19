# PUBLIC INQUIRIES UNIVERSE — scoping register (V23 §5)

*Built 13 Jun 2026. Statutory/public inquiries are a NEW source family — each runs its own
site; concluded ones are preserved in the UK Government Web Archive, and most publish their
final reports on gov.uk. This register is the V24 build input; one inquiry was probed
end-to-end this sprint (Infected Blood). Sizes are ROUGH unless marked MEASURED.*

## Method

Two enumeration sources, cross-referenced:
1. **gov.uk organisations** faceted `filter_format=organisation`, q=`inquiry`/`review` → 22 concluded
   inquiry/review bodies whose gov.uk org pages persist (the historic backbone).
2. **Major current/recent statutory inquiries** (post-2015, Inquiries Act 2005) — each on its own
   `*.independent-inquiry.uk` / `*.public-inquiry.uk` domain, reports also mirrored to gov.uk.
3. **UK Gov Web Archive** (`webarchive.nationalarchives.gov.uk`, 200/302 live) preserves concluded
   inquiry sites whole — the CF-free, TNA-hosted route for sites that have gone dark.

**Licence:** inquiry reports are Crown copyright under OGL v3.0 (gov.uk-published) or the inquiry's
own OGL statement. Inquiry *evidence* bundles (witness statements, exhibits, disclosure) are
mixed-licence and often huge — explicitly **report-first, evidence-deferred** (brief §5).

## Probe result — Infected Blood Inquiry (concluded May 2024) ✓ route verified

- Reports: `gov.uk/government/publications/infected-blood-inquiry-reports` — **9 PDF report volumes**
  (Overview & recommendations; People's Experiences & Treloar's; What happened and why? ×3 vols;
  Response of Government & Public Bodies; Interim Report June 2022). MEASURED via the gov.uk content
  API `details.attachments`. application/pdf, pdfToText-extractable, OGL.
- Route is CF-free and clean. **Not seeded this sprint** — needs a small `inquiry-reports` sourceType
  (gov.uk publication-attachment PDF route differs from the existing govuk-content content-page
  processor). Turn-key for V24; recommended as the family's first seed.

## Register

| Inquiry | Status | Site / route | Reports | Transcripts/evidence | Est. report sections | Licence |
|---|---|---|---|---|---|---|
| UK Covid-19 Inquiry | ongoing | covid19.public-inquiry.uk + gov.uk | modular reports (Module 1 pub. 2024) | full transcripts + evidence (huge) | ~2-5k (reports) | OGL |
| Grenfell Tower Inquiry | concluded Sep 2024 | grenfelltowerinquiry.org.uk + WebArchive | Phase 1 (6 vol) + Phase 2 (final 2024) | full transcripts + evidence | ~3-6k | OGL |
| Post Office Horizon IT (Williams) | ongoing | postofficehorizoninquiry.org.uk | interim reports | full transcripts + evidence | ~2-4k | OGL |
| Infected Blood Inquiry | concluded May 2024 | gov.uk + infectedbloodinquiry.org.uk | **9 vols (MEASURED)** | full transcripts + evidence | ~2-3k | OGL |
| Manchester Arena Inquiry | concluded Mar 2023 | manchesterarenainquiry.org.uk + WebArchive | 3 volumes | full transcripts | ~1-2k | OGL |
| IICSA (child sexual abuse) | concluded Oct 2022 | iicsa.org.uk (live + archived) | final + 19 investigation reports | full transcripts + evidence | ~3-5k | OGL |
| Undercover Policing Inquiry | ongoing | ucpi.org.uk | interim reports | transcripts | ~1-2k | OGL |
| Brook House Inquiry | concluded Sep 2023 | brookhouseinquiry.org.uk + WebArchive | final report | transcripts | ~0.5-1k | OGL |
| Iraq Inquiry (Chilcot) | concluded Jul 2016 | gov.uk org + WebArchive (iraqinquiry.org.uk) | 12-vol report | evidence transcripts | ~5-8k | OGL |
| Leveson Inquiry | concluded 2012 | gov.uk org + WebArchive | 4-vol report | transcripts | ~3-5k | OGL |
| Bloody Sunday (Saville) | concluded 2010 | gov.uk org + WebArchive | 10-vol report | evidence | ~5-8k | OGL |
| Mid Staffordshire NHS (Francis) | concluded 2013 | gov.uk org + WebArchive | 3-vol report | transcripts | ~2-3k | OGL |
| Shipman Inquiry | concluded 2005 | gov.uk org + WebArchive | 6 reports | evidence | ~2-3k | OGL |
| Baha Mousa Inquiry | concluded 2011 | gov.uk org + WebArchive | 3-vol report | transcripts | ~1-2k | OGL |
| Azelle Rodney / Billy Wright / Rosemary Nelson / Robert Hamill (NI) | concluded | gov.uk org + WebArchive | single reports | transcripts | ~0.3-1k each | OGL |
| + ~12 further concluded (Equitable Life, Redfern, ICL, Zahid Mubarek, Victoria Climbié, BCCI, Royal Liverpool, Sutherland, Mull of Kintyre, Macur, Lyons, Kerr/Haslam) | concluded | gov.uk org + WebArchive | single/multi reports | varies | ~0.3-2k each | OGL |

## Headline

- **Reports-only universe (all listed): ROUGH ~40-70k sections** across ~35 inquiries — modest, OGL-clean,
  high civic value ("what an independent judge found about a public failure").
- **Evidence bundles**: an order of magnitude larger and mixed-licence — DEFERRED beyond V24.
- **V24 build**: an `inquiry-reports` sourceType with two adapters — (a) gov.uk publication-attachments
  (recent inquiries; CF-free), (b) Web Archive snapshot crawl (dark own-sites). Seed against this register.
