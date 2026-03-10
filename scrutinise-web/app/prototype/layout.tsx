import { UserProvider } from '@/context/UserContext'
import UserSwitcher from '@/components/UserSwitcher'
import PrototypeBanner from '@/components/PrototypeBanner'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { MOCK_NOTIFICATIONS } from '@/lib/mockData'

const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-background text-foreground">
        <PrototypeBanner />
        {/* Prototype nav */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/prototype" className="text-sm font-semibold tracking-tight hover:text-muted-foreground transition-colors">
              Scrutinise
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/prototype" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/prototype/groups" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Groups
              </Link>
              <Link href="/training" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Training
              </Link>
              <Link href="/prototype/settings" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Settings
              </Link>
              <Link href="/prototype/testing-guide" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Testing Guide
              </Link>
              {/* Notification bell */}
              <Link
                href="/prototype/notifications"
                className="relative flex items-center justify-center p-1.5 rounded-md hover:bg-accent transition-colors"
                aria-label="Notifications"
              >
                <Bell className="size-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>
        <div className="pb-20">
          {children}
        </div>
        <UserSwitcher />
      </div>
    </UserProvider>
  )
}
