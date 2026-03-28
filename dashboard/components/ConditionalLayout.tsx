'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

const NAV = [
  { href: '/',         label: 'Overzicht',    icon: '📋' },
  { href: '/afgekeurd', label: 'Afgekeurd',   icon: '🔴' },
  { href: '/risico',    label: 'Risico',      icon: '🟡' },
  { href: '/goedgekeurd', label: 'Goedgekeurd', icon: '🟢' },
]

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 antialiased">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-gray-900 flex flex-col">

        {/* Logo */}
        <div className="px-6 py-6 border-b border-gray-800">
          <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest mb-1">Voltera</p>
          <h1 className="text-white font-bold text-lg leading-tight">
            Compliance<br />Dashboard
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest px-3 mb-2">Menu</p>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 space-y-3">
          <p className="text-[11px] text-gray-600">v1.0 · 2026</p>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
