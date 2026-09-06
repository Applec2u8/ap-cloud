-- ==============================================================================
-- 1. Create Commits Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id UUID REFERENCES public.repositories(id) ON DELETE CASCADE,
    commit_hash TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public commits are viewable by everyone" 
ON public.commits FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.repositories
        WHERE repositories.id = commits.repo_id
        AND repositories.visibility = 'public'
    )
);

CREATE POLICY "Authenticated users can view all commits"
ON public.commits FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage commits"
ON public.commits FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- 2. Storage Policies for `repo-storage` bucket
-- ==============================================================================
-- Allow public select from repo-storage (for downloads and extracting in client)
CREATE POLICY "Public can view repo-storage"
ON storage.objects FOR SELECT
TO anon, authenticated
USING ( bucket_id = 'repo-storage' );

-- Allow users to insert into repo-storage
CREATE POLICY "Users can insert into repo-storage"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK ( bucket_id = 'repo-storage' );

-- Allow users to update objects in repo-storage
CREATE POLICY "Users can update repo-storage"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING ( bucket_id = 'repo-storage' )
WITH CHECK ( bucket_id = 'repo-storage' );

-- Allow users to delete objects in repo-storage
CREATE POLICY "Users can delete repo-storage"
ON storage.objects FOR DELETE
TO anon, authenticated
USING ( bucket_id = 'repo-storage' );
