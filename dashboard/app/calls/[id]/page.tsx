import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase, type Call, type CheckField, type ComplianceReport } from '@/lib/supabase'
import DeleteButton from '@/components/DeleteButton'

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
    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${cls}`}>
      {level ?? '—'}
    </span>
  )
}

function CheckRow({
  label,
  passed,
  toelichting,
}: {
  label: string
  passed: boolean
  toelichting: string
}) {
  return (
    <tr className={passed ? 'bg-white' : 'bg-red-50'}>
      <td className="px-5 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">
        {label}
      </td>
      <td className="px-4 py-3 text-center text-base">{passed ? '✅' : '❌'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{toelichting || '—'}</td>
    </tr>
  )
}

function ClaimsRow({ claims }: { claims: string[] | undefined; gevonden: boolean }) {
  const none = !claims || claims.length === 0
  return (
    <tr className={none ? 'bg-white' : 'bg-red-50'}>
      <td className="px-5 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">
        Verboden claims
      </td>
      <td className="px-4 py-3 text-center text-base">{none ? '✅' : '❌'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {none ? 'Geen gevonden' : claims!.join(', ')}
      </td>
    </tr>
  )
}

function RodeVlaggenRow({ details }: { details: string[] | undefined; gevonden: boolean }) {
  const none = !details || details.length === 0
  return (
    <tr className={none ? 'bg-white' : 'bg-orange-50'}>
      <td className="px-5 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">
        Rode vlaggen
      </td>
      <td className="px-4 py-3 text-center text-base">{none ? '✅' : '⚠️'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {none ? 'Geen gevonden' : details!.join(', ')}
      </td>
    </tr>
  )
}

function field(f: CheckField | undefined): CheckField {
  return f ?? { voldaan: false, toelichting: '' }
}

export default async function CallDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: call, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', params.id)
    .single<Call>()

  if (error || !call) notFound()

  const report = call.compliance_report as ComplianceReport | null
  const pc = field(report?.productcombinatie)
  const pv = field(report?.prijs_en_voorwaarden)
  const ak = field(report?.akkoord_klant)
  const vc = report?.verboden_claims
  const rv = report?.rode_vlaggen

  return (
    <div className="p-8 max-w-4xl">
      {/* Back link */}
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
        ← Terug naar overzicht
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mt-4 mb-8">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">
            Gesprek {formatTimestamp(call.timestamp)}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Duur: {formatDuration(call.duration)}
            {call.call_type && <> · Type: {call.call_type}</>}
          </p>
        </div>
        <RiskBadge level={call.risk_level} />
        <DeleteButton callId={call.id} />
      </div>

      {/* Samenvatting */}
      {report?.samenvatting && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Samenvatting</p>
          <p className="text-sm text-gray-700 leading-relaxed">{report.samenvatting}</p>
        </div>
      )}

      {/* Audio link */}
      {call.file_url && (
        <div className="mb-6">
          <a
            href={call.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            🎧 Audio beluisteren
          </a>
        </div>
      )}

      {/* Compliance table */}
      {report ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Compliance controle</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-2 font-medium w-48">Controle</th>
                <th className="px-4 py-2 font-medium w-16">Status</th>
                <th className="text-left px-4 py-2 font-medium">Toelichting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <CheckRow
                label="Productcombinatie"
                passed={pc.voldaan}
                toelichting={pc.toelichting}
              />
              <CheckRow
                label="Prijs &amp; Voorwaarden"
                passed={pv.voldaan}
                toelichting={pv.toelichting}
              />
              <CheckRow
                label="Akkoord klant"
                passed={ak.voldaan}
                toelichting={ak.toelichting}
              />
              <ClaimsRow
                gevonden={vc?.gevonden ?? false}
                claims={vc?.claims}
              />
              <RodeVlaggenRow
                gevonden={rv?.gevonden ?? false}
                details={rv?.details}
              />
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-8">Geen compliance rapport beschikbaar.</p>
      )}

      {/* Transcript */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Transcript</h3>
        </div>
        <pre className="px-5 py-4 text-sm text-gray-700 whitespace-pre-wrap break-words font-sans leading-relaxed">
          {call.transcript ?? 'Geen transcript beschikbaar.'}
        </pre>
      </div>
    </div>
  )
}
