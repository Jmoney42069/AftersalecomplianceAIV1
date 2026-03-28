'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

const NAV = [
  { href: '/',            label: 'Overzicht',   icon: '▤'  },
  { href: '/afgekeurd',   label: 'Afgekeurd',   icon: '✕'  },
  { href: '/risico',      label: 'Risico',      icon: '⚠'  },
  { href: '/goedgekeurd', label: 'Goedgekeurd', icon: '✓'  },
]

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900 antialiased">

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 bg-[#0f1117] flex flex-col border-r border-white/5">

        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">V</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">Voltera</p>
            <p className="text-gray-500 text-[11px] leading-none mt-0.5">Compliance</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 pt-4 pb-2 flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-2 mb-2">
            Navigatie
          </p>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'
                }`}
              >
                <span
                  className={`w-5 h-5 flex items-center justify-center text-sm rounded ${
                    active ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {icon}
                </span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/5">
          <LogoutButton />
          <p className="text-[10px] text-gray-700 mt-2">v1.0 · 2026</p>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
