'use client'

import { useState } from 'react'

interface Step {
  id: string
  description: string
}

interface Journey {
  number: number
  name: string
  entryPoint: string
  steps: Step[]
}

const JOURNEYS: Journey[] = [
  {
    number: 1,
    name: 'Create an Idea',
    entryPoint: '/prototype/create/stage1',
    steps: [
      { id: 'j1-1', description: 'Stage 1 form loads with 8 fields: Title, Idea Type, Govt Area, Summary Description, Summary Diagnosis, Summary Guiding Policy, Summary Coherent Actions, Connected Ideas' },
      { id: 'j1-2', description: 'Idea Type toggle switches between "Change a Law" / "Change How Something Works"' },
      { id: 'j1-3', description: 'Char count shows on Title (max 200) and Summary Description (max 280)' },
      { id: 'j1-4', description: '"Ready for Stage 2 →" button is disabled until Title and Summary Description are filled' },
      { id: 'j1-5', description: '"Save Draft" button is visible at all times' },
      { id: 'j1-6', description: 'Stage progress indicator shows: Create highlighted, then Draft → Develop → Campaign → Parliament' },
      { id: 'j1-7', description: '"AI guidance" notice visible in gray below form' },
      { id: 'j1-8', description: 'Stage 2 loads: Lex chat on left, summary panel on right' },
      { id: 'j1-9', description: 'Scripted Lex conversation auto-starts after 1.2s' },
      { id: 'j1-10', description: 'Fields populate in summary panel as conversation progresses' },
    ],
  },
  {
    number: 2,
    name: 'Browse and Vote',
    entryPoint: '/prototype/browse',
    steps: [
      { id: 'j2-1', description: 'Browse page loads with 3 idea cards' },
      { id: 'j2-2', description: 'Area filter dropdown works (filters cards)' },
      { id: 'j2-3', description: 'Stage filter works' },
      { id: 'j2-4', description: 'Search text filters by title' },
      { id: 'j2-5', description: 'Click idea card → idea detail loads' },
      { id: 'j2-6', description: 'Idea detail has 6 tabs: Overview, Amendments, Comments, Research, Wording, History' },
      { id: 'j2-7', description: 'VoteWidget appears (guest view) — direction buttons FOR/AGAINST/UNDECIDED visible' },
      { id: 'j2-8', description: 'Selecting direction shows strength slider with 0.5 increments' },
      { id: 'j2-9', description: 'Submit Vote shows confirmation state with updated bars' },
    ],
  },
  {
    number: 3,
    name: 'Review an Amendment',
    entryPoint: '/prototype/dashboard',
    steps: [
      { id: 'j3-1', description: 'Dashboard loads with My Ideas section' },
      { id: 'j3-2', description: 'Notification visible for amendment proposal' },
      { id: 'j3-3', description: 'Click notification → navigates to idea' },
      { id: 'j3-4', description: 'Amendments tab shows pending amendment' },
      { id: 'j3-5', description: 'DiffView shows current vs proposed wording' },
      { id: 'j3-6', description: 'Accept/Reject/Consult buttons visible (owner only)' },
    ],
  },
  {
    number: 4,
    name: 'Owner Dashboard',
    entryPoint: '/prototype/dashboard (switch to Alex Chen)',
    steps: [
      { id: 'j4-1', description: 'Switch to Alex Chen via UserSwitcher (bottom right)' },
      { id: 'j4-2', description: 'My Ideas shows EPC Ratings idea (owned by u1)' },
      { id: 'j4-3', description: 'Click idea → owner panel visible above tabs (stage gate checklist + vote analytics)' },
      { id: 'j4-4', description: 'Stage gate checklist shows mock conditions (✅ / ❌)' },
      { id: 'j4-5', description: 'Vote analytics bar chart visible with quality flags' },
      { id: 'j4-6', description: '"Broadcast to Voters" button visible' },
      { id: 'j4-7', description: 'Amendments tab shows Accept/Reject buttons on PENDING amendments' },
    ],
  },
  {
    number: 5,
    name: 'Admin Moderation',
    entryPoint: '/prototype/admin (switch to Admin or Mod Team)',
    steps: [
      { id: 'j5-1', description: 'Switch to Admin via UserSwitcher' },
      { id: 'j5-2', description: 'Admin page loads with moderation queue' },
      { id: 'j5-3', description: 'Flagged items visible with type (comment/idea/amendment)' },
      { id: 'j5-4', description: 'Content text and reporter details visible' },
      { id: 'j5-5', description: 'Action buttons visible (Dismiss/Hide/Warn)' },
    ],
  },
  {
    number: 6,
    name: 'User Profile',
    entryPoint: '/prototype/profile/[username]',
    steps: [
      { id: 'j6-1', description: 'Profile page loads with avatar, name, role badge' },
      { id: 'j6-2', description: 'Credibility Score displayed with bar' },
      { id: 'j6-3', description: 'Points breakdown shows Strategist/Thinker/Rallymaster/Teambuilder' },
      { id: 'j6-4', description: "User's ideas listed" },
      { id: 'j6-5', description: 'Follow button toggles state on click' },
    ],
  },
  {
    number: 7,
    name: 'Settings and Notifications',
    entryPoint: '/prototype/settings',
    steps: [
      { id: 'j7-1', description: 'Settings page loads with 5 sections' },
      { id: 'j7-2', description: 'Account section has display name, username (@ prefix), bio inputs' },
      { id: 'j7-3', description: '"Claim Parliamentary Status" opens modal inline' },
      { id: 'j7-4', description: 'Notifications section has toggles for 8 notification types' },
      { id: 'j7-5', description: 'AI section shows credit balance' },
      { id: 'j7-6', description: 'Notifications page loads at /prototype/notifications' },
      { id: 'j7-7', description: 'Filter tabs work (All/Votes/Amendments etc)' },
      { id: 'j7-8', description: '"Mark all as read" changes visual state' },
    ],
  },
  {
    number: 8,
    name: 'Groups',
    entryPoint: '/prototype/groups',
    steps: [
      { id: 'j8-1', description: 'Groups page shows 2 mock groups' },
      { id: 'j8-2', description: 'Owner group shows "Manage →" link' },
      { id: 'j8-3', description: 'Member group shows "View →" link' },
      { id: 'j8-4', description: 'Create Group page loads at /prototype/groups/create' },
      { id: 'j8-5', description: 'Email chip input allows adding/removing chips' },
      { id: 'j8-6', description: 'Type radio (Collaborators/Supporters/Public) works' },
      { id: 'j8-7', description: 'Group detail page loads at /prototype/groups/[id]' },
      { id: 'j8-8', description: 'Invite link copy button works' },
    ],
  },
]

interface PageInventoryRow {
  url: string
  label: string
  id: string
}

const PAGE_INVENTORY: PageInventoryRow[] = [
  { id: 'pi-1',  url: '/',                                    label: 'Homepage' },
  { id: 'pi-2',  url: '/about',                               label: 'About' },
  { id: 'pi-3',  url: '/training',                            label: 'Training resources' },
  { id: 'pi-4',  url: '/prototype',                           label: 'Dashboard' },
  { id: 'pi-5',  url: '/prototype/create/stage1',             label: 'Create Stage 1' },
  { id: 'pi-6',  url: '/prototype/create/stage2',             label: 'Create Stage 2 (Lex)' },
  { id: 'pi-7',  url: '/prototype/browse',                    label: 'Browse ideas' },
  { id: 'pi-8',  url: '/prototype/idea/idea-1',               label: 'Idea detail (use idea-1)' },
  { id: 'pi-9',  url: '/prototype/amendment/amend-1',         label: 'Amendment review' },
  { id: 'pi-10', url: '/prototype/dashboard',                 label: 'Dashboard (redirect check)' },
  { id: 'pi-11', url: '/prototype/admin',                     label: 'Admin moderation' },
  { id: 'pi-12', url: '/prototype/profile/[username]',        label: 'User profile' },
  { id: 'pi-13', url: '/prototype/settings',                  label: 'Settings' },
  { id: 'pi-14', url: '/prototype/notifications',             label: 'Notifications' },
  { id: 'pi-15', url: '/prototype/groups',                    label: 'Groups' },
  { id: 'pi-16', url: '/prototype/groups/create',             label: 'Create group' },
  { id: 'pi-17', url: '/prototype/groups/grp-1',              label: 'Group detail' },
  { id: 'pi-18', url: '/prototype/propose-amendment/idea-1',  label: 'Propose amendment' },
  { id: 'pi-19', url: '/prototype/add-research/idea-1',       label: 'Add research' },
  { id: 'pi-20', url: '/prototype/referral/idea/idea-1',      label: 'Referral idea LP' },
  { id: 'pi-21', url: '/prototype/referral/user/alex',        label: 'Referral user LP' },
  { id: 'pi-22', url: '/prototype/testing-guide',             label: 'This page' },
]

export default function TestingGuidePage() {
  // Step checkboxes: map of step ID → boolean
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({})
  // Page inventory checkboxes
  const [checkedPages, setCheckedPages] = useState<Record<string, boolean>>({})

  const toggleStep = (id: string) =>
    setCheckedSteps(prev => ({ ...prev, [id]: !prev[id] }))

  const togglePage = (id: string) =>
    setCheckedPages(prev => ({ ...prev, [id]: !prev[id] }))

  const totalSteps = JOURNEYS.reduce((sum, j) => sum + j.steps.length, 0)
  const completedSteps = Object.values(checkedSteps).filter(Boolean).length
  const totalPages = PAGE_INVENTORY.length
  const completedPages = Object.values(checkedPages).filter(Boolean).length

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="mb-10">
        <div className="inline-block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 px-3 py-1 border border-gray-700 rounded-full">
          Tester Checklist
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Prototype Testing Guide</h1>
        <p className="text-gray-400 text-sm">
          Use this checklist to verify every journey and page works correctly.
        </p>

        {/* Progress summary */}
        <div className="mt-6 flex gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Journey Steps</div>
            <div className="text-xl font-bold text-white">
              {completedSteps}
              <span className="text-gray-500 font-normal text-sm"> / {totalSteps}</span>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pages Verified</div>
            <div className="text-xl font-bold text-white">
              {completedPages}
              <span className="text-gray-500 font-normal text-sm"> / {totalPages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Journeys */}
      <div className="space-y-8 mb-12">
        {JOURNEYS.map(journey => {
          const completedInJourney = journey.steps.filter(s => checkedSteps[s.id]).length
          return (
            <div key={journey.number} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              {/* Journey header */}
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Journey {journey.number}: {journey.name}
                  </h2>
                  <p className="text-xs text-gray-600 mt-0.5 font-mono">{journey.entryPoint}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-4 mt-1">
                  {completedInJourney}/{journey.steps.length}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-800 rounded-full h-1 mt-3 mb-4">
                <div
                  className="bg-revolutBlue h-1 rounded-full transition-all"
                  style={{ width: `${journey.steps.length ? (completedInJourney / journey.steps.length) * 100 : 0}%` }}
                />
              </div>

              {/* Steps */}
              <ol className="space-y-2">
                {journey.steps.map((step, idx) => (
                  <li key={step.id}>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={!!checkedSteps[step.id]}
                          onChange={() => toggleStep(step.id)}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            checkedSteps[step.id]
                              ? 'bg-revolutBlue border-revolutBlue'
                              : 'border-gray-600 group-hover:border-gray-400'
                          }`}
                        >
                          {checkedSteps[step.id] && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-sm leading-snug ${
                          checkedSteps[step.id] ? 'line-through text-gray-600' : 'text-gray-300'
                        }`}
                      >
                        <span className="text-gray-600 mr-1">{idx + 1}.</span>
                        {step.description}
                      </span>
                    </label>
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
      </div>

      {/* Page Inventory */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Page Inventory</h2>
          <span className="text-xs text-gray-500">{completedPages}/{totalPages} verified</span>
        </div>
        <p className="text-xs text-gray-600 mb-5">
          Tick each page once you have confirmed it loads without errors.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-600 uppercase tracking-wider border-b border-gray-800">
                <th className="text-left pb-2 w-8"></th>
                <th className="text-left pb-2">URL</th>
                <th className="text-left pb-2">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {PAGE_INVENTORY.map(row => (
                <tr key={row.id} className="group">
                  <td className="py-2.5 pr-3">
                    <label className="cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!checkedPages[row.id]}
                        onChange={() => togglePage(row.id)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          checkedPages[row.id]
                            ? 'bg-green-600 border-green-600'
                            : 'border-gray-600 group-hover:border-gray-400'
                        }`}
                      >
                        {checkedPages[row.id] && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </label>
                  </td>
                  <td className={`py-2.5 pr-4 font-mono text-xs ${checkedPages[row.id] ? 'text-gray-600 line-through' : 'text-gray-400'}`}>
                    {row.url}
                  </td>
                  <td className={`py-2.5 text-xs ${checkedPages[row.id] ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                    {row.label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </main>
  )
}
