/**
 * Seed 20 historical example ideas and their org user accounts.
 * Idempotent — safe to run multiple times.
 *
 * Run with:
 *   npx tsx --env-file=.env scripts/seed/seed-historical-examples.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ─────────────────────────────────────────────────────────────────────────────
// User definitions
// ─────────────────────────────────────────────────────────────────────────────

const USERS = [
  { slug: 'shelter_england', name: 'Shelter England', email: 'historical+shelter@scrutinise.org' },
  { slug: 'justice_and_care', name: 'Justice and Care', email: 'historical+justice_care@scrutinise.org' },
  { slug: 'league_cruel_sports', name: 'League Against Cruel Sports', email: 'historical+lacs@scrutinise.org' },
  { slug: 'press_for_change', name: 'Press for Change', email: 'historical+press_for_change@scrutinise.org' },
  { slug: 'fawcett_society', name: 'Fawcett Society', email: 'historical+fawcett@scrutinise.org' },
  { slug: 'ramblers_association', name: 'Ramblers Association', email: 'historical+ramblers@scrutinise.org' },
  { slug: 'which_consumer', name: 'Which?', email: 'historical+which@scrutinise.org' },
  { slug: 'howard_league_scotland', name: 'Howard League Scotland', email: 'historical+howard_league@scrutinise.org' },
  { slug: 'womens_aid', name: "Women's Aid", email: 'historical+womens_aid@scrutinise.org' },
  { slug: 'action_smoking_health', name: 'Action on Smoking and Health (ASH)', email: 'historical+ash@scrutinise.org' },
  { slug: 'policy_exchange', name: 'Policy Exchange', email: 'historical+policy_exchange@scrutinise.org' },
  { slug: 'big_brother_watch', name: 'Big Brother Watch', email: 'historical+bbw@scrutinise.org' },
  { slug: 'free_speech_union', name: 'Free Speech Union', email: 'historical+fsu@scrutinise.org' },
  { slug: 'bma_ash_tobacco', name: 'British Medical Association', email: 'historical+bma@scrutinise.org' },
  { slug: 'andy_wightman', name: 'Andy Wightman', email: 'historical+wightman@scrutinise.org' },
  { slug: 'wwf_cymru', name: 'WWF Cymru', email: 'historical+wwf_cymru@scrutinise.org' },
  { slug: 'kidney_wales', name: 'Kidney Wales Foundation', email: 'historical+kidney_wales@scrutinise.org' },
  { slug: 'scottish_womens_aid', name: "Scottish Women's Aid", email: 'historical+swa@scrutinise.org' },
  { slug: 'cbi_bpf', name: 'CBI / British Property Federation', email: 'historical+cbi_bpf@scrutinise.org' },
  // shelter_england_2 is the SAME user as shelter_england — no second record needed.
]

// ─────────────────────────────────────────────────────────────────────────────
// Idea definitions
// ─────────────────────────────────────────────────────────────────────────────

const IDEAS = [
  {
    creatorSlug: 'shelter_england',
    title: 'Homelessness Reduction Act 2017',
    summaryDescription: 'Required English councils to intervene 56 days before someone becomes homeless, not just after. Extended the duty of care to all homeless people, not just priority groups.',
    govtArea: 'Housing',
    summaryDiagnosis: 'Councils only had a duty to house people after they became homeless, meaning prevention was rare and thousands of families lost their homes unnecessarily each year.',
    summaryGuidingPolicy: 'Create a new Prevention Duty requiring councils to take reasonable steps to prevent homelessness 56 days before it occurs, for anyone at risk.',
    summaryCoherentActions: 'Amend the Housing Act 1996 to create prevention and relief duties, extend eligibility beyond priority groups, and require personalised housing plans.',
  },
  {
    creatorSlug: 'justice_and_care',
    title: 'Modern Slavery Act 2015',
    summaryDescription: 'Consolidated slavery and trafficking offences into a single Act, established the Independent Anti-Slavery Commissioner, and introduced transparency in supply chains requirements for large businesses.',
    govtArea: 'Home Office',
    summaryDiagnosis: 'Slavery and human trafficking offences were scattered across multiple Acts, making prosecution difficult. The scale of modern slavery in the UK — estimated at tens of thousands of victims — was largely hidden.',
    summaryGuidingPolicy: 'Consolidate all slavery and trafficking offences, create a dedicated commissioner to oversee the government\'s response, and require large companies to disclose steps taken to ensure their supply chains are slavery-free.',
    summaryCoherentActions: 'Introduce a Modern Slavery Bill consolidating offences under the Slavery, Servitude and Forced Labour Act, create the Independent Anti-Slavery Commissioner role, and mandate annual transparency statements from businesses with turnover over £36m.',
  },
  {
    creatorSlug: 'league_cruel_sports',
    title: 'Hunting Act 2004',
    summaryDescription: 'Banned the hunting of wild mammals with dogs in England and Wales. The result of a 60-year civil society campaign, it finally passed after reform of the House of Lords removed the blocking power of the upper chamber.',
    govtArea: 'Environment',
    summaryDiagnosis: 'Fox hunting with hounds caused significant suffering to wild animals and had no justification as a pest control method — it was an elite recreational activity protected by landowning interests in the Lords.',
    summaryGuidingPolicy: 'A simple ban with criminal penalties, enforced by police, with limited exemptions for genuine pest control using dogs.',
    summaryCoherentActions: 'Pass primary legislation banning hunting with dogs, with offences carrying unlimited fines and potential imprisonment. Use the Parliament Acts if the Lords block it.',
  },
  {
    creatorSlug: 'press_for_change',
    title: 'Gender Recognition Act 2004',
    summaryDescription: 'Allowed trans people in the UK to obtain a Gender Recognition Certificate, giving full legal recognition of their acquired gender without requiring surgery. The legislation followed the Goodwin v UK ECHR ruling which found the UK in breach of the Convention.',
    govtArea: 'Justice',
    summaryDiagnosis: 'Trans people had no legal recognition of their acquired gender. Following Goodwin v UK (2002), the UK government was required by ECHR to provide a mechanism for legal gender recognition.',
    summaryGuidingPolicy: 'Create a statutory Gender Recognition Panel to assess applications and issue Gender Recognition Certificates, conferring full legal status in the acquired gender including for marriage and pension purposes.',
    summaryCoherentActions: 'Introduce the Gender Recognition Bill with a panel-based process requiring medical diagnosis and a two-year real-life experience test, leading to a full GRC with legal status equivalent to birth registration.',
  },
  {
    creatorSlug: 'fawcett_society',
    title: 'Gender Pay Gap Reporting in the Equality Act 2010',
    summaryDescription: 'The Equality Act 2010 included powers (activated via regulations in 2017) requiring employers with 250+ staff to publish their gender pay gap annually. The Fawcett Society campaigned for this for over two decades.',
    govtArea: 'Business',
    summaryDiagnosis: 'Women earn less than men across almost every sector, but without transparency requirements employers had no accountability for the gap and no incentive to act.',
    summaryGuidingPolicy: 'Mandatory pay gap reporting, publicly accessible, creating reputational pressure on employers and an evidence base for enforcement.',
    summaryCoherentActions: 'Include a pay transparency regulation power in the Equality Bill, then activate it via statutory instrument requiring all employers of 250+ to publish mean and median gender pay gap data annually on a government portal.',
  },
  {
    creatorSlug: 'ramblers_association',
    title: 'Countryside and Rights of Way Act 2000',
    summaryDescription: 'Created a legal right to roam over mountain, moor, heath, down and registered common land in England and Wales. The result of a 60-year campaign by the Ramblers Association following the 1932 Kinder Scout mass trespass.',
    govtArea: 'Environment',
    summaryDiagnosis: 'Public access to open countryside was entirely at the discretion of landowners. Millions of people were excluded from upland and heath landscapes that had historically been used for recreation and subsistence.',
    summaryGuidingPolicy: 'A statutory right of access to open country — mountain, moor, heath, and down — with a mapping exercise to define the open access land and a complaints mechanism for obstruction.',
    summaryCoherentActions: 'Amend the National Parks and Access to the Countryside Act 1949 to create an access right, fund the Countryside Agency to map all open access land in England and Wales, and establish the Open Access Contact Service for disputes.',
  },
  {
    creatorSlug: 'which_consumer',
    title: 'Consumer Rights Act 2015',
    summaryDescription: 'Consolidated and modernised UK consumer protection law, for the first time covering digital content, and introduced new rules on unfair terms and trader remedies. Which? ran a sustained evidence-based campaign from 2008 to 2014 that directly shaped the legislation.',
    govtArea: 'Business',
    summaryDiagnosis: "Consumer protection law was spread across the Sale of Goods Act 1979, Supply of Goods and Services Act 1982, and Unfair Terms in Consumer Contracts Regulations 1999 — outdated and inconsistent, and not covering digital goods at all.",
    summaryGuidingPolicy: 'A single, clear Consumer Rights Act replacing the fragmented framework, explicitly covering digital content, with clear remedies (repair, replace, refund) and enforceable by Trading Standards.',
    summaryCoherentActions: 'Repeal Sale of Goods Act 1979 and related legislation, replace with a single Act covering goods, services and digital content, provide clear 30-day short-term right to reject, and give the Competition and Markets Authority power to seek injunctions against unfair terms.',
  },
  {
    creatorSlug: 'howard_league_scotland',
    title: 'Age of Criminal Responsibility (Scotland) Act 2021',
    summaryDescription: 'Raised the age of criminal responsibility in Scotland from 8 to 12, making Scotland the first UK nation to meet the UN Committee on the Rights of the Child minimum recommendation. The Howard League Scotland and Just Deuteronomy campaigned for this reform for over a decade.',
    govtArea: 'Justice',
    summaryDiagnosis: 'Scotland had the lowest age of criminal responsibility in Europe at 8 years old, directly at odds with child development evidence and international children\'s rights standards.',
    summaryGuidingPolicy: "Raise the minimum age and create a Children's Hearings System response for children under 12 who commit acts that would otherwise be criminal — treating them as children in need of support rather than offenders.",
    summaryCoherentActions: "Introduce primary legislation through the Scottish Parliament raising the age to 12, accompanied by increased investment in early intervention and the Children's Hearings System.",
  },
  {
    creatorSlug: 'shelter_england',
    title: 'Homes (Fitness for Human Habitation) Act 2018',
    summaryDescription: 'Made landlords legally responsible for keeping rented homes fit for human habitation throughout the tenancy. Karen Buck MP introduced this as a Private Member\'s Bill after four previous attempts. Shelter provided the evidence base and campaign support.',
    govtArea: 'Housing',
    summaryDiagnosis: 'Landlords had no general legal obligation to maintain properties fit for habitation during a tenancy. The Landlord and Tenant Act 1985 required fitness at the start but not throughout. Thousands of renters lived in damp, mouldy, or structurally unsafe homes with no legal remedy.',
    summaryGuidingPolicy: 'Amend the Landlord and Tenant Act 1985 to impose an implied covenant that properties must be fit for human habitation at the start and throughout the tenancy, enforceable by tenants in the courts.',
    summaryCoherentActions: "Karen Buck to introduce a Private Member's Bill amending section 8 of the Landlord and Tenant Act 1985. Shelter to provide evidence to the Bill committee. Government to confirm non-opposition after the fifth attempt.",
  },
  {
    creatorSlug: 'womens_aid',
    title: 'Domestic Abuse Act 2021',
    summaryDescription: 'Created the first statutory definition of domestic abuse in England and Wales, established the Domestic Abuse Commissioner, recognised children as victims in their own right, and prohibited perpetrators from cross-examining victims in court. A decade-long coalition campaign.',
    govtArea: 'Home Office',
    summaryDiagnosis: 'There was no statutory definition of domestic abuse in England and Wales. The legal framework was fragmented, coercive control was not recognised as abuse, and perpetrators could cross-examine their victims directly in family proceedings.',
    summaryGuidingPolicy: 'A comprehensive statutory framework: define domestic abuse to include coercive and controlling behaviour, create an independent Commissioner to drive the national response, and strengthen court protections for victims.',
    summaryCoherentActions: 'Introduce a Domestic Abuse Bill creating the statutory definition including psychological, emotional and economic abuse; establish the Domestic Abuse Commissioner in statute; prohibit personal cross-examination of victims by perpetrators in civil proceedings.',
  },
  {
    creatorSlug: 'action_smoking_health',
    title: 'Tobacco and Vapes Act 2025',
    summaryDescription: 'Introduced a generational smoking ban — no one born on or after 1 January 2009 can ever legally be sold tobacco in the UK. The most significant tobacco control legislation since the Health Act 2006. ASH spent a decade building the evidence base for this approach.',
    govtArea: 'Health',
    summaryDiagnosis: 'Conventional tobacco control — taxation, plain packaging, advertising bans — had reduced smoking rates but could not reach zero. Each new generation continued to be recruited to smoking. A generational approach would end recruitment entirely.',
    summaryGuidingPolicy: 'A date-based ban preventing sale of tobacco products to anyone born after a set date, creating a smokefree generation without criminalising existing smokers.',
    summaryCoherentActions: 'Introduce primary legislation setting a birth-date threshold (1 January 2009) after which tobacco products cannot be sold to that person at any age. Apply equivalent restrictions to vaping products to prevent displacement.',
  },
  {
    creatorSlug: 'policy_exchange',
    title: 'Academies Act 2010',
    summaryDescription: "Allowed all maintained schools in England to apply to become academies, independent of local authority control. Policy Exchange's 2007 report 'A Guide to School Reform' directly shaped the legislation. Michael Gove acknowledged it as the intellectual foundation of the academies programme.",
    govtArea: 'Education',
    summaryDiagnosis: 'Local authority control of schools created bureaucratic inefficiency and insulated underperforming schools from accountability. Head teachers had limited autonomy over curriculum, staffing and budget.',
    summaryGuidingPolicy: 'Allow all schools to become independent academies with direct funding from central government, full freedom over curriculum, staffing and admissions, and accountability through Ofsted and published results.',
    summaryCoherentActions: 'Pass primary legislation enabling any maintained school to apply for academy status, fast-track the process for outstanding schools, and create a new funding agreement directly between academy trusts and the Secretary of State.',
  },
  {
    creatorSlug: 'big_brother_watch',
    title: 'Protection of Freedoms Act 2012',
    summaryDescription: 'Regulated CCTV use by public authorities, required destruction of innocent people\'s DNA profiles from the national database, and restricted wheel-clamping on private land. Big Brother Watch built the evidence base for DNA database reform following the Marper v UK ECHR ruling.',
    govtArea: 'Home Office',
    summaryDiagnosis: "The UK had the largest DNA database per capita of any democracy, retaining profiles of millions of people never convicted of any offence. Following Marper v UK (2008), the European Court found this violated the right to privacy.",
    summaryGuidingPolicy: "Bring UK DNA retention practice into compliance with the ECHR ruling by requiring destruction of profiles of unconvicted individuals, while retaining profiles of those convicted of serious offences.",
    summaryCoherentActions: "Introduce legislation requiring the deletion of DNA profiles, fingerprints and cellular samples from innocent people unless specifically authorised for retention by a chief constable in exceptional circumstances.",
  },
  {
    creatorSlug: 'free_speech_union',
    title: 'Higher Education (Freedom of Speech) Act 2023',
    summaryDescription: 'Imposed new free speech duties on universities in England and Wales, banned the use of NDAs to silence harassment complainants, and established a free speech complaints scheme operated by the Office for Students. The Free Speech Union drove the campaign alongside Conservative MPs.',
    govtArea: 'Education',
    summaryDiagnosis: 'Universities were systematically de-platforming speakers, dismissing academics for their views, and using non-disclosure agreements to silence complainants. The 1986 free speech duty was unenforceable because no regulator had investigatory powers.',
    summaryGuidingPolicy: 'Strengthen the free speech duty with regulatory teeth — give the Office for Students power to investigate and fine, create a complaints mechanism for speakers and academics who suffer loss, and ban NDAs in free speech complaints.',
    summaryCoherentActions: 'Introduce the Higher Education (Freedom of Speech) Bill amending the Higher Education and Research Act 2017, inserting new sections A1-A5 imposing duties on providers and constituent institutions, with OfS enforcement powers and a complaints scheme.',
  },
  {
    creatorSlug: 'bma_ash_tobacco',
    title: 'Tobacco Advertising and Promotion Act 2002',
    summaryDescription: 'Banned almost all tobacco advertising and promotion in the UK, including print, billboards, and sponsorship of sport. ASH and the BMA campaigned for this for over 30 years. Tobacco companies challenged it in the courts and failed.',
    govtArea: 'Health',
    summaryDiagnosis: 'Tobacco advertising recruited new smokers — particularly young people — by normalising and glamourising smoking. The industry spent over £100 million per year on UK advertising. Evidence from countries that had banned advertising showed significant falls in smoking uptake.',
    summaryGuidingPolicy: "A comprehensive ban on tobacco advertising and promotion across all media, including indirect advertising through sponsorship, ending the industry's ability to recruit new smokers through marketing.",
    summaryCoherentActions: 'Introduce primary legislation banning tobacco advertising in print, on billboards, and by direct mail; ban tobacco sponsorship of events; apply equivalent restrictions to point-of-sale display; challenge any EU state aid or competition law objections.',
  },
  {
    creatorSlug: 'andy_wightman',
    title: 'Land Reform (Scotland) Act 2003',
    summaryDescription: "Created a statutory right to roam over all land and inland water in Scotland, and established community right to buy provisions allowing communities to purchase land before private sale. Andy Wightman's research and advocacy over two decades was central to the legislation.",
    govtArea: 'Environment',
    summaryDiagnosis: 'Scotland had one of the most concentrated land ownership patterns in Europe — around 432 landowners controlled half of all private land. Communities had no rights to access or purchase land to which they had historical connection.',
    summaryGuidingPolicy: 'A statutory access right over all land (not just open country) combined with a community right to buy, creating both democratic access and a mechanism for community land ownership.',
    summaryCoherentActions: 'Introduce the Land Reform (Scotland) Bill creating Part 1 (access rights), Part 2 (community right to buy) and Part 3 (crofting community right to buy); establish the Scottish Land Court as the enforcement mechanism; fund community land buyouts through the Scottish Land Fund.',
  },
  {
    creatorSlug: 'wwf_cymru',
    title: 'Well-being of Future Generations (Wales) Act 2015',
    summaryDescription: 'Required Welsh public bodies to consider the long-term sustainability of their decisions, established seven well-being goals, and created the Future Generations Commissioner for Wales — the first such role in the world. A genuine Welsh legislative innovation with no UK equivalent.',
    govtArea: 'Cabinet Office',
    summaryDiagnosis: 'Public bodies in Wales consistently made decisions that benefited the short term at the expense of future generations — infrastructure choices, environmental decisions, economic development — with no statutory obligation to consider long-term impact.',
    summaryGuidingPolicy: 'A statutory duty on all Welsh public bodies to carry out sustainable development, defined by seven well-being goals and enforced by an independent Commissioner with review powers.',
    summaryCoherentActions: 'Introduce the Well-being of Future Generations Bill through the Senedd, establishing the seven goals (prosperity, resilience, equality, health, cohesion, culture, global responsibility), creating the Commissioner role with power to review and make recommendations, and requiring well-being objectives from all public bodies.',
  },
  {
    creatorSlug: 'kidney_wales',
    title: 'Organ Donation (Wales) Act 2013',
    summaryDescription: 'Introduced deemed consent (soft opt-out) for organ donation in Wales, making Wales the first UK nation to do so. Kidney Wales Foundation campaigned for a decade. The Act came into force in 2015 and Wales subsequently had significantly higher consent rates.',
    govtArea: 'Health',
    summaryDiagnosis: 'Wales had one of the lowest organ donor registration rates in the UK. Thousands of people died awaiting transplants that could have been performed if consent rates were higher. The opt-in system required active registration that many people intended to do but never completed.',
    summaryGuidingPolicy: 'A soft opt-out system where adults who have not opted out are deemed to have consented to organ donation, while maintaining the ability for individuals to opt out and for families to be consulted.',
    summaryCoherentActions: 'Introduce the Human Transplantation (Wales) Bill through the Senedd creating deemed consent; run a public information campaign; maintain an opt-out register; publish annual data on consent rates to assess impact.',
  },
  {
    creatorSlug: 'scottish_womens_aid',
    title: 'Domestic Abuse (Scotland) Act 2018',
    summaryDescription: 'Created a specific offence of domestic abuse for the first time in Scotland, explicitly covering coercive and controlling behaviour — pre-dating the equivalent England/Wales legislation by three years. Scottish Women\'s Aid drove the campaign over a decade.',
    govtArea: 'Justice',
    summaryDiagnosis: 'Coercive and controlling behaviour — the most common form of domestic abuse — was not a criminal offence in Scotland. The existing criminal law only captured individual violent incidents, missing the pattern of behaviour that characterises abuse.',
    summaryGuidingPolicy: 'A new standalone criminal offence of domestic abuse covering any course of behaviour that is abusive — physical, sexual, psychological, or financial — with a specific provision for the impact on children in the household.',
    summaryCoherentActions: 'Introduce the Domestic Abuse (Scotland) Bill creating a new offence in section 1 covering any abusive behaviour toward a partner or ex-partner; include the children\'s aggravation in section 5; ensure training for Police Scotland, prosecutors and judiciary.',
  },
  {
    creatorSlug: 'cbi_bpf',
    title: 'Planning and Infrastructure Act 2025',
    summaryDescription: 'Streamlined planning for nationally significant infrastructure, reformed the Nature Restoration Fund to reduce development delays, and created new powers for development corporations. The CBI and British Property Federation led years of advocacy for planning reform as a growth barrier.',
    govtArea: 'Housing',
    summaryDiagnosis: "The UK's planning system was a major constraint on economic growth. Infrastructure projects faced multi-year delays from judicial review and pre-application requirements. The biodiversity net gain framework created per-site obligations that developers found unworkable and expensive.",
    summaryGuidingPolicy: 'Streamline NSIP consents, replace per-project biodiversity obligations with a Nature Restoration Fund allowing developers to fund landscape-scale nature recovery, and give development corporations new compulsory purchase powers.',
    summaryCoherentActions: 'Introduce a Planning and Infrastructure Bill removing the statutory pre-application consultation requirement, establishing the Nature Restoration Fund administered by Natural England, and amending compulsory purchase law to speed up land assembly for major development corporations.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  let userUpserted = 0
  let ideaUpserted = 0

  // Map slug → DB user id (populated as we upsert)
  const userIdMap = new Map<string, string>()

  // Upsert users
  for (const u of USERS) {
    try {
      const user = await prisma.user.upsert({
        where: { clerkId: `historical_${u.slug}` },
        update: {
          name: u.name,
          email: u.email,
        },
        create: {
          clerkId: `historical_${u.slug}`,
          firstName: u.name.split(' ')[0],
          lastName: u.name.split(' ').slice(1).join(' ') || u.name,
          name: u.name,
          username: `hist_${u.slug}`,
          email: u.email,
          emailVerified: false,
          ageConfirmed: true,
          role: 'CITIZEN',
          country: 'GB',
          isHistoricalAccount: true,
          referralCode: `hist-${u.slug}`.slice(0, 64),
        },
      })
      userIdMap.set(u.slug, user.id)
      userUpserted++
      console.log(`  ✓ User: ${u.name} (${user.id})`)
    } catch (err) {
      console.error(`  ✗ User ${u.slug} failed:`, err)
    }
  }

  // shelter_england_2 → same id as shelter_england
  const shelterEnglandId = userIdMap.get('shelter_england')
  if (shelterEnglandId) {
    userIdMap.set('shelter_england_2', shelterEnglandId)
  }

  // Upsert ideas
  for (const idea of IDEAS) {
    try {
      const creatorId = userIdMap.get(idea.creatorSlug)
      if (!creatorId) {
        console.error(`  ✗ Idea "${idea.title}" — creator slug "${idea.creatorSlug}" not found in user map`)
        continue
      }

      const existing = await prisma.idea.findFirst({
        where: { title: idea.title, creatorId },
        select: { id: true },
      })

      let record
      if (existing) {
        record = await prisma.idea.update({
          where: { id: existing.id },
          data: {
            summaryDescription: idea.summaryDescription,
            summaryDiagnosis: idea.summaryDiagnosis,
            summaryGuidingPolicy: idea.summaryGuidingPolicy,
            summaryCoherentActions: idea.summaryCoherentActions,
            govtArea: idea.govtArea,
            ideaOrigin: 'HISTORICAL_EXAMPLE',
            bannerColour: '#F97316',
            status: 'ACTIVE',
            stage: 'STAGE_3',
            visibility: 'LINK_ONLY',
            ideaType: 'LEGISLATION',
          },
          select: { id: true, title: true },
        })
      } else {
        record = await prisma.idea.create({
          data: {
            creatorId,
            title: idea.title,
            summaryDescription: idea.summaryDescription,
            summaryDiagnosis: idea.summaryDiagnosis,
            summaryGuidingPolicy: idea.summaryGuidingPolicy,
            summaryCoherentActions: idea.summaryCoherentActions,
            govtArea: idea.govtArea,
            ideaOrigin: 'HISTORICAL_EXAMPLE',
            bannerColour: '#F97316',
            status: 'ACTIVE',
            stage: 'STAGE_3',
            visibility: 'LINK_ONLY',
            ideaType: 'LEGISLATION',
          },
          select: { id: true, title: true },
        })
      }

      ideaUpserted++
      console.log(`  ✓ Idea: "${record.title}" (${record.id})`)
    } catch (err) {
      console.error(`  ✗ Idea "${idea.title}" failed:`, err)
    }
  }

  console.log(`\nDone. ${userUpserted} User records created/updated, ${ideaUpserted} Idea records created/updated.`)
}

main()
  .catch(err => { console.error('Fatal error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
