/**
 * Seed Stage 2 strategic kernel sub-entity records for the 20 historical
 * example ideas: Diagnosis, RootCause, GuidingPolicy, CoherentAction.
 *
 * Idempotent:
 *   - Diagnosis and GuidingPolicy are upserted (@@unique on ideaId).
 *   - RootCause and CoherentAction are only created if none exist for the idea.
 *
 * Run with:
 *   npx tsx --env-file=.env scripts/seed/seed-historical-kernels.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ─────────────────────────────────────────────────────────────────────────────
// Kernel data — one entry per historical idea
// ─────────────────────────────────────────────────────────────────────────────

interface KernelEntry {
  ideaId: string
  title: string
  diagnosis: {
    text: string
    whoAffected: string
    impactDescription: string
    obstacleDefined?: string
    howAffected?: string
    whyPersisted?: string
    impactCost?: string
  }
  rootCause: {
    text: string
    rootCauseMechanism?: string
    whyNotSolved?: string
  }
  guidingPolicy: {
    text: string
    coreTheory?: string
    mechanismRules?: string
    tradeOffs?: string
    competitiveIdeaAnalysis?: string
  }
  coherentActions: Array<{
    title: string
    detailedDescription: string
    actionType: string
    orderIndex: number
  }>
}

const KERNELS: KernelEntry[] = [
  // ── 1. Homelessness Reduction Act 2017 ────────────────────────────────────
  {
    ideaId: 'cb7498df-8275-4d18-ae85-662887249ecc',
    title: 'Homelessness Reduction Act 2017',
    diagnosis: {
      text: 'English councils only had a legal duty to house people after they had already become homeless. The Housing Act 1996 threshold was actual homelessness, not risk of homelessness. This meant prevention was structurally excluded from local authority responsibilities. Thousands of families were turned away at the point of crisis because they were not yet technically homeless.',
      whoAffected: 'Households at risk of homelessness, particularly private renters facing no-fault evictions, people leaving prison or hospital, young people leaving care, and families fleeing domestic abuse.',
      impactDescription: 'Roughly 60,000 households were accepted as homeless each year in England, with the true number far higher once those turned away are included. The cost of emergency accommodation and associated welfare support ran to hundreds of millions of pounds annually.',
      obstacleDefined: 'Councils lacked both a legal obligation and financial incentive to act before homelessness occurred. The 1996 framework created a reactive system that penalised prevention by reserving resources for post-homelessness duties.',
      howAffected: 'Households presented to councils at crisis point and were frequently refused assessment because they did not meet the priority need threshold or had not yet reached the legal definition of homelessness. Many were given advice leaflets and turned away.',
      whyPersisted: 'The Housing Act 1996 had not been substantially reformed. Central government had not funded prevention duties. Councils, under severe budget pressure, had no incentive to invest in upstream prevention when legal obligations only triggered on actual homelessness.',
      impactCost: 'The government\'s own assessment put the cost of homelessness to public services at £1 billion per year when including emergency accommodation, health, criminal justice, and social care costs.',
    },
    rootCause: {
      text: 'The Housing Act 1996 only triggered a local authority duty on actual homelessness, not the risk of it. There was no legal framework, no ring-fenced funding, and no performance management system for prevention work. Councils acting preventively were effectively subsidising the prevention of a problem they were not legally required to address.',
      rootCauseMechanism: 'Legal obligation follows the event rather than precedes it. Prevention work is discretionary and therefore first to be cut under budget pressure. Without a statutory prevention duty, councils have no defensible basis for allocating resources to households who are not yet in crisis.',
      whyNotSolved: 'Previous government reviews had recognised the problem but not legislated. The 2002 Homelessness Act made prevention guidance statutory but not the duty itself. Housing authorities had consistently argued that extending the duty would create unmanageable demand.',
    },
    guidingPolicy: {
      text: 'Create a new statutory Prevention Duty requiring councils to take reasonable steps to prevent homelessness 56 days before it occurs, for anyone at risk regardless of priority group status. Alongside a Relief Duty for those already homeless who are not in priority need.',
      coreTheory: 'If the law creates a prevention obligation with a 56-day window, councils will build the upstream capacity to act. The cost of prevention is lower than the cost of emergency accommodation. Extending duty beyond priority groups ensures the system does not simply shift the burden onto those excluded from the 1996 framework.',
      mechanismRules: 'Statutory Prevention Duty (56 days before homelessness), statutory Relief Duty (56 days of active assistance after homelessness), Personalised Housing Plan for every household, and removal of the intentionality test for domestic abuse survivors.',
      tradeOffs: 'Extending duty to all homeless households regardless of priority need significantly increases the volume of people councils must actively assist. Government new burdens funding is essential. The risk is that without adequate funding, councils meet the letter of the duty but not its spirit.',
      competitiveIdeaAnalysis: 'The 2002 Homelessness Act created prevention guidance but not obligation. The 2003 Homelessness Code of Guidance encouraged prevention but could not compel it. Scotland\'s Housing (Scotland) Act 2010 abolished the priority need test entirely — the Reduction Act took a more incremental approach by retaining priority need while extending prevention duties.',
    },
    coherentActions: [
      {
        title: 'Introduce the Homelessness Reduction Bill',
        detailedDescription: 'Shelter and Crisis to draft the legislative text. Bob Blackman MP to introduce as a Private Member\'s Bill. Government to confirm support and provide new burdens funding for local authorities. Bill committee to take evidence from councils, housing charities, and affected households. MHCLG to publish statutory guidance before commencement.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Secure government new burdens funding',
        detailedDescription: 'MHCLG to assess the financial impact of the new prevention and relief duties on all local housing authorities and fund the estimated £60–80 million annual cost of new burdens created by the Act.',
        actionType: 'REGULATION',
        orderIndex: 1,
      },
    ],
  },

  // ── 2. Modern Slavery Act 2015 ────────────────────────────────────────────
  {
    ideaId: '8bf7ced7-baab-4f72-8765-56a3c6fa4426',
    title: 'Modern Slavery Act 2015',
    diagnosis: {
      text: 'Slavery and trafficking offences were scattered across the Asylum and Immigration (Treatment of Claimants) Act 2004, the Sexual Offences Act 2003, and the Coroners and Justice Act 2009. Prosecutors had to navigate incompatible statutory frameworks, resulting in low conviction rates. The scale of modern slavery in the UK — estimated at 10,000–13,000 victims — was largely hidden, with no dedicated investigatory framework and no independent oversight body.',
      whoAffected: 'Victims of trafficking and forced labour, including domestic workers, agricultural workers, sex industry workers, and children exploited for criminal purposes. Disproportionately affecting migrants without secure immigration status.',
      impactDescription: 'The UK was both a destination and transit country for trafficking. The National Referral Mechanism identified around 2,340 potential victims in 2013, but this was regarded as a significant underestimate. UK supply chains were exposed to forced labour from which consumers had no means of protection.',
      obstacleDefined: 'Legislative fragmentation made prosecution complex. No single enforcement body had responsibility. Supply chain transparency was entirely voluntary — companies faced no obligation to investigate or disclose slavery risks.',
      howAffected: 'Victims faced a criminal justice system designed around immigration enforcement rather than protection. Many were prosecuted for crimes committed under coercion before being identified as victims. Civil society organisations were poorly resourced to identify and support victims.',
      whyPersisted: 'The problem was hidden in plain sight — in car washes, nail bars, agricultural gangmasters, and private households. The 2009 Coroners and Justice Act had consolidated some offences but not created a coordinated response. The political will to act followed the 2013 publication of the All-Party Parliamentary Group report.',
    },
    rootCause: {
      text: 'Legislative fragmentation meant investigators had to navigate multiple incompatible statutes to prosecute a single trafficking case. No independent oversight body existed to coordinate the government response across Home Office, DWP, HMRC, and Border Force. Supply chain transparency was entirely voluntary, leaving corporate complicity unchallenged.',
      rootCauseMechanism: 'Three distinct failure mechanisms: (1) legal complexity deterred prosecution; (2) no coordination function existed to join up the government response; (3) no transparency obligation created no reputational or financial incentive for businesses to investigate their supply chains.',
      whyNotSolved: 'The issue crossed departmental boundaries — Home Office (trafficking), DWP (labour exploitation), HMRC (gangmaster licensing), Foreign Office (overseas supply chains). No single department owned the policy. The Cross-Government Group on Human Trafficking existed but had no power to compel action.',
    },
    guidingPolicy: {
      text: 'Consolidate all slavery and trafficking offences into a single Act; appoint an Independent Anti-Slavery Commissioner to drive the government response; require large businesses to publish annual statements on steps taken to ensure slavery-free supply chains.',
      coreTheory: 'Consolidation removes the prosecutorial barrier. Independent oversight creates accountability for the government response. Transparency requirements shift the burden of investigation onto businesses with the resources to conduct it, using reputational risk as the enforcement mechanism.',
      mechanismRules: 'New consolidated offences (slavery, servitude, forced labour, human trafficking) with enhanced maximum sentences. Independent Commissioner with powers to review government strategy and direct law enforcement. Section 54 supply chain transparency obligation for businesses with turnover over £36 million.',
      tradeOffs: 'Section 54 is a transparency obligation, not a substantive one — companies must publish a statement, but the statement can say they have taken no steps. The effectiveness of the transparency regime depends on investor and consumer pressure rather than direct enforcement.',
      competitiveIdeaAnalysis: 'California\'s Transparency in Supply Chains Act 2010 was the first mandatory supply chain disclosure law and directly influenced the Section 54 model. The Council of Europe Convention on Action Against Trafficking had been ratified by the UK in 2008 but not fully implemented. The Coroners and Justice Act 2009 consolidated some offences but left the coordination gap unaddressed.',
    },
    coherentActions: [
      {
        title: 'Introduce the Modern Slavery Bill',
        detailedDescription: 'Home Office to introduce the Bill with three substantive parts: Part 1 (consolidated offences), Part 2 (Independent Anti-Slavery Commissioner), Part 3 (transparency in supply chains). Pre-legislative scrutiny by the Joint Committee on Human Rights. Royal Assent by March 2015 before the general election.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Establish the Independent Anti-Slavery Commissioner',
        detailedDescription: 'Appoint the Commissioner on statutory basis with powers to publish strategy reviews, direct law enforcement priorities, and report to Parliament. The first Commissioner (Kevin Hyland) to publish the first annual report within twelve months of appointment.',
        actionType: 'STRUCTURAL',
        orderIndex: 1,
      },
    ],
  },

  // ── 3. Hunting Act 2004 ───────────────────────────────────────────────────
  {
    ideaId: '5306bb29-480e-4d3c-afc5-448e4f02e2bf',
    title: 'Hunting Act 2004',
    diagnosis: {
      text: 'Fox hunting with hounds was a form of elite recreational killing with no justification as pest control — terrier work to bolt foxes had been the demonstrated alternative. The Countryside Alliance and the House of Lords had blocked parliamentary reform for 60 years. Animal welfare evidence, including the Burns Report (2000), confirmed that hunting caused suffering.',
      whoAffected: 'Wild mammals — principally foxes, deer, hares, and mink — hunted for recreational purposes. Farmers using hunting as a claimed pest control method were a secondary consideration, with terrier work providing a genuine non-cruel alternative.',
      impactDescription: 'Approximately 300 registered hunts operated in England and Wales. The Burns Report estimated several thousand foxes killed annually by hunts, in addition to deer, hares, and mink. The suffering caused by prolonged chase and death-by-hounds was documented but legally unaddressed.',
      obstacleDefined: 'The House of Lords constituted a structural veto: landowner and farming interests in the Lords blocked Commons-passed bans in 1997, 1998, and 2002. The Parliament Acts were legally available but had rarely been used against specific policy.',
      howAffected: 'Wildlife suffered through a prolonged chase ending in death by hounds — a process Burns described as "seriously compromising" the welfare of the hunted animal. No licensing system, bag limit, or welfare standard constrained hunting practice.',
      whyPersisted: 'The Lords rejected reform three times. The Countryside Alliance mounted a mass protest (the Liberty and Livelihood march, 2002) and sustained high-pressure lobbying. The constitutional convention against using the Parliament Acts was strong enough that Labour deferred legislation for a full parliamentary term.',
    },
    rootCause: {
      text: 'The House of Lords had an effective veto. The Parliament Acts of 1911 and 1949 were legally available but their use required political will that previous governments had declined to exercise. The Lords\' protection of landowning interests in relation to hunting was entrenched across party lines in the upper chamber.',
      rootCauseMechanism: 'The constitutional mechanism — the Lords\' power to delay but not permanently block — was underused. The hunting lobby exploited the two-session delay the Lords could impose, making reform expensive in parliamentary time. The absence of elected Lords reform (failed in 1999 other than hereditary peers) left the blocker in place.',
      whyNotSolved: 'Three previous Commons majorities had failed to become law because of Lords resistance. The 2001 manifesto committed to allowing a free vote; the Commons passed a ban in 2002 and 2003 before the Parliament Acts route was finally used in 2004. The delay of seven years (from 1997 to 2004) reflected political calculation about spending Parliament Act capital.',
    },
    guidingPolicy: {
      text: 'A straightforward outright ban on hunting wild mammals with dogs, with criminal penalties, limited exemptions for genuine pest control, and use of the Parliament Acts if the Lords blocked the Commons majority for a fourth time.',
      coreTheory: 'A clean ban with criminal penalties is enforceable and sends an unambiguous cultural signal. Limited exemptions for genuine pest control prevent the ban from being undermined but must be tightly drafted to prevent "trail hunting" substitution.',
      mechanismRules: 'Section 1 of the Hunting Act creates the offence of hunting a wild mammal with a dog. Section 2 provides limited exemptions for stalking and flushing using one or two dogs. Penalties: unlimited fine, up to 6 months imprisonment. Enforcement by police.',
      tradeOffs: 'The limited exemptions in the Act — particularly flushing for shooting — have been argued by hunts to permit near-equivalent activity under cover of "trail hunting". Enforcement requires police resources and prosecutorial will that has not always been present. A cleaner ban without exemptions would be more enforceable but politically harder to pass.',
      competitiveIdeaAnalysis: 'Scotland banned hunting in 2002 via the Protection of Wild Mammals (Scotland) Act. Three previous English and Welsh Bills passed the Commons but failed in the Lords. The Wild Mammals (Protection) Act 1996 addressed cruelty but not hunting per se.',
    },
    coherentActions: [
      {
        title: 'Introduce the Hunting Bill and invoke the Parliament Acts',
        detailedDescription: 'Government to introduce the Hunting Bill in the Commons. After Lords rejection, invoke the Parliament Acts to pass it without Lords consent. Royal Assent by November 2004 with commencement from February 2005, allowing one final hunting season before the ban took effect.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 4. Gender Recognition Act 2004 ───────────────────────────────────────
  {
    ideaId: 'e72cc67b-8f27-40bb-95c9-6cb2b993887c',
    title: 'Gender Recognition Act 2004',
    diagnosis: {
      text: 'Trans people had no mechanism to obtain legal recognition of their acquired gender under UK law. The birth certificate was permanent and could not be amended. Following Goodwin v United Kingdom (2002), the European Court of Human Rights found the UK in breach of Articles 8 and 12 of the Convention. The government was legally required to provide a mechanism for gender recognition.',
      whoAffected: 'Trans people in the UK — estimated at around 5,000 individuals who had transitioned — who could not marry in their acquired gender, access their pension at the correct age, or hold a passport consistent with their identity.',
      impactDescription: 'Trans people were forced to use documentation inconsistent with their presentation, creating daily humiliation and practical barriers. The pension age gap affected trans women who reached 60 (then the female pension age) but were legally male. The inability to marry in acquired gender meant a trans person in a long-term relationship had no path to legal marriage.',
      obstacleDefined: 'UK law had no concept of legal gender change. The Births and Deaths Registration Act 1953 treated birth registration as permanent. Without a statutory framework, courts consistently held that "sex" in legislation meant biological sex at birth.',
      howAffected: 'Trans people could not get a birth certificate reflecting their gender, could not marry a person of their birth sex, and received pensions on the basis of their birth sex regardless of how long they had lived in their acquired gender.',
      whyPersisted: 'The legal position had been clear since Corbett v Corbett (1970). The European Court had not previously found the UK in breach. After Goodwin v UK (2002), the government could no longer delay — but a recognition mechanism had to be designed from scratch.',
    },
    rootCause: {
      text: 'UK law had no concept of legal gender change. The common law and statutory framework treated biological sex at birth as immutable for all legal purposes. The Goodwin judgment created a ECHR compliance obligation that could only be met by primary legislation creating a new statutory mechanism.',
      rootCauseMechanism: 'The absence of any legal pathway for gender recognition meant that any trans person asserting their acquired gender in any legal context was immediately overridden by their birth registration. No judicial, administrative, or administrative mechanism existed to change this.',
      whyNotSolved: 'The UK had consistently argued before Strasbourg that the law was justified by the interests of third parties and administrative certainty. Corbett v Corbett had set the legal framework in 1970 and had been consistently followed. Political will to act followed the ECHR judgment rather than preceding it.',
    },
    guidingPolicy: {
      text: 'Establish a Gender Recognition Panel — a quasi-judicial body — to assess applications for legal recognition of acquired gender and issue Gender Recognition Certificates conferring full legal status in the acquired gender, including for marriage and pension purposes.',
      coreTheory: 'A panel-based process with evidence requirements provides legal certainty and a mechanism for challenge, while establishing the principle that gender recognition is a legal matter determinable by a defined process rather than a biological or medical judgment.',
      mechanismRules: 'Gender Recognition Certificate issued by the Panel on evidence of: diagnosis of gender dysphoria, living in acquired gender for two years, statutory declaration of intent to live permanently. Full legal recognition in acquired gender for all purposes.',
      tradeOffs: 'The medical diagnosis requirement was controversial at the time and subsequently — it pathologises trans identity. The two-year real-life experience test was the minimum consistent with ECHR compliance. Later reform movements argued for a self-declaration system without medical requirements.',
      competitiveIdeaAnalysis: 'Ireland adopted a self-declaration system in 2015, the first country to do so. Denmark followed in 2014. The Gender Recognition Act\'s panel model was one of the more demanding in Europe in terms of medical evidence requirements, but was the minimum acceptable to government at the time.',
    },
    coherentActions: [
      {
        title: 'Introduce the Gender Recognition Bill',
        detailedDescription: 'Department for Constitutional Affairs to introduce the Bill establishing the Gender Recognition Panel, defining the criteria for a Gender Recognition Certificate, and amending pensions, marriage, and succession law to give full effect to the GRC. Press for Change to give evidence to the Bill committee. Royal Assent by July 2004.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 5. Gender Pay Gap Reporting ───────────────────────────────────────────
  {
    ideaId: '151ddbf1-e356-4cd2-a80a-1dd541e2b100',
    title: 'Gender Pay Gap Reporting in the Equality Act 2010',
    diagnosis: {
      text: 'Women earned significantly less than men across all sectors and occupations. The equal pay individual rights created by the Equal Pay Act 1970 could not address structural occupational segregation or the bonus gap. Without mandatory transparency requirements, employers had no accountability for aggregate pay differences and no incentive to act on them.',
      whoAffected: 'Female employees across all sectors. The gap was widest in financial services, construction, and professional services. Part-time workers — predominantly women — faced an additional pay penalty.',
      impactDescription: 'The mean gender pay gap in 2009 was approximately 22% (full-time) and 36% (all employees including part-time). Women lost an estimated £330,000 over a lifetime compared to men doing equivalent work. The aggregate cost to the UK economy of underutilising female talent was estimated at £23 billion per year.',
      obstacleDefined: 'Pay transparency was entirely voluntary. The Equal Opportunities Commission had recommended mandatory reporting since 2001. Successive governments had resisted, citing employer concerns about administrative burden. The Kingsmill Review (2001) recommended voluntary action, which had demonstrably failed.',
      howAffected: 'Individual women could not know whether they were being paid less than male colleagues doing equivalent work, making individual equal pay claims nearly impossible to bring. The systematic gap remained invisible to external scrutiny.',
      whyPersisted: 'Employer lobby groups consistently argued against mandatory reporting. The DTI and later BIS gave weight to competitiveness arguments. Voluntary action was tried twice (2001, 2007) without measurable impact. The Equality Bill of 2009 created the power to mandate reporting but left activation to secondary legislation.',
    },
    rootCause: {
      text: 'Pay transparency was entirely voluntary. The Equal Pay Act 1970 required equal pay for equal work but could not address structural gaps. Without a legal obligation to measure and disclose the gap, employers had no reputational or financial incentive to address it.',
      rootCauseMechanism: 'Transparency gap — employers did not publish pay data, so neither employees, investors, nor the public could identify or challenge persistent pay differences. Individual enforcement through employment tribunals required employees to know they were being paid less, which was structurally impossible without access to comparator data.',
      whyNotSolved: 'Employer resistance to administrative burden was consistently given political weight. Two voluntary frameworks had been tried and failed. The Equality Act 2010 enabled mandatory reporting but the activation regulations were delayed — first by the coalition government, then by Conservative opposition — and were not finally implemented until 2017.',
    },
    guidingPolicy: {
      text: 'Mandatory annual publication of mean and median gender pay gaps, including bonus gaps, by all employers with 250 or more employees on a government portal — creating reputational pressure on employers and an evidence base for enforcement action.',
      coreTheory: 'Sunlight is the best disinfectant. Mandatory public disclosure creates reputational incentives that voluntary reporting cannot. Employers with large gaps face investor, recruitment, and public pressure to act. The aggregate dataset enables benchmarking and tracks progress.',
      tradeOffs: 'Reporting is not the same as closing the gap. Employers can report a large gap and face limited direct consequences if investor and public pressure is insufficient. The 250-employee threshold excludes the majority of workplaces. Aggregate figures can conceal within-grade discrimination.',
      competitiveIdeaAnalysis: 'Iceland introduced legally binding pay equity certification in 2018, going further than UK disclosure requirements. Australia has required gender pay reporting for large employers since 2012. The UK\'s 2017 regulations were among the first in Europe to require median as well as mean figures.',
    },
    coherentActions: [
      {
        title: 'Insert pay transparency regulation power in the Equality Bill',
        detailedDescription: 'Government Equalities Office to insert a power in the Equality Bill (clause 78) enabling ministers to make regulations requiring employers to publish pay information. Fawcett Society to lead the civil society campaign and give evidence to the Bill committee. Power enacted in the Equality Act 2010.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Activate mandatory reporting via statutory instrument (2017)',
        detailedDescription: 'Following sustained civil society pressure and evidence that voluntary reporting had failed, government to lay the Equality Act 2010 (Gender Pay Gap Information) Regulations 2017 requiring all employers of 250+ to publish annually from April 2018.',
        actionType: 'REGULATION',
        orderIndex: 1,
      },
    ],
  },

  // ── 6. Countryside and Rights of Way Act 2000 ─────────────────────────────
  {
    ideaId: '7700e3c9-9088-4fa7-993e-ddb53deb7a29',
    title: 'Countryside and Rights of Way Act 2000',
    diagnosis: {
      text: 'Public access to upland open countryside — mountain, moor, heath, down, and registered common land — was entirely at the discretion of landowners. Millions of people were excluded from landscapes that had historically been used for recreation and subsistence. The 1932 Kinder Scout mass trespass had dramatised the injustice 68 years earlier.',
      whoAffected: 'Walkers, outdoor recreationalists, and urban communities with no nearby green space who were excluded from upland landscapes by landowner exclusion. Rural communities who had traditionally used moor and heath for subsistence.',
      impactDescription: 'Approximately 4 million acres of open country in England and Wales had no public access despite having minimal agricultural use. Urban communities — disproportionately in the north of England — were separated from upland landscapes they could see from their windows but could not legally access.',
      obstacleDefined: 'No statutory right of access existed. Landowners could exclude the public from any land not subject to a public right of way. The National Parks and Access to the Countryside Act 1949 allowed voluntary access agreements but could not compel them.',
      howAffected: 'Walkers on land without a mapped footpath faced prosecution for trespass. The patchwork of public footpaths, negotiated by parishes over centuries, left vast areas of upland inaccessible. Landowners fenced or blocked access points without legal challenge.',
      whyPersisted: 'Landowner interests were strongly represented in both Houses of Parliament. The Country Landowners Association consistently argued that access would damage farming, wildlife, and grouse shooting. Previous Bills had failed. The political space to legislate arose from the large Labour majority after 1997.',
    },
    rootCause: {
      text: 'The right to roam existed in custom and historical practice but had no legal basis. The National Parks and Access to the Countryside Act 1949 could only create access rights through voluntary agreement with landowners — who had no incentive to agree. Without a statutory right, access was gift rather than entitlement.',
      rootCauseMechanism: 'Property rights in land included the right to exclude. Without a statutory qualification to that right, trespass remained actionable. The failure of voluntary access agreements under the 1949 Act demonstrated that financial incentives alone could not achieve systematic access.',
      whyNotSolved: 'The Country Landowners Association lobbied successfully against access legislation for 60 years, citing damage to farming and grouse shooting. Previous access Bills in 1948, 1966, and 1985 had failed. It took a large parliamentary majority, a sympathetic environment secretary (John Prescott), and 60 years of sustained Ramblers campaigning.',
    },
    guidingPolicy: {
      text: 'A statutory right of access over all open country — mountain, moor, heath, down, and registered common land in England and Wales — with a funded mapping exercise by the Countryside Agency and a complaints mechanism for obstruction.',
      coreTheory: 'Statutory access rights create an entitlement that cannot be withheld by landowner preference. Mapping defines the land subject to access, creating legal certainty for both walkers and landowners. The complaints mechanism ensures enforcement without requiring criminalisation.',
      mechanismRules: 'Part I of the Countryside and Rights of Way Act 2000 creates the access right. Section 2: the right to access open country on foot for recreation. Sections 22-29: restrictions and exclusions by landowners in defined circumstances. Section 84: duty on Natural England to map open access land.',
      tradeOffs: 'The access right is foot access only — no cycling, horse-riding, or motorised access. Landowners retain the right to close access for 28 days per year for land management. The initial mapping exercise took five years and was not complete until 2005. Scotland\'s Land Reform Act 2003 went further, extending access to all land including farmland.',
      competitiveIdeaAnalysis: 'Scotland\'s Land Reform (Scotland) Act 2003 created a statutory right of responsible access over virtually all land. The Nordic countries have the "everyman\'s right" (allemansrätten/allemannsretten) as a constitutional principle. The CRoW Act was more limited in scope than either, covering open country only.',
    },
    coherentActions: [
      {
        title: 'Introduce the Countryside and Rights of Way Bill',
        detailedDescription: 'DETR to introduce the Bill creating the access right over open country. Ramblers Association and Open Spaces Society to give evidence to the Environment, Transport and Regional Affairs Select Committee. Countryside Agency to begin the open access mapping process on Royal Assent.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Fund the Countryside Agency mapping programme',
        detailedDescription: 'DETR to fund the Countryside Agency to map all open access land in England and Wales, consulting with landowners and access groups. Mapping to be completed in phased regional rollout by 2005.',
        actionType: 'STRUCTURAL',
        orderIndex: 1,
      },
    ],
  },

  // ── 7. Consumer Rights Act 2015 ───────────────────────────────────────────
  {
    ideaId: '12f20003-6eb0-4edb-a520-e238ae1fb2af',
    title: 'Consumer Rights Act 2015',
    diagnosis: {
      text: 'Consumer protection law was spread across the Sale of Goods Act 1979, the Supply of Goods and Services Act 1982, and the Unfair Terms in Consumer Contracts Regulations 1999 — three separate frameworks with inconsistent standards and no coverage of digital content. Consumers and businesses both struggled to understand their rights, creating legal uncertainty and enabling exploitation.',
      whoAffected: 'All UK consumers purchasing goods, services, or digital content. Small businesses purchasing goods from other businesses. Digital content consumers who had no statutory rights at all under the 1979 framework.',
      impactDescription: 'Which? estimated that consumers were losing approximately £4 billion per year through poor complaints handling, with retailers exploiting consumer confusion about their statutory rights. The absence of digital content rights left millions of app, software, and streaming consumers without recourse.',
      obstacleDefined: 'Three separate statutory frameworks with different standards created confusion and inconsistency. Digital content was entirely outside the Sale of Goods framework. Unfair terms enforcement required the OFT to act — no individual right of redress existed.',
      howAffected: 'Consumers did not know which Act applied to their purchase, what their remedies were, or how to enforce them. Retailers used legal complexity to deny or delay legitimate claims. Digital content consumers had no statutory rights when products failed.',
      whyPersisted: 'Consolidation required writing new law that reconciled three separate regimes — a technically complex exercise that governments had consistently deferred. The BIS-commissioned Whittle Review (2009) confirmed that consolidation was necessary but the political bandwidth was not available until the Cameron coalition government committed to a Consumer Rights Bill in 2012.',
    },
    rootCause: {
      text: 'Consumer law had accreted over 35 years without consolidation or coherent architecture. Each Act addressed specific problems without systematic review. Digital content arrived as a category in the 1990s and 2000s — long after the 1979 framework was in place — and was simply not covered.',
      rootCauseMechanism: 'Path dependency: each successive government added to existing law rather than replacing it, leaving inconsistencies unaddressed. No statutory review mechanism required periodic consolidation. The BIS preferred incremental amendment to comprehensive reform.',
      whyNotSolved: 'Consolidation is technically demanding and politically low-profile — no external pressure drove it. The Law Commission recommended consolidation in 2009; the Whittle Review in 2009 agreed. The coalition government\'s "Red Tape Challenge" created space for reform by framing it as simplification rather than extension of rights.',
    },
    guidingPolicy: {
      text: 'A single Consumer Rights Act replacing the fragmented framework, explicitly covering goods, services, and digital content as three parallel regimes, with clear tiered remedies (reject, repair, replace, price reduction) and Trading Standards enforcement.',
      coreTheory: 'A unified framework reduces consumer confusion, enables enforcement, and extends rights to digital content on an equivalent basis to physical goods. Clear tiered remedies prevent retailers from substituting repair for refund to deny consumers their preferred outcome.',
      mechanismRules: '30-day short-term right to reject. Right to one repair or replacement before escalating to price reduction or final right to reject. Digital content: right to repair or replace within reasonable time, price reduction where that fails. CMA power to seek injunctions against unfair terms.',
      tradeOffs: 'The 30-day right to reject is shorter than consumer advocates wanted (Which? sought 45 days). Small businesses do not benefit from the Act\'s goods protections in business-to-business transactions. Digital content rights are weaker than physical goods rights in some respects.',
      competitiveIdeaAnalysis: 'The EU Consumer Rights Directive 2011 provided minimum standards and prompted the UK review. Australia\'s Consumer Guarantees under the Australian Consumer Law (2011) provided a comparable unified model. The UK Act went further than the EU minimum by introducing the 30-day short-term right to reject.',
    },
    coherentActions: [
      {
        title: 'Introduce the Consumer Rights Bill',
        detailedDescription: 'BIS to introduce the Bill consolidating the Sale of Goods Act 1979, Supply of Goods and Services Act 1982, and Unfair Terms Regulations 1999 into a single Act covering goods, services, and digital content. Which? to provide evidence. Royal Assent October 2015.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 8. Age of Criminal Responsibility (Scotland) Act 2021 ─────────────────
  {
    ideaId: '97dbdc0f-0eca-4cc4-b1f7-f7162dfa7d27',
    title: 'Age of Criminal Responsibility (Scotland) Act 2021',
    diagnosis: {
      text: 'Scotland had the lowest age of criminal responsibility in Europe at 8 years old — directly contrary to the UN Committee on the Rights of the Child recommendation of a minimum age of 12, and at odds with child development evidence showing that children under 12 lack the moral culpability required for criminal liability.',
      whoAffected: 'Children aged 8–11 in Scotland who could be held criminally responsible for their actions and, in the most serious cases, prosecuted in adult courts. Disproportionately affecting children from deprived backgrounds, those with neurodevelopmental conditions, and children in care.',
      impactDescription: 'In practice, most children under 16 in Scotland were referred to the Children\'s Hearings System rather than prosecuted. However, the legal age of 8 meant that children as young as 8 had a criminal record, which could follow them for life. Scotland was an international outlier and subject to consistent criticism from the UN Committee on the Rights of the Child.',
      obstacleDefined: 'The age of 8 was embedded in common law (doli incapax doctrine) and not subject to regular review. The Children (Scotland) Act 1995 had created the Hearings System but left the age of responsibility unchanged.',
      howAffected: 'Children who came into contact with police before age 12 — even where no prosecution followed — could have information retained on their records. A small number faced formal criminal proceedings. The symbolic and developmental harm of treating 8-year-olds as criminally responsible was significant.',
      whyPersisted: 'Scotland\'s Children\'s Hearings System was rightly seen as internationally progressive — this created a political blind spot about the underlying age of responsibility. The Howard League Scotland campaigned persistently for a decade before the Audit Scotland report (2010) and subsequent Criminal Justice Committee inquiry created political momentum.',
    },
    rootCause: {
      text: 'The age of 8 was a historical accident of common law that had never been examined in the context of modern child development evidence or international human rights standards. The Children\'s Hearings System addressed the practical consequences but left the legal threshold unchanged.',
      rootCauseMechanism: 'The legal definition of criminal responsibility had been frozen by the common law and not subject to legislative review. The Hearings System addressed outcomes without addressing the underlying legal threshold. No formal mechanism existed for periodic review of the age in light of developing evidence and international standards.',
      whyNotSolved: 'The Hearings System\'s success created complacency — policymakers could point to a progressive welfare-based response and argue the criminal responsibility threshold was irrelevant in practice. It took sustained UN criticism, academic evidence, and the Howard League Scotland\'s decade-long campaign to bring the issue to legislative priority.',
    },
    guidingPolicy: {
      text: 'Raise the minimum age of criminal responsibility in Scotland from 8 to 12, meeting the UN Committee on the Rights of the Child minimum recommendation, and route all children under 12 who engage in harmful behaviour through the Children\'s Hearings System for welfare-based responses.',
      coreTheory: 'Children under 12 lack the moral culpability required for criminal liability. A welfare-based Hearings response is more effective at preventing reoffending than criminal justice contact. Raising the age removes a source of lifelong stigma and aligns Scotland with international human rights standards.',
      mechanismRules: 'Age of criminal responsibility raised from 8 to 12. Children under 12 who engage in acts that would otherwise be criminal referred to the Reporter to the Children\'s Panel for welfare assessment. Police retain powers to investigate to protect public safety.',
      tradeOffs: 'The age of 12 is still below the Council of Europe recommendation of 14 and the minimum recommended by some child rights organisations. Raising the age requires additional investment in the Children\'s Hearings System to handle increased referrals. The Scottish Law Commission had recommended 12 as a pragmatic minimum.',
      competitiveIdeaAnalysis: 'Most European countries set the age between 14 and 16. England and Wales retain age 10. Ireland raised the age to 12 in 2006. The UN Committee on the Rights of the Child recommended 14 as a minimum in 2019, making even Scotland\'s reformed position below the international recommendation.',
    },
    coherentActions: [
      {
        title: 'Introduce the Age of Criminal Responsibility (Scotland) Bill',
        detailedDescription: 'Scottish Government to introduce the Bill through the Scottish Parliament. Justice Committee to conduct pre-legislative scrutiny. Howard League Scotland and children\'s rights organisations to give evidence. Royal Assent March 2019 with commencement in 2021 to allow time for Children\'s Hearings system preparation.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 9. Homes (Fitness for Human Habitation) Act 2018 ─────────────────────
  {
    ideaId: 'd42bbf40-d645-44ef-b711-2646af08050a',
    title: 'Homes (Fitness for Human Habitation) Act 2018',
    diagnosis: {
      text: 'Landlords had no general legal obligation to maintain rented homes fit for human habitation throughout the tenancy. The Landlord and Tenant Act 1985 required fitness at the start but not during the tenancy. The fitness standard applied only to properties below rent thresholds that had not been updated since 1957 and therefore excluded virtually all modern tenancies. Hundreds of thousands of renters lived in damp, mouldy, cold, or structurally unsafe homes with no legal remedy.',
      whoAffected: 'Private renters and housing association tenants living in properties that had become unfit during the tenancy through disrepair — estimated at 1.8 million homes in England with category 1 hazards under the HHSRS.',
      impactDescription: 'The English Housing Survey (2016) identified over a million privately rented homes with serious disrepair. Cold, damp homes were associated with respiratory illness, particularly in children. NHS costs attributable to cold homes were estimated at £850 million per year. Shelter documented thousands of cases where tenants had been unable to enforce fitness standards.',
      obstacleDefined: 'The Landlord and Tenant Act 1985 section 8 fitness obligation was inapplicable to modern tenancies due to rent thresholds set in 1957. Councils had enforcement powers under the Housing Health and Safety Rating System but were poorly resourced. Tenants had no direct right of action.',
      howAffected: 'Tenants in unfit homes could not enforce against landlords. Councils could issue improvement notices but compliance rates were low and enforcement resources inadequate. Tenants who complained faced retaliatory eviction — a legitimate fear that the Deregulation Act 2015 had only partially addressed.',
      whyPersisted: 'Four previous attempts by Karen Buck MP had been blocked. Landlord lobby groups argued fitness standards would deter investment. Government had declined to update the section 8 thresholds. The key political shift was the Grenfell Tower fire (June 2017), which changed the political climate around housing safety significantly.',
    },
    rootCause: {
      text: 'Section 8 of the Landlord and Tenant Act 1985 set a fitness standard but applied only at the start of the tenancy and only to properties below rent thresholds frozen at 1957 levels — thresholds so low they excluded all modern market-rent tenancies. Tenants had no direct right to enforce fitness; enforcement relied on councils with inadequate resources.',
      rootCauseMechanism: 'Three-part failure: (1) the legal fitness standard was technically inapplicable to modern tenancies; (2) no tenants\' right of action existed — only council enforcement; (3) councils had enforcement powers but were under-resourced and risk-averse about using them against large landlords.',
      whyNotSolved: 'Landlord lobby consistently argued the implied covenant would deter investment. Government had not updated section 8 thresholds. Karen Buck\'s four previous Bills had been talked out or failed. The political context changed post-Grenfell, and a fifth attempt succeeded with government support.',
    },
    guidingPolicy: {
      text: 'Amend the Landlord and Tenant Act 1985 to impose an implied covenant that properties must be fit for human habitation at the start and throughout the tenancy, enforceable directly by tenants in the civil courts, with no rent threshold limitation.',
      coreTheory: 'Giving tenants a direct right of action in the courts creates an enforcement mechanism that does not depend on council resources. Removing the rent threshold makes the obligation universal. The implied covenant cannot be contracted out of, preventing landlords from excluding it in tenancy agreements.',
      mechanismRules: 'Implied covenant in section 9A of the amended Act: landlord must ensure the dwelling is fit for human habitation at the time the tenancy begins and remains fit throughout. Fitness assessed using the Housing Health and Safety Rating System. Tenants can apply to county court for damages and specific performance.',
      tradeOffs: 'Enforcement still requires tenants to bring civil proceedings — a significant barrier for lower-income tenants, those with insecure immigration status, or those who fear retaliatory eviction. Legal aid for housing is severely limited. The Act does not extend to licensed Houses in Multiple Occupation.',
      competitiveIdeaAnalysis: 'Scotland\'s Housing (Scotland) Act 2006 introduced the Repairing Standard, requiring landlords to keep properties wind- and watertight and in reasonable repair throughout the tenancy. Wales extended similar duties through the Renting Homes (Wales) Act 2016. England lagged both devolved nations.',
    },
    coherentActions: [
      {
        title: 'Karen Buck MP to introduce the Homes (Fitness for Human Habitation) Bill',
        detailedDescription: 'Karen Buck to introduce the Bill as a Private Member\'s Bill amending section 8 of the Landlord and Tenant Act 1985. Shelter to provide evidence to the Housing, Communities and Local Government Committee. Government to confirm non-opposition after the fifth attempt. Royal Assent December 2018.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 10. Domestic Abuse Act 2021 ────────────────────────────────────────────
  {
    ideaId: '3c8441c5-8e53-4c3f-a978-409cdc415a55',
    title: 'Domestic Abuse Act 2021',
    diagnosis: {
      text: 'England and Wales had no statutory definition of domestic abuse. Coercive and controlling behaviour — the dominant pattern experienced by most victims — was not recognised in the criminal law. Perpetrators could cross-examine their victims personally in family proceedings. No independent body coordinated the government response across police, courts, health, and housing.',
      whoAffected: 'Primarily women: two women per week were killed by current or former partners. Approximately 2.4 million adults (1.6 million women, 786,000 men) experienced domestic abuse annually. Children witnessing abuse were not recognised as victims in their own right.',
      impactDescription: 'Domestic abuse cost England and Wales an estimated £66 billion per year (Home Office, 2019) including physical and emotional harm, lost economic output, and public services. Refuge capacity was chronically insufficient. Perpetrators used cross-examination in family courts as a tool of continued abuse.',
      obstacleDefined: 'The criminal law addressed individual violent incidents but not patterns of coercive control. The family court had no mechanism to prevent perpetrators from cross-examining victims. No Commissioner role existed to drive the systemic response.',
      howAffected: 'Victims who experienced psychological, financial, and emotional abuse rather than physical violence had limited access to criminal justice remedies. Family court victims were cross-examined by the people who had abused them. Support services were inconsistently funded and geographically uneven.',
      whyPersisted: 'The Home Office had resisted statutory definition because of definitional complexity. The family court cross-examination issue required primary legislation but had fallen victim to parliamentary time. The Women\'s Aid decade-long "No More" campaign and the Istanbul Convention ratification commitment created the political space.',
    },
    rootCause: {
      text: 'The criminal law framework was incident-based, not pattern-based. It captured individual assaults but not the cumulative pattern of coercive control that characterises most sustained domestic abuse. The family court had not adapted to domestic abuse dynamics, and the adversarial model inadvertently enabled re-traumatisation.',
      rootCauseMechanism: 'Two separate failure mechanisms: (1) the criminal law created no offence of coercive control as a course of conduct — only individual incidents were actionable; (2) the family court rules were designed for civil disputes between parties of equal standing, not for cases where one party had systematically subordinated the other.',
      whyNotSolved: 'The Home Office had resisted statutory definition, citing definitional complexity and the risk of unintended consequences. The Serious Crime Act 2015 created a coercive control offence in England and Wales — but the Act\'s passage took five years of sustained advocacy by Women\'s Aid and the academics who had documented the pattern (most notably Evan Stark\'s Coercive Control, 2007).',
    },
    guidingPolicy: {
      text: 'A comprehensive statutory framework: a statutory definition of domestic abuse including coercive and controlling behaviour; an independent Domestic Abuse Commissioner; children recognised as victims in their own right; prohibition of personal cross-examination of victims by perpetrators.',
      coreTheory: 'A statutory definition changes how institutions — police, courts, housing authorities, health services — assess and respond to abuse. Independent oversight drives systemic change. Prohibition of personal cross-examination removes a specific tool of continued abuse within the justice system.',
      mechanismRules: 'Section 1: statutory definition including physical, sexual, violent, threatening, controlling, coercive, psychological, economic, and emotional abuse. Section 29: prohibition of cross-examination by perpetrators in family proceedings. Parts 2-3: Commissioner and Domestic Abuse Protection Orders.',
      tradeOffs: 'The statutory definition is broad but the criminal offences it creates have been inconsistently enforced. The Commissioner role has limited statutory powers to compel action from government departments. Refuge funding remains chronically insufficient despite statutory guidance.',
      competitiveIdeaAnalysis: 'Scotland created a standalone coercive control offence in the Domestic Abuse (Scotland) Act 2018, three years before the England and Wales equivalent. The Istanbul Convention (CETS 210, ratified by UK 2022) provided the international human rights framework. The Domestic Violence, Crime and Victims Act 2004 was the previous high-water mark of domestic abuse legislation in England and Wales.',
    },
    coherentActions: [
      {
        title: 'Introduce the Domestic Abuse Bill',
        detailedDescription: 'Home Office to introduce the Bill in the Commons. Pre-legislative scrutiny by the Joint Committee on the Draft Domestic Abuse Bill (2018-19). Women\'s Aid, Refuge, and SafeLives to give evidence. Bill to receive Royal Assent April 2021. Home Office to publish the first Domestic Abuse statutory guidance within 6 months of commencement.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Appoint the Domestic Abuse Commissioner',
        detailedDescription: 'Home Office to appoint the Commissioner on statutory footing with power to publish reports, make recommendations to government, and monitor the national response to domestic abuse. Commissioner to publish the first annual report within 12 months of appointment.',
        actionType: 'STRUCTURAL',
        orderIndex: 1,
      },
    ],
  },

  // ── 11. Tobacco and Vapes Act 2025 ────────────────────────────────────────
  {
    ideaId: '0ef5826f-de29-449d-afb7-c3ae236d7856',
    title: 'Tobacco and Vapes Act 2025',
    diagnosis: {
      text: 'Conventional tobacco control had plateaued. Taxation, plain packaging, advertising bans, and age of sale restrictions had significantly reduced smoking prevalence but could not end recruitment. Each new generation continued to be recruited at the age when dependence begins (14–17). E-cigarettes had simultaneously created a new vector of nicotine dependence, particularly among young people who had never smoked.',
      whoAffected: 'Young people born on or after 1 January 2009 who were the first generation subject to the generational ban. Existing smokers (primarily those over 18) were not affected. Vaping consumers including adults who used vaping to quit smoking.',
      impactDescription: 'Smoking costs the NHS £2.5 billion per year in direct treatment costs and the wider economy £19 billion per year. The Jha modelling (2020) suggested a generational ban could prevent approximately 115,000 deaths over the course of this century. UK prevalence had fallen from 45% (1970s) to 13% (2022) but had stalled without further radical intervention.',
      obstacleDefined: 'The opt-in model of tobacco control — restricting marketing, raising prices, requiring health warnings — could not prevent each new cohort from being recruited. Only a generational intervention could end recruitment systematically.',
      howAffected: 'Young people continued to be recruited to tobacco and nicotine dependence at school age, with the majority of adult smokers reporting they started before the age of 18. The tobacco industry argued for consumer choice; public health advocates argued that choice was being exercised at an age when the consequences were not yet apparent.',
      whyPersisted: 'The tobacco industry consistently funded opposition through consumer choice arguments and economic impact claims. New Zealand had first proposed the approach in 2021 (subsequently repealed by a change of government). New Zealand\'s repeal temporarily undermined confidence in the approach before the UK\'s Jha review (2023) recommended it.',
    },
    rootCause: {
      text: 'The opt-in model of tobacco control required each generation to resist recruitment individually. No policy instrument could prevent the tobacco industry from recruiting consumers at the age when dependence begins. The absence of generational restrictions meant the recruitment cycle repeated with every cohort.',
      rootCauseMechanism: 'Demand-side intervention (price, warnings, restrictions) could not match the supply-side investment the tobacco industry made in youth recruitment. The mechanism sustaining smoking was the industry\'s ability to reach young people before they had the information and autonomy to make an informed long-term choice about addiction.',
      whyNotSolved: 'New Zealand\'s repeal of its generational ban after a change of government (2023) created political risk. The tobacco industry characterised the approach as prohibition. The UK required a review (Jha, 2023), a consultation, and a coalition of health organisations to sustain momentum. The policy was finally enacted with Labour majority following the 2024 election.',
    },
    guidingPolicy: {
      text: 'A birth-date threshold preventing tobacco sales to anyone born on or after 1 January 2009, creating a smokefree generation without criminalising existing smokers — combined with equivalent restrictions on vaping to prevent displacement to a different nicotine product.',
      coreTheory: 'A date-based ban is simple, enforceable, and does not require progressive annual increases in the age of sale. It is not prohibition — existing smokers can continue to smoke. By targeting the recruitment mechanism rather than current consumption, it ends addiction at the population level within a generation.',
      mechanismRules: 'Section 1: prohibition on sale of tobacco products to persons born on or after 1 January 2009. Section 2: equivalent prohibition on nicotine vaping products. Retailer obligation to verify age. Fixed penalty notices for retailers selling to under-age customers. Age verification requirements for online sales.',
      tradeOffs: 'Enforcement against illicit trade is a significant risk — if legal products are unavailable, a black market may develop. The vaping restrictions are criticised by harm reduction advocates who argue vaping is a significantly less harmful alternative to smoking and should remain accessible to young people who would otherwise smoke. New Zealand\'s repeal demonstrates political fragility.',
      competitiveIdeaAnalysis: 'New Zealand introduced and then repealed the policy (2021-2023). Australia\'s approach emphasised vaping regulation rather than a generational ban. The UK Act was the first to survive to commencement. The Framework Convention on Tobacco Control (WHO, 2005) had created the international foundation for tobacco control but not the generational mechanism.',
    },
    coherentActions: [
      {
        title: 'Introduce the Tobacco and Vapes Bill',
        detailedDescription: 'DHSC to introduce the Bill with three substantive parts: Part 1 (generational tobacco ban), Part 2 (vaping regulation), Part 3 (illicit trade enforcement powers). ASH, BMA, Royal College of Physicians to give evidence. Bill to pass using Government majority. Royal Assent May 2025.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Establish age verification requirements for retailers',
        detailedDescription: 'DHSC to publish statutory guidance requiring retailers to implement "Challenge 25" age verification for all tobacco and vaping products. Online retailers to implement age verification technology approved by the Gambling Commission framework. HMRC to fund trading standards enforcement.',
        actionType: 'REGULATION',
        orderIndex: 1,
      },
    ],
  },

  // ── 12. Academies Act 2010 ────────────────────────────────────────────────
  {
    ideaId: 'f7a74bbb-bdb7-48bd-914c-0abf51ae9f4f',
    title: 'Academies Act 2010',
    diagnosis: {
      text: 'Local authority control of schools created bureaucratic inefficiency, constrained headteacher autonomy, and insulated underperforming schools from accountability. The 1944 Education Act\'s tripartite system gave local authorities significant power over curriculum, staffing, and budget. Head teachers in maintained schools could not act quickly on staffing decisions or specialise their curriculum.',
      whoAffected: 'Pupils in underperforming local authority schools, particularly in urban areas. Head teachers without autonomy over staffing and curriculum. Teachers subject to LA pay scales and terms.',
      impactDescription: 'The OECD\'s 2006 PISA results ranked England 14th in reading and 24th in mathematics — below comparable countries with more autonomous school systems. Policy Exchange\'s 2007 analysis of the original City Academy programme showed significant improvement in outcomes in schools that had converted.',
      obstacleDefined: 'The 1944 Act\'s framework gave local authorities the role of school organiser. Academies existed under New Labour but only for failing schools. The programme was deliberately small-scale and targeted — Policy Exchange\'s 2007 report argued for universal access to academy status.',
      howAffected: 'High-performing head teachers in local authority schools had limited ability to innovate on curriculum, staffing, or finance. Outstanding schools could not use their status to benefit pupils more directly by becoming academies under the pre-2010 framework.',
      whyPersisted: 'Teacher unions and local authorities had successfully resisted expansion of the academy programme under New Labour by arguing it was an emergency measure for failing schools only. Policy Exchange\'s analytical case that autonomy drove improvement was contested by unions citing selective admissions.',
    },
    rootCause: {
      text: 'The 1944 Education Act had created a school system organised around local authorities as the primary delivery mechanism. This had not been fundamentally reformed for 65 years. The New Labour City Academy programme proved the concept — schools given autonomy improved significantly — but did not extend access to all schools.',
      rootCauseMechanism: 'Local authority control created a bureaucratic layer between central government and schools that slowed decision-making and constrained innovation. The maintenance of LA-level pay bargaining, curriculum oversight, and admissions administration meant that individual school performance was inseparable from LA system performance.',
      whyNotSolved: 'The teacher unions and NUT were powerful political opponents of academic autonomy. New Labour had triangulated between union opposition and the evidence for autonomy by limiting academies to the most failing schools. The Conservative 2010 manifesto committed to universal access.',
    },
    guidingPolicy: {
      text: 'Allow all maintained schools in England — not just failing schools — to convert to academy status with direct funding from central government, full freedom over curriculum, staffing and admissions, and accountability through Ofsted inspections and published results.',
      coreTheory: 'Autonomy drives improvement: schools freed from bureaucratic constraint can make faster staffing decisions, specialise their curriculum, and be more directly accountable for their results. Outstanding schools should be first movers, creating a strong supply of successful models for others to follow.',
      mechanismRules: 'Any maintained school (primary, secondary, or special) can apply for academy status under the Academies Act 2010. Outstanding schools fast-tracked. Funding agreement directly between academy trust and Secretary of State. Ofsted accountability maintained.',
      tradeOffs: 'Academies\' freedom from national pay agreements has driven concerns about teacher retention and pay disparity. The rapid expansion meant insufficient oversight of multi-academy trust governance. Evidence on overall system-level attainment improvement from academisation remains contested — individual school improvement does not necessarily aggregate to system improvement.',
      competitiveIdeaAnalysis: 'Sweden\'s free school system (friskolor) was the international comparator cited by Policy Exchange. US charter schools provided an American model. Critics pointed to Sweden\'s subsequent PISA decline as evidence that autonomy without accountability oversight was insufficient.',
    },
    coherentActions: [
      {
        title: 'Introduce the Academies Bill',
        detailedDescription: 'DfE to introduce the Academies Bill enabling any maintained school to apply for academy status. Fast-track process for outstanding schools. Regional Schools Commissioners to be established to manage performance oversight of academy trusts. Royal Assent July 2010.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 13. Protection of Freedoms Act 2012 ───────────────────────────────────
  {
    ideaId: '32426a88-f77f-4cb2-857f-e398d745842a',
    title: 'Protection of Freedoms Act 2012',
    diagnosis: {
      text: 'The UK had the largest DNA database per capita of any democracy. Six million profiles were held, including those of approximately one million innocent people who had never been convicted of any offence. Following Marper v United Kingdom (2008), the European Court of Human Rights found indefinite retention of profiles from unconvicted individuals violated Article 8 (right to private life). The government was legally obliged to act.',
      whoAffected: 'Approximately one million individuals whose DNA profiles were held on the National DNA Database despite having been acquitted, not charged, or having their charges dropped. Disproportionately affecting young black men: 37% of black men aged 18–35 were on the database.',
      impactDescription: 'The disproportionate retention of DNA profiles from innocent people represented a permanent stigma and created a significant racial justice concern. The Marper judgment created a legal obligation. The misuse of CCTV — an estimated 4.2 million cameras — also raised privacy concerns that the Act addressed.',
      obstacleDefined: 'The Criminal Justice Act 2003 had removed restrictions on indefinite retention. Police resistance to deletion was entrenched; chief constables argued retention had investigative value. No independent oversight mechanism existed to review individual retention decisions.',
      howAffected: 'Innocent people could not have their profiles removed without legislative intervention. The absence of a mechanism for deletion meant acquittal was not the end of law enforcement\'s relationship with an individual\'s genetic material.',
      whyPersisted: 'Police argued retention served public safety and pointed to cases where cold crime matches had been made against database profiles. The Home Office had consistently deferred to police operational claims. The Marper judgment made the current position legally untenable.',
    },
    rootCause: {
      text: 'The Criminal Justice Act 2003 had created indefinite retention powers without a mechanism for review or deletion. Police resistance to deletion was entrenched. No independent body had the power to compel deletion against police preference.',
      rootCauseMechanism: 'Statutory permission for indefinite retention combined with police institutional resistance to deletion and absence of independent oversight created an irreversible one-way ratchet: profiles were added but never removed.',
      whyNotSolved: 'The police consistently lobbied against deletion, citing investigative value. Three previous government reviews had accepted police arguments against reform. The Marper judgment in 2008 removed the government\'s ability to defer further.',
    },
    guidingPolicy: {
      text: 'Require deletion of DNA profiles, fingerprints, and cellular samples of unconvicted individuals within defined periods, with limited exceptions requiring chief constable authorisation for suspects of serious offences — and regulate CCTV use by public authorities.',
      coreTheory: 'Acquittal should restore the status quo ante in terms of state retention of identifying material. Limited and authorised exceptions for serious crime suspects provide a proportionate balance between privacy and public safety that the ECHR requires.',
      mechanismRules: 'Profiles of unconvicted individuals deleted within 3 years (6 years for serious offence suspects). Chief constable application for retention renewal in exceptional cases. National DNA Database Strategy Board to oversee compliance. CCTV Surveillance Camera Commissioner established.',
      tradeOffs: 'The retention periods for serious offence suspects (6 years with renewal) are longer than civil liberties organisations argued was proportionate. The CCTV provisions are regulatory rather than prohibitive. Scotland received different (more protective) provisions than England and Wales.',
      competitiveIdeaAnalysis: 'Germany limits DNA retention to convicted individuals. The Scottish DNA provisions (CriminalProcedure (Legal Assistance, Detention and Appeals) (Scotland) Act 2010) were more protective than the England/Wales regime. Big Brother Watch\'s evidence on the racial disparity in the database was central to the political argument.',
    },
    coherentActions: [
      {
        title: 'Include DNA database reforms in the Protection of Freedoms Bill',
        detailedDescription: 'Home Office to introduce the Protection of Freedoms Bill including DNA retention limits, fingerprint deletion, CCTV regulation, and biometric review. Big Brother Watch and Liberty to give evidence to the Public Bill Committee. Royal Assent May 2012.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 14. Higher Education (Freedom of Speech) Act 2023 ────────────────────
  {
    ideaId: '6c634e74-e845-4c3c-945e-415118a7c7d8',
    title: 'Higher Education (Freedom of Speech) Act 2023',
    diagnosis: {
      text: 'Universities and student unions were systematically de-platforming speakers, using non-disclosure agreements to silence harassment complainants, and dismissing academics for their expressed views. The 1986 free speech duty on universities was unenforceable because no regulator had investigatory or sanctioning powers.',
      whoAffected: 'Academics dismissed or disciplined for their views; visiting speakers denied platforms; students and academics who signed NDAs; staff in precarious contracts who self-censored. Disproportionately affecting those holding heterodox views on contested social issues.',
      impactDescription: 'The Free Speech Union documented hundreds of cases of cancellation, dismissal, and NDA use between 2018 and 2022. A Kings College London survey (2020) found 36% of students self-censored their views for fear of social consequences. Academic dismissal cases included prominent cases in gender-critical research, COVID policy, and history.',
      obstacleDefined: 'The Education (No. 2) Act 1986 imposed a duty on universities to ensure free speech but gave no enforcement body investigatory powers. Institutional compliance was therefore voluntary in practice. Student unions were entirely outside the 1986 regime.',
      howAffected: 'Academics faced dismissal, exclusion from grant funding, and social ostracism for their views on contested issues. Visiting speakers were withdrawn at late notice. Students who complained about harassment were silenced by NDAs. The chilling effect on academic inquiry was documented in multiple research surveys.',
      whyPersisted: 'University management had strong institutional incentives to avoid controversy. Student activism created direct social media pressure that made de-platforming reputationally safe. The absence of enforcement powers under the 1986 regime meant no external check on institutional decisions.',
    },
    rootCause: {
      text: 'The 1986 free speech duty was unenforceable. No regulator had the power to investigate or fine universities for free speech breaches. Student unions were entirely outside the legal framework. The culture of risk aversion in university management created an institutional bias toward suppression over tolerance.',
      rootCauseMechanism: 'A duty without enforcement is symbolic. Universities could breach the 1986 duty without legal consequence. The Office for Students had general oversight powers but no specific free speech investigation or sanctioning function. Institutional incentives — avoiding controversy, protecting research funding, managing student discontent — all cut against tolerance of heterodox views.',
      whyNotSolved: 'The issue was politically contested: critics of the legislation argued it would compel universities to platform hate speech or enable discrimination under the guise of academic freedom. The equalities framework created genuine tension with free speech protections that complicated legislative design. Three years of consultation and pre-legislative scrutiny preceded the Act.',
    },
    guidingPolicy: {
      text: 'Strengthen the free speech duty with regulatory enforcement teeth: give the Office for Students power to investigate and fine, create a free speech complaints scheme for speakers and academics who suffer loss, extend the duty to student unions, and ban NDAs in free speech complaints.',
      coreTheory: 'Enforceable duties change institutional behaviour. A complaints scheme with financial remedies creates a direct incentive for universities to tolerate unpopular speech. Extending the duty to student unions closes the loophole through which most de-platforming occurred.',
      mechanismRules: 'New sections A1-A5 in the Higher Education and Research Act 2017. OfS power to impose monetary penalties up to £500,000. Free speech complaints scheme with power to award compensation. Student unions subject to equivalent duties. NDAs in free speech complaints void.',
      tradeOffs: 'The Act creates genuine tension with the Public Sector Equality Duty — a university that platforms a speaker some staff find discriminatory may face competing legal obligations. The OfS\'s initial implementation was paused pending judicial review by student unions. The Act remains politically contested and its long-term effectiveness is uncertain.',
      competitiveIdeaAnalysis: 'The USA\'s First Amendment provides stronger constitutional free speech protection but does not apply to private universities. Australia\'s French Review (2019) recommended a model code without legislation — the UK rejected this approach. The Free Speech Union\'s model drew on American campus free speech statutes.',
    },
    coherentActions: [
      {
        title: 'Introduce the Higher Education (Freedom of Speech) Bill',
        detailedDescription: 'DfE to introduce the Bill amending the Higher Education and Research Act 2017. Free Speech Union, Universities UK, and NUS to give evidence to the Education Select Committee. Pre-legislative scrutiny to identify the tension between free speech and equalities duties. Royal Assent May 2023.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 15. Tobacco Advertising and Promotion Act 2002 ────────────────────────
  {
    ideaId: '945fd544-5538-425f-9808-450edbcd2ef3',
    title: 'Tobacco Advertising and Promotion Act 2002',
    diagnosis: {
      text: 'Tobacco advertising recruited new smokers — particularly young people — by normalising and glamourising smoking through print advertising, billboards, direct mail, and sponsorship of sport and cultural events. The industry spent over £100 million per year on UK advertising. Evidence from countries that had banned advertising showed significant falls in smoking uptake.',
      whoAffected: 'Young people aged 11–18 exposed to tobacco advertising and sponsorship at the age when most lifetime smoking begins. All existing smokers whose habit was reinforced by advertising.',
      impactDescription: 'Smoking caused 120,000 deaths per year in the UK. The International Agency for Research on Cancer had concluded that tobacco advertising was a causal factor in smoking initiation. Countries including Norway, Finland, and New Zealand had enacted comprehensive advertising bans and seen measurable reductions in youth smoking.',
      obstacleDefined: 'The tobacco industry had resisted advertising restrictions for 30 years through legal challenge, parliamentary lobbying, and argument that advertising only shifted market share rather than growing total demand.',
      howAffected: 'Young people were exposed to tobacco advertising through Formula One sponsorship, magazine advertising, point-of-sale display, and direct mail. The industry\'s own internal documents (disclosed in US litigation) showed deliberate youth recruitment targeting.',
      whyPersisted: 'The industry had successfully lobbied against bans since the first WHO recommendation in 1974. The Major government had resisted a European Directive on advertising. New Labour\'s 1997 manifesto commitment was delayed by Formula One sponsorship controversy (the Bernie Ecclestone affair) before being legislated in 2002.',
    },
    rootCause: {
      text: 'The tobacco industry invested massively in advertising to recruit each new generation of smokers as older smokers died or quit. Partial voluntary restrictions had always failed because the industry found new channels. No single restriction could achieve the impact of a comprehensive ban.',
      rootCauseMechanism: 'The recruitment cycle: smokers tend to die younger or quit, requiring constant replenishment from new recruits. Advertising was the primary recruitment mechanism. Partial bans (restricting some media but not others) simply displaced advertising expenditure to unrestricted channels.',
      whyNotSolved: 'The industry had sustained 30 years of legal challenge, parliamentary lobbying, and economic argument. The Formula One controversy in 1997 delayed action for five years. The European Directive provided cover — the UK could implement as EU compliance rather than unilateral action.',
    },
    guidingPolicy: {
      text: 'A comprehensive ban on all forms of tobacco advertising and promotion — print, billboards, direct mail, online, and sponsorship of events — with criminal penalties and no exemptions for brand-sharing or indirect advertising.',
      coreTheory: 'Comprehensive bans without exemptions are significantly more effective than partial bans. Each exemption provides an advertising channel that the industry exploits. The evidence from complete bans shows measurable reductions in consumption; partial bans do not.',
      mechanismRules: 'Section 2: prohibition on tobacco advertising. Section 6: prohibition on tobacco promotion. Section 9: prohibition on tobacco sponsorship. Offences for publishing, distributing, or sponsoring. Unlimited fine and up to 2 years imprisonment. EU Directive 2003/33/EC provided the European framework.',
      tradeOffs: 'Point-of-sale display was not initially included — this required further legislation (Health Act 2009). The exemption for small retailers allowed display to continue for several years. Formula One sponsorship was exempt under EU rules until 2005.',
      competitiveIdeaAnalysis: 'Norway had banned tobacco advertising since 1975; Finland since 1978. New Zealand banned it in 1990. The WHO Framework Convention on Tobacco Control (2005) subsequently required signatories to implement comprehensive advertising bans. The UK Act preceded the FCTC by three years.',
    },
    coherentActions: [
      {
        title: 'Introduce the Tobacco Advertising and Promotion Bill',
        detailedDescription: 'Department of Health to introduce the Bill banning tobacco advertising across all media and sponsorship. ASH and BMA to give evidence to the Health Select Committee. Industry legal challenge anticipated and prepared for. Royal Assent November 2002.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 16. Land Reform (Scotland) Act 2003 ───────────────────────────────────
  {
    ideaId: '323a51b6-ed30-4eeb-89b1-9f0ced07ccee',
    title: 'Land Reform (Scotland) Act 2003',
    diagnosis: {
      text: 'Scotland had one of the most concentrated land ownership patterns in Europe. Approximately 432 private landowners controlled half of all private land. Communities had no legal right to access land to which they had historical connection, and no right to purchase land before private sale. Feudal tenure, abolished in 2000, had concentrated ownership over centuries without creating mechanisms for community land ownership.',
      whoAffected: 'Rural and island communities historically excluded from land they had farmed, grazed, and lived on. Crofting communities with a statutory relationship to their land but no right to buy. Walkers and recreationalists excluded from private land.',
      impactDescription: 'Communities in the Scottish Highlands and Islands had experienced depopulation over two centuries partly attributable to landowner decisions about management. The Assynt Crofters\' Trust buyout (1993) and Isle of Gigha Community Buyout (2002) demonstrated that community ownership dramatically improved community wellbeing and halted depopulation.',
      obstacleDefined: 'Property rights in land gave landowners the right to exclude access and to sell to any buyer. No right of pre-emption existed for communities. Access rights were discretionary. Community buyouts under the Land Fund relied on landowner willingness to sell.',
      howAffected: 'Communities could not access land to which they had historical connection. They had no rights when an estate came onto the market. The pattern of absentee ownership, land mismanagement, and deliberate depopulation had continued into the 21st century.',
      whyPersisted: 'Property rights in land were constitutionally protected. Scotland\'s feudal system had been abolished in 2000 but the ownership pattern it created had not been addressed. The Scottish Parliament, created in 1999, provided the first political opportunity to act on land reform since Highland clearances-era agitation.',
    },
    rootCause: {
      text: 'Scottish land law was based on feudal tenure which had concentrated ownership over centuries. The abolition of feudal tenure (2000) removed the legal framework but not the ownership pattern it had created. Community land ownership had no legal mechanism of support; commercial sales always took precedence over community interest.',
      rootCauseMechanism: 'Property law gave the market priority over community interest in all land transactions. Communities could not exercise pre-emption rights that did not exist. Access rights were discretionary rather than statutory. Without statutory intervention, market forces would continue to concentrate land.',
      whyNotSolved: 'Land reform was politically contested at Westminster, where landowning interests were represented in the Lords. The devolved Scottish Parliament, elected in 1999, created the first political forum where land reform could be legislated without Westminster veto. Andy Wightman\'s research and advocacy, combined with Jim Hunter\'s historical work, created the evidence base.',
    },
    guidingPolicy: {
      text: 'A statutory right of responsible access over all land and inland water; a Community Right to Buy giving communities pre-emption rights over land when it is offered for sale; and a Crofting Community Right to Buy allowing crofting communities to purchase their land without requiring landowner consent.',
      coreTheory: 'Access rights cannot be left to landowner discretion if they are to be universal. Community pre-emption rights rebalance property law to give communities first refusal before private sale. Compulsory crofting community buy rights address the most concentrated ownership pattern in Scotland where landowner consent is structurally unreliable.',
      mechanismRules: 'Part 1: statutory right of responsible access over all land and inland water for recreation, education, and crossing. Part 2: Community Right to Buy — communities register interest, get notification of intended sale, have 6 months to make an offer. Part 3: Crofting Community Right to Buy — right to compulsorily acquire without landowner consent.',
      tradeOffs: 'The Community Right to Buy (Part 2) requires landowner willingness to sell in practice — communities can only exercise the right when land is already on the market. The compulsory element (Part 3) applies only to crofting areas. The access right (Part 1) is the most significant departure from the CRoW Act 2000 model — covering all land, not just open country.',
      competitiveIdeaAnalysis: 'Norway\'s odelsrett (right of pre-emption for family farms) provided a European model for community pre-emption. The CRoW Act 2000 provided the English model for access rights but was more limited in scope. The Crofters\' Holdings (Scotland) Act 1886 established the statutory crofting framework that Part 3 built on.',
    },
    coherentActions: [
      {
        title: 'Introduce the Land Reform (Scotland) Bill',
        detailedDescription: 'Scottish Executive to introduce the Bill through the Scottish Parliament with three Parts. Rural Affairs Committee to conduct evidence sessions. Andy Wightman, Scottish Crofters Federation, and Ramblers Scotland to give evidence. Royal Assent February 2003. Scottish Land Fund to be funded to support community buyouts following commencement.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Fund the Scottish Land Fund',
        detailedDescription: 'Scottish Government to capitalise the Scottish Land Fund to support community buyouts, providing grants and loans to eligible community bodies seeking to purchase land under the Community Right to Buy provisions.',
        actionType: 'STRUCTURAL',
        orderIndex: 1,
      },
    ],
  },

  // ── 17. Well-being of Future Generations (Wales) Act 2015 ─────────────────
  {
    ideaId: 'd9a75dfc-9b89-45db-be2e-37c9b4b07d1f',
    title: 'Well-being of Future Generations (Wales) Act 2015',
    diagnosis: {
      text: 'Welsh public bodies — the Welsh Government, NHS Wales, local authorities, Natural Resources Wales, and other bodies — consistently made decisions that benefited the short term at the expense of future generations. Infrastructure, environment, and economic development choices were made without statutory obligation to consider long-term or inter-generational impact.',
      whoAffected: 'Future generations of people living in Wales, who would bear the consequences of current public sector decisions on climate, biodiversity, health, and economic development. Current generations, who saw the costs of previous short-term decisions in areas including coal tip remediation, river pollution, and housing stock quality.',
      impactDescription: 'Audit Wales reviews consistently found that public bodies failed to consider long-term sustainability. Annual budgeting cycles and short political terms structurally incentivised present-value decisions. Wales had specific legacy issues including coal tip remediation costs and significant water quality obligations from mining and agriculture.',
      obstacleDefined: 'No statutory duty required Welsh public bodies to consider long-term or inter-generational impact. The UK Sustainable Development Strategy was non-statutory. Annual budgeting dominated decision-making.',
      howAffected: 'Decisions on road building, housing development, economic development, and flood risk were made without inter-generational impact assessment. The compounding cost of short-term decision-making fell on future generations in higher remediation, healthcare, and adaptation costs.',
      whyPersisted: 'Annual budgeting cycles and electoral cycles both incentivised short-term decisions. No mechanism existed to represent the interests of people not yet born. The Welsh Government\'s One Planet Wales programme was voluntary. A statutory framework required primary legislation through the Senedd.',
    },
    rootCause: {
      text: 'Structural incentives in public sector decision-making — annual budgets, short political cycles, departmental silos — created a systematic bias toward present-value decisions at the expense of long-term sustainability. No institutional mechanism represented the interests of future generations.',
      rootCauseMechanism: 'The institutional structure of public decision-making (annual spending rounds, ministerial terms of office, departmental accountability to current Parliament) creates structural short-termism. Without an external check — a Commissioner with review powers — institutional bias toward present-value decisions is self-reinforcing.',
      whyNotSolved: 'The concept of statutory obligations to future generations had no precedent in UK constitutional law. The Welsh Government\'s Sustainable Development Charter was voluntary. It required a Welsh Labour Government with a strong Plaid Cymru influence — and the intellectual contribution of Peter Davies and the Sustainable Development Commission Wales — to create the political will to legislate.',
    },
    guidingPolicy: {
      text: 'A statutory duty on all Welsh public bodies to carry out sustainable development, defined by seven well-being goals and five ways of working, enforced by an independent Future Generations Commissioner with power to review and make recommendations.',
      coreTheory: 'Statutory obligations change institutional behaviour when backed by independent review. Seven well-being goals provide a comprehensive framework that prevents narrow interpretation. The Commissioner role creates an institutional voice for future generations that the democratic system otherwise lacks.',
      mechanismRules: 'Section 3: public bodies must carry out sustainable development. Section 4: duty to set well-being objectives. Sections 15-20: Future Generations Commissioner. Seven goals: prosperous, resilient, healthier, more equal, globally responsible, cohesive communities, vibrant culture. Five ways of working: long-term, prevention, integration, collaboration, involvement.',
      tradeOffs: 'The Commissioner has review powers but limited enforcement powers. Public bodies can set well-being objectives that nominally address the goals without substantive change. The international uniqueness of the approach means limited evidence on long-term effectiveness.',
      competitiveIdeaAnalysis: 'Hungary has a Commissioner for Fundamental Rights (Future Generations) with limited constitutional powers. Finland\'s Committee for the Future and the Cambridge Centre for the Study of Existential Risk provide non-statutory models. The Wales Act was the first statutory Commissioner role of its kind in the world.',
    },
    coherentActions: [
      {
        title: 'Introduce the Well-being of Future Generations Bill',
        detailedDescription: 'Welsh Government to introduce the Bill through the Senedd. Communities, Equality and Local Government Committee to conduct scrutiny. WWF Cymru, WCVA, and the Sustainable Development Alliance to give evidence. Royal Assent April 2015 with commencement April 2016. First Commissioner to be appointed and publish first annual report within 12 months.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
    ],
  },

  // ── 18. Organ Donation (Wales) Act 2013 ───────────────────────────────────
  {
    ideaId: '3709a536-22af-4443-941b-999201b75003',
    title: 'Organ Donation (Wales) Act 2013',
    diagnosis: {
      text: 'Wales had one of the lowest organ donor registration rates in the UK. More than 5,000 people in the UK died waiting for transplants between 2003 and 2013. The opt-in registration system required active initiative from potential donors — most people intended to register but never did, creating a large gap between willingness and registration.',
      whoAffected: 'Patients on transplant waiting lists who could not receive organs because of insufficient supply. Welsh communities where registration rates were significantly below the UK average.',
      impactDescription: 'In 2013, approximately 1,000 patients died in the UK waiting for a transplant. Wales had 82,000 registered donors (31% of population) versus 90% in countries with opt-out systems. NHSBT estimated that a soft opt-out system could increase available organs by 25-30%.',
      obstacleDefined: 'The gap between willingness to donate (polls consistently showed 90%+ support) and registration (31%) was structural, not attitudinal. The opt-in system required people to take a positive step that most never completed despite intending to.',
      howAffected: 'Patients on waiting lists received fewer organs than were available in principle. Families of unregistered people who had intended to donate were placed in the position of making the donation decision without guidance at a moment of acute grief.',
      whyPersisted: 'Organ donation had historically been treated as requiring explicit consent on the basis of bodily autonomy. A Taskforce report in 2008 had recommended against opt-out for England. Kidney Wales Foundation campaigned for Wales to act independently. The NHS Blood and Transplant body had opposed opt-out. It took a decade of Welsh-specific advocacy before the Welsh Government introduced the Bill.',
    },
    rootCause: {
      text: 'The opt-in system created a structural gap between the intention to donate and completed registration. Active initiative was required — a one-time administrative action that many people intended to complete but never did. The system wasted the latent supply of willing donors through administrative friction.',
      rootCauseMechanism: 'Behavioural gap: intention does not translate to action when action requires initiative. The opt-in system placed the burden on individuals to override the default of non-registration. Evidence from Spain, Austria, and Belgium demonstrated that opt-out systems closed this gap by changing the default.',
      whyNotSolved: 'The NHS Blood and Transplant body had argued that opt-out would reduce family consent rates by undermining the culture of explicit gift. The UK Taskforce (2008) had recommended against opt-out for England on these grounds. Kidney Wales built the Welsh evidence base to challenge these conclusions, pointing to Spain\'s experience of maintained family consent rates under a presumed consent system.',
    },
    guidingPolicy: {
      text: 'A soft opt-out system for Wales: adults who have not registered a decision are deemed to have consented to organ donation, while maintaining the right to opt out, the ability to place conditions on donation, and full consultation with families before donation proceeds.',
      coreTheory: 'Changing the default from opt-in to opt-out closes the gap between willing donors and registered donors. Family consultation is maintained in practice, preventing the feared reduction in consent rates. Evidence from comparable countries shows donation rates increase without reducing family trust in the system.',
      mechanismRules: 'Adults (18+) resident in Wales for 12+ months who have not registered an opt-out or an opt-in are deemed to have consented to donation. Opt-out register maintained by NHS Wales. Right to appoint a nominated representative. Transplant teams must consult families before donation proceeds.',
      tradeOffs: 'The 12-month residency requirement creates uncertainty for recently arrived migrants and visitors. Family consultation is maintained as a requirement in practice, which limits the supply increase compared to a hard opt-out. The Act applies only to Wales — transplantation is a cross-border service.',
      competitiveIdeaAnalysis: 'Spain\'s opt-out system combined with dedicated transplant coordinators has the highest donation rate in the world, but Spain\'s success is attributed primarily to the coordinator model rather than the legal presumption. Austria has had opt-out since 1982. England followed Wales with an opt-out system in 2019 (Organ Donation (Deemed Consent) Act).',
    },
    coherentActions: [
      {
        title: 'Introduce the Human Transplantation (Wales) Bill',
        detailedDescription: 'Welsh Government to introduce the Bill through the Senedd. Health and Social Care Committee to conduct scrutiny. Kidney Wales Foundation and BMA Cymru to give evidence. Extensive public information campaign to be planned before commencement. Royal Assent January 2013 with commencement December 2015.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Run a public information campaign',
        detailedDescription: 'NHS Wales and Welsh Government to run a sustained public information campaign explaining the change to deemed consent, how to opt out, and the importance of informing family of wishes. Campaign to run for 18 months before commencement in December 2015.',
        actionType: 'STRUCTURAL',
        orderIndex: 1,
      },
    ],
  },

  // ── 19. Domestic Abuse (Scotland) Act 2018 ────────────────────────────────
  {
    ideaId: '99dfa782-9435-4771-a15d-bbca283a606f',
    title: 'Domestic Abuse (Scotland) Act 2018',
    diagnosis: {
      text: 'Coercive and controlling behaviour — the most common form of domestic abuse — was not a criminal offence in Scotland. Existing criminal law (assault, breach of the peace, threatening behaviour) captured only discrete violent incidents, missing the course of conduct that characterises most serious domestic abuse. Scotland lagged England and Wales where the Serious Crime Act 2015 had created a coercive control offence.',
      whoAffected: 'Primarily women experiencing sustained patterns of coercive control, psychological abuse, financial control, and isolation — patterns that did not constitute any existing criminal offence without a specific violent incident.',
      impactDescription: 'Scottish Women\'s Aid supported 7,000 women and children through refuge and community services in 2017. Police Scotland received over 60,000 domestic abuse call-outs per year. Conviction rates for domestic abuse were consistently lower than for comparable violent offences, partly because coercive patterns were unrecognised in law.',
      obstacleDefined: 'No criminal offence of course-of-conduct domestic abuse existed. Prosecutors could only charge individual incidents. The pattern of behaviour — recognised by researchers, psychologists, and support workers as the core of most serious domestic abuse — was invisible in law.',
      howAffected: 'Victims who primarily experienced psychological and financial control, isolation, and threats — without regular physical violence — could not access the protection of the criminal law. When incidents did come before the courts, the broader pattern of abuse was often legally inadmissible.',
      whyPersisted: 'Scottish criminal law was built around incidents rather than patterns. The Serious Crime Act 2015 applied to England and Wales only. Scottish Women\'s Aid\'s decade of evidence-gathering and Evan Stark\'s Coercive Control framework (2007) created the academic and practice evidence base. The Scottish Government\'s commitment followed the consultation on a standalone offence in 2015.',
    },
    rootCause: {
      text: 'Scottish criminal law addressed incidents of violence rather than patterns of behaviour. The common law framework required proof of a specific harmful act rather than a course of conduct. Police Scotland training, Crown Office guidance, and judicial understanding were all built around incident evidence rather than pattern evidence.',
      rootCauseMechanism: 'The actus reus of existing offences required discrete incidents. A course of conduct — cumulative psychological control that causes serious harm without any single criminal act — was legally invisible. This created an enforcement gap that perpetrators systematically exploited.',
      whyNotSolved: 'The Crown Office had argued that existing offences were sufficient with appropriate prosecution charging practice. Police Scotland had piloted domestic abuse risk assessment but without the legal tools to reflect coercive control in charges. Scottish Women\'s Aid\'s persistence in documenting the gap between practice and law was essential to driving the legislative commitment.',
    },
    guidingPolicy: {
      text: 'A new standalone criminal offence of domestic abuse in Scotland: a course of behaviour that is abusive — physical, sexual, psychological, or financial — towards a partner or ex-partner, with a specific children\'s aggravation.',
      coreTheory: 'A standalone offence changes how police, prosecutors, and courts understand and respond to domestic abuse. It enables pattern evidence to be led and prevents perpetrators from avoiding accountability by ensuring no single incident crosses a criminal threshold.',
      mechanismRules: 'Section 1: offence of engaging in a course of behaviour that is abusive of a partner or ex-partner. Section 5: children\'s aggravation where the accused\'s behaviour adversely affects children in the household. Maximum sentence: 14 years on indictment. Section 9: post-conviction orders.',
      tradeOffs: 'The offence requires evidence of a course of behaviour — prosecutors must demonstrate a pattern rather than a single incident. This is more demanding evidentially but more accurately reflects the reality of abuse. The offence applies only to partners and ex-partners — not family members.',
      competitiveIdeaAnalysis: 'The Serious Crime Act 2015 (England and Wales) created a comparable coercive control offence in section 76. The Scotland Act reflected Scottish Women\'s Aid\'s preference for a more comprehensive standalone offence rather than adding to existing criminal legislation. The 2018 Act was enacted three years after the England and Wales equivalent.',
    },
    coherentActions: [
      {
        title: 'Introduce the Domestic Abuse (Scotland) Bill',
        detailedDescription: 'Scottish Government to introduce the Bill through the Scottish Parliament. Justice Committee to conduct pre-legislative scrutiny. Scottish Women\'s Aid and Rape Crisis Scotland to give evidence. Police Scotland, Crown Office and Procurator Fiscal Service to receive training before commencement. Royal Assent February 2018.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Provide training for Police Scotland and COPFS',
        detailedDescription: 'Scottish Government to fund specialist domestic abuse training for Police Scotland officers and Crown Office prosecutors, enabling them to identify and evidence course of behaviour rather than individual incidents. Training to be completed before the Act commences in April 2019.',
        actionType: 'STRUCTURAL',
        orderIndex: 1,
      },
    ],
  },

  // ── 20. Planning and Infrastructure Act 2025 ──────────────────────────────
  {
    ideaId: 'c75db19f-128c-4216-8770-b0d6748a1d3f',
    title: 'Planning and Infrastructure Act 2025',
    diagnosis: {
      text: 'The UK planning system was a major constraint on economic growth and infrastructure delivery. Nationally Significant Infrastructure Projects (NSIPs) faced multi-year delays from mandatory statutory pre-application consultation. The biodiversity net gain framework created per-site obligations that developers found technically unworkable in urban contexts. Development corporations lacked adequate compulsory purchase powers.',
      whoAffected: 'Infrastructure developers, energy companies, housing developers, and local authorities seeking to deliver NSIPs. Local communities affected by delayed housing and infrastructure delivery. The UK economy broadly, through reduced investment and higher infrastructure costs.',
      impactDescription: 'The CBI estimated planning delays cost the UK economy £20 billion per year in deferred investment. NSIPs were taking an average of 4.7 years from application to consent. The National Infrastructure Commission calculated that the biodiversity net gain requirement added 15–18% to development costs in some urban sites. Housing output had been approximately 250,000 units per year against a target of 300,000.',
      obstacleDefined: 'Three interlocking planning constraints: (1) statutory pre-application consultation for NSIPs added 1–2 years before any application could be submitted; (2) per-project biodiversity obligations were technically undeliverable on many urban brownfield sites; (3) CPO law required complex proportionality justification that delayed land assembly.',
      howAffected: 'Infrastructure projects stalled at pre-application stage. Developers avoided brownfield urban development because biodiversity obligations were disproportionate to greenfield alternatives. Communities awaiting hospitals, schools, transport, and homes faced multi-decade delays.',
      whyPersisted: 'Environmental and amenity organisations defended biodiversity and consultation requirements as essential protections. Planning lawyers benefited from complex procedural requirements. Previous governments had made incremental changes but not addressed the structural bottlenecks. Labour\'s 2024 manifesto commitment to 1.5 million homes created the political drive for systemic reform.',
    },
    rootCause: {
      text: 'Three statutory bottlenecks in combination: mandatory pre-application NSIP consultation embedded in the Planning Act 2008; per-site biodiversity net gain requirements that could not be cost-effectively delivered on all sites; CPO law complexity that made land assembly for development corporations prohibitively slow.',
      rootCauseMechanism: 'Each bottleneck individually could be managed; in combination they made large-scale development economically marginal and legally uncertain. Investors required planning certainty before committing capital — the absence of this certainty, or the cost of achieving it, reduced investment below the level required for growth targets.',
      whyNotSolved: 'Environmental groups had successfully defended biodiversity and consultation requirements by framing them as fundamental protections against development harm. Previous planning reform (the Levelling-Up and Regeneration Act 2023) had made incremental changes. The Labour majority in 2024, combined with Treasury pressure on growth and housing, created the political window for systemic reform.',
    },
    guidingPolicy: {
      text: 'Remove the statutory pre-application NSIP consultation requirement; replace per-project biodiversity obligations with a Nature Restoration Fund allowing developers to fund landscape-scale nature recovery; give development corporations new and faster compulsory purchase powers.',
      coreTheory: 'Removing the pre-application consultation bottleneck eliminates 1–2 years from NSIP timelines without reducing meaningful community engagement, which can be achieved through the examination process. Landscape-scale biodiversity investment through the Nature Restoration Fund is more effective than per-site obligations, which are undeliverable on brownfield land.',
      mechanismRules: 'Section 1: removal of statutory pre-application consultation for NSIPs. Section 14: Nature Restoration Fund administered by Natural England — developers contribute to fund instead of delivering on-site. Section 47: compulsory purchase law reform removing proportionality requirement for development corporations with planning permission.',
      tradeOffs: 'The Nature Restoration Fund model has been criticised by wildlife organisations as allowing "biodiversity offsetting" that allows developers to pay to destroy habitats without equivalent local restoration. Removing NSIP pre-application consultation reduces community influence at the earliest stage. CPO reform is opposed by private landowners.',
      competitiveIdeaAnalysis: 'Germany\'s Infrastructure Acceleration Act (Investitionsbeschleunigungsgesetz) provided a model for removing procedural bottlenecks. France\'s ZAN (Zéro Artificialisation Nette) framework provides a national biodiversity accounting system. The UK Act drew on the National Infrastructure Commission\'s review of planning reform (2023).',
    },
    coherentActions: [
      {
        title: 'Introduce the Planning and Infrastructure Bill',
        detailedDescription: 'MHCLG and DESNZ jointly to introduce the Bill. Levelling Up, Housing and Communities Committee to scrutinise. CBI, British Property Federation, and Wildlife Trusts to give evidence. Treasury to publish growth projections from reform. Royal Assent June 2025.',
        actionType: 'LEGISLATION',
        orderIndex: 0,
      },
      {
        title: 'Establish the Nature Restoration Fund',
        detailedDescription: 'MHCLG to establish the Nature Restoration Fund within Natural England, with a charging schedule for developer contributions by development type and location. Fund to begin accepting contributions from commencement. First landscape-scale restoration projects to be designated within 12 months.',
        actionType: 'STRUCTURAL',
        orderIndex: 1,
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main
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

async function main() {
  const results: ResultRecord[] = []

  for (const kernel of KERNELS) {
    const result: ResultRecord = {
      title: kernel.title,
      ideaId: kernel.ideaId,
      diagnosis: 'skipped',
      rootCause: 'skipped',
      guidingPolicy: 'skipped',
      coherentActions: 0,
    }

    try {
      // Confirm the idea exists
      const idea = await prisma.idea.findUnique({
        where: { id: kernel.ideaId },
        select: { id: true, title: true },
      })
      if (!idea) {
        console.error(`  ✗ Idea not found: ${kernel.ideaId} (${kernel.title})`)
        result.error = 'Idea not found'
        results.push(result)
        continue
      }

      // ── Diagnosis (unique per ideaId — upsert) ───────────────────────────
      try {
        const existingDiag = await prisma.diagnosis.findUnique({ where: { ideaId: kernel.ideaId } })
        if (existingDiag) {
          await prisma.diagnosis.update({
            where: { ideaId: kernel.ideaId },
            data: kernel.diagnosis,
          })
          result.diagnosis = 'updated'
        } else {
          await prisma.diagnosis.create({
            data: { ideaId: kernel.ideaId, ...kernel.diagnosis },
          })
          result.diagnosis = 'created'
        }
      } catch (err) {
        console.error(`  ✗ Diagnosis failed for ${kernel.title}:`, err)
        result.diagnosis = 'error'
      }

      // ── RootCause (create only if none exist) ────────────────────────────
      try {
        const existingRC = await prisma.rootCause.findFirst({ where: { ideaId: kernel.ideaId } })
        if (!existingRC) {
          await prisma.rootCause.create({
            data: { ideaId: kernel.ideaId, ...kernel.rootCause },
          })
          result.rootCause = 'created'
        } else {
          result.rootCause = 'skipped'
        }
      } catch (err) {
        console.error(`  ✗ RootCause failed for ${kernel.title}:`, err)
        result.rootCause = 'error'
      }

      // ── GuidingPolicy (unique per ideaId — upsert) ───────────────────────
      try {
        const existingGP = await prisma.guidingPolicy.findUnique({ where: { ideaId: kernel.ideaId } })
        if (existingGP) {
          await prisma.guidingPolicy.update({
            where: { ideaId: kernel.ideaId },
            data: kernel.guidingPolicy,
          })
          result.guidingPolicy = 'updated'
        } else {
          await prisma.guidingPolicy.create({
            data: { ideaId: kernel.ideaId, ...kernel.guidingPolicy },
          })
          result.guidingPolicy = 'created'
        }
      } catch (err) {
        console.error(`  ✗ GuidingPolicy failed for ${kernel.title}:`, err)
        result.guidingPolicy = 'error'
      }

      // ── CoherentActions (create only if none exist for this idea) ─────────
      try {
        const existingCA = await prisma.coherentAction.findFirst({ where: { ideaId: kernel.ideaId } })
        if (!existingCA) {
          for (const action of kernel.coherentActions) {
            await prisma.coherentAction.create({
              data: { ideaId: kernel.ideaId, ...action },
            })
          }
          result.coherentActions = kernel.coherentActions.length
        } else {
          const count = await prisma.coherentAction.count({ where: { ideaId: kernel.ideaId } })
          result.coherentActions = count
        }
      } catch (err) {
        console.error(`  ✗ CoherentActions failed for ${kernel.title}:`, err)
      }

      console.log(`  ✓ ${kernel.title}`)
      results.push(result)
    } catch (err) {
      console.error(`  ✗ Fatal error for ${kernel.title}:`, err)
      result.error = String(err)
      results.push(result)
    }
  }

  // ── Summary table ────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════')
  console.log('SEED SUMMARY')
  console.log('════════════════════════════════════════════════════════════════')
  console.log(
    `${'Title'.padEnd(52)} ${'Diag'.padEnd(8)} ${'Root'.padEnd(8)} ${'Policy'.padEnd(8)} ${'CA#'}`
  )
  console.log('─'.repeat(82))
  for (const r of results) {
    const title = r.title.length > 50 ? r.title.slice(0, 47) + '...' : r.title
    const diag = r.diagnosis.padEnd(8)
    const rc = r.rootCause.padEnd(8)
    const gp = r.guidingPolicy.padEnd(8)
    const ca = String(r.coherentActions)
    console.log(`${title.padEnd(52)} ${diag} ${rc} ${gp} ${ca}`)
    if (r.error) console.log(`  ERROR: ${r.error}`)
  }
  console.log('─'.repeat(82))
  console.log(
    `Total: ${results.filter(r => !r.error).length}/${KERNELS.length} ideas processed successfully.`
  )
}

main()
  .catch(err => { console.error('Fatal error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
