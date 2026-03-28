'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
  const map: Record<string, { bg: string; color: string }> = {
    GOEDGEKEURD: { bg: '#dcfce7', color: '#16a34a' },
    RISICO:      { bg: '#ffedd5', color: '#c2410c' },
    AFGEKEURD:   { bg: '#fee2e2', color: '#b91c1c' },
  }
  const s = map[level ?? ''] ?? { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {level ?? '—'}
    </span>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '16px 20px', borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function exportCSV(calls: Call[]) {
  const headers = ['Datum & Tijd', 'Agent', 'Duur (sec)', 'Oordeel', 'Samenvatting']
  const rows = calls.map(c => [
    formatTimestamp(c.timestamp),
    (c as any).agent_id ?? '',
    c.duration ?? '',
    c.risk_level ?? '',
    (c.summary ?? '').replace(/"/g, '""'),
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `voltera_gesprekken_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Parse timestamp string "YYYYMMdd_HHmmss" to Date
function tsToDate(ts: string): Date | null {
  if (!ts || ts.length < 8) return null
  try {
    return new Date(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}`)
  } catch { return null }
}

export default function RealtimeCalls({ initial, filterRisk }: { initial: Call[]; filterRisk?: string }) {
  const [calls, setCalls] = useState<Call[]>(initial)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all')

  const fetchCalls = () => {
    let q = supabase.from('calls').select('*').order('created_at', { ascending: false })
    if (filterRisk) q = q.eq('risk_level', filterRisk)
    q.then(({ data }) => { if (data) setCalls(data as Call[]) })
  }

  useEffect(() => {
    fetchCalls()
    const channel = supabase
      .channel('calls-realtime-' + (filterRisk ?? 'all'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, fetchCalls)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRisk])

  const filtered = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7)

    return calls.filter(c => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        ((c as any).agent_id ?? '').toLowerCase().includes(q) ||
        (c.summary ?? '').toLowerCase().includes(q) ||
        (c.risk_level ?? '').toLowerCase().includes(q)

      const d = tsToDate(c.timestamp)
      const matchDate = dateFilter === 'all' ? true
        : dateFilter === 'today' ? (d !== null && d >= todayStart)
        : (d !== null && d >= weekStart)

      return matchSearch && matchDate
    })
  }, [calls, search, dateFilter])

  const total = filtered.length
  const todayCount = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return calls.filter(c => { const d = tsToDate(c.timestamp); return d !== null && d >= start }).length
  }, [calls])
  const goedgekeurd = filtered.filter(c => c.risk_level === 'GOEDGEKEURD').length
  const afgekeurd   = filtered.filter(c => c.risk_level === 'AFGEKEURD').length
  const risico      = filtered.filter(c => c.risk_level === 'RISICO').length
  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'

  return (
    <>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Vandaag" value={todayCount} sub="gesprekken vandaag" accent="#6366f1" />
        <StatCard label="Goedgekeurd" value={pct(goedgekeurd)} sub={`${goedgekeurd} gesprekken`} accent="#16a34a" />
        <StatCard label="Risico" value={pct(risico)} sub={`${risico} gesprekken`} accent="#c2410c" />
        <StatCard label="Afgekeurd" value={pct(afgekeurd)} sub={`${afgekeurd} gesprekken`} accent="#b91c1c" />
      </div>

      {/* Toolbar: search + date filter + export */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Zoek op agent, oordeel, samenvatting..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '8px 12px', fontSize: 13,
            border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none',
            background: '#fff', color: '#111827',
          }}
        />
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value as 'all' | 'today' | 'week')}
          style={{
            padding: '8px 12px', fontSize: 13, border: '1px solid #e5e7eb',
            borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer',
          }}
        >
          <option value="all">Alle datums</option>
          <option value="today">Vandaag</option>
          <option value="week">Afgelopen 7 dagen</option>
        </select>
        <button
          onClick={() => exportCSV(filtered)}
          style={{
            padding: '8px 14px', fontSize: 13, fontWeight: 500,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
            cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap',
          }}
        >
          ↓ Exporteer CSV
        </button>
      </div>

      {/* Table */}
      {total === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Geen gesprekken gevonden.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Datum & Tijd', 'Duur', 'Agent', 'Oordeel', 'Samenvatting', ''].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 16px', fontSize: 11,
                    fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((call, i) => (
                <tr key={call.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f3f4f6' : undefined }}>
                  <td style={{ padding: '10px 16px', color: '#374151', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {formatTimestamp(call.timestamp)}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {formatDuration(call.duration)}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#374151' }}>
                    {(call as any).agent_id ?? '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <RiskBadge level={call.risk_level} />
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {call.summary ?? '—'}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <Link href={`/calls/${call.id}`} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', whiteSpace: 'nowrap' }}>
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
