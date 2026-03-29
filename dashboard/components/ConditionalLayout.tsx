'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

const NAV = [
  { href: '/',            label: 'Overzicht',   icon: '📋' },
  { href: '/afgekeurd',   label: 'Afgekeurd',   icon: '❌' },
  { href: '/risico',      label: 'Risico',      icon: '⚠️' },
  { href: '/goedgekeurd', label: 'Goedgekeurd', icon: '✅' },
]

function useWindowWidth() {
  const [width, setWidth] = useState(1200)
  useEffect(() => {
    setWidth(window.innerWidth)
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMobile = useWindowWidth() < 768

  if (pathname === '/login') return <>{children}</>

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#f9fafb' }}>
        {/* Sticky header */}
        <header style={{
          background: '#fff', borderBottom: '1px solid #e5e7eb',
          padding: '10px 16px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Voltera</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Compliance dashboard</div>
          </div>
          <LogoutButton />
        </header>

        {/* Content — padding-bottom leaves room for bottom nav */}
        <main style={{ flex: 1, paddingBottom: 70 }}>
          {children}
        </main>

        {/* Fixed bottom nav */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e5e7eb',
          display: 'flex', zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '7px 4px', textDecoration: 'none',
                color: active ? '#2563eb' : '#6b7280',
                borderTop: `2px solid ${active ? '#2563eb' : 'transparent'}`,
              }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, marginTop: 1 }}>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    )
  }

  // ── Desktop layout (unchanged) ──────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f9fafb' }}>

      <aside style={{
        width: 220,
        flexShrink: 0,
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}>

        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Voltera</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Compliance dashboard</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: active ? 500 : 400,
                  color: active ? '#111827' : '#6b7280',
                  background: active ? '#f3f4f6' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #f3f4f6' }}>
          <LogoutButton />
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
        {children}
      </main>
    </div>
  )
}
