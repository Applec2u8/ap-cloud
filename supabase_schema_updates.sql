-- ============================================================
-- AP-Cloud: Repository-Scoped Releases Migration
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. Add repository_id FK to releases (safe — does nothing if column already exists)
ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS repository_id uuid
  REFERENCES repositories(id) ON DELETE CASCADE;

-- Optional index for fast per-repo queries
CREATE INDEX IF NOT EXISTS idx_releases_repository_id
  ON releases(repository_id);

-- 2. Per-repo "set latest" RPC
--    Unmarks all releases for a repo, then marks exactly one as latest.
--    Verifies the target release actually belongs to the target repo before acting.
CREATE OR REPLACE FUNCTION set_latest_release_for_repo(
  target_release_id uuid,
  target_repo_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Safety check: ensure the chosen release actually belongs to this repo.
  IF NOT EXISTS (
    SELECT 1 FROM releases
    WHERE id = target_release_id AND repository_id = target_repo_id
  ) THEN
    RAISE EXCEPTION 'Release % does not belong to repository %',
      target_release_id, target_repo_id;
  END IF;

  -- Clear latest flag for every release in this repo ONLY.
  UPDATE releases
    SET is_latest = false
  WHERE repository_id = target_repo_id
    AND id <> target_release_id;

  -- Set the chosen release as latest.
  UPDATE releases
    SET is_latest = true
  WHERE id = target_release_id;
END;
$$;

-- 2b. DB-level trigger: enforce per-repo is_latest uniqueness automatically.
--     Whenever a release row has is_latest set to TRUE, this trigger fires
--     BEFORE the write and clears is_latest on every OTHER release in the
--     SAME repository.  This is a safety net that catches any direct UPDATE
--     statements or future code paths that bypass the RPC above.
CREATE OR REPLACE FUNCTION enforce_single_latest_per_repo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act when is_latest is being turned ON.
  IF NEW.is_latest = true AND (OLD IS NULL OR OLD.is_latest = false) THEN
    -- repository_id must be set; orphaned releases cannot be "latest".
    IF NEW.repository_id IS NULL THEN
      RAISE EXCEPTION
        'Cannot set is_latest = true on a release with no repository_id. '
        'Bind the release to a repository first.';
    END IF;

    -- Clear is_latest for all other releases in the same repo.
    UPDATE releases
      SET is_latest = false
    WHERE repository_id = NEW.repository_id
      AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_latest_per_repo ON releases;
CREATE TRIGGER trg_enforce_single_latest_per_repo
  BEFORE INSERT OR UPDATE OF is_latest ON releases
  FOR EACH ROW EXECUTE FUNCTION enforce_single_latest_per_repo();


--    If you have existing releases you want to bind to a default repository,
--    uncomment and run this after replacing YOUR_DEFAULT_REPO_ID:
--
-- UPDATE releases
--   SET repository_id = 'YOUR_DEFAULT_REPO_ID'::uuid
-- WHERE repository_id IS NULL;

-- ============================================================
-- AP-Cloud: Link Aliases (Permanent Redirect / Proxy URLs)
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 5. Create the link_aliases table
--    Each row is a named alias (slug) scoped to a repository.
--    The Edge Function "resolve-alias" looks up the slug and
--    transparently proxies (or redirects to) target_url.
CREATE TABLE IF NOT EXISTS link_aliases (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  slug          text        NOT NULL,          -- e.g. "my-app-updater"
  target_url    text        NOT NULL,          -- e.g. https://<project>.supabase.co/functions/v1/latest-version?repo_id=...
  description   text,                          -- optional human-readable label
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (repository_id, slug)
);

-- Fast per-repo listing
CREATE INDEX IF NOT EXISTS idx_link_aliases_repo
  ON link_aliases(repository_id);

-- 6. Auto-update updated_at on every row change
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

-- ============================================================
-- AP-Cloud: alias-jsons Storage Bucket
-- Stores custom JSON update files uploaded via the Link Alias
-- "JSON File Upload" mode.  Files are publicly readable so
-- client auto-updaters can fetch them directly.
-- Run this in your Supabase SQL editor (requires the
-- storage extension, which Supabase enables by default).
-- ============================================================

-- 7. Create the public bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alias-jsons',
  'alias-jsons',
  true,          -- public: anyone can GET the files
  524288,        -- 512 KB max per file (JSON files are tiny)
  ARRAY['application/json', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- 8. RLS policies for alias-jsons bucket
--    Drop existing policies first so this block is safe to re-run.
DO $$ BEGIN
  DROP POLICY IF EXISTS "alias-jsons: public read"  ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: auth write"   ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: auth update"  ON storage.objects;
  DROP POLICY IF EXISTS "alias-jsons: auth delete"  ON storage.objects;
END $$;

--    Public read (SELECT) — auto-updater clients fetch the JSON without auth.
CREATE POLICY "alias-jsons: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'alias-jsons');

--    Open write policies — the admin panel uses the anon key (no Supabase Auth
--    session), so we allow both anon and authenticated roles to manage files in
--    this bucket.  Access is implicitly limited to whoever holds the anon/service
--    key (i.e. your admin UI).  If you add Supabase Auth in future, tighten these
--    by replacing `true` with `auth.role() = 'authenticated'`.
CREATE POLICY "alias-jsons: write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'alias-jsons');

CREATE POLICY "alias-jsons: update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'alias-jsons');

CREATE POLICY "alias-jsons: delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'alias-jsons');


