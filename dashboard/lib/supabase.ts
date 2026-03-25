import { createClient } from '@supabase/supabase-js'

export type Call = {
  id: string
  created_at: string
  timestamp: string
  file_url: string | null
  duration: number | null
  transcript: string | null
  compliant: boolean | null
  risk_level: string | null
  call_type: string | null
  issues: Record<string, unknown> | null
  summary: string | null
  compliance_report: ComplianceReport | null
}

export type CheckField = {
  voldaan: boolean
  toelichting: string
}

export type ComplianceReport = {
  productcombinatie?: CheckField
  prijs_en_voorwaarden?: CheckField
  akkoord_klant?: CheckField
  verboden_claims?: { gevonden: boolean; claims: string[] }
  rode_vlaggen?: { gevonden: boolean; details: string[] }
  algemeen_oordeel?: string
  samenvatting?: string
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
