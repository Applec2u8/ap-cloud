-- ============================================================
-- AP-Cloud: Analytics & Tracking Schema (v2 — Full Upgrade)
-- Run this ENTIRE script in your Supabase SQL editor.
-- Safe to re-run: uses IF NOT EXISTS + DROP IF EXISTS for policies.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. Repository Views Table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS repository_views (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid       NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  visitor_ip   text,
  user_agent   text,
  device_type  text,       -- "Mobile" | "Tablet" | "Desktop/PC"
  device_name  text,       -- e.g. "iPhone (iOS 17.1)", "Samsung SM-S908B (Android 13)"
  browser      text,       -- e.g. "Chrome 128", "Safari 17"
  os           text,       -- e.g. "iOS 17.1", "Windows 11/10", "macOS 14.2"
  created_at   timestamptz DEFAULT now()
);

-- Add new columns if upgrading from v1
ALTER TABLE repository_views ADD COLUMN IF NOT EXISTS device_type text;
ALTER TABLE repository_views ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE repository_views ADD COLUMN IF NOT EXISTS browser     text;
ALTER TABLE repository_views ADD COLUMN IF NOT EXISTS os          text;

CREATE INDEX IF NOT EXISTS idx_repository_views_repo
  ON repository_views(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_views_created
  ON repository_views(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 2. Download Logs Table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS download_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  download_type text        NOT NULL CHECK (download_type IN ('source_code', 'release_binary')),
  version       text,
  device_type   text,       -- "Mobile" | "Tablet" | "Desktop/PC"
  device_name   text,       -- e.g. "iPhone (iOS 17.1)", "Windows PC"
  browser       text,       -- e.g. "Chrome 128"
  os            text,       -- e.g. "Android 13", "macOS 14"
  browser_os    text,       -- legacy field (kept for backward compat)
  user_ip       text,
  created_at    timestamptz DEFAULT now()
);

-- Add new columns if upgrading from v1
ALTER TABLE download_logs ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE download_logs ADD COLUMN IF NOT EXISTS browser     text;
ALTER TABLE download_logs ADD COLUMN IF NOT EXISTS os          text;

CREATE INDEX IF NOT EXISTS idx_download_logs_repo
  ON download_logs(repository_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_type
  ON download_logs(download_type);
CREATE INDEX IF NOT EXISTS idx_download_logs_version
  ON download_logs(version);
CREATE INDEX IF NOT EXISTS idx_download_logs_created
  ON download_logs(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 3. Release Views Table (NEW in v2)
--    Tracks when a user clicks on a release to view its detail
--    page, or copies a direct download link.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS release_views (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  version       text        NOT NULL,
  event_type    text        NOT NULL DEFAULT 'page_view',
                            -- 'page_view' | 'link_copy' | 'row_click'
  device_type   text,
  device_name   text,
  browser       text,
  os            text,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_release_views_repo
  ON release_views(repository_id);
CREATE INDEX IF NOT EXISTS idx_release_views_version
  ON release_views(version);
CREATE INDEX IF NOT EXISTS idx_release_views_created
  ON release_views(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 4. Enable RLS on all tracking tables
-- ══════════════════════════════════════════════════════════════
ALTER TABLE repository_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_views     ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- 5. RLS Policies (idempotent — drops before recreating)
-- ══════════════════════════════════════════════════════════════

-- repository_views
DROP POLICY IF EXISTS "Allow anonymous inserts to repository_views"   ON repository_views;
DROP POLICY IF EXISTS "Allow anon read access to repository_views"    ON repository_views;
DROP POLICY IF EXISTS "Allow authenticated read access to repository_views" ON repository_views;

CREATE POLICY "anon_insert_repository_views"
  ON repository_views FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_repository_views"
  ON repository_views FOR SELECT TO anon USING (true);

-- download_logs
DROP POLICY IF EXISTS "Allow anonymous inserts to download_logs"      ON download_logs;
DROP POLICY IF EXISTS "Allow anon read access to download_logs"       ON download_logs;
DROP POLICY IF EXISTS "Allow authenticated read access to download_logs" ON download_logs;

CREATE POLICY "anon_insert_download_logs"
  ON download_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_download_logs"
  ON download_logs FOR SELECT TO anon USING (true);

-- release_views (new)
DROP POLICY IF EXISTS "anon_insert_release_views" ON release_views;
DROP POLICY IF EXISTS "anon_select_release_views" ON release_views;

CREATE POLICY "anon_insert_release_views"
  ON release_views FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_release_views"
  ON release_views FOR SELECT TO anon USING (true);
