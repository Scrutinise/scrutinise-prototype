export type Stage = 'Create' | 'Draft' | 'Develop' | 'Campaign' | 'Legislate'

export type UserRole = 'citizen' | 'mp' | 'expert' | 'moderator' | 'admin'

export interface MockUser {
  id: string
  name: string
  role: UserRole
  credibility: number
  aiFuelRemaining: number
  aiFuelTotal: number
  verified: boolean
  constituency?: string
}

export interface CoherentAction {
  id: string
  title: string
  description: string
  proposedWording: string
}

export interface Amendment {
  id: string
  ideaId: string
  proposedBy: string
  currentWording: string
  proposedWording: string
  rationale?: string
  status: 'pending' | 'accepted' | 'rejected' | 'consulting'
  createdAt: string
}

export interface Comment {
  id: string
  author: string
  text: string
  createdAt: string
  positiveFlags: string[]
  negativeFlags: string[]
  reported?: boolean
  isOwnerReply?: boolean
  stance?: 'supportive' | 'critical' | 'neutral' | 'question'
}

export interface ResearchItem {
  id: string
  title: string
  snippet: string
  relevanceExplanation: string
  sourceType: 'Academic' | 'Government' | 'News' | 'Case Study' | 'Legislation' | 'Other'
  forPolicy: boolean
  sourceUrl: string
}

export interface HistoryEvent {
  id: string
  type: string
  description: string
  date: string
}

export interface Endorsement {
  id: string
  name: string
  role: string
  constituency: string
  publicStatement: string
  endorsedAt: string
}

export interface TargetLegislation {
  title: string
  year: number
  changeType: 'AMEND' | 'REPEAL' | 'NEW_ACT'
  relevantClauses: string
  url: string
}

export interface QualityFlags {
  doesntGoFarEnough: number
  goesTooFar: number
  poorlyWorded: number
}

export interface MockIdea {
  id: string
  title: string
  summary: string
  stage: Stage
  country: 'UK' | 'Ireland'
  area: string
  voteCount: { for: number; against: number; undecided: number }
  passionScore: number
  commentCount: number
  credibilityScore: number
  ownerId: string
  createdAt: string
  coherentActions: CoherentAction[]
  amendments: Amendment[]
  comments: Comment[]
  diagnosis: string
  rootCause: string
  guidingPolicy: string
  targetLegislation: TargetLegislation | null
  endorsements: Endorsement[]
  qualityFlags: QualityFlags
  research: ResearchItem[]
  history: HistoryEvent[]
  wordingLocked: boolean
  version: number
  proposedWording: string
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'u1', name: 'Alex Chen', role: 'citizen',
    credibility: 340, aiFuelRemaining: 42000, aiFuelTotal: 60000,
    verified: true
  },
  {
    id: 'u2', name: 'Rt Hon. Sarah Mills MP', role: 'mp',
    credibility: 1240, aiFuelRemaining: 55000, aiFuelTotal: 60000,
    verified: true, constituency: 'Bristol East'
  },
  {
    id: 'u3', name: 'Dr James Okafor', role: 'expert',
    credibility: 890, aiFuelRemaining: 48000, aiFuelTotal: 60000,
    verified: true
  },
  {
    id: 'u4', name: 'Mod Team', role: 'moderator',
    credibility: 500, aiFuelRemaining: 60000, aiFuelTotal: 60000,
    verified: true
  },
  {
    id: 'u5', name: 'Admin', role: 'admin',
    credibility: 999, aiFuelRemaining: 60000, aiFuelTotal: 60000,
    verified: true
  },
]

export const MOCK_IDEAS: MockIdea[] = [
  {
    id: 'idea-1',
    title: 'Mandatory Energy Efficiency Ratings Before Property Sale',
    summary: 'Require all residential properties to achieve a minimum EPC rating of C before being listed for sale, with a grant scheme to support low-income homeowners.',
    stage: 'Develop',
    country: 'UK',
    area: 'Housing & Energy',
    voteCount: { for: 847, against: 203, undecided: 91 },
    passionScore: 3.8,
    commentCount: 34,
    credibilityScore: 78,
    ownerId: 'u1',
    createdAt: '2025-11-12',
    diagnosis: 'Over 60% of UK residential properties currently fall below EPC rating C. Occupants in these homes face energy bills 40% higher than those in efficient properties, while contributing disproportionately to national carbon emissions. The problem is concentrated in the private rental sector and older owner-occupied stock.',
    rootCause: 'The current EPC regime requires disclosure at point of sale or rental but imposes no minimum standard. Sellers and landlords have calculated — correctly — that the cost of improvement exceeds any reduction in sale price or rent achievable by upgrading. Without a mandatory floor, the market will not self-correct.',
    guidingPolicy: 'Establish a minimum energy performance standard at point of residential property sale, supported by a targeted grant scheme that removes the financial barrier for low-income households. The policy creates a forcing function without a punitive mechanism — sellers who cannot or will not improve simply cannot complete a sale.',
    coherentActions: [
      {
        id: 'ca-1',
        title: 'Amend EPC Regulations',
        description: 'Amend the Energy Performance of Buildings Regulations 2012 to require a minimum EPC rating of C for all residential properties listed for sale from January 2027.',
        proposedWording: 'In Regulation 9 of the Energy Performance of Buildings (England and Wales) Regulations 2012, after paragraph (1) insert: "(1A) No estate agent, property portal or private seller may list a residential property for sale unless the property holds a valid Energy Performance Certificate showing a rating of C or above."'
      },
      {
        id: 'ca-2',
        title: 'Establish Green Home Improvement Fund',
        description: 'Create a £500m fund providing grants of up to £10,000 to households below median income to meet the new standard.',
        proposedWording: 'The Secretary of State must, by order, establish a scheme to provide financial assistance to eligible homeowners for the purpose of improving the energy performance of their dwelling to meet the minimum standard required by Regulation 9(1A).'
      },
      {
        id: 'ca-3',
        title: 'Mandate Local Authority Reporting',
        description: 'Require local authorities to report quarterly on fund uptake and compliance rates to DESNZ.',
        proposedWording: 'Each local housing authority must, within 30 days of the end of each quarter, submit to the Secretary of State a return specifying the number of grants awarded, total expenditure, and the number of properties brought into compliance in its area.'
      }
    ],
    targetLegislation: {
      title: 'Energy Performance of Buildings (England and Wales) Regulations 2012',
      year: 2012,
      changeType: 'AMEND',
      relevantClauses: 'Regulation 9 (duty to provide energy performance certificate), Regulation 5 (definitions)',
      url: 'https://www.legislation.gov.uk/uksi/2012/3118/contents'
    },
    endorsements: [
      {
        id: 'end-1',
        name: 'Rt Hon. Sarah Mills MP',
        role: 'Member of Parliament',
        constituency: 'Bristol East',
        publicStatement: 'This proposal addresses a genuine market failure. The EPC disclosure regime has existed for over a decade and produced no meaningful improvement in stock quality. A mandatory standard at point of sale is long overdue.',
        endorsedAt: '2025-12-15'
      }
    ],
    qualityFlags: { doesntGoFarEnough: 47, goesTooFar: 23, poorlyWorded: 8 },
    research: [
      {
        id: 'res-1',
        title: 'Dutch Mandatory EPC Standards: Market Impact Assessment 2021-2023',
        snippet: 'A study of the Dutch social housing sector found that mandatory EPC standards led to a 34% reduction in average energy consumption within 18 months, with no significant market contraction.',
        relevanceExplanation: 'The Netherlands implemented comparable mandatory EPC standards in 2020. This study provides direct evidence of market behaviour during the transition period.',
        sourceType: 'Academic',
        forPolicy: true,
        sourceUrl: 'https://www.government.nl/topics/energy-saving/energy-performance-of-buildings'
      },
      {
        id: 'res-2',
        title: 'UK EPC Distribution by Tenure: MHCLG 2024',
        snippet: 'As of 2024, 63% of private rented homes and 71% of owner-occupied pre-1970 stock falls below EPC C. The gap between tenure types has widened since 2019.',
        relevanceExplanation: 'Official government data confirming the scale of the problem and identifying the private rented sector as the primary area of non-compliance.',
        sourceType: 'Government',
        forPolicy: true,
        sourceUrl: 'https://www.gov.uk/government/statistics/english-housing-survey-2023-to-2024-headline-report'
      }
    ],
    history: [
      { id: 'h1', type: 'created', description: 'Idea created by Alex Chen', date: '2025-11-12' },
      { id: 'h2', type: 'stage_change', description: 'Stage changed: Create → Draft', date: '2025-11-18' },
      { id: 'h3', type: 'stage_change', description: 'Stage changed: Draft → Develop', date: '2025-11-28' },
      { id: 'h4', type: 'endorsement', description: '1 parliamentary endorsement received from Rt Hon. Sarah Mills MP', date: '2025-12-15' },
      { id: 'h5', type: 'amendment', description: 'Amendment submitted by Dr James Okafor: EPC compliance deadline extended and exemption added for listed buildings', date: '2025-12-01' }
    ],
    wordingLocked: false,
    version: 3,
    proposedWording: 'A Bill to amend the Energy Performance of Buildings (England and Wales) Regulations 2012 to establish a minimum energy performance standard for residential properties at point of sale, and to provide for financial assistance to low-income homeowners in meeting that standard.',
    amendments: [
      {
        id: 'amend-1',
        ideaId: 'idea-1',
        proposedBy: 'Dr James Okafor',
        currentWording: 'require a minimum EPC rating of C for all residential properties listed for sale from January 2027',
        proposedWording: 'require a minimum EPC rating of C for all residential properties listed for sale from January 2028, with an exemption for listed buildings and properties in conservation areas where compliance is technically unfeasible',
        rationale: 'The January 2027 deadline does not allow sufficient time for the construction industry to scale up retrofit capacity. Extending to 2028 reduces market shock. The exemption for listed buildings addresses a genuine technical barrier.',
        status: 'pending',
        createdAt: '2025-12-01'
      }
    ],
    comments: [
      {
        id: 'c1', author: 'Priya S.', createdAt: '2025-11-20',
        text: 'This is badly needed. My landlord has been putting off upgrades for years because there is no legal requirement. This changes that.',
        positiveFlags: ['relevant', 'direct_experience', 'constructive'],
        negativeFlags: [],
        stance: 'supportive'
      },
      {
        id: 'c2', author: 'RogerT', createdAt: '2025-11-22',
        text: "What about rural properties where it's genuinely difficult to achieve a C rating? Blanket rules don't work.",
        positiveFlags: ['good_question', 'relevant', 'constructive'],
        negativeFlags: [],
        stance: 'question'
      },
      {
        id: 'c3', author: 'FlaggedUser99', createdAt: '2025-11-25',
        text: 'This is just another way to stop people buying homes. The whole thing is a scam.',
        positiveFlags: [],
        negativeFlags: ['ad_hominem', 'not_relevant', 'straw_man'],
        reported: true,
        stance: 'critical'
      }
    ]
  },
  {
    id: 'idea-2',
    title: 'Right to Disconnect: Legal Protection for Out-of-Hours Contact',
    summary: 'Give workers the legal right to ignore work communications outside contracted hours, with enforcement via Employment Tribunals.',
    stage: 'Draft',
    country: 'UK',
    area: 'Employment',
    voteCount: { for: 1203, against: 445, undecided: 178 },
    passionScore: 3.6,
    commentCount: 67,
    credibilityScore: 65,
    ownerId: 'u3',
    createdAt: '2025-10-03',
    diagnosis: 'UK workers receive an average of 4.8 work-related messages per day outside contracted hours. Mental health charity data shows 67% of employees feel unable to ignore out-of-hours contact for fear of career consequences. Burnout-related sick leave costs the UK economy an estimated £28bn annually.',
    rootCause: 'No legal right to disconnect exists in UK employment law. Unlike France (2017), Ireland (2021), and Belgium (2022), UK employers face no consequences for habitual out-of-hours contact. The power asymmetry between employer and employee means cultural change without legal backing is ineffective.',
    guidingPolicy: 'Insert a statutory right to disconnect into UK employment law, enforceable via Employment Tribunals with explicit anti-retaliation protections. Model the mechanism on the Irish Code of Practice, which creates a clear framework without prohibiting occasional legitimate emergency contact.',
    coherentActions: [
      {
        id: 'ca-3',
        title: 'Amend Employment Rights Act 1996',
        description: 'Insert a new Part into the Employment Rights Act 1996 establishing the right to disconnect and prohibiting retaliation.',
        proposedWording: 'After Part IVA of the Employment Rights Act 1996 insert: "Part IVB — Right to Disconnect. 43L Right to disconnect. A worker has the right not to be required or expected to perform work, or to respond to work-related communications, outside their contracted hours of work unless a genuine emergency requires it."'
      }
    ],
    targetLegislation: {
      title: 'Employment Rights Act 1996',
      year: 1996,
      changeType: 'AMEND',
      relevantClauses: 'Part IVA (protected disclosures), Part X (unfair dismissal)',
      url: 'https://www.legislation.gov.uk/ukpga/1996/18/contents'
    },
    endorsements: [],
    qualityFlags: { doesntGoFarEnough: 312, goesTooFar: 89, poorlyWorded: 34 },
    research: [
      {
        id: 'res-3',
        title: 'Right to Disconnect in Ireland: Two-Year Review (2023)',
        snippet: "Ireland's Code of Practice has been in effect since April 2021. Complaints to the WRC regarding out-of-hours contact have decreased by 23%, while awareness of the right has reached 78% of workers surveyed.",
        relevanceExplanation: 'Ireland is the most comparable jurisdiction to the UK and implemented the right to disconnect in 2021. This review provides evidence of real-world effectiveness.',
        sourceType: 'Government',
        forPolicy: true,
        sourceUrl: 'https://www.gov.ie/en/publication/ca0e0-work-life-balance/'
      }
    ],
    history: [
      { id: 'h6', type: 'created', description: 'Idea created by Dr James Okafor', date: '2025-10-03' },
      { id: 'h7', type: 'stage_change', description: 'Stage changed: Create → Draft', date: '2025-10-12' }
    ],
    wordingLocked: false,
    version: 2,
    proposedWording: 'A Bill to amend the Employment Rights Act 1996 to establish a right for workers to disconnect from work-related communications outside contracted hours, and to provide protections against retaliation for exercising that right.',
    amendments: [],
    comments: []
  },
  {
    id: 'idea-3',
    title: 'Universal Basic Digital Infrastructure',
    summary: 'Treat broadband access as a public utility — government-funded minimum 50Mbps connection guaranteed for every household.',
    stage: 'Campaign',
    country: 'UK',
    area: 'Digital & Technology',
    voteCount: { for: 3421, against: 892, undecided: 341 },
    passionScore: 4.2,
    commentCount: 112,
    credibilityScore: 88,
    ownerId: 'u2',
    createdAt: '2025-08-15',
    diagnosis: '4.2 million UK households lack access to a broadband connection of 30Mbps or above. Rural areas are disproportionately affected: 18% of rural premises cannot receive a basic 10Mbps connection. The digital divide tracks closely with income inequality and geographic disadvantage, creating compounding barriers to employment, education, and public service access.',
    rootCause: 'Commercial broadband deployment is driven by return on investment. Sparsely populated or economically deprived areas are inherently unprofitable for private providers. The Universal Service Obligation (10Mbps) is inadequate for modern requirements and enforcement is weak. Without direct government investment, the market will continue to under-serve these communities.',
    guidingPolicy: 'Treat broadband access as a public utility on the model of water and electricity. Guarantee a minimum 50Mbps connection to every UK household through a combination of direct government infrastructure investment, mandatory wholesale access requirements, and a universal service levy on profitable operators.',
    coherentActions: [
      {
        id: 'ca-4',
        title: 'Establish Universal Digital Infrastructure Fund',
        description: 'Create a £2.5bn fund to finance fibre-to-the-premises rollout to all unserved and underserved premises.',
        proposedWording: 'The Secretary of State must establish and maintain a Universal Digital Infrastructure Fund of not less than £2,500,000,000 for the purpose of financing the provision of gigabit-capable broadband connections to premises that cannot access a connection of at least 50 megabits per second download speed.'
      },
      {
        id: 'ca-5',
        title: 'Raise Universal Service Obligation',
        description: 'Amend the Communications Act 2003 to raise the Universal Service Obligation from 10Mbps to 50Mbps.',
        proposedWording: 'In section 65 of the Communications Act 2003, for "10 megabits per second" substitute "50 megabits per second".'
      }
    ],
    targetLegislation: {
      title: 'Communications Act 2003',
      year: 2003,
      changeType: 'AMEND',
      relevantClauses: 'Section 65 (universal service conditions), Section 66 (obligations of universal service providers)',
      url: 'https://www.legislation.gov.uk/ukpga/2003/21/contents'
    },
    endorsements: [
      {
        id: 'end-2',
        name: 'Rt Hon. Sarah Mills MP',
        role: 'Member of Parliament',
        constituency: 'Bristol East',
        publicStatement: "Broadband is not a luxury. Constituents in rural Bristol cannot access NHS services, apply for jobs, or support their children's education without reliable connectivity. This policy addresses a genuine infrastructure deficit.",
        endorsedAt: '2025-09-20'
      },
      {
        id: 'end-3',
        name: 'Lord Techbridge',
        role: 'Member of the House of Lords',
        constituency: 'Life Peerage',
        publicStatement: 'The economic case for universal broadband investment is well-established. The return on public infrastructure spending in this area consistently exceeds the cost of capital.',
        endorsedAt: '2025-10-01'
      }
    ],
    qualityFlags: { doesntGoFarEnough: 891, goesTooFar: 145, poorlyWorded: 67 },
    research: [
      {
        id: 'res-4',
        title: 'Economic Returns on Broadband Infrastructure Investment: UK Evidence (2019-2023)',
        snippet: 'Analysis of the UK Gigabit voucher scheme found that each £1 of public investment in rural broadband generated £2.80 in economic activity within 5 years.',
        relevanceExplanation: 'Direct evidence from UK infrastructure investment programs of the economic multiplier effect of broadband spending.',
        sourceType: 'Government',
        forPolicy: true,
        sourceUrl: 'https://www.gov.uk/government/publications/project-gigabit'
      }
    ],
    history: [
      { id: 'h8', type: 'created', description: 'Idea created by Rt Hon. Sarah Mills MP', date: '2025-08-15' },
      { id: 'h9', type: 'stage_change', description: 'Stage changed: Create → Draft', date: '2025-08-28' },
      { id: 'h10', type: 'stage_change', description: 'Stage changed: Draft → Develop', date: '2025-09-15' },
      { id: 'h11', type: 'stage_change', description: 'Stage changed: Develop → Campaign', date: '2025-10-10' },
      { id: 'h12', type: 'endorsement', description: '2 parliamentary endorsements received', date: '2025-10-01' }
    ],
    wordingLocked: true,
    version: 5,
    proposedWording: 'A Bill to amend the Communications Act 2003 to raise the universal broadband service obligation to 50 megabits per second, and to establish a Universal Digital Infrastructure Fund to finance the delivery of gigabit-capable connectivity to underserved premises.',
    amendments: [],
    comments: []
  }
]

export interface Notification {
  id: string
  type: 'amendment' | 'vote' | 'stage' | 'moderation'
  message: string
  ideaId: string
  amendmentId?: string
  createdAt: string
  read: boolean
}

export interface ModerationItem {
  id: string
  contentType: 'comment' | 'idea' | 'amendment'
  contentId: string
  content: string
  reportedBy: string
  reason: string
  ideaTitle: string
  createdAt: string
}

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'amendment',
    message: 'Dr James Okafor proposed an amendment to your Coherent Action on EPC ratings.',
    ideaId: 'idea-1',
    amendmentId: 'amend-1',
    createdAt: '2025-12-01',
    read: false
  },
  {
    id: 'n2',
    type: 'vote',
    message: 'Your idea "Mandatory Energy Efficiency Ratings" received 50 new votes.',
    ideaId: 'idea-1',
    createdAt: '2025-11-30',
    read: true
  },
  {
    id: 'n3',
    type: 'stage',
    message: 'Your idea "Mandatory Energy Efficiency Ratings" is eligible to progress to Campaign stage.',
    ideaId: 'idea-1',
    createdAt: '2025-11-28',
    read: false
  },
  {
    id: 'n4',
    type: 'moderation',
    message: 'A comment on your idea has been removed for violating community guidelines.',
    ideaId: 'idea-1',
    createdAt: '2025-11-26',
    read: true
  },
  {
    id: 'n5',
    type: 'vote',
    message: '"Right to Disconnect" has passed 1,000 votes.',
    ideaId: 'idea-2',
    createdAt: '2025-11-20',
    read: true
  },
  {
    id: 'n6',
    type: 'amendment',
    message: 'Your amendment to "Universal Basic Digital Infrastructure" has been accepted.',
    ideaId: 'idea-3',
    createdAt: '2025-10-05',
    read: true
  },
  {
    id: 'n7',
    type: 'stage',
    message: '"Universal Basic Digital Infrastructure" has entered Campaign stage.',
    ideaId: 'idea-3',
    createdAt: '2025-10-10',
    read: true
  },
  {
    id: 'n8',
    type: 'vote',
    message: 'A new comment on "Universal Basic Digital Infrastructure" mentions you.',
    ideaId: 'idea-3',
    createdAt: '2025-10-15',
    read: false
  }
]

export const MOCK_MODERATION_QUEUE: ModerationItem[] = [
  {
    id: 'report-1',
    contentType: 'comment',
    contentId: 'c3',
    content: 'This is just another way to stop people buying homes. The whole thing is a scam.',
    reportedBy: 'Priya S.',
    reason: 'Dismissive and unconstructive — does not engage with the proposal',
    ideaTitle: 'Mandatory Energy Efficiency Ratings Before Property Sale',
    createdAt: '2025-11-26'
  },
  {
    id: 'report-2',
    contentType: 'idea',
    contentId: 'idea-2',
    content: 'Right to Disconnect: Legal Protection for Out-of-Hours Contact',
    reportedBy: 'UserABC',
    reason: 'Duplicate of existing petition',
    ideaTitle: 'Right to Disconnect: Legal Protection for Out-of-Hours Contact',
    createdAt: '2025-12-03'
  }
]

export interface MockTraining {
  id: string
  title: string
  resourceType: 'VIDEO' | 'ARTICLE'
  author: string
  duration: string
  stageTag: Stage | 'All'
  topicTag: string
  difficultyTag: 'Beginner' | 'Intermediate' | 'Advanced'
  url: string
}

export const MOCK_TRAINING: MockTraining[] = [
  { id: 'tr-1', title: "How Parliament Works: A Beginner's Guide", resourceType: 'ARTICLE', author: 'UK Parliament', duration: '12:34', stageTag: 'All', topicTag: 'Parliament', difficultyTag: 'Beginner', url: 'https://www.youtube.com/watch?v=Wuk3L3tknwg&t=1s' },
  { id: 'tr-2', title: 'Writing Effective Legislative Drafts', resourceType: 'ARTICLE', author: 'Institute for Government', duration: '24:17', stageTag: 'Develop', topicTag: 'Drafting', difficultyTag: 'Intermediate', url: '/training/legislative-drafting' },
  { id: 'tr-3', title: 'Evidence-Based Policy Making', resourceType: 'ARTICLE', author: "King's College London", duration: '18:42', stageTag: 'Draft', topicTag: 'Evidence', difficultyTag: 'Intermediate', url: 'https://www.kcl.ac.uk/policy-institute/assets/what-is-the-role-of-evidence-in-the-policy-process.pdf' },
  { id: 'tr-4', title: "Parliament's Engagement with the Public", resourceType: 'ARTICLE', author: 'Hansard Society', duration: '31:05', stageTag: 'Campaign', topicTag: 'Campaigning', difficultyTag: 'Advanced', url: 'https://hansard.parliament.uk/Lords/2005-02-09/debates/5364d8bc-537e-4712-903e-0add4cd3deba/ParliamentPublicEngagement' },
  { id: 'tr-5', title: 'Understanding Parliamentary Scrutiny', resourceType: 'ARTICLE', author: 'UK Parliament', duration: '8 min read', stageTag: 'Legislate', topicTag: 'Legislate', difficultyTag: 'Beginner', url: '/training/parliamentary-scrutiny' }
]

export interface MockGroupMember {
  id: string
  name: string
  role: string
  joinedAt: string
}

export interface MockGroup {
  id: string
  name: string
  description: string
  type: 'Collaborators' | 'Supporters' | 'Public'
  ownerId: string
  memberCount: number
  myRole: 'Owner' | 'Member'
  members: MockGroupMember[]
}

export const MOCK_GROUPS: MockGroup[] = [
  {
    id: 'grp-1',
    name: 'Housing Policy Network',
    description: 'Cross-party group focused on housing legislation reform and energy efficiency standards.',
    type: 'Public',
    ownerId: 'u1',
    memberCount: 47,
    myRole: 'Owner',
    members: [
      { id: 'u1', name: 'Alex Chen', role: 'citizen', joinedAt: '2025-11-12' },
      { id: 'u2', name: 'Rt Hon. Sarah Mills MP', role: 'mp', joinedAt: '2025-11-15' },
      { id: 'u3', name: 'Dr James Okafor', role: 'expert', joinedAt: '2025-11-20' }
    ]
  },
  {
    id: 'grp-2',
    name: 'Digital Rights Coalition',
    description: 'Advocates for digital infrastructure as a public utility and the right to disconnect.',
    type: 'Supporters',
    ownerId: 'u3',
    memberCount: 128,
    myRole: 'Member',
    members: [
      { id: 'u3', name: 'Dr James Okafor', role: 'expert', joinedAt: '2025-09-01' },
      { id: 'u1', name: 'Alex Chen', role: 'citizen', joinedAt: '2025-10-05' }
    ]
  }
]
