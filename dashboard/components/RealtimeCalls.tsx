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

function tsToDate(ts: string): Date | null {
  if (!ts || ts.length < 8) return null
  try {
    return new Date(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}`)
  } catch { return null }
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
      display: 'inline-block', padding: '2px 10px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {level ?? '—'}
    </span>
  )
}

function LiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: '#16a34a',
        display: 'inline-block', animation: 'pulse 2s infinite',
      }} />
      Live
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </span>
  )
}

function StatCard({ label, value, sub, accent, bar }: {
  label: string; value: string | number; sub?: string; accent?: string; bar?: number
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '16px 20px 12px', borderTop: accent ? `3px solid ${accent}` : undefined,
      position: 'relative', overflow: 'hidden',
    }}>
      <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{sub}</p>}
      {bar !== undefined && bar >= 0 && (
        <div style={{ marginTop: 10, height: 3, background: '#f3f4f6', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${Math.min(bar, 100)}%`, background: accent ?? '#6366f1', borderRadius: 2, transition: 'width .4s' }} />
        </div>
      )}
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
    ((c as any).compliance_report?.samenvatting ?? c.summary ?? '').replace(/"/g, '""'),
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `voltera_gesprekken_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type SortKey = 'timestamp' | 'duration' | 'agent_id' | 'risk_level'
type SortDir = 'asc' | 'desc'

const RISK_ORDER: Record<string, number> = { AFGEKEURD: 0, RISICO: 1, GOEDGEKEURD: 2 }
const PAGE_SIZE = 50

export default function RealtimeCalls({ initial, filterRisk }: { initial: Call[]; filterRisk?: string }) {
  const [calls, setCalls] = useState<Call[]>(initial)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all')
  const [agentFilter, setAgentFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

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

  // Unique agents for quick-filter
  const agents = useMemo(() => {
    const set = new Set(calls.map(c => (c as any).agent_id).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [calls])

  const filtered = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7)

    let result = calls.filter(c => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        ((c as any).agent_id ?? '').toLowerCase().includes(q) ||
        ((c as any).compliance_report?.samenvatting ?? c.summary ?? '').toLowerCase().includes(q) ||
        (c.risk_level ?? '').toLowerCase().includes(q)

      const matchAgent = !agentFilter || (c as any).agent_id === agentFilter

      const d = tsToDate(c.timestamp)
      const matchDate = dateFilter === 'all' ? true
        : dateFilter === 'today' ? (d !== null && d >= todayStart)
        : (d !== null && d >= weekStart)

      return matchSearch && matchAgent && matchDate
    })

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'timestamp') cmp = (a.timestamp ?? '').localeCompare(b.timestamp ?? '')
      else if (sortKey === 'duration') cmp = (a.duration ?? 0) - (b.duration ?? 0)
      else if (sortKey === 'agent_id') cmp = ((a as any).agent_id ?? '').localeCompare((b as any).agent_id ?? '')
      else if (sortKey === 'risk_level') cmp = (RISK_ORDER[a.risk_level ?? ''] ?? 9) - (RISK_ORDER[b.risk_level ?? ''] ?? 9)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [calls, search, agentFilter, dateFilter, sortKey, sortDir])

  const todayCount = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return calls.filter(c => { const d = tsToDate(c.timestamp); return d !== null && d >= start }).length
  }, [calls])

  const total = filtered.length
  const goedgekeurd = filtered.filter(c => c.risk_level === 'GOEDGEKEURD').length
  const afgekeurd   = filtered.filter(c => c.risk_level === 'AFGEKEURD').length
  const risico      = filtered.filter(c => c.risk_level === 'RISICO').length
  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'
  const pctNum = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }

  const SortArrow = ({ k }: { k: SortKey }) => (
    <span style={{ marginLeft: 4, color: sortKey === k ? '#6366f1' : '#d1d5db', fontSize: 10 }}>
      {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = filtered.length > page * PAGE_SIZE

  const rowBg: Record<string, string> = {
    GOEDGEKEURD: '#f0fdf4',
    RISICO:      '#fff7ed',
    AFGEKEURD:   '#fff1f2',
  }

  return (
    <>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Vandaag" value={todayCount} sub="gesprekken vandaag" accent="#6366f1" />
        <StatCard label="Goedgekeurd" value={pct(goedgekeurd)} sub={`${goedgekeurd} gesprekken`} accent="#16a34a" bar={pctNum(goedgekeurd)} />
        <StatCard label="Risico" value={pct(risico)} sub={`${risico} gesprekken`} accent="#c2410c" bar={pctNum(risico)} />
        <StatCard label="Afgekeurd" value={pct(afgekeurd)} sub={`${afgekeurd} gesprekken`} accent="#b91c1c" bar={pctNum(afgekeurd)} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Zoek op agent, oordeel, samenvatting..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{
            flex: 1, minWidth: 220, padding: '8px 12px', fontSize: 13,
            border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none',
            background: '#fff', color: '#111827',
          }}
        />
        {agents.length > 1 && (
          <select
            value={agentFilter}
            onChange={e => { setAgentFilter(e.target.value); setPage(1) }}
            style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' }}
          >
            <option value="">Alle agents</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value as 'all' | 'today' | 'week'); setPage(1) }}
          style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' }}
        >
          <option value="all">Alle datums</option>
          <option value="today">Vandaag</option>
          <option value="week">Afgelopen 7 dagen</option>
        </select>
        <button
          onClick={() => exportCSV(filtered)}
          style={{ padding: '8px 14px', fontSize: 13, fontWeight: 500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}
        >
          ↓ CSV
        </button>
        <LiveDot />
      </div>

      {/* Count */}
      {total > 0 && (
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
          {total} gesprek{total !== 1 ? 'ken' : ''} weergegeven
          {(search || agentFilter || dateFilter !== 'all') && ` — filter actief`}
        </p>
      )}

      {/* Table */}
      {total === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 15, fontWeight: 500, color: '#6b7280', margin: '0 0 4px' }}>Geen gesprekken gevonden</p>
          <p style={{ fontSize: 13, margin: 0 }}>Pas de filters aan of wacht op nieuwe opnames</p>
        </div>
      ) : (
        <>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  {([
                    { key: 'timestamp', label: 'Datum & Tijd' },
                    { key: 'duration',  label: 'Duur' },
                    { key: 'agent_id',  label: 'Agent' },
                    { key: 'risk_level',label: 'Oordeel' },
                  ] as { key: SortKey; label: string }[]).map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        textAlign: 'left', padding: '10px 16px', fontSize: 11,
                        fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
                        letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}<SortArrow k={col.key} />
                    </th>
                  ))}
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Samenvatting</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {paginated.map((call, i) => {
                  const bg = hoveredRow === call.id
                    ? '#f0f9ff'
                    : (rowBg[call.risk_level ?? ''] ?? '#fff')
                  return (
                    <tr
                      key={call.id}
                      onMouseEnter={() => setHoveredRow(call.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        borderBottom: i < paginated.length - 1 ? '1px solid #f3f4f6' : undefined,
                        background: bg, transition: 'background .1s',
                      }}
                    >
                      <td style={{ padding: '10px 16px', color: '#374151', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatTimestamp(call.timestamp)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {formatDuration(call.duration)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#374151', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => { setAgentFilter(a => a === (call as any).agent_id ? '' : (call as any).agent_id ?? ''); setPage(1) }}
                          style={{
                            background: agentFilter === (call as any).agent_id ? '#e0e7ff' : 'transparent',
                            border: 'none', cursor: 'pointer', padding: '2px 6px',
                            borderRadius: 4, color: '#374151', fontSize: 13, fontFamily: 'inherit',
                          }}
                          title="Filter op deze agent"
                        >
                          {(call as any).agent_id ?? '—'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <RiskBadge level={call.risk_level} />
                      </td>
                      <td style={{ padding: '10px 16px', color: '#6b7280', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(call as any).compliance_report?.samenvatting ?? call.summary ?? '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <Link href={`/calls/${call.id}`} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          Bekijk →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '9px 24px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151',
                }}
              >
                Meer laden ({filtered.length - page * PAGE_SIZE} resterend)
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}


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
