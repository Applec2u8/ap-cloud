import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Release {
  id: string;
  app_name: string;
  version: string;
  filename: string;
  size: number;
  public_url: string;
  release_notes: string | null;
  is_public: boolean;
  is_latest: boolean;
  created_at: string;
  /** FK to repositories.id — null for legacy releases not bound to a repo */
  repository_id: string | null;
}

export interface LinkAlias {
  id: string;
  repository_id: string;
  slug: string;
  target_url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

