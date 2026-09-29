import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

export interface VisibilityMap {
  [path: string]: boolean; // true = public, false = private
}

/**
 * Pure function: compute effective visibility of a path considering ancestor cascade.
 * Exported for use in pages that need to check visibility outside the hook.
 */
export function getEffectiveVisibility(path: string, visibilityMap: VisibilityMap): boolean {
  const parts = path.split('/');
  for (let i = 1; i < parts.length; i++) {
    const ancestor = parts.slice(0, i).join('/');
    if (ancestor in visibilityMap && visibilityMap[ancestor] === false) return false;
  }
  if (path in visibilityMap) return visibilityMap[path];
  return true;
}

/**
 * Loads and manages per-file/folder public/private visibility for a repository.
 *
 * Default: any path NOT in the table is treated as PUBLIC.
 *
 * CASCADE rule (applied in `isPathVisible`):
 *   If any ancestor folder is private, the path is considered private
 *   regardless of its own setting.
 */
export function useFileVisibility(repoId: string | undefined) {
  const [visibilityMap, setVisibilityMap] = useState<VisibilityMap>({});
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef<Map<string, boolean>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all visibility rows for this repo
  const loadVisibility = useCallback(async () => {
    if (!repoId) return;
    setLoading(true);
    const { data } = await supabase
      .from('file_visibility')
      .select('path, is_public')
      .eq('repo_id', repoId);

    const map: VisibilityMap = {};
    for (const row of data ?? []) {
      map[row.path] = row.is_public;
    }
    setVisibilityMap(map);
    setLoading(false);
  }, [repoId]);

  useEffect(() => {
    loadVisibility();
  }, [loadVisibility]);

  /**
   * Toggle a single path. Batches upserts with a 400ms debounce
   * to avoid excessive DB calls when clicking quickly.
   */
  const setVisibility = useCallback(async (path: string, isPublic: boolean) => {
    if (!repoId) return;

    // Optimistic UI update
    setVisibilityMap(prev => ({ ...prev, [path]: isPublic }));

    // Batch the DB write
    pendingRef.current.set(path, isPublic);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const batch = Array.from(pendingRef.current.entries()).map(([p, pub]) => ({
        repo_id: repoId,
        path: p,
        is_public: pub,
        updated_at: new Date().toISOString(),
      }));
      pendingRef.current.clear();

      await supabase
        .from('file_visibility')
        .upsert(batch, { onConflict: 'repo_id,path' });
    }, 400);
  }, [repoId]);

  /**
   * Returns whether a path should be visible to a non-admin user.
   *
   * Rules:
   * 1. If any ancestor folder is explicitly private → path is hidden.
   * 2. If the path itself is explicitly private → hidden.
   * 3. Otherwise (no row or row with is_public=true) → visible.
   */
  const isPathVisible = useCallback((path: string): boolean => {
    // Check every ancestor
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/');
      if (ancestor in visibilityMap && visibilityMap[ancestor] === false) {
        return false; // parent is private → cascade hide
      }
    }
    // Check self
    if (path in visibilityMap) return visibilityMap[path];
    return true; // default: public
  }, [visibilityMap]);

  return { visibilityMap, loading, isPathVisible, setVisibility, reload: loadVisibility };
}
