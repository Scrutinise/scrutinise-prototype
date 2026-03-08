'use client'

import { useState } from 'react'
import { useUser } from '@/context/UserContext'
import Link from 'next/link'

type ParliamentaryModalState = 'closed' | 'open' | 'submitted'
type ProfessionalModalState = 'closed' | 'open' | 'submitted'

export default function SettingsPage() {
  const { currentUser } = useUser()

  // Account fields
  const [displayName, setDisplayName] = useState(currentUser.name)
  const [username, setUsername] = useState(currentUser.name.toLowerCase().replace(/\s+/g, '_'))
  const [bio, setBio] = useState('')
  const [expertType, setExpertType] = useState('')
  const [politicalParty, setPoliticalParty] = useState('')

  // Parliamentary modal
  const [parliamentaryModal, setParliamentaryModal] = useState<ParliamentaryModalState>('closed')
  const [parliamentaryRole, setParliamentaryRole] = useState<'MP' | 'Lords'>('MP')
  const [constituency, setConstituency] = useState('')
  const [peerage, setPeerage] = useState('')
  const [parliamentUrl, setParliamentUrl] = useState('')

  // Professional modal
  const [professionalModal, setProfessionalModal] = useState<ProfessionalModalState>('closed')
  const [firmName, setFirmName] = useState('')
  const [credentials, setCredentials] = useState('')
  const [licenceNumber, setLicenceNumber] = useState('')

  // Notifications
  const [globalEmailToggle, setGlobalEmailToggle] = useState(true)
  const [notifToggles, setNotifToggles] = useState({
    votes: true,
    comments: true,
    amendments: true,
    endorsements: true,
    stage: true,
    moderation: false,
    messages: true,
    system: true,
  })

  // AI settings
  const [aiStyle, setAiStyle] = useState('Socratic')

  const toggleNotif = (key: keyof typeof notifToggles) => {
    setNotifToggles(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/prototype/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, privacy, and preferences.</p>
      </div>

      {/* ── Section 1: Account ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Account</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Username</label>
            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl overflow-hidden focus-within:border-revolutBlue transition-colors">
              <span className="pl-4 text-gray-600 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="flex-1 bg-transparent px-2 py-3 text-white placeholder-gray-600 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email <span className="text-gray-700">(managed by Clerk)</span></label>
            <input
              type="email"
              value="user@example.com"
              disabled
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-600 text-sm cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell others about your background and expertise..."
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Professional expertise</label>
            <input
              type="text"
              value={expertType}
              onChange={e => setExpertType(e.target.value)}
              placeholder="e.g. Housing law, Environmental policy"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Political party <span className="text-gray-700">(optional)</span></label>
            <input
              type="text"
              value={politicalParty}
              onChange={e => setPoliticalParty(e.target.value)}
              placeholder="e.g. Conservative, Labour, Liberal Democrat"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
            />
          </div>
        </div>
        <button className="mt-4 px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">
          Save changes
        </button>
      </section>

      <div className="border-t border-gray-800 mb-8" />

      {/* ── Section 2: Status Claims ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Status Claims</h2>
        <p className="text-xs text-gray-500 mb-4">
          Verified status unlocks additional capabilities on the platform. Claims are reviewed by the Scrutinise team within 3 working days.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setParliamentaryModal('open')}
            className="px-4 py-2.5 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors"
          >
            Claim Parliamentary Status
          </button>
          <button
            onClick={() => setProfessionalModal('open')}
            className="px-4 py-2.5 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors"
          >
            Claim Professional Status
          </button>
        </div>

        {/* Parliamentary modal */}
        {parliamentaryModal === 'open' && (
          <div className="mt-4 bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Claim Parliamentary Status</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Role</label>
              <div className="flex gap-3">
                {(['MP', 'Lords'] as const).map(r => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={parliamentaryRole === r}
                      onChange={() => setParliamentaryRole(r)}
                      className="accent-revolutBlue"
                    />
                    <span className="text-sm text-gray-300">{r === 'Lords' ? 'Member of the House of Lords' : 'MP'}</span>
                  </label>
                ))}
              </div>
            </div>
            {parliamentaryRole === 'MP' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Constituency</label>
                <input
                  type="text"
                  value={constituency}
                  onChange={e => setConstituency(e.target.value)}
                  placeholder="e.g. Bristol East"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
                />
              </div>
            )}
            {parliamentaryRole === 'Lords' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Peerage title</label>
                <input
                  type="text"
                  value={peerage}
                  onChange={e => setPeerage(e.target.value)}
                  placeholder="e.g. Lord Smith of Somewhere"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Parliament.uk profile URL</label>
              <input
                type="url"
                value={parliamentUrl}
                onChange={e => setParliamentUrl(e.target.value)}
                placeholder="https://members.parliament.uk/member/..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setParliamentaryModal('submitted')}
                className="px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Submit claim
              </button>
              <button
                onClick={() => setParliamentaryModal('closed')}
                className="px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {parliamentaryModal === 'submitted' && (
          <div className="mt-4 p-4 bg-green-900/20 border border-green-800 rounded-xl">
            <p className="text-sm text-green-400">Your claim is under review. We'll notify you when it has been verified.</p>
          </div>
        )}

        {/* Professional modal */}
        {professionalModal === 'open' && (
          <div className="mt-4 bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Claim Professional Status</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Firm or Chambers</label>
              <input
                type="text"
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                placeholder="e.g. Linklaters LLP"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Professional credentials</label>
              <input
                type="text"
                value={credentials}
                onChange={e => setCredentials(e.target.value)}
                placeholder="e.g. Parliamentary Draftsman, Bar Council member"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Licence or bar number <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={licenceNumber}
                onChange={e => setLicenceNumber(e.target.value)}
                placeholder="Optional"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-revolutBlue transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supporting document (PDF, max 5MB)</label>
              <input
                type="file"
                accept=".pdf"
                className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-600 file:text-xs file:text-gray-300 file:bg-gray-800 hover:file:bg-gray-700 file:cursor-pointer"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setProfessionalModal('submitted')}
                className="px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Submit claim
              </button>
              <button
                onClick={() => setProfessionalModal('closed')}
                className="px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {professionalModal === 'submitted' && (
          <div className="mt-4 p-4 bg-amber-900/20 border border-amber-800 rounded-xl">
            <p className="text-sm text-amber-400">Your professional status claim is pending review. We'll be in touch within 3 working days.</p>
          </div>
        )}
      </section>

      <div className="border-t border-gray-800 mb-8" />

      {/* ── Section 3: Privacy ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Privacy</h2>
        <div className="space-y-3">
          <button className="px-4 py-2.5 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors">
            Download my data
          </button>
          <div>
            <button className="px-4 py-2.5 border border-red-800 text-red-400 hover:border-red-600 hover:text-red-300 rounded-xl text-sm font-medium transition-colors">
              Delete my account
            </button>
            <p className="text-xs text-gray-600 mt-2">Permanently deletes all your ideas, votes, and contributions. This cannot be undone.</p>
          </div>
        </div>
      </section>

      <div className="border-t border-gray-800 mb-8" />

      {/* ── Section 4: Notifications ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Notifications</h2>
        <div className="space-y-4">
          {/* Global toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-700 rounded-xl">
            <div>
              <p className="text-sm text-white font-medium">Email notifications</p>
              <p className="text-xs text-gray-500 mt-0.5">Receive email alerts for the events below</p>
            </div>
            <button
              onClick={() => setGlobalEmailToggle(v => !v)}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${globalEmailToggle ? 'bg-revolutBlue' : 'bg-gray-700'}`}
            >
              <span className={`block w-4 h-4 bg-white rounded-full m-1 transition-transform ${globalEmailToggle ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          {/* Individual toggles */}
          {(Object.keys(notifToggles) as Array<keyof typeof notifToggles>).map(key => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-300 capitalize">{key.replace(/_/g, ' ')}</span>
              <button
                onClick={() => toggleNotif(key)}
                className={`w-10 h-6 rounded-full transition-colors ${notifToggles[key] && globalEmailToggle ? 'bg-revolutBlue' : 'bg-gray-700'}`}
                disabled={!globalEmailToggle}
              >
                <span className={`block w-4 h-4 bg-white rounded-full m-1 transition-transform ${notifToggles[key] && globalEmailToggle ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          ))}
        </div>
        <button className="mt-4 px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">
          Save preferences
        </button>
      </section>

      <div className="border-t border-gray-800 mb-8" />

      {/* ── Section 5: AI ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Lex AI</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Interaction style</label>
            <select
              value={aiStyle}
              onChange={e => setAiStyle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-revolutBlue transition-colors"
            >
              <option value="Socratic">Socratic (default — questions-first)</option>
              <option value="Direct">Direct — give me the answer</option>
              <option value="Collaborative">Collaborative — work through it together</option>
            </select>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white">AI credits remaining</span>
              <span className="text-sm font-semibold text-white">
                {currentUser.aiFuelRemaining.toLocaleString()} / {currentUser.aiFuelTotal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-revolutBlue h-full rounded-full"
                style={{ width: `${(currentUser.aiFuelRemaining / currentUser.aiFuelTotal) * 100}%` }}
              />
            </div>
          </div>
          <button className="px-4 py-2.5 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-xl text-sm font-medium transition-colors">
            Top up credits
          </button>
        </div>
        <button className="mt-4 px-5 py-2.5 bg-revolutBlue hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">
          Save AI preferences
        </button>
      </section>
    </main>
  )
}
