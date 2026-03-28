export default function SchaalplanPage() {
  return (
    <div style={{ padding: '32px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
        Schaalplan — Compliance Bot
      </h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
        Groeipad van intern prototype naar productieklare multi-agent oplossing
      </p>

      {/* Phases */}
      {PHASES.map((phase, i) => (
        <div key={i} style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          marginBottom: 20,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 20px',
            borderBottom: '1px solid #f3f4f6',
            background: phase.active ? '#f0fdf4' : '#ffffff',
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: phase.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}>
              {phase.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                  Fase {i + 1} — {phase.title}
                </span>
                {phase.active && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#dcfce7',
                    color: '#16a34a',
                    padding: '2px 8px',
                    borderRadius: 20,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Huidig
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{phase.subtitle}</div>
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: phase.costColor ?? '#374151',
              textAlign: 'right',
            }}>
              {phase.cost}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 20px', display: 'flex', gap: 32 }}>
            {/* Stack */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Tech stack
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {phase.stack.map((item, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                    <span style={{ color: '#9ca3af', marginTop: 1 }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Capacity */}
            <div style={{ minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Capaciteit
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {phase.capacity.map((item, j) => (
                  <li key={j} style={{ fontSize: 13, color: '#374151', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#9ca3af' }}>·</span>{item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Benodigde stappen
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {phase.actions.map((item, j) => (
                  <li key={j} style={{ fontSize: 13, color: '#374151', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: item.done ? '#16a34a' : '#d1d5db', marginTop: 1 }}>{item.done ? '✓' : '○'}</span>
                    <span style={{ color: item.done ? '#16a34a' : '#374151' }}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}

      {/* Cost table */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Kostenoverzicht per schaal</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Scenario', 'Agenten', 'Calls/dag', 'Audio/dag', 'Transcriptie', 'Server', 'Totaal/mnd'].map((h) => (
                <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COSTS.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: row.highlight ? '#f0fdf4' : '#ffffff' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#111827' }}>{row.scenario}</td>
                <td style={{ padding: '10px 16px', color: '#374151' }}>{row.agents}</td>
                <td style={{ padding: '10px 16px', color: '#374151' }}>{row.calls}</td>
                <td style={{ padding: '10px 16px', color: '#374151' }}>{row.audio}</td>
                <td style={{ padding: '10px 16px', color: '#374151' }}>{row.transcriptie}</td>
                <td style={{ padding: '10px 16px', color: '#374151' }}>{row.server}</td>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: row.highlight ? '#16a34a' : '#111827' }}>{row.totaal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Groq note */}
      <div style={{
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 10,
        padding: '14px 18px',
        fontSize: 13,
        color: '#92400e',
        lineHeight: 1.6,
      }}>
        <strong>Let op:</strong> Bij Fase 1 (lokale Whisper CPU) crasht de server als meerdere agenten tegelijk een gesprek insturen.
        Schakel over naar <strong>Groq Whisper API</strong> zodra meer dan ±3 agenten tegelijk actief zijn.
        Kosten: <strong>$0,111 per uur audio</strong>. Een werkdag van 100 agenten × 4 min/call × 10 calls = ±$7,40/dag.
      </div>
    </div>
  )
}

/* ─── Data ─────────────────────────────────────────────────── */

const PHASES = [
  {
    title: 'Intern prototype',
    subtitle: 'Lokale server op eigen PC, ngrok tunnel, 1–3 agenten',
    icon: '💻',
    color: '#dbeafe',
    cost: '€0 / mnd',
    costColor: '#2563eb',
    active: true,
    stack: [
      'Flask server op eigen PC',
      'ngrok publieke tunnel',
      'Whisper small (lokale CPU)',
      'Supabase gratis tier',
      'Next.js dashboard op Vercel (gratis)',
    ],
    capacity: [
      '1–3 agenten tegelijk',
      'Max ±5 calls tegelijk',
      'Transcriptie: ~2–4× realtime',
    ],
    actions: [
      { label: 'Server draait lokaal', done: true },
      { label: 'Dashboard live op Vercel', done: true },
      { label: 'Supabase Realtime actief', done: false },
      { label: 'Groq API key instellen', done: false },
    ],
  },
  {
    title: 'Kleine klant (1 team)',
    subtitle: 'VPS server, vaste URL, Groq Whisper API, 5–15 agenten',
    icon: '🏢',
    color: '#e0e7ff',
    cost: '€15–30 / mnd',
    costColor: '#4f46e5',
    active: false,
    stack: [
      'VPS (DigitalOcean / Hetzner)',
      'Vaste domeinnaam (geen ngrok)',
      'Groq Whisper API (cloud)',
      'Supabase Pro of gratis',
      'Next.js dashboard Vercel',
    ],
    capacity: [
      '5–15 agenten tegelijk',
      'Onbeperkte parallelle calls',
      'Transcriptie: <10 seconden',
    ],
    actions: [
      { label: 'VPS aanschaffen', done: false },
      { label: 'Domein + SSL instellen', done: false },
      { label: 'Groq Whisper integreren', done: false },
      { label: 'Auto-installer script agent', done: false },
      { label: 'Steam-connect webhook', done: false },
    ],
  },
  {
    title: 'Groei (meerdere klanten)',
    subtitle: 'Multi-tenant, login per klant, gescheiden data, 15–100 agenten',
    icon: '📈',
    color: '#fce7f3',
    cost: '€50–150 / mnd',
    costColor: '#be185d',
    active: false,
    stack: [
      'VPS of cloud (schaalbaar)',
      'Multi-tenant Supabase (per klant)',
      'Groq Whisper API',
      'Klant-login dashboard per bedrijf',
      'Webhook integraties (Steam-connect etc.)',
    ],
    capacity: [
      '15–100+ agenten',
      'Meerdere bedrijven gescheiden',
      'Realtime per klantenaccount',
    ],
    actions: [
      { label: 'Multi-tenant architectuur bouwen', done: false },
      { label: 'Login per bedrijfsaccount', done: false },
      { label: 'Billing / gebruik bijhouden', done: false },
      { label: 'SLA + monitoring (uptime)', done: false },
    ],
  },
  {
    title: 'Enterprise',
    subtitle: 'Managed hosting, SLA, API integraties, 100–∞ agenten',
    icon: '🚀',
    color: '#fef3c7',
    cost: '€200+ / mnd',
    costColor: '#b45309',
    active: false,
    stack: [
      'Kubernetes / auto-scaling cloud',
      'Eigen Whisper GPU cluster (optioneel)',
      'Dedicated Supabase instance',
      'White-label dashboard per klant',
      'Full API integratie (CRM, belsystemen)',
    ],
    capacity: [
      '100–∞ agenten',
      'Volledig parallelle verwerking',
      'SLA 99,9% uptime',
    ],
    actions: [
      { label: 'Auto-scaling infra opzetten', done: false },
      { label: 'Dedicated hardware / GPU', done: false },
      { label: 'White-label branding', done: false },
      { label: 'Enterprise contracten', done: false },
    ],
  },
]

const COSTS = [
  {
    scenario: 'Prototype',
    agents: '1–3',
    calls: '~20',
    audio: '~1 uur',
    transcriptie: 'Lokaal (gratis)',
    server: 'Eigen PC',
    totaal: '€0',
    highlight: true,
  },
  {
    scenario: 'Klein team',
    agents: '5–15',
    calls: '~100',
    audio: '~5 uur',
    transcriptie: '~$3/dag (Groq)',
    server: '€6–12/mnd (VPS)',
    totaal: '~€80/mnd',
    highlight: false,
  },
  {
    scenario: 'Callcenter',
    agents: '15–50',
    calls: '~500',
    audio: '~25 uur',
    transcriptie: '~$15/dag (Groq)',
    server: '€20–40/mnd',
    totaal: '~€300/mnd',
    highlight: false,
  },
  {
    scenario: 'Enterprise',
    agents: '100+',
    calls: '~5.000',
    audio: '~250 uur',
    transcriptie: '~$8/dag (GPU server)',
    server: '€150+/mnd',
    totaal: '~€500+/mnd',
    highlight: false,
  },
]
