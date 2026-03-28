import { supabase, type Call } from '@/lib/supabase'
import RealtimeCalls from '@/components/RealtimeCalls'

export default async function RisicoPage() {
  const { data: calls, error } = await supabase
    .from('calls')
    .select('*')
    .eq('risk_level', 'RISICO')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-8 text-red-600">Fout bij laden: {error.message}</div>
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Risico gesprekken</h2>
      <RealtimeCalls initial={(calls ?? []) as Call[]} filterRisk="RISICO" />
    </div>
  )
}
