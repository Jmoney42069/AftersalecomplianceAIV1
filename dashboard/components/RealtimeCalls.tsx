'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, type Call } from '@/lib/supabase'

function formatTimestamp(ts: string): string {
  if (!ts || ts.length < 15) return ts ?? '—'
  const d = `${ts.slice(6, 8)}-${ts.slice(4, 6)}-${ts.slice(0, 4)}`
  const t = `${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}`
  return `${d} ${t}`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function RiskBadge({ level }: { level: string | null }) {
  const styles: Record<string, string> = {
    GOEDGEKEURD: 'bg-green-100 text-green-700',
    RISICO: 'bg-orange-100 text-orange-700',
    AFGEKEURD: 'bg-red-100 text-red-700',
  }
  const cls = styles[level ?? ''] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {level ?? '—'}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function RealtimeCalls({ initial }: { initial: Call[] }) {
  const [calls, setCalls] = useState<Call[]>(initial)

  useEffect(() => {
    // Initial fetch to make sure we're fully up to date
    supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setCalls(data as Call[]) })

    // Subscribe to all changes on the calls table
    const channel = supabase
      .channel('calls-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls' },
        () => {
          // Re-fetch on any change
          supabase
            .from('calls')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setCalls(data as Call[]) })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const total = calls.length
  const goedgekeurd = calls.filter(c => c.risk_level === 'GOEDGEKEURD').length
  const afgekeurd = calls.filter(c => c.risk_level === 'AFGEKEURD').length
  const risico = calls.filter(c => c.risk_level === 'RISICO').length
  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'

  return (
    <>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Totaal gesprekken" value={total} />
        <StatCard label="Goedgekeurd" value={pct(goedgekeurd)} sub={`${goedgekeurd} gesprekken`} />
        <StatCard label="Risico" value={pct(risico)} sub={`${risico} gesprekken`} />
        <StatCard label="Afgekeurd" value={pct(afgekeurd)} sub={`${afgekeurd} gesprekken`} />
      </div>

      {/* Table */}
      {total === 0 ? (
        <p className="text-gray-400 text-sm">Nog geen gesprekken opgeslagen.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Datum &amp; Tijd</th>
                <th className="text-left px-4 py-3 font-medium">Duur</th>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">Oordeel</th>
                <th className="text-left px-4 py-3 font-medium">Samenvatting</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-700 whitespace-nowrap font-mono text-xs">
                    {formatTimestamp(call.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDuration(call.duration)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {(call as any).agent_id ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge level={call.risk_level} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {call.summary ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/calls/${call.id}`}
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                    >
                      Bekijk →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
