'use client'

import { useUser } from '@/context/UserContext'
import { MOCK_USERS } from '@/lib/mockData'

const roleBadgeColors: Record<string, string> = {
  citizen: 'bg-blue-600',
  mp: 'bg-purple-600',
  expert: 'bg-green-700',
  moderator: 'bg-orange-600',
  admin: 'bg-red-700',
}

export default function UserSwitcher() {
  const { currentUser, setCurrentUser } = useUser()

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl w-56">
      <div className="text-[11px] text-gray-500 mb-2 font-medium uppercase tracking-wide">
        Viewing as:
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-white text-sm truncate">{currentUser.name}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full text-white flex-shrink-0 ${roleBadgeColors[currentUser.role]}`}>
          {currentUser.role}
        </span>
      </div>
      <select
        value={currentUser.id}
        onChange={(e) => {
          const user = MOCK_USERS.find(u => u.id === e.target.value)
          if (user) setCurrentUser(user)
        }}
        className="w-full text-xs bg-gray-800 text-white border border-gray-600 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
      >
        {MOCK_USERS.map(u => (
          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
        ))}
      </select>
      <div className="text-[10px] text-gray-600 mt-2 text-center">
        Test mode — not visible in production
      </div>
    </div>
  )
}
