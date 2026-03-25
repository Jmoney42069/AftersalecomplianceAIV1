-- =============================================================================
-- Voltera Compliance System — Supabase Setup Script
-- Run once in Supabase SQL Editor (Database → SQL Editor → New query)
-- Safe to re-run: uses IF NOT EXISTS and ON CONFLICT DO NOTHING throughout
-- =============================================================================


-- =============================================================================
-- 1. TABLE: calls
--    Single source of truth for all recorded sales calls.
--    Written by Python backend (service key), read by dashboard (anon key).
--
--    SCALING NOTE: When rows exceed ~500k, consider:
--    - Cursor-based pagination in the dashboard (keyset on created_at + id)
--    - Archiving rows older than 12 months to a calls_archive table
--    - GIN index on compliance_report if you query inside the JSONB
--    - tsvector index on transcript for full-text search
-- =============================================================================

CREATE TABLE IF NOT EXISTS calls (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    timestamp          TEXT        NOT NULL,
    file_url           TEXT,
    duration           NUMERIC,
    transcript         TEXT,
    compliant          BOOLEAN,
    risk_level         TEXT        CHECK (risk_level IN ('GOEDGEKEURD', 'RISICO', 'AFGEKEURD')),
    call_type          TEXT,
    issues             JSONB       NOT NULL DEFAULT '[]'::jsonb,
    summary            TEXT,
    compliance_report  JSONB,
    agent_id           TEXT
);


-- =============================================================================
-- 2. INDEXES
--    created_at DESC → dashboard default sort (newest first)
--    risk_level      → filter by verdict (AFGEKEURD overview etc.)
--    agent_id        → per-agent reporting and filtering
--
--    SCALING NOTE: Add composite index (agent_id, created_at DESC) once you
--    build per-agent views to avoid index-scan fallbacks.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_risk_level  ON calls (risk_level);
CREATE INDEX IF NOT EXISTS idx_calls_agent_id    ON calls (agent_id);


-- =============================================================================
-- 3. ROW LEVEL SECURITY
--    service_role → full access (Python backend writes via service key)
--    anon         → SELECT only (Next.js dashboard reads via anon key)
--
--    SCALING NOTE: When adding manager authentication to the dashboard,
--    replace the anon SELECT policy with an auth.uid()-scoped policy so
--    managers only see their own agents' calls.
-- =============================================================================

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Service role: full access (INSERT, UPDATE, SELECT, DELETE)
-- Supabase service role bypasses RLS by default, but made explicit for auditability.
DROP POLICY IF EXISTS "service_role_full_access" ON calls;
CREATE POLICY "service_role_full_access" ON calls
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Anon role: read-only (dashboard uses NEXT_PUBLIC_SUPABASE_ANON_KEY)
DROP POLICY IF EXISTS "anon_select_only" ON calls;
CREATE POLICY "anon_select_only" ON calls
    FOR SELECT
    TO anon
    USING (true);


-- =============================================================================
-- 4. STORAGE BUCKET: recordings
--    Private bucket — files are NOT publicly accessible by URL.
--    File size limit: 50 MB (covers ~60 min WAV at 16kHz mono int16).
--
--    SCALING NOTE: For > 10k files, enable Storage CDN and add a lifecycle
--    rule to delete files older than 90 days to control storage costs.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'recordings',
    'recordings',
    false,                          -- private: requires signed URL to access
    52428800,                       -- 50 MB in bytes
    ARRAY['audio/wav', 'audio/wave', 'audio/x-wav']
)
ON CONFLICT (id) DO UPDATE
    SET file_size_limit    = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =============================================================================
-- 5. STORAGE POLICIES
--    service_role → upload (INSERT), read (SELECT), delete (DELETE) audio files
--    anon         → no direct storage access
--
--    SCALING NOTE: When building audio playback in the dashboard, generate
--    short-lived signed URLs server-side via createSignedUrl() in the SDK —
--    never expose the service key in the browser.
-- =============================================================================

DROP POLICY IF EXISTS "service_role_upload" ON storage.objects;
CREATE POLICY "service_role_upload" ON storage.objects
    FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'recordings');

DROP POLICY IF EXISTS "service_role_read" ON storage.objects;
CREATE POLICY "service_role_read" ON storage.objects
    FOR SELECT
    TO service_role
    USING (bucket_id = 'recordings');

DROP POLICY IF EXISTS "service_role_delete" ON storage.objects;
CREATE POLICY "service_role_delete" ON storage.objects
    FOR DELETE
    TO service_role
    USING (bucket_id = 'recordings');
