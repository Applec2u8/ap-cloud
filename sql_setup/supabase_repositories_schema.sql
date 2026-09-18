-- ==============================================================================
-- Supabase Schema for Repositories Feature
-- ==============================================================================

-- 1. Create repositories table
CREATE TABLE IF NOT EXISTS public.repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    default_branch TEXT DEFAULT 'main',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create repo-storage bucket
-- (Note: you may need to run this from the Supabase Storage UI if SQL bucket creation requires superuser)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('repo-storage', 'repo-storage', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up RLS for repositories table
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to public repositories
CREATE POLICY "Public repositories are viewable by everyone" 
ON public.repositories FOR SELECT 
USING (visibility = 'public');

-- Allow authenticated users to view all repositories (including private)
CREATE POLICY "Authenticated users can view all repositories"
ON public.repositories FOR SELECT
TO authenticated
USING (true);

-- Allow all users to insert/update/delete repositories (since AP-Cloud uses a custom password gate instead of Supabase Auth)
CREATE POLICY "Users can manage repositories"
ON public.repositories FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);


-- ==============================================================================
-- STORAGE LAYOUT (for future CLI integration)
-- ==============================================================================
-- The 'repo-storage' bucket is organized as:
--
--   repo-storage/
--     <repo-id>/
--       <timestamp>/
--         source.zip   ← ZIP uploaded by CLI (node_modules, dist, .git excluded)
--
-- CLI (npx ap-cloud push) workflow:
--   1. ZIP the project locally, ignoring: node_modules/, dist/, .git/, .next/
--   2. Upload to: repo-storage/<repo-id>/<timestamp>/source.zip
--   3. POST push metadata to Supabase Edge Function (future: /functions/v1/repo-push)
-- ==============================================================================
