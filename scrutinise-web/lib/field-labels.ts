export const FIELD_LABELS: Record<string, { sectionHeading?: string; userLabel: string }> = {
  // Diagnosis
  diagnosisTitle:         { sectionHeading: 'Diagnosis — The Challenge',          userLabel: 'The Challenge' },
  diagnosisDescription:   {                                                        userLabel: 'Describe the Challenge' },
  obstacleDefined:        {                                                        userLabel: "What's Blocking Progress" },
  whoAffected:            {                                                        userLabel: 'Who Is Affected' },
  howAffected:            {                                                        userLabel: "How They're Affected" },
  whyPersisted:           {                                                        userLabel: 'Why Has This Gone Unsolved' },
  impactDescription:      {                                                        userLabel: 'The Impact' },
  impactCost:             {                                                        userLabel: 'The Cost of Inaction' },

  // Root Cause
  rootCauseTitle:         { sectionHeading: 'Root Causes — Why It Happens',       userLabel: 'Root Cause' },
  rootCauseDescription:   {                                                        userLabel: 'Explain This Cause' },
  rootCauseLinkBack:      {                                                        userLabel: 'What Caused This Cause' },
  rootCauseLinkForward:   {                                                        userLabel: 'What Does This Cause Lead To' },
  rootCauseMechanism:     {                                                        userLabel: 'How It Works' },
  whyNotSolved:           {                                                        userLabel: "Why Hasn't This Been Fixed" },
  incentiveDrivers:       {                                                        userLabel: 'Incentives Keeping It in Place' },
  structureDrivers:       {                                                        userLabel: 'Structural Factors' },

  // Guiding Policy
  guidingPolicyTitle:                       { sectionHeading: 'Guiding Policy — Your Approach', userLabel: 'Your Approach' },
  guidingPolicyDescription:                 { userLabel: 'Describe Your Approach' },
  coreTheory:                               { userLabel: 'Your Theory of Change' },
  linkToDiagnosis:                          { userLabel: 'How This Addresses the Root Cause' },
  whatThisPolicyRulesOut:                   { userLabel: "What We're Not Doing" },
  whyThisApproachNotOthers:                 { userLabel: 'Why This Approach' },
  conditionsForSuccess:                     { userLabel: 'What Has to Be True' },
  mechanismIncentives:                      { userLabel: 'Incentive Mechanisms' },
  mechanismRules:                           { userLabel: 'Rules & Mandates' },
  mechanismTransparency:                    { userLabel: 'Transparency Measures' },
  mechanismMarketDesign:                    { userLabel: 'Market Design' },
  mechanismInstitutionalRestructuring:      { userLabel: 'Institutional Changes' },
  tradeOffs:                                { userLabel: 'Trade-offs & Compromises' },
  competitiveIdeaAnalysis:                  { userLabel: 'Competing Approaches' },

  // Evidence
  comparablePolicy:  { sectionHeading: 'Evidence — Real-World Precedents', userLabel: 'Comparable Policy' },
  successFailure:    { userLabel: 'Did It Work' },
  whatWorked:        { userLabel: 'What Worked' },
  whatFailed:        { userLabel: 'What Failed' },
  resultCauses:      { userLabel: 'Why It Turned Out That Way' },

  // Coherent Action
  coherentActionTitle:                  { sectionHeading: 'Coherent Actions — What Is to Be Changed', userLabel: 'Action Title' },
  summarySnippet:                       { userLabel: 'One-line Summary' },
  detailedDescription:                  { userLabel: 'What This Does and Why' },
  actionType:                           { userLabel: 'Type of Change' },
  legislationDraftWording:              { userLabel: 'Draft Legislation Wording' },
  organisationalChangeDraftWording:     { userLabel: 'Organisational Change Wording' },
  costBenefitAnalysis:                  { userLabel: 'Cost-Benefit Summary' },
  netCostOngoing:                       { userLabel: 'Net Annual Cost (£)' },
  netCostOneOff:                        { userLabel: 'Net One-off Cost (£)' },
  costFinancial:                        { userLabel: 'Financial Cost of this Action' },
  costSocial:                           { userLabel: 'Social Cost of this Action' },
  costOngoing:                          { userLabel: 'Annual Ongoing Costs of this Action' },
  benefitFinancial:                     { userLabel: 'Financial Benefits of this Action' },
  benefitSocial:                        { userLabel: 'Social Benefits of this Action' },
  benefitOngoing:                       { userLabel: 'Annual Ongoing Benefits of this Action' },
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
  oppositionWhy:                        { userLabel: "Why They'll Oppose It" },
  oppositionAnswers:                    { userLabel: 'Responses to Opposition' },

  // Resources Committed
  resourceDescription:              { sectionHeading: "Resources — What You're Committing", userLabel: 'Resource Description' },
  capitalCommitment:                { userLabel: 'Capital Commitment' },
  annualCost:                       { userLabel: 'Annual Cost' },
  timeframe:                        { userLabel: 'Timeframe' },
  humanCapitalCommitted:            { userLabel: 'Human Capital Committed' },
  humanCapitalAnnualRequirement:    { userLabel: 'Human Capital Annual Requirement' },

  // Idea core
  title:                { userLabel: 'Idea Title' },
  summaryDescription:   { userLabel: 'Your Idea in Brief' },
  situationalAnalysis:  { userLabel: 'Background & Context' },
  targetLegislation:    { userLabel: 'Laws to Change' },
  targetOrganisation:   { userLabel: 'Who Must Act' },
  proposedWording:      { userLabel: 'Draft Legislation' },
}

export const SIDEBAR_SECTIONS = [
  { key: 'diagnosis',       label: 'Diagnosis — The Challenge' },
  { key: 'guidingPolicy',   label: 'Guiding Policy — Your Approach' },
  { key: 'coherentActions', label: 'Coherent Actions — What Is to Be Changed' },
]

export function getFieldLabel(fieldKey: string): string {
  return FIELD_LABELS[fieldKey]?.userLabel ?? fieldKey
}

export function getSectionHeading(fieldKey: string): string | undefined {
  return FIELD_LABELS[fieldKey]?.sectionHeading
}
