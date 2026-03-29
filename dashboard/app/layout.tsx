import type { Metadata, Viewport } from 'next'
import './globals.css'
import ConditionalLayout from '@/components/ConditionalLayout'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Voltera Compliance Dashboard',
  description: 'Naverkoopcontrole voor Voltera verkoopgesprekken',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  )
}
