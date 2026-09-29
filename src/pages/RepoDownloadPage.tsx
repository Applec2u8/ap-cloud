import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRepo } from '../context/RepoContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useFileVisibility } from '../hooks/useFileVisibility';
import { downloadFilteredZip } from '../lib/downloadFilteredZip';

const RepoDownloadPage: React.FC = () => {
  const { repoName } = useParams<{ repoName: string }>();
  const resolvedRepo  = repoName ?? 'repo';

  const {
    repoInfo, commits, loadingRepo, repoError,
    loadRepo, loadCommits,
  } = useRepo();

  const { isAdmin, loadingAdmin } = useAdmin();
  const { visibilityMap, loading: loadingVis } = useFileVisibility(repoInfo?.id);
  const [error, setError]         = useState<string | null>(null);
  const [started, setStarted]     = useState(false);

  // ── Step 1: load repo + commits if context is empty ────────────────────
  useEffect(() => {
    if (repoInfo && commits.length > 0) return; // already loaded
    if (loadingRepo) return;

    (async () => {
      try {
        let repo = repoInfo;
        if (!repo || repo.name !== resolvedRepo) {
          repo = await loadRepo(resolvedRepo);
        }
        if (!repo) throw new Error('Repository not found.');
        if (commits.length === 0) {
          const list = await loadCommits(repo.id);
          if (list.length === 0) throw new Error('No commits available for this repository.');
        }
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, [resolvedRepo, repoInfo, commits.length, loadingRepo]);

  // ── Step 2: once everything is loaded, trigger filtered download ────────
  useEffect(() => {
    if (started) return;
    if (loadingRepo || loadingAdmin || loadingVis) return;
    if (error || repoError) return;
    if (!repoInfo || commits.length === 0) return;

    setStarted(true);

    (async () => {
      try {
        const latestCommit = commits[0];
        await downloadFilteredZip(
          repoInfo.id,
          latestCommit.commit_hash,
          repoInfo.name,
          visibilityMap,
          isAdmin,
        );
      } catch (err: any) {
        setError(err.message || 'Failed to prepare download.');
      }
    })();
  }, [repoInfo, commits, loadingRepo, loadingAdmin, loadingVis, isAdmin, visibilityMap, error, repoError, started]);

  // ── Error state ─────────────────────────────────────────────────────────
  if (error || repoError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h1 className="text-xl font-bold">Download Failed</h1>
        <p className="text-muted-foreground text-sm text-center max-w-sm">{error || repoError}</p>
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-2 text-sm font-medium hover:bg-muted/70 transition-colors"
        >
          ← Go back
        </button>
      </div>
    );
  }

  // ── Loading / Preparing state ────────────────────────────────────────────
  const statusLine = loadingRepo
    ? 'Loading repository…'
    : loadingVis
    ? 'Checking file permissions…'
    : started
    ? 'Filtering and packaging files…'
    : 'Preparing download…';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-4">
      <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
      <h1 className="text-xl font-bold">Preparing Download…</h1>
      <p className="text-muted-foreground text-sm">{statusLine}</p>
    </div>
  );
};

export default RepoDownloadPage;
