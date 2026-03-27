/**
 * Seed 8 editorial seed ideas with full strategic kernels.
 *
 * These are live policy debates (not enacted legislation), created by the
 * Scrutinise editorial team as policy development prompts.
 *
 * Idempotent:
 *   - User upserted on clerkId.
 *   - Ideas upserted on title + creatorId.
 *   - Diagnosis and GuidingPolicy upserted (@@unique on ideaId).
 *   - RootCause and CoherentAction created only if none exist for the idea.
 *
 * Run with:
 *   npx tsx --env-file=.env scripts/seed/seed-editorial-ideas.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ─────────────────────────────────────────────────────────────────────────────
// Editorial user
// ─────────────────────────────────────────────────────────────────────────────

const EDITORIAL_USER = {
  clerkId: 'editorial_scrutinise',
  name: 'Scrutinise Editorial',
  firstName: 'Scrutinise',
  lastName: 'Editorial',
  username: 'editorial_scrutinise',
  email: 'editorial@scrutinise.org',
  referralCode: 'edit-scrutinise',
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner text (shared)
// ─────────────────────────────────────────────────────────────────────────────

const EDITORIAL_BANNER_TEXT =
  'This idea was created by the Scrutinise team as a policy development prompt. It represents a live policy debate with substantial public evidence. Any registered user can contribute to it, and ownership can be transferred to any organisation or individual who wishes to champion it.'

// ─────────────────────────────────────────────────────────────────────────────
// Data types
// ─────────────────────────────────────────────────────────────────────────────

interface EditorialIdea {
  title: string
  summaryDescription: string
  govtArea: string
  summaryDiagnosis: string
  summaryGuidingPolicy: string
  summaryCoherentActions: string
  diagnosis: {
    diagnosisTitle: string
    text: string
    whoAffected: string
    howAffected?: string
    whyPersisted?: string
    impactDescription?: string
    impactCost?: string
  }
  rootCause: {
    rootCauseTitle: string
    text: string
    rootCauseMechanism?: string
    whyNotSolved?: string
  }
  guidingPolicy: {
    guidingPolicyTitle: string
    text: string
    coreTheory?: string
    mechanismRules?: string
    mechanismTransparency?: string
    mechanismInstitutionalRestructuring?: string
    tradeOffs?: string
    competitiveIdeaAnalysis?: string
  }
  coherentActions: Array<{
    title: string
    detailedDescription: string
    actionType: string
    practicalExecution?: string
    keyRisks?: string
    orderIndex: number
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Editorial ideas data
// ─────────────────────────────────────────────────────────────────────────────

const EDITORIAL_IDEAS: EditorialIdea[] = [
  // ── 1. FCA Competitiveness Duty Enforcement ──────────────────────────────
  {
    title: "Enforcing the FCA's Competitiveness Duty: A Statutory Accountability Framework",
    summaryDescription:
      "The Financial Services and Markets Act 2023 added a secondary competitiveness objective to the FCA and PRA, but without any mechanism for Parliament or industry to hold the regulators to account for how they apply it. This proposal creates that mechanism.",
    govtArea: 'Treasury',
    summaryDiagnosis:
      "The FCA and PRA were given a competitiveness duty in 2023 but face no consequences for ignoring it. Regulated firms have no formal recourse when regulatory decisions damage the UK's competitive position.",
    summaryGuidingPolicy:
      "A statutory annual competitiveness report from the FCA and PRA, subject to mandatory Select Committee scrutiny, with a right for industry bodies to submit formal objections that the regulators must publicly respond to.",
    summaryCoherentActions:
      "Amend the Financial Services and Markets Act 2023 to require the FCA and PRA to publish an annual Competitiveness Impact Statement for every major rule change, with a mandatory response mechanism.",
    diagnosis: {
      diagnosisTitle: 'The competitiveness duty has no enforcement mechanism',
      text: "The Financial Services and Markets Act 2023 (FSMA 2023) added a secondary competitiveness and growth objective to both the FCA and PRA, responding to years of industry concern that UK regulation had become disproportionately burdensome relative to competitor jurisdictions. However, the duty is framed as a 'have regard to' obligation — the regulators must consider competitiveness but face no legal or parliamentary consequence for prioritising other objectives over it. This is structurally identical to the position before FSMA 2023, as no enforcement mechanism was created.",
      whoAffected:
        'UK-regulated financial services firms, particularly those competing for listings, capital raising, and asset management mandates against New York, Singapore, Amsterdam, and Dublin. The broader UK economy, which depends on financial services generating approximately 12% of GDP and 11% of tax revenues.',
      howAffected:
        'Firms face regulatory requirements that increase compliance costs without equivalent investor protection benefits, deterring overseas issuers from listing in London and asset managers from operating through UK entities. The London Stock Exchange has lost significant listing share to New York since 2016.',
      whyPersisted:
        'The FCA and PRA are independent regulators with significant political insulation. Parliament has limited tools to scrutinise regulatory decisions. Industry consultation responses are published but regulators are not required to respond to competitiveness objections specifically.',
      impactDescription:
        "London's share of global IPO proceeds has declined substantially since 2010. Several large UK-headquartered companies (ARM, CRH, Flutter) have chosen New York listings. New Financial has documented a sustained outflow of asset management mandates to continental Europe.",
      impactCost:
        'City of London Corporation commissioned research (2023) estimates that declining competitiveness costs the UK approximately £6-9 billion per year in lost financial services activity.',
    },
    rootCause: {
      rootCauseTitle: 'Regulatory independence without accountability creates structural bias toward caution',
      text: 'Independent regulators face an asymmetric incentive structure: the political and reputational cost of a firm failure is borne immediately and visibly, while the cost of excessive regulation is diffuse, slow-moving, and attributed to market conditions rather than regulatory decisions. This creates a structural bias toward over-regulation that a competitiveness duty without enforcement cannot correct.',
      rootCauseMechanism:
        'Regulatory failure (firm collapse, market manipulation) triggers parliamentary inquiries, press coverage, and personal liability for senior regulatory staff. Regulatory over-caution (firms moving to Dublin, listings going to New York) triggers no equivalent consequence. The incentive is therefore always to err on the side of restriction.',
      whyNotSolved:
        "Previous attempts to introduce a competitiveness objective (rejected in 2012 after the financial crisis) failed because the political climate associated 'competitiveness' with the deregulation that caused the 2008 crash. FSMA 2023's inclusion of the duty represented a political compromise: the duty was included but without teeth, satisfying both the Treasury (which wanted the duty) and the regulators (which wanted to preserve their autonomy).",
    },
    guidingPolicy: {
      guidingPolicyTitle: 'Statutory accountability for competitiveness decisions without compromising regulatory independence',
      text: 'Create a formal parliamentary accountability mechanism for how the FCA and PRA apply their competitiveness duty, while preserving their operational independence on individual regulatory decisions. The mechanism should make the cost of ignoring competitiveness concerns politically visible without allowing political interference in individual cases.',
      coreTheory:
        'Sunlight is the best regulator of regulators. If the FCA must publicly explain the competitiveness impact of every major rule change, and industry bodies have a formal right of objection that must be publicly answered, the incentive structure changes without compromising independence.',
      mechanismRules:
        'Mandatory Competitiveness Impact Statement for every CP (consultation paper) above a threshold level of significance, assessing the impact on UK competitiveness relative to comparator jurisdictions. Industry bodies have 60 days to submit formal Competitiveness Objections. Regulators must respond specifically to each objection.',
      mechanismInstitutionalRestructuring:
        'Annual Competitiveness Report from FCA and PRA to the Treasury Select Committee, subject to mandatory oral evidence session. TSC given explicit power to recommend HM Treasury review specific regulatory decisions on competitiveness grounds.',
      tradeOffs:
        'Honest assessment: any mechanism that makes it easier to challenge regulatory decisions on competitiveness grounds also risks being captured by industry lobbying. The 2008 financial crisis was partly caused by regulators who were too responsive to industry competitiveness arguments. The design must distinguish between legitimate competitiveness concerns (unnecessary complexity, duplication with other requirements) and industry self-interest (weaker rules on capital adequacy, conduct). The proposal deliberately does not create a right of appeal to a court or tribunal, which would create litigation risk that would itself damage competitiveness.',
      competitiveIdeaAnalysis:
        "Australia's Council of Financial Regulators provides a coordination mechanism but lacks the formal accountability structure proposed here. The US has congressional oversight of the SEC and CFTC through committee hearings, which is analogous but less structured. Singapore's MAS publishes detailed cost-benefit analyses of major rule changes — the closest comparable model.",
    },
    coherentActions: [
      {
        title: 'Amend FSMA 2023 to require Competitiveness Impact Statements',
        detailedDescription:
          'Insert a new section into FSMA 2023 requiring the FCA and PRA to publish a Competitiveness Impact Statement (CIS) alongside every consultation paper proposing rule changes with an estimated compliance cost above £10 million per year. The CIS must assess the proposal against at least two comparator jurisdictions (to be specified in secondary legislation) and explain why any identified competitive disadvantage is justified by the regulatory objective being served.',
        actionType: 'LEGISLATION',
        practicalExecution:
          'Treasury introduces amendment to FSMA 2023 via a Financial Services Bill or statutory instrument. FCA and PRA consult on the CIS template. Industry bodies (TheCityUK, AFME, Investment Association) designated as formal Objection Bodies.',
        keyRisks:
          'Regulators may treat CIS requirements as box-ticking compliance exercises. Parliamentary scrutiny depends on the TSC having sufficient technical expertise, which is variable. The threshold (£10m per year) would need calibration to avoid capturing minor technical rule changes.',
        orderIndex: 0,
      },
    ],
  },

  // ── 2. UK Pandemic Preparedness Reform ──────────────────────────────────
  {
    title: 'A Statutory UK Pandemic Preparedness Framework',
    summaryDescription:
      "The UK's pre-COVID pandemic preparedness framework proved inadequate in 2020. Post-COVID reforms have been incremental. This proposal creates a statutory framework with mandatory stockpile requirements, rehearsal obligations, and parliamentary oversight.",
    govtArea: 'Health',
    summaryDiagnosis:
      'The UK entered COVID-19 without adequate PPE stockpiles, a functional surge testing capacity, or a rehearsed pandemic response plan. The 2016 Exercise Cygnus identified these gaps but its recommendations were not implemented.',
    summaryGuidingPolicy:
      'A Pandemic Preparedness Act establishing statutory minimum stockpile levels, mandatory five-year rehearsal cycles, an independent Pandemic Preparedness Commissioner, and a reserve procurement framework that can be activated without new Treasury authority.',
    summaryCoherentActions:
      'Introduce primary legislation creating the Pandemic Preparedness Commissioner role with statutory powers, and require DHSC to publish a statutory Pandemic Preparedness Plan updated every three years.',
    diagnosis: {
      diagnosisTitle: "The UK's pandemic preparedness framework was inadequate and its failures were foreseeable",
      text: "Exercise Cygnus (2016) — a government pandemic rehearsal exercise — identified critical weaknesses in the UK's preparedness: insufficient PPE stockpiles, inadequate surge capacity, unclear command structures, and insufficient care home protocols. Its report was classified and its recommendations were not fully implemented. When COVID-19 arrived in 2020, the UK experienced excess mortality significantly above the European average in the first wave, with PPE shortages affecting healthcare workers and care homes.",
      whoAffected:
        'Healthcare workers, care home residents and staff, vulnerable populations, and the general public during the acute phase. The broader economy — UK GDP contracted 9.9% in 2020, the largest contraction since reliable records began. Future populations facing the next pandemic.',
      howAffected:
        "PPE shortages forced healthcare workers to reuse equipment beyond safe parameters. The UK's test-and-trace system took weeks to establish while other countries (South Korea, Germany) activated pre-prepared systems immediately. The Infected Blood Inquiry and COVID Inquiry have documented systemic failures in government decision-making.",
      whyPersisted:
        'Pandemic preparedness is a classic public good problem: the political cost of maintaining expensive stockpiles and rehearsal infrastructure is borne in the current parliament, while the benefit accrues in the next pandemic (which may be decades away). Successive governments prioritised visible healthcare spending over invisible preparedness spending. Exercise Cygnus recommendations were classified rather than published, removing public accountability.',
      impactDescription:
        'The UK COVID-19 Inquiry (Module 1, 2023) found fundamental failings in preparedness. The Office for National Statistics estimated 227,000 deaths involving COVID-19 in England and Wales by March 2022. Independent analysis suggests a significant proportion were preventable with earlier intervention enabled by better preparedness.',
      impactCost:
        'ONS estimates total cost to the UK economy of COVID-19 response at approximately £400 billion in direct expenditure and lost output. The Wellcome Trust estimates that annual global pandemic preparedness investment of $10 billion would have a benefit-to-cost ratio of 250:1 against the costs of future pandemics.',
    },
    rootCause: {
      rootCauseTitle: 'No statutory obligation to maintain pandemic preparedness creates a political incentive to underinvest',
      text: "The UK had no statutory requirement to maintain specific stockpile levels, rehearsal cycles, or surge capacity for pandemic response. Preparedness depended on discretionary spending decisions and civil service judgment — both subject to short-term political and fiscal pressures. Without statutory requirements, preparedness erodes when other spending priorities compete.",
      rootCauseMechanism:
        "Annual spending reviews create pressure to cut discretionary budgets. Pandemic preparedness stockpiles are expensive to maintain and their value is invisible until a pandemic occurs. Without statutory minimum stockpile levels, successive Health Secretaries permitted drawdown without replacement. Exercise Cygnus's classified status removed the public accountability that might have forced implementation of its recommendations.",
      whyNotSolved:
        'Post-COVID reforms have focused on structural reorganisation (UKHSA replacing PHE) and immediate operational gaps, without creating the statutory framework that would prevent the same pattern recurring. The COVID Inquiry is still ongoing and its final recommendations have not yet been published or acted on.',
    },
    guidingPolicy: {
      guidingPolicyTitle: 'Statutory minimum preparedness standards enforced by an independent commissioner',
      text: 'Make pandemic preparedness a statutory obligation rather than a discretionary civil service function. Create minimum standards for stockpiles, rehearsal cycles, and surge capacity. Establish an independent Pandemic Preparedness Commissioner to verify compliance and report to Parliament.',
      coreTheory:
        'What gets measured gets managed. Statutory minimum standards create a floor that cannot be eroded by spending reviews. An independent commissioner with parliamentary reporting obligations creates the public accountability that classified internal exercises cannot. Reserve procurement frameworks eliminate the delay caused by having to run emergency procurement during a crisis.',
      mechanismRules:
        'Pandemic Preparedness Act establishes: statutory minimum stockpile levels for PPE, antivirals, and diagnostic equipment (updated every five years); mandatory national rehearsal exercise every five years with published findings; a reserve procurement framework pre-authorised for activation without new Treasury approval.',
      mechanismInstitutionalRestructuring:
        'Pandemic Preparedness Commissioner with statutory powers to inspect stockpiles and surge capacity, report to the Health and Social Care Select Committee annually, and publish classified exercises in redacted form.',
      tradeOffs:
        'Statutory stockpile requirements are expensive — maintaining PPE stockpiles adequate for a prolonged pandemic could cost £500 million to £2 billion annually depending on scope. Equipment can expire before use, creating waste. The COVID Inquiry has not yet published its final recommendations, so legislating before those are known risks being superseded. A statutory framework may create inflexibility — the next pandemic may be very different from COVID-19, requiring different equipment and responses.',
      competitiveIdeaAnalysis:
        "South Korea's post-MERS (2015) reforms created a statutory preparedness framework that proved effective in COVID-19. Taiwan's National Health Command Center (established post-SARS) enabled rapid response. Germany's Robert Koch Institute has statutory independence and mandatory preparedness reporting. The Wellcome Trust's 2023 Global Preparedness Monitoring Board report provides the most detailed comparative framework.",
    },
    coherentActions: [
      {
        title: 'Introduce the Pandemic Preparedness Bill',
        detailedDescription:
          'Primary legislation establishing: the Pandemic Preparedness Commissioner (independent, reporting to Parliament); statutory National Pandemic Preparedness Plan (updated every three years, published); minimum stockpile standards for Class A pandemic equipment (defined in secondary legislation); mandatory five-year national exercise with published report; reserve procurement framework pre-authorised by Treasury standing authority.',
        actionType: 'LEGISLATION',
        practicalExecution:
          'DHSC leads drafting. COVID Inquiry final recommendations incorporated before Second Reading. Wellcome Trust, Gates Foundation, and UKHSA provide technical input to pre-legislative scrutiny. Cross-party support anticipated given COVID Inquiry public findings.',
        keyRisks:
          "Cost of statutory stockpile requirements may deter Treasury support. The COVID Inquiry's final report may recommend a different approach. International threat landscape is changing — the next pandemic may require different preparedness than COVID-19.",
        orderIndex: 0,
      },
    ],
  },

  // ── 3. Defence Industrial Mobilisation Reserve ──────────────────────────
  {
    title: 'A Statutory UK Defence Industrial Mobilisation Reserve',
    summaryDescription:
      'The Ukraine war has demonstrated that modern warfare requires sustained industrial production at scale. The UK has no statutory mechanism to maintain a mobilisation baseline for defence production. This proposal creates one, without requiring increased defence spending in peacetime.',
    govtArea: 'Defence',
    summaryDiagnosis:
      "The UK's defence industrial base has been optimised for efficiency rather than surge capacity. The Ukraine conflict revealed that 155mm artillery shell production, air defence missiles, and drone manufacturing cannot be scaled quickly enough to sustain a peer-adversary conflict.",
    summaryGuidingPolicy:
      'A statutory Defence Industrial Mobilisation Reserve maintained by a new Defence Industrial Resilience Agency, with pre-negotiated surge contracts and a parliamentary accountability mechanism independent of the MoD procurement chain.',
    summaryCoherentActions:
      'Amend the Defence Reform Act 2014 to establish the Defence Industrial Resilience Agency, with a statutory mandate to maintain mobilisation baselines across Category A defence equipment types.',
    diagnosis: {
      diagnosisTitle: 'UK defence production cannot surge to wartime levels in an acceptable timeframe',
      text: 'The Russia-Ukraine war has consumed artillery ammunition, air defence missiles, and armoured vehicle components at rates that outstrip Western production capacity by factors of 5-10 times. RUSI analysis (2024) found that UK stockpiles of 155mm shells would be exhausted within weeks of a peer-adversary conflict. Production lines for Starstreak and NLAW missiles have been running at maximum capacity since 2022 but still cannot meet Ukrainian demand while maintaining UK reserve levels. Lead times for new production facilities are 3-7 years for most complex weapon systems.',
      whoAffected:
        'UK armed forces in any future conflict; NATO allies who depend on UK contributions to collective defence; the UK defence industrial base (estimated at 165,000 direct employees); wider security of UK and allied populations.',
      howAffected:
        'In a sustained conflict, the UK would face a choice between exhausting strategic reserves (leaving itself undefended) or reducing support to allies. Production ramp-up takes too long to prevent a critical capability gap. The industrial skills base has atrophied — some manufacturing capabilities (propellant production, certain electronics) have been lost entirely from the UK.',
      whyPersisted:
        "Post-Cold War defence procurement optimised for efficiency and unit cost rather than surge capacity. Maintaining idle production capacity is expensive and politically difficult to justify in peacetime. The Treasury's Green Book discount rate makes long-term preparedness investment appear poor value. MoD's focus on procurement of specific platforms has not included systematic assessment of industrial mobilisation baselines.",
      impactDescription:
        "RUSI and IISS analysis suggests that if Article 5 were invoked today and the UK committed forces to a Baltic defence scenario, current ammunition stocks would last approximately 8-14 days of high-intensity combat. This is not a classified assessment — it is consistent with parliamentary testimony by senior military officers.",
      impactCost:
        "The cost of maintaining a mobilisation reserve is estimated at 0.1-0.2% of GDP annually — significantly less than the cost of the capability gap it would prevent. By comparison, Ukraine has received approximately £7.8 billion in UK military aid since 2022, partly compensating for insufficient pre-war stockpiles.",
    },
    rootCause: {
      rootCauseTitle: 'Green Book methodology systematically undervalues defence industrial resilience',
      text: "HM Treasury's Green Book framework for public investment appraisal uses a social discount rate that makes future benefits appear less valuable than current costs. Maintaining idle industrial capacity has a high present cost and a future benefit (deterrence and surge capacity) that is systematically discounted by standard appraisal methods. No adjustments are made for strategic risk or catastrophic downside scenarios.",
      rootCauseMechanism:
        'MoD procurement is subject to Green Book appraisal requirements. Industrial resilience investment scores poorly against standard cost-effectiveness metrics because the benefit (avoiding a war or winning one) cannot be quantified using standard welfare economics. Defence procurement is therefore driven toward platform acquisition and operational readiness, with industrial mobilisation capacity treated as a residual rather than a primary objective.',
      whyNotSolved:
        "Previous National Security Strategies have identified the issue but not created statutory requirements. The Defence and Security Industrial Strategy (2021) acknowledged industrial resilience as a priority but relied on voluntary industry commitment. The Ukraine war has accelerated political attention but legislative change has not followed.",
    },
    guidingPolicy: {
      guidingPolicyTitle: 'A statutory mobilisation baseline maintained outside normal Treasury appraisal rules',
      text: "Create a statutory mechanism requiring HM Treasury and MoD to maintain a defined mobilisation baseline for Category A defence equipment (to be defined in secondary legislation based on NATO commitments), with pre-negotiated surge contracts that can be activated without new Treasury approval. Exempt industrial mobilisation investment from standard Green Book appraisal and create a defence-specific risk-adjusted appraisal methodology.",
      coreTheory:
        "Defence industrial resilience is a public good with deterrent value that standard cost-benefit analysis cannot capture. Making it a statutory obligation with defined minimum standards removes it from the annual spending review cycle, where it consistently loses to more visible expenditure.",
      mechanismRules:
        'Statutory minimum mobilisation baselines for Category A equipment, defined in secondary legislation and updated every five years via statutory instrument. Pre-negotiated surge contracts with defined industry partners. Parliamentary accountability through annual classified report to the Defence Select Committee.',
      mechanismInstitutionalRestructuring:
        'Defence Industrial Resilience Agency (DIRA) — a statutory body independent of MoD procurement, reporting to the National Security Adviser, with responsibility for monitoring mobilisation baselines and managing surge contracts.',
      tradeOffs:
        "Maintaining idle industrial capacity has a real cost — approximately £3-5 billion per year for a meaningful reserve. This must come from the defence budget, displacing platform acquisition. There is a genuine trade-off between force structure size and industrial depth. Exempting defence industrial investment from Green Book discipline creates a precedent other departments will seek to exploit. The statutory baselines will need to evolve as threat landscapes change — legislating specific equipment categories risks locking in yesterday's threats.",
      competitiveIdeaAnalysis:
        "The United States has the Defense Production Act, which provides pre-authorised surge powers and industrial reserve requirements. France maintains strategic industrial reserves through Direction Générale de l'Armement. Sweden has strengthened its Total Defence concept post-Ukraine, requiring industry to plan for wartime production. RUSI's 2024 report 'The Defence Industrial Base and the Requirements of Modern War' provides the most detailed UK-specific analysis.",
    },
    coherentActions: [
      {
        title: 'Establish the Defence Industrial Resilience Agency through primary legislation',
        detailedDescription:
          'Amend the Defence Reform Act 2014 to establish DIRA as a statutory body with: a mandate to maintain mobilisation baselines; power to negotiate and manage pre-surge contracts; exemption from standard Green Book appraisal for Category A industrial resilience investment; annual classified report to the Defence Select Committee.',
        actionType: 'STRUCTURAL',
        practicalExecution:
          'MoD leads drafting with Treasury. RUSI and IISS provide technical input. NATO baseline commitments form the foundation for Category A definitions. Industry consultation (BAE Systems, Rolls-Royce, Thales UK, Chemring) on surge contract structures.',
        keyRisks:
          'Treasury resistance to Green Book exemption. Difficulty defining Category A equipment without creating lobbying incentives for industry to seek inclusion. Political sensitivity of publishing even high-level mobilisation baseline information.',
        orderIndex: 0,
      },
    ],
  },

  // ── 4. ARIA Governance Reform ────────────────────────────────────────────
  {
    title: 'Making ARIA Work: Amending the ARIA Act to Deliver Genuine High-Risk Research Tolerance',
    summaryDescription:
      'The Advanced Research and Invention Agency was established in 2022 to fund high-risk, high-reward research outside normal government appraisal frameworks. In practice, Treasury and DSIT oversight requirements have replicated the risk-aversion ARIA was designed to escape. This proposal amends the ARIA Act to create genuine operational independence.',
    govtArea: 'Science',
    summaryDiagnosis:
      "ARIA's programme managers are applying for standard HM Treasury spending approval processes for research grants. This defeats the purpose of ARIA, which was designed to fund research that standard appraisal processes would reject.",
    summaryGuidingPolicy:
      "Amend the ARIA Act 2022 to explicitly prohibit the application of Green Book analysis to ARIA funding decisions, create a statutory risk tolerance framework based on DARPA's model, and give ARIA programme managers explicit authority to fund projects where the expected value of failure exceeds the cost.",
    summaryCoherentActions:
      "Insert new sections into the ARIA Act 2022 prohibiting Treasury from requiring Green Book compliance for individual ARIA funding decisions, and requiring ARIA's board to publish an annual Risk Tolerance Report.",
    diagnosis: {
      diagnosisTitle: 'ARIA is being administered as a normal government research fund',
      text: "The Advanced Research and Invention Agency Act 2022 gave ARIA exceptional freedoms: it was exempted from the Freedom of Information Act, given unusual flexibility on commercial activities, and designed with a flat programme manager structure modelled on DARPA. DARPA's model succeeds because programme managers have genuine authority to fund speculative research without justifying it through conventional cost-benefit analysis — the expectation is that most projects will fail, and a small number will be transformative. Evidence from ARIA's first two years suggests that Treasury and DSIT approval requirements are being applied to individual funding decisions in ways inconsistent with this model.",
      whoAffected:
        'The UK research and innovation ecosystem. Taxpayers who funded ARIA expecting transformative science. UK industries dependent on breakthrough innovation. Future generations who would benefit from high-risk research that is not being funded.',
      howAffected:
        'Programme managers are gravitating toward fundable projects rather than genuinely speculative ones. The ARIA board is receiving applications that look like conventional Innovate UK or UKRI grants. The £800 million budget is being deployed in ways that duplicate existing research funding mechanisms rather than complementing them.',
      whyPersisted:
        "Civil service risk aversion is deep-rooted. Treasury officials responsible for ARIA oversight face personal liability for approving expenditure that later appears wasteful; they face no equivalent liability for approving only safe projects. ARIA's exemptions from FoI were intended to protect research confidentiality, but they also reduce external accountability that might identify the problem.",
      impactDescription:
        "DARPA's 60-year track record includes: the internet, GPS, mRNA vaccine platforms, stealth technology, voice recognition. The economic return on DARPA's investment is orders of magnitude above any conventional research funding model. The UK's failure to replicate this is a missed opportunity for transformative innovation.",
      impactCost:
        "ARIA's £800 million budget over 10 years represents approximately £80 million per year. If deployed conventionally it will produce conventional returns. If deployed on genuine high-risk research, even a 1-in-10 success rate on transformative projects could produce economic returns of 100x or more.",
    },
    rootCause: {
      rootCauseTitle: 'Standard civil service accountability frameworks are incompatible with high-risk research funding',
      text: "ARIA's programme managers operate within a civil service accountability culture that treats failed expenditure as a disciplinary matter. DARPA's model explicitly expects and celebrates failure — programme managers who never fail are considered insufficiently ambitious. These two cultures are structurally incompatible, and the UK civil service culture is winning because it is embedded in the statutory oversight framework that was not reformed when ARIA was created.",
      rootCauseMechanism:
        'Treasury spending controls require any public expenditure above defined thresholds to be approved against Green Book criteria. ARIA was exempted from some normal UKRI processes but not from Treasury spending controls. Programme managers applying for Treasury approval for speculative projects face rejection or modification requirements that shift the project toward conventional research territory.',
      whyNotSolved:
        "ARIA is only three years old. The problem has been identified by insiders and commentators (Dominic Cummings and others who designed the model have publicly noted the drift) but has not yet produced legislative proposals. The solution requires Treasury to accept a genuine reduction in its oversight of a significant spending body.",
    },
    guidingPolicy: {
      guidingPolicyTitle: 'Statutory prohibition on applying standard appraisal to ARIA decisions, replaced by a published risk tolerance framework',
      text: "Remove Treasury's ability to apply Green Book criteria to individual ARIA funding decisions by statutory amendment. Replace with a published risk tolerance framework developed by ARIA's board and approved by Parliament, specifying the expected failure rate, minimum acceptable speculative content, and programme manager authority thresholds.",
      coreTheory:
        'High-risk research cannot be funded through a framework designed to minimise risk. ARIA needs genuine statutory authority to fund projects that would fail standard appraisal — not permission to try, which can always be overridden by Treasury controls.',
      mechanismRules:
        'Statutory amendment explicitly stating that Green Book appraisal requirements do not apply to ARIA funding decisions below a defined threshold (suggested: £50 million per project). Programme managers given personal authority to commit up to £5 million per project without board approval.',
      mechanismTransparency:
        "Annual Risk Tolerance Report published by ARIA's board, specifying: the proportion of portfolio expected to fail entirely; the proportion of projects assessed as more than 50% likely to fail; the distribution of expected value across portfolio. This transparency substitutes for Green Book compliance.",
      tradeOffs:
        'Genuine high-risk funding means genuine failures — some ARIA projects will produce nothing. This is politically difficult to defend when public money is involved. The FoI exemption already limits accountability; reducing Treasury oversight further reduces it further. There is a real risk that without conventional accountability, ARIA programme managers develop personal relationships with favoured researchers that amount to favouritism without meeting the bar of outright corruption.',
      competitiveIdeaAnalysis:
        "DARPA's model is the only proven model for this type of funding. Israel's MAFAT defence research directorate operates on similar principles. The EU's European Innovation Council Accelerator attempts a similar high-risk model but remains embedded in EU bureaucratic oversight structures.",
    },
    coherentActions: [
      {
        title: 'Amend the ARIA Act 2022 to create statutory protection from Green Book compliance',
        detailedDescription:
          "Insert a new section into the ARIA Act 2022 stating that HM Treasury may not require ARIA to apply Green Book appraisal criteria to individual funding decisions below £50 million, and that ARIA programme managers have personal authority to commit up to £5 million per project. Require ARIA's board to publish an annual Risk Tolerance Report as the accountability substitute.",
        actionType: 'LEGISLATION',
        practicalExecution:
          "DSIT introduces amendment via a Science and Technology Bill or ARIA Act amendment. Treasury accepts the Risk Tolerance Report as the accountability substitute. ARIA's board consults with DARPA programme managers on the risk tolerance framework.",
        keyRisks:
          'Treasury will resist any reduction in oversight. The £50 million threshold may need calibration. Political exposure when high-profile ARIA projects fail publicly.',
        orderIndex: 0,
      },
    ],
  },

  // ── 5. Parliamentary Pre-Legislative Scrutiny Reform ────────────────────
  {
    title: 'Mandatory Pre-Legislative Scrutiny for All Government Bills',
    summaryDescription:
      'The Institute for Government has documented that bills subjected to pre-legislative scrutiny produce significantly better legislation with fewer amendments and less litigation. Fewer than 15% of government bills currently receive this scrutiny. This proposal makes it the default.',
    govtArea: 'Cabinet Office',
    summaryDiagnosis:
      'Most UK legislation reaches the Commons without meaningful pre-parliamentary scrutiny. Bills are frequently amended significantly in committee, revised through ping-pong, and challenged in court — all of which suggests the initial drafting was inadequate.',
    summaryGuidingPolicy:
      'A statutory requirement for all government bills above a defined complexity threshold to be published in draft and subjected to a minimum eight-week scrutiny period by a Joint Committee or relevant Select Committee, with a published government response before First Reading.',
    summaryCoherentActions:
      'Introduce a Legislative Standards Act requiring draft publication of all Category A bills (to be defined by the Leader of the House in consultation with the Liaison Committee), with mandatory government response to scrutiny findings before introduction.',
    diagnosis: {
      diagnosisTitle: 'UK legislation is consistently poorly drafted and frequently amended after passage',
      text: "The Institute for Government's analysis of legislative quality (2022) found that bills not subjected to pre-legislative scrutiny were significantly more likely to require substantial amendment during passage, to generate judicial review challenges, and to require post-enactment correction. The Hansard Society's Audit of Political Engagement documents public concern about the quality of legislation. Several major recent Acts (Illegal Migration Act 2023, Online Safety Act 2023) required substantial amendment during passage and face ongoing legal challenges, suggesting inadequate pre-legislative development.",
      whoAffected:
        'Citizens governed by poorly drafted law. Businesses facing uncertain regulatory requirements. Courts forced to interpret unclear legislation. MPs who lack sufficient time to scrutinise complex bills during the parliamentary session.',
      howAffected:
        'Poor legislative drafting increases compliance costs for businesses, creates uncertainty about legal obligations, and generates litigation that consumes judicial resources. Secondary legislation (statutory instruments) used to patch primary legislation is subject to minimal parliamentary scrutiny.',
      whyPersisted:
        'Pre-legislative scrutiny slows the legislative process and reduces government control over timing. Governments with ambitious legislative programmes cannot afford the time it requires. The whipping system creates pressure to pass bills quickly. Scrutiny also creates political risk: pre-publication scrutiny reveals weaknesses in bills that can be exploited by opposition.',
      impactDescription:
        "The Delegated Powers and Regulatory Reform Committee has repeatedly criticised the volume of Henry VIII clauses (powers allowing ministers to change primary legislation by statutory instrument) in recent bills, indicating that bills are introduced before policy is finalised. The Judicial Review Review (2021) found that the volume of judicial review claims against government decisions had increased substantially.",
      impactCost:
        'The Cabinet Office estimates post-enactment correction costs at approximately £500 million per year across government. The cost of judicial review challenges to poorly drafted legislation is estimated separately at hundreds of millions annually.',
    },
    rootCause: {
      rootCauseTitle: 'Government controls the legislative timetable and faces no cost for poor drafting',
      text: "The government controls parliamentary time and faces minimal direct cost from poorly drafted legislation — the cost falls on businesses, courts, and ultimately taxpayers. Governments have a rational incentive to introduce bills quickly, amend them during passage, and accept the cost of subsequent correction rather than invest in slower pre-legislative development.",
      rootCauseMechanism:
        "The government's control of parliamentary time means it can introduce bills with limited scrutiny and force them through using the whip. There is no constitutional or statutory requirement for pre-legislative scrutiny. The political cost of a delayed bill (perceived weakness) exceeds the diffuse cost of poor legislation (spread across many actors over many years).",
      whyNotSolved:
        'Pre-legislative scrutiny is available as an option and is used for some high-profile bills. But it is discretionary and subject to government control of parliamentary time. Opposition parties benefit from poor legislation (it provides ammunition) so have limited incentive to propose structural reform that would require cross-party cooperation.',
    },
    guidingPolicy: {
      guidingPolicyTitle: 'A statutory default of pre-legislative scrutiny with a structured exception mechanism',
      text: 'Make pre-legislative scrutiny the statutory default for government bills above a complexity threshold, with a defined exception procedure for emergency legislation. Create a published government response obligation so that scrutiny recommendations cannot be ignored.',
      coreTheory:
        'Sunlight produces better legislation. If government must publish draft bills and respond to expert scrutiny before introduction, the political cost of poor drafting falls on the government earlier — when it can be corrected — rather than later when it generates judicial review or post-enactment correction.',
      mechanismRules:
        'Legislative Standards Act: all Category A bills must be published in draft for a minimum eight-week scrutiny period. Exception for emergency legislation (requiring a resolution of both Houses). Government must publish a written response to scrutiny findings before First Reading.',
      tradeOffs:
        "Pre-legislative scrutiny significantly slows the legislative process — potentially by 6-12 months per bill. Governments with ambitious programmes cannot afford this on all bills. An exception mechanism for emergency legislation is necessary but could be abused — 'emergency' has been claimed for non-emergency bills (Nationality and Borders Act 2022). Scrutiny committees can become partisan or captured by specific interest groups.",
      competitiveIdeaAnalysis:
        "New Zealand requires regulatory impact assessments for all significant legislation. Germany's Federal Ministry of Justice has mandatory pre-legislative peer review for complex bills. Canada requires departmental policy proposals to pass a Charter compliance check. Scotland publishes draft bills for consultation more frequently than Westminster.",
    },
    coherentActions: [
      {
        title: 'Introduce a Legislative Standards Act',
        detailedDescription:
          'Primary legislation requiring: mandatory draft publication of all government bills assessed by the Leader of the House (in consultation with the Liaison Committee) as Category A complexity; minimum eight-week Joint Committee scrutiny period; published government response within 12 weeks of scrutiny report; automatic exception mechanism for bills passed under emergency procedures (requiring a motion of both Houses).',
        actionType: 'LEGISLATION',
        practicalExecution:
          'Cabinet Office leads drafting. Institute for Government provides evidence to pre-legislative scrutiny of the bill itself. Liaison Committee consulted on Category A definition. Cross-party support expected from constitutional reform-minded MPs.',
        keyRisks:
          'Government of the day will resist any constraint on legislative timetable. Category A definition could be manipulated to exclude bills government wants to pass quickly. Emergency exception could be regularly used.',
        orderIndex: 0,
      },
    ],
  },

  // ── 6. Open Government Procurement Data ─────────────────────────────────
  {
    title: 'Machine-Readable Government Contract Data: Completing the Procurement Act 2023',
    summaryDescription:
      'The Procurement Act 2023 created a transparency framework for government contracts but the implementation portal publishes data in formats that cannot be systematically analysed. This proposal mandates machine-readable open data formats, transforming the transparency framework from compliance exercise to accountability tool.',
    govtArea: 'Cabinet Office',
    summaryDiagnosis:
      'The government spends approximately £300 billion per year through procurement but contract data is published in PDF or non-standardised formats that prevent systematic analysis of value for money, supplier concentration, or conflicts of interest.',
    summaryGuidingPolicy:
      'Require all government contracts above £10,000 to be published in OCDS (Open Contracting Data Standard) format on a single searchable API, enabling civil society, journalists, and researchers to analyse government spending systematically.',
    summaryCoherentActions:
      'Amend the Procurement Act 2023 secondary legislation to mandate OCDS compliance within 18 months, with a Cabinet Office-run central API replacing the current Contracts Finder portal.',
    diagnosis: {
      diagnosisTitle: 'Government procurement transparency exists on paper but not in practice',
      text: "The UK government publishes contract information through Contracts Finder and Find a Tender Service, nominally implementing the Procurement Act 2023's transparency requirements. However, data is published in inconsistent formats, with varying completeness, and without the machine-readable structure that would enable systematic analysis. Transparency International UK has documented that emergency procurement during COVID-19 (£37 billion through the VIP lane) would have been identifiable earlier with proper machine-readable data.",
      whoAffected:
        'Taxpayers whose money is being spent. SME suppliers who cannot access data needed to identify contracting opportunities. Civil society organisations monitoring for conflicts of interest. Journalists investigating public spending. MPs scrutinising government expenditure.',
      howAffected:
        'Without machine-readable data, analysing £300 billion of annual procurement requires either manual research (impractical) or web scraping (unreliable). Supplier concentration, conflicts of interest, and poor value for money cannot be identified systematically.',
      whyPersisted:
        'Publishing data in accessible formats has a cost — government systems are not designed for OCDS compliance. Departments have autonomy over procurement systems. There has been no statutory requirement for machine-readable data — only for publication.',
      impactDescription:
        'The COVID-19 PPE procurement scandal (£37 billion, significant waste and alleged conflicts of interest) was only identified through laborious manual research by journalists and NGOs. The National Audit Office has consistently found that government lacks data to assess procurement value for money systematically.',
      impactCost:
        'The NAO estimates that poor procurement value for money costs the government approximately £5-15 billion per year. Machine-readable transparency would not eliminate this but would enable faster identification of problems.',
    },
    rootCause: {
      rootCauseTitle: 'Transparency requirements without data standards create the appearance of accountability without the substance',
      text: 'Publishing contract data in PDF or inconsistent formats satisfies the letter of transparency requirements while preventing systematic analysis. Government departments face no requirement to adopt consistent data standards and face real costs in upgrading legacy procurement systems.',
      rootCauseMechanism:
        'Each department uses different procurement systems with different data structures. There is no central requirement to adopt OCDS or any common standard. Contracts Finder aggregates data but cannot enforce consistency. The result is transparency data that is technically public but practically inaccessible for systematic analysis.',
      whyNotSolved:
        'The Procurement Act 2023 focused on transparency obligations without specifying data standards — data standards were left to secondary legislation and Cabinet Office guidance. The cost of OCDS compliance falls on departments, who have resisted it. There is no powerful political constituency for technical data standards.',
    },
    guidingPolicy: {
      guidingPolicyTitle: 'Machine-readable procurement data as a statutory requirement, not a technical aspiration',
      text: 'Mandate OCDS compliance through secondary legislation under the Procurement Act 2023. Create a central Cabinet Office API replacing the fragmented current system. Fund the transition through efficiency savings from the improved analysis the data enables.',
      coreTheory:
        'Data standards are a public good. Once machine-readable procurement data exists, civil society, journalists, academia, and commercial companies will analyse it and produce accountability outputs that government cannot produce itself. The investment in data standards is therefore a lever that multiplies accountability.',
      mechanismTransparency:
        'OCDS (Open Contracting Data Standard) for all contracts above £10,000. Central API operated by Cabinet Office with guaranteed uptime and documented schema. All data under Open Government Licence.',
      tradeOffs:
        'OCDS compliance requires significant IT investment by departments — estimated at £100-300 million across government. Some procurement data is legitimately commercially sensitive and cannot be published — the standard must accommodate this. Machine-readable data makes it easier to identify problems, which creates political exposure for government — this is a feature, not a bug, but governments may resist it.',
      competitiveIdeaAnalysis:
        "The UK Open Government Partnership commitment included OCDS adoption but it has not been mandatory. Ukraine's Prozorro system (OCDS compliant) is the global benchmark for procurement transparency. Mexico and Colombia have implemented OCDS nationally. The UK has the infrastructure but lacks the mandate.",
    },
    coherentActions: [
      {
        title: 'Mandate OCDS compliance through Procurement Act secondary legislation',
        detailedDescription:
          'The Cabinet Office issues statutory instruments under the Procurement Act 2023 requiring all contracting authorities to publish contract data in OCDS format within 18 months. The current Contracts Finder portal is replaced by a central API with guaranteed availability and documented schema. Cabinet Office publishes transition guidance and model system specifications.',
        actionType: 'REGULATORY',
        practicalExecution:
          'Cabinet Office Digital team leads API development. Crown Commercial Service provides standard procurement system specifications. 18-month transition period allows departments to upgrade systems. Open Contracting Partnership provides technical standards support.',
        keyRisks:
          'IT implementation risk in government is high. 18 months may be insufficient for legacy system upgrades. Commercial sensitivity exemptions could be overused to limit actual transparency.',
        orderIndex: 0,
      },
    ],
  },

  // ── 7. Criminal Courts Digitisation Framework ────────────────────────────
  {
    title: 'A Statutory Framework for Remote and Hybrid Criminal Hearings',
    summaryDescription:
      "The Judicial Review and Courts Act 2022 enabled remote hearings for some proceedings but left criminal courts without a clear framework. The resulting ad hoc approach creates inconsistency, access issues, and unresolved questions about defendants' rights. This proposal creates the missing statutory framework.",
    govtArea: 'Justice',
    summaryDiagnosis:
      "Criminal courts lack a statutory framework governing when remote hearings are appropriate, defendants' rights to object, and the technical standards required. Judges are making inconsistent decisions and defendants in custody are appearing via video link without clear standards for when this is appropriate.",
    summaryGuidingPolicy:
      "A Criminal Courts Technology Act establishing: categories of hearing appropriate for remote participation; minimum technical standards; defendants' statutory right to request physical attendance; and a Digital Courts Service responsible for infrastructure.",
    summaryCoherentActions:
      'Introduce primary legislation creating the statutory framework for remote criminal hearings, with Criminal Procedure Rules amended to specify when remote participation is permitted and when it is not.',
    diagnosis: {
      diagnosisTitle: 'Remote criminal hearings lack a coherent statutory framework creating inconsistency and rights concerns',
      text: "The Judicial Review and Courts Act 2022 amended the Courts Act 2003 to permit remote participation in a range of proceedings. However, the legislation left significant discretion to individual judges and courts. Defendants in custody frequently appear via video link for hearings where their physical presence would be appropriate. Bar Council evidence to the Justice Select Committee (2023) documented inconsistent judicial practice, technical failures affecting proceedings, and concerns about defendants' ability to participate effectively in remote hearings.",
      whoAffected:
        'Defendants in criminal proceedings, particularly those in custody. Victims and witnesses whose cases are affected by inefficiency. Legal practitioners. Courts administration.',
      howAffected:
        'Defendants in custody appearing via video link may have limited ability to consult with their legal representatives during hearings. Technical failures cause adjournments. Inconsistent practice across courts means outcomes may depend on the court\'s approach rather than the merits.',
      whyPersisted:
        "The 2022 Act was passed without full parliamentary scrutiny of the criminal courts implications. HMCTS's digital reform programme was developed primarily for civil and family proceedings. Criminal courts have different constitutional requirements (right to confront accusers, right to trial) that were not fully addressed.",
      impactDescription:
        "HM Courts and Tribunals Service data shows the criminal courts backlog remains at historically high levels (over 60,000 Crown Court cases as of 2024). Remote hearings were expected to reduce the backlog but have not done so consistently, partly due to the absence of a clear framework.",
      impactCost:
        'The cost of the criminal courts backlog is estimated at hundreds of millions of pounds per year in prolonged remand, legal aid costs, and delayed justice for victims. Each month of backlog represents additional costs across the criminal justice system.',
    },
    rootCause: {
      rootCauseTitle: 'Technology was deployed without a coherent framework for when it is appropriate',
      text: 'Remote hearing technology was rapidly deployed during COVID-19 and subsequently made permanent without resolving fundamental questions about which hearings benefit from physical presence, what technical standards are required, and what rights defendants have to object to remote participation.',
      rootCauseMechanism:
        'HMCTS implemented video technology as an operational measure during COVID. When the 2022 Act provided statutory authority, it preserved broad judicial discretion rather than resolving the substantive questions. Without a framework, individual judges make inconsistent decisions based on their own views of technology and appropriate procedure.',
      whyNotSolved:
        'Creating a framework requires resolving genuinely difficult questions about defendants\' rights that different stakeholders answer differently. The judiciary wants discretion. The Bar wants physical hearings. HMCTS wants efficiency. These interests have prevented consensus on a framework.',
    },
    guidingPolicy: {
      guidingPolicyTitle: 'A tiered framework defining when remote hearings are permitted, required, and prohibited',
      text: 'Create statutory categories of criminal hearing: Category A (remote permitted by default — case management, bail, preliminary); Category B (remote permitted with defendant consent — pre-trial reviews, sentencing for minor offences); Category C (physical required — trials, serious sentencing). Minimum technical standards. Statutory right to request physical attendance in Categories A and B.',
      coreTheory:
        'Clarity of framework produces consistency of outcomes. If judges know which hearings are appropriate for remote participation, they can make consistent decisions. If defendants know their rights, they can exercise them. If HMCTS knows the technical standards required, it can invest in appropriate infrastructure.',
      mechanismRules:
        'Statutory categories of hearing (defined in primary legislation, detailed in Criminal Procedure Rules). Minimum technical standards (defined by HM Courts and Tribunals Service, updated regularly). Statutory right to request physical attendance in appropriate cases.',
      tradeOffs:
        'Any framework that increases remote hearings risks reducing the quality of justice for defendants who are less able to participate effectively via video. The evidence on whether remote hearings affect outcomes is contested. A statutory framework may be too rigid as technology evolves. Physical hearings have genuine efficiency costs — the current backlog suggests the system cannot afford to require physical presence for all hearings.',
      competitiveIdeaAnalysis:
        "Scotland has developed a more structured approach to remote hearings through the Criminal Procedure (Scotland) Act provisions. New Zealand's district courts have published detailed guidelines on remote hearing suitability. Australia's federal courts produced a remote hearings framework during COVID that has been retained post-pandemic.",
    },
    coherentActions: [
      {
        title: 'Introduce a Criminal Courts Technology Act',
        detailedDescription:
          'Primary legislation establishing: statutory categories of criminal hearing with defined remote participation rules; minimum technical standards enforceable by Criminal Procedure Rules; statutory right to request physical attendance with a defined exception procedure; a Digital Courts Service within HMCTS responsible for infrastructure standards.',
        actionType: 'LEGISLATION',
        practicalExecution:
          'Ministry of Justice leads drafting. Judiciary consulted on categories. Bar Council and Law Society provide evidence on defendants\' rights implications. Criminal Procedure Rule Committee develops detailed rules within the statutory framework.',
        keyRisks:
          'Judicial resistance to loss of discretion. Technical standards may be difficult to specify in primary legislation. The framework may become outdated as technology changes.',
        orderIndex: 0,
      },
    ],
  },

  // ── 8. NHS Diagnostic Waiting Time Guarantee ─────────────────────────────
  {
    title: 'A Statutory NHS Diagnostic Waiting Time Guarantee',
    summaryDescription:
      'The Darzi Review (2024) found that diagnostic delays are the primary driver of the NHS treatment backlog. This proposal creates a statutory 28-day diagnostic guarantee for cancer and cardiac pathways, following the model of the existing 18-week treatment standard.',
    govtArea: 'Health',
    summaryDiagnosis:
      'Patients waiting for cancer or cardiac diagnoses face delays of months, during which conditions deteriorate and treatment options narrow. The NHS has no statutory diagnostic waiting time standard equivalent to the 18-week treatment standard.',
    summaryGuidingPolicy:
      'A statutory 28-day Faster Diagnosis Standard for cancer and cardiac pathways, enforceable by NHS England, with a published accountability mechanism and a diagnostic workforce expansion plan backed by multi-year capital investment.',
    summaryCoherentActions:
      'Amend the National Health Service Act 2006 to create a statutory diagnostic waiting time standard for cancer and cardiac pathways, with NHS England required to publish quarterly performance data by trust and pathway.',
    diagnosis: {
      diagnosisTitle: 'Diagnostic delays are driving the NHS backlog and worsening outcomes',
      text: 'The Darzi Review (2024), commissioned by the Secretary of State for Health, found that diagnostic delays are a primary driver of the NHS treatment backlog. Approximately 1.6 million patients were waiting for a diagnostic test in England in 2024. For cancer pathways, diagnostic delay directly affects survival rates — CRUK analysis shows that one-stage improvement in cancer diagnosis (e.g., from Stage 3 to Stage 2) increases five-year survival by 15-25 percentage points. The NHS has a 28-day Faster Diagnosis Standard as a target but it is not statutory and is consistently missed.',
      whoAffected:
        'Patients on cancer and cardiac diagnostic pathways — approximately 2 million people per year. NHS staff managing high-demand diagnostic services. Taxpayers paying for later-stage treatment that earlier diagnosis would have prevented.',
      howAffected:
        'For cancer patients, diagnostic delays can mean the difference between curative and palliative treatment. For cardiac patients, delays in echocardiography or angiography increase risk of acute events. The longer the wait, the more complex and expensive the eventual treatment.',
      whyPersisted:
        'Diagnostic capacity requires capital investment in scanners, equipment, and specialist workforce training — all long lead time and expensive. Without a statutory standard, NHS England has no legal obligation to meet the 28-day target. Operational pressures consistently crowd out capital investment in diagnostics.',
      impactDescription:
        'CRUK estimates that diagnostic delays contribute to approximately 10,000 avoidable cancer deaths per year in the UK. The Darzi Review calculated that the NHS treatment backlog costs the economy approximately £15 billion per year in lost productivity from sick workers.',
      impactCost:
        'Late-stage cancer treatment costs approximately 3-4 times more than early-stage treatment for the same cancer type. Investing in diagnostic capacity has a positive return on investment within the NHS budget if the cost of later-stage treatment is included.',
    },
    rootCause: {
      rootCauseTitle: 'No statutory standard means no accountability for diagnostic performance',
      text: 'The 18-week treatment standard (introduced in 2008) is statutory and enforceable. Where it has been missed, NHS England has faced accountability. The diagnostic pathway that precedes treatment has no equivalent statutory standard — it is a target, not a right, and NHS trusts face no accountability for missing it.',
      rootCauseMechanism:
        'Without a statutory standard, NHS England cannot prioritise diagnostic capacity investment against competing operational pressures. Trusts facing winter pressures divert diagnostic staff and equipment to acute care. There is no mechanism to enforce the 28-day target or make NHS England accountable for failure to deliver it.',
      whyNotSolved:
        'The 28-day Faster Diagnosis Standard was introduced as a target in 2020 but was not made statutory because the diagnostic workforce and capital infrastructure needed to meet it did not exist. Making it statutory without the infrastructure was seen as setting up a standard the NHS would immediately breach.',
    },
    guidingPolicy: {
      guidingPolicyTitle: 'A phased statutory standard with infrastructure investment that makes the standard achievable',
      text: 'Create a statutory 28-day Faster Diagnosis Standard in primary legislation, with a three-year implementation period backed by a statutory Diagnostic Expansion Plan requiring NHS England to specify the workforce and capital investment needed to meet the standard. The standard should initially apply to cancer and cardiac pathways, expanding to additional pathways as capacity increases.',
      coreTheory:
        'A statutory standard creates accountability that a target cannot. If NHS England must meet the 28-day standard, it must invest in the infrastructure to make that possible. The three-year implementation period with a statutory Diagnostic Expansion Plan addresses the infrastructure gap — the plan must specify how the standard will be met.',
      mechanismRules:
        'Statutory 28-day Faster Diagnosis Standard in NHS Act 2006, taking effect three years after Royal Assent. NHS England must publish quarterly trust-level performance data. CQC given enforcement power for persistent breach.',
      mechanismInstitutionalRestructuring:
        'Statutory Diagnostic Expansion Plan published by NHS England within 12 months of Royal Assent, specifying workforce (radiologists, sonographers, radiographers), capital investment (scanners, endoscopy suites), and timeline for reaching the standard.',
      tradeOffs:
        'Making the standard statutory without the infrastructure creates an immediately breached obligation — hence the three-year implementation period. The capital and workforce investment required is substantial (Darzi Review estimated £2-4 billion). Prioritising cancer and cardiac pathways may draw capacity away from other diagnostic pathways. The standard may be met by gaming the pathway definitions rather than genuinely improving performance.',
      competitiveIdeaAnalysis:
        "Denmark introduced a cancer patient guarantee in 2007 with statutory timelines for diagnosis and treatment — subsequent analysis showed improved survival rates. Sweden has statutory cancer waiting time standards. Canada (Ontario) has introduced diagnostic wait time reporting with accountability mechanisms. The NHS 18-week treatment standard itself is the closest domestic precedent.",
    },
    coherentActions: [
      {
        title: 'Amend the National Health Service Act 2006 to create the Faster Diagnosis Standard',
        detailedDescription:
          'Insert a new section into the NHS Act 2006 creating a statutory right to a diagnostic decision within 28 days of GP referral for cancer and cardiac pathways, taking effect three years after Royal Assent. NHS England must publish a Diagnostic Expansion Plan within 12 months specifying workforce, capital, and pathway requirements. CQC given enforcement power for persistent breach above 20% of pathway referrals.',
        actionType: 'LEGISLATION',
        practicalExecution:
          'DHSC leads drafting. NHS England produces the Diagnostic Expansion Plan. CRUK, British Heart Foundation, and British Medical Association provide clinical evidence. Treasury agrees multi-year capital settlement for diagnostic equipment.',
        keyRisks:
          'Three-year implementation may not be sufficient if workforce expansion takes longer. Capital investment may not materialise in Spending Review. Performance may be met by pathway gaming rather than genuine improvement.',
        orderIndex: 0,
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Result tracking
// ─────────────────────────────────────────────────────────────────────────────

interface ResultRecord {
  title: string
  ideaId: string
  diagnosis: 'created' | 'updated' | 'skipped' | 'error'
  rootCause: 'created' | 'skipped' | 'error'
  guidingPolicy: 'created' | 'updated' | 'skipped' | 'error'
  coherentActions: number
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Upsert editorial user ───────────────────────────────────────────────
  console.log('\n── Editorial user ──────────────────────────────────────────────')
  const user = await prisma.user.upsert({
    where: { clerkId: EDITORIAL_USER.clerkId },
    update: {
      name: EDITORIAL_USER.name,
      email: EDITORIAL_USER.email,
    },
    create: {
      clerkId: EDITORIAL_USER.clerkId,
      firstName: EDITORIAL_USER.firstName,
      lastName: EDITORIAL_USER.lastName,
      name: EDITORIAL_USER.name,
      username: EDITORIAL_USER.username,
      email: EDITORIAL_USER.email,
      emailVerified: false,
      ageConfirmed: true,
      role: 'CITIZEN',
      country: 'GB',
      isHistoricalAccount: false,
      referralCode: EDITORIAL_USER.referralCode,
    },
  })
  console.log(`  ✓ User: ${user.name} (${user.id})`)

  // ── 2. Process each idea ───────────────────────────────────────────────────
  console.log('\n── Ideas and strategic kernels ─────────────────────────────────')
  const results: ResultRecord[] = []

  for (const idea of EDITORIAL_IDEAS) {
    const result: ResultRecord = {
      title: idea.title,
      ideaId: '',
      diagnosis: 'skipped',
      rootCause: 'skipped',
      guidingPolicy: 'skipped',
      coherentActions: 0,
    }

    try {
      // Upsert the idea by title + creatorId
      const existing = await prisma.idea.findFirst({
        where: { title: idea.title, creatorId: user.id },
        select: { id: true },
      })

      let ideaRecord: { id: string }
      if (existing) {
        ideaRecord = await prisma.idea.update({
          where: { id: existing.id },
          data: {
            summaryDescription: idea.summaryDescription,
            summaryDiagnosis: idea.summaryDiagnosis,
            summaryGuidingPolicy: idea.summaryGuidingPolicy,
            summaryCoherentActions: idea.summaryCoherentActions,
            govtArea: idea.govtArea,
            ideaOrigin: 'EDITORIAL_SEED',
            bannerColour: '#3B82F6',
            bannerText: EDITORIAL_BANNER_TEXT,
            status: 'ACTIVE',
            stage: 'STAGE_3',
            visibility: 'LINK_ONLY',
            ideaType: 'LEGISLATION',
          },
          select: { id: true },
        })
      } else {
        ideaRecord = await prisma.idea.create({
          data: {
            creatorId: user.id,
            title: idea.title,
            summaryDescription: idea.summaryDescription,
            summaryDiagnosis: idea.summaryDiagnosis,
            summaryGuidingPolicy: idea.summaryGuidingPolicy,
            summaryCoherentActions: idea.summaryCoherentActions,
            govtArea: idea.govtArea,
            ideaOrigin: 'EDITORIAL_SEED',
            bannerColour: '#3B82F6',
            bannerText: EDITORIAL_BANNER_TEXT,
            status: 'ACTIVE',
            stage: 'STAGE_3',
            visibility: 'LINK_ONLY',
            ideaType: 'LEGISLATION',
          },
          select: { id: true },
        })
      }
      result.ideaId = ideaRecord.id

      // ── Diagnosis (unique per ideaId — upsert) ─────────────────────────────
      try {
        const existingDiag = await prisma.diagnosis.findUnique({ where: { ideaId: ideaRecord.id } })
        if (existingDiag) {
          await prisma.diagnosis.update({
            where: { ideaId: ideaRecord.id },
            data: idea.diagnosis,
          })
          result.diagnosis = 'updated'
        } else {
          await prisma.diagnosis.create({
            data: { ideaId: ideaRecord.id, ...idea.diagnosis },
          })
          result.diagnosis = 'created'
        }
      } catch (err) {
        console.error(`  ✗ Diagnosis failed for "${idea.title}":`, err)
        result.diagnosis = 'error'
      }

      // ── RootCause (create only if none exist) ──────────────────────────────
      try {
        const existingRC = await prisma.rootCause.findFirst({ where: { ideaId: ideaRecord.id } })
        if (!existingRC) {
          await prisma.rootCause.create({
            data: { ideaId: ideaRecord.id, ...idea.rootCause },
          })
          result.rootCause = 'created'
        } else {
          result.rootCause = 'skipped'
        }
      } catch (err) {
        console.error(`  ✗ RootCause failed for "${idea.title}":`, err)
        result.rootCause = 'error'
      }

      // ── GuidingPolicy (unique per ideaId — upsert) ─────────────────────────
      try {
        const existingGP = await prisma.guidingPolicy.findUnique({ where: { ideaId: ideaRecord.id } })
        if (existingGP) {
          await prisma.guidingPolicy.update({
            where: { ideaId: ideaRecord.id },
            data: idea.guidingPolicy,
          })
          result.guidingPolicy = 'updated'
        } else {
          await prisma.guidingPolicy.create({
            data: { ideaId: ideaRecord.id, ...idea.guidingPolicy },
          })
          result.guidingPolicy = 'created'
        }
      } catch (err) {
        console.error(`  ✗ GuidingPolicy failed for "${idea.title}":`, err)
        result.guidingPolicy = 'error'
      }

      // ── CoherentActions (create only if none exist for this idea) ──────────
      try {
        const existingCA = await prisma.coherentAction.findFirst({ where: { ideaId: ideaRecord.id } })
        if (!existingCA) {
          for (const action of idea.coherentActions) {
            await prisma.coherentAction.create({
              data: { ideaId: ideaRecord.id, ...action },
            })
          }
          result.coherentActions = idea.coherentActions.length
        } else {
          const count = await prisma.coherentAction.count({ where: { ideaId: ideaRecord.id } })
          result.coherentActions = count
        }
      } catch (err) {
        console.error(`  ✗ CoherentActions failed for "${idea.title}":`, err)
      }

      console.log(`  ✓ "${idea.title}" (${ideaRecord.id})`)
      results.push(result)
    } catch (err) {
      console.error(`  ✗ Fatal error for "${idea.title}":`, err)
      result.error = String(err)
      results.push(result)
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════')
  console.log('SEED SUMMARY — 8 EDITORIAL IDEAS')
  console.log('════════════════════════════════════════════════════════════════')
  console.log(
    `${'Title'.padEnd(60)} ${'Diag'.padEnd(8)} ${'Root'.padEnd(8)} ${'Policy'.padEnd(8)} ${'CA#'}`
  )
  console.log('─'.repeat(90))
  for (const r of results) {
    const title = r.title.length > 58 ? r.title.slice(0, 55) + '...' : r.title
    const diag = r.diagnosis.padEnd(8)
    const rc = r.rootCause.padEnd(8)
    const gp = r.guidingPolicy.padEnd(8)
    const ca = String(r.coherentActions)
    console.log(`${title.padEnd(60)} ${diag} ${rc} ${gp} ${ca}`)
    if (r.error) console.log(`  ERROR: ${r.error}`)
  }
  console.log('─'.repeat(90))
  console.log(
    `Total: ${results.filter(r => !r.error).length}/${EDITORIAL_IDEAS.length} ideas processed successfully.`
  )
  console.log('\nIdea IDs:')
  for (const r of results) {
    if (r.ideaId) console.log(`  ${r.ideaId}  ${r.title.slice(0, 60)}`)
  }
}

main()
  .catch(err => { console.error('Fatal error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
