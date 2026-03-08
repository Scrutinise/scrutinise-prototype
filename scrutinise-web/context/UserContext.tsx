'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { MockUser, MOCK_USERS } from '@/lib/mockData'

interface UserContextType {
  currentUser: MockUser
  setCurrentUser: (user: MockUser) => void
}

const UserContext = createContext<UserContextType>({
  currentUser: MOCK_USERS[0],
  setCurrentUser: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<MockUser>(MOCK_USERS[0])
  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
