import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRepo } from '../context/RepoContext';
import { supabase, supabaseUrl } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import DropZone from '../components/DropZone';
import ProgressBar from '../components/ProgressBar';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Settings, Tag, CloudUpload, Package,
  Loader2, CheckCircle2, AlertTriangle,
  Trash2, ExternalLink, Copy, Check, Star, ChevronDown,
  Zap, Link as LinkIcon, Globe, Lock, Code, Plus
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatSize = (bytes: number) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'exe': return '⚙️';
    case 'msi': return '🔧';
    case 'zip': return '🗜️';
    case 'pkg': return '📦';
    case 'dmg': return '💿';
    default: return '📄';
  }
};

// ─── Upload-with-progress via XHR (same pattern as AdminPage) ─────────────────
const uploadWithProgress = (
  path: string,
  file: File,
  onProgress: (v: number) => void,
): Promise<void> => {
  const attempt = (retryCount: number): Promise<void> =>
    new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.open('POST', `${supabaseUrl}/storage/v1/object/updates/${path}`);
      req.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      req.setRequestHeader('Authorization', `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`);
      req.setRequestHeader('x-upsert', 'false');
      req.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 70));
      };
      req.onload = () => {
        if (req.status >= 200 && req.status < 300) resolve();
        else reject(new Error(req.responseText || `Upload failed (${req.status})`));
      };
      req.onerror = () => {
        if (retryCount < 3)
          window.setTimeout(() => void attempt(retryCount + 1).then(resolve).catch(reject), 1000 * (retryCount + 1));
        else reject(new Error('Network error. Upload failed after 3 retries.'));
      };
      req.send(file);
    });
  return attempt(0);
};

// ─── Inline Release Card (repo-scoped) ────────────────────────────────────────
interface RepoReleaseCardProps {
  release: Release;
  onDelete: (id: string, filename: string, version: string, repoId: string) => Promise<void>;
  onLatestChange: (release: Release) => Promise<void>;
  onVisibilityChange: (release: Release) => Promise<void>;
  latestUpdating: boolean;
  visibilityUpdating: boolean;
  baseUrl: string;
  edgeFunctionUrl: string;
}

const RepoReleaseCard: React.FC<RepoReleaseCardProps> = ({
  release, onDelete, onLatestChange, onVisibilityChange,
  latestUpdating, visibilityUpdating, baseUrl, edgeFunctionUrl,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete release v${release.version}? This cannot be undone.`)) return;
    setDeleting(true);
    await onDelete(release.id, release.filename, release.version, release.repository_id ?? '');
    setDeleting(false);
  };

  const dlVersioned = `${baseUrl}/dl/${release.version}`;

  const ENDPOINTS = [
    {
      key: 'edge-fn',
      icon: '⭐',
      label: 'Edge Function (Repo-Scoped Latest JSON)',
      description: 'Returns the latest release scoped to this repository. Ideal for auto-updaters.',
      url: edgeFunctionUrl,
      badge: 'application/json',
      badgeColor: 'text-amber-600 border-amber-600/30 bg-amber-600/10 dark:text-amber-400',
      code: `# Python auto-updater (repo-scoped)\nimport requests\ndata = requests.get("${edgeFunctionUrl}").json()\nprint(data["version"], data["url"])`,
    },
    {
      key: 'dl-version',
      icon: '🔖',
      label: `Direct Download v${release.version}`,
      description: 'Pinned URL that directly downloads this specific version.',
      url: dlVersioned,
      badge: `v${release.version}`,
      badgeColor: 'text-purple-600 border-purple-600/30 bg-purple-600/10 dark:text-purple-400',
      code: `import requests, open\nr = requests.get("${dlVersioned}", allow_redirects=True)\nopen("update.exe", "wb").write(r.content)`,
    },
  ];

  return (
    <article className="flex flex-col rounded-xl border border-border/70 bg-card overflow-hidden transition-all hover:border-blue-400/50 shadow-sm">
      {/* Main card body */}
      <div
        className="p-3.5 sm:p-4 cursor-pointer flex flex-col gap-2.5"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Top row: File icon + Name & Badges + Right controls */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* File icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-base shadow-xs">
              {getFileIcon(release.filename)}
            </div>

            {/* Title & Version info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm leading-tight text-foreground truncate max-w-[200px] sm:max-w-none">
                  {release.app_name}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  v{release.version}
                </span>
                {release.is_latest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    Latest
                  </span>
                )}
              </div>

              {/* Sub-row: Size, Date, Filename */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                <span className="whitespace-nowrap font-medium">💾 {formatSize(release.size)}</span>
                <span className="whitespace-nowrap">📅 {formatDate(release.created_at)}</span>
                <span className="hidden md:inline truncate max-w-[200px] font-mono text-[11px] opacity-75">
                  {release.filename}
                </span>
              </div>
            </div>
          </div>

          {/* Right controls: Expand chevron & Delete */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              title={expanded ? 'Hide endpoints' : 'Show endpoints'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete release"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              {deleting ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Action buttons toolbar: responsive row */}
        <div
          className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-border/30 flex-wrap"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 flex-wrap flex-1 sm:flex-initial">
            {/* Latest */}
            <button
              type="button"
              onClick={() => void onLatestChange(release)}
              disabled={latestUpdating || release.is_latest}
              className={cn(
                'h-7.5 rounded-lg border px-3 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-70 flex items-center gap-1.5 whitespace-nowrap',
                release.is_latest
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 cursor-default'
                  : 'border-border/60 bg-muted/30 text-foreground hover:bg-muted hover:border-blue-500/30 dark:hover:bg-muted/60'
              )}
            >
              {latestUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className={cn("h-3 w-3", release.is_latest && "fill-amber-400 text-amber-400")} />}
              {release.is_latest ? 'Latest' : 'Set Latest'}
            </button>

            {/* Visibility */}
            <button
              type="button"
              onClick={() => void onVisibilityChange(release)}
              disabled={visibilityUpdating}
              className={cn(
                'h-7.5 rounded-lg border px-3 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-70 flex items-center gap-1.5 whitespace-nowrap',
                release.is_public
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-400'
              )}
            >
              {visibilityUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : release.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {release.is_public ? 'Public' : 'Private'}
            </button>

            {/* View */}
            <a
              href={release.public_url}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="h-7.5 inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-500/20 dark:text-blue-300 transition whitespace-nowrap"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </a>
          </div>
        </div>
      </div>


      {/* Expanded endpoints — compact two-column grid */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/20 dark:bg-muted/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Endpoints for v{release.version}</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {ENDPOINTS.map(ep => (
              <div key={ep.key} className="rounded-lg border border-border/50 bg-background/60 p-2.5">
                {/* Header */}
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className="text-sm leading-none">{ep.icon}</span>
                  <span className="text-[11px] font-semibold leading-tight">{ep.label}</span>
                  <span className={cn('rounded-full border px-1.5 py-0 text-[9px] font-bold', ep.badgeColor)}>{ep.badge}</span>
                </div>

                {/* URL row */}
                <div className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/40 px-2 py-1 mb-1.5">
                  <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-mono text-[10px] text-blue-600 dark:text-blue-400">{ep.url}</span>
                  <button
                    type="button"
                    onClick={() => void copy(ep.url, `${ep.key}-url`)}
                    className="shrink-0 flex items-center gap-0.5 rounded border border-border/40 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted transition"
                  >
                    {copiedKey === `${ep.key}-url` ? <><Check className="h-2.5 w-2.5 text-emerald-500" />OK</> : <><Copy className="h-2.5 w-2.5" />Copy</>}
                  </button>
                </div>

                {/* Code block */}
                <div className="relative">
                  <pre className="overflow-x-auto rounded-md bg-muted/50 dark:bg-black/30 px-2.5 py-2 text-[10px] leading-relaxed text-foreground/90">{ep.code}</pre>
                  <button
                    type="button"
                    onClick={() => void copy(ep.code, `${ep.key}-code`)}
                    className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded border border-border/40 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted transition dark:bg-black/60"
                  >
                    {copiedKey === `${ep.key}-code` ? <><Check className="h-2.5 w-2.5 text-emerald-500" />OK</> : <><Copy className="h-2.5 w-2.5" />Copy</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ReleasesPage: React.FC = () => {
  const { owner, repoName } = useParams();
  const resolvedOwner = owner ?? 'ap-cloud';
  const resolvedRepo = repoName ?? 'repo';

  const { repoInfo, loadRepo } = useRepo();

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [appName, setAppName] = useState('');
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLatest, setIsLatest] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showMobileUpload, setShowMobileUpload] = useState(false);

  // Release list state
  const [releases, setReleases] = useState<Release[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [updatingLatestId, setUpdatingLatestId] = useState<string | null>(null);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const baseUrl = window.location.origin;
  const edgeFunctionUrl = repoInfo
    ? `${supabaseUrl}/functions/v1/latest-version?repo_id=${repoInfo.id}`
    : `${supabaseUrl}/functions/v1/latest-version`;

  const showAlert = (type: 'success' | 'error', msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  // ── Load repo if needed ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!repoInfo || repoInfo.name !== resolvedRepo) {
        await loadRepo(resolvedRepo);
      }
    })();
  }, [resolvedRepo]);

  // ── Fetch releases scoped to this repo ────────────────────────────────────
  const fetchReleases = useCallback(async (repoId: string) => {
    setLoadingReleases(true);
    const { data, error } = await supabase
      .from('releases')
      .select('*')
      .eq('repository_id', repoId)
      .order('created_at', { ascending: false });
    if (!error && data) setReleases(data as Release[]);
    setLoadingReleases(false);
  }, []);

  useEffect(() => {
    if (repoInfo?.id) {
      fetchReleases(repoInfo.id);
    }
  }, [repoInfo?.id, fetchReleases]);

  // ── Upload ───────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !appName.trim() || !version.trim()) {
      showAlert('error', 'Please fill in all fields and select a file.');
      return;
    }
    if (!repoInfo) {
      showAlert('error', 'Repository not loaded. Please wait and retry.');
      return;
    }

    // Uniqueness check within this repo
    const existing = releases.find(r => r.version === version.trim());
    if (existing) {
      showAlert('error', `v${version.trim()} already exists for this repository.`);
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const safeName = file.name.replace(/\s+/g, '_');
      // Storage path scoped to repo: releases/{repoId}/{version}/{filename}
      const storagePath = `releases/${repoInfo.id}/${version.trim()}/${safeName}`;

      await uploadWithProgress(storagePath, file, (p) => setProgress(10 + p));
      setProgress(65);

      const { data: urlData } = supabase.storage.from('updates').getPublicUrl(storagePath);
      setProgress(80);

      const { data: inserted, error: dbError } = await supabase
        .from('releases')
        .insert({
          app_name: appName.trim(),
          version: version.trim(),
          filename: safeName,
          size: file.size,
          public_url: urlData.publicUrl,
          release_notes: releaseNotes.trim() || null,
          is_public: isPublic,
          is_latest: false,
          repository_id: repoInfo.id,
        })
        .select('id')
        .single();

      if (dbError) throw dbError;

      if (isLatest) {
        const { error: latestErr } = await supabase.rpc('set_latest_release_for_repo', {
          target_release_id: inserted.id,
          target_repo_id: repoInfo.id,
        });
        if (latestErr) throw latestErr;
      }

      setProgress(100);
      showAlert('success', `✅ v${version.trim()} uploaded successfully!`);

      // Reset form
      setFile(null);
      setAppName('');
      setVersion('');
      setReleaseNotes('');
      setIsPublic(true);
      setIsLatest(false);
      setShowMobileUpload(false);
      setTimeout(() => setProgress(0), 800);

      await fetchReleases(repoInfo.id);
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // ── Latest change ────────────────────────────────────────────────────────────
  const handleLatestChange = async (release: Release) => {
    if (!repoInfo || release.is_latest) return;
    setUpdatingLatestId(release.id);
    try {
      const { error } = await supabase.rpc('set_latest_release_for_repo', {
        target_release_id: release.id,
        target_repo_id: repoInfo.id,
      });
      if (error) throw error;
      await fetchReleases(repoInfo.id);
      showAlert('success', `v${release.version} is now the latest.`);
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'Could not set latest.');
    } finally {
      setUpdatingLatestId(null);
    }
  };

  // ── Visibility change ────────────────────────────────────────────────────────
  const handleVisibilityChange = async (release: Release) => {
    if (!repoInfo) return;
    setUpdatingVisibilityId(release.id);
    try {
      const { error } = await supabase
        .from('releases')
        .update({ is_public: !release.is_public })
        .eq('id', release.id);
      if (error) throw error;
      await fetchReleases(repoInfo.id);
      showAlert('success', `v${release.version} is now ${!release.is_public ? 'Public' : 'Private'}.`);
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'Could not update visibility.');
    } finally {
      setUpdatingVisibilityId(null);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string, filename: string, version: string, repoId: string) => {
    if (!repoId) return;
    const storagePath = `releases/${repoId}/${version}/${filename}`;
    await supabase.storage.from('updates').remove([storagePath]);
    await supabase.from('releases').delete().eq('id', id);
    setReleases(prev => prev.filter(r => r.id !== id));
    showAlert('success', 'Release deleted.');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-sm shadow-sm flex-shrink-0">☁️</Link>
            <div className="text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
              <Link to="#" className="text-blue-500 hover:underline shrink-0 max-w-[70px] sm:max-w-[120px] truncate">{resolvedOwner}</Link>
              <span className="text-muted-foreground shrink-0">/</span>
              <Link to={`/repo/${resolvedOwner}/${resolvedRepo}`} className="font-bold hover:underline truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">{resolvedRepo}</Link>
              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider shrink-0 px-1.5 py-0">
                {repoInfo?.visibility === 'private' ? 'Private' : 'Public'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeSwitcher />
            <Button variant="secondary" size="sm" asChild>
              <Link to="/cloud-admin" className="h-8 gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-4">
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">Back to Admin</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mx-auto max-w-6xl px-3 sm:px-6 flex gap-1 border-t border-border/40 overflow-x-auto no-scrollbar flex-nowrap">
          {[
            { label: 'Code', to: `/repo/${resolvedOwner}/${resolvedRepo}`, icon: <Code className="h-3.5 w-3.5" />, active: false },
            { label: 'Releases', to: `/repo/${resolvedOwner}/${resolvedRepo}/releases`, icon: <Tag className="h-3.5 w-3.5" />, active: true },
            { label: 'Links', to: `/repo/${resolvedOwner}/${resolvedRepo}/links`, icon: <LinkIcon className="h-3.5 w-3.5" />, active: false },
            { label: 'Settings', to: `/repo/${resolvedOwner}/${resolvedRepo}/settings`, icon: <Settings className="h-3.5 w-3.5" />, active: false },
          ].map(tab => (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px shrink-0 whitespace-nowrap
                ${tab.active
                  ? 'border-blue-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">

          {/* Page header */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-500" />
                Releases
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Manage binary releases for <strong>{resolvedRepo}</strong> — each release is scoped to this repository.
              </p>
            </div>
            {/* Mobile toggle button: + New Release */}
            <div className="lg:hidden self-start sm:self-auto">
              <Button
                type="button"
                size="sm"
                variant={showMobileUpload ? "secondary" : "default"}
                onClick={() => setShowMobileUpload(p => !p)}
                className="gap-1.5 rounded-full text-xs font-semibold h-8.5 px-4 shadow-sm"
              >
                {showMobileUpload ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 rotate-180 transition-transform" /> Hide Form
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> New Release
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.45fr] items-start">
            {/* ── Upload Form ── */}
            <div className={cn(
              "transition-all duration-300",
              showMobileUpload ? "block mb-2 animate-fade-in" : "hidden lg:block"
            )}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upload New Release</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 border-b border-border/60 flex items-center gap-2">
                  <CloudUpload className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-semibold">New Release</span>
                </div>
                <form onSubmit={handleUpload} className="p-4 flex flex-col gap-3">
                  {/* App Name */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="rp-app-name" className="text-xs font-medium">App Name</label>
                    <input
                      id="rp-app-name"
                      type="text"
                      placeholder="e.g. MyApp Desktop"
                      value={appName}
                      onChange={e => setAppName(e.target.value)}
                      disabled={uploading}
                      className="rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    />
                  </div>

                  {/* Version */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="rp-version" className="text-xs font-medium">Version</label>
                    <input
                      id="rp-version"
                      type="text"
                      placeholder="e.g. 1.2.0"
                      value={version}
                      onChange={e => setVersion(e.target.value)}
                      disabled={uploading}
                      className="rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    />
                    <p className="text-[11px] text-muted-foreground">Version must be unique per repo.</p>
                  </div>

                  {/* Release notes */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="rp-notes" className="text-xs font-medium">
                      Release Notes <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="rp-notes"
                      rows={2}
                      placeholder="What's new in this version..."
                      value={releaseNotes}
                      onChange={e => setReleaseNotes(e.target.value)}
                      disabled={uploading}
                      className="rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    />
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <div
                        className={cn(
                          'h-3.5 w-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          isPublic ? 'border-emerald-500 bg-emerald-500' : 'border-border bg-transparent'
                        )}
                        onClick={() => !uploading && setIsPublic(p => !p)}
                      >
                        {isPublic && <Check className="h-2 w-2 text-white" />}
                      </div>
                      <span className="text-xs leading-tight">
                        <strong className="font-semibold flex items-center gap-1">
                          {isPublic ? <Globe className="h-3 w-3 text-emerald-500" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
                          Make public
                        </strong>
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2">
                      <div
                        className={cn(
                          'h-3.5 w-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          isLatest ? 'border-amber-500 bg-amber-500' : 'border-border bg-transparent'
                        )}
                        onClick={() => !uploading && setIsLatest(p => !p)}
                      >
                        {isLatest && <Check className="h-2 w-2 text-white" />}
                      </div>
                      <span className="text-xs leading-tight">
                        <strong className="font-semibold flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500" />
                          Set as Latest
                        </strong>
                      </span>
                    </label>
                  </div>

                  {/* Drop zone */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">File</label>
                    <DropZone onFileSelected={setFile} disabled={uploading} />
                  </div>

                  {uploading && <ProgressBar progress={progress} label="Uploading to Supabase..." />}

                  <Button
                    type="submit"
                    id="rp-upload-btn"
                    disabled={uploading || !file || !appName || !version || !repoInfo}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {uploading
                      ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Uploading...</>
                      : <><CloudUpload className="h-4 w-4" />Upload Release</>
                    }
                  </Button>
                </form>
              </div>
            </div>

            {/* ── Release List ── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Repository Releases
                </span>
                {!loadingReleases && (
                  <Badge variant="default" className="text-xs">{releases.length}</Badge>
                )}
                <div className="flex-1 h-px bg-border" />
              </div>

              {!repoInfo || loadingReleases ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">{!repoInfo ? 'Loading repository…' : 'Loading releases…'}</span>
                </div>
              ) : releases.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground rounded-xl border border-dashed border-border/60">
                  <Package className="h-10 w-10 opacity-40" />
                  <p className="font-semibold text-foreground">No releases yet</p>
                  <p className="text-sm">Upload your first release using the form.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {releases.map(r => (
                    <RepoReleaseCard
                      key={r.id}
                      release={r}
                      onDelete={handleDelete}
                      onLatestChange={handleLatestChange}
                      onVisibilityChange={handleVisibilityChange}
                      latestUpdating={updatingLatestId === r.id}
                      visibilityUpdating={updatingVisibilityId === r.id}
                      baseUrl={baseUrl}
                      edgeFunctionUrl={edgeFunctionUrl}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Toast alert */}
      {alert && (
        <div className={cn(
          'fixed bottom-6 right-6 z-[1000] flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl',
          'w-[min(390px,calc(100vw-32px))] backdrop-blur-sm',
          alert.type === 'success'
            ? 'border-green-500/30 bg-green-500/10 text-green-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        )}>
          {alert.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            : <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
          {alert.msg}
        </div>
      )}

      <footer className="border-t border-border py-8 mt-12">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 sm:mb-0">
            <span className="text-lg">☁️</span>
            <span className="font-semibold text-foreground">AP-Cloud</span>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground hover:underline transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground hover:underline transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground hover:underline transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ReleasesPage;
