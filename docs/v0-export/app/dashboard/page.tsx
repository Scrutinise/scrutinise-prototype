"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Bell, 
  Plus, 
  ArrowRight, 
  Settings, 
  Users, 
  BookOpen,
  LayoutDashboard,
  Menu,
  X,
  ChevronRight,
  Edit3,
  Vote,
  Rocket
} from "lucide-react"

const notifications = [
  {
    id: 1,
    icon: Edit3,
    message: "Dr James Okafor proposed an amendment to your Coherent Action on EPC ratings.",
    date: "2025-12-01",
  },
  {
    id: 2,
    icon: Vote,
    message: 'Your idea "Mandatory Energy Efficiency Ratings" received 50 new votes.',
    date: "2025-11-30",
  },
  {
    id: 3,
    icon: Rocket,
    message: 'Your idea "Mandatory Energy Efficiency Ratings" is eligible to progress to Campaign stage.',
    date: "2025-11-28",
  },
]

const groups = [
  {
    name: "Housing Policy Network",
    type: "Public",
    members: 47,
  },
  {
    name: "Digital Rights Coalition",
    type: "Supporters",
    members: 128,
  },
]

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: true },
  { name: "Groups", href: "/dashboard/groups", icon: Users },
  { name: "Training", href: "/dashboard/training", icon: BookOpen },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="flex items-center justify-center p-1 lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Scrutinise
            </Link>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="relative flex items-center justify-center p-2" aria-label="Notifications">
              <Bell className="size-5 text-muted-foreground" />
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                3
              </span>
            </button>
            <div className="hidden text-sm text-muted-foreground sm:block">
              Alex Chen
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileNavOpen && (
          <nav className="border-t border-border px-4 py-3 lg:hidden">
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      item.active 
                        ? "bg-secondary font-medium text-foreground" 
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <item.icon className="size-4" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-border lg:block">
          <nav className="sticky top-[57px] p-4">
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      item.active 
                        ? "bg-secondary font-medium text-foreground" 
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <item.icon className="size-4" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-4xl">
            {/* Welcome */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Welcome back, Alex
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {"Here's what's happening with your ideas."}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="mb-6 flex flex-wrap gap-2 sm:mb-8 sm:gap-3">
              <Button size="sm" className="gap-2">
                <Plus className="size-4" />
                <span className="hidden sm:inline">New Idea</span>
                <span className="sm:hidden">New</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                Browse Ideas
                <ArrowRight className="size-3" />
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Bell className="size-4" />
                <span className="hidden sm:inline">Notifications</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  3
                </Badge>
              </Button>
            </div>

            {/* Grid Layout */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              {/* My Ideas */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-semibold sm:text-lg">My Ideas</CardTitle>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs sm:text-sm">
                    <Plus className="size-3 sm:size-4" />
                    New Idea
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-800">
                            Develop
                          </Badge>
                        </div>
                        <h3 className="mt-2 font-medium leading-snug text-sm sm:text-base">
                          Mandatory Energy Efficiency Ratings Before Property Sale
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                          <span className="text-green-600 font-medium">847 FOR</span>
                          <span className="text-red-600 font-medium">203 AGAINST</span>
                          <span>91 UNDECIDED</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Passion: 3.8
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0 gap-1">
                        View
                        <ChevronRight className="size-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Following / Watching */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold sm:text-lg">Following / Watching</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ideas you're watching will appear here.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1">
                    Browse Ideas
                    <ArrowRight className="size-3" />
                  </Button>
                </CardContent>
              </Card>

              {/* Groups */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-semibold sm:text-lg">Groups</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                    Manage
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {groups.map((group) => (
                      <div
                        key={group.name}
                        className="flex items-center justify-between rounded-md border border-border p-2.5 sm:p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.type} · {group.members} members
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2">
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold sm:text-lg">Notifications</CardTitle>
                    <Badge variant="secondary" className="text-xs">3 unread</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                    View all
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-start gap-3 rounded-md border border-border p-2.5 sm:p-3"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                          <notification.icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug">{notification.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{notification.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
