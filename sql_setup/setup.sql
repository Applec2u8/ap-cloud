-- ==============================================================================
-- AP-Cloud Complete Database Setup
-- Run this ENTIRE script in your Supabase SQL editor.
-- It is safe to run multiple times (idempotent).
-- ==============================================================================

-- ══════════════════════════════════════════════════════════════
-- 1. Repositories Schema
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    default_branch TEXT DEFAULT 'main',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Set up RLS for repositories table
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public repositories are viewable by everyone" ON public.repositories;
CREATE POLICY "Public repositories are viewable by everyone" 
ON public.repositories FOR SELECT USING (visibility = 'public');

DROP POLICY IF EXISTS "Authenticated users can view all repositories" ON public.repositories;
CREATE POLICY "Authenticated users can view all repositories"
ON public.repositories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage repositories" ON public.repositories;
CREATE POLICY "Users can manage repositories"
ON public.repositories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create repo-storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('repo-storage', 'repo-storage', false)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 2. Releases Schema
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name TEXT NOT NULL,
    version TEXT NOT NULL,
    filename TEXT NOT NULL,
    size BIGINT NOT NULL,
    public_url TEXT NOT NULL,
    release_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add extensions
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS is_public boolean not null default false;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS is_latest boolean not null default false;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS repository_id uuid REFERENCES repositories(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS releases_single_latest_idx ON public.releases (is_latest) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS releases_public_created_at_idx ON public.releases (is_public, created_at desc);
CREATE INDEX IF NOT EXISTS idx_releases_repository_id ON releases(repository_id);

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client admins can update release visibility" on public.releases;
CREATE POLICY "Client admins can update release visibility"
  on public.releases for update to anon
  using (true)
  with check (true);

-- Per-repo "set latest" RPC
CREATE OR REPLACE FUNCTION set_latest_release_for_repo(
  target_release_id uuid,
  target_repo_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM releases WHERE id = target_release_id AND repository_id = target_repo_id
  ) THEN
    RAISE EXCEPTION 'Release % does not belong to repository %', target_release_id, target_repo_id;
  END IF;

  UPDATE releases SET is_latest = false WHERE repository_id = target_repo_id AND id <> target_release_id;
  UPDATE releases SET is_latest = true WHERE id = target_release_id;
END;
$$;

-- DB-level trigger: enforce per-repo is_latest uniqueness automatically
CREATE OR REPLACE FUNCTION enforce_single_latest_per_repo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_latest = true AND (OLD IS NULL OR OLD.is_latest = false) THEN
    IF NEW.repository_id IS NULL THEN
      RAISE EXCEPTION 'Cannot set is_latest = true on a release with no repository_id.';
    END IF;
    UPDATE releases SET is_latest = false WHERE repository_id = NEW.repository_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_latest_per_repo ON releases;
CREATE TRIGGER trg_enforce_single_latest_per_repo
  BEFORE INSERT OR UPDATE OF is_latest ON releases
  FOR EACH ROW EXECUTE FUNCTION enforce_single_latest_per_repo();

-- Legacy global set latest function (optional but included for completeness)
CREATE OR REPLACE FUNCTION public.set_latest_release(target_release_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.releases SET is_latest = false WHERE is_latest = true;
  UPDATE public.releases SET is_latest = true WHERE id = target_release_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_latest_release(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.set_latest_release(uuid) TO anon;

-- ══════════════════════════════════════════════════════════════
-- 3. Link Aliases Schema
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS link_aliases (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  slug          text        NOT NULL,
  target_url    text        NOT NULL,
  description   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (repository_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_link_aliases_repo ON link_aliases(repository_id);

CREATE OR REPLACE FUNCTION update_link_aliases_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_aliases_updated_at ON link_aliases;
CREATE TRIGGER trg_link_aliases_updated_at
  BEFORE UPDATE ON link_aliases
  FOR EACH ROW EXECUTE FUNCTION update_link_aliases_updated_at();

-- alias-jsons Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alias-jsons',
  'alias-jsons',
  true,
  524288,
  ARRAY['application/json', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "alias-jsons: public read"  ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: auth write"   ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: auth update"  ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: auth delete"  ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: write"        ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: update"       ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: delete"       ON storage.objects;
END $$;

CREATE POLICY "alias-jsons: public read" ON storage.objects FOR SELECT USING (bucket_id = 'alias-jsons');
CREATE POLICY "alias-jsons: write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'alias-jsons');
CREATE POLICY "alias-jsons: update" ON storage.objects FOR UPDATE USING (bucket_id = 'alias-jsons');
CREATE POLICY "alias-jsons: delete" ON storage.objects FOR DELETE USING (bucket_id = 'alias-jsons');


-- ══════════════════════════════════════════════════════════════
-- 4. Analytics & Tracking Schema
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

ALTER TABLE repository_views ADD COLUMN IF NOT EXISTS device_type text;
ALTER TABLE repository_views ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE repository_views ADD COLUMN IF NOT EXISTS browser     text;
ALTER TABLE repository_views ADD COLUMN IF NOT EXISTS os          text;

CREATE INDEX IF NOT EXISTS idx_repository_views_repo ON repository_views(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_views_created ON repository_views(created_at DESC);

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

ALTER TABLE download_logs ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE download_logs ADD COLUMN IF NOT EXISTS browser     text;
ALTER TABLE download_logs ADD COLUMN IF NOT EXISTS os          text;

CREATE INDEX IF NOT EXISTS idx_download_logs_repo ON download_logs(repository_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_type ON download_logs(download_type);
CREATE INDEX IF NOT EXISTS idx_download_logs_version ON download_logs(version);
CREATE INDEX IF NOT EXISTS idx_download_logs_created ON download_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS release_views (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  version       text        NOT NULL,
  event_type    text        NOT NULL DEFAULT 'page_view',
  device_type   text,
  device_name   text,
  browser       text,
  os            text,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_release_views_repo ON release_views(repository_id);
CREATE INDEX IF NOT EXISTS idx_release_views_version ON release_views(version);
CREATE INDEX IF NOT EXISTS idx_release_views_created ON release_views(created_at DESC);

ALTER TABLE repository_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_views     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous inserts to repository_views"   ON repository_views;
DROP POLICY IF EXISTS "Allow anon read access to repository_views"    ON repository_views;
DROP POLICY IF EXISTS "Allow authenticated read access to repository_views" ON repository_views;
DROP POLICY IF EXISTS "anon_insert_repository_views" ON repository_views;
DROP POLICY IF EXISTS "anon_select_repository_views" ON repository_views;

CREATE POLICY "anon_insert_repository_views" ON repository_views FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_repository_views" ON repository_views FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous inserts to download_logs"      ON download_logs;
DROP POLICY IF EXISTS "Allow anon read access to download_logs"       ON download_logs;
DROP POLICY IF EXISTS "Allow authenticated read access to download_logs" ON download_logs;
DROP POLICY IF EXISTS "anon_insert_download_logs" ON download_logs;
DROP POLICY IF EXISTS "anon_select_download_logs" ON download_logs;

CREATE POLICY "anon_insert_download_logs" ON download_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_download_logs" ON download_logs FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert_release_views" ON release_views;
DROP POLICY IF EXISTS "anon_select_release_views" ON release_views;

CREATE POLICY "anon_insert_release_views" ON release_views FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_release_views" ON release_views FOR SELECT TO anon USING (true);
