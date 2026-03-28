'use client'

import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 antialiased">
      {/* Dark sidebar */}
      <aside className="w-56 shrink-0 bg-gray-900 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Voltera</p>
          <h1 className="text-white font-bold text-base leading-snug">
            Compliance<br />Dashboard
          </h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <a
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white text-sm transition-colors"
          >
            <span>📋</span> Gesprekken
          </a>
        </nav>

        <div className="px-5 py-4 border-t border-gray-700 space-y-2">
          <p className="text-xs text-gray-500">Demo versie · 2026</p>
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
