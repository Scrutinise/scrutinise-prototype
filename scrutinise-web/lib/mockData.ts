export type Stage = 'Create' | 'Draft' | 'Develop' | 'Campaign' | 'Parliament'

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
}

export interface CoherentAction {
  id: string
  text: string
  voteFor: number
  voteAgainst: number
}

export interface Amendment {
  id: string
  ideaId: string
  proposedBy: string
  currentWording: string
  proposedWording: string
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
    coherentActions: [
      {
        id: 'ca-1',
        text: 'Amend the Energy Performance of Buildings Regulations 2012 to require a minimum EPC rating of C for all residential properties listed for sale from January 2027.',
        voteFor: 612, voteAgainst: 145
      },
      {
        id: 'ca-2',
        text: 'Establish a £500m Green Home Improvement Fund to provide grants of up to £10,000 to households below median income to meet the new standard.',
        voteFor: 798, voteAgainst: 89
      }
    ],
    amendments: [
      {
        id: 'amend-1',
        ideaId: 'idea-1',
        proposedBy: 'Dr James Okafor',
        currentWording: 'require a minimum EPC rating of C for all residential properties listed for sale from January 2027',
        proposedWording: 'require a minimum EPC rating of C for all residential properties listed for sale from January 2028, with an exemption for listed buildings and properties in conservation areas where compliance is technically unfeasible',
        status: 'pending',
        createdAt: '2025-12-01'
      }
    ],
    comments: [
      {
        id: 'c1', author: 'Priya S.', createdAt: '2025-11-20',
        text: 'This is badly needed. My landlord has been putting off upgrades for years because there is no legal requirement. This changes that.',
        positiveFlags: ['relevant', 'direct_experience', 'constructive'],
        negativeFlags: []
      },
      {
        id: 'c2', author: 'RogerT', createdAt: '2025-11-22',
        text: "What about rural properties where it's genuinely difficult to achieve a C rating? Blanket rules don't work.",
        positiveFlags: ['good_question', 'relevant', 'constructive'],
        negativeFlags: []
      },
      {
        id: 'c3', author: 'FlaggedUser99', createdAt: '2025-11-25',
        text: 'This is just another way to stop people buying homes. The whole thing is a scam.',
        positiveFlags: [],
        negativeFlags: ['ad_hominem', 'not_relevant', 'straw_man'],
        reported: true
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
    coherentActions: [
      {
        id: 'ca-3',
        text: 'Insert a new section into the Employment Rights Act 1996 establishing the right to disconnect, prohibiting employer retaliation for employees not responding to communications outside contracted hours.',
        voteFor: 980, voteAgainst: 312
      }
    ],
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
    coherentActions: [],
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
