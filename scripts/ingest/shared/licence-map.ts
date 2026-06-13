/**
 * licence-map.ts — per-source licence metadata (V20).
 *
 * Every corpus maps to a licence code stored per-row in corpus_sections.licence
 * at ingest (default applied in db-metadata.ts sectionParams). The attribution
 * column is populated ONLY where wording is row-specific (e.g. sentencing-council
 * requires the source document title; OECD CC-BY requires per-document
 * attribution) — uniform boilerplate lives here and in INGEST_PLAYBOOK §18,
 * not duplicated across millions of rows.
 *
 * Verification status (12 Jun 2026, V20):
 *  - ogl-3.0 (TNA legislation): VERIFIED — legislation.gov.uk/contributors
 *    ("All content is available under the Open Government Licence v3.0 except
 *    where otherwise stated").
 *  - ogl-3.0+eu-2011-833 (retained-eu): VERIFIED — same page; EU-derived content
 *    must carry dual attribution (OGL + Commission Decision 2011/833/EU).
 *  - ogl-3.0 (gov.uk): VERIFIED — gov.uk/help/terms-conditions.
 *  - ogl-3.0 (sentencing-council): VERIFIED — their T&Cs; acknowledgment must
 *    name Crown copyright AND the source document title (row-specific).
 *  - ogl (scotlawcom): VERIFIED — /copyright-and-disclaimer (no version stated).
 *  - ogl-3.0 (lawcom.gov.uk): VERIFIED — site footer.
 *  - ojl-2.0 (tna-caselaw / Find Case Law): VERIFIED — Open Justice Licence v2.0.
 *    ⚠️ COMPUTATIONAL ANALYSIS (indexing, bulk/automated processing, ML) is
 *    EXPLICITLY EXCLUDED from the OJL — requires TNA's separate computational
 *    analysis licence (caselawlicence@nationalarchives.gov.uk). Flagged to
 *    Charlie in V20 CHANGE_LOG.
 *  - opl-3.0 (parliamentary material): VERIFIED — the OPL page
 *    (parliament.uk/site-information/copyright-parliament/open-parliament-
 *    licence/) served its full terms on 12 Jun 2026 (V21 evening run; the
 *    V20 morning CF-block was transient). Covers Hansard incl. the digitised
 *    1803–2004 bulk archive (historic-hansard).
 *  - eu-2011-833 (eur-lex): EUR-Lex legal notice is JS-rendered; instrument
 *    confirmed via legislation.gov.uk/contributors wording.
 *  - fca-restricted (fca-handbook): VERIFIED — fca.org.uk/legal: reproduction/
 *    storage in any retrieval system requires prior written permission; Handbook
 *    reproduction requires a licence agreement. Flagged to Charlie.
 *  - cc-by-nc-4.0 (oecd): V19 §3.4 — pre-Jul-2024 OECD content is CC BY-NC;
 *    post-Jul-2024 is CC BY 4.0 (code cc-by-4.0, use for any future OECD seed).
 *  - pending-verification: college-of-policing (CF 403 on T&Cs, 12 Jun 2026),
 *    nilawcom (site SSL failure, 12 Jun 2026).
 */

export interface LicenceInfo {
  licence: string
  // Boilerplate attribution for the whole corpus (documentation only — NOT
  // written per-row). Row-specific attribution is passed explicitly by
  // processors/seeders via SectionMeta.attribution.
  attributionBoilerplate: string | null
}

const OGL3: LicenceInfo = {
  licence: 'ogl-3.0',
  attributionBoilerplate: 'Contains public sector information licensed under the Open Government Licence v3.0.',
}
const OPL3: LicenceInfo = {
  licence: 'opl-3.0',
  attributionBoilerplate: 'Contains Parliamentary information licensed under the Open Parliament Licence v3.0.',
}

export const CORPUS_LICENCES: Record<string, LicenceInfo> = {
  // TNA legislation (Crown copyright, OGL v3.0)
  'primary-acts-pre-2000': OGL3,
  'primary-acts-2000plus': OGL3,
  'si-pre-2010': OGL3,
  'si-2010plus': OGL3,
  'regional': OGL3,
  'explanatory-notes': OGL3,
  'explanatory-memoranda': OGL3,
  // TNA-mirrored EU corpus: dual OGL + Commission Decision 2011/833/EU
  'retained-eu': {
    licence: 'ogl-3.0+eu-2011-833',
    attributionBoilerplate:
      'Crown © and database right material re-used under the Open Government Licence. ' +
      'Material derived from the European Institutions © European Union, 1998-2019 and ' +
      're-used under the terms of Commission Decision 2011/833/EU.',
  },
  'eur-lex': {
    licence: 'eu-2011-833',
    attributionBoilerplate: '© European Union, 1998–2026. Re-used under the terms of Commission Decision 2011/833/EU.',
  },
  // Find Case Law — Open Justice Licence v2.0. ⚠️ computational analysis
  // excluded; separate TNA licence required (see header + CHANGE_LOG V20).
  'tna-caselaw': {
    licence: 'ojl-2.0',
    attributionBoilerplate: 'Contains information licensed under the Open Justice - Licence v2.0.',
  },
  // Parliamentary material — Open Parliament Licence v3.0
  'historic-hansard': OPL3, // bulk archive 1803–1918 (V21); OPL verified live 12 Jun 2026
  'pwdata-debates': OPL3,
  'pwdata-lords': OPL3,
  'pwdata-wrans': OPL3,
  'pwdata-lordswrans': OPL3,
  'pwdata-westminster': OPL3,
  'pwdata-wms': OPL3,
  'pwdata-lordswms': OPL3,
  'lda-commonsoralquestions': OPL3,
  'lda-commonswrittenquestions': OPL3,
  'lda-lordswrittenquestions': OPL3,
  'lda-commonsdivisions': OPL3,
  'lda-lordsdivisions': OPL3,
  'written-answers': OPL3,
  'written-statements': OPL3,
  'committees-reports': OPL3,
  'committees-evidence': OPL3,
  // gov.uk (Crown copyright, OGL v3.0)
  'hmrc-manuals': OGL3,
  'hmrc-codes-guidance': OGL3,
  'hmrc-tiins': OGL3,
  'hmrc-ancillary': OGL3,
  'tax-treaties-dta': OGL3,
  'uk-treaties': OGL3,
  'et-decisions': OGL3,
  'govuk-core-docs': OGL3,
  'quangos-govuk': OGL3, // gov.uk-published ALB content rides gov.uk terms (V22 T1)
  'building-regs': OGL3,
  'planning-policy': OGL3,
  'ots-reports': OGL3,
  // Quangos — individually verified
  'sentencing-council': OGL3, // attribution must also name the source document title (row-specific)
  'scotlawcom': { licence: 'ogl', attributionBoilerplate: 'Re-used under the terms of the Open Government Licence (Scottish Law Commission).' },
  'lawcom': OGL3, // lawcom.gov.uk footer: OGL v3.0 (verified 12 Jun 2026)
  'college-of-policing': { licence: 'pending-verification', attributionBoilerplate: null },
  'nilawcom': { licence: 'pending-verification', attributionBoilerplate: null },
  // HMCTS legacy decisions archive — no licence statement on the site; court
  // decisions are public records but the re-use position needs verification
  // (the FCL computational-analysis issue suggests caution on judgments).
  'tax-tribunals': { licence: 'pending-verification', attributionBoilerplate: null },
  // judiciaryni.uk: footer © Crown Copyright, no open licence stated (12 Jun 2026)
  'ni-judgments': { licence: 'pending-verification', attributionBoilerplate: null },
  // Restricted sources — flagged to Charlie (V20 CHANGE_LOG)
  'fca-handbook': { licence: 'fca-restricted', attributionBoilerplate: null },
  'oecd': { licence: 'cc-by-nc-4.0', attributionBoilerplate: '© OECD. CC BY-NC 4.0 (pre-July-2024 content; non-commercial use).' },
  // NAO copyright statement (verified 12 Jun 2026): free NON-COMMERCIAL re-use
  // with attribution; commercial use needs express permission.
  'nao-reports': { licence: 'nao-nc', attributionBoilerplate: 'Reproduced from National Audit Office material. Non-commercial re-use with attribution per NAO copyright statement.' },
  // ECHR/HUDOC (verified 13 Jun 2026, echr.coe.int/copyright-and-disclaimer):
  // texts reproducible free of charge with source acknowledged (© ECHR-CEDH)
  // for private/information/education purposes; commercial use requires prior
  // written permission. Same posture as nao-nc: fine for the charity,
  // default-excluded from commercial surfaces.
  'echr-hudoc': { licence: 'echr-nc', attributionBoilerplate: '© ECHR-CEDH. Reproduced for information/education purposes per the Court’s copyright statement; commercial use requires permission.' },
}

export function licenceForCorpus(corpus: string): string | null {
  return CORPUS_LICENCES[corpus]?.licence ?? null
}
