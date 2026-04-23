export interface FieldStep {
  key: string           // fieldUpdates key (e.g. 'diagnosis.obstacleDefined')
  label: string         // display label (e.g. '6. The Obstacle')
  section: string       // section key (e.g. 'diagnosis')
  sectionLabel: string  // section heading (e.g. 'Diagnosis — The Challenge')
  isLexGenerated?: boolean  // if true, Lex generates without asking user
  isLoop?: boolean          // if true (coherent actions), loop resumes after completion
}

export const FIELD_SEQUENCE: FieldStep[] = [
  // Initial Information
  { key: 'title',              label: '1. Title',               section: 'initialInformation', sectionLabel: 'Initial Information' },
  { key: 'userProfiling',      label: 'User Profiling',         section: 'initialInformation', sectionLabel: 'Initial Information' },
  { key: 'summaryDescription', label: '2. Summary Description', section: 'initialInformation', sectionLabel: 'Initial Information' },
  { key: 'govtArea',           label: '3. Government Area',     section: 'initialInformation', sectionLabel: 'Initial Information' },
  { key: 'ideaType',           label: '4. Idea Type',           section: 'initialInformation', sectionLabel: 'Initial Information' },

  // Diagnosis
  { key: 'diagnosis.text',              label: "5. What's the Challenge?", section: 'diagnosis', sectionLabel: 'Diagnosis — The Challenge' },
  { key: 'diagnosis.obstacleDefined',   label: '6. The Obstacle',           section: 'diagnosis', sectionLabel: 'Diagnosis — The Challenge' },
  { key: 'diagnosis.whoAffected',       label: "7. Who's Affected?",        section: 'diagnosis', sectionLabel: 'Diagnosis — The Challenge' },
  { key: 'diagnosis.howAffected',       label: '8. How Are They Affected?', section: 'diagnosis', sectionLabel: 'Diagnosis — The Challenge' },
  { key: 'diagnosis.whyPersisted',      label: '9. Why Has This Persisted?', section: 'diagnosis', sectionLabel: 'Diagnosis — The Challenge' },
  { key: 'diagnosis.impactDescription', label: '10. Impact',                section: 'diagnosis', sectionLabel: 'Diagnosis — The Challenge' },
  { key: 'diagnosis.impactCost',        label: '11. Impact Cost',           section: 'diagnosis', sectionLabel: 'Diagnosis — The Challenge' },
  { key: 'summaryDiagnosis',            label: 'Summary: The Challenge',    section: 'diagnosis', sectionLabel: 'Diagnosis — The Challenge', isLexGenerated: true },

  // Guiding Policy
  { key: 'guidingPolicy.text',                 label: '12. How Will We Solve It?',       section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach' },
  { key: 'guidingPolicy.coreTheory',           label: '13. Core Theory',                 section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach' },
  { key: 'guidingPolicy.mechanismTypes',       label: '14. Mechanism Types',             section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach' },
  { key: 'guidingPolicy.tradeOffs',            label: '15. Trade-offs',                  section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach' },
  { key: 'guidingPolicy.whyThisApproachNotOthers', label: '16. Why Not Other Approaches?', section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach' },
  { key: 'guidingPolicy.linkToDiagnosis',      label: '17. Link to Diagnosis',           section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach' },
  { key: 'guidingPolicy.whatThisPolicyRulesOut', label: '18. What This Policy Rules Out', section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach' },
  { key: 'guidingPolicy.conditionsForSuccess', label: '19. Conditions for Success',      section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach' },
  { key: 'summaryGuidingPolicy',               label: 'Summary: Guiding Policy',         section: 'guidingPolicy', sectionLabel: 'Guiding Policy — Your Approach', isLexGenerated: true },

  // Coherent Actions (loop — one action at a time)
  { key: 'coherentAction.title',           label: '20. A Practical Step',     section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'coherentAction.mechanismType',   label: '20a. Mechanism Type',      section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'coherentAction.summary',         label: '21. Summary',              section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'coherentAction.whoImplements',   label: '22. Who Implements This?', section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'coherentAction.benefitFinancial', label: '23. Financial Benefit',   section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'coherentAction.benefitSocial',   label: '24. Social Benefit',       section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'coherentAction.benefitOngoing',  label: '25. Ongoing Benefit',      section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'coherentAction.netCostOngoing',  label: '26. Ongoing Net Cost',     section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'coherentAction.netCostOneOff',   label: '27. One-off Net Cost',     section: 'coherentActions', sectionLabel: 'Coherent Actions', isLoop: true },
  { key: 'summaryCoherentActions',         label: 'Summary: Coherent Actions', section: 'coherentActions', sectionLabel: 'Coherent Actions', isLexGenerated: true },
]

export const FIELD_LABELS: Record<string, { sectionHeading?: string; userLabel: string }> = {
  // Initial Information
  title:              { sectionHeading: 'Initial Information', userLabel: '1. Title' },
  summaryDescription: { userLabel: '2. Summary Description' },
  govtArea:           { userLabel: '3. Government Area' },
  ideaType:           { userLabel: '4. Idea Type' },

  // Diagnosis
  diagnosisTitle:         { sectionHeading: 'Diagnosis — The Challenge',    userLabel: '5. What\'s the Challenge?' },
  diagnosisDescription:   {                                                   userLabel: 'Describe the Challenge' },
  obstacleDefined:        {                                                   userLabel: '6. The Obstacle' },
  whoAffected:            {                                                   userLabel: '7. Who Is Affected' },
  howAffected:            {                                                   userLabel: '8. How They\'re Affected' },
  whyPersisted:           {                                                   userLabel: '9. Why Has This Gone Unsolved' },
  impactDescription:      {                                                   userLabel: '10. The Impact' },
  impactCost:             {                                                   userLabel: '11. The Cost of Inaction' },

  // Root Cause
  rootCauseTitle:         { sectionHeading: 'Root Causes — Why It Happens',  userLabel: 'Root Cause' },
  rootCauseDescription:   {                                                   userLabel: 'Explain This Cause' },
  rootCauseLinkBack:      {                                                   userLabel: 'What Caused This Cause' },
  rootCauseLinkForward:   {                                                   userLabel: 'What Does This Cause Lead To' },
  rootCauseMechanism:     {                                                   userLabel: 'How It Works' },
  whyNotSolved:           {                                                   userLabel: 'Why Hasn\'t This Been Fixed' },
  incentiveDrivers:       {                                                   userLabel: 'Incentives Keeping It in Place' },
  structureDrivers:       {                                                   userLabel: 'Structural Factors' },

  // Guiding Policy
  guidingPolicyTitle:                       { sectionHeading: 'Guiding Policy — Your Approach', userLabel: '12. How Will We Solve It?' },
  guidingPolicyDescription:                 { userLabel: 'Describe Your Approach' },
  coreTheory:                               { userLabel: '13. Core Theory' },
  mechanismTypes:                           { userLabel: '14. Mechanism Types' },
  tradeOffs:                                { userLabel: '15. Trade-offs' },
  whyThisApproachNotOthers:                 { userLabel: '16. Why Not Other Approaches?' },
  linkToDiagnosis:                          { userLabel: '17. Link to Diagnosis' },
  whatThisPolicyRulesOut:                   { userLabel: '18. What This Policy Rules Out' },
  conditionsForSuccess:                     { userLabel: '19. Conditions for Success' },
  competitiveIdeaAnalysis:                  { userLabel: 'Competing Approaches' },

  // Evidence
  comparablePolicy:  { sectionHeading: 'Evidence — Real-World Precedents', userLabel: 'Comparable Policy' },
  successFailure:    { userLabel: 'Did It Work' },
  whatWorked:        { userLabel: 'What Worked' },
  whatFailed:        { userLabel: 'What Failed' },
  resultCauses:      { userLabel: 'Why It Turned Out That Way' },

  // Coherent Action
  coherentActionTitle:                  { sectionHeading: 'Coherent Actions — What Is to Be Changed', userLabel: '20. A Practical Step' },
  mechanismType:                        { userLabel: '20a. Mechanism Type' },
  summarySnippet:                       { userLabel: '21. Summary' },
  actionType:                           { userLabel: '22. Who Implements This?' },
  benefitFinancial:                     { userLabel: '23. Financial Benefit' },
  benefitSocial:                        { userLabel: '24. Social Benefit' },
  benefitOngoing:                       { userLabel: '25. Ongoing Benefit' },
  netCostOngoing:                       { userLabel: '26. Ongoing Net Cost (£)' },
  netCostOneOff:                        { userLabel: '27. One-off Net Cost (£)' },
  detailedDescription:                  { userLabel: 'What This Does and Why' },
  legislationDraftWording:              { userLabel: 'Draft Legislation Wording' },
  organisationalChangeDraftWording:     { userLabel: 'Organisational Change Wording' },
  costBenefitAnalysis:                  { userLabel: 'Cost-Benefit Summary' },
  costFinancial:                        { userLabel: 'Financial Cost of this Action' },
  costSocial:                           { userLabel: 'Social Cost of this Action' },
  costOngoing:                          { userLabel: 'Annual Ongoing Costs of this Action' },
  benefits:                             { userLabel: 'Benefits (general)' },
  practicalExecution:                   { userLabel: 'How This Action Is Carried Out' },
  implementationPlan:                   { userLabel: 'Implementation Plan' },
  accountability:                       { userLabel: 'Accountability' },
  successMeasurement:                   { userLabel: 'How Success Is Measured' },
  keyRisks:                             { userLabel: 'Key Risks' },
  potentialHarm:                        { userLabel: 'Potential Harms' },
  keyChallenges:                        { userLabel: 'Key Challenges' },
  sourcesOfOpposition:                  { userLabel: 'Sources of Opposition' },
  oppositionWho:                        { userLabel: 'Who Will Oppose This' },
  oppositionWhy:                        { userLabel: 'Why They\'ll Oppose It' },
  oppositionAnswers:                    { userLabel: 'Responses to Opposition' },

  // Resources Committed
  resourceDescription:              { sectionHeading: "Resources — What You're Committing", userLabel: 'Resource Description' },
  capitalCommitment:                { userLabel: 'Capital Commitment' },
  annualCost:                       { userLabel: 'Annual Cost' },
  timeframe:                        { userLabel: 'Timeframe' },
  humanCapitalCommitted:            { userLabel: 'Human Capital Committed' },
  humanCapitalAnnualRequirement:    { userLabel: 'Human Capital Annual Requirement' },
}

export const SIDEBAR_SECTIONS = [
  {
    key: 'initialInformation',
    heading: 'Initial Information',
    fields: [
      { key: 'title',              label: '1. Title' },
      { key: 'summaryDescription', label: '2. Summary Description' },
      { key: 'govtArea',           label: '3. Government Area' },
      { key: 'ideaType',           label: '4. Idea Type' },
    ],
  },
  {
    key: 'diagnosis',
    heading: 'Diagnosis — The Challenge',
    fields: [
      { key: 'diagnosisText',              label: "5. What's the Challenge?" },
      { key: 'diagnosisObstacleDefined',   label: '6. The Obstacle' },
      { key: 'diagnosisWhoAffected',       label: "7. Who's Affected?" },
      { key: 'diagnosisHowAffected',       label: '8. How Are They Affected?' },
      { key: 'diagnosisWhyPersisted',      label: '9. Why Has This Persisted?' },
      { key: 'diagnosisImpactDescription', label: '10. Impact' },
      { key: 'diagnosisImpactCost',        label: '11. Impact Cost' },
    ],
  },
  {
    key: 'guidingPolicy',
    heading: 'Guiding Policy — Your Approach',
    fields: [
      { key: 'guidingPolicyText',                    label: '12. How Will We Solve It?' },
      { key: 'guidingPolicyCoreTheory',              label: '13. Core Theory' },
      { key: 'mechanismTypes',                       label: '14. Mechanism Types' },
      { key: 'guidingPolicyTradeOffs',               label: '15. Trade-offs' },
      { key: 'whyThisApproachNotOthers',             label: '16. Why Not Other Approaches?' },
      { key: 'linkToDiagnosis',                      label: '17. Link to Diagnosis' },
      { key: 'whatThisPolicyRulesOut',               label: '18. What This Policy Rules Out' },
      { key: 'conditionsForSuccess',                 label: '19. Conditions for Success' },
    ],
  },
  {
    key: 'coherentActions',
    heading: 'Coherent Actions — What Is to Be Changed',
    fields: [
      { key: 'coherentActionTitle', label: '20. A Practical Step' },
      { key: 'mechanismType',       label: '20a. Mechanism Type' },
      { key: 'summarySnippet',      label: '21. Summary' },
      { key: 'actionType',          label: '22. Who Implements This?' },
      { key: 'benefitFinancial',    label: '23. Financial Benefit' },
      { key: 'benefitSocial',       label: '24. Social Benefit' },
      { key: 'benefitOngoing',      label: '25. Ongoing Benefit' },
      { key: 'netCostOngoing',      label: '26. Ongoing Net Cost' },
      { key: 'netCostOneOff',       label: '27. One-off Net Cost' },
    ],
  },
]

// Maps old field keys to their replacement key (or null if no replacement)
// Used to display deprecated data in the answers panel without losing it
export const DEPRECATED_FIELDS: Record<string, string | null> = {
  mechanismIncentives: null,
  mechanismRules: null,
  mechanismTransparency: null,
  mechanismMarketDesign: null,
  mechanismInstitutionalRestructuring: null,
}

export function getFieldLabel(fieldKey: string): string {
  return FIELD_LABELS[fieldKey]?.userLabel ?? fieldKey
}

export function getSectionHeading(fieldKey: string): string | undefined {
  return FIELD_LABELS[fieldKey]?.sectionHeading
}
