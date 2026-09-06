import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseUrl } from '../supabaseClient';
import type { Release } from '../supabaseClient';
import { cn } from '@/lib/utils';
import {
  Tag, Download, ChevronDown, Copy, Check,
  Star, Link as LinkIcon, Loader2, Package,
} from 'lucide-react';

interface RepoReleasesSidebarProps {
  repoId: string;
  owner: string;
  repoName: string;
}

const formatSize = (bytes: number) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const RepoReleasesSidebar: React.FC<RepoReleasesSidebarProps> = ({ repoId, owner, repoName }) => {
  const [latest, setLatest] = useState<Release | null>(null);
  const [recentCount, setRecentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const baseUrl = window.location.origin;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/latest-version?repo_id=${repoId}`;
  const dlUrl = latest ? `${baseUrl}/dl/${latest.version}` : '';

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fetch latest release for this repo
      const { data: latestData } = await supabase
        .from('releases')
        .select('*')
        .eq('repository_id', repoId)
        .eq('is_latest', true)
        .maybeSingle();

      // Count all releases for this repo
      const { count } = await supabase
        .from('releases')
        .select('id', { count: 'exact', head: true })
        .eq('repository_id', repoId);

      setLatest(latestData as Release | null);
      setRecentCount(count ?? 0);
      setLoading(false);
    })();
  }, [repoId]);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Tag className="h-4 w-4 text-blue-500" />
          Releases
        </div>
        <Link
          to={`/repo/${owner}/${repoName}/releases`}
          className="text-xs text-blue-500 hover:underline font-medium"
        >
          View all →
        </Link>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading releases…</span>
          </div>
        ) : !latest ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <Package className="h-8 w-8 opacity-40" />
            <p className="text-xs font-medium">No releases yet</p>
            <Link
              to={`/repo/${owner}/${repoName}/releases`}
              className="text-xs text-blue-500 hover:underline"
            >
              Create first release →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Latest release card */}
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              {/* Version badge + star */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                    v{latest.version}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Latest</span>
              </div>

              {/* App name & meta */}
              <p className="text-sm font-semibold truncate mb-1">{latest.app_name}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="whitespace-nowrap font-medium">💾 {formatSize(latest.size)}</span>
                <span className="whitespace-nowrap">📅 {formatDate(latest.created_at)}</span>
              </div>

              {latest.release_notes && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">
                  {latest.release_notes}
                </p>
              )}
            </div>

            {/* Download button */}
            <a
              href={latest.public_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 transition-colors"
              id="sidebar-download-btn"
            >
              <Download className="h-4 w-4" />
              Download {latest.filename.split('.').pop()?.toUpperCase()}
            </a>

            {/* Endpoints accordion */}
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              id="sidebar-endpoints-toggle"
            >
              <span className="flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" />
                Auto-updater endpoints
              </span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>

            {expanded && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-3">
                {/* Edge function URL */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                    ⭐ Latest JSON (auto-updater)
                  </p>
                  <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/60 px-2.5 py-1.5">
                    <span className="flex-1 truncate font-mono text-[10px] text-blue-600 dark:text-blue-400">
                      {edgeFunctionUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copy(edgeFunctionUrl, 'edge-url')}
                      className="flex shrink-0 items-center gap-0.5 rounded border border-border/50 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition"
                    >
                      {copiedKey === 'edge-url' ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
                    </button>
                  </div>
                </div>

                {/* Direct download URL */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                    🔖 Direct download URL
                  </p>
                  <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/60 px-2.5 py-1.5">
                    <span className="flex-1 truncate font-mono text-[10px] text-purple-600 dark:text-purple-400">
                      {dlUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copy(dlUrl, 'dl-url')}
                      className="flex shrink-0 items-center gap-0.5 rounded border border-border/50 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition"
                    >
                      {copiedKey === 'dl-url' ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
                    </button>
                  </div>
                </div>

                {/* Python snippet */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                    🐍 Python auto-updater
                  </p>
                  <div className="relative">
                    <pre className="overflow-x-auto rounded-md bg-muted/40 dark:bg-accent px-3 py-2 text-[10px] leading-relaxed text-foreground">
                      {`import requests
data = requests.get("${edgeFunctionUrl}").json()
print(data["version"], data["url"])`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => void copy(`import requests\ndata = requests.get("${edgeFunctionUrl}").json()\nprint(data["version"], data["url"])`, 'py-code')}
                      className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded border border-border/50 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition dark:bg-black/60"
                    >
                      {copiedKey === 'py-code' ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Releases count footer */}
            <Link
              to={`/repo/${owner}/${repoName}/releases`}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <Tag className="h-3.5 w-3.5" />
              {recentCount} release{recentCount !== 1 ? 's' : ''} total
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RepoReleasesSidebar;
