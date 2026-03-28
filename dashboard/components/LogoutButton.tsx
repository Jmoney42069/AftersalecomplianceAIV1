'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:bg-white/5 hover:text-gray-100 transition-all"
    >
      <span className="text-sm">↩</span>
      Uitloggen
    </button>
  )
}
