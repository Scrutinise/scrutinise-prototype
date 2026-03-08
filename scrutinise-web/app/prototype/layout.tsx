import { UserProvider } from '@/context/UserContext'
import UserSwitcher from '@/components/UserSwitcher'
import PrototypeBanner from '@/components/PrototypeBanner'

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-gray-950 text-white">
        <PrototypeBanner />
        <div className="pb-20">
          {children}
        </div>
        <UserSwitcher />
      </div>
    </UserProvider>
  )
}
