'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

const NAV = [
  { href: '/',            label: 'Alle gesprekken' },
  { href: '/afgekeurd',   label: 'Afgekeurd'       },
  { href: '/risico',      label: 'Risico'          },
  { href: '/goedgekeurd', label: 'Goedgekeurd'     },
]

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/login') return <>{children}</>

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
