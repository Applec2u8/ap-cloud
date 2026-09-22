-- ==============================================================================
-- AP-Cloud — Security RLS Update
-- Run this script in Supabase SQL Editor (Project → SQL Editor → New query).
-- It is safe to run multiple times (idempotent DROP IF EXISTS + CREATE).
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. REPOSITORIES TABLE
--    Public: anon can SELECT public repos
--    Admin:  authenticated can SELECT all + INSERT / UPDATE / DELETE
-- ──────────────────────────────────────────────────────────────────────────────

-- Remove the dangerous catch-all that gave anon FULL write access
DROP POLICY IF EXISTS "Users can manage repositories" ON public.repositories;

-- Public read: anyone can see public repos (needed by AutoHotkey / public pages)
DROP POLICY IF EXISTS "Public repositories are viewable by everyone" ON public.repositories;
CREATE POLICY "Public repositories are viewable by everyone"
  ON public.repositories FOR SELECT
  USING (visibility = 'public');

-- Authenticated read: admin can see ALL repos (including private)
DROP POLICY IF EXISTS "Authenticated users can view all repositories" ON public.repositories;
CREATE POLICY "Authenticated users can view all repositories"
  ON public.repositories FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated write: only logged-in admin can create / modify / delete repos
DROP POLICY IF EXISTS "Authenticated users can insert repositories" ON public.repositories;
CREATE POLICY "Authenticated users can insert repositories"
  ON public.repositories FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update repositories" ON public.repositories;
CREATE POLICY "Authenticated users can update repositories"
  ON public.repositories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete repositories" ON public.repositories;
CREATE POLICY "Authenticated users can delete repositories"
  ON public.repositories FOR DELETE
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. RELEASES TABLE
--    Public:  anon can SELECT is_public releases
--    Admin:   authenticated can SELECT all + INSERT / UPDATE / DELETE
-- ──────────────────────────────────────────────────────────────────────────────

-- Remove insecure anon update policy
DROP POLICY IF EXISTS "Client admins can update release visibility" ON public.releases;

-- Public read: anyone can see public releases (download pages, AutoHotkey)
DROP POLICY IF EXISTS "Public releases are viewable by everyone" ON public.releases;
CREATE POLICY "Public releases are viewable by everyone"
  ON public.releases FOR SELECT
  USING (is_public = true);

-- Authenticated read: admin can see ALL releases (public + private)
DROP POLICY IF EXISTS "Authenticated users can view all releases" ON public.releases;
CREATE POLICY "Authenticated users can view all releases"
  ON public.releases FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated write
DROP POLICY IF EXISTS "Authenticated users can insert releases" ON public.releases;
CREATE POLICY "Authenticated users can insert releases"
  ON public.releases FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update releases" ON public.releases;
CREATE POLICY "Authenticated users can update releases"
  ON public.releases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete releases" ON public.releases;
CREATE POLICY "Authenticated users can delete releases"
  ON public.releases FOR DELETE
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. LINK_ALIASES TABLE
--    Public:  anon can SELECT (needed by resolve-alias edge function & public UI)
--    Admin:   authenticated can INSERT / UPDATE / DELETE
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.link_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public link aliases are viewable by everyone" ON public.link_aliases;
CREATE POLICY "Public link aliases are viewable by everyone"
  ON public.link_aliases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert link aliases" ON public.link_aliases;
CREATE POLICY "Authenticated users can insert link aliases"
  ON public.link_aliases FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update link aliases" ON public.link_aliases;
CREATE POLICY "Authenticated users can update link aliases"
  ON public.link_aliases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete link aliases" ON public.link_aliases;
CREATE POLICY "Authenticated users can delete link aliases"
  ON public.link_aliases FOR DELETE
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. STORAGE — updates bucket (release binaries)
--    Public:  anyone can download (SELECT)
--    Admin:   authenticated can upload / update / delete
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "updates: public read" ON storage.objects;
CREATE POLICY "updates: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'updates');

DROP POLICY IF EXISTS "updates: authenticated write" ON storage.objects;
CREATE POLICY "updates: authenticated write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'updates');

DROP POLICY IF EXISTS "updates: authenticated update" ON storage.objects;
CREATE POLICY "updates: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'updates');

DROP POLICY IF EXISTS "updates: authenticated delete" ON storage.objects;
CREATE POLICY "updates: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'updates');

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. STORAGE — repo-storage bucket (repository source zips)
--    Public:  anyone can download source zips (repo browser)
--    Admin:   authenticated can upload / update / delete
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "repo-storage: public read" ON storage.objects;
CREATE POLICY "repo-storage: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'repo-storage');

DROP POLICY IF EXISTS "repo-storage: authenticated write" ON storage.objects;
CREATE POLICY "repo-storage: authenticated write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'repo-storage');

DROP POLICY IF EXISTS "repo-storage: authenticated update" ON storage.objects;
CREATE POLICY "repo-storage: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'repo-storage');

DROP POLICY IF EXISTS "repo-storage: authenticated delete" ON storage.objects;
CREATE POLICY "repo-storage: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'repo-storage');

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. STORAGE — alias-jsons bucket (public JSON files)
--    Public read already exists — tighten write to authenticated only
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "alias-jsons: write"  ON storage.objects;
DROP POLICY IF EXISTS "alias-jsons: update" ON storage.objects;
DROP POLICY IF EXISTS "alias-jsons: delete" ON storage.objects;

DROP POLICY IF EXISTS "alias-jsons: authenticated write"  ON storage.objects;
DROP POLICY IF EXISTS "alias-jsons: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "alias-jsons: authenticated delete" ON storage.objects;

CREATE POLICY "alias-jsons: authenticated write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'alias-jsons');

CREATE POLICY "alias-jsons: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'alias-jsons');

CREATE POLICY "alias-jsons: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'alias-jsons');

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Analytics tables — anon INSERT remains (public tracking), 
--    restrict SELECT to authenticated admin only
-- ──────────────────────────────────────────────────────────────────────────────

-- repository_views: keep anon insert for tracking, restrict read to authenticated
DROP POLICY IF EXISTS "anon_select_repository_views" ON repository_views;
DROP POLICY IF EXISTS "authenticated_select_repository_views" ON repository_views;
CREATE POLICY "authenticated_select_repository_views"
  ON repository_views FOR SELECT
  TO authenticated
  USING (true);

-- download_logs: keep anon insert for tracking, restrict read to authenticated
DROP POLICY IF EXISTS "anon_select_download_logs" ON download_logs;
DROP POLICY IF EXISTS "authenticated_select_download_logs" ON download_logs;
CREATE POLICY "authenticated_select_download_logs"
  ON download_logs FOR SELECT
  TO authenticated
  USING (true);

-- release_views: keep anon insert for tracking, restrict read to authenticated
DROP POLICY IF EXISTS "anon_select_release_views" ON release_views;
DROP POLICY IF EXISTS "authenticated_select_release_views" ON release_views;
CREATE POLICY "authenticated_select_release_views"
  ON release_views FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================================================
-- Done! Summary of changes:
-- * repositories:    anon=SELECT(public only),        authenticated=ALL
-- * releases:        anon=SELECT(is_public=true only), authenticated=ALL
-- * link_aliases:    anon=SELECT,                      authenticated=write
-- * storage/updates: anon=SELECT,                      authenticated=write
-- * storage/repo-storage: anon=SELECT,                 authenticated=write
-- * storage/alias-jsons:  public=SELECT,               authenticated=write
-- * analytics tables: anon=INSERT(tracking),           authenticated=SELECT
-- ==============================================================================
