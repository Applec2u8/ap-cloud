import React, { useState } from 'react';
import type { Release } from '../supabaseClient';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trash2, ExternalLink, Copy, Check, Star, ChevronDown, Zap, Link as LinkIcon } from 'lucide-react';

interface ReleaseCardProps {
  release: Release;
  onDelete: (id: string, filename: string) => Promise<void>;
  onVisibilityChange: (release: Release) => Promise<void>;
  visibilityUpdating: boolean;
  onLatestChange: (release: Release) => Promise<void>;
  latestUpdating: boolean;
  baseUrl: string;
  edgeFunctionUrl: string;
}

const formatSize = (bytes: number) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

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

const ReleaseCard: React.FC<ReleaseCardProps> = ({
  release,
  onDelete,
  onVisibilityChange,
  visibilityUpdating,
  onLatestChange,
  latestUpdating,
  baseUrl,
  edgeFunctionUrl,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = async (text: string, key?: string) => {
    await navigator.clipboard.writeText(text);
    if (key) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete release v${release.version}? This cannot be undone.`)) return;
    setDeleting(true);
    await onDelete(release.id, release.filename);
    setDeleting(false);
  };

  return (
    <article className="animate-fade-in flex flex-col rounded-xl border border-border bg-card transition-all duration-200 hover:border-blue-300/60 hover:bg-accent/40 overflow-hidden">
      {/* ── Main Row ── */}
      <div
        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-1 items-start gap-3 sm:items-center">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-gradient-to-br from-blue-50 to-white text-lg dark:from-blue-950/40 dark:to-card">
            {getFileIcon(release.filename)}
          </div>

          {/* Body */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-foreground text-sm" title={release.filename}>
                {release.app_name}
              </span>
              {release.is_latest && (
                <Star className="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400" />
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                v{release.version}
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:block" title={release.filename}>
                📄 {release.filename}
              </span>
              <span className="text-xs text-muted-foreground">💾 {formatSize(release.size)}</span>
              <span className="text-xs text-muted-foreground">📅 {formatDate(release.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex shrink-0 flex-wrap items-center gap-1.5 self-end sm:self-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Latest toggle */}
          <button
            type="button"
            onClick={() => void onLatestChange(release)}
            disabled={latestUpdating || release.is_latest}
            title="Set as latest version"
            className={cn(
              'h-8 min-w-[80px] rounded-full border px-3 text-xs font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70',
              release.is_latest
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-700 dark:text-amber-400'
                : 'border-blue-300/40 bg-blue-500/10 text-blue-700 hover:border-blue-400 hover:bg-blue-500/20 dark:text-blue-300'
            )}
          >
            {latestUpdating ? 'Saving…' : release.is_latest ? '★ Latest' : 'Set Latest'}
          </button>

          {/* Visibility toggle */}
          <button
            type="button"
            onClick={() => void onVisibilityChange(release)}
            disabled={visibilityUpdating}
            title="Toggle public visibility"
            className={cn(
              'h-8 min-w-[72px] rounded-full border px-3 text-xs font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70 hover:brightness-95',
              release.is_public
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'border-red-400/40 bg-red-500/15 text-red-700 dark:text-red-400'
            )}
          >
            {visibilityUpdating ? 'Saving…' : release.is_public ? 'Public' : 'Private'}
          </button>

          {/* View link */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 text-blue-600 border-blue-300/40 hover:bg-blue-500/10 hover:border-blue-400"
          >
            <a href={release.public_url} target="_blank" rel="noreferrer" title="Open file in browser">
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">View</span>
            </a>
          </Button>

          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
            title="Show API endpoints"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')} />
          </Button>

          {/* Delete */}
          <Button
            variant="danger"
            size="icon"
            className="h-8 w-8"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete release"
          >
            {deleting ? (
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Expanded Endpoints ── */}
      {expanded && (() => {
        const dlVersioned = `${baseUrl}/dl/${release.version}`;
        const ENDPOINTS = [
          {
            key: 'edge-fn',
            icon: '⭐',
            label: 'Edge Function (Latest JSON)',
            description: 'Returns the latest release data (if this release is marked as latest)',
            url: edgeFunctionUrl,
            badge: 'application/json ✓',
            badgeColor: 'text-amber-600 border-amber-600/30 bg-amber-600/10 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-400/10',
            code: `# Python Auto-Updater\nimport requests\ndata = requests.get("${edgeFunctionUrl}").json()\nlatest_version = data["version"]\ndownload_url   = data["url"]`,
          },
          {
            key: 'dl-version',
            icon: '🔖',
            label: `Direct Download (v${release.version})`,
            description: 'URL to directly download this specific version',
            url: dlVersioned,
            badge: `v${release.version}`,
            badgeColor: 'text-purple-600 border-purple-600/30 bg-purple-600/10 dark:text-purple-400 dark:border-purple-400/30 dark:bg-purple-400/10',
            code: `# Pin to v${release.version}\nimport requests\nr = requests.get("${dlVersioned}", allow_redirects=True)\nopen("update.exe", "wb").write(r.content)`,
          },
        ];

        return (
          <div className="border-t border-border/50 bg-muted/30 px-4 py-4 dark:bg-muted/10">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-bold text-foreground">Endpoints for v{release.version}</span>
            </div>

            <div className="flex flex-col gap-3">
              {ENDPOINTS.map((ep) => (
                <div key={ep.key} className="rounded-xl border border-border/50 bg-background/50 p-3 shadow-sm dark:bg-background/20">
                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <span className="text-base">{ep.icon}</span>
                    <span className="text-xs font-semibold text-foreground">{ep.label}</span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', ep.badgeColor)}>
                      {ep.badge}
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">{ep.description}</p>

                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2">
                    <LinkIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono text-xs text-blue-600 dark:text-blue-400">{ep.url}</span>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(ep.url, `${ep.key}-url`)}
                      className="flex flex-shrink-0 items-center gap-1 rounded-md border border-border/50 bg-background px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      {copiedKey === `${ep.key}-url` ? (
                        <><Check className="h-3 w-3 text-emerald-500" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy URL</>
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="overflow-x-auto rounded-lg px-3 py-2.5 text-[11px] leading-relaxed dark:bg-accent">{ep.code}</pre>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(ep.code, `${ep.key}-code`)}
                      className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border/50 bg-background px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground dark:bg-black/60 dark:border-white/10 dark:hover:bg-white/10"
                    >
                      {copiedKey === `${ep.key}-code` ? (
                        <><Check className="h-3 w-3 text-emerald-500" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy code</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </article>
  );
};

export default ReleaseCard;
