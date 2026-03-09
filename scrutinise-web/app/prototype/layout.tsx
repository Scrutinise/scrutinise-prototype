import { UserProvider } from '@/context/UserContext'
import UserSwitcher from '@/components/UserSwitcher'
import PrototypeBanner from '@/components/PrototypeBanner'
import Link from 'next/link'
import { MOCK_NOTIFICATIONS } from '@/lib/mockData'

const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-gray-950 text-white">
        <PrototypeBanner />
        {/* Prototype nav bar with notification bell */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-20">
          <Link href="/prototype" className="text-sm font-semibold text-white hover:text-gray-300 transition-colors">
            Scrutinise Prototype
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/prototype/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Dashboard
            </Link>
            <Link href="/prototype/groups" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Groups
            </Link>
            <Link href="/training" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Training
            </Link>
            <Link href="/prototype/settings" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Settings
            </Link>
            <Link href="/prototype/testing-guide" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Testing Guide
            </Link>
            {/* Notification bell */}
            <Link href="/prototype/notifications" className="relative flex items-center justify-center w-8 h-8 hover:bg-gray-800 rounded-lg transition-colors" title="Notifications">
              <span className="text-base">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>
        <div className="pb-20">
          {children}
        </div>
        <UserSwitcher />
      </div>
    </UserProvider>
  )
}
