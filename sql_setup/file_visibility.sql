-- ==============================================================================
-- AP-Cloud — File Visibility Table
-- Run this in Supabase SQL Editor AFTER the main schema is set up.
-- Safe to run multiple times (idempotent).
-- ==============================================================================

-- 1. Create file_visibility table
CREATE TABLE IF NOT EXISTS public.file_visibility (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id     UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,          -- e.g. "src/components" or "README.md"
    is_public   BOOLEAN NOT NULL DEFAULT true,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (repo_id, path)
);

-- 2. Index for fast lookups by repo
CREATE INDEX IF NOT EXISTS idx_file_visibility_repo_id
    ON public.file_visibility(repo_id);

-- 3. Enable RLS
ALTER TABLE public.file_visibility ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Anyone can read visibility settings (needed to filter tree view)
DROP POLICY IF EXISTS "file_visibility: public read" ON public.file_visibility;
CREATE POLICY "file_visibility: public read"
    ON public.file_visibility FOR SELECT
    USING (true);

-- Only authenticated admin can insert/update/delete
DROP POLICY IF EXISTS "file_visibility: authenticated insert" ON public.file_visibility;
CREATE POLICY "file_visibility: authenticated insert"
    ON public.file_visibility FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "file_visibility: authenticated update" ON public.file_visibility;
CREATE POLICY "file_visibility: authenticated update"
    ON public.file_visibility FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "file_visibility: authenticated delete" ON public.file_visibility;
CREATE POLICY "file_visibility: authenticated delete"
    ON public.file_visibility FOR DELETE
    TO authenticated
    USING (true);

-- ==============================================================================
-- Done! 
-- Logic summary (enforced in frontend):
--   * Default: all files/folders are PUBLIC (no row = public)
--   * A row with is_public=false means that path is PRIVATE
--   * CASCADE: if a parent folder is private, all children are treated as private
--              regardless of their own setting (parent must be public first)
-- ==============================================================================
