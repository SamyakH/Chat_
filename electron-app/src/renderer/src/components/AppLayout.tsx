import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, Users, UserPlus, Share2, Settings, ShieldCheck } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

const NAV = [
  { to: '/chat',        Icon: MessageSquare, label: 'Chat' },
  { to: '/contacts',    Icon: Users,         label: 'Contacts' },
  { to: '/add-contact', Icon: UserPlus,      label: 'Add Contact' },
  { to: '/share',       Icon: Share2,        label: 'Share Identity' },
  { to: '/settings',    Icon: Settings,      label: 'Settings' },
]

export default function AppLayout({ children }: Props) {
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <nav className="w-14 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-1 flex-shrink-0">
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center mb-5">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>

        {NAV.map(({ to, Icon, label }) => {
          const active = pathname === to || pathname.startsWith(to + '/')
          return (
            <Link
              key={to}
              to={to}
              title={label}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                active
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/50'
                  : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
            </Link>
          )
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
    </div>
  )
}