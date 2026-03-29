'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Call } from '@/lib/supabase'

/* ── helpers ─────────────────────────────────────────────────── */
function formatTimestamp(ts: string): string {
  if (!ts || ts.length < 15) return ts ?? '—'
  const d = `${ts.slice(6,8)}-${ts.slice(4,6)}-${ts.slice(0,4)}`
  const t = `${ts.slice(9,11)}:${ts.slice(11,13)}:${ts.slice(13,15)}`
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
    return new Date(`${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}T${ts.slice(9,11)}:${ts.slice(11,13)}:${ts.slice(13,15)}`)
  } catch { return null }
}

/* ── RiskBadge ───────────────────────────────────────────────── */
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

/* ── LiveDot ─────────────────────────────────────────────────── */
function LiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
      Live
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </span>
  )
}

/* ── StatCard ────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent, trend }: {
  label: string; value: string | number; sub?: string; accent?: string
  trend?: { label: string; up: boolean | null }
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '16px 20px 14px', borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sub && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{sub}</p>}
        {trend && (
          <span style={{ fontSize: 12, fontWeight: 600, color: trend.up === null ? '#9ca3af' : trend.up ? '#16a34a' : '#dc2626' }}>
            {trend.up === true ? '▲' : trend.up === false ? '▼' : ''} {trend.label}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── CallDetailModal ─────────────────────────────────────────── */
function CallDetailModal({ call, onClose }: { call: Call; onClose: () => void }) {
  const report = (call as any).compliance_report
  type CheckItem = { label: string; passed: boolean | null }
  let checklistItems: CheckItem[] = []
  if (report?.checklist && Array.isArray(report.checklist)) {
    checklistItems = report.checklist.map((item: any) => ({
      label: typeof item === 'string' ? item : (item.label ?? item.item ?? item.punt ?? JSON.stringify(item)),
      passed: item.passed ?? item.ok ?? item.voldaan ?? null,
    }))
  } else if (report?.items && Array.isArray(report.items)) {
    checklistItems = report.items.map((item: any) => ({
      label: typeof item === 'string' ? item : (item.label ?? item.item ?? JSON.stringify(item)),
      passed: item.passed ?? item.ok ?? null,
    }))
  }
  const extraKeys = report ? Object.keys(report).filter((k: string) => !['samenvatting','checklist','items'].includes(k)) : []

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Gespreksdetail</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
              {(call as any).agent_id ?? '—'} · {formatTimestamp(call.timestamp)}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RiskBadge level={call.risk_level} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', lineHeight: 1, padding: 4 }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 2px' }}>Duur</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>{formatDuration(call.duration)}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 2px' }}>Agent</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>{(call as any).agent_id ?? '—'}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 2px' }}>Oordeel</p>
              <RiskBadge level={call.risk_level} />
            </div>
          </div>
          {(report?.samenvatting ?? call.summary) && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px', fontWeight: 600 }}>Samenvatting</p>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, margin: 0, background: '#f9fafb', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                {report?.samenvatting ?? call.summary}
              </p>
            </div>
          )}
          {checklistItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px', fontWeight: 600 }}>Checklist</p>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {checklistItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: i < checklistItems.length - 1 ? '1px solid #f3f4f6' : undefined, background: '#fff' }}>
                    <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>{item.passed === true ? '✅' : item.passed === false ? '❌' : '⬜'}</span>
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {extraKeys.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px', fontWeight: 600 }}>Rapport details</p>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
                {extraKeys.map((k: string) => (
                  <div key={k} style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{k}: </span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{typeof report[k] === 'object' ? JSON.stringify(report[k]) : String(report[k])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Link href={`/calls/${call.id}`} style={{ display: 'inline-block', padding: '9px 20px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Volledig rapport bekijken →
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ── StatsTab ────────────────────────────────────────────────── */
function StatsTab({ calls }: { calls: Call[] }) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  const todayCalls = calls.filter(c => { const d = tsToDate(c.timestamp); return d !== null && d >= todayStart })
  const yesterdayCalls = calls.filter(c => { const d = tsToDate(c.timestamp); return d !== null && d >= yesterdayStart && d < todayStart })

  const avgDuration = useMemo(() => {
    const w = calls.filter(c => c.duration && c.duration > 0)
    return w.length ? Math.round(w.reduce((s, c) => s + (c.duration ?? 0), 0) / w.length) : null
  }, [calls])

  const avgDurationToday = useMemo(() => {
    const w = todayCalls.filter(c => c.duration && c.duration > 0)
    return w.length ? Math.round(w.reduce((s, c) => s + (c.duration ?? 0), 0) / w.length) : null
  }, [todayCalls])

  const agentAfgekeurd = useMemo(() => {
    const counts: Record<string, number> = {}
    calls.filter(c => c.risk_level === 'AFGEKEURD').forEach(c => {
      const a = (c as any).agent_id ?? 'Onbekend'
      counts[a] = (counts[a] ?? 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [calls])
  const maxAfgekeurd = agentAfgekeurd[0]?.[1] ?? 1

  const agentGoedgekeurd = useMemo(() => {
    const counts: Record<string, number> = {}
    calls.filter(c => c.risk_level === 'GOEDGEKEURD').forEach(c => {
      const a = (c as any).agent_id ?? 'Onbekend'
      counts[a] = (counts[a] ?? 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [calls])
  const maxGoedgekeurd = agentGoedgekeurd[0]?.[1] ?? 1

  const weeklyData = useMemo(() => {
    return [3, 2, 1, 0].map(w => {
      const start = new Date(todayStart); start.setDate(start.getDate() - (w + 1) * 7)
      const end   = new Date(todayStart); end.setDate(end.getDate() - w * 7)
      const wc = calls.filter(c => { const d = tsToDate(c.timestamp); return d !== null && d >= start && d < end })
      const label = `${start.getDate().toString().padStart(2,'0')}/${(start.getMonth()+1).toString().padStart(2,'0')}`
      return {
        label,
        goedgekeurd: wc.filter(c => c.risk_level === 'GOEDGEKEURD').length,
        afgekeurd:   wc.filter(c => c.risk_level === 'AFGEKEURD').length,
        risico:      wc.filter(c => c.risk_level === 'RISICO').length,
        total: wc.length,
      }
    })
  }, [calls])
  const maxWeekTotal = Math.max(...weeklyData.map(w => w.total), 1)

  const todayDelta = todayCalls.length - yesterdayCalls.length
  const todayTrend = { label: `${Math.abs(todayDelta)} vs gisteren`, up: todayDelta > 0 ? true : todayDelta < 0 ? false : (null as null) }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Gem. gespreksduur (totaal)" value={avgDuration !== null ? formatDuration(avgDuration) : '—'} sub={`over ${calls.length} gesprekken`} accent="#6366f1" />
        <StatCard label="Gesprekken vandaag" value={todayCalls.length} sub={`gisteren: ${yesterdayCalls.length}`} accent="#0ea5e9" trend={todayTrend} />
        <StatCard label="Gem. duur vandaag" value={avgDurationToday !== null ? formatDuration(avgDurationToday) : '—'} sub={todayCalls.length > 0 ? `${todayCalls.length} gesprekken` : 'geen gesprekken vandaag'} accent="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Meest afgekeurd per agent</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>Ranking op basis van alle gesprekken</p>
          {agentAfgekeurd.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>Geen afgekeurde gesprekken</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agentAfgekeurd.map(([agent, count], i) => (
                <div key={agent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? '🔴 ' : ''}{agent}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(count / maxAfgekeurd) * 100}%`, background: i === 0 ? '#b91c1c' : '#fca5a5', borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Beste agents (goedgekeurd)</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>Aantal GOEDGEKEURD gesprekken</p>
          {agentGoedgekeurd.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>Geen goedgekeurde gesprekken</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agentGoedgekeurd.map(([agent, count], i) => (
                <div key={agent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? '🏆 ' : ''}{agent}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(count / maxGoedgekeurd) * 100}%`, background: i === 0 ? '#16a34a' : '#86efac', borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Gesprekken per week</p>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>Afgelopen 4 weken — gestapeld per oordeel</p>
        <div style={{ display: 'flex', gap: 16, height: 160, alignItems: 'flex-end', marginBottom: 12 }}>
          {weeklyData.map((week, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>{week.total || ''}</span>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column-reverse', height: 120, justifyContent: 'flex-start', gap: 1 }}>
                {week.total === 0
                  ? <div style={{ width: '100%', flex: 1, background: '#f3f4f6', borderRadius: 2 }} />
                  : <>
                      <div style={{ width: '100%', height: `${(week.goedgekeurd / maxWeekTotal) * 100}%`, minHeight: week.goedgekeurd > 0 ? 4 : 0, background: '#86efac', borderRadius: '0 0 2px 2px' }} />
                      <div style={{ width: '100%', height: `${(week.risico / maxWeekTotal) * 100}%`, minHeight: week.risico > 0 ? 4 : 0, background: '#fdba74' }} />
                      <div style={{ width: '100%', height: `${(week.afgekeurd / maxWeekTotal) * 100}%`, minHeight: week.afgekeurd > 0 ? 4 : 0, background: '#fca5a5', borderRadius: '2px 2px 0 0' }} />
                    </>
                }
              </div>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{week.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#86efac', borderRadius: 2, display: 'inline-block' }} /> Goedgekeurd</span>
          <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#fdba74', borderRadius: 2, display: 'inline-block' }} /> Risico</span>
          <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#fca5a5', borderRadius: 2, display: 'inline-block' }} /> Afgekeurd</span>
        </div>
      </div>
    </div>
  )
}

/* ── CSV export ──────────────────────────────────────────────── */
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
  a.download = `voltera_gesprekken_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Types / constants ───────────────────────────────────────── */
type SortKey = 'timestamp' | 'duration' | 'agent_id' | 'risk_level'
type SortDir = 'asc' | 'desc'
const RISK_ORDER: Record<string, number> = { AFGEKEURD: 0, RISICO: 1, GOEDGEKEURD: 2 }
const PAGE_SIZE = 50

/* ── Main component ──────────────────────────────────────────── */
export default function RealtimeCalls({ initial, filterRisk }: { initial: Call[]; filterRisk?: string }) {
  const [calls, setCalls] = useState<Call[]>(initial)
  const [activeTab, setActiveTab] = useState<'gesprekken' | 'statistieken'>('gesprekken')
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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

  const agents = useMemo(() => {
    const set = new Set(calls.map(c => (c as any).agent_id).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [calls])

  const filtered = useMemo(() => {
    let result = calls.filter(c => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        ((c as any).agent_id ?? '').toLowerCase().includes(q) ||
        ((c as any).compliance_report?.samenvatting ?? c.summary ?? '').toLowerCase().includes(q) ||
        (c.risk_level ?? '').toLowerCase().includes(q)
      const matchAgent = !agentFilter || (c as any).agent_id === agentFilter
      const d = tsToDate(c.timestamp)
      const matchFrom = !dateFrom || (d !== null && d >= new Date(dateFrom + 'T00:00:00'))
      const matchTo   = !dateTo   || (d !== null && d <= new Date(dateTo   + 'T23:59:59'))
      return matchSearch && matchAgent && matchFrom && matchTo
    })
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'timestamp')  cmp = (a.timestamp ?? '').localeCompare(b.timestamp ?? '')
      else if (sortKey === 'duration')   cmp = (a.duration ?? 0) - (b.duration ?? 0)
      else if (sortKey === 'agent_id')   cmp = ((a as any).agent_id ?? '').localeCompare((b as any).agent_id ?? '')
      else if (sortKey === 'risk_level') cmp = (RISK_ORDER[a.risk_level ?? ''] ?? 9) - (RISK_ORDER[b.risk_level ?? ''] ?? 9)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [calls, search, agentFilter, dateFrom, dateTo, sortKey, sortDir])

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayCount = calls.filter(c => { const d = tsToDate(c.timestamp); return d !== null && d >= todayStart }).length

  const total       = filtered.length
  const goedgekeurd = filtered.filter(c => c.risk_level === 'GOEDGEKEURD').length
  const afgekeurd   = filtered.filter(c => c.risk_level === 'AFGEKEURD').length
  const risico      = filtered.filter(c => c.risk_level === 'RISICO').length
  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'

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
  const hasMore   = filtered.length > page * PAGE_SIZE

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: active ? '#fff' : 'transparent',
    border: '1px solid',
    borderColor: active ? '#e5e7eb #e5e7eb #fff' : 'transparent',
    borderRadius: '8px 8px 0 0',
    color: active ? '#111827' : '#6b7280',
    marginBottom: -1, position: 'relative', zIndex: active ? 1 : 0,
    outline: 'none',
  })

  return (
    <>
      {/* KPI summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Vandaag" value={todayCount} sub="gesprekken" accent="#6366f1" />
        <StatCard label="Goedgekeurd" value={pct(goedgekeurd)} sub={`${goedgekeurd} van ${total}`} accent="#16a34a" />
        <StatCard label="Risico"       value={pct(risico)}      sub={`${risico} van ${total}`}      accent="#c2410c" />
        <StatCard label="Afgekeurd"    value={pct(afgekeurd)}   sub={`${afgekeurd} van ${total}`}   accent="#b91c1c" />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 0 }}>
        <button style={tabStyle(activeTab === 'gesprekken')}   onClick={() => setActiveTab('gesprekken')}>Gesprekken</button>
        <button style={tabStyle(activeTab === 'statistieken')} onClick={() => setActiveTab('statistieken')}>Statistieken</button>
      </div>

      <div style={{ paddingTop: 20 }}>
        {activeTab === 'statistieken' ? (
          <StatsTab calls={calls} />
        ) : (
          <>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Zoek op agent, oordeel, samenvatting..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                style={{ flex: 1, minWidth: 220, padding: '8px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none', background: '#fff', color: '#111827' }}
              />
              {agents.length > 1 && (
                <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setPage(1) }}
                  style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' }}>
                  <option value="">Alle agents</option>
                  {agents.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Van</label>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                  style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Tot</label>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
                  style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' }} />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
                  style={{ padding: '8px 10px', fontSize: 12, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', color: '#6b7280' }}>
                  Wis datums
                </button>
              )}
              <button onClick={() => exportCSV(filtered)}
                style={{ padding: '8px 14px', fontSize: 13, fontWeight: 500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}>
                ↓ CSV
              </button>
              <LiveDot />
            </div>

            {total > 0 && (
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
                {total} gesprek{total !== 1 ? 'ken' : ''}
                {(search || agentFilter || dateFrom || dateTo) && ' — filter actief'}
              </p>
            )}

            {total === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📥</div>
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
                          { key: 'risk_level', label: 'Oordeel' },
                        ] as { key: SortKey; label: string }[]).map(col => (
                          <th key={col.key} onClick={() => handleSort(col.key)}
                            style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                            {col.label}<SortArrow k={col.key} />
                          </th>
                        ))}
                        <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Samenvatting</th>
                        <th style={{ width: 80 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((call, i) => {
                        const bg = hoveredRow === call.id ? '#f0f9ff' : '#fff'
                        return (
                          <tr
                            key={call.id}
                            onMouseEnter={() => setHoveredRow(call.id)}
                            onMouseLeave={() => setHoveredRow(null)}
                            onClick={() => setSelectedCall(call)}
                            style={{ borderBottom: i < paginated.length - 1 ? '1px solid #f3f4f6' : undefined, background: bg, transition: 'background .1s', cursor: 'pointer' }}
                          >
                            <td style={{ padding: '10px 16px', color: '#374151', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{formatTimestamp(call.timestamp)}</td>
                            <td style={{ padding: '10px 16px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDuration(call.duration)}</td>
                            <td style={{ padding: '10px 16px', color: '#374151', whiteSpace: 'nowrap' }}>{(call as any).agent_id ?? '—'}</td>
                            <td style={{ padding: '10px 16px' }}><RiskBadge level={call.risk_level} /></td>
                            <td style={{ padding: '10px 16px', color: '#6b7280', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(call as any).compliance_report?.samenvatting ?? call.summary ?? '—'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
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
                    <button onClick={() => setPage(p => p + 1)}
                      style={{ padding: '9px 24px', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151' }}>
                      Meer laden ({filtered.length - page * PAGE_SIZE} resterend)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {selectedCall && <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />}
    </>
  )
}
